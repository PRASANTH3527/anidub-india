// Next.js App Router API Route: app/api/submissions/route.ts
// Handles anime dub submissions with real persistent database support & zero caching

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

import {
  getPersistentSubmissions,
  saveSingleSubmission,
  updatePersistentSubmissionStatus,
  ServerAnimeSubmission,
} from '@/lib/submissionsDb';

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: NO_CACHE_HEADERS,
  });
}

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const all = await getPersistentSubmissions();

    if (status) {
      const filtered = all.filter((s) => s.submissionStatus === status);
      return new Response(
        JSON.stringify({ success: true, count: filtered.length, data: filtered }),
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: all.length, data: all }),
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/submissions error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Server error' }),
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    if (!body || !body.id || !body.title) {
      return new Response(
        JSON.stringify({ success: false, error: 'id and title are required' }),
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const record: ServerAnimeSubmission = {
      ...body,
      submissionStatus: body.submissionStatus || 'pending',
      submittedAt: body.submittedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveSingleSubmission(record);

    return new Response(
      JSON.stringify({ success: true, data: record }),
      { status: 201, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('POST /api/submissions error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Server error' }),
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { id, action, reviewer, reason } = body || {};

    if (!id || (action !== 'approve' && action !== 'reject')) {
      return new Response(
        JSON.stringify({ success: false, error: 'id and valid action required' }),
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const updated = await updatePersistentSubmissionStatus(
      id,
      action === 'approve' ? 'approved' : 'rejected',
      reviewer || 'Admin',
      reason
    );

    return new Response(
      JSON.stringify({ success: true, data: updated }),
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('PATCH /api/submissions error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Server error' }),
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
