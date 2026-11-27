import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDubMatrixEntry,
  parseNullableEpisodeCount,
  normalizeAniListCandidate,
  normalizeJikanCandidate,
  computeMetadataFieldDiffs,
  scanCatalogDataHealth,
  validateCsvDryRunRows,
} from '../utils/adminOpsPro';
import { handleAdminOpsProRoutes } from '../server/routes/adminOpsProRoutes';
import { TEMP_BYPASS_ADMIN_AUTH } from '../utils/auth';

describe('AniDub India — Admin Dashboard 2.0 (Phase 2: Content Operations Pro)', () => {
  it('1. Keeps strict Clerk Admin authentication active (TEMP_BYPASS_ADMIN_AUTH === false)', () => {
    assert.equal(TEMP_BYPASS_ADMIN_AUTH, false);
  });

  it('2. Distinguishes 0 episodes from NULL (unknown) and blocks Complete status without episode counts', () => {
    assert.equal(parseNullableEpisodeCount('').value, null);
    assert.equal(parseNullableEpisodeCount(null).value, null);
    assert.equal(parseNullableEpisodeCount(0).value, 0);
    assert.equal(parseNullableEpisodeCount('12').value, 12);

    // Complete without dubbed_episodes must fail
    const badComplete = validateDubMatrixEntry({
      anime_id: '101',
      season_number: 1,
      language_code: 'ta',
      availability_status: 'complete',
      dubbed_episodes: null,
      total_episodes: 12,
    });
    assert.equal(badComplete.ok, false);
    if (!badComplete.ok) {
      assert.match(badComplete.error || '', /Cannot mark dub status as "Complete"/i);
    }

    // Complete with dubbed_episodes < total_episodes must fail
    const partialMarkedComplete = validateDubMatrixEntry({
      anime_id: '101',
      season_number: 1,
      language_code: 'hi',
      availability_status: 'complete',
      dubbed_episodes: 6,
      total_episodes: 12,
    });
    assert.equal(partialMarkedComplete.ok, false);

    // Valid Complete row
    const validComplete = validateDubMatrixEntry({
      anime_id: '101',
      season_number: 1,
      language_code: 'ta',
      platform_name: 'Crunchyroll',
      availability_status: 'complete',
      dubbed_episodes: 12,
      total_episodes: 12,
      source_url: 'https://www.crunchyroll.com/series/GT000',
    });
    assert.equal(validComplete.ok, true);
    if (validComplete.ok) {
      assert.equal(validComplete.data.dubbed_episodes, 12);
      assert.equal(validComplete.data.total_episodes, 12);
    }
  });

  it('3. Normalizes AniList and Jikan candidates and computes Field-Level Diffs without overwriting manually edited fields by default', () => {
    const anilistCand = normalizeAniListCandidate({
      id: 151807,
      title: { english: 'Solo Leveling', romaji: 'Ore dake Level Up na Ken', native: '나 혼자만 레벨업' },
      coverImage: { extraLarge: 'https://s4.anilist.co/poster.jpg' },
      bannerImage: 'https://s4.anilist.co/banner.jpg',
      seasonYear: 2024,
      format: 'TV',
      episodes: 12,
      genres: ['Action', 'Fantasy'],
      studios: { nodes: [{ name: 'A-1 Pictures' }] },
      description: '<i>Sung Jinwoo</i> awakens.',
    });

    assert.ok(anilistCand);
    assert.equal(anilistCand.title, 'Solo Leveling');
    assert.equal(anilistCand.studio, 'A-1 Pictures');
    assert.equal(anilistCand.episodes, 12);
    assert.equal(anilistCand.synopsis, 'Sung Jinwoo awakens.');

    const jikanCand = normalizeJikanCandidate({
      mal_id: 52299,
      title_english: 'Solo Leveling',
      title: 'Ore dake Level Up na Ken',
      images: { jpg: { large_image_url: 'https://cdn.myanimelist.net/poster.jpg' } },
      year: 2024,
      type: 'TV',
      episodes: 12,
      studios: [{ name: 'A-1 Pictures' }],
      genres: [{ name: 'Action' }],
      synopsis: 'Hunters battle monsters. [Written by MAL Rewrite]',
    });
    assert.ok(jikanCand);
    assert.equal(jikanCand.synopsis, 'Hunters battle monsters.');

    // Diff computation: existing synopsis is protected (defaultSelected: false), empty banner is selected (defaultSelected: true)
    const diffs = computeMetadataFieldDiffs(
      {
        title: 'Solo Leveling',
        synopsis: 'Custom manual Indian editorial synopsis.',
        banner_image: '',
      },
      anilistCand
    );

    const synopsisDiff = diffs.find((d) => d.field === 'synopsis');
    assert.ok(synopsisDiff);
    assert.equal(synopsisDiff.hasCurrentValue, true);
    assert.equal(synopsisDiff.defaultSelected, false);

    const bannerDiff = diffs.find((d) => d.field === 'banner_image');
    assert.ok(bannerDiff);
    assert.equal(bannerDiff.hasCurrentValue, false);
    assert.equal(bannerDiff.defaultSelected, true);
  });

  it('4. Catalog Data Health & QA Scanner detects duplicates, missing artwork, unverified dubs, stale verification, and missing translations', () => {
    const sampleCatalog = [
      {
        id: 1,
        title: 'Dandadan',
        cover_image: '/logo.png',
        banner_image: '',
        synopsis: 'Short',
        languages: 'Hindi, Tamil',
        platform: '',
        episodes_count: 12,
        last_verified_at: '2023-01-01',
      },
      {
        id: 2,
        title: 'Dandadan!',
        cover_image: 'https://s4.anilist.co/dandadan.jpg',
        banner_image: 'https://s4.anilist.co/dandadan-banner.jpg',
        synopsis: 'A complete verified synopsis with more than twenty five characters.',
        languages: 'Hindi',
        platform: 'Crunchyroll',
        official_source_url: 'https://www.crunchyroll.com/dandadan',
        episodes_count: 12,
        last_verified_at: new Date().toISOString().slice(0, 10),
      },
    ];

    const report = scanCatalogDataHealth(sampleCatalog, {
      translationCountsByAnime: { '2': 6 },
      nowMs: Date.now(),
    });

    assert.equal(report.totalScanned, 2);
    assert.ok(report.countsByCategory.duplicate_titles >= 2);
    assert.ok(report.countsByCategory.missing_artwork >= 1);
    assert.ok(report.countsByCategory.missing_synopsis >= 1);
    assert.ok(report.countsByCategory.unverified_dubs >= 1);
    assert.ok(report.countsByCategory.stale_verification >= 1);
    assert.ok(report.countsByCategory.missing_translations >= 1);
  });

  it('5. Safe CSV Import Dry-Run detects duplicates, missing titles, and never auto-populates false dub language defaults', () => {
    const existing = [{ id: 10, title: 'Naruto', slug: 'naruto' }];
    const summary = validateCsvDryRunRows(
      [
        { title: 'Bleach: Thousand-Year Blood War', releaseYear: '2022', rating: '9.0' },
        { title: 'Naruto', releaseYear: '2002' },
        { title: '', releaseYear: 'invalid-year' },
      ],
      existing
    );

    assert.equal(summary.totalRows, 3);
    assert.equal(summary.validCount, 1);
    assert.equal(summary.duplicateCount, 1);
    assert.equal(summary.invalidCount, 1);
    // Verify valid row did NOT get false Tamil/Hindi/Telugu defaults when languages was omitted
    assert.equal(summary.rows[0].languages, '');
  });

  it('6. Enforces strict 401 Clerk Admin authentication on all new Phase 2 /api/admin/* endpoints', async () => {
    const protectedEndpoints: Array<{ method: string; path: string }> = [
      { method: 'GET', path: '/api/admin/metadata-search?q=naruto' },
      { method: 'GET', path: '/api/admin/dub-matrix' },
      { method: 'PUT', path: '/api/admin/dub-matrix/bulk' },
      { method: 'GET', path: '/api/admin/data-health' },
      { method: 'POST', path: '/api/admin/translations/generate' },
      { method: 'PATCH', path: '/api/admin/translations/1/ta/lock' },
      { method: 'GET', path: '/api/admin/moderation-inbox' },
      { method: 'PATCH', path: '/api/admin/dub-reviews/1' },
      { method: 'POST', path: '/api/admin/import-csv/dry-run' },
      { method: 'GET', path: '/api/admin/activity-logs' },
    ];

    for (const ep of protectedEndpoints) {
      const reqUrl = `http://localhost:3000${ep.path}`;
      const request = new Request(reqUrl, { method: ep.method });
      const url = new URL(reqUrl);
      const res = await handleAdminOpsProRoutes({
        request,
        env: { DB: undefined } as any,
        url,
        path: url.pathname,
        method: ep.method,
        jsonResponse: (data, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
      });

      assert.ok(res, `Expected response for ${ep.method} ${ep.path}`);
      assert.equal(res.status, 401, `Expected 401 Unauthorized for unauthenticated ${ep.method} ${ep.path}`);
    }
  });
});
