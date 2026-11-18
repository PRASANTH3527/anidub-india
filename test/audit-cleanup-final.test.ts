import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/[[route]].ts';
import {
  getAuth,
  isAuthorizedClerkAdmin,
} from '../src/utils/auth.js';
import { countAiringSimulcasts } from '../src/utils/schedule.js';
import {
  normalizeSeasonEpisodeCount,
  normalizeLastVerifiedDate,
  deriveSeasonEpisodeCountSummary,
  deriveOfficialSourceUrlFromPartners,
} from '../src/utils/dataNormalization.js';
import { validateOfficialSourceUrl } from '../src/utils/submissionValidation.js';

function signClerkTestJwt(claims: Record<string, any>, privateKeyPem: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_clerk_test_1',
      sid: 'sess_test_1',
      iat: nowSec - 10,
      nbf: nowSec - 10,
      exp: nowSec + 300,
      azp: 'https://anidub.in',
      ...claims,
    })
  ).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKeyPem).toString('base64url');
  return `${unsigned}.${sig}`;
}

function createSqliteD1Env(extraEnv: Record<string, any> = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  const db = {
    prepare(sql: string) {
      let bindings: any[] = [];
      const stmt = sqlite.prepare(sql);
      return {
        bind(...args: any[]) {
          bindings = args.map((v) => (v === undefined ? null : v));
          return this;
        },
        async first() {
          const row = stmt.get(...bindings);
          return row ? { ...row } : null;
        },
        async all() {
          const rows = stmt.all(...bindings).map((r: any) => ({ ...r }));
          return { results: rows, success: true };
        },
        async run() {
          const info = stmt.run(...bindings);
          return {
            success: true,
            meta: {
              changes: Number(info.changes || 0),
              last_row_id: Number(info.lastInsertRowid || 0),
            },
          };
        },
      };
    },
  };

  return {
    sqlite,
    env: {
      DB: db,
      ...extraEnv,
    },
  };
}

