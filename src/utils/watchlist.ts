export const WATCHLIST_STORAGE_KEY = 'cf_anime_watchlist';
export const WATCHLIST_OWNER_STORAGE_KEY = 'cf_anime_watchlist_owner';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // Storage may be blocked in private browsing contexts
  }
  return null;
}

/**
 * Normalizes an arbitrary array of anime IDs or watchlist record objects into
 * deduplicated positive integer IDs.
 */
export function normalizeWatchlistIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const item of raw) {
    const rawVal =
      item && typeof item === 'object'
        ? (item as any).anime_id ?? (item as any).animeId ?? (item as any).id
        : item;
    const id = Number(rawVal);
    if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      normalized.push(id);
    }
  }

  return normalized;
}

/**
 * Reads the persisted watchlist IDs safely from localStorage.
 */
export function readWatchlistFromStorage(storage?: StorageLike | null): number[] {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return [];
  try {
    const raw = store.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeWatchlistIds(parsed);
  } catch {
    return [];
  }
}

/**
 * Reads the owner tag ('guest' or Clerk userId) of the cached watchlist in localStorage.
 */
export function readWatchlistOwner(storage?: StorageLike | null): string {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return 'guest';
  try {
    return store.getItem(WATCHLIST_OWNER_STORAGE_KEY) || 'guest';
  } catch {
    return 'guest';
  }
}

/**
 * Writes normalized watchlist IDs and optional owner tag to localStorage.
 */
export function writeWatchlistToStorage(
  ids: unknown[],
  owner?: string,
  storage?: StorageLike | null
): number[] {
  const normalized = normalizeWatchlistIds(ids);
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (store) {
    try {
      store.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(normalized));
      if (owner !== undefined) {
        store.setItem(WATCHLIST_OWNER_STORAGE_KEY, owner);
      }
    } catch {
      // Ignore storage quota or restricted-mode errors
    }
  }
  return normalized;
}

/**
 * Toggles an anime ID locally and returns both the updated list and whether it is now saved.
 */
export function toggleWatchlistIdLocally(
  currentIds: number[],
  animeId: number
): { ids: number[]; watchlisted: boolean } {
  const normalized = normalizeWatchlistIds(currentIds);
  const idNum = Number(animeId);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return { ids: normalized, watchlisted: false };
  }

  if (normalized.includes(idNum)) {
    return {
      ids: normalized.filter((id) => id !== idNum),
      watchlisted: false,
    };
  }

  return {
    ids: [...normalized, idNum],
    watchlisted: true,
  };
}

/**
 * Merges server D1 watchlist IDs with locally saved guest IDs.
 * Returns the combined deduplicated IDs and the subset of guest IDs that still need
 * to be persisted to the server via POST /api/watchlist.
 */
export function mergeGuestAndServerWatchlist(
  serverIdsRaw: unknown[],
  guestIdsRaw: unknown[]
): { mergedIds: number[]; toSyncIds: number[] } {
  const serverIds = normalizeWatchlistIds(serverIdsRaw);
  const guestIds = normalizeWatchlistIds(guestIdsRaw);
  const serverSet = new Set(serverIds);

  const toSyncIds = guestIds.filter((id) => !serverSet.has(id));
  const mergedIds = [...serverIds, ...toSyncIds];

  return { mergedIds, toSyncIds };
}
