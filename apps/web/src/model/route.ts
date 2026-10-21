// Trasa úseku: stát odjezdu → přechody hranic → stát příjezdu. Pomocné funkce pro formulář průběhu cesty
// (předvyplnění z plánu, zpáteční cesta) a kontrolu, zda trasa po zemi vede jen přes sousední státy.

import { emptySegment, newId, type CrossingDoc, type SegmentDoc, type TransportKind, type TripDoc } from './trip.js';

/** Státy, kterými úsek vede, v pořadí (včetně státu odjezdu a příjezdu). */
export function pathOf(s: Pick<SegmentDoc, 'fromCountry' | 'crossings'>): string[] {
  return [s.fromCountry, ...s.crossings.map((c) => c.to)];
}

const crossingsFor = (path: string[]): CrossingDoc[] => path.slice(1).map((to) => ({ id: newId(), to, at: '' }));

/**
 * Udrží přechody v souladu se státy odjezdu a příjezdu: poslední přechod vede vždy do státu příjezdu,
 * úsek do jiného státu má aspoň jeden přechod a úsek uvnitř jednoho státu žádný (pokud nevede přes jiný stát).
 */
export function normalizeCrossings(s: SegmentDoc): void {
  const last = s.crossings.at(-1);
  if (last) last.to = s.toCountry;
  else if (s.fromCountry !== s.toCountry) s.crossings.push({ id: newId(), to: s.toCountry, at: '' });
  // Jediný „přechod“ do státu, ve kterém úsek začal, není přechod.
  if (s.crossings.length === 1 && s.fromCountry === s.toCountry) s.crossings = [];
}

/** Vloží stát po cestě před přechod do cílového státu. */
export function addTransit(s: SegmentDoc, country = ''): void {
  normalizeCrossings(s);
  if (s.crossings.length === 0) s.crossings.push({ id: newId(), to: s.toCountry, at: '' });
  s.crossings.splice(s.crossings.length - 1, 0, { id: newId(), to: country, at: '' });
}

/**
 * Úseky podle plánu cesty: cesta tam (odjezd = plánovaný začátek) a zpět (příjezd = plánovaný konec)
 * se státy po cestě. Časy přechodů hranic a zbylé časy doplní uživatel.
 */
export function segmentsFromPlan(t: TripDoc): SegmentDoc[] {
  const home = 'CZ';
  const dest = t.kind === 'foreign' ? t.destinationCountry || home : home;
  const path = [home, ...t.transitCountries.filter((c) => c && c !== home && c !== dest), dest];
  const outPath = dest === home ? [home] : path;
  const transport = t.plannedTransportKind || 'vlak';
  const there: SegmentDoc = {
    ...emptySegment(),
    fromPlace: t.startPlace,
    fromCountry: home,
    toPlace: t.destinations,
    toCountry: dest,
    departure: t.plannedStart,
    transport,
    crossings: crossingsFor(outPath),
  };
  const back: SegmentDoc = {
    ...emptySegment(),
    fromPlace: t.destinations,
    fromCountry: dest,
    toPlace: t.endPlace || t.startPlace,
    toCountry: home,
    arrival: t.plannedEnd,
    transport,
    crossings: crossingsFor([...outPath].reverse()),
  };
  return [there, back];
}

/** Zpáteční úsek: z cíle posledního úseku zpět na začátek cesty, státy po cestě v obráceném pořadí. */
export function returnSegment(t: TripDoc): SegmentDoc | undefined {
  const first = t.segments[0];
  const last = t.segments.at(-1);
  if (!first || !last) return undefined;
  // Celá dosavadní trasa jako posloupnost států (bez opakování po sobě jdoucích).
  const path = t.segments.flatMap(pathOf).filter((c, i, a) => i === 0 || c !== a[i - 1]);
  return {
    ...emptySegment(last),
    fromPlace: last.toPlace,
    toPlace: first.fromPlace,
    toCountry: first.fromCountry,
    transport: first.transport,
    km: first.km,
    crossings: path.length > 1 ? crossingsFor([...path].reverse()) : [],
  };
}

const LAND: ReadonlySet<TransportKind> = new Set(['soukrome-auto', 'firemni-auto', 'vlak', 'autobus', 'taxi']);

/** Pozemní hranice evropských států (a spojení tunelem či mostem: GB–FR, DK–SE), které aplikace nabízí. */
const BORDERS: Record<string, string[]> = {
  CZ: ['DE', 'PL', 'SK', 'AT'],
  SK: ['CZ', 'PL', 'UA', 'HU', 'AT'],
  AT: ['DE', 'CZ', 'SK', 'HU', 'SI', 'IT', 'CH', 'LI'],
  DE: ['DK', 'PL', 'CZ', 'AT', 'CH', 'FR', 'LU', 'BE', 'NL'],
  PL: ['DE', 'CZ', 'SK', 'UA', 'LT'],
  HU: ['AT', 'SK', 'UA', 'RO', 'RS', 'HR', 'SI'],
  SI: ['IT', 'AT', 'HU', 'HR'],
  HR: ['SI', 'HU', 'RS', 'BA', 'ME'],
  IT: ['FR', 'CH', 'AT', 'SI'],
  FR: ['BE', 'LU', 'DE', 'CH', 'IT', 'ES', 'GB'],
  CH: ['FR', 'DE', 'AT', 'LI', 'IT'],
  LI: ['CH', 'AT'],
  BE: ['FR', 'LU', 'DE', 'NL'],
  NL: ['DE', 'BE'],
  LU: ['BE', 'DE', 'FR'],
  GB: ['IE', 'FR'],
  IE: ['GB'],
  ES: ['FR', 'PT'],
  PT: ['ES'],
  DK: ['DE', 'SE'],
  SE: ['NO', 'FI', 'DK'],
  NO: ['SE', 'FI'],
  FI: ['SE', 'NO'],
  EE: ['LV'],
  LV: ['EE', 'LT'],
  LT: ['LV', 'PL'],
  UA: ['PL', 'SK', 'HU', 'RO', 'MD'],
  MD: ['RO', 'UA'],
  RO: ['HU', 'UA', 'MD', 'BG', 'RS'],
  BG: ['RO', 'RS', 'MK', 'GR', 'TR'],
  GR: ['AL', 'MK', 'BG', 'TR'],
  RS: ['HU', 'RO', 'BG', 'MK', 'ME', 'BA', 'HR'],
  BA: ['HR', 'RS', 'ME'],
  ME: ['HR', 'BA', 'RS', 'AL'],
  MK: ['RS', 'BG', 'GR', 'AL'],
  AL: ['ME', 'MK', 'GR'],
  TR: ['GR', 'BG'],
};

/**
 * Přechody, které po zemi nejsou možné bez průjezdu dalším státem (např. CZ → HR), jako dvojice [z, do].
 * Kontroluje se jen pozemní doprava mezi státy, jejichž hranice aplikace zná.
 */
export function missingTransit(s: Pick<SegmentDoc, 'fromCountry' | 'crossings' | 'transport'>): [string, string][] {
  if (!LAND.has(s.transport)) return [];
  const path = pathOf(s);
  const out: [string, string][] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    if (a && b && a !== b && BORDERS[a] && BORDERS[b] && !BORDERS[a].includes(b)) out.push([a, b]);
  }
  return out;
}

export const BORDER_TABLE = BORDERS;
