// Pracovní projekt (zadání § 7, návrh § 8): ZIP s project.json, manifest.json a originály příloh.
// Import nic neuloží, dokud celý balíček neprojde kontrolami; přílohy dostanou nová id a odvozené varianty
// se vytvoří znovu z originálů.

import { strFromU8, strToU8, unzipSync, zipSync, type UnzipFileInfo, type Zippable } from 'fflate';
import { sha256, sniff } from '../attachments/detect.js';
import { MAX_TRIP_BYTES, type Attachment } from '../attachments/model.js';
import { processAttachment, type Processed } from '../attachments/render.js';
import type { Snapshot } from '../documents/snapshot.js';
import { migrateTrip } from '../model/migrate.js';
import { newId, SCHEMA_VERSION, type TripDoc } from '../model/trip.js';
import { db, getTrip, type AppDb } from '../storage/db.js';
import { APP_VERSION } from '../version.js';
import { slug } from './names.js';
import { attachmentSchema, envelopeSchema, manifestSchema, parseSnapshot, parseTrip, PROJECT_FORMAT, PROJECT_VERSION, toAttachment } from './schema.js';

/** Limity importu: počet souborů a velikost po rozbalení (ochrana před „ZIP bombou“). */
export const MAX_IMPORT_FILES = 500;
export const MAX_IMPORT_BYTES = 500 * 1024 * 1024;
const MAX_JSON_BYTES = 20 * 1024 * 1024;

const EXT: Record<Attachment['mime'], string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic' };

export class ImportError extends Error {}

const hex = (data: Uint8Array) => sha256(data.slice().buffer as ArrayBuffer);

export const projectFileName = (trip: Pick<TripDoc, 'number'>) => `${slug(trip.number, 'CP')}_projekt.zip`;

async function loadTrip(tripId: string, d: AppDb) {
  const trip = await getTrip(tripId, d);
  if (!trip) throw new Error('Cesta nenalezena.');
  const attachments = (await d.attachments.where('tripId').equals(tripId).toArray()).sort((a, b) => a.order - b.order);
  return { trip, attachments };
}

/** Vytvoří ZIP pracovního projektu. Obrázky ani PDF nejsou v JSON, jen jako samostatné soubory. */
export async function exportProject(tripId: string, now = new Date(), d: AppDb = db): Promise<Uint8Array> {
  const { trip, attachments } = await loadTrip(tripId, d);
  const snapshots = await d.snapshots.where('tripId').equals(tripId).toArray();

  const files: Zippable = {};
  const manifest: { path: string; sha256: string; size: number }[] = [];
  const meta = [];
  for (const a of attachments) {
    const blob = (await d.blobs.get(`${a.id}:original`))?.blob;
    if (!blob) continue;
    const data = new Uint8Array(await blob.arrayBuffer());
    const path = `attachments/${a.id}.${EXT[a.mime]}`;
    // Obrázky a PDF jsou už komprimované – ukládají se bez další komprese.
    files[path] = [data, { level: 0 }];
    manifest.push({ path, sha256: await hex(data), size: data.byteLength });
    const { tripId: _t, conversion: _c, conversionError: _e, pages: _p, ...rest } = a;
    meta.push({ ...rest, file: path });
  }

  const project = strToU8(
    JSON.stringify(
      {
        format: PROJECT_FORMAT,
        projectVersion: PROJECT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        applicationVersion: APP_VERSION,
        exportedAt: now.toISOString(),
        trip,
        attachments: meta,
        snapshots: snapshots.map(({ tripId: _t, ...s }) => s),
      },
      null,
      2,
    ),
  );
  files['project.json'] = project;
  manifest.unshift({ path: 'project.json', sha256: await hex(project), size: project.byteLength });
  files['manifest.json'] = strToU8(JSON.stringify({ files: manifest }, null, 2));
  return zipSync(files, { level: 6, mtime: now });
}

function readJson(bytes: Uint8Array | undefined, name: string): unknown {
  if (!bytes) throw new ImportError(`V balíčku chybí soubor ${name}. Nejde o pracovní projekt této aplikace.`);
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new ImportError(`Soubor ${name} v balíčku je poškozený.`);
  }
}

export interface ImportResult {
  tripId: string;
  attachments: number;
  /** Soubory v ZIP, které nejsou v manifestu – nenačetly se. */
  ignored: number;
  /** Přílohy, které se nepodařilo převést pro PDF (originál je uložen). */
  failed: number;
}

