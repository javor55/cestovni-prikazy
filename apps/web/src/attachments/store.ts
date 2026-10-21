import { db, type AppDb } from '../storage/db.js';
import { safeName, sha256, sniff } from './detect.js';
import { MAX_FILE_BYTES, MAX_TRIP_BYTES, type Attachment, type AttachmentKind, type BlobVariant } from './model.js';
import { processAttachment, type Processed } from './render.js';

export interface AddResult {
  added: Attachment[];
  rejected: { name: string; reason: string }[];
  /** Soubory, které už u cesty jsou (stejný kontrolní součet). Přidají se, ale uživatel je upozorněn. */
  duplicates: string[];
}

const key = (id: string, v: BlobVariant) => `${id}:${v}`;

export async function getBlob(id: string, variant: BlobVariant, d: AppDb = db): Promise<Blob | undefined> {
  return (await d.blobs.get(key(id, variant)))?.blob;
}

async function storeProcessed(id: string, p: Processed, d: AppDb) {
  await d.blobs.put({ key: key(id, 'thumbnail'), attachmentId: id, variant: 'thumbnail', blob: p.thumbnail });
  if (p.derived) await d.blobs.put({ key: key(id, 'derived'), attachmentId: id, variant: 'derived', blob: p.derived });
}

/**
 * Přidá soubory k výdaji (nebo k cestě, je-li expenseId null). Formát se ověřuje podle obsahu,
 * originál se uloží beze změny a vedle něj odvozená varianta a náhled.
 */
export async function addFiles(
  tripId: string,
  expenseId: string | null,
  files: File[],
  kind: AttachmentKind,
  process = processAttachment,
  d: AppDb = db,
): Promise<AddResult> {
  const result: AddResult = { added: [], rejected: [], duplicates: [] };
  const existing = await d.attachments.where('tripId').equals(tripId).toArray();
  let total = existing.reduce((s, a) => s + a.size, 0);
  let order = Math.max(0, ...existing.filter((a) => a.expenseId === expenseId).map((a) => a.order)) + 1;

  for (const file of files) {
    const name = safeName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      result.rejected.push({ name, reason: `Soubor je větší než ${MAX_FILE_BYTES / 1024 / 1024} MB.` });
      continue;
    }
    if (total + file.size > MAX_TRIP_BYTES) {
      result.rejected.push({ name, reason: `Překročen limit ${MAX_TRIP_BYTES / 1024 / 1024} MB příloh na jednu cestu.` });
      continue;
    }
    const data = await file.arrayBuffer();
    const mime = sniff(new Uint8Array(data, 0, Math.min(16, data.byteLength)));
    if (!mime) {
      result.rejected.push({ name, reason: 'Nepodporovaný formát. Nahrajte PDF, JPG, PNG nebo HEIC.' });
      continue;
    }
    const hash = await sha256(data);
    if (existing.some((a) => a.sha256 === hash) || result.added.some((a) => a.sha256 === hash)) result.duplicates.push(name);

    const original = new Blob([data], { type: mime });
    const a: Attachment = {
      id: crypto.randomUUID(),
      tripId,
      expenseId,
      kind,
      subtype: '',
      originalName: name,
      mime,
      size: file.size,
      sha256: hash,
      order: order++,
      createdAt: new Date().toISOString(),
      rotation: 0,
      crop: null,
      conversion: 'done',
      pages: 1,
    };
    let processed: Processed | undefined;
    try {
      processed = await process(original, a);
      a.pages = processed.pages;
    } catch (e) {
      // Originál se uchová i tak; do PDF se pak vloží jen odkaz a uživatel je upozorněn.
      a.conversion = 'failed';
      a.conversionError = (e as Error).message || 'Soubor se nepodařilo zpracovat.';
    }
    await d.transaction('rw', d.attachments, d.blobs, async () => {
      await d.attachments.add(a);
      await d.blobs.put({ key: key(a.id, 'original'), attachmentId: a.id, variant: 'original', blob: original });
      if (processed) await storeProcessed(a.id, processed, d);
    });
    total += file.size;
    result.added.push(a);
  }
  return result;
}

/** Změní otočení nebo ořez a přepočítá odvozenou variantu z originálu. */
export async function editImage(id: string, patch: Pick<Attachment, 'rotation' | 'crop'>, process = processAttachment, d: AppDb = db): Promise<void> {
  const a = await d.attachments.get(id);
  const original = await getBlob(id, 'original', d);
  if (!a || !original) return;
  const next = { ...a, ...patch };
  try {
    const p = await process(original, next);
    await d.transaction('rw', d.attachments, d.blobs, async () => {
      await d.attachments.put({ ...next, conversion: 'done', conversionError: undefined as never, pages: p.pages });
      await storeProcessed(id, p, d);
    });
  } catch (e) {
    await d.attachments.put({ ...next, conversion: 'failed', conversionError: (e as Error).message });
  }
}

export async function updateMeta(id: string, patch: Partial<Pick<Attachment, 'kind' | 'subtype'>>, d: AppDb = db) {
  await d.attachments.update(id, patch);
}

export async function deleteAttachment(id: string, d: AppDb = db): Promise<void> {
  await d.transaction('rw', d.attachments, d.blobs, async () => {
    await d.blobs.where('attachmentId').equals(id).delete();
    await d.attachments.delete(id);
  });
}

/** Posune přílohu v pořadí v rámci výdaje (směr −1 nahoru, +1 dolů). */
export async function move(id: string, dir: -1 | 1, d: AppDb = db): Promise<void> {
  const a = await d.attachments.get(id);
  if (!a) return;
  const list = (await d.attachments.where('tripId').equals(a.tripId).toArray())
    .filter((x) => x.expenseId === a.expenseId)
    .sort((x, y) => x.order - y.order);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  const other = list[j]!;
  await d.transaction('rw', d.attachments, async () => {
    await d.attachments.update(a.id, { order: other.order });
    await d.attachments.update(other.id, { order: a.order });
  });
}

/** Při smazání výdaje se jeho přílohy smažou také. */
export async function deleteForExpense(tripId: string, expenseId: string, d: AppDb = db): Promise<void> {
  const ids = (await d.attachments.where('tripId').equals(tripId).toArray()).filter((a) => a.expenseId === expenseId).map((a) => a.id);
  await d.transaction('rw', d.attachments, d.blobs, async () => {
    await d.blobs.where('attachmentId').anyOf(ids).delete();
    await d.attachments.bulkDelete(ids);
  });
}
