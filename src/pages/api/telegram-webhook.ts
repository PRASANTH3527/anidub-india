// Next.js Pages Router Alternative: pages/api/telegram-webhook.ts
// Use this if your Next.js project is structured with the Pages router instead of App router.

type Data = {
  success?: boolean;
  action?: string;
  animeId?: string;
  error?: string;
  message?: string;
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    if (!update?.callback_query) {
      return res.status(200).json({ message: 'No callback query found' });
    }

    const { id: callbackQueryId, data, from, message } = update.callback_query;
    const [action, animeId, ...titleParts] = (data || '').split(':');
    const title = titleParts.join(':') || 'Anime';
    const adminUser = from.username ? `@${from.username}` : from.first_name || 'Admin';

    if (action !== 'approve' && action !== 'reject') {
      return res.status(200).json({ message: 'Ignored' });
    }

    // 1. Answer Callback Query
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: action === 'approve' ? `✅ Approved: ${title}` : `❌ Rejected: ${title}`,
      }),
    });

    // 2. Edit Telegram Message
    if (message) {
      const isApprove = action === 'approve';
      const statusText = isApprove
        ? `✅ *SUBMISSION APPROVED & LIVE ON SITE*\n\n🎬 *Title:* ${title}\n👤 *Approved by:* ${adminUser}\n🌐 *Live at:* ${WEBSITE_URL}/#anime/${animeId}\n\n📢 *Broadcasted to Channel:* ${PUBLIC_CHANNEL_ID}`
        : `❌ *SUBMISSION REJECTED*\n\n🎬 *Title:* ${title}\n👤 *Rejected by:* ${adminUser}\n⚠️ *Status:* DECLINED`;

      const editEndpoint = message.photo
        ? `${TELEGRAM_API}/editMessageCaption`
        : `${TELEGRAM_API}/editMessageText`;

      const editBody = message.photo
        ? {
            chat_id: message.chat.id,
            message_id: message.message_id,
            caption: statusText,
            parse_mode: 'Markdown',
            reply_markup: isApprove
              ? { inline_keyboard: [[{ text: '🎬 Open Live Page', url: `${WEBSITE_URL}/#anime/${animeId}` }]] }
              : { inline_keyboard: [] },
          }
        : {
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: statusText,
            parse_mode: 'Markdown',
            reply_markup: isApprove
              ? { inline_keyboard: [[{ text: '🎬 Open Live Page', url: `${WEBSITE_URL}/#anime/${animeId}` }]] }
              : { inline_keyboard: [] },
          };

      await fetch(editEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editBody),
      });
    }

    // 3. Channel Broadcast
    if (action === 'approve') {
      const broadcastText =
        `🎉 *NEW REGIONAL DUB ADDED TO ANIDUB INDIA!*\n\n` +
        `🔥 *${title.toUpperCase()}*\n` +
        `🎙 Regional Indian dub options now streaming!\n\n` +
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
            inline_keyboard: [[{ text: '🎬 Open on AniDub India', url: `${WEBSITE_URL}/#anime/${animeId}` }]],
          },
        }),
      });
    }

    return res.status(200).json({ success: true, action, animeId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
