import { describe, expect, it } from 'vitest';
import { calculate } from '../src/index.js';
import { m, seg, trip } from './helpers.js';

// Sazby CZ-2026 (vyhláška 573/2025 Sb.): 5–12 h 155 Kč, 12–18 h 236 Kč, nad 18 h 370 Kč.
// Krácení za bezplatné jídlo 70 / 35 / 25 %. Stravné za den se zaokrouhluje na celé Kč nahoru.

const brno = (start: string, end: string) => [seg('Praha/CZ', 'Brno/CZ', start, start.slice(0, 11) + '10:00')];

describe('tuzemská cesta', () => {
  it('jednodenní cesta 8,5 h = pásmo 5–12 h, 155 Kč', () => {
    const r = calculate(trip({ start: '2026-03-10T07:00', end: '2026-03-10T15:30', segments: brno('2026-03-10T07:00', '') }));
    expect(r.ok).toBe(true);
    expect(r.perDiem!.days).toHaveLength(1);
    expect(r.perDiem!.days[0]!.domestic).toMatchObject({ bandId: '5-12', rate: m(155), amount: m(155) });
    expect(r.settlement!.payout).toBe(m(155));
  });

  it('cesta kratší než 5 hodin nemá nárok na stravné a vysvětlí proč', () => {
    const r = calculate(trip({ start: '2026-03-10T08:00', end: '2026-03-10T12:30' }));
    expect(r.perDiem!.days[0]!.domestic).toBeUndefined();
    expect(r.perDiem!.days[0]!.notes.join()).toContain('kratší než 5 hodin');
    expect(r.settlement!.payout).toBe(0);
  });

  it('přesně 5 hodin už nárok zakládá, přesně 12 hodin je ještě nižší pásmo', () => {
    const five = calculate(trip({ start: '2026-03-10T08:00', end: '2026-03-10T13:00' }));
    expect(five.perDiem!.days[0]!.domestic?.amount).toBe(m(155));
    const twelve = calculate(trip({ start: '2026-03-10T06:00', end: '2026-03-10T18:00' }));
    expect(twelve.perDiem!.days[0]!.domestic?.bandId).toBe('5-12');
    const twelveAndMinute = calculate(trip({ start: '2026-03-10T06:00', end: '2026-03-10T18:01' }));
    expect(twelveAndMinute.perDiem!.days[0]!.domestic?.bandId).toBe('12-18');
  });

  it('bezplatný oběd krátí o 70 %: 155 − 108,50 = 46,50 → 47 Kč', () => {
    const r = calculate(
      trip({ start: '2026-03-10T07:00', end: '2026-03-10T15:30', meals: [{ date: '2026-03-10', lunch: { free: true } }] }),
    );
    expect(r.perDiem!.days[0]!.domestic).toMatchObject({ freeMeals: 1, reduction: m(108.5), beforeRounding: m(46.5), amount: m(47) });
  });

  it('dvě bezplatná jídla v pásmu 5–12 h vynulují stravné', () => {
    const r = calculate(
      trip({
        start: '2026-03-10T07:00',
        end: '2026-03-10T15:30',
        meals: [{ date: '2026-03-10', breakfast: { free: true }, lunch: { free: true } }],
      }),
    );
    expect(r.perDiem!.days[0]!.domestic?.amount).toBe(0);
  });

  it('jídlo, které nebylo bezplatné, stravné nekrátí', () => {
    const r = calculate(
      trip({ start: '2026-03-10T07:00', end: '2026-03-10T15:30', meals: [{ date: '2026-03-10', lunch: { free: false } }] }),
    );
    expect(r.perDiem!.days[0]!.domestic?.amount).toBe(m(155));
  });

  it('vícedenní cesta: 18 h + 24 h se snídaní + 14 h = 236 + 278 + 236 = 750 Kč', () => {
    const r = calculate(
      trip({
        start: '2026-03-10T06:00',
        end: '2026-03-12T14:00',
        meals: [{ date: '2026-03-11', breakfast: { free: true } }],
      }),
    );
    const days = r.perDiem!.days.map((d) => [d.domesticMinutes, d.domestic?.bandId, d.domestic?.amount]);
    expect(days).toEqual([
      [1080, '12-18', m(236)],
      [1440, '18+', m(278)], // 370 − 25 % (92,50) = 277,50 → 278
      [840, '12-18', m(236)],
    ]);
    expect(r.perDiem!.domesticTotal).toBe(m(750));
  });

  it('noční cesta přes půlnoc: bez nastavení nárok nevzniká, se sečtením krátkých dnů 155 Kč', () => {
    const base = trip({ start: '2026-03-10T21:00', end: '2026-03-11T03:00' });
    expect(calculate(base).perDiem!.domesticTotal).toBe(0);
    const combined = calculate({ ...base, options: { combineShortDomesticDays: true } });
    expect(combined.perDiem!.domesticTotal).toBe(m(155));
    expect(combined.perDiem!.days[0]!.notes.join()).toContain('sečtena');
  });

  it('den se změnou času na letní má 23 hodin: 00:00–18:30 je 17,5 h, tedy pásmo 12–18 h', () => {
    const r = calculate(trip({ start: '2026-03-28T23:00', end: '2026-03-29T18:30' }));
    expect(r.perDiem!.days[1]).toMatchObject({ domesticMinutes: 1050, domestic: { bandId: '12-18', amount: m(236) } });
  });

  it('den se změnou času na zimní má 25 hodin', () => {
    const r = calculate(trip({ start: '2026-10-25T00:00', end: '2026-10-25T23:00' }));
    expect(r.perDiem!.days[0]!.domesticMinutes).toBe(24 * 60);
    expect(r.perDiem!.days[0]!.domestic?.bandId).toBe('18+');
  });

  it('neexistující čas při změně času je blokující chyba', () => {
    const r = calculate(trip({ start: '2026-03-29T02:30', end: '2026-03-29T12:00' }));
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('INVALID_TIME');
  });
});

describe('sazby zaměstnavatele', () => {
  it('podnikatelská sféra: vyšší vlastní sazba se použije, nad horní hranicí platové sféry je informace o zdanění', () => {
    const r = calculate(trip({ start: '2026-03-10T07:00', end: '2026-03-10T15:30', employerRates: { domestic: { '5-12': m(200) } } }));
    expect(r.perDiem!.days[0]!.domestic).toMatchObject({ rate: m(200), rateSource: 'EMPLOYER', amount: m(200) });
    expect(r.issues.map((i) => i.code)).toContain('DOMESTIC_RATE_ABOVE_TAX_LIMIT');
  });

  it('podnikatelská sféra: sazba pod zákonným minimem je chyba', () => {
    const r = calculate(trip({ start: '2026-03-10T07:00', end: '2026-03-10T15:30', employerRates: { domestic: { '5-12': m(100) } } }));
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('DOMESTIC_RATE_BELOW_MINIMUM');
  });

  it('platová sféra: bez volby dolní hranice rozpětí, mimo rozpětí chyba', () => {
    const base = trip({ sector: 'public', start: '2026-03-10T06:00', end: '2026-03-10T20:00' });
    expect(calculate(base).perDiem!.days[0]!.domestic?.amount).toBe(m(236));
    const inRange = calculate({ ...base, employerRates: { domestic: { '12-18': m(284) } } });
    expect(inRange.perDiem!.days[0]!.domestic?.amount).toBe(m(284));
    const outOfRange = calculate({ ...base, employerRates: { domestic: { '12-18': m(300) } } });
    expect(outOfRange.issues.map((i) => i.code)).toContain('DOMESTIC_RATE_OUT_OF_RANGE');
  });
});
