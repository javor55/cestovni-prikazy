import { expect, test } from './fixtures.js';
import { go, image } from './helpers.js';

test('soukromé auto: cena paliva z více tankování (vážený průměr) a technický průkaz', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  const base = page.url().replace(/\/kdo$/, '');
  await page.goto(`${base}/cesta`);
  await page.getByLabel('Plánovaný začátek').fill('2026-03-10T06:00');
  await page.getByLabel('Plánovaný konec').fill('2026-03-11T20:00');

  await go(page, `${base}/vydaje`);
  for (const [n, amount, qty] of [
    [1, '1500', '40'],
    [2, '1170,60', '30,5'],
  ] as const) {
    await page.getByRole('button', { name: 'Přidat výdaj' }).click();
    const e = page.getByRole('region', { name: `Výdaj ${n}` });
    await e.getByLabel('Kategorie').selectOption('Pohonné hmoty');
    await e.getByLabel('Datum').fill('2026-03-10');
    await e.getByLabel('Částka', { exact: true }).fill(amount);
    await e.getByLabel('Množství (l)').fill(qty);
  }

  await go(page, `${base}/vozidlo`);
  await page.getByText('Na cestě jsem použil(a) osobní vozidlo').click();
  await page.getByLabel(/Spotřeba podle technického průkazu/).fill('5,6');
  await page.getByLabel('Ujeté kilometry').fill('686');
  await page.getByText('Podle dokladů o tankování', { exact: true }).click();
  await expect(page.getByText('Započítané doklady: 1500 CZK / 40 l · 1170,60 CZK / 30,5 l')).toBeVisible();
  const calc = page.getByRole('region', { name: 'Výpočet náhrady' });
  // (1 500 + 1 170,60) / 70,5 l = 37,88 Kč/l; 38,42 l × 37,88 = 1 455,20 Kč
  await expect(calc).toContainText('37,88 Kč');
  await expect(calc).toContainText('vážený průměr z 2 dokladů');
  await expect(calc).toContainText('1 455,20 Kč');

  await page.getByLabel('Vybrat soubory dokladů').setInputFiles({ name: 'tp.jpg', mimeType: 'image/jpeg', buffer: await image(page, 'image/jpeg') });
  await expect(page.getByRole('list', { name: 'Připojené doklady' })).toContainText('tp.jpg');
  await page.getByLabel('Druh', { exact: true }).selectOption('Technický průkaz');
});

test('průměrná cena paliva podle vyhlášky je vidět a jde ručně změnit; sazby jsou k nahlédnutí', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  const base = page.url().replace(/\/kdo$/, '');
  await page.goto(`${base}/cesta`);
  await page.getByLabel('Plánovaný začátek').fill('2026-03-10T06:00');
  await page.getByLabel('Plánovaný konec').fill('2026-03-11T20:00');
  await go(page, `${base}/vozidlo`);
  await page.getByText('Na cestě jsem použil(a) osobní vozidlo').click();
  await page.getByLabel(/Spotřeba podle technického průkazu/).fill('5,6');
  await page.getByLabel('Ujeté kilometry').fill('686');
  const avg = page.getByLabel('Průměrná cena paliva');
  await expect(avg).toContainText('Průměrná cena podle vyhlášky 573/2025 Sb.: 34,70 Kč za 1 l');
  const calc = page.getByRole('region', { name: 'Výpočet náhrady' });
  await expect(calc).toContainText('34,70 Kč');

  await page.getByLabel(/Jiná průměrná cena za 1 l/).fill('35,10');
  await page.getByLabel('Zdroj ceny').fill('vyhláška č. 123/2026 Sb.');
  // 686 km × 5,6 l / 100 = 38,416 l × 35,10 = 1 348,40 Kč
  await expect(calc).toContainText('průměrná cena zadaná ručně, vyhláška č. 123/2026 Sb.');
  await expect(calc).toContainText('1 348,40 Kč');

  await go(page, `${base}/souhrn`);
  await expect(page.getByRole('region', { name: 'Kontrola' })).toContainText('Průměrná cena paliva je zadaná ručně (35,10 Kč, vyhláška č. 123/2026 Sb.) místo ceny podle vyhlášky 573/2025 (34,70 Kč)');
  // Protokol výpočtu v souhrnu: cena paliva i se zdrojem a oba vzorce s čísly.
  const proto = page.getByRole('region', { name: 'Soukromé vozidlo' });
  await expect(proto).toContainText('zadaná ručně (vyhláška č. 123/2026 Sb.); podle uložené vyhlášky 34,70 Kč');
  await expect(proto).toContainText('686 km × 5,60 ÷ 100 = 38,416 l × 35,10 = 1 348,4016 → 1 348,40 Kč');
  // Informace o použité sadě pravidel v kontrole odkazuje na její hodnoty.
  await expect(page.getByText('Výpočet podle sady pravidel CZ-2026 verze 1.2.0.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zobrazit sazby a hodnoty této sady pravidel' })).toHaveAttribute('href', /\/sazby\?zpet=/);
  await page.getByRole('link', { name: /Sazby a hodnoty výpočtu/ }).click();
  await expect(page.getByText('Sazby a hodnoty výpočtu')).toBeVisible();
  await page.getByLabel('Hledat stát').fill('Chorvatsko');
  await expect(page.getByRole('region', { name: 'Zahraniční stravné' }).getByRole('row', { name: /Chorvatsko/ })).toContainText('50,00 EUR');
  await expect(page.getByRole('region', { name: 'Soukromé vozidlo' })).toContainText('41,80 Kč / l');
  const [rules] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Stáhnout sadu pravidel CZ-2026 v1\.2\.0/ }).click()]);
  expect(rules.suggestedFilename()).toBe('CZ-2026_v1.2.0_sada-pravidel.json');
  await page.getByRole('link', { name: 'Zpět' }).click();
  await expect(page).toHaveURL(/\/souhrn$/);
});
