// Next.js App Router API Route: app/api/telegram-webhook/route.ts
// Handles Telegram Webhook updates (callback_query for [✅ Approve] and [❌ Reject], bot commands, etc.)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import fs from 'fs';
import path from 'path';

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// File paths for persistent storage
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'submissions.json');
const TMP_FILE = path.join('/tmp', 'anidub_submissions_v1.json');

/**
 * Completely self-contained helper to update anime submission status
 */
async function updateServerlessSubmission(id: string, status: 'approved' | 'rejected', reviewer: string) {
  try {
    let list: any[] = [];
    for (const filePath of [LOCAL_DATA_FILE, TMP_FILE]) {
      try {
        if (fs.existsSync(filePath)) {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
            break;
          }
        }
      } catch {}
    }

    const index = list.findIndex((item) => item.id === id);
    let targetRecord: any;

    if (index > -1) {
      list[index].submissionStatus = status;
      list[index].status = status === 'approved' ? 'Ongoing' : 'Rejected';
      list[index].reviewedBy = reviewer;
      list[index].reviewedAt = new Date().toISOString();
      list[index].updatedAt = new Date().toISOString();
      targetRecord = list[index];
    } else {
      targetRecord = {
        id,
        title: `Anime Submission #${id.slice(-6)}`,
        submissionStatus: status,
        status: status === 'approved' ? 'Ongoing' : 'Rejected',
        reviewedBy: reviewer,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.unshift(targetRecord);
    }

    for (const filePath of [LOCAL_DATA_FILE, TMP_FILE]) {
      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
      } catch {}
    }

    return targetRecord;
  } catch (err) {
    console.error('[Database Update Error in Webhook]', err);
    return null;
  }
}

/**
 * 1. GET Handler (Health check / Verification)
 */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      status: 'online',
      service: 'AniDub India Telegram Webhook (Next.js App Router)',
      botConfigured: Boolean(TELEGRAM_BOT_TOKEN),
      websiteUrl: WEBSITE_URL,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}

