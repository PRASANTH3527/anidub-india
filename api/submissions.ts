// Next.js App Router & Vercel Serverless Function: api/submissions.ts
// Direct JSONBin.io persistence with simple one-way Telegram notification.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Master-Key',
};

/**
 * Reads submissions from JSONBin.io strictly adhering to { record: { submissions: [...] } }.
 * If empty or corrupt, initializes cleanly with an empty array.
 */
export async function readJsonBin(): Promise<any[]> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    console.warn('[JSONBin] Missing JSONBIN_BIN_ID or JSONBIN_API_KEY');
    return [];
  }

  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Versioning': 'false',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[JSONBin] Fetch error status: ${res.status}. Initializing with empty array.`);
      await writeJsonBin([]);
      return [];
    }

    const data = await res.json();
    const record = data?.record;

    if (record && Array.isArray(record.submissions)) {
      return record.submissions;
    }

    if (Array.isArray(record)) {
      // Legacy array format; normalize to { submissions: [...] }
      await writeJsonBin(record);
      return record;
    }

    // Corrupt or uninitialized; reset cleanly with empty array
    await writeJsonBin([]);
    return [];
  } catch (err) {
    console.error('[JSONBin Read Error]', err);
    return [];
  }
}

/**
 * Saves submissions to JSONBin.io via PUT request with structure { submissions: [...] }.
 */
export async function writeJsonBin(data: any[]): Promise<boolean> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return false;

  try {
    const res = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
      },
      body: JSON.stringify({ submissions: Array.isArray(data) ? data : [] }),
    });

    return res.ok;
  } catch (err) {
    console.error('[JSONBin Write Error]', err);
    return false;
  }
}

/**
 * Sends a simple one-way text notification to Telegram.
 */
export async function sendTelegramAlert(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) return;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.warn('[Telegram Alert Error]', err);
  }
}

// ============================================================================
// Express / Vite Server Middleware Handler
// ============================================================================
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. GET: Fetch submissions (with optional ?status=approved / pending)
    if (req.method === 'GET') {
      const status = req.query?.status;
      const all = await readJsonBin();

      if (status) {
        const filtered = all.filter(
          (s: any) => s.status === status || s.submissionStatus === status
        );
        return res.status(200).json(filtered);
      }

      return res.status(200).json(all);
    }

    // 2. POST: Submit a new anime with status: 'pending' + Telegram alert
    if (req.method === 'POST') {
      const record = req.body;
      if (!record || !record.id) {
        return res.status(400).json({ error: 'Missing submission ID or data' });
      }

      const current = await readJsonBin();
      const existingIdx = current.findIndex((s: any) => s.id === record.id);

      const pendingRecord = {
        ...record,
        status: 'pending',
        submissionStatus: 'pending',
        submittedAt: record.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        current[existingIdx] = { ...current[existingIdx], ...pendingRecord };
      } else {
        current.unshift(pendingRecord);
      }

      const success = await writeJsonBin(current);
      if (!success) {
        return res.status(503).json({ error: 'Failed to save submission to JSONBin' });
      }

      // Trigger Telegram notification immediately
      const dubList = Array.isArray(record.dubs) ? record.dubs.join(', ') : 'Regional Dub';
      const submitter = record.submittedBy?.userName || 'Community User';
      const telegramText = `🚀 *New Anime Dub Submission!*\n\n🎬 *Title:* ${record.title}\n🎙️ *Dubs:* ${dubList}\n👤 *Submitted By:* ${submitter}\n\n👉 *Review and Approve on AniDub India stealth admin panel.*`;
      
      sendTelegramAlert(telegramText).catch(() => {});

      return res.status(201).json(pendingRecord);
    }

    // 3. PUT / PATCH: Admin moderation (Approve, Reject, Delete)
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = req.body || {};
      const { id, action, reviewer, reason, fullList } = body;

      // Direct full replacement if provided
      if (Array.isArray(fullList)) {
        const saved = await writeJsonBin(fullList);
        if (!saved) return res.status(503).json({ error: 'Failed to update JSONBin' });
        return res.status(200).json({ success: true, count: fullList.length });
      }

      if (!id) {
        return res.status(400).json({ error: 'Missing item ID' });
      }

      const current = await readJsonBin();
      const targetIdx = current.findIndex((s: any) => s.id === id);

      if (targetIdx === -1) {
        return res.status(404).json({ error: 'Submission item not found' });
      }

      if (action === 'delete') {
        current.splice(targetIdx, 1);
        const success = await writeJsonBin(current);
        if (!success) return res.status(503).json({ error: 'Failed to update JSONBin' });
        return res.status(200).json({ success: true, deletedId: id });
      }

      const isApprove = action === 'approve';
      const newStatus = isApprove ? 'approved' : 'rejected';

      current[targetIdx] = {
        ...current[targetIdx],
        status: newStatus,
        submissionStatus: newStatus,
        reviewedBy: reviewer || 'Admin (prasanth123)',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rejectionReason: !isApprove ? (reason || 'Submission rejected by admin') : undefined,
      };

      const success = await writeJsonBin(current);
      if (!success) {
        return res.status(503).json({ error: 'Failed to save updated status to JSONBin' });
      }

      return res.status(200).json(current[targetIdx]);
    }

    // 4. DELETE: Directly delete submission item
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'Missing ID to delete' });

      const current = await readJsonBin();
      const filtered = current.filter((s: any) => s.id !== id);

      const success = await writeJsonBin(filtered);
      if (!success) return res.status(503).json({ error: 'Failed to update JSONBin' });
      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[API Submissions Error]', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

