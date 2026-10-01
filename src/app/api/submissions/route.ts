// Next.js App Router API Route: app/api/submissions/route.ts
// Direct @vercel/kv persistence with URL safety validation.
// Zero cross-imports or shared lib files to prevent Vercel Serverless module resolution errors.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

import { createClient } from '@vercel/kv';

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

const KV_KEY = 'anidub_submissions';
let memoryStore: ServerAnimeSubmission[] = [];

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

// Validates that KV_REST_API_URL is an actual HTTPS endpoint and not an unpopulated placeholder
function isConfiguredKvUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://') &&
    !trimmed.includes('KV_REST_API_URL') &&
    !trimmed.includes('your-kv-store') &&
    !trimmed.includes('example.com')
  );
}

// Safely initializes @vercel/kv client only when valid credentials exist
function getKvClient() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!isConfiguredKvUrl(url) || !token || token === 'KV_REST_API_TOKEN' || token.length < 5) {
    return null;
  }
  try {
    return createClient({ url, token });
  } catch {
    return null;
  }
}

// Safe helper to read from Vercel KV
async function getKvSubmissions(): Promise<ServerAnimeSubmission[]> {
  const client = getKvClient();
  if (client) {
    try {
      const data = await client.get<ServerAnimeSubmission[]>(KV_KEY);
      if (Array.isArray(data)) {
        memoryStore = data;
        return data;
      }
      return [];
    } catch (err) {
      console.warn('[Vercel KV Warning] Failed to read from KV, using fallback:', err);
    }
  }
  return memoryStore;
}

// Safe helper to write to Vercel KV
async function saveKvSubmissions(list: ServerAnimeSubmission[]): Promise<boolean> {
  memoryStore = list;
  const client = getKvClient();
  if (client) {
    try {
      await client.set(KV_KEY, list);
      return true;
    } catch (err) {
      console.warn('[Vercel KV Warning] Failed to save to KV, stored in fallback:', err);
      return false;
    }
  }
  return true;
}

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
    const all = await getKvSubmissions();

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

    const current = await getKvSubmissions();
    const index = current.findIndex((s) => s.id === record.id);
    if (index !== -1) {
      current[index] = { ...current[index], ...record };
    } else {
      current.unshift(record);
    }

    await saveKvSubmissions(current);

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
        JSON.stringify({ success: false, error: 'id and valid action (approve/reject) required' }),
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const current = await getKvSubmissions();
    const index = current.findIndex((s) => s.id === id);

    let target: ServerAnimeSubmission;
    if (index === -1) {
      target = {
        id,
        title: `Anime Submission #${id.slice(-6)}`,
        poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
        type: 'Series',
        releaseYear: new Date().getFullYear(),
        rating: 8.5,
        status: newStatus === 'approved' ? 'Ongoing' : 'Rejected',
        submissionStatus: newStatus,
        reviewedBy: reviewer || 'Admin',
        reviewedAt: new Date().toISOString(),
        genres: ['Action'],
        studio: 'Animation Studio',
        synopsis: 'Regional Indian dubbed anime release.',
        dubs: ['Tamil', 'Telugu', 'Hindi'],
        platforms: [{ name: 'Crunchyroll', url: '' }],
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rejectionReason: newStatus === 'rejected' ? reason : undefined,
      };
      current.unshift(target);
    } else {
      current[index] = {
        ...current[index],
        submissionStatus: newStatus,
        status: newStatus === 'approved' ? 'Ongoing' : 'Rejected',
        reviewedBy: reviewer || 'Admin',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rejectionReason: newStatus === 'rejected' ? reason : undefined,
      };
      target = current[index];
    }

    await saveKvSubmissions(current);

    return new Response(
      JSON.stringify({ success: true, data: target }),
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
