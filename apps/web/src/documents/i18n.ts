// Texty údajů v dokumentu k podpisu v češtině a angličtině (např. pro zahraničního nadřízeného).
// Statické popisky šablony jsou v @cp/documents (labels.ts). Údaje zadané uživatelem se nepřekládají.

import type { ConversionSource, PaymentMethod } from '@cp/core';
import type { Lang } from '@cp/documents/model';
import type { FuelType } from '@cp/rules';
import { countryName as countryNameCs } from '../model/countries.js';
import { fuelLabels, paymentLabels, transportLabels, type TransportKind } from '../model/trip.js';

const transportEn: Record<TransportKind, string> = {
  'soukrome-auto': 'Private car',
  'pujcene-auto': 'Borrowed car (family, friend)',
  'pronajate-auto': 'Rental car',
  'firemni-auto': 'Company car',
  vlak: 'Train',
  autobus: 'Bus',
  letadlo: 'Plane',
  lod: 'Ship, ferry',
  mhd: 'Public transport',
  taxi: 'Taxi',
  jine: 'Other',
};

const paymentEn: Record<PaymentMethod, string> = {
  PRIVATE_CARD: 'Private card',
  PRIVATE_CASH: 'Private cash',
  EMPLOYEE_TRANSFER: 'Transfer from private account',
  COMPANY_CARD: 'Company card',
  COMPANY_CASH: 'Company cash',
  EMPLOYER_TRANSFER: 'Paid by employer (transfer)',
  ADVANCE: 'From advance',
  OTHER: 'Other',
};

const fuelEn: Record<FuelType, string> = { petrol95: 'Petrol 95', petrol98: 'Petrol 98', diesel: 'Diesel', electricity: 'Electricity' };

const categoryEn: Record<string, string> = {
  Ubytování: 'Accommodation',
  Vlak: 'Train',
  Autobus: 'Bus',
  Letenka: 'Air ticket',
  MHD: 'Public transport',
  Taxi: 'Taxi',
  Parkovné: 'Parking',
  'Dálniční známka': 'Motorway vignette',
  Mýtné: 'Toll',
  Trajekt: 'Ferry',
  'Pohonné hmoty': 'Fuel',
  'Nabíjení elektromobilu': 'EV charging',
  'Pronájem vozidla': 'Vehicle rental',
  Zavazadlo: 'Luggage',
  'Rezervace sedadla': 'Seat reservation',
  'Místní poplatek': 'Local tax',
  'Nutný vedlejší výdaj': 'Necessary incidental expense',
  Ostatní: 'Other',
};

const rateSourceCs: Record<ConversionSource, string> = {
  CNB: 'ČNB',
  BANK_CONFIRMATION: 'potvrzení banky',
  EXCHANGE_RECEIPT: 'doklad o směně',
  ADVANCE_RATE: 'kurz zálohy',
  MANUAL: 'ručně zadaný kurz',
};
const rateSourceEn: Record<ConversionSource, string> = {
  CNB: 'CNB',
  BANK_CONFIRMATION: 'bank statement',
  EXCHANGE_RECEIPT: 'exchange receipt',
  ADVANCE_RATE: 'advance rate',
  MANUAL: 'manually entered rate',
};

const namesEn = new Intl.DisplayNames(['en'], { type: 'region' });
const weekdaysCs = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Poznámky jádra ke dnům (česky) → anglicky. Neznámá poznámka zůstane česky. */
const notePatterns: [RegExp, (...m: string[]) => string][] = [
  [/^Pobyt v zahraničí (.+) je kratší než 1 hodina – započten do tuzemské části\.$/, (t) => `Time abroad ${t} is shorter than 1 hour – counted as time in Czechia.`],
  [/^Doba cesty ve všech dnech sečtena \((.+)\) podle nastavení „sečíst krátké dny“\.$/, (t) => `Trip time of all days added up (${t}) under the "combine short days" setting.`],
  [/^Doba v Česku (.+) je kratší než 5 hodin – tuzemské stravné nenáleží\.$/, (t) => `Time in Czechia ${t} is shorter than 5 hours – no domestic meal allowance.`],
  [/^Pobyt v zahraničí (.+) nezakládá nárok na zahraniční stravné\.$/, (t) => `Time abroad ${t} does not give rise to a foreign meal allowance.`],
];

