// Next.js Pages Router API Route: src/pages/api/submissions.ts
// Completely self-contained to avoid Vercel module resolution errors

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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

const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'submissions.json');
const TMP_FILE = path.join('/tmp', 'anidub_submissions_v1.json');
let memoryCache: ServerAnimeSubmission[] = [];

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
      const all = loadFromLocalDisk();
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

      const all = loadFromLocalDisk();
      const existingIdx = all.findIndex((s) => s.id === payload.id);
      const record: ServerAnimeSubmission = {
        ...payload,
        submissionStatus: payload.submissionStatus || 'pending',
        submittedAt: payload.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        all[existingIdx] = { ...all[existingIdx], ...record };
      } else {
        all.unshift(record);
      }

      saveToLocalDisk(all);
      return res.status(201).json({ success: true, data: record });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, action, reviewer, reason } = body || {};

      if (!id || (action !== 'approve' && action !== 'reject')) {
        return res.status(400).json({ success: false, error: 'id and valid action required' });
      }

      const all = loadFromLocalDisk();
      const index = all.findIndex((s) => s.id === id);
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      let target: ServerAnimeSubmission;
      if (index === -1) {
        target = {
          id,
          title: 'Anime Submission #' + id.slice(-6),
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
          synopsis: 'Dubbed regional anime release.',
          dubs: ['Tamil', 'Telugu', 'Hindi'],
          platforms: [{ name: 'Crunchyroll', url: '' }],
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          rejectionReason: action === 'reject' ? reason : undefined,
        };
        all.unshift(target);
      } else {
        all[index] = {
          ...all[index],
          submissionStatus: newStatus,
          status: 'Ongoing',
          reviewedBy: reviewer || 'Admin',
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          rejectionReason: action === 'reject' ? reason : undefined,
        };
        target = all[index];
      }

      saveToLocalDisk(all);
      return res.status(200).json({ success: true, data: target });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Submissions API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}
