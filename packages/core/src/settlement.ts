import type { RuleSet } from '@cp/rules';
import { Fraction, ZERO } from './fraction.js';
import type { IssueList } from './issues.js';
import type { Advance, Conversion, Expense, ExpensePayer, TripInput } from './model.js';
import { convertToCzk, formatMoney, impliedRate, isCurrencyCode, minorPerUnit, roundMinor } from './money.js';
import { exactForeignTotals, type PerDiemResult } from './perDiem.js';
import { datePart } from './time.js';
import type { VehicleResult } from './vehicle.js';

export interface ExpenseResult {
  id: string;
  order: number;
  category: string;
  amount: number;
  currency: string;
  /** Částka v Kč (haléře). U výdaje ze zálohy přepočtená kurzem zálohy. */
  czk: number;
  rate?: string;
  rateUnit?: number;
  rateSource?: Conversion['source'];
  payer: ExpensePayer;
  reimbursable: boolean;
}

export interface CurrencySettlement {
  currency: string;
  /** Nárok v měně: zahraniční stravné + kapesné + výdaje uhrazené ze zálohy. */
  perDiem: number;
  pocketMoney: number;
  /** Přesné stravné + kapesné, pokud se liší od zaokrouhleného na centy (desetinné číslo s tečkou, 4 místa). */
  perDiemExact?: string;
  fromAdvance: number;
  claim: number;
  advance: number;
  /** > 0 doplatek zaměstnanci, < 0 vratka zaměstnance. */
  balance: number;
  rate?: string;
  rateUnit?: number;
  balanceCzk: number;
}

export interface Settlement {
  currencies: CurrencySettlement[];
  /** Zahraniční stravné v měnách bez zálohy přepočtené na Kč. */
  convertedPerDiem: { currency: string; amount: number; exactAmount?: string; rate: string; rateUnit: number; czk: number }[];
  domesticPerDiemCzk: number;
  employeeExpensesCzk: number;
  vehicleCzk: number;
  claimCzk: number;
  advanceCzk: number;
  /** Přesná částka k výplatě (záporná = vratka zaměstnance). */
  payoutExact: number;
  payout: number;
  employerPaidCzk: number;
  totalCostCzk: number;
}

const PRIVATE_PAYMENT = new Set(['PRIVATE_CARD', 'EMPLOYEE_TRANSFER']);

/** Částka v nejmenších jednotkách jako desetinné číslo v jednotkách měny na 4 místa, např. „159.1667“. */
function decimal4(minor: Fraction, currency: string): string {
  const scaled = minor.div(minorPerUnit(currency)).mul(10000).toInt('HALF_UP');
  return (scaled / 10000).toFixed(4);
}

/** Přepočet přesné částky (v nejmenších jednotkách) na Kč, zaokrouhleno na haléře. */
function exactToCzk(minor: Fraction, currency: string, rate: string, unit: number): number {
  return minor.div(minorPerUnit(currency)).mul(Fraction.parse(rate)).div(unit).mul(100).toInt('HALF_UP');
}

function rateOf(c: Conversion | undefined): { rate: string; unit: number } | undefined {
  return c?.rate ? { rate: c.rate, unit: c.unit ?? 1 } : undefined;
}

