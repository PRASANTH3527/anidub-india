// Vercel Serverless Function: /api/submissions.ts
// Handles persistent storage and synchronization of anime dub submissions between website and Telegram bot.

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
}

// In-memory cache + file backup in /tmp (works across warm Vercel serverless lambdas)
const TMP_FILE = path.join('/tmp', 'anidub_submissions_v1.json');

let memorySubmissions: ServerAnimeSubmission[] = [];

// Helper to load submissions
export function loadSubmissions(): ServerAnimeSubmission[] {
  if (memorySubmissions.length > 0) {
    return memorySubmissions;
  }
  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf-8');
      memorySubmissions = JSON.parse(content);
      return memorySubmissions;
    }
  } catch (err) {
    console.error('Failed reading tmp submissions file:', err);
  }
  return memorySubmissions;
}

// Helper to save submissions
export function saveSubmissions(list: ServerAnimeSubmission[]): void {
  memorySubmissions = list;
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing tmp submissions file:', err);
  }
}

// Approve or reject a submission by ID
export function updateSubmissionStatus(
  id: string,
  newStatus: 'approved' | 'rejected',
  reviewer: string = 'Telegram Admin Bot',
  rejectionReason?: string
): ServerAnimeSubmission | null {
  const current = loadSubmissions();
  const index = current.findIndex((s) => s.id === id);

  if (index === -1) {
    // If not found in server storage, create a stub record so it can be approved
    const stubRecord: ServerAnimeSubmission = {
      id,
      title: 'Anime Submission #' + id.slice(-6),
      poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      type: 'Series',
      releaseYear: new Date().getFullYear(),
      rating: 8.0,
      status: 'Ongoing',
      submissionStatus: newStatus,
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      genres: ['Action', 'Shonen'],
      studio: 'Animation Studio',
      synopsis: 'Dubbed regional anime release.',
      dubs: ['Tamil', 'Telugu', 'Hindi'],
      platforms: [{ name: 'Crunchyroll', url: '' }],
      submittedAt: new Date().toISOString(),
      rejectionReason: newStatus === 'rejected' ? rejectionReason : undefined,
    };
    current.push(stubRecord);
    saveSubmissions(current);
    return stubRecord;
  }

  current[index] = {
    ...current[index],
    submissionStatus: newStatus,
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    rejectionReason: newStatus === 'rejected' ? rejectionReason : undefined,
  };

  saveSubmissions(current);
  return current[index];
}

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { status } = req.query || {};
      const all = loadSubmissions();
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

      const all = loadSubmissions();
      const existingIdx = all.findIndex((s) => s.id === payload.id);
      
      const record: ServerAnimeSubmission = {
        ...payload,
        submissionStatus: payload.submissionStatus || 'pending',
        submittedAt: payload.submittedAt || new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        all[existingIdx] = { ...all[existingIdx], ...record };
      } else {
        all.unshift(record);
      }

      saveSubmissions(all);
      return res.status(201).json({ success: true, data: record });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, action, reviewer, reason } = body || {};

      if (!id || (action !== 'approve' && action !== 'reject')) {
        return res.status(400).json({ success: false, error: 'id and valid action (approve/reject) required' });
      }

      const updated = updateSubmissionStatus(
        id,
        action === 'approve' ? 'approved' : 'rejected',
        reviewer || 'Admin',
        reason
      );

      return res.status(200).json({ success: true, data: updated });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Submissions API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}
