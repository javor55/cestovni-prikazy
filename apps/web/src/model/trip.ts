// Uložená podoba cesty v prohlížeči. Číselná pole z formulářů zůstávají textem tak, jak je uživatel napsal
// („1 234,50“), a na čísla se převádějí až při výpočtu (toInput.ts). Rozepsaný údaj se tak nikdy neztratí.

import type { EmployerSector, PaymentMethod } from '@cp/core';
import type { FuelType, VehicleType } from '@cp/rules';

export const SCHEMA_VERSION = 7;

export type TransportKind =
  | 'soukrome-auto'
  | 'pujcene-auto'
  | 'pronajate-auto'
  | 'firemni-auto'
  | 'vlak'
  | 'autobus'
  | 'letadlo'
  | 'lod'
  | 'mhd'
  | 'taxi'
  | 'jine';

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
  /**
   * Přechody hranic v pořadí, v jakém proběhly. Každý vede ze státu předchozího přechodu (u prvního ze státu
   * odjezdu) do státu `to`; poslední vede vždy do státu příjezdu (viz route.ts). Čas může chybět – aplikace
   * pak upozorní a dobu odhadne.
   */
  crossings: CrossingDoc[];
  private: boolean;
  note: string;
}

export interface CrossingDoc {
  id: string;
  /** Stát, do kterého se hranicí vjíždí. */
  to: string;
  at: string;
}

export interface RouteStopDoc {
  id: string;
  /** Místo (nepovinné – stačí stát, kterým se projíždí). */
  place: string;
  country: string;
  /** Zastávka (jednání, přespání) – v průběhu cesty se tu cesta rozdělí na dva úseky. */
  stop: boolean;
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
  /** Datum kurzovního lístku ČNB, ze kterého je kurz. */
  rateDate: string;
  /** Stržená částka v Kč podle potvrzení banky. */
  czkAmount: string;
  documentNumber: string;
  /** false = neproplácí se (např. tankování, když se počítá náhrada za vozidlo). */
  reimbursable: boolean;
  /** U tankování a nabíjení množství v l / kWh – z dokladů se počítá cena paliva pro náhradu za vozidlo. */
  fuelQuantity: string;
  /** U ubytování: byla v ceně snídaně? '' = zatím neodpovězeno (aplikace se zeptá). */
  breakfast: '' | 'yes' | 'no';
  note: string;
}

export interface AdvanceDoc {
  id: string;
  amount: string;
  currency: string;
  providedOn: string;
  rate: string;
  rateUnit: string;
  rateDate: string;
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
  /** Cena paliva: z dokladů o tankování mezi výdaji (vážený průměr), z jednoho dokladu, nebo průměrná podle vyhlášky. */
  fuelPriceMode: 'receipts' | 'receipt' | 'average';
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
  /** bankAccount = číslo účtu pro výplatu náhrad (uvede se v PDF). */
  employee: { name: string; personalNumber: string; position: string; department: string; regularWorkplace: string; address: string; bankAccount: string };
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
  /** Plánované dopravní prostředky (může jich být víc, např. taxi a letadlo). */
  plannedTransportKinds: TransportKind[];
  /** Upřesnění dopravního prostředku (např. „Railjet“, „vlastní vůz“). */
  plannedTransport: string;
  /** Stát cíle cesty a státy, kterými se po cestě projíždí – z nich se předvyplní průběh cesty. */
  destinationCountry: string;
  /** Trasa mezi místem nástupu a cílem: místa a státy po cestě v pořadí cesty tam. */
  route: RouteStopDoc[];
  /** Místo a datum vystavení cestovního příkazu. */
  issuedPlace: string;
  issuedOn: string;
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
  /** Kurz pro přepočet zahraničního stravného v měně, ve které nebyla záloha. */
  perDiemRates: Record<string, RateDoc>;
  combineShortDomesticDays: boolean;
  /** Způsob podpisu: nahraný sken, nebo vložený obrázek podpisu (velikost v % podpisového pole, razítko). */
  signature: { mode: 'scan' | 'image'; widthPct: number; stamp: boolean };
}

export interface RateDoc {
  rate: string;
  unit: string;
  rateDate: string;
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
    crossings: [],
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
    rateDate: '',
    czkAmount: '',
    documentNumber: '',
    reimbursable: true,
    fuelQuantity: '',
    breakfast: '',
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
    employee: { name: '', personalNumber: '', position: '', department: '', regularWorkplace: '', address: '', bankAccount: '', ...remembered?.employee },
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
    plannedTransportKinds: [],
    plannedTransport: '',
    destinationCountry: '',
    route: [],
    issuedPlace: '',
    issuedOn: '',
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
      fuelPriceMode: 'average',
      requestedByEmployer: true,
      note: '',
    },
    employerRates: { domestic: {}, pocketMoneyPct: '', foreignBase: {} },
    perDiemRates: {},
    combineShortDomesticDays: false,
    signature: { mode: 'scan', widthPct: 70, stamp: false },
  };
}

/** Návrh čísla cestovního příkazu CP-RRRR-NNNN. V anonymním režimu nejde o souvislou číselnou řadu. */
export function suggestNumber(now: Date): string {
  const rnd = crypto.getRandomValues(new Uint16Array(1))[0]! % 10000;
  return `CP-${now.getFullYear()}-${String(rnd).padStart(4, '0')}`;
}

export const transportLabels: Record<TransportKind, string> = {
  'soukrome-auto': 'Soukromé auto',
  'pujcene-auto': 'Půjčené auto (od rodiny, známého)',
  'pronajate-auto': 'Auto z autopůjčovny',
  'firemni-auto': 'Firemní auto',
  vlak: 'Vlak',
  autobus: 'Autobus',
  letadlo: 'Letadlo',
  lod: 'Loď, trajekt',
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

/** Plánovaný dopravní prostředek jako text pro dokumenty: druh a upřesnění. */
export function plannedTransportText(t: Pick<TripDoc, 'plannedTransportKinds' | 'plannedTransport'>): string {
  return [...t.plannedTransportKinds.map((k) => transportLabels[k]), t.plannedTransport].filter(Boolean).join(', ');
}

/**
 * Přechody hranic úseku jako text, např. „CZ–AT 14. 10. 2026 9:45, AT–SI čas nezadán“.
 * PDF je má pod sebou (`separator` = '\n') ve tvaru „CZ – AT“ (písmo PDF nemá šipku →).
 */
export function crossingsText(s: Pick<SegmentDoc, 'fromCountry' | 'crossings'>, time: (local: string) => string, separator = ', ', arrow = '–'): string {
  let from = s.fromCountry;
  return s.crossings
    .map((c) => {
      const t = `${from}${arrow}${c.to} ${c.at ? time(c.at) : 'čas nezadán'}`;
      from = c.to;
      return t;
    })
    .join(separator);
}
