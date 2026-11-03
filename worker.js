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
        const { results } = await this.env.DB.prepare(
          "SELECT id, user, text, timestamp, rating, language, isReview FROM chat_messages ORDER BY id DESC LIMIT 60"
        ).all();
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
          user: String(data.user || "Anonymous Fan").slice(0, 50),
          text: String(data.text || "").slice(0, 1000),
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : null,
          language: data.language ? String(data.language).slice(0, 30) : null,
          isReview: data.isReview ? 1 : 0
        };

        if (this.env.DB) {
          await this.env.DB.prepare(
            "INSERT INTO chat_messages (user, text, timestamp, rating, language, isReview) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(chatMsg.user, chatMsg.text, chatMsg.timestamp, chatMsg.rating, chatMsg.language, chatMsg.isReview).run();
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

function getCorsHeaders(request) {
  const origin = request ? (request.headers.get("Origin") || request.headers.get("origin")) : null;
  
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, x-device-id, x-requested-with, Accept, Origin, Cache-Control, Pragma",
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
            let where = ["(status != 'pending' OR status IS NULL)"];
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
            const { results } = await env.DB.prepare("SELECT * FROM chat_messages ORDER BY id DESC LIMIT 50").all();
            return jsonResponse(results || [], 200, request);
          }
          return jsonResponse([], 200, request);
        }
        if (method === "POST") {
          const body = await request.json();
          if (env.DB) {
            await env.DB.prepare("INSERT INTO chat_messages (user, text, timestamp) VALUES (?, ?, ?)")
              .bind(body.user || 'Anon', body.text || '', new Date().toISOString()).run();
          }
          return jsonResponse({ success: true }, 201, request);
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

      // 12. Individual Anime GET/DELETE
      const animeMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)$/);
      if (animeMatch) {
        const id = animeMatch[1];
        if (method === "GET") {
          if (env.DB) {
            const anime = await env.DB.prepare("SELECT * FROM anime WHERE id = ? OR slug = ?").bind(id, id).first();
            if (anime) return jsonResponse(anime, 200, request);
          }
          const fallback = SEED_ANIME.find(a => String(a.id) === id || a.slug === id);
          return fallback ? jsonResponse(fallback, 200, request) : jsonResponse({ error: "Not found" }, 404, request);
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

          let insertedCount = 0;
          let skippedCount = 0;

          for (const row of rows) {
            const title = (row.title || row.Title || row.name || row.Name || Object.values(row)[0] || '').toString().trim();
            if (!title) {
              skippedCount++;
              continue;
            }

            const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
            const synopsis = (row.synopsis || row.Synopsis || row.description || row.Description || 'Exciting anime series').toString().trim();
            const year = parseInt(row.year || row.Year || '2024', 10) || 2024;
            const rating = parseFloat(row.rating || row.Ratings || '8.5') || 8.5;
            const genres = (row.genres || row.Genres || 'Action, Fantasy').toString().trim();
            const platform = (row.platform || row.Platform || 'Crunchyroll').toString().trim();
            const languages = (row.languages || row.Languages || 'Tamil, Hindi').toString().trim();
            const cover_image = row.cover_image || row['Cover Image'] || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800';
            const banner_image = row.banner_image || row['Banner Image'] || cover_image;

            if (env.DB) {
              await env.DB.prepare(
                `INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, submissionStatus, season, year, genres, popularity, languages, platform, type)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'Spring', ?, ?, 0, ?, ?, 'TV Series')`
              ).bind(title, slug, synopsis, cover_image, banner_image, rating, 12, year, genres, languages, platform).run();
            }
            insertedCount++;
          }

          return jsonResponse({ success: true, count: insertedCount, skipped: skippedCount }, 200, request);
        } catch (csvErr) {
          console.error("Worker CSV Import error:", csvErr);
          return jsonResponse({ success: false, error: csvErr.message }, 500, request);
        }
      }

      // 15. Admin Approve / Reject
      const approveMatch = path.match(/^\/api\/admin\/approve\/([0-9a-zA-Z_-]+)$/);
      if (approveMatch && method === "POST") {
        const id = approveMatch[1];
        if (env.DB) {
          await env.DB.prepare("UPDATE anime SET status = 'Ongoing', submissionStatus = 'approved' WHERE id = ?").bind(id).run();
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

      // 16. Catch-all for /api/
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

