import type { Conversion, Expense, ExpensePayer, Issue, PaymentMethod, TripInput } from '@cp/core';
import { normalizeDecimal, toMinor } from './format.js';
import { missingTransit } from './route.js';

/** Kategorie výdajů, u kterých se zadává množství paliva (l / kWh). */
export const FUEL_CATEGORIES: ReadonlySet<string> = new Set(['Pohonné hmoty', 'Nabíjení elektromobilu']);
import type { SegmentDoc, TripDoc } from './trip.js';

const PAYER: Record<PaymentMethod, ExpensePayer> = {
  PRIVATE_CARD: 'EMPLOYEE',
  PRIVATE_CASH: 'EMPLOYEE',
  EMPLOYEE_TRANSFER: 'EMPLOYEE',
  OTHER: 'EMPLOYEE',
  COMPANY_CARD: 'EMPLOYER',
  COMPANY_CASH: 'EMPLOYER',
  EMPLOYER_TRANSFER: 'EMPLOYER',
  ADVANCE: 'ADVANCE',
};

export const payerOf = (m: PaymentMethod): ExpensePayer => PAYER[m];

export interface Mapped {
  /** undefined = chybí údaje nutné pro výpočet (viz issues). */
  input?: TripInput;
  issues: Issue[];
  actualStart: string;
  actualEnd: string;
}

/** Skutečný začátek a konec: zadaný ručně, jinak první odjezd a poslední příjezd, jinak plán. */
export function actualTimes(doc: TripDoc): { start: string; end: string } {
  const deps = doc.segments.map((s) => s.departure).filter(Boolean).sort();
  const arrs = doc.segments.map((s) => s.arrival).filter(Boolean).sort();
  return {
    start: doc.actualStart || deps[0] || doc.plannedStart,
    end: doc.actualEnd || arrs.at(-1) || doc.plannedEnd,
  };
}

/** Počty dokladů k výdajům podle id výdaje. Bez nich se kontrola dokladů nespouští (např. v testech). */
export type DocCounts = Record<string, { accounting: number; payment: number }>;

