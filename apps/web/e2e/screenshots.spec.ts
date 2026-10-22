// Screenshoty pro README: projde ukázkovou cestu do Vídně a uloží obrazovky do adresáře SCREENSHOTS.
// Spuštění: SCREENSHOTS=$PWD/../../docs/img pnpm --filter @cp/web exec playwright test screenshots --project=desktop --project=mobil
// Bez proměnné SCREENSHOTS se test přeskočí (v CI neběží).
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { expect, test } from './fixtures.js';
import { go, image } from './helpers.js';

const dir = process.env.SCREENSHOTS;
test.skip(!dir, 'Screenshoty jen na vyžádání (proměnná SCREENSHOTS).');

async function shot(page: Page, name: string) {
  const prefix = test.info().project.name === 'desktop' ? '' : 'mobil-';
  // Kurzor a zvýraznění pole nejsou na screenshotu žádoucí.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  if (page.url().includes('/cesta/')) await expect(page.getByText('uloženo v prohlížeči')).toBeVisible();
  await page.screenshot({ path: `${dir}/${prefix}${name}.png` });
}

test('ukázková cesta do Vídně', async ({ page }) => {
  test.skip(test.info().project.name === 'mobil-320');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  const base = page.url().replace(/\/kdo$/, '');

  await page.getByLabel('Jméno a příjmení').fill('Jana Nováková');
  await page.getByText('Osobní číslo, pozice, útvar, adresa').click();
  await page.getByLabel('Pracovní pozice').fill('Nákupčí');
  await page.getByLabel('Pravidelné pracoviště').fill('Praha, Ukázková 12');
  await page.getByLabel('Název').fill('Ukázková firma s.r.o.');
  await page.getByText('IČO, organizační jednotka').click();
  await page.getByLabel('IČO').fill('87654326');
  await page.getByLabel('Sídlo').fill('Ukázková 12, Praha 1');

  await go(page, `${base}/cesta`);
  await page.getByLabel('Číslo cestovního příkazu').fill('CP-2026-0042');
  await page.getByLabel('Účel cesty').fill('Jednání s dodavatelem');
  await page.getByText('Zahraniční', { exact: true }).click();
  await page.getByLabel('Místo nástupu').fill('Praha');
  await page.getByLabel('Místo ukončení').fill('Praha');
  await page.getByLabel('Plánovaný začátek').fill('2026-10-14T06:30');
  await page.getByLabel('Plánovaný konec').fill('2026-10-16T19:00');
  await page.getByLabel('Cílová místa').fill('Vídeň');
  await page.getByLabel('Stát cíle').selectOption('AT');
  await page.getByLabel('Dopravní prostředky', { exact: true }).selectOption('soukrome-auto');
  await page.getByLabel('Místo vystavení příkazu').fill('Praha');
  await page.getByLabel('Datum vystavení příkazu').fill('2026-10-12');
  await page.getByRole('button', { name: 'Přidat zálohu' }).click();
  await page.getByLabel('Částka').fill('100');
  await page.getByLabel('Vyplaceno dne').fill('2026-10-12');
  await page.getByLabel('Kurz Kč za 1 EUR').fill('24,35');
  await page.getByRole('heading', { name: 'Plán cesty' }).scrollIntoViewIfNeeded();
  await shot(page, '02-plan');

  await go(page, `${base}/prubeh`);
  await page.getByRole('button', { name: 'Vyplnit podle plánu' }).click();
  const there = page.getByRole('region', { name: 'Úsek 1' });
  const back = page.getByRole('region', { name: 'Úsek 2' });
  await there.getByLabel('Příjezd').fill('2026-10-14T11:00');
  await there.getByLabel('Kilometry').fill('343');
  await there.getByLabel('Přechod hranice CZ → AT').fill('2026-10-14T09:45');
  await back.getByLabel('Odjezd').fill('2026-10-16T14:00');
  await back.getByLabel('Příjezd').fill('2026-10-16T18:30');
  await back.getByLabel('Kilometry').fill('343');
  await back.getByLabel('Přechod hranice AT → CZ').fill('2026-10-16T15:15');
  // Na mobilu je zajímavější karta úseku s přechodem hranice než úvodní text.
  if (test.info().project.name === 'desktop') await page.getByRole('heading', { name: 'Průběh cesty' }).scrollIntoViewIfNeeded();
  else await there.getByLabel('Kilometry').scrollIntoViewIfNeeded();
  await shot(page, '03-prubeh');

  await go(page, `${base}/jidla`);
  await page.getByRole('button', { name: 'Snídaně každé ráno (v ceně ubytování)' }).click();
  await page.getByRole('region', { name: /15\. 10\. 2026/ }).getByRole('button', { name: 'Oběd' }).click();
  await shot(page, '04-jidla');

  await go(page, `${base}/vydaje`);
  await page.getByRole('button', { name: 'Přidat výdaj' }).click();
  const hotel = page.getByRole('region', { name: 'Výdaj 1' });
  await hotel.getByLabel('Kategorie').selectOption('Ubytování');
  await hotel.getByLabel('Dodavatel').fill('Hotel Am Ring');
  await hotel.getByLabel('Datum').fill('2026-10-16');
  await hotel.getByLabel('Částka', { exact: true }).fill('238');
  await hotel.getByLabel('Přepočet na Kč').selectOption('BANK_CONFIRMATION');
  await hotel.getByLabel('Stržená částka v Kč').fill('5 812,44');
  await hotel.getByLabel('Vybrat soubory dokladů').setInputFiles({ name: 'faktura-hotel.jpg', mimeType: 'image/jpeg', buffer: await image(page, 'image/jpeg') });
  await expect(hotel).toContainText('✓ 1 účetní doklad');
  await hotel.getByRole('button', { name: 'Hotovo' }).click();
  await page.getByRole('button', { name: 'Přidat výdaj' }).click();
  const parking = page.getByRole('region', { name: 'Výdaj 2' });
  await parking.getByLabel('Kategorie').selectOption('Parkovné');
  await parking.getByLabel('Datum').fill('2026-10-15');
  await parking.getByLabel('Částka', { exact: true }).fill('36');
  await parking.getByLabel('Způsob úhrady').selectOption('ADVANCE');
  await parking.getByRole('button', { name: 'Hotovo' }).click();
  await page.getByLabel('Číslo účtu pro výplatu').fill('2000145399/0800');
  await page.getByRole('heading', { name: 'Výdaje', level: 1 }).scrollIntoViewIfNeeded();
  await shot(page, '05-vydaje');

  await go(page, `${base}/vozidlo`);
  await page.getByText('Na cestě jsem použil(a) osobní vozidlo').click();
  await page.getByLabel('Značka a typ').fill('Škoda Octavia');
  await page.getByLabel('Registrační značka').fill('1AB 2345');
  await page.getByLabel(/Spotřeba podle technického průkazu/).fill('5,6');
  await page.getByRole('button', { name: /Použít 686 km/ }).click();
  await page.getByText('Cena z jednoho dokladu', { exact: true }).click();
  await page.getByLabel(/Cena za 1 l z dokladu/).fill('38,90');
  await page.getByRole('region', { name: 'Výpočet náhrady' }).scrollIntoViewIfNeeded();
  await shot(page, '06-vozidlo');

  await go(page, `${base}/souhrn`);
  await expect(page.getByRole('region', { name: 'Výsledek' })).toContainText('K výplatě zaměstnanci');
  await shot(page, '07-souhrn');

  await page.goto(`${base}/pdf`);
  await page.getByRole('button', { name: 'Vytvořit PDF' }).click();
  const created = page.getByRole('region', { name: 'Vytvořené PDF' });
  await expect(created).toBeVisible({ timeout: 20_000 });
  if (test.info().project.name === 'desktop') {
    const [pdf] = await Promise.all([page.waitForEvent('download'), created.getByRole('link', { name: /Stáhnout/ }).first().click()]);
    await pdf.saveAs(`${dir}/ukazka-cestovni-prikaz.pdf`);
  }
  await shot(page, '08-pdf');

  await page.goto(`${base}/kompletni`);
  await page.getByRole('button', { name: 'Sestavit kompletní PDF' }).click();
  const done = page.getByRole('region', { name: 'Kompletní PDF' });
  await expect(done).toBeVisible({ timeout: 30_000 });
  if (test.info().project.name === 'desktop') {
    const [pdf] = await Promise.all([page.waitForEvent('download'), done.getByRole('link', { name: 'Stáhnout kompletní PDF' }).click()]);
    await pdf.saveAs(`${dir}/ukazka-kompletni-dokumentace.pdf`);
  }
  await shot(page, '09-kompletni');


  await page.goto('/');
  await shot(page, '01-uvod');
  await writeFile(`${dir}/.gitkeep`, '');
});
