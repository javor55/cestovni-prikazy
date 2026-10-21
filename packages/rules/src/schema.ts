import { z } from 'zod';

// Částky jsou v nejmenších jednotkách měny (haléře, centy), data ve formátu YYYY-MM-DD.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const minor = z.number().int().nonnegative();
const pct = z.number().min(0).max(100);
const currency = z.string().regex(/^[A-Z]{3}$/);

const domesticBand = z.object({
  id: z.string(),
  minMinutes: z.number().int().nonnegative(),
  maxMinutes: z.number().int().positive().nullable(),
  business: z.object({ min: minor }),
  public: z.object({ min: minor, max: minor }),
  mealReductionPct: pct,
});

const foreignTier = z.object({
  id: z.string(),
  minMinutes: z.number().int().nonnegative(),
  maxMinutes: z.number().int().positive().nullable(),
  numerator: z.number().int().positive(),
  denominator: z.number().int().positive(),
  mealReductionPct: pct,
});

export const fuelTypes = ['petrol95', 'petrol98', 'diesel', 'electricity'] as const;
export const vehicleTypes = ['car', 'motorcycle'] as const;
export const roundingModes = ['NONE', 'HALF_UP_UNIT', 'CEIL_UNIT'] as const;

export const ruleSetSchema = z.object({
  id: z.string(),
  version: z.string(),
  validFrom: isoDate,
  validTo: isoDate,
  description: z.string(),
  verification: z.string(),
  sources: z.array(z.object({ id: z.string(), title: z.string() })),
  domestic: z.object({ source: z.string(), bands: z.array(domesticBand).min(1) }),
  foreign: z.object({
    source: z.string(),
    minAbroadMinutes: z.number().int().positive(),
    tiers: z.array(foreignTier).min(1),
    mealReductionBase: z.enum(['TIER_AMOUNT', 'BASE_RATE']),
    pocketMoneyMaxPct: pct,
    rates: z.record(
      z.string().regex(/^[A-Z]{2}$/),
      z.object({ name: z.string(), currency, amount: minor.positive(), verified: z.boolean() }),
    ),
  }),
  vehicle: z.object({
    source: z.string(),
    ratesPerKm: z.record(z.enum(vehicleTypes), z.object({ amount: minor })),
    averagePrices: z.array(
      z.object({ fuel: z.enum(fuelTypes), unit: z.enum(['l', 'kWh']), amount: minor, validFrom: isoDate, validTo: isoDate, source: z.string() }),
    ),
  }),
  rounding: z.object({
    domesticPerDay: z.enum(roundingModes),
    foreignPerDay: z.enum(roundingModes),
    payout: z.enum(roundingModes),
  }),
  assumptions: z.array(z.object({ code: z.string(), text: z.string() })),
});

export type RuleSet = z.infer<typeof ruleSetSchema>;
export type FuelType = (typeof fuelTypes)[number];
export type VehicleType = (typeof vehicleTypes)[number];
export type RoundingMode = (typeof roundingModes)[number];
