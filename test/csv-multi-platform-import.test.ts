import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/[[route]].ts';
import {
  CANONICAL_STREAMING_PLATFORMS,
  matchCanonicalPlatformName,
  parseCsvPlatformsField,
} from '../src/utils/dataNormalization.ts';

function createSignedClerkJwt(sub: string, extraClaims: Record<string, unknown> = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      sid: `sess_${sub}`,
      azp: 'https://anidub.in',
      exp: nowSec + 300,
      iat: nowSec - 10,
      nbf: nowSec - 10,
      ...extraClaims,
    })
  ).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(unsigned), privateKey)
    .toString('base64url');
  return { token: `${unsigned}.${signature}`, publicPem: publicKey };
}

test('matchCanonicalPlatformName trims whitespace and matches UI dropdown options case-insensitively', () => {
  assert.equal(matchCanonicalPlatformName('  prime video  '), 'Prime Video');
  assert.equal(matchCanonicalPlatformName('NETFLIX'), 'Netflix');
  assert.equal(matchCanonicalPlatformName('jiohotstar'), 'JioHotstar');
  assert.equal(matchCanonicalPlatformName('  jio   hotstar '), 'JioHotstar');
  assert.equal(matchCanonicalPlatformName('youtube (ani-one india)'), 'YouTube (Ani-One India)');
  assert.equal(matchCanonicalPlatformName('disney+ hotstar'), 'Disney+ Hotstar');
  assert.equal(matchCanonicalPlatformName('sony yay'), 'Sony YAY!');
  assert.equal(matchCanonicalPlatformName('sony liv'), 'Sony LIV');
  assert.equal(matchCanonicalPlatformName('Custom Regional OTT'), 'Custom Regional OTT');

  for (const canonical of CANONICAL_STREAMING_PLATFORMS) {
    assert.equal(matchCanonicalPlatformName(canonical.toLowerCase()), canonical);
    assert.equal(matchCanonicalPlatformName(canonical.toUpperCase()), canonical);
  }
});

test('parseCsvPlatformsField parses multi-platform PlatformName::URL|PlatformName2::URL2 with trimming and case-insensitive matching', () => {
  const res = parseCsvPlatformsField(
    '  prime video :: https://www.primevideo.com/detail/xyz  |  NETFLIX :: https://www.netflix.com/in/title/123  |  youtube (ani-one india) :: https://youtube.com/playlist?list=abc ',
    ['Tamil', 'Hindi']
  );

  assert.equal(res.partners.length, 3);
  assert.deepEqual(res.partners[0], {
    name: 'Prime Video',
    platform: 'Prime Video',
    url: 'https://www.primevideo.com/detail/xyz',
    languages: ['Tamil', 'Hindi'],
  });
  assert.deepEqual(res.partners[1], {
    name: 'Netflix',
    platform: 'Netflix',
    url: 'https://www.netflix.com/in/title/123',
    languages: ['Tamil', 'Hindi'],
  });
  assert.deepEqual(res.partners[2], {
    name: 'YouTube (Ani-One India)',
    platform: 'YouTube (Ani-One India)',
    url: 'https://youtube.com/playlist?list=abc',
    languages: ['Tamil', 'Hindi'],
  });
  assert.equal(res.platformString, 'Netflix|Prime Video|YouTube (Ani-One India)');
  assert.equal(res.primaryUrl, 'https://www.primevideo.com/detail/xyz');
});

test('parseCsvPlatformsField maintains backward compatibility for single-platform rows (with or without ::URL)', () => {
  const singleNameOnly = parseCsvPlatformsField('  crunchyroll  ', ['Hindi', 'Tamil']);
  assert.deepEqual(singleNameOnly.partners, [
    {
      name: 'Crunchyroll',
      platform: 'Crunchyroll',
      url: '',
      languages: ['Hindi', 'Tamil'],
    },
  ]);
  assert.equal(singleNameOnly.platformString, 'Crunchyroll');
  assert.equal(singleNameOnly.primaryUrl, '');

  const singleWithFallbackUrl = parseCsvPlatformsField(
    'jiohotstar',
    ['Tamil'],
    'https://www.hotstar.com/in/shows/example'
  );
  assert.deepEqual(singleWithFallbackUrl.partners, [
    {
      name: 'JioHotstar',
      platform: 'JioHotstar',
      url: 'https://www.hotstar.com/in/shows/example',
      languages: ['Tamil'],
    },
  ]);
  assert.equal(singleWithFallbackUrl.primaryUrl, 'https://www.hotstar.com/in/shows/example');

  const singleWithInlineUrl = parseCsvPlatformsField(
    '  Prime Video :: https://www.primevideo.com/detail/single  ',
    ['Hindi']
  );
  assert.deepEqual(singleWithInlineUrl.partners, [
    {
      name: 'Prime Video',
      platform: 'Prime Video',
      url: 'https://www.primevideo.com/detail/single',
      languages: ['Hindi'],
    },
  ]);
  assert.equal(singleWithInlineUrl.platformString, 'Prime Video');
  assert.equal(singleWithInlineUrl.primaryUrl, 'https://www.primevideo.com/detail/single');
});

