// Protokol výpočtu v Souhrnu: u každé částky postup s konkrétními čísly, aby šlo výpočet zkontrolovat
// a přepočítat bez aplikace. Zobrazuje výsledek výpočetního jádra; nic nepočítá jinak, jen rozepisuje.

import { formatMinutes, minorPerUnit, type CalculationResult, type DayResult, type ExpenseResult } from '@cp/core';
import { ruleSets } from '@cp/rules';
import type { ReactNode } from 'react';
import { bandLabel } from '../model/bands.js';
import { countryName } from '../model/countries.js';
import { formatDay, formatMinor as formatMinorRaw, formatRate, normalizeDecimal, perDiemRoundingNote } from '../model/format.js';
import { FUEL_CATEGORIES } from '../model/toInput.js';
import type { TripDoc } from '../model/trip.js';
import { Card, H2 } from '../ui/controls.js';

const nf = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
/** Číslo na 2–4 desetinná místa, např. „33,3333“ nebo „25,00“. */
const n4 = (x: number) => nf.format(x).replace(/^-/, '−');
const cur = (code: string) => (code === 'CZK' ? 'Kč' : code);
const units = (minor: number, currency = 'CZK') => minor / minorPerUnit(currency);
const formatMinor = (minor: number, currency?: string) => formatMinorRaw(minor, currency).replace(/^-/, '−');

/** Barvy států v pruhu dne – Česko vždy stejně, ostatní podle pořadí. */
const PALETTE = ['#f3e3d6', '#dcefe4', '#f6ecc4', '#e6dcf3', '#d6ecf3', '#f3d6e2'];
const HOME_COLOR = '#dfe6f3';

