import { calculate } from '@cp/core';
import { describe, expect, it } from 'vitest';
import { toInput } from '../model/toInput.js';
import { emptyExpense, emptySegment, newTrip, type TripDoc } from '../model/trip.js';
import { buildDocModel } from './buildModel.js';
import { inputHash } from './snapshot.js';

function vienna(): TripDoc {
  const t = newTrip(new Date('2026-10-12T08:00:00Z'));
  Object.assign(t, { kind: 'foreign', number: 'CP-2026-0042', purpose: 'Jednání', issuedPlace: 'Praha', issuedOn: '2026-10-12' });
  const out = { ...emptySegment(), fromPlace: 'Praha', toPlace: 'Vídeň', toCountry: 'AT', departure: '2026-10-14T06:30', arrival: '2026-10-14T11:00', crossingAt: '2026-10-14T09:45', transport: 'soukrome-auto' as const, km: '343' };
  const back = { ...emptySegment(out), toPlace: 'Praha', toCountry: 'CZ', departure: '2026-10-16T14:00', arrival: '2026-10-16T18:30', crossingAt: '2026-10-16T15:15', km: '343' };
  t.segments = [out, back];
  t.meals = { '2026-10-15': { breakfast: true, lunch: true, dinner: false }, '2026-10-16': { breakfast: true, lunch: false, dinner: false } };
  t.advances = [{ id: 'a', amount: '100', currency: 'EUR', providedOn: '2026-10-12', rate: '24,35', rateUnit: '1', rateDate: '2026-10-12' }];
  t.expenses = [
    { ...emptyExpense('2026-10-16'), id: 'h', category: 'Ubytování', supplier: 'Hotel', amount: '238', currency: 'EUR', rateSource: 'BANK_CONFIRMATION', czkAmount: '5 812,44' },
    { ...emptyExpense('2026-10-16'), id: 'p', category: 'Parkovné', amount: '36', currency: 'EUR', paymentMethod: 'ADVANCE' },
    { ...emptyExpense('2026-10-13'), id: 'z', category: 'Dálniční známka', amount: '12,80', currency: 'EUR', rate: '24,315', rateDate: '2026-10-12' },
    { ...emptyExpense('2026-10-15'), id: 'm', category: 'MHD', amount: '8', currency: 'EUR', paymentMethod: 'ADVANCE' },
    { ...emptyExpense('2026-10-16'), id: 'f', category: 'Pohonné hmoty', amount: '1 758,28', reimbursable: false },
  ];
  t.vehicle = { ...t.vehicle, used: true, model: 'Škoda Octavia', plate: '1AB 2345', consumption: ['5,6'], km: '686', receiptPrice: '38,90', receiptDate: '2026-10-16' };
  return t;
}

function build(t: TripDoc) {
  const mapped = toInput(t, { h: { accounting: 1, payment: 1 } });
  const m = buildDocModel({ trip: t, mapped, result: calculate(mapped.input!), docCounts: { h: { accounting: 1, payment: 1 } }, documentCount: 2, now: new Date('2026-10-21T12:05:00Z') });
  // Formátovač čísel odděluje tisíce nezlomitelnou mezerou; pro porovnání ji nahradíme obyčejnou.
  return JSON.parse(JSON.stringify(m).replace(/\u00a0/g, ' ')) as typeof m;
}

describe('model dokumentu', () => {
  it('ukázková cesta do Vídně: hlavička, stravné, výdaje, vozidlo, vyrovnání', () => {
    const m = build(vienna());
    expect(m).toMatchObject({ number: 'CP-2026-0042', ruleSet: 'CZ-2026 v1.0.0', issued: { place: 'Praha', date: '12. 10. 2026' }, createdAt: '21. 10. 2026 14:05' });
    expect(m.trip.advances).toEqual(['100 EUR (12. 10. 2026)']);
    expect(m.actual).toEqual({ start: '14. 10. 2026 6:30', end: '16. 10. 2026 18:30', km: '686 km' });
    expect(m.segments[0]!.border).toBe('CZ–AT 14. 10. 2026 9:45');
    expect(m.perDiem.days.map((d) => [d.tier, d.meals, d.amount])).toEqual([
      ['2/3', '', '30,00 EUR'],
      ['1/1', 'S + O', '23,00 EUR'],
      ['2/3', 'S', '20,00 EUR'],
    ]);
    expect(m.perDiem.foreignTotal).toBe('73,00 EUR');
    expect(m.expenses[0]).toMatchObject({ rate: '24,422 · potvrzení banky', czk: '5 812,44', docs: '1+1' });
    expect(m.expenses[2]!.rate).toBe('24,315 · ČNB 12. 10. 2026');
    expect(m.expenses[4]!.note).toBe('neproplácí se');
    expect(m.vehicle).toMatchObject({ vehicle: 'Škoda Octavia, 1AB 2345', total: '5 541,78', fuelPriceSource: 'cena z dokladu' });
    expect(m.settlement.payout).toBe('12 079,00 Kč');
    expect(m.settlement.payoutLabel).toBe('K výplatě zaměstnanci');
    expect(m.settlement.rows).toContainEqual({ label: 'Doplatek v EUR × kurz zálohy 24,35', foreign: '17,00 EUR', czk: '413,95' });
  });

  it('otisk se změní jen při změně údajů, ne při uložení nebo otevření', async () => {
    const t = vienna();
    const h1 = await inputHash(t, {});
    expect(await inputHash({ ...t, updatedAt: 'x', lastOpenedAt: 'y' }, {})).toBe(h1);
    expect(await inputHash({ ...t, purpose: 'Jiný účel' }, {})).not.toBe(h1);
    expect(await inputHash(t, { h: { accounting: 1, payment: 0 } })).not.toBe(h1);
  });
});