export interface DocTexts {
  lang: Lang;
  /** Částka s měnou: v angličtině „1 234,56 CZK“ místo „Kč“. */
  currency: (text: string) => string;
  country: (code: string, czechName?: string) => string;
  day: (date: string) => string;
  transport: (k: TransportKind) => string;
  payment: (p: PaymentMethod) => string;
  fuel: (f: FuelType) => string;
  category: (c: string) => string;
  rateSource: (s: ConversionSource) => string;
  note: (text: string) => string;
  fuelPriceRef: (ref: string) => string;
  mealLetters: [string, string, string];
  t: typeof cs;
}

const cs = {
  sectorBusiness: 'Podnikatelská sféra',
  sectorPublic: 'Platová sféra',
  kindForeign: 'Zahraniční',
  kindDomestic: 'Tuzemská',
  privatePart: ' – soukromá část',
  timeMissing: 'čas nezadán',
  domesticPerDiem: 'Tuzemské stravné',
  foreignPerDiemRate: (rate: string) => `Zahraniční stravné × kurz ${rate}`,
  foreignPerDiem: 'Zahraniční stravné',
  foreignPerDiemPocket: 'Zahraniční stravné a kapesné',
  pocketMoney: 'Kapesné',
  fromAdvance: 'Výdaje uhrazené ze zálohy',
  advanceGiven: 'Poskytnutá záloha',
  balance: (plus: boolean, cur: string, rate: string) => `${plus ? 'Doplatek' : 'Přeplatek'} v ${cur}${rate ? ` × kurz zálohy ${rate}` : ''}`,
  employeeExpenses: 'Výdaje uhrazené zaměstnancem',
  vehicleComp: 'Náhrada za soukromé vozidlo',
  advanceCzk: 'Poskytnutá záloha v Kč',
  employerPaid: 'Uhrazeno přímo zaměstnavatelem (jen náklad, nevyplácí se)',
  mealsNote: 'S/O/V = bezplatně poskytnutá snídaně/oběd/večeře.',
  reductionNote: 'Krácení zahraničního stravného z částky pásma.',
  notReimbursed: 'neproplácí se',
  paidByEmployer: 'uhradil zaměstnavatel',
  expensesNote: 'Dokl. = počet účetních dokladů + dokladů o zaplacení. Výdaje uhrazené zaměstnavatelem a neproplácené výdaje nejsou v částce k výplatě.',
  privateVehicle: 'Soukromé vozidlo',
  fuelReceipt: 'cena z dokladu',
  fuelReceipts: (ref: string) => `cena z dokladů o tankování – ${ref}`,
  fuelAverage: (ref: string) => `průměrná cena – ${ref}`,
  fuelManual: (ref: string) => `průměrná cena zadaná ručně – ${ref}`,
  rulesPrice: (price: string) => ` (podle uložené vyhlášky ${price})`,
  yes: 'ano',
  no: 'ne',
  payout: 'K výplatě zaměstnanci',
  refund: 'Vratka zaměstnance',
  claimCzk: 'Nárok v Kč',
  headlineBalance: (plus: boolean, amount: string) => `${plus ? 'Doplatek' : 'Přeplatek'} ${amount} =`,
  totalCost: 'Celkové náklady cesty',
  declaration: 'Prohlašuji, že jsem pracovní cestu vykonal(a) podle uvedených údajů, že všechny údaje jsou pravdivé a úplné a že předložené doklady se vztahují k této pracovní cestě.',
};

