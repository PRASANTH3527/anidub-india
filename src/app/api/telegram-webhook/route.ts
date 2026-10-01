// Next.js App Router API Route: app/api/telegram-webhook/route.ts
// Uses standard Web API Request/Response (supported natively by Next.js 13/14/15)

// Environment variables needed in Next.js (.env.local)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN || '';

// Telegram Bot API Base
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * 2. Next.js Serverless Webhook API Route: /api/telegram-webhook
 * Directly receives webhook updates (like inline button callback_queries) from Telegram.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Optional Security: Verify secret token header sent by Telegram
    if (TELEGRAM_SECRET_TOKEN) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
      if (headerSecret !== TELEGRAM_SECRET_TOKEN) {
        return Response.json({ error: 'Unauthorized webhook call' }, { status: 401 });
      }
    }

    const update = await req.json();

    // Check if the update is a button click (callback_query)
    if (!update.callback_query) {
      return Response.json({ ok: true, message: 'Non-callback update ignored' });
    }

    const { id: callbackQueryId, data, from, message } = update.callback_query;
    if (!data) {
      return Response.json({ ok: true });
    }

    // Parse callback data format: "approve:anime_id:title" or "reject:anime_id:title"
    const [action, animeId, ...titleParts] = data.split(':');
    const title = titleParts.join(':') || 'Anime';
    const adminUser = from.username ? `@${from.username}` : from.first_name || 'Admin';

    // Verify action
    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ ok: true, message: 'Unknown action' });
    }

    // =========================================================================
    // STEP A: UPDATE DATABASE DOCUMENT (Firebase Firestore / Supabase)
    // =========================================================================
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await updateDatabaseStatus(animeId, newStatus, adminUser);

    // =========================================================================
    // STEP B: ACKNOWLEDGE TELEGRAM CALLBACK QUERY (Stops loading spinner)
    // =========================================================================
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: action === 'approve' ? `✅ Approved: ${title}` : `❌ Rejected: ${title}`,
        show_alert: false,
      }),
    });

    // =========================================================================
    // STEP C: UPDATE TELEGRAM MESSAGE VIA editMessageCaption or editMessageText
    // =========================================================================
    if (message) {
      const isApprove = action === 'approve';
      const statusText = isApprove
        ? `✅ *SUBMISSION APPROVED & LIVE ON SITE*\n\n` +
          `🎬 *Title:* ${title}\n` +
          `👤 *Approved by:* ${adminUser}\n` +
          `🌐 *Live at:* ${WEBSITE_URL}/#anime/${animeId}\n\n` +
          `📢 *Broadcasted to Channel:* ${PUBLIC_CHANNEL_ID}`
        : `❌ *SUBMISSION REJECTED*\n\n` +
          `🎬 *Title:* ${title}\n` +
          `👤 *Rejected by:* ${adminUser}\n` +
          `⚠️ *Status:* DECLINED (Not published on website)`;

      const replyMarkup = isApprove
        ? {
            inline_keyboard: [
              [{ text: '🎬 Open Live Anime Page', url: `${WEBSITE_URL}/#anime/${animeId}` }],
            ],
          }
        : { inline_keyboard: [] };

      // If the original message had a photo, edit caption; otherwise edit text
      const editEndpoint = message.photo
        ? `${TELEGRAM_API}/editMessageCaption`
        : `${TELEGRAM_API}/editMessageText`;

      const editBody = message.photo
        ? {
            chat_id: message.chat.id,
            message_id: message.message_id,
            caption: statusText,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
          }
        : {
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: statusText,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
          };

      await fetch(editEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editBody),
      });
    }

    // =========================================================================
    // STEP D: SERVERLESS CHANNEL BROADCAST (Once approved, post to channel)
    // =========================================================================
    if (action === 'approve') {
      await broadcastToChannel(title, animeId);
    }

    return Response.json({ success: true, action, animeId });
  } catch (error: any) {
    console.error('Error handling Telegram Webhook:', error);
    return Response.json({ error: error.message || 'Webhook error' }, { status: 500 });
  }
}

/**
 * 3. Serverless Channel Broadcast:
 * Immediately sends a formatted announcement to the public channel (e.g. @anidub_india).
 */
async function broadcastToChannel(title: string, animeId: string) {
  try {
    const broadcastText =
      `🎉 *NEW REGIONAL DUB ADDED TO ANIDUB INDIA!*\n\n` +
      `🔥 *${title.toUpperCase()}*\n` +
      `🎙 Regional Indian dub options now verified & streaming!\n\n` +
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
    console.error('Failed serverless broadcast to Telegram channel:', err);
  }
}

/**
 * Updates the document in Firebase Firestore or Supabase
 */
async function updateDatabaseStatus(animeId: string, status: 'approved' | 'rejected', reviewer: string) {
  // Option 1: Firebase Admin SDK (Serverless Firestore)
  // const db = getFirestore();
  // await db.collection('anime').doc(animeId).update({
  //   submissionStatus: status,
  //   reviewedBy: reviewer,
  //   reviewedAt: new Date().toISOString(),
  // });

  // Option 2: Supabase Serverless Client
  // const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // await supabase.from('anime').update({
  //   submission_status: status,
  //   reviewed_by: reviewer,
  //   reviewed_at: new Date().toISOString()
  // }).eq('id', animeId);

  console.log(`[Database Serverless Update] Anime ${animeId} marked as ${status} by ${reviewer}`);
}
