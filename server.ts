import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';
import { GoogleGenAI } from '@google/genai';
import { createAdminToken, verifyAdminToken, validateAdminPassword } from './src/utils/auth.js';
import { 
  formatNotificationTitle, 
  formatNotificationBody, 
  formatTelegramNotificationHtml, 
  NotificationPayload 
} from './src/utils/notifications.js';

const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Vary', 'Origin');
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token, x-device-id, Accept, Origin, Cache-Control, Pragma, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure data directory for D1 persistence exists
const dataDir = path.join(process.cwd(), 'data');
const imgCacheDir = path.join(dataDir, 'imgbb_cache');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(imgCacheDir)) fs.mkdirSync(imgCacheDir, { recursive: true });

// Read schema.sql for export / console inspection
const schemaSqlPath = path.join(process.cwd(), 'schema.sql');
let schemaSqlContent = '';
if (fs.existsSync(schemaSqlPath)) {
  schemaSqlContent = fs.readFileSync(schemaSqlPath, 'utf-8');
}

// Serve cached images if local fallback is triggered
app.use('/imgbb-cache', express.static(imgCacheDir));

// Proxy route for images to bypass ORB blocking
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) return res.status(400).send('Missing url parameter');
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Proxy fetch failed for ${imageUrl} with status: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        console.warn('Image not found, returning placeholder:', imageUrl);
        return res.redirect('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800');
      }
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', response.headers.get('Content-Type') || 'image/jpeg');
    res.set('Access-Control-Allow-Origin', '*'); // Allow CORS
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('Image proxy error:', err);
    res.status(502).send('Failed to fetch image: ' + err.message);
  }
});

// Initialize Gemini client (Server-side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'AIza-mock-key',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Initialize SQLite D1 Simulation using sql.js
let db: any = null;
const dbFilePath = path.join(dataDir, 'd1_database.sqlite');

async function initD1() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  runMigrations();
  persistD1();
  console.log('Cloudflare D1 Database initialized with ImgBB image support.');
}

function persistD1() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbFilePath, buffer);
}

// Helper: Escape HTML special characters for Telegram HTML parse_mode
function escapeTelegramHtml(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper: Get Telegram credentials from environment or SQLite system_settings
function getTelegramConfig(): { token: string; chatId: string } {
  let token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  let chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();

  if (db) {
    try {
      db.run("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)");
      const stmt1 = db.prepare("SELECT value FROM system_settings WHERE key = 'TELEGRAM_BOT_TOKEN'");
      if (stmt1.step()) {
        const val = stmt1.getAsObject()?.value;
        if (val && typeof val === 'string' && val.trim()) token = val.trim();
      }
      stmt1.free();

      const stmt2 = db.prepare("SELECT value FROM system_settings WHERE key = 'TELEGRAM_CHAT_ID'");
      if (stmt2.step()) {
        const val = stmt2.getAsObject()?.value;
        if (val && typeof val === 'string' && val.trim()) chatId = val.trim();
      }
      stmt2.free();
    } catch (_) {}
  }

  return { token, chatId };
}

// Helper: Send general Telegram message with photo fallback & error resilience
async function sendTelegramMessage(text: string, photoUrl?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const { token, chatId } = getTelegramConfig();

  if (!token || !chatId) {
    const errorMsg = 'Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured.';
    console.log(`[Telegram] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    if (photoUrl && typeof photoUrl === 'string' && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
      const photoEndpoint = `https://api.telegram.org/bot${token}/sendPhoto`;
      const photoRes = await fetch(photoEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: text.slice(0, 1024),
          parse_mode: 'HTML'
        })
      });

      if (photoRes.ok) {
        return { success: true, message: 'Telegram photo notification sent successfully.' };
      }
    }

    const msgEndpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(msgEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        parse_mode: 'HTML'
      })
    });

    if (res.ok) {
      return { success: true, message: 'Telegram message sent successfully.' };
    }

    return { success: false, error: 'Telegram dispatch failed' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to connect to Telegram API' };
  }
}

