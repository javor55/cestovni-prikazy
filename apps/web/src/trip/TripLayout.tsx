import { calculate } from '@cp/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toInput, type DocCounts } from '../model/toInput.js';
import type { TripDoc } from '../model/trip.js';
import { db, deleteTrip, getTrip, saveTrip, touchTrip } from '../storage/db.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { Icon, icons, LinkButton } from '../ui/controls.js';
import { TripContext, type TripCtx } from './context.js';
import { stepState, steps, type StepSlug, type StepState } from './steps.js';
import { StepPages } from './pages/index.js';

const stateLabel: Record<StepState, [string, string]> = {
  done: ['hotovo', 'text-ok'],
  warning: ['varování', 'text-warn'],
  error: ['chyba', 'text-danger'],
  todo: ['', ''],
};

export function TripLayout() {
  const { id = '', step = 'kdo' } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripDoc | null | undefined>(undefined);
  const [saved, setSaved] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef<TripDoc | null>(null);

  useEffect(() => {
    let alive = true;
    getTrip(id).then((t) => {
      if (!alive) return;
      setTrip(t ?? null);
      if (t) void touchTrip(t.id, new Date());
    });
    return () => {
      alive = false;
    };
  }, [id]);

  // Automatické ukládání: ukládá se vykreslený stav, nejpozději 300 ms po první neuložené změně
  // (i při nepřetržitém psaní) a okamžitě při skrytí nebo opuštění stránky.
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const t = pending.current;
    pending.current = null;
    if (t) void saveTrip(t).then(() => !pending.current && setSaved(true));
  }, []);
  useEffect(() => {
    if (!trip || !dirty.current) return;
    dirty.current = false;
    pending.current = trip;
    timer.current ??= setTimeout(flush, 300);
  }, [trip, flush]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  const update = useCallback((fn: (draft: TripDoc) => void) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const draft = structuredClone(prev);
      fn(draft);
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    dirty.current = true;
    setSaved(false);
  }, []);

  const attachments = useLiveQuery(() => db.attachments.where('tripId').equals(id).toArray(), [id]);
  const docCounts = useMemo(() => {
    const counts: DocCounts = {};
    for (const a of attachments ?? []) {
      if (!a.expenseId) continue;
      const c = (counts[a.expenseId] ??= { accounting: 0, payment: 0 });
      if (a.kind === 'accounting') c.accounting++;
      if (a.kind === 'payment') c.payment++;
    }
    return counts;
  }, [attachments]);
  const mapped = useMemo(() => (trip ? toInput(trip, attachments ? docCounts : undefined) : undefined), [trip, attachments, docCounts]);
  const result = useMemo(() => (mapped?.input ? calculate(mapped.input) : undefined), [mapped]);

  if (trip === undefined) return <p className="p-6 text-muted">Načítám…</p>;
  if (trip === null)
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">Cesta nenalezena</h1>
        <p className="text-muted">V tomto prohlížeči taková cesta není. Mohla být smazána, nebo byla založena v jiném prohlížeči či zařízení.</p>
        <LinkButton to="/">Na úvod</LinkButton>
      </main>
    );

  const ctx: TripCtx = { trip, update, mapped: mapped!, result, issues: [...mapped!.issues, ...(result?.issues ?? [])] };
  const index = Math.max(0, steps.findIndex((s) => s.slug === step));
  const current = steps[index]!;
  const prev = steps[index - 1];
  const next = steps[index + 1];
  const Page = StepPages[current.slug as StepSlug];
  const title = trip.purpose || 'Nová pracovní cesta';

  return (
    <TripContext.Provider value={ctx}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-white px-3 py-2 md:px-6">
          <div className="flex items-center gap-2">
            <Link to="/" aria-label="Na úvod" className="flex size-11 items-center justify-center rounded-lg text-ink hover:bg-ground">
              <Icon d={icons.back} />
            </Link>
            <div className="flex min-w-0 grow flex-col">
              <span className="truncate text-xs text-subtle">
                {trip.number || 'Bez čísla'} · <span aria-live="polite">{saved ? 'uloženo v prohlížeči' : 'ukládám…'}</span>
              </span>
              <strong className="truncate text-[17px]">{title}</strong>
            </div>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-danger hover:bg-danger-soft"
            >
              <Icon d={icons.trash} />
              <span className="hidden sm:inline">Smazat data cesty</span>
              <span className="sr-only sm:hidden">Smazat data cesty</span>
            </button>
          </div>
          <div className="md:hidden">
            <div className="mb-1 flex justify-between text-[13px] text-muted">
              <span>{current.title}</span>
              <span>
                Krok {index + 1} z {steps.length}
              </span>
            </div>
            <div className="h-1 rounded bg-line" aria-hidden="true">
              <div className="h-1 rounded bg-accent" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl grow gap-6 md:px-6 md:py-6">
          <nav aria-label="Kroky" className="hidden w-60 shrink-0 md:block">
            <ol className="sticky top-24 flex flex-col gap-0.5">
              {steps.map((s, i) => {
                const st = stepState(s.slug, trip, ctx.issues);
                const [label, cls] = stateLabel[st];
                const active = s.slug === current.slug;
                return (
                  <li key={s.slug}>
                    <Link
                      to={`/cesta/${trip.id}/${s.slug}`}
                      aria-current={active ? 'step' : undefined}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-[15px] no-underline hover:bg-line/60 ${active ? 'bg-accent-soft font-semibold text-ink' : 'text-ink'}`}
                    >
                      <span className="w-5 text-subtle">{i + 1}</span>
                      <span className="grow">{s.title}</span>
                      {label && <span className={`text-xs font-semibold ${cls}`}>{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <main className="flex min-w-0 grow flex-col gap-4 px-4 py-5 md:px-0 md:py-0">
            <h1 className="text-2xl font-bold">{current.title}</h1>
            <Page />
          </main>
        </div>

        <footer className="sticky bottom-0 flex gap-2 border-t border-line bg-white px-4 py-3 md:static md:mx-auto md:w-full md:max-w-6xl md:border-0 md:bg-transparent md:px-6 md:pl-[17.5rem]">
          {prev && (
            <LinkButton variant="secondary" to={`/cesta/${trip.id}/${prev.slug}`}>
              Zpět
            </LinkButton>
          )}
          {next && (
            <LinkButton to={`/cesta/${trip.id}/${next.slug}`} className="grow md:grow-0">
              Pokračovat: {next.title.toLowerCase()}
            </LinkButton>
          )}
        </footer>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Smazat všechna data této pracovní cesty?"
        confirmLabel="Smazat"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          pending.current = null;
          await deleteTrip(trip.id);
          navigate('/?smazano=1');
        }}
      >
        Smažou se údaje cesty, výdaje a výpočet uložené v tomto prohlížeči. Akci nelze vrátit. Soubory, které jste si už stáhli, zůstanou ve vašem zařízení.
      </ConfirmDialog>
    </TripContext.Provider>
  );
}
