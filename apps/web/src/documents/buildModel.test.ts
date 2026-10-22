import { calculate } from '@cp/core';
import { describe, expect, it } from 'vitest';
import { toInput } from '../model/toInput.js';
import { vienna } from '../model/sample.js';
import type { TripDoc } from '../model/trip.js';
import { buildDocModel } from './buildModel.js';
import { inputHash } from './snapshot.js';

function build(t: TripDoc) {
  const mapped = toInput(t, { h: { accounting: 1, payment: 1 } });
  const m = buildDocModel({ trip: t, mapped, result: calculate(mapped.input!), docCounts: { h: { accounting: 1, payment: 1 } }, documentCount: 2, now: new Date('2026-10-21T12:05:00Z') });
  // Formátovač čísel odděluje tisíce nezlomitelnou mezerou; pro porovnání ji nahradíme obyčejnou.
  return JSON.parse(JSON.stringify(m).replace(/\u00a0/g, ' ')) as typeof m;
}

describe('model dokumentu', () => {
  it('ukázková cesta do Vídně: hlavička, stravné, výdaje, vozidlo, vyrovnání', () => {
    const m = build(vienna());
    expect(m).toMatchObject({ number: 'CP-2026-0042', ruleSet: 'CZ-2026 v1.2.0', issued: { place: 'Praha', date: '12. 10. 2026' }, createdAt: '21. 10. 2026 14:05' });
    expect(m.trip.advances).toEqual(['100 EUR (12. 10. 2026)']);
    expect(m.actual).toEqual({ start: '14. 10. 2026 6:30', end: '16. 10. 2026 18:30', km: '686 km' });
    expect(m.segments[0]!.border).toBe('CZ–AT 14. 10. 2026 9:45');
    expect(m.perDiem.days.map((d) => [d.tier, d.meals, d.amount])).toEqual([
      ['2/3', '', '30,00 EUR'],
      ['1/1', 'S + O', '22,50 EUR'],
      ['2/3', 'S', '19,50 EUR'],
    ]);
    expect(m.perDiem.foreignTotal).toBe('72,00 EUR');
    expect(m.expenses[0]).toMatchObject({ rate: '24,422 · potvrzení banky', czk: '5 812,44', docs: '1+1' });
    expect(m.expenses[2]!.rate).toBe('24,315 · ČNB 12. 10. 2026');
    expect(m.expenses[4]!.note).toBe('neproplácí se');
    expect(m.vehicle).toMatchObject({ vehicle: 'Škoda Octavia, 1AB 2345', total: '5 541,78', fuelPriceSource: 'cena z dokladu' });
    expect(m.settlement.payout).toBe('12 055,00 Kč');
    expect(m.settlement.payoutLabel).toBe('K výplatě zaměstnanci');
    expect(m.settlement.rows).toContainEqual({ label: 'Doplatek v EUR × kurz zálohy 24,35', foreign: '16,00 EUR', czk: '389,60' });
  });

  it('otisk se změní jen při změně údajů, ne při uložení nebo otevření', async () => {
    const t = vienna();
    const h1 = await inputHash(t, {});
    expect(await inputHash({ ...t, updatedAt: 'x', lastOpenedAt: 'y' }, {})).toBe(h1);
    expect(await inputHash({ ...t, purpose: 'Jiný účel' }, {})).not.toBe(h1);
    expect(await inputHash(t, { h: { accounting: 1, payment: 0 } })).not.toBe(h1);
  });

  it('cíl v zahraničí má v dokumentu i stát', () => {
    const t = vienna();
    t.destinations = 'Záhřeb';
    t.destinationCountry = 'HR';
    expect(build(t).trip.destinations).toBe('Záhřeb (Chorvatsko)');
    t.kind = 'domestic';
    expect(build(t).trip.destinations).toBe('Záhřeb');
  });
});
