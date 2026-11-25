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

function sanitizeApiUrl(raw?: string): string {
  if (!raw) return '';
  const match = raw.trim().match(/https?:\/\/[^\s\)"'\]]+/i);
  if (!match) return '';
  const url = match[0].replace(/\/+$/, '');
  if (url.includes('your-subdomain') || url.includes('placeholder')) return '';
  return url;
}

// ---> DYNAMIC API BASE URL CONFIGURATION <---
export const CLOUDFLARE_API_URL: string = sanitizeApiUrl((import.meta as any).env?.VITE_CLOUDFLARE_API_URL);

/**
 * Default fallback Worker URL used when relative paths and env vars fail.
 */
export const DEFAULT_FALLBACK_WORKER_URL = '';

// Optional: Cloudflare D1 Database binding identifier from wrangler.toml
export const CLOUDFLARE_D1_DATABASE_NAME = 'anime-db';
export const CLOUDFLARE_D1_DATABASE_ID = '75f053ab-5b44-4d48-abf8-b3a357a89426';

// Cloudflare Worker API routes specification
export const CLOUDFLARE_ENDPOINTS = {
  CATALOG: '/api/anime',
  CATALOG_INDEX: '/api/anime/index',
  SUBMIT_ANIME: '/api/anime/submit',
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
  REPORT: '/api/report',
  PROGRESS: '/api/progress',
};

/**
 * Resolves full Cloudflare endpoint URL with support for both remote Workers
 * and local Pages Functions dev proxy.
 */
export function getCloudflareUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    // On local dev, AI Studio preview, or unified Cloudflare Pages/Workers deployment, route via same-origin relative paths
    const host = window.location.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'anidub.in' ||
      host.endsWith('.anidub.in') ||
      host.endsWith('.pages.dev') ||
      host.endsWith('.workers.dev') ||
      host.includes('.run.app')
    ) {
      return cleanPath;
    }

    let manualOverride = '';
    try {
      manualOverride = localStorage.getItem('cf_api_url_override') || '';
    } catch {}

    if (manualOverride && manualOverride.trim() !== '') {
      try {
        const cleanBase = manualOverride.trim().replace(/\/+$/, '');
        const fullUrl = `${cleanBase}${cleanPath}`;
        new URL(fullUrl);
        return fullUrl;
      } catch {}
    }
  }

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

export const CHAT_WORKER_HTTP_URL = 'https://anime-chat.samayaprasanth0.workers.dev';
export const CHAT_WORKER_WS_URL = 'wss://anime-chat.samayaprasanth0.workers.dev';

/**
 * Resolves full Cloudflare WebSocket URL pointing to the `anime-chat` Durable Object worker
 * (`wss://anime-chat.samayaprasanth0.workers.dev`) or local/same-origin `/ws` endpoint
 * WITHOUT embedding authentication tokens in the URL query string.
 * Authentication happens post-connect via the initial `{ type: 'auth', token }` payload.
 */
export function getCloudflareWsUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (CLOUDFLARE_API_URL && CLOUDFLARE_API_URL.trim() !== '') {
    const configuredWsBase = CLOUDFLARE_API_URL.replace(/\/+$/, '').replace(/^http/, 'ws');
    return `${configuredWsBase}${cleanPath}`;
  }
  return `${CHAT_WORKER_WS_URL}${cleanPath}`;
}