export function toInput(doc: TripDoc, docs?: DocCounts): Mapped {
  const issues: Issue[] = [];
  const err = (code: string, message: string, ref?: Record<string, string>) => issues.push({ severity: 'error', code, message, ...(ref && { ref }) });
  const { start, end } = actualTimes(doc);
  if (!start || !end) {
    err('FORM_MISSING_TIMES', 'Chybí začátek a konec cesty. Doplňte průběh cesty (úseky) nebo plánovaný začátek a konec.', { step: 'prubeh' });
    return { issues, actualStart: start, actualEnd: end };
  }

  const expenses: Expense[] = [];
  doc.expenses.forEach((e, i) => {
    const name = `Výdaj č. ${i + 1}`;
    const currency = e.currency.trim().toUpperCase();
    const amount = toMinor(e.amount, currency);
    if (amount === null || amount <= 0) {
      err('FORM_EXPENSE_AMOUNT', `${name}: zadejte částku jako číslo, např. 238,50.`, { expenseId: e.id, step: 'vydaje' });
      return;
    }
    let conversion: Conversion | undefined;
    if (currency !== 'CZK' && e.paymentMethod !== 'ADVANCE') {
      if (e.rateSource === 'BANK_CONFIRMATION') {
        const czk = toMinor(e.czkAmount, 'CZK');
        conversion = { source: 'BANK_CONFIRMATION', ...(czk !== null && { czkAmount: czk }) };
      } else {
        const rate = normalizeDecimal(e.rate);
        const unit = Number(normalizeDecimal(e.rateUnit) ?? '1') || 1;
        conversion = {
          source: e.rateSource,
          ...(rate && { rate }),
          unit,
          ...(e.rateDate && { rateDate: e.rateDate }),
          ...(e.rateSource === 'MANUAL' && e.note && { manualReason: e.note }),
        };
      }
    }
    expenses.push({
      id: e.id,
      order: i + 1,
      category: e.category,
      description: e.description,
      ...(e.supplier && { supplier: e.supplier }),
      ...(e.documentNumber && { documentNumber: e.documentNumber }),
      date: e.date,
      amount: { amount, currency },
      ...(conversion && { conversion }),
      paymentMethod: e.paymentMethod,
      payer: payerOf(e.paymentMethod),
      reimbursable: e.reimbursable,
      ...(FUEL_CATEGORIES.has(e.category) && normalizeDecimal(e.fuelQuantity) && { fuelQuantity: normalizeDecimal(e.fuelQuantity)! }),
      ...(docs && { attachments: docs[e.id] ?? { accounting: 0, payment: 0 } }),
    });
  });

  const advances: TripInput['advances'] = [];
  doc.advances.forEach((a, i) => {
    const currency = a.currency.trim().toUpperCase();
    const amount = toMinor(a.amount, currency);
    if (amount === null || amount <= 0) {
      err('FORM_ADVANCE_AMOUNT', `Záloha č. ${i + 1}: zadejte částku jako číslo.`, { step: 'cesta' });
      return;
    }
    const rate = normalizeDecimal(a.rate);
    advances.push({
      id: a.id,
      amount: { amount, currency },
      providedOn: a.providedOn,
      ...(currency !== 'CZK' && rate && { conversion: { source: 'CNB', rate, unit: Number(normalizeDecimal(a.rateUnit) ?? '1') || 1, ...(a.rateDate && { rateDate: a.rateDate }) } }),
    });
  });

  let vehicle: TripInput['vehicle'];
  const v = doc.vehicle;
  if (v.used) {
    const km = normalizeDecimal(v.km);
    const consumption = v.consumption.map(normalizeDecimal).filter((c): c is string => c !== null);
    const receipt = v.fuelPriceMode === 'receipt' && v.receiptPrice ? toMinor(v.receiptPrice, 'CZK') : undefined;
    if (v.ownership === 'private' && (!km || consumption.length === 0)) {
      err('FORM_VEHICLE', 'Soukromé vozidlo: doplňte ujeté kilometry a spotřebu z technického průkazu.', { step: 'vozidlo' });
    } else if (receipt === null) {
      err('FORM_VEHICLE', 'Soukromé vozidlo: cenu paliva z dokladu zadejte jako číslo, např. 38,90.', { step: 'vozidlo' });
    } else {
      vehicle = {
        type: v.type,
        ownership: v.ownership,
        fuel: v.fuel,
        consumption,
        km: km ?? '0',
        requestedByEmployer: v.requestedByEmployer,
        ...(receipt !== undefined && { receiptPrice: { amount: receipt, date: v.receiptDate || start.slice(0, 10) } }),
        ...(v.fuelPriceMode === 'receipts' && { fuelPriceFromExpenses: true }),
      };
    }
  }

  const domestic: Record<string, number> = {};
  for (const [band, text] of Object.entries(doc.employerRates.domestic)) {
    if (!text) continue;
    const value = toMinor(text, 'CZK');
    if (value === null) err('FORM_RATE', `Vlastní sazba stravného pro pásmo ${band} h není číslo.`, { step: 'kdo' });
    else domestic[band] = value;
  }
  const foreignBase: Record<string, { amount: number; currency: string }> = {};
  for (const [country, r] of Object.entries(doc.employerRates.foreignBase)) {
    if (!r.amount) continue;
    const value = toMinor(r.amount, r.currency);
    if (value === null) err('FORM_RATE', `Sazba zahraničního stravného pro ${country} není číslo.`, { step: 'prubeh' });
    else foreignBase[country] = { amount: value, currency: r.currency };
  }
  const pocket = doc.employerRates.pocketMoneyPct ? Number(normalizeDecimal(doc.employerRates.pocketMoneyPct)) : 0;

  const perDiemRates: TripInput['perDiemRates'] = {};
  for (const [cur, r] of Object.entries(doc.perDiemRates)) {
    const rate = normalizeDecimal(r.rate);
    if (rate) perDiemRates[cur] = { source: 'CNB', rate, unit: Number(normalizeDecimal(r.unit) ?? '1') || 1, ...(r.rateDate && { rateDate: r.rateDate }) };
  }

  const input: TripInput = {
    sector: doc.sector,
    kind: doc.kind,
    start,
    end,
    segments: doc.segments.map((s, i) => ({
      id: s.id,
      from: { place: s.fromPlace || '?', country: s.fromCountry },
      to: { place: s.toPlace || '?', country: s.toCountry },
      departure: s.departure,
      arrival: s.arrival,
      transport: s.transport,
      ...(normalizeDecimal(s.km) && { km: Number(normalizeDecimal(s.km)) }),
      ...crossingsOf(s, i, issues),
      ...(s.private && { private: true }),
    })),
    meals: Object.entries(doc.meals).map(([date, m]) => ({
      date,
      ...(m.breakfast && { breakfast: { free: true } }),
      ...(m.lunch && { lunch: { free: true } }),
      ...(m.dinner && { dinner: { free: true } }),
    })),
    expenses,
    advances,
    ...(vehicle && { vehicle }),
    employerRates: { domestic, foreignBase, ...(pocket && { pocketMoneyPct: pocket }) },
    perDiemRates,
    options: { combineShortDomesticDays: doc.combineShortDomesticDays },
  };
  return { input, issues, actualStart: start, actualEnd: end };
}

