import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/[[route]].ts';
import { findMissingAnimeIds, resolveHydratedAnimeList } from '../src/utils/watchlist';
import { normalizeOfflineAnimeRecord, resolveOfflinePosterUrl } from '../src/utils/offlineStorage';

function createD1Adapter(sqliteDb: DatabaseSync) {
  return {
    prepare(sql: string) {
      let bindings: any[] = [];
      return {
        bind(...args: any[]) {
          bindings = args;
          return this;
        },
        async first<T = Record<string, unknown>>() {
          const stmt = sqliteDb.prepare(sql);
          const row = stmt.get(...bindings);
          return (row as T) ?? null;
        },
        async all<T = Record<string, unknown>>() {
          const stmt = sqliteDb.prepare(sql);
          const rows = stmt.all(...bindings);
          return { results: rows as T[] };
        },
        async run() {
          const stmt = sqliteDb.prepare(sql);
          const info = stmt.run(...bindings);
          return {
            success: true,
            meta: { last_row_id: Number(info.lastInsertRowid || 0), changes: Number(info.changes || 0) },
          };
        },
      };
    },
  };
}

function createMigratedSqliteDb(options: { skipReportsMigration?: boolean } = {}): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => !(options.skipReportsMigration && f === '0005_add_reports.sql'));

  for (const fileName of migrationFiles) {
    db.exec(fs.readFileSync(path.join(migrationsDir, fileName), 'utf8'));
  }
  return db;
}

function createSignedClerkJwt(sub: string, extraClaims: Record<string, any> = {}) {
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

test('Watchlist & Recently Viewed hydration helpers fetch missing IDs beyond page 1 without dropping items', () => {
  const loadedPage1 = Array.from({ length: 24 }, (_, idx) => ({
    id: idx + 1,
    title: `Anime #${idx + 1}`,
  }));

  const savedIds = [2, 25, 31, 14, 48];
  const missing = findMissingAnimeIds(savedIds, loadedPage1);
  assert.deepEqual(missing, [25, 31, 48]);

  const fetchedFromD1 = [
    { id: 25, title: 'Anime #25' },
    { id: 31, title: 'Anime #31' },
    { id: 48, title: 'Anime #48' },
  ];

  const resolved = resolveHydratedAnimeList(savedIds, [loadedPage1, fetchedFromD1]);
  assert.deepEqual(
    resolved.map((a) => a.id),
    [2, 25, 31, 14, 48]
  );
  assert.equal(resolved[1]?.title, 'Anime #25');
  assert.equal(resolved[4]?.title, 'Anime #48');
});

test('GET /api/anime?ids=... bypasses 24-item pagination and respects published visibility', async () => {
  const sqlite = createMigratedSqliteDb();
  const insertStmt = sqlite.prepare(
    `INSERT INTO anime (id, title, slug, synopsis, cover_image, banner_image, rating, popularity, status, submissionStatus, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (let i = 1; i <= 30; i++) {
    insertStmt.run(
      i,
      `Regional Anime ${i}`,
      `regional-anime-${i}`,
      'Official Hindi dub',
      `https://i.ibb.co/poster-${i}.jpg`,
      `https://i.ibb.co/banner-${i}.jpg`,
      8.5,
      1000 - i,
      'Completed',
      'approved',
      1
    );
  }
  // Unpublished item #31 should not be returned publicly
  insertStmt.run(
    31,
    'Secret Pending Dub',
    'secret-pending-dub',
    'Pending review',
    'https://i.ibb.co/poster-31.jpg',
    'https://i.ibb.co/banner-31.jpg',
    8.0,
    10,
    'pending',
    'pending',
    0
  );

  const env = {
    DB: createD1Adapter(sqlite),
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: '',
  };

  // Fetch items past limit=24 directly by ?ids=
  const res = await onRequest({
    request: new Request('https://anidub.in/api/anime?ids=29,25,31,3'),
    env,
  });
  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.deepEqual(
    json.data.map((a: any) => a.id),
    [29, 25, 3]
  );

  // Invalid / empty ids= should return empty array cleanly
  const emptyRes = await onRequest({
    request: new Request('https://anidub.in/api/anime?ids=abc,-5'),
    env,
  });
  assert.equal(emptyRes.status, 200);
  const emptyJson: any = await emptyRes.json();
  assert.deepEqual(emptyJson.data, []);

  sqlite.close();
});

