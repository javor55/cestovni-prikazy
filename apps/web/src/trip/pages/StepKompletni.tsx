import type { AssemblyStats } from '@cp/documents';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buildComplete, completeFileName } from '../../documents/complete.js';
import { inputHash } from '../../documents/snapshot.js';
import { db } from '../../storage/db.js';
import { Button, Card, H2, Icon, Notice } from '../../ui/controls.js';
import { useTrip } from '../context.js';

const size = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} kB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

export function StepKompletni() {
  const { trip, docCounts } = useTrip();
  const latest = useLiveQuery(() => db.snapshots.where('tripId').equals(trip.id).filter((s) => s.part === 'full').reverse().sortBy('createdAt').then((l) => l[0] ?? null), [trip.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; name: string; stats: AssemblyStats } | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (latest) void inputHash(trip, docCounts).then((h) => setStale(h !== latest.inputHash));
  }, [latest, trip, docCounts]);
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  if (latest === undefined) return null;
  if (latest === null)
    return (
      <Notice tone="warn" title="Nejdřív vytvořte PDF cestovního příkazu a vyúčtování">
        Kompletní dokumentace vychází z dokumentu z kroku <Link to={`/cesta/${trip.id}/pdf`} className="font-semibold text-accent underline">PDF k podpisu</Link>.
      </Notice>
    );

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const { blob, stats } = await buildComplete(trip, latest, new Date());
      setResult({ url: URL.createObjectURL(blob), name: completeFileName(latest.model), stats });
    } catch (e) {
      setError(`Kompletní PDF se nepodařilo vytvořit: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {stale && <Notice tone="warn">Údaje cesty se od vytvoření PDF k podpisu změnily. Kompletní dokumentace použije stav z {new Date(latest.createdAt).toLocaleString('cs-CZ')} – pokud chcete aktuální údaje, vytvořte nejdřív nové PDF a znovu ho podepište.</Notice>}
      <Card>
        <H2>Kompletní dokumentace</H2>
        <p className="text-[15px] leading-relaxed text-muted">
          Jedno PDF pro účetní: krycí list, obsah a seznam příloh, podepsaný cestovní příkaz a vyúčtování, přehled výpočtu a výdajů, u každého výdaje identifikační stránka a hned za ní všechny jeho doklady (účetní doklad, doklad o zaplacení, doplňující dokumenty), doklady k vozidlu a doplňující přílohy k cestě.
        </p>
        <Button className="self-start" onClick={create} disabled={busy}>
          {busy ? 'Sestavuji PDF…' : result ? 'Sestavit znovu' : 'Sestavit kompletní PDF'}
        </Button>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </Card>

      {result && (
        <Card aria-label="Kompletní PDF">
          <H2>Před stažením zkontrolujte</H2>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ['Stran', String(result.stats.pages)],
              ['Účetních dokladů', String(result.stats.accountingDocs)],
              ['Dokladů o zaplacení', String(result.stats.paymentDocs)],
              ['Výdajů bez dokladu', String(result.stats.expensesWithoutDocs)],
              ['Doplňujících dokumentů', String(result.stats.supportingDocs)],
              ['Velikost', size(result.stats.size)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col rounded-xl border border-line bg-white p-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="text-lg font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          {result.stats.problems.length > 0 && (
            <Notice tone="warn" title="Upozornění">
              <ul className="list-disc pl-4">
                {result.stats.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Notice>
          )}
          <div className="flex flex-wrap gap-2">
            <a href={result.url} download={result.name} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-white no-underline hover:bg-accent-dark">
              <Icon d="M12 3v12M7 10l5 5 5-5M4 19h16" /> Stáhnout kompletní PDF
            </a>
            <a href={result.url} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-xl border border-line-strong bg-white px-4 font-semibold text-ink no-underline hover:bg-ground">
              Otevřít v novém okně
            </a>
          </div>
          <p className="text-[13px] text-subtle">{result.name}</p>
          <iframe title="Náhled kompletního PDF" src={result.url} className="hidden h-[75vh] w-full rounded-lg border border-line md:block" />
          <p className="text-[13px] text-subtle">
            Originály dokladů v ZIP, tabulky XLSX/CSV a pracovní projekt najdete v kroku{' '}
            <Link to={`/cesta/${trip.id}/export`} className="font-semibold text-accent underline">
              Exporty
            </Link>
            .
          </p>
        </Card>
      )}
    </>
  );
}
