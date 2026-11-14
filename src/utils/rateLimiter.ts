export interface RateLimitKvLike {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ) => Promise<void>;
}

export interface RateLimitWindowRecord {
  count: number;
  resetAtMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
  clientIp: string;
}

export const DEFAULT_ANALYTICS_RATE_LIMIT = 30;
export const DEFAULT_ANALYTICS_WINDOW_MS = 60_000;
const MAX_IN_MEMORY_KEYS = 5000;

const defaultAnalyticsRateStore = new Map<string, RateLimitWindowRecord>();

/**
 * Extracts and normalizes the client IP address from Cloudflare/standard proxy headers.
 */
export function extractClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor && forwardedFor.trim()) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  return '127.0.0.1';
}

function pruneExpiredEntries(
  store: Map<string, RateLimitWindowRecord>,
  nowMs: number
): void {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAtMs <= nowMs) {
      store.delete(key);
    }
  }
  while (store.size >= MAX_IN_MEMORY_KEYS) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

export function clearAnalyticsRateLimitStore(
  store: Map<string, RateLimitWindowRecord> = defaultAnalyticsRateStore
): void {
  store.clear();
}

/**
 * Sliding/fixed-window IP-based rate limiter for `/api/track` (DB spam protection).
 * Uses Cloudflare KV when bound (`env.RATE_LIMIT_KV`) and falls back to a bounded
 * per-isolate in-memory `Map` with automatic expiration.
 */
export async function checkAnalyticsRateLimit(
  request: Request,
  options?: {
    maxRequests?: number;
    windowMs?: number;
    nowMs?: number;
    store?: Map<string, RateLimitWindowRecord>;
    kv?: RateLimitKvLike | null;
    keyPrefix?: string;
  }
): Promise<RateLimitCheckResult> {
  const limit = Math.max(1, options?.maxRequests ?? DEFAULT_ANALYTICS_RATE_LIMIT);
  const windowMs = Math.max(1000, options?.windowMs ?? DEFAULT_ANALYTICS_WINDOW_MS);
  const nowMs = options?.nowMs ?? Date.now();
  const clientIp = extractClientIp(request);
  const keyPrefix = options?.keyPrefix ?? 'track_rl';
  const bucketKey = `${keyPrefix}:${clientIp}`;

  if (options?.kv) {
    try {
      const windowBucket = Math.floor(nowMs / windowMs);
      const kvKey = `${bucketKey}:${windowBucket}`;
      const resetAtMs = (windowBucket + 1) * windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
      const rawCount = await options.kv.get(kvKey);
      const currentCount = rawCount ? Number.parseInt(rawCount, 10) || 0 : 0;

      if (currentCount >= limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetAtMs,
          retryAfterSeconds,
          clientIp,
        };
      }

      const nextCount = currentCount + 1;
      const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000) + 5);
      await options.kv.put(kvKey, String(nextCount), { expirationTtl: ttlSeconds });

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - nextCount),
        resetAtMs,
        retryAfterSeconds,
        clientIp,
      };
    } catch {
      // Fall through to in-memory limiter if KV throws transiently
    }
  }

  const store = options?.store ?? defaultAnalyticsRateStore;
  const existing = store.get(bucketKey);

  if (!existing || existing.resetAtMs <= nowMs) {
    if (store.size >= MAX_IN_MEMORY_KEYS) {
      pruneExpiredEntries(store, nowMs);
    }
    const resetAtMs = nowMs + windowMs;
    store.set(bucketKey, { count: 1, resetAtMs });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAtMs,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
      clientIp,
    };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000));
  if (existing.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAtMs: existing.resetAtMs,
      retryAfterSeconds,
      clientIp,
    };
  }

  existing.count += 1;
  store.set(bucketKey, existing);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAtMs: existing.resetAtMs,
    retryAfterSeconds,
    clientIp,
  };
}
