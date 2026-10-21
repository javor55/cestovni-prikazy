import type { BorderCrossing, CountryCode, TripInput } from './model.js';
import type { IssueList } from './issues.js';
import { isLocalDateTime, toInstant } from './time.js';

export const HOME: CountryCode = 'CZ';

export interface Presence {
  start: number;
  end: number;
  country: CountryCode;
}

export interface Timeline {
  start: number;
  end: number;
  presence: Presence[];
  /** Soukromé části cesty, které se nezapočítávají do doby pro stravné. */
  excluded: { start: number; end: number }[];
  /** true, pokud byl některý přechod hranice odhadnut. */
  estimatedCrossings: boolean;
}

function instant(value: string, label: string, issues: IssueList, ref?: Record<string, string>): number | undefined {
  if (!isLocalDateTime(value)) {
    issues.error('INVALID_TIME', `${label}: neplatný údaj „${value}“. Zadejte datum a čas.`, ref);
    return undefined;
  }
  try {
    return toInstant(value);
  } catch (e) {
    issues.error('INVALID_TIME', `${label}: ${(e as Error).message}.`, ref);
    return undefined;
  }
}

/**
 * Zkontroluje časovou osu a sestaví z ní intervaly pobytu v jednotlivých státech.
 * Vrací undefined, pokud časovou osu nelze sestavit (blokující chyba).
 */
export function buildTimeline(trip: TripInput, issues: IssueList): Timeline | undefined {
  const start = instant(trip.start, 'Skutečný začátek cesty', issues);
  const end = instant(trip.end, 'Skutečný konec cesty', issues);
  if (start === undefined || end === undefined) return undefined;
  if (end <= start) {
    issues.error('TRIP_END_BEFORE_START', 'Skutečný konec cesty je dříve než její začátek. Opravte data a časy cesty.');
    return undefined;
  }

  const segs = trip.segments
    .map((s) => ({
      s,
      dep: instant(s.departure, `Úsek ${s.from.place} → ${s.to.place}, odjezd`, issues, { segmentId: s.id }),
      arr: instant(s.arrival, `Úsek ${s.from.place} → ${s.to.place}, příjezd`, issues, { segmentId: s.id }),
    }))
    .filter((x): x is { s: (typeof trip.segments)[number]; dep: number; arr: number } => x.dep !== undefined && x.arr !== undefined)
    .sort((a, b) => a.dep - b.dep);

  const crossings: { at: number; c: BorderCrossing; segmentId: string }[] = [];
  const excluded: Timeline['excluded'] = [];
  let estimatedCrossings = false;
  let fatal = false;
  let prev: (typeof segs)[number] | undefined;

  for (const x of segs) {
    const { s, dep, arr } = x;
    const ref = { segmentId: s.id };
    const name = `Úsek ${s.from.place} → ${s.to.place}`;
    if (arr <= dep) {
      issues.error('SEGMENT_ARRIVAL_BEFORE_DEPARTURE', `${name}: příjezd není později než odjezd. Opravte časy úseku.`, ref);
      fatal = true;
      continue;
    }
    if (dep < start || arr > end) {
      issues.error('SEGMENT_OUTSIDE_TRIP', `${name} leží mimo skutečný začátek a konec cesty. Upravte časy úseku nebo cesty.`, ref);
      fatal = true;
    }
    if (prev && prev.arr > dep) {
      issues.error('SEGMENT_OVERLAP', `${name} začíná dříve, než skončil předchozí úsek. Opravte časy, úseky se nesmí překrývat.`, ref);
      fatal = true;
    }
    if (prev && prev.s.to.country !== s.from.country) {
      issues.warning('SEGMENT_DISCONTINUITY', `${name} začíná v jiném státě (${s.from.country}), než kde skončil předchozí úsek (${prev.s.to.country}). Zkontrolujte pořadí úseků.`, ref);
    }
    if (s.private) excluded.push({ start: dep, end: arr });

    const own = s.borderCrossings ?? [];
    if (own.length === 0 && s.from.country !== s.to.country) {
      // Odhad, který nenadhodnocuje pobyt v zahraničí: odjezd z ČR počítáme až příjezdem, návrat již odjezdem.
      const at = s.from.country === HOME ? arr : dep;
      crossings.push({ at, c: { at: '', from: s.from.country, to: s.to.country }, segmentId: s.id });
      estimatedCrossings = true;
      issues.warning(
        'MISSING_BORDER_CROSSING',
        `${name}: chybí čas přechodu hranice ${s.from.country} → ${s.to.country}. Stravné je spočítané z odhadu (${s.from.country === HOME ? 'čas příjezdu' : 'čas odjezdu'}). Doplňte skutečný čas.`,
        ref,
      );
    }
    for (const c of own) {
      const at = instant(c.at, `${name}, přechod hranice`, issues, ref);
      if (at === undefined) {
        fatal = true;
        continue;
      }
      if (at < dep || at > arr) {
        issues.error('CROSSING_OUTSIDE_SEGMENT', `${name}: čas přechodu hranice není mezi odjezdem a příjezdem úseku. Opravte čas přechodu.`, ref);
        fatal = true;
      }
      crossings.push({ at, c, segmentId: s.id });
    }
    prev = x;
  }

  crossings.sort((a, b) => a.at - b.at);
  const presence: Presence[] = [];
  let country = HOME;
  let t = start;
  for (const { at, c, segmentId } of crossings) {
    if (c.from !== country) {
      issues.error(
        'CROSSING_INCONSISTENT',
        `Přechod hranice ${c.from} → ${c.to} nenavazuje: podle předchozích údajů je zaměstnanec v tu chvíli ve státě ${country}. Zkontrolujte přechody hranic.`,
        { segmentId },
      );
      fatal = true;
    }
    if (at > t) presence.push({ start: t, end: at, country });
    t = Math.max(t, at);
    country = c.to;
  }
  if (end > t) presence.push({ start: t, end, country });

  if (country !== HOME) {
    issues.warning('TRIP_ENDS_ABROAD', `Cesta podle zadaných přechodů hranic končí mimo Česko (${country}). Doplňte návrat a přechod hranice.`);
  }
  const abroad = presence.some((p) => p.country !== HOME);
  if (trip.kind === 'domestic' && abroad) {
    issues.warning('KIND_MISMATCH', 'Cesta je označená jako tuzemská, ale obsahuje pobyt v zahraničí. Změňte typ cesty na zahraniční.');
  }
  if (trip.kind === 'foreign' && !abroad) {
    issues.warning('KIND_MISMATCH', 'Cesta je označená jako zahraniční, ale žádný úsek nevede do zahraničí. Doplňte úseky a přechody hranic.');
  }

  return fatal ? undefined : { start, end, presence, excluded, estimatedCrossings };
}