test('Clerk admin verification: supports ADMIN_USER_ID / ADMIN_USER_IDS, verified publicMetadata/org role, and blocks unsafeMetadata spoofing', async () => {
  const prevId = process.env.ADMIN_USER_ID;
  const prevIds = process.env.ADMIN_USER_IDS;
  const prevEmail = process.env.ADMIN_EMAIL;

  try {
    delete process.env.ADMIN_EMAIL;
    process.env.ADMIN_USER_ID = 'user_primary_admin';
    process.env.ADMIN_USER_IDS = 'user_backup_admin, user_third_admin';

    assert.equal(isAuthorizedClerkAdmin({ id: 'user_primary_admin' }), true);
    assert.equal(isAuthorizedClerkAdmin({ id: 'user_backup_admin' }), true);
    assert.equal(isAuthorizedClerkAdmin({ id: 'user_random', publicMetadata: { role: 'admin' } }), true);
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_random',
        organizationMemberships: [{ role: 'org:admin' }],
      }),
      true
    );
    // Client-editable unsafeMetadata must NEVER grant admin privileges
    assert.equal(
      isAuthorizedClerkAdmin({ id: 'user_attacker', unsafeMetadata: { role: 'admin' } }),
      false
    );
  } finally {
    if (prevId === undefined) delete process.env.ADMIN_USER_ID;
    else process.env.ADMIN_USER_ID = prevId;
    if (prevIds === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = prevIds;
    if (prevEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prevEmail;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const env = {
    ADMIN_USER_ID: 'user_id_admin_42',
    CLERK_JWT_KEY: publicKey,
    DB: null as any,
  };

  const idAdminJwt = signClerkTestJwt(
    { sub: 'user_id_admin_42', email: 'someone@otherdomain.com', email_verified: true },
    privateKey
  );
  const idAdminAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${idAdminJwt}` },
    }),
    env
  );
  assert.equal(idAdminAuth.authenticated, true);
  assert.equal(idAdminAuth.isAdmin, true);

  const roleAdminJwt = signClerkTestJwt(
    {
      sub: 'user_role_admin_99',
      public_metadata: { role: 'superadmin' },
      email: 'staff@anidub.in',
      email_verified: true,
    },
    privateKey
  );
  const roleAdminAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${roleAdminJwt}` },
    }),
    env
  );
  assert.equal(roleAdminAuth.authenticated, true);
  assert.equal(roleAdminAuth.isAdmin, true);

  const spoofedJwt = signClerkTestJwt(
    {
      sub: 'user_attacker_1',
      unsafe_metadata: { role: 'admin' },
      email: 'attacker@example.com',
      email_verified: true,
    },
    privateKey
  );
  const spoofedAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${spoofedJwt}` },
    }),
    env
  );
  assert.equal(spoofedAuth.authenticated, true);
  assert.equal(spoofedAuth.isAdmin, false);
});

test('All protected Admin API routes enforce strict 401 unauthenticated vs 403 non-admin vs 200 verified admin', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const { sqlite, env } = createSqliteD1Env({
    ADMIN_USER_ID: 'user_verified_admin',
    CLERK_JWT_KEY: publicKey,
  });

  try {
    // Seed 1 feedback row to test DELETE /api/feedback/:id
    sqlite
      .prepare('INSERT INTO feedback (name_or_insta, email, feedback_text) VALUES (?, ?, ?)')
      .run('Tester', 't@example.com', 'Great site!');

    const viewerJwt = signClerkTestJwt(
      { sub: 'user_regular_viewer', email: 'viewer@example.com', email_verified: true },
      privateKey
    );
    const adminJwt = signClerkTestJwt(
      { sub: 'user_verified_admin', email: 'ops@example.com', email_verified: true },
      privateKey
    );

    const protectedRequests: Array<{ method: string; url: string; body?: string; expectedAdminStatus?: number }> = [
      { method: 'GET', url: 'https://anidub.in/api/admin/pending' },
      { method: 'GET', url: 'https://anidub.in/api/admin/export-csv' },
      { method: 'GET', url: 'https://anidub.in/api/cloudflare/status' },
      { method: 'GET', url: 'https://anidub.in/api/analytics/dashboard' },
      { method: 'GET', url: 'https://anidub.in/api/feedback' },
      { method: 'DELETE', url: 'https://anidub.in/api/feedback/1' },
      { method: 'GET', url: 'https://anidub.in/api/admin/reports' },
      { method: 'GET', url: 'https://anidub.in/api/anime?includePending=true' },
      {
        method: 'POST',
        url: 'https://anidub.in/api/admin/import-csv',
        body: JSON.stringify({ animeList: [{ title: 'Solo Leveling Test' }] }),
      },
      { method: 'POST', url: 'https://anidub.in/api/admin/clear-pending' },
      {
        method: 'POST',
        url: 'https://anidub.in/api/anime',
        body: JSON.stringify({ title: 'Spy x Family', platform: 'Crunchyroll', languages: 'Hindi, Tamil' }),
        expectedAdminStatus: 201,
      },
      {
        method: 'PUT',
        url: 'https://anidub.in/api/anime/2',
        body: JSON.stringify({ title: 'Spy x Family S2', status: 'Airing' }),
      },
    ];

    for (const check of protectedRequests) {
      // 1. Unauthenticated -> 401
      const unauthRes = await onRequest({
        request: new Request(check.url, {
          method: check.method,
          headers: check.body ? { 'Content-Type': 'application/json' } : undefined,
          body: check.body,
        }),
        env,
      });
      assert.equal(unauthRes.status, 401, `Expected 401 for unauthenticated ${check.method} ${check.url}`);

      // 2. Non-admin authenticated user -> 403
      const nonAdminRes = await onRequest({
        request: new Request(check.url, {
          method: check.method,
          headers: {
            Authorization: `Bearer ${viewerJwt}`,
            ...(check.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: check.body,
        }),
        env,
      });
      assert.equal(nonAdminRes.status, 403, `Expected 403 for non-admin ${check.method} ${check.url}`);

      // 3. Verified admin -> allowed
      const adminRes = await onRequest({
        request: new Request(check.url, {
          method: check.method,
          headers: {
            Authorization: `Bearer ${adminJwt}`,
            ...(check.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: check.body,
        }),
        env,
      });
      assert.equal(
        adminRes.status,
        check.expectedAdminStatus ?? 200,
        `Expected ${check.expectedAdminStatus ?? 200} for admin ${check.method} ${check.url}`
      );
    }

    // Resolving a non-existent feedback ticket returns 404
    const missingFb = await onRequest({
      request: new Request('https://anidub.in/api/feedback/999', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminJwt}` },
      }),
      env,
    });
    assert.equal(missingFb.status, 404);
  } finally {
    sqlite.close();
  }
});

