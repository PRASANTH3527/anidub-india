// Next.js App Router API Route: app/api/telegram-feedback/route.ts
// Sends notification to ADMIN_CHAT_ID when a user submits feedback

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8769442354';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { nameOrInsta, email, feedback } = body;

    if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
      return Response.json({ success: false, error: 'Feedback text is required' }, { status: 400 });
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

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      console.warn('Telegram API response error for feedback:', data);
      return Response.json({ success: false, error: data.description }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Feedback notification sent to Admin' });
  } catch (err: any) {
    console.error('Error sending Telegram feedback notification:', err);
    return Response.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
