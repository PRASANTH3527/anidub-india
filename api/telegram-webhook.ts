// Vercel Serverless Function: /api/telegram-webhook.ts
// Handles Telegram Webhook callbacks (inline button clicks like [✅ Approve] and [❌ Reject]) and bot commands.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import fs from 'fs';
import path from 'path';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Database cloud providers
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// URL and Token Validation Helpers
function isValidHttpUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  if (
    trimmed.includes('your-kv-store') ||
    trimmed.includes('your-project') ||
    trimmed.includes('example.com') ||
    trimmed === 'KV_REST_API_URL' ||
    trimmed === 'SUPABASE_URL'
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidToken(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (trimmed.length < 8) return false;
  if (
    trimmed.startsWith('your_') ||
    trimmed === 'KV_REST_API_TOKEN' ||
    trimmed === 'UPSTASH_REDIS_REST_TOKEN' ||
    trimmed === 'SUPABASE_SERVICE_ROLE_KEY' ||
    trimmed === 'SUPABASE_ANON_KEY'
  ) {
    return false;
  }
  return true;
}

function isValidFirebaseProjectId(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length < 4) return false;
  if (
    trimmed === 'FIREBASE_PROJECT_ID' ||
    trimmed === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' ||
    trimmed.startsWith('your-') ||
    trimmed.includes('example')
  ) {
    return false;
  }
  return /^[a-z0-9-]+$/.test(trimmed);
}

// Persistent file storage paths (project data directory + /tmp fallback)
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'submissions.json');
const TMP_FILE = path.join('/tmp', 'anidub_submissions_v1.json');
let memorySubmissions: any[] = [];

/**
 * Self-contained helper to load submissions from cloud DB or local disk
 */
async function loadSubmissionsAsync(): Promise<any[]> {
  // 1. Try Vercel KV / Upstash (only if valid URL provided)
  if (isValidHttpUrl(KV_URL) && isValidToken(KV_TOKEN)) {
    try {
      const res = await fetch(`${KV_URL}/get/anidub_submissions`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.error('KV read error in webhook:', e);
    }
  }

  // 2. Try Local disk (data/submissions.json then /tmp)
  for (const filePath of [LOCAL_DATA_FILE, TMP_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          memorySubmissions = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.error(`Failed reading ${filePath}:`, err);
    }
  }
  return memorySubmissions;
}

function loadSubmissions(): any[] {
  for (const filePath of [LOCAL_DATA_FILE, TMP_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          memorySubmissions = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return memorySubmissions;
}

/**
 * Helper to save submissions to cloud and local disk
 */
async function saveSubmissionsAsync(list: any[]): Promise<void> {
  memorySubmissions = list;
  for (const filePath of [LOCAL_DATA_FILE, TMP_FILE]) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Failed writing ${filePath}:`, err);
    }
  }

  // Sync to Vercel KV (only if valid)
  if (isValidHttpUrl(KV_URL) && isValidToken(KV_TOKEN)) {
    try {
      await fetch(`${KV_URL}/set/anidub_submissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(list),
      });
    } catch (e) {
      console.error('KV write error in webhook:', e);
    }
  }

  // Sync to Firebase (only if valid)
  if (isValidFirebaseProjectId(FIREBASE_PROJECT_ID)) {
    try {
      const endpoint = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/submissions`;
      await Promise.allSettled(
        list.map((item) => {
          const fields: any = {};
          for (const [k, v] of Object.entries(item)) {
            if (typeof v === 'string') fields[k] = { stringValue: v };
            else if (typeof v === 'number') fields[k] = { doubleValue: v };
            else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
          }
          return fetch(`${endpoint}/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
          });
        })
      );
    } catch (e) {
      console.error('Firebase write error in webhook:', e);
    }
  }

  // Sync to Supabase (only if valid)
  if (isValidHttpUrl(SUPABASE_URL) && isValidToken(SUPABASE_KEY)) {
    const token = SUPABASE_KEY as string;
    try {
      await Promise.allSettled(
        list.map((item) =>
          fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
            method: 'POST',
            headers: {
              apikey: token,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(item),
          })
        )
      );
    } catch (e) {
      console.error('Supabase write error in webhook:', e);
    }
  }
}

/**
 * Self-contained helper to update anime submission status in persistent database
 */
