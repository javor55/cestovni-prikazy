import { calculate } from '@cp/core';
import { describe, expect, it } from 'vitest';
import { addTransit, BORDER_TABLE, mainTransport, missingTransit, normalizeCrossings, pathOf, returnSegment, segmentsFromPlan } from './route.js';
import { toInput } from './toInput.js';
import { emptySegment, newTrip, type SegmentDoc, type TripDoc } from './trip.js';

const seg = (over: Partial<SegmentDoc>): SegmentDoc => ({ ...emptySegment(), ...over });

/** Ústí nad Labem → Záhřeb autem přes Rakousko a Slovinsko, tam i zpět. */
function zagreb(): TripDoc {
  const t = newTrip(new Date('2026-10-01T08:00:00Z'));
  Object.assign(t, {
    kind: 'foreign',
    startPlace: 'Ústí nad Labem',
    destinations: 'Záhřeb',
    destinationCountry: 'HR',
    route: [
      { id: 'r1', place: '', country: 'AT', stop: false },
      { id: 'r2', place: '', country: 'SI', stop: false },
    ],
    plannedStart: '2026-10-14T05:00',
    plannedEnd: '2026-10-15T22:00',
    plannedTransportKinds: ['soukrome-auto'],
  });
  return t;
}

describe('trasa úseku', () => {
  it('úsek do jiného státu má vždy přechod do státu příjezdu', () => {
    const s = seg({ fromCountry: 'CZ', toCountry: 'AT' });
    normalizeCrossings(s);
    expect(pathOf(s)).toEqual(['CZ', 'AT']);
    s.toCountry = 'HR';
    normalizeCrossings(s);
    expect(pathOf(s)).toEqual(['CZ', 'HR']);
    addTransit(s, 'AT');
    addTransit(s, 'SI');
    expect(pathOf(s)).toEqual(['CZ', 'AT', 'SI', 'HR']);
    s.toCountry = 'CZ';
    s.crossings = s.crossings.slice(-1);
    normalizeCrossings(s);
    expect(s.crossings).toEqual([]);
  });

  it('z plánu vznikne cesta tam a zpět se státy po cestě', () => {
    const [there, back] = segmentsFromPlan(zagreb());
    expect(there).toMatchObject({ fromPlace: 'Ústí nad Labem', toPlace: 'Záhřeb', fromCountry: 'CZ', toCountry: 'HR', departure: '2026-10-14T05:00', arrival: '', transport: 'soukrome-auto' });
    expect(pathOf(there!)).toEqual(['CZ', 'AT', 'SI', 'HR']);
    expect(back).toMatchObject({ fromPlace: 'Záhřeb', toPlace: 'Ústí nad Labem', toCountry: 'CZ', arrival: '2026-10-15T22:00' });
    expect(pathOf(back!)).toEqual(['HR', 'SI', 'AT', 'CZ']);
    expect(there!.crossings.every((c) => c.at === '')).toBe(true);
  });

  it('zastávka na trase rozdělí cestu tam na dva úseky; místo bez státu leží ve státě předchozího bodu', () => {
    const t = zagreb();
    t.route = [
      { id: 'a', place: 'Linec', country: 'AT', stop: false },
      { id: 'b', place: 'Štýrský Hradec', country: '', stop: true },
      { id: 'c', place: '', country: 'SI', stop: false },
    ];
    const segs = segmentsFromPlan(t);
    expect(segs.map((s) => `${s.fromPlace} → ${s.toPlace}`)).toEqual(['Ústí nad Labem → Štýrský Hradec', 'Štýrský Hradec → Záhřeb', 'Záhřeb → Ústí nad Labem']);
    expect(segs.map(pathOf)).toEqual([['CZ', 'AT'], ['AT', 'SI', 'HR'], ['HR', 'SI', 'AT', 'CZ']]);
    expect(segs[0]!.departure).toBe('2026-10-14T05:00');
    expect(segs[1]!.departure).toBe('');
  });

  it('hlavní dopravní prostředek z plánu: ten, kterým se jede nejdál', () => {
    expect(mainTransport(['taxi', 'letadlo', 'mhd'])).toBe('letadlo');
    expect(mainTransport(['pujcene-auto', 'lod'])).toBe('lod');
    expect(mainTransport([])).toBe('vlak');
  });

  it('tuzemský plán dá úseky bez přechodů', () => {
    const t = { ...zagreb(), kind: 'domestic' as const };
    expect(segmentsFromPlan(t).map(pathOf)).toEqual([['CZ'], ['CZ']]);
  });

  it('zpáteční cesta obrátí trasu všech úseků', () => {
    const t = zagreb();
    t.segments = [seg({ fromPlace: 'Ústí', toPlace: 'Vídeň', toCountry: 'AT', transport: 'vlak', km: '400' }), seg({ fromPlace: 'Vídeň', fromCountry: 'AT', toPlace: 'Záhřeb', toCountry: 'HR' })];
    t.segments.forEach(normalizeCrossings);
    addTransit(t.segments[1]!, 'SI');
    const r = returnSegment(t)!;
    expect(r).toMatchObject({ fromPlace: 'Záhřeb', fromCountry: 'HR', toPlace: 'Ústí', toCountry: 'CZ', transport: 'vlak', km: '400' });
    expect(pathOf(r)).toEqual(['HR', 'SI', 'AT', 'CZ']);
  });

  it('po zemi upozorní na přechod mezi státy, které nesousedí; u letadla ne', () => {
    expect(missingTransit(seg({ fromCountry: 'CZ', toCountry: 'HR', crossings: [{ id: 'a', to: 'HR', at: '' }], transport: 'soukrome-auto' }))).toEqual([['CZ', 'HR']]);
    expect(missingTransit(seg({ fromCountry: 'CZ', toCountry: 'HR', crossings: [{ id: 'a', to: 'HR', at: '' }], transport: 'letadlo' }))).toEqual([]);
    const ok = seg({ fromCountry: 'CZ', toCountry: 'HR', transport: 'vlak', crossings: ['AT', 'SI', 'HR'].map((to) => ({ id: to, to, at: '' })) });
    expect(missingTransit(ok)).toEqual([]);
  });

  it('tabulka hranic je souměrná', () => {
    for (const [a, list] of Object.entries(BORDER_TABLE)) for (const b of list) expect(BORDER_TABLE[b], `${a}–${b}`).toContain(a);
  });
});

