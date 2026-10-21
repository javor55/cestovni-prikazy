import type { FuelType, RuleSet } from '@cp/rules';
import { Fraction } from './fraction.js';
import type { IssueList } from './issues.js';
import type { TripInput } from './model.js';
import { datePart } from './time.js';

export interface VehicleResult {
  km: string;
  ratePerKm: number;
  /** Základní náhrada v haléřích. */
  basic: number;
  /** Spotřeba použitá ve výpočtu (průměr, pokud byly zadány tři hodnoty). */
  consumption: string;
  /** Spotřebované množství PHM / elektřiny, zaokrouhlené na setiny (jen pro zobrazení). */
  quantity: string;
  unit: 'l' | 'kWh';
  fuelPrice: number;
  fuelPriceSource: 'RECEIPT' | 'AVERAGE';
  fuelPriceRef: string;
  fuelCompensation: number;
  total: number;
}

const fuelUnit = (fuel: FuelType) => (fuel === 'electricity' ? 'kWh' : 'l');

export function computeVehicle(trip: TripInput, rules: RuleSet, issues: IssueList): VehicleResult | undefined {
  const v = trip.vehicle;
  if (!v) return undefined;
  if (v.ownership === 'company') {
    issues.info('COMPANY_VEHICLE', 'Firemní vozidlo: náhrada za použití vozidla se neposkytuje. Tankování firemní kartou se jen eviduje ve výdajích.');
    return undefined;
  }
  if (!v.requestedByEmployer) {
    issues.warning(
      'VEHICLE_NOT_REQUESTED',
      trip.sector === 'public'
        ? 'Soukromé vozidlo použité na žádost zaměstnance: zaměstnavatel v platové sféře může náhradu omezit (např. na cenu hromadné dopravy). Ověřte u účetní.'
        : 'Náhrada za soukromé vozidlo náleží, pokud bylo použito na žádost nebo se souhlasem zaměstnavatele. Ověřte, že souhlas máte.',
    );
  }

  let km: Fraction;
  let consumption: Fraction;
  try {
    km = Fraction.parse(v.km);
    if (v.consumption.length === 0) throw new Error('chybí spotřeba');
    consumption = v.consumption.map((c) => Fraction.parse(c)).reduce((a, b) => a.add(b)).div(v.consumption.length);
  } catch (e) {
    issues.error('VEHICLE_INVALID', `Údaje o vozidle nejsou úplné nebo platné (${(e as Error).message}). Doplňte kilometry a spotřebu z technického průkazu.`);
    return undefined;
  }
  if (km.cmp(Fraction.of(0)) <= 0) {
    issues.error('VEHICLE_INVALID', 'Počet ujetých kilometrů musí být větší než nula.');
    return undefined;
  }

  const rate = rules.vehicle.ratesPerKm[v.type];
  if (!rate) {
    issues.error('VEHICLE_RATE_MISSING', `Sada pravidel ${rules.id} neobsahuje sazbu základní náhrady pro tento typ vozidla.`);
    return undefined;
  }

  const date = v.date ?? datePart(trip.start);
  let price: number;
  let source: VehicleResult['fuelPriceSource'];
  let ref: string;
  if (v.receiptPrice) {
    price = v.receiptPrice.amount;
    source = 'RECEIPT';
    ref = `doklad ze dne ${v.receiptPrice.date}`;
  } else {
    const avg = rules.vehicle.averagePrices.find((p) => p.fuel === v.fuel && p.validFrom <= date && date <= p.validTo);
    if (!avg) {
      issues.error('FUEL_PRICE_MISSING', `Pro datum ${date} není v sadě pravidel průměrná cena pro zvolený druh paliva. Přiložte doklad o tankování s cenou.`);
      return undefined;
    }
    price = avg.amount;
    source = 'AVERAGE';
    ref = `vyhláška ${avg.source}`;
    const end = datePart(trip.end);
    const changes = rules.vehicle.averagePrices.some((p) => p.fuel === v.fuel && p.validFrom > date && p.validFrom <= end);
    if (changes) {
      issues.warning('FUEL_PRICE_CHANGES_DURING_TRIP', `Během cesty se změnila průměrná cena paliva podle vyhlášky. Použita cena platná k ${date}. Ověřte postup u účetní.`);
    }
  }

  // Částky v haléřích: km × sazba; km × spotřeba / 100 × cena.
  const basic = km.mul(rate.amount).toInt();
  const quantity = km.mul(consumption).div(100);
  const fuelCompensation = quantity.mul(price).toInt();
  return {
    km: v.km,
    ratePerKm: rate.amount,
    basic,
    consumption: (consumption.mul(100).toInt() / 100).toFixed(2),
    quantity: (quantity.mul(100).toInt() / 100).toFixed(2),
    unit: fuelUnit(v.fuel),
    fuelPrice: price,
    fuelPriceSource: source,
    fuelPriceRef: ref,
    fuelCompensation,
    total: basic + fuelCompensation,
  };
}