/**
 * Načte pracovní projekt jako novou cestu. Kontroluje formát, verzi schématu, počet a velikost souborů,
 * kontrolní součty a skutečný formát příloh. Obsah souborů se nikdy nespouští, cesty ze ZIP se nepoužijí
 * jako cesty v počítači. Při jakékoli chybě vyhodí ImportError a nic neuloží.
 */
export async function importProject(file: Blob, now = new Date(), process: (b: Blob, a: Pick<Attachment, 'mime' | 'rotation' | 'crop'>) => Promise<Processed> = processAttachment, d: AppDb = db): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError(`Soubor je větší než ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
  const zip = new Uint8Array(await file.arrayBuffer());
  if (!(zip[0] === 0x50 && zip[1] === 0x4b)) throw new ImportError('Soubor není ZIP. Vyberte pracovní projekt (…_projekt.zip) stažený z této aplikace.');

  // Rozbalí se jen očekávané soubory a jen do povolené celkové velikosti.
  let count = 0;
  let total = 0;
  let ignored = 0;
  const wanted = (f: UnzipFileInfo) => {
    if (++count > MAX_IMPORT_FILES + 2) throw new ImportError(`Balíček obsahuje víc než ${MAX_IMPORT_FILES} souborů.`);
    const ok = f.name === 'project.json' || f.name === 'manifest.json' || /^attachments\/[\w-]{1,64}\.(pdf|jpg|png|heic)$/.test(f.name);
    if (!ok) {
      ignored++;
      return false;
    }
    const limit = f.name.endsWith('.json') ? MAX_JSON_BYTES : MAX_IMPORT_BYTES;
    total += f.originalSize;
    if (f.originalSize > limit || total > MAX_IMPORT_BYTES) throw new ImportError(`Obsah balíčku je po rozbalení větší než ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
    return true;
  };
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip, { filter: wanted });
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError('Soubor ZIP je poškozený nebo nepodporovaný.');
  }

  const manifest = manifestSchema.safeParse(readJson(entries['manifest.json'], 'manifest.json'));
  if (!manifest.success) throw new ImportError('Seznam souborů (manifest.json) má neplatný formát.');
  const listed = new Map(manifest.data.files.map((f) => [f.path, f]));

  // Kontrolní součty: každý soubor z manifestu musí v balíčku být a sedět; soubory mimo manifest se zahodí.
  for (const [path, f] of listed) {
    const data = entries[path];
    if (!data) throw new ImportError(`V balíčku chybí soubor ${path}.`);
    if (data.byteLength !== f.size || (await hex(data)) !== f.sha256) throw new ImportError(`Soubor ${path} je poškozený nebo byl změněn (nesouhlasí kontrolní součet).`);
  }
  for (const name of Object.keys(entries)) {
    if (name !== 'manifest.json' && !listed.has(name)) {
      delete entries[name];
      ignored++;
    }
  }

  const envelope = envelopeSchema.safeParse(readJson(entries['project.json'], 'project.json'));
  if (!envelope.success) throw new ImportError('Soubor project.json nemá formát pracovního projektu této aplikace.');
  const p = envelope.data;
  if (p.projectVersion > PROJECT_VERSION || p.schemaVersion > SCHEMA_VERSION)
    throw new ImportError(`Projekt pochází z novější verze aplikace (${p.applicationVersion}). Aktualizujte stránku a zkuste to znovu.`);

  let trip: TripDoc;
  try {
    trip = parseTrip(migrateTrip({ ...p.trip, schemaVersion: p.schemaVersion }));
  } catch {
    throw new ImportError('Údaje cesty v projektu jsou neúplné nebo poškozené.');
  }

  const metas = p.attachments.map((raw) => {
    const m = attachmentSchema.safeParse(raw);
    if (!m.success) throw new ImportError('Údaje o přílohách v projektu jsou poškozené.');
    return m.data;
  });
  const expenseIds = new Set(trip.expenses.map((e) => e.id));
  let bytes = 0;
  for (const m of metas) {
    const data = entries[m.file];
    if (!data || listed.get(m.file)?.sha256 !== m.sha256) throw new ImportError(`Příloha ${m.originalName} v balíčku chybí nebo nesouhlasí její kontrolní součet.`);
    if (sniff(data.subarray(0, 16)) !== m.mime) throw new ImportError(`Příloha ${m.originalName} nemá formát, který uvádí projekt.`);
    if (m.expenseId !== null && !expenseIds.has(m.expenseId)) throw new ImportError(`Příloha ${m.originalName} patří k výdaji, který v projektu není.`);
    if (m.kind === 'signature' && m.mime !== 'image/png') throw new ImportError('Obrázek podpisu musí být PNG.');
    bytes += data.byteLength;
  }
  if (bytes > MAX_TRIP_BYTES) throw new ImportError(`Přílohy projektu překračují limit ${MAX_TRIP_BYTES / 1024 / 1024} MB na jednu cestu.`);

  let snapshots: Omit<Snapshot, 'tripId'>[];
  try {
    snapshots = p.snapshots.map(parseSnapshot);
  } catch {
    throw new ImportError('Uložené snímky PDF v projektu jsou poškozené.');
  }

  // Vše je zkontrolované – připraví se nové záznamy (nová id, aby import nikdy nepřepsal existující cestu).
  const tripId = newId();
  const iso = now.toISOString();
  const imported: TripDoc = { ...trip, id: tripId, schemaVersion: SCHEMA_VERSION, lastOpenedAt: iso };
  const records: { a: Attachment; original: Blob; processed?: Processed }[] = [];
  let failed = 0;
  for (const m of metas) {
    const original = new Blob([entries[m.file]!.slice().buffer as ArrayBuffer], { type: m.mime });
    const a: Attachment = { ...toAttachment(m, tripId), id: newId(), conversion: 'done', pages: 1 };
    try {
      const processed = await process(original, a);
      a.pages = processed.pages;
      records.push({ a, original, processed });
    } catch (e) {
      a.conversion = 'failed';
      a.conversionError = (e as Error).message || 'Soubor se nepodařilo zpracovat.';
      failed++;
      records.push({ a, original });
    }
  }

  await d.transaction('rw', [d.trips, d.attachments, d.blobs, d.snapshots], async () => {
    await d.trips.add(imported);
    for (const { a, original, processed } of records) {
      await d.attachments.add(a);
      await d.blobs.put({ key: `${a.id}:original`, attachmentId: a.id, variant: 'original', blob: original });
      if (processed) {
        await d.blobs.put({ key: `${a.id}:thumbnail`, attachmentId: a.id, variant: 'thumbnail', blob: processed.thumbnail });
        if (processed.derived) await d.blobs.put({ key: `${a.id}:derived`, attachmentId: a.id, variant: 'derived', blob: processed.derived });
      }
    }
    for (const s of snapshots) await d.snapshots.add({ ...s, id: newId(), tripId });
  });
  return { tripId, attachments: records.length, ignored, failed };
}

