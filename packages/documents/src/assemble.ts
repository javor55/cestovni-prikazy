// Sestavení kompletní dokumentace (zadání § 19): krycí list, obsah, podepsaný dokument, přehled výdajů,
// identifikační stránky výdajů a doklady. Doklady se vkládají zmenšené do stránky A4 s okrajem,
// aby se na každou stranu vešlo záhlaví a průběžné číslování. Originální soubory se nemění.

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFHexString, PDFName, rgb, type PDFEmbeddedPage, type PDFFont, type PDFPage } from 'pdf-lib';
import { createElement, type ReactElement } from 'react';
import { CoverAndToc, ExpenseIdPages, ExpenseOverview, type CoverInfo, type IdPageFile, type TocEntry } from './Appendix.js';
import type { DocModel } from './model.js';

export type FileKind = 'accounting' | 'payment' | 'supporting' | 'vehicle' | 'signed';

export interface AssemblyFile {
  name: string;
  kind: FileKind;
  /** Obrázky se předávají jako odvozená varianta (JPEG/PNG), PDF jako originál. */
  type: 'pdf' | 'jpeg' | 'png';
  bytes?: Uint8Array;
  /** Soubor se nepodařilo převést – vloží se zástupná stránka. */
  failed?: string;
}

/** Části kompletní dokumentace, které má PDF obsahovat (výchozí: všechny). */
export interface AssemblyParts {
  /** Krycí list a obsah se seznamem příloh. */
  cover: boolean;
  signed: boolean;
  expenseOverview: boolean;
  /** Identifikační stránka před doklady každého výdaje. */
  expenseIdPages: boolean;
  accounting: boolean;
  payment: boolean;
  /** Doplňující dokumenty u výdajů. */
  expenseSupporting: boolean;
  vehicle: boolean;
  /** Doplňující přílohy k celé cestě. */
  supporting: boolean;
}

export const ALL_PARTS: AssemblyParts = {
  cover: true,
  signed: true,
  expenseOverview: true,
  expenseIdPages: true,
  accounting: true,
  payment: true,
  expenseSupporting: true,
  vehicle: true,
  supporting: true,
};

export interface AssemblyInput {
  model: DocModel;
  /** Které části dokument obsahuje; chybí-li, všechny. */
  parts?: AssemblyParts;
  /** Podepsaný dokument: sken (stránky/soubory v daném pořadí), nebo vygenerované PDF. */
  signed: { source: 'scan'; files: AssemblyFile[] } | { source: 'generated'; pdf: Uint8Array; visualSignature: boolean };
  /** Výdaje v pořadí; `n` odpovídá číslu výdaje v modelu. */
  expenses: { n: string; files: AssemblyFile[] }[];
  /** Doplňující dokumenty k celé cestě. */
  supporting: AssemblyFile[];
  /** Doklady k soukromému vozidlu (technický průkaz, výpis z registru, smlouva o výpůjčce). */
  vehicle?: AssemblyFile[];
  fonts: { regular: Uint8Array; bold: Uint8Array };
  /** Vyrenderuje prvek @react-pdf na PDF (v prohlížeči přes pdf().toBlob(), v Node přes renderToBuffer). */
  render: (element: ReactElement) => Promise<Uint8Array>;
}

export interface AssemblyStats {
  pages: number;
  accountingDocs: number;
  paymentDocs: number;
  supportingDocs: number;
  vehicleDocs: number;
  expensesWithoutDocs: number;
  size: number;
  unsigned: boolean;
  problems: string[];
}

const A4: [number, number] = [595.28, 841.89];
const kindLabel: Record<FileKind, string> = {
  accounting: 'Účetní doklad',
  payment: 'Doklad o zaplacení',
  supporting: 'Doplňující dokument',
  vehicle: 'Doklad k vozidlu',
  signed: 'Podepsaný dokument',
};

/** Jedna stránka výsledku – buď převzatá z vlastního PDF, nebo vložený doklad. */
type Source =
  | { type: 'own'; doc: PDFDocument; index: number }
  | { type: 'pdf'; page: PDFEmbeddedPage; label: string }
  | { type: 'image'; file: AssemblyFile; label: string }
  | { type: 'placeholder'; label: string; reason: string };

async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  const d = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return d.getPageCount();
}

