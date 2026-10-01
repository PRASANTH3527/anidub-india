# AniDub India — Telegram Bot Admin Approval & Channel Broadcasting Guide

This guide explains how to connect your **AniDub India** web application to a **Telegram Bot** for automated content moderation (approving/rejecting anime dub submissions directly from Telegram) and automatically broadcasting approved dub announcements to your public Telegram Channel.

---

## 🏗 System Architecture Flow

```
   [User on Website]
           │
           ▼ Submits "Dub Info" Form
   [Database: status = "pending"]
           │
           ▼ Triggers Webhook API
   [Telegram Admin Bot (@AniDubAdminBot)]
           │
           ▼ Sends Photo + Inline Buttons to Admin Private Chat
   ┌──────────────────────────────────────────────┐
   │ 🚨 NEW ANIME DUB SUBMISSION                  │
   │ 🎬 Title: Solo Leveling                      │
   │ 🌐 Dubs: Tamil, Telugu, Hindi                │
   │ [ ✅ Approve ]         [ ❌ Reject ]         │
   └──────────────────────────────────────────────┘
           │
           ├─► Admin Clicks [✅ Approve]
           │      1. Updates Database: status = "approved" (Live on site!)
           │      2. Edits Telegram Message -> "✅ APPROVED"
           │      3. Broadcasts to Public Channel (@anidub_india) 📢
           │
           └─► Admin Clicks [❌ Reject]
                  1. Updates Database: status = "rejected"
                  2. Edits Telegram Message -> "❌ REJECTED"
```

---

## 1. Setup Instructions (BotFather & Chat IDs)

### Step 1: Create your Bot with @BotFather
1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`.
3. Provide a name: `AniDub India Admin Bot`
4. Provide a username: `AniDubAdminBot` (or your preferred unique username).
5. Copy your **HTTP API Token** (e.g. `7129384910:AAHq_w749...`). This is your `TELEGRAM_BOT_TOKEN`.

### Step 2: Get your Admin Private Chat ID
1. Search for `@userinfobot` on Telegram and send `/start`.
2. It will reply with your personal **Id** (e.g., `712933804`).
3. This is your `ADMIN_CHAT_ID`. Only this user will receive approval alerts.

### Step 3: Setup your Public Announcement Channel
1. Create a public Telegram Channel (e.g., `@anidub_india`).
2. Go to **Channel Settings** -> **Administrators** -> **Add Administrator**.
3. Search for your bot username (`@AniDubAdminBot`) and add it as an **Admin** with **"Post Messages"** permission.
4. Your `PUBLIC_CHANNEL_ID` is `@anidub_india`.

---

## 2. Environment Variables

Create or update `.env` in the bot directory:

```env
TELEGRAM_BOT_TOKEN="7129384910:AAHq_w749..."
ADMIN_CHAT_ID="712933804"
PUBLIC_CHANNEL_ID="@anidub_india"
WEBSITE_URL="https://anidub.in"
```

---

## 3. Running the Bot

### Option A: Python (`telegram-bot/bot.py`)
Suitable for hosting on **Replit**, **Render**, **Railway**, or any VPS:

```bash
cd telegram-bot
pip install python-telegram-bot flask requests firebase-admin
python bot.py
```

### Option B: Node.js (`telegram-bot/bot.js`)
```bash
cd telegram-bot
npm install telegraf express dotenv
node bot.js
```

---

## 4. In-App Telegram Simulator & Admin Console

You can test the entire workflow without leaving the web browser!
1. Navigate to the **Admin Panel** (`/admin-panel` or click the **Admin** shield icon in the top header).
2. Click the **"Telegram Bot"** tab.
3. You will see:
   - **Private Bot Chat Preview**: Live interactive message card with photo and `[✅ Approve]` / `[❌ Reject]` buttons.
   - Click `[✅ Approve]`: Watch it update the database, publish the anime live to the home directory, and instantly trigger the **Public Channel Broadcast**.
   - **Live API & Webhook Configuration**: Enter your real Bot Token and Chat ID to send actual network requests to Telegram's servers.
