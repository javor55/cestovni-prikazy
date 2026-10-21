import { describe, expect, it } from 'vitest';
import { calculate, convertToCzk, type Vehicle } from '../src/index.js';
import { expense, m, trip } from './helpers.js';

const day = { start: '2026-03-10T07:00', end: '2026-03-10T15:30' }; // 155 Kč stravné

describe('výdaje a kurzy', () => {
  it('kurz ČNB za 100 jednotek (JPY): 10 000 JPY × 15,432 / 100 = 1 543,20 Kč', () => {
    expect(convertToCzk({ amount: 10000, currency: 'JPY' }, '15.432', 100)).toBe(m(1543.2));
  });

  it('přepočet se zaokrouhluje na haléře matematicky', () => {
    expect(convertToCzk({ amount: m(12.8), currency: 'EUR' }, '24.315')).toBe(m(311.23)); // 311,232
    expect(convertToCzk({ amount: m(0.5), currency: 'EUR' }, '24.33')).toBe(m(12.17)); // 12,165 → 12,17
  });

  it('ručně zadaný kurz je viditelné varování, výpočet proběhne', () => {
    const r = calculate(
      trip({ ...day, expenses: [expense({ amount: { amount: m(10), currency: 'EUR' }, conversion: { source: 'MANUAL', rate: '25', manualReason: 'směnárna bez dokladu' } })] }),
    );
    expect(r.ok).toBe(true);
    expect(r.expenses[0]!.czk).toBe(m(250));
    expect(r.issues.find((i) => i.code === 'EXPENSE_MANUAL_RATE')?.message).toContain('směnárna bez dokladu');
  });

  it('cizí měna bez kurzu je blokující chyba', () => {
    const r = calculate(trip({ ...day, expenses: [expense({ amount: { amount: m(10), currency: 'EUR' } })] }));
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('EXPENSE_MISSING_RATE');
  });

  it('neplatná částka a měna jsou blokující chyby', () => {
    const r = calculate(
      trip({ ...day, expenses: [expense({ amount: { amount: 0, currency: 'CZK' } }), expense({ amount: { amount: 100, currency: 'euro' } })] }),
    );
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['EXPENSE_INVALID_AMOUNT', 'EXPENSE_INVALID_CURRENCY']));
  });

  it('firemní a soukromá platba: zaměstnavatelem placený výdaj se nevyplácí, ale je v nákladech', () => {
    const r = calculate(
      trip({
        ...day,
        expenses: [
          expense({ amount: { amount: m(450), currency: 'CZK' }, payer: 'EMPLOYEE' }),
          expense({ amount: { amount: m(2000), currency: 'CZK' }, payer: 'EMPLOYER', paymentMethod: 'COMPANY_CARD' }),
        ],
      }),
    );
    const s = r.settlement!;
    expect(s.employeeExpensesCzk).toBe(m(450));
    expect(s.employerPaidCzk).toBe(m(2000));
    expect(s.payout).toBe(m(605)); // 155 + 450
    expect(s.totalCostCzk).toBe(m(2605));
  });

  it('výdaj mimo dobu cesty, chybějící doklady a možná duplicita jsou varování', () => {
    const r = calculate(
      trip({
        ...day,
        expenses: [
          expense({ amount: { amount: m(100), currency: 'CZK' }, date: '2026-03-01', supplier: 'ČD', attachments: { accounting: 0, payment: 0 } }),
          expense({ amount: { amount: m(100), currency: 'CZK' }, date: '2026-03-01', supplier: 'ČD', attachments: { accounting: 1, payment: 0 } }),
          expense({ amount: { amount: m(30), currency: 'EUR' }, conversion: { source: 'CNB', rate: '24' }, attachments: { accounting: 1, payment: 0 } }),
        ],
      }),
    );
    expect(r.ok).toBe(true);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['EXPENSE_OUTSIDE_TRIP', 'EXPENSE_NO_DOCUMENT', 'EXPENSE_POSSIBLE_DUPLICATE', 'EXPENSE_NO_PAYMENT_PROOF']));
  });
});

describe('záloha, doplatek a přeplatek', () => {
  it('korunová záloha vyšší než nárok = vratka zaměstnance', () => {
    const r = calculate(
      trip({
        ...day,
        advances: [{ id: 'a', amount: { amount: m(1000), currency: 'CZK' }, providedOn: '2026-03-09' }],
        expenses: [expense({ amount: { amount: m(300), currency: 'CZK' }, payer: 'ADVANCE', paymentMethod: 'ADVANCE' })],
      }),
    );
    // nárok 155 + 300 ze zálohy = 455; záloha 1 000 → vratka 545
    expect(r.settlement!.claimCzk).toBe(m(455));
    expect(r.settlement!.payout).toBe(m(-545));
  });

  it('záloha v EUR vyšší než nárok: přeplatek přepočtený kurzem zálohy', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-06-01T00:00',
        end: '2026-06-01T23:30',
        segments: [
          {
            id: 's',
            from: { place: 'Praha', country: 'CZ' },
            to: { place: 'Drážďany', country: 'DE' },
            departure: '2026-06-01T00:00',
            arrival: '2026-06-01T02:00',
            transport: 'vlak',
            borderCrossings: [{ at: '2026-06-01T01:00', from: 'CZ', to: 'DE' }],
          },
        ],
        advances: [{ id: 'a', amount: { amount: m(200), currency: 'EUR' }, providedOn: '2026-05-29', conversion: { source: 'CNB', rate: '24.35' } }],
      }),
    );
    // stravné 50 EUR − záloha 200 = −150 EUR × 24,35 = −3 652,50 → vratka 3 653 Kč (zaokrouhlení od nuly)
    expect(r.settlement!.currencies[0]).toMatchObject({ balance: m(-150), balanceCzk: m(-3652.5) });
    expect(r.settlement!.payout).toBe(m(-3653));
  });

  it('výdaj ze zálohy v měně, ve které záloha není, je chyba', () => {
    const r = calculate(trip({ ...day, expenses: [expense({ amount: { amount: m(5), currency: 'EUR' }, payer: 'ADVANCE' })] }));
    expect(r.issues.map((i) => i.code)).toContain('EXPENSE_ADVANCE_MISSING');
  });

  it('výsledek k výplatě se zaokrouhluje na celé Kč matematicky', () => {
    const r = calculate(trip({ ...day, expenses: [expense({ amount: { amount: m(0.5), currency: 'CZK' } })] }));
    expect(r.settlement!.payoutExact).toBe(m(155.5));
    expect(r.settlement!.payout).toBe(m(156));
  });
});

