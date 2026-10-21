import type { FuelType } from '@cp/rules';
import { formatMinor } from '../../model/format.js';
import { fuelLabels, type VehicleDoc } from '../../model/trip.js';
import { Button, Card, Checkbox, H2, NumberField, RadioCards, SelectField, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

const fuelOptions = Object.entries(fuelLabels) as [FuelType, string][];

export function StepVozidlo() {
  const { trip, update, result } = useTrip();
  const v = trip.vehicle;
  const set = <K extends keyof VehicleDoc>(k: K) => (val: VehicleDoc[K]) => update((d) => void (d.vehicle[k] = val));
  const carKm = trip.segments.filter((s) => s.transport === 'soukrome-auto').reduce((s, x) => s + (Number(x.km.replace(',', '.')) || 0), 0);
  const three = v.consumption.length === 3;
  const unit = v.fuel === 'electricity' ? 'kWh' : 'l';
  const r = result?.vehicle;

  return (
    <>
      <StepIssues slug="vozidlo" />
      <Checkbox checked={v.used} onChange={set('used')}>
        Na cestě jsem použil(a) osobní vozidlo
      </Checkbox>
      {!v.used && <p className="text-[15px] text-muted">Pokud jste cestovali jen hromadnou dopravou, tento krok přeskočte.</p>}
      {v.used && (
        <>
          <Card>
            <RadioCards
              legend="Čí bylo vozidlo"
              value={v.ownership}
              onChange={set('ownership')}
              options={[
                { value: 'private', title: 'Soukromé', hint: 'Náleží základní náhrada za km a náhrada za palivo.' },
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
                <H2>Cena paliva</H2>
                <p className="text-[15px] text-muted">Pokud máte doklad o tankování, zadejte cenu z něj. Jinak se použije průměrná cena podle vyhlášky.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField label={`Cena za 1 ${unit} z dokladu (Kč)`} optional value={v.receiptPrice} onChange={set('receiptPrice')} />
                  <TextField label="Datum dokladu" optional type="date" value={v.receiptDate} onChange={set('receiptDate')} />
                </div>
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
                      {r.quantity.replace('.', ',')} {r.unit} × {formatMinor(r.fuelPrice)} ({r.fuelPriceSource === 'RECEIPT' ? 'cena z dokladu' : 'průměrná cena, ' + r.fuelPriceRef})
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
