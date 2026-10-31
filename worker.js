/**
 * ============================================================================
 * ANIDUB INDIA - CLOUDFLARE WORKER BACKEND API & DURABLE OBJECT WEBSOCKET CHAT
 * ============================================================================
 */

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    await this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(webSocket) {
    webSocket.accept();
    this.sessions.add(webSocket);

    // Load recent message history from D1 database
    try {
      if (this.env.DB) {
        // Ensure table exists
        await this.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            rating REAL,
            language TEXT,
            isReview INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

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
      console.error("Failed to load chat history from D1:", e);
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

        // Save message to D1 database
        if (this.env.DB) {
          try {
            await this.env.DB.prepare(
              "INSERT INTO chat_messages (user, text, timestamp, rating, language, isReview) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(chatMsg.user, chatMsg.text, chatMsg.timestamp, chatMsg.rating, chatMsg.language, chatMsg.isReview).run();
          } catch (dbErr) {
            console.error("Failed to insert message into D1:", dbErr);
          }
        }

        const payload = JSON.stringify(chatMsg);
        for (const session of this.sessions) {
          try {
            session.send(payload);
          } catch (err) {
            this.sessions.delete(session);
          }
        }
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
    });

    webSocket.addEventListener("close", () => {
      this.sessions.delete(webSocket);
    });

    webSocket.addEventListener("error", () => {
      this.sessions.delete(webSocket);
    });
  }
}

// Helper: Standard / Dynamic CORS Headers
function getCorsHeaders(request) {
  const origin = request ? (request.headers.get("Origin") || request.headers.get("origin")) : null;
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, X-Admin-Token, Accept, Origin, x-requested-with, x-device-id, cf-connecting-ip",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "Set-Cookie, x-device-id",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data, status = 200, extraHeaders = {}, request = null) {
  const headers = new Headers(getCorsHeaders(request));
  headers.set("Content-Type", "application/json");
  for (const [key, val] of Object.entries(extraHeaders)) {
    if (val !== undefined && val !== null) {
      headers.set(key, val);
    }
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function getOrCreateDeviceId(request) {
  const cookieHeader = request.headers.get("Cookie") || request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)device_id=([^;]+)/);
  if (match && match[1]) {
    const existing = decodeURIComponent(match[1]).trim();
    if (existing) return { deviceId: existing, isNew: false };
  }
  const headerId = request.headers.get("x-device-id");
  if (headerId && headerId.trim()) return { deviceId: headerId.trim(), isNew: false };

  const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  return { deviceId: newId, isNew: true };
}

