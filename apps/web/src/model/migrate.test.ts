import { describe, expect, it } from 'vitest';
import { migrateTrip } from './migrate.js';
import { newTrip, SCHEMA_VERSION } from './trip.js';

describe('migrace uložené cesty', () => {
  it('v1 → v2: kurz stravného jako objekt, datum kurzu u výdajů a záloh', () => {
    const v1 = { ...newTrip(new Date()), schemaVersion: 1, perDiemRates: { EUR: '24,30' } } as Record<string, unknown>;
    (v1.advances as unknown[]) = [{ id: 'a', amount: '100', currency: 'EUR', providedOn: '2026-10-12', rate: '24,35' }];
    (v1.expenses as unknown[]) = [{ id: 'e', rate: '24,3' }];
    const t = migrateTrip(v1);
    expect(t.schemaVersion).toBe(SCHEMA_VERSION);
    expect(t.perDiemRates.EUR).toEqual({ rate: '24,30', unit: '1', rateDate: '' });
    expect(t.advances[0]).toMatchObject({ rateUnit: '1', rateDate: '' });
    expect(t.expenses[0]!.rateDate).toBe('');
    expect(t).toMatchObject({ issuedPlace: '', issuedOn: '' });
  });

  it('v4 → v5: čas přechodu hranice jako seznam přechodů, stát cíle podle úseků', () => {
    const v4 = { ...newTrip(new Date()), schemaVersion: 4, kind: 'foreign' } as Record<string, unknown>;
    for (const k of ['plannedTransportKind', 'destinationCountry', 'transitCountries']) delete v4[k];
    (v4.segments as unknown[]) = [
      { id: 's1', fromCountry: 'CZ', toCountry: 'AT', crossingAt: '2026-10-14T09:45' },
      { id: 's2', fromCountry: 'AT', toCountry: 'AT', crossingAt: '' },
      { id: 's3', fromCountry: 'AT', toCountry: 'CZ', crossingAt: '' },
    ];
    const t = migrateTrip(v4);
    expect(t.segments.map((s) => s.crossings.map((c) => [c.to, c.at]))).toEqual([[['AT', '2026-10-14T09:45']], [], [['CZ', '']]]);
    expect(t.segments[0]).not.toHaveProperty('crossingAt');
    expect(t).toMatchObject({ destinationCountry: 'AT', route: [], plannedTransportKinds: [] });
  });

  it('aktuální verzi nechá beze změny a novější odmítne', () => {
    const t = newTrip(new Date());
    expect(migrateTrip(t)).toEqual(t);
    expect(() => migrateTrip({ ...t, schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/novější verze/);
  });
});
