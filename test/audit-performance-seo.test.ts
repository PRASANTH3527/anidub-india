import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkAnalyticsRateLimit,
  clearAnalyticsRateLimitStore,
  DEFAULT_ANALYTICS_RATE_LIMIT,
  extractClientIp,
} from '../src/utils/rateLimiter';
import { buildAnimeJsonLd } from '../src/utils/seoMeta';
import { onRequest } from '../functions/api/[[route]]';

test('extractClientIp resolves cf-connecting-ip, x-forwarded-for, x-real-ip, and fallback', () => {
  assert.equal(
    extractClientIp(
      new Request('https://anidub.in/api/track', {
        headers: { 'cf-connecting-ip': '198.51.100.42', 'x-forwarded-for': '10.0.0.1' },
      })
    ),
    '198.51.100.42'
  );
  assert.equal(
    extractClientIp(
      new Request('https://anidub.in/api/track', {
        headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
      })
    ),
    '203.0.113.9'
  );
  assert.equal(extractClientIp(new Request('https://anidub.in/api/track')), '127.0.0.1');
});

test('checkAnalyticsRateLimit enforces per-IP limits, resets after window expires, and supports Cloudflare KV', async () => {
  const store = new Map();
  const reqIp1 = new Request('https://anidub.in/api/track', {
    headers: { 'cf-connecting-ip': '198.51.100.10' },
  });
  const reqIp2 = new Request('https://anidub.in/api/track', {
    headers: { 'cf-connecting-ip': '198.51.100.11' },
  });

  // First 3 requests within window succeed
  for (let i = 0; i < 3; i++) {
    const res = await checkAnalyticsRateLimit(reqIp1, {
      maxRequests: 3,
      windowMs: 60_000,
      nowMs: 1_000_000 + i * 100,
      store,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 2 - i);
  }

  // 4th request from IP1 is blocked
  const blocked = await checkAnalyticsRateLimit(reqIp1, {
    maxRequests: 3,
    windowMs: 60_000,
    nowMs: 1_005_000,
    store,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds >= 1);

  // IP2 remains unaffected
  const otherIp = await checkAnalyticsRateLimit(reqIp2, {
    maxRequests: 3,
    windowMs: 60_000,
    nowMs: 1_005_000,
    store,
  });
  assert.equal(otherIp.allowed, true);
  assert.equal(otherIp.remaining, 2);

  // After window expires, IP1 is allowed again
  const resetRes = await checkAnalyticsRateLimit(reqIp1, {
    maxRequests: 3,
    windowMs: 60_000,
    nowMs: 1_061_000,
    store,
  });
  assert.equal(resetRes.allowed, true);
  assert.equal(resetRes.remaining, 2);

  // Cloudflare KV-backed rate limiting works deterministically
  const kvData = new Map<string, string>();
  const mockKv = {
    async get(key: string) {
      return kvData.get(key) ?? null;
    },
    async put(key: string, value: string) {
      kvData.set(key, value);
    },
  };
  const kvAllowed1 = await checkAnalyticsRateLimit(reqIp1, {
    maxRequests: 2,
    windowMs: 60_000,
    nowMs: 2_000_000,
    kv: mockKv,
  });
  const kvAllowed2 = await checkAnalyticsRateLimit(reqIp1, {
    maxRequests: 2,
    windowMs: 60_000,
    nowMs: 2_000_100,
    kv: mockKv,
  });
  const kvBlocked = await checkAnalyticsRateLimit(reqIp1, {
    maxRequests: 2,
    windowMs: 60_000,
    nowMs: 2_000_200,
    kv: mockKv,
  });
  assert.equal(kvAllowed1.allowed, true);
  assert.equal(kvAllowed2.allowed, true);
  assert.equal(kvBlocked.allowed, false);
});

test('POST /api/track enforces IP-based rate limiting and halts D1 writes after limit exceeded', async () => {
  clearAnalyticsRateLimitStore();

  let dbWrites = 0;
  const mockDb = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async run() {
          dbWrites += 1;
          return { success: true };
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };

  const env = { DB: mockDb };
  const spamIp = '203.0.113.77';

  // Exhaust DEFAULT_ANALYTICS_RATE_LIMIT requests from the same IP
  for (let i = 0; i < DEFAULT_ANALYTICS_RATE_LIMIT; i++) {
    const res = await onRequest({
      request: new Request('https://anidub.in/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': spamIp,
        },
        body: JSON.stringify({ sessionId: `sess_${i}`, path: '/' }),
      }),
      env,
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('X-RateLimit-Limit'), String(DEFAULT_ANALYTICS_RATE_LIMIT));
  }

  const writesAtLimit = dbWrites;
  assert.ok(writesAtLimit > 0);

  // Next request from same IP must return 429 and NOT execute any D1 writes
  const blockedRes = await onRequest({
    request: new Request('https://anidub.in/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': spamIp,
      },
      body: JSON.stringify({ sessionId: 'sess_spam', path: '/' }),
    }),
    env,
  });
  assert.equal(blockedRes.status, 429);
  assert.ok(Number(blockedRes.headers.get('Retry-After')) >= 1);
  assert.equal(blockedRes.headers.get('X-RateLimit-Remaining'), '0');
  assert.equal(dbWrites, writesAtLimit, 'Rate-limited request must not write to D1');

  // Request from a distinct IP succeeds
  const otherRes = await onRequest({
    request: new Request('https://anidub.in/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '198.51.100.88',
      },
      body: JSON.stringify({ sessionId: 'sess_clean', path: '/' }),
    }),
    env,
  });
  assert.equal(otherRes.status, 200);

  clearAnalyticsRateLimitStore();
});

