// Next.js Pages Router API Route: pages/api/telegram-feedback.ts

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nameOrInsta, email, feedback } = req.body || {};

    if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
      return res.status(400).json({ error: 'Feedback text is required' });
    }

    const nameText = nameOrInsta?.trim() || 'Anonymous User';
    const emailText = email?.trim() || 'Not provided';
    const feedbackText = feedback.trim();
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

    const message =
      `💬 *NEW USER FEEDBACK RECEIVED*\n\n` +
      `👤 *Name / Insta ID:* ${nameText}\n` +
      `📧 *Email ID:* ${emailText}\n` +
      `📅 *Date & Time:* ${timestamp}\n\n` +
      `📝 *Feedback:*\n` +
      `"${feedbackText}"\n\n` +
      `_Sent via AniDub India Community Portal_`;

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return res.status(500).json({ error: data.description });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
