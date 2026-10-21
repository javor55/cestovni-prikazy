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

  it('každý zdroj má odkaz na úplné znění', () => {
    for (const s of r.sources) expect(s.url, s.id).toMatch(/^https:\/\//);
  });

  it('zahraniční stravné podle úplné přílohy vyhlášky 489/2025 Sb.', () => {
    const rate = (c: string) => `${r.foreign.rates[c]!.currency} ${r.foreign.rates[c]!.amount / 100}`;
    // Kontrolní vzorek přímo z PDF přílohy.
    expect(Object.keys(r.foreign.rates)).toHaveLength(227);
    expect(['AT', 'DE', 'FR', 'IT', 'PL', 'SK', 'HU', 'HR', 'SI', 'RS', 'GB', 'CH', 'US', 'JP', 'PE'].map(rate)).toEqual([
      'EUR 45', 'EUR 50', 'EUR 50', 'EUR 55', 'EUR 50', 'EUR 40', 'EUR 50', 'EUR 50', 'EUR 40', 'EUR 40', 'GBP 45', 'CHF 75', 'USD 70', 'USD 65', 'USD 52',
    ]);
    // Území ze skupin (poznámky pod čarou) a sazba pro ostatní země.
    expect(['FJ', 'GP', 'JM'].map(rate)).toEqual(['USD 70', 'EUR 50', 'USD 60']);
    expect(r.foreign.otherCountries).toEqual({ currency: 'EUR', amount: 3500 });
    expect(Object.values(r.foreign.rates).every((x) => x.verified)).toBe(true);
  });
});