test('Simulcast count logic: counts Airing/Ongoing/Simulcast items dynamically and matches SQL status=Airing filter', async () => {
  assert.equal(
    countAiringSimulcasts([
      { id: 1, title: 'Dandadan', status: 'Airing' },
      { id: 2, title: 'One Piece', airing_status: 'Ongoing (Simulcast)' },
      { id: 3, title: 'Sakamoto Days', status: 'Simulcast' },
      { id: 4, title: 'Death Note', status: 'Completed' },
      { id: 5, title: 'Movie X', status: 'Upcoming' },
    ]),
    3
  );
  assert.equal(countAiringSimulcasts([{ id: 1, status: 'Airing' }], 7), 7);
  assert.equal(countAiringSimulcasts([], 0), 0);

  const { sqlite, env } = createSqliteD1Env();
  try {
    const insert = sqlite.prepare(
      `INSERT INTO anime (title, slug, cover_image, banner_image, status, airing_status, is_published, approval_status) VALUES (?, ?, '/logo.png', '/logo.png', ?, ?, 1, 'approved')`
    );
    insert.run('Kaiju No. 8', 'kaiju-no-8', 'Airing', 'Airing');
    insert.run('One Piece', 'one-piece', 'Ongoing', 'Ongoing (Simulcast)');
    insert.run('Wind Breaker', 'wind-breaker', 'Simulcast', 'Currently Airing');
    insert.run('Fullmetal Alchemist', 'fmab', 'Completed', 'Completed');
    insert.run('Upcoming Show', 'upcoming-show', 'Upcoming', 'Upcoming');

    const airingRes = await onRequest({
      request: new Request('https://anidub.in/api/anime?status=Airing&limit=100'),
      env,
    });
    assert.equal(airingRes.status, 200);
    const airingJson: any = await airingRes.json();
    assert.equal(airingJson.data.length, 3);
    assert.equal(airingJson.meta.totalItems, 3);
    assert.equal(airingJson.summary.airingCount, 3);

    const allRes = await onRequest({
      request: new Request('https://anidub.in/api/anime?limit=100'),
      env,
    });
    assert.equal(allRes.status, 200);
    const allJson: any = await allRes.json();
    assert.equal(allJson.summary.airingCount, 3);
  } finally {
    sqlite.close();
  }
});

