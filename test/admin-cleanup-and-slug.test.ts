import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/[[route]].ts';
import {
  normalizeAnimeSlug,
  pickUniqueSlugFromSet,
  isSlugUniqueConstraintError,
} from '../src/utils/slugUtils';
import { getVisibleModerationSections } from '../src/components/admin/AdminModerationInboxTab';

function signClerkTestJwt(claims: Record<string, any>, privateKeyPem: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_clerk_admin_slug',
      sid: 'sess_slug_test',
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
              changes: Number(info.changes ?? 0),
              last_row_id: Number(info.lastInsertRowid ?? 0),
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

test('slugUtils normalizes slugs cleanly, generates deterministic collision suffixes, and detects D1 unique errors', () => {
  assert.equal(normalizeAnimeSlug('  Demon Slayer: Kimetsu no Yaiba!!  '), 'demon-slayer-kimetsu-no-yaiba');
  assert.equal(normalizeAnimeSlug('---Solo Leveling---'), 'solo-leveling');
  assert.equal(normalizeAnimeSlug(''), 'anime');

  const existing = new Set(['solo-leveling', 'solo-leveling-2024', 'solo-leveling-2']);
  assert.equal(pickUniqueSlugFromSet('Solo Leveling', existing, 2024), 'solo-leveling-3');
  assert.equal(pickUniqueSlugFromSet('Jujutsu Kaisen', existing, 2023), 'jujutsu-kaisen');
  assert.equal(pickUniqueSlugFromSet('Solo Leveling', new Set(['solo-leveling']), 2024), 'solo-leveling-2024');

  assert.equal(
    isSlugUniqueConstraintError(new Error('D1_ERROR: UNIQUE constraint failed: anime.slug')),
    true
  );
  assert.equal(
    isSlugUniqueConstraintError(new Error('SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: anime.slug')),
    true
  );
  assert.equal(isSlugUniqueConstraintError(new Error('Network timeout')), false);
});

test('POST /api/anime, PUT /api/anime/:id, and CSV import never fail with raw UNIQUE constraint failed: anime.slug', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const { sqlite, env } = createSqliteD1Env({
    ADMIN_USER_ID: 'user_slug_admin',
    CLERK_JWT_KEY: publicKey,
  });

  const adminJwt = signClerkTestJwt(
    { sub: 'user_slug_admin', email: 'ops@anidub.in', email_verified: true },
    privateKey
  );

  try {
    // 1. Create first anime
    const create1 = await onRequest({
      request: new Request('https://anidub.in/api/anime', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Solo Leveling',
          releaseYear: 2024,
          platform: 'Crunchyroll',
          languages: 'Hindi, Tamil',
        }),
      }),
      env,
    });
    assert.equal(create1.status, 201);
    const body1: any = await create1.json();
    assert.equal(body1.slug, 'solo-leveling');

    // 2. Create second anime with the exact same title -> auto-generates unique slug instead of 500 D1_ERROR
    const create2 = await onRequest({
      request: new Request('https://anidub.in/api/anime', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Solo Leveling',
          releaseYear: 2025,
          platform: 'Crunchyroll',
          languages: 'Hindi, Telugu',
        }),
      }),
      env,
    });
    assert.equal(create2.status, 201);
    const body2: any = await create2.json();
    assert.equal(body2.slug, 'solo-leveling-2025');
    assert.notEqual(body1.id, body2.id);

    // 3. Updating existing anime #1 with its OWN slug succeeds (200) and never collides with itself
    const updateSelf = await onRequest({
      request: new Request(`https://anidub.in/api/anime/${body1.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Solo Leveling',
          slug: 'solo-leveling',
          status: 'Completed',
          languages: 'Hindi, Tamil, Telugu',
        }),
      }),
      env,
    });
    assert.equal(updateSelf.status, 200);

    // 4. Explicitly changing anime #2's slug to collide with anime #1 returns clean 409
    const updateConflict = await onRequest({
      request: new Request(`https://anidub.in/api/anime/${body2.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Solo Leveling S2',
          slug: 'solo-leveling',
        }),
      }),
      env,
    });
    assert.equal(updateConflict.status, 409);
    const conflictJson: any = await updateConflict.json();
    assert.match(String(conflictJson.error || ''), /already exists/i);

    // 5. CSV bulk import with colliding title/slug succeeds cleanly
    const csvRes = await onRequest({
      request: new Request('https://anidub.in/api/admin/import-csv', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          animeList: [
            { title: 'Solo Leveling', releaseYear: 2024, platform: 'Crunchyroll', languages: 'Hindi' },
          ],
        }),
      }),
      env,
    });
    assert.equal(csvRes.status, 200);
    const csvJson: any = await csvRes.json();
    assert.equal(csvJson.imported, 1);
  } finally {
    sqlite.close();
  }
});

test('Simplified Moderation Inbox hides 0-count review sections and surfaces them only when reviews exist', () => {
  const emptyReviews = getVisibleModerationSections({
    pendingCount: 3,
    dubReviewsCount: 0,
    generalReviewsCount: 0,
    openFeedbackCount: 2,
  });
  assert.equal(emptyReviews.showDubReviews, false);
  assert.equal(emptyReviews.showGeneralReviews, false);
  assert.deepEqual(
    emptyReviews.visibleTabs.map((t) => t.id),
    ['all', 'pending', 'feedback']
  );

  const withReviews = getVisibleModerationSections({
    pendingCount: 1,
    dubReviewsCount: 4,
    generalReviewsCount: 2,
    openFeedbackCount: 0,
  });
  assert.equal(withReviews.showDubReviews, true);
  assert.equal(withReviews.showGeneralReviews, true);
  assert.deepEqual(
    withReviews.visibleTabs.map((t) => t.id),
    ['all', 'pending', 'feedback', 'dub_reviews', 'general_reviews']
  );
});

test('AdminDashboard enforces cleaned-up navigation, DubInfoModal edit mode, and _savedToServer guard', () => {
  const dashboardSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/AdminDashboard.tsx'),
    'utf-8'
  );

  // Removed clutter tabs must not be imported or rendered in AdminDashboard
  assert.equal(dashboardSrc.includes('AdminDubMatrixTab'), false);
  assert.equal(dashboardSrc.includes('AdminActivityLogTab'), false);
  assert.equal(dashboardSrc.includes('AdminRecycleBinTab'), false);

  // Classic DubInfoModal must receive explicit edit vs submit mode and prevent double-POST
  assert.ok(dashboardSrc.includes("mode={editingAnime?.id ? 'edit' : 'submit'}"));
  assert.ok(dashboardSrc.includes('_savedToServer'));

  // Maintainability threshold check
  const lineCount = dashboardSrc.split('\n').length;
  assert.ok(lineCount < 2200, `Expected AdminDashboard.tsx < 2200 lines, got ${lineCount}`);
});
