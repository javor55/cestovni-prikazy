import { countryName, countryOptions } from '../../model/countries.js';
import { formatDateTime } from '../../model/format.js';
import { actualTimes } from '../../model/toInput.js';
import { emptySegment, transportLabels, type SegmentDoc, type TransportKind } from '../../model/trip.js';
import { Button, Card, Checkbox, H2, Icon, icons, NumberField, SelectField, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

const transportOptions = Object.entries(transportLabels) as [TransportKind, string][];

export function StepPrubeh() {
  const { trip, update } = useTrip();
  const { start, end } = actualTimes(trip);
  const totalKm = trip.segments.reduce((s, x) => s + (Number(x.km.replace(',', '.')) || 0), 0);

  const setSeg = <K extends keyof SegmentDoc>(i: number, k: K) => (v: SegmentDoc[K]) => update((d) => void (d.segments[i]![k] = v));

  const addSegment = () =>
    update((d) => {
      const prev = d.segments.at(-1);
      const s = emptySegment(prev);
      if (!prev) s.fromPlace = d.startPlace;
      d.segments.push(s);
    });

  const addReturn = () =>
    update((d) => {
      const first = d.segments[0];
      const last = d.segments.at(-1);
      if (!first || !last) return;
      d.segments.push({ ...emptySegment(last), toPlace: first.fromPlace, toCountry: first.fromCountry, km: first.km, transport: first.transport });
    });

  return (
    <>
      <StepIssues slug="prubeh" />
      <p className="text-[15px] leading-relaxed text-muted">
        Zadejte jednotlivé úseky cesty tak, jak skutečně proběhly. Časy v českém čase. Pokud úsek vede do jiného státu, doplňte čas přechodu hranice. U letu je to čas odletu z letiště v Česku nebo příletu do něj.
      </p>
      {(start || end) && (
        <p className="text-[15px]">
          Cesta: <strong>{formatDateTime(start) || '?'}</strong> – <strong>{formatDateTime(end) || '?'}</strong>
          {totalKm > 0 && <span className="text-muted"> · {totalKm} km</span>}
        </p>
      )}

      {trip.segments.map((s, i) => {
        const abroad = s.fromCountry !== s.toCountry;
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
              <NumberField label="Kilometry" optional value={s.km} onChange={setSeg(i, 'km')} />
            </div>
            {abroad && (
              <TextField
                label={`Přechod hranice ${countryName(s.fromCountry)} → ${countryName(s.toCountry)}`}
                type="datetime-local"
                value={s.crossingAt}
                onChange={setSeg(i, 'crossingAt')}
                min={s.departure}
                max={s.arrival}
                hint="Rozhoduje o době v zahraničí. Pokud projíždíte více státy, rozdělte cestu na úseky po státech."
              />
            )}
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-semibold text-accent">Dopravce, číslo spoje, soukromá část</summary>
              <div className="mt-2 flex flex-col gap-3">
                <TextField label="Dopravce, číslo spoje nebo letu" optional value={s.carrier} onChange={setSeg(i, 'carrier')} />
                <Checkbox checked={s.private} onChange={setSeg(i, 'private')}>
                  Soukromá část cesty – nezapočítává se do doby pro stravné
                </Checkbox>
              </div>
            </details>
          </Card>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={addSegment}>
          <Icon d={icons.plus} /> Přidat úsek
        </Button>
        {trip.segments.length > 0 && (
          <Button variant="secondary" onClick={addReturn}>
            Přidat zpáteční cestu
          </Button>
        )}
      </div>

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
