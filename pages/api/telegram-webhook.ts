// Next.js Pages Router API Route: pages/api/telegram-webhook.ts
// Handles Telegram Webhook callbacks (inline button clicks like [✅ Approve] and [❌ Reject])

import fs from 'fs';
import path from 'path';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TMP_FILE = path.join('/tmp', 'anidub_submissions_v1.json');

function updateServerlessSubmission(id: string, status: 'approved' | 'rejected', reviewer: string) {
  try {
    let list: any[] = [];
    if (fs.existsSync(TMP_FILE)) {
      list = JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
    }
    const index = list.findIndex((item) => item.id === id);
    if (index > -1) {
      list[index].submissionStatus = status;
      list[index].status = status === 'approved' ? 'Ongoing' : 'Rejected';
      list[index].reviewedBy = reviewer;
      list[index].reviewedAt = new Date().toISOString();
    } else {
      list.push({
        id,
        title: `Anime Submission #${id.slice(-6)}`,
        submissionStatus: status,
        status: status === 'approved' ? 'Ongoing' : 'Rejected',
        reviewedBy: reviewer,
        reviewedAt: new Date().toISOString(),
      });
    }
    fs.writeFileSync(TMP_FILE, JSON.stringify(list, null, 2), 'utf-8');
    return list[index] || list[list.length - 1];
  } catch (err) {
    console.error('[Database Update Error]', err);
    return null;
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
      status: 'active',
      service: 'AniDub India Telegram Webhook (Pages Router)',
      botConfigured: Boolean(TELEGRAM_BOT_TOKEN),
      timestamp: new Date().toISOString(),
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

    // 1. HANDLE INLINE BUTTON CLICKS (callback_query)
    if (update.callback_query) {
      const { id: callbackQueryId, data, from, message } = update.callback_query;
      const adminUser = from?.username ? `@${from.username}` : from?.first_name || 'Admin';

      if (!data) {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackQueryId, text: 'No action data' }),
        }).catch(() => {});
        return res.status(200).json({ ok: true });
      }

      const [action, animeId, ...titleParts] = data.split(':');
      const title = titleParts.join(':') || 'Anime';
      const isApprove = action === 'approve';
      const isReject = action === 'reject';

      if (!isApprove && !isReject) {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackQueryId, text: 'Unknown action' }),
        }).catch(() => {});
        return res.status(200).json({ ok: true });
      }

      // CRITICAL STEP A: Immediately Answer Telegram Callback Query so button stops loading
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: isApprove
            ? `✅ Approved: "${title}" is now LIVE on AniDub India!`
            : `❌ Rejected: "${title}" has been declined.`,
          show_alert: false,
        }),
      }).catch((e) => console.error('Error answering callback query:', e));

      // CRITICAL STEP B: Update server submission record in DB
      const newStatus = isApprove ? 'approved' : 'rejected';
      updateServerlessSubmission(animeId, newStatus, adminUser);

      // CRITICAL STEP C: Edit the Telegram message to show confirmation & remove action buttons
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

      // CRITICAL STEP D: Channel broadcast if approved
      if (isApprove) {
        try {
          const broadcastText =
            `🎉 *NEW ANIME DUB AVAILABLE ON ANIDUB INDIA!*\n\n` +
            `🔥 *${title.toUpperCase()}*\n` +
            `🎙️ Verified regional Indian dub options now streaming!\n\n` +
            `👉 *Check Stream & Dub Cast Details:*\n` +
            `${WEBSITE_URL}/#anime/${animeId}\n\n` +
            `#AniDub #AnimeIndia #TamilDub #TeluguDub #HindiDub`;

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
        } catch (e) {
          console.error('Channel broadcast error:', e);
        }
      }

      return res.status(200).json({ ok: true, action, animeId, title });
    }

    // 2. HANDLE BOT COMMANDS
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text.startsWith('/start')) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `👋 *Welcome to AniDub India Moderation Bot!*\n\nUse [✅ Approve] and [❌ Reject] buttons on incoming submissions to moderate the live catalog.`,
            parse_mode: 'Markdown',
          }),
        });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
