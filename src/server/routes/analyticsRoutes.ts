import { getAuth } from '../../utils/auth';
import { checkAnalyticsRateLimit } from '../../utils/rateLimiter';
import { getErrorMessage, type RouteContext } from './shared';

interface CloudflareRequestWithCf extends Request {
  cf?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

interface AnalyticsEventPayload {
  eventType?: string;
  type?: string;
  targetId?: string;
  target?: string;
}

interface TrackAnalyticsPayload {
  sessionId?: string;
  session_id?: string;
  region?: string;
  referrer?: string;
  path?: string;
  timeSpentSeconds?: number;
  maxScrollDepth?: number;
  pageview?: {
    path?: string;
    timeSpentSeconds?: number;
    maxScrollDepth?: number;
  };
  events?: AnalyticsEventPayload[];
  eventType?: string;
  event_type?: string;
  targetId?: string;
  target_id?: string;
}

export async function handleAnalyticsRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, path, method, jsonResponse } = ctx;

  // 1. POST /api/track
  if (path === '/api/track' && method === 'POST') {
    try {
      const rateLimit = await checkAnalyticsRateLimit(request, {
        kv: env.RATE_LIMIT_KV ?? null,
      });
      const rateLimitHeaders: Record<string, string> = {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAtMs / 1000)),
      };

      if (!rateLimit.allowed) {
        return jsonResponse(
          {
            success: false,
            error: 'Rate limit exceeded for analytics tracking. Please slow down.',
          },
          429,
          request,
          {
            ...rateLimitHeaders,
            'Retry-After': String(rateLimit.retryAfterSeconds),
          }
        );
      }

      let payload: TrackAnalyticsPayload;
      const contentType = (request.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        payload = (await request.json().catch(() => ({}))) as TrackAnalyticsPayload;
      } else {
        const text = await request.text().catch(() => '');
        try {
          payload = JSON.parse(text) as TrackAnalyticsPayload;
        } catch {
          payload = {};
        }
      }

      const sessionId = payload?.sessionId || payload?.session_id;
      if (!sessionId) {
        return jsonResponse({ success: false, error: 'Missing sessionId' }, 400, request, rateLimitHeaders);
      }

      const cfReq = request as CloudflareRequestWithCf;
      const country = cfReq.cf?.country || request.headers.get('cf-ipcountry') || 'IN';
      const rawRegion =
        cfReq.cf?.region || request.headers.get('cf-region') || request.headers.get('cf-region-code') || payload?.region || '';
      const region = rawRegion ? decodeURIComponent(rawRegion) : 'Tamil Nadu';
      const city = cfReq.cf?.city || request.headers.get('cf-ipcity') || request.headers.get('cf-city') || 'Chennai';
      const rawIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

      let ipHash = 'anon_visitor';
      try {
        const msgUint8 = new TextEncoder().encode(rawIp + '_anidub_edge_salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        ipHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
      } catch {
        // Fallback hash
      }

      const ua = request.headers.get('user-agent') || '';
      let deviceType = 'desktop';
      if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';
      else if (/mobile|android|iphone/i.test(ua)) deviceType = 'mobile';

      let os = 'Unknown OS';
      if (/windows/i.test(ua)) os = 'Windows';
      else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
      else if (/android/i.test(ua)) os = 'Android';
      else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
      else if (/linux/i.test(ua)) os = 'Linux';

      let browser = 'Unknown';
      if (/edg/i.test(ua)) browser = 'Edge';
      else if (/chrome|crios/i.test(ua)) browser = deviceType === 'mobile' ? 'Chrome Mobile' : 'Chrome';
      else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
      else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = deviceType === 'mobile' ? 'Safari Mobile' : 'Safari';

      const session = await getAuth(request, env);
      const clerkUserId = session.userId || null;
      const referrer = payload.referrer || 'direct';

      if (env.DB) {
        await env.DB.prepare(`
          INSERT INTO analytics_sessions (session_id, clerk_user_id, ip_hash, country, region, city, os, browser, device_type, referrer, started_at, last_active_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(session_id) DO UPDATE SET 
            last_active_at = datetime('now'),
            clerk_user_id = COALESCE(excluded.clerk_user_id, analytics_sessions.clerk_user_id),
            region = COALESCE(excluded.region, analytics_sessions.region)
        `)
          .bind(sessionId, clerkUserId, ipHash, country, region, city, os, browser, deviceType, referrer)
          .run();

        if (payload.path || payload.pageview) {
          const p = payload.path || payload.pageview?.path || '/';
          const t = Math.max(0, Math.round(Number(payload.timeSpentSeconds ?? payload.pageview?.timeSpentSeconds ?? 0)));
          const s = Math.min(100, Math.max(0, Math.round(Number(payload.maxScrollDepth ?? payload.pageview?.maxScrollDepth ?? 0))));
          await env.DB.prepare(`
            INSERT INTO analytics_pageviews (session_id, path, time_spent_seconds, max_scroll_depth, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `)
            .bind(sessionId, p, t, s)
            .run();
        }

        if (Array.isArray(payload.events) && payload.events.length > 0) {
          for (const evt of payload.events.slice(0, 25)) {
            if (evt && (evt.eventType || evt.type)) {
              await env.DB.prepare(`
                INSERT INTO analytics_events (session_id, event_type, target_id, created_at)
                VALUES (?, ?, ?, datetime('now'))
              `)
                .bind(sessionId, evt.eventType || evt.type, evt.targetId || evt.target || null)
                .run();
            }
          }
        } else if (payload.eventType || payload.event_type) {
          await env.DB.prepare(`
            INSERT INTO analytics_events (session_id, event_type, target_id, created_at)
            VALUES (?, ?, ?, datetime('now'))
          `)
            .bind(sessionId, payload.eventType || payload.event_type, payload.targetId || payload.target_id || null)
            .run();
        }
      }

      return jsonResponse({ success: true, sessionId }, 200, request, rateLimitHeaders);
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500);
    }
  }

  // 2. GET /api/analytics/dashboard (Admin only)
  if (path === '/api/analytics/dashboard' && method === 'GET') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    try {
      const reqUrl = new URL(request.url);
      const range = reqUrl.searchParams.get('range') || 'all';

      let timeFilter = '1=1';
      let sessionFilter = '1=1';
      if (range === 'today') {
        timeFilter = "date(created_at) = date('now')";
        sessionFilter = "date(started_at) = date('now')";
      } else if (range === '24h') {
        timeFilter = "created_at >= datetime('now', '-24 hours')";
        sessionFilter = "started_at >= datetime('now', '-24 hours')";
      } else if (range === '7d') {
        timeFilter = "created_at >= datetime('now', '-7 days')";
        sessionFilter = "started_at >= datetime('now', '-7 days')";
      }

      if (!env.DB) {
        return jsonResponse({
          success: true,
          data: {
            liveUsersCount: 0,
            totalSessions: 0,
            uniqueVisitors: 0,
            totalPageviews: 0,
            topPages: [],
            regions: [],
            cities: [],
            countries: [],
            devices: [],
            browsers: [],
            os: [],
            outboundClicks: [],
            recentEvents: [],
          },
        });
      }

      const [liveRes, sessRes, pvRes, bounceRes, topPagesRes, regionsRes, citiesRes, countriesRes, devRes, browserRes, osRes, outRes, eventsRes] =
        await Promise.all([
          env.DB.prepare("SELECT COUNT(*) as count FROM analytics_sessions WHERE last_active_at >= datetime('now', '-3 minutes')").first(),
          env.DB.prepare(`SELECT COUNT(*) as count, COUNT(DISTINCT ip_hash) as uniqueVisitors FROM analytics_sessions WHERE ${sessionFilter}`).first(),
          env.DB.prepare(`SELECT COUNT(*) as count, ROUND(AVG(time_spent_seconds)) as avgDuration, ROUND(AVG(max_scroll_depth)) as avgScroll FROM analytics_pageviews WHERE ${timeFilter}`).first(),
          env.DB.prepare(`SELECT COUNT(*) as count FROM (SELECT session_id FROM analytics_pageviews WHERE ${timeFilter} GROUP BY session_id HAVING COUNT(*) = 1)`).first(),
          env.DB.prepare(`SELECT path, COUNT(*) as views, ROUND(AVG(time_spent_seconds)) as avgTime, ROUND(AVG(max_scroll_depth)) as avgScroll FROM analytics_pageviews WHERE ${timeFilter} GROUP BY path ORDER BY views DESC LIMIT 10`).all(),
          env.DB.prepare(`SELECT COALESCE(NULLIF(region, ''), city, 'Tamil Nadu') as region, country, COUNT(*) as count FROM analytics_sessions WHERE ${sessionFilter} GROUP BY COALESCE(NULLIF(region, ''), city, 'Tamil Nadu'), country ORDER BY count DESC LIMIT 10`).all(),
          env.DB.prepare(`SELECT city, country, COUNT(*) as count FROM analytics_sessions WHERE ${sessionFilter} GROUP BY city, country ORDER BY count DESC LIMIT 10`).all(),
          env.DB.prepare(`SELECT country, COUNT(*) as count FROM analytics_sessions WHERE ${sessionFilter} GROUP BY country ORDER BY count DESC LIMIT 8`).all(),
          env.DB.prepare(`SELECT device_type as device, COUNT(DISTINCT COALESCE(clerk_user_id, ip_hash)) as count FROM analytics_sessions WHERE ${sessionFilter} GROUP BY device_type ORDER BY count DESC`).all(),
          env.DB.prepare(`SELECT browser, COUNT(DISTINCT COALESCE(clerk_user_id, ip_hash)) as count FROM analytics_sessions WHERE ${sessionFilter} GROUP BY browser ORDER BY count DESC LIMIT 6`).all(),
          env.DB.prepare(`SELECT os, COUNT(DISTINCT COALESCE(clerk_user_id, ip_hash)) as count FROM analytics_sessions WHERE ${sessionFilter} GROUP BY os ORDER BY count DESC LIMIT 6`).all(),
          env.DB.prepare(`SELECT target_id as url, COUNT(*) as clicks, event_type as provider FROM analytics_events WHERE ${timeFilter} AND event_type LIKE 'clicked_%' GROUP BY target_id, event_type ORDER BY clicks DESC LIMIT 10`).all(),
          env.DB.prepare(`SELECT e.id, e.session_id, e.event_type, e.target_id, e.created_at, COALESCE(s.region, s.city, 'Tamil Nadu') as region, s.city, s.country FROM analytics_events e LEFT JOIN analytics_sessions s ON e.session_id = s.session_id ORDER BY e.id DESC LIMIT 20`).all(),
        ]);

      const liveUsersCount = Number(liveRes?.count) || 0;
      const totalSessions = Number(sessRes?.count) || 0;
      const uniqueVisitors = Number(sessRes?.uniqueVisitors) || 0;
      const totalPageviews = Number(pvRes?.count) || 0;
      const avgDurationSeconds = Number(pvRes?.avgDuration) || 0;
      const avgScrollDepth = Number(pvRes?.avgScroll) || 0;
      const singlePv = Number(bounceRes?.count) || 0;
      const bounceRatePercent = totalSessions > 0 ? Math.min(100, Math.round((singlePv / totalSessions) * 100)) : 0;

      return jsonResponse({
        success: true,
        data: {
          liveUsersCount,
          totalSessions,
          uniqueVisitors,
          totalPageviews,
          avgDurationSeconds,
          avgScrollDepth,
          bounceRatePercent,
          topPages: topPagesRes?.results || [],
          regions: regionsRes?.results || [],
          cities: citiesRes?.results || [],
          countries: countriesRes?.results || [],
          devices: devRes?.results || [],
          browsers: browserRes?.results || [],
          os: osRes?.results || [],
          outboundClicks: outRes?.results || [],
          recentEvents: eventsRes?.results || [],
        },
      });
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500);
    }
  }

  return null;
}