async function sendTelegramNotification(anime: any) {
  const langs = anime.languages || 'Tamil, Telugu, Hindi';
  const type = anime.type || 'TV Series';
  const rating = anime.rating || '8.5';
  const eps = anime.episodes_count || 12;
  const platform = anime.platform || 'Crunchyroll';
  const synop = anime.synopsis ? anime.synopsis.slice(0, 160) : 'Now streaming legally across India.';

  const htmlMessage =
    `🔥 <b>NEW ANIME ADDED TO DIRECTORY!</b> 🔥\n\n` +
    `📌 <b>Title:</b> ${escapeTelegramHtml(anime.title)}\n` +
    `⭐ <b>Rating:</b> ${escapeTelegramHtml(rating)}/10\n` +
    `📺 <b>Type:</b> ${escapeTelegramHtml(type)} (${escapeTelegramHtml(eps)} Episodes)\n` +
    `🎙 <b>Languages:</b> ${escapeTelegramHtml(langs)}\n` +
    `🏷 <b>Genres:</b> ${escapeTelegramHtml(anime.genres || 'Action, Fantasy')}\n` +
    `📅 <b>Season:</b> ${escapeTelegramHtml(anime.season || 'Spring')} ${escapeTelegramHtml(anime.year || 2026)}\n` +
    `🌐 <b>Platform:</b> ${escapeTelegramHtml(platform)}\n\n` +
    `💬 <i>"${escapeTelegramHtml(synop)}..."</i>\n\n` +
    `👉 <b>Stream now on Anidub India!</b>`;

  return await sendTelegramMessage(htmlMessage, anime.cover_image);
}

const sseClients = new Set<express.Response>();

