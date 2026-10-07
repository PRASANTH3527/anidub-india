import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js API Route for Automated Anime Updates Telegram Broadcast
 * Route: POST or GET /api/telegram/broadcast-anime
 *
 * Environment variables:
 * - TELEGRAM_ANIME_BOT_TOKEN: The Bot Token from @BotFather (dedicated updates bot)
 * - TELEGRAM_ANIME_CHANNEL_ID: The target Telegram Channel username (@channelname) or numerical ID (-100...)
 * - NEXT_PUBLIC_SITE_URL: Base website URL (default: https://anidub.in)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const botToken = process.env.TELEGRAM_ANIME_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || body.botToken || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
    const channelId = process.env.TELEGRAM_ANIME_CHANNEL_ID || process.env.ADMIN_CHAT_ID || body.channelId || '8769442354';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://anidub.in';

    if (!botToken || !channelId) {
      return NextResponse.json(
        { 
          error: 'Missing configuration', 
          message: 'Please provide TELEGRAM_ANIME_BOT_TOKEN or TELEGRAM_BOT_TOKEN' 
        },
        { status: 400 }
      );
    }

    const customMessage = body.message || body.text;

    // Accepts either custom anime data or fetches latest trending/dubbed release
    let anime = body.anime;

    // Handle custom notification message (e.g., '🔔 Anime Updated: [Title]' or '🔔 Anime Added: [Title]')
    if (customMessage) {
      const hasHttpPhoto = anime?.poster && (anime.poster.startsWith('http://') || anime.poster.startsWith('https://'));
      let tgRes;

      if (hasHttpPhoto) {
        const photoCaption = [
          `<b>${escapeHtml(customMessage)}</b>`,
          ``,
          anime?.title ? `🎬 <b>${escapeHtml(anime.title)}</b>` : null,
          anime?.languages ? `🎙️ <b>Dubs:</b> ${escapeHtml(Array.isArray(anime.languages) ? anime.languages.join(' • ') : anime.languages)}` : null,
          anime?.episodes ? `📺 <b>Episodes:</b> ${escapeHtml(String(anime.episodes))}` : null,
          anime?.score ? `⭐ <b>Rating:</b> ${escapeHtml(String(anime.score))}` : null,
          anime?.genres ? `🏷️ <b>Genres:</b> ${escapeHtml(anime.genres)}` : null,
          ``,
          `⚡ AniDub India Admin Alert`,
        ].filter(Boolean).join('\n');

        try {
          tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              photo: anime.poster,
              caption: photoCaption,
              parse_mode: 'HTML',
            }),
          });
        } catch (e) {
          console.warn('[Telegram sendPhoto error, falling back to sendMessage]', e);
        }
      }

      if (!tgRes || !tgRes.ok) {
        const textLines = [
          `<b>${escapeHtml(customMessage)}</b>`,
          ``,
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
            chat_id: channelId,
            text: textLines,
            parse_mode: 'HTML',
          }),
        });
      }

      const tgData = await tgRes.json().catch(() => ({}));
      return NextResponse.json({
        success: true,
        message: 'Notification sent to Telegram successfully!',
        telegramMessageId: tgData?.result?.message_id,
        broadcastedAnime: anime?.title || 'Anime'
      });
    }

    if (!anime) {
      return NextResponse.json(
        { error: 'Missing anime data', message: 'No anime data provided to broadcast.' },
        { status: 400 }
      );
    }

    // Format rich HTML Telegram post caption
    const caption = [
      `🔥 <b>NEW ANIME UPDATE</b>`,
      ``,
      `🎬 <b>${escapeHtml(anime.title)}</b>`,
      anime.japaneseTitle ? `🇯🇵 <i>${escapeHtml(anime.japaneseTitle)}</i>` : null,
      ``,
      `🎙️ <b>Regional Dubs:</b> ${anime.languages ? anime.languages.join(' • ') : 'Tamil • Telugu • Hindi'}`,
      `⭐ <b>Score:</b> ${anime.score} / 10 | 📺 <b>Episodes:</b> ${anime.episodes}`,
      anime.genres ? `🏷️ <b>Genres:</b> ${escapeHtml(anime.genres)}` : null,
      ``,
      `📝 <i>${escapeHtml(anime.synopsis || '')}</i>`,
      ``,
      `⚡ Verified legal streams on Crunchyroll, Netflix & JioCinema.`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `📢 Stay tuned on <a href="${siteUrl}">AniDub India</a>`
    ].filter(Boolean).join('\n');

    // Inline button linking to site
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '▶️ Watch Now / Details',
            url: anime.watchUrl || `${siteUrl}?id=${anime.id}`
          },
          {
            text: '🌐 Open AniDub Directory',
            url: siteUrl
          }
        ]
      ]
    };

    // Send photo with caption and inline button via Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    const tgRes = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        photo: anime.poster,
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return NextResponse.json(
        { error: 'Telegram API Error', details: tgData },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Anime update broadcasted to Telegram channel successfully!',
      telegramMessageId: tgData.result?.message_id,
      broadcastedAnime: anime.title
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Support quick GET triggering (e.g. for Vercel Cron jobs)
  return POST(req);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
