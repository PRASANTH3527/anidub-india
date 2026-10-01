// Next.js App Router API Route: app/api/submissions/route.ts
// Direct JSONBin.io persistence using standard fetch().
// Returns raw array to match frontend expectations.

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
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return [];
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Versioning': 'false',
      },
      cache: 'no-store',
    });
    const json = await res.json();
    // JSONBin v3 wraps data in a "record" property
    return Array.isArray(json.record) ? json.record : [];
  } catch (err) {
    console.error('JSONBin read error:', err);
    return [];
  }
}

async function updateBin(data: any[]): Promise<boolean> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return false;
  try {
    const res = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
      },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (err) {
    console.error('JSONBin update error:', err);
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

    await updateBin(current);
    return new Response(JSON.stringify(updatedRecord), {
      status: 201,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
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

    await updateBin(current);
    return new Response(JSON.stringify(current[index]), {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}
