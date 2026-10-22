import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function pdfText(path: string): Promise<string[]> {
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
export async function image(page: Page, type: 'image/jpeg' | 'image/png'): Promise<Buffer> {
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

export async function go(page: Page, url: string) {
  await expect(page.getByText('uloženo v prohlížeči')).toBeVisible();
  await page.goto(url);
}

/** Jednodenní cesta s jedním výdajem a jeho dokladem, vytvořené PDF k podpisu. */
export async function tripWithPdf(page: Page): Promise<string> {
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
  await page.getByLabel('Číslo účtu pro výplatu').fill('2000145399/0800');
  await go(page, `${base}/pdf`);
  await page.getByRole('button', { name: 'Vytvořit PDF' }).click();
  await expect(page.getByRole('region', { name: 'Vytvořené PDF' })).toBeVisible({ timeout: 20_000 });
  return base;
}
