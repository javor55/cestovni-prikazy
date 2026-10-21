import { countryName, countryOptions, currencyOptions } from '../../model/countries.js';
import { CnbButton } from '../../rates/CnbButton.js';
import { newId, suggestNumber, transportLabels, type TransportKind } from '../../model/trip.js';
import { Button, Card, H2, Icon, icons, NumberField, RadioCards, SelectField, TextArea, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

const transportOptions: [TransportKind | '', string][] = [['', 'Vyberte'], ...(Object.entries(transportLabels) as [TransportKind, string][])];
const destinationOptions: [string, string][] = [['', 'Vyberte stát'], ...countryOptions.filter(([c]) => c !== 'CZ')];
const transitAdd: [string, string][] = [['', 'Přidat stát…'], ...countryOptions.filter(([c]) => c !== 'CZ')];

export function StepCesta() {
  const { trip, update } = useTrip();
  const set = (k: 'number' | 'purpose' | 'startPlace' | 'endPlace' | 'destinations' | 'via' | 'plannedStart' | 'plannedEnd' | 'plannedTransport' | 'issuedPlace' | 'issuedOn' | 'note') => (v: string) =>
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
          {trip.kind === 'foreign' ? (
            <SelectField label="Stát cíle" value={trip.destinationCountry} options={destinationOptions} onChange={(v) => update((d) => void (d.destinationCountry = v))} />
          ) : (
            <span className="hidden sm:block" />
          )}
          {trip.kind === 'foreign' && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <SelectField
                label="Státy po cestě"
                optional
                value=""
                options={transitAdd}
                onChange={(v) => v && update((d) => void d.transitCountries.push(v))}
                hint="Státy, kterými pojedete, v pořadí cesty tam (např. Rakousko, Slovinsko). Předvyplní se z nich přechody hranic v průběhu cesty."
              />
              {trip.transitCountries.length > 0 && (
                <ol className="flex flex-wrap gap-2" aria-label="Vybrané státy po cestě">
                  {trip.transitCountries.map((c, i) => (
                    <li key={`${c}-${i}`} className="flex items-center gap-1 rounded-full border border-line-strong bg-white py-1 pr-1 pl-3 text-sm">
                      {i + 1}. {countryName(c)}
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-full text-danger hover:bg-danger-soft"
                        aria-label={`Odebrat ${countryName(c)}`}
                        onClick={() => update((d) => void d.transitCountries.splice(i, 1))}
                      >
                        <Icon d="M6 6l12 12M18 6L6 18" className="size-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
          <TextField label="Průjezdní místa" optional value={trip.via} onChange={set('via')} />
          <SelectField
            label="Dopravní prostředek"
            value={trip.plannedTransportKind}
            options={transportOptions}
            onChange={(v) => update((d) => void (d.plannedTransportKind = v))}
          />
          <TextField label="Upřesnění dopravy" optional value={trip.plannedTransport} onChange={set('plannedTransport')} placeholder="např. Railjet, vlastní vůz" />
          <TextField label="Místo vystavení příkazu" optional value={trip.issuedPlace} onChange={set('issuedPlace')} placeholder="Praha" />
          <TextField label="Datum vystavení příkazu" optional type="date" value={trip.issuedOn} onChange={set('issuedOn')} hint="Obvykle den před cestou. Prázdné pole zůstane v PDF k ručnímu doplnění." />
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
            {a.currency !== 'CZK' && (
              <div className="flex flex-col gap-2 sm:col-span-4">
                <NumberField
                  label={`Kurz Kč za ${a.rateUnit || 1} ${a.currency}`}
                  value={a.rate}
                  onChange={(v) => update((d) => void (d.advances[i]!.rate = v))}
                  hint="Kurz ČNB ze dne vyplacení zálohy. Tímto kurzem se přepočte doplatek nebo přeplatek."
                />
                <CnbButton
                  date={a.providedOn}
                  currency={a.currency}
                  rateDate={a.rateDate}
                  onRate={(r) =>
                    update((d) => {
                      const x = d.advances[i]!;
                      x.rate = r.rate.replace('.', ',');
                      x.rateUnit = String(r.amount);
                      x.rateDate = r.rateDate;
                    })
                  }
                />
              </div>
            )}
            <Button variant="danger" className="sm:col-span-4 sm:justify-self-start" onClick={() => update((d) => void d.advances.splice(i, 1))}>
              <Icon d={icons.trash} /> Odebrat zálohu
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => update((d) => void d.advances.push({ id: newId(), amount: '', currency: d.kind === 'foreign' ? 'EUR' : 'CZK', providedOn: '', rate: '', rateUnit: '1', rateDate: '' }))}
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
