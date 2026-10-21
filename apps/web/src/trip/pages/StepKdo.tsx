import { ruleSets } from '@cp/rules';
import { useEffect, useState } from 'react';
import { formatMinor } from '../../model/format.js';
import { getRemembered, setRemembered } from '../../storage/db.js';
import { Card, Checkbox, H2, NumberField, RadioCards, TextField } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

export function StepKdo() {
  const { trip, update } = useTrip();
  const [remember, setRemember] = useState(false);
  const bands = ruleSets[0]!.domestic.bands;

  useEffect(() => {
    void getRemembered().then((r) => setRemember(Boolean(r)));
  }, []);
  // Zapamatované údaje se průběžně aktualizují, dokud je volba zapnutá.
  useEffect(() => {
    if (remember) void setRemembered({ employee: trip.employee, employer: trip.employer, sector: trip.sector });
  }, [remember, trip.employee, trip.employer, trip.sector]);

  const emp = (k: keyof typeof trip.employee) => (v: string) => update((d) => void (d.employee[k] = v));
  const er = (k: keyof typeof trip.employer) => (v: string) => update((d) => void (d.employer[k] = v));

  return (
    <>
      <StepIssues slug="kdo" />
      <Card>
        <H2>Zaměstnanec</H2>
        <TextField label="Jméno a příjmení" value={trip.employee.name} onChange={emp('name')} autoComplete="name" />
        <TextField
          label="Pravidelné pracoviště"
          value={trip.employee.regularWorkplace}
          onChange={emp('regularWorkplace')}
          hint="Místo, kde obvykle pracujete, např. „Praha, Vinohradská 12“."
        />
        <details className="group">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-accent">Osobní číslo, pozice, útvar, adresa, číslo účtu</summary>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <TextField label="Osobní číslo" optional value={trip.employee.personalNumber} onChange={emp('personalNumber')} />
            <TextField label="Pracovní pozice" optional value={trip.employee.position} onChange={emp('position')} />
            <TextField label="Útvar" optional value={trip.employee.department} onChange={emp('department')} />
            <TextField label="Adresa" optional value={trip.employee.address} onChange={emp('address')} />
            <TextField
              label="Číslo účtu pro výplatu"
              optional
              value={trip.employee.bankAccount}
              onChange={emp('bankAccount')}
              placeholder="123456789/0800"
              hint="Uvede se ve vyúčtování u částky k výplatě."
            />
          </div>
        </details>
      </Card>

      <Card>
        <H2>Zaměstnavatel</H2>
        <TextField label="Název" value={trip.employer.name} onChange={er('name')} autoComplete="organization" />
        <TextField label="Sídlo" value={trip.employer.seat} onChange={er('seat')} />
        <RadioCards
          legend="Typ zaměstnavatele"
          value={trip.sector}
          onChange={(v) => update((d) => void (d.sector = v))}
          options={[
            { value: 'business', title: 'Soukromá firma', hint: 'Podnikatelská sféra – zákonné minimum stravného, firma může dát víc.' },
            { value: 'public', title: 'Stát, obec, kraj, příspěvková organizace', hint: 'Platová sféra – sazby v pevném rozpětí.' },
          ]}
        />
        <p className="text-[13px] text-subtle">Nevíte? Zeptejte se účetní. Typ zaměstnavatele ovlivňuje výpočet stravného.</p>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-accent">IČO, organizační jednotka, nákladové středisko, zakázka</summary>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <TextField label="IČO" optional value={trip.employer.ico} onChange={er('ico')} inputMode="numeric" />
            <TextField label="Organizační jednotka" optional value={trip.employer.unit} onChange={er('unit')} />
            <TextField label="Nákladové středisko" optional value={trip.employer.costCenter} onChange={er('costCenter')} />
            <TextField label="Projekt nebo zakázka" optional value={trip.employer.project} onChange={er('project')} />
          </div>
        </details>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-accent">Sazby podle vnitřního předpisu firmy</summary>
          <div className="mt-2 flex flex-col gap-4">
            <p className="text-[13px] text-subtle">
              Vyplňte jen tehdy, pokud firma platí jiné sazby, než je výchozí hodnota. Prázdné pole = {trip.sector === 'business' ? 'zákonné minimum' : 'dolní hranice rozpětí'}.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {bands.map((b) => (
                <NumberField
                  key={b.id}
                  label={`Stravné ${b.id.replace('+', ' a více')} h (Kč)`}
                  optional
                  value={trip.employerRates.domestic[b.id] ?? ''}
                  onChange={(v) => update((d) => void (d.employerRates.domestic[b.id] = v))}
                  hint={trip.sector === 'business' ? `min. ${formatMinor(b.business.min)}` : `${formatMinor(b.public.min)} – ${formatMinor(b.public.max)}`}
                />
              ))}
            </div>
            <NumberField
              label="Kapesné při zahraniční cestě (% ze stravného)"
              optional
              value={trip.employerRates.pocketMoneyPct}
              onChange={(v) => update((d) => void (d.employerRates.pocketMoneyPct = v))}
              hint="Kapesné je dobrovolné, nejvýše 40 %. Bez pokynu zaměstnavatele nechte prázdné."
            />
            <Checkbox checked={trip.combineShortDomesticDays} onChange={(v) => update((d) => void (d.combineShortDomesticDays = v))}>
              Sčítat doby kratší než 5 hodin z více dnů tuzemské cesty (jen pokud to vnitřní předpis firmy výslovně stanoví – viz otázka Ú-5 pro účetní)
            </Checkbox>
          </div>
        </details>
      </Card>

      <Checkbox
        checked={remember}
        onChange={(v) => {
          setRemember(v);
          if (!v) void setRemembered(undefined);
        }}
      >
        Zapamatovat zaměstnance a zaměstnavatele pro příští cesty v tomto prohlížeči
      </Checkbox>
    </>
  );
}
