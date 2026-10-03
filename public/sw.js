// ==============================================================================
// AniDub India — Service Worker with PWA Background Sync & IndexedDB Queue
// ==============================================================================

const CACHE_NAME = 'anidub-pwa-v1';
const DB_NAME = 'anidub-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-watchlist';
const SYNC_TAG = 'sync-watchlist';

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
  event.waitUntil(self.clients.claim());
});

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

  // 2. Navigation requests: Network first with Cache fallback (handles offline /share and /)
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

  // 3. Default network fetch for all other requests
  event.respondWith(fetch(event.request));
});
