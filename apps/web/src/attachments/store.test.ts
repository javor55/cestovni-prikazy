import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { newTrip } from '../model/trip.js';
import { AppDb, deleteEverything, deleteTrip, purgeExpired, saveTrip } from '../storage/db.js';
import { MAX_FILE_BYTES } from './model.js';
import { addFiles, deleteAttachment, deleteForExpense, editImage, getBlob, move } from './store.js';

let d: AppDb;
beforeEach(async () => {
  d = new AppDb(`att-${Math.random()}`);
  await d.open();
});

// Zpracování obrázku potřebuje prohlížeč; v jednotkových testech ho nahrazuje jednoduchá funkce.
const fakeProcess = async (_: Blob, a: { mime: string }) => ({ thumbnail: new Blob(['t']), ...(a.mime !== 'application/pdf' && { derived: new Blob(['d']) }), pages: 1 });
const failing = async () => {
  throw new Error('HEIC nelze převést');
};
const jpeg = (name: string, extra = '') => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(extra)])], name);
const pdf = (name: string) => new File([new TextEncoder().encode('%PDF-1.7 ...')], name);

describe('přílohy', () => {
  it('uloží originál, odvozenou variantu a náhled; pořadí roste', async () => {
    const r = await addFiles('t1', 'e1', [jpeg('a.jpg', '1'), pdf('b.pdf')], 'accounting', fakeProcess, d);
    expect(r.rejected).toEqual([]);
    expect(r.added.map((a) => [a.mime, a.order, a.kind])).toEqual([
      ['image/jpeg', 1, 'accounting'],
      ['application/pdf', 2, 'accounting'],
    ]);
    const id = r.added[0]!.id;
    expect(await getBlob(id, 'original', d)).toBeDefined();
    expect(await getBlob(id, 'derived', d)).toBeDefined();
    expect(await getBlob(r.added[1]!.id, 'derived', d)).toBeUndefined();
  });

  it('odmítne podvržený a příliš velký soubor', async () => {
    const fake = new File(['<html><script>alert(1)</script>'], 'faktura.pdf', { type: 'application/pdf' });
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'velky.jpg');
    const r = await addFiles('t1', 'e1', [fake, big], 'accounting', fakeProcess, d);
    expect(r.added).toEqual([]);
    expect(r.rejected.map((x) => x.name)).toEqual(['faktura.pdf', 'velky.jpg']);
    expect(r.rejected[0]!.reason).toContain('Nepodporovaný formát');
  });

  it('upozorní na stejný soubor nahraný podruhé', async () => {
    await addFiles('t1', 'e1', [jpeg('a.jpg', 'x')], 'accounting', fakeProcess, d);
    const r = await addFiles('t1', 'e2', [jpeg('kopie.jpg', 'x')], 'accounting', fakeProcess, d);
    expect(r.duplicates).toEqual(['kopie.jpg']);
    expect(r.added).toHaveLength(1);
  });

  it('nepodařený převod uchová originál a označí přílohu', async () => {
    const r = await addFiles('t1', 'e1', [jpeg('a.jpg')], 'accounting', failing, d);
    expect(r.added[0]).toMatchObject({ conversion: 'failed', conversionError: 'HEIC nelze převést' });
    expect(await getBlob(r.added[0]!.id, 'original', d)).toBeDefined();
  });

  it('otočení přepočítá odvozenou variantu, originál zůstane', async () => {
    const r = await addFiles('t1', 'e1', [jpeg('a.jpg')], 'accounting', fakeProcess, d);
    const id = r.added[0]!.id;
    const before = await getBlob(id, 'original', d);
    await editImage(id, { rotation: 90, crop: { x: 0, y: 0, w: 0.5, h: 1 } }, fakeProcess, d);
    expect(await d.attachments.get(id)).toMatchObject({ rotation: 90, crop: { w: 0.5 } });
    expect(await getBlob(id, 'original', d)).toEqual(before);
  });

  it('změna pořadí a smazání', async () => {
    const r = await addFiles('t1', 'e1', [jpeg('a.jpg', '1'), jpeg('b.jpg', '2')], 'accounting', fakeProcess, d);
    await move(r.added[1]!.id, -1, d);
    const order = (await d.attachments.toArray()).sort((a, b) => a.order - b.order).map((a) => a.originalName);
    expect(order).toEqual(['b.jpg', 'a.jpg']);
    await deleteAttachment(r.added[0]!.id, d);
    expect(await d.attachments.count()).toBe(1);
    expect(await d.blobs.where('attachmentId').equals(r.added[0]!.id).count()).toBe(0);
  });

  it('smazání výdaje, cesty a všech dat odstraní i soubory', async () => {
    const t = newTrip(new Date('2026-09-01T10:00:00Z'));
    await saveTrip(t, d);
    await addFiles(t.id, 'e1', [jpeg('a.jpg', '1')], 'accounting', fakeProcess, d);
    await addFiles(t.id, 'e2', [jpeg('b.jpg', '2')], 'accounting', fakeProcess, d);
    await addFiles('jina-cesta', 'e9', [jpeg('c.jpg', '3')], 'accounting', fakeProcess, d);

    await deleteForExpense(t.id, 'e1', d);
    expect((await d.attachments.toArray()).map((a) => a.originalName).sort()).toEqual(['b.jpg', 'c.jpg']);

    await deleteTrip(t.id, d);
    expect((await d.attachments.toArray()).map((a) => a.originalName)).toEqual(['c.jpg']);
    expect(await d.blobs.count()).toBe(3); // originál, odvozená varianta a náhled souboru c.jpg

    await deleteEverything(d);
    expect(await d.blobs.count()).toBe(0);
  });

  it('automatické mazání po 30 dnech odstraní i přílohy', async () => {
    const t = newTrip(new Date('2026-09-01T10:00:00Z'));
    await saveTrip(t, d);
    await addFiles(t.id, null, [pdf('program.pdf')], 'supporting', fakeProcess, d);
    expect(await purgeExpired(new Date('2026-10-02T10:00:00Z'), 30, d)).toBe(1);
    expect(await d.attachments.count()).toBe(0);
    expect(await d.blobs.count()).toBe(0);
  });
});
