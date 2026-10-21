import type { PaymentMethod } from '@cp/core';
import { useState } from 'react';
import { currencyOptions } from '../../model/countries.js';
import { formatDay, formatMinor, formatRate } from '../../model/format.js';
import { actualTimes } from '../../model/toInput.js';
import { emptyExpense, expenseCategories, paymentLabels, rateSourceLabels, type ExpenseDoc, type RateSource } from '../../model/trip.js';
import { Button, Card, Checkbox, Icon, icons, NumberField, SelectField, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

const categoryOptions = expenseCategories.map((c) => [c, c] as const);
const paymentOptions = Object.entries(paymentLabels) as [PaymentMethod, string][];
const rateOptions = Object.entries(rateSourceLabels) as [RateSource, string][];

export function StepVydaje() {
  const { trip, update, result, issues } = useTrip();
  const [open, setOpen] = useState<string | null>(null);
  const total = result?.expenses.reduce((s, e) => s + (e.reimbursable ? e.czk : 0), 0) ?? 0;

  const set = <K extends keyof ExpenseDoc>(i: number, k: K) => (v: ExpenseDoc[K]) => update((d) => void (d.expenses[i]![k] = v));

  return (
    <>
      <StepIssues slug="vydaje" />
      <div className="flex items-baseline justify-between text-[15px]">
        <span>
          {trip.expenses.length} {trip.expenses.length === 1 ? 'výdaj' : trip.expenses.length >= 2 && trip.expenses.length <= 4 ? 'výdaje' : 'výdajů'}
        </span>
        <strong>{formatMinor(total)}</strong>
      </div>

      {trip.expenses.map((e, i) => {
        const r = result?.expenses.find((x) => x.id === e.id);
        const hasProblem = issues.some((x) => x.ref?.expenseId === e.id && x.severity !== 'info');
        const isOpen = open === e.id;
        const foreign = e.currency !== 'CZK' && e.paymentMethod !== 'ADVANCE';
        return (
          <Card key={e.id} className={hasProblem ? 'border-warn-line bg-warn-soft' : ''} aria-label={`Výdaj ${i + 1}`}>
            <button type="button" className="flex min-h-11 w-full flex-col gap-1 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}>
              <span className="flex w-full justify-between gap-2">
                <strong className="text-[15px]">
                  {i + 1}. {e.category}
                  {e.supplier && ` · ${e.supplier}`}
                </strong>
                <strong className="text-[15px] whitespace-nowrap">{e.amount ? `${e.amount} ${e.currency}` : 'bez částky'}</strong>
              </span>
              <span className="flex w-full justify-between gap-2 text-[13px] text-muted">
                <span>
                  {formatDay(e.date) || 'bez data'} · {paymentLabels[e.paymentMethod]}
                  {!e.reimbursable && ' · neproplácí se'}
                </span>
                {r && e.currency !== 'CZK' && <span className="whitespace-nowrap">{formatMinor(r.czk)}</span>}
              </span>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-4 border-t border-line pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Kategorie" value={e.category} options={categoryOptions} onChange={set(i, 'category')} />
                  <TextField label="Datum" type="date" value={e.date} onChange={set(i, 'date')} />
                  <TextField label="Popis" optional value={e.description} onChange={set(i, 'description')} />
                  <TextField label="Dodavatel" optional value={e.supplier} onChange={set(i, 'supplier')} />
                  <NumberField label="Částka" value={e.amount} onChange={set(i, 'amount')} placeholder="0,00" />
                  <SelectField label="Měna" value={e.currency} options={currencyOptions} onChange={set(i, 'currency')} />
                  <SelectField
                    label="Způsob úhrady"
                    value={e.paymentMethod}
                    options={paymentOptions}
                    onChange={set(i, 'paymentMethod')}
                    className="sm:col-span-2"
                    hint={
                      e.paymentMethod.startsWith('COMPANY') || e.paymentMethod === 'EMPLOYER_TRANSFER'
                        ? 'Výdaj zaplatil zaměstnavatel – nevyplácí se, jen se uvede v nákladech cesty.'
                        : e.paymentMethod === 'ADVANCE'
                          ? 'Zúčtuje se se zálohou v téže měně.'
                          : 'Proplatí se zaměstnanci.'
                    }
                  />
                </div>
                {foreign && (
                  <div className="flex flex-col gap-4 rounded-xl bg-ground p-3">
                    <SelectField label="Přepočet na Kč" value={e.rateSource} options={rateOptions} onChange={set(i, 'rateSource')} />
                    {e.rateSource === 'BANK_CONFIRMATION' ? (
                      <NumberField
                        label="Stržená částka v Kč"
                        value={e.czkAmount}
                        onChange={set(i, 'czkAmount')}
                        hint="Podle výpisu nebo potvrzení z bankovnictví. Kurz se dopočítá."
                      />
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <NumberField
                          label={`Kurz Kč za ${e.rateUnit || 1} ${e.currency}`}
                          value={e.rate}
                          onChange={set(i, 'rate')}
                          hint={e.rateSource === 'CNB' ? 'Automatické načtení kurzu ČNB přibude v příští verzi. Zatím ho opište z cnb.cz.' : undefined}
                        />
                        <NumberField label="Množství" value={e.rateUnit} onChange={set(i, 'rateUnit')} hint="ČNB uvádí kurz za 1, u některých měn za 100 jednotek." />
                      </div>
                    )}
                    {r?.rate && e.rateSource === 'BANK_CONFIRMATION' && <p className="text-[13px] text-muted">Odpovídá kurzu {formatRate(r.rate)} Kč za 1 {e.currency}.</p>}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Číslo dokladu" optional value={e.documentNumber} onChange={set(i, 'documentNumber')} hint="Pomůže odhalit omylem zadaný duplicitní výdaj." />
                  <TextField label="Poznámka" optional value={e.note} onChange={set(i, 'note')} />
                </div>
                <Checkbox checked={!e.reimbursable} onChange={(v) => set(i, 'reimbursable')(!v)}>
                  Neproplácet (např. doklad o tankování, který slouží jen k určení ceny paliva)
                </Checkbox>
                <p className="text-[13px] text-subtle">Fotky a skeny dokladů půjde připojit v příští verzi.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setOpen(null)}>
                    Hotovo
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      update((d) => void d.expenses.splice(i, 1));
                      setOpen(null);
                    }}
                  >
                    <Icon d={icons.trash} /> Odebrat výdaj
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      <Button
        className="self-start"
        onClick={() => {
          const e = emptyExpense(actualTimes(trip).start.slice(0, 10));
          if (trip.kind === 'foreign') e.currency = 'EUR';
          update((d) => void d.expenses.push(e));
          setOpen(e.id);
        }}
      >
        <Icon d={icons.plus} /> Přidat výdaj
      </Button>
    </>
  );
}
