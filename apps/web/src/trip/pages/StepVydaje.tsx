import type { PaymentMethod } from '@cp/core';
import { useState } from 'react';
import { currencyOptions } from '../../model/countries.js';
import { convertToCzk, impliedRate } from '@cp/core';
import { formatDay, formatMinor, formatRate, normalizeDecimal, toMinor } from '../../model/format.js';
import { datesOf, markBreakfasts } from '../../model/meals.js';
import { bankAccountProblem } from '../../model/bankAccount.js';
import { actualTimes, FUEL_CATEGORIES, payerOf } from '../../model/toInput.js';
import { CnbButton } from '../../rates/CnbButton.js';
import { AttachmentList } from '../../attachments/AttachmentList.js';
import { deleteForExpense } from '../../attachments/store.js';
import { db } from '../../storage/db.js';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Attachment } from '../../attachments/model.js';
import { emptyExpense, expenseCategories, paymentLabels, rateSourceLabels, type ExpenseDoc, type RateSource } from '../../model/trip.js';
import { Link } from 'react-router';
import { Button, Card, Checkbox, Icon, icons, Notice, NumberField, SelectField, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

const categoryOptions = expenseCategories.map((c) => [c, c] as const);
const paymentOptions = Object.entries(paymentLabels) as [PaymentMethod, string][];
const rateOptions = Object.entries(rateSourceLabels) as [RateSource, string][];

export function StepVydaje() {
  const { trip, update, result, issues } = useTrip();
  const [open, setOpen] = useState<string | null>(null);
  const attachments = useLiveQuery(() => db.attachments.where('tripId').equals(trip.id).toArray(), [trip.id]) ?? [];
  const total = result?.expenses.reduce((s, e) => s + (e.reimbursable ? e.czk : 0), 0) ?? 0;

  const paidPrivately = trip.expenses.some((e) => e.reimbursable && e.amount.trim() && payerOf(e.paymentMethod) === 'EMPLOYEE');

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
              <DocSummary list={attachments.filter((a) => a.expenseId === e.id)} />
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
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <NumberField label={`Kurz Kč za ${e.rateUnit || 1} ${e.currency}`} value={e.rate} onChange={set(i, 'rate')} />
                          <NumberField label="Množství" value={e.rateUnit} onChange={set(i, 'rateUnit')} hint="ČNB uvádí kurz za 1, u některých měn za 100 jednotek." />
                        </div>
                        {e.rateSource === 'CNB' && (
                          <CnbButton
                            date={e.date}
                            currency={e.currency}
                            rateDate={e.rateDate}
                            onRate={(r) =>
                              update((d) => {
                                const x = d.expenses[i]!;
                                x.rate = r.rate.replace('.', ',');
                                x.rateUnit = String(r.amount);
                                x.rateDate = r.rateDate;
                              })
                            }
                          />
                        )}
                      </>
                    )}
                    <Conversion e={e} />
                  </div>
                )}
                {e.category === 'Ubytování' && (
                  <BreakfastQuestion
                    answer={e.breakfast}
                    tripId={trip.id}
                    onAnswer={(yes) =>
                      update((d) => {
                        const was = d.expenses[i]!.breakfast;
                        d.expenses[i]!.breakfast = yes ? 'yes' : 'no';
                        const { start, end } = actualTimes(d);
                        // Zpětné „nebyla“ zruší snídaně, které aplikace označila.
                        if (yes || was === 'yes') markBreakfasts(d, datesOf(start, end), yes);
                      })
                    }
                  />
                )}
                {FUEL_CATEGORIES.has(e.category) && (
                  <NumberField
                    label={e.category === 'Nabíjení elektromobilu' ? 'Množství (kWh)' : 'Množství (l)'}
                    value={e.fuelQuantity}
                    onChange={set(i, 'fuelQuantity')}
                    hint="Z dokladu o tankování. Z cen a množství všech tankování se spočítá cena paliva pro náhradu za soukromé vozidlo."
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Číslo dokladu" optional value={e.documentNumber} onChange={set(i, 'documentNumber')} hint="Pomůže odhalit omylem zadaný duplicitní výdaj." />
                  <TextField label="Poznámka" optional value={e.note} onChange={set(i, 'note')} />
                </div>
                <Checkbox checked={!e.reimbursable} onChange={(v) => set(i, 'reimbursable')(!v)}>
                  Neproplácet (např. doklad o tankování, který slouží jen k určení ceny paliva)
                </Checkbox>
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <h3 className="text-base font-bold">Doklady</h3>
                  <AttachmentList tripId={trip.id} expenseId={e.id} defaultKind="accounting" privatePayment={['PRIVATE_CARD', 'EMPLOYEE_TRANSFER'].includes(e.paymentMethod)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setOpen(null)}>
                    Hotovo
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      update((d) => void d.expenses.splice(i, 1));
                      void deleteForExpense(trip.id, e.id);
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

      <details className="rounded-2xl border border-line bg-white p-4">
        <summary className="min-h-11 cursor-pointer font-semibold text-accent">
          Další dokumenty k cestě{attachments.some((a) => a.expenseId === null) && ` (${attachments.filter((a) => a.expenseId === null).length})`}
        </summary>
        <p className="my-2 text-[13px] text-subtle">Program cesty, pozvánka, rezervace a další podklady, které nepatří k jednomu výdaji.</p>
        <AttachmentList tripId={trip.id} expenseId={null} defaultKind="supporting" />
      </details>

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

      {paidPrivately && (
        <Card aria-label="Výplata na účet">
          <TextField
            label="Číslo účtu pro výplatu"
            value={trip.employee.bankAccount}
            onChange={(v) => update((d) => void (d.employee.bankAccount = v))}
            placeholder="123456789/0800"
            hint="Některé výdaje jste platili ze soukromých prostředků. Na tento účet vám je účetní pošle – číslo bude ve vyúčtování v PDF."
            error={trip.employee.bankAccount.trim() ? bankAccountProblem(trip.employee.bankAccount) : 'Doplňte číslo účtu.'}
          />
        </Card>
      )}
    </>
  );
}

