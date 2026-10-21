import { describe, expect, it } from 'vitest';
import { safeName, sha256, sniff } from './detect.js';

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe('rozpoznání formátu podle obsahu', () => {
  it('PDF, JPEG, PNG a HEIC', () => {
    expect(sniff(bytes('%PDF-1.7'))).toBe('application/pdf');
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniff(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniff(bytes(0, 0, 0, 0x18, 'ftypheic'))).toBe('image/heic');
    expect(sniff(bytes(0, 0, 0, 0x18, 'ftypmif1'))).toBe('image/heic');
  });

  it('podvržený soubor s příponou .pdf, ale jiným obsahem odmítne', () => {
    expect(sniff(bytes('<html><script>'))).toBeNull();
    expect(sniff(bytes('MZ', 0x90, 0))).toBeNull(); // spustitelný soubor
    expect(sniff(bytes(0, 0, 0, 0x18, 'ftypisom'))).toBeNull(); // MP4 video
    expect(sniff(new Uint8Array())).toBeNull();
  });
});

describe('názvy a kontrolní součty', () => {
  it('odstraní cestu a nebezpečné znaky', () => {
    expect(safeName('../../etc/passwd')).toBe('passwd');
    expect(safeName('C:\\Users\\x\\účtenka "hotel".jpg')).toBe('účtenka hotel.jpg');
    expect(safeName('\u0000')).toBe('soubor');
    expect(safeName('a'.repeat(300))).toHaveLength(120);
  });

  it('SHA-256', async () => {
    expect(await sha256(new TextEncoder().encode('abc').buffer as ArrayBuffer)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
