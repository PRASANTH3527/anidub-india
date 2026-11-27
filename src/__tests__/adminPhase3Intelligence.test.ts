import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFranchiseKey,
  validateFranchiseEntryInput,
  reorderFranchiseEntries,
  validateAdminCastPayload,
  validateContentDemandEvent,
  computeOttPerformanceCtr,
  validateContentBackupBundle,
} from '../utils/adminPhase3Intelligence';
import { handleAdminPhase3Routes } from '../server/routes/adminPhase3Routes';
import { TEMP_BYPASS_ADMIN_AUTH } from '../utils/auth';

const mockJsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('Production Clerk Admin security remains strictly enforced (TEMP_BYPASS_ADMIN_AUTH === false)', () => {
  assert.equal(TEMP_BYPASS_ADMIN_AUTH, false);
});

test('normalizeFranchiseKey slugifies franchise identifiers cleanly', () => {
  assert.equal(normalizeFranchiseKey('  Demon Slayer: Kimetsu no Yaiba! '), 'demon-slayer-kimetsu-no-yaiba');
  assert.equal(normalizeFranchiseKey('naruto_shippuden'), 'naruto_shippuden');
});

test('validateFranchiseEntryInput enforces required fields and blocks duplicate (franchise_key, anime_id)', () => {
  const existing = [
    {
      id: 1,
      franchise_key: 'demon-slayer',
      anime_id: '101',
      watch_order: 1,
      relation_label: 'Original Series',
      note: null,
    },
  ];

  // Duplicate anime_id in same franchise is rejected
  const dup = validateFranchiseEntryInput(
    {
      franchise_key: 'Demon Slayer',
      anime_id: '101',
      relation_label: 'Sequel',
    },
    existing
  );
  assert.equal(dup.ok, false);
  if (!dup.ok) {
    assert.match(dup.error, /already in franchise/i);
  }

  // Valid new anime_id in same franchise succeeds and auto-increments watch_order
  const valid = validateFranchiseEntryInput(
    {
      franchise_key: 'Demon Slayer',
      anime_id: '102',
      relation_label: 'Movie',
      note: 'Mugen Train Arc',
    },
    existing
  );
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.franchise_key, 'demon-slayer');
    assert.equal(valid.data.watch_order, 2);
    assert.equal(valid.data.relation_label, 'Movie');
  }
});

test('reorderFranchiseEntries moves entries up/down and renumbers watch_order 1..N deterministically', () => {
  const entries = [
    {
      id: 10,
      franchise_key: 'naruto',
      anime_id: '1',
      watch_order: 1,
      relation_label: 'Original Series',
      note: null,
    },
    {
      id: 20,
      franchise_key: 'naruto',
      anime_id: '2',
      watch_order: 2,
      relation_label: 'Sequel',
      note: null,
    },
    {
      id: 30,
      franchise_key: 'naruto',
      anime_id: '3',
      watch_order: 3,
      relation_label: 'Next Generation',
      note: null,
    },
  ];

  // Move index 2 ('3') up -> swaps with index 1 ('2')
  const movedUp = reorderFranchiseEntries(entries, 2, 'up');
  assert.deepEqual(
    movedUp.map((e) => ({ anime_id: e.anime_id, watch_order: e.watch_order })),
    [
      { anime_id: '1', watch_order: 1 },
      { anime_id: '3', watch_order: 2 },
      { anime_id: '2', watch_order: 3 },
    ]
  );

  // Move index 0 ('1') down -> swaps with index 1 ('3')
  const movedDown = reorderFranchiseEntries(movedUp, 0, 'down');
  assert.deepEqual(
    movedDown.map((e) => ({ anime_id: e.anime_id, watch_order: e.watch_order })),
    [
      { anime_id: '3', watch_order: 1 },
      { anime_id: '1', watch_order: 2 },
      { anime_id: '2', watch_order: 3 },
    ]
  );
});

test('validateAdminCastPayload defaults verified to 0 (unverified) unless explicitly marked verified', () => {
  const unverifiedRes = validateAdminCastPayload({
    anime_id: '42',
    character_name: 'Sung Jinwoo',
    role: 'Main',
    dub_language: 'Tamil',
    voice_actor_name: 'Sample Actor',
  });
  assert.equal(unverifiedRes.ok, true);
  if (unverifiedRes.ok) {
    assert.equal(unverifiedRes.data.verified, 0);
  }

  const verifiedRes = validateAdminCastPayload({
    anime_id: '42',
    character_name: 'Sung Jinwoo',
    role: 'Main',
    dub_language: 'Hindi',
    voice_actor_name: 'Verified Actor',
    verified: true,
  });
  assert.equal(verifiedRes.ok, true);
  if (verifiedRes.ok) {
    assert.equal(verifiedRes.data.verified, 1);
  }

  const invalidLang = validateAdminCastPayload({
    anime_id: '42',
    character_name: 'Sung Jinwoo',
    dub_language: 'Klingon',
    voice_actor_name: 'Actor',
  });
  assert.equal(invalidLang.ok, false);
});

