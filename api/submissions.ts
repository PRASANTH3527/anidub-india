// Vercel Serverless Function: api/submissions.ts
// Direct JSONBin.io persistence with simple one-way Telegram notification.

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';

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
    const record = json.record || {};
    if (Array.isArray(record)) return record;
    if (record.submissions && Array.isArray(record.submissions)) return record.submissions;
    return [];
  } catch {
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
      body: JSON.stringify({ submissions: data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendTelegramAlert(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: text, parse_mode: 'Markdown' }),
    });
  } catch {}
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const status = req.query?.status;
      const all = await readBin();
      if (status) {
        const filtered = all.filter((s: any) => (s.submissionStatus === status || s.status === status));
        return res.status(200).json(filtered);
      }
      return res.status(200).json(all);
    }

    if (req.method === 'POST') {
      const record = req.body;
      if (!record || !record.id) return res.status(400).json({ error: 'Missing ID' });
      const current = await readBin();
      const index = current.findIndex((s: any) => s.id === record.id);
      const updatedRecord = { 
        ...record, 
        updatedAt: new Date().toISOString(),
        submissionStatus: 'pending',
        status: 'pending',
        airingStatus: record.status === 'pending' ? 'Ongoing' : (record.airingStatus || record.status || 'Ongoing')
      };
      if (index !== -1) current[index] = { ...current[index], ...updatedRecord };
      else current.unshift(updatedRecord);
      const success = await updateBin(current);
      if (!success) return res.status(503).json({ error: 'DB update failed' });
      
      // Simple Alert
      await sendTelegramAlert(`🚀 *New Submission!*\n\n🎬 *Title:* ${record.title}\n👤 *By:* ${record.submittedBy?.userName || 'User'}\n\n👉 Approve in /admin dashboard.`);
      
      return res.status(201).json(updatedRecord);
    }

    if (req.method === 'PATCH') {
      const { id, action, reviewer, reason } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing ID' });
      const current = await readBin();
      const index = current.findIndex((s: any) => s.id === id);
      if (index === -1) return res.status(404).json({ error: 'Not found' });
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      current[index] = {
        ...current[index],
        submissionStatus: newStatus,
        status: newStatus,
        reviewedBy: reviewer || 'Admin',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rejectionReason: newStatus === 'rejected' ? reason : undefined,
      };
      const success = await updateBin(current);
      if (!success) return res.status(503).json({ error: 'DB update failed' });
      return res.status(200).json(current[index]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
