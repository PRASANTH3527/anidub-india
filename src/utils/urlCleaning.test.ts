import { describe, it } from 'node:test';
import assert from 'node:assert';
import { cleanWatchUrl } from './urlCleaning';

describe('Watch URL Preservation Logic (Sanitization Disabled)', () => {
  it('preserves Crunchyroll tracking and share parameters exactly as entered', () => {
    const raw = 'https://www.crunchyroll.com/series/G6W4QKX0R/the-rising-of-the-shield-hero?utm_medium=android&utm_source=share';
    assert.strictEqual(cleanWatchUrl(raw), raw);
  });

  it('preserves clean URLs without query parameters', () => {
    const raw = 'https://www.crunchyroll.com/series/G6W4QKX0R/the-rising-of-the-shield-hero';
    assert.strictEqual(cleanWatchUrl(raw), raw);
  });

  it('preserves complex query parameters, referral tags, and hash fragments', () => {
    const raw = 'https://www.netflix.com/title/80100127?s=a&trkid=13747225&tctx=0%2C0#episodes';
    assert.strictEqual(cleanWatchUrl(raw), raw);
  });

  it('preserves JioCinema and YouTube streaming links with full query strings', () => {
    const rawJio = 'https://www.jiocinema.com/tv-shows/anime/3762828?utm_campaign=share&utm_source=app';
    assert.strictEqual(cleanWatchUrl(rawJio), rawJio);

    const rawYt = 'https://www.youtube.com/playlist?list=PLwLSw1_eDZl1-Qx2k7oZ8o4P7pX8f3jK2';
    assert.strictEqual(cleanWatchUrl(rawYt), rawYt);
  });

  it('gracefully handles null, undefined, empty, and whitespace strings', () => {
    assert.strictEqual(cleanWatchUrl(null), '');
    assert.strictEqual(cleanWatchUrl(undefined), '');
    assert.strictEqual(cleanWatchUrl(''), '');
    assert.strictEqual(cleanWatchUrl('   '), '');
  });

  it('trims leading/trailing whitespace but preserves full URL and query params', () => {
    const padded = '   https://www.crunchyroll.com/watch/GZ7UV391M?season=1&episode=3   ';
    assert.strictEqual(cleanWatchUrl(padded), 'https://www.crunchyroll.com/watch/GZ7UV391M?season=1&episode=3');
  });
});
