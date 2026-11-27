import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildIndianDubIntelligenceCards,
  classifyIndianDubStatus,
  computeEpisodeProgressStats,
  createWatchedSetFromCount,
  getEpisodeRanges,
  getLanguageScriptBadge,
  markAllEpisodesWatched,
  readPersonalWatchStatus,
  readStoredWatchedEpisodesBySeason,
  resolveSingleHeroRating,
  shouldResetDetailTabOnPropChange,
  toggleEpisodeNumber,
  writePersonalWatchStatus,
  writeStoredWatchedEpisodesBySeason,
} from '../src/utils/animeDetailIntelligence';
import { buildDubProgressBreakdown } from '../src/utils/dubProgress';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

test('Details 2.0: Tab-reset guard ONLY returns true when animeId changes to a different anime', () => {
  assert.equal(shouldResetDetailTabOnPropChange(null, '101'), true);
  assert.equal(shouldResetDetailTabOnPropChange('101', '101'), false);
  assert.equal(shouldResetDetailTabOnPropChange('101', '202'), true);
  assert.equal(shouldResetDetailTabOnPropChange('202', null), false);
});

test('Details 2.0: Indian Dub Intelligence never infers Complete from a language tag alone', () => {
  const listedOnly = classifyIndianDubStatus({
    isListed: true,
    episodesDubbed: null,
    totalEpisodes: 24,
    animePublicationStatus: 'Completed',
  });
  assert.equal(listedOnly, 'Listed');

  const announced = classifyIndianDubStatus({
    isListed: true,
    episodesDubbed: null,
    totalEpisodes: null,
    animePublicationStatus: 'Upcoming',
  });
  assert.equal(announced, 'Announced');

  const partial = classifyIndianDubStatus({
    isListed: true,
    episodesDubbed: 12,
    totalEpisodes: 24,
    animePublicationStatus: 'Airing',
  });
  assert.equal(partial, 'Partial');

  const complete = classifyIndianDubStatus({
    isListed: true,
    episodesDubbed: 24,
    totalEpisodes: 24,
    animePublicationStatus: 'Completed',
  });
  assert.equal(complete, 'Complete');

  const unverified = classifyIndianDubStatus({
    isListed: false,
    episodesDubbed: null,
    totalEpisodes: null,
  });
  assert.equal(unverified, 'Unverified');
});

test('Details 2.0: buildIndianDubIntelligenceCards attaches native scripts, honest statuses, and real OTT platforms', () => {
  assert.equal(getLanguageScriptBadge('Tamil'), 'த');
  assert.equal(getLanguageScriptBadge('Hindi'), 'हि');
  assert.equal(getLanguageScriptBadge('Telugu'), 'తె');
  assert.equal(getLanguageScriptBadge('Malayalam'), 'മ');
  assert.equal(getLanguageScriptBadge('Kannada'), 'ಕ');
  assert.equal(getLanguageScriptBadge('Bengali'), 'বা');

  const animeRecord = {
    id: '42',
    title: 'Jujutsu Kaisen',
    status: 'Completed' as const,
    episodesCount: 24,
    languages: ['Tamil', 'Hindi', 'Telugu'],
    platforms: ['Crunchyroll', 'Netflix'],
    dub_matrix: JSON.stringify([
      {
        season: 1,
        total_episodes: 24,
        languages: {
          Hindi: 24,
          Tamil: 12,
        },
      },
    ]),
  };

  const dubProgress = buildDubProgressBreakdown(animeRecord);
  const cards = buildIndianDubIntelligenceCards(animeRecord, dubProgress);

  assert.equal(cards.length, 3);

  const tamil = cards.find((c) => c.language === 'Tamil')!;
  assert.equal(tamil.scriptBadge, 'த');
  assert.equal(tamil.status, 'Partial');
  assert.equal(tamil.episodesDubbed, 12);
  assert.equal(tamil.totalEpisodes, 24);
  assert.equal(tamil.progressPercent, 50);
  assert.deepEqual(tamil.platforms, ['Crunchyroll', 'Netflix']);

  const hindi = cards.find((c) => c.language === 'Hindi')!;
  assert.equal(hindi.scriptBadge, 'हि');
  assert.equal(hindi.status, 'Complete');
  assert.equal(hindi.progressPercent, 100);

  // Telugu is listed in anime.languages without episode counts -> MUST be Listed, never Complete!
  const telugu = cards.find((c) => c.language === 'Telugu')!;
  assert.equal(telugu.scriptBadge, 'తె');
  assert.equal(telugu.status, 'Listed');
  assert.equal(telugu.episodesDubbed, null);
  assert.equal(telugu.progressPercent, null);
});

