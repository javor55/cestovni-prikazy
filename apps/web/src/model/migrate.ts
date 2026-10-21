import { SCHEMA_VERSION, type TripDoc } from './trip.js';

/**
 * Převede uloženou cestu ze starší verze schématu na aktuální. Používá se při načtení z prohlížeče
 * a později i při importu pracovního projektu. Novější verzi, než aplikace zná, odmítne.
 */
export function migrateTrip(raw: unknown): TripDoc {
  const t = structuredClone(raw) as Record<string, unknown> & { schemaVersion?: number };
  const version = t.schemaVersion ?? 1;
  if (version > SCHEMA_VERSION) throw new Error(`Data pocházejí z novější verze aplikace (schéma ${version}). Aktualizujte stránku.`);

  if (version < 2) {
    // v2: kurzy mají množství a datum kurzovního lístku, kurz pro stravné je objekt.
    const doc = t as unknown as TripDoc & { perDiemRates: Record<string, unknown> };
    for (const e of doc.expenses) e.rateDate ??= '';
    for (const a of doc.advances) {
      a.rateUnit ??= '1';
      a.rateDate ??= '';
    }
    for (const [cur, v] of Object.entries(doc.perDiemRates)) {
      if (typeof v === 'string') doc.perDiemRates[cur] = { rate: v, unit: '1', rateDate: '' };
    }
  }
  t.schemaVersion = SCHEMA_VERSION;
  return t as unknown as TripDoc;
}
