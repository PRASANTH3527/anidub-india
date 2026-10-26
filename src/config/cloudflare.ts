/**
 * ============================================================================
 * CLOUDFLARE BACKEND CONFIGURATION (Workers + D1 / KV)
 * ============================================================================
 * 
 * Paste your deployed Cloudflare Worker or Cloudflare Pages API URL below.
 * When left empty or set to '', all requests default to the same-origin '/api'
 * routes (which connect directly to the Cloudflare D1 Edge adapter or local D1 server).
 * 
 * Examples:
 *   export const CLOUDFLARE_API_URL = 'https://anidub-api.samayaprasanth0.workers.dev';
 *   export const CLOUDFLARE_API_URL = 'https://anidub-india.pages.dev';
 */

// ---> PLACEHOLDER VARIABLE FOR YOUR CLOUDFLARE WORKER / PAGES URL <---
// PASTE YOUR ACTUAL CLOUDFLARE WORKER URL HERE:
export const CLOUDFLARE_API_URL: string = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLOUDFLARE_API_URL) || 
  'https://anidub-apiii.samayaprasanth0.workers.dev';

// Optional: Cloudflare D1 Database binding identifier from wrangler.toml
export const CLOUDFLARE_D1_DATABASE_NAME = 'anime-hub-db';
export const CLOUDFLARE_D1_DATABASE_ID = '75f053ab-5b44-4d48-abf8-b3a357a89426';

// Cloudflare Worker API routes specification
export const CLOUDFLARE_ENDPOINTS = {
  CATALOG: '/api/anime',
  ANIME_BY_ID: (id: string | number) => `/api/anime/${id}`,
  APPROVE: (id: string | number) => `/api/admin/approve/${id}`,
  VOTE: (id: string | number) => `/api/anime/${id}/vote`,
  LIKE: (id: string | number) => `/api/anime/${id}/like`,
  RATE: (id: string | number) => `/api/anime/${id}/rate`,
  WATCHLIST: '/api/watchlist',
  REVIEWS: '/api/reviews',
  FEEDBACK: '/api/feedback',
  UPLOAD: '/api/upload',
  RESET_DB: '/api/admin/reset-db',
  VERIFY_ADMIN: '/api/admin/verify',
  LOGIN_ADMIN: '/api/admin/login',
  EXPORT_CSV: '/api/admin/export-csv'
};

/**
 * Resolves full Cloudflare endpoint URL with support for both remote Workers
 * and local Pages Functions dev proxy.
 */
export function getCloudflareUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!CLOUDFLARE_API_URL || CLOUDFLARE_API_URL.trim() === '') {
    return cleanPath;
  }
  const cleanBase = CLOUDFLARE_API_URL.replace(/\/+$/, '');
  return `${cleanBase}${cleanPath}`;
}
