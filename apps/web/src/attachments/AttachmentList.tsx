import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../storage/db.js';
import { Icon, icons, Notice } from '../ui/controls.js';
import { ImageEditor } from './ImageEditor.js';
import { documentKinds, kindLabels, subtypes, type Attachment, type AttachmentKind } from './model.js';
import { addFiles, deleteAttachment, getBlob, move, updateMeta } from './store.js';

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

const ACCEPT = 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif,application/pdf';
const kinds = documentKinds.map((k) => [k, kindLabels[k]] as const);

function Thumb({ a }: { a: Attachment }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let made: string | undefined;
    void getBlob(a.id, 'thumbnail').then((b) => {
      if (b) setUrl((made = URL.createObjectURL(b)));
    });
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
    // Náhled se po úpravě přegeneruje – sledujeme otočení a ořez.
  }, [a.id, a.rotation, a.crop]);
  return (
    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-ground">
      {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <Icon d={icons.doc} className="size-7 text-subtle" />}
    </div>
  );
}

async function openOriginal(a: Attachment) {
  const b = await getBlob(a.id, 'original');
  if (!b) return;
  const url = URL.createObjectURL(b);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Doklady k jednomu výdaji (nebo k celé cestě): focení, nahrání, typ, pořadí, úpravy, mazání. */
/** fixedKind = seznam jen jednoho druhu bez možnosti ho měnit (např. strany podepsaného skenu). */
export function AttachmentList({ tripId, expenseId, defaultKind, privatePayment, fixedKind }: { tripId: string; expenseId: string | null; defaultKind: AttachmentKind; privatePayment?: boolean; fixedKind?: AttachmentKind }) {
  const list = useLiveQuery(
    async () =>
      (await db.attachments.where('tripId').equals(tripId).toArray())
        .filter((a) => a.expenseId === expenseId && (fixedKind ? a.kind === fixedKind : (documentKinds as readonly string[]).includes(a.kind)))
        .sort((a, b) => a.order - b.order),
    [tripId, expenseId, fixedKind],
  );
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [editing, setEditing] = useState<Attachment | null>(null);

  const hasAccounting = list?.some((a) => a.kind === 'accounting');
  const hasPayment = list?.some((a) => a.kind === 'payment');

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    // První doklad je obvykle účetní, další u soukromé platby potvrzení o zaplacení.
    const kind: AttachmentKind = fixedKind ?? (expenseId === null ? 'supporting' : hasAccounting && privatePayment ? 'payment' : defaultKind);
    const r = await addFiles(tripId, expenseId, [...files], kind);
    setMessages([
      ...r.rejected.map((x) => `${x.name}: ${x.reason}`),
      ...r.duplicates.map((n) => `${n}: stejný soubor už u této cesty je. Zkontrolujte, že nejde o duplicitu.`),
      ...r.added.filter((a) => a.conversion === 'failed').map((a) => `${a.originalName}: soubor se nepodařilo převést (${a.conversionError}). Originál je uložen, do PDF se ale nevloží jako obrázek.`),
    ]);
    setBusy(false);
    if (camera.current) camera.current.value = '';
    if (picker.current) picker.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      {list && list.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Připojené doklady">
          {list.map((a, i) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-2.5">
              <div className="flex items-center gap-3">
                <Thumb a={a} />
                <div className="flex min-w-0 grow flex-col">
                  <span className="truncate text-sm font-semibold">{a.originalName}</span>
                  <span className="text-xs text-subtle">
                    {a.mime === 'application/pdf' ? `PDF, ${a.pages} ${a.pages === 1 ? 'strana' : a.pages < 5 ? 'strany' : 'stran'}` : 'Obrázek'} · {formatSize(a.size)}
                    {a.conversion === 'failed' && <strong className="text-danger"> · nepodařilo se převést</strong>}
                  </span>
                </div>
              </div>
              {(!fixedKind || subtypes[a.kind].length > 0) && <div className="grid gap-2 sm:grid-cols-2">
                {!fixedKind && <select aria-label="Typ dokladu" className="min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-white px-2 text-sm" value={a.kind} onChange={(e) => updateMeta(a.id, { kind: e.target.value as AttachmentKind, subtype: '' })}>
                  {kinds.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>}
                <select aria-label="Druh" className="min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-white px-2 text-sm" value={a.subtype} onChange={(e) => updateMeta(a.id, { subtype: e.target.value })}>
                  <option value="">Upřesnit (nepovinné)</option>
                  {subtypes[a.kind].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>}
              <div className="flex flex-wrap gap-1">
                {a.mime !== 'application/pdf' && a.conversion !== 'failed' && (
                  <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft" onClick={() => setEditing(a)}>
                    Otočit / oříznout
                  </button>
                )}
                <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft" onClick={() => openOriginal(a)}>
                  Zobrazit
                </button>
                <button type="button" aria-label={`Posunout ${a.originalName} výš`} disabled={i === 0} className="min-h-11 min-w-11 rounded-lg text-accent hover:bg-accent-soft disabled:opacity-30" onClick={() => move(a.id, -1)}>
                  <Icon d={icons.chevronUp} className="mx-auto size-5" />
                </button>
                <button type="button" aria-label={`Posunout ${a.originalName} níž`} disabled={i === list.length - 1} className="min-h-11 min-w-11 rounded-lg text-accent hover:bg-accent-soft disabled:opacity-30" onClick={() => move(a.id, 1)}>
                  <Icon d={icons.chevronDown} className="mx-auto size-5" />
                </button>
                <button type="button" className="ml-auto min-h-11 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger-soft" onClick={() => deleteAttachment(a.id)}>
                  Odebrat
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {messages.length > 0 && (
        <Notice tone="warn">
          <ul className="list-disc pl-4">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFiles(e.target.files)} />
        <input ref={picker} type="file" accept={ACCEPT} multiple className="sr-only" aria-label="Vybrat soubory dokladů" onChange={(e) => onFiles(e.target.files)} />
        <button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60" onClick={() => camera.current?.click()}>
          <Icon d="M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /> Vyfotit
        </button>
        <button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-white px-3 text-sm font-semibold hover:bg-ground disabled:opacity-60" onClick={() => picker.current?.click()}>
          <Icon d={icons.upload} /> Nahrát soubor
        </button>
        {busy && <span className="self-center text-sm text-muted" role="status">Zpracovávám…</span>}
      </div>
      {expenseId !== null && privatePayment && hasAccounting && !hasPayment && (
        <p className="text-[13px] text-subtle">
          U platby soukromou kartou přidejte potvrzení o zaplacení. Z výpisu stačí řádek s touto platbou – ostatní transakce oříznete tlačítkem „Otočit / oříznout“.
        </p>
      )}

      {editing && <ImageEditor attachment={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