test('Offline storage helpers normalize metadata and resolve cover image URLs cleanly', () => {
  assert.equal(
    resolveOfflinePosterUrl({ id: 7, title: 'Solo Leveling', posterUrl: 'https://cdn.example.com/sl.jpg' }),
    'https://cdn.example.com/sl.jpg'
  );
  assert.equal(
    resolveOfflinePosterUrl({ id: 8, title: 'Fallback Poster' }),
    '/logo.png'
  );

  assert.equal(normalizeOfflineAnimeRecord({ id: 0, title: 'Invalid ID' }), null);

  const record = normalizeOfflineAnimeRecord(
    {
      id: 42,
      title: 'Dandadan (Hindi Dub)',
      posterUrl: 'https://i.ibb.co/dandadan.jpg',
      status: 'Airing',
      languages: ['Hindi', 'Tamil'],
    },
    { cachedInCacheStorage: true, savedAt: '2026-01-01T00:00:00.000Z' }
  );
  assert.ok(record);
  assert.equal(record?.id, 42);
  assert.equal(record?.title, 'Dandadan (Hindi Dub)');
  assert.equal(record?.posterUrl, 'https://i.ibb.co/dandadan.jpg');
  assert.equal(record?.cachedInCacheStorage, true);
  assert.equal(record?.anime.cover_image, 'https://i.ibb.co/dandadan.jpg');
});

test('POST /api/report validates input, saves reports to D1 reports table, logs diagnostics, and supports admin listing', async () => {
  const sqlite = createMigratedSqliteDb();
  const { token: adminToken, publicPem } = createSignedClerkJwt('user_admin_rep', {
    email: 'admin@anidub.in',
    email_verified: true,
  });

  const env = {
    DB: createD1Adapter(sqlite),
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicPem,
  };

  // 1. Reject missing issueType or animeTitle
  const badRes = await onRequest({
    request: new Request('https://anidub.in/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animeTitle: 'Jujutsu Kaisen' }),
    }),
    env,
  });
  assert.equal(badRes.status, 400);

  // 2. Valid report inserts into reports + cloudflare_logs and returns 201
  const okRes = await onRequest({
    request: new Request('https://anidub.in/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animeId: 12,
        animeTitle: 'Jujutsu Kaisen',
        issueType: 'Missing Tamil audio track',
        description: 'Episode 4 only plays Hindi audio on Crunchyroll link.',
      }),
    }),
    env,
  });
  assert.equal(okRes.status, 201);
  const okJson: any = await okRes.json();
  assert.equal(okJson.success, true);
  assert.ok(Number(okJson.reportId) >= 1);
  assert.equal(okJson.issueType, 'Missing Tamil audio track');

  const storedReport = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(okJson.reportId) as any;
  assert.equal(storedReport.anime_id, 12);
  assert.equal(storedReport.anime_title, 'Jujutsu Kaisen');
  assert.equal(storedReport.issue_type, 'Missing Tamil audio track');
  assert.equal(storedReport.status, 'open');

  const storedLog = sqlite.prepare("SELECT * FROM cloudflare_logs WHERE service = 'REPORT'").get() as any;
  assert.ok(storedLog);
  assert.equal(storedLog.event_type, 'POST /api/report');

  // 3. GET /api/admin/reports requires admin auth and returns saved reports
  const unauthReports = await onRequest({
    request: new Request('https://anidub.in/api/admin/reports'),
    env,
  });
  assert.equal(unauthReports.status, 401);

  const adminReports = await onRequest({
    request: new Request('https://anidub.in/api/admin/reports', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }),
    env,
  });
  assert.equal(adminReports.status, 200);
  const adminReportsJson: any = await adminReports.json();
  assert.equal(adminReportsJson.reports.length, 1);
  assert.equal(adminReportsJson.reports[0].anime_title, 'Jujutsu Kaisen');

  sqlite.close();
});

test('POST /api/report falls back cleanly to feedback table if reports table is absent', async () => {
  const sqlite = createMigratedSqliteDb({ skipReportsMigration: true });
  const env = {
    DB: createD1Adapter(sqlite),
    ADMIN_EMAIL: 'admin@anidub.in',
  };

  const res = await onRequest({
    request: new Request('https://anidub.in/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animeId: 5,
        animeTitle: 'Chainsaw Man',
        issueType: 'Broken Stream Link',
        description: 'Watch button returns 404',
      }),
    }),
    env,
  });
  assert.equal(res.status, 201);
  const feedbackRow = sqlite.prepare('SELECT * FROM feedback').get() as any;
  assert.ok(feedbackRow);
  assert.match(feedbackRow.feedback_text, /\[REPORT: Broken Stream Link\] Chainsaw Man/);

  sqlite.close();
});

