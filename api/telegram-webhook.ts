// Vercel Serverless Function: /api/telegram-webhook.ts
// Handles Telegram Webhook callbacks (inline button clicks like [✅ Approve] and [❌ Reject]) and bot commands.

import { updateSubmissionStatus, loadSubmissions } from './submissions';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Bot-Api-Secret-Token');

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

      // STEP B: Update server submission record
      const updatedRecord = updateSubmissionStatus(
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
        const isPhoto = Boolean(message.photo);
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
        const all = loadSubmissions();
        const pendingCount = all.filter((s) => s.submissionStatus === 'pending').length;
        const approvedCount = all.filter((s) => s.submissionStatus === 'approved').length;

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
        const all = loadSubmissions();
        const pending = all.filter((s) => s.submissionStatus === 'pending');

        if (pending.length === 0) {
          await sendTextMessage(chatId, `🎉 *All caught up!* There are currently 0 pending dub submissions.`);
          return res.status(200).json({ ok: true });
        }

        await sendTextMessage(chatId, `📋 *Found ${pending.length} pending submission(s):*`);

        for (const item of pending.slice(0, 5)) {
          const itemMsg =
            `🎬 *${item.title}*\n` +
            `🎭 *Type:* ${item.type} | 📡 *Status:* ${item.status}\n` +
            `🌐 *Dubs:* ${item.dubs.join(', ')}\n` +
            `📺 *Platform:* ${item.platforms[0]?.name || 'Crunchyroll'}\n` +
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
