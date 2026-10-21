// Cloudflare Workers: Worker obsluhuje jen /api/* (viz run_worker_first ve wrangler.toml),
// statické soubory aplikace servíruje Cloudflare přímo z apps/web/dist včetně hlaviček ze souboru _headers.

import { createApp } from './app.js';
import { cnbClient } from './cnb.js';

// Paměť instance se mezi požadavky zachovává, dokud Cloudflare instanci neuvolní.
const app = createApp({
  cnb: cnbClient({
    // Odpověď ČNB pro uplynulý den se nemění – Cloudflare ji může držet ve své mezipaměti.
    fetchImpl: (input, init) => fetch(input, { ...init, cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit),
  }),
  // Adresu klienta doplňuje Cloudflare a klient ji nemůže podvrhnout.
  clientKey: (c) => c.req.header('cf-connecting-ip') ?? 'neznamy',
});

export default app;
