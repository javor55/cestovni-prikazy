import type { Issue } from '@cp/core';
import type { TripDoc } from '../model/trip.js';

export const steps = [
  { slug: 'kdo', title: 'Kdo cestuje' },
  { slug: 'cesta', title: 'Údaje o cestě' },
  { slug: 'prubeh', title: 'Průběh cesty' },
  { slug: 'jidla', title: 'Bezplatná jídla' },
  { slug: 'vydaje', title: 'Výdaje' },
  { slug: 'vozidlo', title: 'Vozidlo' },
  { slug: 'souhrn', title: 'Souhrn' },
  { slug: 'kontrola', title: 'Kontrola' },
  { slug: 'pdf', title: 'PDF k podpisu' },
  { slug: 'podpis', title: 'Podpis' },
  { slug: 'kompletni', title: 'Kompletní PDF' },
  { slug: 'export', title: 'Exporty' },
] as const;

export type StepSlug = (typeof steps)[number]['slug'];

const prefixes: [RegExp, StepSlug][] = [
  [/^(SEGMENT_|CROSSING_|MISSING_BORDER|TRIP_|KIND_|INVALID_TIME)/, 'prubeh'],
  [/^EXPENSE_|^FUEL_EXPENSE/, 'vydaje'],
  [/^(VEHICLE_|FUEL_PRICE|COMPANY_VEHICLE)/, 'vozidlo'],
  [/^(DOMESTIC_RATE|POCKET_MONEY)/, 'kdo'],
  [/^(ADVANCE_|RULESET_MISSING)/, 'cesta'],
  [/^(FOREIGN_RATE|PER_DIEM)/, 'souhrn'],
];

/** Krok průvodce, ve kterém se dá problém opravit. */
export function stepOf(issue: Issue): StepSlug | undefined {
  const explicit = issue.ref?.step as StepSlug | undefined;
  if (explicit) return explicit;
  return prefixes.find(([re]) => re.test(issue.code))?.[1];
}

export type StepState = 'done' | 'warning' | 'error' | 'todo';

/** Stav kroku pro navigaci: povinné údaje a chyby/varování, které do kroku patří. */
export function stepState(slug: StepSlug, trip: TripDoc, issues: Issue[]): StepState {
  const mine = issues.filter((i) => stepOf(i) === slug);
  if (mine.some((i) => i.severity === 'error')) return 'error';
  const filled: Partial<Record<StepSlug, boolean>> = {
    kdo: Boolean(trip.employee.name && trip.employee.regularWorkplace && trip.employer.name),
    cesta: Boolean(trip.purpose && trip.plannedStart && trip.plannedEnd),
    prubeh: trip.segments.length > 0,
  };
  if (filled[slug] === false) return 'todo';
  if (mine.some((i) => i.severity === 'warning')) return 'warning';
  return slug === 'pdf' || slug === 'podpis' || slug === 'kompletni' || slug === 'export' ? 'todo' : 'done';
}
