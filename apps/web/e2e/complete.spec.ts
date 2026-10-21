import { expect, test, type Page } from '@playwright/test';
import { go, image, pdfText, tripWithPdf } from './helpers.js';

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
