// Výběr částí kompletní dokumentace. Volba se pamatuje v prohlížeči (nepatří k údajům cesty,
// takže její změna neoznačí PDF k podpisu jako zastaralé).
import type { AssemblyParts } from '@cp/documents';

export const ALL: AssemblyParts = {
  cover: true,
  signed: true,
  calculation: true,
  expenseOverview: true,
  expenseIdPages: true,
  accounting: true,
  payment: true,
  expenseSupporting: true,
  vehicle: true,
  supporting: true,
};

/** Jen podepsaný dokument a u každého výdaje jeho doklady (účetní doklad, doklad o zaplacení). */
export const SIGNED_AND_RECEIPTS: AssemblyParts = {
  cover: false,
  signed: true,
  calculation: false,
  expenseOverview: false,
  expenseIdPages: false,
  accounting: true,
  payment: true,
  expenseSupporting: false,
  vehicle: false,
  supporting: false,
};

export const partLabels: [keyof AssemblyParts, string][] = [
  ['cover', 'Krycí list a obsah'],
  ['signed', 'Podepsaný cestovní příkaz a vyúčtování'],
  ['calculation', 'Detailní přehled výpočtu'],
  ['expenseOverview', 'Přehled výdajů'],
  ['expenseIdPages', 'Identifikační stránka před doklady každého výdaje'],
  ['accounting', 'Účetní doklady k výdajům'],
  ['payment', 'Doklady o zaplacení k výdajům'],
  ['expenseSupporting', 'Doplňující dokumenty k výdajům'],
  ['vehicle', 'Doklady k vozidlu'],
  ['supporting', 'Doplňující přílohy k cestě'],
];

const KEY = 'cp.kompletni.casti';

export function loadParts(): AssemblyParts {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AssemblyParts> | null;
    if (saved && typeof saved === 'object') return { ...ALL, ...Object.fromEntries(Object.entries(saved).filter(([k, v]) => k in ALL && typeof v === 'boolean')) };
  } catch {
    // Úložiště nemusí být dostupné (soukromé okno) – použije se výchozí výběr.
  }
  return ALL;
}

export function saveParts(p: AssemblyParts) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Bez úložiště se volba jen nezapamatuje.
  }
}

export const sameParts = (a: AssemblyParts, b: AssemblyParts) => partLabels.every(([k]) => a[k] === b[k]);
