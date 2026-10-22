// Sestavení kompletní dokumentace v prohlížeči z uloženého snímku a příloh v IndexedDB.

import type { AssemblyFile, AssemblyParts, AssemblyStats } from '@cp/documents';
import type { DocModel } from '@cp/documents/model';
import type { Attachment } from '../attachments/model.js';
import { getBlob } from '../attachments/store.js';
import { db } from '../storage/db.js';
import type { TripDoc } from '../model/trip.js';
import { generatePdf, loadDocuments } from './generate.js';
import type { Snapshot } from './snapshot.js';

async function bytes(b: Blob) {
  return new Uint8Array(await b.arrayBuffer());
}

/** Soubor přílohy pro sestavení: u obrázků odvozená varianta (otočená, oříznutá, zmenšená), u PDF originál. */
async function toFile(a: Attachment): Promise<AssemblyFile> {
  const kind = a.kind === 'signature' ? 'supporting' : a.kind;
  if (a.conversion === 'failed') return { name: a.originalName, kind, type: 'jpeg', failed: a.conversionError ?? 'soubor nelze převést' };
  if (a.mime === 'application/pdf') {
    const b = await getBlob(a.id, 'original');
    return { name: a.originalName, kind, type: 'pdf', ...(b && { bytes: await bytes(b) }) };
  }
  const b = await getBlob(a.id, 'derived');
  return { name: a.originalName, kind, type: 'jpeg', ...(b && { bytes: await bytes(b) }) };
}

export async function signatureDataUrl(tripId: string): Promise<string | undefined> {
  const a = (await db.attachments.where('tripId').equals(tripId).toArray()).find((x) => x.kind === 'signature');
  const b = a && (await getBlob(a.id, 'original'));
  if (!b) return undefined;
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(new Blob([b], { type: 'image/png' }));
  });
}

/** Model dokumentu doplněný o vizuální podpis podle nastavení cesty (nebo beze změny, pokud podpis není). */
export async function withSignature(model: DocModel, trip: TripDoc, now: Date): Promise<DocModel | undefined> {
  if (trip.signature.mode !== 'image') return undefined;
  const image = await signatureDataUrl(trip.id);
  if (!image && !trip.signature.stamp) return undefined;
  return {
    ...model,
    signature: {
      ...(image && { image }),
      widthPct: trip.signature.widthPct,
      ...(trip.signature.stamp && { stamp: { name: model.employee.name, date: now.toLocaleDateString('cs-CZ') } }),
    },
  };
}

export async function buildComplete(trip: TripDoc, snapshot: Snapshot, now: Date, parts?: AssemblyParts): Promise<{ blob: Blob; stats: AssemblyStats }> {
  const { docs, fontUrls } = await loadDocuments();
  const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
  // Pro záhlaví a číslování stran (pdf-lib) jsou potřeba data písem, ne jen jejich adresy.
  const fonts = { regular: await fetchBytes(fontUrls.regular), bold: await fetchBytes(fontUrls.bold) };

  const all = (await db.attachments.where('tripId').equals(trip.id).toArray()).sort((a, b) => a.order - b.order);
  const scan = all.filter((a) => a.kind === 'signed');
  const model = snapshot.model;

  let signed: Parameters<typeof docs.assemble>[0]['signed'];
  if (trip.signature.mode === 'scan' && scan.length) {
    signed = { source: 'scan', files: await Promise.all(scan.map(toFile)) };
  } else {
    const signedModel = await withSignature(model, trip, now);
    const pdf = await generatePdf(signedModel ?? model, 'full');
    signed = { source: 'generated', pdf: await bytes(pdf), visualSignature: Boolean(signedModel) };
  }

  const expenses = await Promise.all(
    model.expenses.map(async (e) => ({
      n: e.n,
      files: await Promise.all(all.filter((a) => a.expenseId && a.expenseId === e.id && a.kind !== 'signed' && a.kind !== 'signature').map(toFile)),
    })),
  );
  const supporting = await Promise.all(all.filter((a) => a.expenseId === null && a.kind === 'supporting').map(toFile));
  const vehicle = trip.vehicle.used ? await Promise.all(all.filter((a) => a.kind === 'vehicle').map(toFile)) : [];

  const { bytes: out, stats } = await docs.assemble({
    model,
    ...(parts && { parts }),
    signed,
    expenses,
    supporting,
    vehicle,
    fonts,
    render: async (el) => bytes(await docs.renderPdfElement(el)),
  });
  return { blob: new Blob([out.slice().buffer as ArrayBuffer], { type: 'application/pdf' }), stats };
}

export function completeFileName(model: Pick<DocModel, 'number'>): string {
  const n = (model.number || 'CP').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '');
  return `${n}_Kompletni-dokumentace.pdf`;
}
