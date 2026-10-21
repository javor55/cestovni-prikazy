import { Hono, type Context } from 'hono';
import { AresError, validIco, type AresClient } from './ares.js';
import type { CnbClient } from './cnb.js';
import { securityHeaders } from './headers.js';
import { rateLimit } from './rateLimit.js';

export interface AppOptions {
  cnb: CnbClient;
  ares?: AresClient;
  today?: () => string;
  /** Identifikace klienta pro limit počtu požadavků (IP adresa). */
  clientKey?: (c: Context) => string;
  /** Počet požadavků na API za minutu z jedné adresy. */
  rateLimitPerMinute?: number;
}

/** API aplikace. Sdílí ho server v Node (Docker) i Worker na Cloudflare. */
export function createApp({ cnb, ares, today = () => new Date().toISOString().slice(0, 10), clientKey = () => 'vsichni', rateLimitPerMinute = 60 }: AppOptions) {
  const app = new Hono();

  app.use('*', async (c, next) => {
    await next();
    for (const [k, v] of Object.entries(securityHeaders)) c.header(k, v);
  });
  // Pro kontrolu stavu kontejneru (Docker healthcheck) – mimo limit požadavků.
  app.get('/zdravi', (c) => c.text('ok'));
  app.use('/api/*', rateLimit({ limit: rateLimitPerMinute, key: clientKey }));

  // Kurzy ČNB. Požadavek obsahuje jen datum – žádné údaje o uživateli ani cestě.
  app.get('/api/kurzy', async (c) => {
    const date = c.req.query('datum') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      return c.json({ error: 'Zadejte datum ve tvaru RRRR-MM-DD.' }, 400);
    }
    if (date > today()) return c.json({ error: 'Kurz pro budoucí datum ještě není vyhlášen.' }, 400);
    if (date < '1991-01-01') return c.json({ error: 'Kurzy ČNB jsou k dispozici od roku 1991.' }, 400);
    try {
      const rates = await cnb.get(date);
      c.header('Cache-Control', date < today() ? 'public, max-age=86400' : 'public, max-age=600');
      return c.json(rates);
    } catch {
      return c.json({ error: 'Kurz ČNB se nepodařilo načíst. Zkuste to později, nebo zadejte kurz ručně podle cnb.cz.' }, 502);
    }
  });

  // Vyhledání zaměstnavatele v ARES podle IČO nebo názvu. Dotaz obsahuje jen IČO nebo název firmy.
  app.get('/api/ares', async (c) => {
    if (!ares) return c.json({ error: 'Vyhledávání v ARES není na tomto serveru zapnuté.' }, 404);
    const ico = c.req.query('ico')?.replace(/\s/g, '');
    const name = c.req.query('nazev')?.trim().replace(/\s+/g, ' ');
    try {
      if (ico !== undefined) {
        if (!/^\d{1,8}$/.test(ico)) return c.json({ error: 'IČO má nejvýše 8 číslic.' }, 400);
        const full = ico.padStart(8, '0');
        if (!validIco(full)) return c.json({ error: `IČO ${full} nemá správnou kontrolní číslici. Zkontrolujte ho.` }, 400);
        const subject = await ares.byIco(full);
        c.header('Cache-Control', 'private, max-age=3600');
        return c.json({ total: 1, subjects: [subject] });
      }
      if (name === undefined || name.length < 3 || name.length > 100) return c.json({ error: 'Zadejte IČO, nebo alespoň 3 znaky názvu firmy.' }, 400);
      const found = await ares.search(name);
      c.header('Cache-Control', 'private, max-age=3600');
      return c.json(found);
    } catch (e) {
      if (e instanceof AresError) return c.json({ error: e.message }, e.status);
      return c.json({ error: 'ARES teď neodpovídá. Zkuste to později, nebo údaje vyplňte ručně.' }, 502);
    }
  });

  app.all('/api/*', (c) => c.json({ error: 'Neznámá adresa API.' }, 404));
  return app;
}
