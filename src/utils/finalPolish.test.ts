import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCanonicalOttName,
  normalizeCanonicalOttList,
  matchesSelectedPlatforms,
} from './ottHub';
import {
  readScopedString,
  writeScopedString,
  readScopedJson,
  writeScopedJson,
  transitionAccountStorage,
  getActiveAccountId,
} from './accountIsolation';
import {
  expandSearchQueryVariants,
  matchesAnimeSearchQuery,
  parseFiltersFromSearchParams,
  buildShareableFilterQuery,
  readPreferredLanguage,
  writePreferredLanguage,
  readRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from './searchFilterState';
import {
  LIBRARY_STATUSES,
  readLibraryStatusMap,
  setAnimeLibraryStatus,
  removeAnimeLibraryStatus,
  resolveEffectiveLibraryStatus,
  buildWatchlistCsv,
} from './libraryStatus';
import { buildAnimeComparison } from './compareAnime';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  keys(): string[] {
    return Array.from(this.map.keys());
  }
}

test('OTT Naming Normalization maps legacy Indian OTT names canonically without guessing unverified entries', () => {
  assert.equal(normalizeCanonicalOttName('JioCinema'), 'JioHotstar');
  assert.equal(normalizeCanonicalOttName('Disney+ Hotstar'), 'JioHotstar');
  assert.equal(normalizeCanonicalOttName('Hotstar'), 'JioHotstar');
  assert.equal(normalizeCanonicalOttName('JioHotstar'), 'JioHotstar');
  assert.equal(normalizeCanonicalOttName('Amazon Prime Video'), 'Prime Video');
  assert.equal(normalizeCanonicalOttName('SonyLIV'), 'Sony LIV');
  assert.equal(normalizeCanonicalOttName('YouTube (Muse India)'), 'Muse India');

  // Strict honesty: blank or placeholder values stay empty
  assert.equal(normalizeCanonicalOttName(''), '');
  assert.equal(normalizeCanonicalOttName('Not verified'), '');
  assert.equal(normalizeCanonicalOttName('TBA'), '');
  assert.equal(normalizeCanonicalOttName(null), '');

  // Deduplicates merged legacy variants on the same anime record
  assert.deepEqual(
    normalizeCanonicalOttList({ platform: 'JioCinema | Disney+ Hotstar | Crunchyroll' }),
    ['JioHotstar', 'Crunchyroll']
  );
  // Never fabricates Crunchyroll for unverified records
  assert.deepEqual(normalizeCanonicalOttList({ platform: '' }), []);
  assert.equal(matchesSelectedPlatforms({ platform: 'JioCinema' }, ['JioHotstar']), true);
  assert.equal(matchesSelectedPlatforms({ platform: '' }, ['Crunchyroll']), false);
});

test('Saved language preference, shareable filter URLs, English/Japanese aliases, and recent searches', () => {
  const storage = new MemoryStorage();

  // Saved language preference per account
  assert.equal(readPreferredLanguage('user_1', storage), 'All');
  assert.equal(writePreferredLanguage('tamil', 'user_1', storage), 'Tamil');
  assert.equal(readPreferredLanguage('user_1', storage), 'Tamil');
  assert.equal(readPreferredLanguage('user_2', storage), 'All');

  // Shareable filter URL serialization & parsing
  const qs = buildShareableFilterQuery({
    search: 'Demon Slayer',
    language: 'Tamil',
    platform: 'JioCinema',
    genre: 'Action',
    sort: 'rating',
  });
  assert.equal(qs, 'q=Demon+Slayer&lang=Tamil&ott=JioHotstar&genre=Action&sort=rating');

  const parsed = parseFiltersFromSearchParams(`?${qs}`);
  assert.deepEqual(parsed, {
    search: 'Demon Slayer',
    language: 'Tamil',
    platform: 'JioHotstar',
    genre: 'Action',
    sort: 'rating',
  });

  // Defaults are omitted from shareable URLs
  assert.equal(
    buildShareableFilterQuery({
      language: 'All',
      platform: 'All Platforms',
      genre: 'All Genres',
      sort: 'popularity',
    }),
    ''
  );

  // English <-> Japanese/Romaji alias expansion and matching
  const variants = expandSearchQueryVariants('Kimetsu no Yaiba');
  assert.ok(variants.includes('demon slayer'));
  assert.equal(
    matchesAnimeSearchQuery({ title: 'Demon Slayer: Kimetsu no Yaiba', genres: 'Action' }, 'kimetsu'),
    true
  );
  assert.equal(
    matchesAnimeSearchQuery({ title: 'Attack on Titan', genres: 'Action, Drama' }, 'Shingeki no Kyojin'),
    true
  );
  assert.equal(
    matchesAnimeSearchQuery({ title: 'My Hero Academia', genres: 'Shonen' }, 'boku no hero'),
    true
  );

  // Recent searches dedupe, cap, remove, clear
  addRecentSearch('Naruto', 'user_1', storage);
  addRecentSearch('Demon Slayer', 'user_1', storage);
  addRecentSearch('naruto', 'user_1', storage);
  assert.deepEqual(readRecentSearches('user_1', storage), ['naruto', 'Demon Slayer']);
  removeRecentSearch('Demon Slayer', 'user_1', storage);
  assert.deepEqual(readRecentSearches('user_1', storage), ['naruto']);
  clearRecentSearches('user_1', storage);
  assert.deepEqual(readRecentSearches('user_1', storage), []);
});