test('GET /api/cloudflare/status returns live D1 counts, real logs, and Clerk verification status (never hardcoded counts)', async () => {
  const sqlite = createMigratedSqliteDb();
  const { token: adminToken, publicPem } = createSignedClerkJwt('user_admin_status', {
    email: 'admin@anidub.in',
    email_verified: true,
  });

  // Insert 2 active anime and 1 pending anime + 1 report + 1 log row
  const insertAnime = sqlite.prepare(
    `INSERT INTO anime (id, title, slug, synopsis, cover_image, banner_image, status, submissionStatus, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertAnime.run(1, 'Active One', 'active-one', 'Syn', 'https://i.ibb.co/1.jpg', 'https://i.ibb.co/b1.jpg', 'Airing', 'approved', 1);
  insertAnime.run(2, 'Active Two', 'active-two', 'Syn', 'https://i.ibb.co/2.jpg', 'https://i.ibb.co/b2.jpg', 'Completed', 'approved', 1);
  insertAnime.run(3, 'Pending One', 'pending-one', 'Syn', 'https://i.ibb.co/3.jpg', 'https://i.ibb.co/b3.jpg', 'pending', 'pending', 0);

  sqlite
    .prepare('INSERT INTO reports (anime_id, anime_title, issue_type, description) VALUES (?, ?, ?, ?)')
    .run(1, 'Active One', 'Missing Hindi dub', 'Audio mismatch');
  sqlite
    .prepare('INSERT INTO cloudflare_logs (service, event_type, status_code, latency_ms, details) VALUES (?, ?, ?, ?, ?)')
    .run('D1', 'CATALOG_SYNC', 200, 4, 'Synced active catalog');

  const env = {
    DB: createD1Adapter(sqlite),
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicPem,
    CLERK_SECRET_KEY: 'sk_test_123',
    IMGBB_API_KEY: 'imgbb_key_present',
  };

  // Unauthenticated blocked
  const unauthRes = await onRequest({
    request: new Request('https://anidub.in/api/cloudflare/status'),
    env,
  });
  assert.equal(unauthRes.status, 401);

  const res = await onRequest({
    request: new Request('https://anidub.in/api/cloudflare/status', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }),
    env,
  });
  assert.equal(res.status, 200);
  const data: any = await res.json();

  assert.equal(data.services.d1.connected, true);
  assert.equal(data.services.d1.recordsCount, 3);
  assert.equal(data.services.d1.activeAnimeCount, 2);
  assert.equal(data.services.d1.pendingAnimeCount, 1);
  assert.equal(data.services.d1.reportsCount, 1);
  assert.equal(data.services.clerk.status, 'Connected & Verified');
  assert.equal(data.services.clerk.userId, 'user_admin_status');
  assert.equal(data.services.clerk.isAdmin, true);
  assert.equal(data.services.imgbb.apiKeyConfigured, true);
  assert.ok(Array.isArray(data.logs));
  assert.ok(data.logs.some((l: any) => l.event_type === 'CATALOG_SYNC'));

  sqlite.close();
});

test('Auth, Offline, Report, Watchlist, and Terminal UI code follow real integrations with no legacy fake auth or simulation strings', () => {
  const authModal = fs.readFileSync(path.join(process.cwd(), 'src/components/AuthModal.tsx'), 'utf-8');
  assert.equal(authModal.includes('cf_anime_user'), false);
  assert.equal(authModal.includes('setTimeout'), false);
  assert.ok(authModal.includes('useSignIn'));
  assert.ok(authModal.includes('useSignUp'));
  assert.ok(authModal.includes('authenticateWithRedirect'));

  const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert.ok(appCode.includes('fetchAnimeByIds'));
  assert.equal(appCode.includes('AUTO-CLEANUP: Sync'), false);

  const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AnimeCard.tsx'), 'utf-8');
  assert.equal(cardCode.includes('const isCached = true'), false);
  assert.ok(cardCode.includes('saveAnimeForOffline'));
  assert.ok(cardCode.includes('ReportModal'));

  const reportModal = fs.readFileSync(path.join(process.cwd(), 'src/components/ReportModal.tsx'), 'utf-8');
  assert.ok(reportModal.includes('Issue Type'));
  assert.ok(reportModal.includes('Description'));
  assert.ok(reportModal.includes('cloudflareApi.reportIssue'));

  const terminalHud = fs.readFileSync(path.join(process.cwd(), 'src/components/admin/AdminTerminalHud.tsx'), 'utf-8');
  assert.equal(/Simulated/i.test(terminalHud), false);

  const adminDash = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf-8');
  assert.equal(/Simulated/i.test(adminDash), false);
  assert.ok(adminDash.includes('/api/cloudflare/status'));
});
