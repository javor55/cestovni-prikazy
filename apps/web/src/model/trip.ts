// Uložená podoba cesty v prohlížeči. Číselná pole z formulářů zůstávají textem tak, jak je uživatel napsal
// („1 234,50“), a na čísla se převádějí až při výpočtu (toInput.ts). Rozepsaný údaj se tak nikdy neztratí.

import type { EmployerSector, PaymentMethod } from '@cp/core';
import type { FuelType, VehicleType } from '@cp/rules';

export const SCHEMA_VERSION = 1;

export type TransportKind = 'soukrome-auto' | 'firemni-auto' | 'vlak' | 'autobus' | 'letadlo' | 'mhd' | 'taxi' | 'jine';

export interface SegmentDoc {
  id: string;
  fromPlace: string;
  fromCountry: string;
  toPlace: string;
  toCountry: string;
  departure: string;
  arrival: string;
  transport: TransportKind;
  carrier: string;
  km: string;
  /** Čas přechodu hranice, pokud úsek vede do jiného státu. */
  crossingAt: string;
  private: boolean;
  note: string;
}

export interface MealsDoc {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export type RateSource = 'CNB' | 'BANK_CONFIRMATION' | 'EXCHANGE_RECEIPT' | 'MANUAL';

export interface ExpenseDoc {
  id: string;
  category: string;
  description: string;
  supplier: string;
  date: string;
  amount: string;
  currency: string;
  paymentMethod: PaymentMethod;
  rateSource: RateSource;
  rate: string;
  rateUnit: string;
  /** Stržená částka v Kč podle potvrzení banky. */
  czkAmount: string;
  documentNumber: string;
  /** false = neproplácí se (např. tankování, když se počítá náhrada za vozidlo). */
  reimbursable: boolean;
  note: string;
}

export interface AdvanceDoc {
  id: string;
  amount: string;
  currency: string;
  providedOn: string;
  rate: string;
}

export interface VehicleDoc {
  used: boolean;
  type: VehicleType;
  ownership: 'private' | 'company';
  model: string;
  plate: string;
  owner: string;
  fuel: FuelType;
  /** Spotřeba z TP: jedna hodnota, nebo tři (město, mimo město, kombinovaná). */
  consumption: string[];
  km: string;
  receiptPrice: string;
  receiptDate: string;
  requestedByEmployer: boolean;
  note: string;
}

export interface TripDoc {
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;

  number: string;
  employee: { name: string; personalNumber: string; position: string; department: string; regularWorkplace: string; address: string };
  employer: { name: string; ico: string; seat: string; unit: string; costCenter: string; project: string };
  sector: EmployerSector;

  kind: 'domestic' | 'foreign';
  purpose: string;
  startPlace: string;
  endPlace: string;
  destinations: string;
  via: string;
  plannedStart: string;
  plannedEnd: string;
  plannedTransport: string;
  /** Skutečný začátek a konec, pokud se liší od prvního odjezdu a posledního příjezdu. */
  actualStart: string;
  actualEnd: string;
  note: string;

