import { expect, test } from './fixtures.js';
import { go } from './helpers.js';

test('ubytování se zeptá na snídani; kontrola v souhrnu ukáže lhůtu pro odevzdání vyúčtování', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  const base = page.url().replace(/\/kdo$/, '');
  await page.goto(`${base}/cesta`);
  await page.getByLabel('Plánovaný začátek').fill('2026-10-14T07:00');
  await page.getByLabel('Plánovaný konec').fill('2026-10-16T18:00');

  await go(page, `${base}/vydaje`);
  await page.getByRole('button', { name: 'Přidat výdaj' }).click();
  const hotel = page.getByRole('region', { name: 'Výdaj 1' });
  await hotel.getByLabel('Kategorie').selectOption('Ubytování');
  await expect(hotel.getByText('Byla v ceně ubytování snídaně?')).toBeVisible();
  await hotel.getByRole('button', { name: 'Ano, označit snídaně' }).click();
  await expect(hotel).toContainText('Snídaně v ceně ubytování jsou označené');

  await go(page, `${base}/jidla`);
  const breakfast = (day: RegExp) => page.getByRole('region', { name: day }).getByRole('button', { name: 'Snídaně' });
  await expect(breakfast(/14\. 10\. 2026/)).toHaveAttribute('aria-pressed', 'false');
  await expect(breakfast(/15\. 10\. 2026/)).toHaveAttribute('aria-pressed', 'true');
  await expect(breakfast(/16\. 10\. 2026/)).toHaveAttribute('aria-pressed', 'true');

  // Odpověď jde změnit – snídaně se zase zruší.
  await go(page, `${base}/vydaje`);
  const again = page.getByRole('region', { name: 'Výdaj 1' });
  await again.getByRole('button', { expanded: false }).first().click();
  await again.getByRole('button', { name: 'Snídaně v ceně nebyla' }).click();
  await go(page, `${base}/jidla`);
  await expect(breakfast(/15\. 10\. 2026/)).toHaveAttribute('aria-pressed', 'false');

  // Hromadně: večeře každý večer (např. pozvání od hostitele) a zase zrušit.
  await page.getByRole('button', { name: 'Večeře každý večer' }).click();
  const dinner = (day: RegExp) => page.getByRole('region', { name: day }).getByRole('button', { name: 'Večeře' });
  for (const d of [/14\. 10\. 2026/, /15\. 10\. 2026/, /16\. 10\. 2026/]) await expect(dinner(d)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Zrušit večeře' }).click();
  await expect(dinner(/15\. 10\. 2026/)).toHaveAttribute('aria-pressed', 'false');

  await go(page, `${base}/souhrn`);
  // Konec v pátek 16. 10. 2026, 28. 10. je svátek → 10. pracovní den je 2. 11. 2026.
  await expect(page.getByText('Vyúčtování předložte zaměstnavateli do 2. 11. 2026')).toBeVisible();
});
