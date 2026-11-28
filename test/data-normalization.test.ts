import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/[[route]].ts';
import {
  buildStreamingPartnersPayload,
  resolveAnimeStreamingPartners,
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
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  return { token: `${unsigned}.${signature}`, publicPem: publicKey };
}

test('POST /api/admin/import-csv preserves null season/episodes when omitted and normalizes platforms', async () => {
  const { token, publicPem } = createSignedClerkJwt('admin_user_1', {
    email: 'admin@anidub.in',
    email_verified: true,
  });

  const insertedRows: Array<Record<string, unknown>> = [];
  const mockDb = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bindings = args;
          return this;
        },
        async all() {
          if (sql.includes('SELECT title, slug FROM anime')) {
            return { results: [] };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO anime')) {
            // Column order in adminRoutes import-csv bind():
            // 0:title, 1:slug, 2:synopsis, 3:cover_image, 4:banner_image, 5:rating, 6:episodes_count, 7:status, 8:airing_status,
            // 9:season, 10:year, 11:genres, 12:languages, 13:platform, 14:type, 15:studio, 16:episodes_per_season, 17:mixedEntries
            insertedRows.push({
              title: bindings[0],
              slug: bindings[1],
              episodes_count: bindings[6],
              season: bindings[9],
              platform: bindings[13],
              episodes_per_season: bindings[16],
            });
          }
          return { meta: { last_row_id: insertedRows.length } };
        },
        async first() {
          return null;
        },
      };
    },
  };

  const res = await onRequest({
    request: new Request('https://anidub.in/api/admin/import-csv', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        animeList: [
          {
            Title: 'No Defaults Anime',
            Platform: 'JioHotstar | Crunchyroll',
          },
          {
            Title: 'Explicit Metadata Anime',
            Season: 'Winter',
            Episodes: '24',
            Platform: 'Netflix, Crunchyroll, Prime Video',
          },
          {
            Title: 'Derived Seasons Total Anime',
            Seasons: 'Season 1:12|Season 2:13',
            Platform: 'Crunchyroll',
          },
        ],
      }),
    }),
    env: {
      ADMIN_EMAIL: 'admin@anidub.in',
      CLERK_JWT_KEY: publicPem,
      DB: mockDb,
    },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.success, true);
  assert.equal(body.insertedCount, 3);

  assert.equal(insertedRows[0].title, 'No Defaults Anime');
  assert.equal(insertedRows[0].season, null, 'Omitted Season must store null, never Spring');
  assert.equal(insertedRows[0].episodes_count, null, 'Omitted Episodes must store null, never 12');
  assert.equal(insertedRows[0].episodes_per_season, '', 'Omitted episodes_per_season must stay empty');
  assert.equal(insertedRows[0].platform, 'Crunchyroll|JioHotstar');

  assert.equal(insertedRows[1].title, 'Explicit Metadata Anime');
  assert.equal(insertedRows[1].season, 'Winter');
  assert.equal(insertedRows[1].episodes_count, 24);
  assert.equal(insertedRows[1].platform, 'Crunchyroll|Netflix|Prime Video');

  assert.equal(insertedRows[2].title, 'Derived Seasons Total Anime');
  assert.equal(insertedRows[2].season, null);
  assert.equal(insertedRows[2].episodes_count, 25);
  assert.equal(insertedRows[2].episodes_per_season, '12|13');
});

