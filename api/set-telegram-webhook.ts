// Vercel Serverless Function: /api/set-telegram-webhook.ts
// Configures and tests the Telegram bot webhook to link Vercel deployments.

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.query?.token || TELEGRAM_BOT_TOKEN;
  const botApi = `https://api.telegram.org/bot${token}`;

  try {
    // 1. GET: Check Current Webhook Status via Telegram getWebhookInfo
    if (req.method === 'GET') {
      const resp = await fetch(`${botApi}/getWebhookInfo`);
      const data = await resp.json();
      return res.status(200).json({
        success: data.ok,
        botTokenConfigured: Boolean(token),
        webhookInfo: data.result || null,
        description: data.description || 'Retrieved webhook info successfully',
      });
    }

    // 2. POST: Set or Update Webhook URL
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { webhookUrl, dropPendingUpdates = true, secretToken } = body;

      if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://')) {
        return res.status(400).json({
          success: false,
          error: 'A valid HTTPS webhook URL is required (e.g. https://your-project.vercel.app/api/telegram-webhook)',
        });
      }

      // Prepare Telegram setWebhook payload
      const setWebhookPayload: Record<string, any> = {
        url: webhookUrl.trim(),
        drop_pending_updates: Boolean(dropPendingUpdates),
        allowed_updates: ['message', 'callback_query'],
      };

      if (secretToken) {
        setWebhookPayload.secret_token = secretToken;
      }

      const telegramRes = await fetch(`${botApi}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setWebhookPayload),
      });

      const result = await telegramRes.json();

      if (!result.ok) {
        return res.status(400).json({
          success: false,
          error: result.description || 'Failed to set webhook in Telegram',
          raw: result,
        });
      }

      // Re-verify webhook info
      const verifyRes = await fetch(`${botApi}/getWebhookInfo`);
      const verifyData = await verifyRes.json();

      return res.status(200).json({
        success: true,
        message: `Webhook successfully linked to: ${webhookUrl}`,
        webhookInfo: verifyData.result,
        telegramResponse: result,
      });
    }

    // 3. DELETE: Remove Webhook (switch back to polling or detach)
    if (req.method === 'DELETE') {
      const dropUpdates = req.query?.drop_pending_updates === 'true';
      const telegramRes = await fetch(`${botApi}/deleteWebhook?drop_pending_updates=${dropUpdates}`);
      const result = await telegramRes.json();

      return res.status(200).json({
        success: result.ok,
        message: result.description || 'Webhook deleted',
        raw: result,
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Set Telegram Webhook error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while communicating with Telegram',
    });
  }
}
