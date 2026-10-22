import type { RuleSet } from '@cp/rules';
import { Fraction, ZERO } from './fraction.js';
import type { IssueList } from './issues.js';
import type { CountryCode, MealDay, TripInput } from './model.js';
import { formatMoney, roundMinor, type Money } from './money.js';
import { datePart, datesBetween, dayStart, formatDate, formatMinutes, nextDate, overlap, TIME_ZONE } from './time.js';
import { HOME, type Timeline } from './timeline.js';

export interface DomesticDay {
  bandId: string;
  /** Sazba pro pásmo v haléřích. */
  rate: number;
  rateSource: 'MINIMUM' | 'EMPLOYER';
  freeMeals: number;
  reductionPct: number;
  reduction: number;
  beforeRounding: number;
  amount: number;
}

export interface ForeignDay {
  country: CountryCode;
  countryName: string;
  currency: string;
  baseRate: number;
  /** RULES = sazba státu z vyhlášky, OTHER = sazba pro státy v příloze neuvedené, EMPLOYER = vlastní sazba. */
  baseRateSource: 'RULES' | 'OTHER' | 'EMPLOYER';
  tierId: string;
  /** Poměrná část základní sazby pro pásmo, zaokrouhlená na nejmenší jednotky (jen pro zobrazení). */
  tierAmount: number;
  freeMeals: number;
  reductionPct: number;
  reduction: number;
  beforeRounding: number;
  amount: number;
}

/** Úsek dne v jednom státě (místní čas „HH:MM“, konec dne „24:00“). Soukromá část se do doby nepočítá. */
export interface DayInterval {
  from: string;
  to: string;
  country: CountryCode;
  minutes: number;
  private?: boolean;
}

export interface DayResult {
  date: string;
  /** Časové úseky dne po státech – rozpis, ze kterého vznikly doby v ČR a v zahraničí. */
  intervals: DayInterval[];
  label: string;
  domesticMinutes: number;
  foreignMinutes: number;
  countries: { country: CountryCode; minutes: number }[];
  domestic?: DomesticDay;
  foreign?: ForeignDay;
  pocketMoney?: Money & { pct: number };
  notes: string[];
}

export interface PerDiemResult {
  days: DayResult[];
  domesticTotal: number;
  /** Zahraniční stravné po měnách. */
  foreignTotals: Record<string, number>;
  pocketMoneyTotals: Record<string, number>;
}

/**
 * Přesné součty zahraničního stravného a kapesného po měnách (v nejmenších jednotkách, bez zaokrouhlení).
 * Při režimu zaokrouhlení NONE se do přepočtu na Kč bere přesná hodnota, např. 2/3 sazby 50 EUR po krácení
 * o 35 % = 21,6667 EUR, ne 21,67 EUR. Drží se mimo výsledek, aby výsledek zůstal převoditelný do JSON.
 */
export const exactForeignTotals = new WeakMap<PerDiemResult, { perDiem: Record<string, Fraction>; pocketMoney: Record<string, Fraction> }>();

type Minutes = { date: string; domestic: number; foreign: Map<CountryCode, number>; order: CountryCode[]; intervals: DayInterval[] };

