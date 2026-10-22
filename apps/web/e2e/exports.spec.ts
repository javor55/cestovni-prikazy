import type { Download, Page } from '@playwright/test';
import { expect, test } from './fixtures.js';
import { strFromU8, unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { go, pdfText, tripWithPdf } from './helpers.js';

async function save(page: Page, button: string): Promise<{ download: Download; bytes: Uint8Array }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button }).click()]);
  return { download, bytes: new Uint8Array(await readFile((await download.path())!)) };
}

test('exporty XLSX, CSV, JSON, originály a pracovní projekt; projekt se znovu načte', async ({ page }) => {
  const base = await tripWithPdf(page);
  await go(page, `${base}/kompletni`);

  const xlsx = await save(page, 'XLSX (Excel)');
  expect(xlsx.download.suggestedFilename()).toBe('CP-2026-0099_Vyuctovani.xlsx');
  const book = unzipSync(xlsx.bytes);
  const workbook = strFromU8(book['xl/workbook.xml']!);
  for (const sheet of ['Souhrn', 'Useky', 'Stravne', 'Vydaje', 'Vozidlo', 'Kontroly']) expect(workbook).toContain(`name="${sheet}"`);
  expect(strFromU8(book['xl/worksheets/sheet1.xml']!)).toContain('Jana Ukázková');
  expect(strFromU8(book['xl/worksheets/sheet4.xml']!)).toContain('Vlak');

  const csv = await save(page, 'CSV (ZIP)');
  expect(csv.download.suggestedFilename()).toBe('CP-2026-0099_CSV.zip');
  const vydajeBytes = unzipSync(csv.bytes)['vydaje.csv']!;
  // UTF-8 s BOM, aby Excel poznal kódování.
  expect([...vydajeBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const vydaje = strFromU8(vydajeBytes);
  expect(vydaje).toContain(';2026-03-10;120.00;CZK;');

  const json = await save(page, 'JSON');
  expect(json.download.suggestedFilename()).toBe('CP-2026-0099_data.json');
  const data = JSON.parse(strFromU8(json.bytes));
  expect(data).toMatchObject({ format: 'cestovni-prikazy-data', trip: { number: 'CP-2026-0099', purpose: 'Školení' } });
  expect(data.attachments).toHaveLength(1);
  expect(data.calculation.ok).toBe(true);

  const originals = await save(page, 'Stáhnout originály (1)');
  expect(Object.keys(unzipSync(originals.bytes))).toEqual(['01_Vlak/01_ucetni-doklad_jizdenka.jpg']);

  const project = await save(page, 'Stáhnout pracovní projekt (ZIP)');
  expect(project.download.suggestedFilename()).toBe('CP-2026-0099_projekt.zip');
  const projectPath = (await project.download.path())!;

  // Smazání cesty a opětovné načtení z projektu.
  await page.getByRole('button', { name: 'Smazat data cesty' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
  await expect(page.getByText('Data cesty byla odstraněna')).toBeVisible();
  await expect(page.getByText('Školení')).toHaveCount(0);

  await page.getByLabel('Soubor pracovního projektu').setInputFiles({ name: 'projekt.txt', mimeType: 'text/plain', buffer: Buffer.from('není zip') });
  await expect(page.getByRole('alert')).toContainText('Soubor není ZIP');

  await page.getByLabel('Soubor pracovního projektu').setInputFiles(projectPath);
  await page.waitForURL(/\/souhrn\?nacteno=1$/);
  await expect(page.getByText('Pracovní projekt byl načten')).toBeVisible();
  await expect(page.getByText('včetně 1 přílohy')).toBeVisible();
  await expect(page.locator('header')).toContainText('Školení');

  // Snímek PDF i doklad se načetly: kompletní PDF jde sestavit bez upozornění na změnu údajů.
  const newBase = page.url().replace(/\/souhrn.*$/, '');
  await page.goto(`${newBase}/kompletni`);
  await page.getByRole('button', { name: 'Sestavit kompletní PDF' }).click();
  const done = page.getByRole('region', { name: 'Kompletní PDF' });
  await expect(done).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('od vytvoření PDF k podpisu změnily')).toHaveCount(0);
  const [pdf] = await Promise.all([page.waitForEvent('download'), done.getByRole('link', { name: 'Stáhnout kompletní PDF' }).click()]);
  const all = (await pdfText((await pdf.path())!)).join(' ');
  expect(all).toContain('Výdaj č. 1 · Vlak');
  expect(all).toContain('Účetní doklad · jizdenka.jpg');
});
