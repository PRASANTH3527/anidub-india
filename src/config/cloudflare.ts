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

// ---> DYNAMIC API BASE URL CONFIGURATION <---
export const CLOUDFLARE_API_URL: string = 'https://anime-chat.samayaprasanth0.workers.dev';

/**
 * Default fallback Worker URL used when relative paths and env vars fail.
 */
export const DEFAULT_FALLBACK_WORKER_URL = '';

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
  ANIME_REVIEWS: (id: string | number) => `/api/anime/${id}/reviews`,
  FEEDBACK: '/api/feedback',
  UPLOAD: '/api/upload',
  RESET_DB: '/api/admin/reset-db',
  VERIFY_ADMIN: '/api/admin/verify',
  LOGIN_ADMIN: '/api/admin/login',
  EXPORT_CSV: '/api/admin/export-csv',
  USER_STATS: '/api/user/stats',
  CHAT: '/api/chat',
  NOTIFICATIONS: '/api/notifications',
  REPORT: '/api/report'
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
  // Robust check: Ensure URL is valid before returning. If malformed, fallback to relative path.
  try {
    const cleanBase = CLOUDFLARE_API_URL.replace(/\/+$/, '');
    const fullUrl = `${cleanBase}${cleanPath}`;
    new URL(fullUrl); // Validate
    return fullUrl;
  } catch (e) {
    console.error('Invalid URL constructed in getCloudflareUrl, falling back to relative path:', { CLOUDFLARE_API_URL, path });
    return cleanPath;
  }
}

/**
 * Resolves full Cloudflare WebSocket URL.
 */
export function getCloudflareWsUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!CLOUDFLARE_API_URL || CLOUDFLARE_API_URL.trim() === '') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${cleanPath}`;
  }
  const cleanBase = CLOUDFLARE_API_URL.replace(/\/+$/, '').replace(/^http/, 'ws');
  return `${cleanBase}${cleanPath}`;
}
