import type { Conversion, Expense, ExpensePayer, Issue, PaymentMethod, TripInput } from '@cp/core';
import { normalizeDecimal, toMinor } from './format.js';
import type { TripDoc } from './trip.js';

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
    const receipt = v.receiptPrice ? toMinor(v.receiptPrice, 'CZK') : undefined;
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
    segments: doc.segments.map((s) => ({
      id: s.id,
      from: { place: s.fromPlace || '?', country: s.fromCountry },
      to: { place: s.toPlace || '?', country: s.toCountry },
      departure: s.departure,
      arrival: s.arrival,
      transport: s.transport,
      ...(normalizeDecimal(s.km) && { km: Number(normalizeDecimal(s.km)) }),
      ...(s.fromCountry !== s.toCountry && s.crossingAt && { borderCrossings: [{ at: s.crossingAt, from: s.fromCountry, to: s.toCountry }] }),
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