test('POST /api/admin/import-csv checks duplicates ONLY by case-insensitive D1 title and ignores slug/watch_url', async () => {
  const { token, publicPem } = createSignedClerkJwt('admin_csv_dedup_1', {
    email: 'admin@anidub.in',
    email_verified: true,
  });

  const existingDbRows = [
    { id: 1, title: 'Solo Leveling', slug: 'solo-leveling', watch_url: 'https://watch.example/solo' },
    { id: 2, title: 'Dr. Stone', slug: 'dr-stone', watch_url: 'https://watch.example/dr-stone' },
  ];

  const executedQueries: string[] = [];
  const insertedTitles: string[] = [];
  const insertedSlugs: string[] = [];

  const mockDb = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bindings = args;
          return this;
        },
        async first() {
          executedQueries.push(sql);
          if (sql.includes('SELECT id FROM anime WHERE LOWER(title) = LOWER(?)')) {
            const target = String(bindings[0] ?? '').toLowerCase();
            const match = existingDbRows.find((r) => r.title.toLowerCase() === target);
            return match ? { id: match.id } : null;
          }
          return null;
        },
        async all() {
          executedQueries.push(sql);
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO anime')) {
            const title = String(bindings[0]);
            const slug = String(bindings[1]);
            if (existingDbRows.some((r) => r.slug === slug)) {
              throw new Error('UNIQUE constraint failed: anime.slug');
            }
            existingDbRows.push({ id: existingDbRows.length + 1, title, slug, watch_url: '' });
            insertedTitles.push(title);
            insertedSlugs.push(slug);
          }
          return { meta: { last_row_id: existingDbRows.length } };
        },
      };
    },
  };

  const res = await onRequest({
    request: new Request('https://anidub.in/api/admin/import-csv', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        animeList: [
          { Title: 'solo leveling', slug: 'different-slug', watch_url: 'https://watch.example/other' }, // case-insensitive duplicate of Solo Leveling -> skip
          { Title: 'Dr Stone', slug: 'dr-stone', watch_url: 'https://watch.example/dr-stone' }, // different title, same slug & watch_url -> MUST insert!
          { Title: 'Brand New Anime', slug: 'solo-leveling', watch_url: 'https://watch.example/solo' }, // different title, matching slug & watch_url -> MUST insert!
          { Title: 'brand new anime' }, // duplicate within same CSV batch -> skip
        ],
      }),
    }),
    env: {
      ADMIN_EMAIL: 'admin@anidub.in',
      CLERK_JWT_KEY: publicPem,
      DB: mockDb,
    },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.success, true);
  assert.equal(body.insertedCount, 2);
  assert.equal(body.skippedCount, 2);
  assert.deepEqual(body.skippedTitles, ['solo leveling', 'brand new anime']);
  assert.deepEqual(body.duplicates, ['solo leveling', 'brand new anime']);
  assert.deepEqual(insertedTitles, ['Dr Stone', 'Brand New Anime']);
  assert.ok(insertedSlugs[0].startsWith('dr-stone-'), 'Slug collision should disambiguate slug instead of rejecting non-duplicate title');
  assert.ok(
    executedQueries.some((q) => q.includes('SELECT id FROM anime WHERE LOWER(title) = LOWER(?)')),
    'Must query D1 with case-insensitive title-only check'
  );
  assert.equal(
    executedQueries.some((q) => q.includes('slug') && q.trim().toUpperCase().startsWith('SELECT')),
    false,
    'Must NOT query slug to determine duplicates'
  );
});

test('POST /api/anime and PUT /api/anime/:id normalize platform strings and avoid hardcoded Spring/12', async () => {
  const { token, publicPem } = createSignedClerkJwt('admin_user_2', {
    email: 'admin@anidub.in',
    email_verified: true,
  });

  let createdParams: unknown[] = [];
  let updatedParams: unknown[] = [];

  const mockDb = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bindings = args;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO anime')) {
            createdParams = bindings;
            return { meta: { last_row_id: 101 } };
          }
          if (sql.includes('UPDATE anime SET')) {
            updatedParams = bindings;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        async first() {
          return null;
        },
      };
    },
  };

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicPem,
    DB: mockDb,
  };

  const createRes = await onRequest({
    request: new Request('https://anidub.in/api/anime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Platform Sort Test',
        platform: 'SonyLIV | Crunchyroll | JioHotstar',
      }),
    }),
    env,
  });
  assert.equal(createRes.status, 201);
  // episodes_count index 6, season index 9, platform index 14
  assert.equal(createdParams[6], null);
  assert.equal(createdParams[9], null);
  assert.equal(createdParams[14], 'Crunchyroll|JioHotstar|SonyLIV');

  const updateRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/101', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform: 'Netflix | Crunchyroll | netflix',
      }),
    }),
    env,
  });
  assert.equal(updateRes.status, 200);
  const updateBody = (await updateRes.json()) as Record<string, unknown>;
  assert.equal(updateBody.platform, 'Crunchyroll|Netflix');
  // In UPDATE bind order: title(0), synopsis(1), cover(2), banner(3), rating(4), episodes_count(5), status(6),
  // submissionStatus(7), season(8), year(9), genres(10), languages(11), platform(12)
  assert.equal(updatedParams[12], 'Crunchyroll|Netflix');
});