function Calc({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-0.5 rounded-lg bg-ground px-3 py-2 font-mono text-[13px] leading-relaxed break-words text-ink">{children}</div>;
}
const Line = ({ children, strong }: { children: ReactNode; strong?: boolean }) => <span className={strong ? 'font-semibold' : ''}>{children}</span>;
const Why = ({ children }: { children: ReactNode }) => <span className="font-sans text-[13px] text-muted">{children}</span>;

function DayBar({ day, colors }: { day: DayResult; colors: Map<string, string> }) {
  const label = day.intervals.map((i) => `${i.from}–${i.to} ${countryName(i.country)}${i.private ? ' (soukromě)' : ''}`).join(', ');
  return (
    <div className="flex h-6 overflow-hidden rounded border border-line text-[11px]" role="img" aria-label={label}>
      {day.intervals.map((i, k) => (
        <span
          key={k}
          className="flex items-center justify-center overflow-hidden border-r border-white whitespace-nowrap"
          style={{
            flex: i.minutes,
            background: i.private ? 'repeating-linear-gradient(45deg,#eceef1 0 4px,#fff 4px 8px)' : (colors.get(i.country) ?? '#eee'),
          }}
          aria-hidden="true"
        >
          {i.minutes >= 90 ? i.country : ''}
        </span>
      ))}
    </div>
  );
}

function PerDiemDay({ day, trip, colors }: { day: DayResult; trip: TripDoc; colors: Map<string, string> }) {
  const rules = ruleSets[0]!;
  const d = day.domestic;
  const f = day.foreign;
  const band = d && rules.domestic.bands.find((b) => b.id === d.bandId);
  const tier = f && rules.foreign.tiers.find((t) => t.id === f.tierId);
  const foreignTotal = day.countries.reduce((a, c) => a + c.minutes, 0);
  // Přesné mezivýsledky zahraničního stravného (jádro je drží jako zlomky, tady stačí 4 desetinná místa).
  const base = f ? units(f.baseRate, f.currency) : 0;
  const tierExact = tier ? (base * tier.numerator) / tier.denominator : 0;
  const reductionBase = rules.foreign.mealReductionBase === 'TIER_AMOUNT' ? tierExact : base;
  const reductionExact = f ? (reductionBase * f.reductionPct * f.freeMeals) / 100 : 0;
  const resultExact = Math.max(0, tierExact - reductionExact);
  const meals = trip.meals[day.date];
  const mealNames = meals ? [meals.breakfast && 'snídaně', meals.lunch && 'oběd', meals.dinner && 'večeře'].filter(Boolean).join(', ') : '';

  return (
    <li className="flex flex-col gap-2 py-3" aria-label={`Den ${day.label}`}>
      <div className="flex flex-wrap justify-between gap-x-3 text-sm">
        <strong>{day.label}</strong>
        <span className="text-muted">
          ČR {formatMinutes(day.domesticMinutes)} · zahraničí {formatMinutes(day.foreignMinutes)}
        </span>
      </div>
      {day.intervals.length > 0 && <DayBar day={day} colors={colors} />}
      <Calc>
        <Line>
          {day.intervals.map((i, k) => (
            <span key={k}>
              {k > 0 && ' · '}
              {i.from}–{i.to} {countryName(i.country)} {formatMinutes(i.minutes)}
              {i.private && ' (soukromá část, nepočítá se)'}
            </span>
          ))}
        </Line>
        {day.countries.length > 1 && (
          <Line>
            Zahraničí celkem: {day.countries.map((c) => formatMinutes(c.minutes)).join(' + ')} = {formatMinutes(foreignTotal)}
          </Line>
        )}
        {f && (
          <Line strong>
            Rozhodující stát: {countryName(f.country)} ({formatMinutes(day.countries.find((c) => c.country === f.country)?.minutes ?? 0)}
            {day.countries.length > 1 ? ' – nejvíc času v tento den' : ''})
          </Line>
        )}
        {day.notes.map((n) => (
          <Why key={n}>{n}</Why>
        ))}
      </Calc>

      {d && band && (
        <Calc>
          <Why>Tuzemské stravné</Why>
          <Line>
            ČR {formatMinutes(day.domesticMinutes)} → pásmo {bandLabel(band.minMinutes, band.maxMinutes)} → sazba {formatMinor(d.rate)} (
            {d.rateSource === 'EMPLOYER' ? 'podle vnitřního předpisu' : trip.sector === 'business' ? 'zákonné minimum' : 'dolní hranice rozpětí'})
          </Line>
          {d.freeMeals > 0 && (
            <Line>
              krácení: {d.freeMeals} {d.freeMeals === 1 ? 'jídlo' : 'jídla'} × {d.reductionPct} % × {n4(units(d.rate))} = {n4(units(d.reduction))} Kč
            </Line>
          )}
          <Line strong>
            {n4(units(d.rate))}
            {d.freeMeals > 0 && ` − ${n4(units(d.reduction))} = ${n4(units(d.beforeRounding))}`} → {formatMinor(d.amount)}
            {d.amount !== d.beforeRounding && ' (zaokrouhleno nahoru na celé Kč)'}
          </Line>
        </Calc>
      )}

      {f && tier && (
        <Calc>
          <Why>
            Zahraniční stravné{mealNames && ` · bezplatně: ${mealNames}`}
          </Why>
          <Line>
            zahraničí {formatMinutes(day.foreignMinutes)} → pásmo {bandLabel(tier.minMinutes, tier.maxMinutes)} → {tier.id === '1/1' ? 'plná sazba' : `${tier.id} sazby`}
          </Line>
          <Line>
            {tier.id === '1/1' ? 'základní sazba ' : `${tier.id} × `}
            {n4(base)} {cur(f.currency)} ({countryName(f.country)}
            {f.baseRateSource === 'EMPLOYER' ? ', sazba zadaná ručně' : f.baseRateSource === 'OTHER' ? ', sazba pro ostatní země' : ''}){tier.id === '1/1' ? '' : ` = ${n4(tierExact)} ${cur(f.currency)}`}
          </Line>
          {f.freeMeals > 0 && (
            <Line>
              krácení: {f.freeMeals} {f.freeMeals === 1 ? 'jídlo' : 'jídla'} × {f.reductionPct} % × {n4(reductionBase)} = {n4(reductionExact)} {cur(f.currency)}
            </Line>
          )}
          <Line strong>
            {f.freeMeals > 0 ? `${n4(tierExact)} − ${n4(reductionExact)} = ` : ''}
            {n4(resultExact)} {cur(f.currency)}
            {rules.rounding.foreignPerDay === 'NONE' ? ' (nezaokrouhluje se)' : ` → ${formatMinor(f.amount, f.currency)}`}
          </Line>
          {day.pocketMoney && (
            <Line>
              kapesné: {n4(resultExact)} × {day.pocketMoney.pct} % = {n4((resultExact * day.pocketMoney.pct) / 100)} {cur(f.currency)}
            </Line>
          )}
        </Calc>
      )}
    </li>
  );
}

/** Stravné po dnech: časové úseky, rozhodující stát a výpočet krok za krokem. */
export function PerDiemProtocol({ result, trip }: { result: CalculationResult; trip: TripDoc }) {
  const days = result.perDiem?.days ?? [];
  const colors = new Map<string, string>([['CZ', HOME_COLOR]]);
  for (const d of days) for (const i of d.intervals) if (!colors.has(i.country)) colors.set(i.country, PALETTE[(colors.size - 1) % PALETTE.length]!);
  return (
    <Card aria-label="Stravné po dnech">
      <H2>Stravné po dnech</H2>
      <div className="flex flex-wrap gap-3 text-[13px] text-muted" aria-hidden="true">
        {[...colors].map(([c, color]) => (
          <span key={c} className="flex items-center gap-1.5">
            <i className="inline-block size-3 rounded-sm" style={{ background: color }} />
            {countryName(c)}
          </span>
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {days.map((d) => (
          <PerDiemDay key={d.date} day={d} trip={trip} colors={colors} />
        ))}
      </ul>
      <p className="text-[13px] text-subtle">{perDiemRoundingNote(ruleSets[0]!.rounding, Object.keys(result.perDiem?.foreignTotals ?? {}).length > 0)}</p>
    </Card>
  );
}

/** Přepočet zahraničního stravného na Kč a vyrovnání záloh v cizí měně. */
export function ConversionProtocol({ result, trip }: { result: CalculationResult; trip: TripDoc }) {
  const s = result.settlement;
  const days = result.perDiem?.days ?? [];
  if (!s || (!s.convertedPerDiem.length && !s.currencies.length)) return null;
  const exactDay = (d: DayResult) => {
    const f = d.foreign!;
    const tier = ruleSets[0]!.foreign.tiers.find((t) => t.id === f.tierId)!;
    const base = units(f.baseRate, f.currency);
    const t = (base * tier.numerator) / tier.denominator;
    const r = ((ruleSets[0]!.foreign.mealReductionBase === 'TIER_AMOUNT' ? t : base) * f.reductionPct * f.freeMeals) / 100;
    return ruleSets[0]!.rounding.foreignPerDay === 'NONE' ? Math.max(0, t - r) : units(f.amount, f.currency);
  };
  const parts = (code: string) => days.filter((d) => d.foreign?.currency === code).map(exactDay);
  return (
    <Card aria-label="Přepočet na Kč">
      <H2>Přepočet zahraničního stravného na Kč</H2>
      {s.convertedPerDiem.map((c) => {
        const r = trip.perDiemRates[c.currency];
        // Přesný součet ze dnů (exactAmount je jen na 4 desetinná místa a násobení by se o haléř lišilo).
        const total = parts(c.currency).reduce((a, b) => a + b, 0) + units(result.perDiem?.pocketMoneyTotals[c.currency] ?? 0, c.currency);
        return (
          <Calc key={c.currency}>
            <Line>
              součet: {parts(c.currency).map(n4).join(' + ')} = {n4(total)} {c.currency}
            </Line>
            <Why>
              Záloha v {c.currency} nebyla – kurz ČNB ke dni začátku cesty{r?.rateDate ? `, kurzovní lístek ze dne ${formatDay(r.rateDate)}` : ''}.
            </Why>
            <Line>
              {n4(total)} × {formatRate(c.rate)}
              {c.rateUnit > 1 ? ` ÷ ${c.rateUnit}` : ''} = {n4((total * Number(c.rate)) / c.rateUnit)} Kč
            </Line>
            <Line strong>zaokrouhleno na haléře: {formatMinor(c.czk)}</Line>
          </Calc>
        );
      })}
      {s.currencies.map((c) => {
        const perDiem = c.perDiemExact ? Number(c.perDiemExact) : units(c.perDiem + c.pocketMoney, c.currency);
        const balance = perDiem + units(c.fromAdvance - c.advance, c.currency);
        return (
          <Calc key={c.currency}>
            <Line>
              stravné{c.pocketMoney ? ' a kapesné' : ''} {n4(perDiem)} + výdaje ze zálohy {n4(units(c.fromAdvance, c.currency))} − záloha {n4(units(c.advance, c.currency))} = {n4(balance)} {c.currency}{' '}
              ({balance >= 0 ? 'doplatek' : 'přeplatek'})
            </Line>
            {c.rate && (
              <Line>
                {n4(balance)} × {formatRate(c.rate)} (kurz zálohy){(c.rateUnit ?? 1) > 1 ? ` ÷ ${c.rateUnit}` : ''} = {n4((balance * Number(c.rate)) / (c.rateUnit ?? 1))} Kč
              </Line>
            )}
            <Line strong>zaokrouhleno na haléře: {formatMinor(c.balanceCzk)}</Line>
          </Calc>
        );
      })}
    </Card>
  );
}

function expenseCalc(e: ExpenseResult): string {
  if (e.currency === 'CZK') return 'v Kč';
  const amount = units(e.amount, e.currency);
  if (e.rateSource === 'BANK_CONFIRMATION') return `stržená částka podle banky (odpovídá kurzu ${formatRate(e.rate ?? '0')})`;
  const rate = Number(e.rate ?? 0);
  const unit = e.rateUnit ?? 1;
  const src = e.rateSource === 'ADVANCE_RATE' ? ' (kurz zálohy)' : e.rateSource === 'CNB' ? ' (ČNB)' : e.rateSource === 'EXCHANGE_RECEIPT' ? ' (doklad o směně)' : ' (ručně)';
  return `${n4(amount)} × ${formatRate(e.rate ?? '0')}${unit > 1 ? ` ÷ ${unit}` : ''}${src} = ${n4((amount * rate) / unit)}`;
}

function counted(e: ExpenseResult): string {
  if (e.payer === 'EMPLOYER') return 'ne – platil zaměstnavatel';
  if (e.payer === 'ADVANCE') return 'vyrovná se se zálohou';
  return e.reimbursable ? 'ano' : 'ne – neproplácí se';
}

/** Výdaje po jednom: přepočet na Kč a zda jdou do výplaty. */
export function ExpensesProtocol({ result, trip }: { result: CalculationResult; trip: TripDoc }) {
  if (!result.expenses.length) return null;
  return (
    <Card aria-label="Výdaje">
      <H2>Výdaje</H2>
      {/* Na úzkém displeji se tabulka posouvá – kontejner je proto dosažitelný klávesnicí. */}
      <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Tabulka výdajů">
        <table className="w-full border-collapse text-left text-[14px] tabular-nums">
          <thead>
            <tr className="border-b border-line-strong text-[13px] text-muted">
              <th className="py-1.5 pr-3 font-semibold">#</th>
              <th className="py-1.5 pr-3 font-semibold">Výdaj</th>
              <th className="py-1.5 pr-3 text-right font-semibold">Částka</th>
              <th className="py-1.5 pr-3 font-semibold">Přepočet</th>
              <th className="py-1.5 pr-3 text-right font-semibold">Kč</th>
              <th className="py-1.5 font-semibold">Do výplaty</th>
            </tr>
          </thead>
          <tbody>
            {result.expenses.map((e) => {
              const doc = trip.expenses.find((x) => x.id === e.id);
              return (
                <tr key={e.id} className="border-b border-line align-top">
                  <td className="py-1.5 pr-3">{e.order}</td>
                  <td className="py-1.5 pr-3">
                    {e.category}
                    {doc?.date && <span className="text-muted"> · {formatDay(doc.date)}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right whitespace-nowrap">{formatMinor(e.amount, e.currency)}</td>
                  <td className="py-1.5 pr-3 text-[13px]">{expenseCalc(e)}</td>
                  <td className="py-1.5 pr-3 text-right whitespace-nowrap">{formatMinor(e.czk).replace(/\s?Kč$/, '')}</td>
                  <td className="py-1.5 text-[13px]">{counted(e)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-subtle">Přepočet se zaokrouhluje na haléře. U platby kartou podle potvrzení banky se bere skutečně stržená částka v Kč.</p>
    </Card>
  );
}

/** Náhrada za soukromé vozidlo: kilometry, spotřeba, cena paliva a oba vzorce. */
export function VehicleProtocol({ result, trip }: { result: CalculationResult; trip: TripDoc }) {
  const v = result.vehicle;
  if (!v) return null;
  const rules = ruleSets[0]!;
  const km = Number(v.km);
  const cons = trip.vehicle.consumption.map((c) => Number(normalizeDecimal(c) ?? 0)).filter((c) => c > 0);
  const qty = (km * Number(v.consumption)) / 100;
  const receipts = result.expenses
    .map((e) => ({ e, doc: trip.expenses.find((x) => x.id === e.id) }))
    .filter(({ doc }) => doc && FUEL_CATEGORIES.has(doc.category) && Number(normalizeDecimal(doc.fuelQuantity) ?? 0) > 0);
  const sumCzk = receipts.reduce((a, r) => a + units(r.e.czk), 0);
  const sumQty = receipts.reduce((a, r) => a + Number(normalizeDecimal(r.doc!.fuelQuantity) ?? 0), 0);
  const start = result.perDiem?.days[0]?.date ?? '';
  const avg = rules.vehicle.averagePrices.find((p) => p.fuel === trip.vehicle.fuel && p.validFrom <= start && start <= p.validTo);
  return (
    <Card aria-label="Soukromé vozidlo">
      <H2>Soukromé vozidlo</H2>
      <Calc>
        <Line>ujeté kilometry: {n4(km).replace(/,00$/, '')} km</Line>
        <Line>
          spotřeba: {cons.length === 3 ? `(${cons.map(n4).join(' + ')}) ÷ 3 = ` : ''}
          {n4(Number(v.consumption))} {v.unit}/100 km
        </Line>
        {v.fuelPriceSource === 'RECEIPTS' && (
          <>
            {receipts.map(({ e, doc }) => (
              <Line key={e.id}>
                tankování č. {e.order}: {formatMinor(e.czk)} / {doc!.fuelQuantity} {v.unit}
              </Line>
            ))}
            <Line>
              cena paliva: {n4(sumCzk)} Kč ÷ {n4(sumQty)} {v.unit} = {n4(sumCzk / sumQty)} → {formatMinor(v.fuelPrice)} za 1 {v.unit} (vážený průměr)
            </Line>
          </>
        )}
        {v.fuelPriceSource === 'RECEIPT' && (
          <Line>
            cena paliva: {formatMinor(v.fuelPrice)} za 1 {v.unit} ({v.fuelPriceRef})
          </Line>
        )}
        {v.fuelPriceSource === 'AVERAGE' && (
          <Line>
            cena paliva: {formatMinor(v.fuelPrice)} za 1 {v.unit} – průměrná cena podle vyhlášky {avg?.source ?? v.fuelPriceRef}
            {avg && ` (platí ${formatDay(avg.validFrom)} – ${formatDay(avg.validTo)})`}
          </Line>
        )}
        {v.fuelPriceSource === 'AVERAGE_MANUAL' && (
          <Line>
            cena paliva: {formatMinor(v.fuelPrice)} za 1 {v.unit} – zadaná ručně ({v.fuelPriceRef})
            {v.rulesAveragePrice !== undefined && `; podle uložené vyhlášky ${formatMinor(v.rulesAveragePrice)}`}
          </Line>
        )}
      </Calc>
      <Calc>
        <Line>
          základní náhrada: {n4(km).replace(/,00$/, '')} km × {n4(units(v.ratePerKm))} Kč = {n4(km * units(v.ratePerKm))} → {formatMinor(v.basic)}
        </Line>
        <Line>
          palivo: {n4(km).replace(/,00$/, '')} km × {n4(Number(v.consumption))} ÷ 100 = {n4(qty)} {v.unit} × {n4(units(v.fuelPrice))} = {n4(qty * units(v.fuelPrice))} → {formatMinor(v.fuelCompensation)}
        </Line>
        <Line strong>
          celkem: {formatMinor(v.basic)} + {formatMinor(v.fuelCompensation)} = {formatMinor(v.total)}
        </Line>
      </Calc>
    </Card>
  );
}

/** Vyúčtování s mezisoučty, přesnou částkou a zaokrouhlením. */
export function SettlementProtocol({ result }: { result: CalculationResult }) {
  const s = result.settlement;
  if (!s) return null;
  const czkFromAdvance = result.expenses.filter((e) => e.payer === 'ADVANCE' && e.currency === 'CZK').reduce((a, e) => a + e.czk, 0);
  const rows: [string, number, boolean?][] = [
    ['Tuzemské stravné', s.domesticPerDiemCzk],
    ...s.convertedPerDiem.map((c): [string, number] => [`Zahraniční stravné v ${c.currency} přepočtené na Kč`, c.czk]),
    ['Výdaje uhrazené zaměstnancem', s.employeeExpensesCzk],
    ...(czkFromAdvance ? [['Výdaje uhrazené z korunové zálohy', czkFromAdvance] as [string, number]] : []),
    ...(result.vehicle ? [['Náhrada za soukromé vozidlo', s.vehicleCzk] as [string, number]] : []),
    ['Nárok celkem', s.claimCzk, true],
    ...(s.advanceCzk ? [['Poskytnutá záloha v Kč', -s.advanceCzk] as [string, number]] : []),
    ...s.currencies.map((c): [string, number] => [`${c.balance >= 0 ? 'Doplatek' : 'Přeplatek'} zálohy v ${c.currency} v Kč`, c.balanceCzk]),
    ...(s.payoutExact !== s.claimCzk ? [['K výplatě přesně', s.payoutExact, true] as [string, number, boolean]] : []),
  ];
  const diff = s.payout - s.payoutExact;
  return (
    <Card aria-label="Vyúčtování">
      <H2>Vyúčtování</H2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[15px] tabular-nums">
        {rows.map(([label, value, bold]) => (
          <div key={label} className={`contents ${bold ? 'font-semibold' : ''}`}>
            <dt className={bold ? 'border-t border-line pt-1.5' : 'text-muted'}>{label}</dt>
            <dd className={`text-right whitespace-nowrap ${bold ? 'border-t border-line pt-1.5' : ''}`}>{formatMinor(value)}</dd>
          </div>
        ))}
        <dt className="text-muted">Zaokrouhlení na celé Kč</dt>
        <dd className="text-right whitespace-nowrap">
          {diff >= 0 ? '+' : '−'}
          {formatMinor(Math.abs(diff))}
        </dd>
        <dt className="border-t border-ink pt-1.5 font-bold">{s.payout >= 0 ? 'K výplatě zaměstnanci' : 'Vratka zaměstnance'}</dt>
        <dd className="border-t border-ink pt-1.5 text-right font-bold whitespace-nowrap">{formatMinor(Math.abs(s.payout))}</dd>
        {s.employerPaidCzk > 0 && (
          <>
            <dt className="text-muted">Uhrazeno přímo zaměstnavatelem (jen náklad, nevyplácí se)</dt>
            <dd className="text-right whitespace-nowrap">{formatMinor(s.employerPaidCzk)}</dd>
          </>
        )}
        <dt className="text-muted">Celkové náklady cesty</dt>
        <dd className="text-right whitespace-nowrap">{formatMinor(s.totalCostCzk)}</dd>
      </dl>
    </Card>
  );
}
