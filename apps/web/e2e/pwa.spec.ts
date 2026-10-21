import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.js';
import { tripWithPdf } from './helpers.js';

test('aplikace jde nainstalovat a po první návštěvě se otevře i bez připojení', async ({ page, context }) => {
  await page.goto('/');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Cestovní příkazy', lang: 'cs', display: 'standalone', start_url: '/' });
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);

  // Po registraci service workeru se soubory aplikace uloží při dalším načtení.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nová pracovní cesta' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cestovní příkaz a vyúčtování cesty' })).toBeVisible();
  // Bez připojení jde i založit cestu – data jsou v prohlížeči.
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await expect(page.getByLabel('Jméno a příjmení')).toBeVisible();
  await context.setOffline(false);
});

test('přístupnost: hlavní obrazovky bez závažných nálezů (axe)', async ({ page }) => {
  const check = async (name: string) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${name}: ${v.id} – ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`)).toEqual([]);
  };
  await page.goto('/');
  await check('úvod');
  const base = await tripWithPdf(page);
  for (const step of ['kdo', 'cesta', 'prubeh', 'jidla', 'vydaje', 'vozidlo', 'souhrn', 'kontrola', 'pdf', 'podpis', 'kompletni', 'export']) {
    await page.goto(`${base}/${step}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await check(step);
  }
});
