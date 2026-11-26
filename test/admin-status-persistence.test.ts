import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/[[route]]';

function createSignedAdminJwt() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'admin_status_test_1',
      sid: 'sess_admin_status_test_1',
      azp: 'https://anidub.in',
      email: 'admin@anidub.in',
      email_verified: true,
      exp: now + 3600,
      iat: now - 10,
      nbf: now - 10,
    })
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  return { token: `${signingInput}.${sig}`, publicPem: publicKey };
}

function createSqliteD1Wrapper(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          bound = params;
          return stmt;
        },
        async first<T = Record<string, unknown>>() {
          const row = db.prepare(sql).get(...(bound as any[]));
          return (row as T | undefined) ?? null;
        },
        async all<T = Record<string, unknown>>() {
          const rows = db.prepare(sql).all(...(bound as any[]));
          return { results: rows as T[] };
        },
        async run() {
          const res = db.prepare(sql).run(...(bound as any[]));
          return {
            meta: {
              changes: Number(res.changes || 0),
              last_row_id: Number(res.lastInsertRowid || 0),
            },
          };
        },
      };
      return stmt;
    },
  };
}

function createMigratedSqliteDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

test('Admin Edit Anime Info: changing Airing -> Completed persists in D1, clears airing fields, and reloads as Completed', async () => {
  const db = createMigratedSqliteDb();
  const { token, publicPem } = createSignedAdminJwt();

  // Seed an Airing anime with active schedule & airing metadata
  db.prepare(
    `INSERT INTO anime (
      id, title, slug, synopsis, cover_image, banner_image, rating, episodes_count,
      status, airing_status, season, year, genres, popularity, languages, platform,
      type, studio, broadcast_day, broadcast_time, is_published, submissionStatus, approval_status
    ) VALUES (
      501, 'Solo Leveling', 'solo-leveling', 'Hunter rises.', 'https://cdn.anidub.in/sl.jpg',
      'https://cdn.anidub.in/sl-b.jpg', 8.5, 25, 'Airing', 'Airing', 'Season 2', 2025,
      'Action, Fantasy', 120, 'Tamil, Hindi', 'Crunchyroll', 'TV Series', 'A-1 Pictures',
      'Saturday', '10:00 PM IST', 1, 'approved', 'approved'
    )`
  ).run();

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicPem,
    DB: createSqliteD1Wrapper(db),
  };

  // 1. Admin saves Edit Anime Info modal changing Status from Airing -> Completed
  const putRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/501', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Solo Leveling',
        status: 'Completed',
        airing_status: 'Completed',
        broadcast_day: null,
        broadcast_time: null,
        season: null,
        current_season: null,
        live_episode: null,
      }),
    }),
    env,
  } as any);

  assert.equal(putRes.status, 200);
  assert.equal(putRes.headers.get('Cache-Control'), 'no-store');
  const putJson = (await putRes.json()) as Record<string, unknown>;
  assert.equal(putJson.success, true);
  assert.equal(putJson.status, 'Completed');
  assert.equal(putJson.airing_status, 'Completed');
  assert.equal(putJson.broadcast_day, null);
  assert.equal(putJson.broadcast_time, null);
  assert.equal(putJson.season, null);

  // 2. Inspect D1 directly: BOTH status and airing_status must be 'Completed' and schedule fields cleared
  const rawRow = db
    .prepare('SELECT status, airing_status, broadcast_day, broadcast_time, season FROM anime WHERE id = 501')
    .get() as Record<string, unknown>;
  assert.equal(rawRow.status, 'Completed');
  assert.equal(rawRow.airing_status, 'Completed');
  assert.equal(rawRow.broadcast_day, null);
  assert.equal(rawRow.broadcast_time, null);
  assert.equal(rawRow.season, null);

  // 3. Reload via GET /api/anime?fresh=1&_t=... (Admin reload path)
  const freshCatalogRes = await onRequest({
    request: new Request('https://anidub.in/api/anime?page=1&limit=100&fresh=1&_t=1700000000000'),
    env,
  } as any);
  assert.equal(freshCatalogRes.status, 200);
  assert.equal(freshCatalogRes.headers.get('Cache-Control'), 'no-store');
  const freshCatalogJson = (await freshCatalogRes.json()) as { data: Record<string, unknown>[] };
  assert.equal(freshCatalogJson.data.length, 1);
  assert.equal(freshCatalogJson.data[0].status, 'Completed');
  assert.equal(freshCatalogJson.data[0].airing_status, 'Completed');
  assert.equal(freshCatalogJson.data[0].broadcast_day, null);
  assert.equal(freshCatalogJson.data[0].broadcast_time, null);

  // 4. Filter checks: must NOT match ?status=Airing, MUST match ?status=Completed
  const airingFilterRes = await onRequest({
    request: new Request('https://anidub.in/api/anime?status=Airing'),
    env,
  } as any);
  const airingFilterJson = (await airingFilterRes.json()) as { data: Record<string, unknown>[] };
  assert.equal(airingFilterJson.data.length, 0);

  const completedFilterRes = await onRequest({
    request: new Request('https://anidub.in/api/anime?status=Completed'),
    env,
  } as any);
  const completedFilterJson = (await completedFilterRes.json()) as { data: Record<string, unknown>[] };
  assert.equal(completedFilterJson.data.length, 1);
  assert.equal(completedFilterJson.data[0].id, 501);

  // 5. Detail GET /api/anime/501 and index GET /api/anime/index?fresh=1 must both return Completed
  const detailRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/501'),
    env,
  } as any);
  const detailJson = (await detailRes.json()) as Record<string, unknown>;
  assert.equal(detailJson.status, 'Completed');
  assert.equal(detailJson.airing_status, 'Completed');

  const indexRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/index?fresh=1&_t=1700000000001'),
    env,
  } as any);
  assert.equal(indexRes.headers.get('Cache-Control'), 'no-store');
  const indexJson = (await indexRes.json()) as { data: Record<string, unknown>[] };
  assert.equal(indexJson.data[0].status, 'Completed');
  assert.equal(indexJson.data[0].airing_status, 'Completed');

  db.close();
});

