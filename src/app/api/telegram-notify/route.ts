// Next.js App Router API Route: app/api/telegram-notify/route.ts
// Handles POST requests to trigger Telegram Admin notification alerts

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { id, title, languages, platform, poster, releaseYear, submittedBy } = body;

    if (!title) {
      return Response.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const dubList = Array.isArray(languages) ? languages.join(', ') : languages || 'Indian Dub';
    const streamingPlatform = platform || 'Crunchyroll';
    const submitterName = submittedBy || 'Community Member';

    const caption = 
      `🚨 *NEW ANIME DUB SUBMISSION*\n\n` +
      `🎬 *Title:* ${title}\n` +
      `🌐 *Languages:* ${dubList}\n` +
      `📺 *Streaming Platform:* ${streamingPlatform}\n` +
      `📅 *Release Year:* ${releaseYear || new Date().getFullYear()}\n` +
      `👤 *Submitted by:* ${submitterName}\n\n` +
      `_Status: PENDING ADMIN APPROVAL_`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve:${id || 'sub'}:${title}` },
          { text: '❌ Reject', callback_data: `reject:${id || 'sub'}:${title}` },
        ],
        [
          { text: '🌐 View on AniDub India', url: `${WEBSITE_URL}/#anime/${id || ''}` },
        ],
      ],
    };

    const hasPhoto = poster && typeof poster === 'string' && poster.startsWith('http');
    const endpoint = hasPhoto ? `${TELEGRAM_API}/sendPhoto` : `${TELEGRAM_API}/sendMessage`;

    const payload = hasPhoto
      ? {
          chat_id: ADMIN_CHAT_ID,
          photo: poster,
          caption,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        }
      : {
          chat_id: ADMIN_CHAT_ID,
          text: caption,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        };

    const tgRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const tgData = await tgRes.json();

    return Response.json({
      success: tgData.ok,
      message: 'Telegram admin alert dispatched successfully',
      data: tgData,
    });
  } catch (error: any) {
    console.error('Error in /api/telegram-notify:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
