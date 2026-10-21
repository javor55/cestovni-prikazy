import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { formatDateTime } from './model/format.js';
import { actualTimes } from './model/toInput.js';
import { newTrip, type TripDoc } from './model/trip.js';
import { deleteEverything, expiresAt, getRemembered, listTrips, purgeExpired, RETENTION_DAYS, saveTrip } from './storage/db.js';
import { ConfirmDialog } from './ui/ConfirmDialog.js';
import { Button, Icon, icons, Notice } from './ui/controls.js';

export function Home() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [trips, setTrips] = useState<TripDoc[] | null>(null);
  const [purged, setPurged] = useState(0);
  const [confirmAll, setConfirmAll] = useState(false);
  const deleted = params.get('smazano');

  useEffect(() => {
    void (async () => {
      setPurged(await purgeExpired(new Date()));
      setTrips(await listTrips());
      // Požádá prohlížeč, aby data nemazal při nedostatku místa (není-li podporováno, nic se neděje).
      void navigator.storage?.persist?.();
    })();
  }, []);

  const create = async () => {
    const t = newTrip(new Date(), await getRemembered());
    await saveTrip(t);
    navigate(`/cesta/${t.id}/kdo`);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2.5 border-b border-line bg-white px-5 py-4">
        <Icon d={icons.doc} className="size-7 text-accent" />
        <span className="text-[17px] font-bold">Cestovní příkazy</span>
      </header>

      <main className="mx-auto flex w-full max-w-2xl grow flex-col gap-6 px-5 py-6">
        {deleted && (
          <Notice title="Data cesty byla odstraněna">
            Údaje cesty byly z tohoto prohlížeče smazány.{' '}
            <button type="button" className="font-semibold text-accent underline" onClick={() => setParams({})}>
              Zavřít
            </button>
          </Notice>
        )}
        {purged > 0 && <Notice>Automaticky smazáno {purged} cest, které nikdo neotevřel déle než {RETENTION_DAYS} dní.</Notice>}

        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] leading-tight font-bold">Cestovní příkaz a vyúčtování cesty</h1>
          <p className="text-base leading-relaxed text-muted">
            Vyplňte pracovní cestu, nechte si spočítat stravné a náhrady podle zákoníku práce a připravte podklady pro účetní. Bez registrace.
          </p>
        </div>

        <section className="flex gap-3 rounded-xl border border-accent-line bg-accent-soft p-4" aria-labelledby="privacy-title">
          <Icon d={icons.lock} className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="flex flex-col gap-1 text-sm leading-relaxed">
            <strong id="privacy-title">Data zůstávají jen v tomto prohlížeči</strong>
            <span>
              Nic se neodesílá na server. Cesta se smaže po {RETENTION_DAYS} dnech, kdy ji nikdo neotevře. Na sdíleném počítači data po dokončení smažte.
            </span>
          </div>
        </section>

        <div className="flex flex-col gap-2.5">
          <Button onClick={create}>
            <Icon d={icons.plus} /> Nová pracovní cesta
          </Button>
          <Button variant="secondary" disabled title="Připravujeme" className="opacity-60">
            <Icon d={icons.upload} /> Načíst pracovní projekt (připravujeme)
          </Button>
        </div>

        {trips && trips.length > 0 && (
          <section className="flex flex-col gap-2.5" aria-labelledby="list-title">
            <h2 id="list-title" className="text-[13px] font-semibold tracking-wide text-subtle uppercase">
              Rozpracované v tomto prohlížeči
            </h2>
            {trips.map((t) => {
              const { start, end } = actualTimes(t);
              return (
                <Link key={t.id} to={`/cesta/${t.id}/kdo`} className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4 text-ink no-underline hover:border-accent-line">
                  <span className="flex justify-between gap-2">
                    <strong className="text-base">{t.purpose || 'Nová pracovní cesta'}</strong>
                    <span className="text-[13px] text-subtle">{t.number}</span>
                  </span>
                  <span className="text-sm text-muted">
                    {start ? `${formatDateTime(start)} – ${formatDateTime(end)}` : 'bez termínu'} · {t.kind === 'foreign' ? 'zahraniční' : 'tuzemská'} · {t.expenses.length} výdajů
                  </span>
                  <span className="text-xs text-subtle">Smaže se {expiresAt(t).toLocaleDateString('cs-CZ')}, pokud ji neotevřete</span>
                </Link>
              );
            })}
            <Button variant="danger" className="mt-2" onClick={() => setConfirmAll(true)}>
              <Icon d={icons.trash} /> Smazat všechna data aplikace v tomto prohlížeči
            </Button>
          </section>
        )}
      </main>

      <footer className="border-t border-line bg-white px-5 py-4 text-center text-[13px] text-subtle">
        Výpočet podle zákoníku práce a vyhlášek pro rok 2026. Výsledek zkontroluje účetní.
      </footer>

      <ConfirmDialog
        open={confirmAll}
        title="Smazat všechna data aplikace?"
        confirmLabel="Smazat vše"
        onCancel={() => setConfirmAll(false)}
        onConfirm={async () => {
          await deleteEverything();
          setConfirmAll(false);
          setTrips([]);
          setParams({ smazano: '1' });
        }}
      >
        Smažou se všechny cesty a zapamatované údaje uložené v tomto prohlížeči. Akci nelze vrátit.
      </ConfirmDialog>
    </div>
  );
}