function buildDeviceCookie(deviceId) {
  const maxAge = 315360000;
  const expiresDate = new Date(Date.now() + maxAge * 1000).toUTCString();
  return `device_id=${encodeURIComponent(deviceId)}; Path=/; Max-Age=${maxAge}; Expires=${expiresDate}; SameSite=None; Secure; HttpOnly`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }

    try {
      // WebSocket chat upgrade endpoint routing to Durable Object
      if (path === "/ws") {
        const upgradeHeader = request.headers.get("Upgrade");
        if (!upgradeHeader || upgradeHeader !== "websocket") {
          return new Response("Expected Upgrade: websocket", { status: 426 });
        }
        try {
          const id = env.CHAT_ROOM.idFromName("global-anime-chat");
          const stub = env.CHAT_ROOM.get(id);
          return stub.fetch(request);
        } catch (err) {
          return new Response(`WebSocket Durable Object routing error: ${err.message}`, { status: 500 });
        }
      }

      // Basic health check
      if (path === "/" || path === "/api/health") {
        return jsonResponse({ status: "healthy", service: "AniDub India Cloudflare Worker API + WebSockets" });
      }

      // Chat History GET endpoint
      if ((path === "/api/chat" || path === "/api/chat/messages") && method === "GET") {
        let messages = [];
        if (env.DB) {
          try {
            await env.DB.prepare(`
              CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT NOT NULL,
                text TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                rating REAL,
                language TEXT,
                isReview INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `).run();
            const { results } = await env.DB.prepare(
              "SELECT id, user, text, timestamp, rating, language, isReview FROM chat_messages ORDER BY id ASC LIMIT 150"
            ).all();
            if (results) messages = results;
          } catch (e) {
            console.error("D1 chat read error:", e);
          }
        }
        if (messages.length === 0 && env.ANIME_DB && typeof env.ANIME_DB.get === "function") {
          try {
            const raw = await env.ANIME_DB.get("chat_history", { type: "json" });
            if (Array.isArray(raw)) messages = raw;
          } catch (_) {}
        }
        return jsonResponse({ success: true, count: messages.length, messages, data: messages });
      }

      // Chat Message POST endpoint
      if ((path === "/api/chat" || path === "/api/chat/messages") && method === "POST") {
        const body = await request.json();
        const user = String(body.user || "Anonymous Fan").slice(0, 50);
        const text = String(body.text || "").slice(0, 1000);
        const timestamp = String(body.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const rating = body.rating !== undefined ? Number(body.rating) : null;
        const language = body.language ? String(body.language).slice(0, 30) : null;
        const isReview = body.isReview ? 1 : 0;

        let insertedId = Date.now();
        if (env.DB) {
          try {
            await env.DB.prepare(
              "INSERT INTO chat_messages (user, text, timestamp, rating, language, isReview) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(user, text, timestamp, rating, language, isReview).run();
          } catch (e) {
            console.error("D1 chat insert error:", e);
          }
        }
        return jsonResponse({
          success: true,
          message: { id: insertedId, user, text, timestamp, rating, language, isReview: Boolean(isReview) }
        });
      }

      // 3. GET /api/anime (Catalog with pagination & search)
      if (path === "/api/anime" && method === "GET") {
        try {
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '8');
          const offset = (page - 1) * limit;
          const genre = url.searchParams.get('genre');
          const status = url.searchParams.get('status');
          const search = url.searchParams.get('search');
          const sort = url.searchParams.get('sort') || 'popularity';

          if (env.DB) {
            let whereClauses = [];
            let params = [];
            if (genre && genre !== 'All') {
              whereClauses.push("genres LIKE ?");
              params.push(`%${genre}%`);
            }
            if (status && status !== 'All') {
              whereClauses.push("status = ?");
              params.push(status);
            }
            if (search) {
              whereClauses.push("(title LIKE ? OR synopsis LIKE ? OR genres LIKE ?)");
              params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
            let orderSql = "ORDER BY popularity DESC";
            if (sort === 'rating') orderSql = "ORDER BY rating DESC";
            else if (sort === 'newest') orderSql = "ORDER BY year DESC, id DESC";
            else if (sort === 'title') orderSql = "ORDER BY title ASC";

            const countRes = await env.DB.prepare(`SELECT COUNT(*) as total FROM anime ${whereSql}`).bind(...params).first();
            const total = countRes ? Number(countRes.total) : 0;

            if (total > 0) {
              const queryParams = [...params, limit, offset];
              const dataRes = await env.DB.prepare(`SELECT * FROM anime ${whereSql} ${orderSql} LIMIT ? OFFSET ?`).bind(...queryParams).all();
              return jsonResponse({
                success: true,
                data: dataRes.results || [],
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
              });
            }
          }

          // Fallback to KV if D1 is empty
          if (env.ANIME_DB) {
            const raw = await env.ANIME_DB.get("anime_catalog", { type: "json" });
            if (Array.isArray(raw) && raw.length > 0) {
              return jsonResponse({
                success: true,
                data: raw.slice(offset, offset + limit),
                pagination: { page, limit, total: raw.length, totalPages: Math.ceil(raw.length / limit) }
              });
            }
          }

          // Ultimate Fallback: SEED ANIME
          const SEED_ANIME = [
            { id: 1, title: 'Solo Leveling', slug: 'solo-leveling', synopsis: 'In a world of hunters and monsters...', cover_image: 'https://cdn.myanimelist.net/images/anime/1546/141065.jpg', rating: 8.7, year: 2024, genres: 'Action, Fantasy', platform: 'Crunchyroll' },
            { id: 2, title: 'Demon Slayer', slug: 'demon-slayer', synopsis: 'Family slaughtered by demons...', cover_image: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg', rating: 8.9, year: 2019, genres: 'Action, Supernatural', platform: 'Netflix' },
            { id: 3, title: 'Naruto Shippuden', slug: 'naruto-shippuden', synopsis: 'Intense training follow up...', cover_image: 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg', rating: 8.3, year: 2007, genres: 'Action, Adventure', platform: 'Sony YAY!' },
            { id: 4, title: 'Jujutsu Kaisen', slug: 'jujutsu-kaisen', synopsis: 'Boy with tremendous strength...', cover_image: 'https://cdn.myanimelist.net/images/anime/1171/109222.jpg', rating: 8.8, year: 2020, genres: 'Action, Supernatural', platform: 'Crunchyroll' }
          ];

          return jsonResponse({
            success: true,
            data: SEED_ANIME.slice(offset, offset + limit),
            pagination: { 
              page, 
              limit, 
              total: SEED_ANIME.length, 
              totalPages: Math.ceil(SEED_ANIME.length / limit) 
            }
          });
        } catch (err) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      return jsonResponse({ error: `Route not found: ${method} ${path}` }, 404);
    } catch (err) {
      console.error("Worker error:", err);
      return jsonResponse({ error: err.message || "Internal Worker Error" }, 500);
    }
  }
};
