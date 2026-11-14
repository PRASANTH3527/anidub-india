import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { onRequest } from '../functions/api/[[route]].ts';

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