test('buildAnimeJsonLd produces valid Schema.org TVSeries and Movie structured data and escapes HTML script characters', () => {
  const tvRaw = buildAnimeJsonLd(
    {
      id: 101,
      slug: 'solo-leveling',
      title: 'Solo Leveling </script><script>',
      synopsis: 'Sung Jinwoo awakens the Shadow Monarch system.',
      cover_image: 'https://cdn.anidub.in/solo.jpg',
      languages: 'HIN, TAM, TEL, JPN',
      type: 'TV Series',
      year: 2024,
      rating: 8.9,
      episodes_count: 12,
      studio: 'A-1 Pictures',
      genres: 'Action, Fantasy',
      popularity: 420,
    },
    'https://anidub.in'
  );

  assert.equal(tvRaw.includes('</script>'), false);
  const tvParsed = JSON.parse(tvRaw);
  assert.equal(tvParsed['@context'], 'https://schema.org');
  assert.equal(tvParsed['@type'], 'TVSeries');
  assert.equal(tvParsed.name, 'Solo Leveling </script><script>');
  assert.equal(tvParsed.image, 'https://cdn.anidub.in/solo.jpg');
  assert.equal(tvParsed.url, 'https://anidub.in/anime/solo-leveling');
  assert.deepEqual(tvParsed.inLanguage, ['Hindi', 'Tamil', 'Telugu']);
  assert.equal(tvParsed.numberOfEpisodes, 12);
  assert.equal(tvParsed.productionCompany.name, 'A-1 Pictures');
  assert.equal(tvParsed.aggregateRating.ratingValue, 8.9);

  const movieRaw = buildAnimeJsonLd(
    {
      id: 202,
      slug: 'suzume',
      title: 'Suzume',
      synopsis: 'A young girl helps close doors across Japan.',
      cover_image: 'https://cdn.anidub.in/suzume.jpg',
      languages: 'Hindi, Tamil',
      type: 'Movie',
      year: 2022,
      rating: 8.5,
      episodes_count: 1,
    },
    'https://anidub.in'
  );
  const movieParsed = JSON.parse(movieRaw);
  assert.equal(movieParsed['@type'], 'Movie');
  assert.equal(movieParsed.numberOfEpisodes, undefined);
  assert.deepEqual(movieParsed.inLanguage, ['Hindi', 'Tamil']);
});

test('All poster image components specify explicit width/height and lazy loading attributes to prevent CLS', () => {
  const posterComponents: Array<{ file: string; requiresLazy: boolean }> = [
    { file: 'src/components/AnimeCard.tsx', requiresLazy: true },
    { file: 'src/components/AnimeDetailPage.tsx', requiresLazy: true },
    { file: 'src/components/MoreLikeThisSection.tsx', requiresLazy: true },
    { file: 'src/components/RecommendationSystem.tsx', requiresLazy: true },
    { file: 'src/components/ScheduleView.tsx', requiresLazy: true },
    { file: 'src/components/AnimeTierListMaker.tsx', requiresLazy: true },
    { file: 'src/components/CreateCollectionModal.tsx', requiresLazy: true },
    { file: 'src/components/RouletteModal.tsx', requiresLazy: true },
    { file: 'src/components/RecentlyViewedRow.tsx', requiresLazy: true },
    { file: 'src/components/PublicHomeView.tsx', requiresLazy: true },
    { file: 'src/components/HeroBanner.tsx', requiresLazy: false },
  ];

  for (const { file, requiresLazy } of posterComponents) {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
    assert.ok(/\bwidth=\{?\d+/.test(content), `${file} must specify explicit width attribute on poster images`);
    assert.ok(/\bheight=\{?\d+/.test(content), `${file} must specify explicit height attribute on poster images`);
    if (requiresLazy) {
      assert.ok(content.includes('loading="lazy"') || content.includes(': "lazy"'), `${file} must include loading="lazy"`);
    }
  }

  const detailCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AnimeDetailPage.tsx'), 'utf-8');
  assert.ok(detailCode.includes('application/ld+json'));
  assert.ok(detailCode.includes('buildAnimeJsonLd'));
});
