import { formatMinutes, type CalculationResult, type ConversionSource } from '@cp/core';
import { DOC_MODEL_VERSION, type DocModel } from '@cp/documents/model';
import { countryName } from '../model/countries.js';
import { formatDateTime, formatDay, formatMinor, formatRate } from '../model/format.js';
import type { DocCounts, Mapped } from '../model/toInput.js';
import { crossingsText, fuelLabels, paymentLabels, plannedTransportText, transportLabels, type TripDoc } from '../model/trip.js';

/** Číslo bez měny pro sloupec „Kč“. */
const num = (minor: number) => formatMinor(minor).replace(/\s?Kč$/, '');

const rateSource: Record<ConversionSource, string> = {
  CNB: 'ČNB',
  BANK_CONFIRMATION: 'potvrzení banky',
  EXCHANGE_RECEIPT: 'doklad o směně',
  ADVANCE_RATE: 'kurz zálohy',
  MANUAL: 'ručně zadaný kurz',
};

const mealLetters = (m?: { breakfast: boolean; lunch: boolean; dinner: boolean }) =>
  m ? [m.breakfast && 'S', m.lunch && 'O', m.dinner && 'V'].filter(Boolean).join(' + ') : '';

export interface BuildInput {
  trip: TripDoc;
  mapped: Mapped;
  result?: CalculationResult;
  docCounts: DocCounts;
  documentCount: number;
  now: Date;
}

