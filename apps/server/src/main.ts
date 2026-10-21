// Server pro Docker / vlastní počítač: API kurzů ČNB a sestavená webová aplikace.

import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Context } from 'hono';
import { createApp } from './app.js';
import { cnbClient, CNB_URL } from './cnb.js';
import { fileStore } from './fileStore.js';

const env = process.env;
const port = Number(env.PORT ?? 8787);

/**
 * Adresa klienta pro limit požadavků. Za reverzní proxy (Caddy) je skutečná adresa poslední položkou
 * X-Forwarded-For – starší položky může klient podvrhnout, proto se nepoužijí.
 */
function clientKey(c: Context): string {
  if (env.TRUST_PROXY === '1') {
    const last = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim();
    if (last) return last;
  }
  return getConnInfo(c).remote.address ?? 'neznamy';
}

const app = createApp({
  cnb: cnbClient({ url: env.CNB_URL || CNB_URL, ...(env.RATE_CACHE_DIR && { store: fileStore(env.RATE_CACHE_DIR) }) }),
  clientKey,
  ...(env.RATE_LIMIT_PER_MINUTE && { rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE) }),
});

const staticDir = env.STATIC_DIR;
if (staticDir) {
  app.use('/assets/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  });
  app.use('/sw.js', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-cache');
  });
  app.use('*', serveStatic({ root: staticDir }));
  // Chybějící soubor aplikace je 404, ne stránka aplikace.
  app.get('/assets/*', (c) => c.text('Nenalezeno', 404));
  // Aplikace je SPA – ostatní cesty vrací index.html.
  app.get('*', serveStatic({ root: staticDir, path: 'index.html' }));
}

serve({ fetch: app.fetch, port }, () => console.log(`Server běží na http://localhost:${port}`));
