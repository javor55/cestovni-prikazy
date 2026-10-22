// Kontrola čísla účtu pro výplatu: český tvar „předčíslí-číslo/kód banky“ (modulo 11), nebo IBAN (modulo 97).

const WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];

function mod11(digits: string): boolean {
  const padded = digits.padStart(10, '0');
  return [...padded].reduce((s, d, i) => s + Number(d) * WEIGHTS[i]!, 0) % 11 === 0;
}

function iban(text: string): boolean {
  const s = text.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const c of moved) {
    const n = c >= 'A' ? String(c.charCodeAt(0) - 55) : c;
    for (const d of n) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** Chyba v čísle účtu (text pro uživatele), nebo undefined, když je číslo v pořádku nebo prázdné. */
export function bankAccountProblem(text: string): string | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (/^[A-Za-z]{2}/.test(t)) return iban(t) ? undefined : 'IBAN nemá správný tvar nebo kontrolní číslice.';
  const m = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/.exec(t.replace(/\s/g, ''));
  if (!m) return 'Zadejte číslo účtu ve tvaru 123456789/0800 (případně s předčíslím 19-123456789/0800), nebo IBAN.';
  if ((m[1] && !mod11(m[1])) || !mod11(m[2]!)) return 'Číslo účtu nesedí s kontrolním součtem – zkontrolujte ho.';
  return undefined;
}
