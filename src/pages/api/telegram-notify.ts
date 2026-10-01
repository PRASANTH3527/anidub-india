// Next.js Pages Router API Route: pages/api/telegram-notify.ts

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, title, languages, platform, poster, imageUrl, releaseYear, type, status, airingStatus, releaseDay, genres, submittedBy } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const dubList = Array.isArray(languages) ? languages.join(', ') : languages || 'Indian Dub';
    const streamingPlatform = platform || 'Crunchyroll';
    const submitterName = submittedBy || 'Community Member';
    const imgLink = imageUrl || poster || '';
    const typeText = type || 'Series';
    const statusText = status || airingStatus || 'Ongoing';
    const dayText = releaseDay || 'Saturday';
    const genreList = Array.isArray(genres) && genres.length > 0 ? genres.join(', ') : 'Action, Shonen';

    const caption = 
      `🚨 *NEW ANIME DUB SUBMISSION*\n\n` +
      `🎬 *Title:* ${title}\n` +
      `🎭 *Type:* ${typeText}\n` +
      `🏷️ *Genres:* ${genreList}\n` +
      `📡 *Status:* ${statusText}\n` +
      `🗓️ *Release Day:* Every ${dayText}\n` +
      `🌐 *Languages:* ${dubList}\n` +
      `📺 *Streaming Platform:* ${streamingPlatform}\n` +
      `🖼️ *Image URL:* ${imgLink ? imgLink : 'Default Poster'}\n` +
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
    return res.status(200).json({ success: tgData.ok, data: tgData });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
