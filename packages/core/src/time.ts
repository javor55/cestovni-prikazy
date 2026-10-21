// Časy cesty se zadávají v českém místním čase (předpoklad Ú-9) jako „YYYY-MM-DDTHH:mm“.
// Interně se převádějí na minuty od epochy UTC, aby dny se změnou času měly správně 23 nebo 25 hodin.

export const TIME_ZONE = 'Europe/Prague';

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Posun Europe/Prague oproti UTC v minutách v daném okamžiku. */
function offsetAt(utcMs: number): number {
  const p: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!);
  return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000);
}

export function isLocalDateTime(s: string): boolean {
  return LOCAL_RE.test(s);
}

export function isIsoDate(s: string): boolean {
  return DATE_RE.test(s);
}

/**
 * Převede místní čas na minuty od epochy. Neexistující čas při jarní změně času vyhodí chybu,
 * u dvojznačného času při podzimní změně se použije dřívější (letní) okamžik.
 */
export function toInstant(local: string): number {
  const m = LOCAL_RE.exec(local);
  if (!m) throw new Error(`Neplatný čas „${local}“, očekáváno YYYY-MM-DDTHH:mm`);
  const naive = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  // Zkusíme oba možné posuny (zimní +60 a letní +120) a vezmeme ten, který dá zpět stejný místní čas.
  const candidates = [120, 60]
    .map((off) => naive - off * 60000)
    .filter((t) => offsetAt(t) * 60000 + t === naive);
  if (candidates.length === 0) throw new Error(`Čas ${local} v českém čase neexistuje (změna času)`);
  return Math.min(...candidates) / 60000;
}

/** Začátek kalendářního dne (00:00 místního času) v minutách od epochy. */
export function dayStart(date: string): number {
  return toInstant(`${date}T00:00`);
}

export function datePart(local: string): string {
  return local.slice(0, 10);
}

/** Následující kalendářní den ve formátu YYYY-MM-DD. */
export function nextDate(date: string): string {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Neplatné datum „${date}“`);
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]! + 1));
  return d.toISOString().slice(0, 10);
}

/** Všechny kalendářní dny od–do včetně. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = nextDate(d)) out.push(d);
  return out;
}

/** Průnik dvou intervalů [a1, a2) a [b1, b2) v minutách. */
export function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

const dayNames = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

/** „st 14. 10. 2026“ */
export function formatDate(date: string): string {
  const m = DATE_RE.exec(date)!;
  const wd = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).getUTCDay();
  return `${dayNames[wd]} ${+m[3]!}. ${+m[2]!}. ${m[1]}`;
}

/** „14 h 15 min“ */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
