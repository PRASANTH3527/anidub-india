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
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    await this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
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

        const payload = JSON.stringify(chatMsg);
        for (const session of this.sessions) {
          try {
            session.send(payload);
          } catch (err) {
            this.sessions.delete(session);
          }
        }
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
  { id: 1, title: 'Solo Leveling', slug: 'solo-leveling', synopsis: 'In a world of hunters...', cover_image: 'https://cdn.myanimelist.net/images/anime/1546/141065.jpg', rating: 8.7, year: 2024, genres: 'Action, Fantasy', platform: 'Crunchyroll', popularity: 95000 },
  { id: 2, title: 'Demon Slayer', slug: 'demon-slayer', synopsis: 'Family slaughtered...', cover_image: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg', rating: 8.9, year: 2019, genres: 'Action, Supernatural', platform: 'Netflix', popularity: 120000 },
  { id: 3, title: 'Naruto Shippuden', slug: 'naruto-shippuden', synopsis: 'Intense training...', cover_image: 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg', rating: 8.3, year: 2007, genres: 'Action, Adventure', platform: 'Sony YAY!', popularity: 88000 },
  { id: 4, title: 'Jujutsu Kaisen', slug: 'jujutsu-kaisen', synopsis: 'Cursed spirit...', cover_image: 'https://cdn.myanimelist.net/images/anime/1171/109222.jpg', rating: 8.8, year: 2020, genres: 'Action, Supernatural', platform: 'Crunchyroll', popularity: 110000 }
];

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || request.headers.get("origin") || "*";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, X-Admin-Token, Accept, Origin, x-requested-with, x-device-id",
    "Access-Control-Max-Age": "86400",
  };

  // Stricter CORS for credentials support
  if (origin !== "*") {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

function jsonResponse(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(request)
    }
  });
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

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    try {
      // 1. Health & Status
      if (path === "/" || path === "/api/health") {
        return jsonResponse({ status: "healthy", service: "AniDub India Worker" }, 200, request);
      }

      // 2. Catalog GET /api/anime
      if (path === "/api/anime" && method === "GET") {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = (page - 1) * limit;
        const search = url.searchParams.get('search');
        const genre = url.searchParams.get('genre');

        if (env.DB) {
          try {
            let where = [];
            let params = [];
            if (search) { where.push("(title LIKE ? OR synopsis LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
            if (genre && genre !== 'All') { where.push("genres LIKE ?"); params.push(`%${genre}%`); }
            
            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const count = await env.DB.prepare(`SELECT COUNT(*) as total FROM anime ${whereSql}`).bind(...params).first();
            const total = count?.total || 0;
            
            const results = await env.DB.prepare(`SELECT * FROM anime ${whereSql} ORDER BY popularity DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();
            return jsonResponse({ data: results.results || [], pagination: { total, page, limit } }, 200, request);
          } catch (e) {
            console.error("D1 Fetch Error:", e);
          }
        }
        return jsonResponse({ data: SEED_ANIME.slice(offset, offset + limit), pagination: { total: SEED_ANIME.length, page, limit } }, 200, request);
      }

      // 3. POST /api/anime (Create)
      if (path === "/api/anime" && method === "POST") {
        const body = await request.json();
        if (env.DB) {
          const slug = (body.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-');
          await env.DB.prepare(`
            INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, season, year, genres, popularity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(body.title, slug, body.synopsis || '', body.cover_image || '', body.banner_image || '', body.rating || 8.5, body.episodes_count || 12, body.status || 'Airing', body.season || 'Spring', body.year || 2024, body.genres || 'Action', 50000).run();
        }
        await sendTelegramAlert(env, `<b>New Anime Added:</b> ${body.title}`);
        return jsonResponse({ success: true }, 201, request);
      }

      // 4. Admin Auth
      if (path === "/api/admin/login" && method === "POST") {
        const { password } = await request.json();
        if (password === "prasanth123" || password === env.ADMIN_PASSWORD) {
          return jsonResponse({ success: true, token: "cf_admin_edge_token_" + Date.now() }, 200, request);
        }
        return jsonResponse({ success: false, error: "Unauthorized" }, 401, request);
      }

      if (path === "/api/admin/verify") {
        return jsonResponse({ success: true }, 200, request);
      }

      // 5. Upload Proxy
      if (path === "/api/upload" && method === "POST") {
        const body = await request.json();
        const apiKey = env.IMGBB_API_KEY || DEFAULT_IMGBB_KEY;
        const formData = new FormData();
        formData.append('image', body.image.replace(/^data:image\/\w+;base64,/, ''));
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: 'POST', body: formData });
        const data = await res.json();
        return jsonResponse(data, res.status, request);
      }

      // 6. Generic /api/anime/:id handler
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
        if (method === "DELETE" && env.DB) {
          await env.DB.prepare("DELETE FROM anime WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true }, 200, request);
        }
      }

      // 7. Feedback
      if (path === "/api/feedback") {
        if (method === "POST") {
          const body = await request.json();
          if (env.DB) {
            await env.DB.prepare("INSERT INTO feedback (name_or_insta, email, feedback_text) VALUES (?, ?, ?)")
              .bind(body.name || 'Anon', body.email || '', body.message || body.feedback || '').run();
          }
          await sendTelegramAlert(env, `<b>New Feedback:</b> ${body.message || body.feedback}`);
          return jsonResponse({ success: true }, 201, request);
        }
        if (method === "GET" && env.DB) {
          const res = await env.DB.prepare("SELECT * FROM feedback ORDER BY id DESC").all();
          return jsonResponse({ feedback: res.results || [] }, 200, request);
        }
      }

      return jsonResponse({ error: "Route not found" }, 404, request);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500, request);
    }
  }
};
