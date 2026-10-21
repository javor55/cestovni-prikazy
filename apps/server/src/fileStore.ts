import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CnbRates, RateStore } from './cnb.js';

/** Lístky ČNB za uplynulé dny jako soubory JSON v adresáři (přežijí restart serveru). */
export function fileStore(dir: string): RateStore {
  return {
    async get(date) {
      try {
        return JSON.parse(await readFile(join(dir, `${date}.json`), 'utf8')) as CnbRates;
      } catch {
        return undefined;
      }
    },
    async put(date, value) {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${date}.json`), JSON.stringify(value));
    },
  };
}
