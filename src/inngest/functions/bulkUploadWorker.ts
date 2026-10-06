// ==============================================================================
// AniDub India — Serverless Task Queue Worker: Bulk Upload & Sync Pipeline
// Batched Writes (writeBatch), Smart Rate Limiting, Exponential Backoff, DLQ
// ==============================================================================

import { inngest } from '../../lib/inngest';
import { 
  getServerFirestore, 
  updateUploadProgress, 
  recordDLQItems, 
  isResourceExhausted, 
  sleep, 
  DLQItem 
} from '../../lib/firebaseAdmin';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';

export const BATCH_SIZE = 50; // 50 items * 3 docs = 150 ops per batch (well under 500 limit)
export const THROTTLE_DELAY_MS = 350; // Smart Rate Limiting between batches
export const MAX_RETRY_ATTEMPTS = 4; // Max attempts per batch on quota error
export const BASE_BACKOFF_MS = 2000; // 2 seconds initial backoff

export interface ProcessQueueParams {
  jobId: string;
  items: any[];
  adminUser?: string;
}

export interface WorkerResult {
  jobId: string;
  totalItems: number;
  successCount: number;
  failedCount: number;
  dlqCount: number;
  status: 'completed' | 'failed';
  error?: string;
}

/**
 * Normalizes raw JSON anime item for Firestore storage
 */
