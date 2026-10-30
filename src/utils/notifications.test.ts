import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeTelegramHtml,
  formatNotificationTitle,
  formatNotificationBody,
  formatTelegramNotificationHtml
} from './notifications.ts';

test('escapeTelegramHtml escapes HTML special characters', () => {
  assert.equal(escapeTelegramHtml('Attack & Titan <Season 2>'), 'Attack &amp; Titan &lt;Season 2&gt;');
  assert.equal(escapeTelegramHtml(''), '');
  assert.equal(escapeTelegramHtml(null), '');
  assert.equal(escapeTelegramHtml(undefined), '');
  assert.equal(escapeTelegramHtml(123), '123');
});

test('formatNotificationTitle formats titles for all activity types', () => {
  assert.equal(
    formatNotificationTitle({ type: 'review', anime_title: 'Solo Leveling' }),
    '⭐ New Dub Review: Solo Leveling'
  );

  assert.equal(
    formatNotificationTitle({ type: 'chat', user: 'Tanjiro_Delhi' }),
    '💬 Tanjiro_Delhi in Live Chat'
  );

  assert.equal(
    formatNotificationTitle({ type: 'anime_submission', anime_title: 'Demon Slayer' }),
    '🎬 New Anime Submitted: Demon Slayer'
  );

  assert.equal(
    formatNotificationTitle({ type: 'anime_approved', anime_title: 'Naruto' }),
    '🔥 Newly Approved Dub: Naruto'
  );

  assert.equal(
    formatNotificationTitle({ type: 'upvote', anime_title: 'Jujutsu Kaisen' }),
    '❤️ Upvote for Jujutsu Kaisen'
  );

  assert.equal(
    formatNotificationTitle({ type: 'feedback' }),
    '📩 New Community Feedback Received'
  );
});

test('formatNotificationBody produces clear user-facing messages', () => {
  const reviewBody = formatNotificationBody({
    type: 'review',
    user: 'Goku_Chennai',
    rating: 9.5,
    language: 'Tamil Dub',
    message: 'Awesome voice acting by the Tamil team!'
  });
  assert.ok(reviewBody.includes('Goku_Chennai'));
  assert.ok(reviewBody.includes('9.5/10'));
  assert.ok(reviewBody.includes('[Tamil Dub]'));
  assert.ok(reviewBody.includes('Awesome voice acting'));

  const chatBody = formatNotificationBody({
    type: 'chat',
    user: 'Luffy_Mumbai',
    message: 'When is season 2 coming in Hindi?'
  });
  assert.equal(chatBody, 'When is season 2 coming in Hindi?');
});

test('formatTelegramNotificationHtml formats full HTML for Telegram Bot', () => {
  const tgHtml = formatTelegramNotificationHtml({
    type: 'review',
    anime_title: 'Chainsaw Man',
    user: 'Denji_Pune',
    rating: 10,
    language: 'Hindi Dub',
    message: 'The Hindi dialogues are hilarious & action is top notch!',
    timestamp: '10:30 AM'
  });

  assert.ok(tgHtml.includes('NEW DUB REVIEW SUBMITTED!'));
  assert.ok(tgHtml.includes('Chainsaw Man'));
  assert.ok(tgHtml.includes('Denji_Pune'));
  assert.ok(tgHtml.includes('10/10'));
  assert.ok(tgHtml.includes('Hindi Dub'));
  assert.ok(tgHtml.includes('10:30 AM IST'));
});

test('formatTelegramNotificationHtml formats live chat messages for Telegram', () => {
  const tgChat = formatTelegramNotificationHtml({
    type: 'chat',
    user: 'Zoro_Bengaluru',
    message: 'Is One Piece dubbed in Telugu yet?',
    timestamp: '11:15 AM'
  });

  assert.ok(tgChat.includes('NEW LIVE COMMUNITY CHAT'));
  assert.ok(tgChat.includes('Zoro_Bengaluru'));
  assert.ok(tgChat.includes('Is One Piece dubbed in Telugu yet?'));
});
