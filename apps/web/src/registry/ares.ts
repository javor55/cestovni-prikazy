// Vyhledání zaměstnavatele v ARES přes server aplikace. Server dostane jen IČO nebo název firmy, nic o cestě ani zaměstnanci.

export interface AresSubject {
  ico: string;
  name: string;
  seat: string;
  legalForm: string;
  /** Právní forma typická pro platovou sféru (stát, obec, kraj, příspěvková organizace). */
  publicSector: boolean;
  dissolved?: string;
}

export interface AresResult {
  total: number;
  subjects: AresSubject[];
}

export class AresError extends Error {}

/** Kontrola IČO: 8 číslic, poslední je kontrolní (vážený součet modulo 11). Stejná kontrola je na serveru. */
export function validIco(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  const sum = [...ico.slice(0, 7)].reduce((s, d, i) => s + Number(d) * (8 - i), 0);
  return (11 - (sum % 11)) % 10 === Number(ico[7]);
}

/** Číslice (s mezerami) se hledají jako IČO, cokoli jiného jako název firmy. */
export function aresQuery(text: string): string | undefined {
  const t = text.trim();
  if (/^[\d\s]+$/.test(t)) return `ico=${t.replace(/\s/g, '')}`;
  if (t.length >= 3) return `nazev=${encodeURIComponent(t)}`;
  return undefined;
}

export async function searchAres(text: string): Promise<AresResult> {
  const q = aresQuery(text);
  if (!q) throw new AresError('Zadejte IČO, nebo alespoň 3 znaky názvu firmy.');
  let res: Response;
  try {
    res = await fetch(`/api/ares?${q}`);
  } catch {
    throw new AresError('ARES se nepodařilo zavolat (jste offline?). Údaje vyplňte ručně.');
  }
  const body = (await res.json().catch(() => ({}))) as Partial<AresResult> & { error?: string };
  if (!res.ok || !Array.isArray(body.subjects)) throw new AresError(body.error ?? 'ARES se nepodařilo zavolat. Údaje vyplňte ručně.');
  return { total: body.total ?? body.subjects.length, subjects: body.subjects };
}