  segments: SegmentDoc[];
  meals: Record<string, MealsDoc>;
  expenses: ExpenseDoc[];
  advances: AdvanceDoc[];
  vehicle: VehicleDoc;
  employerRates: { domestic: Record<string, string>; pocketMoneyPct: string; foreignBase: Record<string, { amount: string; currency: string }> };
  /** Kurz pro přepočet zahraničního stravného v měně bez zálohy (kurz ČNB, zatím zadaný ručně). */
  perDiemRates: Record<string, string>;
  combineShortDomesticDays: boolean;
}

export const newId = () => crypto.randomUUID();

export function emptySegment(prev?: SegmentDoc): SegmentDoc {
  return {
    id: newId(),
    fromPlace: prev?.toPlace ?? '',
    fromCountry: prev?.toCountry ?? 'CZ',
    toPlace: '',
    toCountry: prev?.toCountry ?? 'CZ',
    departure: '',
    arrival: '',
    transport: prev?.transport ?? 'vlak',
    carrier: '',
    km: '',
    crossingAt: '',
    private: false,
    note: '',
  };
}

export function emptyExpense(date = ''): ExpenseDoc {
  return {
    id: newId(),
    category: 'Ostatní',
    description: '',
    supplier: '',
    date,
    amount: '',
    currency: 'CZK',
    paymentMethod: 'PRIVATE_CARD',
    rateSource: 'CNB',
    rate: '',
    rateUnit: '1',
    czkAmount: '',
    documentNumber: '',
    reimbursable: true,
    note: '',
  };
}

export function newTrip(now: Date, remembered?: Pick<TripDoc, 'employee' | 'employer' | 'sector'>): TripDoc {
  const iso = now.toISOString();
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: iso,
    updatedAt: iso,
    lastOpenedAt: iso,
    number: '',
    employee: remembered?.employee ?? { name: '', personalNumber: '', position: '', department: '', regularWorkplace: '', address: '' },
    employer: remembered?.employer ?? { name: '', ico: '', seat: '', unit: '', costCenter: '', project: '' },
    sector: remembered?.sector ?? 'business',
    kind: 'domestic',
    purpose: '',
    startPlace: '',
    endPlace: '',
    destinations: '',
    via: '',
    plannedStart: '',
    plannedEnd: '',
    plannedTransport: '',
    actualStart: '',
    actualEnd: '',
    note: '',
    segments: [],
    meals: {},
    expenses: [],
    advances: [],
    vehicle: {
      used: false,
      type: 'car',
      ownership: 'private',
      model: '',
      plate: '',
      owner: '',
      fuel: 'petrol95',
      consumption: [''],
      km: '',
      receiptPrice: '',
      receiptDate: '',
      requestedByEmployer: true,
      note: '',
    },
    employerRates: { domestic: {}, pocketMoneyPct: '', foreignBase: {} },
    perDiemRates: {},
    combineShortDomesticDays: false,
  };
}

/** Návrh čísla cestovního příkazu CP-RRRR-NNNN. V anonymním režimu nejde o souvislou číselnou řadu. */
export function suggestNumber(now: Date): string {
  const rnd = crypto.getRandomValues(new Uint16Array(1))[0]! % 10000;
  return `CP-${now.getFullYear()}-${String(rnd).padStart(4, '0')}`;
}

export const transportLabels: Record<TransportKind, string> = {
  'soukrome-auto': 'Soukromé auto',
  'firemni-auto': 'Firemní auto',
  vlak: 'Vlak',
  autobus: 'Autobus',
  letadlo: 'Letadlo',
  mhd: 'MHD',
  taxi: 'Taxi',
  jine: 'Jiné',
};

export const expenseCategories = [
  'Ubytování',
  'Vlak',
  'Autobus',
  'Letenka',
  'MHD',
  'Taxi',
  'Parkovné',
  'Dálniční známka',
  'Mýtné',
  'Trajekt',
  'Pohonné hmoty',
  'Nabíjení elektromobilu',
  'Pronájem vozidla',
  'Zavazadlo',
  'Rezervace sedadla',
  'Místní poplatek',
  'Nutný vedlejší výdaj',
  'Ostatní',
] as const;

export const paymentLabels: Record<PaymentMethod, string> = {
  PRIVATE_CARD: 'Soukromá karta',
  PRIVATE_CASH: 'Soukromá hotovost',
  EMPLOYEE_TRANSFER: 'Převod ze soukromého účtu',
  COMPANY_CARD: 'Firemní karta',
  COMPANY_CASH: 'Firemní hotovost',
  EMPLOYER_TRANSFER: 'Uhradil zaměstnavatel převodem',
  ADVANCE: 'Ze zálohy',
  OTHER: 'Jiný způsob',
};

export const rateSourceLabels: Record<RateSource, string> = {
  CNB: 'Kurz ČNB',
  BANK_CONFIRMATION: 'Podle potvrzení banky',
  EXCHANGE_RECEIPT: 'Kurz z dokladu o směně',
  MANUAL: 'Ručně zadaný kurz',
};

export const fuelLabels: Record<FuelType, string> = {
  petrol95: 'Benzin 95',
  petrol98: 'Benzin 98',
  diesel: 'Nafta',
  electricity: 'Elektřina',
};
