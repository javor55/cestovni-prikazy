import { minorDigits, minorPerUnit } from '@cp/core';

/**
 * Normalizuje číslo zapsané uživatelem („1 234,50“, „1234.5“) na tvar „1234.50“ pro jádro.
 * Vrací null, pokud text není platné nezáporné číslo.
 */
export function normalizeDecimal(text: string): string | null {
  const s = text.replace(/[\s ]/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(s) ? s : null;
}

/** Částka zapsaná uživatelem → nejmenší jednotky měny. Více desetinných míst, než měna má, je chyba. */
export function toMinor(text: string, currency: string): number | null {
  const s = normalizeDecimal(text);
  if (s === null) return null;
  const [int, frac = ''] = s.split('.') as [string, string?];
  const digits = minorDigits(currency);
  if (frac.length > digits) return null;
  return Number(int) * minorPerUnit(currency) + Number(frac.padEnd(digits, '0') || 0);
}

const nf2 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });

export function formatMinor(amount: number, currency = 'CZK'): string {
  const value = amount / minorPerUnit(currency);
  const text = minorDigits(currency) === 0 ? nf0.format(value) : nf2.format(value);
  return `${text} ${currency === 'CZK' ? 'Kč' : currency}`;
}

/** Kurz z jádra („24.4220“) pro zobrazení: „24,422“. */
export function formatRate(rate: string): string {
  return rate.replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

/** Lokální datum a čas z <input type="datetime-local"> → „14. 10. 2026 6:30“. */
export function formatDateTime(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  return m ? `${+m[3]!}. ${+m[2]!}. ${m[1]} ${+m[4]!}:${m[5]}` : '';
}

export function formatDay(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${+m[3]!}. ${+m[2]!}. ${m[1]}` : '';
}
