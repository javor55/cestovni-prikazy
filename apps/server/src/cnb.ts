// Denní kurzy devizového trhu ČNB. ČNB vyhlašuje kurzy v pracovní dny odpoledne;
// pro víkend, svátek nebo dopoledne vrací poslední vyhlášený kurzovní lístek (datum je v jeho hlavičce).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const CNB_URL =
  process.env.CNB_URL ?? 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';

export interface CnbRate {
  country: string;
  name: string;
  /** Kurz v Kč za `amount` jednotek měny, desetinná tečka („24.350“). */
  rate: string;
  amount: number;
}

export interface CnbRates {
  /** Datum kurzovního lístku (YYYY-MM-DD) – může být dřívější než požadované datum. */
  date: string;
  number: string;
  rates: Record<string, CnbRate>;
}

/** Rozebere textový kurzovní lístek ČNB („20.10.2026 #203“, hlavička sloupců, řádky „země|měna|množství|kód|kurz“). */
export function parseCnb(text: string): CnbRates {
  const lines = text.trim().split(/\r?\n/);
  const head = /^(\d{2})\.(\d{2})\.(\d{4}) #(\d+)$/.exec(lines[0]?.trim() ?? '');
  if (!head || lines.length < 3) throw new Error('Neočekávaný formát kurzovního lístku ČNB');
  const rates: Record<string, CnbRate> = {};
  for (const line of lines.slice(2)) {
    const parts = line.split('|');
    if (parts.length !== 5) throw new Error(`Neočekávaný řádek kurzovního lístku: ${line}`);
    const [country, name, amount, code, rate] = parts as [string, string, string, string, string];
    if (!/^[A-Z]{3}$/.test(code) || !/^\d+$/.test(amount) || !/^\d+,\d+$/.test(rate)) {
      throw new Error(`Neočekávaný řádek kurzovního lístku: ${line}`);
    }
    rates[code] = { country, name, amount: Number(amount), rate: rate.replace(',', '.') };
  }
  return { date: `${head[3]}-${head[2]}-${head[1]}`, number: head[4]!, rates };
}

const toCnbDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export interface CnbClient {
  get(date: string): Promise<CnbRates>;
}

/**
 * Klient s mezipamětí. Lístek za den, který už skončil, se nemění, proto se ukládá do paměti
 * a volitelně na disk. Dnešní lístek se drží jen krátce, protože ČNB ho během dne vyhlásí.
 */
export function cnbClient({ fetchImpl = fetch, cacheDir, today = () => new Date().toISOString().slice(0, 10) }: { fetchImpl?: typeof fetch; cacheDir?: string; today?: () => string } = {}): CnbClient {
  const memory = new Map<string, { value: CnbRates; until: number }>();
  return {
    async get(date) {
      const hit = memory.get(date);
      if (hit && hit.until > Date.now()) return hit.value;
      const final = date < today();
      const file = cacheDir && final ? join(cacheDir, `${date}.json`) : undefined;
      if (file) {
        try {
          const value = JSON.parse(await readFile(file, 'utf8')) as CnbRates;
          memory.set(date, { value, until: Infinity });
          return value;
        } catch {
          // v mezipaměti na disku není – stáhne se
        }
      }
      const res = await fetchImpl(`${CNB_URL}?date=${toCnbDate(date)}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`ČNB odpověděla ${res.status}`);
      const value = parseCnb(await res.text());
      memory.set(date, { value, until: final ? Infinity : Date.now() + 15 * 60_000 });
      if (file) {
        await mkdir(cacheDir!, { recursive: true });
        await writeFile(file, JSON.stringify(value));
      }
      return value;
    },
  };
}
