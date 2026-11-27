import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecycleBinArchiveEntry,
  validateRecycleBinPurgeConfirmation,
  generateFailedCsvRowsExport,
  findPotentialCatalogDuplicates,
  REJECTION_REASON_PRESETS,
  formatModerationRejectionSummary,
  checkOptimisticConcurrencyConflict,
  computeAnimeRevisionDiff,
  checkDailyAiUsageQuota,
  scanExtendedDataHealth,
  computeHighDemandMissingDubs,
} from '../utils/adminPhase35Polish';
import { validateContentDemandEvent } from '../utils/adminPhase3Intelligence';
import { TEMP_BYPASS_ADMIN_AUTH } from '../utils/auth';
import { handleAdminPhase35Routes } from '../server/routes/adminPhase35Routes';

function mockJsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('Phase 3.5 keeps strict Clerk Admin authentication active (TEMP_BYPASS_ADMIN_AUTH === false)', () => {
  assert.equal(TEMP_BYPASS_ADMIN_AUTH, false);
});

test('handleAdminPhase35Routes enforces 401 Clerk Admin auth on all Phase 3.5 /api/admin/* endpoints', async () => {
  const protectedEndpoints: Array<{ method: string; path: string; body?: unknown }> = [
    { method: 'GET', path: '/api/admin/recycle-bin' },
    { method: 'POST', path: '/api/admin/recycle-bin/1/restore', body: {} },
    { method: 'DELETE', path: '/api/admin/recycle-bin/1', body: { confirm: 'PURGE' } },
    { method: 'GET', path: '/api/admin/ai-usage' },
    { method: 'PUT', path: '/api/admin/ai-usage/cap', body: { dailyCap: 50 } },
    { method: 'GET', path: '/api/admin/translations/1/ta/versions' },
    { method: 'POST', path: '/api/admin/translations/1/ta/rollback', body: { versionId: 1 } },
    { method: 'GET', path: '/api/admin/anime/1/revisions' },
    { method: 'POST', path: '/api/admin/anime/1/revisions/1/restore', body: {} },
    { method: 'DELETE', path: '/api/admin/dub-reviews/1' },
  ];

  for (const ep of protectedEndpoints) {
    const req = new Request(`http://localhost:3000${ep.path}`, {
      method: ep.method,
      headers: { 'Content-Type': 'application/json' },
      ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
    });
    const res = await handleAdminPhase35Routes({
      request: req,
      env: { DB: undefined } as any,
      path: ep.path,
      method: ep.method,
      url: new URL(req.url),
      jsonResponse: mockJsonResponse,
    });
    assert.ok(res, `Expected response for ${ep.method} ${ep.path}`);
    assert.equal(res.status, 401, `Expected 401 Unauthorized for ${ep.method} ${ep.path}`);
  }
});

test('buildRecycleBinArchiveEntry normalizes valid payloads and rejects invalid entity types', () => {
  const entry = buildRecycleBinArchiveEntry({
    entity_type: 'anime',
    entity_id: 42,
    title: '  Naruto Shippuden  ',
    payload: { id: 42, title: 'Naruto Shippuden' },
    deleted_by: 'admin@anidub.in',
  });

  assert.equal(entry.entity_type, 'anime');
  assert.equal(entry.entity_id, '42');
  assert.equal(entry.title, 'Naruto Shippuden');
  assert.equal(entry.deleted_by, 'admin@anidub.in');
  assert.deepEqual(JSON.parse(entry.payload_json), { id: 42, title: 'Naruto Shippuden' });

  assert.throws(
    () =>
      buildRecycleBinArchiveEntry({
        entity_type: 'invalid_table' as any,
        entity_id: '1',
        payload: {},
      }),
    /Invalid recycle bin entity_type/
  );

  assert.throws(
    () =>
      buildRecycleBinArchiveEntry({
        entity_type: 'reviews',
        entity_id: '   ',
        payload: {},
      }),
    /entity_id is required/
  );
});

test('validateRecycleBinPurgeConfirmation requires exact uppercase PURGE', () => {
  assert.equal(validateRecycleBinPurgeConfirmation('PURGE').valid, true);
  assert.equal(validateRecycleBinPurgeConfirmation(' PURGE ').valid, true);
  assert.equal(validateRecycleBinPurgeConfirmation('purge').valid, false);
  assert.equal(validateRecycleBinPurgeConfirmation('DELETE').valid, false);
  assert.equal(validateRecycleBinPurgeConfirmation('').valid, false);
  assert.equal(validateRecycleBinPurgeConfirmation(null).valid, false);
});

