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
  'konžská republika': 'CG',
  'konžská demokratická republika': 'CD',
  'hongkong': 'HK',
  'macao': 'MO',
  'džibutsko': 'DJ',
  'salvador': 'SV',
  'rusko': 'RU',
  'spojené arabské emiráty': 'AE',
  'kostarika': 'CR',
  // Území z poznámek pod čarou u skupin („ostrovní státy“, „zámořská území“).
  'midwayské ostrovy': 'UM',
  'ostrov wake': 'UM',
  'pitcairnův ostrov': 'PN',
  'norfolk': 'NF',
  'společenství severních marian': 'MP',
  'západní samoa': 'WS',
  'kokosové ostrovy': 'CC',
  'martinik': 'MQ',
  'svatý bartoloměj': 'BL',
  'svatý martin': 'MF',
  'saint pierre a miquelon': 'PM',
  'britské panenské ostrovy': 'VG',
  'portoriko': 'PR',
  'svatá lucie': 'LC',
  'svatý kryštof a nevis': 'KN',
  'svatý vincent a grenadiny': 'VC',
  'turks a caicos': 'TC',
  'kajmanské ostrovy': 'KY',
  'curaçao': 'CW',
  'papua nová guinea': 'PG',
  'mauretánie': 'MR',
};

/** Části území, které nemají vlastní kód státu (patří jinému státu) – ze skupin se vynechají. */
const NOT_A_COUNTRY = new Set(['velikonoční ostrov']);

/** Zastaralé nebo rezervované kódy ISO 3166, které se nepoužijí. */
const RETIRED = new Set(['AN', 'BU', 'CS', 'DD', 'FX', 'NT', 'SU', 'TP', 'YU', 'ZR', 'EU', 'EZ', 'UN', 'QO', 'XA', 'XB']);

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
        // Zastaralé a rezervované kódy mají v prohlížeči stejný název jako platné (FX = Francie, CS = Srbsko).
        if (n && n !== code && !RETIRED.has(code)) byName.set(n.toLowerCase(), code);
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

/**
 * Poznámky pod čarou u skupin území: „1) Americká Samoa, Cookovy ostrovy, …“ (i přes více řádků).
 * Vrací číslo poznámky → seznam názvů.
 */
function footnotes(text: string): Map<string, string[]> {
  const notes = new Map<string, string[]>();
  const re = /(?:^|\n)\s*(\d)\s*\n?\s*\)\s*([\s\S]*?\.)\s*(?=\n\s*\d\s*\n?\s*\)|$)/g;
  for (const m of text.matchAll(re)) {
    notes.set(m[1]!, m[2]!.replace(/\s+/g, ' ').replace(/\.$/, '').split(/,\s*/).map((x) => x.trim()).filter(Boolean));
  }
  return notes;
}

const minor = (value: string, currency: string) => {
  const [int, frac = ''] = value.replace(',', '.').split('.') as [string, string?];
  const digits = minorDigits(currency);
  return Number(int) * 10 ** digits + Number(frac.padEnd(digits, '0').slice(0, digits) || 0);
};

export function parseAnnex(text: string): { rates: ParsedRate[]; unknown: string[]; other?: { currency: string; amount: number } } {
  const rates: ParsedRate[] = [];
  const unknown: string[] = [];
  const notes = footnotes(text);
  let other: { currency: string; amount: number } | undefined;
  const add = (name: string, currency: string, amount: number) => {
    if (NOT_A_COUNTRY.has(name.toLowerCase())) return;
    const code = countryCode(name);
    if (!code) unknown.push(name);
    else if (!rates.some((r) => r.code === code)) rates.push({ code, name, currency, amount });
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const m = /^(?:\d+\.?\s+)?(.+?) ([A-Z]{3}) (\d+(?:[.,]\d{1,2})?)$/.exec(line);
    if (!m) continue;
    const [, name, currency, value] = m as unknown as [string, string, string, string];
    const amount = minor(value, currency);
    if (/^ostatní země/i.test(name)) {
      other = { currency, amount };
      continue;
    }
    // Skupina území s odkazem na poznámku, např. „Karibik – ostrovní státy3)“.
    const group = /^(.*?)\s*(\d)\)$/.exec(name);
    if (group) {
      const members = notes.get(group[2]!);
      if (!members) unknown.push(`${name} (chybí poznámka ${group[2]})`);
      for (const member of members ?? []) add(member, currency, amount);
      continue;
    }
    add(name, currency, amount);
  }
  return { rates, unknown, ...(other && { other }) };
}

// Použití: pnpm --filter @cp/rules exec tsx scripts/foreign-import.ts priloha.txt data/cz-2026.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFile, writeFile } = await import('node:fs/promises');
  const [annex, target] = process.argv.slice(2);
  if (!annex || !target) {
    console.error('Použití: tsx scripts/foreign-import.ts <text přílohy.txt> <sada pravidel.json>');
    process.exit(1);
  }
  const { rates, unknown, other } = parseAnnex(await readFile(annex, 'utf8'));
  if (unknown.length) {
    console.error(`Neznámé názvy států (doplňte do ALIASES): ${unknown.join('; ')}`);
    process.exit(2);
  }
  const set = JSON.parse(await readFile(target, 'utf8'));
  set.foreign.rates = Object.fromEntries(
    rates.sort((a, b) => a.code.localeCompare(b.code)).map((r) => [r.code, { name: r.name, currency: r.currency, amount: r.amount, verified: true }]),
  );
  if (other) set.foreign.otherCountries = other;
  else delete set.foreign.otherCountries;
  await writeFile(target, JSON.stringify(set, null, 2) + '\n');
  console.log(`Zapsáno ${rates.length} sazeb do ${target}. Spusťte testy a nechte výsledek zkontrolovat účetní.`);
}