/** Sestaví z cesty a výsledku výpočtu model dokumentu – naformátovaný, neměnný snímek pro PDF. */
export function buildDocModel({ trip, mapped, result, docCounts, documentCount, now }: BuildInput): DocModel {
  const pd = result?.perDiem;
  const s = result?.settlement;
  const km = trip.segments.reduce((sum, x) => sum + (Number(x.km.replace(',', '.')) || 0), 0);

  const foreignReductions: Record<string, number> = {};
  for (const d of pd?.days ?? []) if (d.foreign) foreignReductions[d.foreign.currency] = (foreignReductions[d.foreign.currency] ?? 0) + d.foreign.reduction;
  const dayNotes = [...new Set((pd?.days ?? []).flatMap((d) => d.notes))];

  const rows: DocModel['settlement']['rows'] = [];
  if (s) {
    if (s.domesticPerDiemCzk || !s.currencies.length) rows.push({ label: 'Tuzemské stravné', foreign: '', czk: num(s.domesticPerDiemCzk) });
    for (const c of s.convertedPerDiem) {
      rows.push({ label: `Zahraniční stravné × kurz ${formatRate(c.rate)}${c.rateUnit > 1 ? ` / ${c.rateUnit}` : ''}`, foreign: formatMinor(c.amount, c.currency), czk: num(c.czk) });
    }
    for (const c of s.currencies) {
      rows.push({ label: 'Zahraniční stravné', foreign: formatMinor(c.perDiem, c.currency), czk: '' });
      if (c.pocketMoney) rows.push({ label: 'Kapesné', foreign: formatMinor(c.pocketMoney, c.currency), czk: '' });
      if (c.fromAdvance) rows.push({ label: 'Výdaje uhrazené ze zálohy', foreign: formatMinor(c.fromAdvance, c.currency), czk: '' });
      rows.push({ label: 'Poskytnutá záloha', foreign: `−${formatMinor(c.advance, c.currency)}`, czk: '' });
      rows.push({
        label: `${c.balance >= 0 ? 'Doplatek' : 'Přeplatek'} v ${c.currency}${c.rate ? ` × kurz zálohy ${formatRate(c.rate)}` : ''}`,
        foreign: formatMinor(c.balance, c.currency).replace(/^-/, '−'),
        czk: num(c.balanceCzk).replace(/^-/, '−'),
      });
    }
    rows.push({ label: 'Výdaje uhrazené zaměstnancem', foreign: '', czk: num(s.employeeExpensesCzk) });
    if (result?.vehicle) rows.push({ label: 'Náhrada za soukromé vozidlo', foreign: '', czk: num(s.vehicleCzk) });
    if (s.advanceCzk) rows.push({ label: 'Poskytnutá záloha v Kč', foreign: '', czk: `−${num(s.advanceCzk)}` });
    if (s.employerPaidCzk) rows.push({ label: 'Uhrazeno přímo zaměstnavatelem (jen náklad, nevyplácí se)', foreign: '', czk: `(${num(s.employerPaidCzk)})` });
  }

  const v = result?.vehicle;
  const tv = trip.vehicle;

  return {
    version: DOC_MODEL_VERSION,
    number: trip.number,
    createdAt: now.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    ruleSet: result?.ruleSet ? `${result.ruleSet.id} v${result.ruleSet.version}` : '',
    issued: { place: trip.issuedPlace, date: formatDay(trip.issuedOn) },
    employer: { ...trip.employer, sector: trip.sector === 'business' ? 'Podnikatelská sféra' : 'Platová sféra' },
    employee: { ...trip.employee },
    trip: {
      kind: trip.kind === 'foreign' ? 'Zahraniční' : 'Tuzemská',
      purpose: trip.purpose,
      startPlace: trip.startPlace,
      endPlace: trip.endPlace,
      plannedStart: formatDateTime(trip.plannedStart),
      plannedEnd: formatDateTime(trip.plannedEnd),
      // Cíl v zahraničí se státem v závorce, např. „Záhřeb (Chorvatsko)“.
      destinations:
        trip.kind === 'foreign' && trip.destinationCountry && trip.destinationCountry !== 'CZ' && trip.destinations
          ? `${trip.destinations} (${countryName(trip.destinationCountry)})`
          : trip.destinations,
      via: [...trip.route.map((r) => [r.place, r.country && trip.kind === 'foreign' ? countryName(r.country) : ''].filter(Boolean).join(' – ')), trip.via].filter(Boolean).join(', '),
      transport: plannedTransportText(trip),
      advances: trip.advances.filter((a) => a.amount).map((a) => `${a.amount} ${a.currency}${a.providedOn ? ` (${formatDay(a.providedOn)})` : ''}`),
      note: trip.note,
    },
    actual: { start: formatDateTime(mapped.actualStart), end: formatDateTime(mapped.actualEnd), km: km ? `${km.toLocaleString('cs-CZ')} km` : '' },
    segments: [...trip.segments]
      .sort((a, b) => a.departure.localeCompare(b.departure))
      .map((x, i) => ({
        n: String(i + 1),
        from: `${x.fromPlace} (${x.fromCountry})`,
        to: `${x.toPlace} (${x.toCountry})`,
        departure: formatDateTime(x.departure),
        arrival: formatDateTime(x.arrival),
        transport: transportLabels[x.transport] + (x.private ? ' – soukromá část' : '') + (x.carrier ? `, ${x.carrier}` : ''),
        km: x.km,
        border: crossingsText(x, formatDateTime),
      })),
    perDiem: {
      days: (pd?.days ?? []).map((d) => ({
        date: d.label,
        domesticTime: formatMinutes(d.domesticMinutes),
        foreignTime: formatMinutes(d.foreignMinutes),
        domestic: d.domestic ? `${d.domestic.bandId} h: ${formatMinor(d.domestic.rate)}${d.domestic.freeMeals ? ` − ${d.domestic.freeMeals} × ${d.domestic.reductionPct} %` : ''}` : '',
        domesticAmount: d.domestic ? formatMinor(d.domestic.amount) : '',
        // U států mimo přílohu vyhlášky dává jádro jen kód – název doplní prohlížeč.
        country: d.foreign ? (d.foreign.countryName === d.foreign.country ? countryName(d.foreign.country) : d.foreign.countryName) : d.countries[0] ? countryName(d.countries[0].country) : '',
        tier: d.foreign?.tierId ?? '',
        base: d.foreign ? formatMinor(d.foreign.baseRate, d.foreign.currency) : '',
        tierAmount: d.foreign ? formatMinor(d.foreign.tierAmount, d.foreign.currency) : '',
        meals: mealLetters(trip.meals[d.date]),
        reduction: d.foreign?.freeMeals ? `${d.foreign.freeMeals} × ${d.foreign.reductionPct} % = −${formatMinor(d.foreign.reduction, d.foreign.currency)}` : '',
        amount: d.foreign ? formatMinor(d.foreign.amount, d.foreign.currency) : '',
        pocketMoney: d.pocketMoney ? formatMinor(d.pocketMoney.amount, d.pocketMoney.currency) : '',
      })),
      domesticTotal: formatMinor(pd?.domesticTotal ?? 0),
      foreignTotal: Object.entries(pd?.foreignTotals ?? {})
        .map(([c, a]) => formatMinor(a, c))
        .join(' + '),
      reductionTotal: Object.entries(foreignReductions)
        .filter(([, a]) => a)
        .map(([c, a]) => `−${formatMinor(a, c)}`)
        .join(', '),
      note: [
        'S/O/V = bezplatně poskytnutá snídaně/oběd/večeře.',
        Object.keys(pd?.foreignTotals ?? {}).length ? 'Krácení zahraničního stravného z částky pásma.' : '',
        'Stravné za den je zaokrouhleno na celé jednotky měny nahoru.',
        ...dayNotes,
      ]
        .filter(Boolean)
        .join(' '),
      hasForeign: (pd?.days ?? []).some((d) => d.foreign),
    },
    expenses: (result?.expenses ?? []).map((r) => {
      const e = trip.expenses.find((x) => x.id === r.id)!;
      const c = docCounts[r.id] ?? { accounting: 0, payment: 0 };
      return {
        id: r.id,
        n: String(r.order),
        date: formatDay(e.date),
        category: r.category,
        description: e.description,
        supplier: e.supplier,
        amount: formatMinor(r.amount, r.currency),
        rate: r.rate && r.currency !== 'CZK' ? `${formatRate(r.rate)}${(r.rateUnit ?? 1) > 1 ? ` / ${r.rateUnit}` : ''} · ${rateSource[r.rateSource!]}${r.rateSource === 'CNB' && e.rateDate ? ` ${formatDay(e.rateDate)}` : ''}` : '',
        czk: num(r.czk),
        payment: paymentLabels[e.paymentMethod],
        docs: `${c.accounting}+${c.payment}`,
        note: [!r.reimbursable && 'neproplácí se', r.payer === 'EMPLOYER' && 'uhradil zaměstnavatel', e.note].filter(Boolean).join(', '),
      };
    }),
    expensesNote: 'Dokl. = počet účetních dokladů + dokladů o zaplacení. Výdaje uhrazené zaměstnavatelem a neproplácené výdaje nejsou v částce k výplatě.',
    ...(v &&
      tv.used && {
        vehicle: {
          vehicle: [tv.model, tv.plate].filter(Boolean).join(', ') || 'Soukromé vozidlo',
          owner: tv.owner,
          fuel: fuelLabels[tv.fuel],
          consumption: `${v.consumption.replace('.', ',')} ${v.unit}/100 km`,
          km: `${v.km.replace('.', ',')} km`,
          basic: num(v.basic),
          basicCalc: `${v.km.replace('.', ',')} km × ${formatMinor(v.ratePerKm)}`,
          fuelComp: num(v.fuelCompensation),
          fuelCalc: `${v.quantity.replace('.', ',')} ${v.unit} × ${formatMinor(v.fuelPrice)}`,
          fuelPriceSource: v.fuelPriceSource === 'RECEIPT' ? 'cena z dokladu' : v.fuelPriceSource === 'RECEIPTS' ? `cena z dokladů o tankování – ${v.fuelPriceRef}` : `průměrná cena podle ${v.fuelPriceRef}`,
          total: num(v.total),
          requested: tv.requestedByEmployer ? 'ano' : 'ne',
        },
      }),
    settlement: {
      rows,
      payoutLabel: (s?.payout ?? 0) >= 0 ? 'K výplatě zaměstnanci' : 'Vratka zaměstnance',
      payout: formatMinor(Math.abs(s?.payout ?? 0)),
      headline: s
        ? [
            { label: 'Nárok v Kč', value: formatMinor(s.claimCzk) },
            ...s.currencies.map((c) => ({ label: `${c.balance >= 0 ? 'Doplatek' : 'Přeplatek'} ${formatMinor(Math.abs(c.balance), c.currency)} =`, value: formatMinor(Math.abs(c.balanceCzk)) })),
            { label: 'Celkové náklady cesty', value: formatMinor(s.totalCostCzk) },
          ]
        : [],
    },
    documentCount: String(documentCount),
    declaration:
      'Prohlašuji, že jsem pracovní cestu vykonal(a) podle uvedených údajů, že všechny údaje jsou pravdivé a úplné a že předložené doklady se vztahují k této pracovní cestě.',
  };
}
