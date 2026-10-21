import { calculate } from '@cp/core';
import { describe, expect, it } from 'vitest';
import { toMinor } from './format.js';
import { toInput } from './toInput.js';
import { emptyExpense, emptySegment, newTrip, type TripDoc } from './trip.js';

function viennaTrip(): TripDoc {
  const t = newTrip(new Date('2026-10-12T08:00:00Z'));
  t.kind = 'foreign';
  const out = { ...emptySegment(), fromPlace: 'Praha', toPlace: 'Vídeň', toCountry: 'AT', departure: '2026-10-14T06:30', arrival: '2026-10-14T11:00', crossingAt: '2026-10-14T09:45', transport: 'soukrome-auto' as const };
  const back = { ...emptySegment(out), toPlace: 'Praha', toCountry: 'CZ', departure: '2026-10-16T14:00', arrival: '2026-10-16T18:30', crossingAt: '2026-10-16T15:15' };
  t.segments = [out, back];
  t.meals = { '2026-10-15': { breakfast: true, lunch: true, dinner: false }, '2026-10-16': { breakfast: true, lunch: false, dinner: false } };
  t.advances = [{ id: 'a', amount: '100', currency: 'EUR', providedOn: '2026-10-12', rate: '24,35' }];
  t.expenses = [
    { ...emptyExpense('2026-10-16'), category: 'Ubytování', amount: '238', currency: 'EUR', rateSource: 'BANK_CONFIRMATION', czkAmount: '5 812,44' },
    { ...emptyExpense('2026-10-16'), category: 'Parkovné', amount: '36', currency: 'EUR', paymentMethod: 'ADVANCE' },
    { ...emptyExpense('2026-10-13'), category: 'Dálniční známka', amount: '12,80', currency: 'eur', rate: '24,315' },
    { ...emptyExpense('2026-10-15'), category: 'MHD', amount: '8', currency: 'EUR', paymentMethod: 'ADVANCE' },
    { ...emptyExpense('2026-10-16'), category: 'Pohonné hmoty', amount: '1 758,28', reimbursable: false },
  ];
  t.vehicle = { ...t.vehicle, used: true, consumption: ['5,6'], km: '686', receiptPrice: '38,90', receiptDate: '2026-10-16' };
  return t;
}

describe('převod formuláře na vstup výpočtu', () => {
  it('čísla v českém zápisu', () => {
    expect(toMinor('1 234,50', 'CZK')).toBe(123450);
    expect(toMinor('1234.5', 'EUR')).toBe(123450);
    expect(toMinor('1000', 'JPY')).toBe(1000);
    expect(toMinor('12,345', 'CZK')).toBeNull();
    expect(toMinor('abc', 'CZK')).toBeNull();
    expect(toMinor('-5', 'CZK')).toBeNull();
  });

  it('ukázková cesta do Vídně z formuláře dá stejný výsledek jako test jádra (12 079 Kč)', () => {
    const { input, issues } = toInput(viennaTrip());
    expect(issues).toEqual([]);
    expect(input!.start).toBe('2026-10-14T06:30');
    expect(input!.end).toBe('2026-10-16T18:30');
    const r = calculate(input!);
    expect(r.ok).toBe(true);
    expect(r.perDiem!.foreignTotals).toEqual({ EUR: 7300 });
    expect(r.settlement!.payout).toBe(1207900);
  });

  it('bez úseků použije plánovaný začátek a konec', () => {
    const t = newTrip(new Date());
    t.plannedStart = '2026-03-10T07:00';
    t.plannedEnd = '2026-03-10T15:30';
    const r = calculate(toInput(t).input!);
    expect(r.settlement!.payout).toBe(15500);
  });

  it('bez časů výpočet nespustí a řekne, co doplnit', () => {
    const m = toInput(newTrip(new Date()));
    expect(m.input).toBeUndefined();
    expect(m.issues[0]).toMatchObject({ code: 'FORM_MISSING_TIMES', ref: { step: 'prubeh' } });
  });

  it('neplatná částka výdaje je chyba s odkazem na výdaj', () => {
    const t = viennaTrip();
    t.expenses[0]!.amount = '23x';
    const m = toInput(t);
    expect(m.issues).toEqual([expect.objectContaining({ code: 'FORM_EXPENSE_AMOUNT', ref: { expenseId: t.expenses[0]!.id, step: 'vydaje' } })]);
  });
});
