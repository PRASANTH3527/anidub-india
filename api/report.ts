// API endpoint: /api/report
// Sends an instant Telegram alert to the admin without saving to JSONBin.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sendTelegramAlert(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.warn('[Report Alert] Telegram bot token or admin chat ID not configured');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[Report Alert Error]', err);
    return false;
  }
}

// Next.js App Router handlers
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { animeId, animeTitle, reason, details } = body || {};

    if (!animeTitle || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required report fields (animeTitle, reason)' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const telegramMessage = 
`🚨 *AniDub Issue Report*

🎬 *Anime*: ${animeTitle}
🆔 *ID*: \`${animeId || 'N/A'}\`
⚠️ *Reason*: ${reason}
${details ? `📝 *Details*: ${details}\n` : ''}⏰ *Time*: ${timestamp}
🌐 *Source*: Public Community Flag`;

    // Fire Telegram alert without persisting to JSONBin
    await sendTelegramAlert(telegramMessage);

    return new Response(
      JSON.stringify({ success: true, message: 'Report delivered to moderation team.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[API Report Error]', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Express / Vite SSR dev middleware & Vercel serverless default export
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { animeId, animeTitle, reason, details } = req.body || {};

    if (!animeTitle || !reason) {
      return res.status(400).json({ error: 'Missing required report fields (animeTitle, reason)' });
    }

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const telegramMessage = 
`🚨 *AniDub Issue Report*

🎬 *Anime*: ${animeTitle}
🆔 *ID*: \`${animeId || 'N/A'}\`
⚠️ *Reason*: ${reason}
${details ? `📝 *Details*: ${details}\n` : ''}⏰ *Time*: ${timestamp}
🌐 *Source*: Public Community Flag`;

    // Fire Telegram alert without persisting to JSONBin
    await sendTelegramAlert(telegramMessage);

    return res.status(200).json({ success: true, message: 'Report delivered to moderation team.' });
  } catch (err: any) {
    console.error('[API Report Error]', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