function DocSummary({ list }: { list: Attachment[] }) {
  const acc = list.filter((a) => a.kind === 'accounting').length;
  const pay = list.filter((a) => a.kind === 'payment').length;
  if (!list.length) return <span className="text-xs font-semibold text-warn">! Bez dokladu</span>;
  return (
    <span className="text-xs font-semibold text-ok">
      ✓ {acc} {acc === 1 ? 'účetní doklad' : 'účetních dokladů'}
      {pay > 0 && ` · ${pay} ${pay === 1 ? 'doklad o zaplacení' : 'doklady o zaplacení'}`}
    </span>
  );
}

/** Přepočet na Kč přímo ve formuláři – nezávisle na tom, zda je už vyplněná celá cesta. */
function Conversion({ e }: { e: ExpenseDoc }) {
  const amount = toMinor(e.amount, e.currency);
  if (amount === null || amount <= 0) return null;
  const money = { amount, currency: e.currency };
  if (e.rateSource === 'BANK_CONFIRMATION') {
    const czk = toMinor(e.czkAmount, 'CZK');
    if (!czk) return null;
    return <p className="text-[13px] text-muted">Odpovídá kurzu {formatRate(impliedRate(money, czk))} Kč za 1 {e.currency}.</p>;
  }
  const rate = normalizeDecimal(e.rate);
  if (!rate) return null;
  const unit = Number(normalizeDecimal(e.rateUnit) ?? '1') || 1;
  return (
    <p className="text-[15px]">
      = <strong>{formatMinor(convertToCzk(money, rate, unit))}</strong>
    </p>
  );
}

/** Snídaně v ceně ubytování krátí stravné (Ú-6) – aplikace se zeptá přímo u ubytování. */
function BreakfastQuestion({ answer, tripId, onAnswer }: { answer: ExpenseDoc['breakfast']; tripId: string; onAnswer: (yes: boolean) => void }) {
  if (answer === 'yes')
    return (
      <p className="text-sm text-muted">
        Snídaně v ceně ubytování jsou označené v kroku{' '}
        <Link to={`/cesta/${tripId}/jidla`} className="font-semibold text-accent underline">
          Bezplatná jídla
        </Link>{' '}
        (každé ráno po první noci). Upravit je můžete tam.{' '}
        <button type="button" className="font-semibold text-accent underline" onClick={() => onAnswer(false)}>
          Snídaně v ceně nebyla
        </button>
      </p>
    );
  if (answer === 'no') return null;
  return (
    <Notice title="Byla v ceně ubytování snídaně?">
      <span className="flex flex-col gap-2">
        Snídaně, kterou platí zaměstnavatel (v ceně ubytování), snižuje stravné.
        <span className="flex flex-wrap gap-2">
          <Button onClick={() => onAnswer(true)}>Ano, označit snídaně</Button>
          <Button variant="secondary" onClick={() => onAnswer(false)}>
            Ne
          </Button>
        </span>
      </span>
    </Notice>
  );
}
