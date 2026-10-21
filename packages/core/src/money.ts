import { minorDigits, minorPerUnit, type RoundingMode } from '@cp/rules';
import { Fraction } from './fraction.js';

/** Částka v nejmenších jednotkách měny (haléře, centy). */
export interface Money {
  amount: number;
  currency: string;
}

export { minorDigits, minorPerUnit };

export function isCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** Zaokrouhlí částku v nejmenších jednotkách podle režimu ze sady pravidel. */
export function roundMinor(value: Fraction, mode: RoundingMode, currency: string): number {
  const unit = minorPerUnit(currency);
  switch (mode) {
    case 'NONE':
      return value.toInt('HALF_UP');
    case 'HALF_UP_UNIT':
      return value.div(unit).toInt('HALF_UP') * unit;
    case 'CEIL_UNIT':
      return value.div(unit).toInt('CEIL') * unit;
  }
}

/**
 * Přepočet cizí měny na Kč: částka × kurz / množství (ČNB uvádí kurz např. za 1 EUR nebo za 100 JPY).
 * Výsledek v haléřích, zaokrouhleno na haléře.
 */
export function convertToCzk(amount: Money, rate: string, unit = 1): number {
  const units = new Fraction(BigInt(amount.amount), BigInt(minorPerUnit(amount.currency)));
  return units.mul(Fraction.parse(rate)).div(unit).mul(100).toInt('HALF_UP');
}

/** Kurz odvozený ze skutečně stržené částky v Kč (potvrzení banky), zaokrouhlený na 4 desetinná místa pro zobrazení. */
export function impliedRate(amount: Money, czk: number): string {
  const units = new Fraction(BigInt(amount.amount), BigInt(minorPerUnit(amount.currency)));
  const rate = new Fraction(BigInt(czk), 100n).div(units);
  const scaled = rate.mul(10000).toInt('HALF_UP');
  return (scaled / 10000).toFixed(4);
}

const nf = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** „1 234,56 EUR“ – pro texty upozornění. */
export function formatMoney(m: Money): string {
  const value = m.amount / minorPerUnit(m.currency);
  const text = minorDigits(m.currency) === 0 ? String(value) : nf.format(value);
  return `${text} ${m.currency === 'CZK' ? 'Kč' : m.currency}`;
}