function normalizeAnimeForBatch(item: any, id: string): any {
  const rawTitle = (item.title || item.name || '').trim();
  const rawRomaji = (item.romajiTitle || item.japaneseTitle || '').trim();
  const dubs = Array.isArray(item.dubs) ? item.dubs : (item.dubbedIn || item.languages || ['Tamil']);
  const genres = Array.isArray(item.genres) ? item.genres : (item.genre ? [item.genre] : ['Action']);
  const platforms = Array.isArray(item.platforms) ? item.platforms : (item.streamingPartners || []);

  const jsonStatus = String(item.status || item.airingStatus || '').toLowerCase();
  const airingStatus = (jsonStatus.includes('ongoing') || jsonStatus.includes('airing')) ? 'Ongoing' : 'Completed';

  return {
    ...item,
    id,
    title: rawTitle,
    romajiTitle: rawRomaji,
    poster: item.poster || item.image || '',
    banner: item.banner || item.coverImage || '',
    synopsis: item.synopsis || item.description || '',
    type: item.type || 'TV Series',
    airingStatus,
    status: 'pending',
    submissionStatus: 'pending',
    dubs,
    genres,
    platforms,
    isDeleted: false,
    updatedAt: new Date().toISOString(),
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

/**
 * Core Worker Processor: Executes chunked batch writes with Rate Limiting, Exponential Backoff & DLQ
 */
export async function executeBulkUploadWorker(params: ProcessQueueParams): Promise<WorkerResult> {
  const { jobId, items, adminUser = 'Admin (Queue Worker)' } = params;
  
  try {
    const db = getServerFirestore();
    const totalItems = items.length;
    const totalBatches = Math.ceil(totalItems / BATCH_SIZE);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    const allDlqItems: DLQItem[] = [];

    console.info(`[Worker] Step 0: Job ${jobId} initialized with ${totalItems} items.`);

    // Initialize progress doc in Firestore
    await updateUploadProgress({
      jobId,
      status: 'processing',
      totalItems,
      processedItems: 0,
      successCount: 0,
      failedCount: 0,
      dlqCount: 0,
      currentBatch: 0,
      totalBatches,
      percentage: 0,
      startedAt: new Date().toISOString(),
      error: null,
    });

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      console.log(`[Worker] Step 1: Starting Batch ${batchIndex + 1}/${totalBatches}`);
      const startIdx = batchIndex * BATCH_SIZE;
      const chunk = items.slice(startIdx, startIdx + BATCH_SIZE);
      const chunkIds: string[] = [];

      let attempt = 0;
      let batchCommitted = false;
      let lastError: any = null;

      // Retry loop with Exponential Backoff
      while (attempt < MAX_RETRY_ATTEMPTS && !batchCommitted) {
        attempt++;
        console.log(`[Worker] Step 2: Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} for Batch ${batchIndex + 1}`);
        try {
          const batch = writeBatch(db);

          for (const rawItem of chunk) {
            const rawTitle = (rawItem.title || rawItem.name || '').trim();
            if (!rawTitle) {
              console.warn('[Worker] Skipping item with no title');
              continue;
            }

            const docId = rawItem.id || `bulk-${jobId}-${Math.random().toString(36).substring(2, 9)}`;
            chunkIds.push(docId);

            const normalized = normalizeAnimeForBatch(rawItem, docId);

            const subRef = doc(db, 'submissions', docId);
            const animeRef = doc(db, 'animes', docId);
            const actRef = doc(db, 'activities', `act-bulk-${docId}-${Date.now()}`);

            batch.set(subRef, normalized, { merge: true });
            batch.set(animeRef, normalized, { merge: true });
            batch.set(actRef, {
              user: adminUser,
              action: 'submitted',
              animeTitle: normalized.title,
              timestamp: serverTimestamp(),
              language: normalized.dubs?.[0] || 'Tamil',
              status: 'pending',
            });
          }

          console.log(`[Worker] Step 3: Committing Batch ${batchIndex + 1} (${chunk.length} items)...`);
          // Commit Firestore batched write
          await batch.commit();
          console.log(`[Worker] Step 4: Batch ${batchIndex + 1} COMMITTED SUCCESS.`);
          batchCommitted = true;
          successCount += chunk.length;
        } catch (err: any) {
          lastError = err;
          const isQuota = isResourceExhausted(err);
          console.warn(`[Worker] Step 5: Batch ${batchIndex + 1} FAILED. QuotaError: ${isQuota}. Error:`, err?.message || err);

          if (isQuota && attempt < MAX_RETRY_ATTEMPTS) {
            // Exponential backoff with jitter
            const backoffDelay = (BASE_BACKOFF_MS * Math.pow(2, attempt - 1)) + Math.round(Math.random() * 500);
            console.info(`[Worker] Firestore quota hit. Backing off for ${backoffDelay}ms before retry...`);

            // Notify frontend that we are currently rate-limited and backing off
            await updateUploadProgress({
              jobId,
              error: `Rate limit hit. Automatically retrying batch in ${Math.round(backoffDelay / 1000)}s (Attempt ${attempt}/${MAX_RETRY_ATTEMPTS})...`,
            });

            await sleep(backoffDelay);
          } else {
            // FATAL ERROR OR RETRIES EXHAUSTED: Stop the entire job
            console.error(`[Worker] Step 6: FATAL error or retries exhausted for Batch ${batchIndex + 1}. BREAKING LOOP.`);
            
            await updateUploadProgress({
              jobId,
              status: 'failed',
              error: `Processing stopped due to fatal error: ${err?.message || 'Unknown error'}. Remaining ${items.length - processedCount} items were not processed.`,
              completedAt: new Date().toISOString(),
            });
            
            return {
              jobId,
              totalItems,
              successCount,
              failedCount: failedCount + chunk.length,
              dlqCount: allDlqItems.length,
              status: 'failed',
              error: err?.message,
            };
          }
        }
      }

      if (!batchCommitted) {
        // Permanently failed batch -> Send items to Dead Letter Queue (DLQ)
        failedCount += chunk.length;
        const batchDlq: DLQItem[] = chunk.map((item, idx) => ({
          id: chunkIds[idx] || `dlq-item-${Date.now()}-${idx}`,
          jobId,
          failedAt: new Date().toISOString(),
          reason: lastError?.message || 'Permanent batch write failure',
          errorStack: lastError?.stack || undefined,
          payload: item,
          retryAttempts: attempt,
        }));

        allDlqItems.push(...batchDlq);
        await recordDLQItems(batchDlq);
      }

      processedCount += chunk.length;

      // Update real-time progress after each batch completes
      const lastItemTitle = chunk[chunk.length - 1]?.title || chunk[chunk.length - 1]?.name || '';
      await updateUploadProgress({
        jobId,
        status: 'processing',
        processedItems: processedCount,
        successCount,
        failedCount,
        dlqCount: allDlqItems.length,
        currentBatch: batchIndex + 1,
        totalBatches,
        percentage: Math.min(100, Math.round((processedCount / totalItems) * 100)),
        lastProcessedTitle: lastItemTitle,
        error: null,
      });

      // Smart Rate Limiting throttle delay between batches
      if (batchIndex < totalBatches - 1) {
        await sleep(THROTTLE_DELAY_MS);
      }
    }

    // Final job status update
    const finalStatus = failedCount === totalItems ? 'failed' : 'completed';
    await updateUploadProgress({
      jobId,
      status: finalStatus,
      processedItems: totalItems,
      successCount,
      failedCount,
      dlqCount: allDlqItems.length,
      percentage: 100,
      completedAt: new Date().toISOString(),
      error: failedCount > 0 ? `${failedCount} items sent to Dead Letter Queue (DLQ)` : null,
    });

    console.info(`[Worker] Job ${jobId} finished: ${successCount} succeeded, ${failedCount} sent to DLQ.`);

    return {
      jobId,
      totalItems,
      successCount,
      failedCount,
      dlqCount: allDlqItems.length,
      status: finalStatus,
    };
  } catch (fatalErr: any) {
    console.error(`[Worker] UNHANDLED FATAL CRASH for Job ${jobId}:`, fatalErr);
    try {
      await updateUploadProgress({
        jobId,
        status: 'failed',
        error: `Worker crashed: ${fatalErr?.message || 'Unknown internal error'}`,
        completedAt: new Date().toISOString()
      });
    } catch {}
    return {
      jobId,
      totalItems: items.length,
      successCount: 0,
      failedCount: items.length,
      dlqCount: 0,
      status: 'failed',
      error: fatalErr?.message
    };
  }
}

/**
 * Inngest Serverless Function Registration
 */
export const processBulkUploadQueue = inngest.createFunction(
  {
    id: 'process-bulk-upload-queue',
    name: 'Process Admin Bulk Upload Queue',
    concurrency: {
      limit: 1, // Strict concurrency control to protect Firestore write throughput
    },
    retries: 3,
    triggers: [{ event: 'admin/bulk.upload.requested' }],
  },
  async ({ event, step }: any) => {
    const { jobId, items, adminUser } = event.data;

    const result = await step.run('execute-batch-import-with-dlq', async () => {
      return await executeBulkUploadWorker({ jobId, items, adminUser });
    });

    return { success: true, result };
  }
);