test('Details 2.0: Single hero rating resolves catalog or community rating cleanly without duplication', () => {
  assert.deepEqual(resolveSingleHeroRating({ rating: 8.74, userRatingsCount: 12 }), {
    value: 8.7,
    scale: 10,
    source: 'catalog',
    voteCount: 12,
  });

  assert.deepEqual(
    resolveSingleHeroRating({ rating: 0, userRatingsCount: 4, userRatingsSum: 34 }),
    {
      value: 8.5,
      scale: 10,
      source: 'community',
      voteCount: 4,
    }
  );

  assert.equal(resolveSingleHeroRating({ rating: 0, userRatingsCount: 0 }), null);
});

test('Details 2.0: Interactive Episode Grid toggle, Continue Watching, Mark All, Range Chunks & Storage Sync', () => {
  let watched: number[] = [];
  watched = toggleEpisodeNumber(watched, 1, 12);
  watched = toggleEpisodeNumber(watched, 3, 12);
  assert.deepEqual(watched, [1, 3]);

  // Continue watching finds lowest unwatched episode (2)
  const midStats = computeEpisodeProgressStats(watched, 12);
  assert.equal(midStats.watchedCount, 2);
  assert.equal(midStats.percent, 17);
  assert.equal(midStats.nextEpisode, 2);
  assert.equal(midStats.isCompleted, false);

  // Toggle ep 3 off
  watched = toggleEpisodeNumber(watched, 3, 12);
  assert.deepEqual(watched, [1]);

  // Mark all watched
  const allWatched = markAllEpisodesWatched(12);
  assert.equal(allWatched.length, 12);
  const doneStats = computeEpisodeProgressStats(allWatched, 12);
  assert.equal(doneStats.percent, 100);
  assert.equal(doneStats.nextEpisode, null);
  assert.equal(doneStats.isCompleted, true);

  // Chunk ranges for long series
  const ranges = getEpisodeRanges(120, 50);
  assert.equal(ranges.length, 3);
  assert.equal(ranges[0].label, '1–50');
  assert.equal(ranges[2].label, '101–120');

  // Dual-write localStorage hydration & legacy compatibility
  const storage = createMemoryStorage();
  const total = writeStoredWatchedEpisodesBySeason('99', { 1: [1, 2, 5], 2: [1] }, storage);
  assert.equal(total, 4);
  assert.deepEqual(readStoredWatchedEpisodesBySeason('99', storage), { 1: [1, 2, 5], 2: [1] });
  assert.equal(JSON.parse(storage.getItem('anime_progress') || '{}')['99'], 4);
  assert.deepEqual(JSON.parse(storage.getItem('anime_season_progress_v2') || '{}')['99'], {
    1: 3,
    2: 1,
  });

  // Fallback hydration from legacy anime_progress only
  const legacyStorage = createMemoryStorage();
  legacyStorage.setItem('anime_progress', JSON.stringify({ '77': 3 }));
  assert.deepEqual(readStoredWatchedEpisodesBySeason('77', legacyStorage), {
    1: createWatchedSetFromCount(3, null),
  });

  // Personal watch status persistence
  writePersonalWatchStatus('99', 'Watching', storage);
  assert.equal(readPersonalWatchStatus('99', 'Plan to Watch', storage), 'Watching');
});

test('Details 2.0: Architecture contracts — tab reset isolation, dedicated page route, and /translation alias', () => {
  const detailCode = fs.readFileSync(
    path.join(process.cwd(), 'src/components/AnimeDetailPage.tsx'),
    'utf8'
  );
  // Root-cause fix: activeTab initialization effect must NOT include followedIds
  assert.equal(detailCode.includes('}, [anime?.id, followedIds]);'), false);
  assert.ok(detailCode.includes('shouldResetDetailTabOnPropChange'));
  assert.ok(detailCode.includes('data-testid="indian-dub-intelligence-grid"'));
  assert.ok(detailCode.includes('data-testid="episode-grid"'));
  assert.ok(detailCode.includes('data-testid="continue-watching-indicator"'));
  assert.ok(detailCode.includes('data-testid="mark-all-watched-btn"'));
  assert.ok(detailCode.includes('data-testid="hero-single-rating"'));

  const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appCode.includes('<AnimeDetailPage'));
  assert.ok(appCode.includes('asPage={true}'));

  const routeCode = fs.readFileSync(
    path.join(process.cwd(), 'src/server/routes/translationRoutes.ts'),
    'utf8'
  );
  assert.ok(routeCode.includes('translations?'));
});
