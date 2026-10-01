// Vercel Serverless Function: api/feedback.ts
// Direct JSONBin.io persistence with simple one-way Telegram notification.

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';

async function readBin(): Promise<any> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return {};
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Versioning': 'false',
      },
      cache: 'no-store',
    });
    if (!res.ok) return {};
    const json = await res.json();
    return json.record || {};
  } catch {
    return {};
  }
}

async function updateBin(record: any): Promise<boolean> {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return false;
  try {
    const res = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
      },
      body: JSON.stringify(record),
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
  } catch {}
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const feedback = req.body;
      const binData = await readBin();
      
      const feedbackList = binData.feedback || [];
      const newFeedback = {
        ...feedback,
        id: 'fb-' + Date.now(),
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      binData.feedback = [newFeedback, ...feedbackList];
      
      const success = await updateBin(binData);
      if (!success) return res.status(503).json({ error: 'DB update failed' });

      // One-way Telegram Notification
      const alertMsg = `💬 *New User Feedback!*\n\n👤 *From:* ${feedback.nameOrInsta || 'Anonymous'}\n📝 *Feedback:* ${feedback.feedback}\n\n👉 Review in Admin Dashboard.`;
      await sendTelegramAlert(alertMsg);

      return res.status(201).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
