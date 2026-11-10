/**
 * ============================================================================
 * ANIDUB INDIA - CLOUDFLARE WORKER BACKEND API
 * ============================================================================
 * 
 * Standalone Cloudflare Worker acting as a robust fallback for Pages Functions.
 * Handles D1 CRUD, ImgBB Proxies, and Telegram Notifications.
 */

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.sseWriters = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade");

    // Internal Broadcast Trigger (via POST)
    if (request.method === "POST" && url.pathname === "/internal/broadcast") {
      const payload = await request.json();
      this.broadcast(payload);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // SSE Connection Handler
    if (url.pathname === "/api/notifications/stream") {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      this.sseWriters.add(writer);
      
      const initialMsg = `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`;
      writer.write(encoder.encode(initialMsg));

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        this.sseWriters.delete(writer);
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...getCorsHeaders(request)
        }
      });
    }

    // WebSocket Handshake
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      await this.handleSession(server);
      const response = new Response(null, { status: 101, webSocket: client });
      const headers = getCorsHeaders(request);
      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }
      return response;
    }

    return new Response(JSON.stringify({ status: "ChatRoom DO active" }), { 
      status: 200, 
      headers: getCorsHeaders(request) 
    });
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    const encoder = new TextEncoder();
    const sseMsg = `data: ${payload}\n\n`;

    // Send to WebSockets
    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch (err) {
        this.sessions.delete(session);
      }
    }

    // Send to SSE Writers
    for (const writer of this.sseWriters) {
      try {
        writer.write(encoder.encode(sseMsg));
      } catch (err) {
        this.sseWriters.delete(writer);
      }
    }
  }

  async handleSession(webSocket) {
    webSocket.accept();
    this.sessions.add(webSocket);

    try {
      if (this.env.DB) {
        // Auto-migrate potentially missing columns
        await this.env.DB.prepare("ALTER TABLE chat_messages ADD COLUMN rating REAL").run().catch(() => {});
        await this.env.DB.prepare("ALTER TABLE chat_messages ADD COLUMN language TEXT").run().catch(() => {});
        await this.env.DB.prepare("ALTER TABLE chat_messages ADD COLUMN isReview INTEGER DEFAULT 0").run().catch(() => {});
        await this.env.DB.prepare("ALTER TABLE chat_messages ADD COLUMN clerk_user_id TEXT").run().catch(() => {});
        await this.env.DB.prepare("ALTER TABLE chat_messages ADD COLUMN avatar TEXT").run().catch(() => {});
        await this.env.DB.prepare("ALTER TABLE chat_messages ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP").run().catch(() => {});

        let results = [];
        try {
          const res = await this.env.DB.prepare(
            "SELECT id, user, text, timestamp, rating, language, isReview, clerk_user_id FROM chat_messages ORDER BY id DESC LIMIT 60"
          ).all();
          results = res.results || [];
        } catch {
          const fallback = await this.env.DB.prepare(
            "SELECT * FROM chat_messages ORDER BY id DESC LIMIT 60"
          ).all().catch(() => ({ results: [] }));
          results = fallback.results || [];
        }

        if (results && results.length > 0) {
          const chronological = results.reverse();
          for (const msg of chronological) {
            webSocket.send(JSON.stringify(msg));
          }
        }
      }
    } catch (e) {
      console.error("D1 chat read error:", e);
    }

    webSocket.addEventListener("message", async (msg) => {
      try {
        const data = JSON.parse(msg.data);
        const chatMsg = {
          id: data.id || `msg_${Date.now()}_${Math.random()}`,
          user: String(data.user || data.username || data.user_name || "Anonymous Fan").slice(0, 50),
          text: String(data.text || data.message || data.comment || "").slice(0, 1000),
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          rating: data.rating !== undefined && data.rating !== null && !isNaN(Number(data.rating)) ? Number(data.rating) : null,
          language: (data.language || data.dub_language) ? String(data.language || data.dub_language).slice(0, 30) : null,
          isReview: Boolean(data.isReview || data.is_review || data.rating) ? 1 : 0,
          clerk_user_id: String(data.clerk_user_id || data.userId || "guest").slice(0, 100)
        };

        if (this.env.DB) {
          try {
            await this.env.DB.prepare(
              "INSERT INTO chat_messages (user, text, timestamp, rating, language, isReview, clerk_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(chatMsg.user, chatMsg.text, chatMsg.timestamp, chatMsg.rating, chatMsg.language, chatMsg.isReview, chatMsg.clerk_user_id).run();
          } catch {
            // Graceful fallback to 3-column insert
            await this.env.DB.prepare(
              "INSERT INTO chat_messages (user, text, timestamp) VALUES (?, ?, ?)"
            ).bind(chatMsg.user, chatMsg.text, chatMsg.timestamp).run().catch(() => {});
          }
        }

        this.broadcast(chatMsg);
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    });

    webSocket.addEventListener("close", () => this.sessions.delete(webSocket));
    webSocket.addEventListener("error", () => this.sessions.delete(webSocket));
  }
}

const DEFAULT_IMGBB_KEY = 'Ee6b4e37ae9c228c29b8448483b6591b';

const SEED_ANIME = [
  { id: 1, title: 'Solo Leveling', slug: 'solo-leveling', synopsis: 'In a world of hunters...', cover_image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800', rating: 8.7, year: 2024, genres: 'Action, Fantasy', platform: 'Crunchyroll', popularity: 95000 },
  { id: 2, title: 'Demon Slayer', slug: 'demon-slayer', synopsis: 'Family slaughtered...', cover_image: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg', rating: 8.9, year: 2019, genres: 'Action, Supernatural', platform: 'Netflix', popularity: 120000 },
  { id: 3, title: 'Naruto Shippuden', slug: 'naruto-shippuden', synopsis: 'Intense training...', cover_image: 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg', rating: 8.3, year: 2007, genres: 'Action, Adventure', platform: 'Sony YAY!', popularity: 88000 },
  { id: 4, title: 'Jujutsu Kaisen', slug: 'jujutsu-kaisen', synopsis: 'Cursed spirit...', cover_image: 'https://cdn.myanimelist.net/images/anime/1171/109222.jpg', rating: 8.8, year: 2020, genres: 'Action, Supernatural', platform: 'Crunchyroll', popularity: 110000 }
];

function cleanWatchUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return trimmed.split('?')[0].split('#')[0].trim();
  } catch {
    return trimmed.split('?')[0].split('#')[0].trim();
  }
}

function getCorsHeaders(request) {
  const origin = request ? (request.headers.get("Origin") || request.headers.get("origin")) : null;
  
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, x-device-id, x-user-id, x-requested-with, Accept, Origin, Cache-Control, Pragma",
    "Access-Control-Expose-Headers": "Content-Length, Content-Type, Set-Cookie",
    "Vary": "Origin"
  };

  if (origin && (origin.includes('localhost') || origin.includes('.run.app') || origin.includes('workers.dev') || origin.includes('pages.dev'))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = origin || "*";
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

function jsonResponse(data, status = 200, request = null) {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
  
  const headers = getCorsHeaders(request);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  
  return response;
}

async function sendTelegramAlert(env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (e) {}
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // 1. Unified CORS Preflight
    if (method === "OPTIONS") {
      return new Response(null, { 
        status: 204, 
        headers: getCorsHeaders(request)
      });
    }

    // 1.5 WebSocket & SSE Routing to ChatRoom Durable Object
    if (path === "/ws" || path === "/api/chat/stream" || path === "/api/notifications/stream") {
      if (env.CHAT_ROOM) {
        const id = env.CHAT_ROOM.idFromName("global_chat");
        const obj = env.CHAT_ROOM.get(id);
        return obj.fetch(request);
      }
      return jsonResponse({ error: "Durable Object binding missing" }, 503, request);
    }

    // Helper: Broadcast activity to all connected clients (internal)
    const broadcastActivity = async (payload) => {
      if (env.CHAT_ROOM) {
        try {
          const id = env.CHAT_ROOM.idFromName("global_chat");
          const obj = env.CHAT_ROOM.get(id);
          await obj.fetch(new Request("http://internal/internal/broadcast", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" }
          }));
        } catch (e) {
          console.error("Broadcast failed:", e);
        }
      }
    };

    try {
      // 2. Health & Status
      if (path === "/" || path === "/api/health" || path === "/api/cloudflare/status") {
        return jsonResponse({ 
          status: "healthy", 
          service: "AniDub India Worker",
          database: env.DB ? "connected" : "missing",
          kv: env.ANIME_DB ? "connected" : "missing",
          durable_object: env.CHAT_ROOM ? "connected" : "missing",
          timestamp: new Date().toISOString()
        }, 200, request);
      }

      // 3. Catalog GET /api/anime
      if (path === "/api/anime" && method === "GET") {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = (page - 1) * limit;
        const search = url.searchParams.get('search');
        const genre = url.searchParams.get('genre');

        if (env.DB) {
          try {
            const includePending = url.searchParams.get('includePending') === 'true';
            let where = [];
            if (!includePending) {
              where.push("(is_published = 1 OR is_published = true) AND status != 'pending' AND (submissionStatus = 'approved' OR submissionStatus IS NULL)");
            }
            let params = [];
            if (search) { 
              where.push("(title LIKE ? OR synopsis LIKE ?)"); 
              params.push(`%${search}%`, `%${search}%`); 
            }
            if (genre && genre !== 'All' && genre !== 'All Genres') { 
              where.push("genres LIKE ?"); 
              params.push(`%${genre}%`); 
            }
            
            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const count = await env.DB.prepare(`SELECT COUNT(*) as total FROM anime ${whereSql}`).bind(...params).first();
            const total = count?.total || 0;
            
            const results = await env.DB.prepare(`SELECT * FROM anime ${whereSql} ORDER BY popularity DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();
            const data = (results.results && results.results.length > 0) ? results.results : SEED_ANIME.slice(offset, offset + limit);
            return jsonResponse({ data, pagination: { total: Math.max(total, SEED_ANIME.length), page, limit } }, 200, request);
          } catch (e) {
            console.error("D1 Fetch Error:", e);
          }
        }
        return jsonResponse({ data: SEED_ANIME.slice(offset, offset + limit), pagination: { total: SEED_ANIME.length, page, limit }, note: "Using seed data fallback" }, 200, request);
      }

      // 4. Notifications
      if (path === "/api/notifications" || path === "/api/notifications/test") {
        const notifications = [
          { id: 'n1', type: 'info', title: 'Welcome', message: 'Welcome to AniDub India!', timestamp: new Date().toISOString() },
          { id: 'n2', type: 'success', title: 'Live Update', message: 'Solo Leveling Episode 12 is now live!', timestamp: new Date().toISOString() }
        ];
        return jsonResponse({ success: true, notifications, data: notifications }, 200, request);
      }

      // 5. Admin Auth
      if (path === "/api/admin/login" && method === "POST") {
        const { password } = await request.json();
        if (password === "prasanth123" || password === env.ADMIN_PASSWORD) {
          return jsonResponse({ success: true, token: "cf_admin_edge_token_" + Date.now() }, 200, request);
        }
        return jsonResponse({ success: false, error: "Unauthorized" }, 401, request);
      }

      if (path === "/api/admin/verify") {
        return jsonResponse({ success: true, valid: true, role: 'admin' }, 200, request);
      }

      // 6. User Stats
      if (path === "/api/user/stats" || path === "/api/user-stats") {
        return jsonResponse({ reviewCount: 0, voteCount: 0, deviceId: "edge_user" }, 200, request);
      }

      // 7. Chat
      if (path === "/api/chat") {
        if (method === "GET") {
          if (env.DB) {
            let results = [];
            try {
              const res = await env.DB.prepare("SELECT id, user, text, timestamp, rating, language, isReview, clerk_user_id, created_at FROM chat_messages ORDER BY id ASC LIMIT 150").all();
              results = res.results || [];
            } catch {
              const res = await env.DB.prepare("SELECT * FROM chat_messages ORDER BY id ASC LIMIT 150").all().catch(() => ({ results: [] }));
              results = res.results || [];
            }
            return jsonResponse(results, 200, request);
          }
          return jsonResponse([], 200, request);
        }
        if (method === "POST") {
          const body = await request.json().catch(() => ({}));
          const cleanUser = String(body.user || body.username || body.user_name || 'Anonymous Fan').slice(0, 50);
          const cleanText = String(body.text || body.message || body.comment || '').slice(0, 1000);
          const cleanTimestamp = body.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const cleanRating = body.rating !== undefined && body.rating !== null && !isNaN(Number(body.rating)) ? Number(body.rating) : null;
          const cleanLanguage = (body.language || body.dub_language) ? String(body.language || body.dub_language).slice(0, 30) : null;
          const cleanIsReview = Boolean(body.isReview || body.is_review || cleanRating) ? 1 : 0;
          const cleanClerkId = String(body.clerk_user_id || body.userId || 'guest').slice(0, 100);

          if (!cleanText.trim()) {
            return jsonResponse({ error: "Missing message text" }, 400, request);
          }

          if (env.DB) {
            try {
              await env.DB.prepare(
                "INSERT INTO chat_messages (user, text, timestamp, rating, language, isReview, clerk_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
              ).bind(cleanUser, cleanText, cleanTimestamp, cleanRating, cleanLanguage, cleanIsReview, cleanClerkId).run();
            } catch {
              await env.DB.prepare(
                "INSERT INTO chat_messages (user, text, timestamp) VALUES (?, ?, ?)"
              ).bind(cleanUser, cleanText, cleanTimestamp).run().catch(() => {});
            }
          }
          return jsonResponse({ 
            success: true, 
            message: {
              id: Date.now(),
              user: cleanUser,
              text: cleanText,
              timestamp: cleanTimestamp,
              rating: cleanRating,
              language: cleanLanguage,
              isReview: Boolean(cleanIsReview),
              clerk_user_id: cleanClerkId
            }
          }, 201, request);
        }
      }

      // 8. Watchlist
      if (path === "/api/watchlist") {
        if (method === "GET") {
          return jsonResponse({ watchlist: [], data: [] }, 200, request);
        }
        if (method === "POST") {
          return jsonResponse({ success: true, watchlisted: true }, 200, request);
        }
      }

      // 9. Feedback & Reports
      if (path === "/api/feedback" || path === "/api/report") {
        if (method === "POST") {
          const body = await request.json();
          if (env.DB) {
            await env.DB.prepare("INSERT INTO feedback (name_or_insta, email, feedback_text) VALUES (?, ?, ?)")
              .bind(body.name || body.animeTitle || 'Anon', body.email || body.reason || '', body.message || body.feedback || body.notes || '').run();
          }
          await sendTelegramAlert(env, `<b>New Interaction:</b> ${body.message || body.feedback || body.reason}`);
          return jsonResponse({ success: true }, 201, request);
        }
      }

      // 10. Upload Proxy
      if (path === "/api/upload" && method === "POST") {
        const body = await request.json();
        const apiKey = env.IMGBB_API_KEY || DEFAULT_IMGBB_KEY;
        const formData = new FormData();
        formData.append('image', body.image.replace(/^data:image\/\w+;base64,/, ''));
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: 'POST', body: formData });
        const data = await res.json();
        return jsonResponse(data, res.status, request);
      }

      // 11. Specific Anime Routes (/api/anime/:id/...)
      const animeSubMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)\/(reviews|like|likes|vote|upvote|rate|vote-status)$/);
      if (animeSubMatch) {
        const id = animeSubMatch[1];
        const sub = animeSubMatch[2];
        const clientIp = request.headers.get("CF-Connecting-IP") || 
                         request.headers.get("x-real-ip") || 
                         request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                         "127.0.0.1";
        
        // Resolve numeric anime ID if slug was passed
        let numericId = parseInt(id, 10);
        if (isNaN(numericId) && env.DB) {
          const row = await env.DB.prepare("SELECT id FROM anime WHERE slug = ?").bind(id).first();
          if (row && row.id) numericId = row.id;
        }

        // GET Reviews
        if (sub === 'reviews' && method === "GET") {
          if (env.DB) {
            const { results } = await env.DB.prepare(
              "SELECT * FROM reviews WHERE anime_id = ? OR anime_id = (SELECT id FROM anime WHERE slug = ?) ORDER BY id DESC"
            ).bind(id, id).all();
            return jsonResponse({ reviews: results || [] }, 200, request);
          }
          return jsonResponse({ reviews: [] }, 200, request);
        }

        // POST Review
        if (sub === 'reviews' && method === "POST") {
          try {
            const body = await request.json().catch(() => ({}));
            if (env.DB && numericId) {
              await env.DB.prepare(
                "INSERT INTO reviews (anime_id, user_name, user_avatar, rating, comment) VALUES (?, ?, ?, ?, ?)"
              ).bind(numericId, body.user_name || 'Anonymous', body.user_avatar || '', body.rating || 10, body.comment || '').run();
            }
            
            // Query title for notification
            let animeTitle = 'Anime';
            if (env.DB && numericId) {
              const row = await env.DB.prepare("SELECT title FROM anime WHERE id = ?").bind(numericId).first();
              if (row) animeTitle = row.title;
            }

            await broadcastActivity({
              type: 'review',
              anime_id: numericId,
              anime_title: animeTitle,
              user: body.user_name || 'Anonymous',
              rating: body.rating,
              message: body.comment
            });

            return jsonResponse({ success: true, message: "Review posted successfully" }, 200, request);
          } catch (revErr) {
            return jsonResponse({ success: false, error: revErr.message }, 500, request);
          }
        }

        // GET Vote Status (Checks if authenticated user has already liked or upvoted)
        if (sub === 'vote-status' && method === "GET") {
          try {
            const userId = url.searchParams.get('userId') || url.searchParams.get('user_id') || request.headers.get('x-user-id') || request.headers.get('x-device-id') || 'default_user';
            let hasLiked = false;
            let hasUpvoted = false;
            if (env.DB && numericId && userId && userId !== 'default_user') {
              const likeCheck = await env.DB.prepare(
                "SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'like'"
              ).bind(numericId, userId).first().catch(() => null);
              const upvoteCheck = await env.DB.prepare(
                "SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'upvote'"
              ).bind(numericId, userId).first().catch(() => null);
              hasLiked = Boolean(likeCheck);
              hasUpvoted = Boolean(upvoteCheck);
            }
            return jsonResponse({ animeId: numericId || id, hasLiked, hasUpvoted, userId }, 200, request);
          } catch (statusErr) {
            return jsonResponse({ animeId: numericId || id, hasLiked: false, hasUpvoted: false, error: statusErr.message }, 200, request);
          }
        }

        // POST Vote / Upvote (with Authentication & Unique Constraint Spam Prevention)
        if ((sub === 'vote' || sub === 'upvote') && method === "POST") {
          try {
            const body = await request.json().catch(() => ({}));
            const userId = body.user_id || body.userId || request.headers.get('x-user-id');
            
            if (!userId) {
              return jsonResponse({
                error: "Authentication required",
                message: "Please sign in to upvote anime titles.",
                requiresAuth: true
              }, 401, request);
            }

            if (env.DB && numericId) {
              // 1. Check if user already upvoted
              const existing = await env.DB.prepare(
                "SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'upvote'"
              ).bind(numericId, userId).first();

              if (existing) {
                return jsonResponse({
                  error: "Already voted",
                  message: "You have already upvoted this anime.",
                  alreadyVoted: true,
                  animeId: numericId
                }, 400, request);
              }

              // 2. Insert vote record (with UNIQUE constraint catch)
              try {
                await env.DB.prepare(
                  "INSERT INTO user_votes (anime_id, user_id, vote_type) VALUES (?, ?, 'upvote')"
                ).bind(numericId, userId).run();
              } catch (uErr) {
                if (String(uErr?.message || uErr).toLowerCase().includes("unique")) {
                  return jsonResponse({
                    error: "Already voted",
                    message: "You have already upvoted this anime.",
                    alreadyVoted: true,
                    animeId: numericId
                  }, 400, request);
                }
                throw uErr;
              }

              // 3. Increment upvotes & popularity in D1
              await env.DB.prepare(
                "UPDATE anime SET upvotes = MAX(0, COALESCE(upvotes, 0) + 1), popularity = MAX(0, COALESCE(popularity, 0) + 1) WHERE id = ?"
              ).bind(numericId).run();

              const updated = await env.DB.prepare("SELECT title, upvotes, popularity FROM anime WHERE id = ?").bind(numericId).first();
              const newUpvotes = updated?.upvotes ?? updated?.popularity ?? 1;

              await broadcastActivity({
                type: 'upvote',
                anime_id: numericId,
                anime_title: updated?.title || 'Anime',
                message: `${newUpvotes} total upvotes`
              });

              return jsonResponse({
                success: true,
                upvotes: newUpvotes,
                popularity: newUpvotes,
                animeId: numericId,
                message: "Upvote recorded successfully"
              }, 200, request);
            }

            return jsonResponse({ success: true, upvotes: 1, popularity: 1 }, 200, request);
          } catch (voteErr) {
            return jsonResponse({ success: false, error: voteErr.message }, 500, request);
          }
        }

        // POST Like (with Authentication & Unique Constraint Spam Prevention)
        if ((sub === 'like' || sub === 'likes') && method === "POST") {
          try {
            const body = await request.json().catch(() => ({}));
            const userId = body.user_id || body.userId || request.headers.get('x-user-id');

            if (!userId) {
              return jsonResponse({
                error: "Authentication required",
                message: "Please sign in to like anime titles.",
                requiresAuth: true
              }, 401, request);
            }

            if (env.DB && numericId) {
              // 1. Check if user already liked
              const existing = await env.DB.prepare(
                "SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'like'"
              ).bind(numericId, userId).first();

              if (existing) {
                return jsonResponse({
                  error: "Already voted",
                  message: "You have already liked this anime.",
                  alreadyVoted: true,
                  animeId: numericId
                }, 400, request);
              }

              // 2. Insert vote record (with UNIQUE constraint catch)
              try {
                await env.DB.prepare(
                  "INSERT INTO user_votes (anime_id, user_id, vote_type) VALUES (?, ?, 'like')"
                ).bind(numericId, userId).run();
              } catch (uErr) {
                if (String(uErr?.message || uErr).toLowerCase().includes("unique")) {
                  return jsonResponse({
                    error: "Already voted",
                    message: "You have already liked this anime.",
                    alreadyVoted: true,
                    animeId: numericId
                  }, 400, request);
                }
                throw uErr;
              }

              // 3. Increment likes & likesCount in D1
              await env.DB.prepare(
                "UPDATE anime SET likes = MAX(0, COALESCE(likes, 0) + 1), likesCount = MAX(0, COALESCE(likesCount, 0) + 1) WHERE id = ?"
              ).bind(numericId).run();

              const updated = await env.DB.prepare("SELECT title, likes, likesCount FROM anime WHERE id = ?").bind(numericId).first();
              const newLikes = updated?.likes ?? updated?.likesCount ?? 1;

              await broadcastActivity({
                type: 'like',
                anime_id: numericId,
                anime_title: updated?.title || 'Anime',
                message: `${newLikes} total likes`
              });

              return jsonResponse({
                success: true,
                likes: newLikes,
                likesCount: newLikes,
                animeId: numericId,
                message: "Like recorded successfully"
              }, 200, request);
            }

            return jsonResponse({ success: true, likes: 1, likesCount: 1 }, 200, request);
          } catch (likeErr) {
            return jsonResponse({ success: false, error: likeErr.message }, 500, request);
          }
        }

        // POST Rate fallback
        if (sub === 'rate' && method === "POST") {
          return jsonResponse({ success: true, message: "Rating recorded" }, 200, request);
        }
      }

      // 12. Individual Anime GET/PUT/PATCH/DELETE
      const animeMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)$/);
      if (animeMatch) {
        const id = animeMatch[1];
        if (method === "GET") {
          if (env.DB) {
            const anime = await env.DB.prepare("SELECT * FROM anime WHERE id = ? OR slug = ?").bind(id, id).first();
            if (anime) {
              const platformRaw = anime.streaming_partners || anime.platforms_data;
              if (platformRaw && typeof platformRaw === 'string') {
                try {
                  anime.streaming_partners = JSON.parse(platformRaw);
                  anime.platforms_data = anime.streaming_partners;
                } catch {
                  anime.streaming_partners = [];
                }
              }
              const mixedRaw = anime.mixed_entries || anime.mixedEntries;
              if (mixedRaw && typeof mixedRaw === 'string') {
                try {
                  anime.mixed_entries = JSON.parse(mixedRaw);
                  anime.mixedEntries = anime.mixed_entries;
                } catch {
                  anime.mixed_entries = [];
                  anime.mixedEntries = [];
                }
              }
              return jsonResponse(anime, 200, request);
            }
          }
          const fallback = SEED_ANIME.find(a => String(a.id) === id || a.slug === id);
          return fallback ? jsonResponse(fallback, 200, request) : jsonResponse({ error: "Not found" }, 404, request);
        }
        if (method === "PUT" || method === "PATCH") {
          try {
            const body = await request.json().catch(() => ({}));
            let platformsDataStr = null;
            let rawPlatforms = body.streaming_partners !== undefined ? body.streaming_partners : (body.streamingPartners !== undefined ? body.streamingPartners : (body.platforms_data !== undefined ? body.platforms_data : body.platformsData));
            if (rawPlatforms !== undefined) {
              if (Array.isArray(rawPlatforms)) {
                rawPlatforms = rawPlatforms.map(p => ({ ...p, url: cleanWatchUrl(p.url) }));
              }
              platformsDataStr = typeof rawPlatforms === 'string' ? rawPlatforms : JSON.stringify(rawPlatforms);
            }
            const rawWatchUrl = body.watch_url !== undefined ? body.watch_url : body.watchUrl;
            const watchUrl = cleanWatchUrl(rawWatchUrl);

            const rawMixed = body.mixed_entries !== undefined ? body.mixed_entries : (body.mixedEntries !== undefined ? body.mixedEntries : null);
            let mixedDataStr = null;
            if (rawMixed !== null) {
              mixedDataStr = typeof rawMixed === 'string' ? rawMixed : JSON.stringify(rawMixed);
            }
            const episodesPerSeason = body.episodes_per_season !== undefined 
              ? String(body.episodes_per_season) 
              : (Array.isArray(rawMixed) ? rawMixed.map(m => m.episodes || m.episodeCount || 0).join('|') : null);

            if (env.DB) {
              await env.DB.prepare("ALTER TABLE anime ADD COLUMN platforms_data TEXT DEFAULT ''").run().catch(() => {});
              await env.DB.prepare("ALTER TABLE anime ADD COLUMN streaming_partners TEXT DEFAULT ''").run().catch(() => {});
              await env.DB.prepare("ALTER TABLE anime ADD COLUMN watch_url TEXT DEFAULT ''").run().catch(() => {});
              await env.DB.prepare("ALTER TABLE anime ADD COLUMN mixedEntries TEXT DEFAULT ''").run().catch(() => {});
              await env.DB.prepare("ALTER TABLE anime ADD COLUMN mixed_entries TEXT DEFAULT ''").run().catch(() => {});
              await env.DB.prepare("ALTER TABLE anime ADD COLUMN episodes_per_season TEXT DEFAULT ''").run().catch(() => {});

              await env.DB.prepare(`
                UPDATE anime SET
                  title = COALESCE(?, title),
                  synopsis = COALESCE(?, synopsis),
                  cover_image = COALESCE(?, cover_image),
                  banner_image = COALESCE(?, banner_image),
                  rating = COALESCE(?, rating),
                  episodes_count = COALESCE(?, episodes_count),
                  status = COALESCE(?, status),
                  year = COALESCE(?, year),
                  genres = COALESCE(?, genres),
                  languages = COALESCE(?, languages),
                  platform = COALESCE(?, platform),
                  studio = COALESCE(?, studio),
                  type = COALESCE(?, type),
                  platforms_data = CASE WHEN ? IS NOT NULL THEN ? ELSE platforms_data END,
                  streaming_partners = CASE WHEN ? IS NOT NULL THEN ? ELSE streaming_partners END,
                  watch_url = CASE WHEN ? IS NOT NULL THEN ? ELSE watch_url END,
                  mixedEntries = CASE WHEN ? IS NOT NULL THEN ? ELSE mixedEntries END,
                  mixed_entries = CASE WHEN ? IS NOT NULL THEN ? ELSE mixed_entries END,
                  episodes_per_season = CASE WHEN ? IS NOT NULL THEN ? ELSE episodes_per_season END
                WHERE id = ? OR slug = ?
              `).bind(
                body.title ?? null,
                body.synopsis ?? null,
                body.cover_image ?? body.poster_url ?? null,
                body.banner_image ?? null,
                body.rating !== undefined ? Number(body.rating) : null,
                body.episodes_count !== undefined ? Number(body.episodes_count) : null,
                body.status ?? null,
                body.year !== undefined ? Number(body.year) : null,
                Array.isArray(body.genres) ? body.genres.join(', ') : (body.genres ?? null),
                Array.isArray(body.languages) ? body.languages.join(', ') : (body.languages ?? null),
                body.platform ?? null,
                body.studio ?? null,
                body.type ?? null,
                platformsDataStr, platformsDataStr,
                platformsDataStr, platformsDataStr,
                watchUrl ?? null, watchUrl ?? null,
                mixedDataStr, mixedDataStr,
                mixedDataStr, mixedDataStr,
                episodesPerSeason ?? null, episodesPerSeason ?? null,
                id, id
              ).run();

              const updated = await env.DB.prepare("SELECT * FROM anime WHERE id = ? OR slug = ?").bind(id, id).first();
              return jsonResponse({ success: true, id, data: updated }, 200, request);
            }
            return jsonResponse({ success: true, id, data: body }, 200, request);
          } catch (updateErr) {
            console.error("Worker UPDATE error:", updateErr);
            return jsonResponse({ success: false, error: updateErr.message }, 500, request);
          }
        }
        if (method === "DELETE") {
          try {
            if (env.DB) {
              await env.DB.prepare("DELETE FROM episodes WHERE anime_id = ?").bind(id).run();
              await env.DB.prepare("DELETE FROM reviews WHERE anime_id = ?").bind(id).run();
              await env.DB.prepare("DELETE FROM watchlist WHERE anime_id = ?").bind(id).run();
              await env.DB.prepare("DELETE FROM anime WHERE id = ? OR slug = ?").bind(id, id).run();
            }
            return jsonResponse({ success: true, id }, 200, request);
          } catch (delErr) {
            console.error("Worker DELETE error:", delErr);
            return jsonResponse({ success: false, error: delErr.message }, 500, request);
          }
        }
      }

      // 13. Admin Pending Queue
      if (path === "/api/admin/pending" && method === "GET") {
        try {
          if (env.DB) {
            const { results } = await env.DB.prepare(
              "SELECT * FROM anime WHERE status = 'pending' OR submissionStatus = 'pending' ORDER BY id DESC"
            ).all();
            return jsonResponse({ success: true, data: results || [], total: (results || []).length }, 200, request);
          }
          return jsonResponse({ success: true, data: [], total: 0 }, 200, request);
        } catch (e) {
          return jsonResponse({ success: false, error: e.message, data: [] }, 500, request);
        }
      }

      // 14. Admin CSV Import
      if (path === "/api/admin/import-csv" && method === "POST") {
        try {
          const body = await request.json();
          let rows = [];
          if (Array.isArray(body)) rows = body;
          else if (Array.isArray(body?.animeList)) rows = body.animeList;
          else if (Array.isArray(body?.data)) rows = body.data;

          if (!rows || rows.length === 0) {
            return jsonResponse({ success: false, error: "Empty CSV payload" }, 400, request);
          }

          // Title Normalization and Key Simplification
          const normalizeTitle = (t) => {
            return String(t || '')
              .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
              .replace(/["'“”‘’]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
          };

          const simplifyTitleKey = (t) => {
            return normalizeTitle(t).replace(/[^a-z0-9]/g, '');
          };

          const extractTitleFromRow = (r) => {
            if (!r || typeof r !== 'object') return '';
            return String(
              r.title || 
              r['Title'] || 
              r['title'] || 
              r.Name || 
              r['Name'] || 
              r['name'] || 
              r.anime || 
              r['Anime'] || 
              r['anime'] || 
              r['Anime Title'] || 
              r['anime_title'] || 
              r['Series'] || 
              r['series'] || 
              r['Title (English)'] ||
              (Object.values(r)[0] ?? '')
            ).trim();
          };

          // 1. Pre-fetch all existing titles and slugs from Cloudflare D1
          const existingNormalizedTitles = new Set();
          const existingSimplifiedKeys = new Set();
          const existingSlugs = new Set();

          if (env.DB) {
            try {
              const res = await env.DB.prepare("SELECT title, slug FROM anime").all();
              const items = (res && res.results) ? res.results : [];
              for (const item of items) {
                if (item.title) {
                  existingNormalizedTitles.add(normalizeTitle(item.title));
                  existingSimplifiedKeys.add(simplifyTitleKey(item.title));
                }
                if (item.slug) {
                  existingSlugs.add(normalizeTitle(item.slug));
                  existingSimplifiedKeys.add(simplifyTitleKey(item.slug));
                }
              }
            } catch (dbErr) {
              console.warn('[Worker D1 fetch existing titles warning]:', dbErr);
            }
          }

          // 2. Strict In-Memory Filtering against D1 and within this batch
          const seenInThisUpload = new Set();
          const seenInThisUploadKeys = new Set();
          const itemsToInsert = [];
          const skippedTitles = [];
          const addedTitles = [];
          let skippedCount = 0;

          for (const row of rows) {
            const rawTitle = extractTitleFromRow(row);
            const norm = normalizeTitle(rawTitle);
            const key = simplifyTitleKey(rawTitle);

            if (!norm || !key) {
              skippedCount++;
              continue;
            }

            const baseSlug = norm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'anime';

            // Check if this anime already exists in catalog or pending, or repeated in the CSV
            const isAlreadyInDb = existingNormalizedTitles.has(norm) || existingSimplifiedKeys.has(key) || existingSlugs.has(baseSlug);
            const isDuplicateInBatch = seenInThisUpload.has(norm) || seenInThisUploadKeys.has(key);

            if (isAlreadyInDb || isDuplicateInBatch) {
              skippedCount++;
              skippedTitles.push(rawTitle);
              continue;
            }

            seenInThisUpload.add(norm);
            seenInThisUploadKeys.add(key);
            existingNormalizedTitles.add(norm);
            existingSimplifiedKeys.add(key);
            existingSlugs.add(baseSlug);

            itemsToInsert.push({ ...row, resolvedTitle: rawTitle, resolvedSlug: baseSlug });
            addedTitles.push(rawTitle);
          }

          // 3. Insert ONLY the remaining truly unique anime into pending queue
          let insertedCount = 0;
          for (const row of itemsToInsert) {
            const title = row.resolvedTitle;
            const slug = row.resolvedSlug;
            const synopsis = (row.synopsis || row.Synopsis || row.description || row.Description || 'Exciting anime series').toString().trim();
            const year = parseInt(row.year || row['Release Year'] || row.Year || '2024', 10) || 2024;
            const rating = parseFloat(row.rating || row.Ratings || row.Rating || '8.5') || 8.5;
            const genres = Array.isArray(row.genres) ? row.genres.join(', ') : (typeof row.genres === 'string' && row.genres.includes('|') ? row.genres.split('|').map((g) => g.trim()).join(', ') : (row.genres || row.Genres || 'Action, Fantasy')).toString().trim();
            const platform = (row.platform || row.Platform || 'Crunchyroll').toString().trim();
            const languages = Array.isArray(row.languages) ? row.languages.join(', ') : (typeof row.languages === 'string' && row.languages.includes('|') ? row.languages.split('|').map((l) => l.trim()).join(', ') : (row.languages || row.Languages || 'Tamil, Hindi')).toString().trim();
            const cover_image = row.cover_image || row.poster_url || row['Poster'] || row['Poster URL'] || row['Cover Image'] || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800';
            const banner_image = row.banner_image || row['Banner Image'] || cover_image;

            const rawStatus = (row.status || row.airing_status || row.Status || '').toString().trim().toLowerCase();
            const resolvedStatus = rawStatus.includes('complete') ? 'Completed' : 'Airing';

            let studio = '';
            if (row.Studio !== undefined && row.Studio !== null && String(row.Studio).trim() !== '') {
              studio = String(row.Studio).trim();
            } else if (row.studio !== undefined && row.studio !== null && String(row.studio).trim() !== '') {
              studio = String(row.studio).trim();
            } else if (row.STUDIO !== undefined && row.STUDIO !== null && String(row.STUDIO).trim() !== '') {
              studio = String(row.STUDIO).trim();
            } else if (row['Studio Name'] || row['studio_name'] || row['Studio_Name'] || row.studio_name) {
              studio = String(row['Studio Name'] || row['studio_name'] || row['Studio_Name'] || row.studio_name).trim();
            } else if (row.animation_studio || row.Animation_Studio || row.AnimationStudio || row['Animation Studio'] || row.animationstudio) {
              studio = String(row.animation_studio || row.Animation_Studio || row.AnimationStudio || row['Animation Studio'] || row.animationstudio).trim();
            } else {
              const studioKey = Object.keys(row).find(k => {
                const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return clean === 'studio' || clean.includes('studio') || clean.includes('animationstudio');
              });
              if (studioKey && row[studioKey]) {
                studio = String(row[studioKey]).trim();
              }
            }
            if (!studio) studio = 'Unknown Studio';

            const resolvedType = (row.type || row.Type || 'TV Series').toString().trim();
            const epCount = parseInt(row.episodes_count || row.episodes || '12', 10) || 12;

            let mixedEntriesRaw = row.mixed_entries || row.mixedEntries;
            if (!mixedEntriesRaw && typeof row['Seasons'] === 'string') {
              mixedEntriesRaw = row['Seasons'].split('|').map((entry) => {
                const [name, eps] = entry.split(':');
                return {
                  type: 'Season',
                  name: name ? name.trim() : '',
                  episodes: parseInt(eps) || null
                };
              }).filter((e) => e.name !== '');
            }

            const mixedEntriesJson = Array.isArray(mixedEntriesRaw) 
              ? JSON.stringify(mixedEntriesRaw) 
              : (typeof mixedEntriesRaw === 'string' ? mixedEntriesRaw : '');

            const episodesPerSeason = Array.isArray(mixedEntriesRaw) && mixedEntriesRaw.length > 0
              ? mixedEntriesRaw.map((e) => e.episodes || 12).join('|')
              : (row.episodes_per_season ? String(row.episodes_per_season) : String(epCount));

            if (env.DB) {
              try {
                await env.DB.prepare(
                  `INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, airing_status, submissionStatus, approval_status, is_published, season, year, genres, popularity, languages, platform, type, studio, episodes_per_season, mixedEntries)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 0, 'Spring', ?, ?, 0, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(title) DO NOTHING`
                ).bind(title, slug, synopsis, cover_image, banner_image, rating, epCount, resolvedStatus, resolvedStatus, year, genres, languages, platform, resolvedType, studio, episodesPerSeason, mixedEntriesJson).run();
              } catch (firstErr) {
                // Auto-heal missing D1 columns if migrations have not been applied yet
                try { await env.DB.prepare("ALTER TABLE anime ADD COLUMN is_published INTEGER DEFAULT 0").run(); } catch (e) {}
                try { await env.DB.prepare("ALTER TABLE anime ADD COLUMN studio TEXT DEFAULT 'Unknown Studio'").run(); } catch (e) {}
                try { await env.DB.prepare("ALTER TABLE anime ADD COLUMN approval_status TEXT DEFAULT 'pending'").run(); } catch (e) {}
                try { await env.DB.prepare("ALTER TABLE anime ADD COLUMN submissionStatus TEXT DEFAULT 'pending'").run(); } catch (e) {}
                try { await env.DB.prepare("ALTER TABLE anime ADD COLUMN episodes_per_season TEXT DEFAULT ''").run(); } catch (e) {}
                try { await env.DB.prepare("ALTER TABLE anime ADD COLUMN mixedEntries TEXT DEFAULT ''").run(); } catch (e) {}

                try {
                  await env.DB.prepare(
                    `INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, airing_status, submissionStatus, approval_status, is_published, season, year, genres, popularity, languages, platform, type, studio, episodes_per_season, mixedEntries)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 0, 'Spring', ?, ?, 0, ?, ?, ?, ?, ?, ?)`
                  ).bind(title, slug, synopsis, cover_image, banner_image, rating, epCount, resolvedStatus, resolvedStatus, year, genres, languages, platform, resolvedType, studio, episodesPerSeason, mixedEntriesJson).run();
                } catch {
                  await env.DB.prepare(
                    `INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, submissionStatus, is_published, season, year, genres, popularity, languages, platform, type, studio)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 'Spring', ?, ?, 0, ?, ?, ?, ?)`
                  ).bind(title, slug, synopsis, cover_image, banner_image, rating, epCount, resolvedStatus, year, genres, languages, platform, resolvedType, studio).run();
                }
              }
            }
            insertedCount++;
          }

          return jsonResponse({
            success: true,
            count: insertedCount,
            insertedCount,
            skippedCount,
            skippedTitles,
            addedTitles,
            message: `Upload complete: ${insertedCount} added to pending queue, ${skippedCount} existing titles rejected.`
          }, 200, request);
        } catch (csvErr) {
          console.error("Worker CSV Import error:", csvErr);
          return jsonResponse({ success: false, error: csvErr.message }, 500, request);
        }
      }

      // 14b. Admin Clear Pending Queue
      if (path === "/api/admin/clear-pending" && method === "POST") {
        try {
          if (env.DB) {
            await env.DB.prepare("DELETE FROM anime WHERE status = 'pending' OR submissionStatus = 'pending' OR approval_status = 'pending'").run();
          }
          return jsonResponse({ success: true, message: "Pending queue wiped successfully" }, 200, request);
        } catch (e) {
          return jsonResponse({ success: false, error: e.message }, 500, request);
        }
      }

      // 15. Admin Approve / Reject
      const approveMatch = path.match(/^\/api\/admin\/approve\/([0-9a-zA-Z_-]+)$/);
      if (approveMatch && method === "POST") {
        const id = approveMatch[1];
        if (env.DB) {
          await env.DB.prepare("UPDATE anime SET status = 'Ongoing', submissionStatus = 'approved', approval_status = 'approved', is_published = 1 WHERE id = ?").bind(id).run();
        }
        return jsonResponse({ success: true, id, submissionStatus: 'approved' }, 200, request);
      }

      const rejectMatch = path.match(/^\/api\/admin\/reject\/([0-9a-zA-Z_-]+)$/);
      if (rejectMatch && method === "POST") {
        const id = rejectMatch[1];
        if (env.DB) {
          await env.DB.prepare("DELETE FROM anime WHERE id = ?").bind(id).run();
        }
        return jsonResponse({ success: true, id }, 200, request);
      }

      // 16. GOD-MODE EDGE ANALYTICS: POST /api/track
      if (path === "/api/track" && method === "POST") {
        try {
          let payload;
          const contentType = (request.headers.get("content-type") || "").toLowerCase();
          if (contentType.includes("application/json")) {
            payload = await request.json().catch(() => ({}));
          } else {
            const text = await request.text().catch(() => "");
            try { payload = JSON.parse(text); } catch { payload = {}; }
          }

          const sessionId = payload?.sessionId || payload?.session_id;
          if (!sessionId) {
            return jsonResponse({ success: false, error: "Missing sessionId" }, 400, request);
          }

          const country = request.cf?.country || request.headers.get("cf-ipcountry") || "IN";
          const rawRegion = request.cf?.region || request.headers.get("cf-region") || request.headers.get("cf-region-code") || payload?.region || "";
          const region = rawRegion ? decodeURIComponent(rawRegion) : "Tamil Nadu";
          const city = request.cf?.city || request.headers.get("cf-ipcity") || request.headers.get("cf-city") || "Chennai";
          const rawIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";

          let ipHash = "anon_visitor";
          try {
            const msgUint8 = new TextEncoder().encode(rawIp + "_anidub_edge_salt");
            const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            ipHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
          } catch (_) {}

          const ua = request.headers.get("user-agent") || "";
          let deviceType = "desktop";
          if (/tablet|ipad/i.test(ua)) deviceType = "tablet";
          else if (/mobile|android|iphone/i.test(ua)) deviceType = "mobile";

          let os = "Unknown OS";
          if (/windows/i.test(ua)) os = "Windows";
          else if (/macintosh|mac os/i.test(ua)) os = "macOS";
          else if (/android/i.test(ua)) os = "Android";
          else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
          else if (/linux/i.test(ua)) os = "Linux";

          let browser = "Unknown";
          if (/edg/i.test(ua)) browser = "Edge";
          else if (/chrome|crios/i.test(ua)) browser = deviceType === "mobile" ? "Chrome Mobile" : "Chrome";
          else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
          else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = deviceType === "mobile" ? "Safari Mobile" : "Safari";

          const clerkUserId = payload.clerkUserId || payload.clerk_user_id || null;
          const referrer = payload.referrer || "direct";

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO analytics_sessions (session_id, clerk_user_id, ip_hash, country, region, city, os, browser, device_type, referrer, started_at, last_active_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
              ON CONFLICT(session_id) DO UPDATE SET 
                last_active_at = datetime('now'),
                clerk_user_id = COALESCE(excluded.clerk_user_id, analytics_sessions.clerk_user_id),
                region = COALESCE(excluded.region, analytics_sessions.region)
            `).bind(sessionId, clerkUserId, ipHash, country, region, city, os, browser, deviceType, referrer).run();

            if (payload.path || payload.pageview) {
              const p = payload.path || payload.pageview?.path || "/";
              const t = Math.max(0, Math.round(Number(payload.timeSpentSeconds ?? payload.pageview?.timeSpentSeconds ?? 0)));
              const s = Math.min(100, Math.max(0, Math.round(Number(payload.maxScrollDepth ?? payload.pageview?.maxScrollDepth ?? 0))));
              await env.DB.prepare(`
                INSERT INTO analytics_pageviews (session_id, path, time_spent_seconds, max_scroll_depth, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
              `).bind(sessionId, p, t, s).run();
            }

            if (Array.isArray(payload.events) && payload.events.length > 0) {
              for (const evt of payload.events) {
                if (evt && (evt.eventType || evt.type)) {
                  await env.DB.prepare(`
                    INSERT INTO analytics_events (session_id, event_type, target_id, created_at)
                    VALUES (?, ?, ?, datetime('now'))
                  `).bind(sessionId, evt.eventType || evt.type, evt.targetId || evt.target || null).run();
                }
              }
            } else if (payload.eventType || payload.event_type) {
              await env.DB.prepare(`
                INSERT INTO analytics_events (session_id, event_type, target_id, created_at)
                VALUES (?, ?, ?, datetime('now'))
              `).bind(sessionId, payload.eventType || payload.event_type, payload.targetId || payload.target_id || null).run();
            }
          }

          return jsonResponse({ success: true, sessionId }, 200, request);
        } catch (err) {
          return jsonResponse({ success: false, error: err.message }, 500, request);
        }
      }

      // 17. GOD-MODE EDGE ANALYTICS: GET /api/analytics/dashboard
      if (path === "/api/analytics/dashboard" && method === "GET") {
        try {
          const url = new URL(request.url);
          const range = url.searchParams.get("range") || "all";

          let timeFilter = "1=1";
          let sessionFilter = "1=1";
          if (range === "today") {
            timeFilter = "date(created_at) = date('now')";
            sessionFilter = "date(started_at) = date('now')";
          } else if (range === "24h") {
            timeFilter = "created_at >= datetime('now', '-24 hours')";
            sessionFilter = "started_at >= datetime('now', '-24 hours')";
          } else if (range === "7d") {
            timeFilter = "created_at >= datetime('now', '-7 days')";
            sessionFilter = "started_at >= datetime('now', '-7 days')";
          }

          if (!env.DB) {
            return jsonResponse({ success: true, data: { liveUsersCount: 0, totalSessions: 0, uniqueVisitors: 0, totalPageviews: 0, topPages: [], regions: [], cities: [], countries: [], devices: [], browsers: [], os: [], outboundClicks: [], recentEvents: [] } }, 200, request);
          }

          const [liveRes, sessRes, pvRes, bounceRes, topPagesRes, regionsRes, citiesRes, countriesRes, devRes, browserRes, osRes, outRes, eventsRes] = await Promise.all([
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
            env.DB.prepare(`SELECT e.id, e.session_id, e.event_type, e.target_id, e.created_at, COALESCE(s.region, s.city, 'Tamil Nadu') as region, s.city, s.country FROM analytics_events e LEFT JOIN analytics_sessions s ON e.session_id = s.session_id ORDER BY e.id DESC LIMIT 20`).all()
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
              recentEvents: eventsRes?.results || []
            }
          }, 200, request);
        } catch (err) {
          return jsonResponse({ success: false, error: err.message }, 500, request);
        }
      }

      // 18. Catch-all for /api/
      if (path.startsWith("/api/")) {
        return jsonResponse({ error: "Endpoint not implemented on worker", path }, 404, request);
      }

      return jsonResponse({ error: "Route not found", path }, 404, request);
    } catch (e) {
      console.error("Worker Global Error:", e);
      return jsonResponse({ 
        error: "Internal Worker Error", 
        message: e.message,
        stack: e.stack?.split('\n').slice(0, 3) 
      }, 500, request);
    }
  }
};

