// Bezpečnostní hlavičky – jeden zdroj pro server v Node (Docker), soubor _headers na Cloudflare
// a náhled ve Vite, ve kterém běží E2E testy (aplikace se tak testuje se stejnou CSP jako v provozu).

/**
 * Content Security Policy: skripty, styly, písma i připojení jen z vlastní domény. blob: a data: jsou
 * potřeba pro náhledy dokladů a PDF vytvořené v prohlížeči; 'wasm-unsafe-eval' pro WebAssembly
 * (sazba PDF), nikoli pro eval JavaScriptu.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Robots-Tag': 'noindex',
};

/** Obsah souboru _headers pro statické soubory na Cloudflare. */
export function cloudflareHeaders(): string {
  const all = Object.entries(securityHeaders).map(([k, v]) => `  ${k}: ${v}`);
  return [
    '/*',
    ...all,
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/sw.js',
    '  Cache-Control: no-cache',
    '',
  ].join('\n');
}