const en: typeof cs = {
  sectorBusiness: 'Business sector',
  sectorPublic: 'Public sector',
  kindForeign: 'Foreign',
  kindDomestic: 'Domestic',
  privatePart: ' – private part',
  timeMissing: 'time not entered',
  domesticPerDiem: 'Domestic meal allowance',
  foreignPerDiemRate: (rate: string) => `Foreign meal allowance × rate ${rate}`,
  foreignPerDiem: 'Foreign meal allowance',
  foreignPerDiemPocket: 'Foreign meal allowance and pocket money',
  pocketMoney: 'Pocket money',
  fromAdvance: 'Expenses paid from advance',
  advanceGiven: 'Advance provided',
  balance: (plus: boolean, cur: string, rate: string) => `${plus ? 'Additional payment' : 'Overpayment'} in ${cur}${rate ? ` × advance rate ${rate}` : ''}`,
  employeeExpenses: 'Expenses paid by employee',
  vehicleComp: 'Private vehicle compensation',
  advanceCzk: 'Advance provided in CZK',
  employerPaid: 'Paid directly by employer (cost only, not paid out)',
  mealsNote: 'B/L/D = breakfast/lunch/dinner provided free of charge.',
  reductionNote: 'Foreign meal allowance reduced from the amount for the time band.',
  notReimbursed: 'not reimbursed',
  paidByEmployer: 'paid by employer',
  expensesNote: 'Docs = number of accounting documents + proofs of payment. Expenses paid by the employer and non-reimbursed expenses are not included in the payout.',
  privateVehicle: 'Private vehicle',
  fuelReceipt: 'price from receipt',
  fuelReceipts: (ref: string) => `price from fuel receipts – ${ref}`,
  fuelAverage: (ref: string) => `average price – ${ref}`,
  fuelManual: (ref: string) => `average price entered manually – ${ref}`,
  rulesPrice: (price: string) => ` (stored decree value ${price})`,
  yes: 'yes',
  no: 'no',
  payout: 'Payable to employee',
  refund: 'Refund by employee',
  claimCzk: 'Claim in CZK',
  headlineBalance: (plus: boolean, amount: string) => `${plus ? 'Additional payment' : 'Overpayment'} ${amount} =`,
  totalCost: 'Total trip cost',
  declaration: 'I declare that I made the business trip as stated, that all information is true and complete and that the attached documents relate to this business trip.',
};

export function docTexts(lang: Lang): DocTexts {
  if (lang === 'cs') {
    return {
      lang,
      currency: (x) => x,
      country: (code, czechName) => czechName ?? countryNameCs(code),
      day: (date) => {
        const [y, m, d] = date.split('-').map(Number) as [number, number, number];
        return `${weekdaysCs[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}. ${m}. ${y}`;
      },
      transport: (k) => transportLabels[k],
      payment: (p) => paymentLabels[p],
      fuel: (f) => fuelLabels[f],
      category: (c) => c,
      rateSource: (s) => rateSourceCs[s],
      note: (x) => x,
      fuelPriceRef: (x) => x,
      mealLetters: ['S', 'O', 'V'],
      t: cs,
    };
  }
  return {
    lang,
    currency: (x) => x.replace(/\s?Kč$/, ' CZK'),
    country: (code, czechName) => (/^[A-Z]{2}$/.test(code) ? (namesEn.of(code) ?? czechName ?? code) : (czechName ?? code)),
    day: (date) => {
      const [y, m, d] = date.split('-').map(Number) as [number, number, number];
      return `${weekdaysEn[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}. ${m}. ${y}`;
    },
    transport: (k) => transportEn[k],
    payment: (p) => paymentEn[p],
    fuel: (f) => fuelEn[f],
    category: (c) => categoryEn[c] ?? c,
    rateSource: (s) => rateSourceEn[s],
    note: (x) => {
      for (const [re, fn] of notePatterns) {
        const m = re.exec(x);
        if (m) return fn(...m.slice(1));
      }
      return x;
    },
    fuelPriceRef: (x) =>
      x
        .replace(/^vyhláška (.+)$/, 'Decree No. $1 Coll.')
        .replace(/^doklad ze dne (.+)$/, 'receipt of $1')
        .replace(/^vážený průměr z (\d+) doklad(?:u|ů): (.+)$/, 'weighted average of $1 receipt(s): $2')
        .replace(/ Kč/g, ' CZK'),
    mealLetters: ['B', 'L', 'D'],
    t: en,
  };
}
