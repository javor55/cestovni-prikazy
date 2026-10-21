import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { cnbClient } from './cnb.js';

const port = Number(process.env.PORT ?? 8787);
const app = createApp({
  cnb: cnbClient({ cacheDir: process.env.RATE_CACHE_DIR }),
  staticDir: process.env.STATIC_DIR,
});

serve({ fetch: app.fetch, port }, () => console.log(`Server běží na http://localhost:${port}`));