test('/api/admin/normalize-platforms enforces admin auth and updates only non-normalized rows', async () => {
  const adminJwt = createSignedClerkJwt('admin_norm_1', {
    email: 'admin@anidub.in',
    email_verified: true,
  });
  const guestJwt = createSignedClerkJwt('guest_user_1', {
    email: 'guest@example.com',
    email_verified: true,
  });

  const rows = [
    { id: 1, platform: 'JioHotstar|Crunchyroll' },
    { id: 2, platform: 'Crunchyroll|JioHotstar' },
    { id: 3, platform: '  Netflix | Ani-One , Crunchyroll ' },
    { id: 4, platform: null },
    { id: 5, platform: '' },
  ];

  const mockDb = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bindings = args;
          return this;
        },
        async all() {
          if (sql.includes('SELECT id, platform FROM anime')) {
            return { results: rows.map((r) => ({ ...r })) };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('UPDATE anime SET platform = ? WHERE id = ?')) {
            const target = rows.find((r) => r.id === bindings[1]);
            if (target) target.platform = String(bindings[0]);
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
    },
  };

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: adminJwt.publicPem,
    DB: mockDb,
  };

  // 1. Unauthenticated -> 401
  const unauthRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/normalize-platforms', { method: 'POST' }),
    env,
  });
  assert.equal(unauthRes.status, 401);

  // 2. Non-admin -> 403
  const forbiddenRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/normalize-platforms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${guestJwt.token}` },
    }),
    env: {
      ADMIN_EMAIL: 'admin@anidub.in',
      CLERK_JWT_KEY: guestJwt.publicPem,
      DB: mockDb,
    },
  });
  assert.equal(forbiddenRes.status, 403);

  // 3. Admin execution -> normalizes inconsistent rows
  const okRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/normalize-platforms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminJwt.token}` },
    }),
    env,
  });
  assert.equal(okRes.status, 200);
  const okBody = (await okRes.json()) as Record<string, unknown>;
  assert.equal(okBody.success, true);
  assert.equal(okBody.totalScanned, 5);
  assert.equal(okBody.updatedCount, 2);
  assert.equal(okBody.unchangedCount, 3);
  assert.equal(rows[0].platform, 'Crunchyroll|JioHotstar');
  assert.equal(rows[1].platform, 'Crunchyroll|JioHotstar');
  assert.equal(rows[2].platform, 'Ani-One|Crunchyroll|Netflix');
  assert.equal(rows[3].platform, null);
  assert.equal(rows[4].platform, '');
});

