import { describe, expect, it } from 'vitest';
import { calculate } from '../src/index.js';
import type { Vehicle } from '../src/model.js';
import { expense, m, seg, trip } from './helpers.js';

const car: Vehicle = { type: 'car', ownership: 'private', fuel: 'petrol95', consumption: ['5.6'], km: '686', requestedByEmployer: true };

const base = (vehicle: Vehicle, expenses = [] as ReturnType<typeof expense>[]) =>
  calculate(
    trip({
      start: '2026-03-10T06:00',
      end: '2026-03-11T20:00',
      segments: [seg('Praha/CZ', 'Ostrava/CZ', '2026-03-10T06:00', '2026-03-10T10:00'), seg('Ostrava/CZ', 'Praha/CZ', '2026-03-11T16:00', '2026-03-11T20:00')],
      vehicle,
      expenses,
    }),
  );

describe('cena paliva u soukromého vozidla', () => {
  it('více tankování za různé ceny: vážený průměr z dokladů (Ú-26)', () => {
    const fuel = [
      expense({ amount: { amount: m(1500), currency: 'CZK' }, category: 'Pohonné hmoty', fuelQuantity: '40', reimbursable: false }),
      expense({ amount: { amount: m(1170.6), currency: 'CZK' }, category: 'Pohonné hmoty', fuelQuantity: '30.5', reimbursable: false }),
      expense({ amount: { amount: m(120), currency: 'CZK' }, category: 'Parkovné' }),
    ];
    const r = base({ ...car, fuelPriceFromExpenses: true }, fuel);
    // (1 500 + 1 170,60) / 70,5 l = 37,880851… → 37,88 Kč/l
    expect(r.vehicle).toMatchObject({ fuelPrice: m(37.88), fuelPriceSource: 'RECEIPTS' });
    expect(r.vehicle!.fuelPriceRef).toBe('vážený průměr z 2 dokladů: 2670,60 Kč / 70,50 l');
    // 686 km × 5,6 l / 100 = 38,416 l × 37,88 = 1 455,198… → 1 455,20 Kč
    expect(r.vehicle!.fuelCompensation).toBe(m(1455.2));
  });

  it('bez dokladů s množstvím použije průměrnou cenu a upozorní', () => {
    const r = base({ ...car, fuelPriceFromExpenses: true });
    expect(r.vehicle!.fuelPriceSource).toBe('AVERAGE');
    expect(r.issues.map((i) => i.code)).toContain('FUEL_RECEIPTS_MISSING');
  });

  it('ručně zadaná průměrná cena (novela vyhlášky) nahradí cenu ze sady pravidel a upozorní', () => {
    const r = base({ ...car, averagePriceOverride: { amount: m(35.1), source: 'vyhláška č. 123/2026 Sb.' } });
    expect(r.vehicle).toMatchObject({ fuelPrice: m(35.1), fuelPriceSource: 'AVERAGE_MANUAL', fuelPriceRef: 'vyhláška č. 123/2026 Sb.', rulesAveragePrice: m(34.7) });
    // 686 km × 5,6 l / 100 = 38,416 l × 35,10 = 1 348,4016 → 1 348,40 Kč
    expect(r.vehicle!.fuelCompensation).toBe(m(1348.4));
    expect(r.issues.find((i) => i.code === 'FUEL_PRICE_MANUAL')?.message).toContain('místo ceny podle vyhlášky 573/2025 (34,70 Kč)');
  });

  it('doklad o tankování má přednost před ručně zadanou průměrnou cenou', () => {
    const r = base({ ...car, receiptPrice: { amount: m(38.9), date: '2026-03-10' }, averagePriceOverride: { amount: m(35.1), source: 'x' } });
    expect(r.vehicle!.fuelPriceSource).toBe('RECEIPT');
  });

  it('cena z jednoho dokladu zůstává', () => {
    const r = base({ ...car, receiptPrice: { amount: m(38.9), date: '2026-03-10' } });
    expect(r.vehicle).toMatchObject({ fuelPrice: m(38.9), fuelPriceSource: 'RECEIPT' });
  });
});
