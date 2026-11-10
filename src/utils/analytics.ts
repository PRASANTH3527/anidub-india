/**
 * Enterprise Custom Web Analytics Utility (God Mode)
 * Privacy-first telemetry built strictly with Cloudflare Edge headers, D1 database, and Clerk Auth.
 * NO Google Analytics or external telemetry trackers.
 */

const SESSION_STORAGE_KEY = 'anidub_analytics_session_id';

/**
 * Retrieves or lazily creates a persistent session ID for the current browser tab session
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return `sess_server_${Date.now().toString(36)}`;
  }
  try {
    let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      const entropy = Math.random().toString(36).substring(2, 10);
      sessionId = `sess_${Date.now().toString(36)}_${entropy}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return `sess_${Date.now().toString(36)}_fallback`;
  }
}

export interface TrackPayload {
  sessionId: string;
  type: 'pageview' | 'pageview_update' | 'event' | 'ping';
  path?: string;
  clerkUserId?: string | null;
  timeSpentSeconds?: number;
  maxScrollDepth?: number;
  eventType?: string;
  targetId?: string;
  referrer?: string;
  metadata?: Record<string, any>;
}

/**
 * Sends an analytics telemetry beacon or keepalive fetch to the Cloudflare Edge API
 */
export function sendAnalyticsPayload(payload: Partial<TrackPayload>): boolean {
  if (typeof window === 'undefined') return false;

  const sessionId = payload.sessionId || getOrCreateSessionId();
  const fullPayload: TrackPayload = {
    sessionId,
    type: payload.type || 'pageview',
    path: payload.path || window.location.pathname,
    clerkUserId: payload.clerkUserId || null,
    timeSpentSeconds: payload.timeSpentSeconds || 0,
    maxScrollDepth: payload.maxScrollDepth || 0,
    eventType: payload.eventType,
    targetId: payload.targetId,
    referrer: payload.referrer !== undefined ? payload.referrer : (document.referrer || 'direct'),
    metadata: payload.metadata
  };

  const jsonStr = JSON.stringify(fullPayload);

  // 1. Try navigator.sendBeacon (ideal for unload, visibilitychange, and background dispatch)
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // Send as text/plain blob for guaranteed cross-browser CORS delivery
      const blob = new Blob([jsonStr], { type: 'text/plain;charset=UTF-8' });
      const queued = navigator.sendBeacon('/api/track', blob);
      if (queued) return true;
    }
  } catch (err) {
    // Fall back to keepalive fetch
  }

  // 2. Fetch with keepalive fallback
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr,
      keepalive: true
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Public helper to log custom events (e.g., clicked_crunchyroll, submitted_review, upvoted_anime)
 */
export function trackAnalyticsEvent(eventType: string, targetId?: string, clerkUserId?: string | null): void {
  sendAnalyticsPayload({
    type: 'event',
    eventType,
    targetId: targetId || '',
    clerkUserId
  });
}

/**
 * Compute current page scroll percentage safely (0 - 100)
 */
export function calculateScrollDepth(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  try {
    const doc = document.documentElement;
    const body = document.body;
    const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
    const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight) - window.innerHeight;
    if (scrollHeight <= 0) return 100;
    const pct = Math.round((scrollTop / scrollHeight) * 100);
    return Math.max(0, Math.min(100, pct));
  } catch {
    return 0;
  }
}
