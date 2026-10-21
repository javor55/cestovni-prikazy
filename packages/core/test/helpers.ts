import type { BorderCrossing, Expense, Segment, TripInput } from '../src/index.js';

let seq = 0;

export function seg(from: string, to: string, departure: string, arrival: string, extra: Partial<Segment> = {}): Segment {
  const [fp, fc] = from.split('/') as [string, string];
  const [tp, tc] = to.split('/') as [string, string];
  return {
    id: `s${++seq}`,
    from: { place: fp, country: fc },
    to: { place: tp, country: tc },
    departure,
    arrival,
    transport: 'auto',
    ...extra,
  };
}

export const cross = (at: string, from: string, to: string): BorderCrossing => ({ at, from, to });

export function trip(partial: Partial<TripInput> & Pick<TripInput, 'start' | 'end'>): TripInput {
  return {
    sector: 'business',
    kind: 'domestic',
    segments: [],
    meals: [],
    expenses: [],
    advances: [],
    ...partial,
  };
}

export function expense(partial: Partial<Expense> & Pick<Expense, 'amount'>): Expense {
  const n = ++seq;
  return {
    id: `e${n}`,
    order: n,
    category: 'Ostatní',
    description: '',
    date: '2026-03-10',
    paymentMethod: 'PRIVATE_CARD',
    payer: 'EMPLOYEE',
    ...partial,
  };
}

/** Kč → haléře, EUR → centy. */
export const m = (units: number) => Math.round(units * 100);
