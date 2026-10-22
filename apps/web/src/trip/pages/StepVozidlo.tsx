import { ruleSets, type FuelType } from '@cp/rules';
import { AttachmentList } from '../../attachments/AttachmentList.js';
import { formatDay, formatMinor, normalizeDecimal } from '../../model/format.js';
import { actualTimes, FUEL_CATEGORIES } from '../../model/toInput.js';
import { fuelLabels, type VehicleDoc } from '../../model/trip.js';
import { Button, Card, Checkbox, H2, Notice, NumberField, RadioCards, SelectField, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

const fuelOptions = Object.entries(fuelLabels) as [FuelType, string][];

export function StepVozidlo() {
  const { trip, update, result } = useTrip();
  const v = trip.vehicle;
  const set = <K extends keyof VehicleDoc>(k: K) => (val: VehicleDoc[K]) => update((d) => void (d.vehicle[k] = val));
  const carKm = trip.segments.filter((s) => s.transport === 'soukrome-auto' || s.transport === 'pujcene-auto').reduce((s, x) => s + (Number(x.km.replace(',', '.')) || 0), 0);
  const three = v.consumption.length === 3;
  const unit = v.fuel === 'electricity' ? 'kWh' : 'l';
  const r = result?.vehicle;
  const uses = (k: string) => trip.segments.some((s) => s.transport === k);
  const fuelReceipts = trip.expenses.filter((e) => FUEL_CATEGORIES.has(e.category) && normalizeDecimal(e.fuelQuantity));
  const priceSource = { RECEIPTS: 'podle dokladů o tankování', RECEIPT: 'cena z dokladu', AVERAGE: 'průměrná cena', AVERAGE_MANUAL: 'průměrná cena zadaná ručně' } as const;
  // Průměrná cena podle sady pravidel ke dni začátku cesty (stejně jako ve výpočtu).
  const priceDate = actualTimes(trip).start.slice(0, 10) || trip.plannedStart.slice(0, 10);
  const rulesAverage = ruleSets[0]!.vehicle.averagePrices.find((p) => p.fuel === v.fuel && priceDate && p.validFrom <= priceDate && priceDate <= p.validTo);

  return (
    <>
      <StepIssues slug="vozidlo" />
      <Checkbox checked={v.used} onChange={set('used')}>
        Na cestě jsem použil(a) osobní vozidlo
      </Checkbox>
      {!v.used && <p className="text-[15px] text-muted">Pokud jste cestovali jen hromadnou dopravou, tento krok přeskočte.</p>}
      {uses('pronajate-auto') && (
        <Notice title="Auto z autopůjčovny">
          Nájemné, palivo, dálniční známku apod. zadejte jako výdaje. Náhrada za kilometry podle zákoníku práce u vozidla z autopůjčovny obvykle nenáleží – postup ověřte u účetní.
        </Notice>
      )}
      {uses('pujcene-auto') && (
        <Notice title="Půjčené auto">
          Auto půjčené např. od rodiny se pro náhradu posuzuje stejně jako vlastní (není to vozidlo zaměstnavatele). Vyplňte vlastníka a přiložte technický průkaz a smlouvu o výpůjčce.
        </Notice>
      )}
      {v.used && (
        <>
          <Card>
            <RadioCards
              legend="Čí bylo vozidlo"
              value={v.ownership}
              onChange={set('ownership')}
              options={[
                { value: 'private', title: 'Soukromé nebo půjčené', hint: 'Náleží základní náhrada za km a náhrada za palivo.' },
                { value: 'company', title: 'Firemní', hint: 'Náhrada se neposkytuje. Tankování zadejte jako výdaj.' },
              ]}
            />
          </Card>
          {v.ownership === 'private' && (
            <>
              <Card>
                <H2>Vozidlo</H2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Značka a typ" optional value={v.model} onChange={set('model')} placeholder="Škoda Octavia" />
                  <TextField label="Registrační značka" optional value={v.plate} onChange={set('plate')} />
                  <TextField label="Vlastník" optional value={v.owner} onChange={set('owner')} />
                  <SelectField
                    label="Druh vozidla"
                    value={v.type}
                    options={[
                      ['car', 'Osobní automobil'],
                      ['motorcycle', 'Motocykl'],
                    ]}
                    onChange={set('type')}
                  />
                  <SelectField label="Palivo" value={v.fuel} options={fuelOptions} onChange={set('fuel')} />
                </div>
                <Checkbox checked={v.requestedByEmployer} onChange={set('requestedByEmployer')}>
                  Vozidlo jsem použil(a) na žádost nebo se souhlasem zaměstnavatele
                </Checkbox>
              </Card>
              <Card>
                <H2>Spotřeba a kilometry</H2>
                {three ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {['Ve městě', 'Mimo město', 'Kombinovaná'].map((label, i) => (
                      <NumberField
                        key={label}
                        label={`${label} (${unit}/100 km)`}
                        value={v.consumption[i] ?? ''}
                        onChange={(val) => update((d) => void (d.vehicle.consumption[i] = val))}
                      />
                    ))}
                  </div>
                ) : (
                  <NumberField
                    label={`Spotřeba podle technického průkazu (${unit}/100 km)`}
                    value={v.consumption[0] ?? ''}
                    onChange={(val) => update((d) => void (d.vehicle.consumption = [val]))}
                  />
                )}
                <Button variant="secondary" className="self-start" onClick={() => update((d) => void (d.vehicle.consumption = three ? [d.vehicle.consumption[2] ?? ''] : ['', '', d.vehicle.consumption[0] ?? '']))}>
                  {three ? 'Technický průkaz uvádí jen jednu hodnotu' : 'Technický průkaz uvádí tři hodnoty'}
                </Button>
                <NumberField label="Ujeté kilometry" value={v.km} onChange={set('km')} />
                {carKm > 0 && String(carKm) !== v.km && (
                  <Button variant="secondary" className="self-start" onClick={() => set('km')(String(carKm))}>
                    Použít {carKm} km z úseků jetých soukromým autem
                  </Button>
                )}
              </Card>
              <Card>
                <RadioCards
                  legend="Cena paliva"
                  value={v.fuelPriceMode}
                  onChange={set('fuelPriceMode')}
                  options={[
                    {
                      value: 'receipts',
                      title: 'Podle dokladů o tankování',
                      hint: 'Vážený průměr: cena všech tankování ÷ množství. Tankování zadejte ve výdajích (kategorie Pohonné hmoty) i s množstvím.',
                    },
                    { value: 'receipt', title: 'Cena z jednoho dokladu', hint: 'Zadáte cenu za litr nebo kWh ručně.' },
                    { value: 'average', title: 'Průměrná cena podle vyhlášky', hint: 'Když doklad o tankování nemáte.' },
                  ]}
                />
                {v.fuelPriceMode === 'receipts' &&
                  (fuelReceipts.length ? (
                    <p className="text-[15px] text-muted">
                      Započítané doklady: {fuelReceipts.map((e) => `${e.amount} ${e.currency} / ${e.fuelQuantity} ${e.category === 'Nabíjení elektromobilu' ? 'kWh' : 'l'}`).join(' · ')}
                    </p>
                  ) : (
                    <Notice tone="warn">Zatím žádný výdaj za pohonné hmoty s vyplněným množstvím. Do té doby se počítá s průměrnou cenou podle vyhlášky.</Notice>
                  ))}
                {v.fuelPriceMode !== 'receipt' && (
                  <div className="flex flex-col gap-3 rounded-xl border border-line p-3" aria-label="Průměrná cena paliva">
                    <p className="text-[15px]">
                      {rulesAverage ? (
                        <>
                          Průměrná cena podle vyhlášky {rulesAverage.source} Sb.: <strong>{formatMinor(rulesAverage.amount)}</strong> za 1 {unit} (platí {formatDay(rulesAverage.validFrom)} – {formatDay(rulesAverage.validTo)}, rozhoduje den
                          začátku cesty {formatDay(priceDate)}).
                        </>
                      ) : (
                        <>Pro {priceDate ? `den ${formatDay(priceDate)}` : 'datum cesty'} průměrnou cenu v uložených sazbách nemáme – zadejte ji níže.</>
                      )}
                      {v.fuelPriceMode === 'receipts' && ' Použije se, jen když chybí doklady o tankování s množstvím.'}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <NumberField
                        label={`Jiná průměrná cena za 1 ${unit} (Kč)`}
                        optional
                        value={v.averagePrice}
                        onChange={set('averagePrice')}
                        hint="Jen když se cena podle vyhlášky změnila a aplikace novou cenu ještě nezná."
                      />
                      {v.averagePrice.trim() && (
                        <TextField
                          label="Zdroj ceny"
                          value={v.averagePriceSource}
                          onChange={set('averagePriceSource')}
                          placeholder="např. vyhláška č. 123/2026 Sb., od 1. 11. 2026"
                          hint="Uvede se ve výpočtu i v PDF, aby to účetní mohla ověřit."
                        />
                      )}
                    </div>
                  </div>
                )}
                {v.fuelPriceMode === 'receipt' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label={`Cena za 1 ${unit} z dokladu (Kč)`} value={v.receiptPrice} onChange={set('receiptPrice')} />
                    <TextField label="Datum dokladu" optional type="date" value={v.receiptDate} onChange={set('receiptDate')} />
                  </div>
                )}
              </Card>
              <Card>
                <H2>Doklady k vozidlu</H2>
                <p className="text-[15px] text-muted">
                  Fotka technického průkazu (strana se spotřebou) nebo výpis z registru vozidel, u půjčeného auta smlouva o výpůjčce. V kompletním PDF budou v oddílu „Doklady k vozidlu“.
                </p>
                <AttachmentList tripId={trip.id} expenseId={null} defaultKind="vehicle" fixedKind="vehicle" />
              </Card>
              {r && (
                <Card aria-label="Výpočet náhrady">
                  <H2>Náhrada</H2>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[15px]">
                    <dt className="text-muted">
                      Základní náhrada {r.km} km × {formatMinor(r.ratePerKm)}
                    </dt>
                    <dd className="text-right">{formatMinor(r.basic)}</dd>
                    <dt className="text-muted">
                      {r.quantity.replace('.', ',')} {r.unit} × {formatMinor(r.fuelPrice)} ({priceSource[r.fuelPriceSource]}, {r.fuelPriceRef})
                    </dt>
                    <dd className="text-right">{formatMinor(r.fuelCompensation)}</dd>
                    <dt className="font-bold">Celkem</dt>
                    <dd className="text-right font-bold">{formatMinor(r.total)}</dd>
                  </dl>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
