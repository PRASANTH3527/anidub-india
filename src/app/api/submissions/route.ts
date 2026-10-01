// Next.js App Router API Route: src/app/api/submissions/route.ts
// Completely self-contained to avoid Vercel module resolution errors

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

import fs from 'fs';
import path from 'path';

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
  status: 'Ongoing' | 'Completed' | 'Airing' | 'Upcoming';
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

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

function isValidHttpUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  if (
    trimmed.includes('your-kv-store') ||
    trimmed.includes('your-project') ||
    trimmed.includes('example.com') ||
    trimmed === 'KV_REST_API_URL' ||
    trimmed === 'SUPABASE_URL'
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidToken(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (trimmed.length < 8) return false;
  if (
    trimmed.startsWith('your_') ||
    trimmed === 'KV_REST_API_TOKEN' ||
    trimmed === 'UPSTASH_REDIS_REST_TOKEN' ||
    trimmed === 'SUPABASE_SERVICE_ROLE_KEY' ||
    trimmed === 'SUPABASE_ANON_KEY'
  ) {
    return false;
  }
  return true;
}

function isValidFirebaseProjectId(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length < 4) return false;
  if (
    trimmed === 'FIREBASE_PROJECT_ID' ||
    trimmed === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' ||
    trimmed.startsWith('your-') ||
    trimmed.includes('example')
  ) {
    return false;
  }
  return /^[a-z0-9-]+$/.test(trimmed);
}

const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'submissions.json');
const TMP_FILE = path.join('/tmp', 'anidub_submissions_v1.json');
let memoryCache: ServerAnimeSubmission[] = [];

async function fetchFromKV(): Promise<ServerAnimeSubmission[] | null> {
  if (!isValidHttpUrl(KV_URL) || !isValidToken(KV_TOKEN)) return null;
  try {
    const res = await fetch(`${KV_URL}/get/anidub_submissions`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.result) {
      const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch {
    return null;
  }
}

async function saveToKV(list: ServerAnimeSubmission[]): Promise<boolean> {
  if (!isValidHttpUrl(KV_URL) || !isValidToken(KV_TOKEN)) return false;
  try {
    const res = await fetch(`${KV_URL}/set/anidub_submissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(list),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchFromFirebase(): Promise<ServerAnimeSubmission[] | null> {
  if (!isValidFirebaseProjectId(FIREBASE_PROJECT_ID)) return null;
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/submissions?pageSize=300`;
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.documents || !Array.isArray(json.documents)) return [];

    return json.documents.map((doc: any) => {
      const fields = doc.fields || {};
      const obj: any = {};
      for (const [k, v] of Object.entries(fields)) {
        const val: any = v;
        if (val.stringValue !== undefined) obj[k] = val.stringValue;
        else if (val.integerValue !== undefined) obj[k] = parseInt(val.integerValue, 10);
        else if (val.doubleValue !== undefined) obj[k] = parseFloat(val.doubleValue);
        else if (val.booleanValue !== undefined) obj[k] = val.booleanValue;
        else if (val.arrayValue !== undefined) {
          obj[k] = (val.arrayValue.values || []).map((x: any) => x.stringValue || x);
        }
      }
      return obj as ServerAnimeSubmission;
    });
  } catch {
    return null;
  }
}

async function saveDocumentToFirebase(item: ServerAnimeSubmission): Promise<boolean> {
  if (!isValidFirebaseProjectId(FIREBASE_PROJECT_ID)) return false;
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/submissions/${item.id}`;
    const fields: any = {};
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'string') fields[k] = { stringValue: v };
      else if (typeof v === 'number') fields[k] = { doubleValue: v };
      else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
      else if (Array.isArray(v)) {
        fields[k] = {
          arrayValue: {
            values: v.map((el) =>
              typeof el === 'string' ? { stringValue: el } : { stringValue: JSON.stringify(el) }
            ),
          },
        };
      }
    }
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function loadFromLocalDisk(): ServerAnimeSubmission[] {
  for (const filePath of [LOCAL_DATA_FILE, TMP_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCache = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return memoryCache;
}

function saveToLocalDisk(list: ServerAnimeSubmission[]): void {
  memoryCache = list;
  for (const filePath of [LOCAL_DATA_FILE, TMP_FILE]) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch {}
  }
}

async function getPersistentSubmissions(): Promise<ServerAnimeSubmission[]> {
  const kvData = await fetchFromKV();
  if (kvData !== null) {
    memoryCache = kvData;
    saveToLocalDisk(kvData);
    return kvData;
  }

  const fbData = await fetchFromFirebase();
  if (fbData !== null && fbData.length > 0) {
    memoryCache = fbData;
    saveToLocalDisk(fbData);
    return fbData;
  }

  return loadFromLocalDisk();
}

async function saveSingleSubmission(item: ServerAnimeSubmission): Promise<void> {
  const current = await getPersistentSubmissions();
  const index = current.findIndex((s) => s.id === item.id);
  if (index !== -1) {
    current[index] = { ...current[index], ...item };
  } else {
    current.unshift(item);
  }
  memoryCache = current;
  saveToLocalDisk(current);

  await Promise.allSettled([
    saveToKV(current),
    saveDocumentToFirebase(item),
  ]);
}

async function updatePersistentSubmissionStatus(
  id: string,
  newStatus: 'approved' | 'rejected',
  reviewer: string = 'Telegram Admin Bot',
  rejectionReason?: string
): Promise<ServerAnimeSubmission | null> {
  const current = await getPersistentSubmissions();
  const index = current.findIndex((s) => s.id === id);

  let targetRecord: ServerAnimeSubmission;

  if (index === -1) {
    targetRecord = {
      id,
      title: 'Anime Submission #' + id.slice(-6),
      poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      type: 'Series',
      releaseYear: new Date().getFullYear(),
      rating: 8.5,
      status: 'Ongoing',
      submissionStatus: newStatus,
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      genres: ['Action', 'Adventure'],
      studio: 'Official Animation Studio',
      synopsis: 'Regional Indian dubbed anime release.',
      dubs: ['Tamil', 'Telugu', 'Hindi'],
      platforms: [{ name: 'Crunchyroll', url: '' }],
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rejectionReason: newStatus === 'rejected' ? rejectionReason : undefined,
    };
    current.unshift(targetRecord);
  } else {
    current[index] = {
      ...current[index],
      submissionStatus: newStatus,
      status: 'Ongoing',
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rejectionReason: newStatus === 'rejected' ? rejectionReason : undefined,
    };
    targetRecord = current[index];
  }

  memoryCache = current;
  saveToLocalDisk(current);
  await Promise.allSettled([
    saveToKV(current),
    saveDocumentToFirebase(targetRecord),
  ]);
  return targetRecord;
}

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
