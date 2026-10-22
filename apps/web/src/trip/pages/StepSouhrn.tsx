import { Link } from 'react-router';
import { countryName } from '../../model/countries.js';
import { formatMinor } from '../../model/format.js';
import { CnbButton } from '../../rates/CnbButton.js';
import { actualTimes } from '../../model/toInput.js';
import { Card, H2, Notice, NumberField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { ConversionProtocol, ExpensesProtocol, PerDiemProtocol, SettlementProtocol, VehicleProtocol } from '../Protocol.js';
import { Kontrola } from './Kontrola.js';

export function StepSouhrn() {
  const { trip, update, result, issues } = useTrip();
  const s = result?.settlement;
  const missingRates = issues.filter((i) => i.code === 'PER_DIEM_MISSING_RATE').map((i) => i.ref?.currency).filter(Boolean) as string[];
  const perDiemCurrencies = [...new Set([...missingRates, ...Object.keys(trip.perDiemRates)])];
  // Ruční sazba: stát bez sazby, stát se sazbou „ostatní země“ (Ú-28) a státy, kde už ji uživatel zadal.
  const missingCountries = issues.filter((i) => i.code === 'FOREIGN_RATE_MISSING' || i.code === 'FOREIGN_RATE_OTHER').map((i) => i.ref?.country).filter(Boolean) as string[];
  const ownCountries = [...new Set([...missingCountries, ...Object.keys(trip.employerRates.foreignBase)])];

  return (
    <>
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
        <Notice tone="warn">Výpočet zatím nelze provést. Doplňte údaje podle chyb v kontrole níže.</Notice>
      )}

      <Kontrola />

      {result?.perDiem && (
        <>
          <p className="text-[15px] leading-relaxed text-muted">
            Postup výpočtu s čísly této cesty – u každé částky je vidět, jak vznikla. Hodnoty, se kterými aplikace počítá, jsou na stránce{' '}
            <Link to={`/sazby?zpet=/cesta/${trip.id}/souhrn`} className="font-semibold text-accent underline">
              Sazby a hodnoty výpočtu{result.ruleSet ? ` (${result.ruleSet.id} v${result.ruleSet.version})` : ''}
            </Link>
            . Stejný výpočet ve vzorcích Excelu je v exportu XLSX.
          </p>
          <PerDiemProtocol result={result} trip={trip} />
          <ConversionProtocol result={result} trip={trip} />
          <ExpensesProtocol result={result} trip={trip} />
          <VehicleProtocol result={result} trip={trip} />
          <SettlementProtocol result={result} />
        </>
      )}
    </>
  );
}

