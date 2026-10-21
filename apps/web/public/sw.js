// Service worker: aplikace se po první návštěvě otevře i bez připojení (např. v zahraničí bez dat).
// Data cest jsou v IndexedDB, sem se ukládají jen soubory aplikace. API (kurzy ČNB) se neukládá.
const CACHE = 'cestovni-prikazy-v1';
const MAX_ENTRIES = 300;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function put(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  // Staré verze souborů (po aktualizaci aplikace) se postupně odstraní.
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    // Stránka: vždy nejnovější ze serveru, bez připojení poslední uložená.
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) await put('/', res.clone());
          return res;
        } catch {
          return (await caches.match('/')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (/^\/(assets|icons)\/|^\/(manifest\.webmanifest|favicon\.png)$/.test(url.pathname)) {
    // Soubory s otiskem v názvu se nemění – stačí je stáhnout jednou.
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        // Některé hostingy vrací pro chybějící soubor stránku aplikace (200, text/html) – ta se neukládá.
        if (res.ok && !(res.headers.get('content-type') ?? '').includes('text/html')) await put(req, res.clone());
        return res;
      })(),
    );
  }
});
