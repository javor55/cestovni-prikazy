// Funkce pro Cloudflare Pages: obsluhuje /api/*, statické soubory aplikace servíruje přímo Cloudflare.
// Soubor functions/api/[[path]].ts v kořeni repozitáře z tohoto modulu jen re-exportuje onRequest.

import { handle } from 'hono/cloudflare-pages';
import { createApp } from './app.js';
import { cnbClient } from './cnb.js';

// Paměť instance se mezi požadavky zachovává, dokud Cloudflare instanci neuvolní; lístky za
// uplynulé dny navíc ukládá Cloudflare do mezipaměti podle hlavičky Cache-Control (viz níže).
const app = createApp({
  cnb: cnbClient({
    // Odpověď ČNB pro uplynulý den se nemění – Cloudflare ji může držet ve své mezipaměti.
    fetchImpl: (input, init) => fetch(input, { ...init, cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit),
  }),
  // Adresu klienta doplňuje Cloudflare a klient ji nemůže podvrhnout.
  clientKey: (c) => c.req.header('cf-connecting-ip') ?? 'neznamy',
});

export const onRequest = handle(app);
