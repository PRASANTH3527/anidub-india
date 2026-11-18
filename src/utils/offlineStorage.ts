/**
 * Offline Storage Utility (IndexedDB metadata + Cache Storage cover image caching)
 * Stores saved anime metadata and cover images locally for real offline availability.
 */

export const OFFLINE_DB_NAME = 'anidub_offline_v1';
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_STORE_NAME = 'anime_entries';
export const OFFLINE_CACHE_NAME = 'anidub-offline-media-v1';
export const OFFLINE_CHANGED_EVENT = 'anidub:offline-updated';

export interface OfflineAnimeInput {
  id: number | string;
  title: string;
  slug?: string;
  synopsis?: string;
  cover_image?: string;
  posterUrl?: string;
  poster?: string;
  image?: string;
  banner_image?: string;
  rating?: number | string | null;
  episodes_count?: number | null;
  status?: string;
  airing_status?: string;
  season?: string;
  year?: number | null;
  releaseYear?: number;
  genres?: string;
  languages?: string | string[];
  platform?: string | string[];
  type?: string;
  [key: string]: unknown;
}

export interface OfflineAnimeRecord {
  id: number;
  title: string;
  posterUrl: string;
  posterDataUrl?: string | null;
  cachedInCacheStorage: boolean;
  savedAt: string;
  anime: OfflineAnimeInput;
}

export function resolveOfflinePosterUrl(anime: OfflineAnimeInput): string {
  const candidates = [
    anime.cover_image,
    anime.posterUrl,
    anime.image,
    anime.poster,
    anime.poster_url,
    anime.banner_image,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim();
    }
  }
  return '/logo.png';
}

export function normalizeOfflineAnimeRecord(
  anime: OfflineAnimeInput,
  options: { cachedInCacheStorage?: boolean; posterDataUrl?: string | null; savedAt?: string } = {}
): OfflineAnimeRecord | null {
  const idNum = Number(anime?.id);
  if (!Number.isInteger(idNum) || idNum <= 0) return null;

  const title = typeof anime.title === 'string' && anime.title.trim() ? anime.title.trim() : `Anime #${idNum}`;
  const posterUrl = resolveOfflinePosterUrl(anime);

  return {
    id: idNum,
    title,
    posterUrl,
    posterDataUrl: options.posterDataUrl ?? null,
    cachedInCacheStorage: Boolean(options.cachedInCacheStorage),
    savedAt: options.savedAt || new Date().toISOString(),
    anime: {
      ...anime,
      id: idNum,
      title,
      cover_image: posterUrl,
    },
  };
}

function dispatchOfflineChangedEvent(animeId?: number) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(OFFLINE_CHANGED_EVENT, { detail: { animeId } }));
  } catch {
    // Ignore event dispatch failures
  }
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
          db.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readFallbackLocalMap(): Record<string, OfflineAnimeRecord> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OFFLINE_DB_NAME);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, OfflineAnimeRecord>) : {};
  } catch {
    return {};
  }
}

function writeFallbackLocalMap(map: Record<string, OfflineAnimeRecord>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_DB_NAME, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

async function cacheCoverImageAsset(posterUrl: string): Promise<{ cached: boolean; dataUrl: string | null }> {
  if (!posterUrl) return { cached: false, dataUrl: null };
  let cachedInStore = false;
  let dataUrl: string | null = null;

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      let res = await fetch(posterUrl, { mode: 'cors', credentials: 'omit' }).catch(() => null);
      if (res && res.ok) {
        await cache.put(posterUrl, res.clone());
        cachedInStore = true;
        try {
          const blob = await res.blob();
          if (blob.size <= 300_000 && typeof FileReader !== 'undefined') {
            dataUrl = await new Promise<string | null>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
          }
        } catch {
          // Optional base64 preview
        }
      } else {
        // Fallback opaque no-cors fetch for third-party image CDNs without CORS headers
        const req = new Request(posterUrl, { mode: 'no-cors' });
        const opaqueRes = await fetch(req).catch(() => null);
        if (opaqueRes) {
          await cache.put(posterUrl, opaqueRes);
          cachedInStore = true;
        }
      }
    } catch {
      // Cache Storage may be unavailable in insecure contexts
    }
  }

  return { cached: cachedInStore, dataUrl };
}

