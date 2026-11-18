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

export const DEFAULT_CHAT_RATE_LIMIT = 12;
export const DEFAULT_CHAT_WINDOW_MS = 60_000;
export const DEFAULT_CHAT_DUPLICATE_COOLDOWN_MS = 10_000;
export const DEFAULT_WS_RATE_LIMIT = 10;
export const DEFAULT_WS_WINDOW_MS = 15_000;

const defaultChatRateStore = new Map<string, RateLimitWindowRecord>();
const defaultChatDuplicateStore = new Map<string, { textHash: string; sentAtMs: number }>();
const defaultWsRateStore = new Map<string, RateLimitWindowRecord>();

export function clearChatRateLimitStores(): void {
  defaultChatRateStore.clear();
  defaultChatDuplicateStore.clear();
  defaultWsRateStore.clear();
}

export function buildRateLimitHeaders(
  result: Pick<RateLimitCheckResult, 'allowed' | 'limit' | 'remaining' | 'resetAtMs' | 'retryAfterSeconds'>
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAtMs / 1000)),
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(Math.max(1, result.retryAfterSeconds));
  }
  return headers;
}

export interface ChatRateLimitResult extends RateLimitCheckResult {
  reason?: 'rate_limit' | 'duplicate_spam';
  error?: string;
}

async function checkFixedBucket(params: {
  bucketKey: string;
  limit: number;
  windowMs: number;
  nowMs: number;
  kv?: RateLimitKvLike | null;
  store: Map<string, RateLimitWindowRecord>;
}): Promise<{ allowed: boolean; remaining: number; resetAtMs: number; retryAfterSeconds: number }> {
  const { bucketKey, limit, windowMs, nowMs, kv, store } = params;

  if (kv) {
    try {
      const windowBucket = Math.floor(nowMs / windowMs);
      const kvKey = `${bucketKey}:${windowBucket}`;
      const resetAtMs = (windowBucket + 1) * windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
      const rawCount = await kv.get(kvKey);
      const currentCount = rawCount ? Number.parseInt(rawCount, 10) || 0 : 0;

      if (currentCount >= limit) {
        return { allowed: false, remaining: 0, resetAtMs, retryAfterSeconds };
      }

      const nextCount = currentCount + 1;
      const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000) + 5);
      await kv.put(kvKey, String(nextCount), { expirationTtl: ttlSeconds });

      return {
        allowed: true,
        remaining: Math.max(0, limit - nextCount),
        resetAtMs,
        retryAfterSeconds,
      };
    } catch {
      // Fall through to memory store
    }
  }

  const existing = store.get(bucketKey);
  if (!existing || existing.resetAtMs <= nowMs) {
    if (store.size >= MAX_IN_MEMORY_KEYS) {
      pruneExpiredEntries(store, nowMs);
    }
    const resetAtMs = nowMs + windowMs;
    store.set(bucketKey, { count: 1, resetAtMs });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAtMs,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000));
  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAtMs: existing.resetAtMs,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  store.set(bucketKey, existing);
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAtMs: existing.resetAtMs,
    retryAfterSeconds,
  };
}

/**
 * Enforces per-user + per-IP sliding/fixed-window throttling and duplicate message
 * cooldown for Live Chat REST endpoints (`POST /api/chat`, `POST /api/chat/messages`).
 */