test('parseCsvPlatformsField supports multi-platform names without URLs and mixed link/linkless entries', () => {
  const linklessMulti = parseCsvPlatformsField(
    '  prime video | NETFLIX | crunchyroll  ',
    ['Tamil', 'Hindi']
  );
  assert.deepEqual(linklessMulti.partners, [
    {
      name: 'Prime Video',
      platform: 'Prime Video',
      url: '',
      languages: ['Tamil', 'Hindi'],
    },
    {
      name: 'Netflix',
      platform: 'Netflix',
      url: '',
      languages: ['Tamil', 'Hindi'],
    },
    {
      name: 'Crunchyroll',
      platform: 'Crunchyroll',
      url: '',
      languages: ['Tamil', 'Hindi'],
    },
  ]);
  assert.equal(linklessMulti.platformString, 'Crunchyroll|Netflix|Prime Video');
  assert.equal(linklessMulti.primaryUrl, '');

  const mixedEntries = parseCsvPlatformsField(
    'Prime Video|Netflix::https://www.netflix.com/in/title/123|Crunchyroll',
    ['Hindi', 'Telugu']
  );
  assert.deepEqual(mixedEntries.partners, [
    {
      name: 'Prime Video',
      platform: 'Prime Video',
      url: '',
      languages: ['Hindi', 'Telugu'],
    },
    {
      name: 'Netflix',
      platform: 'Netflix',
      url: 'https://www.netflix.com/in/title/123',
      languages: ['Hindi', 'Telugu'],
    },
    {
      name: 'Crunchyroll',
      platform: 'Crunchyroll',
      url: '',
      languages: ['Hindi', 'Telugu'],
    },
  ]);
  assert.equal(mixedEntries.platformString, 'Crunchyroll|Netflix|Prime Video');
  assert.equal(mixedEntries.primaryUrl, 'https://www.netflix.com/in/title/123');
});

