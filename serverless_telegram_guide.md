# Serverless Telegram Bot Admin Approval & Channel Broadcasting Guide
### (Next.js + Firebase/Supabase — No External Server Required)

This guide documents the **100% Serverless** implementation of the Telegram Bot Admin Approval System and Public Channel Broadcasting in Next.js without requiring Replit, a VPS, or an external Python/Node process.

---

## ⚡ The Exact cURL Commands to Register your Webhook

To connect your Telegram Bot to your Next.js API route, run this **one-time cURL command** in your terminal (replace `<YOUR_BOT_TOKEN>` and `https://your-domain.com` with your production URL, such as your Vercel or Cloud Run domain):

### 1. Register Webhook
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://your-domain.com/api/telegram-webhook",
       "allowed_updates": ["callback_query", "message"]
     }'
```

*(Optional with secret token for request verification)*:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://your-domain.com/api/telegram-webhook",
       "secret_token": "MY_TELEGRAM_SECRET_12345",
       "allowed_updates": ["callback_query"]
     }'
```

### 2. Verify Webhook Status
Run this command to verify that Telegram successfully connected to your Next.js route:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```
**Expected Response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-domain.com/api/telegram-webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### 3. Remove Webhook (if switching back to polling)
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

---

## 🏗 End-to-End Serverless Architecture

```
1. [User submits Dub form on website]
   │
   ├─► Saved to Database (status: "pending")
   │
   └─► Frontend / Server Action uses native `fetch` to call:
       POST https://api.telegram.org/bot<TOKEN>/sendPhoto
       To: ADMIN_CHAT_ID
       With: [✅ Approve] and [❌ Reject] Inline Buttons

2. [Admin clicks [✅ Approve] or [❌ Reject] on Telegram]
   │
   └─► Telegram dispatches webhook POST to:
       https://your-domain.com/api/telegram-webhook
       │
       ├─► 1. Acknowledges callback (`answerCallbackQuery`)
       ├─► 2. Updates Document in Firestore / Supabase (`status = "approved"`)
       ├─► 3. Edits Telegram message (`editMessageCaption` -> "✅ Approved")
       └─► 4. Broadcasts to Public Channel (`sendMessage` to @anidub_india) 📢
```

---

## 1. Frontend Form Submission (Native fetch Trigger)

When a user submits a dub on the website, save it with `status: "pending"`, then execute this native `fetch` call:

```typescript
// Call directly from form submission handler or Server Action
async function notifyAdminViaTelegram(anime: AnimeRecord) {
  const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN!;
  const ADMIN_CHAT_ID = process.env.NEXT_PUBLIC_ADMIN_CHAT_ID!;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://anidub.in";

  const caption = 
    `🚨 *NEW ANIME DUB SUBMISSION*\n\n` +
    `🎬 *Title:* ${anime.title}\n` +
    `🌐 *Dub Languages:* ${anime.dubs.join(', ')}\n` +
    `📺 *Platform:* ${anime.platforms[0]?.name}\n` +
    `👤 *Submitted by:* ${anime.submittedBy?.userName}\n\n` +
    `_Status: PENDING ADMIN APPROVAL_`;

  const body = {
    chat_id: ADMIN_CHAT_ID,
    photo: anime.poster,
    caption: caption,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approve:${anime.id}:${anime.title}` },
          { text: "❌ Reject", callback_data: `reject:${anime.id}:${anime.title}` }
        ],
        [
          { text: "🌐 View on AniDub", url: `${APP_URL}/#anime/${anime.id}` }
        ]
      ]
    }
  };

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
```

---

## 2. Next.js Webhook Route (`src/app/api/telegram-webhook/route.ts`)

Located in your codebase at `src/app/api/telegram-webhook/route.ts`. Handles incoming callbacks from Telegram when you click buttons:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID || '@anidub_india';
const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://anidub.in';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    if (!update.callback_query) {
      return NextResponse.json({ ok: true });
    }

    const { id: callbackQueryId, data, from, message } = update.callback_query;
    const [action, animeId, ...titleParts] = (data || '').split(':');
    const title = titleParts.join(':') || 'Anime';
    const adminUser = from.username ? `@${from.username}` : from.first_name || 'Admin';

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ ok: true });
    }

    // 1. Update Database (Firebase Firestore or Supabase)
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    // await db.collection('anime').doc(animeId).update({ submissionStatus: newStatus, reviewedBy: adminUser });

    // 2. Acknowledge Callback Query (Stops the Telegram spinner)
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: action === 'approve' ? `✅ Approved: ${title}` : `❌ Rejected: ${title}`,
      }),
    });

    // 3. Edit Telegram Message via editMessageCaption
    if (message) {
      const isApprove = action === 'approve';
      const statusText = isApprove
        ? `✅ *SUBMISSION APPROVED & LIVE ON SITE*\n\n🎬 *Title:* ${title}\n👤 *Approved by:* ${adminUser}\n🌐 *Live at:* ${WEBSITE_URL}/#anime/${animeId}\n\n📢 *Broadcasted to:* ${PUBLIC_CHANNEL_ID}`
        : `❌ *SUBMISSION REJECTED*\n\n🎬 *Title:* ${title}\n👤 *Rejected by:* ${adminUser}\n⚠️ *Status:* DECLINED`;

      await fetch(`${TELEGRAM_API}/editMessageCaption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: message.chat.id,
          message_id: message.message_id,
          caption: statusText,
          parse_mode: 'Markdown',
          reply_markup: isApprove
            ? { inline_keyboard: [[{ text: '🎬 Open Live Page', url: `${WEBSITE_URL}/#anime/${animeId}` }]] }
            : { inline_keyboard: [] },
        }),
      });
    }

    // 4. Serverless Channel Broadcast (Only if approved)
    if (action === 'approve') {
      const broadcastText =
        `🎉 *NEW REGIONAL DUB ADDED TO ANIDUB INDIA!*\n\n` +
        `🔥 *${title.toUpperCase()}*\n` +
        `🎙 Regional Indian dub options now streaming!\n\n` +
        `👉 *Watch Now & Track Dub Details:*\n` +
        `${WEBSITE_URL}/#anime/${animeId}\n\n` +
        `#TamilDub #TeluguDub #HindiDub #AnimeIndia #AniDub`;

      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: PUBLIC_CHANNEL_ID,
          text: broadcastText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🎬 Open on AniDub India', url: `${WEBSITE_URL}/#anime/${animeId}` }]],
          },
        }),
      });
    }

    return NextResponse.json({ success: true, action, animeId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## 3. Environment Variables (`.env.local`)

```env
TELEGRAM_BOT_TOKEN="7129384910:AAHq_w749..."
ADMIN_CHAT_ID="712933804"
PUBLIC_CHANNEL_ID="@anidub_india"
NEXT_PUBLIC_APP_URL="https://anidub.in"
TELEGRAM_SECRET_TOKEN="optional_secret_token"
```
