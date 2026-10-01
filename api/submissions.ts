// Vercel Serverless Function: api/submissions.ts
// Direct JSONBin.io persistence using native fetch().
// Format: export default async function handler(req, res)

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const BIN_HEADERS = {
  'Content-Type': 'application/json',
  'X-Master-Key': JSONBIN_API_KEY || '',
  'X-Bin-Versioning': 'false',
};

// Helper to read from JSONBin
async function readBin(): Promise<any[]> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return [];
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      method: 'GET',
      headers: BIN_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.record) ? data.record : [];
  } catch {
    return [];
  }
}

// Helper to update JSONBin
async function updateBin(data: any[]): Promise<boolean> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return false;
  try {
    const res = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: BIN_HEADERS,
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const status = req.query?.status;
      const all = await readBin();

      if (status) {
        const filtered = all.filter((s: any) => s.submissionStatus === status);
        return res.status(200).json({ success: true, count: filtered.length, data: filtered });
      }
      return res.status(200).json({ success: true, count: all.length, data: all });
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || !body.id || !body.title) {
        return res.status(400).json({ success: false, error: 'Missing ID or title' });
      }

      const record = {
        ...body,
        submissionStatus: body.submissionStatus || 'pending',
        submittedAt: body.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const current = await readBin();
      const index = current.findIndex((s: any) => s.id === record.id);
      if (index !== -1) {
        current[index] = { ...current[index], ...record };
      } else {
        current.unshift(record);
      }

      await updateBin(current);
      return res.status(201).json({ success: true, data: record });
    }

    if (req.method === 'PATCH') {
      const { id, action, reviewer, reason } = req.body || {};
      if (!id || (action !== 'approve' && action !== 'reject')) {
        return res.status(400).json({ success: false, error: 'Invalid action or missing ID' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const current = await readBin();
      const index = current.findIndex((s: any) => s.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Submission not found' });
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
      return res.status(200).json({ success: true, data: current[index] });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Submissions API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