/** ZIP s originály dokladů, roztříděnými do složek podle výdajů – pro účetní nebo archiv. */
export async function exportOriginals(tripId: string, now = new Date(), d: AppDb = db): Promise<{ bytes: Uint8Array; count: number }> {
  const { trip, attachments } = await loadTrip(tripId, d);
  const files: Zippable = {};
  const used = new Set<string>();
  const kindName = { accounting: 'ucetni-doklad', payment: 'doklad-o-zaplaceni', supporting: 'doplnujici', vehicle: 'doklad-k-vozidlu', signed: 'podepsany-dokument', signature: 'podpis' } as const;
  const counters = new Map<string, number>();
  for (const a of attachments) {
    const blob = (await d.blobs.get(`${a.id}:original`))?.blob;
    if (!blob) continue;
    const ei = a.expenseId ? trip.expenses.findIndex((e) => e.id === a.expenseId) : -1;
    const folder =
      ei >= 0
        ? `${String(ei + 1).padStart(2, '0')}_${slug(trip.expenses[ei]!.category, 'vydaj')}`
        : a.kind === 'signed' || a.kind === 'signature'
          ? 'podpis'
          : a.kind === 'vehicle'
            ? 'vozidlo'
            : 'doplnujici-dokumenty';
    const n = (counters.get(folder) ?? 0) + 1;
    counters.set(folder, n);
    const base = slug(a.originalName.replace(/\.[^.]+$/, ''));
    let path = `${folder}/${String(n).padStart(2, '0')}_${kindName[a.kind]}_${base}.${EXT[a.mime]}`;
    while (used.has(path)) path = path.replace(/(\.\w+)$/, '-1$1');
    used.add(path);
    files[path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  }
  const count = Object.keys(files).length;
  return { bytes: zipSync(files, { mtime: now }), count };
}
