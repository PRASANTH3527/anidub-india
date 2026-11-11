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

  // If in browser, check if an admin manual override is set in localStorage
  if (typeof window !== 'undefined') {
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

    // On local dev or AI Studio preview container, route via same-origin relative paths to server.ts
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.includes('.run.app')) {
      return cleanPath;
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

/**
 * Resolves full Cloudflare WebSocket URL.
 */
export function getCloudflareWsUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.includes('.run.app')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}${cleanPath}`;
    }
  }
  if (!CLOUDFLARE_API_URL || CLOUDFLARE_API_URL.trim() === '') {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    return `${protocol}//${host}${cleanPath}`;
  }
  const cleanBase = CLOUDFLARE_API_URL.replace(/\/+$/, '').replace(/^http/, 'ws');
  return `${cleanBase}${cleanPath}`;
}