test('Anime metadata fields (season_episode_count, official_source_url, last_verified_date) validation, D1 CRUD, and CSV round-trip', async () => {
  assert.equal(normalizeSeasonEpisodeCount('  2 Seasons • 24 Episodes  '), '2 Seasons • 24 Episodes');
  assert.equal(normalizeLastVerifiedDate('2026-11-17T10:30:00Z'), '2026-11-17');
  assert.equal(normalizeLastVerifiedDate('invalid-date'), '');

  assert.equal(validateOfficialSourceUrl('https://www.crunchyroll.com/series/abc').ok, true);
  assert.equal(validateOfficialSourceUrl('http://museasia.example.com/show').ok, true);
  assert.equal(validateOfficialSourceUrl('').ok, true);
  assert.equal(validateOfficialSourceUrl('javascript:alert(1)').ok, false);
  assert.equal(validateOfficialSourceUrl('https://localhost/admin').ok, false);
  assert.equal(validateOfficialSourceUrl('https://user:pass@example.com').ok, false);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const { sqlite, env } = createSqliteD1Env({
    ADMIN_USER_ID: 'user_verified_admin',
    CLERK_JWT_KEY: publicKey,
  });

  try {
    const adminJwt = signClerkTestJwt({ sub: 'user_verified_admin' }, privateKey);

    // 1. Invalid official_source_url rejected with 400
    const badSourceRes = await onRequest({
      request: new Request('https://anidub.in/api/anime', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Bad Source Test',
          official_source_url: 'javascript:alert(1)',
        }),
      }),
      env,
    });
    assert.equal(badSourceRes.status, 400);

    // 2. Create anime with all 3 new metadata fields
    const createRes = await onRequest({
      request: new Request('https://anidub.in/api/anime', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Frieren: Beyond Journey End',
          platform: 'Crunchyroll',
          languages: 'Hindi, Tamil, Telugu',
          season_episode_count: '1 Season • 28 Episodes',
          official_source_url: 'https://www.crunchyroll.com/series/GG5H5XQX4/frieren-beyond-journeys-end',
          last_verified_date: '2026-11-17',
        }),
      }),
      env,
    });
    assert.equal(createRes.status, 201);
    const created: any = await createRes.json();
    const createdId = created.id || created.animeId;

    const getRes = await onRequest({
      request: new Request(`https://anidub.in/api/anime/${createdId}`),
      env,
    });
    assert.equal(getRes.status, 200);
    const fetched: any = await getRes.json();
    assert.equal(fetched.season_episode_count, '1 Season • 28 Episodes');
    assert.equal(
      fetched.official_source_url,
      'https://www.crunchyroll.com/series/GG5H5XQX4/frieren-beyond-journeys-end'
    );
    assert.equal(fetched.last_verified_date, '2026-11-17');

    // 3. Update metadata fields via PUT
    const putRes = await onRequest({
      request: new Request(`https://anidub.in/api/anime/${createdId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Frieren: Beyond Journey End',
          season_episode_count: '2 Seasons • 40 Episodes',
          official_source_url: 'https://www.netflix.com/title/81726714',
          last_verified_date: '2026-11-18',
        }),
      }),
      env,
    });
    assert.equal(putRes.status, 200);

    const updatedRes = await onRequest({
      request: new Request(`https://anidub.in/api/anime/${createdId}`),
      env,
    });
    const updated: any = await updatedRes.json();
    assert.equal(updated.season_episode_count, '2 Seasons • 40 Episodes');
    assert.equal(updated.official_source_url, 'https://www.netflix.com/title/81726714');
    assert.equal(updated.last_verified_date, '2026-11-18');

    // 4. CSV import & export include the new metadata columns
    const csvImportRes = await onRequest({
      request: new Request('https://anidub.in/api/admin/import-csv', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          animeList: [
            {
              title: 'Vinland Saga',
              platform: 'Netflix',
              languages: ['Hindi'],
              season_episode_count: '2 Seasons • 48 Episodes',
              official_source_url: 'https://www.netflix.com/title/81249833',
              last_verified_date: '2026-11-16',
            },
          ],
        }),
      }),
      env,
    });
    assert.equal(csvImportRes.status, 200);

    const csvExportRes = await onRequest({
      request: new Request('https://anidub.in/api/admin/export-csv', {
        headers: { Authorization: `Bearer ${adminJwt}` },
      }),
      env,
    });
    assert.equal(csvExportRes.status, 200);
    const csvText = await csvExportRes.text();
    assert.ok(csvText.includes('season_episode_count'));
    assert.ok(csvText.includes('official_source_url'));
    assert.ok(csvText.includes('last_verified_date'));
    assert.ok(csvText.includes('2 Seasons • 40 Episodes'));
    assert.ok(csvText.includes('2 Seasons • 48 Episodes'));
  } finally {
    sqlite.close();
  }
});

test('Mobile 390px overflow guards, ScheduleView simulcast binding, and preserved Clerk TEST key', () => {
  const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
  assert.ok(indexCss.includes('overflow-x: clip'));
  assert.ok(indexCss.includes('max-width: 100%'));

  const detailCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AnimeDetailPage.tsx'), 'utf8');
  assert.ok(detailCode.includes('overflow-x-clip'));
  assert.ok(detailCode.includes('max-w-[calc(100vw-1.5rem)]'));
  assert.ok(detailCode.includes('SEASONS &amp; EPISODES'));
  assert.ok(detailCode.includes('OFFICIAL SOURCE'));
  assert.ok(detailCode.includes('LAST VERIFIED DATE'));

  const scheduleCode = fs.readFileSync(path.join(process.cwd(), 'src/components/ScheduleView.tsx'), 'utf8');
  assert.ok(scheduleCode.includes('countAiringSimulcasts'));
  assert.ok(scheduleCode.includes('data-testid="simulcast-airing-count"'));

  const mainTsx = fs.readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf8');
  assert.ok(mainTsx.includes('pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bnRzLmRldiQ'));
  assert.equal(mainTsx.includes('pk_live_'), false);
});