async function broadcastActivityNotification(payload: NotificationPayload, sendTelegram: boolean = true) {
  const timestamp = payload.timestamp || new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const title = formatNotificationTitle(payload);
  const message = formatNotificationBody(payload);

  const eventData = {
    id: payload.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: payload.type,
    title,
    message,
    user: payload.user || 'Indian Anime Fan',
    anime_id: payload.anime_id ?? null,
    anime_title: payload.anime_title ?? null,
    rating: payload.rating ?? null,
    language: payload.language ?? null,
    link: payload.link || (payload.anime_id ? `/?anime=${payload.anime_id}` : null),
    timestamp
  };

  if (db) {
    try {
      db.run(`CREATE TABLE IF NOT EXISTS activity_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        user TEXT,
        anime_id INTEGER,
        anime_title TEXT,
        rating REAL,
        language TEXT,
        link TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`);
      db.run(
        `INSERT INTO activity_notifications (type, title, message, user, anime_id, anime_title, rating, language, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [eventData.type, eventData.title, eventData.message, eventData.user, eventData.anime_id, eventData.anime_title, eventData.rating, eventData.language, eventData.link]
      );
      persistD1();
    } catch (_) {}
  }

  const sseData = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(sseData);
    } catch {
      sseClients.delete(client);
    }
  }

  if (sendTelegram) {
    const tgHtml = formatTelegramNotificationHtml({ ...payload, title, message, timestamp });
    sendTelegramMessage(tgHtml).catch(() => {});
  }

  return eventData;
}

function logCloudflareEvent(service: string, eventType: string, status: number, latency: number, details: string) {
  try {
    if (!db) return;
    db.run(
      `INSERT INTO cloudflare_logs (timestamp, service, event_type, status_code, latency_ms, details) VALUES (?, ?, ?, ?, ?, ?)`,
      [new Date().toISOString(), service, eventType, status, latency, details]
    );
    persistD1();
  } catch (_) {}
}

function runMigrations() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      avatar_url TEXT NOT NULL DEFAULT 'https://i.ibb.co/vzS8G90/default-avatar.png',
      role TEXT DEFAULT 'user',
      bio TEXT DEFAULT 'Anime enthusiast streaming on Cloudflare Edge',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      synopsis TEXT,
      cover_image TEXT NOT NULL,
      banner_image TEXT NOT NULL,
      rating REAL DEFAULT 0.0,
      episodes_count INTEGER DEFAULT 12,
      status TEXT DEFAULT 'Airing',
      season TEXT DEFAULT 'Spring',
      year INTEGER DEFAULT 2026,
      genres TEXT NOT NULL,
      popularity INTEGER DEFAULT 0,
      watch_url TEXT DEFAULT '',
      platforms_data TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try { db.run("ALTER TABLE anime ADD COLUMN languages TEXT DEFAULT 'HIN,TAM,TEL';"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN platform TEXT DEFAULT 'Crunchyroll';"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN type TEXT DEFAULT 'TV Series';"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN studio TEXT DEFAULT 'Unknown Studio';"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN submissionStatus TEXT DEFAULT 'approved';"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN episodes_per_season TEXT DEFAULT '';"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN mixedEntries TEXT DEFAULT '';"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN likesCount INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN likes INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.run("ALTER TABLE anime ADD COLUMN upvotes INTEGER DEFAULT 0;"); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      duration TEXT DEFAULT '24m',
      thumbnail_url TEXT,
      video_url TEXT NOT NULL,
      synopsis TEXT,
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      user_id TEXT DEFAULT 'default_user',
      user_name TEXT NOT NULL,
      user_avatar TEXT DEFAULT 'https://i.ibb.co/vzS8G90/default-avatar.png',
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      anime_id INTEGER NOT NULL,
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, anime_id),
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_or_insta TEXT,
      email TEXT,
      feedback_text TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cloudflare_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      service TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS user_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      vote_type TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(anime_id, user_id, vote_type)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      rating REAL,
      language TEXT,
      isReview INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      user TEXT,
      anime_id INTEGER,
      anime_title TEXT,
      rating REAL,
      language TEXT,
      link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.run("DROP TABLE IF EXISTS user_votes;");
  } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS user_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      vote_type TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(anime_id, user_id, vote_type)
    );
  `);
}

// Admin Authentication Middleware
function requireAdminAuth(req: any, res: any, next: any) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !verifyAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized: Admin access required" });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (validateAdminPassword(password)) {
    const token = createAdminToken();
    return res.json({ success: true, token });
  }
  return res.status(401).json({ error: "Invalid admin password" });
});

// ImgBB Upload Gateway
async function uploadToImgBB(base64Image: string, filename: string = 'image.png'): Promise<{ success: boolean; url: string; display_url?: string }> {
  const apiKey = process.env.IMGBB_API_KEY || 'Ee6b4e37ae9c228c29b8448483b6591b';
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('image', cleanBase64);
    formData.append('name', filename.replace(/\.[^/.]+$/, ''));

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });

    const json: any = await res.json();
    if (json && json.success) {
      return { success: true, url: json.data.url, display_url: json.data.display_url };
    }
    throw new Error(json?.error?.message || 'ImgBB upload rejected');
  } catch (err: any) {
    console.warn('[ImgBB Fallback]:', err.message);
    const localFilename = `img_${Date.now()}_${filename}`;
    const localPath = path.join(imgCacheDir, localFilename);
    const baseData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    fs.writeFileSync(localPath, Buffer.from(baseData, 'base64'));
    const fallbackUrl = `/imgbb-cache/${localFilename}`;
    return { success: true, url: fallbackUrl, display_url: fallbackUrl };
  }
}

