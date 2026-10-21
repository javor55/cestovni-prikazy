import { expect, test } from './fixtures.js';
import { go } from './helpers.js';

test('cesta autem do Záhřebu: plán se státy po cestě, převzetí do průběhu, úprava trasy', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  const base = page.url().replace(/\/kdo$/, '');
  await page.goto(`${base}/cesta`);
  await page.getByText('Zahraniční', { exact: true }).click();
  await page.getByLabel('Místo nástupu').fill('Ústí nad Labem');
  await page.getByLabel('Cílová místa').fill('Záhřeb');
  await page.getByLabel('Stát cíle').selectOption('HR');
  // Trasa: stát po cestě bez místa stačí.
  const route = page.getByRole('list', { name: 'Trasa' });
  await page.getByRole('button', { name: 'Místo nebo stát po cestě' }).click();
  await route.getByLabel('Stát').nth(0).selectOption('AT');
  await page.getByRole('button', { name: 'Místo nebo stát po cestě' }).click();
  await route.getByLabel('Stát').nth(1).selectOption('SI');
  await page.getByLabel('Dopravní prostředky', { exact: true }).selectOption('soukrome-auto');
  await page.getByLabel('Dopravní prostředky', { exact: true }).selectOption('taxi');
  await expect(page.getByRole('list', { name: 'Vybrané dopravní prostředky' })).toContainText('Soukromé autoTaxi');
  await page.getByRole('button', { name: 'Odebrat Taxi' }).click();
  await page.getByLabel('Plánovaný začátek').fill('2026-10-14T05:00');
  await page.getByLabel('Plánovaný konec').fill('2026-10-15T22:00');

  await go(page, `${base}/prubeh`);
  await page.getByRole('button', { name: 'Vyplnit podle plánu' }).click();
  const there = page.getByRole('region', { name: 'Úsek 1' });
  const back = page.getByRole('region', { name: 'Úsek 2' });
  await expect(there.getByRole('heading')).toHaveText('1. Ústí nad Labem → Záhřeb');
  await expect(back.getByRole('heading')).toHaveText('2. Záhřeb → Ústí nad Labem');
  await expect(there.getByLabel('Odjezd')).toHaveValue('2026-10-14T05:00');
  await expect(back.getByLabel('Příjezd')).toHaveValue('2026-10-15T22:00');
  // Tři přechody v jednom úseku: CZ → AT → SI → HR, zpět obráceně.
  for (const label of ['Přechod hranice CZ → AT', 'Přechod hranice AT → SI', 'Přechod hranice SI → HR']) await expect(there.getByLabel(label)).toBeVisible();
  for (const label of ['Přechod hranice HR → SI', 'Přechod hranice SI → AT', 'Přechod hranice AT → CZ']) await expect(back.getByLabel(label)).toBeVisible();

  await there.getByLabel('Příjezd').fill('2026-10-14T14:00');
  await there.getByLabel('Přechod hranice CZ → AT').fill('2026-10-14T06:30');
  await there.getByLabel('Přechod hranice AT → SI').fill('2026-10-14T11:00');
  await there.getByLabel('Přechod hranice SI → HR').fill('2026-10-14T12:30');

  // Jiná trasa zpět: bez Slovinska (přes Maďarsko) – stát po cestě jde změnit, odebrat i přidat.
  await back.getByLabel('Odjezd').fill('2026-10-15T13:00');
  await back.getByLabel(/Stát po cestě \(Chorvatsko/).selectOption('HU');
  await expect(back.getByLabel('Přechod hranice HR → HU')).toBeVisible();
  await back.getByRole('button', { name: 'Odebrat stát po cestě Rakousko' }).click();
  const problems = page.getByRole('list', { name: 'Problémy v tomto kroku' });
  // Maďarsko s Českem nesousedí – varování, ne chyba.
  await expect(problems).toContainText('HU a CZ spolu nesousedí');
  await back.getByRole('button', { name: 'Stát po cestě', exact: true }).click();
  await back.getByLabel(/Stát po cestě \(Maďarsko/).selectOption('SK');
  await expect(page.getByText(/nesousedí/)).toHaveCount(0);
  await back.getByLabel('Přechod hranice HR → HU').fill('2026-10-15T14:00');
  await back.getByLabel('Přechod hranice HU → SK').fill('2026-10-15T17:00');
  // Čas posledního přechodu chybí – varování s radou.
  await expect(problems).toContainText('chybí čas přechodu hranice SK → CZ');
  await back.getByLabel('Přechod hranice SK → CZ').fill('2026-10-15T19:00');
  await expect(page.getByText(/chybí čas přechodu/)).toHaveCount(0);
});
