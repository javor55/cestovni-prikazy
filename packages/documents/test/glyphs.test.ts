import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sample } from './sample.js';

// Znak, který písmo nemá, se v PDF vykreslí jako jiný znak (např. šipka „→“ jako apostrof).
const font = (f: string) => fontkit.create(readFileSync(new URL(`../fonts/${f}`, import.meta.url)));
const fonts = [font('NotoSans-Regular.ttf'), font('NotoSans-Bold.ttf')];
const source = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

function missing(text: string): string[] {
  const chars = new Set([...text].filter((c) => c.codePointAt(0)! > 0x7f && !/\s/.test(c)));
  return [...chars].filter((c) => fonts.some((f) => !f.hasGlyphForCodePoint(c.codePointAt(0)!)));
}

describe('znaky v PDF', () => {
  it('kontrola pozná chybějící znak', () => {
    expect(missing('CZ → AT, CZ – AT · 1 × 35 % » 21,67 €')).toEqual(['→']);
  });

  it('písmo obsahuje všechny znaky ze šablon', () => {
    // Bez komentářů – v nich znaky nevadí.
    const text = ['Modern.tsx', 'Appendix.tsx', 'labels.ts'].map(source).join('\n').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
    expect(missing(text)).toEqual([]);
  });

  it('písmo obsahuje všechny znaky z ukázkového dokumentu', () => {
    expect(missing(JSON.stringify(sample()))).toEqual([]);
  });
});