/**
 * 2. OPTIONS Handler (CORS)
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Bot-Api-Secret-Token',
      'Cache-Control': 'no-store, no-cache',
    },
  });
}

/**
 * 3. POST Handler: Receives Webhook Updates from Telegram
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === '') {
      return Response.json({ ok: false, error: 'Empty request body' }, { status: 400 });
    }

    let update: any;
    try {
      update = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error('Failed to parse update JSON:', parseErr);
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // =========================================================================
    // 1. HANDLE INLINE BUTTON CLICKS: callback_query (Approve / Reject)
    // =========================================================================
    const callbackQuery = update.callback_query;

    if (callbackQuery) {
      const { id: callbackQueryId, data, from, message } = callbackQuery;
      const adminUser = from?.username ? `@${from.username}` : from?.first_name || 'Admin';

      if (!data) {
        // Stop spinner immediately even if data is missing
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: '⚠️ No action data found on button.',
          }),
        }).catch((e) => console.error('Failed to answer empty callback:', e));

        return Response.json({ ok: true, message: 'Empty callback data' });
      }

      // Parse data format: "approve:anime_id:title" or "reject:anime_id:title"
      const [action, animeId, ...titleParts] = data.split(':');
      const title = titleParts.join(':') || 'Anime Submission';
      const isApprove = action?.toLowerCase() === 'approve';
      const isReject = action?.toLowerCase() === 'reject';

      if (!isApprove && !isReject) {
        // Unknown action - stop spinner
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: `Unknown action: ${action}`,
          }),
        }).catch((e) => console.error('Failed to answer unknown action:', e));

        return Response.json({ ok: true, message: 'Unknown action' });
      }

      // -----------------------------------------------------------------------
      // CRITICAL REQUIREMENT 3: Call answerCallbackQuery SO BUTTON STOPS LOADING
      // -----------------------------------------------------------------------
      const answerText = isApprove
        ? `✅ Approved! "${title}" is now LIVE on AniDub India.`
        : `❌ Rejected! "${title}" was declined.`;

      try {
        const answerRes = await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: answerText,
            show_alert: false,
          }),
        });
        const answerJson = await answerRes.json();
        console.log('[answerCallbackQuery Result]', answerJson);
      } catch (answerErr) {
        console.error('Error calling answerCallbackQuery:', answerErr);
      }

      // -----------------------------------------------------------------------
      // CRITICAL REQUIREMENT 2: Update the anime status in persistent database
      // -----------------------------------------------------------------------
      const newStatus = isApprove ? 'approved' : 'rejected';
      await updateServerlessSubmission(animeId, newStatus, adminUser);

      // -----------------------------------------------------------------------
      // CRITICAL REQUIREMENT 4: Edit original Telegram message to show Approved/Rejected
      // -----------------------------------------------------------------------
      if (message) {
        const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
        const liveUrl = `${WEBSITE_URL}/#anime/${animeId}`;

        const updatedCaption = isApprove
          ? `✅ *SUBMISSION APPROVED & PUBLISHED LIVE*\n\n` +
            `🎬 *Title:* ${title}\n` +
            `👤 *Approved by:* ${adminUser}\n` +
            `📅 *Date:* ${istTime}\n` +
            `🌐 *Status:* Live on AniDub India catalog\n\n` +
            `📢 *Broadcasted to Channel:* ${PUBLIC_CHANNEL_ID}`
          : `❌ *SUBMISSION REJECTED*\n\n` +
            `🎬 *Title:* ${title}\n` +
            `👤 *Rejected by:* ${adminUser}\n` +
            `📅 *Date:* ${istTime}\n` +
            `⚠️ *Status:* DECLINED (Not visible on public website)`;

        const updatedKeyboard = isApprove
          ? {
              inline_keyboard: [
                [{ text: '🎬 Open Live Page on AniDub India', url: liveUrl }],
              ],
            }
          : {
              inline_keyboard: [],
            };

        const isPhotoMessage = Boolean(message.photo && message.photo.length > 0);
        const editEndpoint = isPhotoMessage
          ? `${TELEGRAM_API}/editMessageCaption`
          : `${TELEGRAM_API}/editMessageText`;

        const editPayload = isPhotoMessage
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

        try {
          const editRes = await fetch(editEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editPayload),
          });
          const editData = await editRes.json();
          console.log('[editMessage Result]', editData);
        } catch (editErr) {
          console.error('Error editing Telegram message:', editErr);
        }
      }

      // -----------------------------------------------------------------------
      // Broadcast to Public Channel if Approved
      // -----------------------------------------------------------------------
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
        } catch (broadcastErr) {
          console.warn('Channel broadcast warning:', broadcastErr);
        }
      }

      return Response.json(
        {
          ok: true,
          action,
          animeId,
          title,
          status: newStatus,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    // =========================================================================
    // 2. HANDLE TELEGRAM MESSAGES & BOT COMMANDS (/start, /status, /help)
    // =========================================================================
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text.startsWith('/start')) {
        const welcomeText =
          `👋 *Welcome to AniDub India Moderation Bot!*\n\n` +
          `Whenever users submit new regional anime dubs on AniDub India, you will receive real-time alerts here with *[✅ Approve]* and *[❌ Reject]* buttons.\n\n` +
          `*Commands:*\n` +
          `• /status - Check webhook connection\n` +
          `• /help - Help & documentation`;

        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            parse_mode: 'Markdown',
          }),
        });
      } else if (text.startsWith('/status')) {
        const statusText =
          `⚡ *AniDub India Webhook Status*\n\n` +
          `• Service: Active & Responding\n` +
          `• Admin Chat: \`${chatId}\`\n` +
          `• Target Website: ${WEBSITE_URL}\n` +
          `• Channel: ${PUBLIC_CHANNEL_ID}\n` +
          `• Time: ${new Date().toISOString()}`;

        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: statusText,
            parse_mode: 'Markdown',
          }),
        });
      }

      return Response.json({ ok: true, message: 'Message handled' });
    }

    return Response.json({ ok: true, message: 'Update received and processed' });
  } catch (err: any) {
    console.error('Unhandled webhook error:', err);
    return Response.json({ ok: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
