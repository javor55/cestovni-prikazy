import type { DocPart, Layout } from '@cp/documents/model';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buildDocModel } from '../../documents/buildModel.js';
import { fileName, generatePdf } from '../../documents/generate.js';
import { inputHash, type Snapshot } from '../../documents/snapshot.js';
import { db } from '../../storage/db.js';
import { Button, Card, H2, Icon, icons, Notice, RadioCards } from '../../ui/controls.js';
import { useTrip } from '../context.js';

export function StepPdf() {
  const { trip, mapped, result, issues, docCounts, attachmentCount } = useTrip();
  const errors = issues.filter((i) => i.severity === 'error').length;
  const latest = useLiveQuery(() => db.snapshots.where('tripId').equals(trip.id).reverse().sortBy('createdAt').then((l) => l[0]), [trip.id]);
  const [layout, setLayout] = useState<Layout>('modern');
  const [part, setPart] = useState<DocPart>('full');
  const [hash, setHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<{ url: string; name: string; snapshot: Snapshot } | null>(null);

  useEffect(() => {
    void inputHash(trip, docCounts).then(setHash);
  }, [trip, docCounts]);
  useEffect(() => () => {
    if (file) URL.revokeObjectURL(file.url);
  }, [file]);

  const blockedFull = part === 'full' && (errors > 0 || !result);
  const stale = latest && hash && latest.inputHash !== hash;

  const show = async (snapshot: Snapshot) => {
    const blob = await generatePdf(snapshot.model, snapshot.layout, snapshot.part);
    setFile({ url: URL.createObjectURL(blob), name: fileName(snapshot.model, snapshot.part), snapshot });
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const now = new Date();
      const snapshot: Snapshot = {
        id: crypto.randomUUID(),
        tripId: trip.id,
        createdAt: now.toISOString(),
        layout,
        part,
        inputHash: hash || (await inputHash(trip, docCounts)),
        model: buildDocModel({ trip, mapped, result, docCounts, documentCount: attachmentCount, now }),
      };
      await db.snapshots.add(snapshot);
      await show(snapshot);
    } catch (e) {
      setError(`PDF se nepodařilo vytvořit: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {errors > 0 && (
        <Notice tone="danger" title={`Vyúčtování obsahuje chyby (${errors})`}>
          Opravte je v kroku <Link to={`/cesta/${trip.id}/kontrola`} className="font-semibold text-accent underline">Kontrola</Link>. Samotný cestovní příkaz (část A) k podpisu před cestou můžete vytvořit i tak.
        </Notice>
      )}

      <Card>
        <H2>Vytvořit PDF k podpisu</H2>
        <RadioCards
          legend="Obsah"
          value={part}
          onChange={setPart}
          options={[
            { value: 'full', title: 'Cestovní příkaz a vyúčtování', hint: 'Část A (příkaz) a část B (vyúčtování a žádost o vyplacení) – po návratu z cesty.' },
            { value: 'A', title: 'Jen cestovní příkaz', hint: 'K podpisu nadřízeným před cestou.' },
          ]}
        />
        <RadioCards
          legend="Vzhled"
          value={layout}
          onChange={setLayout}
          options={[
            { value: 'modern', title: 'Moderní (doporučeno)', hint: 'Částka k výplatě a souhrn nahoře, přehledné tabulky.' },
            { value: 'conservative', title: 'Konzervativní', hint: 'Číslované oddíly a mřížka jako na tradičním tiskopisu.' },
          ]}
        />
        <Button onClick={create} disabled={busy || blockedFull} className="self-start">
          {busy ? 'Vytvářím PDF…' : 'Vytvořit PDF'}
        </Button>
        {blockedFull && errors > 0 && <p className="text-[13px] text-danger">Celé vyúčtování lze vytvořit až po opravě chyb.</p>}
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </Card>

      {latest && !file && (
        <Card>
          <H2>Naposledy vytvořené PDF</H2>
          <p className="text-[15px] text-muted">
            {new Date(latest.createdAt).toLocaleString('cs-CZ')} · {latest.part === 'full' ? 'příkaz a vyúčtování' : 'jen příkaz'} · {latest.layout === 'modern' ? 'moderní' : 'konzervativní'}
          </p>
          {stale && <Notice tone="warn">Údaje cesty se od vytvoření tohoto PDF změnily. Pro odevzdání vytvořte PDF znovu.</Notice>}
          <Button variant="secondary" className="self-start" onClick={() => show(latest)}>
            Zobrazit znovu
          </Button>
        </Card>
      )}

      {file && (
        <Card aria-label="Vytvořené PDF">
          <H2>PDF je připravené</H2>
          {stale && <Notice tone="warn">Údaje cesty se od vytvoření tohoto PDF změnily. Pro odevzdání vytvořte PDF znovu.</Notice>}
          <div className="flex flex-wrap gap-2">
            <a href={file.url} download={file.name} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-white no-underline hover:bg-accent-dark">
              <Icon d="M12 3v12M7 10l5 5 5-5M4 19h16" /> Stáhnout PDF
            </a>
            <a href={file.url} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-xl border border-line-strong bg-white px-4 font-semibold text-ink no-underline hover:bg-ground">
              Otevřít v novém okně
            </a>
          </div>
          <p className="text-[13px] text-subtle">{file.name}</p>
          <iframe title="Náhled PDF" src={file.url} className="hidden h-[75vh] w-full rounded-lg border border-line md:block" />
          <Notice>
            Dokument vytiskněte a podepište. <strong>Stáhněte si také pracovní projekt</strong>, abyste se k cestě mohli vrátit i z jiného zařízení – tato funkce přibude v další verzi, zatím zůstává cesta uložená v tomto prohlížeči.
          </Notice>
        </Card>
      )}

      <p className="flex items-center gap-2 text-[13px] text-subtle">
        <Icon d={icons.lock} className="size-4" /> PDF se vytváří přímo v tomto zařízení, nic se neodesílá.
      </p>
    </>
  );
}