/**
 * Přechody hranic úseku pro výpočet. Přechod bez času se vynechá a doba ve státě, kterým se projíždělo,
 * se započte k sousednímu státu (s varováním). Bez jediného času jádro dobu odhadne a upozorní samo.
 */
function crossingsOf(s: SegmentDoc, index: number, issues: Issue[]): { borderCrossings?: TripInput['segments'][number]['borderCrossings'] } {
  const name = `Úsek ${index + 1} (${s.fromPlace || '?'} → ${s.toPlace || '?'})`;
  const ref = { step: 'prubeh', segmentId: s.id };
  for (const [a, b] of missingTransit(s)) {
    issues.push({
      severity: 'warning',
      code: 'FORM_TRANSIT_MISSING',
      message: `${name}: státy ${a} a ${b} spolu nesousedí. Doplňte státy, kterými jste projížděli („+ stát po cestě“) – stravné se řídí státem, ve kterém jste ten den strávili nejvíc času.`,
      ref,
    });
  }
  if (s.crossings.some((c) => !c.to)) {
    issues.push({ severity: 'error', code: 'FORM_CROSSING_COUNTRY', message: `${name}: vyberte stát u každého přechodu hranice, nebo přechod odeberte.`, ref });
    return {};
  }
  const timed = s.crossings.filter((c) => c.at);
  if (timed.length === 0) return {};
  const out: NonNullable<TripInput['segments'][number]['borderCrossings']> = [];
  let current = s.fromCountry;
  let prev = s.fromCountry;
  for (const c of s.crossings) {
    if (c.at) {
      out.push({ at: c.at, from: current, to: c.to });
      current = c.to;
    } else {
      issues.push({
        severity: 'warning',
        code: 'FORM_CROSSING_TIME',
        message: `${name}: chybí čas přechodu hranice ${prev} → ${c.to}. Doba ve státě ${out.length ? prev : c.to} se započte k sousednímu státu. Doplňte čas.`,
        ref,
      });
      // Bez času se vjezd do státu připíše k poslednímu přechodu s časem (na začátku úseku se nezapočte).
      if (out.length) {
        out.at(-1)!.to = c.to;
        current = c.to;
      }
    }
    prev = c.to;
  }
  return { borderCrossings: out };
}
