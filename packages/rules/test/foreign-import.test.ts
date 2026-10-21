import { describe, expect, it } from 'vitest';
import { countryCode, parseAnnex } from '../scripts/foreign-import.js';

describe('import přílohy vyhlášky o zahraničním stravném', () => {
  it('převede české názvy států na kódy', () => {
    expect(countryCode('Rakousko')).toBe('AT');
    expect(countryCode('Německo')).toBe('DE');
    expect(countryCode('Spojené státy americké')).toBe('US');
    expect(countryCode('Velká Británie')).toBe('GB');
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
});