test('generateFailedCsvRowsExport outputs only failed/duplicate rows with escaped error_reason column', () => {
  const csv = generateFailedCsvRowsExport([
    {
      rowNumber: 1,
      title: 'Valid Show',
      slug: 'valid-show',
      status: 'valid',
      errors: [],
      raw: { title: 'Valid Show', release_year: '2024' },
    },
    {
      rowNumber: 2,
      title: 'Solo Leveling',
      slug: 'solo-leveling',
      status: 'duplicate',
      errors: ['Slug "solo-leveling" already exists'],
      raw: { title: 'Solo Leveling', release_year: '2024' },
    },
    {
      rowNumber: 3,
      title: 'Bad, "Quoted" Show',
      slug: '',
      status: 'invalid',
      errors: ['Missing slug', 'Invalid year'],
      raw: { title: 'Bad, "Quoted" Show', release_year: 'abc' },
    },
  ]);

  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'title,release_year,error_reason');
  assert.equal(lines[1], 'Solo Leveling,2024,"Slug ""solo-leveling"" already exists"');
  assert.equal(lines[2], '"Bad, ""Quoted"" Show",abc,Missing slug; Invalid year');

  assert.equal(
    generateFailedCsvRowsExport([
      { rowNumber: 1, title: 'Ok', slug: 'ok', status: 'valid', errors: [] },
    ]),
    ''
  );
});

test('findPotentialCatalogDuplicates detects exact title, slug, and similar title matches while skipping pending items', () => {
  const catalog = [
    { id: 1, title: 'Jujutsu Kaisen', slug: 'jujutsu-kaisen', status: 'ongoing' },
    { id: 2, title: 'Jujutsu Kaisen Season 2', slug: 'jujutsu-kaisen-s2', status: 'completed' },
    { id: 3, title: 'Demon Slayer', slug: 'kimetsu-no-yaiba', status: 'completed' },
    { id: 99, title: 'Jujutsu Kaisen', slug: 'jujutsu-kaisen-pending', status: 'pending' },
  ];

  const exactAndSimilar = findPotentialCatalogDuplicates(
    { id: 100, title: 'Jujutsu Kaisen!', slug: 'jjk-new' },
    catalog
  );
  assert.equal(exactAndSimilar.length, 2);
  assert.equal(exactAndSimilar[0].id, 1);
  assert.equal(exactAndSimilar[0].matchType, 'exact_title');
  assert.equal(exactAndSimilar[1].id, 2);
  assert.equal(exactAndSimilar[1].matchType, 'similar_title');

  const slugMatch = findPotentialCatalogDuplicates(
    { id: 101, title: 'Kimetsu Yaiba Dub', slug: 'kimetsu-no-yaiba' },
    catalog
  );
  assert.equal(slugMatch.length, 1);
  assert.equal(slugMatch[0].id, 3);
  assert.equal(slugMatch[0].matchType, 'slug');
});

test('formatModerationRejectionSummary combines preset reason and moderator note cleanly', () => {
  assert.ok(REJECTION_REASON_PRESETS.includes('Duplicate Entry'));
  assert.ok(REJECTION_REASON_PRESETS.includes('Unverified Dub Claim'));

  const withBoth = formatModerationRejectionSummary(
    12,
    'Fake Show',
    'Unverified Dub Claim',
    'No Crunchyroll IN proof provided'
  );
  assert.equal(
    withBoth,
    'Rejected pending anime #12 (Fake Show) — Reason: Unverified Dub Claim | Note: No Crunchyroll IN proof provided'
  );

  const baseOnly = formatModerationRejectionSummary(15, 'Test Anime');
  assert.equal(baseOnly, 'Rejected pending anime #15 (Test Anime)');
});

test('checkOptimisticConcurrencyConflict detects stale timestamps and allows matching or absent timestamps', () => {
  assert.equal(
    checkOptimisticConcurrencyConflict('2026-05-01T10:00:00Z', '2026-05-01T10:00:00Z').conflict,
    false
  );
  const conflict = checkOptimisticConcurrencyConflict(
    '2026-05-01T10:00:00Z',
    '2026-05-01T10:05:00Z'
  );
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.currentDbUpdatedAt, '2026-05-01T10:05:00Z');
  assert.equal(checkOptimisticConcurrencyConflict(null, '2026-05-01T10:05:00Z').conflict, false);
});

test('computeAnimeRevisionDiff identifies changed fields and summarizes diff cleanly', () => {
  const diff = computeAnimeRevisionDiff(
    { title: 'Naruto', episodes_count: 220, dub_languages: ['Tamil'] },
    { title: 'Naruto', episodes_count: 221, dub_languages: ['Tamil', 'Hindi'] }
  );

  assert.equal(diff.changes.length, 2);
  assert.equal(diff.changes[0].field, 'episodes_count');
  assert.equal(diff.changes[0].before, 220);
  assert.equal(diff.changes[0].after, 221);
  assert.equal(diff.changes[1].field, 'dub_languages');
  assert.match(diff.summary, /episodes_count, dub_languages/);

  const noDiff = computeAnimeRevisionDiff({ title: 'Naruto' }, { title: 'Naruto' });
  assert.equal(noDiff.changes.length, 0);
  assert.match(noDiff.summary, /no tracked field changes/i);
});

