import type { Issue, Severity } from '@cp/core';
import { Link } from 'react-router';
import { Icon, icons } from '../ui/controls.js';
import { useTrip } from './context.js';
import { stepOf, steps, type StepSlug } from './steps.js';

const look: Record<Severity, { icon: string; cls: string; label: string }> = {
  error: { icon: icons.error, cls: 'border-danger-line bg-danger-soft text-danger', label: 'Chyba' },
  warning: { icon: icons.warn, cls: 'border-warn-line bg-warn-soft text-warn', label: 'Varování' },
  info: { icon: icons.info, cls: 'border-line bg-white text-muted', label: 'Informace' },
};

export function IssueItem({ issue, showLink }: { issue: Issue; showLink?: boolean }) {
  const { trip } = useTrip();
  const l = look[issue.severity];
  const step = stepOf(issue);
  return (
    <li className={`flex gap-2.5 rounded-xl border p-3 text-sm leading-relaxed ${l.cls}`}>
      <Icon d={l.icon} className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-1">
        <span>
          <strong>{l.label}:</strong> <span className="text-ink">{issue.message}</span>
        </span>
        {issue.code === 'RULESET_USED' && (
          <Link to={`/sazby?zpet=/cesta/${trip.id}/souhrn`} className="self-start font-semibold text-accent">
            Zobrazit sazby a hodnoty této sady pravidel
          </Link>
        )}
        {showLink && step && (
          <Link to={`/cesta/${trip.id}/${step}`} className="self-start font-semibold text-accent">
            Opravit v kroku „{steps.find((s) => s.slug === step)?.title}“
          </Link>
        )}
      </div>
    </li>
  );
}

/** Chyby a varování patřící do daného kroku – zobrazují se nahoře v kroku. */
export function StepIssues({ slug }: { slug: StepSlug }) {
  const { issues } = useTrip();
  const mine = issues.filter((i) => i.severity !== 'info' && stepOf(i) === slug);
  if (!mine.length) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Problémy v tomto kroku">
      {mine.map((i, n) => (
        <IssueItem key={n} issue={i} />
      ))}
    </ul>
  );
}