function createPartialSqliteD1Env(migrationFilenames: string[], extraEnv: Record<string, any> = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of migrationFilenames) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  const db = {
    prepare(sql: string) {
      let bindings: any[] = [];
      return {
        bind(...args: any[]) {
          bindings = args.map((v) => (v === undefined ? null : v));
          return this;
        },
        async first() {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...bindings);
          return row ? { ...row } : null;
        },
        async all() {
          const stmt = sqlite.prepare(sql);
          const rows = stmt.all(...bindings).map((r: any) => ({ ...r }));
          return { results: rows, success: true };
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...bindings);
          return {
            success: true,
            meta: {
              changes: Number(info.changes || 0),
              last_row_id: Number(info.lastInsertRowid || 0),
            },
          };
        },
      };
    },
  };

  return { sqlite, env: { DB: db, ...extraEnv } };
}

test('P0-01: /api/progress returns HTTP 500 with actual SQL error when watch_progress table is missing, DB fails, or DB is unconfigured', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const userJwt = signClerkTestJwt({ sub: 'user_progress_fail_1' }, privateKey);

  // 1. Legacy SQLite schema (0001 only — watch_progress table does NOT exist)
  const { sqlite, env } = createPartialSqliteD1Env(['0001_initial_schema.sql'], {
    CLERK_JWT_KEY: publicKey,
  });

  try {
    for (const method of ['PUT', 'POST'] as const) {
      const writeRes = await onRequest({
        request: new Request('https://anidub.in/api/progress', {
          method,
          headers: {
            Authorization: `Bearer ${userJwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ animeId: 7, season: 1, episode: 5, totalEpisodes: 24, completed: false }),
        }),
        env,
      });
      assert.equal(writeRes.status, 500, `${method} /api/progress must return 500 when watch_progress table is missing`);
      const writeJson: any = await writeRes.json();
      assert.equal(writeJson.success, false);
      assert.match(String(writeJson.error || ''), /watch_progress/i);
    }

    for (const url of ['https://anidub.in/api/progress?animeId=7', 'https://anidub.in/api/progress']) {
      const getRes = await onRequest({
        request: new Request(url, {
          headers: { Authorization: `Bearer ${userJwt}` },
        }),
        env,
      });
      assert.equal(getRes.status, 500, `GET ${url} must return 500 when watch_progress table is missing`);
      const getJson: any = await getRes.json();
      assert.equal(getJson.success, false);
      assert.match(String(getJson.error || ''), /watch_progress/i);
    }

    const delRes = await onRequest({
      request: new Request('https://anidub.in/api/progress?animeId=7', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userJwt}` },
      }),
      env,
    });
    assert.equal(delRes.status, 500);
    const delJson: any = await delRes.json();
    assert.equal(delJson.success, false);
    assert.match(String(delJson.error || ''), /watch_progress/i);
  } finally {
    sqlite.close();
  }

  // 2. Generic D1 write error (e.g., disk I/O / constraint failure) propagates exact message with 500
  const failingDbEnv = {
    CLERK_JWT_KEY: publicKey,
    DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          async run() {
            throw new Error('D1_ERROR: SQLITE_IOERR disk I/O error');
          },
          async first() {
            throw new Error('D1_ERROR: SQLITE_IOERR disk I/O error');
          },
          async all() {
            throw new Error('D1_ERROR: SQLITE_IOERR disk I/O error');
          },
        };
      },
    },
  };

  const ioRes = await onRequest({
    request: new Request('https://anidub.in/api/progress', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${userJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ animeId: 12, season: 1, episode: 2 }),
    }),
    env: failingDbEnv,
  });
  assert.equal(ioRes.status, 500);
  const ioJson: any = await ioRes.json();
  assert.equal(ioJson.success, false);
  assert.equal(ioJson.error, 'D1_ERROR: SQLITE_IOERR disk I/O error');

  // 3. Unconfigured DB binding returns 500 (never silent success)
  const noDbEnv = { CLERK_JWT_KEY: publicKey, DB: null as any };
  const noDbRes = await onRequest({
    request: new Request('https://anidub.in/api/progress', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${userJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ animeId: 12, season: 1, episode: 2 }),
    }),
    env: noDbEnv,
  });
  assert.equal(noDbRes.status, 500);
  const noDbJson: any = await noDbRes.json();
  assert.equal(noDbJson.success, false);
  assert.match(String(noDbJson.error || ''), /Database binding/i);
});

