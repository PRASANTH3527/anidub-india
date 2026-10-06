// ==============================================================================
// Next.js App Router API Route: /api/admin/bulk-upload
// Instant 202 Acknowledgment & Asynchronous Queue Ingestion
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '../../../../lib/inngest';
import { updateUploadProgress, getLatestUploadProgress, getServerFirestore, getInMemoryDLQItems } from '../../../../lib/firebaseAdmin';
import { executeBulkUploadWorker } from '../../../../inngest/functions/bulkUploadWorker';
import { collection, getDocs, limit, query, orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : null);

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload. Expected an array of anime objects in "items" or request body.' },
        { status: 400 }
      );
    }

    const adminUser = body.adminUser || req.headers.get('x-admin-user') || 'Admin (Bulk Upload API)';
    const jobId = `job_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const totalItems = items.length;
    const totalBatches = Math.ceil(totalItems / 50);

    console.info(`[API /api/admin/bulk-upload] Received ${totalItems} items. Assigning Job ID: ${jobId}`);

    // 1. Instantly initialize the real-time progress document in Firestore (system/upload_status)
    updateUploadProgress({
      jobId,
      status: 'queued',
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
    }).catch(e => console.warn('[UploadProgress init notice]:', e));

    // 2. Dispatch event to Serverless Message Queue (Inngest / Background Worker)
    inngest.send({
      name: 'admin/bulk.upload.requested',
      data: {
        jobId,
        items,
        adminUser,
      },
    }).catch(() => {
      // Inngest dev server not running locally; direct background worker will process
    });

    // 3. Trigger asynchronous background processing pipeline (non-blocking)
    executeBulkUploadWorker({ jobId, items, adminUser }).catch((workerErr) => {
      console.error(`[API Background Worker Error] Job ${jobId}:`, workerErr);
    });

    // 4. Instantly acknowledge with HTTP 202 Accepted
    return NextResponse.json(
      {
        success: true,
        status: 'queued',
        jobId,
        totalItems,
        totalBatches,
        message: 'Payload queued for asynchronous processing. Track live progress via system/upload_status.',
      },
      {
        status: 202,
        headers: {
          'Location': `/api/admin/bulk-upload?jobId=${jobId}`,
        },
      }
    );
  } catch (error: any) {
    console.error('[API /api/admin/bulk-upload] Error processing request:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error while queueing payload.' },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve the latest upload status and DLQ items
 */
export async function GET(req: NextRequest) {
  try {
    const currentStatus = await getLatestUploadProgress();

    // Check if DLQ list is requested
    const { searchParams } = new URL(req.url);
    const includeDlq = searchParams.get('includeDlq') === 'true';

    let dlqItems: any[] = [...getInMemoryDLQItems()];
    if (includeDlq) {
      try {
        const db = getServerFirestore();
        const dlqQuery = query(collection(db, 'dlq_uploads'), orderBy('timestamp', 'desc'), limit(20));
        const dlqSnap = await getDocs(dlqQuery);
        const firestoreDlq = dlqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const idSet = new Set(dlqItems.map(i => i.id));
        firestoreDlq.forEach(item => {
          if (!idSet.has(item.id)) dlqItems.push(item);
        });
      } catch (e) {
        console.warn('Error fetching DLQ items from Firestore:', e);
      }
    }

    return NextResponse.json({
      success: true,
      status: currentStatus,
      dlqItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error fetching status.' },
      { status: 500 }
    );
  }
}
