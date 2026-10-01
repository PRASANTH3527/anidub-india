// Vercel Serverless Function: api/submissions.ts
// Direct JSONBin.io persistence using native fetch().
// Returns raw array to match frontend expectations.

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

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
        return res.status(200).json(filtered);
      }
      return res.status(200).json(all);
    }

    if (req.method === 'POST') {
      const record = req.body;
      if (!record || !record.id) {
        return res.status(400).json({ error: 'Missing ID' });
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
      return res.status(201).json(updatedRecord);
    }

    if (req.method === 'PATCH') {
      const { id, action, reviewer, reason } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: 'Missing ID' });
      }

      const current = await readBin();
      const index = current.findIndex((s: any) => s.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Not found' });
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
      return res.status(200).json(current[index]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Submissions API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
