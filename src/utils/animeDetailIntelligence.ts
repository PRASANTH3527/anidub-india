/**
 * Pure Indian Dub Intelligence & Episode Progress Engine for AniDub India — Anime Details 2.0.
 *
 * STRICT DATA INTEGRITY RULES:
 * - Never fabricates episode counts, dub availability, or completion status.
 * - Never infers "Complete" from a language tag alone without verified episode counts.
 * - Clearly distinguishes: Complete, Partial, Announced, Listed, Unverified.
 */

import type { Anime, WatchlistStatus } from '../types';
import type { DubProgressResult } from './dubProgress';

export const DUB_SCRIPT_BADGES: Record<string, string> = {
  Tamil: 'த',
  Hindi: 'हि',
  Telugu: 'తె',
  Malayalam: 'മ',
  Kannada: 'ಕ',
  Bengali: 'বা',
  Marathi: 'म',
  Gujarati: 'ગુ',
  Punjabi: 'ਪੰ',
  Odia: 'ଓ',
  Assamese: 'অ',
};

export type IndianDubStatus =
  | 'Complete'
  | 'Partial'
  | 'Announced'
  | 'Listed'
  | 'Unverified';

export interface IndianDubIntelligenceCard {
  language: string;
  scriptBadge: string;
  status: IndianDubStatus;
  episodesDubbed: number | null;
  totalEpisodes: number | null;
  progressPercent: number | null;
  platforms: string[];
  seasonNote?: string;
}

export interface EpisodeProgressStats {
  watchedCount: number;
  totalEpisodes: number | null;
  percent: number;
  nextEpisode: number | null;
  isCompleted: boolean;
}

export interface EpisodeRangeChunk {
  index: number;
  start: number;
  end: number;
  label: string;
}

export interface SingleHeroRating {
  value: number;
  scale: 10;
  source: 'catalog' | 'community';
  voteCount?: number;
}

export const EPISODE_SET_STORAGE_KEY = 'anime_episode_set_v1';
export const PERSONAL_STATUS_STORAGE_KEY = 'anime_personal_watch_status_v1';

/**
 * Guard that guarantees active detail tabs only reset when navigating to a DIFFERENT anime ID,
 * never on parent re-renders, follow toggles, watchlist changes, or translation loads.
 */
export function shouldResetDetailTabOnPropChange(
  previousAnimeId: string | null,
  nextAnimeId: string | null
): boolean {
  if (!nextAnimeId) return false;
  return previousAnimeId !== nextAnimeId;
}

export function getLanguageScriptBadge(language: string): string {
  const clean = String(language || '').trim();
  if (!clean) return 'IN';
  if (DUB_SCRIPT_BADGES[clean]) return DUB_SCRIPT_BADGES[clean];
  const matchedKey = Object.keys(DUB_SCRIPT_BADGES).find(
    (k) => k.toLowerCase() === clean.toLowerCase()
  );
  if (matchedKey) return DUB_SCRIPT_BADGES[matchedKey];
  return clean.slice(0, 2).toUpperCase();
}

function parseStreamingPartnersRaw(anime: any): Array<{ name: string; languages: string[] }> {
  const results: Array<{ name: string; languages: string[] }> = [];
  const rawSources = [anime?.platforms_data, anime?.streaming_partners];
  for (const src of rawSources) {
    if (!src) continue;
    let parsed: unknown = src;
    if (typeof src === 'string') {
      try {
        parsed = JSON.parse(src);
      } catch {
        continue;
      }
    }
    if (!Array.isArray(parsed)) continue;
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const name = String(obj.name || obj.platform || '').trim();
      if (!name) continue;
      const langs: string[] = [];
      if (Array.isArray(obj.languages)) {
        for (const l of obj.languages) {
          if (typeof l === 'string' && l.trim()) langs.push(l.trim());
        }
      } else if (typeof obj.languages === 'string' && obj.languages.trim()) {
        langs.push(
          ...obj.languages
            .split(/[,/|•+]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        );
      }
      results.push({ name, languages: langs });
    }
  }
  return results;
}

