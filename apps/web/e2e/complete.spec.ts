import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.js';
import { go, image, pdfText, tripWithPdf } from './helpers.js';

async function buildAndDownload(page: Page, base: string, preset?: string) {
  await go(page, `${base}/kompletni`);
  if (preset) await page.getByText(preset, { exact: true }).click();
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

test('kompletní PDF jen s podepsaným dokumentem a doklady k výdajům', async ({ page }) => {
  const base = await tripWithPdf(page);
  await go(page, `${base}/podpis`);
  await page.getByText('Vytisknu, podepíšu a nahraji sken').click();
  await page.getByLabel('Vybrat soubory dokladů').setInputFiles({ name: 'podepsano.jpg', mimeType: 'image/jpeg', buffer: await image(page, 'image/jpeg') });
  await expect(page.getByText('Nahráno souborů: 1')).toBeVisible();

  const { pages } = await buildAndDownload(page, base, 'Jen podepsaný dokument a doklady k výdajům');
  expect(pages).toHaveLength(2);
  expect(pages[0]).toContain('Podepsaný dokument – podepsano.jpg');
  expect(pages[1]).toContain('Výdaj č. 1 · Vlak · Účetní doklad · jizdenka.jpg');
  expect(pages.join(' ')).not.toContain('Kompletní dokumentace pracovní cesty');

  // Vlastní výběr si prohlížeč pamatuje.
  await page.reload();
  await expect(page.getByLabel('Jen podepsaný dokument a doklady k výdajům')).toBeChecked();
  await page.getByText('Vlastní výběr', { exact: true }).click();
  await page.getByLabel('Podepsaný cestovní příkaz a vyúčtování', { exact: true }).uncheck();
  await page.getByLabel('Účetní doklady k výdajům', { exact: true }).uncheck();
  await page.getByLabel('Doklady o zaplacení k výdajům', { exact: true }).uncheck();
  await expect(page.getByText('Vyberte alespoň jednu část.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sestavit/ })).toBeDisabled();
});
