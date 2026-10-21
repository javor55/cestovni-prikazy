import Dexie, { type EntityTable } from 'dexie';
import type { TripDoc } from '../model/trip.js';

/** Výchozí doba uchování rozpracované cesty od posledního otevření (rozhodnutí R10). */
export const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Setting {
  key: string;
  value: unknown;
}

export class AppDb extends Dexie {
  trips!: EntityTable<TripDoc, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'cestovni-prikazy') {
    super(name);
    this.version(1).stores({
      trips: 'id, lastOpenedAt, updatedAt',
      settings: 'key',
    });
  }
}

export const db = new AppDb();

export function expiresAt(trip: Pick<TripDoc, 'lastOpenedAt'>, days = RETENTION_DAYS): Date {
  return new Date(new Date(trip.lastOpenedAt).getTime() + days * DAY_MS);
}

export async function listTrips(d: AppDb = db): Promise<TripDoc[]> {
  return d.trips.orderBy('updatedAt').reverse().toArray();
}

export async function getTrip(id: string, d: AppDb = db): Promise<TripDoc | undefined> {
  return d.trips.get(id);
}

export async function saveTrip(trip: TripDoc, d: AppDb = db): Promise<void> {
  await d.trips.put(trip);
}

/** Zaznamená otevření cesty – od něj se počítá doba do automatického smazání. */
export async function touchTrip(id: string, now: Date, d: AppDb = db): Promise<void> {
  await d.trips.update(id, { lastOpenedAt: now.toISOString() });
}

export async function deleteTrip(id: string, d: AppDb = db): Promise<void> {
  // Přílohy (milník 3) budou v dalších tabulkách – smazání pak proběhne v jedné transakci.
  await d.transaction('rw', d.trips, async () => {
    await d.trips.delete(id);
  });
}

export async function deleteEverything(d: AppDb = db): Promise<void> {
  await d.transaction('rw', d.trips, d.settings, async () => {
    await d.trips.clear();
    await d.settings.clear();
  });
}

/** Smaže cesty, které nikdo neotevřel déle než nastavenou dobu. Vrací počet smazaných. */
export async function purgeExpired(now: Date, days = RETENTION_DAYS, d: AppDb = db): Promise<number> {
  const limit = new Date(now.getTime() - days * DAY_MS).toISOString();
  return d.trips.where('lastOpenedAt').below(limit).delete();
}

export type Remembered = Pick<TripDoc, 'employee' | 'employer' | 'sector'>;

export async function getRemembered(d: AppDb = db): Promise<Remembered | undefined> {
  return (await d.settings.get('remembered'))?.value as Remembered | undefined;
}

export async function setRemembered(value: Remembered | undefined, d: AppDb = db): Promise<void> {
  if (value) await d.settings.put({ key: 'remembered', value });
  else await d.settings.delete('remembered');
}