describe('soukromé vozidlo', () => {
  const car = (extra: Partial<Vehicle> = {}): Vehicle => ({
    type: 'car',
    ownership: 'private',
    fuel: 'petrol95',
    consumption: ['5.6'],
    km: '686',
    requestedByEmployer: true,
    ...extra,
  });

  it('průměrná cena benzinu 95 do 30. 9. 2026: 34,70 Kč', () => {
    const r = calculate(trip({ start: '2026-09-10T07:00', end: '2026-09-10T19:00', vehicle: car() }));
    // 38,416 l × 34,70 = 1 333,0352 → 1 333,04; základní 686 × 5,90 = 4 047,40
    expect(r.vehicle).toMatchObject({ fuelPrice: m(34.7), fuelPriceSource: 'AVERAGE', fuelCompensation: m(1333.04), total: m(5380.44) });
  });

  it('průměrná cena benzinu 95 od 1. 10. 2026: 41,80 Kč (vyhláška 175/2026)', () => {
    const r = calculate(trip({ start: '2026-10-14T07:00', end: '2026-10-14T19:00', vehicle: car() }));
    // 38,416 × 41,80 = 1 605,7888 → 1 605,79
    expect(r.vehicle).toMatchObject({ fuelPrice: m(41.8), fuelCompensation: m(1605.79), fuelPriceRef: 'vyhláška 175/2026' });
  });

  it('nafta: 34,10 Kč do 31. 5., 44,50 Kč od 1. 6. 2026 a varování při změně během cesty', () => {
    const before = calculate(trip({ start: '2026-05-20T07:00', end: '2026-05-20T19:00', vehicle: car({ fuel: 'diesel', km: '100', consumption: ['5'] }) }));
    expect(before.vehicle).toMatchObject({ fuelPrice: m(34.1), fuelCompensation: m(170.5) }); // 5 l × 34,10
    const spanning = calculate(trip({ start: '2026-05-31T07:00', end: '2026-06-01T19:00', vehicle: car({ fuel: 'diesel', km: '100', consumption: ['5'] }) }));
    expect(spanning.issues.map((i) => i.code)).toContain('FUEL_PRICE_CHANGES_DURING_TRIP');
    const after = calculate(trip({ start: '2026-06-02T07:00', end: '2026-06-02T19:00', vehicle: car({ fuel: 'diesel', km: '100', consumption: ['5'] }) }));
    expect(after.vehicle?.fuelCompensation).toBe(m(222.5)); // 5 l × 44,50
  });

  it('tři hodnoty spotřeby z TP se zprůměrují', () => {
    const r = calculate(trip({ ...day, vehicle: car({ km: '100', consumption: ['7.2', '4.8', '5.7'] }) }));
    // průměr 5,9 l/100 km × 100 km × 34,70 = 204,73
    expect(r.vehicle).toMatchObject({ consumption: '5.90', fuelCompensation: m(204.73) });
  });

  it('elektromobil: 18 kWh/100 km × 250 km × 7,20 Kč = 324 Kč', () => {
    const r = calculate(trip({ ...day, vehicle: car({ fuel: 'electricity', km: '250', consumption: ['18'] }) }));
    expect(r.vehicle).toMatchObject({ unit: 'kWh', quantity: '45.00', fuelCompensation: m(324), basic: m(1475) });
  });

  it('motocykl: 1,60 Kč/km', () => {
    const r = calculate(trip({ ...day, vehicle: car({ type: 'motorcycle', km: '100', consumption: ['4'] }) }));
    expect(r.vehicle?.basic).toBe(m(160));
  });

  it('firemní vozidlo náhradu nemá', () => {
    const r = calculate(trip({ ...day, vehicle: car({ ownership: 'company' }) }));
    expect(r.vehicle).toBeUndefined();
    expect(r.issues.map((i) => i.code)).toContain('COMPANY_VEHICLE');
  });

  it('vozidlo bez souhlasu zaměstnavatele je varování', () => {
    const r = calculate(trip({ ...day, vehicle: car({ requestedByEmployer: false }) }));
    expect(r.issues.map((i) => i.code)).toContain('VEHICLE_NOT_REQUESTED');
  });

  it('tankování jako proplácený výdaj vedle náhrady za vozidlo je varování', () => {
    const r = calculate(trip({ ...day, vehicle: car(), expenses: [expense({ category: 'Pohonné hmoty', amount: { amount: m(1500), currency: 'CZK' } })] }));
    expect(r.issues.map((i) => i.code)).toContain('FUEL_EXPENSE_WITH_VEHICLE');
  });
});
