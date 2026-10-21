import { formatMinutes } from '@cp/core';
import { formatMinor } from '../../model/format.js';
import { datesOf, markBreakfasts } from '../../model/meals.js';
import { actualTimes } from '../../model/toInput.js';
import type { MealsDoc } from '../../model/trip.js';
import { Button, Card, Notice } from '../../ui/controls.js';
import { useTrip } from '../context.js';
import { StepIssues } from '../IssueList.js';

const mealNames: [keyof MealsDoc, string][] = [
  ['breakfast', 'Snídaně'],
  ['lunch', 'Oběd'],
  ['dinner', 'Večeře'],
];

export function StepJidla() {
  const { trip, update, result } = useTrip();
  const { start, end } = actualTimes(trip);
  const dates = datesOf(start, end);
  const meals = (date: string): MealsDoc => trip.meals[date] ?? { breakfast: false, lunch: false, dinner: false };

  const toggle = (date: string, k: keyof MealsDoc) =>
    update((d) => {
      const m = d.meals[date] ?? { breakfast: false, lunch: false, dinner: false };
      m[k] = !m[k];
      d.meals[date] = m;
    });

  if (!dates.length) return <Notice tone="warn">Nejdřív vyplňte průběh cesty – jídla se zadávají po jednotlivých dnech cesty.</Notice>;

  return (
    <>
      <StepIssues slug="jidla" />
      <p className="text-[15px] leading-relaxed text-muted">
        Označte jídla, která jste dostali zdarma: od hostitele, na školení, nebo v ceně ubytování, které platí zaměstnavatel. Každé takové jídlo snižuje stravné.
      </p>
      {dates.length > 1 && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() =>
            update((d) => markBreakfasts(d, dates))
          }
        >
          Snídaně v ceně ubytování každé ráno
        </Button>
      )}
      {dates.map((date) => {
        const day = result?.perDiem?.days.find((x) => x.date === date);
        const m = meals(date);
        return (
          <Card key={date} aria-label={day?.label ?? date}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="text-base">{day?.label ?? date}</strong>
              {day && (
                <span className="text-[13px] text-muted">
                  v Česku {formatMinutes(day.domesticMinutes)}
                  {day.foreignMinutes > 0 && ` · v zahraničí ${formatMinutes(day.foreignMinutes)}`}
                </span>
              )}
            </div>
            <div className="flex gap-2" role="group" aria-label="Bezplatná jídla">
              {mealNames.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={m[k]}
                  onClick={() => toggle(date, k)}
                  className={`min-h-11 flex-1 rounded-lg border text-sm font-semibold ${m[k] ? 'border-accent bg-accent text-white' : 'border-line-strong bg-white text-ink'}`}
                >
                  {label}
                  {m[k] && <span className="sr-only"> – zdarma</span>}
                </button>
              ))}
            </div>
            {day && (
              <div className="flex flex-col gap-0.5 text-[13px] text-muted">
                {day.domestic && (
                  <span>
                    Tuzemské stravné: <strong className="text-ink">{formatMinor(day.domestic.amount)}</strong>
                    {day.domestic.freeMeals > 0 && ` (${formatMinor(day.domestic.rate)} − ${day.domestic.freeMeals} × ${day.domestic.reductionPct} %)`}
                  </span>
                )}
                {day.foreign && (
                  <span>
                    Zahraniční stravné: <strong className="text-ink">{formatMinor(day.foreign.amount, day.foreign.currency)}</strong>
                    {day.foreign.freeMeals > 0 && ` (${formatMinor(day.foreign.tierAmount, day.foreign.currency)} − ${day.foreign.freeMeals} × ${day.foreign.reductionPct} %)`}
                  </span>
                )}
                {!day.domestic && !day.foreign && <span>Za tento den stravné nenáleží.</span>}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
