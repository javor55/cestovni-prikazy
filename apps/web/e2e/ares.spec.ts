import { expect, test } from './fixtures.js';

const MF = { ico: '00006947', name: 'Ministerstvo financí', seat: 'Letenská 525/15, Malá Strana, 11800 Praha 1', legalForm: '325', publicSector: true };
const SKODA = [
  { ico: '00177041', name: 'Škoda Auto a.s.', seat: 'tř. Václava Klementa 869, Mladá Boleslav II, 29301 Mladá Boleslav', legalForm: '121', publicSector: false },
  { ico: '07700903', name: 'Nadační fond Škoda Auto', seat: 'tř. Václava Klementa 869, 29301 Mladá Boleslav', legalForm: '118', publicSector: false },
];

test('zaměstnavatel z ARES podle názvu i IČO', async ({ page }) => {
  const queries: string[] = [];
  await page.route('**/api/ares?*', (route) => {
    const q = new URL(route.request().url()).searchParams;
    queries.push(q.toString());
    if (q.get('ico')?.padStart(8, '0') === '00006947') return route.fulfill({ json: { total: 1, subjects: [MF] } });
    if (q.get('nazev') === 'Novák') return route.fulfill({ status: 400, json: { error: 'Názvu odpovídá příliš mnoho subjektů (8 581). Upřesněte název, nebo zadejte IČO.' } });
    return route.fulfill({ json: { total: 12, subjects: SKODA } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Nová pracovní cesta' }).click();
  await page.waitForURL(/\/kdo$/);
  const search = page.getByRole('search', { name: 'Vyhledat zaměstnavatele v ARES' });

  await search.getByLabel('Vyhledat v ARES').fill('Novák');
  await search.getByRole('button', { name: 'Vyhledat' }).click();
  await expect(search).toContainText('Chyba: Názvu odpovídá příliš mnoho subjektů (8 581)');

  await search.getByLabel('Vyhledat v ARES').fill('škoda auto');
  await search.getByLabel('Vyhledat v ARES').press('Enter');
  await expect(page.getByText('Prvních 2 z 12 – případně upřesněte název.')).toBeVisible();
  await page.getByRole('button', { name: /Škoda Auto a\.s\./ }).click();
  await expect(page.getByLabel('Název', { exact: true })).toHaveValue('Škoda Auto a.s.');
  await expect(page.getByLabel('Sídlo')).toHaveValue('tř. Václava Klementa 869, Mladá Boleslav II, 29301 Mladá Boleslav');
  await page.getByText('IČO, organizační jednotka').click();
  await expect(page.getByLabel('IČO')).toHaveValue('00177041');
  await expect(page.getByLabel('Soukromá firma')).toBeChecked();

  // IČO bez úvodních nul se doplní rovnou; právní forma státu přepne na platovou sféru.
  await search.getByLabel('Vyhledat v ARES').fill('6947');
  await search.getByRole('button', { name: 'Vyhledat' }).click();
  await expect(page.getByLabel('Název', { exact: true })).toHaveValue('Ministerstvo financí');
  await expect(page.getByLabel('IČO')).toHaveValue('00006947');
  await expect(page.getByText(/Podle právní formy jde o platovou sféru/)).toBeVisible();
  await expect(page.getByLabel(/Stát, obec, kraj/)).toBeChecked();
  expect(queries).toEqual(['nazev=Nov%C3%A1k', 'nazev=%C5%A1koda+auto', 'ico=6947']);

  // Ručně zadané IČO: krátké a s chybnou kontrolní číslicí.
  await page.getByLabel('IČO').fill('6947');
  await expect(page.getByText('Chyba: IČO má 8 číslic.')).toBeVisible();
  await page.getByLabel('IČO').fill('00006948');
  await expect(page.getByText('Chyba: IČO nesedí s kontrolní číslicí – zkontrolujte ho.')).toBeVisible();
});
