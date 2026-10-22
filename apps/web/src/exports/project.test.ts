import 'fake-indexeddb/auto';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { addFiles, getBlob } from '../attachments/store.js';
import { inputHash } from '../documents/snapshot.js';
import { vienna } from '../model/sample.js';
import { AppDb, getTrip, saveTrip } from '../storage/db.js';
import { exportOriginals, exportProject, importProject, ImportError, MAX_IMPORT_FILES, projectFileName } from './project.js';

let d: AppDb;
beforeEach(async () => {
  d = new AppDb(`proj-${Math.random()}`);
  await d.open();
});

const fakeProcess = async (_: Blob, a: { mime: string }) => ({ thumbnail: new Blob(['t']), ...(a.mime !== 'application/pdf' && { derived: new Blob(['d']) }), pages: 1 });
const jpeg = (name: string, extra = '') => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(extra)])], name);
const pdf = (name: string) => new File([new TextEncoder().encode('%PDF-1.7 obsah')], name);
const png = (name: string) => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])], name);
const now = new Date('2026-10-21T10:00:00Z');

async function sample() {
  const trip = vienna();
  await saveTrip(trip, d);
  await addFiles(trip.id, 'h', [jpeg('účtenka hotel.jpg', '1')], 'accounting', fakeProcess, d);
  await addFiles(trip.id, 'h', [pdf('výpis.pdf')], 'payment', fakeProcess, d);
  await addFiles(trip.id, null, [pdf('pozvánka.pdf')], 'supporting', fakeProcess, d);
  await addFiles(trip.id, null, [png('podpis.png')], 'signature', fakeProcess, d);
  const hash = await inputHash(trip, { h: { accounting: 1, payment: 1 } });
  await d.snapshots.add({ id: 's1', tripId: trip.id, createdAt: now.toISOString(), layout: 'modern', part: 'full', inputHash: hash, model: { ...minimalModel(), number: trip.number } });
  return trip;
}

function minimalModel() {
  const e = '';
  return {
    version: 1, number: e, createdAt: e, ruleSet: e, issued: { place: e, date: e },
    employer: { name: e, ico: e, seat: e, unit: e, costCenter: e, project: e, sector: e },
    employee: { name: e, personalNumber: e, position: e, department: e, regularWorkplace: e, address: e },
    trip: { kind: e, purpose: e, startPlace: e, endPlace: e, plannedStart: e, plannedEnd: e, destinations: e, via: e, transport: e, advances: [], note: e },
    actual: { start: e, end: e, km: e }, segments: [],
    perDiem: { days: [], domesticTotal: e, foreignTotal: e, reductionTotal: e, note: e, hasForeign: false },
    expenses: [{ id: 'h', n: '1', date: e, category: e, description: e, supplier: e, amount: e, rate: e, czk: e, payment: e, docs: e, note: e }],
    expensesNote: e, settlement: { rows: [], payoutLabel: e, payout: e, headline: [] }, documentCount: '2', declaration: e,
  };
}

const asFile = (bytes: Uint8Array) => new Blob([bytes.slice().buffer as ArrayBuffer]);

/** Rozbalí projekt, nechá upravit soubory a znovu zabalí. */
function tamper(bytes: Uint8Array, fn: (files: Record<string, Uint8Array>) => void): Blob {
  const files = unzipSync(bytes);
  fn(files);
  return asFile(zipSync(files as Zippable));
}
const json = (b: Uint8Array) => JSON.parse(strFromU8(b));

async function expectImportError(file: Blob, message: RegExp) {
  const before = await d.trips.count();
  await expect(importProject(file, now, fakeProcess, d)).rejects.toThrow(message);
  await expect(importProject(file, now, fakeProcess, d)).rejects.toBeInstanceOf(ImportError);
  // Při chybě se nic neuloží.
  expect(await d.trips.count()).toBe(before);
}

