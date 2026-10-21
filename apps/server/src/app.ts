import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { CnbClient } from './cnb.js';

export interface AppOptions {
  cnb: CnbClient;
  /** Adresář se sestavenou webovou aplikací. Bez něj server poskytuje jen API. */
  staticDir?: string;
  today?: () => string;
}

export function createApp({ cnb, staticDir, today = () => new Date().toISOString().slice(0, 10) }: AppOptions) {
  const app = new Hono();

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Robots-Tag', 'noindex');
  });

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

  if (staticDir) {
    app.use('/assets/*', async (c, next) => {
      await next();
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    });
    app.use('*', serveStatic({ root: staticDir }));
    // Aplikace je SPA – ostatní cesty vrací index.html.
    app.get('*', serveStatic({ root: staticDir, path: 'index.html' }));
  }
  return app;
}