export function computeExpenses(trip: TripInput, issues: IssueList): ExpenseResult[] {
  const advanceByCurrency = new Map<string, Advance>();
  for (const a of trip.advances) advanceByCurrency.set(a.amount.currency, a);
  const start = datePart(trip.start);
  const end = datePart(trip.end);
  const seen = new Map<string, Expense>();

  return [...trip.expenses]
    .sort((a, b) => a.order - b.order)
    .flatMap((e): ExpenseResult[] => {
      const ref = { expenseId: e.id };
      const name = `Výdaj č. ${e.order} (${e.category})`;
      const reimbursable = e.reimbursable ?? true;
      if (!Number.isInteger(e.amount.amount) || e.amount.amount <= 0) {
        issues.error('EXPENSE_INVALID_AMOUNT', `${name}: částka musí být kladné číslo.`, ref);
        return [];
      }
      if (!isCurrencyCode(e.amount.currency)) {
        issues.error('EXPENSE_INVALID_CURRENCY', `${name}: neznámá měna „${e.amount.currency}“. Použijte třípísmenný kód (např. EUR).`, ref);
        return [];
      }
      if (e.date < start || e.date > end) {
        issues.warning('EXPENSE_OUTSIDE_TRIP', `${name} má datum ${e.date} mimo dobu cesty. Zkontrolujte datum nebo připojte vysvětlení.`, ref);
      }
      if (e.attachments) {
        if (e.attachments.accounting === 0) issues.warning('EXPENSE_NO_DOCUMENT', `${name} nemá účetní doklad. Přiložte doklad nebo vysvětlení jeho chybění.`, ref);
        if (e.attachments.payment === 0 && PRIVATE_PAYMENT.has(e.paymentMethod) && e.amount.currency !== 'CZK') {
          issues.warning('EXPENSE_NO_PAYMENT_PROOF', `${name} byl placen soukromě v cizí měně bez dokladu o zaplacení. Účetní ho může vyžadovat.`, ref);
        }
      }
      const key = e.documentNumber ? `doc:${e.documentNumber}` : `${e.supplier ?? ''}|${e.date}|${e.amount.amount}|${e.amount.currency}`;
      const dup = seen.get(key);
      if (dup && (e.documentNumber || e.supplier)) {
        issues.warning('EXPENSE_POSSIBLE_DUPLICATE', `${name} se shoduje s výdajem č. ${dup.order} (${e.documentNumber ? 'číslo dokladu' : 'dodavatel, datum a částka'}). Ověřte, že nejde o duplicitu.`, ref);
      }
      seen.set(key, e);

      const base = { id: e.id, order: e.order, category: e.category, amount: e.amount.amount, currency: e.amount.currency, payer: e.payer, reimbursable };
      if (e.amount.currency === 'CZK') return [{ ...base, czk: e.amount.amount }];

      if (e.payer === 'ADVANCE') {
        const adv = advanceByCurrency.get(e.amount.currency);
        const r = rateOf(adv?.conversion);
        if (!adv || !r) {
          issues.error('EXPENSE_ADVANCE_MISSING', `${name} je uhrazen ze zálohy v ${e.amount.currency}, ale taková záloha s kurzem není zadána. Doplňte zálohu nebo změňte způsob úhrady.`, ref);
          return [];
        }
        return [{ ...base, czk: convertToCzk(e.amount, r.rate, r.unit), rate: r.rate, rateUnit: r.unit, rateSource: 'ADVANCE_RATE' }];
      }

      const c = e.conversion;
      if (c?.source === 'BANK_CONFIRMATION') {
        if (!c.czkAmount || c.czkAmount <= 0) {
          issues.error('EXPENSE_MISSING_RATE', `${name}: u přepočtu podle potvrzení banky zadejte strženou částku v Kč.`, ref);
          return [];
        }
        return [{ ...base, czk: c.czkAmount, rate: impliedRate(e.amount, c.czkAmount), rateUnit: 1, rateSource: c.source }];
      }
      const r = rateOf(c);
      if (!c || !r) {
        issues.error('EXPENSE_MISSING_RATE', `${name}: chybí kurz pro přepočet ${e.amount.currency} na Kč. Načtěte kurz ČNB nebo zadejte kurz z dokladu.`, ref);
        return [];
      }
      if (c.source === 'MANUAL') {
        issues.warning('EXPENSE_MANUAL_RATE', `${name}: kurz ${r.rate} byl zadán ručně${c.manualReason ? ` (${c.manualReason})` : ''}. Bude výrazně uveden ve vyúčtování.`, ref);
      }
      return [{ ...base, czk: convertToCzk(e.amount, r.rate, r.unit), rate: r.rate, rateUnit: r.unit, rateSource: c.source }];
    });
}