describe('export projektu', () => {
  it('ZIP obsahuje project.json, manifest s kontrolními součty a originály – bez Base64', async () => {
    const trip = await sample();
    const files = unzipSync(await exportProject(trip.id, now, d));
    expect(Object.keys(files).filter((f) => f.startsWith('attachments/'))).toHaveLength(4);
    const project = json(files['project.json']!);
    expect(project).toMatchObject({ format: 'cestovni-prikazy-projekt', projectVersion: 1, schemaVersion: 8, applicationVersion: '0.6.0', exportedAt: now.toISOString() });
    expect(project.trip.number).toBe('CP-2026-0042');
    expect(project.attachments.find((a: { mime: string }) => a.mime === 'image/jpeg')).toMatchObject({ originalName: 'účtenka hotel.jpg', expenseId: 'h', kind: 'accounting', mime: 'image/jpeg' });
    expect(project.attachments[0].tripId).toBeUndefined();
    expect(project.snapshots).toHaveLength(1);
    expect(strFromU8(files['project.json']!)).not.toMatch(/base64|data:image/);
    const manifest = json(files['manifest.json']!);
    expect(manifest.files.map((f: { path: string }) => f.path)).toContain('project.json');
    expect(manifest.files).toHaveLength(5);
    expect(projectFileName(trip)).toBe('CP-2026-0042_projekt.zip');
  });

  it('import vytvoří novou cestu se stejnými údaji, přílohami i snímkem PDF', async () => {
    const trip = await sample();
    const r = await importProject(asFile(await exportProject(trip.id, now, d)), now, fakeProcess, d);
    expect(r).toMatchObject({ attachments: 4, ignored: 0, failed: 0 });
    expect(r.tripId).not.toBe(trip.id);

    const copy = (await getTrip(r.tripId, d))!;
    const { id: _a, lastOpenedAt: _b, ...rest } = copy;
    const { id: _c, lastOpenedAt: _d, ...orig } = trip;
    expect(rest).toEqual(orig);
    expect(copy.lastOpenedAt).toBe(now.toISOString());

    const atts = await d.attachments.where('tripId').equals(r.tripId).toArray();
    expect(atts.map((a) => [a.originalName, a.kind, a.expenseId]).sort()).toEqual([
      ['podpis.png', 'signature', null],
      ['pozvánka.pdf', 'supporting', null],
      ['výpis.pdf', 'payment', 'h'],
      ['účtenka hotel.jpg', 'accounting', 'h'],
    ]);
    const img = atts.find((a) => a.mime === 'image/jpeg')!;
    expect(await getBlob(img.id, 'derived', d)).toBeDefined();
    expect(await getBlob(img.id, 'thumbnail', d)).toBeDefined();
    expect(new Uint8Array(await (await getBlob(img.id, 'original', d))!.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x31]));

    // Snímek PDF patří nové cestě a podle otisku údajů není zastaralý.
    const snap = (await d.snapshots.where('tripId').equals(r.tripId).first())!;
    expect(snap.inputHash).toBe(await inputHash(copy, { h: { accounting: 1, payment: 1 } }));
    // Původní cesta zůstala beze změny.
    expect(await d.attachments.where('tripId').equals(trip.id).count()).toBe(4);
  });

  it('starší verze schématu se při importu převede', async () => {
    const trip = await sample();
    const file = await reseal(await exportProject(trip.id, now, d), (_, p) => {
      p.schemaVersion = 3;
      delete p.trip.signature;
      p.trip.schemaVersion = 3;
    });
    const r = await importProject(file, now, fakeProcess, d);
    expect((await getTrip(r.tripId, d))!.signature).toEqual({ mode: 'scan', widthPct: 70, stamp: false });
  });

  it('nepřevedená příloha se uloží jako originál a import projde', async () => {
    const trip = await sample();
    const r = await importProject(asFile(await exportProject(trip.id, now, d)), now, async () => {
      throw new Error('nelze');
    }, d);
    expect(r.failed).toBe(4);
    expect((await d.attachments.where('tripId').equals(r.tripId).toArray()).every((a) => a.conversion === 'failed')).toBe(true);
  });

  it('ZIP originálů: složky podle výdajů, názvy bez diakritiky', async () => {
    const trip = await sample();
    const { bytes, count } = await exportOriginals(trip.id, now, d);
    expect(count).toBe(4);
    expect(Object.keys(unzipSync(bytes)).sort()).toEqual([
      '01_Ubytovani/01_ucetni-doklad_uctenka-hotel.jpg',
      '01_Ubytovani/02_doklad-o-zaplaceni_vypis.pdf',
      'doplnujici-dokumenty/01_doplnujici_pozvanka.pdf',
      'podpis/01_podpis_podpis.png',
    ]);
  });
});

