// Schémata pro kontrolu importovaného pracovního projektu. Importovaná data se nikdy nepoužijí,
// dokud neprojdou těmito schématy; neznámé vlastnosti se zahodí.

import type { DocModel } from '@cp/documents/model';
import { fuelTypes, vehicleTypes } from '@cp/rules';
import { z } from 'zod';
import type { Attachment } from '../attachments/model.js';
import type { Snapshot } from '../documents/snapshot.js';
import type { TripDoc } from '../model/trip.js';

const text = z.string().max(5000);
const short = z.string().max(500);
const id = z.string().regex(/^[\w-]{1,64}$/);
const isoTime = z.string().max(40);
const strMap = <T extends z.ZodTypeAny>(v: T) => z.record(z.string().max(64), v).refine((r) => Object.keys(r).length <= 1000, 'Příliš mnoho položek.');

const paymentMethods = ['PRIVATE_CARD', 'COMPANY_CARD', 'PRIVATE_CASH', 'COMPANY_CASH', 'EMPLOYEE_TRANSFER', 'EMPLOYER_TRANSFER', 'ADVANCE', 'OTHER'] as const;
const transports = ['soukrome-auto', 'firemni-auto', 'vlak', 'autobus', 'letadlo', 'mhd', 'taxi', 'jine'] as const;

const segment = z.object({
  id,
  fromPlace: short,
  fromCountry: short,
  toPlace: short,
  toCountry: short,
  departure: short,
  arrival: short,
  transport: z.enum(transports),
  carrier: short,
  km: short,
  crossings: z.array(z.object({ id, to: short, at: short })).max(50),
  private: z.boolean(),
  note: text,
});

const expense = z.object({
  id,
  category: short,
  description: text,
  supplier: short,
  date: short,
  amount: short,
  currency: short,
  paymentMethod: z.enum(paymentMethods),
  rateSource: z.enum(['CNB', 'BANK_CONFIRMATION', 'EXCHANGE_RECEIPT', 'MANUAL']),
  rate: short,
  rateUnit: short,
  rateDate: short,
  czkAmount: short,
  documentNumber: short,
  reimbursable: z.boolean(),
  note: text,
});

const rate = z.object({ rate: short, unit: short, rateDate: short });

export const tripSchema = z.object({
  id,
  schemaVersion: z.number().int(),
  createdAt: isoTime,
  updatedAt: isoTime,
  lastOpenedAt: isoTime,
  number: short,
  employee: z.object({ name: short, personalNumber: short, position: short, department: short, regularWorkplace: short, address: short }),
  employer: z.object({ name: short, ico: short, seat: short, unit: short, costCenter: short, project: short }),
  sector: z.enum(['business', 'public']),
  kind: z.enum(['domestic', 'foreign']),
  purpose: text,
  startPlace: short,
  endPlace: short,
  destinations: text,
  via: text,
  plannedStart: short,
  plannedEnd: short,
  plannedTransportKind: z.union([z.enum(transports), z.literal('')]),
  plannedTransport: short,
  destinationCountry: short,
  transitCountries: z.array(short).max(50),
  issuedPlace: short,
  issuedOn: short,
  actualStart: short,
  actualEnd: short,
  note: text,
  segments: z.array(segment).max(500),
  meals: strMap(z.object({ breakfast: z.boolean(), lunch: z.boolean(), dinner: z.boolean() })),
  expenses: z.array(expense).max(1000),
  advances: z.array(z.object({ id, amount: short, currency: short, providedOn: short, rate: short, rateUnit: short, rateDate: short })).max(100),
  vehicle: z.object({
    used: z.boolean(),
    type: z.enum(vehicleTypes),
    ownership: z.enum(['private', 'company']),
    model: short,
    plate: short,
    owner: short,
    fuel: z.enum(fuelTypes),
    consumption: z.array(short).max(3),
    km: short,
    receiptPrice: short,
    receiptDate: short,
    requestedByEmployer: z.boolean(),
    note: text,
  }),
  employerRates: z.object({ domestic: strMap(short), pocketMoneyPct: short, foreignBase: strMap(z.object({ amount: short, currency: short })) }),
  perDiemRates: strMap(rate),
  combineShortDomesticDays: z.boolean(),
  signature: z.object({ mode: z.enum(['scan', 'image']), widthPct: z.number().min(30).max(100), stamp: z.boolean() }),
});