export function settle(
  trip: TripInput,
  rules: RuleSet,
  perDiem: PerDiemResult,
  expenses: ExpenseResult[],
  vehicle: VehicleResult | undefined,
  issues: IssueList,
): Settlement {
  const advances = new Map<string, number>();
  const advanceRates = new Map<string, { rate: string; unit: number }>();
  for (const a of trip.advances) {
    advances.set(a.amount.currency, (advances.get(a.amount.currency) ?? 0) + a.amount.amount);
    const r = rateOf(a.conversion);
    if (r) advanceRates.set(a.amount.currency, r);
    else if (a.amount.currency !== 'CZK') {
      issues.error('ADVANCE_MISSING_RATE', `Záloha ${formatMoney(a.amount)} nemá kurz pro přepočet. Zadejte kurz ze dne poskytnutí zálohy.`, { advanceId: a.id });
    }
  }

  const foreignCurrencies = new Set([...Object.keys(perDiem.foreignTotals), ...Object.keys(perDiem.pocketMoneyTotals), ...advances.keys()]);
  foreignCurrencies.delete('CZK');
  const currencies: CurrencySettlement[] = [];
  const convertedPerDiem: Settlement['convertedPerDiem'] = [];
  const exact = exactForeignTotals.get(perDiem);
  // Přesné stravné + kapesné v měně; bez přesných součtů (starší výsledek) součet zaokrouhlených dní.
  const exactPerDiem = (cur: string) =>
    exact ? (exact.perDiem[cur] ?? ZERO).add(exact.pocketMoney[cur] ?? ZERO) : Fraction.of((perDiem.foreignTotals[cur] ?? 0) + (perDiem.pocketMoneyTotals[cur] ?? 0));

  for (const cur of [...foreignCurrencies].sort()) {
    const pd = perDiem.foreignTotals[cur] ?? 0;
    const pm = perDiem.pocketMoneyTotals[cur] ?? 0;
    const fromAdvance = expenses.filter((e) => e.payer === 'ADVANCE' && e.currency === cur).reduce((s, e) => s + e.amount, 0);
    const adv = advances.get(cur);
    if (adv === undefined) {
      // Bez zálohy v této měně se stravné přepočte na Kč kurzem, který dodá aplikace (Ú-10).
      const r = rateOf(trip.perDiemRates?.[cur]);
      if (!r) {
        issues.error('PER_DIEM_MISSING_RATE', `Chybí kurz pro přepočet zahraničního stravného v ${cur} na Kč. Načtěte kurz ČNB.`, { currency: cur });
        continue;
      }
      const e = exactPerDiem(cur);
      const amount = e.toInt('HALF_UP');
      const exactAmount = e.cmp(Fraction.of(amount)) === 0 ? undefined : decimal4(e, cur);
      convertedPerDiem.push({ currency: cur, amount, ...(exactAmount && { exactAmount }), rate: r.rate, rateUnit: r.unit, czk: exactToCzk(e, cur, r.rate, r.unit) });
      continue;
    }
    const e = exactPerDiem(cur);
    const exactBalance = e.add(Fraction.of(fromAdvance - adv));
    const claim = e.add(Fraction.of(fromAdvance)).toInt('HALF_UP');
    const balance = exactBalance.toInt('HALF_UP');
    const r = advanceRates.get(cur);
    const perDiemExact = e.cmp(Fraction.of(pd + pm)) === 0 ? undefined : decimal4(e, cur);
    currencies.push({
      currency: cur,
      perDiem: pd,
      pocketMoney: pm,
      ...(perDiemExact && { perDiemExact }),
      fromAdvance,
      claim,
      advance: adv,
      balance,
      ...(r && { rate: r.rate, rateUnit: r.unit }),
      balanceCzk: r ? exactToCzk(exactBalance, cur, r.rate, r.unit) : 0,
    });
  }

  const employeeExpensesCzk = expenses.filter((e) => e.payer === 'EMPLOYEE' && e.reimbursable).reduce((s, e) => s + e.czk, 0);
  const employerPaidCzk = expenses.filter((e) => e.payer === 'EMPLOYER').reduce((s, e) => s + e.czk, 0);
  const vehicleCzk = vehicle?.total ?? 0;
  const convertedCzk = convertedPerDiem.reduce((s, c) => s + c.czk, 0);
  // Výdaje z korunové zálohy se započítají do nároku, aby se vyrovnaly se zálohou.
  const czkFromAdvance = expenses.filter((e) => e.payer === 'ADVANCE' && e.currency === 'CZK').reduce((s, e) => s + e.czk, 0);
  const claimCzk = perDiem.domesticTotal + employeeExpensesCzk + vehicleCzk + convertedCzk + czkFromAdvance;
  const advanceCzk = advances.get('CZK') ?? 0;
  const payoutExact = claimCzk - advanceCzk + currencies.reduce((s, c) => s + c.balanceCzk, 0);
  const payout = Math.sign(payoutExact) * roundMinor(Fraction.of(Math.abs(payoutExact)), rules.rounding.payout, 'CZK');

  // Celkové náklady cesty v Kč: vše, co zaměstnavatel za cestu vynaloží.
  const foreignAdvanceCostCzk = currencies.reduce((s, c) => {
    const r = c.rate ? { rate: c.rate, unit: c.rateUnit ?? 1 } : undefined;
    return s + (r ? exactToCzk(exactPerDiem(c.currency), c.currency, r.rate, r.unit) : 0);
  }, 0);
  const fromAdvanceCzk = expenses.filter((e) => e.payer === 'ADVANCE' && e.currency !== 'CZK').reduce((s, e) => s + e.czk, 0);
  const totalCostCzk = claimCzk + foreignAdvanceCostCzk + fromAdvanceCzk + employerPaidCzk;

  return {
    currencies,
    convertedPerDiem,
    domesticPerDiemCzk: perDiem.domesticTotal,
    employeeExpensesCzk,
    vehicleCzk,
    claimCzk,
    advanceCzk,
    payoutExact,
    payout,
    employerPaidCzk,
    totalCostCzk,
  };
}
