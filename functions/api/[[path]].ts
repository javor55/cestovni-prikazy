// Cloudflare Pages Functions: všechny požadavky na /api/* obslouží API ze serveru aplikace.
export { onRequest } from '../../apps/server/src/cloudflare.js';
