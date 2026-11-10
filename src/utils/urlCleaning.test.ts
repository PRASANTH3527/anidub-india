import { describe, it } from 'node:test';
import assert from 'node:assert';
import { cleanWatchUrl } from './urlCleaning';

describe('Watch URL Cleaning Logic', () => {
  it('strips Crunchyroll tracking parameters leaving clean canonical URL', () => {
    const raw = 'https://www.crunchyroll.com/series/G6W4QKX0R/the-rising-of-the-shield-hero?utm_medium=android&utm_source=share';
    const expected = 'https://www.crunchyroll.com/series/G6W4QKX0R/the-rising-of-the-shield-hero';
    assert.strictEqual(cleanWatchUrl(raw), expected);
  });

  it('preserves already clean URLs without query parameters', () => {
    const raw = 'https://www.crunchyroll.com/series/G6W4QKX0R/the-rising-of-the-shield-hero';
    assert.strictEqual(cleanWatchUrl(raw), raw);
  });

  it('strips complex query parameters, referral tags, and hash fragments', () => {
    const raw = 'https://www.netflix.com/title/80100127?s=a&trkid=13747225&tctx=0%2C0#episodes';
    const expected = 'https://www.netflix.com/title/80100127';
    assert.strictEqual(cleanWatchUrl(raw), expected);
  });

  it('handles JioCinema and YouTube streaming links', () => {
    const rawJio = 'https://www.jiocinema.com/tv-shows/anime/3762828?utm_campaign=share&utm_source=app';
    assert.strictEqual(cleanWatchUrl(rawJio), 'https://www.jiocinema.com/tv-shows/anime/3762828');

    const rawYt = 'https://www.youtube.com/playlist?list=PLwLSw1_eDZl1-Qx2k7oZ8o4P7pX8f3jK2';
    // When stripping query parameters from YouTube playlist, it returns base path
    assert.strictEqual(cleanWatchUrl(rawYt), 'https://www.youtube.com/playlist');
  });

  it('gracefully handles null, undefined, empty, and whitespace strings', () => {
    assert.strictEqual(cleanWatchUrl(null), '');
    assert.strictEqual(cleanWatchUrl(undefined), '');
    assert.strictEqual(cleanWatchUrl(''), '');
    assert.strictEqual(cleanWatchUrl('   '), '');
  });

  it('falls back gracefully to split logic on invalid URL format', () => {
    const malformed = 'custom-scheme://watch/item123?tracking=true#anchor';
    assert.strictEqual(cleanWatchUrl(malformed), 'custom-scheme://watch/item123');
  });
});
