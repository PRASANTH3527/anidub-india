// Next.js App Router API Route: app/api/telegram-webhook/route.ts
// Handles Telegram Webhook callbacks with direct @vercel/kv persistence.
// Zero external shared lib files to prevent Vercel module resolution errors.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

import { kv } from '@vercel/kv';

const KV_KEY = 'anidub_submissions';

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Safe helper to read from Vercel KV
async function getKvSubmissions(): Promise<any[]> {
  try {
    const data = await kv.get<any[]>(KV_KEY);
    if (Array.isArray(data)) return data;
    return [];
  } catch (err) {
    console.error('[Vercel KV Error in Webhook] Failed to read submissions:', err);
    return [];
  }
}

// Safe helper to write to Vercel KV
async function saveKvSubmissions(list: any[]): Promise<boolean> {
  try {
    await kv.set(KV_KEY, list);
    return true;
  } catch (err) {
    console.error('[Vercel KV Error in Webhook] Failed to save submissions:', err);
    return false;
  }
}

/**
 * Updates submission status directly in Vercel KV
 */
async function updateKvSubmissionStatus(
  id: string,
  newStatus: 'approved' | 'rejected',
  reviewer: string,
  defaultTitle?: string
): Promise<any> {
  const current = await getKvSubmissions();
  const index = current.findIndex((item) => item.id === id);

  let targetRecord: any;

  if (index > -1) {
    current[index].submissionStatus = newStatus;
    current[index].status = newStatus === 'approved' ? 'Ongoing' : 'Rejected';
    current[index].reviewedBy = reviewer;
    current[index].reviewedAt = new Date().toISOString();
    current[index].updatedAt = new Date().toISOString();
    targetRecord = current[index];
  } else {
    targetRecord = {
      id,
      title: defaultTitle || `Anime Submission #${id.slice(-6)}`,
      poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      type: 'Series',
      releaseYear: new Date().getFullYear(),
      rating: 8.5,
      status: newStatus === 'approved' ? 'Ongoing' : 'Rejected',
      submissionStatus: newStatus,
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      genres: ['Action', 'Adventure'],
      studio: 'Animation Studio',
      synopsis: 'Regional Indian dubbed anime release.',
      dubs: ['Tamil', 'Telugu', 'Hindi'],
      platforms: [{ name: 'Crunchyroll', url: '' }],
      submittedAt: new Date().toISOString(),
    };
    current.unshift(targetRecord);
  }

  await saveKvSubmissions(current);
  return targetRecord;
}

/**
 * 1. GET Handler (Health check / Verification)
 */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      status: 'online',
      service: 'AniDub India Telegram Webhook (Vercel KV)',
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

    const callbackQuery = update.callback_query;

    if (callbackQuery) {
      const { id: callbackQueryId, data, from, message } = callbackQuery;
      const adminUser = from?.username ? `@${from.username}` : from?.first_name || 'Admin';

      if (!data) {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: '⚠️ No action data found on button.',
          }),
        }).catch(() => {});

        return Response.json({ ok: true, message: 'Empty callback data' });
      }

      const [action, animeId, ...titleParts] = data.split(':');
      const title = titleParts.join(':') || 'Anime Submission';
      const isApprove = action?.toLowerCase() === 'approve';
      const isReject = action?.toLowerCase() === 'reject';

      if (!isApprove && !isReject) {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: `Unknown action: ${action}`,
          }),
        }).catch(() => {});

        return Response.json({ ok: true, message: 'Unknown action' });
      }

      const answerText = isApprove
        ? `✅ Approved! "${title}" is now LIVE on AniDub India.`
        : `❌ Rejected! "${title}" was declined.`;

      try {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: answerText,
            show_alert: false,
          }),
        });
      } catch (answerErr) {
        console.error('Error calling answerCallbackQuery:', answerErr);
      }

      const newStatus = isApprove ? 'approved' : 'rejected';
      await updateKvSubmissionStatus(animeId, newStatus, adminUser, title);

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
          await fetch(editEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editPayload),
          });
        } catch (editErr) {
          console.error('Error editing Telegram message:', editErr);
        }
      }

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
          `• Database: @vercel/kv (Redis)\n` +
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
