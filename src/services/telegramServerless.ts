import { AnimeRecord } from '../types/database';

/**
 * 1. Form Submission (Serverless Trigger via Native fetch):
 * Calls Telegram sendMessage or sendPhoto directly to ADMIN_CHAT_ID
 * with [✅ Approve] and [❌ Reject] inline keyboard buttons.
 */
export async function triggerTelegramAdminAlert(anime: AnimeRecord): Promise<{ success: boolean; data?: any; error?: string }> {
  const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
  const adminChatId = process.env.NEXT_PUBLIC_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || '8769442354';
  const websiteUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://anidub.in');

  if (!botToken || !adminChatId) {
    console.warn('[Telegram Serverless] Missing BOT_TOKEN or ADMIN_CHAT_ID. Check your .env.local variables.');
    return { success: false, error: 'Telegram credentials missing in environment' };
  }

  const dubList = anime.dubs.join(', ');
  const platform = anime.platforms[0]?.name || 'Crunchyroll';
  const submitter = anime.submittedBy?.userName || 'Anonymous User';
  const imgLink = anime.imageUrl || anime.poster || '';
  const typeText = anime.type || 'Series';
  const statusText = anime.status || anime.airingStatus || 'Ongoing';
  const dayText = (statusText === 'Ongoing' && (anime.releaseDay || anime.airingDay)) 
    ? `🗓️ *Release Day:* Every ${anime.releaseDay || anime.airingDay}\n` 
    : '';
  const genreList = Array.isArray(anime.genres) && anime.genres.length > 0 ? anime.genres.join(', ') : 'Action, Shonen';

  const caption = 
    `🚨 *NEW ANIME DUB SUBMISSION*\n\n` +
    `🎬 *Title:* ${anime.title}\n` +
    `🎭 *Type:* ${typeText}\n` +
    `🏷️ *Genres:* ${genreList}\n` +
    `📡 *Status:* ${statusText}\n` +
    dayText +
    `🌐 *Dub Languages:* ${dubList}\n` +
    `📺 *Streaming Platform:* ${platform}\n` +
    `🖼️ *Image URL:* ${imgLink ? imgLink : 'Default Poster'}\n` +
    `📅 *Release Year:* ${anime.releaseYear}\n` +
    `👤 *Submitted by:* ${submitter}\n\n` +
    `_Status: PENDING ADMIN APPROVAL_`;

  // Inline keyboard with [✅ Approve] and [❌ Reject]
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve:${anime.id}:${anime.title}` },
        { text: '❌ Reject', callback_data: `reject:${anime.id}:${anime.title}` },
      ],
      [
        { text: '🌐 View on AniDub India', url: `${websiteUrl}/#anime/${anime.id}` },
      ],
    ],
  };

  try {
    // If anime has a valid poster URL, send using sendPhoto; otherwise use sendMessage
    const endpoint = anime.poster && anime.poster.startsWith('http')
      ? `https://api.telegram.org/bot${botToken}/sendPhoto`
      : `https://api.telegram.org/bot${botToken}/sendMessage`;

    const body = anime.poster && anime.poster.startsWith('http')
      ? {
          chat_id: adminChatId,
          photo: anime.poster,
          caption,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        }
      : {
          chat_id: adminChatId,
          text: caption,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return { success: data.ok, data };
  } catch (err: any) {
    console.error('[Telegram Serverless Trigger Error]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Feedback Notification:
 * Sends a notification message directly to ADMIN_CHAT_ID containing
 * the user's Name/Insta ID, Email ID, and Feedback text.
 */
export async function sendTelegramFeedbackAlert(feedbackData: {
  nameOrInsta?: string;
  email?: string;
  feedback: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const botToken =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
  const adminChatId =
    process.env.NEXT_PUBLIC_ADMIN_CHAT_ID ||
    process.env.ADMIN_CHAT_ID ||
    '8769442354';

  if (!botToken || !adminChatId) {
    return { success: false, error: 'Telegram credentials missing' };
  }

  const nameText = feedbackData.nameOrInsta?.trim() || 'Anonymous User';
  const emailText = feedbackData.email?.trim() || 'Not provided';
  const feedbackContent = feedbackData.feedback?.trim() || 'No feedback';
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

  const messageText =
    `💬 *NEW USER FEEDBACK RECEIVED*\n\n` +
    `👤 *Name / Insta ID:* ${nameText}\n` +
    `📧 *Email ID:* ${emailText}\n` +
    `📅 *Date & Time:* ${timestamp}\n\n` +
    `📝 *Feedback:*\n` +
    `"${feedbackContent}"\n\n` +
    `_Sent via AniDub India Community Portal_`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: messageText,
        parse_mode: 'Markdown',
      }),
    });

    const data = await res.json();
    return { success: data.ok, data };
  } catch (err: any) {
    console.error('[Telegram Serverless Feedback Error]:', err);
    return { success: false, error: err.message };
  }
}