/** Metadata přílohy v projektu (bez vazby na cestu – ta se při importu nastaví nově). */
export const attachmentSchema = z.object({
  id,
  expenseId: id.nullable(),
  kind: z.enum(['accounting', 'payment', 'supporting', 'signed', 'signature']),
  subtype: short,
  originalName: short,
  mime: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/heic']),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  order: z.number().int(),
  createdAt: isoTime,
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) }).nullable(),
  /** Cesta k souboru v ZIP. */
  file: z.string().regex(/^attachments\/[\w-]{1,64}\.(pdf|jpg|png|heic)$/),
});

const row = z.object({ label: short, value: text });
const s = text;

/** Model dokumentu ze snímku. Vizuální podpis se do snímku neukládá, proto ho schéma nepřijme. */
const docModelSchema = z.object({
  version: z.number().int(),
  number: s,
  createdAt: s,
  ruleSet: s,
  issued: z.object({ place: s, date: s }),
  employer: z.object({ name: s, ico: s, seat: s, unit: s, costCenter: s, project: s, sector: s }),
  employee: z.object({ name: s, personalNumber: s, position: s, department: s, regularWorkplace: s, address: s }),
  trip: z.object({ kind: s, purpose: s, startPlace: s, endPlace: s, plannedStart: s, plannedEnd: s, destinations: s, via: s, transport: s, advances: z.array(s).max(100), note: s }),
  actual: z.object({ start: s, end: s, km: s }),
  segments: z.array(z.object({ n: s, from: s, to: s, departure: s, arrival: s, transport: s, km: s, border: s })).max(500),
  perDiem: z.object({
    days: z
      .array(z.object({ date: s, domesticTime: s, foreignTime: s, domestic: s, domesticAmount: s, country: s, tier: s, base: s, tierAmount: s, meals: s, reduction: s, amount: s, pocketMoney: s }))
      .max(1000),
    domesticTotal: s,
    foreignTotal: s,
    reductionTotal: s,
    note: s,
    hasForeign: z.boolean(),
  }),
  expenses: z.array(z.object({ id: id.optional(), n: s, date: s, category: s, description: s, supplier: s, amount: s, rate: s, czk: s, payment: s, docs: s, note: s })).max(1000),
  expensesNote: s,
  vehicle: z
    .object({ vehicle: s, owner: s, fuel: s, consumption: s, km: s, basic: s, basicCalc: s, fuelComp: s, fuelCalc: s, fuelPriceSource: s, total: s, requested: s })
    .optional(),
  settlement: z.object({ rows: z.array(z.object({ label: s, foreign: s, czk: s })).max(200), payoutLabel: s, payout: s, headline: z.array(row).max(50) }),
  documentCount: s,
  declaration: s,
});

export const snapshotSchema = z.object({
  id,
  createdAt: isoTime,
  layout: z.enum(['modern', 'conservative']),
  part: z.enum(['full', 'A']),
  inputHash: z.string().regex(/^[0-9a-f]{64}$/),
  model: docModelSchema,
});

export const PROJECT_FORMAT = 'cestovni-prikazy-projekt';
/** Verze obálky projektu (project.json + manifest.json). Verze dat cesty je schemaVersion. */
export const PROJECT_VERSION = 1;

export const envelopeSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  projectVersion: z.number().int(),
  schemaVersion: z.number().int().min(1),
  applicationVersion: short,
  exportedAt: isoTime,
  trip: z.record(z.unknown()),
  attachments: z.array(z.unknown()).max(500),
  snapshots: z.array(z.unknown()).max(100),
});

export const manifestSchema = z.object({
  files: z.array(z.object({ path: z.string().max(200), sha256: z.string().regex(/^[0-9a-f]{64}$/), size: z.number().int().nonnegative() })).max(501),
});

export type AttachmentMeta = z.infer<typeof attachmentSchema>;

// Kontrola při překladu: schémata odpovídají typům aplikace (při změně modelu je nutné upravit i schéma).
export const parseTrip = (raw: unknown): TripDoc => tripSchema.parse(raw);
export const parseSnapshot = (raw: unknown): Omit<Snapshot, 'tripId'> => snapshotSchema.parse(raw) satisfies Omit<Snapshot, 'tripId' | 'model'> & { model: DocModel };
export const toAttachment = (m: AttachmentMeta, tripId: string): Omit<Attachment, 'conversion' | 'pages'> => {
  const { file: _f, ...rest } = m;
  return { ...rest, tripId };
};
