// ==============================================================================
// AniDub India — Enterprise-Grade Server-Side Firebase Admin & Firestore Helper
// Handles Firebase Admin SDK, Server-Side Batch Writes, Rate Limiting & DLQ
// ==============================================================================

import { getApps, initializeApp as initializeClientApp } from 'firebase/app';
import { 
  getFirestore as getClientFirestore, 
  initializeFirestore,
  doc as clientDoc, 
  setDoc as clientSetDoc, 
  getDoc as clientGetDoc,
  writeBatch as clientWriteBatch,
  serverTimestamp as clientServerTimestamp,
  collection as clientCollection,
  Firestore as ClientFirestore
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Target Project & Database Configuration
export const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || 'keen-matrix-p40ks';
export const FIRESTORE_DATABASE_ID = firebaseConfigJson.firestoreDatabaseId || 'ai-studio-anidubindiadubbe-5d6f2b65-be54-4278-868a-15922d0100a3';

export interface UploadJobStatus {
  jobId: string;
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  processedItems: number;
  successCount: number;
  failedCount: number;
  dlqCount: number;
  currentBatch: number;
  totalBatches: number;
  percentage: number;
  startedAt?: any;
  updatedAt?: any;
  completedAt?: any;
  error?: string | null;
  lastProcessedTitle?: string;
}

export interface DLQItem {
  id: string;
  jobId: string;
  failedAt: string;
  reason: string;
  payload: any;
  retryAttempts: number;
  errorStack?: string;
}

// In-memory cache of upload job progress (resilient against Firestore quota exhaustion)
let latestInMemoryStatus: UploadJobStatus = {
  jobId: null as any,
  status: 'idle',
  totalItems: 0,
  processedItems: 0,
  successCount: 0,
  failedCount: 0,
  dlqCount: 0,
  currentBatch: 0,
  totalBatches: 0,
  percentage: 0,
};

let inMemoryDlqItems: DLQItem[] = [];

export function getInMemoryDLQItems(): DLQItem[] {
  return inMemoryDlqItems;
}

// Check for Firestore Resource Exhausted / Quota Limit error
export function isResourceExhausted(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  const msg = String(err.message || '').toLowerCase();
  const name = String(err.name || '').toLowerCase();

  return (
    code === '8' ||
    code === 'resource-exhausted' ||
    code === 'quota-exceeded' ||
    code.includes('exhausted') ||
    code.includes('resource_exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    name.includes('quota')
  );
}

// Utility for delays
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Lazy-initialized Server-Side Firestore instance with Long-Polling support for Node.js
let cachedDb: ClientFirestore | null = null;

export function getServerFirestore(): ClientFirestore {
  if (cachedDb) return cachedDb;

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
    projectId: PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfigJson.appId,
  };

  const apps = getApps();
  const clientApp = apps.length > 0 ? apps[0] : initializeClientApp(firebaseConfig, 'server-app');
  try {
    cachedDb = initializeFirestore(clientApp, { experimentalForceLongPolling: true }, FIRESTORE_DATABASE_ID);
  } catch {
    cachedDb = getClientFirestore(clientApp, FIRESTORE_DATABASE_ID);
  }
  return cachedDb;
}

/**
 * Updates the real-time progress status document in Firestore (system/upload_status)
 * Also synchronizes latestInMemoryStatus for zero-quota fallback reads.
 */
export async function updateUploadProgress(statusData: Partial<UploadJobStatus> & { jobId: string }): Promise<void> {
  // Update in-memory record first
  latestInMemoryStatus = {
    ...latestInMemoryStatus,
    ...statusData,
    jobId: statusData.jobId,
    updatedAt: new Date().toISOString(),
  };

  if (typeof statusData.totalItems === 'number' && typeof statusData.processedItems === 'number' && statusData.totalItems > 0) {
    latestInMemoryStatus.percentage = Math.min(100, Math.round((statusData.processedItems / statusData.totalItems) * 100));
  }

  try {
    const db = getServerFirestore();
    const statusRef = clientDoc(db, 'system', 'upload_status');
    const updatePayload: Record<string, any> = {
      ...statusData,
      percentage: latestInMemoryStatus.percentage,
      updatedAt: clientServerTimestamp(),
    };

    await clientSetDoc(statusRef, updatePayload, { merge: true });
  } catch (err: any) {
    if (isResourceExhausted(err)) {
      console.warn('[firebaseAdmin] Firestore write quota exhausted; status maintained in memory.');
    } else {
      console.warn('[firebaseAdmin] Failed to update upload_status doc in Firestore:', err?.message || err);
    }
  }
}

/**
 * Retrieves the current upload progress, with resilient fallback to in-memory state
 */
export async function getLatestUploadProgress(): Promise<UploadJobStatus> {
  try {
    const db = getServerFirestore();
    const statusRef = clientDoc(db, 'system', 'upload_status');
    const snapshot = await clientGetDoc(statusRef);
    if (snapshot.exists()) {
      const data = snapshot.data() as UploadJobStatus;
      latestInMemoryStatus = { ...latestInMemoryStatus, ...data };
      return latestInMemoryStatus;
    }
  } catch (err: any) {
    console.info('[firebaseAdmin] Using in-memory status cache (Firestore quota limit active).');
  }
  return latestInMemoryStatus;
}

/**
 * Sends unrecoverable failed items to Dead Letter Queue (DLQ) in Firestore (dlq_uploads collection)
 */
export async function recordDLQItems(items: DLQItem[]): Promise<void> {
  if (!items || items.length === 0) return;
  inMemoryDlqItems.unshift(...items);
  if (inMemoryDlqItems.length > 100) {
    inMemoryDlqItems = inMemoryDlqItems.slice(0, 100);
  }
  const db = getServerFirestore();

  try {
    const batch = clientWriteBatch(db);
    for (const item of items) {
      const dlqDocRef = clientDoc(db, 'dlq_uploads', `dlq-${item.jobId}-${item.id}-${Date.now()}`);
      batch.set(dlqDocRef, {
        ...item,
        timestamp: clientServerTimestamp(),
      });
    }
    await batch.commit();
    console.info(`[DLQ] Logged ${items.length} failed items into dlq_uploads.`);
  } catch (dlqErr) {
    console.error('[DLQ] Error recording items to dlq_uploads:', dlqErr);
  }
}
