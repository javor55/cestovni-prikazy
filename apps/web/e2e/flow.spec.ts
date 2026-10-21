import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.js';

const shot = (page: Page, name: string) =>
  process.env.SHOTS ? page.screenshot({ path: `${process.env.SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true }) : undefined;

async function next(page: Page) {
  await page.getByRole('link', { name: /^Pokračovat:/ }).click();
}

test('celá zahraniční cesta: vyplnění, výpočet, uložení a smazání', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cestovní příkaz a vyúčtování cesty' })).toBeVisible();
  await shot(page, '01-uvod');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();

  // 1 Kdo cestuje
  await page.getByLabel('Jméno a příjmení').fill('Jana Ukázková');
  await page.getByLabel('Pravidelné pracoviště').fill('Praha, Ukázková 12');
  await page.getByLabel('Název').fill('Ukázková firma s.r.o.');
  await page.getByLabel('Sídlo').fill('Praha 1');
  await shot(page, '02-kdo');
  await next(page);

  // 2 Údaje o cestě
  await page.getByRole('button', { name: 'Navrhnout číslo' }).click();
  await expect(page.getByLabel('Číslo cestovního příkazu')).toHaveValue(/^CP-\d{4}-\d{4}$/);
  await page.getByLabel('Účel cesty').fill('Jednání s dodavatelem');
  await page.getByText('Zahraniční', { exact: true }).click();
  await page.getByLabel('Místo nástupu').fill('Praha');
  await page.getByLabel('Plánovaný začátek').fill('2026-10-14T06:30');
  await page.getByLabel('Plánovaný konec').fill('2026-10-16T19:00');
  await page.getByRole('button', { name: 'Přidat zálohu' }).click();
  await page.getByLabel('Částka').fill('100');
  await page.getByLabel('Vyplaceno dne').fill('2026-10-12');
  await page.getByLabel('Kurz Kč za 1 EUR').fill('24,35');
  await next(page);

  // 3 Průběh: tam a zpět s přechodem hranice
  await page.getByRole('button', { name: 'Zadat úseky ručně' }).click();
  const s1 = page.getByRole('region', { name: 'Úsek 1' });
  await s1.getByLabel('Kam').fill('Vídeň');
  await s1.getByLabel('Stát').nth(1).selectOption('AT');
  await s1.getByLabel('Odjezd').fill('2026-10-14T06:30');
  await s1.getByLabel('Příjezd').fill('2026-10-14T11:00');
  await s1.getByLabel('Dopravní prostředek').selectOption('soukrome-auto');
  await s1.getByLabel('Kilometry').fill('343');
  await s1.getByLabel(/Přechod hranice/).fill('2026-10-14T09:45');
  await page.getByRole('button', { name: 'Přidat zpáteční cestu' }).click();
  const s2 = page.getByRole('region', { name: 'Úsek 2' });
  await expect(s2.getByLabel('Kam')).toHaveValue('Praha');
  await s2.getByLabel('Odjezd').fill('2026-10-16T14:00');
  await s2.getByLabel('Příjezd').fill('2026-10-16T18:30');
  await s2.getByLabel(/Přechod hranice/).fill('2026-10-16T15:15');
  await shot(page, '03-prubeh');
  await next(page);

  // 4 Jídla: snídaně v hotelu, oběd 15. 10.
  await page.getByRole('button', { name: 'Snídaně každé ráno (v ceně ubytování)' }).click();
  await page.getByRole('region', { name: /15\. 10\. 2026/ }).getByRole('button', { name: 'Oběd' }).click();
  await expect(page.getByRole('region', { name: /15\. 10\. 2026/ })).toContainText('23,00 EUR');
  await expect(page.getByRole('region', { name: /16\. 10\. 2026/ })).toContainText('20,00 EUR');
  await shot(page, '04-jidla');
  await next(page);

  // 5 Výdaje: hotel v EUR podle potvrzení banky
  await page.getByRole('button', { name: 'Přidat výdaj' }).click();
  const e1 = page.getByRole('region', { name: 'Výdaj 1' });
  await e1.getByLabel('Kategorie').selectOption('Ubytování');
  await e1.getByLabel('Datum').fill('2026-10-16');
  await e1.getByLabel('Částka', { exact: true }).fill('238');
  await e1.getByLabel('Přepočet na Kč').selectOption('BANK_CONFIRMATION');
  await e1.getByLabel('Stržená částka v Kč').fill('5 812,44');
  await expect(e1).toContainText('kurzu 24,422');
  await shot(page, '05-vydaje');
  await next(page);

  // 6 Vozidlo
  await page.getByText('Na cestě jsem použil(a) osobní vozidlo').click();
  await page.getByLabel(/Spotřeba podle technického průkazu/).fill('5,6');
  await page.getByRole('button', { name: /Použít 686 km/ }).click();
  await page.getByText('Cena z jednoho dokladu', { exact: true }).click();
  await page.getByLabel(/Cena za 1 l z dokladu/).fill('38,90');
  await expect(page.getByRole('region', { name: 'Výpočet náhrady' })).toContainText('5 541,78 Kč');
  await next(page);

  // 7 Souhrn: 73 EUR stravné − záloha 100 = −27 EUR × 24,35 = −657,45; 5 812,44 + 5 541,78 − 657,45 = 10 696,77 → 10 697 Kč
  const result = page.getByRole('region', { name: 'Výsledek' });
  await expect(result).toContainText('K výplatě zaměstnanci');
  await expect(result).toContainText('10 697,00 Kč');
  await shot(page, '07-souhrn');
  await next(page);

  // 8 Kontrola: bez chyb
  await expect(page.getByText('Žádné chyby.')).toBeVisible();
  await shot(page, '08-kontrola');

  // Data přežijí obnovení stránky (po potvrzení uložení, které uživatel vidí v hlavičce)
  await expect(page.getByText('uloženo v prohlížeči')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Žádné chyby.')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Jednání s dodavatelem/ })).toBeVisible();

  // Smazání cesty
  await page.getByRole('link', { name: /Jednání s dodavatelem/ }).click();
  await page.getByRole('button', { name: 'Smazat data cesty' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
  await expect(page.getByText('Data cesty byla odstraněna')).toBeVisible();
  await expect(page.getByRole('link', { name: /Jednání s dodavatelem/ })).toHaveCount(0);
});

test('chyba v časové ose se ukáže v kroku i v kontrole s odkazem na opravu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  await page.goto(page.url().replace('/kdo', '/prubeh'));
  await page.getByRole('button', { name: 'Zadat úseky ručně' }).click();
  const s1 = page.getByRole('region', { name: 'Úsek 1' });
  await s1.getByLabel('Odjezd').fill('2026-03-10T10:00');
  await s1.getByLabel('Příjezd').fill('2026-03-10T09:00');
  // Konec (poslední příjezd) je před začátkem (první odjezd) – blokující chyba s radou, co opravit.
  const problems = page.getByRole('list', { name: 'Problémy v tomto kroku' });
  await expect(problems).toContainText('Chyba:');
  await expect(problems).toContainText('Opravte data a časy cesty');
  await page.goto(page.url().replace('/prubeh', '/kontrola'));
  await expect(page.getByRole('link', { name: 'Opravit v kroku „Průběh cesty“' }).first()).toBeVisible();
});

test('na šířce stránky nevzniká vodorovný posuvník', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  for (const step of ['kdo', 'cesta', 'prubeh', 'vydaje', 'souhrn', 'kontrola']) {
    await page.goto(page.url().replace(/\/[a-z]+$/, `/${step}`));
    await expect(page).toHaveURL(new RegExp(`/cesta/.+/${step}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `krok ${step}`).toBeLessThanOrEqual(0);
  }
});
