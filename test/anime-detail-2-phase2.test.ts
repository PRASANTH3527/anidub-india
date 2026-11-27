import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  computeOverallDubScore,
  validateDubReviewPayload,
  computeDubReviewAggregates,
  computeDubReviewAggregatesByLanguage,
  extractOfficialYouTubeVideoId,
  buildOfficialTrailerInfo,
  resolveOfficialTrailerFromAnime,
  sortSmartWatchOrderEntries,
  groupVerifiedCastByLanguage,
  sanitizeOptionalHttpsImageUrl,
  type DubReviewRecord,
} from '../src/utils/animeDetailsV2';
import { onRequest } from '../functions/api/[[route]].ts';

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

function createSqliteD1Env(options: { applyV2Migration: boolean; publicKeyPem?: string }) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE,
      cover_image TEXT,
      year INTEGER,
      status TEXT,
      episodes_count INTEGER,
      languages TEXT,
      approval_status TEXT DEFAULT 'approved',
      is_published INTEGER DEFAULT 1
    );
  `);

  sqlite
    .prepare(
      `INSERT INTO anime (id, title, slug, cover_image, year, status, episodes_count, languages, approval_status, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(101, 'Jujutsu Kaisen', 'jujutsu-kaisen', 'https://cdn.example.com/jjk1.jpg', 2020, 'Completed', 24, '["Tamil","Hindi"]', 'approved', 1);

  sqlite
    .prepare(
      `INSERT INTO anime (id, title, slug, cover_image, year, status, episodes_count, languages, approval_status, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(102, 'Jujutsu Kaisen 0', 'jujutsu-kaisen-0', 'https://cdn.example.com/jjk0.jpg', 2021, 'Completed', 1, '["Tamil","Hindi"]', 'approved', 1);

  sqlite
    .prepare(
      `INSERT INTO anime (id, title, slug, cover_image, year, status, episodes_count, languages, approval_status, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(103, 'Jujutsu Kaisen Season 2', 'jujutsu-kaisen-s2', 'https://cdn.example.com/jjk2.jpg', 2023, 'Completed', 23, '["Tamil","Hindi","Telugu"]', 'approved', 1);

  sqlite
    .prepare(
      `INSERT INTO anime (id, title, slug, cover_image, year, status, episodes_count, languages, approval_status, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(104, 'Secret Draft Movie', 'secret-draft-movie', 'https://cdn.example.com/draft.jpg', 2026, 'Upcoming', 1, '["Hindi"]', 'pending', 0);

  if (options.applyV2Migration) {
    const sqlPath = path.join(process.cwd(), 'migrations', '003_anime_details_v2.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    sqlite.exec(sql);
  }

  const db = {
    prepare(sql: string) {
      let bindings: any[] = [];
      return {
        bind(...args: any[]) {
          bindings = args;
          return this;
        },
        async first() {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...bindings);
          return row === undefined ? null : row;
        },
        async all() {
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...bindings);
          return { results };
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

  return {
    sqlite,
    env: {
      DB: db,
      ADMIN_EMAIL: 'admin@anidub.in',
      CLERK_JWT_KEY: options.publicKeyPem || '',
    },
  };
}

test('Details 2.0 Phase 2: Pure 5-slider scoring, validation, and honest zero-review aggregates', () => {
  assert.equal(
    computeOverallDubScore({
      voice_acting: 9,
      voice_casting: 8,
      translation_quality: 9,
      lip_sync: 7,
      emotional_delivery: 9,
    }),
    8.4
  );

  const invalidOutOfRange = validateDubReviewPayload({
    dub_language: 'Tamil',
    voice_acting: 11,
    voice_casting: 8,
    translation_quality: 8,
    lip_sync: 8,
    emotional_delivery: 8,
  });
  assert.equal(invalidOutOfRange.ok, false);

  const valid = validateDubReviewPayload({
    dub_language: 'Tamil',
    voice_acting: 10,
    voice_casting: 9,
    translation_quality: 9,
    lip_sync: 8,
    emotional_delivery: 10,
    review_text: 'Amazing ending performance when the final boss appears!',
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.overall_score, 9.2);
    assert.equal(valid.data.has_spoilers, 1); // Auto-spoiler detection
  }

  // Empty reviews must return null averages — NEVER fake scores
  const emptyAgg = computeDubReviewAggregates([]);
  assert.equal(emptyAgg.count, 0);
  assert.equal(emptyAgg.overall, null);
  assert.equal(emptyAgg.voice_acting, null);

  const sampleReviews: DubReviewRecord[] = [
    {
      id: 1,
      anime_id: '101',
      user_name: 'Karthik',
      dub_language: 'Tamil',
      voice_acting: 10,
      voice_casting: 8,
      translation_quality: 9,
      lip_sync: 8,
      emotional_delivery: 10,
      overall_score: 9.0,
      review_text: 'Great Tamil localization.',
      has_spoilers: false,
      status: 'published',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 2,
      anime_id: '101',
      user_name: 'Aarav',
      dub_language: 'Hindi',
      voice_acting: 8,
      voice_casting: 8,
      translation_quality: 8,
      lip_sync: 8,
      emotional_delivery: 8,
      overall_score: 8.0,
      review_text: 'Solid Hindi dub.',
      has_spoilers: false,
      status: 'published',
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
    },
    {
      id: 3,
      anime_id: '101',
      user_name: 'FlaggedUser',
      dub_language: 'Hindi',
      voice_acting: 1,
      voice_casting: 1,
      translation_quality: 1,
      lip_sync: 1,
      emotional_delivery: 1,
      overall_score: 1.0,
      review_text: 'Spam',
      has_spoilers: false,
      status: 'hidden',
      created_at: '2026-01-03',
      updated_at: '2026-01-03',
    },
  ];

  const allAgg = computeDubReviewAggregates(sampleReviews);
  assert.equal(allAgg.count, 2);
  assert.equal(allAgg.overall, 8.5);

  const byLang = computeDubReviewAggregatesByLanguage(sampleReviews);
  assert.equal(byLang.Tamil.count, 1);
  assert.equal(byLang.Tamil.overall, 9);
  assert.equal(byLang.Hindi.count, 1);
  assert.equal(byLang.Hindi.overall, 8);
});

test('Details 2.0 Phase 2: Strict YouTube trailer parser, watch order sorting, cast grouping, and HTTPS portrait sanitizer', () => {
  assert.equal(
    extractOfficialYouTubeVideoId('https://www.youtube.com/watch?v=pkKu9hLT-t8'),
    'pkKu9hLT-t8'
  );
  assert.equal(extractOfficialYouTubeVideoId('https://youtu.be/pkKu9hLT-t8?si=abc'), 'pkKu9hLT-t8');
  assert.equal(
    extractOfficialYouTubeVideoId('https://www.youtube-nocookie.com/embed/pkKu9hLT-t8'),
    'pkKu9hLT-t8'
  );
  // Reject non-YouTube & malicious URLs
  assert.equal(extractOfficialYouTubeVideoId('javascript:alert(1)'), null);
  assert.equal(extractOfficialYouTubeVideoId('https://evil.example.com/watch?v=pkKu9hLT-t8'), null);
  assert.equal(extractOfficialYouTubeVideoId('https://www.youtube.com/watch?v=short'), null);

  const trailer = buildOfficialTrailerInfo('https://youtu.be/pkKu9hLT-t8');
  assert.ok(trailer);
  assert.equal(trailer.embedUrl, 'https://www.youtube-nocookie.com/embed/pkKu9hLT-t8?autoplay=1&rel=0');
  assert.equal(trailer.thumbnailUrl, 'https://i.ytimg.com/vi/pkKu9hLT-t8/hqdefault.jpg');

  assert.equal(resolveOfficialTrailerFromAnime({ title: 'No Trailer Anime' }), null);
  assert.equal(
    resolveOfficialTrailerFromAnime({ trailer_url: 'https://www.youtube.com/watch?v=pkKu9hLT-t8' })
      ?.videoId,
    'pkKu9hLT-t8'
  );

  // Watch order sorting
  const sorted = sortSmartWatchOrderEntries(
    [
      { franchise_key: 'jjk', anime_id: '103', relation_label: 'Season 2', watch_order: 3, note: null, title: 'S2' },
      { franchise_key: 'jjk', anime_id: '101', relation_label: 'Season 1', watch_order: 1, note: 'Start here', title: 'S1' },
      { franchise_key: 'jjk', anime_id: '102', relation_label: 'Prequel Movie', watch_order: 2, note: null, title: 'Movie 0' },
    ],
    '101'
  );
  assert.deepEqual(
    sorted.map((s) => s.watch_order),
    [1, 2, 3]
  );
  assert.equal(sorted[0].is_current, true);
  assert.equal(sorted[1].is_current, false);

  // Cast grouping ignores unverified rows and puts Main roles before Supporting
  const grouped = groupVerifiedCastByLanguage([
    {
      id: 1,
      anime_id: '101',
      character_name: 'Megumi',
      role: 'Supporting',
      voice_actor_name: 'Actor B',
      dub_language: 'Tamil',
      character_image: null,
      actor_image: null,
      verified: true,
    },
    {
      id: 2,
      anime_id: '101',
      character_name: 'Yuji Itadori',
      role: 'Main',
      voice_actor_name: 'Actor A',
      dub_language: 'Tamil',
      character_image: null,
      actor_image: null,
      verified: true,
    },
    {
      id: 3,
      anime_id: '101',
      character_name: 'Unverified Char',
      role: 'Main',
      voice_actor_name: 'Fake VA',
      dub_language: 'Hindi',
      character_image: null,
      actor_image: null,
      verified: false,
    },
  ]);
  assert.deepEqual(grouped.languages, ['Tamil']);
  assert.equal(grouped.byLanguage.Tamil[0].character_name, 'Yuji Itadori');
  assert.equal(grouped.byLanguage.Tamil[1].character_name, 'Megumi');

  // HTTPS image sanitizer
  assert.equal(sanitizeOptionalHttpsImageUrl('https://cdn.anidub.in/va.jpg'), 'https://cdn.anidub.in/va.jpg');
  assert.equal(sanitizeOptionalHttpsImageUrl('http://insecure.example.com/va.jpg'), null);
  assert.equal(sanitizeOptionalHttpsImageUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeOptionalHttpsImageUrl('https://127.0.0.1/secret.png'), null);
});

test('Details 2.0 Phase 2: migrations/003_anime_details_v2.sql is idempotent and enforces constraints', () => {
  const { sqlite } = createSqliteD1Env({ applyV2Migration: true });
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'migrations', '003_anime_details_v2.sql'),
    'utf8'
  );
  // Running migration a second time must succeed idempotently
  assert.doesNotThrow(() => sqlite.exec(sql));

  // CHECK constraint rejects scores outside 1..10
  assert.throws(() => {
    sqlite
      .prepare(
        `INSERT INTO dub_reviews
         (anime_id, user_id, user_name, dub_language, voice_acting, voice_casting, translation_quality, lip_sync, emotional_delivery, overall_score)
         VALUES ('101', 'u1', 'User', 'Tamil', 15, 8, 8, 8, 8, 9.4)`
      )
      .run();
  });
});

test('Details 2.0 Phase 2 API: Graceful pre-migration fallback returns 200 without crashing', async () => {
  const { env } = createSqliteD1Env({ applyV2Migration: false });

  const revRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/101/dub-reviews'),
    env,
  });
  assert.equal(revRes.status, 200);
  const revJson: any = await revRes.json();
  assert.equal(revJson.tableReady, false);
  assert.deepEqual(revJson.reviews, []);
  assert.equal(revJson.summary.overall, null);

  const franRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/101/franchise'),
    env,
  });
  assert.equal(franRes.status, 200);
  const franJson: any = await franRes.json();
  assert.equal(franJson.tableReady, false);
  assert.deepEqual(franJson.entries, []);

  const castRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/101/cast'),
    env,
  });
  assert.equal(castRes.status, 200);
  const castJson: any = await castRes.json();
  assert.equal(castJson.tableReady, false);
  assert.deepEqual(castJson.entries, []);
});

test('Details 2.0 Phase 2 API: Regional 5-slider dub reviews auth, upsert, ownership delete, franchise published-only, and verified cast', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const { sqlite, env } = createSqliteD1Env({
    applyV2Migration: true,
    publicKeyPem: publicKey,
  });

  const user1Token = signClerkTestJwt(
    { sub: 'user_fan_1', email: 'fan1@example.com', email_verified: true, username: 'TamilOtaku' },
    privateKey
  );
  const user2Token = signClerkTestJwt(
    { sub: 'user_fan_2', email: 'fan2@example.com', email_verified: true, username: 'HindiFan' },
    privateKey
  );
  const adminToken = signClerkTestJwt(
    { sub: 'user_admin_1', email: 'admin@anidub.in', email_verified: true, username: 'AniDubAdmin' },
    privateKey
  );

  // 1. Unauthenticated POST must return 401
  const guestPost = await onRequest({
    request: new Request('https://anidub.in/api/anime/101/dub-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dub_language: 'Tamil',
        voice_acting: 9,
        voice_casting: 9,
        translation_quality: 8,
        lip_sync: 8,
        emotional_delivery: 9,
      }),
    }),
    env,
  });
  assert.equal(guestPost.status, 401);

  // 2. Authenticated POST computes overall_score server-side (ignoring client tampering)
  const postRes1 = await onRequest({
    request: new Request('https://anidub.in/api/anime/jujutsu-kaisen/dub-reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        dub_language: 'Tamil',
        voice_acting: 10,
        voice_casting: 9,
        translation_quality: 9,
        lip_sync: 8,
        emotional_delivery: 9,
        overall_score: 1.0, // Should be ignored; server computes 9.0
        review_text: 'Brilliant Chennai slang localization!',
      }),
    }),
    env,
  });
  assert.equal(postRes1.status, 200);
  const postJson1: any = await postRes1.json();
  assert.equal(postJson1.review.overall_score, 9);
  assert.equal(postJson1.review.dub_language, 'Tamil');
  assert.equal(postJson1.review.user_id, undefined); // Never leaks raw user_id

  // 3. Upsert same (anime_id, user_id, dub_language) updates existing row rather than duplicating
  const postRes1Update = await onRequest({
    request: new Request('https://anidub.in/api/anime/101/dub-reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        dub_language: 'Tamil',
        voice_acting: 8,
        voice_casting: 8,
        translation_quality: 8,
        lip_sync: 8,
        emotional_delivery: 8,
        review_text: 'Updated after Season 1 rewatch.',
      }),
    }),
    env,
  });
  assert.equal(postRes1Update.status, 200);
  const updatedReviewId = ((await postRes1Update.json()) as any).review.id;

  const getReviewsRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/101/dub-reviews'),
    env,
  });
  const getReviewsJson: any = await getReviewsRes.json();
  assert.equal(getReviewsJson.reviews.length, 1);
  assert.equal(getReviewsJson.summary.overall, 8);
  assert.equal(getReviewsJson.byLanguage.Tamil.count, 1);

  // 4. Another user CANNOT delete user1's review (403)
  const forbiddenDel = await onRequest({
    request: new Request(`https://anidub.in/api/anime/101/dub-reviews/${updatedReviewId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user2Token}` },
    }),
    env,
  });
  assert.equal(forbiddenDel.status, 403);

  // 5. Owner CAN delete their own review (200)
  const ownerDel = await onRequest({
    request: new Request(`https://anidub.in/api/anime/101/dub-reviews/${updatedReviewId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user1Token}` },
    }),
    env,
  });
  assert.equal(ownerDel.status, 200);

  // 6. Admin Franchise CRUD + Published-Only Guard
  const nonAdminFranPut = await onRequest({
    request: new Request('https://anidub.in/api/admin/franchise/jjk', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({ anime_id: '101', relation_label: 'Season 1', watch_order: 1 }),
    }),
    env,
  });
  assert.equal(nonAdminFranPut.status, 403);

  for (const item of [
    { anime_id: '101', relation_label: 'Season 1', watch_order: 1, note: 'Start here' },
    { anime_id: '102', relation_label: 'Prequel Movie', watch_order: 2, note: 'Best watched after S1' },
    { anime_id: '103', relation_label: 'Season 2', watch_order: 3, note: 'Shibuya Arc' },
    { anime_id: '104', relation_label: 'Unpublished Draft', watch_order: 4, note: 'Must never leak' },
  ]) {
    const res = await onRequest({
      request: new Request('https://anidub.in/api/admin/franchise/jjk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(item),
      }),
      env,
    });
    assert.equal(res.status, 200);
  }

  const franGet = await onRequest({
    request: new Request('https://anidub.in/api/anime/101/franchise'),
    env,
  });
  const franJson: any = await franGet.json();
  assert.equal(franJson.franchiseKey, 'jjk');
  assert.equal(franJson.entries.length, 3); // Draft anime 104 excluded!
  assert.deepEqual(
    franJson.entries.map((e: any) => e.anime_id),
    ['101', '102', '103']
  );
  assert.equal(franJson.entries[0].is_current, true);

  // 7. Admin Cast CRUD + Verified-Only Public Guard
  const castPostRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/anime/101/cast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        character_name: 'Yuji Itadori',
        role: 'Main',
        voice_actor_name: 'Verified Tamil VA',
        dub_language: 'Tamil',
        character_image: 'javascript:alert(1)', // Must be stripped to null
        actor_image: 'https://cdn.anidub.in/actors/tamil-va.jpg',
        verified: true,
      }),
    }),
    env,
  });
  assert.equal(castPostRes.status, 201);

  // Insert an unverified row directly to ensure public GET hides verified = 0 rows
  sqlite
    .prepare(
      `INSERT INTO anime_cast_entries (anime_id, character_name, role, voice_actor_name, dub_language, verified)
       VALUES ('101', 'Unverified Char', 'Main', 'Rumored VA', 'Hindi', 0)`
    )
    .run();

  const castGet = await onRequest({
    request: new Request('https://anidub.in/api/anime/101/cast'),
    env,
  });
  const castJson: any = await castGet.json();
  assert.equal(castJson.entries.length, 1);
  assert.equal(castJson.entries[0].character_name, 'Yuji Itadori');
  assert.equal(castJson.entries[0].character_image, null); // javascript: stripped
  assert.equal(castJson.entries[0].actor_image, 'https://cdn.anidub.in/actors/tamil-va.jpg');
  assert.deepEqual(castJson.languages, ['Tamil']);
});
