import { describe, expect, it } from 'vitest';
import { countryCode, parseAnnex } from '../scripts/foreign-import.js';

describe('import přílohy vyhlášky o zahraničním stravném', () => {
  it('převede české názvy států na kódy', () => {
    expect(countryCode('Rakousko')).toBe('AT');
    expect(countryCode('Německo')).toBe('DE');
    expect(countryCode('Spojené státy americké')).toBe('US');
    expect(countryCode('Velká Británie')).toBe('GB');
    expect(countryCode('Francie')).toBe('FR'); // ne zastaralé FX „Metropolitní Francie“
    expect(countryCode('Srbsko')).toBe('RS'); // ne zastaralé CS
    expect(countryCode('Neexistující stát')).toBeUndefined();
  });

  it('rozebere řádky přílohy a ohlásí neznámé státy', () => {
    const text = `Příloha k vyhlášce č. 489/2025 Sb.
Stát Měna Sazba
1. Afghánistán EUR 45
Rakousko   EUR   45
Spojené státy americké USD 60
Spojené království GBP 45,50
Japonsko JPY 6500
Atlantida EUR 99
strana 2`;
    const { rates, unknown } = parseAnnex(text);
    expect(rates.map((r) => [r.code, r.currency, r.amount])).toEqual([
      ['AF', 'EUR', 4500],
      ['AT', 'EUR', 4500],
      ['US', 'USD', 6000],
      ['GB', 'GBP', 4550],
      ['JP', 'JPY', 6500],
    ]);
    expect(unknown).toEqual(['Atlantida']);
  });

  it('skupiny území z poznámek pod čarou a sazba pro ostatní země (formát PDF vyhlášky 489/2025)', () => {
    const text = `Karibik – ostrovní státy3) USD 60
Francouzská zámořská území2) EUR 50
Ostatní země neuvedené v příloze EUR 35
2
) Francouzská Guyana, Martinik, Saint
  Pierre a Miquelon.
3
) Anguilla, Aruba, Dominikánská republika,
  Svatý Vincent a Grenadiny, Turks a Caicos.`;
    const { rates, unknown, other } = parseAnnex(text);
    expect(unknown).toEqual([]);
    expect(Object.fromEntries(rates.map((r) => [r.code, `${r.currency} ${r.amount / 100}`]))).toEqual({
      AI: 'USD 60',
      AW: 'USD 60',
      DO: 'USD 60',
      VC: 'USD 60',
      TC: 'USD 60',
      GF: 'EUR 50',
      MQ: 'EUR 50',
      PM: 'EUR 50',
    });
    expect(other).toEqual({ currency: 'EUR', amount: 3500 });
  });
});