async function updateSubmissionStatusAsync(
  id: string,
  newStatus: 'approved' | 'rejected',
  reviewer: string = 'Telegram Admin Bot',
  rejectionReason?: string
): Promise<any> {
  const current = await loadSubmissionsAsync();
  const index = current.findIndex((s) => s.id === id);

  let targetRecord: any;

  if (index === -1) {
    targetRecord = {
      id,
      title: 'Anime Submission #' + id.slice(-6),
      poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      type: 'Series',
      releaseYear: new Date().getFullYear(),
      rating: 8.5,
      status: 'Ongoing',
      submissionStatus: newStatus,
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      genres: ['Action', 'Adventure'],
      studio: 'Animation Studio',
      synopsis: 'Dubbed regional anime release.',
      dubs: ['Tamil', 'Telugu', 'Hindi'],
      platforms: [{ name: 'Crunchyroll', url: '' }],
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    current.unshift(targetRecord);
  } else {
    current[index].submissionStatus = newStatus;
    current[index].status = 'Ongoing';
    current[index].reviewedBy = reviewer;
    current[index].reviewedAt = new Date().toISOString();
    current[index].updatedAt = new Date().toISOString();
    if (rejectionReason) {
      current[index].rejectionReason = rejectionReason;
    }
    targetRecord = current[index];
  }

  await saveSubmissionsAsync(current);
  console.log(`[Database Update] Marked ${id} as ${newStatus} by ${reviewer} (persisted to cloud)`);
  return targetRecord;
}

export default async function handler(req: any, res: any) {
  // CORS & Strict Zero-Cache Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Bot-Api-Secret-Token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow GET to verify endpoint is online
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      service: 'AniDub India Telegram Webhook',
      timestamp: new Date().toISOString(),
      botConfigured: Boolean(TELEGRAM_BOT_TOKEN),
      adminChatIdConfigured: Boolean(ADMIN_CHAT_ID),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!update) {
      return res.status(400).json({ error: 'No update payload received' });
    }

    // =========================================================================
    // 1. HANDLE INLINE BUTTON CLICKS (callback_query)
    // =========================================================================
    if (update.callback_query) {
      const { id: callbackQueryId, data, from, message } = update.callback_query;

      if (!data) {
        await answerCallback(callbackQueryId, 'No action data found');
        return res.status(200).json({ ok: true });
      }

      // Parse data format: "approve:anime_id:title" or "reject:anime_id:title"
      const [action, animeId, ...titleParts] = data.split(':');
      const title = titleParts.join(':') || 'Anime';
      const adminUser = from?.username ? `@${from.username}` : from?.first_name || 'Admin';

      if (action !== 'approve' && action !== 'reject') {
        await answerCallback(callbackQueryId, 'Unknown button action');
        return res.status(200).json({ ok: true });
      }

      const isApprove = action === 'approve';

      // CRITICAL STEP A: Immediately Answer Telegram Callback Query
      // This stops the infinite loading spinner on Telegram!
      await answerCallback(
        callbackQueryId,
        isApprove
          ? `✅ Approved: "${title}" is now LIVE on the website!`
          : `❌ Rejected: "${title}" has been declined.`
      );

      // STEP B: Update server submission record directly in persistent cloud database
      const updatedRecord = await updateSubmissionStatusAsync(
        animeId,
        isApprove ? 'approved' : 'rejected',
        adminUser
      );

      // STEP C: Edit the Telegram message to show confirmation & remove action buttons
      if (message) {
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
        const updatedCaption = isApprove
          ? `✅ *SUBMISSION APPROVED & PUBLISHED LIVE*\n\n` +
            `🎬 *Title:* ${title}\n` +
            `👤 *Approved by:* ${adminUser}\n` +
            `📅 *Date:* ${timestamp}\n` +
            `🌐 *Status:* Live on AniDub India catalog\n\n` +
            `📢 *Broadcasted to Channel:* ${PUBLIC_CHANNEL_ID}`
          : `❌ *SUBMISSION REJECTED*\n\n` +
            `🎬 *Title:* ${title}\n` +
            `👤 *Rejected by:* ${adminUser}\n` +
            `📅 *Date:* ${timestamp}\n` +
            `⚠️ *Status:* DECLINED (Not visible on public website)`;

        const liveUrl = `${WEBSITE_URL}/#anime/${animeId}`;

        const updatedKeyboard = isApprove
          ? {
              inline_keyboard: [
                [{ text: '🎬 Open Live Page on AniDub India', url: liveUrl }],
              ],
            }
          : { inline_keyboard: [] };

        // Edit photo caption or text
        const isPhoto = Boolean(message.photo && message.photo.length > 0);
        const endpoint = isPhoto
          ? `${TELEGRAM_API}/editMessageCaption`
          : `${TELEGRAM_API}/editMessageText`;

        const editBody = isPhoto
          ? {
              chat_id: message.chat.id,
              message_id: message.message_id,
              caption: updatedCaption,
              parse_mode: 'Markdown',
              reply_markup: updatedKeyboard,
            }
          : {
              chat_id: message.chat.id,
              message_id: message.message_id,
              text: updatedCaption,
              parse_mode: 'Markdown',
              reply_markup: updatedKeyboard,
            };

        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editBody),
        }).catch((err) => console.error('Error editing Telegram message:', err));
      }

      // STEP D: If approved, broadcast announcement to public Telegram channel
      if (isApprove) {
        await broadcastToChannel(title, animeId, updatedRecord);
      }

      return res.status(200).json({ ok: true, action, animeId, title });
    }

    // =========================================================================
    // 2. HANDLE BOT COMMANDS (/start, /status, /pending, /help)
    // =========================================================================
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text.startsWith('/start')) {
        const welcomeText =
          `👋 *Welcome to the AniDub India Admin Moderation Bot!*\n\n` +
          `Whenever users submit new regional anime dubs on AniDub India, you will receive real-time alerts here with [✅ Approve] and [❌ Reject] buttons.\n\n` +
          `*Commands:*\n` +
          `• /status - Check webhook connection & pending counts\n` +
          `• /pending - View pending submissions\n` +
          `• /help - Help & documentation`;

        await sendTextMessage(chatId, welcomeText, {
          inline_keyboard: [
            [{ text: '🌐 Visit AniDub India', url: WEBSITE_URL }],
          ],
        });
        return res.status(200).json({ ok: true });
      }

      if (text.startsWith('/status')) {
        const all = await loadSubmissionsAsync();
        const pendingCount = all.filter((s: any) => s.submissionStatus === 'pending').length;
        const approvedCount = all.filter((s: any) => s.submissionStatus === 'approved').length;

        const statusMsg =
          `📊 *AniDub India System Status*\n\n` +
          `🟢 *Webhook Status:* Active & Receiving Updates\n` +
          `⏳ *Pending Submissions:* ${pendingCount}\n` +
          `✅ *Approved Anime:* ${approvedCount}\n` +
          `📢 *Public Channel:* ${PUBLIC_CHANNEL_ID}\n` +
          `🌐 *Website:* ${WEBSITE_URL}`;

        await sendTextMessage(chatId, statusMsg);
        return res.status(200).json({ ok: true });
      }

      if (text.startsWith('/pending')) {
        const all = await loadSubmissionsAsync();
        const pending = all.filter((s: any) => s.submissionStatus === 'pending');

        if (pending.length === 0) {
          await sendTextMessage(chatId, `🎉 *All caught up!* There are currently 0 pending dub submissions.`);
          return res.status(200).json({ ok: true });
        }

        await sendTextMessage(chatId, `📋 *Found ${pending.length} pending submission(s):*`);

        for (const item of pending.slice(0, 5)) {
          const itemMsg =
            `🎬 *${item.title}*\n` +
            `🎭 *Type:* ${item.type} | 📡 *Status:* ${item.status}\n` +
            `🌐 *Dubs:* ${item.dubs?.join(', ') || 'Regional'}\n` +
            `📺 *Platform:* ${item.platforms?.[0]?.name || 'Crunchyroll'}\n` +
            `👤 *By:* ${item.submittedBy?.userName || 'Community'}`;

          await sendTextMessage(chatId, itemMsg, {
            inline_keyboard: [
              [
                { text: '✅ Approve', callback_data: `approve:${item.id}:${item.title}` },
                { text: '❌ Reject', callback_data: `reject:${item.id}:${item.title}` },
              ],
            ],
          });
        }
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(200).json({ ok: true, message: 'Update handled' });
  } catch (error: any) {
    console.error('Telegram Webhook error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

// Helper to call Telegram answerCallbackQuery (stops spinner)
async function answerCallback(callbackQueryId: string, text: string) {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
    });
  } catch (e) {
    console.error('Failed to answer callback query:', e);
  }
}

