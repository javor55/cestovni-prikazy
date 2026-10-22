import { ruleSets } from '@cp/rules';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { download } from './exports/download.js';
import { bandLabel } from './model/bands.js';
import { formatDay, formatMinor } from './model/format.js';
import { fuelLabels } from './model/trip.js';
import { Button, Card, H2, Icon, icons, TextField } from './ui/controls.js';

const fmtHours = (min: number | null) => (min === null ? '' : `${Math.round((min / 60) * 100) / 100}`.replace('.', ','));
const band = bandLabel;
const rounding = { NONE: 'nezaokrouhluje se', HALF_UP_UNIT: 'matematicky na celé jednotky', CEIL_UNIT: 'nahoru na celé jednotky' } as const;

/**
 * Hodnoty, se kterými aplikace počítá (sada pravidel) – aby si účetní mohla ověřit každý výpočet.
 * Stránka je dostupná bez cesty, odkazuje na ni Souhrn a export XLSX.
 */
export function Sazby() {
  const [params] = useSearchParams();
  const back = params.get('zpet');
  const [q, setQ] = useState('');
  const r = ruleSets[0]!;
  const rates = Object.entries(r.foreign.rates)
    .filter(([code, x]) => !q || x.name.toLocaleLowerCase('cs').includes(q.toLocaleLowerCase('cs')) || code === q.toUpperCase())
    .sort((a, b) => a[1].name.localeCompare(b[1].name, 'cs'));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-line bg-white px-3 py-2 md:px-6">
        <Link to={back?.startsWith('/') ? back : '/'} aria-label="Zpět" className="flex size-11 items-center justify-center rounded-lg text-ink hover:bg-ground">
          <Icon d={icons.back} />
        </Link>
        <strong className="text-[17px]">Sazby a hodnoty výpočtu</strong>
      </header>
      <main className="mx-auto flex w-full max-w-3xl grow flex-col gap-4 px-4 py-5 md:px-6">
        <p className="text-[15px] leading-relaxed text-muted">
          Sada pravidel <strong className="text-ink">{r.id} verze {r.version}</strong> platná {formatDay(r.validFrom)} – {formatDay(r.validTo)}. S těmito hodnotami aplikace počítá; každé
          vytvořené PDF uvádí verzi sady, podle které se počítalo. {r.verification}
        </p>
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => download(new TextEncoder().encode(JSON.stringify(r, null, 2)), `${r.id}_v${r.version}_sada-pravidel.json`, 'application/json')}
        >
          <Icon d={icons.download} /> Stáhnout sadu pravidel {r.id} v{r.version} (JSON)
        </Button>

        <Card aria-label="Tuzemské stravné">
          <H2>Tuzemské stravné (vyhláška {r.domestic.source})</H2>
          <Table
            head={['Doba v Česku za den', 'Podnikatelská sféra – minimum', 'Platová sféra – rozpětí', 'Krácení za 1 bezplatné jídlo']}
            rows={r.domestic.bands.map((b) => [
              band(b.minMinutes, b.maxMinutes),
              formatMinor(b.business.min),
              `${formatMinor(b.public.min)} – ${formatMinor(b.public.max)}`,
              `${b.mealReductionPct} % sazby`,
            ])}
          />
          <p className="text-[13px] text-subtle">Kratší než {fmtHours(r.domestic.bands[0]!.minMinutes)} h: stravné nenáleží. Zaokrouhlení za den: {rounding[r.rounding.domesticPerDay].replace('jednotky', 'Kč')}.</p>
        </Card>

        <Card aria-label="Zahraniční stravné">
          <H2>Zahraniční stravné (vyhláška {r.foreign.source})</H2>
          <Table
            head={['Doba v zahraničí za den', 'Část základní sazby', 'Krácení za 1 bezplatné jídlo']}
            rows={r.foreign.tiers.map((t) => [band(t.minMinutes, t.maxMinutes), t.id === '1/1' ? 'plná sazba' : t.id, `${t.mealReductionPct} % ${r.foreign.mealReductionBase === 'TIER_AMOUNT' ? 'z částky pro pásmo' : 'ze základní sazby'}`])}
          />
          <p className="text-[13px] text-subtle">
            Pobyt v zahraničí kratší než {fmtHours(r.foreign.minAbroadMinutes)} h za den se započte k tuzemské části. Rozhodující je stát, kde zaměstnanec v daném dni strávil nejvíc času.
            Kapesné nejvýše {r.foreign.pocketMoneyMaxPct} % zahraničního stravného. Zaokrouhlení za den: {rounding[r.rounding.foreignPerDay]}; na Kč se přepočítá z přesné částky a
            zaokrouhlí na haléře.
            {r.foreign.otherCountries && ` Státy, které příloha vyhlášky neuvádí: ${formatMinor(r.foreign.otherCountries.amount, r.foreign.otherCountries.currency)}.`}
          </p>
          <TextField label="Hledat stát" value={q} onChange={setQ} placeholder="např. Chorvatsko nebo HR" />
          <Table head={['Stát', 'Kód', 'Základní sazba']} rows={rates.map(([code, x]) => [x.name, code, formatMinor(x.amount, x.currency)])} />
          <p className="text-[13px] text-subtle">
            {rates.length} z {Object.keys(r.foreign.rates).length} států a území.
          </p>
        </Card>

        <Card aria-label="Soukromé vozidlo">
          <H2>Soukromé vozidlo (vyhláška {r.vehicle.source})</H2>
          <Table
            head={['Druh vozidla', 'Základní náhrada za 1 km']}
            rows={Object.entries(r.vehicle.ratesPerKm).map(([k, v]) => [k === 'car' ? 'Osobní automobil' : 'Jednostopé vozidlo, tříkolka', formatMinor(v.amount)])}
          />
          <Table
            head={['Palivo', 'Průměrná cena', 'Platí', 'Vyhláška']}
            rows={r.vehicle.averagePrices.map((p) => [fuelLabels[p.fuel], `${formatMinor(p.amount)} / ${p.unit}`, `${formatDay(p.validFrom)} – ${formatDay(p.validTo)}`, `${p.source} Sb.`])}
          />
          <p className="text-[13px] text-subtle">Rozhoduje průměrná cena platná v den začátku cesty. Když se cena změní a aplikace ji ještě nezná, jde v kroku Vozidlo zadat ručně se zdrojem.</p>
        </Card>

        <Card aria-label="Předpisy a předpoklady">
          <H2>Předpisy a předpoklady</H2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
            {r.sources.map((x) => (
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
          <p className="text-[15px] text-muted">Předpoklady, které potvrzuje účetní (otázky Ú-x):</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-muted">
            {r.assumptions.map((a) => (
              <li key={a.code}>
                {a.code.replace('U-', 'Ú-')}: {a.text}
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-line-strong py-1.5 pr-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((c, j) => (
                <td key={j} className="border-b border-line py-1.5 pr-3 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
