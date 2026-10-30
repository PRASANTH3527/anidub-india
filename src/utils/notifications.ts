export type ActivityType = 
  | 'review' 
  | 'chat' 
  | 'anime_submission' 
  | 'anime_approved' 
  | 'upvote' 
  | 'feedback' 
  | 'report'
  | 'system';

export interface NotificationPayload {
  id?: string | number;
  type: ActivityType;
  title?: string;
  message?: string;
  user?: string;
  anime_id?: number | string | null;
  anime_title?: string | null;
  rating?: number | null;
  language?: string | null;
  link?: string | null;
  timestamp?: string;
}

export function escapeTelegramHtml(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatNotificationTitle(payload: NotificationPayload): string {
  switch (payload.type) {
    case 'review':
      return `⭐ New Dub Review: ${payload.anime_title || 'Anime'}`;
    case 'chat':
      return `💬 ${payload.user || 'Community Fan'} in Live Chat`;
    case 'anime_submission':
      return `🎬 New Anime Submitted: ${payload.anime_title || payload.title || 'Untitled'}`;
    case 'anime_approved':
      return `🔥 Newly Approved Dub: ${payload.anime_title || payload.title || 'Anime'}`;
    case 'upvote':
      return `❤️ Upvote for ${payload.anime_title || 'Anime'}`;
    case 'feedback':
      return `📩 New Community Feedback Received`;
    case 'report':
      return `🚨 Issue Reported for ${payload.anime_title || 'Anime'}`;
    default:
      return payload.title || 'AniDub India Alert';
  }
}

export function formatNotificationBody(payload: NotificationPayload): string {
  switch (payload.type) {
    case 'review': {
      const ratingStr = payload.rating ? `${payload.rating}/10` : '';
      const langStr = payload.language ? `[${payload.language}]` : '';
      const parts = [ratingStr, langStr].filter(Boolean).join(' ');
      const comment = payload.message ? ` "${payload.message.slice(0, 80)}${payload.message.length > 80 ? '...' : ''}"` : '';
      return `${payload.user || 'Fan'} rated ${parts}${comment}`;
    }
    case 'chat':
      return payload.message ? payload.message.slice(0, 100) : 'Sent a live message in community chat';
    case 'anime_submission':
      return `Submitted for regional Indian dub catalog review.`;
    case 'anime_approved':
      return `${payload.anime_title || 'This anime'} is now live with official Indian regional dubs!`;
    case 'upvote':
      return payload.message || `Received another vote from the Indian anime community.`;
    case 'feedback':
      return payload.message ? payload.message.slice(0, 100) : `Feedback submitted from the community.`;
    case 'report':
      return payload.message ? `Reason: ${payload.message}` : `Broken link or issue reported.`;
    default:
      return payload.message || 'New activity on AniDub India';
  }
}

export function formatTelegramNotificationHtml(payload: NotificationPayload): string {
  const timeStr = payload.timestamp || new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

  switch (payload.type) {
    case 'review': {
      const animeName = escapeTelegramHtml(payload.anime_title || 'Anime');
      const reviewer = escapeTelegramHtml(payload.user || 'Indian Anime Fan');
      const rating = payload.rating !== undefined && payload.rating !== null ? payload.rating : '8.5';
      const lang = escapeTelegramHtml(payload.language || 'Regional Dub');
      const comment = escapeTelegramHtml(payload.message || 'No additional comment provided.');

      return (
        `⭐ <b>NEW DUB REVIEW SUBMITTED!</b> ⭐\n\n` +
        `🎬 <b>Anime:</b> ${animeName}\n` +
        `👤 <b>Reviewer:</b> ${reviewer}\n` +
        `⭐ <b>Dub Rating:</b> ${rating}/10\n` +
        `🎙️ <b>Language:</b> ${lang}\n` +
        `💬 <b>Review:</b> <i>"${comment}"</i>\n\n` +
        `🕒 <b>Time:</b> ${timeStr} IST\n` +
        `🌐 <i>Stream officially on AniDub India</i>`
      );
    }

    case 'chat': {
      const user = escapeTelegramHtml(payload.user || 'AnimeFan_IN');
      const text = escapeTelegramHtml(payload.message || '');

      return (
        `💬 <b>NEW LIVE COMMUNITY CHAT</b> 💬\n\n` +
        `👤 <b>User:</b> ${user}\n` +
        `💭 <b>Message:</b> "${text}"\n` +
        `🕒 <b>Time:</b> ${timeStr} IST\n\n` +
        `🌐 <i>AniDub India Live Community Chat</i>`
      );
    }

    case 'anime_submission': {
      const title = escapeTelegramHtml(payload.anime_title || payload.title || 'New Anime');
      const langs = escapeTelegramHtml(payload.language || 'Hindi, Tamil, Telugu');
      const user = escapeTelegramHtml(payload.user || 'Community Contributor');

      return (
        `🎬 <b>NEW ANIME SUBMITTED FOR REVIEW!</b> 🎬\n\n` +
        `📌 <b>Title:</b> ${title}\n` +
        `🎙️ <b>Languages:</b> ${langs}\n` +
        `👤 <b>Submitted by:</b> ${user}\n` +
        `🕒 <b>Time:</b> ${timeStr} IST\n\n` +
        `👉 <b>Review &amp; approve in the Admin Dashboard!</b>`
      );
    }

    case 'anime_approved': {
      const title = escapeTelegramHtml(payload.anime_title || payload.title || 'Anime');
      const langs = escapeTelegramHtml(payload.language || 'Indian Dubs');

      return (
        `🔥 <b>NEW DUB APPROVED &amp; PUBLISHED!</b> 🔥\n\n` +
        `📌 <b>Title:</b> ${title}\n` +
        `🎙️ <b>Available in:</b> ${langs}\n` +
        `🕒 <b>Time:</b> ${timeStr} IST\n\n` +
        `👉 <b>Stream now on AniDub India!</b>`
      );
    }

    case 'upvote': {
      const title = escapeTelegramHtml(payload.anime_title || 'Anime');
      const count = payload.message ? escapeTelegramHtml(payload.message) : 'Trending';

      return (
        `❤️ <b>COMMUNITY UPVOTE!</b> ❤️\n\n` +
        `🎬 <b>Anime:</b> ${title}\n` +
        `⚡ <b>Upvotes:</b> ${count}\n` +
        `🕒 <b>Time:</b> ${timeStr} IST\n\n` +
        `🌐 <i>AniDub India Community</i>`
      );
    }

    case 'feedback': {
      const user = escapeTelegramHtml(payload.user || 'Anonymous Fan');
      const text = escapeTelegramHtml(payload.message || 'General feedback submitted.');

      return (
        `📩 <b>NEW FEEDBACK / DUB REQUEST</b> 📩\n\n` +
        `👤 <b>Name/User:</b> ${user}\n` +
        `📝 <b>Message:</b>\n<i>"${text}"</i>\n\n` +
        `🕒 <b>Time:</b> ${timeStr} IST\n` +
        `🌐 <i>AniDub India</i>`
      );
    }

    case 'report': {
      const title = escapeTelegramHtml(payload.anime_title || 'Unknown Anime');
      const text = escapeTelegramHtml(payload.message || 'Issue reported');

      return (
        `🚨 <b>ANIME ISSUE REPORT RECEIVED</b> 🚨\n\n` +
        `🎬 <b>Anime:</b> ${title}\n` +
        `⚠️ <b>Details:</b> ${text}\n` +
        `🕒 <b>Time:</b> ${timeStr} IST\n\n` +
        `<i>AniDub India Control Deck</i>`
      );
    }

    default: {
      return (
        `🔔 <b>ANIDUB INDIA NOTIFICATION</b> 🔔\n\n` +
        `📌 <b>${escapeTelegramHtml(payload.title || 'Update')}</b>\n` +
        `${escapeTelegramHtml(payload.message || '')}\n\n` +
        `🕒 <b>Time:</b> ${timeStr} IST`
      );
    }
  }
}