export async function assemble(input: AssemblyInput): Promise<{ bytes: Uint8Array; stats: AssemblyStats }> {
  const { model: m } = input;
  const parts = input.parts ?? ALL_PARTS;
  const kindOn: Record<Exclude<FileKind, 'signed' | 'vehicle'>, boolean> = { accounting: parts.accounting, payment: parts.payment, supporting: parts.expenseSupporting };
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  // Celé písmo: podmnožina (subset) z @pdf-lib/fontkit u Noto Sans vykresluje rozsypané znaky.
  const font = await out.embedFont(input.fonts.regular);
  const bold = await out.embedFont(input.fonts.bold);
  const problems: string[] = [];

  // Soubory dokladů → zdroje stránek (PDF se vkládají jako stránky, obrázky jako stránky s obrázkem).
  const fileSources = async (f: AssemblyFile, label: string): Promise<Source[]> => {
    if (f.failed || !f.bytes) {
      problems.push(`${f.name}: soubor nelze vložit (${f.failed ?? 'chybí data'}).`);
      return [{ type: 'placeholder', label, reason: f.failed ?? 'Soubor není k dispozici.' }];
    }
    if (f.type !== 'pdf') return [{ type: 'image', file: f, label }];
    try {
      const src = await PDFDocument.load(f.bytes, { updateMetadata: false });
      const pages = await out.embedPages(src.getPages());
      return pages.map((page, i) => ({ type: 'pdf', page, label: pages.length > 1 ? `${label} (str. ${i + 1}/${pages.length})` : label }));
    } catch {
      problems.push(`${f.name}: PDF je zašifrované nebo poškozené, nelze ho vložit. Originál přiložte zvlášť.`);
      return [{ type: 'placeholder', label, reason: 'PDF je zašifrované nebo poškozené – originál je potřeba odevzdat zvlášť.' }];
    }
  };
  const ownPages = async (el: ReactElement) => {
    const doc = await PDFDocument.load(await input.render(el));
    return doc.getPageIndices().map((index): Source => ({ type: 'own', doc, index }));
  };

  // 3. Podepsaný dokument
  let signed: Source[] = [];
  let signature: string;
  if (input.signed.source === 'scan' && input.signed.files.length) {
    if (parts.signed) for (const [i, f] of input.signed.files.entries()) signed.push(...(await fileSources(f, `Podepsaný dokument – ${f.name} (${i + 1}/${input.signed.files.length})`)));
    signature = 'podepsaný dokument nahrán jako sken';
  } else if (input.signed.source === 'generated') {
    const doc = await PDFDocument.load(input.signed.pdf);
    signed = doc.getPageIndices().map((index) => ({ type: 'own', doc, index }));
    signature = input.signed.visualSignature ? 'vložený obrázek podpisu (nejde o elektronický podpis)' : 'NEPODEPSÁNO – dokument je potřeba vytisknout a podepsat';
  } else {
    signature = 'NEPODEPSÁNO';
  }
  const unsigned = signature.startsWith('NEPODEPSÁNO');
  if (unsigned && parts.signed) problems.push('Cestovní příkaz a vyúčtování nejsou podepsané.');
  if (!parts.signed) signed = [];

  // 4.–5. Přehledy a identifikační stránky
  const overview = parts.expenseOverview ? await ownPages(createElement(ExpenseOverview, { m })) : [];
  const idFiles: Record<string, IdPageFile[]> = {};
  const expenseSources: { n: string; accounting: Source[]; payment: Source[]; supporting: Source[] }[] = [];
  for (const e of input.expenses) {
    const exp = m.expenses.find((x) => x.n === e.n);
    const title = `Výdaj č. ${e.n}${exp ? ` · ${exp.category}` : ''}`;
    const group = { n: e.n, accounting: [] as Source[], payment: [] as Source[], supporting: [] as Source[] };
    idFiles[e.n] = [];
    for (const f of e.files) {
      if (f.kind === 'signed' || f.kind === 'vehicle' || !kindOn[f.kind]) continue;
      const src = await fileSources(f, `${title} · ${kindLabel[f.kind]} · ${f.name}`);
      group[f.kind].push(...src);
      idFiles[e.n]!.push({ kind: kindLabel[f.kind], name: f.name, pages: src.length });
    }
    expenseSources.push(group);
  }
  const idPages = m.expenses.length && parts.expenseIdPages ? await ownPages(createElement(ExpenseIdPages, { m, files: idFiles })) : [];
  const supporting: Source[] = [];
  if (parts.supporting) for (const f of input.supporting) supporting.push(...(await fileSources(f, `${kindLabel.supporting} · ${f.name}`)));
  const vehicle: Source[] = [];
  if (parts.vehicle) for (const f of input.vehicle ?? []) vehicle.push(...(await fileSources(f, `${kindLabel.vehicle} · ${f.name}`)));

  // Pořadí těla dokumentu a položky obsahu (čísla stran zatím relativně od začátku těla).
  const body: Source[] = [];
  const toc: (TocEntry & { rel: number })[] = [];
  const section = (title: string, pages: Source[], level: TocEntry['level'] = 0) => {
    if (!pages.length) return;
    toc.push({ title, page: 0, level, rel: body.length });
    body.push(...pages);
  };
  section('Podepsaný cestovní příkaz a žádost o vyplacení', signed);
  section('Přehled výdajů', overview);
  // Každý výdaj pohromadě: identifikační stránka a za ní všechny jeho přílohy
  // (účetní doklad, doklad o zaplacení, doplňující dokumenty).
  const groups = expenseSources.map((g, i) => ({ g, pages: [...(idPages[i] ? [idPages[i]] : []), ...g.accounting, ...g.payment, ...g.supporting] })).filter((x) => x.pages.length);
  if (groups.length) toc.push({ title: 'Výdaje a jejich doklady', page: 0, level: 0, rel: body.length });
  for (const { g, pages } of groups) {
    toc.push({ title: `Výdaj č. ${g.n}${g.accounting.length || !parts.accounting ? '' : ' – bez účetního dokladu'}`, page: 0, level: 1, rel: body.length });
    body.push(...pages);
  }
  section('Doklady k vozidlu', vehicle);
  section('Doplňující přílohy', supporting);

  const count = (k: Exclude<FileKind, 'signed' | 'vehicle'>) => (kindOn[k] ? input.expenses.reduce((s, e) => s + e.files.filter((f) => f.kind === k).length, 0) : 0);
  const info = (totalPages: number): CoverInfo => ({
    totalPages,
    signature,
    accountingDocs: count('accounting'),
    paymentDocs: count('payment'),
    supportingDocs: count('supporting') + (parts.supporting ? input.supporting.length : 0),
    vehicleDocs: parts.vehicle ? (input.vehicle?.length ?? 0) : 0,
    expensesWithoutDocs: input.expenses.filter((e) => !e.files.some((f) => f.kind === 'accounting')).length,
    problems,
  });

  if (!body.length && !parts.cover) throw new Error('Vyberte alespoň jednu část dokumentu.');
  // Krycí list a obsah: počet jejich stran ovlivňuje čísla v obsahu, proto se počítá iterativně.
  let front = parts.cover ? 2 : 0;
  let frontDoc: PDFDocument | undefined;
  for (let attempt = 0; parts.cover && attempt < 4; attempt++) {
    const entries = toc.map(({ rel, ...e }) => ({ ...e, page: front + rel + 1 }));
    frontDoc = await PDFDocument.load(await input.render(createElement(CoverAndToc, { m, toc: entries, info: info(front + body.length) })));
    if (frontDoc.getPageCount() === front) break;
    front = frontDoc.getPageCount();
  }
  const all: Source[] = [...(frontDoc ? frontDoc.getPageIndices().map((index): Source => ({ type: 'own', doc: frontDoc, index })) : []), ...body];

  // Vložení stránek
  const labels: string[] = [];
  for (const src of all) {
    if (src.type === 'own') {
      const [p] = await out.copyPages(src.doc, [src.index]);
      out.addPage(p!);
      labels.push('');
    } else if (src.type === 'pdf') {
      const landscape = src.page.width > src.page.height;
      const page = out.addPage(landscape ? [A4[1], A4[0]] : A4);
      fit(page, src.page.width, src.page.height, (x, y, w, h) => page.drawPage(src.page, { x, y, width: w, height: h }));
      labels.push(src.label);
    } else if (src.type === 'image') {
      const img = src.file.type === 'png' ? await out.embedPng(src.file.bytes!) : await out.embedJpg(src.file.bytes!);
      const landscape = img.width > img.height * 1.15;
      const page = out.addPage(landscape ? [A4[1], A4[0]] : A4);
      fit(page, img.width, img.height, (x, y, w, h) => page.drawImage(img, { x, y, width: w, height: h }));
      labels.push(src.label);
    } else {
      const page = out.addPage(A4);
      page.drawText('Soubor nelze vložit', { x: 50, y: 760, size: 16, font: bold });
      page.drawText(src.reason, { x: 50, y: 735, size: 10, font, maxWidth: 495, lineHeight: 13 });
      labels.push(src.label);
    }
  }

  // Záhlaví u dokladů a průběžné číslování na každé straně
  const total = out.getPageCount();
  out.getPages().forEach((page, i) => {
    stamp(page, font, `${m.number} · Kompletní dokumentace`, `strana ${i + 1} z ${total}`);
    if (labels[i]) header(page, font, labels[i]!);
  });

  // Záložky
  const marks = [...(parts.cover ? [{ title: 'Krycí list a obsah', page: 0 }] : []), ...toc.map((e) => ({ title: e.level ? `  ${e.title}` : e.title, page: front + e.rel }))];
  addOutline(out, marks);

  out.setTitle(`${m.number} Kompletní dokumentace`);
  out.setAuthor(m.employee.name);
  out.setLanguage('cs');
  out.setCreator('Cestovní příkazy');
  out.setProducer('Cestovní příkazy');
  const bytes = await out.save({ useObjectStreams: true });
  return { bytes, stats: { ...info(total), pages: total, size: bytes.byteLength, unsigned, problems } };
}

