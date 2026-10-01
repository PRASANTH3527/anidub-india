"""
AniDub India - Telegram Bot Admin Moderation & Broadcast System
Suitable for deployment on Replit, VPS, Render, or serverless functions.

Requirements:
pip install python-telegram-bot flask requests firebase-admin
"""

import os
import logging
from flask import Flask, request, jsonify
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# Logging setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Environment Configurations
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_FROM_BOTFATHER")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "YOUR_TELEGRAM_ADMIN_CHAT_ID")
PUBLIC_CHANNEL_ID = os.getenv("PUBLIC_CHANNEL_ID", "@anidub_india")
WEBSITE_URL = os.getenv("WEBSITE_URL", "https://anidub.in")

# Initialize Flask for webhook reception from Website
app = Flask(__name__)

# Initialize Telegram Application
bot_app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

# ==========================================================
# 1. DATABASE CONNECTOR (Firebase Firestore or Supabase)
# ==========================================================
def update_anime_status(anime_id: str, new_status: str, reviewed_by: str):
    """
    Updates the anime document in Firebase Firestore or Supabase.
    Example below shows Firestore SDK syntax; adjust for Supabase if needed.
    """
    try:
        # Example for Firebase Firestore:
        # from firebase_admin import firestore
        # db = firestore.client()
        # db.collection('anime').document(anime_id).update({
        #     'submissionStatus': new_status,
        #     'reviewedBy': reviewed_by,
        #     'reviewedAt': firestore.SERVER_TIMESTAMP
        # })
        logger.info(f"Database updated: Anime ID {anime_id} -> {new_status} by {reviewed_by}")
        return True
    except Exception as e:
        logger.error(f"Error updating database: {e}")
        return False

# ==========================================================
# 2. WEBSITE WEBHOOK: SEND MODERATION ALERT TO TELEGRAM BOT
# ==========================================================
@app.route("/api/telegram-webhook/new-submission", methods=["POST"])
async def handle_new_submission():
    """
    Called by website when user submits anime dub details.
    Payload: { id, title, dubs, poster, releaseYear, studio, platforms, submittedBy }
    """
    data = request.json or {}
    anime_id = data.get("id")
    title = data.get("title", "Unknown Anime")
    dubs = ", ".join(data.get("dubs", ["Tamil"]))
    poster_url = data.get("poster", "")
    submitter = data.get("submittedBy", {}).get("userName", "Anonymous")
    platform = data.get("platforms", [{}])[0].get("name", "Crunchyroll")

    caption = (
        f"🚨 *NEW ANIME DUB SUBMISSION*\n\n"
        f"🎬 *Title:* {title}\n"
        f"🌐 *Dub Audio:* {dubs}\n"
        f"📺 *Platform:* {platform}\n"
        f"👤 *Submitted By:* {submitter}\n\n"
        f"_Status: PENDING ADMIN APPROVAL_"
    )

    keyboard = [
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve:{anime_id}:{title}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject:{anime_id}:{title}")
        ],
        [
            InlineKeyboardButton("🌐 View on Website", url=f"{WEBSITE_URL}/#anime/{anime_id}")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    try:
        bot = bot_app.bot
        if poster_url and poster_url.startswith("http"):
            await bot.send_photo(
                chat_id=ADMIN_CHAT_ID,
                photo=poster_url,
                caption=caption,
                parse_mode="Markdown",
                reply_markup=reply_markup
            )
        else:
            await bot.send_message(
                chat_id=ADMIN_CHAT_ID,
                text=caption,
                parse_mode="Markdown",
                reply_markup=reply_markup
            )
        return jsonify({"success": True, "message": "Telegram alert dispatched"}), 200
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ==========================================================
# 3. TELEGRAM BOT INLINE CALLBACK HANDLER ([Approve] / [Reject])
# ==========================================================
async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data.split(":")
    action = data[0]
    anime_id = data[1]
    title = data[2] if len(data) > 2 else "Anime"
    user_name = query.from_user.first_name or "Admin"

    if action == "approve":
        # 1. Update database document to "approved"
        update_anime_status(anime_id, "approved", f"Telegram Admin (@{query.from_user.username or user_name})")

        # 2. Edit Telegram message to reflect approval
        new_caption = (
            f"✅ *SUBMISSION APPROVED!*\n\n"
            f"🎬 *Title:* {title}\n"
            f"👤 *Approved By:* @{query.from_user.username or user_name}\n"
            f"🌐 *Status:* LIVE ON DIRECTORY\n\n"
            f"📢 *Broadcasted to Channel:* {PUBLIC_CHANNEL_ID}"
        )
        await query.edit_message_caption(
            caption=new_caption,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🎬 View Live Page", url=f"{WEBSITE_URL}/#anime/{anime_id}")
            ]])
        )

        # 3. Automatically broadcast to public Telegram Channel
        await broadcast_to_channel(context.bot, title, anime_id)

    elif action == "reject":
        # Update database document to "rejected"
        update_anime_status(anime_id, "rejected", f"Telegram Admin (@{query.from_user.username or user_name})")

        new_caption = (
            f"❌ *SUBMISSION REJECTED*\n\n"
            f"🎬 *Title:* {title}\n"
            f"👤 *Rejected By:* @{query.from_user.username or user_name}\n"
            f"⚠️ *Status:* DECLINED (Not published)"
        )
        await query.edit_message_caption(caption=new_caption, parse_mode="Markdown")

# ==========================================================
# 4. PUBLIC CHANNEL BROADCASTING
# ==========================================================
async def broadcast_to_channel(bot, title: str, anime_id: str):
    channel_caption = (
        f"🎉 *NEW ANIME DUB ADDED TO ANIDUB INDIA!*\n\n"
        f"🔥 *{title.upper()}*\n"
        f"🎙 Check out regional audio dubs, streaming links & cast:\n\n"
        f"👉 *Watch & Track on AniDub:*\n"
        f"{WEBSITE_URL}/#anime/{anime_id}\n\n"
        f"#TamilDub #TeluguDub #HindiDub #AnimeIndia #AniDub"
    )
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("🎬 Open on AniDub India", url=f"{WEBSITE_URL}/#anime/{anime_id}")
    ]])
    try:
        await bot.send_message(
            chat_id=PUBLIC_CHANNEL_ID,
            text=channel_caption,
            parse_mode="Markdown",
            reply_markup=keyboard
        )
        logger.info(f"Broadcasted '{title}' to {PUBLIC_CHANNEL_ID}")
    except Exception as e:
        logger.error(f"Error broadcasting to channel {PUBLIC_CHANNEL_ID}: {e}")

# Command: /start
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    await update.message.reply_text(
        f"👋 Welcome to *AniDub India Admin Bot*!\n\n"
        f"Your Chat ID: `{chat_id}`\n"
        f"Use this ID as `ADMIN_CHAT_ID` to receive incoming anime dub submissions with approval buttons.",
        parse_mode="Markdown"
    )

bot_app.add_handler(CommandHandler("start", start_command))
bot_app.add_handler(CallbackQueryHandler(handle_callback_query))

if __name__ == "__main__":
    import asyncio
    logger.info("Starting AniDub India Telegram Admin Bot...")
    bot_app.run_polling()
