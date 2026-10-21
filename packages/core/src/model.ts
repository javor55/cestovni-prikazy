import type { FuelType, VehicleType } from '@cp/rules';
import type { Money } from './money.js';

/** Místní čas v Česku, „YYYY-MM-DDTHH:mm“. */
export type LocalDateTime = string;
/** Datum, „YYYY-MM-DD“. */
export type IsoDate = string;
/** Kód státu ISO 3166-1 alpha-2, Česko = „CZ“. */
export type CountryCode = string;

export type EmployerSector = 'business' | 'public';

export interface BorderCrossing {
  at: LocalDateTime;
  from: CountryCode;
  to: CountryCode;
}

export interface Segment {
  id: string;
  from: { place: string; country: CountryCode };
  to: { place: string; country: CountryCode };
  departure: LocalDateTime;
  arrival: LocalDateTime;
  transport: string;
  km?: number;
  /** Přechody hranic během úseku. U letu odlet z / přílet na letiště v ČR (předpoklad Ú-7). */
  borderCrossings?: BorderCrossing[];
  /** Soukromá část cesty – nezapočítává se do doby pro stravné (Ú-14). */
  private?: boolean;
}

export interface MealEntry {
  free: boolean;
  /** Ke které části stravného jídlo patří. Bez určení: zahraniční, pokud v daném dni náleží, jinak tuzemské. */
  part?: 'domestic' | 'foreign';
}

export interface MealDay {
  date: IsoDate;
  breakfast?: MealEntry;
  lunch?: MealEntry;
  dinner?: MealEntry;
}

export type ConversionSource =
  /** Denní kurz ČNB – kurz dodá aplikace. */
  | 'CNB'
  /** Skutečně stržená částka v Kč podle potvrzení banky (R4). */
  | 'BANK_CONFIRMATION'
  /** Kurz z dokladu o směně nebo výběru z bankomatu. */
  | 'EXCHANGE_RECEIPT'
  /** Kurz, kterým byla přepočtena záloha v téže měně. */
  | 'ADVANCE_RATE'
  /** Ručně zadaný kurz – v souhrnu vždy viditelný. */
  | 'MANUAL';

export interface Conversion {
  source: ConversionSource;
  /** Kurz jako text kvůli přesnosti, např. „24.350“. Kč za `unit` jednotek cizí měny. */
  rate?: string;
  unit?: number;
  rateDate?: IsoDate;
  /** Jen u BANK_CONFIRMATION: stržená částka v haléřích. */
  czkAmount?: number;
  manualReason?: string;
}

export type ExpensePayer = 'EMPLOYEE' | 'ADVANCE' | 'EMPLOYER';

export type PaymentMethod =
  | 'PRIVATE_CARD'
  | 'COMPANY_CARD'
  | 'PRIVATE_CASH'
  | 'COMPANY_CASH'
  | 'EMPLOYEE_TRANSFER'
  | 'EMPLOYER_TRANSFER'
  | 'ADVANCE'
  | 'OTHER';

export interface Expense {
  id: string;
  order: number;
  category: string;
  description: string;
  supplier?: string;
  date: IsoDate;
  amount: Money;
  conversion?: Conversion;
  paymentMethod: PaymentMethod;
  payer: ExpensePayer;
  /** false = výdaj se neproplácí (např. doklad o tankování sloužící jen k ceně PHM). Výchozí true. */
  reimbursable?: boolean;
  documentNumber?: string;
  attachments?: { accounting: number; payment: number };
}

export interface Advance {
  id: string;
  amount: Money;
  providedOn: IsoDate;
  /** U zálohy v cizí měně kurz, kterým se přepočítává vyrovnání (Ú-10). */
  conversion?: Conversion;
}

export interface Vehicle {
  type: VehicleType;
  ownership: 'private' | 'company';
  fuel: FuelType;
  /** Spotřeba z technického průkazu na 100 km (l nebo kWh). Jedna hodnota, nebo tři pro různé režimy. */
  consumption: string[];
  /** Ujeté kilometry pracovní cesty, desetinné číslo jako text. */
  km: string;
  /** Cena PHM z dokladu za 1 l / 1 kWh v haléřích. Bez ní se použije průměrná cena z vyhlášky. */
  receiptPrice?: { amount: number; date: IsoDate };
  /** Datum pro výběr průměrné ceny; výchozí je den začátku cesty. */
  date?: IsoDate;
  requestedByEmployer: boolean;
}

export interface EmployerRates {
  /** Vlastní sazby tuzemského stravného v haléřích podle id pásma („5-12“, „12-18“, „18+“). */
  domestic?: Record<string, number>;
  /** Vlastní základní sazba zahraničního stravného podle státu, v nejmenších jednotkách měny ze sady pravidel. */
  foreignBase?: Record<CountryCode, Money>;
  /** Kapesné v procentech zahraničního stravného (0–40). */
  pocketMoneyPct?: number;
}

export interface CalculationOptions {
  /**
   * Tuzemská cesta přes půlnoc, kdy ani jeden den nedosáhne 5 hodin: sečíst dobu do jednoho dne.
   * Výchozí false (Ú-5).
   */
  combineShortDomesticDays?: boolean;
}

export interface TripInput {
  sector: EmployerSector;
  kind: 'domestic' | 'foreign';
  /** Skutečný začátek a konec cesty. */
  start: LocalDateTime;
  end: LocalDateTime;
  segments: Segment[];
  meals: MealDay[];
  expenses: Expense[];
  advances: Advance[];
  vehicle?: Vehicle;
  employerRates?: EmployerRates;
  /** Kurzy pro přepočet zahraničního stravného v měnách, ve kterých nebyla záloha (Ú-10). */
  perDiemRates?: Record<string, Conversion>;
  options?: CalculationOptions;
}
