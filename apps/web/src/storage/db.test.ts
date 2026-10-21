import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { newTrip } from '../model/trip.js';
import { AppDb, deleteEverything, deleteTrip, expiresAt, getRemembered, listTrips, purgeExpired, saveTrip, setRemembered, touchTrip } from './db.js';

let d: AppDb;
beforeEach(async () => {
  d = new AppDb(`test-${Math.random()}`);
  await d.open();
});

const at = (iso: string) => new Date(iso);

describe('lokální úložiště', () => {
  it('uloží a načte cestu', async () => {
    const t = newTrip(at('2026-10-01T10:00:00Z'));
    t.purpose = 'Jednání';
    await saveTrip(t, d);
    expect((await listTrips(d)).map((x) => x.purpose)).toEqual(['Jednání']);
  });

  it('po 30 dnech od posledního otevření cestu smaže, mladší ponechá', async () => {
    const old = newTrip(at('2026-09-01T10:00:00Z'));
    const recent = newTrip(at('2026-09-01T10:00:00Z'));
    await saveTrip(old, d);
    await saveTrip(recent, d);
    await touchTrip(recent.id, at('2026-09-25T10:00:00Z'), d);

    expect(expiresAt(old).toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(await purgeExpired(at('2026-10-01T09:59:00Z'), 30, d)).toBe(0);
    expect(await purgeExpired(at('2026-10-01T10:01:00Z'), 30, d)).toBe(1);
    expect((await listTrips(d)).map((x) => x.id)).toEqual([recent.id]);
  });

  it('ruční smazání cesty a smazání všech dat', async () => {
    const a = newTrip(at('2026-10-01T10:00:00Z'));
    const b = newTrip(at('2026-10-01T10:00:00Z'));
    await saveTrip(a, d);
    await saveTrip(b, d);
    await setRemembered({ employee: a.employee, employer: a.employer, sector: 'public' }, d);

    await deleteTrip(a.id, d);
    expect((await listTrips(d)).map((x) => x.id)).toEqual([b.id]);

    await deleteEverything(d);
    expect(await listTrips(d)).toEqual([]);
    expect(await getRemembered(d)).toBeUndefined();
  });
});
