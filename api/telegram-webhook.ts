// Vercel Serverless Function: api/telegram-webhook.ts
// Handles Telegram Webhook callbacks with JSONBin.io persistence.
// Format: export default async function handler(req, res)

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const BIN_HEADERS = {
  'Content-Type': 'application/json',
  'X-Master-Key': JSONBIN_API_KEY || '',
  'X-Bin-Versioning': 'false',
};

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Helper to read from JSONBin
async function readBin(): Promise<any[]> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return [];
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      method: 'GET',
      headers: BIN_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.record) ? data.record : [];
  } catch {
    return [];
  }
}

// Helper to update JSONBin
async function updateBin(data: any[]): Promise<boolean> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return false;
  try {
    const res = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: BIN_HEADERS,
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Bot-Api-Secret-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      service: 'AniDub India Telegram Webhook (JSONBin)',
      botConfigured: Boolean(TELEGRAM_BOT_TOKEN),
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    const callbackQuery = update.callback_query;

    if (callbackQuery) {
      const { id: callbackQueryId, data, from, message } = callbackQuery;
      const adminUser = from?.username ? `@${from.username}` : from?.first_name || 'Admin';

      if (!data) return res.status(200).json({ ok: true });

      const [action, animeId, ...titleParts] = data.split(':');
      const title = titleParts.join(':') || 'Anime Submission';
      const isApprove = action?.toLowerCase() === 'approve';
      const isReject = action?.toLowerCase() === 'reject';

      if (!isApprove && !isReject) return res.status(200).json({ ok: true });

      const newStatus = isApprove ? 'approved' : 'rejected';
      const current = await readBin();
      const index = current.findIndex((item: any) => item.id === animeId);

      if (index > -1) {
        current[index].submissionStatus = newStatus;
        current[index].status = newStatus === 'approved' ? 'Ongoing' : 'Rejected';
        current[index].reviewedBy = adminUser;
        current[index].reviewedAt = new Date().toISOString();
        current[index].updatedAt = new Date().toISOString();
        await updateBin(current);
      }

      // Answer Telegram Callback
      const answerText = isApprove ? `✅ Approved! "${title}" is now LIVE.` : `❌ Rejected! "${title}" was declined.`;
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text: answerText }),
      }).catch(() => {});

      // Edit Moderator Message
      if (message) {
        const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
        const updatedCaption = isApprove
          ? `✅ *SUBMISSION APPROVED*\n🎬 *Title:* ${title}\n👤 *By:* ${adminUser}\n📅 *Date:* ${istTime}\n🌐 *Status:* LIVE`
          : `❌ *SUBMISSION REJECTED*\n🎬 *Title:* ${title}\n👤 *By:* ${adminUser}\n📅 *Date:* ${istTime}\n⚠️ *Status:* DECLINED`;

        const isPhoto = Boolean(message.photo && message.photo.length > 0);
        await fetch(`${TELEGRAM_API}/${isPhoto ? 'editMessageCaption' : 'editMessageText'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.chat.id,
            message_id: message.message_id,
            [isPhoto ? 'caption' : 'text']: updatedCaption,
            parse_mode: 'Markdown',
            reply_markup: isApprove ? {
              inline_keyboard: [[{ text: '🎬 Open Live Page', url: `${WEBSITE_URL}/#anime/${animeId}` }]]
            } : { inline_keyboard: [] }
          }),
        }).catch(() => {});
      }

      // Broadcast to Channel if approved
      if (isApprove) {
        const broadcastText = `🎉 *NEW ANIME DUB AVAILABLE!*\n\n🔥 *${title.toUpperCase()}*\n\n👉 *Check Details:*\n${WEBSITE_URL}/#anime/${animeId}`;
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: PUBLIC_CHANNEL_ID,
            text: broadcastText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🎬 Open on AniDub India', url: `${WEBSITE_URL}/#anime/${animeId}` }]]
            }
          }),
        }).catch(() => {});
      }

      return res.status(200).json({ ok: true });
    }

    // Handle /status command
    if (update.message?.text?.startsWith('/status')) {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: update.message.chat.id,
          text: `⚡ *AniDub India Status (JSONBin)*\n\n• Service: Active\n• Time: ${new Date().toISOString()}`,
          parse_mode: 'Markdown',
        }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
