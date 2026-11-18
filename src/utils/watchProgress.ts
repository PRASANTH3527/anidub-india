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

function readLegacyWatchedIds(storage?: Storage | null): Set<number> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(WATCHED_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0));
  } catch {
    return new Set();
  }
}

function syncLegacyWatchedFlag(animeId: number, completed: boolean, storage?: Storage | null): void {
  if (!storage) return;
  try {
    const ids = readLegacyWatchedIds(storage);
    if (completed) {
      ids.add(animeId);
    } else {
      ids.delete(animeId);
    }
    storage.setItem(WATCHED_IDS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export function getAllWatchProgress(storage?: Storage | null): Record<number, WatchProgressEntry> {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return {};
  try {
    const raw = targetStorage.getItem(WATCH_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<number, WatchProgressEntry> = {};
    for (const [key, val] of Object.entries(parsed)) {
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
  storage?: Storage | null
): WatchProgressEntry | null {
  const numericId = Number(animeId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const all = getAllWatchProgress(targetStorage);
  if (all[numericId]) return all[numericId];

  const legacyWatched = readLegacyWatchedIds(targetStorage);
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
  storage?: Storage | null
): WatchProgressEntry | null {
  const normalized = normalizeWatchProgressEntry(animeId, input);
  if (!normalized) return null;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (targetStorage) {
    const all = getAllWatchProgress(targetStorage);
    all[normalized.animeId] = normalized;
    try {
      targetStorage.setItem(WATCH_PROGRESS_STORAGE_KEY, JSON.stringify(all));
    } catch {}
    syncLegacyWatchedFlag(normalized.animeId, normalized.completed, targetStorage);
  }
  return normalized;
}

export function clearAnimeWatchProgress(
  animeId: number | string,
  storage?: Storage | null
): boolean {
  const numericId = Number(animeId);
  if (!Number.isInteger(numericId) || numericId <= 0) return false;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return false;
  const all = getAllWatchProgress(targetStorage);
  delete all[numericId];
  try {
    targetStorage.setItem(WATCH_PROGRESS_STORAGE_KEY, JSON.stringify(all));
  } catch {}
  syncLegacyWatchedFlag(numericId, false, targetStorage);
  return true;
}

export function getSpoilerProtectionEnabled(storage?: Storage | null): boolean {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return false;
  try {
    const raw = targetStorage.getItem(SPOILER_PROTECTION_STORAGE_KEY);
    return raw === 'true' || raw === '1';
  } catch {
    return false;
  }
}

export function setSpoilerProtectionEnabled(
  enabled: boolean,
  storage?: Storage | null
): boolean {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (targetStorage) {
    try {
      targetStorage.setItem(SPOILER_PROTECTION_STORAGE_KEY, String(Boolean(enabled)));
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