test('validateContentDemandEvent validates search_query, ott_impression, ott_click, and dub_language_filter', () => {
  const searchEvt = validateContentDemandEvent({
    event_type: 'search_query',
    query_text: 'Chainsaw Man Hindi',
    result_count: 0,
  });
  assert.equal(searchEvt.ok, true);
  if (searchEvt.ok) {
    assert.equal(searchEvt.data.result_count, 0);
  }

  const ottClickEvt = validateContentDemandEvent({
    event_type: 'ott_click',
    anime_id: '15',
    platform_name: 'Crunchyroll',
    language_code: 'Tamil',
  });
  assert.equal(ottClickEvt.ok, true);
  if (ottClickEvt.ok) {
    assert.equal(ottClickEvt.data.language_code, 'ta');
  }

  const filterEvt = validateContentDemandEvent({
    event_type: 'dub_language_filter',
    language_code: 'Telugu',
  });
  assert.equal(filterEvt.ok, true);
  if (filterEvt.ok) {
    assert.equal(filterEvt.data.language_code, 'te');
  }

  const badEvt = validateContentDemandEvent({
    event_type: 'unknown_event',
  });
  assert.equal(badEvt.ok, false);
});

test('computeOttPerformanceCtr calculates CTR and returns "—" when impressions are 0', () => {
  const zeroImpressions = computeOttPerformanceCtr(5, 0);
  assert.equal(zeroImpressions.ctrPercent, null);
  assert.equal(zeroImpressions.display, '—');

  const realCtr = computeOttPerformanceCtr(25, 200);
  assert.equal(realCtr.ctrPercent, 12.5);
  assert.equal(realCtr.display, '12.5%');
});

test('validateContentBackupBundle inspects table counts and rejects leaked private credentials', () => {
  const validBundle = validateContentBackupBundle({
    schemaVersion: 'anidub-content-backup-v2.3',
    exportedAt: '2026-11-27T12:00:00.000Z',
    tables: {
      anime: [{ id: 1, title: 'Solo Leveling' }],
      anime_dub_matrix: [],
      anime_translations: [],
      anime_franchise_links: [],
      anime_cast_entries: [],
      dub_reviews: [],
    },
  });
  assert.equal(validBundle.valid, true);
  assert.equal(validBundle.tableCounts.anime, 1);

  const leakedSecretsBundle = validateContentBackupBundle({
    schemaVersion: 'anidub-content-backup-v2.3',
    exportedAt: '2026-11-27T12:00:00.000Z',
    clerk_secret: 'sk_live_123',
    tables: {
      anime: [{ id: 1, title: 'Solo Leveling' }],
    },
  });
  assert.equal(leakedSecretsBundle.valid, false);
  assert.ok(leakedSecretsBundle.errors.some((e) => /credential|user data/i.test(e)));
});

test('handleAdminPhase3Routes enforces 401 Clerk Admin auth on all /api/admin/* Phase 3 endpoints and accepts public /api/analytics/event', async () => {
  // 1. Public /api/analytics/event works without auth
  const publicReq = new Request('http://localhost:3000/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'search_query',
      query_text: 'Blue Lock Tamil',
      result_count: 0,
    }),
  });
  const publicRes = await handleAdminPhase3Routes({
    request: publicReq,
    env: { DB: undefined } as any,
    path: '/api/analytics/event',
    method: 'POST',
    url: new URL(publicReq.url),
    jsonResponse: mockJsonResponse,
  });
  assert.ok(publicRes);
  assert.equal(publicRes.status, 200);

  // 2. All Phase 3 /api/admin/* endpoints return 401 when unauthenticated
  const protectedEndpoints: Array<{ method: string; path: string }> = [
    { method: 'GET', path: '/api/admin/franchises' },
    { method: 'PUT', path: '/api/admin/franchises/demon-slayer' },
    { method: 'DELETE', path: '/api/admin/franchises/demon-slayer/101' },
    { method: 'GET', path: '/api/admin/cast?anime_id=1' },
    { method: 'POST', path: '/api/admin/cast' },
    { method: 'PUT', path: '/api/admin/cast/1' },
    { method: 'DELETE', path: '/api/admin/cast/1' },
    { method: 'GET', path: '/api/admin/analytics/demand?timeframe=30d' },
    { method: 'GET', path: '/api/admin/backup/stats' },
    { method: 'GET', path: '/api/admin/backup/export-csv' },
    { method: 'GET', path: '/api/admin/backup/export-json' },
    { method: 'POST', path: '/api/admin/backup/validate' },
  ];

  for (const ep of protectedEndpoints) {
    const req = new Request(`http://localhost:3000${ep.path}`, { method: ep.method });
    const res = await handleAdminPhase3Routes({
      request: req,
      env: { DB: undefined } as any,
      path: new URL(req.url).pathname,
      method: ep.method,
      url: new URL(req.url),
      jsonResponse: mockJsonResponse,
    });
    assert.ok(res, `Expected response for ${ep.method} ${ep.path}`);
    assert.equal(
      res.status,
      401,
      `Expected 401 Unauthorized for unauthenticated ${ep.method} ${ep.path}`
    );
  }
});
