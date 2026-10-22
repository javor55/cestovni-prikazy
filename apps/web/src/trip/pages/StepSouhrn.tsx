import { formatMinutes } from '@cp/core';
import { ruleSets } from '@cp/rules';
import { Link } from 'react-router';
import { countryName } from '../../model/countries.js';
import { formatExact, formatMinor, formatRate, perDiemRoundingNote } from '../../model/format.js';
import { CnbButton } from '../../rates/CnbButton.js';
import { actualTimes } from '../../model/toInput.js';
import { Card, H2, Icon, icons, Notice, NumberField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

export function StepSouhrn() {
  const { trip, update, result, issues } = useTrip();
  const s = result?.settlement;
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const missingRates = issues.filter((i) => i.code === 'PER_DIEM_MISSING_RATE').map((i) => i.ref?.currency).filter(Boolean) as string[];
  const perDiemCurrencies = [...new Set([...missingRates, ...Object.keys(trip.perDiemRates)])];
  // Ruční sazba: stát bez sazby, stát se sazbou „ostatní země“ (Ú-28) a státy, kde už ji uživatel zadal.
  const missingCountries = issues.filter((i) => i.code === 'FOREIGN_RATE_MISSING' || i.code === 'FOREIGN_RATE_OTHER').map((i) => i.ref?.country).filter(Boolean) as string[];
  const ownCountries = [...new Set([...missingCountries, ...Object.keys(trip.employerRates.foreignBase)])];

  return (
    <>
      <StepIssues slug="souhrn" />

      {(perDiemCurrencies.length > 0 || ownCountries.length > 0) && (
        <Card>
          <H2>Doplňte pro výpočet</H2>
          {perDiemCurrencies.map((cur) => {
            const r = trip.perDiemRates[cur] ?? { rate: '', unit: '1', rateDate: '' };
            const date = actualTimes(trip).start.slice(0, 10);
            return (
              <div key={cur} className="flex flex-col gap-2">
                <NumberField
                  label={`Kurz pro přepočet zahraničního stravného (Kč za ${r.unit || 1} ${cur})`}
                  value={r.rate}
                  onChange={(v) => update((d) => void (d.perDiemRates[cur] = { ...r, rate: v }))}
                  hint="V této měně nebyla záloha. Výchozí je kurz ČNB ke dni začátku cesty – postup potvrzuje účetní (Ú-10)."
                />
                <CnbButton date={date} currency={cur} rateDate={r.rateDate} onRate={(x) => update((d) => void (d.perDiemRates[cur] = { rate: x.rate.replace('.', ','), unit: String(x.amount), rateDate: x.rateDate }))} />
              </div>
            );
          })}
          {ownCountries.map((c) => {
            const r = trip.employerRates.foreignBase[c] ?? { amount: '', currency: 'EUR' };
            return (
              <div key={c} className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label={`Základní sazba zahraničního stravného – ${countryName(c)}`}
                  value={r.amount}
                  onChange={(v) => update((d) => void (d.employerRates.foreignBase[c] = { ...r, amount: v }))}
                  hint="Podle vyhlášky MF o sazbách zahraničního stravného pro rok 2026. Prázdné pole = sazba podle přílohy vyhlášky (u států, které příloha neuvádí, sazba pro ostatní země)."
                />
                <NumberField
                  label="Měna sazby"
                  value={r.currency}
                  onChange={(v) => update((d) => void (d.employerRates.foreignBase[c] = { ...r, currency: v.toUpperCase().slice(0, 3) }))}
                />
              </div>
            );
          })}
        </Card>
      )}

      {s ? (
        <section className="flex flex-col gap-1 rounded-2xl bg-ink p-5 text-white" aria-label="Výsledek">
          <span className="text-sm text-white/75">{s.payout >= 0 ? 'K výplatě zaměstnanci' : 'Zaměstnanec vrací'}</span>
          <strong className="text-4xl tracking-tight">{formatMinor(Math.abs(s.payout))}</strong>
          <span className="text-[13px] text-white/75">
            Nárok v Kč {formatMinor(s.claimCzk)}
            {s.currencies.map((c) => ` · ${c.balance >= 0 ? 'doplatek' : 'přeplatek'} ${formatMinor(Math.abs(c.balance), c.currency)} = ${formatMinor(Math.abs(c.balanceCzk))}`)}
          </span>
        </section>
      ) : (
        <Notice tone="warn">Výpočet zatím nelze provést. Doplňte údaje podle chyb v kroku Kontrola.</Notice>
      )}

      <Link
        to={`/cesta/${trip.id}/kontrola`}
        className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold no-underline ${errors ? 'border-danger-line bg-danger-soft text-danger' : warnings ? 'border-warn-line bg-warn-soft text-warn' : 'border-line bg-white text-ok'}`}
      >
        <Icon d={errors || warnings ? icons.warn : icons.check} />
        <span className="grow">
          {errors} {errors === 1 ? 'chyba' : errors >= 2 && errors <= 4 ? 'chyby' : 'chyb'} · {warnings} {warnings === 1 ? 'varování' : 'varování'} ke kontrole
        </span>
        <span aria-hidden="true">›</span>
      </Link>

      {result?.perDiem && (
        <Card>
          <H2>Stravné po dnech</H2>
          <ul className="flex flex-col divide-y divide-line">
            {result.perDiem.days.map((d) => (
              <li key={d.date} className="flex flex-col gap-1 py-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <strong>{d.label}</strong>
                  <span className="text-muted">
                    ČR {formatMinutes(d.domesticMinutes)}
                    {d.foreignMinutes > 0 && ` · zahraničí ${formatMinutes(d.foreignMinutes)}`}
                  </span>
                </div>
                {d.domestic && (
                  <div className="flex justify-between gap-2 text-muted">
                    <span>
                      Tuzemské, pásmo {d.domestic.bandId} h: {formatMinor(d.domestic.rate)}
                      {d.domestic.freeMeals > 0 && ` − ${d.domestic.freeMeals} × ${d.domestic.reductionPct} % (${formatMinor(d.domestic.reduction)})`}
                    </span>
                    <strong className="text-ink">{formatMinor(d.domestic.amount)}</strong>
                  </div>
                )}
                {d.foreign && (
                  <div className="flex justify-between gap-2 text-muted">
                    <span>
                      {d.foreign.countryName} {d.foreign.tierId} z {formatMinor(d.foreign.baseRate, d.foreign.currency)} = {formatMinor(d.foreign.tierAmount, d.foreign.currency)}
                      {d.foreign.freeMeals > 0 && ` − ${d.foreign.freeMeals} × ${d.foreign.reductionPct} % (${formatMinor(d.foreign.reduction, d.foreign.currency)})`}
                    </span>
                    <strong className="text-ink">{formatMinor(d.foreign.amount, d.foreign.currency)}</strong>
                  </div>
                )}
                {d.pocketMoney && (
                  <div className="flex justify-between gap-2 text-muted">
                    <span>Kapesné {d.pocketMoney.pct} %</span>
                    <strong className="text-ink">{formatMinor(d.pocketMoney.amount, d.pocketMoney.currency)}</strong>
                  </div>
                )}
                {d.notes.map((n) => (
                  <span key={n} className="text-[13px] text-subtle">
                    {n}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-subtle">{perDiemRoundingNote(ruleSets[0]!.rounding, Object.keys(result?.perDiem?.foreignTotals ?? {}).length > 0)}</p>
        </Card>
      )}

      {s && (
        <Card>
          <H2>Vyúčtování</H2>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[15px]">
            <dt className="text-muted">Tuzemské stravné</dt>
            <dd className="text-right">{formatMinor(s.domesticPerDiemCzk)}</dd>
            {s.convertedPerDiem.map((c) => (
              <Row key={c.currency} label={`Zahraniční stravné ${c.exactAmount ? formatExact(c.exactAmount, c.currency) : formatMinor(c.amount, c.currency)} × ${formatRate(c.rate)}`} value={formatMinor(c.czk)} />
            ))}
            <Row label="Výdaje uhrazené zaměstnancem" value={formatMinor(s.employeeExpensesCzk)} />
            {result?.vehicle && <Row label="Náhrada za soukromé vozidlo" value={formatMinor(s.vehicleCzk)} />}
            {s.advanceCzk > 0 && <Row label="Záloha v Kč" value={`−${formatMinor(s.advanceCzk)}`} />}
            {s.currencies.map((c) => (
              <Row
                key={c.currency}
                label={`${c.currency}: stravné ${c.perDiemExact ? formatExact(c.perDiemExact, c.currency) : formatMinor(c.perDiem + c.pocketMoney, c.currency)} + ze zálohy ${formatMinor(c.fromAdvance, c.currency)} − záloha ${formatMinor(c.advance, c.currency)}${c.rate ? ` × ${formatRate(c.rate)}` : ''}`}
                value={formatMinor(c.balanceCzk)}
              />
            ))}
            <dt className="border-t border-line pt-1.5 font-bold">{s.payout >= 0 ? 'K výplatě' : 'Vratka zaměstnance'} (zaokrouhleno)</dt>
            <dd className="border-t border-line pt-1.5 text-right font-bold">{formatMinor(Math.abs(s.payout))}</dd>
            {s.employerPaidCzk > 0 && <Row label="Uhrazeno přímo zaměstnavatelem (jen náklad)" value={formatMinor(s.employerPaidCzk)} />}
            <Row label="Celkové náklady cesty" value={formatMinor(s.totalCostCzk)} />
          </dl>
        </Card>
      )}

      {result?.ruleSet && (
        <details className="rounded-2xl border border-line bg-white p-4 text-sm">
          <summary className="min-h-11 cursor-pointer font-semibold text-accent">
            Pravidla výpočtu: {result.ruleSet.id} v{result.ruleSet.version}
          </summary>
          <div className="mt-2 flex flex-col gap-2 leading-relaxed text-muted">
            <p>{result.ruleSet.verification}</p>
            <p>Předpoklady, které ještě potvrzuje účetní:</p>
            <ul className="list-disc pl-5">
              {result.ruleSet.assumptions.map((a) => (
                <li key={a.code}>{a.text}</li>
              ))}
            </ul>
            <p>Předpisy, ze kterých sazby pocházejí:</p>
            <ul className="list-disc pl-5">
              {(ruleSets.find((x) => x.id === result.ruleSet!.id)?.sources ?? []).map((x) => (
                <li key={x.id}>
                  {x.url ? (
                    <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                      {x.title}
                    </a>
                  ) : (
                    x.title
                  )}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right whitespace-nowrap">{value}</dd>
    </>
  );
}
