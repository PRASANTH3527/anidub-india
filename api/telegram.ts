// API Route Handler: api/telegram.ts
export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_ANIME_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.TELEGRAM_ANIME_CHANNEL_ID || process.env.ADMIN_CHAT_ID || '8769442354';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const message = body.message || body.text || '🔔 New Anime Submitted';
    const anime = body.anime;

    if (TELEGRAM_BOT_TOKEN && ADMIN_CHAT_ID) {
      const textLines = [
        `<b>${escapeHtml(message)}</b>`,
        '',
        anime?.title ? `🎬 <b>Title:</b> ${escapeHtml(anime.title)}` : null,
        anime?.languages ? `🎙️ <b>Dubs:</b> ${escapeHtml(Array.isArray(anime.languages) ? anime.languages.join(' • ') : anime.languages)}` : null,
        anime?.episodes ? `📺 <b>Episodes:</b> ${escapeHtml(String(anime.episodes))}` : null,
        anime?.id ? `🆔 <b>ID:</b> <code>${escapeHtml(anime.id)}</code>` : null,
        `⏱️ <i>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</i>`,
      ].filter(Boolean).join('\n');

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: textLines,
          parse_mode: 'HTML',
        }),
      });
    }

    return res.status(200).json({ success: true, message: 'Telegram alert sent' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
