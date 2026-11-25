import {
  readScopedJson,
  readScopedString,
  writeScopedJson,
  writeScopedString,
} from './accountIsolation';

export const WATCH_PROGRESS_STORAGE_KEY = 'cf_watch_progress_v1';
export const WATCHED_IDS_STORAGE_KEY = 'cf_watched_anime_ids';
export const SPOILER_PROTECTION_STORAGE_KEY = 'anidub_spoiler_protection_v1';
export const SPOILER_PROTECTION_EVENT = 'anidub:spoiler-protection-changed';

export interface WatchProgressEntry {
  animeId: number;
  season: number;
  episode: number;
  totalEpisodes: number | null;
  completed: boolean;
  updatedAt: string;
}

export interface WatchProgressInput {
  animeId?: number | string;
  season?: number | string;
  episode?: number | string;
  totalEpisodes?: number | string | null;
  completed?: boolean;
  updatedAt?: string;
}

export function normalizeWatchProgressEntry(
  animeIdRaw: number | string,
  input: WatchProgressInput = {}
): WatchProgressEntry | null {
  const animeId = Number(input.animeId ?? animeIdRaw);
  if (!Number.isInteger(animeId) || animeId <= 0) return null;

  const parsedSeason = Math.floor(Number(input.season ?? 1));
  const season = Number.isFinite(parsedSeason) && parsedSeason >= 1 ? Math.min(parsedSeason, 99) : 1;

  const rawTotal = input.totalEpisodes;
  const parsedTotal =
    rawTotal !== null && rawTotal !== undefined && String(rawTotal).trim() !== ''
      ? Math.floor(Number(rawTotal))
      : NaN;
  const totalEpisodes =
    Number.isFinite(parsedTotal) && parsedTotal > 0 ? Math.min(parsedTotal, 9999) : null;

  const parsedEpisode = Math.floor(Number(input.episode ?? 0));
  let episode = Number.isFinite(parsedEpisode) && parsedEpisode >= 0 ? Math.min(parsedEpisode, 9999) : 0;
  if (totalEpisodes !== null && episode > totalEpisodes) {
    episode = totalEpisodes;
  }

  const completed =
    typeof input.completed === 'boolean'
      ? input.completed
      : Boolean(totalEpisodes !== null && totalEpisodes > 0 && episode >= totalEpisodes);

  if (completed && totalEpisodes !== null && episode < totalEpisodes) {
    episode = totalEpisodes;
  }

  const updatedAt =
    typeof input.updatedAt === 'string' && input.updatedAt.trim()
      ? input.updatedAt.trim()
      : new Date().toISOString();

  return {
    animeId,
    season,
    episode,
    totalEpisodes,
    completed,
    updatedAt,
  };
}

export function computeWatchProgressPercent(
  episode: number,
  totalEpisodes?: number | null,
  completed = false
): number {
  if (completed) return 100;
  if (!Number.isFinite(episode) || episode <= 0) return 0;
  if (totalEpisodes && Number.isFinite(totalEpisodes) && totalEpisodes > 0) {
    return Math.min(100, Math.max(0, Math.round((episode / totalEpisodes) * 100)));
  }
  return Math.min(95, episode * 8);
}

function readLegacyWatchedIds(storage?: Storage | null, userId?: string | null): Set<number> {
  if (!storage) return new Set();
  try {
    const parsed = readScopedJson<unknown>(WATCHED_IDS_STORAGE_KEY, [], userId, storage);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0));
  } catch {
    return new Set();
  }
}

function syncLegacyWatchedFlag(
  animeId: number,
  completed: boolean,
  storage?: Storage | null,
  userId?: string | null
): void {
  if (!storage) return;
  try {
    const ids = readLegacyWatchedIds(storage, userId);
    if (completed) {
      ids.add(animeId);
    } else {
      ids.delete(animeId);
    }
    writeScopedJson(WATCHED_IDS_STORAGE_KEY, Array.from(ids), userId, storage);
  } catch {}
}

