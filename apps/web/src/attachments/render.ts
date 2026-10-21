// Zpracování obrázků a PDF v prohlížeči: převod HEIC, otočení podle EXIF i podle uživatele,
// ořez, zmenšení a náhled. Originál se nikdy nemění – vytváří se z něj odvozená varianta.

import type { Attachment, Crop } from './model.js';

/** Delší strana odvozeného obrázku pro PDF – zhruba 200 DPI na A4. */
const DERIVED_MAX = 2400;
const THUMB_MAX = 360;

async function decode(original: Blob, mime: Attachment['mime']): Promise<ImageBitmap> {
  let blob = original;
  if (mime === 'image/heic') {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: original, toType: 'image/jpeg', quality: 0.92 });
    blob = Array.isArray(out) ? out[0]! : out;
  }
  // imageOrientation 'from-image' otočí fotku podle EXIF (fotky z telefonu).
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}

function toBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Obrázek se nepodařilo uložit'))), type, quality));
}

/** Vykreslí obrázek otočený o `rotation` a oříznutý; výsledek se vejde do `maxSide`. */
export function drawImage(img: ImageBitmap | HTMLCanvasElement, rotation: number, crop: Crop | null, maxSide: number): HTMLCanvasElement {
  const swap = rotation === 90 || rotation === 270;
  const rw = swap ? img.height : img.width;
  const rh = swap ? img.width : img.height;
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const cw = Math.max(1, Math.round(c.w * rw));
  const ch = Math.max(1, Math.round(c.h * rh));
  const scale = Math.min(1, maxSide / Math.max(cw, ch));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cw * scale));
  canvas.height = Math.max(1, Math.round(ch * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // průhledné PNG na bílý podklad
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-c.x * rw, -c.y * rh);
  ctx.translate(rw / 2, rh / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas;
}

async function renderPdfPage1(original: Blob, maxSide: number): Promise<{ canvas: HTMLCanvasElement; pages: number }> {
  // Varianta „legacy“ obsahuje polyfilly pro starší prohlížeče (např. starší iOS Safari).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerSrc } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  // pdf.js skripty z PDF nespouští (scripting je ve výchozím stavu vypnutý); XFA formuláře nevykreslujeme.
  const task = pdfjs.getDocument({ data: new Uint8Array(await original.arrayBuffer()), enableXfa: false });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: maxSide / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return { canvas, pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

export interface Processed {
  /** Varianta pro vložení do PDF (u PDF se nevytváří – vkládají se přímo stránky originálu). */
  derived?: Blob;
  thumbnail: Blob;
  pages: number;
}

export async function processAttachment(original: Blob, a: Pick<Attachment, 'mime' | 'rotation' | 'crop'>): Promise<Processed> {
  if (a.mime === 'application/pdf') {
    const { canvas, pages } = await renderPdfPage1(original, THUMB_MAX);
    const thumb = drawImage(canvas, a.rotation, null, THUMB_MAX);
    return { thumbnail: await toBlob(thumb), pages };
  }
  const bitmap = await decode(original, a.mime);
  try {
    const derived = await toBlob(drawImage(bitmap, a.rotation, a.crop, DERIVED_MAX));
    const thumbnail = await toBlob(drawImage(bitmap, a.rotation, a.crop, THUMB_MAX), 'image/jpeg', 0.8);
    return { derived, thumbnail, pages: 1 };
  } finally {
    bitmap.close();
  }
}

/** Obrázek otočený, ale neoříznutý – podklad pro editor ořezu. */
export async function rotatedPreview(original: Blob, a: Pick<Attachment, 'mime' | 'rotation'>, maxSide = 1200): Promise<string> {
  const bitmap = await decode(original, a.mime);
  try {
    return URL.createObjectURL(await toBlob(drawImage(bitmap, a.rotation, null, maxSide)));
  } finally {
    bitmap.close();
  }
}
