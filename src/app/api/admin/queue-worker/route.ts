// ==============================================================================
// Next.js App Router API Route: /api/admin/queue-worker
// Dedicated Serverless Queue Worker Endpoint (Upstash QStash / Cloud Tasks / Webhook)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { executeBulkUploadWorker } from '../../../../inngest/functions/bulkUploadWorker';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { jobId, items, adminUser } = payload;

    if (!jobId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: jobId and non-empty items array.' },
        { status: 400 }
      );
    }

    console.info(`[Queue Worker Webhook] Processing Job ${jobId} (${items.length} items)...`);

    // Execute the worker with Smart Rate Limiting, Batched Writes, Exponential Backoff & DLQ
    const result = await executeBulkUploadWorker({ jobId, items, adminUser });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[Queue Worker Webhook Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Worker execution failed' },
      { status: 500 }
    );
  }
}
