import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflareHeaders, securityHeaders } from '../server/src/headers.js';

/** Při sestavení přidá soubor _headers s bezpečnostními hlavičkami pro Cloudflare Pages. */
const cloudflare = (): Plugin => ({
  name: 'cloudflare-headers',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: cloudflareHeaders() });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  // Náhled (a E2E testy v něm) běží se stejnými hlavičkami včetně CSP jako aplikace v provozu.
  preview: { port: 4173, headers: securityHeaders, proxy: { '/api': 'http://localhost:8787' } },
});
