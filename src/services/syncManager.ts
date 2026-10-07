// ==============================================================================
// AniDub India — Advanced Enterprise-Grade Firebase Sync & Queue Manager
// IndexedDB-backed Queue, Batched Firestore Writes, and Exponential Backoff
// ==============================================================================

import { openDB, IDBPDatabase } from 'idb';
import { 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AnimeRecord } from '../types/database';

export const SYNC_DB_NAME = 'anidub_sync_db';
export const SYNC_DB_VERSION = 1;

export const SYNC_STORES = {
  ADMIN_UPLOADS: 'admin_pending_uploads',
  USER_SUBMISSIONS: 'user_pending_submissions',
  META: 'sync_meta',
} as const;

export const SYNC_TAG = 'anidub-sync-queue';

export interface BackoffState {
  attempts: number;
  nextRetryTime: number; // Unix timestamp in ms
  lastError?: string;
  isQuotaHit: boolean;
}

export interface SyncStatus {
  adminQueueCount: number;
  userQueueCount: number;
  isSyncing: boolean;
  quotaHit: boolean;
  nextRetryInSeconds: number | null;
  lastSyncedAt: number | null;
}

// Check if error is Firestore Resource Exhausted / Quota Limit
export function isFirestoreQuotaError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  const msg = String(err.message || '').toLowerCase();
  const name = String(err.name || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code === 'quota-exceeded' ||
    code.includes('exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    name.includes('quota')
  );
}

// Exponential Backoff parameters (1m, 2m, 4m, 8m, max 16m)
const BASE_DELAY_MS = 60 * 1000;       // 1 minute
const MAX_DELAY_MS = 16 * 60 * 1000;    // 16 minutes
const BATCH_CHUNK_SIZE = 75;            // ~75 anime * 3 docs (animes, submissions, activities) = 225 ops per batch <= 250 limit

// Helper to remove any undefined fields before saving to Firestore to prevent crashes
function cleanFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanFirestoreData);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    // Basic check to see if it looks like a Firestore FieldValue or complex object we shouldn't deep-clean
    if (obj.constructor && (obj.constructor.name === 'FieldValue' || obj.constructor.name === 'Timestamp')) {
      return obj;
    }
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        res[key] = cleanFirestoreData(val);
      }
    }
    return res;
  }
  return obj;
}

