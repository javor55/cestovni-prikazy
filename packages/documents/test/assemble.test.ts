import { renderToBuffer } from '@react-pdf/renderer';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFName } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ALL_PARTS, assemble, documentElement, registerFonts, type AssemblyInput } from '../src/index.js';
import { sample } from './sample.js';

const font = (f: string) => new URL(`../fonts/${f}`, import.meta.url).pathname;
const fixture = (f: string) => readFile(new URL(`./fixtures/${f}`, import.meta.url)).then((b) => new Uint8Array(b));
const render = async (el: Parameters<typeof renderToBuffer>[0]) => new Uint8Array(await renderToBuffer(el));

beforeAll(() => registerFonts({ regular: font('NotoSans-Regular.ttf'), bold: font('NotoSans-Bold.ttf'), serifBold: font('NotoSerif-Bold.ttf') }));

async function texts(bytes: Uint8Array): Promise<string[]> {
  const task = getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((x) => ('str' in x ? x.str : '')).join(' ').replace(/\s+/g, ' '));
  }
  await task.destroy();
  return out;
}

async function input(over: Partial<AssemblyInput> = {}): Promise<AssemblyInput> {
  const m = sample();
  m.expenses = [
    { ...m.expenses[0]!, n: '1' },
    { ...m.expenses[0]!, n: '2', category: 'Parkovné', supplier: 'Garáž' },
  ];
  const signedPdf = await render(documentElement(m, 'full') as Parameters<typeof renderToBuffer>[0]);
  const vypis = await render(documentElement(m, 'A') as Parameters<typeof renderToBuffer>[0]); // libovolné jednostránkové PDF
  return {
    model: m,
    signed: { source: 'generated', pdf: signedPdf, visualSignature: true },
    expenses: [
      {
        n: '1',
        files: [
          { name: 'faktura.jpg', kind: 'accounting', type: 'jpeg', bytes: await fixture('uctenka.jpg') },
          { name: 'vypis.pdf', kind: 'payment', type: 'pdf', bytes: vypis },
          { name: 'program-vydaje.jpg', kind: 'supporting', type: 'jpeg', bytes: await fixture('uctenka.jpg') },
        ],
      },
      { n: '2', files: [] },
    ],
    supporting: [{ name: 'program.jpg', kind: 'supporting', type: 'jpeg', bytes: await fixture('siroky.jpg') }],
    fonts: { regular: await readFile(font('NotoSans-Regular.ttf')), bold: await readFile(font('NotoSans-Bold.ttf')) },
    render: (el) => render(el as Parameters<typeof renderToBuffer>[0]),
    ...over,
  };
}