app.post('/api/upload', async (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image data" });
    const result = await uploadToImgBB(image, filename || 'poster.png');
    logCloudflareEvent('ImgBB', 'POST /api/upload', 200, 50, `Uploaded image: ${result.url}`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Stats Route
app.get('/api/user/stats', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default_user';
    const reviewStmt = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE user_id = 'default_user'");
    let reviewCount = 0;
    if (reviewStmt.step()) {
      reviewCount = reviewStmt.getAsObject().count as number;
    }
    reviewStmt.free();

    const voteStmt = db.prepare("SELECT COUNT(*) as count FROM user_votes WHERE user_id = ?");
    voteStmt.bind([userId]);
    let voteCount = 0;
    if (voteStmt.step()) {
      voteCount = voteStmt.getAsObject().count as number;
    }
    voteStmt.free();

    res.json({ reviewCount, voteCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/anime (Catalog List)
app.get('/api/anime', (req, res) => {
  const start = Date.now();
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 8;
    const offset = (page - 1) * limit;
    const genre = req.query.genre as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const sort = (req.query.sort as string) || 'popularity';

    let whereClauses: string[] = [];
    let params: any[] = [];

    const includePending = req.query.includePending === 'true';
    if (!includePending) {
      whereClauses.push("(status != 'pending' AND (submissionStatus IS NULL OR submissionStatus != 'pending'))");
    }

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

    const countQuery = `SELECT COUNT(*) as total FROM anime ${whereSql}`;
    const countStmt = db.prepare(countQuery);
    countStmt.bind(params);
    let total = 0;
    if (countStmt.step()) {
      total = countStmt.getAsObject().total as number;
    }
    countStmt.free();

    const dataQuery = `SELECT * FROM anime ${whereSql} ${orderSql} LIMIT ? OFFSET ?`;
    const dataStmt = db.prepare(dataQuery);
    dataStmt.bind([...params, limit, offset]);

    const animeList = [];
    while (dataStmt.step()) {
      const row: any = dataStmt.getAsObject();
      if (row.mixedEntries) {
        try { row.mixedEntries = JSON.parse(row.mixedEntries); } catch { row.mixedEntries = []; }
      }
      animeList.push(row);
    }
    dataStmt.free();

    res.json({
      data: animeList,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/anime/:id
app.get('/api/anime/:id', (req, res) => {
  try {
    const id = req.params.id;
    const stmt = db.prepare("SELECT * FROM anime WHERE id = ? OR slug = ?");
    stmt.bind([id, id]);
    if (!stmt.step()) {
      stmt.free();
      return res.status(404).json({ error: "Anime not found" });
    }
    const anime: any = stmt.getAsObject();
    if (anime.mixedEntries) {
      try { anime.mixedEntries = JSON.parse(anime.mixedEntries); } catch { anime.mixedEntries = []; }
    }
    stmt.free();

    const epStmt = db.prepare("SELECT * FROM episodes WHERE anime_id = ? ORDER BY episode_number ASC");
    epStmt.bind([anime.id]);
    const episodes = [];
    while (epStmt.step()) {
      episodes.push(epStmt.getAsObject());
    }
    epStmt.free();

    const revStmt = db.prepare("SELECT * FROM reviews WHERE anime_id = ? ORDER BY id DESC");
    revStmt.bind([anime.id]);
    const reviews = [];
    while (revStmt.step()) {
      const r: any = revStmt.getAsObject();
      reviews.push({
        id: r.id,
        anime_id: r.anime_id,
        user_name: r.user_name || 'Indian Anime Fan',
        author: r.user_name || 'Indian Anime Fan',
        user_avatar: r.user_avatar || 'https://i.ibb.co/vzS8G90/default-avatar.png',
        rating: r.rating,
        language: r.language || 'Regional Dub',
        comment: r.comment,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent'
      });
    }
    revStmt.free();

    const wlStmt = db.prepare("SELECT id FROM watchlist WHERE user_id = 'default_user' AND anime_id = ?");
    wlStmt.bind([anime.id]);
    const isWatchlisted = wlStmt.step();
    wlStmt.free();

    res.json({ ...anime, episodes, reviews, isWatchlisted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/anime/:id/upvote (Strict Clerk Auth)
app.all(['/api/anime/:id/vote', '/api/anime/:id/upvote', '/anime/:id/vote', '/anime/:id/upvote'], (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PUT') return next();
  try {
    const animeId = req.params.id;
    const userId = req.body?.userId || req.headers['x-user-id'] || null;

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(401).json({ success: false, error: "Unauthorized", message: "Please sign in to upvote." });
    }

    const checkStmt = db.prepare("SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'upvote'");
    checkStmt.bind([animeId, userId]);
    const alreadyVoted = checkStmt.step();
    checkStmt.free();

    if (alreadyVoted) {
      return res.status(400).json({ error: "Already voted", message: "You have already upvoted this anime.", alreadyVoted: true, animeId });
    }

    db.run("INSERT INTO user_votes (anime_id, user_id, vote_type) VALUES (?, ?, 'upvote')", [animeId, userId]);
    try {
      db.run("UPDATE anime SET upvotes = MAX(0, COALESCE(upvotes, 0) + 1), popularity = MAX(0, COALESCE(popularity, 0) + 1) WHERE id = ?", [animeId]);
    } catch (_) {
      db.run("UPDATE anime SET popularity = MAX(0, COALESCE(popularity, 0) + 1) WHERE id = ?", [animeId]);
    }
    persistD1();

    const stmt = db.prepare("SELECT upvotes, popularity FROM anime WHERE id = ?");
    stmt.bind([animeId]);
    let newPopularity = 0;
    if (stmt.step()) {
      newPopularity = stmt.getAsObject().upvotes ?? stmt.getAsObject().popularity ?? 0;
    }
    stmt.free();

    res.json({ success: true, upvotes: newPopularity, popularity: newPopularity, message: "Upvote recorded successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/anime/:id/like (Strict Clerk Auth)
app.all(['/api/anime/:id/like', '/api/anime/:id/likes', '/anime/:id/like', '/anime/:id/likes'], (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PUT') return next();
  try {
    const animeId = req.params.id;
    const userId = req.body?.userId || req.headers['x-user-id'] || null;

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(401).json({ success: false, error: "Unauthorized", message: "Please sign in to like." });
    }

    const checkStmt = db.prepare("SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'like'");
    checkStmt.bind([animeId, userId]);
    const alreadyVoted = checkStmt.step();
    checkStmt.free();

    if (alreadyVoted) {
      return res.status(400).json({ error: "Already voted", message: "You have already liked this anime.", alreadyVoted: true, animeId });
    }

    db.run("INSERT INTO user_votes (anime_id, user_id, vote_type) VALUES (?, ?, 'like')", [animeId, userId]);
    try {
      db.run("UPDATE anime SET likes = MAX(0, COALESCE(likes, 0) + 1), likesCount = MAX(0, COALESCE(likesCount, 0) + 1) WHERE id = ?", [animeId]);
    } catch (_) {
      db.run("UPDATE anime SET likesCount = MAX(0, COALESCE(likesCount, 0) + 1) WHERE id = ?", [animeId]);
    }
    persistD1();

    const stmt = db.prepare("SELECT likes, likesCount FROM anime WHERE id = ?");
    stmt.bind([animeId]);
    let newLikes = 0;
    if (stmt.step()) {
      newLikes = stmt.getAsObject().likes ?? stmt.getAsObject().likesCount ?? 0;
    }
    stmt.free();

    res.json({ success: true, likes: newLikes, likesCount: newLikes, message: "Like recorded successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/anime/:id/vote-status
app.get(['/api/anime/:id/vote-status', '/api/anime/:id/vote_status', '/anime/:id/vote-status'], (req, res) => {
  try {
    const animeId = req.params.id;
    const userId = req.headers['x-user-id'] || req.query.userId || 'default_user';

    const likeStmt = db.prepare("SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'like'");
    likeStmt.bind([animeId, userId]);
    const hasLiked = likeStmt.step();
    likeStmt.free();

    const upvoteStmt = db.prepare("SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'upvote'");
    upvoteStmt.bind([animeId, userId]);
    const hasUpvoted = upvoteStmt.step();
    upvoteStmt.free();

    res.json({ animeId, userId, hasLiked, hasUpvoted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
async function startServer() {
  initD1();
  const PORT = 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  });
}

startServer();
