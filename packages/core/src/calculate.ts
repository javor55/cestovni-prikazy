import { ruleSets as defaultRuleSets, type RuleSet } from '@cp/rules';
import { IssueList, type Issue } from './issues.js';
import type { TripInput } from './model.js';
import { computePerDiem, type PerDiemResult } from './perDiem.js';
import { computeExpenses, settle, type ExpenseResult, type Settlement } from './settlement.js';
import { datePart, isLocalDateTime } from './time.js';
import { buildTimeline } from './timeline.js';
import { computeVehicle, type VehicleResult } from './vehicle.js';

export interface CalculationResult {
  /** false = výpočet obsahuje blokující chyby a částky nejsou spolehlivé. */
  ok: boolean;
  ruleSet?: { id: string; version: string; verification: string; assumptions: RuleSet['assumptions'] };
  perDiem?: PerDiemResult;
  expenses: ExpenseResult[];
  vehicle?: VehicleResult;
  settlement?: Settlement;
  issues: Issue[];
}

/**
 * Vypočítá cestovní náhrady. Čistá funkce: stejný vstup a stejná sada pravidel dají vždy stejný výsledek.
 * Kurzy ČNB, aktuální čas ani jiné vnější údaje nečte – vše musí být ve vstupu.
 */
export function calculate(trip: TripInput, sets: readonly RuleSet[] = defaultRuleSets): CalculationResult {
  const issues = new IssueList();
  const fail = (): CalculationResult => ({ ok: false, expenses: [], issues: issues.items });

  if (!isLocalDateTime(trip.start) || !isLocalDateTime(trip.end)) {
    issues.error('INVALID_TIME', 'Zadejte skutečný začátek a konec cesty (datum a čas).');
    return fail();
  }
  const startDate = datePart(trip.start);
  const endDate = datePart(trip.end);
  const rules = sets.find((s) => s.validFrom <= startDate && startDate <= s.validTo);
  if (!rules) {
    issues.error('RULESET_MISSING', `Pro datum ${startDate} nejsou k dispozici sazby cestovních náhrad. Aplikaci je potřeba aktualizovat.`);
    return fail();
  }
  if (endDate > rules.validTo) {
    issues.error('RULESET_MISSING', `Cesta pokračuje po ${rules.validTo}, pro další období nejsou sazby k dispozici. Aplikaci je potřeba aktualizovat.`);
    return fail();
  }

  const timeline = buildTimeline(trip, issues);
  if (!timeline) return fail();

  const perDiem = computePerDiem(trip, timeline, rules, issues);
  const expenses = computeExpenses(trip, issues);
  const vehicle = computeVehicle(trip, rules, issues, expenses);
  const settlement = settle(trip, rules, perDiem, expenses, vehicle, issues);

  issues.info('RULESET_USED', `Výpočet podle sady pravidel ${rules.id} verze ${rules.version}.`);
  if (trip.vehicle && expenses.some((e) => e.category === 'Pohonné hmoty' && e.reimbursable)) {
    issues.warning('FUEL_EXPENSE_WITH_VEHICLE', 'Pohonné hmoty jsou uvedeny jako proplácený výdaj a zároveň se počítá náhrada za vozidlo. Doklad o tankování obvykle slouží jen k určení ceny PHM.');
  }

  return {
    ok: !issues.hasErrors,
    ruleSet: { id: rules.id, version: rules.version, verification: rules.verification, assumptions: rules.assumptions },
    perDiem,
    expenses,
    ...(vehicle && { vehicle }),
    settlement,
    issues: issues.items,
  };
}
