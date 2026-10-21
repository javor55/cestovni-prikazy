import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { cnbClient, parseCnb } from '../src/cnb.js';
import { fileStore } from '../src/fileStore.js';
import { cloudflareHeaders } from '../src/headers.js';

// Ukázka ve formátu kurzovního lístku ČNB (hodnoty kurzů jsou ilustrativní).
const SAMPLE = `16.10.2026 #201
země|měna|množství|kód|kurz
Austrálie|dolar|1|AUD|14,512
EMU|euro|1|EUR|24,315
Japonsko|jen|100|JPY|15,432
USA|dolar|1|USD|21,500
Velká Británie|libra|1|GBP|28,120
`;

const response = (text: string, status = 200) => new Response(text, { status });

describe('kurzovní lístek ČNB', () => {
  it('rozebere datum, číslo a kurzy včetně množství', () => {
    const r = parseCnb(SAMPLE);
    expect(r.date).toBe('2026-10-16');
    expect(r.number).toBe('201');
    expect(r.rates.EUR).toEqual({ country: 'EMU', name: 'euro', amount: 1, rate: '24.315' });
    expect(r.rates.JPY).toMatchObject({ amount: 100, rate: '15.432' });
  });

  it('odmítne neočekávaný formát', () => {
    expect(() => parseCnb('<html>chyba</html>')).toThrow();
    expect(() => parseCnb('16.10.2026 #201\nzemě|měna|množství|kód|kurz\nEMU|euro|1|EUR|abc')).toThrow();
  });

  it('dotáže se ČNB na datum ve tvaru DD.MM.RRRR a minulé dny drží v mezipaměti', async () => {
    const fetchImpl = vi.fn(async () => response(SAMPLE));
    const dir = await mkdtemp(join(tmpdir(), 'cnb-'));
    const c = cnbClient({ fetchImpl, store: fileStore(dir), today: () => '2026-10-21' });
    await c.get('2026-10-18');
    await c.get('2026-10-18');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toMatch(/\?date=18\.10\.2026$/);
    // Nový klient (restart serveru) načte lístek z disku bez dotazu na ČNB.
    const again = vi.fn(async () => response(SAMPLE));
    expect((await cnbClient({ fetchImpl: again, store: fileStore(dir), today: () => '2026-10-21' }).get('2026-10-18')).date).toBe('2026-10-16');
    expect(again).not.toHaveBeenCalled();
  });
});

describe('GET /api/kurzy', () => {
  const app = (fetchImpl: typeof fetch = async () => response(SAMPLE), limit = 60) =>
    createApp({ cnb: cnbClient({ fetchImpl, today: () => '2026-10-21' }), today: () => '2026-10-21', clientKey: (c) => c.req.header('x-test-ip') ?? '', rateLimitPerMinute: limit });

  it('vrátí kurzy pro datum', async () => {
    const res = await app().request('/api/kurzy?datum=2026-10-18');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { date: string; rates: Record<string, { rate: string }> };
    expect(body.date).toBe('2026-10-16');
    expect(body.rates.EUR!.rate).toBe('24.315');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('odmítne neplatné a budoucí datum', async () => {
    expect((await app().request('/api/kurzy?datum=18.10.2026')).status).toBe(400);
    expect((await app().request('/api/kurzy?datum=2026-10-22')).status).toBe(400);
    expect((await app().request('/api/kurzy')).status).toBe(400);
  });

  it('při výpadku ČNB vrátí 502 se srozumitelnou zprávou', async () => {
    const res = await app(async () => response('', 503)).request('/api/kurzy?datum=2026-10-18');
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toContain('zadejte kurz ručně');
  });

  it('bezpečnostní hlavičky včetně CSP, neznámá adresa API, kontrola stavu', async () => {
    const res = await app().request('/api/neco');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(await (await app().request('/zdravi')).text()).toBe('ok');
  });

  it('limit počtu požadavků na jednu adresu', async () => {
    const a = app(undefined, 3);
    const get = (ip: string) => a.request('/api/kurzy?datum=2026-10-18', { headers: { 'x-test-ip': ip } });
    for (let i = 0; i < 3; i++) expect((await get('1.1.1.1')).status).toBe(200);
    const blocked = await get('1.1.1.1');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(((await blocked.json()) as { error: string }).error).toContain('Příliš mnoho');
    // Jiná adresa limit nesdílí.
    expect((await get('2.2.2.2')).status).toBe(200);
  });
});

describe('Cloudflare', () => {
  it('soubor _headers obsahuje CSP pro všechny stránky a dlouhou mezipaměť pro assets', () => {
    const h = cloudflareHeaders();
    expect(h).toMatch(/^\/\*\n  Content-Security-Policy: default-src 'self';/);
    expect(h).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable');
    expect(h).toContain('/sw.js\n  Cache-Control: no-cache');
  });
});

