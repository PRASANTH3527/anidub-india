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
    const botToken = process.env.TELEGRAM_ANIME_BOT_TOKEN || body.botToken;
    const channelId = process.env.TELEGRAM_ANIME_CHANNEL_ID || body.channelId;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://anidub.in';

    if (!botToken || !channelId) {
      return NextResponse.json(
        { 
          error: 'Missing configuration', 
          message: 'Please provide TELEGRAM_ANIME_BOT_TOKEN and TELEGRAM_ANIME_CHANNEL_ID' 
        },
        { status: 400 }
      );
    }

    // Accepts either custom anime data or fetches latest trending/dubbed release
    let anime = body.anime;

    if (!anime) {
      // Fetch latest anime release from Jikan API (MyAnimeList v4)
      const res = await fetch('https://api.jikan.moe/v4/seasons/now?limit=5', {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch anime releases: ${res.statusText}`);
      }

      const data = await res.json();
      const releases = data.data || [];
      if (releases.length === 0) {
        return NextResponse.json({ message: 'No new releases found at this moment' });
      }

      // Pick the top item
      const item = releases[0];
      anime = {
        id: item.mal_id,
        title: item.title_english || item.title,
        japaneseTitle: item.title_japanese,
        poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
        synopsis: (item.synopsis || '').slice(0, 220) + '...',
        genres: (item.genres || []).map((g: any) => g.name).slice(0, 3).join(', '),
        score: item.score || 'N/A',
        episodes: item.episodes || 'Ongoing',
        languages: ['Tamil', 'Telugu', 'Hindi'],
        watchUrl: `${siteUrl}?anime=${item.mal_id}`
      };
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
