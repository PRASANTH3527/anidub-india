// Next.js App Router API Route: app/api/submissions/route.ts
// Direct JSONBin.io persistence using standard fetch().
// Structure: { submissions: [...] }

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Master-Key',
};

async function readBin(): Promise<any[]> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    console.error('[JSONBin] Credentials missing');
    return [];
  }
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Versioning': 'false',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`[JSONBin] GET failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const json = await res.json();
    // Support both { record: { submissions: [] } } and { record: [] }
    const record = json.record || {};
    if (Array.isArray(record)) return record;
    if (record.submissions && Array.isArray(record.submissions)) return record.submissions;
    return [];
  } catch (err) {
    console.error('[JSONBin] Read error:', err);
    return [];
  }
}

async function updateBin(data: any[]): Promise<boolean> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    console.error('[JSONBin] Credentials missing for update');
    return false;
  }
  try {
    const res = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
      },
      body: JSON.stringify({ submissions: data }),
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[JSONBin] PUT failed: ${res.status} ${res.statusText}`, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[JSONBin] Update error:', err);
    return false;
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: NO_CACHE_HEADERS });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const all = await readBin();

    if (status) {
      const filtered = all.filter((s: any) => s.submissionStatus === status);
      return new Response(JSON.stringify(filtered), {
        status: 200,
        headers: NO_CACHE_HEADERS,
      });
    }

    return new Response(JSON.stringify(all), {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}

export async function POST(req: Request) {
  try {
    const record = await req.json();
    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: 'Missing ID' }), {
        status: 400,
        headers: NO_CACHE_HEADERS,
      });
    }

    const current = await readBin();
    const index = current.findIndex((s: any) => s.id === record.id);
    const updatedRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
      submissionStatus: record.submissionStatus || 'pending',
    };

    if (index !== -1) {
      current[index] = { ...current[index], ...updatedRecord };
    } else {
      current.unshift(updatedRecord);
    }

    const success = await updateBin(current);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Failed to save to database' }), {
        status: 503,
        headers: NO_CACHE_HEADERS,
      });
    }

    return new Response(JSON.stringify(updatedRecord), {
      status: 201,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    console.error('[POST] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, reviewer, reason } = body || {};

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing ID' }), {
        status: 400,
        headers: NO_CACHE_HEADERS,
      });
    }

    const current = await readBin();
    const index = current.findIndex((s: any) => s.id === id);

    if (index === -1) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: NO_CACHE_HEADERS,
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    current[index] = {
      ...current[index],
      submissionStatus: newStatus,
      status: newStatus === 'approved' ? 'Ongoing' : 'Rejected',
      reviewedBy: reviewer || 'Admin',
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rejectionReason: newStatus === 'rejected' ? reason : undefined,
    };

    const success = await updateBin(current);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Failed to save update' }), {
        status: 503,
        headers: NO_CACHE_HEADERS,
      });
    }

    return new Response(JSON.stringify(current[index]), {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    console.error('[PATCH] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}