test('POST /api/admin/import-csv stores linkless multi-platform and mixed URL partners in D1 and GET /api/admin/pending hydrates them', async () => {
  const { token, publicPem } = createSignedClerkJwt('admin_multi_plat_csv', {
    email: 'admin@anidub.in',
    email_verified: true,
  });

  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      synopsis TEXT,
      cover_image TEXT NOT NULL,
      banner_image TEXT NOT NULL,
      rating REAL DEFAULT 0.0,
      episodes_count INTEGER DEFAULT 12,
      status TEXT DEFAULT 'Airing',
      airing_status TEXT DEFAULT 'Airing',
      season TEXT,
      year INTEGER DEFAULT 2026,
      genres TEXT NOT NULL,
      popularity INTEGER DEFAULT 0,
      languages TEXT DEFAULT 'Tamil, Hindi',
      platform TEXT DEFAULT 'Crunchyroll',
      type TEXT DEFAULT 'TV Series',
      studio TEXT DEFAULT 'Unknown Studio',
      submissionStatus TEXT DEFAULT 'approved',
      approval_status TEXT DEFAULT 'approved',
      is_published INTEGER DEFAULT 0,
      episodes_per_season TEXT DEFAULT '',
      mixedEntries TEXT DEFAULT '',
      watch_url TEXT DEFAULT '',
      platforms_data TEXT DEFAULT '[]',
      streaming_partners TEXT DEFAULT '[]',
      broadcast_day TEXT,
      broadcast_time TEXT,
      season_episode_count TEXT DEFAULT '',
      official_source_url TEXT DEFAULT ''
    );
  `);

  const d1Wrapper = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bindings = args;
          return this;
        },
        async first() {
          const stmt = sqlite.prepare(sql);
          return (
            (stmt.get(...(bindings as Array<string | number | null>)) as
              | Record<string, unknown>
              | undefined) ?? null
          );
        },
        async all() {
          const stmt = sqlite.prepare(sql);
          return { results: stmt.all(...(bindings as Array<string | number | null>)) };
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...(bindings as Array<string | number | null>));
          return { meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } };
        },
      };
    },
  };

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicPem,
    DB: d1Wrapper,
  };

  const importRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/import-csv', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        animeList: [
          {
            Title: 'Multi Platform No Links Anime',
            Languages: 'Tamil|Hindi',
            Genres: 'Action|Fantasy',
            Status: 'Completed',
            platforms: 'Prime Video|Netflix|Crunchyroll',
            Seasons: 'Season 1:12',
          },
          {
            Title: 'Mixed Platform Links Anime',
            Languages: 'Tamil|Telugu|Hindi',
            Genres: 'Action',
            Status: 'Airing',
            platforms: '  prime video | NETFLIX :: https://www.netflix.com/in/title/123 ',
          },
          {
            Title: 'Single Platform Legacy Row',
            Languages: 'Hindi|Tamil',
            Genres: 'Adventure',
            Status: 'Airing',
            platforms: '',
            Platform: 'crunchyroll',
          },
          {
            Title: 'Single Platform With URL Row',
            Languages: 'Tamil',
            Genres: 'Sci-Fi',
            Status: 'Completed',
            platforms: 'jiohotstar::https://www.hotstar.com/in/shows/sample',
          },
        ],
      }),
    }),
    env,
  });

  assert.equal(importRes.status, 200);
  const importBody = (await importRes.json()) as Record<string, unknown>;
  assert.equal(importBody.success, true);
  assert.equal(importBody.insertedCount, 4);

  const pendingRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/pending', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
    env,
  });
  assert.equal(pendingRes.status, 200);
  const pendingBody = (await pendingRes.json()) as {
    success: boolean;
    data: Array<Record<string, unknown>>;
  };
  assert.equal(pendingBody.success, true);
  assert.equal(pendingBody.data.length, 4);

  const linklessRow = pendingBody.data.find((r) => r.title === 'Multi Platform No Links Anime');
  assert.ok(linklessRow, 'Linkless multi-platform row should be present in pending queue');
  assert.equal(linklessRow.platform, 'Crunchyroll|Netflix|Prime Video');
  assert.equal(linklessRow.watch_url, '');
  assert.equal(linklessRow.official_source_url, '');
  assert.deepEqual(linklessRow.streaming_partners, [
    { name: 'Prime Video', platform: 'Prime Video', url: '', languages: ['Tamil', 'Hindi'] },
    { name: 'Netflix', platform: 'Netflix', url: '', languages: ['Tamil', 'Hindi'] },
    { name: 'Crunchyroll', platform: 'Crunchyroll', url: '', languages: ['Tamil', 'Hindi'] },
  ]);
  assert.deepEqual(linklessRow.platforms_data, linklessRow.streaming_partners);

  const mixedRow = pendingBody.data.find((r) => r.title === 'Mixed Platform Links Anime');
  assert.ok(mixedRow, 'Mixed link/linkless row should be present in pending queue');
  assert.equal(mixedRow.platform, 'Netflix|Prime Video');
  assert.equal(mixedRow.watch_url, 'https://www.netflix.com/in/title/123');
  assert.equal(mixedRow.official_source_url, 'https://www.netflix.com/in/title/123');
  assert.deepEqual(mixedRow.streaming_partners, [
    {
      name: 'Prime Video',
      platform: 'Prime Video',
      url: '',
      languages: ['Tamil', 'Telugu', 'Hindi'],
    },
    {
      name: 'Netflix',
      platform: 'Netflix',
      url: 'https://www.netflix.com/in/title/123',
      languages: ['Tamil', 'Telugu', 'Hindi'],
    },
  ]);

  const singleLegacyRow = pendingBody.data.find((r) => r.title === 'Single Platform Legacy Row');
  assert.ok(singleLegacyRow, 'Single-platform legacy row should be present');
  assert.equal(singleLegacyRow.platform, 'Crunchyroll');
  assert.deepEqual(singleLegacyRow.streaming_partners, [
    {
      name: 'Crunchyroll',
      platform: 'Crunchyroll',
      url: '',
      languages: ['Hindi', 'Tamil'],
    },
  ]);

  const singleUrlRow = pendingBody.data.find((r) => r.title === 'Single Platform With URL Row');
  assert.ok(singleUrlRow, 'Single-platform URL row should be present');
  assert.equal(singleUrlRow.platform, 'JioHotstar');
  assert.equal(singleUrlRow.watch_url, 'https://www.hotstar.com/in/shows/sample');
  assert.deepEqual(singleUrlRow.streaming_partners, [
    {
      name: 'JioHotstar',
      platform: 'JioHotstar',
      url: 'https://www.hotstar.com/in/shows/sample',
      languages: ['Tamil'],
    },
  ]);

  sqlite.close();
});

test('AdminDashboard and AdminCsvHelpModal templates default to Prime Video|Netflix and document optional ::URL', () => {
  const dashboardSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/AdminDashboard.tsx'),
    'utf-8'
  );
  const helpModalSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/admin/AdminCsvHelpModal.tsx'),
    'utf-8'
  );

  assert.ok(
    dashboardSrc.includes(',Prime Video|Netflix,'),
    'AdminDashboard CSV template/snippet should default to Prime Video|Netflix format'
  );
  assert.ok(
    helpModalSrc.includes('Prime Video|Netflix'),
    'AdminCsvHelpModal should show simpler Prime Video|Netflix format by default'
  );
  assert.ok(
    helpModalSrc.includes('Prime Video|Netflix::https://...'),
    'AdminCsvHelpModal should document optional ::URL mixed syntax'
  );
});
