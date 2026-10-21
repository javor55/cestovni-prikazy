import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AttachmentList } from '../../attachments/AttachmentList.js';
import { checkSignature } from '../../attachments/signature.js';
import { addFiles, deleteAttachment, getBlob } from '../../attachments/store.js';
import { db } from '../../storage/db.js';
import { Card, Checkbox, H2, Icon, icons, Notice, RadioCards } from '../../ui/controls.js';
import { useTrip } from '../context.js';

export function StepPodpis() {
  const { trip, update } = useTrip();
  const latest = useLiveQuery(() => db.snapshots.where('tripId').equals(trip.id).filter((s) => s.part === 'full').reverse().sortBy('createdAt').then((l) => l[0] ?? null), [trip.id]);
  const sig = useLiveQuery(() => db.attachments.where('tripId').equals(trip.id).filter((a) => a.kind === 'signature').first(), [trip.id]);
  const scanCount = useLiveQuery(() => db.attachments.where('tripId').equals(trip.id).filter((a) => a.kind === 'signed').count(), [trip.id]) ?? 0;
  const [url, setUrl] = useState<string>();
  const [message, setMessage] = useState<{ tone: 'warn' | 'danger'; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const s = trip.signature;

  useEffect(() => {
    let made: string | undefined;
    if (sig) void getBlob(sig.id, 'original').then((b) => b && setUrl((made = URL.createObjectURL(b))));
    else setUrl(undefined);
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, [sig]);

  const upload = async (file?: File) => {
    if (!file) return;
    const check = await checkSignature(file);
    if (check.error) {
      setMessage({ tone: 'danger', text: check.error });
      return;
    }
    if (sig) await deleteAttachment(sig.id);
    // Podpis se zpracuje jen jako originál – náhled ani odvozená varianta nejsou potřeba.
    await addFiles(trip.id, null, [file], 'signature', async () => ({ thumbnail: new Blob(), pages: 1 }));
    setMessage(check.transparent ? null : { tone: 'warn', text: 'Obrázek nemá průhledné pozadí. V PDF bude podpis v bílém obdélníku – doporučujeme PNG s průhledným pozadím.' });
    if (input.current) input.current.value = '';
  };

  if (latest === undefined) return null;
  if (latest === null)
    return (
      <Notice tone="warn" title="Nejdřív vytvořte PDF cestovního příkazu a vyúčtování">
        Podepisuje se dokument z kroku <Link to={`/cesta/${trip.id}/pdf`} className="font-semibold text-accent underline">PDF k podpisu</Link> (celé vyúčtování).
      </Notice>
    );

  return (
    <>
      <RadioCards
        legend="Jak dokument podepíšete"
        value={s.mode}
        onChange={(mode) => update((d) => void (d.signature.mode = mode))}
        options={[
          { value: 'scan', title: 'Vytisknu, podepíšu a nahraji sken', hint: 'Vyfoťte nebo nahrajte všechny podepsané strany, případně jedno PDF ze skeneru.' },
          { value: 'image', title: 'Vložím obrázek podpisu', hint: 'PNG s podpisem se vloží do podpisových polí zaměstnance.' },
        ]}
      />

      {s.mode === 'scan' && (
        <Card>
          <H2>Podepsaný dokument</H2>
          <p className="text-[15px] text-muted">Strany seřaďte podle originálu. Fotky lze otočit a oříznout, chybnou stranu odeberte.</p>
          <AttachmentList tripId={trip.id} expenseId={null} defaultKind="signed" fixedKind="signed" />
          {scanCount > 0 && (
            <p className="flex items-center gap-2 text-sm font-semibold text-ok">
              <Icon d={icons.check} /> Nahráno souborů: {scanCount}
            </p>
          )}
        </Card>
      )}

      {s.mode === 'image' && (
        <Card>
          <H2>Obrázek podpisu</H2>
          <Notice tone="warn">
            Vložený obrázek podpisu představuje pouze vizuální podobu podpisu. Aplikace neověřuje totožnost podepisující osoby a nejde o kvalifikovaný elektronický podpis.
          </Notice>
          <div className="flex flex-col gap-1.5 rounded-xl border-2 border-dashed border-line-strong bg-white p-3" aria-label="Náhled podpisového pole">
            <span className="text-xs font-bold">Zaměstnanec</span>
            <div className="flex min-h-16 items-center justify-between gap-2">
              {url ? <img src={url} alt="Váš podpis" style={{ width: `${s.stamp ? s.widthPct * 0.6 : s.widthPct}%` }} className="max-h-16 object-contain" /> : <span className="text-sm text-subtle">bez obrázku</span>}
              {s.stamp && (
                <span className="rounded border border-ink px-1.5 py-0.5 text-[11px] leading-tight">
                  <strong>Podepsáno</strong>
                  <br />
                  {trip.employee.name || 'jméno'}
                  <br />
                  {new Date().toLocaleDateString('cs-CZ')}
                </span>
              )}
            </div>
            <span className="text-[11px] text-subtle">Datum a podpis</span>
          </div>
          <input ref={input} type="file" accept="image/png" className="sr-only" aria-label="Nahrát obrázek podpisu (PNG)" onChange={(e) => upload(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-white px-3 text-sm font-semibold hover:bg-ground" onClick={() => input.current?.click()}>
              <Icon d={icons.upload} /> {sig ? 'Nahrát jiný podpis' : 'Nahrát podpis (PNG)'}
            </button>
            {sig && (
              <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger-soft" onClick={() => deleteAttachment(sig.id)}>
                Odebrat podpis
              </button>
            )}
          </div>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Velikost podpisu ({s.widthPct} % šířky pole)
            <input type="range" min={30} max={100} step={5} value={s.widthPct} onChange={(e) => update((d) => void (d.signature.widthPct = Number(e.target.value)))} className="min-h-11 accent-accent" />
          </label>
          <Checkbox checked={s.stamp} onChange={(v) => update((d) => void (d.signature.stamp = v))}>
            Přidat razítko „Podepsáno“ se jménem a dnešním datem
          </Checkbox>
          <p className="text-[13px] text-subtle">Podpis se použije jen pro tuto cestu a smaže se spolu s ní.</p>
        </Card>
      )}
    </>
  );
}