test('POST /api/anime and POST /api/admin/approve/:id persist Completed into both status and airing_status', async () => {
  const db = createMigratedSqliteDb();
  const { token, publicPem } = createSignedAdminJwt();
  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicPem,
    DB: createSqliteD1Wrapper(db),
  };

  // 1. Create a Completed TV Series directly via POST /api/anime
  const postRes = await onRequest({
    request: new Request('https://anidub.in/api/anime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Fullmetal Alchemist Brotherhood',
        status: 'Completed',
        type: 'TV Series',
        languages: 'Hindi, Tamil',
        platform: 'Netflix',
      }),
    }),
    env,
  } as any);
  assert.equal(postRes.status, 201);
  const postJson = (await postRes.json()) as Record<string, unknown>;
  assert.equal(postJson.status, 'Completed');
  assert.equal(postJson.airing_status, 'Completed');

  const createdRow = db
    .prepare('SELECT status, airing_status FROM anime WHERE id = ?')
    .get(Number(postJson.id)) as Record<string, unknown>;
  assert.equal(createdRow.status, 'Completed');
  assert.equal(createdRow.airing_status, 'Completed');

  // 2. Seed a pending anime with legacy airing_status='Airing' and approve as Completed
  db.prepare(
    `INSERT INTO anime (
      id, title, slug, cover_image, banner_image, status, airing_status,
      broadcast_day, broadcast_time, submissionStatus, approval_status, is_published
    ) VALUES (
      777, 'Death Note', 'death-note', 'https://cdn.anidub.in/dn.jpg', 'https://cdn.anidub.in/dn-b.jpg',
      'pending', 'Airing', 'Monday', '08:00 PM IST', 'pending', 'pending', 0
    )`
  ).run();

  const approveRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/approve/777', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'Completed', submissionStatus: 'approved' }),
    }),
    env,
  } as any);
  assert.equal(approveRes.status, 200);
  const approvedRow = db
    .prepare('SELECT status, airing_status, broadcast_day, broadcast_time, is_published FROM anime WHERE id = 777')
    .get() as Record<string, unknown>;
  assert.equal(approvedRow.status, 'Completed');
  assert.equal(approvedRow.airing_status, 'Completed');
  assert.equal(approvedRow.broadcast_day, null);
  assert.equal(approvedRow.broadcast_time, null);
  assert.equal(approvedRow.is_published, 1);

  db.close();
});
