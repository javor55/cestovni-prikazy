import { describe, expect, it } from 'vitest';
import { calculate } from '../src/index.js';
import { cross, seg, trip } from './helpers.js';

const codes = (r: ReturnType<typeof calculate>) => r.issues.map((i) => i.code);

describe('kontroly časové osy', () => {
  it('konec cesty před začátkem', () => {
    const r = calculate(trip({ start: '2026-03-10T15:00', end: '2026-03-10T08:00' }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('TRIP_END_BEFORE_START');
  });

  it('příjezd před odjezdem', () => {
    const r = calculate(trip({ start: '2026-03-10T07:00', end: '2026-03-10T18:00', segments: [seg('Praha/CZ', 'Brno/CZ', '2026-03-10T10:00', '2026-03-10T09:00')] }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('SEGMENT_ARRIVAL_BEFORE_DEPARTURE');
  });

  it('překrývající se úseky', () => {
    const r = calculate(
      trip({
        start: '2026-03-10T07:00',
        end: '2026-03-10T18:00',
        segments: [seg('Praha/CZ', 'Brno/CZ', '2026-03-10T07:00', '2026-03-10T10:00'), seg('Brno/CZ', 'Praha/CZ', '2026-03-10T09:30', '2026-03-10T12:00')],
      }),
    );
    expect(codes(r)).toContain('SEGMENT_OVERLAP');
  });

  it('úsek mimo dobu cesty', () => {
    const r = calculate(trip({ start: '2026-03-10T07:00', end: '2026-03-10T18:00', segments: [seg('Praha/CZ', 'Brno/CZ', '2026-03-10T06:00', '2026-03-10T09:00')] }));
    expect(codes(r)).toContain('SEGMENT_OUTSIDE_TRIP');
  });

  it('úseky nenavazují (jiný stát) – varování', () => {
    const r = calculate(
      trip({
        start: '2026-03-10T07:00',
        end: '2026-03-10T18:00',
        segments: [seg('Praha/CZ', 'Brno/CZ', '2026-03-10T07:00', '2026-03-10T10:00'), seg('Vídeň/AT', 'Vídeň/AT', '2026-03-10T11:00', '2026-03-10T12:00')],
      }),
    );
    expect(codes(r)).toContain('SEGMENT_DISCONTINUITY');
  });

  it('chybějící přechod hranice: odhad z času příjezdu a varování', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-06-01T06:00',
        end: '2026-06-01T22:00',
        segments: [
          seg('Praha/CZ', 'Drážďany/DE', '2026-06-01T06:00', '2026-06-01T09:00'),
          seg('Drážďany/DE', 'Praha/CZ', '2026-06-01T18:00', '2026-06-01T22:00', { borderCrossings: [cross('2026-06-01T20:00', 'DE', 'CZ')] }),
        ],
        perDiemRates: { EUR: { source: 'CNB', rate: '24' } },
      }),
    );
    expect(r.ok).toBe(true);
    expect(codes(r)).toContain('MISSING_BORDER_CROSSING');
    // Odhad: hranice v 9:00 (příjezd) → zahraničí 9:00–20:00 = 11 h
    expect(r.perDiem!.days[0]!.foreignMinutes).toBe(660);
  });

  it('nenavazující přechod hranice je chyba', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-06-01T06:00',
        end: '2026-06-01T22:00',
        segments: [seg('Praha/CZ', 'Vídeň/AT', '2026-06-01T06:00', '2026-06-01T11:00', { borderCrossings: [cross('2026-06-01T09:00', 'DE', 'AT')] })],
      }),
    );
    expect(codes(r)).toContain('CROSSING_INCONSISTENT');
  });

  it('přechod hranice mimo čas úseku je chyba', () => {
    const r = calculate(
      trip({
        kind: 'foreign',
        start: '2026-06-01T06:00',
        end: '2026-06-01T22:00',
        segments: [seg('Praha/CZ', 'Vídeň/AT', '2026-06-01T06:00', '2026-06-01T11:00', { borderCrossings: [cross('2026-06-01T12:00', 'CZ', 'AT')] })],
      }),
    );
    expect(codes(r)).toContain('CROSSING_OUTSIDE_SEGMENT');
  });

  it('cesta končící v zahraničí a nesoulad typu cesty – varování', () => {
    const r = calculate(
      trip({
        kind: 'domestic',
        start: '2026-06-01T06:00',
        end: '2026-06-01T22:00',
        segments: [seg('Praha/CZ', 'Vídeň/AT', '2026-06-01T06:00', '2026-06-01T11:00', { borderCrossings: [cross('2026-06-01T09:00', 'CZ', 'AT')] })],
        perDiemRates: { EUR: { source: 'CNB', rate: '24' } },
      }),
    );
    expect(codes(r)).toEqual(expect.arrayContaining(['TRIP_ENDS_ABROAD', 'KIND_MISMATCH']));
  });

  it('soukromá část cesty se do doby pro stravné nezapočítá', () => {
    const r = calculate(
      trip({
        start: '2026-03-10T06:00',
        end: '2026-03-10T20:00',
        segments: [seg('Praha/CZ', 'Brno/CZ', '2026-03-10T12:00', '2026-03-10T16:00', { private: true })],
      }),
    );
    // 14 h − 4 h soukromě = 10 h → pásmo 5–12 h
    expect(r.perDiem!.days[0]).toMatchObject({ domesticMinutes: 600, domestic: { bandId: '5-12' } });
  });

  it('cesta mimo období sazeb je blokující chyba', () => {
    const r = calculate(trip({ start: '2025-12-30T08:00', end: '2025-12-30T18:00' }));
    expect(codes(r)).toContain('RULESET_MISSING');
    const crossYear = calculate(trip({ start: '2026-12-31T08:00', end: '2027-01-01T18:00' }));
    expect(crossYear.ok).toBe(false);
    expect(crossYear.issues[0]!.message).toContain('2026-12-31');
  });

  it('výpočet je deterministický a uvádí použitou sadu pravidel', () => {
    const t = trip({ start: '2026-03-10T07:00', end: '2026-03-10T15:30' });
    expect(calculate(t)).toEqual(calculate(t));
    expect(calculate(t).ruleSet).toMatchObject({ id: 'CZ-2026', version: '1.0.0' });
    expect(codes(calculate(t))).toContain('RULESET_USED');
  });
});
