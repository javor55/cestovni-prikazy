import { describe, expect, it, vi } from 'vitest';
import { aresClient, validIco } from '../src/ares.js';
import { createApp } from '../src/app.js';
import { cnbClient } from '../src/cnb.js';

// Zkrácené skutečné odpovědi ARES (říjen 2026).
const MF = {
  ico: '00006947',
  obchodniJmeno: 'Ministerstvo financí',
  sidlo: { kodStatu: 'CZ', nazevObce: 'Praha', textovaAdresa: 'Letenská 525/15, Malá Strana, 11800 Praha 1' },
  pravniForma: '325',
  dic: 'CZ00006947',
};
const SEARCH = {
  pocetCelkem: 12,
  ekonomickeSubjekty: [
    { ico: '00177041', obchodniJmeno: 'Škoda Auto a.s.', sidlo: { textovaAdresa: 'tř. Václava Klementa 869, Mladá Boleslav II, 29301 Mladá Boleslav' }, pravniForma: '121' },
    { ico: '07700903', obchodniJmeno: 'Nadační fond  Škoda Auto', datumZaniku: '2025-01-31', adresaDorucovaci: { radekAdresy1: 'tř. Václava Klementa 869', radekAdresy3: '29301 Mladá Boleslav' }, pravniForma: '118' },
  ],
};
const NOT_FOUND = { kod: 'NENALEZENO', popis: 'Nebyl nalezen žádný subjekt…', subKod: 'VYSTUP_SUBJEKT_NENALEZEN' };
const TOO_MANY = { kod: 'CHYBA_VSTUPU', popis: 'Zadaný dotaz vrací příliš mnoho výsledků (8 581). Povoleno je maximálně 1 000 výsledků.|Chyba vstupu', subKod: 'VYSTUP_PRILIS_MNOHO_VYSLEDKU' };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeAres() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/00006947')) return json(MF);
    if (url.endsWith('/vyhledat')) {
      const name = (JSON.parse(String(init?.body)) as { obchodniJmeno: string }).obchodniJmeno;
      if (name === 'novák') return json(TOO_MANY, 400);
      if (name.startsWith('škoda')) return json(SEARCH);
      return json(NOT_FOUND, 404);
    }
    return json(NOT_FOUND, 404);
  });
}

const app = (fetchImpl = fakeAres()) => ({
  fetchImpl,
  app: createApp({ cnb: cnbClient({ fetchImpl: async () => new Response('') }), ares: aresClient({ fetchImpl }) }),
});
const get = async (a: ReturnType<typeof app>['app'], q: string) => {
  const res = await a.request(`/api/ares?${q}`);
  return { status: res.status, body: (await res.json()) as { error?: string; total?: number; subjects?: Record<string, unknown>[] } };
};

describe('IČO', () => {
  it('ověří kontrolní číslici', () => {
    expect(validIco('00006947')).toBe(true);
    expect(validIco('00177041')).toBe(true);
    expect(validIco('27074358')).toBe(true);
    expect(validIco('00006948')).toBe(false);
    expect(validIco('6947')).toBe(false);
  });
});

describe('GET /api/ares', () => {
  it('najde subjekt podle IČO a doplní nuly na začátku', async () => {
    const { app: a, fetchImpl } = app();
    const r = await get(a, 'ico=6947');
    expect(r.status).toBe(200);
    expect(r.body.subjects).toEqual([{ ico: '00006947', name: 'Ministerstvo financí', seat: 'Letenská 525/15, Malá Strana, 11800 Praha 1', legalForm: '325', publicSector: true }]);
    // Opakovaný dotaz jde z mezipaměti.
    await get(a, 'ico=00006947');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('odmítne chybné IČO bez dotazu do ARES', async () => {
    const { app: a, fetchImpl } = app();
    expect((await get(a, 'ico=00006948')).body.error).toMatch(/kontrolní číslici/);
    expect((await get(a, 'ico=123456789')).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('neexistující IČO vrátí 404 s vysvětlením', async () => {
    const r = await get(app().app, 'ico=00000019');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Subjekt s IČO 00000019 v ARES není.');
  });

  it('vyhledá podle názvu a sestaví sídlo i z doručovací adresy', async () => {
    const { app: a, fetchImpl } = app();
    const r = await get(a, `nazev=${encodeURIComponent('  škoda   auto ')}`);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(12);
    expect(r.body.subjects!.map((s) => [s.ico, s.name, s.seat, s.dissolved])).toEqual([
      ['00177041', 'Škoda Auto a.s.', 'tř. Václava Klementa 869, Mladá Boleslav II, 29301 Mladá Boleslav', undefined],
      ['07700903', 'Nadační fond Škoda Auto', 'tř. Václava Klementa 869, 29301 Mladá Boleslav', '2025-01-31'],
    ]);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body))).toEqual({ obchodniJmeno: 'škoda auto', pocet: 10, start: 0 });
  });

  it('nic nenalezeno je prázdný seznam, příliš mnoho výsledků je srozumitelná chyba', async () => {
    const { app: a } = app();
    expect((await get(a, 'nazev=xyzzy')).body).toEqual({ total: 0, subjects: [] });
    const many = await get(a, 'nazev=novák');
    expect(many.status).toBe(400);
    expect(many.body.error).toBe('Názvu odpovídá příliš mnoho subjektů (8 581). Upřesněte název, nebo zadejte IČO.');
  });

  it('krátký dotaz odmítne, výpadek ARES vrátí 502 a neuloží se do mezipaměti', async () => {
    expect((await get(app().app, 'nazev=ab')).status).toBe(400);
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const { app: a } = app(down as never);
    const r = await get(a, 'ico=00006947');
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/ARES teď neodpovídá/);
    await get(a, 'ico=00006947');
    expect(down).toHaveBeenCalledTimes(2);
  });

  it('bez klienta ARES vrátí 404', async () => {
    const a = createApp({ cnb: cnbClient({ fetchImpl: async () => new Response('') }) });
    expect((await a.request('/api/ares?ico=00006947')).status).toBe(404);
  });
});
