// Next.js App Router Route Handler: app/api/feedback/route.ts
export { default } from '../../../api/feedback';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY || '' },
      cache: 'no-store',
    });
    const json = await res.json();
    const binData = json.record || {};
    const feedbackList = binData.feedback || [];
    const newFeedback = {
      ...body,
      id: 'fb-' + Date.now(),
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    binData.feedback = [newFeedback, ...feedbackList];
    await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': process.env.JSONBIN_API_KEY || '',
      },
      body: JSON.stringify(binData),
    });

    if (process.env.TELEGRAM_BOT_TOKEN) {
      const alertMsg = `💬 *New User Feedback!*\n\n👤 *From:* ${body.nameOrInsta || 'Anonymous'}\n📝 *Feedback:* ${body.feedback}\n\n👉 *Review in Admin Dashboard.*`;
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.ADMIN_CHAT_ID || '8769442354',
          text: alertMsg,
          parse_mode: 'Markdown',
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
