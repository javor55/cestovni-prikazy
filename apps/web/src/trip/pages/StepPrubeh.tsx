import { countryName, countryOptions } from '../../model/countries.js';
import { formatDateTime } from '../../model/format.js';
import { addTransit, normalizeCrossings, pathOf, returnSegment, segmentsFromPlan } from '../../model/route.js';
import { actualTimes } from '../../model/toInput.js';
import { emptySegment, transportLabels, type SegmentDoc, type TransportKind } from '../../model/trip.js';
import { Button, Card, Checkbox, H2, Icon, icons, NumberField, SelectField, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

const transportOptions = Object.entries(transportLabels) as [TransportKind, string][];
const transitOptions: [string, string][] = [['', 'Vyberte stát'], ...countryOptions];
const CAR: ReadonlySet<TransportKind> = new Set(['soukrome-auto', 'firemni-auto']);

export function StepPrubeh() {
  const { trip, update } = useTrip();
  const { start, end } = actualTimes(trip);
  const totalKm = trip.segments.reduce((s, x) => s + (Number(x.km.replace(',', '.')) || 0), 0);
  const foreign = trip.kind === 'foreign';
  const planReady = Boolean(trip.startPlace || trip.destinations || trip.plannedStart);

  const updateSeg = (i: number, fn: (s: SegmentDoc) => void) =>
    update((d) => {
      const s = d.segments[i]!;
      fn(s);
      normalizeCrossings(s);
    });
  const setSeg = <K extends keyof SegmentDoc>(i: number, k: K) => (v: SegmentDoc[K]) => updateSeg(i, (s) => void (s[k] = v));

  const addSegment = () =>
    update((d) => {
      const prev = d.segments.at(-1);
      const s = emptySegment(prev);
      if (!prev) s.fromPlace = d.startPlace;
      d.segments.push(s);
    });

  const addReturn = () =>
    update((d) => {
      const r = returnSegment(d);
      if (r) d.segments.push(r);
    });

  return (
    <>
      <StepIssues slug="prubeh" />
      <p className="text-[15px] leading-relaxed text-muted">
        Jak cesta skutečně proběhla – podle toho se počítá stravné. Plán z kroku „Údaje o cestě“ je cestovní příkaz, který schvaluje zaměstnavatel předem. Pokud cesta proběhla podle plánu,
        stačí ho převzít a doplnit časy. Časy zadávejte v českém čase.
      </p>
      {(start || end) && (
        <p className="text-[15px]">
          Cesta: <strong>{formatDateTime(start) || '?'}</strong> – <strong>{formatDateTime(end) || '?'}</strong>
          {totalKm > 0 && <span className="text-muted"> · {totalKm} km</span>}
        </p>
      )}

      {trip.segments.length === 0 && (
        <Card>
          <H2>Začněte podle plánu</H2>
          <p className="text-[15px] leading-relaxed text-muted">
            Vytvoří se cesta tam a zpět s místy, státy po cestě a dopravním prostředkem z plánu. Doplníte jen časy příjezdu, odjezdu a přechodů hranic. Vše jde potom upravit, třeba když jste
            jeli jinou trasou.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => update((d) => void (d.segments = segmentsFromPlan(d)))} disabled={!planReady}>
              Vyplnit podle plánu
            </Button>
            <Button variant="secondary" onClick={addSegment}>
              <Icon d={icons.plus} /> Zadat úseky ručně
            </Button>
          </div>
          {!planReady && <p className="text-[13px] text-subtle">Plán cesty zatím není vyplněný.</p>}
        </Card>
      )}

      {trip.segments.map((s, i) => {
        const path = pathOf(s);
        const showKm = CAR.has(s.transport) || Boolean(s.km);
        return (
          <Card key={s.id} aria-label={`Úsek ${i + 1}`}>
            <div className="flex items-center justify-between gap-2">
              <H2>
                {i + 1}. {s.fromPlace || '…'} → {s.toPlace || '…'}
              </H2>
              <Button variant="danger" className="min-h-11 px-3" onClick={() => update((d) => void d.segments.splice(i, 1))} aria-label={`Odebrat úsek ${i + 1}`}>
                <Icon d={icons.trash} />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Odkud" value={s.fromPlace} onChange={setSeg(i, 'fromPlace')} />
              <SelectField label="Stát" value={s.fromCountry} options={countryOptions} onChange={setSeg(i, 'fromCountry')} />
              <TextField label="Kam" value={s.toPlace} onChange={setSeg(i, 'toPlace')} />
              <SelectField label="Stát" value={s.toCountry} options={countryOptions} onChange={setSeg(i, 'toCountry')} />
              <TextField label="Odjezd" type="datetime-local" value={s.departure} onChange={setSeg(i, 'departure')} />
              <TextField label="Příjezd" type="datetime-local" value={s.arrival} onChange={setSeg(i, 'arrival')} min={s.departure} />
              <SelectField label="Dopravní prostředek" value={s.transport} options={transportOptions} onChange={setSeg(i, 'transport')} />
              {showKm && <NumberField label="Kilometry" optional value={s.km} onChange={setSeg(i, 'km')} />}
            </div>

            {s.crossings.length > 0 && (
              <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
                <legend className="px-1 text-sm font-semibold">Přechody hranic</legend>
                {s.crossings.map((c, j) => {
                  const last = j === s.crossings.length - 1;
                  const from = path[j]!;
                  return (
                    <div key={c.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      {last ? (
                        // Cílový stát úseku se mění u „Kam“ – zde jen pro přehled, ve stejném rozložení jako ostatní řádky.
                        <div className="flex flex-col gap-1.5">
                          <span className="text-sm font-semibold">Cílový stát ({countryName(from) || '?'} → …)</span>
                          <span className="flex min-h-11 items-center rounded-lg border border-line bg-ground px-3 text-base">{countryName(c.to)}</span>
                        </div>
                      ) : (
                        <SelectField
                          label={`Stát po cestě (${countryName(from) || '?'} → …)`}
                          value={c.to}
                          options={transitOptions}
                          onChange={(v) => updateSeg(i, (x) => void (x.crossings[j]!.to = v))}
                        />
                      )}
                      <TextField
                        label={`Přechod hranice ${from || '?'} → ${c.to || '?'}`}
                        type="datetime-local"
                        value={c.at}
                        onChange={(v) => updateSeg(i, (x) => void (x.crossings[j]!.at = v))}
                        min={s.departure}
                        max={s.arrival}
                      />
                      {last ? (
                        <span className="hidden w-12 sm:block" aria-hidden="true" />
                      ) : (
                        <Button
                          variant="danger"
                          className="min-h-11 w-12 px-0"
                          aria-label={`Odebrat stát po cestě ${countryName(c.to) || ''}`.trim()}
                          onClick={() => updateSeg(i, (x) => void x.crossings.splice(j, 1))}
                        >
                          <Icon d={icons.trash} />
                        </Button>
                      )}
                    </div>
                  );
                })}
                <p className="text-[13px] leading-snug text-subtle">
                  Stačí přibližný čas. U každého státu, kterým jste projížděli, zadejte vjezd – stravné se řídí státem, ve kterém jste ten den strávili nejvíc času. U letu je to čas
                  odletu z Česka nebo příletu do něj.
                </p>
              </fieldset>
            )}
            {(foreign || s.crossings.length > 0) && (
              <Button variant="secondary" className="self-start" onClick={() => updateSeg(i, (x) => addTransit(x))}>
                <Icon d={icons.plus} /> Stát po cestě
              </Button>
            )}

            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-semibold text-accent">Dopravce, číslo spoje, soukromá část{!showKm && ', kilometry'}</summary>
              <div className="mt-2 flex flex-col gap-3">
                <TextField label="Dopravce, číslo spoje nebo letu" optional value={s.carrier} onChange={setSeg(i, 'carrier')} />
                {!showKm && <NumberField label="Kilometry" optional value={s.km} onChange={setSeg(i, 'km')} />}
                <Checkbox checked={s.private} onChange={setSeg(i, 'private')}>
                  Soukromá část cesty – nezapočítává se do doby pro stravné
                </Checkbox>
              </div>
            </details>
          </Card>
        );
      })}

      {trip.segments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={addSegment}>
            <Icon d={icons.plus} /> Přidat úsek
          </Button>
          <Button variant="secondary" onClick={addReturn}>
            Přidat zpáteční cestu
          </Button>
        </div>
      )}

      <details className="rounded-2xl border border-line bg-white p-4">
        <summary className="min-h-11 cursor-pointer font-semibold text-accent">Skutečný začátek a konec se liší od prvního odjezdu a posledního příjezdu</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <TextField label="Skutečný začátek cesty" type="datetime-local" optional value={trip.actualStart} onChange={(v) => update((d) => void (d.actualStart = v))} />
          <TextField label="Skutečný konec cesty" type="datetime-local" optional value={trip.actualEnd} onChange={(v) => update((d) => void (d.actualEnd = v))} />
        </div>
        <p className="mt-2 text-[13px] text-subtle">Například když cesta začíná odchodem z domova dříve, než odjíždí první spoj.</p>
      </details>
    </>
  );
}
