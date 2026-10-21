import type { AttachmentMime } from './model.js';

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

/**
 * Skutečný formát souboru podle prvních bajtů – přípona ani MIME typ z prohlížeče se nekontrolují,
 * protože je lze snadno podvrhnout. Vrací null pro nepodporovaný formát.
 */
export function sniff(head: Uint8Array): AttachmentMime | null {
  const b = (i: number) => head[i] ?? -1;
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b(i) === v)) return 'image/png';
  if (ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12))) return 'image/heic';
  return null;
}

/** Bezpečný název pro zobrazení a pozdější export: bez cest, řídicích znaků a s rozumnou délkou. */
export function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  return (clean || 'soubor').slice(0, 120);
}

export async function sha256(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
