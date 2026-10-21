import { describe, expect, it } from 'vitest';
import { aresQuery, validIco } from './ares.js';

describe('ARES', () => {
  it('číslice hledá jako IČO, text jako název', () => {
    expect(aresQuery(' 000 06 947 ')).toBe('ico=00006947');
    expect(aresQuery('Škoda Auto')).toBe('nazev=%C5%A0koda%20Auto');
    expect(aresQuery('ab')).toBeUndefined();
  });

  it('ověří kontrolní číslici IČO', () => {
    expect(validIco('00177041')).toBe(true);
    expect(validIco('00177042')).toBe(false);
  });
});
