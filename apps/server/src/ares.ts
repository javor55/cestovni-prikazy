// Vyhledání zaměstnavatele v ARES (Administrativní registr ekonomických subjektů, Ministerstvo financí).
// Dotaz obsahuje jen IČO nebo část názvu firmy – žádné údaje o zaměstnanci ani cestě.
// Modul nepoužívá nic z Node.js – běží v Node (Docker) i na Cloudflare.

export const ARES_URL = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

export interface AresSubject {
  ico: string;
  name: string;
  /** Sídlo jako jeden řádek („Letenská 525/15, Malá Strana, 11800 Praha 1“). */
  seat: string;
  /** Kód právní formy podle číselníku ČSÚ (např. 112 = s.r.o., 325 = organizační složka státu). */
  legalForm: string;
  /** Právní forma typická pro platovou sféru (stát, obec, kraj, příspěvková organizace). */
  publicSector: boolean;
  /** Datum zániku subjektu (YYYY-MM-DD), pokud zanikl. */
  dissolved?: string;
}

export interface AresSearch {
  total: number;
  subjects: AresSubject[];
}

/** Uživatelsky srozumitelná chyba – server ji vrátí klientovi jako text. */
export class AresError extends Error {
  readonly status: 400 | 404 | 502;
  constructor(message: string, status: 400 | 404 | 502) {
    super(message);
    this.status = status;
  }
}

// Organizační složka státu, příspěvková organizace, obec, kraj, městská část nebo obvod.
const PUBLIC_FORMS = new Set(['325', '331', '801', '804', '811']);

/** Kontrola IČO: 8 číslic, poslední je kontrolní (vážený součet modulo 11). */
export function validIco(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  const sum = [...ico.slice(0, 7)].reduce((s, d, i) => s + Number(d) * (8 - i), 0);
  return (11 - (sum % 11)) % 10 === Number(ico[7]);
}

interface RawAddress {
  textovaAdresa?: string;
}
interface RawSubject {
  ico?: string;
  obchodniJmeno?: string;
  sidlo?: RawAddress;
  adresaDorucovaci?: { radekAdresy1?: string; radekAdresy2?: string; radekAdresy3?: string };
  pravniForma?: string;
  datumZaniku?: string;
}

function toSubject(r: RawSubject): AresSubject {
  const d = r.adresaDorucovaci;
  const seat = r.sidlo?.textovaAdresa ?? [d?.radekAdresy1, d?.radekAdresy2, d?.radekAdresy3].filter(Boolean).join(', ');
  const legalForm = r.pravniForma ?? '';
  const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
  return {
    ico: r.ico ?? '',
    name: clean(r.obchodniJmeno ?? ''),
    seat: clean(seat),
    legalForm,
    publicSector: PUBLIC_FORMS.has(legalForm),
    ...(r.datumZaniku && { dissolved: r.datumZaniku }),
  };
}

export interface AresClient {
  byIco(ico: string): Promise<AresSubject>;
  search(name: string): Promise<AresSearch>;
}

const PAGE = 10;
const TTL = 24 * 3600_000;

/** Klient s krátkou mezipamětí v paměti – údaje v registru se mění zřídka. */
export function aresClient({ fetchImpl = fetch, url = ARES_URL }: { fetchImpl?: typeof fetch; url?: string } = {}): AresClient {
  const memory = new Map<string, { value: unknown; until: number }>();
  async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = memory.get(key);
    if (hit && hit.until > Date.now()) return hit.value as T;
    const value = await load();
    memory.set(key, { value, until: Date.now() + TTL });
    // Paměť se omezí, aby ji nešlo zaplnit tisíci různých dotazů.
    if (memory.size > 2000) memory.delete(memory.keys().next().value!);
    return value;
  }

  async function call(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
    let res: Response;
    try {
      res = await fetchImpl(`${url}${path}`, { ...init, headers: { Accept: 'application/json', ...init?.headers }, signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new AresError('ARES teď neodpovídá. Zkuste to později, nebo údaje vyplňte ručně.', 502);
    }
    const body = (await res.json().catch(() => undefined)) as unknown;
    return { status: res.status, body };
  }

  return {
    byIco: (ico) =>
      cached(`ico:${ico}`, async () => {
        const { status, body } = await call(`/${ico}`);
        if (status === 404) throw new AresError(`Subjekt s IČO ${ico} v ARES není.`, 404);
        if (status !== 200 || !body || typeof body !== 'object') throw new AresError('ARES vrátil neočekávanou odpověď. Údaje vyplňte ručně.', 502);
        return toSubject(body as RawSubject);
      }),
    search: (name) =>
      cached(`name:${name.toLocaleLowerCase('cs')}`, async () => {
        const { status, body } = await call('/vyhledat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ obchodniJmeno: name, pocet: PAGE, start: 0 }),
        });
        const b = (body ?? {}) as { pocetCelkem?: number; ekonomickeSubjekty?: RawSubject[]; subKod?: string; popis?: string };
        if (status === 404 || b.subKod === 'VYSTUP_SUBJEKT_NENALEZEN') return { total: 0, subjects: [] };
        if (b.subKod === 'VYSTUP_PRILIS_MNOHO_VYSLEDKU') {
          const count = /\(([\d\s ]+)\)/.exec(b.popis ?? '')?.[1]?.trim();
          throw new AresError(`Názvu odpovídá příliš mnoho subjektů${count ? ` (${count})` : ''}. Upřesněte název, nebo zadejte IČO.`, 400);
        }
        if (status !== 200 || !Array.isArray(b.ekonomickeSubjekty)) throw new AresError('ARES vrátil neočekávanou odpověď. Údaje vyplňte ručně.', 502);
        return { total: b.pocetCelkem ?? b.ekonomickeSubjekty.length, subjects: b.ekonomickeSubjekty.map(toSubject) };
      }),
  };
}