test('checkDailyAiUsageQuota allows below cap and blocks when cap is reached', () => {
  const below = checkDailyAiUsageQuota(25, 100);
  assert.equal(below.allowed, true);
  assert.equal(below.remaining, 75);

  const atCap = checkDailyAiUsageQuota(100, 100);
  assert.equal(atCap.allowed, false);
  assert.equal(atCap.remaining, 0);

  const overCap = checkDailyAiUsageQuota(125, 100);
  assert.equal(overCap.allowed, false);
  assert.equal(overCap.remaining, 0);
});

test('scanExtendedDataHealth flags orphan franchise links, conflicting watch orders, unverified cast, and missing external IDs', () => {
  const report = scanExtendedDataHealth({
    animeRows: [
      { id: 1, title: 'Naruto', slug: 'naruto', mal_id: 20 },
      { id: 2, title: 'Naruto Shippuden', slug: 'naruto-shippuden' },
    ],
    franchiseRows: [
      { id: 10, franchise_key: 'naruto', anime_id: 1, watch_order: 1 },
      { id: 11, franchise_key: 'naruto', anime_id: 2, watch_order: 1 },
      { id: 12, franchise_key: 'naruto', anime_id: 999, watch_order: 3 },
    ],
    castRows: [
      {
        id: 50,
        anime_id: 1,
        character_name: 'Naruto Uzumaki',
        voice_actor_name: 'Verified Actor',
        language: 'Tamil',
        verified: 1,
      },
      {
        id: 51,
        anime_id: 2,
        character_name: 'Sasuke Uchiha',
        voice_actor_name: 'Pending Actor',
        language: 'Hindi',
        verified: 0,
      },
    ],
  });

  assert.equal(report.orphanFranchiseLinks.length, 1);
  assert.equal(report.orphanFranchiseLinks[0].anime_id, 999);

  assert.equal(report.conflictingWatchOrders.length, 1);
  assert.equal(report.conflictingWatchOrders[0].franchise_key, 'naruto');
  assert.equal(report.conflictingWatchOrders[0].watch_order, 1);
  assert.deepEqual(report.conflictingWatchOrders[0].anime_ids, [1, 2]);

  assert.equal(report.unverifiedCastEntries.length, 1);
  assert.equal(report.unverifiedCastEntries[0].id, 51);
  assert.equal(report.unverifiedCastEntries[0].anime_title, 'Naruto Shippuden');

  assert.equal(report.missingExternalIds.length, 1);
  assert.equal(report.missingExternalIds[0].anime_id, 2);
});

test('computeHighDemandMissingDubs ranks high-demand titles missing verified Tamil/Hindi/Telugu dubs', () => {
  const ranked = computeHighDemandMissingDubs(
    [
      { id: 1, title: 'Fully Dubbed Hit', slug: 'fully-dubbed' },
      { id: 2, title: 'Needs Tamil & Telugu', slug: 'needs-tamil-telugu' },
      { id: 3, title: 'Top Missing Dub', slug: 'top-missing-dub' },
    ],
    [
      { anime_id: 1, detail_views: 500, watchlist_adds: 100 },
      { anime_id: 2, detail_views: 80, watchlist_adds: 20, ott_clicks: 10 },
      { anime_id: 3, detail_views: 250, watchlist_adds: 50, translation_requests: 30 },
    ],
    [
      { anime_id: 1, language: 'Tamil', verified: 1, status: 'complete' },
      { anime_id: 1, language: 'Hindi', verified: 1, status: 'complete' },
      { anime_id: 1, language: 'Telugu', verified: 1, status: 'partial' },
      { anime_id: 2, language: 'Hindi', verified: 1, status: 'complete' },
      { anime_id: 3, language: 'Tamil', verified: 0, status: 'complete' }, // unverified should not count
    ]
  );

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].anime_id, 3);
  assert.equal(ranked[0].total_demand_events, 330);
  assert.deepEqual(ranked[0].missing_languages, ['Tamil', 'Hindi', 'Telugu']);

  assert.equal(ranked[1].anime_id, 2);
  assert.equal(ranked[1].total_demand_events, 110);
  assert.deepEqual(ranked[1].verified_languages, ['Hindi']);
  assert.deepEqual(ranked[1].missing_languages, ['Tamil', 'Telugu']);
});

test('validateContentDemandEvent supports Phase 3.5 anime_detail_view, watchlist_add, and translation_request', () => {
  const detail = validateContentDemandEvent({
    event_type: 'anime_detail_view',
    anime_id: '42',
  });
  assert.equal(detail.ok, true);

  const watchlist = validateContentDemandEvent({
    event_type: 'watchlist_add',
    anime_id: '42',
  });
  assert.equal(watchlist.ok, true);

  const translation = validateContentDemandEvent({
    event_type: 'translation_request',
    anime_id: '42',
    language_code: 'ta',
  });
  assert.equal(translation.ok, true);
  if (translation.ok) {
    assert.equal(translation.data.language_code, 'ta');
  }

  const missingAnimeId = validateContentDemandEvent({
    event_type: 'anime_detail_view',
  });
  assert.equal(missingAnimeId.ok, false);
});