export async function checkChatRateLimit(params: {
  request: Request;
  userId: string;
  messageText?: string;
  maxPerUser?: number;
  maxPerIp?: number;
  windowMs?: number;
  duplicateCooldownMs?: number;
  nowMs?: number;
  kv?: RateLimitKvLike | null;
  store?: Map<string, RateLimitWindowRecord>;
  duplicateStore?: Map<string, { textHash: string; sentAtMs: number }>;
}): Promise<ChatRateLimitResult> {
  const limit = Math.max(1, params.maxPerUser ?? DEFAULT_CHAT_RATE_LIMIT);
  const ipLimit = Math.max(limit, params.maxPerIp ?? limit * 2);
  const windowMs = Math.max(1000, params.windowMs ?? DEFAULT_CHAT_WINDOW_MS);
  const duplicateCooldownMs = Math.max(0, params.duplicateCooldownMs ?? DEFAULT_CHAT_DUPLICATE_COOLDOWN_MS);
  const nowMs = params.nowMs ?? Date.now();
  const clientIp = extractClientIp(params.request);
  const store = params.store ?? defaultChatRateStore;
  const dupStore = params.duplicateStore ?? defaultChatDuplicateStore;

  const normalizedMsg = String(params.messageText || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (normalizedMsg && duplicateCooldownMs > 0) {
    const dupKey = `chat_dup:${params.userId}`;
    const prev = dupStore.get(dupKey);
    if (prev && prev.textHash === normalizedMsg && nowMs - prev.sentAtMs < duplicateCooldownMs) {
      const waitSec = Math.max(1, Math.ceil((prev.sentAtMs + duplicateCooldownMs - nowMs) / 1000));
      return {
        allowed: false,
        reason: 'duplicate_spam',
        limit,
        remaining: 0,
        resetAtMs: prev.sentAtMs + duplicateCooldownMs,
        retryAfterSeconds: waitSec,
        clientIp,
        error: `Please wait ${waitSec}s before sending the exact same message again.`,
      };
    }
  }

  const userBucket = await checkFixedBucket({
    bucketKey: `chat_user:${params.userId}`,
    limit,
    windowMs,
    nowMs,
    kv: params.kv,
    store,
  });

  if (!userBucket.allowed) {
    return {
      allowed: false,
      reason: 'rate_limit',
      limit,
      remaining: 0,
      resetAtMs: userBucket.resetAtMs,
      retryAfterSeconds: userBucket.retryAfterSeconds,
      clientIp,
      error: `Slow down: maximum ${limit} chat messages per ${Math.round(windowMs / 1000)}s reached. Retry in ${userBucket.retryAfterSeconds}s.`,
    };
  }

  const ipBucket = await checkFixedBucket({
    bucketKey: `chat_ip:${clientIp}`,
    limit: ipLimit,
    windowMs,
    nowMs,
    kv: params.kv,
    store,
  });

  if (!ipBucket.allowed) {
    return {
      allowed: false,
      reason: 'rate_limit',
      limit: ipLimit,
      remaining: 0,
      resetAtMs: ipBucket.resetAtMs,
      retryAfterSeconds: ipBucket.retryAfterSeconds,
      clientIp,
      error: `Too many chat messages from your network. Retry in ${ipBucket.retryAfterSeconds}s.`,
    };
  }

  if (normalizedMsg && duplicateCooldownMs > 0) {
    if (dupStore.size >= MAX_IN_MEMORY_KEYS) {
      for (const [k, v] of dupStore.entries()) {
        if (nowMs - v.sentAtMs >= duplicateCooldownMs) dupStore.delete(k);
      }
    }
    dupStore.set(`chat_dup:${params.userId}`, { textHash: normalizedMsg, sentAtMs: nowMs });
  }

  return {
    allowed: true,
    limit,
    remaining: userBucket.remaining,
    resetAtMs: userBucket.resetAtMs,
    retryAfterSeconds: userBucket.retryAfterSeconds,
    clientIp,
  };
}

/**
 * Synchronous per-user burst rate limiter for WebSocket chat frames inside ChatRoom.
 */
export function checkWebSocketMessageRateLimit(params: {
  userId: string;
  maxMessages?: number;
  windowMs?: number;
  nowMs?: number;
  store?: Map<string, RateLimitWindowRecord>;
}): { allowed: boolean; retryAfterSeconds: number; remaining: number; limit: number } {
  const limit = Math.max(1, params.maxMessages ?? DEFAULT_WS_RATE_LIMIT);
  const windowMs = Math.max(1000, params.windowMs ?? DEFAULT_WS_WINDOW_MS);
  const nowMs = params.nowMs ?? Date.now();
  const store = params.store ?? defaultWsRateStore;
  const bucketKey = `ws_user:${params.userId}`;

  const existing = store.get(bucketKey);
  if (!existing || existing.resetAtMs <= nowMs) {
    if (store.size >= MAX_IN_MEMORY_KEYS) {
      pruneExpiredEntries(store, nowMs);
    }
    store.set(bucketKey, { count: 1, resetAtMs: nowMs + windowMs });
    return {
      allowed: true,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
      remaining: Math.max(0, limit - 1),
      limit,
    };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000));
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds,
      remaining: 0,
      limit,
    };
  }

  existing.count += 1;
  store.set(bucketKey, existing);
  return {
    allowed: true,
    retryAfterSeconds,
    remaining: Math.max(0, limit - existing.count),
    limit,
  };
}