test('POST, PUT, and GET /api/anime store and retrieve nested per-platform language arrays', async () => {
  const { token, publicPem } = createSignedClerkJwt('admin_platform_langs_1', {
    email: 'admin@anidub.in',
    email_verified: true,
  });

  const dbRow: Record<string, unknown> = {
    id: 501,
    title: 'Cyberpunk: Edgerunners',
    slug: 'cyberpunk-edgerunners',
    synopsis: 'Night City legend.',
    cover_image: 'https://i.ibb.co/example/poster.jpg',
    banner_image: 'https://i.ibb.co/example/poster.jpg',
    rating: 8.6,
    episodes_count: 10,
    status: 'Completed',
    submissionStatus: 'approved',
    is_published: 1,
    year: 2022,
    genres: 'Action, Sci-Fi',
    languages: '',
    platform: '',
    platforms_data: '',
    watch_url: '',
  };

  const mockDb = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bindings = args;
          return this;
        },
        async first() {
          if (sql.includes('SELECT COUNT(*) as total')) {
            return { total: 1 };
          }
          if (sql.includes('SELECT * FROM anime WHERE')) {
            return { ...dbRow };
          }
          return null;
        },
        async all() {
          if (sql.includes('SELECT * FROM anime')) {
            return { results: [{ ...dbRow }] };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO anime')) {
            dbRow.title = bindings[0];
            dbRow.languages = bindings[13];
            dbRow.platform = bindings[14];
            dbRow.platforms_data = bindings[16];
            dbRow.watch_url = bindings[17];
            return { meta: { last_row_id: 501 } };
          }
          if (sql.includes('UPDATE anime SET')) {
            dbRow.languages = bindings[11];
            dbRow.platform = bindings[12];
            dbRow.platforms_data = bindings[16];
            dbRow.watch_url = bindings[18];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
    },
  };

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicPem,
    DB: mockDb,
  };

  // 1. POST /api/anime stores nested per-platform languages JSON
  const createRes = await onRequest({
    request: new Request('https://anidub.in/api/anime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Cyberpunk: Edgerunners',
        streaming_partners: [
          { platform: 'Netflix', url: 'https://www.netflix.com/title/81054853', languages: ['Hindi', 'English'] },
          { platform: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/test', languages: ['Tamil', 'Telugu'] },
        ],
      }),
    }),
    env,
  });

  assert.equal(createRes.status, 201);
  const createBody = (await createRes.json()) as Record<string, unknown>;
  assert.equal(createBody.platform, 'Crunchyroll|Netflix');
  assert.equal(createBody.languages, 'Hindi, English, Tamil, Telugu');
  const storedJson = JSON.parse(String(dbRow.platforms_data)) as Array<Record<string, unknown>>;
  assert.equal(storedJson.length, 2);
  assert.deepEqual(storedJson[0], {
    name: 'Netflix',
    platform: 'Netflix',
    url: 'https://www.netflix.com/title/81054853',
    languages: ['Hindi', 'English'],
  });
  assert.deepEqual(storedJson[1], {
    name: 'Crunchyroll',
    platform: 'Crunchyroll',
    url: 'https://www.crunchyroll.com/series/test',
    languages: ['Tamil', 'Telugu'],
  });

  // 2. GET /api/anime & GET /api/anime/:id retrieve parsed per-platform language arrays
  const listRes = await onRequest({
    request: new Request('https://anidub.in/api/anime'),
    env,
  });
  assert.equal(listRes.status, 200);
  const listBody = (await listRes.json()) as { data: Array<Record<string, unknown>> };
  assert.deepEqual(listBody.data[0].streaming_partners, storedJson);
  assert.deepEqual(listBody.data[0].platforms_data, storedJson);

  const detailRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/501'),
    env,
  });
  assert.equal(detailRes.status, 200);
  const detailBody = (await detailRes.json()) as Record<string, unknown>;
  assert.deepEqual(detailBody.streaming_partners, storedJson);
  assert.deepEqual(detailBody.platforms_data, storedJson);

  // 3. PUT /api/anime/:id updates per-platform languages & derives aggregate languages
  const updateRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/501', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platforms_data: [
          { platform: 'Netflix', url: 'https://www.netflix.com/title/81054853', languages: ['Hindi', 'Malayalam'] },
        ],
      }),
    }),
    env,
  });
  assert.equal(updateRes.status, 200);
  const updateBody = (await updateRes.json()) as Record<string, unknown>;
  assert.equal(updateBody.platform, 'Netflix');
  assert.equal(updateBody.languages, 'Hindi, Malayalam');
  assert.deepEqual(updateBody.platforms_data, [
    {
      name: 'Netflix',
      platform: 'Netflix',
      url: 'https://www.netflix.com/title/81054853',
      languages: ['Hindi', 'Malayalam'],
    },
  ]);
});