test('P1-04: /api/admin/export-csv inspects schema via PRAGMA and falls back strictly to legacy columns without broadcast_day/broadcast_time', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const adminJwt = signClerkTestJwt({ sub: 'user_verified_admin' }, privateKey);

  // 1. Legacy 0001-only SQLite schema (missing broadcast_day, broadcast_time, and 0008 columns)
  const legacyRun = createPartialSqliteD1Env(['0001_initial_schema.sql'], {
    ADMIN_USER_ID: 'user_verified_admin',
    CLERK_JWT_KEY: publicKey,
  });
  try {
    legacyRun.sqlite
      .prepare(
        `INSERT INTO anime (title, slug, cover_image, banner_image, status, rating, episodes_count, year, genres, languages, platform, type, studio)
         VALUES ('Naruto Shippuden', 'naruto-shippuden', '/logo.png', '/logo.png', 'Completed', 8.9, 500, 2007, 'Action', 'Hindi, Tamil', 'Sony YAY!', 'TV Series', 'Pierrot')`
      )
      .run();

    const exportRes = await onRequest({
      request: new Request('https://anidub.in/api/admin/export-csv', {
        headers: { Authorization: `Bearer ${adminJwt}` },
      }),
      env: legacyRun.env,
    });
    assert.equal(exportRes.status, 200);
    const csv = await exportRes.text();
    assert.ok(csv.includes('Naruto Shippuden'));
    assert.ok(csv.includes('Sony YAY!'));
    assert.ok(csv.includes('Pierrot'));
  } finally {
    legacyRun.sqlite.close();
  }

  // 2. Partial schema (0001 + 0006 only, without 0008) still exports broadcast_day & broadcast_time accurately
  const partialRun = createPartialSqliteD1Env(
    ['0001_initial_schema.sql', '0006_add_schedule_fields.sql'],
    {
      ADMIN_USER_ID: 'user_verified_admin',
      CLERK_JWT_KEY: publicKey,
    }
  );
  try {
    partialRun.sqlite
      .prepare(
        `INSERT INTO anime (title, slug, cover_image, banner_image, status, broadcast_day, broadcast_time, platform)
         VALUES ('Dandadan', 'dandadan', '/logo.png', '/logo.png', 'Airing', 'Thursday', '21:30', 'Netflix')`
      )
      .run();

    const exportRes = await onRequest({
      request: new Request('https://anidub.in/api/admin/export-csv', {
        headers: { Authorization: `Bearer ${adminJwt}` },
      }),
      env: partialRun.env,
    });
    assert.equal(exportRes.status, 200);
    const csv = await exportRes.text();
    assert.ok(csv.includes('Dandadan'));
    assert.ok(csv.includes('Thursday'));
    assert.ok(csv.includes('21:30'));
  } finally {
    partialRun.sqlite.close();
  }

  // 3. Non-PRAGMA legacy mockDb: fallback query MUST NOT request broadcast_day or broadcast_time
  const executedSqls: string[] = [];
  const legacyMockEnv = {
    ADMIN_USER_ID: 'user_verified_admin',
    CLERK_JWT_KEY: publicKey,
    DB: {
      prepare(sql: string) {
        executedSqls.push(sql);
        return {
          async all() {
            if (sql.startsWith('PRAGMA')) {
              return { results: [] };
            }
            if (sql.includes('broadcast_day') || sql.includes('broadcast_time')) {
              throw new Error('D1_ERROR: no such column: broadcast_day');
            }
            return {
              results: [
                {
                  id: 1,
                  title: 'Solo Leveling',
                  status: 'Airing',
                  rating: 9.1,
                  episodes_count: 12,
                  year: 2024,
                  genres: 'Action',
                  languages: 'Hindi, English',
                  platform: 'Crunchyroll',
                  type: 'TV Series',
                  studio: 'A-1 Pictures',
                },
              ],
            };
          },
        };
      },
    },
  };

  const mockExportRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/export-csv', {
      headers: { Authorization: `Bearer ${adminJwt}` },
    }),
    env: legacyMockEnv,
  });
  assert.equal(mockExportRes.status, 200);
  const mockCsv = await mockExportRes.text();
  assert.ok(mockCsv.includes('Solo Leveling'));
  assert.ok(mockCsv.includes('A-1 Pictures'));
  assert.equal(executedSqls.some((s) => s.startsWith('PRAGMA table_info(anime)')), true);
  const lastSelect = executedSqls[executedSqls.length - 1];
  assert.equal(lastSelect.includes('broadcast_day'), false);
  assert.equal(lastSelect.includes('broadcast_time'), false);
});

