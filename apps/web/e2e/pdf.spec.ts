import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.js';
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

/** Před přechodem na jinou adresu počkat, až aplikace ohlásí uložení. */
async function go(page: Page, url: string) {
  await expect(page.getByText('uloženo v prohlížeči')).toBeVisible();
  await page.goto(url);
}

async function domesticTrip(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  await page.getByLabel('Jméno a příjmení').fill('Žofie Šťastná');
  await page.getByLabel('Pravidelné pracoviště').fill('Praha');
  await page.getByLabel('Název').fill('Ukázková firma s.r.o.');
  const base = page.url().replace(/\/kdo$/, '');
  await go(page, `${base}/cesta`);
  await page.getByLabel('Číslo cestovního příkazu').fill('CP-2026-0007');
  await page.getByLabel('Účel cesty').fill('Školení bezpečnosti práce');
  await page.getByLabel('Místo nástupu').fill('Praha');
  await page.getByLabel('Plánovaný začátek').fill('2026-03-10T07:00');
  await page.getByLabel('Plánovaný konec').fill('2026-03-10T16:00');
  await page.getByLabel('Místo vystavení příkazu').fill('Praha');
  await page.getByLabel('Datum vystavení příkazu').fill('2026-03-09');
  await go(page, `${base}/prubeh`);
  await page.getByRole('button', { name: 'Přidat úsek' }).click();
  const s1 = page.getByRole('region', { name: 'Úsek 1' });
  await s1.getByLabel('Kam').fill('Brno');
  await s1.getByLabel('Odjezd').fill('2026-03-10T07:00');
  await s1.getByLabel('Příjezd').fill('2026-03-10T15:30');
  await go(page, `${base}/jidla`);
  await page.getByRole('button', { name: 'Oběd' }).click();
  await go(page, `${base}/pdf`);
  return base;
}

test('PDF k podpisu: vytvoření, stažení, obsah a upozornění na změnu údajů', async ({ page }) => {
  const base = await domesticTrip(page);
  await page.getByText('Konzervativní', { exact: true }).click();
  await page.getByRole('button', { name: 'Vytvořit PDF' }).click();
  const ready = page.getByRole('region', { name: 'Vytvořené PDF' });
  await expect(ready).toBeVisible({ timeout: 20_000 });
  await expect(ready).toContainText('CP-2026-0007_Cestovni-prikaz-a-zadost-o-vyplaceni.pdf');

  const [download] = await Promise.all([page.waitForEvent('download'), ready.getByRole('link', { name: 'Stáhnout PDF' }).click()]);
  expect(download.suggestedFilename()).toBe('CP-2026-0007_Cestovni-prikaz-a-zadost-o-vyplaceni.pdf');
  if (process.env.SHOTS) await download.saveAs(`${process.env.SHOTS}/${test.info().project.name}-vyuctovani.pdf`);
  const pages = await pdfText(await download.path());
  expect(pages.length).toBeGreaterThanOrEqual(2);
  pages.forEach((p, i) => {
    expect(p).toContain('CP-2026-0007');
    expect(p).toContain(`Strana ${i + 1} z ${pages.length}`);
  });
  const all = pages.join(' ');
  expect(all).toContain('CESTOVNÍ PŘÍKAZ');
  expect(all).toContain('Žofie Šťastná');
  expect(all).toContain('Školení bezpečnosti práce');
  expect(all).toContain('9. 3. 2026'); // datum vystavení
  // 8,5 h → 155 Kč, oběd zdarma −70 % → 46,50 → 47 Kč
  expect(all).toContain('47,00 Kč');
  expect(all).toContain('CZ-2026 v1.0.0');

  // Po změně údajů aplikace upozorní, že PDF už neodpovídá
  await go(page, `${base}/cesta`);
  await page.getByLabel('Účel cesty').fill('Školení bezpečnosti práce a požární ochrany');
  await go(page, `${base}/pdf`);
  await expect(page.getByText('Údaje cesty se od vytvoření tohoto PDF změnily')).toBeVisible();
});

test('jen cestovní příkaz (část A) má jednu stranu a jde vytvořit i s chybou ve vyúčtování', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  await page.goto(page.url().replace(/\/kdo$/, '/pdf'));
  await expect(page.getByText(/Vyúčtování obsahuje chyby/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vytvořit PDF' })).toBeDisabled();
  await page.getByText('Jen cestovní příkaz', { exact: true }).click();
  await page.getByRole('button', { name: 'Vytvořit PDF' }).click();
  const ready = page.getByRole('region', { name: 'Vytvořené PDF' });
  await expect(ready).toBeVisible({ timeout: 20_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), ready.getByRole('link', { name: 'Stáhnout PDF' }).click()]);
  expect(download.suggestedFilename()).toBe('CP_Cestovni-prikaz.pdf');
  const pages = await pdfText(await download.path());
  expect(pages).toHaveLength(1);
  expect(pages[0]).toContain('Cestovní příkaz');
});