test('Account data isolation prevents cross-account leakage and resets legacy keys on logout/switch', () => {
  const storage = new MemoryStorage();
  storage.setItem('anidub_custom_name', 'LegacyLeakName');
  storage.setItem('cf_anime_watchlist', '[1,2,3]');

  // User A signs in and writes scoped data
  transitionAccountStorage('guest', 'user_A', { storage });
  assert.equal(getActiveAccountId(storage), 'user_A');
  writeScopedString('anidub_custom_name', 'PrasanthA', 'user_A', storage);
  writeScopedJson('anidub_library_statuses_v1', { 10: 'watching' }, 'user_A', storage);

  // User A does NOT inherit legacy unscoped keys
  assert.equal(readScopedString('anidub_anime_avatar', 'user_A', '', storage), '');
  assert.equal(readScopedString('anidub_custom_name', 'user_A', '', storage), 'PrasanthA');

  // Switch to User B: legacy keys cleared, User B sees empty state (no leak from User A)
  const switchRes = transitionAccountStorage('user_A', 'user_B', { storage });
  assert.ok(switchRes.clearedKeys.includes('anidub_custom_name'));
  assert.equal(storage.getItem('anidub_custom_name'), null);
  assert.equal(readScopedString('anidub_custom_name', 'user_B', '', storage), '');
  assert.deepEqual(readScopedJson('anidub_library_statuses_v1', {}, 'user_B', storage), {});

  // Logout to guest cleanly resets active owner
  transitionAccountStorage('user_B', null, { storage });
  assert.equal(getActiveAccountId(storage), 'guest');
});

test('Status-based Library supports all 6 statuses and generates escaped RFC-4180 CSV export', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(
    LIBRARY_STATUSES.map((s) => s.id),
    ['watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped', 'rewatching']
  );

  setAnimeLibraryStatus(101, 'watching', 'user_1', storage);
  setAnimeLibraryStatus(102, 'rewatching', 'user_1', storage);
  const map = readLibraryStatusMap('user_1', storage);
  assert.equal(map[101], 'watching');
  assert.equal(map[102], 'rewatching');

  // Effective status fallback from watch progress
  assert.equal(
    resolveEffectiveLibraryStatus(103, map, {
      animeId: 103,
      season: 1,
      episode: 12,
      totalEpisodes: 12,
      completed: true,
      updatedAt: '2026-01-01T00:00:00Z',
    }),
    'completed'
  );
  assert.equal(resolveEffectiveLibraryStatus(104, map, null), 'plan_to_watch');

  // CSV Export with quotes, commas, canonical OTT names, unverified fallbacks, and formula neutralization
  const csv = buildWatchlistCsv(
    [
      {
        id: 101,
        title: '=Dangerous, "Quoted" Anime',
        languages: 'Tamil, Hindi',
        platform: 'JioCinema|Crunchyroll',
        episodes_count: 24,
        rating: 8.7,
        year: 2024,
        official_source_url: 'https://www.crunchyroll.com/series/test',
      },
      {
        id: 104,
        title: 'Unverified Title',
        languages: '',
        platform: '',
        episodes_count: null,
        rating: 0,
      },
    ],
    map,
    {
      101: {
        animeId: 101,
        season: 1,
        episode: 7,
        totalEpisodes: 24,
        completed: false,
        updatedAt: '2026-01-01T00:00:00Z',
      },
    }
  );

  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('Title,Library Status,Indian Dub Languages'));
  assert.ok(lines[1].includes('"\'=Dangerous, ""Quoted"" Anime"'));
  assert.ok(lines[1].includes('Watching'));
  assert.ok(lines[1].includes('"JioHotstar, Crunchyroll"'));
  assert.ok(lines[1].includes('S1 Ep 7 / 24'));
  assert.ok(lines[2].includes('Plan to Watch,Not verified,Not verified,Not started,Count not verified,Unrated'));

  removeAnimeLibraryStatus(101, 'user_1', storage);
  assert.equal(readLibraryStatusMap('user_1', storage)[101], undefined);
});

test('Compare Anime (A vs B) normalizes OTTs, computes shared/unique dubs, and stays honest on missing fields', () => {
  const result = buildAnimeComparison(
    {
      id: 1,
      title: 'Solo Leveling',
      languages: 'Hindi, Tamil, Telugu',
      platform: 'Crunchyroll',
      episodes_count: 12,
      rating: 8.6,
      year: 2024,
      status: 'Completed',
    },
    {
      id: 2,
      title: 'Demon Slayer',
      languages: 'Hindi, Tamil, Malayalam',
      platform: 'JioCinema | Crunchyroll | Netflix',
      episodes_count: null,
      rating: 8.9,
      year: 2019,
      status: 'Airing',
    }
  );

  assert.deepEqual(result.sharedLanguages, ['Hindi', 'Tamil']);
  assert.deepEqual(result.onlyLeftLanguages, ['Telugu']);
  assert.deepEqual(result.onlyRightLanguages, ['Malayalam']);
  assert.deepEqual(result.right.platforms, ['JioHotstar', 'Crunchyroll', 'Netflix']);
  assert.deepEqual(result.sharedPlatforms, ['Crunchyroll']);
  assert.equal(result.left.episodesLabel, '12 Episodes');
  assert.equal(result.right.episodesLabel, 'Count not verified');
  assert.equal(result.ratingWinner, 'right');
  assert.equal(result.languageCountWinner, 'tie');
});