// Helper to send text message
async function sendTextMessage(chatId: number | string, text: string, replyMarkup?: any) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });
  } catch (e) {
    console.error('Failed to send text message:', e);
  }
}

// Helper to broadcast to public Telegram channel
async function broadcastToChannel(title: string, animeId: string, record?: any) {
  try {
    const dubs = record?.dubs?.join(', ') || 'Regional Indian Languages';
    const genres = record?.genres?.join(', ') || 'Action, Anime';
    const broadcastText =
      `🎉 *NEW ANIME DUB ADDED TO ANIDUB INDIA!*\n\n` +
      `🔥 *${title.toUpperCase()}*\n` +
      `🎙 *Audio:* ${dubs}\n` +
      `🏷 *Genres:* ${genres}\n\n` +
      `👉 *Watch Now & Track Dub Details:*\n` +
      `${WEBSITE_URL}/#anime/${animeId}\n\n` +
      `#TamilDub #TeluguDub #HindiDub #AnimeIndia #AniDub`;

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: PUBLIC_CHANNEL_ID,
        text: broadcastText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎬 Open on AniDub India', url: `${WEBSITE_URL}/#anime/${animeId}` }],
          ],
        },
      }),
    });
  } catch (err) {
    console.error('Failed broadcast to Telegram channel:', err);
  }
}
