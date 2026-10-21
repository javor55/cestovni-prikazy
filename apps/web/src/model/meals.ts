import type { MealsDoc, TripDoc } from './trip.js';

/** Kalendářní dny cesty (YYYY-MM-DD) od začátku do konce včetně. */
export function datesOf(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const out: string[] = [];
  const d = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  const last = end.slice(0, 10);
  while (out.length < 366) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > last) break;
    out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const none: MealsDoc = { breakfast: false, lunch: false, dinner: false };

/** Označí (nebo zruší) jedno jídlo ve všech zadaných dnech. */
export function setMealAll(d: TripDoc, dates: string[], kind: keyof MealsDoc, value: boolean): void {
  for (const date of dates) d.meals[date] = { ...(d.meals[date] ?? none), [kind]: value };
}

/** Snídaně v ceně ubytování: označí (nebo zruší) snídani každé ráno po první noci, tj. od druhého dne cesty. */
export function markBreakfasts(d: TripDoc, dates: string[], value = true): void {
  setMealAll(d, dates.slice(1), 'breakfast', value);
}