const clock = new Intl.DateTimeFormat('cs-CZ', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// Okamžiky jsou v minutách od epochy.
const hhmm = (t: number, dayEnd: number) => (t >= dayEnd ? '24:00' : clock.format(t * 60000));

/** Rozdělí interval [s, e) podle soukromých částí na započítané a soukromé kusy. */
function splitByExcluded(s: number, e: number, excluded: Timeline['excluded']): { s: number; e: number; private: boolean }[] {
  const cuts = new Set([s, e]);
  for (const x of excluded) {
    if (x.start > s && x.start < e) cuts.add(x.start);
    if (x.end > s && x.end < e) cuts.add(x.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  return points.slice(0, -1).map((a, i) => {
    const b = points[i + 1]!;
    return { s: a, e: b, private: excluded.some((x) => x.start <= a && b <= x.end) };
  });
}

function minutesPerDay(trip: TripInput, tl: Timeline): Minutes[] {
  return datesBetween(datePart(trip.start), datePart(trip.end)).map((date) => {
    const ds = dayStart(date);
    const de = dayStart(nextDate(date));
    let domestic = 0;
    const foreign = new Map<CountryCode, number>();
    const order: CountryCode[] = [];
    const intervals: DayInterval[] = [];
    for (const p of tl.presence) {
      let m = overlap(p.start, p.end, ds, de);
      if (!m) continue;
      for (const piece of splitByExcluded(Math.max(p.start, ds), Math.min(p.end, de), tl.excluded)) {
        intervals.push({ from: hhmm(piece.s, de), to: hhmm(piece.e, de), country: p.country, minutes: piece.e - piece.s, ...(piece.private && { private: true }) });
      }
      for (const x of tl.excluded) {
        m -= overlap(Math.max(p.start, ds), Math.min(p.end, de), x.start, x.end);
      }
      if (m <= 0) continue;
      if (p.country === HOME) domestic += m;
      else {
        foreign.set(p.country, (foreign.get(p.country) ?? 0) + m);
        order.push(p.country);
      }
    }
    return { date, domestic, foreign, order, intervals };
  });
}

function mealCounts(day: MealDay | undefined, foreignApplies: boolean) {
  let domestic = 0;
  let foreign = 0;
  for (const meal of [day?.breakfast, day?.lunch, day?.dinner]) {
    if (!meal?.free) continue;
    const part = meal.part ?? (foreignApplies ? 'foreign' : 'domestic');
    if (part === 'foreign') foreign++;
    else domestic++;
  }
  return { domestic, foreign };
}

export function computePerDiem(trip: TripInput, tl: Timeline, rules: RuleSet, issues: IssueList): PerDiemResult {
  const days = minutesPerDay(trip, tl);
  const notesByDate = new Map<string, string[]>();
  const note = (date: string, text: string) => notesByDate.set(date, [...(notesByDate.get(date) ?? []), text]);

  // Krátké pobyty v zahraničí (pod 1 hodinu za den) se přičítají k tuzemské části.
  for (const d of days) {
    const abroad = [...d.foreign.values()].reduce((a, b) => a + b, 0);
    if (abroad > 0 && abroad < rules.foreign.minAbroadMinutes) {
      d.domestic += abroad;
      d.foreign.clear();
      note(d.date, `Pobyt v zahraničí ${formatMinutes(abroad)} je kratší než 1 hodina – započten do tuzemské části.`);
    }
  }

  const minBand = Math.min(...rules.domestic.bands.map((b) => b.minMinutes));
  if (trip.options?.combineShortDomesticDays && days.every((d) => d.foreign.size === 0 && d.domestic < minBand)) {
    const total = days.reduce((a, d) => a + d.domestic, 0);
    if (total >= minBand && days.length > 1) {
      days.forEach((d, i) => (d.domestic = i === 0 ? total : 0));
      note(days[0]!.date, `Doba cesty ve všech dnech sečtena (${formatMinutes(total)}) podle nastavení „sečíst krátké dny“.`);
    }
  }

  const reportedCountries = new Set<string>();
  const pocketPct = trip.employerRates?.pocketMoneyPct ?? 0;
  if (pocketPct < 0 || pocketPct > rules.foreign.pocketMoneyMaxPct) {
    issues.error('POCKET_MONEY_OUT_OF_RANGE', `Kapesné ${pocketPct} % je mimo povolený rozsah 0–${rules.foreign.pocketMoneyMaxPct} % zahraničního stravného. Opravte procento.`);
  }

  const result: PerDiemResult = { days: [], domesticTotal: 0, foreignTotals: {}, pocketMoneyTotals: {} };
  const exact = { perDiem: {} as Record<string, Fraction>, pocketMoney: {} as Record<string, Fraction> };
  exactForeignTotals.set(result, exact);
  const addExact = (to: Record<string, Fraction>, currency: string, value: Fraction) => (to[currency] = (to[currency] ?? ZERO).add(value));

  for (const d of days) {
    const foreignMinutes = [...d.foreign.values()].reduce((a, b) => a + b, 0);
    const tier = rules.foreign.tiers.find((t) => foreignMinutes >= t.minMinutes && (t.maxMinutes === null || foreignMinutes <= t.maxMinutes));
    const meals = mealCounts(trip.meals.find((m) => m.date === d.date), tier !== undefined);
    const day: DayResult = {
      date: d.date,
      intervals: d.intervals,
      label: formatDate(d.date),
      domesticMinutes: d.domestic,
      foreignMinutes,
      countries: [...d.foreign.entries()].map(([country, minutes]) => ({ country, minutes })),
      notes: notesByDate.get(d.date) ?? [],
    };

    const band = rules.domestic.bands.find((b) => d.domestic >= b.minMinutes && (b.maxMinutes === null || d.domestic <= b.maxMinutes));
    if (band) {
      const own = trip.employerRates?.domestic?.[band.id];
      let rate: number;
      if (trip.sector === 'business') {
        rate = own ?? band.business.min;
        if (own !== undefined && own < band.business.min) {
          issues.error('DOMESTIC_RATE_BELOW_MINIMUM', `Vlastní sazba tuzemského stravného pro pásmo ${band.id} h (${formatMoney({ amount: own, currency: 'CZK' })}) je nižší než zákonné minimum ${formatMoney({ amount: band.business.min, currency: 'CZK' })}.`);
        }
        if (own !== undefined && own > band.public.max) {
          issues.info('DOMESTIC_RATE_ABOVE_TAX_LIMIT', `Sazba pro pásmo ${band.id} h převyšuje horní hranici pro platovou sféru (${formatMoney({ amount: band.public.max, currency: 'CZK' })}). Částka nad tuto hranici je u zaměstnance zdanitelným příjmem.`);
        }
      } else {
        rate = own ?? band.public.min;
        if (rate < band.public.min || rate > band.public.max) {
          issues.error('DOMESTIC_RATE_OUT_OF_RANGE', `Sazba tuzemského stravného pro pásmo ${band.id} h musí být v platové sféře v rozpětí ${formatMoney({ amount: band.public.min, currency: 'CZK' })} až ${formatMoney({ amount: band.public.max, currency: 'CZK' })}.`);
        }
      }
      const reduction = Fraction.of(rate).mul(band.mealReductionPct * meals.domestic).div(100);
      const before = Fraction.of(rate).sub(reduction).max(ZERO);
      const amount = roundMinor(before, rules.rounding.domesticPerDay, 'CZK');
      day.domestic = {
        bandId: band.id,
        rate,
        rateSource: own === undefined ? 'MINIMUM' : 'EMPLOYER',
        freeMeals: meals.domestic,
        reductionPct: band.mealReductionPct,
        reduction: reduction.toInt(),
        beforeRounding: before.toInt(),
        amount,
      };
      result.domesticTotal += amount;
    } else if (d.domestic > 0) {
      day.notes.push(`Doba v Česku ${formatMinutes(d.domestic)} je kratší než 5 hodin – tuzemské stravné nenáleží.`);
    }

    if (tier) {
      // Rozhodující stát: nejvíce času v daném dni (Ú-4). Při shodě později navštívený stát.
      let country = d.order[0]!;
      for (const c of d.order) if ((d.foreign.get(c) ?? 0) >= (d.foreign.get(country) ?? 0)) country = c;
      const ruleRate = rules.foreign.rates[country];
      const own = trip.employerRates?.foreignBase?.[country];
      const other = !own && !ruleRate ? rules.foreign.otherCountries : undefined;
      const base = own ?? (ruleRate && { amount: ruleRate.amount, currency: ruleRate.currency }) ?? other;
      if (other && !reportedCountries.has(country)) {
        issues.warning(
          'FOREIGN_RATE_OTHER',
          `Stát ${country} není v příloze vyhlášky ${rules.foreign.source} uveden jmenovitě – použita sazba pro ostatní země ${formatMoney(other)}. Ověřte, že stát není v příloze pod jiným názvem nebo ve skupině území.`,
          { country },
        );
        reportedCountries.add(country);
      }
      if (!base) {
        if (!reportedCountries.has(country)) {
          issues.error('FOREIGN_RATE_MISSING', `Pro stát ${country} není v sadě pravidel ${rules.id} základní sazba zahraničního stravného. Doplňte sazbu podle vyhlášky MF ručně.`, { country });
          reportedCountries.add(country);
        }
      } else {
        if (!own && ruleRate && !ruleRate.verified && !reportedCountries.has(country)) {
          issues.warning('FOREIGN_RATE_UNVERIFIED', `Sazba zahraničního stravného pro ${ruleRate.name} (${formatMoney(base)}) nebyla ověřena v textu vyhlášky. Před odevzdáním ji zkontrolujte.`, { country });
          reportedCountries.add(country);
        }
        const tierAmount = Fraction.of(base.amount).mul(tier.numerator).div(tier.denominator);
        const reductionBase = rules.foreign.mealReductionBase === 'TIER_AMOUNT' ? tierAmount : Fraction.of(base.amount);
        const reduction = reductionBase.mul(tier.mealReductionPct * meals.foreign).div(100);
        const before = tierAmount.sub(reduction).max(ZERO);
        const amount = roundMinor(before, rules.rounding.foreignPerDay, base.currency);
        // Bez zaokrouhlení (NONE) se den zobrazí na centy, ale do součtu jde přesná hodnota.
        const counted = rules.rounding.foreignPerDay === 'NONE' ? before : Fraction.of(amount);
        addExact(exact.perDiem, base.currency, counted);
        day.foreign = {
          country,
          countryName: ruleRate?.name ?? country,
          currency: base.currency,
          baseRate: base.amount,
          baseRateSource: own ? 'EMPLOYER' : other ? 'OTHER' : 'RULES',
          tierId: tier.id,
          tierAmount: tierAmount.toInt(),
          freeMeals: meals.foreign,
          reductionPct: tier.mealReductionPct,
          reduction: reduction.toInt(),
          beforeRounding: before.toInt(),
          amount,
        };
        result.foreignTotals[base.currency] = (result.foreignTotals[base.currency] ?? 0) + amount;
        if (pocketPct > 0) {
          const pct = Math.min(pocketPct, rules.foreign.pocketMoneyMaxPct);
          const pmExact = counted.mul(pct).div(100);
          const pm = pmExact.toInt();
          addExact(exact.pocketMoney, base.currency, pmExact);
          day.pocketMoney = { amount: pm, currency: base.currency, pct };
          result.pocketMoneyTotals[base.currency] = (result.pocketMoneyTotals[base.currency] ?? 0) + pm;
        }
      }
    } else if (foreignMinutes > 0) {
      day.notes.push(`Pobyt v zahraničí ${formatMinutes(foreignMinutes)} nezakládá nárok na zahraniční stravné.`);
    }
    result.days.push(day);
  }
  return result;
}