async function deleteCachedCoverImage(posterUrl?: string): Promise<void> {
  if (!posterUrl || typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    await cache.delete(posterUrl);
  } catch {
    // Ignore Cache Storage deletion failures
  }
}

export async function saveAnimeForOffline(
  anime: OfflineAnimeInput
): Promise<{ success: boolean; record?: OfflineAnimeRecord; error?: string }> {
  const posterUrl = resolveOfflinePosterUrl(anime);
  const { cached, dataUrl } = await cacheCoverImageAsset(posterUrl);
  const record = normalizeOfflineAnimeRecord(anime, {
    cachedInCacheStorage: cached,
    posterDataUrl: dataUrl,
    savedAt: new Date().toISOString(),
  });

  if (!record) {
    return { success: false, error: 'Valid anime ID is required for offline caching.' };
  }

  const db = await openOfflineDb();
  if (db) {
    const stored = await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        store.put(record);
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          resolve(false);
        };
      } catch {
        db.close();
        resolve(false);
      }
    });

    if (stored) {
      dispatchOfflineChangedEvent(record.id);
      return { success: true, record };
    }
  }

  // IndexedDB fallback only when browser IndexedDB is unavailable (e.g. private sandbox)
  const fallbackMap = readFallbackLocalMap();
  fallbackMap[String(record.id)] = { ...record, posterDataUrl: null };
  writeFallbackLocalMap(fallbackMap);
  dispatchOfflineChangedEvent(record.id);
  return { success: true, record };
}

export async function getOfflineAnime(animeId: number | string): Promise<OfflineAnimeRecord | null> {
  const idNum = Number(animeId);
  if (!Number.isInteger(idNum) || idNum <= 0) return null;

  const db = await openOfflineDb();
  if (db) {
    const fromDb = await new Promise<OfflineAnimeRecord | null>((resolve) => {
      try {
        const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        const req = store.get(idNum);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as OfflineAnimeRecord) || null);
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
    if (fromDb) return fromDb;
  }

  const fallbackMap = readFallbackLocalMap();
  return fallbackMap[String(idNum)] || null;
}

export async function isAnimeOffline(animeId: number | string): Promise<boolean> {
  const record = await getOfflineAnime(animeId);
  return Boolean(record);
}

export async function getAllOfflineAnime(): Promise<OfflineAnimeRecord[]> {
  const db = await openOfflineDb();
  if (db) {
    const rows = await new Promise<OfflineAnimeRecord[]>((resolve) => {
      try {
        const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          db.close();
          resolve(Array.isArray(req.result) ? (req.result as OfflineAnimeRecord[]) : []);
        };
        req.onerror = () => {
          db.close();
          resolve([]);
        };
      } catch {
        db.close();
        resolve([]);
      }
    });
    if (rows.length > 0) return rows;
  }

  return Object.values(readFallbackLocalMap());
}

export async function getOfflineAnimeIds(): Promise<number[]> {
  const rows = await getAllOfflineAnime();
  return rows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);
}

export async function removeAnimeFromOffline(animeId: number | string): Promise<boolean> {
  const idNum = Number(animeId);
  if (!Number.isInteger(idNum) || idNum <= 0) return false;

  const existing = await getOfflineAnime(idNum);
  if (existing?.posterUrl) {
    await deleteCachedCoverImage(existing.posterUrl);
  }

  const db = await openOfflineDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        store.delete(idNum);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }

  const fallbackMap = readFallbackLocalMap();
  if (fallbackMap[String(idNum)]) {
    delete fallbackMap[String(idNum)];
    writeFallbackLocalMap(fallbackMap);
  }

  dispatchOfflineChangedEvent(idNum);
  return true;
}

export function subscribeOfflineChanges(listener: (animeId?: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ animeId?: number }>;
    listener(customEvent?.detail?.animeId);
  };
  window.addEventListener(OFFLINE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(OFFLINE_CHANGED_EVENT, handler);
}
