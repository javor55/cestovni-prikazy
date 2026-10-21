import { newId, SCHEMA_VERSION, type TripDoc } from './trip.js';

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
  if (version < 3) {
    // v3: místo a datum vystavení cestovního příkazu.
    t.issuedPlace ??= '';
    t.issuedOn ??= '';
  }
  if (version < 4) {
    // v4: způsob podpisu.
    t.signature ??= { mode: 'scan', widthPct: 70, stamp: false };
  }
  if (version < 5) {
    // v5: více přechodů hranic v jednom úseku; stát cíle, státy po cestě a druh dopravy v plánu.
    const doc = t as unknown as TripDoc & { segments: (TripDoc['segments'][number] & { crossingAt?: string })[] };
    for (const s of doc.segments) {
      const at = s.crossingAt ?? '';
      delete s.crossingAt;
      s.crossings = s.fromCountry !== s.toCountry ? [{ id: newId(), to: s.toCountry, at }] : [];
    }
    const plan = t as { plannedTransportKind?: string; transitCountries?: string[] };
    plan.plannedTransportKind ??= '';
    plan.transitCountries ??= [];
    doc.destinationCountry ??= doc.segments.find((s) => s.toCountry !== 'CZ')?.toCountry ?? '';
  }
  if (version < 6) {
    // v6: více dopravních prostředků v plánu, trasa s místy a zastávkami, množství paliva u výdajů,
    // způsob určení ceny paliva.
    const doc = t as unknown as TripDoc & { plannedTransportKind?: TripDoc['plannedTransportKinds'][number] | ''; transitCountries?: string[] };
    doc.plannedTransportKinds ??= doc.plannedTransportKind ? [doc.plannedTransportKind] : [];
    delete doc.plannedTransportKind;
    doc.route ??= (doc.transitCountries ?? []).map((country) => ({ id: newId(), place: '', country, stop: false }));
    delete doc.transitCountries;
    for (const e of doc.expenses) e.fuelQuantity ??= '';
    doc.vehicle.fuelPriceMode ??= doc.vehicle.receiptPrice ? 'receipt' : 'average';
  }
  t.schemaVersion = SCHEMA_VERSION;
  return t as unknown as TripDoc;
}
