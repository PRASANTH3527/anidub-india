import type { WatchProgressEntry } from './watchProgress';

export interface GenreStatItem {
  genre: string;
  count: number;
  percent: number;
}

export interface DubLanguageStatItem {
  language: string;
  count: number;
  percent: number;
  barColorClass: string;
  dotColorClass: string;
  textColorClass: string;
}

export interface PersonalAnimeStatsResult {
  completedCount: number;
  episodesWatched: number;
  watchingCount: number;
  planToWatchCount: number;
  totalTrackedTitles: number;
  favoriteGenres: GenreStatItem[];
  preferredLanguages: DubLanguageStatItem[];
  hasLoggedActivity: boolean;
}

const INDIAN_LANGUAGE_STYLES: Record<
  string,
  { barColorClass: string; dotColorClass: string; textColorClass: string }
> = {
  Tamil: {
    barColorClass: 'bg-gradient-to-r from-amber-500 to-orange-400',
    dotColorClass: 'bg-amber-400',
    textColorClass: 'text-amber-300',
  },
  Hindi: {
    barColorClass: 'bg-gradient-to-r from-purple-500 to-fuchsia-500',
    dotColorClass: 'bg-purple-400',
    textColorClass: 'text-purple-300',
  },
  Telugu: {
    barColorClass: 'bg-gradient-to-r from-cyan-500 to-sky-400',
    dotColorClass: 'bg-cyan-400',
    textColorClass: 'text-cyan-300',
  },
  Malayalam: {
    barColorClass: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    dotColorClass: 'bg-emerald-400',
    textColorClass: 'text-emerald-300',
  },
  Kannada: {
    barColorClass: 'bg-gradient-to-r from-rose-500 to-pink-400',
    dotColorClass: 'bg-rose-400',
    textColorClass: 'text-rose-300',
  },
  Bengali: {
    barColorClass: 'bg-gradient-to-r from-indigo-500 to-blue-400',
    dotColorClass: 'bg-indigo-400',
    textColorClass: 'text-indigo-300',
  },
};

function extractIndianDubLanguages(raw: unknown): string[] {
  const tokens = Array.isArray(raw)
    ? raw.map((x) => String(x || '').trim())
    : typeof raw === 'string'
      ? raw.split(/[,/|•+]+/).map((s) => s.trim())
      : [];

  const found = new Set<string>();
  for (const token of tokens) {
    const low = token.toLowerCase();
    if (!low) continue;
    if (low.includes('hin')) found.add('Hindi');
    else if (low.includes('tam')) found.add('Tamil');
    else if (low.includes('tel')) found.add('Telugu');
    else if (low.includes('mal')) found.add('Malayalam');
    else if (low.includes('kan')) found.add('Kannada');
    else if (low.includes('ben')) found.add('Bengali');
  }
  return Array.from(found);
}

function extractGenres(raw: unknown): string[] {
  const tokens = Array.isArray(raw)
    ? raw.map((x) => String(x || '').trim())
    : typeof raw === 'string'
      ? raw.split(/[,/|•]+/).map((s) => s.trim())
      : [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const g of tokens) {
    if (!g) continue;
    const key = g.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(g);
  }
  return result;
}

/**
 * Pure personal anime stats calculator ("My Anime Journey").
 *
 * STRICT HONESTY RULE:
 * Calculates all metrics strictly from the user's own Watchlist and logged Episode Progress.
 * Never fabricates watch-time hours or implies automatic OTT playback tracking.
 */
