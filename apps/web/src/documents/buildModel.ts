import { formatMinutes, type CalculationResult } from '@cp/core';
import { DOC_MODEL_VERSION, type DocModel, type Lang } from '@cp/documents/model';
import { ruleSets } from '@cp/rules';
import { formatDateTime, formatDay, formatExact, formatMinor, formatRate, perDiemRoundingNote } from '../model/format.js';
import type { DocCounts, Mapped } from '../model/toInput.js';
import { crossingsText, type TripDoc } from '../model/trip.js';
import { docTexts } from './i18n.js';

/** Číslo bez měny pro sloupec „Kč“. */
const num = (minor: number) => formatMinor(minor).replace(/\s?Kč$/, '');

export interface BuildInput {
  trip: TripDoc;
  mapped: Mapped;
  result?: CalculationResult;
  docCounts: DocCounts;
  documentCount: number;
  now: Date;
  /** Jazyk dokumentu, výchozí čeština. */
  lang?: Lang;
}

/** Sestaví z cesty a výsledku výpočtu model dokumentu – naformátovaný, neměnný snímek pro PDF. */
export function buildDocModel({ trip, mapped, result, docCounts, documentCount, now, lang = 'cs' }: BuildInput): DocModel {
  const L = docTexts(lang);
  const t = L.t;
  const money = (minor: number, currency = 'CZK') => L.currency(formatMinor(minor, currency));
  const exact = (decimal: string, currency: string) => L.currency(formatExact(decimal, currency));
  const mealLetters = (m?: { breakfast: boolean; lunch: boolean; dinner: boolean }) =>
    m ? [m.breakfast && L.mealLetters[0], m.lunch && L.mealLetters[1], m.dinner && L.mealLetters[2]].filter(Boolean).join(' + ') : '';
  const pd = result?.perDiem;
  const s = result?.settlement;
  const km = trip.segments.reduce((sum, x) => sum + (Number(x.km.replace(',', '.')) || 0), 0);

  const foreignReductions: Record<string, number> = {};
  for (const d of pd?.days ?? []) if (d.foreign) foreignReductions[d.foreign.currency] = (foreignReductions[d.foreign.currency] ?? 0) + d.foreign.reduction;
  const dayNotes = [...new Set((pd?.days ?? []).flatMap((d) => d.notes))];

  const rows: DocModel['settlement']['rows'] = [];
  if (s) {
    if (s.domesticPerDiemCzk || !s.currencies.length) rows.push({ label: t.domesticPerDiem, foreign: '', czk: num(s.domesticPerDiemCzk) });
    for (const c of s.convertedPerDiem) {
      rows.push({ label: t.foreignPerDiemRate(`${formatRate(c.rate)}${c.rateUnit > 1 ? ` / ${c.rateUnit}` : ''}`), foreign: c.exactAmount ? exact(c.exactAmount, c.currency) : money(c.amount, c.currency), czk: num(c.czk) });
    }
    for (const c of s.currencies) {
      if (c.perDiemExact) rows.push({ label: c.pocketMoney ? t.foreignPerDiemPocket : t.foreignPerDiem, foreign: exact(c.perDiemExact, c.currency), czk: '' });
      else {
        rows.push({ label: t.foreignPerDiem, foreign: money(c.perDiem, c.currency), czk: '' });
        if (c.pocketMoney) rows.push({ label: t.pocketMoney, foreign: money(c.pocketMoney, c.currency), czk: '' });
      }
      if (c.fromAdvance) rows.push({ label: t.fromAdvance, foreign: money(c.fromAdvance, c.currency), czk: '' });
      rows.push({ label: t.advanceGiven, foreign: `−${money(c.advance, c.currency)}`, czk: '' });
      rows.push({
        label: t.balance(c.balance >= 0, c.currency, c.rate ? formatRate(c.rate) : ''),
        foreign: money(c.balance, c.currency).replace(/^-/, '−'),
        czk: num(c.balanceCzk).replace(/^-/, '−'),
      });
    }
    rows.push({ label: t.employeeExpenses, foreign: '', czk: num(s.employeeExpensesCzk) });
    if (result?.vehicle) rows.push({ label: t.vehicleComp, foreign: '', czk: num(s.vehicleCzk) });
    if (s.advanceCzk) rows.push({ label: t.advanceCzk, foreign: '', czk: `−${num(s.advanceCzk)}` });
    if (s.employerPaidCzk) rows.push({ label: t.employerPaid, foreign: '', czk: `(${num(s.employerPaidCzk)})` });
  }

  const v = result?.vehicle;
  const tv = trip.vehicle;

  return {
    version: DOC_MODEL_VERSION,
    lang,
    number: trip.number,
    createdAt: now.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    ruleSet: result?.ruleSet ? `${result.ruleSet.id} v${result.ruleSet.version}` : '',
    issued: { place: trip.issuedPlace, date: formatDay(trip.issuedOn) },
    employer: { ...trip.employer, sector: trip.sector === 'business' ? t.sectorBusiness : t.sectorPublic },
    employee: { ...trip.employee },
    trip: {
      kind: trip.kind === 'foreign' ? t.kindForeign : t.kindDomestic,
      purpose: trip.purpose,
      startPlace: trip.startPlace,
      endPlace: trip.endPlace,
      plannedStart: formatDateTime(trip.plannedStart),
      plannedEnd: formatDateTime(trip.plannedEnd),
      // Cíl v zahraničí se státem v závorce, např. „Záhřeb (Chorvatsko)“.
      destinations:
        trip.kind === 'foreign' && trip.destinationCountry && trip.destinationCountry !== 'CZ' && trip.destinations
          ? `${trip.destinations} (${L.country(trip.destinationCountry)})`
          : trip.destinations,
      via: [...trip.route.map((r) => [r.place, r.country && trip.kind === 'foreign' ? L.country(r.country) : ''].filter(Boolean).join(' – ')), trip.via].filter(Boolean).join(', '),
      transport: [...trip.plannedTransportKinds.map(L.transport), trip.plannedTransport].filter(Boolean).join(', '),
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
        transport: L.transport(x.transport) + (x.private ? t.privatePart : '') + (x.carrier ? `, ${x.carrier}` : ''),
        km: x.km,
        border: crossingsText(x, formatDateTime, '\n', ' – ').replaceAll('čas nezadán', t.timeMissing),
      })),
    perDiem: {
      days: (pd?.days ?? []).map((d) => ({
        date: L.day(d.date),
        domesticTime: formatMinutes(d.domesticMinutes),
        foreignTime: formatMinutes(d.foreignMinutes),
        domestic: d.domestic ? `${d.domestic.bandId} h: ${money(d.domestic.rate)}${d.domestic.freeMeals ? ` − ${d.domestic.freeMeals} × ${d.domestic.reductionPct} %` : ''}` : '',
        domesticAmount: d.domestic ? money(d.domestic.amount) : '',
        // U států mimo přílohu vyhlášky dává jádro jen kód – název doplní prohlížeč.
        country: d.foreign ? L.country(d.foreign.country, d.foreign.countryName === d.foreign.country ? undefined : d.foreign.countryName) : d.countries[0] ? L.country(d.countries[0].country) : '',
        tier: d.foreign?.tierId ?? '',
        base: d.foreign ? money(d.foreign.baseRate, d.foreign.currency) : '',
        tierAmount: d.foreign ? money(d.foreign.tierAmount, d.foreign.currency) : '',
        meals: mealLetters(trip.meals[d.date]),
        reduction: d.foreign?.freeMeals ? `${d.foreign.freeMeals} × ${d.foreign.reductionPct} % = −${money(d.foreign.reduction, d.foreign.currency)}` : '',
        amount: d.foreign ? money(d.foreign.amount, d.foreign.currency) : '',
        pocketMoney: d.pocketMoney ? money(d.pocketMoney.amount, d.pocketMoney.currency) : '',
      })),
      domesticTotal: money(pd?.domesticTotal ?? 0),
      foreignTotal: Object.entries(pd?.foreignTotals ?? {})
        .map(([c, a]) => money(a, c))
        .join(' + '),
      reductionTotal: Object.entries(foreignReductions)
        .filter(([, a]) => a)
        .map(([c, a]) => `−${money(a, c)}`)
        .join(', '),
      note: [
        t.mealsNote,
        Object.keys(pd?.foreignTotals ?? {}).length ? t.reductionNote : '',
        perDiemRoundingNote(ruleSets[0]!.rounding, Object.keys(pd?.foreignTotals ?? {}).length > 0, lang),
        ...dayNotes.map(L.note),
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
        category: L.category(r.category),
        description: e.description,
        supplier: e.supplier,
        amount: money(r.amount, r.currency),
        rate: r.rate && r.currency !== 'CZK' ? `${formatRate(r.rate)}${(r.rateUnit ?? 1) > 1 ? ` / ${r.rateUnit}` : ''} · ${L.rateSource(r.rateSource!)}${r.rateSource === 'CNB' && e.rateDate ? ` ${formatDay(e.rateDate)}` : ''}` : '',
        czk: num(r.czk),
        payment: L.payment(e.paymentMethod),
        docs: `${c.accounting}+${c.payment}`,
        note: [!r.reimbursable && t.notReimbursed, r.payer === 'EMPLOYER' && t.paidByEmployer, e.note].filter(Boolean).join(', '),
      };
    }),
    expensesNote: t.expensesNote,
    ...(v &&
      tv.used && {
        vehicle: {
          vehicle: [tv.model, tv.plate].filter(Boolean).join(', ') || t.privateVehicle,
          owner: tv.owner,
          fuel: L.fuel(tv.fuel),
          consumption: `${v.consumption.replace('.', ',')} ${v.unit}/100 km`,
          km: `${v.km.replace('.', ',')} km`,
          basic: num(v.basic),
          basicCalc: `${v.km.replace('.', ',')} km × ${money(v.ratePerKm)}`,
          fuelComp: num(v.fuelCompensation),
          fuelCalc: `${v.quantity.replace('.', ',')} ${v.unit} × ${money(v.fuelPrice)}`,
          fuelPriceSource:
            v.fuelPriceSource === 'RECEIPT'
              ? t.fuelReceipt
              : v.fuelPriceSource === 'RECEIPTS'
                ? t.fuelReceipts(L.fuelPriceRef(v.fuelPriceRef))
                : v.fuelPriceSource === 'AVERAGE_MANUAL'
                  ? t.fuelManual(v.fuelPriceRef + (v.rulesAveragePrice !== undefined ? t.rulesPrice(money(v.rulesAveragePrice)) : ''))
                  : t.fuelAverage(L.fuelPriceRef(v.fuelPriceRef)),
          total: num(v.total),
          requested: tv.requestedByEmployer ? t.yes : t.no,
        },
      }),
    settlement: {
      rows,
      payoutLabel: (s?.payout ?? 0) >= 0 ? t.payout : t.refund,
      payout: money(Math.abs(s?.payout ?? 0)),
      headline: s
        ? [
            { label: t.claimCzk, value: money(s.claimCzk) },
            ...s.currencies.map((c) => ({ label: t.headlineBalance(c.balance >= 0, money(Math.abs(c.balance), c.currency)), value: money(Math.abs(c.balanceCzk)) })),
            { label: t.totalCost, value: money(s.totalCostCzk) },
          ]
        : [],
    },
    documentCount: String(documentCount),
    declaration: t.declaration,
  };
}
