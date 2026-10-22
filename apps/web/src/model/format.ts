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

/** Přesná částka z výpočtu („159.1667“) → „159,1667 EUR“. */
export function formatExact(decimal: string, currency: string): string {
  const [int = '0', frac = ''] = decimal.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${grouped}${frac ? `,${frac}` : ''} ${currency === 'CZK' ? 'Kč' : currency}`;
}

const roundingText = { NONE: 'nezaokrouhluje', HALF_UP_UNIT: 'zaokrouhluje matematicky na celé jednotky', CEIL_UNIT: 'zaokrouhluje nahoru na celé jednotky' } as const;

/** Popis zaokrouhlení stravného podle sady pravidel – pro Souhrn a PDF (česky nebo anglicky). */
export function perDiemRoundingNote(
  rounding: { domesticPerDay: keyof typeof roundingText; foreignPerDay: keyof typeof roundingText },
  foreign: boolean,
  lang: 'cs' | 'en' = 'cs',
): string {
  if (lang === 'en') {
    const how = { NONE: 'is not rounded', HALF_UP_UNIT: 'is rounded to whole units', CEIL_UNIT: 'is rounded up to whole units' } as const;
    const domestic = `Domestic meal allowance per day ${how[rounding.domesticPerDay].replace('units', 'CZK')}.`;
    if (!foreign) return domestic;
    const abroad =
      rounding.foreignPerDay === 'NONE'
        ? 'Foreign meal allowance is not rounded – shown per day to cents, converted to CZK from the exact amount.'
        : `Foreign meal allowance per day ${how[rounding.foreignPerDay]} of the currency.`;
    return `${domestic} ${abroad}`;
  }
  const domestic = `Tuzemské stravné za den se ${roundingText[rounding.domesticPerDay].replace('jednotky', 'Kč')}.`;
  if (!foreign) return domestic;
  const abroad =
    rounding.foreignPerDay === 'NONE'
      ? 'Zahraniční stravné se nezaokrouhluje – za den je uvedeno na centy, na Kč se přepočítá z přesné částky.'
      : `Zahraniční stravné za den se ${roundingText[rounding.foreignPerDay]} měny.`;
  return `${domestic} ${abroad}`;
}
