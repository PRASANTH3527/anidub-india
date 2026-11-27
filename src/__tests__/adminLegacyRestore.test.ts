import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvTextToAnimeRows,
  computeGenreDistributionFromCatalog,
  rankGenreCounts,
  evaluateImdbRatingDiff,
  buildSafeImdbBatchUpdates,
  redactSensitiveTokens,
  type ImdbRatingCandidate,
} from '../utils/adminLegacyRestore';
import {
  ADMIN_QUICK_PILL_TABS,
  ADMIN_TOOLS_TABS,
  ADMIN_MORE_TABS,
  resolveMobileAdminActiveGroup,
} from '../utils/adminShellLayout';
import { TEMP_BYPASS_ADMIN_AUTH } from '../utils/auth';
import { handleAdminRoutes } from '../server/routes/adminRoutes';
import { handleAdminPhase35Routes } from '../server/routes/adminPhase35Routes';
import { createJsonResponder, type CloudflareEnv } from '../server/routes/shared';

describe('Restored Legacy Admin Features — Pure Logic & Security', () => {
  it('parses pasted CSV text with quoted commas & pipes while leaving blank dub languages unverified', () => {
    const csv =
      '\uFEFFTitle,Rating,Release Year,Genres,Languages,Platforms\n' +
      '"Solo Leveling, Season 1",8.8,2024,"Action | Fantasy","Hindi | Tamil | Telugu",Crunchyroll\n' +
      '"Unverified Dub Anime",7.9,2025,"Sci-Fi, Mystery","",""\n';

    const parsed = parseCsvTextToAnimeRows(csv);
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0].title, 'Solo Leveling, Season 1');
    assert.equal(parsed.rows[0].languages, 'Hindi | Tamil | Telugu');
    assert.equal(parsed.rows[1].title, 'Unverified Dub Anime');
    // Must never auto-invent Hindi/Tamil for empty language rows
    assert.equal(parsed.rows[1].languages, '');
    assert.equal(parsed.rows[1].platforms, '');
  });

  it('returns clear error for empty or header-only CSV paste input', () => {
    const emptyRes = parseCsvTextToAnimeRows('Title,Rating\n');
    assert.equal(emptyRes.rows.length, 0);
    assert.ok(emptyRes.error && emptyRes.error.includes('missing data rows'));
  });

  it('computes accurate Genre Distribution counts from real catalog rows without fabrication', () => {
    const catalog = [
      { genres: 'Action, Fantasy, Action' }, // duplicate genre on same anime counted once
      { genres: 'Action | Sci-Fi | Adventure' },
      { genres: ['Fantasy', 'Slice of Life'] },
      { genres: '' },
      { genres: null },
    ];

    const dist = computeGenreDistributionFromCatalog(catalog, 5);
    assert.equal(dist.genreCounts.Action, 2);
    assert.equal(dist.genreCounts.Fantasy, 2);
    assert.equal(dist.genreCounts['Sci-Fi'], 1);
    assert.equal(dist.genreCounts['Slice of Life'], 1);
    assert.equal(dist.ranked[0].genre, 'Action');
    assert.equal(dist.ranked[0].count, 2);
    assert.equal(dist.ranked[0].percentage, 40);

    // Empty catalog produces empty ranked list (zero fake genres)
    assert.deepEqual(rankGenreCounts({}, 0), []);
  });

  it('evaluates IMDb rating diffs strictly and builds safe batch payloads rejecting invalid scores', () => {
    const missingDiff = evaluateImdbRatingDiff(null, 8.7);
    assert.equal(missingDiff.status, 'missing_current');
    assert.equal(missingDiff.fetchedRating, 8.7);

    const outdatedDiff = evaluateImdbRatingDiff(8.5, 8.9);
    assert.equal(outdatedDiff.status, 'outdated');
    assert.equal(outdatedDiff.delta, 0.4);

    const matchedDiff = evaluateImdbRatingDiff(8.7, 8.7);
    assert.equal(matchedDiff.status, 'matched');
    assert.equal(matchedDiff.delta, 0);

    const notFoundDiff = evaluateImdbRatingDiff(8.5, 'N/A');
    assert.equal(notFoundDiff.status, 'not_found');
    assert.equal(notFoundDiff.fetchedRating, null);

    const candidates: ImdbRatingCandidate[] = [
      {
        animeId: 10,
        title: 'Valid Match',
        currentRating: 8.5,
        fetchedRating: 8.9,
        delta: 0.4,
        source: 'IMDb (OMDb)',
        externalId: 'tt1234567',
        status: 'outdated',
      },
      {
        animeId: 11,
        title: 'No Match',
        currentRating: 8.5,
        fetchedRating: null,
        delta: null,
        source: 'Not Found',
        status: 'not_found',
      },
      {
        animeId: 12,
        title: 'Invalid Score',
        currentRating: 8.5,
        fetchedRating: 15.2,
        delta: null,
        source: 'Invalid',
        status: 'outdated',
      },
    ];

    const updates = buildSafeImdbBatchUpdates(candidates, [10, 11, 12]);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], {
      animeId: 10,
      rating: 8.9,
      externalId: 'tt1234567',
    });
  });

  it('redacts Telegram bot tokens and API keys from error strings', () => {
    const raw =
      'Fetch failed for https://api.telegram.org/bot123456789:AAHfakeSecretToken_999/sendMessage?apikey=xyz123';
    const safe = redactSensitiveTokens(raw);
    assert.equal(safe.includes('AAHfakeSecretToken_999'), false);
    assert.equal(safe.includes('xyz123'), false);
    assert.ok(safe.includes('bot[REDACTED]'));
    assert.ok(safe.includes('apikey=[REDACTED]'));
  });

  it('keeps all restored legacy and Phase 1–3.5 tools reachable in Quick-Tab bar and Tools/More groups', () => {
    const quickIds = new Set(ADMIN_QUICK_PILL_TABS.map((t) => t.id));
    for (const required of [
      'overview',
      'catalog',
      'dubs',
      'backup',
      'imdb_checker',
      'data_health',
      'translations',
      'franchises',
      'cast',
      'moderation',
      'analytics',
      'activity_log',
      'recycle_bin',
      'settings',
    ] as const) {
      assert.ok(quickIds.has(required), `Missing ${required} in ADMIN_QUICK_PILL_TABS`);
    }

    assert.equal(resolveMobileAdminActiveGroup('imdb_checker'), 'tools');
    assert.equal(resolveMobileAdminActiveGroup('data_health'), 'tools');
    assert.equal(resolveMobileAdminActiveGroup('translations'), 'tools');
    assert.equal(resolveMobileAdminActiveGroup('backup'), 'more');
    assert.equal(resolveMobileAdminActiveGroup('settings'), 'more');
    assert.ok(ADMIN_TOOLS_TABS.includes('imdb_checker'));
    assert.ok(ADMIN_MORE_TABS.includes('settings'));
  });

  it('enforces strict Clerk Admin auth (401 without session) on restored Telegram & IMDb endpoints', async () => {
    assert.equal(TEMP_BYPASS_ADMIN_AUTH, false);

    const mockEnv: CloudflareEnv = { DB: null };

    const checkRoute = async (
      handler: typeof handleAdminRoutes,
      path: string,
      method: 'GET' | 'POST'
    ) => {
      const request = new Request(`https://anidub.in${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({}) } : {}),
      });
      const res = await handler({
        request,
        env: mockEnv,
        url: new URL(request.url),
        path,
        method,
        jsonResponse: createJsonResponder(request, mockEnv),
      });
      assert.ok(res, `Expected response for ${method} ${path}`);
      assert.equal(res.status, 401, `Expected 401 Unauthorized for ${method} ${path}`);
    };

    await checkRoute(handleAdminRoutes, '/api/telegram/status', 'GET');
    await checkRoute(handleAdminRoutes, '/api/telegram/settings', 'POST');
    await checkRoute(handleAdminRoutes, '/api/telegram/test', 'POST');
    await checkRoute(handleAdminPhase35Routes, '/api/admin/imdb-ratings/check', 'POST');
    await checkRoute(handleAdminPhase35Routes, '/api/admin/imdb-ratings/apply', 'POST');
  });
});
