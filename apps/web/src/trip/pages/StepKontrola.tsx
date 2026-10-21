import type { Severity } from '@cp/core';
import { submitDeadline } from '../../model/deadline.js';
import { formatDay } from '../../model/format.js';
import { actualTimes } from '../../model/toInput.js';
import { expiresAt } from '../../storage/db.js';
import { Icon, icons, LinkButton } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { IssueItem } from '../IssueList.js';

const groups: [Severity, string][] = [
  ['error', 'Chyby bránící vytvoření PDF'],
  ['warning', 'Varování – PDF lze vytvořit, ale zkontrolujte je'],
  ['info', 'Pro informaci'],
];

export function StepKontrola() {
  const { trip, issues } = useTrip();
  const errors = issues.filter((i) => i.severity === 'error');
  const expiry = expiresAt(trip).toLocaleDateString('cs-CZ');
  const deadline = submitDeadline(actualTimes(trip).end);

  return (
    <>
      {errors.length === 0 ? (
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ok">
          <Icon d={icons.check} /> Žádné chyby. Vyúčtování je připravené k vytvoření PDF.
        </p>
      ) : (
        <p className="text-[15px] text-muted">Opravte chyby. Odkaz u každé vás zavede do kroku, kde se oprava provede.</p>
      )}
      {groups.map(([sev, title]) => {
        const list = issues.filter((i) => i.severity === sev);
        const extra =
          sev === 'info'
            ? [
                ...(deadline
                  ? [`Vyúčtování předložte zaměstnavateli do ${formatDay(deadline)} – do 10 pracovních dnů po skončení cesty (§ 183 zákoníku práce), pokud vnitřní předpis neurčuje jinou lhůtu.`]
                  : []),
                `Data cesty se z tohoto prohlížeče smažou ${expiry}, pokud ji do té doby neotevřete.`,
              ]
            : [];
        if (!list.length && !extra.length) return null;
        return (
          <section key={sev} className="flex flex-col gap-2">
            <h2 className="text-base font-bold">
              {title} ({list.length + extra.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {list.map((i, n) => (
                <IssueItem key={n} issue={i} showLink={sev !== 'info'} />
              ))}
              {extra.map((t) => (
                <IssueItem key={t} issue={{ severity: 'info', code: 'RETENTION', message: t }} />
              ))}
            </ul>
          </section>
        );
      })}
      {errors.length === 0 && (
        <LinkButton to={`/cesta/${trip.id}/pdf`} className="self-start">
          Pokračovat k PDF
        </LinkButton>
      )}
    </>
  );
}
