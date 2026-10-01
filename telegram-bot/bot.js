/**
 * AniDub India - Node.js Telegram Admin Bot & Channel Broadcaster
 * Run with: node telegram-bot/bot.js
 * Requirements: npm install telegraf express dotenv
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_FROM_BOTFATHER';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || 'YOUR_TELEGRAM_ADMIN_CHAT_ID';
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://anidub.in';

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// 1. Start Command - gives user their Chat ID
bot.start((ctx) => {
  ctx.replyWithMarkdown(
    `👋 *Welcome to AniDub India Admin Moderation Bot!*\n\n` +
    `Your Chat ID: \`${ctx.chat.id}\`\n\n` +
    `Set this in your environment as \`ADMIN_CHAT_ID\` to receive submission approval cards.`
  );
});

// 2. Inline Callback Query Handlers: [Approve] & [Reject]
bot.action(/^approve:(.+):(.+)$/, async (ctx) => {
  const animeId = ctx.match[1];
  const title = ctx.match[2];
  const adminName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  await ctx.answerCbQuery(`✅ Approved: ${title}`);

  // 1. Update Database (e.g. Firebase Firestore / Supabase)
  console.log(`Database Updated: ${animeId} marked APPROVED by ${adminName}`);

  // 2. Edit Telegram message to show Approved badge
  await ctx.editMessageCaption(
    `✅ *SUBMISSION APPROVED!*\n\n` +
    `🎬 *Title:* ${title}\n` +
    `👤 *Approved by:* ${adminName}\n` +
    `🌐 *Status:* LIVE ON DIRECTORY\n\n` +
    `📢 *Broadcasted to Channel:* ${PUBLIC_CHANNEL_ID}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('🎬 View Live Anime Page', `${WEBSITE_URL}/#anime/${animeId}`)],
      ]),
    }
  );

  // 3. Broadcast to Public Channel
  try {
    const broadcastText =
      `🎉 *NEW ANIME DUB ADDED TO ANIDUB INDIA!*\n\n` +
      `🔥 *${title.toUpperCase()}*\n` +
      `🎙 Regional Indian Dubs available!\n\n` +
      `👉 *Watch Now & Track Dub Details:*\n` +
      `${WEBSITE_URL}/#anime/${animeId}\n\n` +
      `#TamilDub #TeluguDub #HindiDub #AnimeIndia #AniDub`;

    await bot.telegram.sendMessage(PUBLIC_CHANNEL_ID, broadcastText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('🎬 Open on AniDub India', `${WEBSITE_URL}/#anime/${animeId}`)],
      ]),
    });
    console.log(`Broadcasted ${title} to ${PUBLIC_CHANNEL_ID}`);
  } catch (err) {
    console.error(`Error broadcasting to ${PUBLIC_CHANNEL_ID}:`, err.message);
  }
});

bot.action(/^reject:(.+):(.+)$/, async (ctx) => {
  const animeId = ctx.match[1];
  const title = ctx.match[2];
  const adminName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  await ctx.answerCbQuery(`❌ Rejected: ${title}`);

  // Update Database to "rejected"
  console.log(`Database Updated: ${animeId} marked REJECTED by ${adminName}`);

  await ctx.editMessageCaption(
    `❌ *SUBMISSION REJECTED*\n\n` +
    `🎬 *Title:* ${title}\n` +
    `👤 *Rejected by:* ${adminName}\n` +
    `⚠️ *Status:* DECLINED (Not published)`,
    { parse_mode: 'Markdown' }
  );
});

// 3. Webhook from Website when new Dub is submitted
app.post('/api/notify-telegram', async (req, res) => {
  const { id, title, dubs, poster, releaseYear, submittedBy, platforms } = req.body || {};
  const dubList = (dubs || []).join(', ');
  const submitter = submittedBy?.userName || 'User';
  const platform = platforms?.[0]?.name || 'Crunchyroll';

  const caption =
    `🚨 *NEW ANIME DUB SUBMISSION*\n\n` +
    `🎬 *Title:* ${title}\n` +
    `🌐 *Dub Audio:* ${dubList}\n` +
    `📺 *Platform:* ${platform}\n` +
    `📅 *Release Year:* ${releaseYear || 2024}\n` +
    `👤 *Submitted by:* ${submitter}\n\n` +
    `_Status: PENDING ADMIN APPROVAL_`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `approve:${id}:${title}`),
      Markup.button.callback('❌ Reject', `reject:${id}:${title}`),
    ],
    [Markup.button.url('🌐 View on AniDub', `${WEBSITE_URL}/#anime/${id}`)],
  ]);

  try {
    if (poster && poster.startsWith('http')) {
      await bot.telegram.sendPhoto(ADMIN_CHAT_ID, poster, {
        caption,
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } else {
      await bot.telegram.sendMessage(ADMIN_CHAT_ID, caption, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    }
    return res.json({ success: true, message: 'Dispatched to Telegram Admin Bot' });
  } catch (error) {
    console.error('Failed to notify Telegram bot:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Launch Express webhook server and Telegram Bot
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Telegram Bot Webhook listener running on port ${PORT}`));
bot.launch().then(() => console.log('Telegram Admin Bot is running...'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