describe('kompletní dokumentace', () => {
  it('pořadí oddílů, identifikační stránky, číslování a záhlaví na každé straně', async () => {
    const { bytes, stats } = await assemble(await input());
    const p = await texts(bytes);
    expect(stats.pages).toBe(p.length);
    p.forEach((t, i) => expect(t).toContain(`strana ${i + 1} z ${p.length}`));
    p.forEach((t) => expect(t).toContain('CP-2026-0042 · Kompletní dokumentace'));

    // Každý oddíl se hledá až za předchozím (obsah na straně 2 zmiňuje všechny názvy).
    let from = -1;
    const next = (needle: string) => (from = p.findIndex((t, i) => i > from && t.includes(needle)));
    const order = [
      next('Kompletní dokumentace pracovní cesty'),
      next('Obsah a seznam příloh'),
      next('Část A · Cestovní příkaz'),
      next('Detailní přehled výpočtu'),
      next('Přehled výdajů'),
      next('Výdaj č. 1 · Ubytování Popis'),
      next('Výdaj č. 1 · Ubytování · Účetní doklad · faktura.jpg'),
      // Přílohy výdaje jsou hned za jeho účetním dokladem, před dalším výdajem.
      next('Výdaj č. 1 · Ubytování · Doklad o zaplacení · vypis.pdf'),
      next('Výdaj č. 1 · Ubytování · Doplňující dokument · program-vydaje.jpg'),
      next('Výdaj č. 2 · Parkovné Popis'),
      next('Doplňující dokument · program.jpg'),
    ];
    expect(order.every((x) => x >= 0)).toBe(true);
    // Obsah odkazuje na skutečnou stranu oddílu.
    expect(p[1]).toMatch(new RegExp(`Detailní přehled výpočtu ${order[3]! + 1}`));
    expect(p[order[9]!]).toContain('K výdaji není přiložen žádný doklad');

    // Krycí list uvádí souhrn a obsah odkazuje na skutečné strany.
    expect(p[0]).toContain(`Celkem stran: ${p.length}`);
    expect(p[0]).toContain('Výdaje bez přiloženého dokladu: 1');
    expect(p[0]).toContain('vložený obrázek podpisu');
    expect(stats).toMatchObject({ accountingDocs: 1, paymentDocs: 1, supportingDocs: 2, expensesWithoutDocs: 1, unsigned: false });
  });

  it('široký obrázek dostane stranu na šířku, záložky existují', async () => {
    const { bytes } = await assemble(await input());
    const doc = await PDFDocument.load(bytes);
    const sizes = doc.getPages().map((pg) => pg.getSize());
    expect(sizes.some((s) => s.width > s.height)).toBe(true);
    expect(doc.catalog.get(PDFName.of('Outlines'))).toBeDefined();
    expect(doc.getTitle()).toBe('CP-2026-0042 Kompletní dokumentace');
  });

  it('poškozený soubor nahradí zástupnou stránkou a upozorní', async () => {
    const inp = await input();
    inp.expenses[0]!.files.push({ name: 'rozbity.pdf', kind: 'accounting', type: 'pdf', bytes: new TextEncoder().encode('%PDF-1.7 nesmysl') });
    const { bytes, stats } = await assemble(inp);
    const p = (await texts(bytes)).join(' ');
    expect(p).toContain('Soubor nelze vložit');
    expect(stats.problems.join()).toContain('rozbity.pdf');
  });

  it('podepsaný sken ze stránek a varování u nepodepsaného dokumentu', async () => {
    const scan = await input({ signed: { source: 'scan', files: [{ name: 'strana1.jpg', kind: 'signed', type: 'jpeg', bytes: await fixture('uctenka.jpg') }] } });
    const r1 = await assemble(scan);
    expect((await texts(r1.bytes)).join(' ')).toContain('Podepsaný dokument – strana1.jpg');
    expect(r1.stats.unsigned).toBe(false);

    const none = await assemble(await input({ signed: { source: 'scan', files: [] } }));
    expect(none.stats.unsigned).toBe(true);
    expect((await texts(none.bytes))[0]).toContain('NEPODEPSÁNO');
  });

  it('doklady k vozidlu mají vlastní oddíl za výdaji a jejich doklady', async () => {
    const tp = { name: 'technicky-prukaz.jpg', kind: 'vehicle' as const, type: 'jpeg' as const, bytes: await fixture('uctenka.jpg') };
    const { bytes, stats } = await assemble(await input({ vehicle: [tp] }));
    const p = await texts(bytes);
    expect(stats.vehicleDocs).toBe(1);
    expect(p[0]).toContain('Doklady k vozidlu: 1');
    const pay = p.findIndex((t, i) => i > 1 && t.includes('Doklad o zaplacení · vypis.pdf'));
    const veh = p.findIndex((t, i) => i > 1 && t.includes('Doklad k vozidlu · technicky-prukaz.jpg'));
    const sup = p.findIndex((t, i) => i > 1 && t.includes('Doplňující dokument · program.jpg'));
    expect(pay).toBeGreaterThan(0);
    expect(veh).toBeGreaterThan(pay);
    expect(sup).toBeGreaterThan(veh);
  });

  it('jen vybrané části: podepsaný dokument a doklady k výdajům', async () => {
    const parts = { ...ALL_PARTS, cover: false, calculation: false, expenseOverview: false, expenseIdPages: false, expenseSupporting: false, vehicle: false, supporting: false };
    const { bytes, stats } = await assemble(await input({ parts }));
    const p = await texts(bytes);
    expect(p[0]).toContain('Část A · Cestovní příkaz');
    expect(p.join(' ')).not.toMatch(/Kompletní dokumentace pracovní cesty|Obsah a seznam příloh|Detailní přehled výpočtu|Přehled výdajů|K výdaji není přiložen|program/);
    const acc = p.findIndex((t) => t.includes('Výdaj č. 1 · Ubytování · Účetní doklad · faktura.jpg'));
    const pay = p.findIndex((t) => t.includes('Výdaj č. 1 · Ubytování · Doklad o zaplacení · vypis.pdf'));
    expect(acc).toBeGreaterThan(0);
    expect(pay).toBe(acc + 1);
    expect(p).toHaveLength(pay + 1);
    p.forEach((t, i) => expect(t).toContain(`strana ${i + 1} z ${p.length}`));
    expect(stats).toMatchObject({ accountingDocs: 1, paymentDocs: 1, supportingDocs: 0, pages: p.length });
    await expect(assemble(await input({ parts: Object.fromEntries(Object.keys(ALL_PARTS).map((k) => [k, false])) as unknown as typeof ALL_PARTS }))).rejects.toThrow('Vyberte alespoň jednu část');
  });

  it('velikost zůstane rozumná', async () => {
    const { stats } = await assemble(await input());
    expect(stats.size).toBeLessThan(1_500_000);
  });
});
