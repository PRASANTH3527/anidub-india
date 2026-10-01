// Next.js App Router API Route: app/api/submissions/route.ts
// Direct JSONBin.io persistence using standard fetch().
// Zero npm packages and zero shared local files.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Master-Key': JSONBIN_API_KEY || '',
  'X-Bin-Versioning': 'false',
};

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Master-Key',
};

export interface ServerAnimeSubmission {
  id: string;
  title: string;
  romajiTitle?: string;
  poster: string;
  imageUrl?: string;
  banner?: string;
  type: 'Series' | 'Movie' | 'Special' | 'OVA';
  releaseYear: number;
  originalReleaseDate?: string;
  rating: number;
  episodes?: number;
  status: 'Ongoing' | 'Completed' | 'Airing' | 'Upcoming' | 'Rejected';
  airingStatus?: 'Ongoing' | 'Completed';
  releaseDay?: string;
  airingDay?: string;
  submissionStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  genres: string[];
  themes?: string[];
  studio: string;
  synopsis: string;
  characters?: any[];
  dubs: string[];
  dubDetails?: any[];
  platforms: { name: string; url: string }[];
  submittedBy?: {
    userId: string;
    userName: string;
    userEmail?: string;
  };
  submittedAt: string;
  updatedAt?: string;
}

// Helper to read from JSONBin
async function readBin(): Promise<ServerAnimeSubmission[]> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    console.error('JSONBin credentials missing');
    return [];
  }
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      method: 'GET',
      headers: HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`JSONBin GET failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.record) ? data.record : [];
  } catch (err) {
    console.error('JSONBin read error:', err);
    return [];
  }
}

// Helper to update JSONBin
async function updateBin(data: ServerAnimeSubmission[]): Promise<boolean> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return false;
  try {
    const res = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: HEADERS,
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
      const filtered = all.filter((s) => s.submissionStatus === status);
      return new Response(JSON.stringify({ success: true, count: filtered.length, data: filtered }), {
        status: 200,
        headers: NO_CACHE_HEADERS,
      });
    }

    return new Response(JSON.stringify({ success: true, count: all.length, data: all }), {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.id || !body.title) {
      return new Response(JSON.stringify({ success: false, error: 'Missing ID or title' }), {
        status: 400,
        headers: NO_CACHE_HEADERS,
      });
    }

    const record: ServerAnimeSubmission = {
      ...body,
      submissionStatus: body.submissionStatus || 'pending',
      submittedAt: body.submittedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const current = await readBin();
    const index = current.findIndex((s) => s.id === record.id);
    if (index !== -1) {
      current[index] = { ...current[index], ...record };
    } else {
      current.unshift(record);
    }

    await updateBin(current);
    return new Response(JSON.stringify({ success: true, data: record }), {
      status: 201,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, reviewer, reason } = body || {};

    if (!id || (action !== 'approve' && action !== 'reject')) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid action or missing ID' }), {
        status: 400,
        headers: NO_CACHE_HEADERS,
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const current = await readBin();
    const index = current.findIndex((s) => s.id === id);

    if (index === -1) {
      return new Response(JSON.stringify({ success: false, error: 'Submission not found' }), {
        status: 404,
        headers: NO_CACHE_HEADERS,
      });
    }

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
    return new Response(JSON.stringify({ success: true, data: current[index] }), {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}