// ============================================================================
// Next.js App Router Route Handlers (GET, POST, PUT, PATCH, DELETE, OPTIONS)
// ============================================================================
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const all = await readJsonBin();

    if (status) {
      const filtered = all.filter(
        (s: any) => s.status === status || s.submissionStatus === status
      );
      return new Response(JSON.stringify(filtered), { status: 200, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify(all), { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(req: Request) {
  try {
    const record = await req.json();
    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400, headers: CORS_HEADERS });
    }

    const current = await readJsonBin();
    const existingIdx = current.findIndex((s: any) => s.id === record.id);

    const pendingRecord = {
      ...record,
      status: 'pending',
      submissionStatus: 'pending',
      submittedAt: record.submittedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx !== -1) {
      current[existingIdx] = { ...current[existingIdx], ...pendingRecord };
    } else {
      current.unshift(pendingRecord);
    }

    const success = await writeJsonBin(current);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Failed to update JSONBin' }), { status: 503, headers: CORS_HEADERS });
    }

    const dubList = Array.isArray(record.dubs) ? record.dubs.join(', ') : 'Regional Dub';
    const submitter = record.submittedBy?.userName || 'Community User';
    const telegramText = `🚀 *New Anime Dub Submission!*\n\n🎬 *Title:* ${record.title}\n🎙️ *Dubs:* ${dubList}\n👤 *Submitted By:* ${submitter}\n\n👉 *Review and Approve on AniDub India stealth admin panel.*`;
    
    sendTelegramAlert(telegramText).catch(() => {});

    return new Response(JSON.stringify(pendingRecord), { status: 201, headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, action, reviewer, reason, fullList } = body || {};

    if (Array.isArray(fullList)) {
      const saved = await writeJsonBin(fullList);
      if (!saved) return new Response(JSON.stringify({ error: 'Failed to save to JSONBin' }), { status: 503, headers: CORS_HEADERS });
      return new Response(JSON.stringify({ success: true, count: fullList.length }), { status: 200, headers: CORS_HEADERS });
    }

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400, headers: CORS_HEADERS });
    }

    const current = await readJsonBin();
    const targetIdx = current.findIndex((s: any) => s.id === id);

    if (targetIdx === -1) {
      return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404, headers: CORS_HEADERS });
    }

    if (action === 'delete') {
      current.splice(targetIdx, 1);
      const success = await writeJsonBin(current);
      if (!success) return new Response(JSON.stringify({ error: 'Failed to save to JSONBin' }), { status: 503, headers: CORS_HEADERS });
      return new Response(JSON.stringify({ success: true, deletedId: id }), { status: 200, headers: CORS_HEADERS });
    }

    const isApprove = action === 'approve';
    const newStatus = isApprove ? 'approved' : 'rejected';

    current[targetIdx] = {
      ...current[targetIdx],
      status: newStatus,
      submissionStatus: newStatus,
      reviewedBy: reviewer || 'Admin (prasanth123)',
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rejectionReason: !isApprove ? (reason || 'Rejected by admin') : undefined,
    };

    const success = await writeJsonBin(current);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Failed to save to JSONBin' }), { status: 503, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify(current[targetIdx]), { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
}

export async function PATCH(req: Request) {
  return PUT(req);
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400, headers: CORS_HEADERS });

    const current = await readJsonBin();
    const filtered = current.filter((s: any) => s.id !== id);

    const success = await writeJsonBin(filtered);
    if (!success) return new Response(JSON.stringify({ error: 'Failed to save to JSONBin' }), { status: 503, headers: CORS_HEADERS });
    return new Response(JSON.stringify({ success: true, deletedId: id }), { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
}
