import { ruleSets } from '@cp/rules';
import { describe, expect, it } from 'vitest';
import { calculate } from '../src/index.js';
import { cross, m, seg, trip } from './helpers.js';

// Sazby 2026 (vyhláška 489/2025 Sb.): AT 45 EUR, DE 50 EUR, SK 40 EUR.
// Pásma: do 12 h 1/3, 12–18 h 2/3, nad 18 h plná sazba; krácení 70 / 35 / 25 % z částky pásma (předpoklad Ú-17).

const eur = { source: 'CNB' as const, rate: '24.30', unit: 1, rateDate: '2026-05-04' };

describe('zahraniční cesta', () => {
  it('jedna země: Vídeň 14.–16. 10. 2026 se zálohou, auto, výdaje ve dvou měnách', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-10-14T06:30',
        end: '2026-10-16T18:30',
        segments: [
          seg('Praha/CZ', 'Vídeň/AT', '2026-10-14T06:30', '2026-10-14T11:00', { km: 334, borderCrossings: [cross('2026-10-14T09:45', 'CZ', 'AT')] }),
          seg('Vídeň/AT', 'Vídeň/AT', '2026-10-15T08:00', '2026-10-15T18:00', { km: 18 }),
          seg('Vídeň/AT', 'Praha/CZ', '2026-10-16T14:00', '2026-10-16T18:30', { km: 334, borderCrossings: [cross('2026-10-16T15:15', 'AT', 'CZ')] }),
        ],
        meals: [
          { date: '2026-10-15', breakfast: { free: true }, lunch: { free: true } },
          { date: '2026-10-16', breakfast: { free: true } },
        ],
        advances: [{ id: 'a1', amount: { amount: m(100), currency: 'EUR' }, providedOn: '2026-10-12', conversion: { source: 'CNB', rate: '24.35' } }],
        expenses: [
          { id: 'x1', order: 1, category: 'Ubytování', description: '', date: '2026-10-16', amount: { amount: m(238), currency: 'EUR' }, conversion: { source: 'BANK_CONFIRMATION', czkAmount: m(5812.44) }, paymentMethod: 'PRIVATE_CARD', payer: 'EMPLOYEE' },
          { id: 'x2', order: 2, category: 'Parkovné', description: '', date: '2026-10-16', amount: { amount: m(36), currency: 'EUR' }, paymentMethod: 'ADVANCE', payer: 'ADVANCE' },
          { id: 'x3', order: 3, category: 'Dálniční známka', description: '', date: '2026-10-13', amount: { amount: m(12.8), currency: 'EUR' }, conversion: { source: 'CNB', rate: '24.315' }, paymentMethod: 'PRIVATE_CARD', payer: 'EMPLOYEE' },
          { id: 'x4', order: 4, category: 'MHD', description: '', date: '2026-10-15', amount: { amount: m(8), currency: 'EUR' }, paymentMethod: 'ADVANCE', payer: 'ADVANCE' },
          { id: 'x5', order: 5, category: 'Pohonné hmoty', description: '', date: '2026-10-16', amount: { amount: m(1758.28), currency: 'CZK' }, paymentMethod: 'PRIVATE_CARD', payer: 'EMPLOYEE', reimbursable: false },
        ],
        vehicle: { type: 'car', ownership: 'private', fuel: 'petrol95', consumption: ['5.6'], km: '686', receiptPrice: { amount: m(38.9), date: '2026-10-16' }, requestedByEmployer: true },
      }),
    );
    expect(r.ok).toBe(true);
    const days = r.perDiem!.days.map((d) => [d.domesticMinutes, d.foreignMinutes, d.foreign?.tierId, d.foreign?.amount, d.domestic?.amount ?? 0]);
    expect(days).toEqual([
      [195, 855, '2/3', m(30), 0], // 2/3 × 45 = 30
      [0, 1440, '1/1', m(22.5), 0], // 45 − 2 × 25 % × 45 = 22,50 (nezaokrouhluje se, Ú-8)
      [195, 915, '2/3', m(19.5), 0], // 30 − 35 % × 30 = 19,50
    ]);
    expect(r.perDiem!.foreignTotals).toEqual({ EUR: m(72) });

    expect(r.expenses.map((e) => [e.id, e.czk])).toEqual([
      ['x1', m(5812.44)],
      ['x2', m(876.6)], // 36 × 24,35
      ['x3', m(311.23)], // 12,80 × 24,315 = 311,232
      ['x4', m(194.8)],
      ['x5', m(1758.28)],
    ]);
    expect(r.expenses[0]!.rate).toBe('24.4220');

    // 686 × 5,90 = 4 047,40; 686 × 5,6 / 100 = 38,416 l × 38,90 = 1 494,3824 → 1 494,38
    expect(r.vehicle).toMatchObject({ basic: m(4047.4), fuelCompensation: m(1494.38), total: m(5541.78), fuelPriceSource: 'RECEIPT' });

    const s = r.settlement!;
    // EUR: stravné 72 + ze zálohy 44 = 116 − záloha 100 = doplatek 16 EUR × 24,35 = 389,60 Kč
    expect(s.currencies).toEqual([
      expect.objectContaining({ currency: 'EUR', perDiem: m(72), fromAdvance: m(44), claim: m(116), advance: m(100), balance: m(16), balanceCzk: m(389.6) }),
    ]);
    expect(s.employeeExpensesCzk).toBe(m(6123.67));
    expect(s.claimCzk).toBe(m(11665.45));
    expect(s.payoutExact).toBe(m(12055.05));
    expect(s.payout).toBe(m(12055));
  });

  it('průjezd více státy: rozhoduje stát s nejdelším pobytem v daném dni', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-05-04T05:00',
        end: '2026-05-05T13:00',
        segments: [
          seg('Praha/CZ', 'Linec/AT', '2026-05-04T05:00', '2026-05-04T16:00', {
            borderCrossings: [cross('2026-05-04T07:00', 'CZ', 'DE'), cross('2026-05-04T15:00', 'DE', 'AT')],
          }),
          seg('Linec/AT', 'Praha/CZ', '2026-05-05T08:00', '2026-05-05T13:00', { borderCrossings: [cross('2026-05-05T10:00', 'AT', 'CZ')] }),
        ],
        perDiemRates: { EUR: eur },
      }),
    );
    expect(r.ok).toBe(true);
    const [d1, d2] = r.perDiem!.days;
    // Den 1: DE 8 h, AT 9 h → celkem 17 h v zahraničí (2/3), rozhoduje AT: 2/3 × 45 = 30 EUR
    expect(d1!.countries).toEqual([
      { country: 'DE', minutes: 480 },
      { country: 'AT', minutes: 540 },
    ]);
    expect(d1!.foreign).toMatchObject({ country: 'AT', tierId: '2/3', amount: m(30) });
    // Den 2: AT 10 h → 1/3 × 45 = 15 EUR
    expect(d2!.foreign).toMatchObject({ country: 'AT', tierId: '1/3', amount: m(15) });
    // Bez zálohy se stravné přepočte kurzem: 45 × 24,30 = 1 093,50 → 1 094 Kč
    expect(r.settlement!.convertedPerDiem).toEqual([{ currency: 'EUR', amount: m(45), rate: '24.30', rateUnit: 1, czk: m(1093.5) }]);
    expect(r.settlement!.payout).toBe(m(1094));
  });

  it('přechod hranice kurz před půlnocí: pobyt pod 1 hodinu se přičte k tuzemské části', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-06-01T20:00',
        end: '2026-06-02T23:00',
        segments: [
          seg('Praha/CZ', 'Mnichov/DE', '2026-06-01T20:00', '2026-06-02T01:00', { borderCrossings: [cross('2026-06-01T23:30', 'CZ', 'DE')] }),
          seg('Mnichov/DE', 'Praha/CZ', '2026-06-02T18:00', '2026-06-02T23:00', { borderCrossings: [cross('2026-06-02T21:00', 'DE', 'CZ')] }),
        ],
        perDiemRates: { EUR: eur },
      }),
    );
    const [d1, d2] = r.perDiem!.days;
    expect(d1).toMatchObject({ domesticMinutes: 240, foreignMinutes: 0 });
    expect(d1!.foreign).toBeUndefined();
    expect(d1!.notes.join()).toContain('kratší než 1 hodina');
    // Den 2: DE 21 h → plná sazba 50 EUR, v ČR 2 h → bez tuzemského stravného
    expect(d2!.foreign).toMatchObject({ country: 'DE', tierId: '1/1', amount: m(50) });
    expect(d2!.domestic).toBeUndefined();
  });

  it('kombinace tuzemského a zahraničního stravného v jednom dni, oběd zdarma v zahraničí', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-04-07T05:00',
        end: '2026-04-08T20:00',
        segments: [
          seg('Praha/CZ', 'Bratislava/SK', '2026-04-07T05:00', '2026-04-07T13:00', { borderCrossings: [cross('2026-04-07T12:00', 'CZ', 'SK')] }),
          seg('Bratislava/SK', 'Praha/CZ', '2026-04-08T07:00', '2026-04-08T20:00', { borderCrossings: [cross('2026-04-08T08:00', 'SK', 'CZ')] }),
        ],
        meals: [{ date: '2026-04-07', lunch: { free: true } }],
        perDiemRates: { EUR: eur },
      }),
    );
    const [d1, d2] = r.perDiem!.days;
    // Den 1: ČR 7 h → 155 Kč; SK 12 h → 1/3 × 40 = 13,33; oběd −70 % × 13,33 = −9,33 → 4,00 EUR
    expect(d1!.domestic?.amount).toBe(m(155));
    expect(d1!.foreign).toMatchObject({ tierId: '1/3', tierAmount: m(13.33), reduction: m(9.33), amount: m(4) });
    // Den 2: SK 8 h → 1/3 × 40 = 13,3333 EUR, zobrazí se 13,33; ČR 12 h → 155 Kč
    expect(d2!.foreign?.amount).toBe(m(13.33));
    expect(d2!.domestic?.amount).toBe(m(155));
    expect(r.perDiem!.domesticTotal).toBe(m(310));
    expect(r.perDiem!.foreignTotals).toEqual({ EUR: m(17.33) });
    // Přepočet z přesné částky: 4 + 13,3333 = 17,3333 EUR × 24,30 = 421,20 Kč (z 17,33 by vyšlo 421,12)
    expect(r.settlement!.convertedPerDiem).toEqual([{ currency: 'EUR', amount: m(17.33), exactAmount: '17.3333', rate: '24.30', rateUnit: 1, czk: m(421.2) }]);
  });

  it('stravné za den se nezaokrouhluje, přepočet na Kč je z přesné částky (Záhřeb 27. 9. – 2. 10. 2026, ověřeno s účetní)', () => {
    // Skutečná cesta: výpočet účetní 159,1667 EUR × 24,350 = 3 875,71 Kč. Při zaokrouhlení dnů nahoru vycházelo 160 EUR = 3 896 Kč.
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-09-27T08:00',
        end: '2026-10-02T23:00',
        segments: [
          seg('Ústí nad Labem/CZ', 'Záhřeb/HR', '2026-09-27T08:00', '2026-09-27T18:00', {
            borderCrossings: [cross('2026-09-27T11:43', 'CZ', 'AT'), cross('2026-09-27T16:00', 'AT', 'SI'), cross('2026-09-27T17:00', 'SI', 'HR')],
          }),
          seg('Záhřeb/HR', 'Ústí nad Labem/CZ', '2026-10-02T13:00', '2026-10-02T23:00', {
            borderCrossings: [cross('2026-10-02T13:00', 'HR', 'SI'), cross('2026-10-02T15:15', 'SI', 'AT'), cross('2026-10-02T19:30', 'AT', 'CZ')],
          }),
        ],
        meals: [
          { date: '2026-09-27', dinner: { free: true } },
          ...['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'].map((date) => ({ date, breakfast: { free: true }, dinner: { free: true } })),
          { date: '2026-10-02', breakfast: { free: true } },
        ],
        perDiemRates: { EUR: { source: 'CNB', rate: '24.350', unit: 1, rateDate: '2026-09-25' } },
      }),
    );
    expect(r.ok).toBe(true);
    // 27. 9.: 12 h 17 min v zahraničí, rozhoduje HR (50 EUR): 2/3 = 33,3333 − 35 % = 21,6667 → zobrazeno 21,67
    expect(r.perDiem!.days.map((d) => [d.foreign?.country, d.foreign?.tierId, d.foreign?.amount])).toEqual([
      ['HR', '2/3', m(21.67)],
      ['HR', '1/1', m(25)],
      ['HR', '1/1', m(25)],
      ['HR', '1/1', m(25)],
      ['HR', '1/1', m(25)],
      ['HR', '1/1', m(37.5)],
    ]);
    expect(r.settlement!.convertedPerDiem).toEqual([{ currency: 'EUR', amount: m(159.17), exactAmount: '159.1667', rate: '24.350', rateUnit: 1, czk: m(3875.71) }]);
    expect(r.settlement!.payout).toBe(m(3876));
  });

  it('jídlo výslovně přiřazené k tuzemské části krátí tuzemské stravné', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-04-07T05:00',
        end: '2026-04-07T23:00',
        segments: [seg('Praha/CZ', 'Bratislava/SK', '2026-04-07T05:00', '2026-04-07T13:00', { borderCrossings: [cross('2026-04-07T12:00', 'CZ', 'SK')] })],
        meals: [{ date: '2026-04-07', breakfast: { free: true, part: 'domestic' } }],
        perDiemRates: { EUR: eur },
      }),
    );
    const d = r.perDiem!.days[0]!;
    expect(d.domestic).toMatchObject({ freeMeals: 1, amount: m(47) }); // 155 − 70 % = 46,50 → 47
    expect(d.foreign?.freeMeals).toBe(0);
  });

  it('kapesné 40 % ze zahraničního stravného', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-06-01T00:00',
        end: '2026-06-01T23:30',
        segments: [seg('Praha/CZ', 'Drážďany/DE', '2026-06-01T00:00', '2026-06-01T02:00', { borderCrossings: [cross('2026-06-01T01:00', 'CZ', 'DE')] })],
        employerRates: { pocketMoneyPct: 40 },
        perDiemRates: { EUR: eur },
      }),
    );
    expect(r.perDiem!.days[0]!.foreign?.amount).toBe(m(50));
    expect(r.perDiem!.days[0]!.pocketMoney).toEqual({ amount: m(20), currency: 'EUR', pct: 40 });
    expect(r.settlement!.convertedPerDiem[0]!.amount).toBe(m(70));
  });

  it('kapesné nad 40 % je chyba', () => {
    const r = calculate(trip({ start: '2026-06-01T08:00', end: '2026-06-01T16:00', employerRates: { pocketMoneyPct: 50 } }));
    expect(r.issues.map((i) => i.code)).toContain('POCKET_MONEY_OUT_OF_RANGE');
  });

  it('stát bez sazby v pravidlech je blokující chyba, vlastní sazba ji vyřeší', () => {
    // Sada pravidel bez USA a bez sazby pro ostatní země.
    const { US: _us, ...rest } = ruleSets[0]!.foreign.rates;
    const { otherCountries: _o, ...foreign } = ruleSets[0]!.foreign;
    const sets = [{ ...ruleSets[0]!, foreign: { ...foreign, rates: rest } }];
    const base = trip({
      kind: 'foreign',
      start: '2026-06-01T06:00',
      end: '2026-06-02T22:00',
      segments: [
        seg('Praha/CZ', 'New York/US', '2026-06-01T06:00', '2026-06-01T18:00', { transport: 'letadlo', borderCrossings: [cross('2026-06-01T08:00', 'CZ', 'US')] }),
        seg('New York/US', 'Praha/CZ', '2026-06-02T08:00', '2026-06-02T22:00', { transport: 'letadlo', borderCrossings: [cross('2026-06-02T20:00', 'US', 'CZ')] }),
      ],
      perDiemRates: { USD: { source: 'CNB', rate: '21.50' } },
    });
    const missing = calculate(base, sets);
    expect(missing.ok).toBe(false);
    expect(missing.issues.filter((i) => i.code === 'FOREIGN_RATE_MISSING')).toHaveLength(1);

    const own = calculate({ ...base, employerRates: { foreignBase: { US: { amount: m(60), currency: 'USD' } } } }, sets);
    expect(own.ok).toBe(true);
    // Den 1: US 16 h → 2/3 × 60 = 40 USD; den 2: US 20 h → 60 USD
    expect(own.perDiem!.foreignTotals).toEqual({ USD: m(100) });
  });

  it('stát, který příloha neuvádí, dostane sazbu pro ostatní země s upozorněním', () => {
    // Austrálie není v příloze vyhlášky 489/2025 jmenovitě (jen „ostrovní státy“ Oceánie).
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-06-01T06:00',
        end: '2026-06-02T22:00',
        segments: [
          seg('Praha/CZ', 'Sydney/AU', '2026-06-01T06:00', '2026-06-01T18:00', { transport: 'letadlo', borderCrossings: [cross('2026-06-01T08:00', 'CZ', 'AU')] }),
          seg('Sydney/AU', 'Praha/CZ', '2026-06-02T08:00', '2026-06-02T22:00', { transport: 'letadlo', borderCrossings: [cross('2026-06-02T20:00', 'AU', 'CZ')] }),
        ],
        perDiemRates: { EUR: eur },
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.perDiem!.days[1]!.foreign).toMatchObject({ country: 'AU', currency: 'EUR', baseRate: m(35), baseRateSource: 'OTHER' });
    expect(r.issues.filter((i) => i.code === 'FOREIGN_RATE_OTHER')).toHaveLength(1);
  });

  it('neověřená sazba vypočte, ale upozorní', () => {
    const sets = [{ ...ruleSets[0]!, foreign: { ...ruleSets[0]!.foreign, rates: { ...ruleSets[0]!.foreign.rates, HU: { ...ruleSets[0]!.foreign.rates.HU!, verified: false } } } }];
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-06-01T06:00',
        end: '2026-06-01T22:00',
        segments: [seg('Praha/CZ', 'Győr/HU', '2026-06-01T06:00', '2026-06-01T12:00', { borderCrossings: [cross('2026-06-01T10:00', 'CZ', 'HU')] })],
        perDiemRates: { EUR: eur },
      }),
      sets,
    );
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain('FOREIGN_RATE_UNVERIFIED');
  });
});