class SyncManager {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private isSyncingAdmin = false;
  private isSyncingUser = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private lastSyncedAt: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initDB();
      this.migrateLegacyLocalStorage();
      this.setupEventListeners();
    }
  }

  // --- 1. IndexedDB Initialization & Management ---
  public async getDB(): Promise<IDBPDatabase> {
    if (typeof window === 'undefined') {
      throw new Error('IndexedDB is only accessible in browser environment.');
    }
    if (!this.dbPromise) {
      this.dbPromise = openDB(SYNC_DB_NAME, SYNC_DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(SYNC_STORES.ADMIN_UPLOADS)) {
            database.createObjectStore(SYNC_STORES.ADMIN_UPLOADS, { keyPath: 'id' });
          }
          if (!database.objectStoreNames.contains(SYNC_STORES.USER_SUBMISSIONS)) {
            database.createObjectStore(SYNC_STORES.USER_SUBMISSIONS, { keyPath: 'id' });
          }
          if (!database.objectStoreNames.contains(SYNC_STORES.META)) {
            database.createObjectStore(SYNC_STORES.META, { keyPath: 'key' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  private async initDB() {
    try {
      await this.getDB();
      this.notifyListeners();
    } catch (err) {
      console.warn('[SyncManager] Error initializing IndexedDB:', err);
    }
  }

  // Seamlessly migrate any legacy items from localStorage into IndexedDB
  private async migrateLegacyLocalStorage() {
    try {
      const db = await this.getDB();

      // Migrate admin_pending_uploads
      const legacyAdmin = localStorage.getItem('admin_pending_uploads');
      if (legacyAdmin) {
        try {
          const parsed = JSON.parse(legacyAdmin);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const tx = db.transaction(SYNC_STORES.ADMIN_UPLOADS, 'readwrite');
            for (const item of parsed) {
              const id = item.id || ('sub-' + Math.random().toString(36).substring(2, 9));
              await tx.store.put({ ...item, id });
            }
            await tx.done;
            console.log(`[SyncManager] Migrated ${parsed.length} items from localStorage to IndexedDB.`);
          }
          localStorage.removeItem('admin_pending_uploads');
        } catch {}
      }

      // Migrate user_pending_submissions
      const legacyUser = localStorage.getItem('user_pending_submissions');
      if (legacyUser) {
        try {
          const parsed = JSON.parse(legacyUser);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const tx = db.transaction(SYNC_STORES.USER_SUBMISSIONS, 'readwrite');
            for (const item of parsed) {
              const id = item.id || ('sub-' + Math.random().toString(36).substring(2, 9));
              await tx.store.put({ ...item, id });
            }
            await tx.done;
            console.log(`[SyncManager] Migrated ${parsed.length} user submissions from localStorage to IndexedDB.`);
          }
          localStorage.removeItem('user_pending_submissions');
        } catch {}
      }

      this.notifyListeners();
    } catch (err) {
      console.warn('[SyncManager] Migration notice:', err);
    }
  }

  private setupEventListeners() {
    // When browser returns online, evaluate retry
    window.addEventListener('online', () => {
      console.log('[SyncManager] Network online. Attempting background sync...');
      this.syncAllQueues();
    });

    // When tab regains focus or visibility, check sync
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkScheduledRetry();
      }
    });
  }

  // --- 2. Exponential Backoff Engine ---
  public async getBackoff(queueKey: 'admin' | 'user'): Promise<BackoffState> {
    try {
      const db = await this.getDB();
      const meta = await db.get(SYNC_STORES.META, `${queueKey}_backoff`);
      if (meta) {
        return {
          attempts: meta.attempts || 0,
          nextRetryTime: meta.nextRetryTime || 0,
          lastError: meta.lastError,
          isQuotaHit: Boolean(meta.isQuotaHit),
        };
      }
    } catch {}
    return { attempts: 0, nextRetryTime: 0, isQuotaHit: false };
  }

  public async setBackoff(queueKey: 'admin' | 'user', error: any): Promise<number> {
    const current = await this.getBackoff(queueKey);
    const isQuota = isFirestoreQuotaError(error);
    const nextAttempts = current.attempts + 1;

    // Progression: 1m (60s), 2m (120s), 4m (240s), 8m (480s), up to 16m
    const rawDelay = Math.min(BASE_DELAY_MS * Math.pow(2, nextAttempts - 1), MAX_DELAY_MS);
    // Add jitter (+- 10%)
    const jitter = (Math.random() * 0.2 - 0.1) * rawDelay;
    const delay = Math.max(10000, Math.round(rawDelay + jitter));
    const nextRetryTime = Date.now() + delay;

    try {
      const db = await this.getDB();
      await db.put(SYNC_STORES.META, {
        key: `${queueKey}_backoff`,
        attempts: nextAttempts,
        nextRetryTime,
        lastError: String(error?.message || error || 'Quota exceeded'),
        isQuotaHit: isQuota,
      });
    } catch {}

    this.scheduleTimer(delay);
    this.notifyListeners();
    return delay;
  }

  public async resetBackoff(queueKey: 'admin' | 'user'): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete(SYNC_STORES.META, `${queueKey}_backoff`);
    } catch {}
    this.notifyListeners();
  }

  private scheduleTimer(delayMs: number) {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.retryTimer = setTimeout(() => {
      this.syncAllQueues();
    }, delayMs);
  }

  private async checkScheduledRetry() {
    const adminBackoff = await this.getBackoff('admin');
    const userBackoff = await this.getBackoff('user');
    const now = Date.now();

    if (
      (adminBackoff.nextRetryTime > 0 && now >= adminBackoff.nextRetryTime) ||
      (userBackoff.nextRetryTime > 0 && now >= userBackoff.nextRetryTime)
    ) {
      this.syncAllQueues();
    }
  }

  // --- 3. Admin Bulk Import: Storage & Batched Writes (<=250 ops/chunk) ---
  public async enqueueAdminUploads(items: any[]): Promise<number> {
    if (!Array.isArray(items) || items.length === 0) return 0;
    const db = await this.getDB();
    const tx = db.transaction(SYNC_STORES.ADMIN_UPLOADS, 'readwrite');
    let enqueued = 0;

    for (const raw of items) {
      const rawTitle = (raw.title || raw.name || '').trim();
      if (!rawTitle) continue;
      const id = raw.id || ('sub-' + Math.random().toString(36).substring(2, 9));
      await tx.store.put({
        ...raw,
        id,
        status: 'pending',
        submissionStatus: 'pending',
        queuedAt: new Date().toISOString(),
      });
      enqueued++;
    }

    await tx.done;
    this.notifyListeners();
    return enqueued;
  }

  public async getAdminPendingUploads(): Promise<any[]> {
    try {
      const db = await this.getDB();
      return await db.getAll(SYNC_STORES.ADMIN_UPLOADS);
    } catch {
      return [];
    }
  }

  public async getAdminPendingCount(): Promise<number> {
    try {
      const db = await this.getDB();
      return await db.count(SYNC_STORES.ADMIN_UPLOADS);
    } catch {
      return 0;
    }
  }

  public async clearAdminPendingUploads(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear(SYNC_STORES.ADMIN_UPLOADS);
      await this.resetBackoff('admin');
      this.notifyListeners();
    } catch (err) {
      console.warn('[SyncManager] Error clearing admin uploads:', err);
    }
  }

  /**
   * Processes Admin Bulk Upload in Chunks using Firestore writeBatch (<= 250 ops per batch)
   */
  public async processAdminBatchUpload(chunkSize = BATCH_CHUNK_SIZE): Promise<{
    added: number;
    failed: number;
    quotaHit: boolean;
    remaining: number;
    delaySeconds?: number;
  }> {
    if (this.isSyncingAdmin) {
      const count = await this.getAdminPendingCount();
      return { added: 0, failed: 0, quotaHit: false, remaining: count };
    }

    // Check backoff condition
    const backoff = await this.getBackoff('admin');
    if (backoff.nextRetryTime > Date.now()) {
      const remainingSec = Math.ceil((backoff.nextRetryTime - Date.now()) / 1000);
      const count = await this.getAdminPendingCount();
      console.warn(`[SyncManager] Admin upload backed off. Retry in ${remainingSec}s.`);
      return { added: 0, failed: 0, quotaHit: true, remaining: count, delaySeconds: remainingSec };
    }

    this.isSyncingAdmin = true;
    this.notifyListeners();

    let addedCount = 0;
    let failedCount = 0;
    let quotaHit = false;

    try {
      const dbInstance = await this.getDB();
      let allQueued = await dbInstance.getAll(SYNC_STORES.ADMIN_UPLOADS);

      while (allQueued.length > 0) {
        // Take a chunk of up to BATCH_CHUNK_SIZE items (<= 250 operations)
        const chunk = allQueued.slice(0, chunkSize);
        const batch = writeBatch(db);
        const chunkIds: string[] = [];

        for (const item of chunk) {
          const finalId = item.id;
          chunkIds.push(finalId);

          const animeRef = doc(db, 'anime_list', finalId);
          const actRef = doc(db, 'activities', `act-import-${finalId}-${Date.now()}`);

          const docData = cleanFirestoreData({
            ...item,
            status: 'pending',
            submissionStatus: 'pending',
            updatedAt: new Date().toISOString(),
          });

          batch.set(animeRef, docData, { merge: true });
          batch.set(actRef, {
            user: 'Admin (Bulk Sync)',
            action: 'submitted',
            animeTitle: item.title,
            timestamp: serverTimestamp(),
            language: item.dubs?.[0] || 'Tamil',
            status: 'pending',
          });
        }

        try {
          // Execute Firestore batched write
          await batch.commit();

          // Batch succeeded! Remove this entire chunk from IndexedDB
          const tx = dbInstance.transaction(SYNC_STORES.ADMIN_UPLOADS, 'readwrite');
          for (const id of chunkIds) {
            await tx.store.delete(id);
          }
          await tx.done;

          addedCount += chunk.length;
          allQueued = allQueued.slice(chunk.length);
          this.lastSyncedAt = Date.now();
          this.notifyListeners();
        } catch (batchErr: any) {
          console.error('[SyncManager] Batch write error:', batchErr);
          if (isFirestoreQuotaError(batchErr)) {
            quotaHit = true;
            const delay = await this.setBackoff('admin', batchErr);
            console.warn(`[SyncManager] Quota limit encountered. Backing off for ${Math.round(delay / 1000)}s.`);
            break; // Stop immediately, leave remaining items safely in IndexedDB
          } else {
            // Other error: remove failed chunk to prevent infinite blockage
            const tx = dbInstance.transaction(SYNC_STORES.ADMIN_UPLOADS, 'readwrite');
            for (const id of chunkIds) {
              await tx.store.delete(id);
            }
            await tx.done;
            failedCount += chunk.length;
            allQueued = allQueued.slice(chunk.length);
          }
        }
      }

      if (!quotaHit) {
        await this.resetBackoff('admin');
      }

      const remaining = await this.getAdminPendingCount();
      return { added: addedCount, failed: failedCount, quotaHit, remaining };
    } finally {
      this.isSyncingAdmin = false;
      this.notifyListeners();
    }
  }

  // --- 4. User Submissions: Storage & Silent Background Sync ---
  public async enqueueUserSubmission(submission: AnimeRecord): Promise<void> {
    const db = await this.getDB();
    const id = submission.id || ('sub-' + Math.random().toString(36).substring(2, 9));
    await db.put(SYNC_STORES.USER_SUBMISSIONS, {
      ...submission,
      id,
      status: 'pending',
      submissionStatus: 'pending',
      queuedAt: new Date().toISOString(),
    });
    this.notifyListeners();

    // Trigger Service Worker Background Sync API if supported
    this.requestServiceWorkerSync();
  }

  public async getUserPendingSubmissions(): Promise<AnimeRecord[]> {
    try {
      const db = await this.getDB();
      return await db.getAll(SYNC_STORES.USER_SUBMISSIONS);
    } catch {
      return [];
    }
  }

  public async getUserPendingCount(): Promise<number> {
    try {
      const db = await this.getDB();
      return await db.count(SYNC_STORES.USER_SUBMISSIONS);
    } catch {
      return 0;
    }
  }

  public async clearUserPendingSubmissions(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear(SYNC_STORES.USER_SUBMISSIONS);
      await this.resetBackoff('user');
      this.notifyListeners();
    } catch {}
  }

  public async syncUserSubmissions(): Promise<{ synced: number; remaining: number }> {
    if (this.isSyncingUser) {
      const count = await this.getUserPendingCount();
      return { synced: 0, remaining: count };
    }

    // Check backoff condition
    const backoff = await this.getBackoff('user');
    if (backoff.nextRetryTime > Date.now()) {
      const count = await this.getUserPendingCount();
      return { synced: 0, remaining: count };
    }

    this.isSyncingUser = true;
    this.notifyListeners();

    let synced = 0;
    try {
      const dbInstance = await this.getDB();
      let queue = await dbInstance.getAll(SYNC_STORES.USER_SUBMISSIONS);

      while (queue.length > 0) {
        // Chunk user submissions into batches of up to 50
        const chunk = queue.slice(0, 50);
        const batch = writeBatch(db);
        const chunkIds: string[] = [];

        for (const item of chunk) {
          chunkIds.push(item.id);
          const animeRef = doc(db, 'anime_list', item.id);
          const actRef = doc(db, 'activities', `act-${item.id}`);

          const docData = cleanFirestoreData({
            ...item,
            status: 'pending',
            submissionStatus: 'pending',
            createdAt: item.createdAt || new Date().toISOString(),
            serverCreatedAt: serverTimestamp(),
          });

          batch.set(animeRef, docData, { merge: true });
          batch.set(actRef, {
            user: item.submittedBy?.userName || 'Community User',
            action: 'submitted',
            animeTitle: item.title,
            timestamp: serverTimestamp(),
            language: item.dubs?.[0] || 'Tamil',
            status: 'pending',
          });
        }

        try {
          await batch.commit();

          const tx = dbInstance.transaction(SYNC_STORES.USER_SUBMISSIONS, 'readwrite');
          for (const id of chunkIds) {
            await tx.store.delete(id);
          }
          await tx.done;

          synced += chunk.length;
          queue = queue.slice(chunk.length);
          this.lastSyncedAt = Date.now();
        } catch (err: any) {
          if (isFirestoreQuotaError(err)) {
            await this.setBackoff('user', err);
            break; // Stop loop, keep items safely in IndexedDB
          } else {
            // Drop corrupt items so they don't block queue
            const tx = dbInstance.transaction(SYNC_STORES.USER_SUBMISSIONS, 'readwrite');
            for (const id of chunkIds) {
              await tx.store.delete(id);
            }
            await tx.done;
            queue = queue.slice(chunk.length);
          }
        }
      }

      const remaining = await this.getUserPendingCount();
      if (remaining === 0) {
        await this.resetBackoff('user');
      }
      return { synced, remaining };
    } finally {
      this.isSyncingUser = false;
      this.notifyListeners();
    }
  }

  // --- 5. Background Sync API (Service Worker) ---
  public async requestServiceWorkerSync(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register(SYNC_TAG);
        console.log(`[SyncManager] Background Sync registered tag: ${SYNC_TAG}`);
      }
    } catch (err) {
      console.info('[SyncManager] Background Sync registration notice:', err);
    }
  }

  public async syncAllQueues(): Promise<void> {
    await this.syncUserSubmissions();
    const adminCount = await this.getAdminPendingCount();
    if (adminCount > 0) {
      await this.processAdminBatchUpload();
    }
  }

  // --- 6. UI Status & Subscription Helpers ---
  public async getStatus(): Promise<SyncStatus> {
    const adminQueueCount = await this.getAdminPendingCount();
    const userQueueCount = await this.getUserPendingCount();
    const adminBackoff = await this.getBackoff('admin');
    const userBackoff = await this.getBackoff('user');

    const nextRetryTime = Math.max(adminBackoff.nextRetryTime, userBackoff.nextRetryTime);
    const now = Date.now();
    const nextRetryInSeconds = nextRetryTime > now ? Math.ceil((nextRetryTime - now) / 1000) : null;

    return {
      adminQueueCount,
      userQueueCount,
      isSyncing: this.isSyncingAdmin || this.isSyncingUser,
      quotaHit: adminBackoff.isQuotaHit || userBackoff.isQuotaHit,
      nextRetryInSeconds,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  public subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    this.getStatus().then(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private async notifyListeners() {
    if (this.listeners.length === 0) return;
    try {
      const status = await this.getStatus();
      this.listeners.forEach((l) => l(status));
    } catch {}
  }
}

export const syncManager = new SyncManager();
export default syncManager;
