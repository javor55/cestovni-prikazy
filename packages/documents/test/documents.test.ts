import { renderToBuffer } from '@react-pdf/renderer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { documentElement, fileName, registerFonts, type DocModel, type DocPart } from '../src/index.js';
import { sample } from './sample.js';

const font = (f: string) => new URL(`../fonts/${f}`, import.meta.url).pathname;

beforeAll(() => registerFonts({ regular: font('NotoSans-Regular.ttf'), bold: font('NotoSans-Bold.ttf'), serifBold: font('NotoSerif-Bold.ttf') }));

/** Vyrenderuje PDF a vrátí text jednotlivých stran. */
async function pages(m: DocModel, part: DocPart): Promise<string[]> {
  const buf = await renderToBuffer(documentElement(m, part) as Parameters<typeof renderToBuffer>[0]);
  expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  const task = getDocument({ data: new Uint8Array(buf), useSystemFonts: false });
  const doc = await task.promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((x) => ('str' in x ? x.str : '')).join(' ').replace(/\s+/g, ' '));
  }
  await task.destroy();
  return out;
}

describe('dokument k podpisu', () => {
  it('celý dokument: části A i B, číslo příkazu a číslování na každé straně', async () => {
    const p = await pages(sample(), 'full');
    expect(p.length).toBeGreaterThanOrEqual(2);
    p.forEach((text, i) => {
      expect(text).toContain('CP-2026-0042');
      expect(text).toMatch(new RegExp(`strana ${i + 1}/${p.length}`));
    });
    const all = p.join(' ');
    expect(all).toMatch(/cestovní příkaz/i);
    expect(all).toMatch(/vyúčtování pracovní cesty/i);
    expect(all).toContain('Jana Ukázková');
    expect(all).toContain('Účel');
    expect(all).toContain('10 672,00 Kč');
    expect(all).toContain('24,422');
    expect(all).toContain('CZ-2026 v1.0.0');
  });

  it('číslo účtu pro výplatu je ve vyúčtování; bez něj je tam řádek k doplnění', async () => {
    const m = sample();
    expect((await pages(m, 'full')).join(' ')).toContain('Číslo účtu pro výplatu: ……');
    m.employee.bankAccount = '123456789/0800';
    expect((await pages(m, 'full')).join(' ')).toContain('Číslo účtu zaměstnance pro výplatu: 123456789/0800');
  });

  it('jen část A má jednu stranu bez vyúčtování', async () => {
    const p = await pages(sample(), 'A');
    expect(p).toHaveLength(1);
    expect(p[0]).not.toMatch(/vyúčtování pracovní cesty/i);
  });

  it('dlouhé texty, cizí znaky a mnoho úseků se zalomí na více stran a číslování sedí', async () => {
    const m = sample();
    m.trip.purpose = 'Jednání ' + 'o dlouhodobé spolupráci a technických podmínkách dodávky '.repeat(12);
    m.employee.name = 'Žofie Šťastná-Øster Großmann';
    m.segments = Array.from({ length: 40 }, (_, i) => ({ ...m.segments[0]!, n: String(i + 1), to: i % 2 ? 'Łódź (PL)' : 'Győr (HU)' }));
    const p = await pages(m, 'full');
    expect(p.length).toBeGreaterThanOrEqual(3);
    expect(p.join(' ')).toContain('Žofie Šťastná-Øster Großmann');
    expect(p.join(' ')).toContain('Łódź');
    expect(p.join(' ')).toContain('Győr');
    p.forEach((text) => expect(text).toContain('CP-2026-0042'));
  });

  it('tuzemská cesta bez vozidla a výdajů', async () => {
    const m = sample();
    m.trip.kind = 'Tuzemská';
    m.perDiem = {
      days: [{ date: 'út 10. 3. 2026', domesticTime: '8 h 30 min', foreignTime: '0 h', domestic: '5–12 h: 155,00 Kč − 1 × 70 %', domesticAmount: '47,00 Kč', country: '', tier: '', base: '', tierAmount: '', meals: 'O', reduction: '', amount: '', pocketMoney: '' }],
      domesticTotal: '47,00 Kč',
      foreignTotal: '',
      reductionTotal: '',
      note: '',
      hasForeign: false,
    };
    m.expenses = [];
    delete m.vehicle;
    const all = (await pages(m, 'full')).join(' ');
    expect(all).toContain('47,00 Kč');
    expect(all).not.toContain('Soukromé vozidlo ·');
  });
});

describe('dokument v angličtině', () => {
  it('pevné popisky jsou anglicky, údaje z modelu zůstávají', async () => {
    const m = { ...sample(), lang: 'en' as const };
    m.employee = { ...m.employee, bankAccount: '123456789/0800' };
    const all = (await pages(m, 'full')).join(' ');
    expect(all).toContain('Travel order');
    expect(all).toContain('Business trip expense claim');
    expect(all).toContain('Meal allowance by day');
    expect(all).toContain("Employee's bank account for payment: 123456789/0800");
    expect(all).toContain('Approved by – supervisor');
    expect(all).toMatch(/page 1\/\d/);
    expect(all).not.toMatch(/Cestovní příkaz|Vyúčtování pracovní cesty|Stravné po dnech|strana \d/);
  });
});

describe('název souboru', () => {
  it('podle zadání a bez nebezpečných znaků', () => {
    expect(fileName({ number: 'CP-2026-0042' }, 'full')).toBe('CP-2026-0042_Cestovni-prikaz-a-zadost-o-vyplaceni.pdf');
    expect(fileName({ number: 'CP-2026-0042' }, 'A')).toBe('CP-2026-0042_Cestovni-prikaz.pdf');
    expect(fileName({ number: '../a/b c' }, 'A')).toBe('a-b-c_Cestovni-prikaz.pdf');
    expect(fileName({ number: '' }, 'full')).toBe('CP_Cestovni-prikaz-a-zadost-o-vyplaceni.pdf');
  });
});

describe('vložený podpis', () => {
  it('obrázek podpisu a razítko se objeví jen v podpisových polích zaměstnance', async () => {
    const { readFile } = await import('node:fs/promises');
    const png = await readFile(new URL('./fixtures/podpis.png', import.meta.url));
    const m = sample();
    m.signature = { image: `data:image/png;base64,${png.toString('base64')}`, widthPct: 80, stamp: { name: 'Jana Ukázková', date: '17. 10. 2026' } };
    const buf = await renderToBuffer(documentElement(m, 'full') as Parameters<typeof renderToBuffer>[0]);
    expect(buf.includes('/Subtype /Image')).toBe(true);
    const text = (await pages(m, 'full')).join(' ');
    // razítko v části A i B
    expect(text.match(/Podepsáno/g)).toHaveLength(2);
    expect(text).toContain('17. 10. 2026');
  });
});