test('POST /api/admin/import-csv executes cleanly on SQLite schema without UNIQUE(title) and skips case-insensitive duplicates', async () => {
  const { token, publicPem } = createSignedClerkJwt('admin_sqlite_csv_1', {
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
      season TEXT DEFAULT 'Spring',
      year INTEGER DEFAULT 2026,
      genres TEXT NOT NULL,
      popularity INTEGER DEFAULT 0,
      languages TEXT DEFAULT 'HIN,TAM,TEL',
      platform TEXT DEFAULT 'Crunchyroll',
      type TEXT DEFAULT 'TV Series',
      studio TEXT DEFAULT 'Unknown Studio',
      submissionStatus TEXT DEFAULT 'approved',
      approval_status TEXT DEFAULT 'approved',
      is_published INTEGER DEFAULT 0,
      episodes_per_season TEXT DEFAULT '',
      mixedEntries TEXT DEFAULT ''
    );
  `);

  sqlite
    .prepare(
      `INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, genres)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run('Solo Leveling', 'solo-leveling', 'Arise.', '/logo.png', '/logo.png', 'Action');

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
          return (stmt.get(...(bindings as Array<string | number | null>)) as Record<string, unknown> | undefined) ?? null;
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

  const adminRoutesSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/adminRoutes.ts'), 'utf-8');
  assert.equal(adminRoutesSrc.includes('ON CONFLICT(title)'), false, 'ON CONFLICT(title) must not exist in adminRoutes.ts');

  const res = await onRequest({
    request: new Request('https://anidub.in/api/admin/import-csv', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        animeList: [
          { Title: 'solo leveling', Platform: 'Crunchyroll' },
          { Title: 'New Dubbed Series', Platform: 'Netflix', Languages: 'Hindi|English' },
        ],
      }),
    }),
    env: {
      ADMIN_EMAIL: 'admin@anidub.in',
      CLERK_JWT_KEY: publicPem,
      DB: d1Wrapper,
    },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.success, true);
  assert.equal(body.insertedCount, 1);
  assert.equal(body.skippedCount, 1);
  assert.deepEqual(body.skippedTitles, ['solo leveling']);

  const allRows = sqlite.prepare('SELECT title, slug FROM anime ORDER BY id ASC').all() as Array<{
    title: string;
    slug: string;
  }>;
  assert.equal(allRows.length, 2);
  assert.equal(allRows[1].title, 'New Dubbed Series');
  sqlite.close();
});

