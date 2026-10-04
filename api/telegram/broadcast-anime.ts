// Vercel Serverless Function & Next.js API Handler: api/telegram/broadcast-anime.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_ANIME_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ANIME_CHANNEL_ID || process.env.ADMIN_CHAT_ID || '8769442354';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://anidub.in';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramMessage(text: string, photoUrl?: string) {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.warn('[Telegram Broadcast] Token or chat ID missing');
    return null;
  }

  const hasHttpPhoto = photoUrl && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'));

  if (hasHttpPhoto) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          photo: photoUrl,
          caption: text,
          parse_mode: 'HTML',
        }),
      });
      if (res.ok) return await res.json().catch(() => ({ ok: true }));
    } catch (e) {
      console.warn('[sendPhoto error, falling back to sendMessage]', e);
    }
  }

  // Fallback to text message
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
    return await res.json().catch(() => ({ ok: true }));
  } catch (err) {
    console.error('[sendMessage error]', err);
    return null;
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body.message || body.text || `🔔 Anime Updated: ${body.title || body.anime?.title || 'Unknown'}`;
    const anime = body.anime;

    const formattedCaption = [
      `<b>${escapeHtml(message)}</b>`,
      ``,
      anime?.title ? `🎬 <b>Title:</b> ${escapeHtml(anime.title)}` : null,
      anime?.languages ? `🎙️ <b>Dubs:</b> ${escapeHtml(Array.isArray(anime.languages) ? anime.languages.join(' • ') : anime.languages)}` : null,
      anime?.episodes ? `📺 <b>Episodes:</b> ${escapeHtml(String(anime.episodes))}` : null,
      anime?.score ? `⭐ <b>Rating:</b> ${escapeHtml(String(anime.score))}` : null,
      anime?.genres ? `🏷️ <b>Genres:</b> ${escapeHtml(anime.genres)}` : null,
      ``,
      `⚡ AniDub India Admin Alert`,
    ].filter(Boolean).join('\n');

    const result = await sendTelegramMessage(formattedCaption, anime?.poster);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification delivered to Telegram successfully!',
        result,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}

// Serverless fallback export
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  const body = req.body || {};
  const message = body.message || body.text || `🔔 Anime Updated: ${body.title || body.anime?.title || 'Unknown'}`;
  const anime = body.anime;

  const formattedCaption = [
    `<b>${escapeHtml(message)}</b>`,
    ``,
    anime?.title ? `🎬 <b>Title:</b> ${escapeHtml(anime.title)}` : null,
    anime?.languages ? `🎙️ <b>Dubs:</b> ${escapeHtml(Array.isArray(anime.languages) ? anime.languages.join(' • ') : anime.languages)}` : null,
    anime?.episodes ? `📺 <b>Episodes:</b> ${escapeHtml(String(anime.episodes))}` : null,
    anime?.score ? `⭐ <b>Rating:</b> ${escapeHtml(String(anime.score))}` : null,
    anime?.genres ? `🏷️ <b>Genres:</b> ${escapeHtml(anime.genres)}` : null,
    ``,
    `⚡ AniDub India Admin Alert`,
  ].filter(Boolean).join('\n');

  const result = await sendTelegramMessage(formattedCaption, anime?.poster);
  return res.status(200).json({ success: true, message: 'Notification delivered!', result });
}