export function getAllWatchProgress(
  storage?: Storage | null,
  userId?: string | null
): Record<number, WatchProgressEntry> {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return {};
  try {
    const parsed = readScopedJson<unknown>(WATCH_PROGRESS_STORAGE_KEY, {}, userId, targetStorage);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<number, WatchProgressEntry> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      const normalized = normalizeWatchProgressEntry(key, (val || {}) as WatchProgressInput);
      if (normalized) {
        result[normalized.animeId] = normalized;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function getAnimeWatchProgress(
  animeId: number | string,
  storage?: Storage | null,
  userId?: string | null
): WatchProgressEntry | null {
  const numericId = Number(animeId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const all = getAllWatchProgress(targetStorage, userId);
  if (all[numericId]) return all[numericId];

  const legacyWatched = readLegacyWatchedIds(targetStorage, userId);
  if (legacyWatched.has(numericId)) {
    return {
      animeId: numericId,
      season: 1,
      episode: 1,
      totalEpisodes: null,
      completed: true,
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function saveAnimeWatchProgress(
  animeId: number | string,
  input: WatchProgressInput,
  storage?: Storage | null,
  userId?: string | null
): WatchProgressEntry | null {
  const normalized = normalizeWatchProgressEntry(animeId, input);
  if (!normalized) return null;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (targetStorage) {
    const all = getAllWatchProgress(targetStorage, userId);
    all[normalized.animeId] = normalized;
    try {
      writeScopedJson(WATCH_PROGRESS_STORAGE_KEY, all, userId, targetStorage);
    } catch {}
    syncLegacyWatchedFlag(normalized.animeId, normalized.completed, targetStorage, userId);
  }
  return normalized;
}

export function clearAnimeWatchProgress(
  animeId: number | string,
  storage?: Storage | null,
  userId?: string | null
): boolean {
  const numericId = Number(animeId);
  if (!Number.isInteger(numericId) || numericId <= 0) return false;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return false;
  const all = getAllWatchProgress(targetStorage, userId);
  delete all[numericId];
  try {
    writeScopedJson(WATCH_PROGRESS_STORAGE_KEY, all, userId, targetStorage);
  } catch {}
  syncLegacyWatchedFlag(numericId, false, targetStorage, userId);
  return true;
}

export function getSpoilerProtectionEnabled(
  storage?: Storage | null,
  userId?: string | null
): boolean {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return false;
  try {
    const raw = readScopedString(SPOILER_PROTECTION_STORAGE_KEY, userId, '', targetStorage);
    return raw === 'true' || raw === '1';
  } catch {
    return false;
  }
}

export function setSpoilerProtectionEnabled(
  enabled: boolean,
  storage?: Storage | null,
  userId?: string | null
): boolean {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (targetStorage) {
    try {
      writeScopedString(SPOILER_PROTECTION_STORAGE_KEY, String(Boolean(enabled)), userId, targetStorage);
    } catch {}
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(SPOILER_PROTECTION_EVENT, { detail: { enabled: Boolean(enabled) } }));
    } catch {}
  }
  return Boolean(enabled);
}

const SPOILER_KEYWORDS_REGEX =
  /\[spoiler\]|\bspoiler\b|\bdies\b|\bending explained\b|\bplot twist\b|\bfinal episode\b/i;

export function containsSpoilerContent(text: string, explicitFlag?: boolean): boolean {
  if (explicitFlag) return true;
  if (!text || typeof text !== 'string') return false;
  return SPOILER_KEYWORDS_REGEX.test(text);
}

export interface SeasonLimitInfo {
  seasonNumber: number;
  label: string;
  totalEpisodes: number | null;
}

function parsePositiveEpisodeInt(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Math.floor(Number(val));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : null;
}

/**
 * Extracts verified season limits (season count and per-season episode caps)
 * from an anime record so progress tracking never exceeds valid season boundaries.
 */
export function extractSeasonLimits(
  anime: Record<string, unknown> | null | undefined
): SeasonLimitInfo[] {
  if (!anime || typeof anime !== 'object') {
    return [{ seasonNumber: 1, label: 'Season 1', totalEpisodes: null }];
  }

  const seasons: SeasonLimitInfo[] = [];

  const rawEntries = anime.mixed_entries ?? anime.mixedEntries ?? anime.seasons ?? anime.seasonsList;
  let parsedEntries: unknown = rawEntries;
  if (typeof rawEntries === 'string' && rawEntries.trim().startsWith('[')) {
    try {
      parsedEntries = JSON.parse(rawEntries);
    } catch {
      parsedEntries = null;
    }
  }

  if (Array.isArray(parsedEntries) && parsedEntries.length > 0) {
    parsedEntries.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const obj = entry as Record<string, unknown>;
      const eps = parsePositiveEpisodeInt(
        obj.episodes ?? obj.episodeCount ?? obj.episode_count ?? obj.total_episodes ?? obj.totalEpisodes
      );
      const rawLabel = String(obj.name || obj.label || '').trim();
      const label = rawLabel || `Season ${idx + 1}`;
      seasons.push({
        seasonNumber: idx + 1,
        label,
        totalEpisodes: eps,
      });
    });
  }

  if (seasons.length === 0 && typeof anime.episodes_per_season === 'string' && anime.episodes_per_season.trim()) {
    const parts = anime.episodes_per_season
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      parts.forEach((part, idx) => {
        seasons.push({
          seasonNumber: idx + 1,
          label: `Season ${idx + 1}`,
          totalEpisodes: parsePositiveEpisodeInt(part),
        });
      });
    }
  }

  if (seasons.length === 0 && typeof anime.season_episode_count === 'string' && anime.season_episode_count.trim()) {
    const matches = Array.from(
      anime.season_episode_count.matchAll(/(?:season\s*(\d+)|s(\d+))\s*[:\-]\s*(\d+)/gi)
    );
    if (matches.length > 0) {
      matches.forEach((m, idx) => {
        const sNum = Number(m[1] || m[2]) || idx + 1;
        seasons.push({
          seasonNumber: idx + 1,
          label: `Season ${sNum}`,
          totalEpisodes: parsePositiveEpisodeInt(m[3]),
        });
      });
    }
  }

  if (seasons.length === 0) {
    const fallbackTotal = parsePositiveEpisodeInt(
      anime.episodes_count ?? anime.episodes ?? anime.episode_count
    );
    seasons.push({
      seasonNumber: 1,
      label: String(anime.type || '').toLowerCase() === 'movie' ? 'Movie' : 'Season 1',
      totalEpisodes: fallbackTotal,
    });
  }

  return seasons;
}

/**
 * Clamps a watch progress entry strictly within the anime's verified season boundaries
 * and per-season episode limits.
 */
export function clampWatchProgressToSeasonLimits(
  input: { season: number; episode: number; completed?: boolean },
  seasonLimits: SeasonLimitInfo[]
): { season: number; episode: number; totalEpisodes: number | null; completed: boolean } {
  const safeLimits =
    Array.isArray(seasonLimits) && seasonLimits.length > 0
      ? seasonLimits
      : [{ seasonNumber: 1, label: 'Season 1', totalEpisodes: null }];

  const maxSeason = safeLimits.length;
  const rawSeason = Math.floor(Number(input.season) || 1);
  const season = Math.max(1, Math.min(rawSeason, maxSeason));
  const currentLimit = safeLimits[season - 1] || safeLimits[0];
  const totalEpisodes = currentLimit?.totalEpisodes ?? null;

  const rawEp = Math.floor(Number(input.episode) || 0);
  let episode = Math.max(0, rawEp);
  if (totalEpisodes !== null && episode > totalEpisodes) {
    episode = totalEpisodes;
  }

  const completed =
    typeof input.completed === 'boolean'
      ? input.completed
      : Boolean(totalEpisodes !== null && totalEpisodes > 0 && episode >= totalEpisodes);

  if (completed && totalEpisodes !== null && episode < totalEpisodes) {
    episode = totalEpisodes;
  }

  return {
    season,
    episode,
    totalEpisodes,
    completed,
  };
}

