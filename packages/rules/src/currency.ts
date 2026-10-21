// Měny bez desetinných míst. Ostatní mají dvě desetinná místa.
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'ISK', 'CLP', 'VND']);

export function minorDigits(currency: string): number {
  return ZERO_DECIMAL.has(currency) ? 0 : 2;
}

export function minorPerUnit(currency: string): number {
  return 10 ** minorDigits(currency);
}
