// Next.js App Router API Route: app/api/submissions/route.ts
// Direct JSONBin.io persistence with simple one-way Telegram notification.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Master-Key',
};

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
    if (!res.ok) return [];
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
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.warn('[Telegram Alert Error]', err);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: NO_CACHE_HEADERS });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const all = await readBin();

    if (status) {
      const filtered = all.filter((s: any) => s.status === status || s.submissionStatus === status);
      return new Response(JSON.stringify(filtered), {
        status: 200,
        headers: NO_CACHE_HEADERS,
      });
    }

    return new Response(JSON.stringify(all), {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}

export async function POST(req: Request) {
  try {
    const record = await req.json();
    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: 'Missing ID' }), {
        status: 400,
        headers: NO_CACHE_HEADERS,
      });
    }

    const current = await readBin();
    const index = current.findIndex((s: any) => s.id === record.id);
    
    const updatedRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
      status: 'pending',
      submissionStatus: 'pending',
      airingStatus: record.status === 'pending' ? 'Ongoing' : (record.airingStatus || record.status || 'Ongoing'),
    };

    if (index !== -1) {
      current[index] = { ...current[index], ...updatedRecord };
    } else {
      current.unshift(updatedRecord);
    }

    const success = await updateBin(current);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Failed to save to JSONBin' }), {
        status: 503,
        headers: NO_CACHE_HEADERS,
      });
    }

    // One-way Telegram Notification
    const alertMsg = `🚀 *New Anime Submission!*\n\n🎬 *Title:* ${record.title}\n👤 *Submitted by:* ${record.submittedBy?.userName || 'User'}\n\n👉 Go to /admin page to approve.`;
    await sendTelegramAlert(alertMsg);

    return new Response(JSON.stringify(updatedRecord), {
      status: 201,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, reviewer, reason } = body || {};

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing ID' }), {
        status: 400,
        headers: NO_CACHE_HEADERS,
      });
    }

    const current = await readBin();
    const index = current.findIndex((s: any) => s.id === id);

    if (index === -1) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: NO_CACHE_HEADERS,
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    current[index] = {
      ...current[index],
      status: newStatus,
      submissionStatus: newStatus,
      reviewedBy: reviewer || 'Admin',
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rejectionReason: newStatus === 'rejected' ? reason : undefined,
    };

    await updateBin(current);
    return new Response(JSON.stringify(current[index]), {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}
