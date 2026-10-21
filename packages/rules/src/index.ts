import cz2026 from '../data/cz-2026.json';
import { ruleSetSchema, type RuleSet } from './schema.js';

export * from './schema.js';
export * from './currency.js';

/** Všechny dostupné sady pravidel, validované schématem už při načtení modulu. */
export const ruleSets: readonly RuleSet[] = [ruleSetSchema.parse(cz2026)];

/** Vrátí sadu pravidel platnou pro dané datum (YYYY-MM-DD), nebo undefined. */
export function ruleSetFor(date: string, sets: readonly RuleSet[] = ruleSets): RuleSet | undefined {
  return sets.find((s) => s.validFrom <= date && date <= s.validTo);
}
