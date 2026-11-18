import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { onRequest as sitemapOnRequest } from '../functions/sitemap.xml';
import { onRequest as apiOnRequest } from '../functions/api/[[route]]';
import {
  SITE_ORIGIN,
  resolveCanonicalOrigin,
  buildDefaultSeoMeta,
  buildAnimeSeoMeta,
  buildLanguageSeoMeta,
  buildAnimeJsonLd,
  buildDynamicSitemapXml,
} from '../src/utils/seoMeta';
import { parsePlatformList } from '../src/utils/dataNormalization';
import {
  WATCH_PROGRESS_STORAGE_KEY,
  SPOILER_PROTECTION_STORAGE_KEY,
  computeWatchProgressPercent,
  getAllWatchProgress,
  getAnimeWatchProgress,
  saveAnimeWatchProgress,
  clearAnimeWatchProgress,
  getSpoilerProtectionEnabled,
  setSpoilerProtectionEnabled,
  containsSpoilerContent,
} from '../src/utils/watchProgress';
import {
  BLOCKED_CHAT_USERS_STORAGE_KEY,
  getBlockedChatUsers,
  blockChatUser,
  unblockChatUser,
  isChatUserBlocked,
  filterVisibleChatMessages,
  formatSpoilerChatMessage,
  stripSpoilerMarker,
  isChatMessageSpoiler,
} from '../src/utils/chatModeration';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function createSignedJwt(payload: Record<string, any>, privateKeyPem: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = Buffer.from(
    JSON.stringify({
      iat: now - 5,
      nbf: now - 5,
      exp: now + 300,
      azp: 'https://anidub.in',
      ...payload,
    })
  ).toString('base64url');
  const unsigned = `${header}.${fullPayload}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKeyPem).toString('base64url');
  return `${unsigned}.${sig}`;
}

test('Step 3.1 SEO Domain Correction: canonical URLs, JSON-LD, index.html, and sitemap strictly use https://anidub.in', async () => {
  assert.equal(SITE_ORIGIN, 'https://anidub.in');
  assert.equal(resolveCanonicalOrigin('https://anidub-india-a1y.pages.dev'), 'https://anidub.in');
  assert.equal(resolveCanonicalOrigin('http://localhost:3000'), 'https://anidub.in');

  const defaultMeta = buildDefaultSeoMeta('https://anidub-india-a1y.pages.dev');
  assert.equal(defaultMeta.canonicalUrl, 'https://anidub.in/');

  const animeMeta = buildAnimeSeoMeta(
    { id: 7, slug: 'jujutsu-kaisen', title: 'Jujutsu Kaisen', languages: 'Hindi, Tamil, Telugu' },
    'https://anidub-india-a1y.pages.dev',
    'jujutsu-kaisen'
  );
  assert.equal(animeMeta.canonicalUrl, 'https://anidub.in/anime/jujutsu-kaisen');

  const langMeta = buildLanguageSeoMeta('Hindi', 'https://anidub-india.pages.dev');
  assert.equal(langMeta.canonicalUrl, 'https://anidub.in/dubbed-anime/hindi');

  const jsonLd = buildAnimeJsonLd(
    { id: 7, slug: 'jujutsu-kaisen', title: 'Jujutsu Kaisen', languages: 'Hindi, Tamil' },
    'https://anidub-india-a1y.pages.dev',
    'jujutsu-kaisen'
  );
  assert.ok(jsonLd.includes('https://anidub.in/anime/jujutsu-kaisen'));
  assert.equal(jsonLd.includes('pages.dev'), false);

  const xml = buildDynamicSitemapXml(
    [{ id: 7, slug: 'jujutsu-kaisen', created_at: '2026-05-01T00:00:00Z' }],
    'https://anidub-india-a1y.pages.dev'
  );
  assert.ok(xml.includes('<loc>https://anidub.in/</loc>'));
  assert.ok(xml.includes('<loc>https://anidub.in/anime/jujutsu-kaisen</loc>'));
  assert.equal(xml.includes('pages.dev'), false);

  const sitemapResp = await sitemapOnRequest({
    request: new Request('https://anidub-india-a1y.pages.dev/sitemap.xml'),
    env: {
      DB: {
        prepare() {
          return {
            async all() {
              return { results: [{ id: 10, slug: 'mushoku-tensei', created_at: '2026-06-15T10:00:00Z' }] as any };
            },
          };
        },
      },
    },
  });
  assert.equal(sitemapResp.status, 200);
  const sitemapBody = await sitemapResp.text();
  assert.ok(sitemapBody.includes('https://anidub.in/anime/mushoku-tensei'));
  assert.equal(sitemapBody.includes('pages.dev'), false);

  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(indexHtml.includes('href="https://anidub.in/"'));
  assert.ok(indexHtml.includes('content="https://anidub.in/"'));
  assert.equal(indexHtml.includes('pages.dev'), false);

  const robotsTxt = fs.readFileSync(path.join(process.cwd(), 'public/robots.txt'), 'utf-8');
  assert.ok(robotsTxt.includes('Sitemap: https://anidub.in/sitemap.xml'));
});

test('Step 3.2 Accessibility & UI Text: replaces "100% Legal" claims and enforces aria-labels on icon buttons', () => {
  const uiFiles = [
    'src/components/Navbar.tsx',
    'src/components/Hero.tsx',
    'src/components/AnimatedStats.tsx',
    'src/components/AnimeCard.tsx',
    'src/components/AnimeDetailPage.tsx',
    'src/components/ScheduleView.tsx',
    'src/components/RecentlyViewedRow.tsx',
    'src/components/VoiceSearchBar.tsx',
    'src/components/PublicHomeView.tsx',
    'src/components/CatalogView.tsx',
    'src/components/FeedbackSection.tsx',
    'src/components/LiveChat.tsx',
  ];

  for (const relPath of uiFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
    assert.equal(content.includes('100% Legal'), false, `${relPath} must not contain "100% Legal"`);
  }

  assert.ok(
    fs.readFileSync(path.join(process.cwd(), 'src/components/Hero.tsx'), 'utf-8').includes('Verified Sources')
  );
  assert.ok(
    fs.readFileSync(path.join(process.cwd(), 'src/components/AnimeDetailPage.tsx'), 'utf-8').includes('Verified Sources')
  );
  assert.ok(
    fs.readFileSync(path.join(process.cwd(), 'src/components/ScheduleView.tsx'), 'utf-8').includes('Official Streams')
  );

  for (const relPath of [
    'src/components/Navbar.tsx',
    'src/components/AnimeCard.tsx',
    'src/components/VoiceSearchBar.tsx',
    'src/components/RecentlyViewedRow.tsx',
    'src/components/LiveChat.tsx',
  ]) {
    const content = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
    assert.ok(content.includes('aria-label='), `${relPath} should define aria-label on icon buttons`);
  }

  // Clerk test publishable key must remain untouched
  const mainTsx = fs.readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf-8');
  assert.ok(mainTsx.includes('pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bnRzLmRldiQ'));
});

test('Step 3.3 Watch Progress & Spoiler Protection: local persistence, D1 /api/progress sync, and spoiler detection/blur helpers', async () => {
  const prevStorage = (globalThis as any).localStorage;
  (globalThis as any).localStorage = createMemoryStorage();

  try {
    // 1. Watch Progress pure helpers & localStorage
    const saved = saveAnimeWatchProgress(42, { season: 2, episode: 8, totalEpisodes: 12, completed: false });
    assert.ok(saved);
    assert.equal(saved.season, 2);
    assert.equal(saved.episode, 8);
    assert.equal(saved.totalEpisodes, 12);
    assert.equal(computeWatchProgressPercent(8, 12, false), 67);
    assert.equal(computeWatchProgressPercent(12, 12, true), 100);

    const fetched = getAnimeWatchProgress(42);
    assert.equal(fetched?.season, 2);
    assert.equal(fetched?.episode, 8);
    assert.equal(Object.keys(getAllWatchProgress()).length, 1);
    assert.ok((globalThis as any).localStorage.getItem(WATCH_PROGRESS_STORAGE_KEY));

    clearAnimeWatchProgress(42);
    assert.equal(getAnimeWatchProgress(42), null);

    // 2. Spoiler Protection state & detection
    assert.equal(getSpoilerProtectionEnabled(), false);
    setSpoilerProtectionEnabled(true);
    assert.equal(getSpoilerProtectionEnabled(), true);
    assert.equal((globalThis as any).localStorage.getItem(SPOILER_PROTECTION_STORAGE_KEY), 'true');

    assert.equal(containsSpoilerContent('[SPOILER] Gojo gets sealed in Shibuya'), true);
    assert.equal(containsSpoilerContent('Great Hindi dubbing by the voice cast!'), false);

    const formatted = formatSpoilerChatMessage('Plot twist at the end', true);
    assert.equal(formatted, '[SPOILER] Plot twist at the end');
    assert.equal(stripSpoilerMarker(formatted), 'Plot twist at the end');
    assert.equal(isChatMessageSpoiler({ text: formatted }), true);
  } finally {
    (globalThis as any).localStorage = prevStorage;
  }

  // 3. Backend /api/progress D1 persistence & auth guard
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const userJwt = createSignedJwt(
    { sub: 'user_progress_01', sid: 'sess_prog_01', username: 'TanjiroFan' },
    privateKey
  );

  const progressRows = new Map<string, any>();
  const mockDb = {
    prepare(sql: string) {
      let args: any[] = [];
      const stmt = {
        bind(...params: any[]) {
          args = params;
          return stmt;
        },
        async first() {
          if (sql.includes('FROM watch_progress') && sql.includes('anime_id = ?')) {
            return progressRows.get(`${args[0]}:${args[1]}`) ?? null;
          }
          return null;
        },
        async all() {
          if (sql.includes('FROM watch_progress')) {
            return { results: Array.from(progressRows.values()).filter((r) => r.user_id === args[0]) };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO watch_progress')) {
            const [userId, animeId, season, episode, totalEpisodes, completed] = args;
            const key = `${userId}:${animeId}`;
            progressRows.set(key, {
              user_id: userId,
              anime_id: animeId,
              season,
              episode,
              total_episodes: totalEpisodes,
              completed,
              updated_at: new Date().toISOString(),
            });
            return { meta: { changes: 1 } };
          }
          if (sql.includes('DELETE FROM watch_progress')) {
            const deleted = progressRows.delete(`${args[0]}:${args[1]}`);
            return { meta: { changes: deleted ? 1 : 0 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  };

  const env = { DB: mockDb, CLERK_JWT_KEY: publicKey };

  // Unauthenticated request must return 401
  const unauthResp = await apiOnRequest({
    request: new Request('https://anidub.in/api/progress?animeId=7'),
    env,
  } as any);
  assert.equal(unauthResp.status, 401);

  // Invalid PUT payload returns 400
  const invalidResp = await apiOnRequest({
    request: new Request('https://anidub.in/api/progress', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${userJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ animeId: -5, episode: 1 }),
    }),
    env,
  } as any);
  assert.equal(invalidResp.status, 400);

  // Valid PUT saves progress & GET retrieves it
  const putResp = await apiOnRequest({
    request: new Request('https://anidub.in/api/progress', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${userJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ animeId: 7, season: 2, episode: 14, totalEpisodes: 24, completed: false }),
    }),
    env,
  } as any);
  assert.equal(putResp.status, 200);
  const putData = (await putResp.json()) as any;
  assert.equal(putData.progress.season, 2);
  assert.equal(putData.progress.episode, 14);

  const getResp = await apiOnRequest({
    request: new Request('https://anidub.in/api/progress?animeId=7', {
      headers: { Authorization: `Bearer ${userJwt}` },
    }),
    env,
  } as any);
  assert.equal(getResp.status, 200);
  const getData = (await getResp.json()) as any;
  assert.equal(getData.progress.episode, 14);
  assert.equal(getData.progress.completed, false);
});

test('Step 3.4 Chat Moderation & Notification UI: user block/unblock filtering and Profile notification preferences', () => {
  const prevStorage = (globalThis as any).localStorage;
  (globalThis as any).localStorage = createMemoryStorage();

  try {
    assert.deepEqual(getBlockedChatUsers(), []);
    blockChatUser('Spammer_123');
    blockChatUser('Troll_99');
    assert.equal(isChatUserBlocked('spammer_123', getBlockedChatUsers()), true);
    assert.ok((globalThis as any).localStorage.getItem(BLOCKED_CHAT_USERS_STORAGE_KEY));

    const messages = [
      { id: '1', user: 'GojoFan', text: 'Hindi dub is peak!' },
      { id: '2', user: 'Spammer_123', text: 'Buy coins now!' },
      { id: '3', user: 'Troll_99', text: 'Spoilers!!' },
    ];
    const visible = filterVisibleChatMessages(messages, getBlockedChatUsers());
    assert.equal(visible.length, 1);
    assert.equal(visible[0].user, 'GojoFan');

    unblockChatUser('Spammer_123');
    assert.equal(isChatUserBlocked('Spammer_123', getBlockedChatUsers()), false);
    assert.equal(isChatUserBlocked('Troll_99', getBlockedChatUsers()), true);
  } finally {
    (globalThis as any).localStorage = prevStorage;
  }

  const liveChatSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/LiveChat.tsx'), 'utf-8');
  assert.ok(liveChatSrc.includes('Block User'));
  assert.ok(liveChatSrc.includes('Report User'));
  assert.ok(liveChatSrc.includes('handleToggleSpoilerShield'));

  const profileSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/ProfileView.tsx'), 'utf-8');
  assert.ok(profileSrc.includes('Notification Preferences'));
  assert.ok(profileSrc.includes('Notification Sound Chime'));
  assert.ok(profileSrc.includes('Weekly Simulcast Drops'));
});

test('Step 3.5 Streaming Data Parsing: cleanly splits multi-platform delimited strings & JSON arrays without duplicates', () => {
  assert.deepEqual(
    parsePlatformList('Crunchyroll|Netflix'),
    ['Crunchyroll', 'Netflix']
  );

  assert.deepEqual(
    parsePlatformList('Crunchyroll, Netflix / JioCinema • Crunchyroll'),
    ['Crunchyroll', 'Netflix', 'JioCinema']
  );

  assert.deepEqual(
    parsePlatformList('', ['Netflix', 'YouTube (Muse India)'], undefined),
    ['Netflix', 'YouTube (Muse India)']
  );

  assert.deepEqual(
    parsePlatformList(
      '',
      '',
      JSON.stringify([
        { platform: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/jujutsu-kaisen' },
        { name: 'Netflix', url: 'https://www.netflix.com/title/81278456' },
      ])
    ),
    ['Crunchyroll', 'Netflix']
  );

  assert.deepEqual(
    parsePlatformList('', '', undefined, { defaultFallback: ['Crunchyroll'] }),
    ['Crunchyroll']
  );
});
