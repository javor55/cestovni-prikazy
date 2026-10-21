import type { Context, MiddlewareHandler } from 'hono';

/**
 * Jednoduchý limit počtu požadavků na klienta v pevném okně. Chrání API kurzů (a tím i ČNB) před
 * zahlcením. Drží se v paměti procesu – pro jednu instanci serveru to stačí.
 */
export function rateLimit({ limit = 60, windowMs = 60_000, key }: { limit?: number; windowMs?: number; key: (c: Context) => string }): MiddlewareHandler {
  const hits = new Map<string, { count: number; reset: number }>();
  return async (c, next) => {
    const now = Date.now();
    const k = key(c);
    let h = hits.get(k);
    if (!h || h.reset <= now) {
      if (hits.size > 10_000) for (const [x, v] of hits) if (v.reset <= now) hits.delete(x);
      h = { count: 0, reset: now + windowMs };
      hits.set(k, h);
    }
    if (++h.count > limit) {
      c.header('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return c.json({ error: 'Příliš mnoho požadavků. Zkuste to prosím za chvíli.' }, 429);
    }
    await next();
  };
}