export function computePersonalAnimeStats(params: {
  watchlistIds: number[];
  catalogItems: any[];
  progressMap: Record<number, WatchProgressEntry>;
  watchedIds?: number[];
}): PersonalAnimeStatsResult {
  const watchlistSet = new Set<number>(
    (params.watchlistIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0)
  );
  const legacyWatchedSet = new Set<number>(
    (params.watchedIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0)
  );
  const progressMap = params.progressMap || {};

  const animeById = new Map<number, any>();
  for (const item of params.catalogItems || []) {
    if (!item || typeof item !== 'object') continue;
    const id = Number(item.id);
    if (Number.isInteger(id) && id > 0 && !animeById.has(id)) {
      animeById.set(id, item);
    }
  }

  // Union of all anime the user has interacted with (watchlisted, logged episodes, or marked completed)
  const trackedIds = new Set<number>([
    ...watchlistSet,
    ...legacyWatchedSet,
    ...Object.keys(progressMap)
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0),
  ]);

  let completedCount = 0;
  let episodesWatched = 0;
  let watchingCount = 0;
  let planToWatchCount = 0;

  for (const animeId of trackedIds) {
    const progress = progressMap[animeId];
    const anime = animeById.get(animeId);
    const totalEpsFromCatalog =
      anime && Number(anime.episodes_count ?? anime.episodes ?? 0) > 0
        ? Math.floor(Number(anime.episodes_count ?? anime.episodes))
        : null;
    const totalEps = progress?.totalEpisodes ?? totalEpsFromCatalog;
    const episodeCount = progress ? Math.max(0, Math.floor(Number(progress.episode) || 0)) : 0;

    const isCompleted =
      Boolean(progress?.completed) ||
      legacyWatchedSet.has(animeId) ||
      (totalEps !== null && totalEps > 0 && episodeCount >= totalEps);

    if (progress) {
      episodesWatched += episodeCount;
    }

    if (isCompleted) {
      completedCount++;
    } else if (episodeCount > 0) {
      watchingCount++;
    } else if (watchlistSet.has(animeId)) {
      planToWatchCount++;
    }
  }

  // Favorite Genres & Preferred Dub Languages calculated strictly from tracked/watchlisted anime
  const genreCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();

  for (const animeId of trackedIds) {
    const anime = animeById.get(animeId);
    if (!anime) continue;

    for (const genre of extractGenres(anime.genres || anime.genre)) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }

    for (const lang of extractIndianDubLanguages(anime.languages)) {
      languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
    }
  }

  const maxGenreCount = Math.max(1, ...Array.from(genreCounts.values()));
  const favoriteGenres: GenreStatItem[] = Array.from(genreCounts.entries())
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .slice(0, 6)
    .map(([genre, count]) => ({
      genre,
      count,
      percent: Math.round((count / maxGenreCount) * 100),
    }));

  const sortedLanguages = Array.from(languageCounts.entries()).sort((a, b) =>
    b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])
  );
  const totalLangMentions = sortedLanguages.reduce((sum, [, count]) => sum + count, 0);

  // Compute integer percentages that cleanly sum to 100%
  const preferredLanguages: DubLanguageStatItem[] = [];
  if (totalLangMentions > 0) {
    const rawItems = sortedLanguages.map(([language, count]) => {
      const exact = (count / totalLangMentions) * 100;
      const floored = Math.floor(exact);
      return {
        language,
        count,
        floored,
        remainder: exact - floored,
      };
    });
    let remaining = 100 - rawItems.reduce((sum, item) => sum + item.floored, 0);
    const byRemainder = [...rawItems].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remaining && i < byRemainder.length; i++) {
      byRemainder[i].floored += 1;
    }

    for (const item of rawItems) {
      const style = INDIAN_LANGUAGE_STYLES[item.language] || {
        barColorClass: 'bg-gradient-to-r from-neutral-500 to-neutral-400',
        dotColorClass: 'bg-neutral-400',
        textColorClass: 'text-neutral-300',
      };
      preferredLanguages.push({
        language: item.language,
        count: item.count,
        percent: item.floored,
        ...style,
      });
    }
  }

  const hasLoggedActivity = trackedIds.size > 0;

  return {
    completedCount,
    episodesWatched,
    watchingCount,
    planToWatchCount,
    totalTrackedTitles: trackedIds.size,
    favoriteGenres,
    preferredLanguages,
    hasLoggedActivity,
  };
}