/**
 * Classifies Indian dub status strictly from verified metadata.
 * NEVER infers "Complete" from a language tag alone.
 */
export function classifyIndianDubStatus(params: {
  isListed: boolean;
  episodesDubbed: number | null;
  totalEpisodes: number | null;
  animePublicationStatus?: string;
}): IndianDubStatus {
  const { isListed, episodesDubbed, totalEpisodes, animePublicationStatus } = params;
  const pubStatus = String(animePublicationStatus || '').trim().toLowerCase();

  if (
    episodesDubbed !== null &&
    episodesDubbed > 0 &&
    totalEpisodes !== null &&
    totalEpisodes > 0 &&
    episodesDubbed >= totalEpisodes
  ) {
    return 'Complete';
  }

  if (episodesDubbed !== null && episodesDubbed > 0) {
    return 'Partial';
  }

  if (isListed && (pubStatus === 'upcoming' || pubStatus === 'announced')) {
    return 'Announced';
  }

  if (isListed) {
    return 'Listed';
  }

  return 'Unverified';
}

/**
 * Builds Indian Dub Intelligence cards exclusively from verified catalog data.
 */
export function buildIndianDubIntelligenceCards(
  anime: Partial<Anime> & Record<string, any>,
  dubProgress: DubProgressResult | null
): IndianDubIntelligenceCard[] {
  const verifiedPlatforms: string[] = Array.isArray(anime.platforms)
    ? anime.platforms.filter((p): p is string => Boolean(p && String(p).trim()))
    : [];
  const partnerEntries = parseStreamingPartnersRaw(anime);

  const resolvePlatformsForLanguage = (language: string): string[] => {
    const langLower = language.toLowerCase();
    const matchedPartners = partnerEntries
      .filter(
        (p) =>
          p.languages.length > 0 &&
          p.languages.some((l) => l.toLowerCase() === langLower)
      )
      .map((p) => p.name);

    if (matchedPartners.length > 0) {
      return Array.from(new Set(matchedPartners));
    }
    return verifiedPlatforms;
  };

  const progressMap = new Map<
    string,
    { episodesDubbed: number | null; totalEpisodes: number | null }
  >();

  if (dubProgress?.seasons && dubProgress.seasons.length > 0) {
    const seasonSums = new Map<
      string,
      { dubbed: number; total: number; hasDubbed: boolean; hasTotal: boolean }
    >();
    for (const season of dubProgress.seasons) {
      for (const lp of season.languages) {
        if (lp.status === 'unavailable') continue;
        const key = lp.language.toLowerCase();
        const acc = seasonSums.get(key) || {
          dubbed: 0,
          total: 0,
          hasDubbed: false,
          hasTotal: false,
        };
        if (typeof lp.episodesDubbed === 'number' && lp.episodesDubbed > 0) {
          acc.dubbed += lp.episodesDubbed;
          acc.hasDubbed = true;
          const sTotal = lp.totalEpisodes ?? season.totalEpisodes;
          if (typeof sTotal === 'number' && sTotal > 0) {
            acc.total += sTotal;
            acc.hasTotal = true;
          }
        }
        seasonSums.set(key, acc);
      }
    }
    for (const [key, acc] of seasonSums.entries()) {
      if (acc.hasDubbed) {
        progressMap.set(key, {
          episodesDubbed: acc.dubbed,
          totalEpisodes: acc.hasTotal ? acc.total : null,
        });
      }
    }
  }

  if (dubProgress?.overall?.languages) {
    for (const lp of dubProgress.overall.languages) {
      if (lp.status === 'unavailable') continue;
      const key = lp.language.toLowerCase();
      if (!progressMap.has(key)) {
        progressMap.set(key, {
          episodesDubbed: lp.episodesDubbed,
          totalEpisodes: lp.totalEpisodes,
        });
      }
    }
  }

  const orderedLanguages: string[] = [];
  const seen = new Set<string>();
  const addLang = (lang: string) => {
    const clean = String(lang || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    orderedLanguages.push(clean);
  };

  if (Array.isArray(anime.languages)) {
    for (const lang of anime.languages) addLang(lang);
  }
  if (dubProgress?.overall?.languages) {
    for (const lp of dubProgress.overall.languages) {
      if (lp.status !== 'unavailable') addLang(lp.language);
    }
  }

  if (orderedLanguages.length === 0) {
    return [];
  }

  const fallbackTotal =
    typeof anime.episodesCount === 'number' && anime.episodesCount > 0
      ? anime.episodesCount
      : null;

  return orderedLanguages.map((language) => {
    const entry = progressMap.get(language.toLowerCase());
    const episodesDubbed =
      entry && typeof entry.episodesDubbed === 'number' && entry.episodesDubbed > 0
        ? entry.episodesDubbed
        : null;
    const totalEpisodes =
      entry && typeof entry.totalEpisodes === 'number' && entry.totalEpisodes > 0
        ? entry.totalEpisodes
        : fallbackTotal;

    const status = classifyIndianDubStatus({
      isListed: true,
      episodesDubbed,
      totalEpisodes,
      animePublicationStatus: anime.status,
    });

    const progressPercent =
      episodesDubbed !== null && totalEpisodes !== null && totalEpisodes > 0
        ? Math.min(100, Math.round((episodesDubbed / totalEpisodes) * 100))
        : null;

    return {
      language,
      scriptBadge: getLanguageScriptBadge(language),
      status,
      episodesDubbed,
      totalEpisodes,
      progressPercent,
      platforms: resolvePlatformsForLanguage(language),
      seasonNote:
        dubProgress && dubProgress.hasMultipleSeasons
          ? `${dubProgress.seasons.length} seasons tracked`
          : undefined,
    };
  });
}

/**
 * Resolves ONE clean rating indicator for the Hero section to eliminate duplicate ratings.
 */
export function resolveSingleHeroRating(
  anime: Partial<Anime>
): SingleHeroRating | null {
  if (typeof anime.rating === 'number' && Number.isFinite(anime.rating) && anime.rating > 0) {
    return {
      value: Math.round(anime.rating * 10) / 10,
      scale: 10,
      source: 'catalog',
      voteCount:
        typeof anime.userRatingsCount === 'number' && anime.userRatingsCount > 0
          ? anime.userRatingsCount
          : undefined,
    };
  }

  if (
    typeof anime.userRatingsCount === 'number' &&
    anime.userRatingsCount > 0 &&
    typeof anime.userRatingsSum === 'number' &&
    anime.userRatingsSum > 0
  ) {
    const avg = anime.userRatingsSum / anime.userRatingsCount;
    return {
      value: Math.round(avg * 10) / 10,
      scale: 10,
      source: 'community',
      voteCount: anime.userRatingsCount,
    };
  }

  return null;
}

/**
 * Normalizes a list of watched episode numbers into a sorted, unique, bounded array.
 */
export function normalizeWatchedEpisodeList(
  episodes: number[],
  maxEpisodes: number | null
): number[] {
  const unique = new Set<number>();
  for (const ep of episodes) {
    const num = Math.floor(Number(ep));
    if (!Number.isFinite(num) || num < 1) continue;
    if (maxEpisodes !== null && maxEpisodes > 0 && num > maxEpisodes) continue;
    unique.add(num);
  }
  return Array.from(unique).sort((a, b) => a - b);
}

/**
 * Hydrates a sequential episode array [1..count] from a numeric count.
 */
export function createWatchedSetFromCount(
  count: number,
  maxEpisodes: number | null
): number[] {
  const cleanCount = Math.max(0, Math.floor(Number(count) || 0));
  const bounded =
    maxEpisodes !== null && maxEpisodes > 0
      ? Math.min(cleanCount, maxEpisodes)
      : cleanCount;
  const out: number[] = [];
  for (let i = 1; i <= bounded; i++) {
    out.push(i);
  }
  return out;
}

/**
 * Toggles a single episode number inside the watched list.
 */
export function toggleEpisodeNumber(
  watchedEpisodes: number[],
  episodeNumber: number,
  maxEpisodes: number | null
): number[] {
  const ep = Math.floor(Number(episodeNumber));
  if (!Number.isFinite(ep) || ep < 1) {
    return normalizeWatchedEpisodeList(watchedEpisodes, maxEpisodes);
  }
  if (maxEpisodes !== null && maxEpisodes > 0 && ep > maxEpisodes) {
    return normalizeWatchedEpisodeList(watchedEpisodes, maxEpisodes);
  }

  const nextSet = new Set(normalizeWatchedEpisodeList(watchedEpisodes, maxEpisodes));
  if (nextSet.has(ep)) {
    nextSet.delete(ep);
  } else {
    nextSet.add(ep);
  }
  return Array.from(nextSet).sort((a, b) => a - b);
}

/**
 * Marks all episodes 1..maxEpisodes as watched.
 */
export function markAllEpisodesWatched(maxEpisodes: number | null): number[] {
  if (maxEpisodes === null || maxEpisodes <= 0) return [];
  return createWatchedSetFromCount(maxEpisodes, maxEpisodes);
}

/**
 * Computes watched count, percentage, next unwatched episode ("Continue Watching"), and completion flag.
 */
export function computeEpisodeProgressStats(
  watchedEpisodes: number[],
  totalEpisodes: number | null
): EpisodeProgressStats {
  const normalized = normalizeWatchedEpisodeList(watchedEpisodes, totalEpisodes);
  const watchedCount = normalized.length;
  const watchedSet = new Set(normalized);

  if (totalEpisodes !== null && totalEpisodes > 0) {
    const percent = Math.min(100, Math.round((watchedCount / totalEpisodes) * 100));
    let nextEpisode: number | null = null;
    for (let ep = 1; ep <= totalEpisodes; ep++) {
      if (!watchedSet.has(ep)) {
        nextEpisode = ep;
        break;
      }
    }
    return {
      watchedCount,
      totalEpisodes,
      percent,
      nextEpisode,
      isCompleted: watchedCount >= totalEpisodes,
    };
  }

  const maxWatched = normalized.length > 0 ? normalized[normalized.length - 1] : 0;
  return {
    watchedCount,
    totalEpisodes: null,
    percent: 0,
    nextEpisode: maxWatched + 1,
    isCompleted: false,
  };
}

/**
 * Splits large episode counts into clean selectable range tabs (e.g. 1-50, 51-100).
 */
export function getEpisodeRanges(
  totalEpisodes: number,
  chunkSize = 50
): EpisodeRangeChunk[] {
  if (!Number.isFinite(totalEpisodes) || totalEpisodes <= 0) return [];
  const safeChunk = Math.max(10, Math.floor(chunkSize));
  const chunks: EpisodeRangeChunk[] = [];
  let idx = 0;
  for (let start = 1; start <= totalEpisodes; start += safeChunk) {
    const end = Math.min(totalEpisodes, start + safeChunk - 1);
    chunks.push({
      index: idx,
      start,
      end,
      label: `${start}–${end}`,
    });
    idx += 1;
  }
  return chunks;
}

/**
 * Reads per-season watched episode sets from localStorage, seamlessly falling back to
 * legacy `anime_season_progress_v2` and `anime_progress` numeric counters.
 */
export function readStoredWatchedEpisodesBySeason(
  animeId: string,
  storage: Pick<Storage, 'getItem'> | null
): Record<number, number[]> {
  if (!storage || !animeId) return { 1: [] };

  try {
    const rawSets = JSON.parse(storage.getItem(EPISODE_SET_STORAGE_KEY) || '{}');
    if (rawSets[animeId] && typeof rawSets[animeId] === 'object') {
      const hydrated: Record<number, number[]> = {};
      for (const [seasonKey, eps] of Object.entries(rawSets[animeId])) {
        const sNum = Number(seasonKey);
        if (Number.isInteger(sNum) && sNum > 0 && Array.isArray(eps)) {
          hydrated[sNum] = normalizeWatchedEpisodeList(eps as number[], null);
        }
      }
      if (Object.keys(hydrated).length > 0) {
        return hydrated;
      }
    }
  } catch {
    // Fallback to v2 numeric counts
  }

  try {
    const seasonCounts = JSON.parse(storage.getItem('anime_season_progress_v2') || '{}');
    if (seasonCounts[animeId] && typeof seasonCounts[animeId] === 'object') {
      const hydrated: Record<number, number[]> = {};
      for (const [seasonKey, count] of Object.entries(seasonCounts[animeId])) {
        const sNum = Number(seasonKey);
        if (Number.isInteger(sNum) && sNum > 0) {
          hydrated[sNum] = createWatchedSetFromCount(Number(count) || 0, null);
        }
      }
      if (Object.keys(hydrated).length > 0) {
        return hydrated;
      }
    }
  } catch {
    // Fallback to legacy single count
  }

  try {
    const legacyCounts = JSON.parse(storage.getItem('anime_progress') || '{}');
    const count = Number(legacyCounts[animeId]) || 0;
    return { 1: createWatchedSetFromCount(count, null) };
  } catch {
    return { 1: [] };
  }
}

/**
 * Persists per-season watched episode sets AND keeps `anime_season_progress_v2` and `anime_progress`
 * synchronized so WatchlistView and other views read accurate counts immediately.
 */
export function writeStoredWatchedEpisodesBySeason(
  animeId: string,
  bySeason: Record<number, number[]>,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
): number {
  const countsBySeason: Record<number, number> = {};
  let totalWatchedAcrossSeasons = 0;

  for (const [seasonKey, list] of Object.entries(bySeason)) {
    const sNum = Number(seasonKey);
    if (!Number.isInteger(sNum) || sNum <= 0) continue;
    const cleanList = normalizeWatchedEpisodeList(list, null);
    countsBySeason[sNum] = cleanList.length;
    totalWatchedAcrossSeasons += cleanList.length;
  }

  if (!storage || !animeId) return totalWatchedAcrossSeasons;

  try {
    const rawSets = JSON.parse(storage.getItem(EPISODE_SET_STORAGE_KEY) || '{}');
    rawSets[animeId] = bySeason;
    storage.setItem(EPISODE_SET_STORAGE_KEY, JSON.stringify(rawSets));
  } catch {
    // Ignore storage quota errors
  }

  try {
    const seasonCounts = JSON.parse(storage.getItem('anime_season_progress_v2') || '{}');
    seasonCounts[animeId] = countsBySeason;
    storage.setItem('anime_season_progress_v2', JSON.stringify(seasonCounts));
  } catch {
    // Ignore storage quota errors
  }

  try {
    const legacyCounts = JSON.parse(storage.getItem('anime_progress') || '{}');
    legacyCounts[animeId] = totalWatchedAcrossSeasons;
    storage.setItem('anime_progress', JSON.stringify(legacyCounts));
  } catch {
    // Ignore storage quota errors
  }

  return totalWatchedAcrossSeasons;
}

const VALID_WATCHLIST_STATUSES = new Set<WatchlistStatus>([
  'Watching',
  'Completed',
  'Plan to Watch',
  'On Hold',
  'Dropped',
  'Rewatching',
]);

export function readPersonalWatchStatus(
  animeId: string,
  fallback: WatchlistStatus,
  storage: Pick<Storage, 'getItem'> | null
): WatchlistStatus {
  if (!storage || !animeId) return fallback;
  try {
    const map = JSON.parse(storage.getItem(PERSONAL_STATUS_STORAGE_KEY) || '{}');
    const saved = map[animeId] as WatchlistStatus | undefined;
    if (saved && VALID_WATCHLIST_STATUSES.has(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export function writePersonalWatchStatus(
  animeId: string,
  status: WatchlistStatus,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
): void {
  if (!storage || !animeId || !VALID_WATCHLIST_STATUSES.has(status)) return;
  try {
    const map = JSON.parse(storage.getItem(PERSONAL_STATUS_STORAGE_KEY) || '{}');
    map[animeId] = status;
    storage.setItem(PERSONAL_STATUS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
