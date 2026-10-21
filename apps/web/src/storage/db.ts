import Dexie, { type EntityTable } from 'dexie';
import type { Attachment, StoredBlob } from '../attachments/model.js';
import type { Snapshot } from '../documents/snapshot.js';
import { migrateTrip } from '../model/migrate.js';
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
  attachments!: EntityTable<Attachment, 'id'>;
  blobs!: EntityTable<StoredBlob, 'key'>;
  snapshots!: EntityTable<Snapshot, 'id'>;

  constructor(name = 'cestovni-prikazy') {
    super(name);
    this.version(1).stores({
      trips: 'id, lastOpenedAt, updatedAt',
      settings: 'key',
    });
    this.version(2).stores({
      attachments: 'id, tripId, expenseId, sha256',
      blobs: 'key, attachmentId',
    });
    this.version(3).stores({
      snapshots: 'id, tripId, createdAt',
    });
  }
}

export const db = new AppDb();

export function expiresAt(trip: Pick<TripDoc, 'lastOpenedAt'>, days = RETENTION_DAYS): Date {
  return new Date(new Date(trip.lastOpenedAt).getTime() + days * DAY_MS);
}

export async function listTrips(d: AppDb = db): Promise<TripDoc[]> {
  return (await d.trips.orderBy('updatedAt').reverse().toArray()).map(migrateTrip);
}

export async function getTrip(id: string, d: AppDb = db): Promise<TripDoc | undefined> {
  const t = await d.trips.get(id);
  return t && migrateTrip(t);
}

export async function saveTrip(trip: TripDoc, d: AppDb = db): Promise<void> {
  await d.trips.put(trip);
}

/** Zaznamená otevření cesty – od něj se počítá doba do automatického smazání. */
export async function touchTrip(id: string, now: Date, d: AppDb = db): Promise<void> {
  await d.trips.update(id, { lastOpenedAt: now.toISOString() });
}

/** Smaže cestu včetně všech příloh a jejich souborů v jedné transakci. */
export async function deleteTrip(id: string, d: AppDb = db): Promise<void> {
  await d.transaction('rw', [d.trips, d.attachments, d.blobs, d.snapshots], async () => {
    await d.snapshots.where('tripId').equals(id).delete();
    const ids = await d.attachments.where('tripId').equals(id).primaryKeys();
    await d.blobs.where('attachmentId').anyOf(ids).delete();
    await d.attachments.bulkDelete(ids);
    await d.trips.delete(id);
  });
}

export async function deleteEverything(d: AppDb = db): Promise<void> {
  await d.transaction('rw', [d.trips, d.settings, d.attachments, d.blobs, d.snapshots], async () => {
    await Promise.all([d.trips.clear(), d.settings.clear(), d.attachments.clear(), d.blobs.clear(), d.snapshots.clear()]);
  });
}

/** Smaže cesty, které nikdo neotevřel déle než nastavenou dobu. Vrací počet smazaných. */
export async function purgeExpired(now: Date, days = RETENTION_DAYS, d: AppDb = db): Promise<number> {
  const limit = new Date(now.getTime() - days * DAY_MS).toISOString();
  const expired = await d.trips.where('lastOpenedAt').below(limit).primaryKeys();
  for (const id of expired) await deleteTrip(id, d);
  return expired.length;
}

export type Remembered = Pick<TripDoc, 'employee' | 'employer' | 'sector'>;

export async function getRemembered(d: AppDb = db): Promise<Remembered | undefined> {
  return (await d.settings.get('remembered'))?.value as Remembered | undefined;
}

export async function setRemembered(value: Remembered | undefined, d: AppDb = db): Promise<void> {
  if (value) await d.settings.put({ key: 'remembered', value });
  else await d.settings.delete('remembered');
}
