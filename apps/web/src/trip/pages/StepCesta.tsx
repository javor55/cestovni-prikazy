import { currencyOptions } from '../../model/countries.js';
import { newId, suggestNumber } from '../../model/trip.js';
import { Button, Card, H2, Icon, icons, NumberField, RadioCards, SelectField, TextArea, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

export function StepCesta() {
  const { trip, update } = useTrip();
  const set = (k: 'number' | 'purpose' | 'startPlace' | 'endPlace' | 'destinations' | 'via' | 'plannedStart' | 'plannedEnd' | 'plannedTransport' | 'note') => (v: string) =>
    update((d) => void (d[k] = v));

  return (
    <>
      <StepIssues slug="cesta" />
      <Card>
        <H2>Pracovní cesta</H2>
        <div className="flex items-end gap-2">
          <TextField label="Číslo cestovního příkazu" className="grow" value={trip.number} onChange={set('number')} hint="Podle číslování ve firmě, nebo si nechte navrhnout." />
        </div>
        <Button variant="secondary" className="self-start" onClick={() => update((d) => void (d.number = suggestNumber(new Date())))}>
          Navrhnout číslo
        </Button>
        <TextField label="Účel cesty" value={trip.purpose} onChange={set('purpose')} placeholder="např. Jednání s dodavatelem" />
        <RadioCards
          legend="Druh cesty"
          value={trip.kind}
          onChange={(v) => update((d) => void (d.kind = v))}
          options={[
            { value: 'domestic', title: 'Tuzemská', hint: 'Celá cesta v Česku.' },
            { value: 'foreign', title: 'Zahraniční', hint: 'Alespoň část cesty v zahraničí.' },
          ]}
        />
      </Card>

      <Card>
        <H2>Plán cesty</H2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Místo nástupu" value={trip.startPlace} onChange={set('startPlace')} placeholder="Praha" />
          <TextField label="Místo ukončení" value={trip.endPlace} onChange={set('endPlace')} placeholder="Praha" />
          <TextField label="Plánovaný začátek" type="datetime-local" value={trip.plannedStart} onChange={set('plannedStart')} />
          <TextField label="Plánovaný konec" type="datetime-local" value={trip.plannedEnd} onChange={set('plannedEnd')} min={trip.plannedStart} />
          <TextField label="Cílová místa" value={trip.destinations} onChange={set('destinations')} placeholder="Vídeň" />
          <TextField label="Průjezdní místa" optional value={trip.via} onChange={set('via')} />
          <TextField label="Dopravní prostředek" value={trip.plannedTransport} onChange={set('plannedTransport')} placeholder="vlak, soukromé auto…" className="sm:col-span-2" />
        </div>
        <p className="text-[13px] text-subtle">Časy zadávejte v českém čase. Skutečný průběh vyplníte v dalším kroku.</p>
      </Card>

      <Card>
        <H2>Záloha</H2>
        {trip.advances.length === 0 && <p className="text-[15px] text-muted">Žádná záloha nebyla poskytnuta.</p>}
        {trip.advances.map((a, i) => (
          <div key={a.id} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-4">
            <NumberField label="Částka" value={a.amount} onChange={(v) => update((d) => void (d.advances[i]!.amount = v))} />
            <SelectField label="Měna" value={a.currency} options={currencyOptions} onChange={(v) => update((d) => void (d.advances[i]!.currency = v))} />
            <TextField label="Vyplaceno dne" type="date" value={a.providedOn} onChange={(v) => update((d) => void (d.advances[i]!.providedOn = v))} />
            {a.currency !== 'CZK' ? (
              <NumberField
                label={`Kurz Kč za 1 ${a.currency}`}
                value={a.rate}
                onChange={(v) => update((d) => void (d.advances[i]!.rate = v))}
                hint="Kurz ČNB ze dne vyplacení zálohy."
              />
            ) : (
              <div />
            )}
            <Button variant="danger" className="sm:col-span-4 sm:justify-self-start" onClick={() => update((d) => void d.advances.splice(i, 1))}>
              <Icon d={icons.trash} /> Odebrat zálohu
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => update((d) => void d.advances.push({ id: newId(), amount: '', currency: d.kind === 'foreign' ? 'EUR' : 'CZK', providedOn: '', rate: '' }))}
        >
          <Icon d={icons.plus} /> Přidat zálohu
        </Button>
      </Card>

      <Card>
        <TextArea label="Poznámka" optional value={trip.note} onChange={set('note')} />
      </Card>
    </>
  );
}