describe('bezpečný import', () => {
  it('odmítne soubor, který není ZIP, a poškozený ZIP', async () => {
    await expectImportError(new Blob(['<html>ahoj</html>']), /není ZIP/);
    await expectImportError(new Blob([new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3])]), /poškozený/);
  });

  it('odmítne ZIP bez project.json nebo s cizím formátem', async () => {
    await expectImportError(asFile(zipSync({ 'manifest.json': strToU8('{"files":[]}') })), /project\.json/);
    await expectImportError(await pack({ 'project.json': strToU8(JSON.stringify({ format: 'jiny', trip: {} })) }), /formát pracovního projektu/);
    await expectImportError(await pack({ 'project.json': strToU8('{nevalidní') }), /poškozený/);
    await expectImportError(asFile(zipSync({ 'project.json': strToU8('{}'), 'manifest.json': strToU8('{"soubory":1}') })), /manifest\.json/);
  });

  it('odmítne projekt z novější verze aplikace', async () => {
    const trip = await sample();
    const file = await reseal(await exportProject(trip.id, now, d), (_, p) => (p.schemaVersion = 99));
    await expectImportError(file, /novější verze/);
  });

  it('odmítne změněný soubor (nesouhlasí kontrolní součet) i chybějící přílohu', async () => {
    const trip = await sample();
    const bytes = await exportProject(trip.id, now, d);
    const name = Object.keys(unzipSync(bytes)).find((f) => f.endsWith('.jpg'))!;
    await expectImportError(tamper(bytes, (f) => (f[name] = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x32]))), /kontrolní součet/);
    await expectImportError(tamper(bytes, (f) => delete f[name]), /chybí/);
    await expectImportError(
      tamper(bytes, (f) => {
        const p = json(f['project.json']!);
        p.trip.expenses[0].amount = 'x'.repeat(10_000);
        f['project.json'] = strToU8(JSON.stringify(p));
      }),
      /kontrolní součet/,
    );
  });

  it('odmítne přílohu, jejíž obsah neodpovídá uvedenému formátu', async () => {
    const trip = await sample();
    const bytes = await exportProject(trip.id, now, d);
    const file = await reseal(bytes, (files, p) => {
      const a = p.attachments.find((x: { mime: string }) => x.mime === 'application/pdf');
      files[a.file] = strToU8('<script>alert(1)</script>');
    });
    await expectImportError(file, /formát/);
  });

  it('soubory mimo manifest a nebezpečné cesty se nenačtou', async () => {
    const trip = await sample();
    const bytes = await exportProject(trip.id, now, d);
    const file = tamper(bytes, (f) => {
      f['../../etc/passwd'] = strToU8('x');
      f['attachments/../../evil.js'] = strToU8('alert(1)');
      f['index.html'] = strToU8('<script>alert(1)</script>');
      f['attachments/neni-v-manifestu.pdf'] = strToU8('%PDF-1.7');
    });
    const r = await importProject(file, now, fakeProcess, d);
    expect(r).toMatchObject({ attachments: 4, ignored: 4 });
  });

  it('odmítne neplatné údaje cesty a přílohu k neexistujícímu výdaji', async () => {
    const trip = await sample();
    const bytes = await exportProject(trip.id, now, d);
    await expectImportError(await reseal(bytes, (_, p) => (p.trip.kind = 'mesic')), /neúplné nebo poškozené/);
    await expectImportError(await reseal(bytes, (_, p) => (p.attachments[0].expenseId = 'neexistuje')), /výdaji, který v projektu není/);
    await expectImportError(await reseal(bytes, (_, p) => (p.attachments[0].file = '../x.jpg')), /přílohách/);
    await expectImportError(await reseal(bytes, (_, p) => (p.snapshots[0].model.signature = { image: 'http://example.com/x.png' }, (p.snapshots[0].model.number = 5))), /snímky PDF/);
  });

  it('limit velikosti po rozbalení (ZIP bomba)', async () => {
    const big = new Uint8Array(21 * 1024 * 1024).fill(32);
    await expectImportError(asFile(zipSync({ 'project.json': big, 'manifest.json': strToU8('{"files":[]}') })), /větší než 500 MB/);
  });

  it('limit počtu souborů', async () => {
    const files: Zippable = { 'project.json': strToU8('{}'), 'manifest.json': strToU8('{"files":[]}') };
    for (let i = 0; i <= MAX_IMPORT_FILES; i++) files[`attachments/${i}.pdf`] = strToU8('%PDF');
    await expectImportError(asFile(zipSync(files)), /víc než 500 souborů/);
  });
});

/** Upraví project.json i soubory a přepočítá manifest – simuluje cíleně podvržený balíček. */
async function reseal(bytes: Uint8Array, fn: (files: Record<string, Uint8Array>, project: any) => void): Promise<Blob> {
  const { sha256 } = await import('../attachments/detect.js');
  const files = unzipSync(bytes);
  const p = json(files['project.json']!);
  fn(files, p);
  for (const a of p.attachments) if (files[a.file]) a.sha256 = await sha256(files[a.file]!.slice().buffer as ArrayBuffer);
  files['project.json'] = strToU8(JSON.stringify(p));
  const manifest = [];
  for (const [path, data] of Object.entries(files)) {
    if (path === 'manifest.json') continue;
    manifest.push({ path, sha256: await sha256(data.slice().buffer as ArrayBuffer), size: data.byteLength });
  }
  files['manifest.json'] = strToU8(JSON.stringify({ files: manifest }));
  return asFile(zipSync(files as Zippable));
}

/** Zabalí soubory a doplní k nim manifest se správnými kontrolními součty. */
async function pack(files: Record<string, Uint8Array>): Promise<Blob> {
  const { sha256 } = await import('../attachments/detect.js');
  const manifest = [];
  for (const [path, data] of Object.entries(files)) manifest.push({ path, sha256: await sha256(data.slice().buffer as ArrayBuffer), size: data.byteLength });
  return asFile(zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify({ files: manifest })) }));
}
