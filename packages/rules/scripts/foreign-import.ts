// Převod přílohy vyhlášky MF o zahraničním stravném (text zkopírovaný z PDF) na sazby pro sadu pravidel.
// Řádek přílohy má tvar „Název státu  MĚNA  částka“, např. „Rakousko EUR 45“.

import { minorDigits } from '../src/currency.js';

const names = new Intl.DisplayNames(['cs'], { type: 'region' });

/** Názvy, které vyhláška používá jinak než standardní české názvy států. */
const ALIASES: Record<string, string> = {
  'spojené státy americké': 'US',
  'velká británie': 'GB',
  'spojené království': 'GB',
  'korejská republika': 'KR',
  'korejská lidově demokratická republika': 'KP',
  'ruská federace': 'RU',
  'čínská lidová republika': 'CN',
  'čína': 'CN',
  'nizozemsko': 'NL',
  'nizozemí': 'NL',
  'bosna a hercegovina': 'BA',
  'severní makedonie': 'MK',
  'kongo (demokratická republika)': 'CD',
  'demokratická republika kongo': 'CD',
  'kongo': 'CG',
  'pobřeží slonoviny': 'CI',
  'vatikán': 'VA',
  'kapverdy': 'CV',
  'svatý tomáš a princův ostrov': 'ST',
  'východní timor': 'TL',
  'myanmar': 'MM',
  'barma': 'MM',
  'turecko': 'TR',
  'eswatini': 'SZ',
  'svazijsko': 'SZ',
  'palestina': 'PS',
  'tchaj-wan': 'TW',
  'kosovo': 'XK',
};

let byName: Map<string, string> | undefined;

/** Kód státu ISO 3166-1 alpha-2 podle českého názvu. */
export function countryCode(name: string): string | undefined {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (ALIASES[key]) return ALIASES[key];
  if (!byName) {
    byName = new Map();
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const n = names.of(code);
        if (n && n !== code) byName.set(n.toLowerCase(), code);
      }
    }
  }
  return byName.get(key);
}

export interface ParsedRate {
  code: string;
  name: string;
  currency: string;
  /** V nejmenších jednotkách měny. */
  amount: number;
}

export function parseAnnex(text: string): { rates: ParsedRate[]; unknown: string[] } {
  const rates: ParsedRate[] = [];
  const unknown: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const m = /^(?:\d+\.?\s+)?(.+?) ([A-Z]{3}) (\d+(?:[.,]\d{1,2})?)$/.exec(line);
    if (!m) continue;
    const [, name, currency, value] = m as unknown as [string, string, string, string];
    const code = countryCode(name);
    if (!code) {
      unknown.push(name);
      continue;
    }
    const [int, frac = ''] = value.replace(',', '.').split('.') as [string, string?];
    const digits = minorDigits(currency);
    rates.push({ code, name, currency, amount: Number(int) * 10 ** digits + Number(frac.padEnd(digits, '0').slice(0, digits) || 0) });
  }
  return { rates, unknown };
}

// Použití: pnpm --filter @cp/rules exec tsx scripts/foreign-import.ts priloha.txt data/cz-2026.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFile, writeFile } = await import('node:fs/promises');
  const [annex, target] = process.argv.slice(2);
  if (!annex || !target) {
    console.error('Použití: tsx scripts/foreign-import.ts <text přílohy.txt> <sada pravidel.json>');
    process.exit(1);
  }
  const { rates, unknown } = parseAnnex(await readFile(annex, 'utf8'));
  if (unknown.length) {
    console.error(`Neznámé názvy států (doplňte do ALIASES): ${unknown.join('; ')}`);
    process.exit(2);
  }
  const set = JSON.parse(await readFile(target, 'utf8'));
  set.foreign.rates = Object.fromEntries(
    rates.sort((a, b) => a.code.localeCompare(b.code)).map((r) => [r.code, { name: r.name, currency: r.currency, amount: r.amount, verified: true }]),
  );
  await writeFile(target, JSON.stringify(set, null, 2) + '\n');
  console.log(`Zapsáno ${rates.length} sazeb do ${target}. Spusťte testy a nechte výsledek zkontrolovat účetní.`);
}
