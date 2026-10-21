import { ruleSets } from '@cp/rules';

// Nejčastější státy služebních cest. Názvy dodá prohlížeč v češtině.
const CODES = [
  'CZ', 'SK', 'AT', 'DE', 'PL', 'HU', 'SI', 'HR', 'IT', 'FR', 'CH', 'LI', 'BE', 'NL', 'LU', 'GB', 'IE', 'ES', 'PT',
  'DK', 'SE', 'NO', 'FI', 'IS', 'EE', 'LV', 'LT', 'UA', 'MD', 'RO', 'BG', 'GR', 'CY', 'MT', 'RS', 'BA', 'ME', 'MK',
  'AL', 'TR', 'IL', 'AE', 'US', 'CA', 'MX', 'BR', 'CN', 'JP', 'KR', 'IN', 'SG', 'TH', 'VN', 'AU', 'ZA', 'EG', 'MA',
];

const names = new Intl.DisplayNames(['cs'], { type: 'region' });

export const countryName = (code: string) => names.of(code) ?? code;

export const countryOptions: [string, string][] = [
  ['CZ', 'Česko'],
  ...CODES.filter((c) => c !== 'CZ')
    .map((c): [string, string] => [c, countryName(c)])
    .sort((a, b) => a[1].localeCompare(b[1], 'cs')),
];

/** Má stát v aktuální sadě pravidel sazbu zahraničního stravného? */
export const hasRate = (code: string) => code === 'CZ' || code in (ruleSets[0]?.foreign.rates ?? {});

export const currencyOptions: [string, string][] = [
  ['CZK', 'CZK – koruna'],
  ['EUR', 'EUR – euro'],
  ['USD', 'USD – americký dolar'],
  ['GBP', 'GBP – libra'],
  ['CHF', 'CHF – švýcarský frank'],
  ['PLN', 'PLN – zlotý'],
  ['HUF', 'HUF – forint'],
  ['SEK', 'SEK – švédská koruna'],
  ['NOK', 'NOK – norská koruna'],
  ['DKK', 'DKK – dánská koruna'],
  ['RON', 'RON – rumunský lei'],
  ['JPY', 'JPY – jen'],
  ['CNY', 'CNY – jüan'],
];