/** Vloží obsah se zachováním poměru stran mezi záhlaví (32 pt) a zápatí (30 pt). */
function fit(page: PDFPage, w: number, h: number, draw: (x: number, y: number, w: number, h: number) => void) {
  const { width: pw, height: ph } = page.getSize();
  const box = { x: 24, y: 30, w: pw - 48, h: ph - 30 - 34 };
  const scale = Math.min(box.w / w, box.h / h, 1.5);
  const dw = w * scale;
  const dh = h * scale;
  draw(box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
}

function stamp(page: PDFPage, font: PDFFont, left: string, right: string) {
  const { width } = page.getSize();
  const size = 6.5;
  page.drawText(left, { x: 24, y: 10, size, font, color: rgb(0.25, 0.25, 0.25) });
  page.drawText(right, { x: width - 24 - font.widthOfTextAtSize(right, size), y: 10, size, font, color: rgb(0.25, 0.25, 0.25) });
}

function header(page: PDFPage, font: PDFFont, text: string) {
  const { width, height } = page.getSize();
  const size = 7.5;
  let t = text;
  while (font.widthOfTextAtSize(t, size) > width - 48 && t.length > 10) t = `${t.slice(0, -2)}…`;
  page.drawRectangle({ x: 20, y: height - 26, width: width - 40, height: 16, color: rgb(1, 1, 1), opacity: 0.9 });
  page.drawText(t, { x: 24, y: height - 21, size, font, color: rgb(0.1, 0.1, 0.1) });
  page.drawLine({ start: { x: 24, y: height - 28 }, end: { x: width - 24, y: height - 28 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
}

/** Jednoúrovňové záložky (osnova) PDF. pdf-lib nemá vlastní API, proto přes nízkoúrovňové objekty. */
function addOutline(doc: PDFDocument, items: { title: string; page: number }[]) {
  if (!items.length) return;
  const ctx = doc.context;
  const root = ctx.nextRef();
  const refs = items.map(() => ctx.nextRef());
  const pages = doc.getPages();
  items.forEach((it, i) => {
    const dict = ctx.obj({
      Title: PDFHexString.fromText(it.title),
      Parent: root,
      Dest: [pages[Math.min(it.page, pages.length - 1)]!.ref, PDFName.of('Fit')],
      ...(i > 0 && { Prev: refs[i - 1]! }),
      ...(i < items.length - 1 && { Next: refs[i + 1]! }),
    });
    ctx.assign(refs[i]!, dict);
  });
  ctx.assign(root, ctx.obj({ Type: 'Outlines', First: refs[0]!, Last: refs.at(-1)!, Count: items.length }));
  doc.catalog.set(PDFName.of('Outlines'), root);
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

export { pdfPageCount };
