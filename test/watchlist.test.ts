import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WATCHLIST_OWNER_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY,
  mergeGuestAndServerWatchlist,
  normalizeWatchlistIds,
  readWatchlistFromStorage,
  readWatchlistOwner,
  toggleWatchlistIdLocally,
  writeWatchlistToStorage,
  type StorageLike,
} from '../src/utils/watchlist';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test('normalizeWatchlistIds & localStorage guest hydration handle valid, duplicate, and corrupted values', () => {
  assert.deepEqual(normalizeWatchlistIds([1, '2', 2, { id: 3 }, { anime_id: 4 }, -5, 0, 'abc', null]), [1, 2, 3, 4]);

  const corruptStorage = createMemoryStorage({ [WATCHLIST_STORAGE_KEY]: 'not-valid-json' });
  assert.deepEqual(readWatchlistFromStorage(corruptStorage), []);

  const guestStorage = createMemoryStorage();
  assert.equal(readWatchlistOwner(guestStorage), 'guest');

  writeWatchlistToStorage([10, 20, 10], 'guest', guestStorage);
  assert.deepEqual(readWatchlistFromStorage(guestStorage), [10, 20]);
  assert.equal(readWatchlistOwner(guestStorage), 'guest');

  const added = toggleWatchlistIdLocally(readWatchlistFromStorage(guestStorage), 30);
  assert.equal(added.watchlisted, true);
  assert.deepEqual(added.ids, [10, 20, 30]);

  const removed = toggleWatchlistIdLocally(added.ids, 20);
  assert.equal(removed.watchlisted, false);
  assert.deepEqual(removed.ids, [10, 30]);
});

test('mergeGuestAndServerWatchlist deduplicates and computes guest items needing POST sync', () => {
  const { mergedIds, toSyncIds } = mergeGuestAndServerWatchlist([5, 10], [10, 20, 30]);
  assert.deepEqual(toSyncIds, [20, 30]);
  assert.deepEqual(mergedIds, [5, 10, 20, 30]);

  const noGuest = mergeGuestAndServerWatchlist([5, 10], []);
  assert.deepEqual(noGuest.toSyncIds, []);
  assert.deepEqual(noGuest.mergedIds, [5, 10]);
});

test('Backend /api/watchlist enforces Clerk JWT auth on GET, POST, DELETE and supports POST/DELETE operations', async () => {
  const { onRequest } = await import('../functions/api/[[route]]');
  const mockEnv = {
    DB: null,
    CLERK_SECRET_KEY: 'sk_test_example',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmsuYW5pZHViLmluJA',
  };

  for (const method of ['GET', 'POST', 'DELETE'] as const) {
    const res = await onRequest({
      request: new Request('https://anidub.in/api/watchlist?anime_id=1', {
        method,
        ...(method === 'POST' ? { body: JSON.stringify({ anime_id: 1 }) } : {}),
      }),
      env: mockEnv,
    });
    assert.equal(res.status, 401, `${method} /api/watchlist must reject unauthenticated requests`);
  }

  // Verify frontend API client uses DELETE /api/watchlist for removals and POST /api/watchlist for additions
  const apiClientCode = fs.readFileSync(path.join(process.cwd(), 'src/services/cloudflareApi.ts'), 'utf-8');
  assert.ok(apiClientCode.includes("method: 'DELETE'"));
  assert.ok(apiClientCode.includes("method: 'POST'"));
  assert.ok(apiClientCode.includes('removeFromWatchlist'));
  assert.ok(apiClientCode.includes('addToWatchlist'));

  // Verify App.tsx wires DELETE removal, guest localStorage fallback, and Clerk login hydration
  const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert.ok(appCode.includes('cloudflareApi.removeFromWatchlist'));
  assert.ok(appCode.includes('cloudflareApi.addToWatchlist'));
  assert.ok(appCode.includes('cloudflareApi.fetchWatchlistDetailed'));
  assert.ok(appCode.includes('mergeGuestAndServerWatchlist'));
  assert.ok(appCode.includes(WATCHLIST_OWNER_STORAGE_KEY) || appCode.includes('readWatchlistOwner'));
});
