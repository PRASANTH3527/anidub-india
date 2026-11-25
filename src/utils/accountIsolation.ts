/**
 * Account Data Isolation helpers for AniDub India.
 *
 * Scopes personal client-side cache (profile display name, avatar, preferences,
 * watch progress, library statuses, recent searches, subscriptions, and recently viewed)
 * strictly by the signed-in Clerk userId (`guest` when signed out), and resets shared/legacy
 * unscoped keys whenever a user logs out or switches accounts so zero personal data leaks.
 */

export interface SimpleStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

export const ACTIVE_ACCOUNT_OWNER_KEY = 'anidub_active_account_id_v1';
export const ACCOUNT_CHANGED_EVENT = 'anidub:account-changed';

export const LEGACY_PERSONAL_STORAGE_KEYS = [
  'anidub_custom_name',
  'anidub_anime_avatar',
  'cf_anime_watchlist',
  'cf_anime_watchlist_owner',
  'cf_anime_recently_viewed',
  'cf_watch_progress_v1',
  'cf_watched_anime_ids',
  'anidub_my_subscriptions',
  'anidub_my_subscriptions_enabled',
  'anidub_spoiler_protection_v1',
  'anidub_preferred_language_v1',
  'anidub_recent_searches_v1',
  'anidub_library_statuses_v1',
] as const;

function resolveStorage(storage?: SimpleStorageLike | null): SimpleStorageLike | null {
  if (storage !== undefined) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // Restricted storage environment
  }
  return null;
}

export function normalizeAccountId(userId?: string | null): string {
  if (typeof userId !== 'string') return 'guest';
  const clean = userId.trim();
  return clean.length > 0 ? clean : 'guest';
}

export function getActiveAccountId(storage?: SimpleStorageLike | null): string {
  const store = resolveStorage(storage);
  if (!store) return 'guest';
  try {
    return normalizeAccountId(store.getItem(ACTIVE_ACCOUNT_OWNER_KEY));
  } catch {
    return 'guest';
  }
}

export function setActiveAccountId(
  userId?: string | null,
  storage?: SimpleStorageLike | null
): string {
  const normalized = normalizeAccountId(userId);
  const store = resolveStorage(storage);
  if (store) {
    try {
      store.setItem(ACTIVE_ACCOUNT_OWNER_KEY, normalized);
    } catch {}
  }
  return normalized;
}

export function getScopedStorageKey(baseKey: string, userId?: string | null): string {
  const resolvedOwner =
    userId !== undefined ? normalizeAccountId(userId) : getActiveAccountId();
  return `${baseKey}::${resolvedOwner}`;
}

export function readScopedString(
  baseKey: string,
  userId?: string | null,
  fallback = '',
  storage?: SimpleStorageLike | null
): string {
  const store = resolveStorage(storage);
  if (!store) return fallback;
  const owner = userId !== undefined ? normalizeAccountId(userId) : getActiveAccountId(store);
  try {
    const scoped = store.getItem(`${baseKey}::${owner}`);
    if (scoped !== null) return scoped;
    // Allow guest to read legacy unscoped value once before migration, but NEVER leak it into a signed-in user
    if (owner === 'guest') {
      const legacy = store.getItem(baseKey);
      if (legacy !== null) return legacy;
    }
  } catch {}
  return fallback;
}

export function writeScopedString(
  baseKey: string,
  value: string,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  const owner = userId !== undefined ? normalizeAccountId(userId) : getActiveAccountId(store);
  try {
    store.setItem(`${baseKey}::${owner}`, value);
  } catch {}
}

export function removeScopedKey(
  baseKey: string,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store || typeof store.removeItem !== 'function') return;
  const owner = userId !== undefined ? normalizeAccountId(userId) : getActiveAccountId(store);
  try {
    store.removeItem(`${baseKey}::${owner}`);
  } catch {}
}

export function readScopedJson<T>(
  baseKey: string,
  fallback: T,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): T {
  const raw = readScopedString(baseKey, userId, '', storage);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeScopedJson<T>(
  baseKey: string,
  value: T,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): void {
  try {
    writeScopedString(baseKey, JSON.stringify(value), userId, storage);
  } catch {}
}

/**
 * Transitions the active account owner cleanly.
 * When logging out or switching between two signed-in accounts, removes all shared/legacy
 * unscoped personal keys and optionally purges the outgoing user's cached local keys so
 * zero personal state ever leaks to the next session.
 */
export function transitionAccountStorage(
  previousUserId: string | null | undefined,
  nextUserId: string | null | undefined,
  options: { purgePreviousUserScopedKeys?: boolean; storage?: SimpleStorageLike | null } = {}
): { prevOwner: string; nextOwner: string; clearedKeys: string[] } {
  const store = resolveStorage(options.storage);
  const prevOwner = normalizeAccountId(previousUserId);
  const nextOwner = normalizeAccountId(nextUserId);
  const clearedKeys: string[] = [];

  if (store && prevOwner !== nextOwner) {
    const isLogout = prevOwner !== 'guest' && nextOwner === 'guest';
    const isAccountSwitch = prevOwner !== 'guest' && nextOwner !== 'guest' && prevOwner !== nextOwner;

    if (isLogout || isAccountSwitch) {
      for (const legacyKey of LEGACY_PERSONAL_STORAGE_KEYS) {
        try {
          if (typeof store.removeItem === 'function') {
            store.removeItem(legacyKey);
          } else {
            store.setItem(legacyKey, '');
          }
          clearedKeys.push(legacyKey);
        } catch {}
      }

      if (options.purgePreviousUserScopedKeys) {
        for (const baseKey of LEGACY_PERSONAL_STORAGE_KEYS) {
          const scopedKey = `${baseKey}::${prevOwner}`;
          try {
            if (typeof store.removeItem === 'function') {
              store.removeItem(scopedKey);
            }
            clearedKeys.push(scopedKey);
          } catch {}
        }
      }
    }

    setActiveAccountId(nextOwner, store);
  } else if (store) {
    setActiveAccountId(nextOwner, store);
  }

  if (typeof window !== 'undefined' && prevOwner !== nextOwner) {
    try {
      window.dispatchEvent(
        new CustomEvent(ACCOUNT_CHANGED_EVENT, { detail: { prevOwner, nextOwner } })
      );
    } catch {}
  }

  return { prevOwner, nextOwner, clearedKeys };
}