test('DubInfoModal cleanup: removes duplicate Season & Episode Count / Official Source Link boxes and auto-derives them on submit while keeping Last Verified Date', () => {
  // 1. Mixed Entries -> season_episode_count auto-summary
  assert.equal(
    deriveSeasonEpisodeCountSummary([
      { entryType: 'Season', episodes: '12' },
      { entryType: 'Season', episodes: '12' },
    ]),
    '2 Seasons • 24 Episodes'
  );
  assert.equal(
    deriveSeasonEpisodeCountSummary([{ entryType: 'Season', episodes: '28' }]),
    '1 Season • 28 Episodes'
  );
  assert.equal(
    deriveSeasonEpisodeCountSummary([{ entryType: 'Season', episodes: '' }]),
    '1 Season'
  );
  assert.equal(
    deriveSeasonEpisodeCountSummary([
      { entryType: 'Season', episodes: '24' },
      { entryType: 'OVA', episodes: '2' },
      { entryType: 'Movie', episodes: '1' },
    ]),
    '1 Season, 1 Movie, 1 OVA • 27 Episodes'
  );
  assert.equal(
    deriveSeasonEpisodeCountSummary([{ entryType: 'Movie', episodes: '1' }]),
    '1 Movie'
  );
  assert.equal(deriveSeasonEpisodeCountSummary([]), '');

  // 2. Streaming Partners -> official_source_url auto-extraction
  assert.equal(
    deriveOfficialSourceUrlFromPartners([
      { name: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/abc' },
      { name: 'Netflix', url: 'https://www.netflix.com/title/123' },
    ]),
    'https://www.crunchyroll.com/series/abc'
  );
  assert.equal(
    deriveOfficialSourceUrlFromPartners([
      { name: 'Crunchyroll', url: '   ' },
      { name: 'Netflix', url: '  https://www.netflix.com/title/123  ' },
    ]),
    'https://www.netflix.com/title/123'
  );
  assert.equal(deriveOfficialSourceUrlFromPartners([{ name: 'Crunchyroll', url: '' }]), '');
  assert.equal(deriveOfficialSourceUrlFromPartners([]), '');

  // 3. UI component source assertions
  const modalSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/DubInfoModal.tsx'), 'utf8');
  assert.equal(modalSrc.includes('Season &amp; Episode Count'), false);
  assert.equal(modalSrc.includes('Official Source Link'), false);
  assert.ok(modalSrc.includes('Last Verified Date'));
  assert.ok(modalSrc.includes('aria-label="Last Verified Date"'));
  assert.ok(modalSrc.includes('deriveSeasonEpisodeCountSummary(mixedEntries)'));
  assert.ok(modalSrc.includes('deriveOfficialSourceUrlFromPartners(serializedPartners)'));
});


