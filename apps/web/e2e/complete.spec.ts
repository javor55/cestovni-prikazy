import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function pdfText(path: string): Promise<string[]> {
  const task = getDocument({ data: new Uint8Array(await readFile(path)) });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    pages.push(c.items.map((x) => ('str' in x ? x.str : '')).join(' ').replace(/\s+/g, ' '));
  }
  await task.destroy();
  return pages;
}

/** Obrázek vyrobený v prohlížeči: JPEG účtenky, nebo PNG podpisu s průhledným pozadím. */
async function image(page: Page, type: 'image/jpeg' | 'image/png'): Promise<Buffer> {
  const b64 = await page.evaluate(async (t) => {
    const c = document.createElement('canvas');
    c.width = t === 'image/png' ? 400 : 600;
    c.height = t === 'image/png' ? 120 : 900;
    const ctx = c.getContext('2d')!;
    if (t === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#000';
      ctx.font = '40px sans-serif';
      ctx.fillText('ÚČTENKA 120 Kč', 40, 100);
    } else {
      ctx.strokeStyle = '#123';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(10, 90);
      ctx.bezierCurveTo(80, -20, 150, 160, 390, 40);
      ctx.stroke();
    }
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), t, 0.9));
    let s = '';
    for (const x of new Uint8Array(await blob.arrayBuffer())) s += String.fromCharCode(x);
    return btoa(s);
  }, type);
  return Buffer.from(b64, 'base64');
}

async function go(page: Page, url: string) {
  await expect(page.getByText('uloženo v prohlížeči')).toBeVisible();
  await page.goto(url);
}

/** Jednodenní cesta s jedním výdajem a jeho dokladem, vytvořené PDF k podpisu. */
async function tripWithPdf(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  await page.getByLabel('Jméno a příjmení').fill('Jana Ukázková');
  await page.getByLabel('Pravidelné pracoviště').fill('Praha');
  await page.getByLabel('Název').fill('Ukázková firma s.r.o.');
  const base = page.url().replace(/\/kdo$/, '');
  await go(page, `${base}/cesta`);
  await page.getByLabel('Číslo cestovního příkazu').fill('CP-2026-0099');
  await page.getByLabel('Účel cesty').fill('Školení');
  await page.getByLabel('Plánovaný začátek').fill('2026-03-10T07:00');
  await page.getByLabel('Plánovaný konec').fill('2026-03-10T16:00');
  await go(page, `${base}/vydaje`);
  await page.getByRole('button', { name: 'Přidat výdaj' }).click();
  const e1 = page.getByRole('region', { name: 'Výdaj 1' });
  await e1.getByLabel('Kategorie').selectOption('Vlak');
  await e1.getByLabel('Datum').fill('2026-03-10');
  await e1.getByLabel('Částka', { exact: true }).fill('120');
  await e1.getByLabel('Vybrat soubory dokladů').setInputFiles({ name: 'jizdenka.jpg', mimeType: 'image/jpeg', buffer: await image(page, 'image/jpeg') });
  await expect(e1).toContainText('✓ 1 účetní doklad');
  await go(page, `${base}/pdf`);
  await page.getByRole('button', { name: 'Vytvořit PDF' }).click();
  await expect(page.getByRole('region', { name: 'Vytvořené PDF' })).toBeVisible({ timeout: 20_000 });
  return base;
}

async function buildAndDownload(page: Page, base: string) {
  await go(page, `${base}/kompletni`);
  await page.getByRole('button', { name: 'Sestavit kompletní PDF' }).click();
  const done = page.getByRole('region', { name: 'Kompletní PDF' });
  await expect(done).toBeVisible({ timeout: 30_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), done.getByRole('link', { name: 'Stáhnout kompletní PDF' }).click()]);
  expect(download.suggestedFilename()).toBe('CP-2026-0099_Kompletni-dokumentace.pdf');
  if (process.env.SHOTS) await download.saveAs(`${process.env.SHOTS}/${test.info().project.name}-kompletni.pdf`);
  return { done, pages: await pdfText(await download.path()) };
}

test('obrázek podpisu s razítkem a kompletní PDF s doklady', async ({ page }) => {
  const base = await tripWithPdf(page);
  await go(page, `${base}/podpis`);
  await page.getByText('Vložím obrázek podpisu').click();
  await expect(page.getByText('nejde o kvalifikovaný elektronický podpis')).toBeVisible();
  await page.getByLabel('Nahrát obrázek podpisu (PNG)').setInputFiles({ name: 'podpis.png', mimeType: 'image/png', buffer: await image(page, 'image/png') });
  await expect(page.getByRole('img', { name: 'Váš podpis' })).toBeVisible();
  await expect(page.getByText('nemá průhledné pozadí')).toHaveCount(0);
  await page.getByText('Přidat razítko „Podepsáno“').click();
  await page.getByLabel(/Velikost podpisu/).fill('80');

  const { done, pages } = await buildAndDownload(page, base);
  await expect(done).toContainText('Účetních dokladů');
  const all = pages.join(' ');
  expect(all).toContain('Kompletní dokumentace pracovní cesty');
  // Krycí list s prostrkovaným názvem firmy – žádný znak nesmí chybět (chyba sdíleného písma v @react-pdf).
  expect(pages[0]!.replace(/\s/g, '')).toContain('UKÁZKOVÁFIRMAS.R.O.');
  expect(all).toContain('vložený obrázek podpisu');
  expect(all).toContain('Podepsáno');
  expect(all).toContain('Výdaj č. 1 · Vlak');
  expect(all).toContain('Účetní doklad · jizdenka.jpg');
  pages.forEach((p, i) => expect(p).toContain(`strana ${i + 1} z ${pages.length}`));
});

test('podepsaný sken a odmítnutí podpisu, který není PNG', async ({ page }) => {
  const base = await tripWithPdf(page);
  await go(page, `${base}/podpis`);
  await page.getByText('Vložím obrázek podpisu').click();
  await page.getByLabel('Nahrát obrázek podpisu (PNG)').setInputFiles({ name: 'podpis.png', mimeType: 'image/png', buffer: await image(page, 'image/jpeg') });
  await expect(page.getByText('musí být ve formátu PNG')).toBeVisible();

  await page.getByText('Vytisknu, podepíšu a nahraji sken').click();
  await page.getByLabel('Vybrat soubory dokladů').setInputFiles({ name: 'podepsano.jpg', mimeType: 'image/jpeg', buffer: await image(page, 'image/jpeg') });
  await expect(page.getByText('Nahráno souborů: 1')).toBeVisible();

  const { pages } = await buildAndDownload(page, base);
  const all = pages.join(' ');
  expect(pages[0]!.replace(/\s/g, '')).toContain('UKÁZKOVÁFIRMAS.R.O.');
  expect(all).toContain('podepsaný dokument nahrán jako sken');
  expect(all).toContain('Podepsaný dokument – podepsano.jpg');
});
