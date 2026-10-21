import { describe, expect, it } from 'vitest';
import { ruleSetFor, ruleSets } from '../src/index.js';

describe('sada pravidel CZ-2026', () => {
  const r = ruleSets[0]!;

  it('platí pro celý rok 2026 a nic jiného', () => {
    expect(ruleSetFor('2026-01-01')?.id).toBe('CZ-2026');
    expect(ruleSetFor('2026-12-31')?.id).toBe('CZ-2026');
    expect(ruleSetFor('2025-12-31')).toBeUndefined();
    expect(ruleSetFor('2027-01-01')).toBeUndefined();
  });

  it('tuzemské stravné podle vyhlášky 573/2025 Sb.', () => {
    expect(r.domestic.bands.map((b) => [b.id, b.business.min, b.public.min, b.public.max])).toEqual([
      ['5-12', 15500, 15500, 18500],
      ['12-18', 23600, 23600, 28400],
      ['18+', 37000, 37000, 44200],
    ]);
  });

  it('pásma na sebe navazují bez mezer', () => {
    for (const list of [r.domestic.bands, r.foreign.tiers]) {
      for (let i = 1; i < list.length; i++) expect(list[i]!.minMinutes).toBe(list[i - 1]!.maxMinutes! + 1);
      expect(list.at(-1)!.maxMinutes).toBeNull();
    }
  });

  it('průměrné ceny PHM pokrývají celý rok bez mezer a překryvů pro každý druh', () => {
    for (const fuel of ['petrol95', 'petrol98', 'diesel', 'electricity'] as const) {
      const periods = r.vehicle.averagePrices.filter((p) => p.fuel === fuel).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
      expect(periods[0]!.validFrom).toBe(r.validFrom);
      expect(periods.at(-1)!.validTo).toBe(r.validTo);
      for (let i = 1; i < periods.length; i++) {
        const prevEnd = new Date(periods[i - 1]!.validTo + 'T00:00Z');
        prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
        expect(periods[i]!.validFrom).toBe(prevEnd.toISOString().slice(0, 10));
      }
    }
  });

  it('každý zdroj uvedený u údajů je v seznamu zdrojů', () => {
    const ids = new Set(r.sources.map((s) => s.id));
    for (const src of [r.domestic.source, r.foreign.source, r.vehicle.source, ...r.vehicle.averagePrices.map((p) => p.source)]) {
      expect(ids.has(src)).toBe(true);
    }
  });
});
