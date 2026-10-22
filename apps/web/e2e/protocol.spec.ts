import { expect, test } from './fixtures.js';
import { go } from './helpers.js';

test('protokol výpočtu u tuzemské dvoudenní cesty: pásma, krácení, zaokrouhlení, soukromá část', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  const base = page.url().replace(/\/kdo$/, '');
  await page.goto(`${base}/prubeh`);
  await page.getByRole('button', { name: 'Zadat úseky ručně' }).click();
  const s1 = page.getByRole('region', { name: 'Úsek 1' });
  await s1.getByLabel('Odkud').fill('Praha');
  await s1.getByLabel('Kam').fill('Brno');
  await s1.getByLabel('Odjezd').fill('2026-03-10T07:00');
  await s1.getByLabel('Příjezd').fill('2026-03-10T10:00');
  await page.getByRole('button', { name: 'Přidat úsek' }).click();
  const s2 = page.getByRole('region', { name: 'Úsek 2' });
  await s2.getByLabel('Kam').fill('Praha');
  await s2.getByLabel('Odjezd').fill('2026-03-11T15:00');
  await s2.getByLabel('Příjezd').fill('2026-03-11T19:30');
  // Návrat ze soukromé části: 2 hodiny se do doby nepočítají.
  await page.getByRole('button', { name: 'Přidat úsek' }).click();
  const s3 = page.getByRole('region', { name: 'Úsek 3' });
  await s3.getByLabel('Kam').fill('Praha – návštěva');
  await s3.getByLabel('Odjezd').fill('2026-03-11T19:30');
  await s3.getByLabel('Příjezd').fill('2026-03-11T21:30');
  await s3.getByText('Dopravce, číslo spoje, soukromá část').click();
  await s3.getByText('Soukromá část cesty').click();

  await go(page, `${base}/jidla`);
  await page.getByRole('region', { name: /10\. 3\. 2026/ }).getByRole('button', { name: 'Oběd', exact: true }).click();
  await page.getByRole('region', { name: /11\. 3\. 2026/ }).getByRole('button', { name: 'Snídaně', exact: true }).click();

  await go(page, `${base}/souhrn`);
  const d1 = page.getByRole('listitem', { name: 'Den út 10. 3. 2026' });
  await expect(d1).toContainText('07:00–24:00 Česko 17 h');
  // 17 h → 12–18 h: 236 Kč, oběd −35 % = 82,60 → 153,40 → 154 Kč
  await expect(d1).toContainText('ČR 17 h → pásmo nad 12 do 18 h → sazba 236,00 Kč (zákonné minimum)');
  await expect(d1).toContainText('krácení: 1 jídlo × 35 % × 236,00 = 82,60 Kč');
  await expect(d1).toContainText('236,00 − 82,60 = 153,40 → 154,00 Kč (zaokrouhleno nahoru na celé Kč)');
  const d2 = page.getByRole('listitem', { name: 'Den st 11. 3. 2026' });
  await expect(d2).toContainText('19:30–21:30 Česko 2 h (soukromá část, nepočítá se)');
  // 19 h 30 min → nad 18 h: 370 Kč, snídaně −25 % = 92,50 → 277,50 → 278 Kč
  await expect(d2).toContainText('ČR 19 h 30 min → pásmo nad 18 h → sazba 370,00 Kč');
  await expect(d2).toContainText('370,00 − 92,50 = 277,50 → 278,00 Kč');
  await expect(d2).not.toContainText('Rozhodující stát');
  await expect(page.getByRole('region', { name: 'Přepočet na Kč' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Vyúčtování' })).toContainText('432,00 Kč');
});
