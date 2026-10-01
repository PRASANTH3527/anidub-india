// Next.js Pages Router API Route: src/pages/api/submissions.ts
// Handles anime dub submissions with persistent database & zero caching

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import {
  getPersistentSubmissions,
  saveSingleSubmission,
  updatePersistentSubmissionStatus,
  ServerAnimeSubmission,
} from '../../../lib/submissionsDb';

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
      const all = await getPersistentSubmissions();
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

      await saveSingleSubmission(record);
      return res.status(201).json({ success: true, data: record });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, action, reviewer, reason } = body || {};

      if (!id || (action !== 'approve' && action !== 'reject')) {
        return res.status(400).json({ success: false, error: 'id and valid action required' });
      }

      const updated = await updatePersistentSubmissionStatus(
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