describe('výpočet s více přechody v jednom úseku', () => {
  function filled(): TripDoc {
    const t = zagreb();
    t.segments = segmentsFromPlan(t);
    // Sazba pro Chorvatsko zatím v sazbách není (čeká se na úplnou přílohu vyhlášky) – zadá se ručně.
    t.employerRates.foreignBase.HR = { amount: '45', currency: 'EUR' };
    t.perDiemRates.EUR = { rate: '24,30', unit: '1', rateDate: '2026-10-13' };
    const [there, back] = t.segments as [SegmentDoc, SegmentDoc];
    there.arrival = '2026-10-14T14:00';
    there.crossings.forEach((c, i) => (c.at = ['2026-10-14T06:30', '2026-10-14T11:00', '2026-10-14T12:30'][i]!));
    back.departure = '2026-10-15T13:00';
    back.crossings.forEach((c, i) => (c.at = ['2026-10-15T14:30', '2026-10-15T16:00', '2026-10-15T20:30'][i]!));
    return t;
  }

  it('jeden úsek se třemi přechody: doba v každém státě a rozhodný stát dne', () => {
    const m = toInput(filled());
    expect(m.issues).toEqual([]);
    const r = calculate(m.input!);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const day1 = r.perDiem!.days[0]!;
    // 5:00–6:30 Česko, 6:30–11:00 Rakousko, 11:00–12:30 Slovinsko, od 12:30 Chorvatsko.
    expect(Object.fromEntries(day1.countries.map((c) => [c.country, c.minutes]))).toMatchObject({ AT: 270, SI: 90, HR: 690 });
    expect(r.perDiem!.days.map((d) => d.foreign?.country)).toEqual(['HR', 'HR']);
  });

  it('chybějící stát po cestě a chybějící čas přechodu jsou varování, ne chyba', () => {
    const t = filled();
    t.segments[0]!.crossings.splice(0, 2); // jen CZ → HR
    t.segments[1]!.crossings[1]!.at = '';
    const m = toInput(t);
    expect(m.issues.map((i) => [i.severity, i.code])).toEqual([
      ['warning', 'FORM_TRANSIT_MISSING'],
      ['warning', 'FORM_CROSSING_TIME'],
    ]);
    expect(m.issues[0]!.message).toContain('CZ a HR spolu nesousedí');
    expect(m.issues[1]!.message).toContain('SI → AT');
    const r = calculate(m.input!);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('nevybraný stát u přechodu je chyba', () => {
    const t = filled();
    t.segments[0]!.crossings[0]!.to = '';
    expect(toInput(t).issues.map((i) => i.code)).toContain('FORM_CROSSING_COUNTRY');
  });
});
