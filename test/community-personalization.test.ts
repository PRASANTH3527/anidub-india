import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computePersonalAnimeStats } from '../src/utils/personalStats';

test('Feature 3: Personal Anime Stats ("My Anime Journey") computes honest metrics and empty state', () => {
  // 1. Empty state when user has nothing logged
  const emptyStats = computePersonalAnimeStats({
    watchlistIds: [],
    catalogItems: [],
    progressMap: {},
    watchedIds: [],
  });
  assert.equal(emptyStats.hasLoggedActivity, false);
  assert.equal(emptyStats.completedCount, 0);
  assert.equal(emptyStats.episodesWatched, 0);
  assert.equal(emptyStats.watchingCount, 0);
  assert.equal(emptyStats.planToWatchCount, 0);

  // 2. Populated watchlist + logged episode progress
  const catalog = [
    { id: 1, title: 'Solo Leveling', episodes_count: 12, genres: 'Action, Fantasy', languages: 'Tamil, Hindi, Japanese' },
    { id: 2, title: 'Dandadan', episodes_count: 12, genres: 'Action, Sci-Fi', languages: 'Tamil, Telugu' },
    { id: 3, title: 'Spy x Family', episodes_count: 25, genres: 'Comedy, Action', languages: 'Tamil, English' },
    { id: 4, title: 'Frieren', episodes_count: 28, genres: 'Fantasy, Drama', languages: 'Hindi' },
  ];

  const stats = computePersonalAnimeStats({
    watchlistIds: [1, 2, 3, 4],
    catalogItems: catalog,
    progressMap: {
      1: { animeId: 1, season: 1, episode: 12, totalEpisodes: 12, completed: true, updatedAt: '2026-01-01T00:00:00Z' },
      2: { animeId: 2, season: 1, episode: 5, totalEpisodes: 12, completed: false, updatedAt: '2026-01-02T00:00:00Z' },
    },
    watchedIds: [3], // legacy completed flag
  });

  assert.equal(stats.hasLoggedActivity, true);
  assert.equal(stats.completedCount, 2); // #1 and #3
  assert.equal(stats.episodesWatched, 17); // 12 + 5
  assert.equal(stats.watchingCount, 1); // #2
  assert.equal(stats.planToWatchCount, 1); // #4

  // Favorite genres: Action (3), Fantasy (2), ...
  assert.equal(stats.favoriteGenres[0].genre, 'Action');
  assert.equal(stats.favoriteGenres[0].count, 3);
  assert.equal(stats.favoriteGenres[0].percent, 100);

  // Preferred Indian dub languages
  const langNames = stats.preferredLanguages.map((l) => l.language);
  assert.equal(langNames.includes('Japanese'), false);
  assert.equal(langNames.includes('English'), false);
  assert.equal(stats.preferredLanguages[0].language, 'Tamil');
  assert.equal(stats.preferredLanguages[0].percent, 50);
  const sumPct = stats.preferredLanguages.reduce((sum, l) => sum + l.percent, 0);
  assert.equal(sumPct, 100);

  // Source honesty check: no fabricated watch-hours or OTT playback tracking claims
  const statsComponentSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/PersonalAnimeStats.tsx'),
    'utf8'
  );
  assert.ok(statsComponentSrc.includes('Anime Completed'));
  assert.ok(statsComponentSrc.includes('Episodes Watched'));
  assert.ok(statsComponentSrc.includes('Plan to Watch'));
  assert.equal(/hours watched|watch time/i.test(statsComponentSrc), false);
});
