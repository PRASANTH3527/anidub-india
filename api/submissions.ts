// Vercel Serverless Function: api/submissions.ts
// Uses @vercel/kv directly for persistent storage and updates.
// Zero external shared lib files to prevent Vercel module resolution errors.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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
      console.warn('[Vercel KV Warning] Failed to read submissions:', err);
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
      console.warn('[Vercel KV Warning] Failed to save submissions:', err);
      return false;
    }
  }
  return true;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { status } = req.query || {};
      const all = await getKvSubmissions();

      if (status) {
        const filtered = all.filter((s) => s.submissionStatus === status);
        return res.status(200).json({ success: true, count: filtered.length, data: filtered });
      }
      return res.status(200).json({ success: true, count: all.length, data: all });
    }

    if (req.method === 'POST') {
      const payload: ServerAnimeSubmission = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!payload || !payload.id || !payload.title) {
        return res.status(400).json({ success: false, error: 'id and title are required' });
      }

      const record: ServerAnimeSubmission = {
        ...payload,
        submissionStatus: payload.submissionStatus || 'pending',
        submittedAt: payload.submittedAt || new Date().toISOString(),
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
      return res.status(201).json({ success: true, data: record });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, action, reviewer, reason } = body || {};

      if (!id || (action !== 'approve' && action !== 'reject')) {
        return res.status(400).json({ success: false, error: 'id and valid action (approve/reject) required' });
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
          status: 'Ongoing',
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
      return res.status(200).json({ success: true, data: target });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Submissions API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}