test('buildStreamingPartnersPayload auto-syncs single platform from global languages and keeps multi-platform languages independent', () => {
  // 1. Single platform: auto-syncs global Mixed Entries languages even if platform had stale/empty array
  const singleResult = buildStreamingPartnersPayload(
    [{ name: 'Netflix', url: 'https://www.netflix.com/title/123', languages: ['English'] }],
    ['Tamil', 'Hindi', 'Telugu']
  );
  assert.equal(singleResult.serializedPartners.length, 1);
  assert.deepEqual(singleResult.serializedPartners[0], {
    name: 'Netflix',
    platform: 'Netflix',
    url: 'https://www.netflix.com/title/123',
    languages: ['Tamil', 'Hindi', 'Telugu'],
  });
  assert.deepEqual(singleResult.derivedGlobalDubs, ['Tamil', 'Hindi', 'Telugu']);

  // 2. Multiple platforms (2+): preserves each platform's own selected languages
  const multiResult = buildStreamingPartnersPayload(
    [
      { name: 'Netflix', url: 'https://www.netflix.com/title/123', languages: ['Hindi', 'English'] },
      { name: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/123', languages: ['Tamil', 'Telugu'] },
    ],
    ['Tamil', 'Hindi']
  );
  assert.equal(multiResult.serializedPartners.length, 2);
  assert.deepEqual(multiResult.serializedPartners[0].languages, ['Hindi', 'English']);
  assert.deepEqual(multiResult.serializedPartners[1].languages, ['Tamil', 'Telugu']);
  assert.deepEqual(multiResult.derivedGlobalDubs, ['Hindi', 'English', 'Tamil', 'Telugu']);
});

test('DubInfoModal conditionally renders per-platform languages only when 2+ platforms exist and uses dynamic platform label', () => {
  const modalSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/DubInfoModal.tsx'), 'utf-8');
  assert.ok(
    modalSrc.includes('{streamingPartners.length > 1 && ('),
    'Per-platform language checkboxes must be hidden when only 1 platform exists'
  );
  assert.ok(
    modalSrc.includes('Languages on {activePlatformLabel}'),
    'Per-platform label must dynamically reflect the selected platform name'
  );
});

test('resolveAnimeStreamingPartners pre-fills OTT links across all D1 schemas (streaming_partners="[]", platforms_data, watch_url, official_source_url, streamingLinks, platform_links)', () => {
  // 1. Multi-platform Attack on Titan row where D1 streaming_partners is "[]" while platforms_data holds the 3 partner URLs
  const aotPartners = resolveAnimeStreamingPartners(
    {
      title: 'Attack on Titan',
      platform: 'Anime Times|Crunchyroll|JioHotstar',
      languages: 'Hindi, Tamil, Telugu',
      streaming_partners: '[]',
      platforms_data: JSON.stringify([
        {
          name: 'Anime Times',
          url: 'https://www.primevideo.com/detail/aot-anime-times',
          languages: ['Hindi'],
        },
        {
          name: 'Crunchyroll',
          url: 'https://www.crunchyroll.com/series/GR751KNZY/attack-on-titan',
          languages: ['Hindi', 'Tamil', 'Telugu'],
        },
        {
          name: 'JioHotstar',
          url: 'https://www.hotstar.com/in/shows/attack-on-titan/1260000001',
          languages: ['Hindi'],
        },
      ]),
    },
    { defaultWhenEmpty: true, includePlatformNamesFallback: true }
  );

  assert.equal(aotPartners.length, 3);
  assert.equal(aotPartners[0].name, 'Anime Times');
  assert.equal(aotPartners[0].url, 'https://www.primevideo.com/detail/aot-anime-times');
  assert.deepEqual(aotPartners[0].languages, ['Hindi']);
  assert.equal(aotPartners[1].name, 'Crunchyroll');
  assert.equal(
    aotPartners[1].url,
    'https://www.crunchyroll.com/series/GR751KNZY/attack-on-titan'
  );
  assert.deepEqual(aotPartners[1].languages, ['Hindi', 'Tamil', 'Telugu']);
  assert.equal(aotPartners[2].name, 'JioHotstar');
  assert.equal(
    aotPartners[2].url,
    'https://www.hotstar.com/in/shows/attack-on-titan/1260000001'
  );

  // 2. Single-platform Haikyu!! row where platforms_data has url: "" while official_source_url / watch_url holds the link
  const haikyuPartners = resolveAnimeStreamingPartners(
    {
      title: 'Haikyu!!',
      platform: 'Crunchyroll',
      languages: 'Hindi, Tamil, Telugu',
      streaming_partners: '[]',
      platforms_data: JSON.stringify([{ name: 'Crunchyroll', url: '', languages: [] }]),
      watch_url: '',
      official_source_url: 'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu',
    },
    { defaultWhenEmpty: true, includePlatformNamesFallback: true }
  );
  assert.equal(haikyuPartners.length, 1);
  assert.equal(haikyuPartners[0].name, 'Crunchyroll');
  assert.equal(haikyuPartners[0].url, 'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu');
  assert.deepEqual(haikyuPartners[0].languages, ['Hindi', 'Tamil', 'Telugu']);

  // 3. Welcome to Demon School! Iruma-kun row where links are stored in streamingLinks / watchLink / { platform, link }
  const irumaPartners = resolveAnimeStreamingPartners(
    {
      title: 'Welcome to Demon School! Iruma-kun',
      platform: 'Crunchyroll',
      languages: 'Hindi, Tamil',
      streaming_partners: [],
      platform_links: JSON.stringify([
        {
          platform: 'Crunchyroll',
          link: 'https://www.crunchyroll.com/series/G6NVG970Y/welcome-to-demon-school-iruma-kun',
        },
      ]),
    },
    { defaultWhenEmpty: true, includePlatformNamesFallback: true }
  );
  assert.equal(irumaPartners.length, 1);
  assert.equal(irumaPartners[0].name, 'Crunchyroll');
  assert.equal(
    irumaPartners[0].url,
    'https://www.crunchyroll.com/series/G6NVG970Y/welcome-to-demon-school-iruma-kun'
  );
  assert.deepEqual(irumaPartners[0].languages, ['Hindi', 'Tamil']);
});

test('GET /api/anime, GET /api/anime/:id, and PUT /api/anime/:id preserve D1 OTT links when streaming_partners defaults to "[]"', async () => {
  const { token, publicPem } = createSignedClerkJwt('admin_ott_links_fix', {
    email: 'admin@anidub.in',
    email_verified: true,
  });

  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      synopsis TEXT DEFAULT '',
      cover_image TEXT DEFAULT '/logo.png',
      banner_image TEXT DEFAULT '/logo.png',
      rating REAL DEFAULT 8.5,
      episodes_count INTEGER DEFAULT 25,
      status TEXT DEFAULT 'Completed',
      airing_status TEXT DEFAULT 'Completed',
      submissionStatus TEXT DEFAULT 'approved',
      approval_status TEXT DEFAULT 'approved',
      is_published INTEGER DEFAULT 1,
      season TEXT DEFAULT 'Spring',
      year INTEGER DEFAULT 2014,
      genres TEXT DEFAULT 'Sports',
      popularity INTEGER DEFAULT 100,
      languages TEXT DEFAULT 'Hindi, Tamil, Telugu',
      platform TEXT DEFAULT 'Crunchyroll',
      type TEXT DEFAULT 'TV Series',
      studio TEXT DEFAULT 'Production I.G',
      episodes_per_season TEXT DEFAULT '25',
      mixedEntries TEXT DEFAULT '',
      mixed_entries TEXT DEFAULT '',
      watch_url TEXT DEFAULT '',
      platforms_data TEXT DEFAULT '[]',
      streaming_partners TEXT DEFAULT '[]',
      broadcast_day TEXT DEFAULT NULL,
      broadcast_time TEXT DEFAULT NULL,
      season_episode_count TEXT DEFAULT '1 Season • 25 Episodes',
      official_source_url TEXT DEFAULT '',
      last_verified_at TEXT DEFAULT '2026-03-01',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT NOT NULL
    );
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      user_id TEXT,
      user_name TEXT,
      user_avatar TEXT,
      rating INTEGER,
      language TEXT,
      comment TEXT,
      is_spoiler INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert Haikyu!! with streaming_partners = '[]' (D1 column default) and link in platforms_data + official_source_url
  sqlite
    .prepare(
      `INSERT INTO anime (id, title, slug, platform, languages, streaming_partners, platforms_data, watch_url, official_source_url)
       VALUES (1, 'Haikyu!!', 'haikyu', 'Crunchyroll', 'Hindi, Tamil, Telugu', '[]', ?, 'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu', 'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu')`
    )
    .run(
      JSON.stringify([
        {
          name: 'Crunchyroll',
          platform: 'Crunchyroll',
          url: 'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu',
          languages: ['Hindi', 'Tamil', 'Telugu'],
        },
      ])
    );

  const d1Adapter = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bound = args;
          return this;
        },
        async first() {
          const stmt = sqlite.prepare(sql);
          return (stmt.get(...(bound as Array<string | number | null>)) as Record<string, unknown>) || null;
        },
        async all() {
          const stmt = sqlite.prepare(sql);
          return {
            results: (stmt.all(...(bound as Array<string | number | null>)) as Array<Record<string, unknown>>) || [],
          };
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...(bound as Array<string | number | null>));
          return {
            meta: {
              changes: Number(info.changes ?? 0),
              last_row_id: Number(info.lastInsertRowid ?? 0),
            },
          };
        },
      };
    },
  };

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicPem,
    DB: d1Adapter,
  };

  // 1. GET /api/anime returns non-empty streaming_partners and platforms_data with URL intact
  const catalogRes = await onRequest({
    request: new Request('https://anidub.in/api/anime?includePending=true', {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env,
  });
  assert.equal(catalogRes.status, 200);
  const catalogJson = (await catalogRes.json()) as { data: Array<Record<string, any>> };
  assert.equal(catalogJson.data.length, 1);
  assert.equal(
    catalogJson.data[0].streaming_partners[0].url,
    'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu'
  );

  // 2. GET /api/anime/1 returns the full streaming_partners and platforms_data URLs
  const detailRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/1', {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env,
  });
  assert.equal(detailRes.status, 200);
  const detailJson = (await detailRes.json()) as Record<string, any>;
  assert.equal(
    detailJson.streaming_partners[0].url,
    'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu'
  );
  assert.equal(
    detailJson.platforms_data[0].url,
    'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu'
  );

  // 3. Non-destructive PUT /api/anime/1: updating rating with empty partner URL preserves existing D1 link
  const putRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/1', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Haikyu!!',
        rating: 8.9,
        streaming_partners: [{ name: 'Crunchyroll', url: '', languages: ['Hindi', 'Tamil', 'Telugu'] }],
        watch_url: '',
        official_source_url: '',
      }),
    }),
    env,
  });
  assert.equal(putRes.status, 200);
  const putJson = (await putRes.json()) as Record<string, any>;
  assert.equal(
    putJson.platforms_data[0].url,
    'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu'
  );
  assert.equal(putJson.watch_url, 'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu');
  assert.equal(
    putJson.official_source_url,
    'https://www.crunchyroll.com/series/GY8VM8MWY/haikyu'
  );

  sqlite.close();
});

