// ==============================================================================
// AniDub India — Service Worker with PWA Background Sync & IndexedDB Queue
// ==============================================================================

const CACHE_NAME = 'anidub-pwa-v3';
const POSTER_CACHE_NAME = 'anidub-posters-v2';
const MAX_POSTERS = 120;
const DB_NAME = 'anidub-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-watchlist';
const SYNC_TAG = 'sync-watchlist';

// Offline SVG Fallback poster placeholder
const OFFLINE_POSTER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600" fill="none">
  <rect width="400" height="600" fill="#0d131f"/>
  <rect x="20" y="20" width="360" height="560" rx="16" stroke="#253047" stroke-width="2" stroke-dasharray="6 6"/>
  <circle cx="200" cy="250" r="48" fill="#1c2436"/>
  <path d="M185 240L215 240M200 225L200 255" stroke="#7c3aed" stroke-width="4" stroke-linecap="round"/>
  <path d="M175 270L195 245L210 262L220 252L235 270H175Z" fill="#a855f7"/>
  <text x="200" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#e2e8f0" text-anchor="middle">Poster Offline</text>
  <text x="200" y="370" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">AniDub India Offline Cache</text>
</svg>
`.trim();

// --- Lifecycle Events ---
const PRECACHE_ASSETS = ['/', '/share', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Precache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== POSTER_CACHE_NAME) {
            console.log('[ServiceWorker] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Trim Poster Cache LRU
async function trimPosterCache(maxItems) {
  try {
    const cache = await caches.open(POSTER_CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (err) {
    console.warn('[ServiceWorker] Failed to trim poster cache:', err);
  }
}

// Helper: Check if request is an image or anime poster
function isImageRequest(request) {
  if (request.destination === 'image') return true;
  const url = request.url.toLowerCase();
  return (
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.png') ||
    url.endsWith('.webp') ||
    url.endsWith('.avif') ||
    url.endsWith('.gif') ||
    url.includes('images.unsplash.com') ||
    url.includes('cdn.myanimelist.net') ||
    url.includes('s4.anilist.co') ||
    url.includes('media.kitsu.io') ||
    url.includes('crunchyroll.com') ||
    url.includes('static.wikia.nocookie.net') ||
    url.includes('m.media-amazon.com')
  );
}

// --- IndexedDB Queue Management ---
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queuePendingRequest(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getPendingRequests() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removePendingRequest(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Background Sync Replay Logic ---
async function replayWatchlistQueue() {
  console.log('[ServiceWorker] Background Sync started: Replaying queued watchlist items...');
  const queue = await getPendingRequests();
  if (!queue || queue.length === 0) {
    return;
  }

  let replayedCount = 0;

  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok) {
        await removePendingRequest(item.id);
        replayedCount++;
        console.log(`[ServiceWorker] Synced item #${item.id} successfully.`);
      }
    } catch (err) {
      console.warn(`[ServiceWorker] Replay failed for #${item.id}, will retry on next sync event.`, err);
      // Keep in queue for next sync opportunity
    }
  }

  // Notify all open window clients that sync succeeded
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETED',
      count: replayedCount,
      timestamp: Date.now(),
    });
  });
}

// --- Sync Event Listener ---
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayWatchlistQueue());
  }
});

// --- Fetch Interceptor ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Intercept 'Add to Watchlist' POST requests
  if (url.pathname.includes('/api/watchlist') && event.request.method === 'POST') {
    event.respondWith(
      fetch(event.request.clone()).catch(async (error) => {
        console.info('[ServiceWorker] Offline detected. Queuing watchlist request into IndexedDB...');

        try {
          const bodyText = await event.request.clone().text();
          const headersObj = {};
          for (const [k, v] of event.request.headers.entries()) {
            headersObj[k] = v;
          }

          // Store in IndexedDB
          await queuePendingRequest({
            url: event.request.url,
            method: event.request.method,
            headers: headersObj,
            body: bodyText,
            timestamp: Date.now(),
          });

          // Register for Background Sync with browser
          if ('sync' in self.registration) {
            try {
              await self.registration.sync.register(SYNC_TAG);
              console.log('[ServiceWorker] Background sync registered for:', SYNC_TAG);
            } catch (syncErr) {
              console.warn('[ServiceWorker] Sync registration failed:', syncErr);
            }
          }

          // Return synthetic accepted response so the client knows it was queued offline
          return new Response(
            JSON.stringify({
              offline: true,
              queued: true,
              message: 'Saved Offline - Will sync when connected',
            }),
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (queueErr) {
          console.error('[ServiceWorker] Failed to queue request into IndexedDB:', queueErr);
          throw error;
        }
      })
    );
    return;
  }

  // 2. Poster & Image Requests: Cache-First with Stale-While-Revalidate and Offline Fallback
  if (isImageRequest(event.request)) {
    event.respondWith(
      caches.open(POSTER_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);

        // Background network fetch to keep cache fresh (stale-while-revalidate)
        const fetchPromise = fetch(event.request.clone())
          .then(async (networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              await cache.put(event.request, networkResponse.clone());
              trimPosterCache(MAX_POSTERS);
            }
            return networkResponse;
          })
          .catch(() => {
            if (!cachedResponse) {
              return new Response(OFFLINE_POSTER_SVG, {
                status: 200,
                headers: { 'Content-Type': 'image/svg+xml' },
              });
            }
            return cachedResponse;
          });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Navigation requests: Network first with Cache fallback (handles offline /share and /)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/share') || caches.match('/');
          });
        })
    );
    return;
  }

  // 4. Default network fetch for all other requests
  event.respondWith(fetch(event.request));
});
