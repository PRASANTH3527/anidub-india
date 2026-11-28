import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { onRequest } from '../functions/api/[[route]].ts';
import { AnimeUniverseSection } from '../src/components/details/AnimeUniverseSection';

function signClerkAdminJwt(claims: Record<string, any>, privateKeyPem: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_clerk_admin_1',
      sid: 'sess_admin_1',
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

function createBatchTrackingD1Env(publicKeyPem: string) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE,
      cover_image TEXT,
      type TEXT DEFAULT 'TV Series',
      year INTEGER,
      status TEXT,
      episodes_count INTEGER,
      languages TEXT,
      approval_status TEXT DEFAULT 'approved',
      is_published INTEGER DEFAULT 1
    );
  `);

  const insertAnime = sqlite.prepare(
    `INSERT INTO anime (id, title, slug, cover_image, type, year, status, episodes_count, languages, approval_status, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertAnime.run(201, 'Demon Slayer: Kimetsu no Yaiba', 'demon-slayer', 'https://cdn.example.com/ds1.jpg', 'TV Series', 2019, 'Completed', 26, '["Tamil","Hindi"]', 'approved', 1);
  insertAnime.run(202, 'Demon Slayer: Mugen Train', 'demon-slayer-mugen-train', 'https://cdn.example.com/ds-movie.jpg', 'Movie', 2020, 'Completed', 1, '["Tamil","Hindi","Telugu"]', 'approved', 1);
  insertAnime.run(203, 'Demon Slayer: Entertainment District', 'demon-slayer-s2', 'https://cdn.example.com/ds2.jpg', 'TV Series', 2021, 'Completed', 11, '["Tamil","Hindi"]', 'approved', 1);
  insertAnime.run(204, 'Demon Slayer: Pending Entry', 'demon-slayer-pending', 'https://cdn.example.com/ds-pending.jpg', 'Movie', 2026, 'pending', 1, '["Hindi"]', 'pending', 0);

  const v2MigrationPath = path.join(process.cwd(), 'migrations', '003_anime_details_v2.sql');
  sqlite.exec(fs.readFileSync(v2MigrationPath, 'utf8'));

  const executedSqlLog: string[] = [];
  let batchCallCount = 0;

  const db = {
    prepare(sql: string) {
      let bindings: any[] = [];
      return {
        _sql: sql,
        _getBindings: () => bindings,
        bind(...args: any[]) {
          bindings = args;
          return this;
        },
        async first() {
          executedSqlLog.push(sql);
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...bindings);
          return row === undefined ? null : row;
        },
        async all() {
          executedSqlLog.push(sql);
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...bindings);
          return { results };
        },
        async run() {
          executedSqlLog.push(sql);
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
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      batchCallCount += 1;
      const results = [];
      sqlite.exec('BEGIN');
      try {
        for (const s of statements) {
          results.push(await s.run());
        }
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };

  return {
    sqlite,
    executedSqlLog,
    getBatchCallCount: () => batchCallCount,
    env: {
      DB: db as any,
      CLERK_JWT_KEY: publicKeyPem,
      ADMIN_EMAIL: 'admin@anidub.in',
      ALLOWED_ORIGINS: 'https://anidub.in',
    },
  };
}

test('Franchise Builder APIs enforce strict auth, validate anime existence, reject duplicates with 409, reorder atomically via db.batch() without DELETE, and re-sequence on delete', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const { executedSqlLog, getBatchCallCount, env } = createBatchTrackingD1Env(publicKey);
  const adminToken = signClerkAdminJwt({ email: 'admin@anidub.in', role: 'admin' }, privateKey);
  const userToken = signClerkAdminJwt({ sub: 'user_regular', email: 'fan@example.com' }, privateKey);

  // 1. Non-admin gets 403 on all new endpoints
  const nonAdminRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/franchises/demon-slayer/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ anime_id: '201', relation_label: 'Main Series' }),
    }),
    env,
  });
  assert.equal(nonAdminRes.status, 403);

  // 2. Adding a non-existent anime_id returns 404
  const missingAnimeRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/franchises/demon-slayer/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ anime_id: '99999', relation_label: 'Main Series' }),
    }),
    env,
  });
  assert.equal(missingAnimeRes.status, 404);

  // 3. Add 4 entries (including pending anime #204) and verify auto-increment watch_order 1..4
  const toAdd = [
    { anime_id: '201', relation_label: 'Main Series', note: 'Start here' },
    { anime_id: '202', relation_label: 'Movie', note: 'Watch after S1' },
    { anime_id: '203', relation_label: 'Sequel', note: 'Season 2' },
    { anime_id: '204', relation_label: 'Spin-off', note: 'Pending draft' },
  ];

  for (let i = 0; i < toAdd.length; i++) {
    const res = await onRequest({
      request: new Request('https://anidub.in/api/admin/franchises/demon-slayer/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(toAdd[i]),
      }),
      env,
    });
    assert.equal(res.status, 201);
    const json: any = await res.json();
    assert.equal(json.entry.watch_order, i + 1);
  }

  // 4. Duplicate (franchise_key, anime_id) returns HTTP 409 Conflict
  const dupRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/franchises/demon-slayer/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ anime_id: '201', relation_label: 'Sequel' }),
    }),
    env,
  });
  assert.equal(dupRes.status, 409);

  // 5. GET /api/admin/franchises includes display_title and count
  const listRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/franchises', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }),
    env,
  });
  assert.equal(listRes.status, 200);
  const listJson: any = await listRes.json();
  assert.equal(listJson.franchises[0].franchise_key, 'demon-slayer');
  assert.equal(listJson.franchises[0].display_title, 'Demon Slayer');
  assert.equal(listJson.franchises[0].entry_count, 4);

  // 6. GET /api/admin/franchises/:key returns ordered entries joined with anime metadata
  const keyRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/franchises/demon-slayer', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }),
    env,
  });
  assert.equal(keyRes.status, 200);
  const keyJson: any = await keyRes.json();
  assert.equal(keyJson.displayTitle, 'Demon Slayer');
  assert.deepEqual(
    keyJson.entries.map((e: any) => e.anime_id),
    ['201', '202', '203', '204']
  );

  // 7. PUT /api/admin/franchises/:key/reorder uses atomic db.batch() and NEVER deletes rows
  const logStartIdx = executedSqlLog.length;
  const batchesBefore = getBatchCallCount();
  const reorderedEntryIds = [
    keyJson.entries[1].id, // 202 -> #1
    keyJson.entries[0].id, // 201 -> #2
    keyJson.entries[2].id, // 203 -> #3
    keyJson.entries[3].id, // 204 -> #4
  ];

  const reorderRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/franchises/demon-slayer/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ entryIds: reorderedEntryIds }),
    }),
    env,
  });
  assert.equal(reorderRes.status, 200);
  const reorderJson: any = await reorderRes.json();
  assert.equal(getBatchCallCount(), batchesBefore + 1, 'Expected atomic db.batch() call on reorder');

  const reorderSqlSlice = executedSqlLog.slice(logStartIdx);
  assert.equal(
    reorderSqlSlice.some((sql) => /DELETE\s+FROM\s+anime_franchise_links/i.test(sql)),
    false,
    'Reorder must NEVER execute DELETE FROM anime_franchise_links'
  );
  assert.deepEqual(
    reorderJson.entries.map((e: any) => ({ anime_id: e.anime_id, watch_order: e.watch_order })),
    [
      { anime_id: '202', watch_order: 1 },
      { anime_id: '201', watch_order: 2 },
      { anime_id: '203', watch_order: 3 },
      { anime_id: '204', watch_order: 4 },
    ]
  );

  // 8. Public GET /api/anime/201/franchise returns ONLY approved/published entries ordered by watch_order ASC
  const pubRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/201/franchise'),
    env,
  });
  assert.equal(pubRes.status, 200);
  const pubJson: any = await pubRes.json();
  assert.deepEqual(
    pubJson.entries.map((e: any) => e.anime_id),
    ['202', '201', '203'],
    'Pending anime #204 must be filtered out and order must follow watch_order ASC'
  );

  // 9. DELETE /api/admin/franchises/:key/entries/:id deletes row and re-sequences remaining 1..N atomically
  const batchesBeforeDel = getBatchCallCount();
  const deleteId = reorderJson.entries[1].id; // anime 201 (watch_order 2)
  const delRes = await onRequest({
    request: new Request(`https://anidub.in/api/admin/franchises/demon-slayer/entries/${deleteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    }),
    env,
  });
  assert.equal(delRes.status, 200);
  const delJson: any = await delRes.json();
  assert.equal(getBatchCallCount(), batchesBeforeDel + 1, 'Expected atomic db.batch() re-sequence on delete');
  assert.deepEqual(
    delJson.entries.map((e: any) => ({ anime_id: e.anime_id, watch_order: e.watch_order })),
    [
      { anime_id: '202', watch_order: 1 },
      { anime_id: '203', watch_order: 2 },
      { anime_id: '204', watch_order: 3 },
    ]
  );
});

test('Public AnimeUniverseSection renders nothing when fewer than 2 entries exist, and renders compact Watch Order when 2+ entries exist', () => {
  const emptyMarkup = renderToStaticMarkup(
    React.createElement(AnimeUniverseSection, {
      d1Entries: [],
      fallbackEntries: [],
      currentAnimeId: '201',
      allAnime: [],
    })
  );
  assert.equal(emptyMarkup, '');

  const singleMarkup = renderToStaticMarkup(
    React.createElement(AnimeUniverseSection, {
      d1Entries: [
        {
          id: 1,
          franchise_key: 'demon-slayer',
          anime_id: '201',
          relation_label: 'Main Series',
          watch_order: 1,
          note: null,
          title: 'Demon Slayer',
          is_current: true,
        },
      ],
      fallbackEntries: [],
      currentAnimeId: '201',
      allAnime: [],
    })
  );
  assert.equal(singleMarkup, '', 'Watch Order section must render nothing when only 1 entry exists');

  const multiMarkup = renderToStaticMarkup(
    React.createElement(AnimeUniverseSection, {
      d1Entries: [
        {
          id: 1,
          franchise_key: 'demon-slayer',
          anime_id: '201',
          relation_label: 'Main Series',
          watch_order: 1,
          note: 'Start here',
          title: 'Demon Slayer',
          is_current: true,
        },
        {
          id: 2,
          franchise_key: 'demon-slayer',
          anime_id: '202',
          relation_label: 'Movie',
          watch_order: 2,
          note: 'Watch after S1',
          title: 'Demon Slayer: Mugen Train',
          is_current: false,
        },
      ],
      fallbackEntries: [],
      currentAnimeId: '201',
      allAnime: [],
    })
  );
  assert.match(multiMarkup, /Watch Order/);
  assert.match(multiMarkup, /#1/);
  assert.match(multiMarkup, /#2/);
  assert.match(multiMarkup, /Current/);
  assert.match(multiMarkup, /Demon Slayer: Mugen Train/);
});
