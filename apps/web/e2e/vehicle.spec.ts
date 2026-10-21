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
