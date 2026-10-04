import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js API Route for Telegram Admin Notifications
 * Route: POST /api/telegram
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const botToken = process.env.TELEGRAM_ANIME_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || body.botToken || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
    const chatId = process.env.TELEGRAM_ANIME_CHANNEL_ID || process.env.ADMIN_CHAT_ID || body.chatId || '8769442354';

    if (!botToken || !chatId) {
      return NextResponse.json(
        { error: 'Missing Telegram configuration', message: 'Token or chat ID missing' },
        { status: 400 }
      );
    }

    const message = body.message || body.text || '🔔 New Anime Submitted';
    const anime = body.anime;
    const photoUrl = anime?.poster || body.photo;

    const hasHttpPhoto = photoUrl && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'));
    let tgRes;

    if (hasHttpPhoto) {
      const captionLines = [
        `<b>${escapeHtml(message)}</b>`,
        '',
        anime?.title ? `🎬 <b>${escapeHtml(anime.title)}</b>` : null,
        anime?.languages ? `🎙️ <b>Dubs:</b> ${escapeHtml(Array.isArray(anime.languages) ? anime.languages.join(' • ') : anime.languages)}` : null,
        anime?.episodes ? `📺 <b>Episodes:</b> ${escapeHtml(String(anime.episodes))}` : null,
        anime?.genres ? `🏷️ <b>Genres:</b> ${escapeHtml(anime.genres)}` : null,
        '',
        `⚡ AniDub India Admin Alert`,
      ].filter(Boolean).join('\n');

      try {
        tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption: captionLines,
            parse_mode: 'HTML',
          }),
        });
      } catch (err) {
        console.warn('[Telegram sendPhoto error, falling back to sendMessage]', err);
      }
    }

    if (!tgRes || !tgRes.ok) {
      const textLines = [
        `<b>${escapeHtml(message)}</b>`,
        '',
        anime?.title ? `🎬 <b>Title:</b> ${escapeHtml(anime.title)}` : null,
        anime?.languages ? `🎙️ <b>Dubs:</b> ${escapeHtml(Array.isArray(anime.languages) ? anime.languages.join(' • ') : anime.languages)}` : null,
        anime?.episodes ? `📺 <b>Episodes:</b> ${escapeHtml(String(anime.episodes))}` : null,
        anime?.id ? `🆔 <b>ID:</b> <code>${escapeHtml(anime.id)}</code>` : null,
        `⏱️ <i>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</i>`,
      ].filter(Boolean).join('\n');

      tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: textLines,
          parse_mode: 'HTML',
        }),
      });
    }

    const tgData = await tgRes.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      message: 'Telegram notification sent successfully!',
      telegramMessageId: tgData?.result?.message_id,
    });
  } catch (err: any) {
    console.error('[Telegram API Route Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to send notification' }, { status: 500 });
  }
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
