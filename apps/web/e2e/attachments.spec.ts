import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.js';

const shot = (page: Page, name: string) =>
  process.env.SHOTS ? page.screenshot({ path: `${process.env.SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true }) : undefined;

const MINI_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 300]>>endobj
trailer<</Root 1 0 R>>
%%EOF`;

const RATES = {
  date: '2026-10-16',
  number: '201',
  rates: { EUR: { country: 'EMU', name: 'euro', amount: 1, rate: '24.315' }, JPY: { country: 'Japonsko', name: 'jen', amount: 100, rate: '15.432' } },
};

/** Skutečný JPEG vyrobený v prohlížeči (účtenka na výšku). */
async function makeJpeg(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 900;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 600, 900);
    ctx.fillStyle = '#000';
    ctx.font = '40px sans-serif';
    ctx.fillText('ÚČTENKA 238 EUR', 40, 100);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const x of bytes) s += String.fromCharCode(x);
    return btoa(s);
  });
  return Buffer.from(b64, 'base64');
}

async function newExpense(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  await page.goto(page.url().replace('/kdo', '/vydaje'));
  await page.getByRole('button', { name: 'Přidat výdaj' }).click();
  return page.getByRole('region', { name: 'Výdaj 1' });
}

test('kurz ČNB se načte podle data výdaje včetně data kurzovního lístku', async ({ page }) => {
  let asked = '';
  await page.route('**/api/kurzy?*', (route) => {
    asked = new URL(route.request().url()).searchParams.get('datum') ?? '';
    return route.fulfill({ json: RATES });
  });
  const e1 = await newExpense(page);
  await e1.getByLabel('Datum').fill('2026-10-18');
  await e1.getByLabel('Měna').selectOption('EUR');
  await e1.getByLabel('Částka', { exact: true }).fill('12,80');
  await e1.getByRole('button', { name: /Načíst kurz ČNB k 18\. 10\. 2026/ }).click();
  await expect(e1.getByLabel(/Kurz Kč za 1 EUR/)).toHaveValue('24,315');
  await expect(e1).toContainText('Kurzovní lístek ČNB ze dne 16. 10. 2026');
  expect(asked).toBe('2026-10-18');
  await expect(e1).toContainText('311,23 Kč');

  // Měna s kurzem za 100 jednotek
  await e1.getByLabel('Měna').selectOption('JPY');
  await e1.getByLabel('Částka', { exact: true }).fill('10000');
  await e1.getByRole('button', { name: /Načíst kurz ČNB/ }).click();
  await expect(e1.getByLabel(/Kurz Kč za 100 JPY/)).toHaveValue('15,432');
  await expect(e1).toContainText('1 543,20 Kč');
});

test('výpadek ČNB nabídne ruční zadání', async ({ page }) => {
  await page.route('**/api/kurzy?*', (route) => route.fulfill({ status: 502, json: { error: 'Kurz ČNB se nepodařilo načíst. Zkuste to později, nebo zadejte kurz ručně podle cnb.cz.' } }));
  const e1 = await newExpense(page);
  await e1.getByLabel('Datum').fill('2026-10-18');
  await e1.getByLabel('Měna').selectOption('EUR');
  await e1.getByRole('button', { name: /Načíst kurz ČNB/ }).click();
  await expect(e1.getByRole('alert')).toContainText('zadejte kurz ručně');
});

test('doklady: foto, PDF, odmítnutí podvrhu, typ, otočení, pořadí a smazání', async ({ page }) => {
  const e1 = await newExpense(page);
  await expect(e1).toContainText('Bez dokladu');
  const picker = e1.getByLabel('Vybrat soubory dokladů');

  await picker.setInputFiles({ name: 'uctenka.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
  const docs = e1.getByRole('list', { name: 'Připojené doklady' });
  await expect(docs.getByRole('listitem')).toHaveCount(1);
  await expect(docs).toContainText('uctenka.jpg');
  await expect(docs.locator('img').first()).toHaveJSProperty('complete', true);
  await expect(e1).toContainText('✓ 1 účetní doklad');

  await picker.setInputFiles([
    { name: 'vypis.pdf', mimeType: 'application/pdf', buffer: Buffer.from(MINI_PDF) },
    { name: 'faktura.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html><script>alert(1)</script></html>') },
  ]);
  await expect(docs.getByRole('listitem')).toHaveCount(2);
  await expect(docs).toContainText('PDF, 1 strana');
  await expect(docs.locator('img')).toHaveCount(2); // náhled vznikl i z PDF
  await expect(e1).not.toContainText('nepodařilo');
  await expect(e1).toContainText('faktura.pdf: Nepodporovaný formát');

  // Druhý soubor je potvrzení o zaplacení
  await docs.getByRole('listitem').nth(1).getByLabel('Typ dokladu').selectOption('payment');
  await expect(e1).toContainText('1 doklad o zaplacení');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await shot(page, '10-doklady');

  // Otočení obrázku
  await docs.getByRole('listitem').first().getByRole('button', { name: 'Otočit / oříznout' }).click();
  const dialog = page.getByRole('dialog', { name: 'Úprava dokladu' });
  await expect(dialog.getByRole('img', { name: 'Náhled dokladu' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Otočit doprava' }).click();
  await shot(page, '11-editor');
  await dialog.getByRole('button', { name: 'Uložit' }).click();
  await expect(dialog).toBeHidden();

  // Pořadí: PDF nahoru
  await docs.getByRole('button', { name: 'Posunout vypis.pdf výš' }).click();
  await expect(docs.getByRole('listitem').first()).toContainText('vypis.pdf');

  // Smazání výdaje odstraní i jeho doklady
  await e1.getByRole('button', { name: 'Odebrat výdaj' }).click();
  const left = await page.evaluate(
    () =>
      new Promise<number>((res) => {
        const r = indexedDB.open('cestovni-prikazy');
        r.onsuccess = () => {
          const q = r.result.transaction('blobs').objectStore('blobs').count();
          q.onsuccess = () => res(q.result);
        };
      }),
  );
  expect(left).toBe(0);
});
