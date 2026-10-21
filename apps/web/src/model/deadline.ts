// Lhůta pro vyúčtování pracovní cesty: do 10 pracovních dnů po jejím skončení (§ 183 odst. 1 zákoníku práce),
// pokud vnitřní předpis neurčí jinak (Ú-15). Pracovní den = ne sobota, neděle ani státní svátek / ostatní svátek ČR.

const FIXED = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'];

/** Velikonoční neděle (gregoriánský kalendář, algoritmus Meeus/Jones/Butcher). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Svátky v daném roce jako YYYY-MM-DD (včetně Velkého pátku a Velikonočního pondělí). */
export function holidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const shift = (days: number) => iso(new Date(easter.getTime() + days * 86_400_000));
  return new Set([...FIXED.map((md) => `${year}-${md}`), shift(-2), shift(1)]);
}

export const SUBMIT_WORKING_DAYS = 10;

/** Poslední den lhůty pro předložení vyúčtování (YYYY-MM-DD), nebo '' bez data konce cesty. */
export function submitDeadline(endDate: string, workingDays = SUBMIT_WORKING_DAYS): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(endDate)) return '';
  const d = new Date(`${endDate.slice(0, 10)}T00:00:00Z`);
  let left = workingDays;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6 && !holidays(d.getUTCFullYear()).has(iso(d))) left--;
  }
  return iso(d);
}
