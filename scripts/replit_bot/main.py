import os
import time
import telebot
from telebot import types
from keep_alive import keep_alive

# ------------------------------------------------------------------
# CONFIGURATION
# ------------------------------------------------------------------
# Your Bot Token provided by BotFather
BOT_TOKEN = os.environ.get("BOT_TOKEN", "8928992155:AAFp98d-k2YBHKv5TnmyYHYzZPkHtectusY")

# Replace with your Telegram Channel username (e.g. '@anidub_updates')
# or private channel ID (e.g. -1001234567890).
# NOTE: Make sure the bot is added to the channel as an ADMIN with "Post Messages" permission!
CHAT_ID = os.environ.get("CHAT_ID", "@YOUR_CHANNEL_USERNAME")

# Target Website
WEBSITE_URL = "https://anidub-india.vercel.app/"

# Initialize the bot
bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")


# ------------------------------------------------------------------
# FUNCTION: Send Automated Anime Post with Poster & 'Watch Now' Button
# ------------------------------------------------------------------
def send_anime_update(
    title: str,
    poster_url: str,
    description: str = "",
    languages: str = "Tamil • Telugu • Hindi",
    custom_url: str = WEBSITE_URL
):
    """
    Sends an anime poster image with title, details, and an inline 'Watch Now' button to your channel.
    """
    try:
        # Create Inline Keyboard with 'Watch Now' button
        markup = types.InlineKeyboardMarkup()
        watch_button = types.InlineKeyboardButton(
            text="▶️ Watch Now",
            url=custom_url
        )
        markup.add(watch_button)

        # Format Caption in HTML
        caption = (
            f"🔥 <b>NEW ANIME UPDATE</b>\n\n"
            f"🎬 <b>{title}</b>\n"
            f"🎙️ <b>Available Dubs:</b> {languages}\n"
        )
        if description:
            caption += f"\n📝 <i>{description}</i>\n"

        caption += (
            f"\n━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚡ Stream legally on <b>AniDub India</b>"
        )

        # Send Photo with Caption and Inline Button
        sent_message = bot.send_photo(
            chat_id=CHAT_ID,
            photo=poster_url,
            caption=caption,
            reply_markup=markup
        )
        print(f"✅ Success: Posted '{title}' to channel {CHAT_ID} (Msg ID: {sent_message.message_id})")
        return True

    except Exception as e:
        print(f"❌ Error sending anime update: {e}")
        return False


# ------------------------------------------------------------------
# (Optional) Bot Command Handlers
# ------------------------------------------------------------------
@bot.message_handler(commands=['start', 'help'])
def handle_start(message):
    bot.reply_to(message, "👋 AniDub Updates Bot is online and broadcasting to your channel!")

@bot.message_handler(commands=['test'])
def handle_test(message):
    bot.reply_to(message, "🚀 Triggering sample broadcast to channel...")
    trigger_sample_update()


# ------------------------------------------------------------------
# SAMPLE TRIGGER FUNCTION
# ------------------------------------------------------------------
def trigger_sample_update():
    """Sample trigger to test the broadcast immediately"""
    sample_title = "Solo Leveling (Season 2)"
    sample_poster = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80"
    sample_desc = "Sung Jinwoo returns with new shadows and regional Indian dub tracks!"
    
    send_anime_update(
        title=sample_title,
        poster_url=sample_poster,
        description=sample_desc,
        languages="Tamil • Telugu • Hindi • English",
        custom_url="https://anidub-india.vercel.app/"
    )


# ------------------------------------------------------------------
# MAIN RUNNER
# ------------------------------------------------------------------
if __name__ == "__main__":
    print("🤖 Starting Telegram Anime Bot...")

    # 1. Start Flask web server for 24/7 UptimeRobot pinging
    keep_alive()
    print("🌐 Keep-alive server running on port 8080.")

    # 2. Trigger a sample post on startup (uncomment or leave enabled to test)
    if CHAT_ID and CHAT_ID != "@YOUR_CHANNEL_USERNAME":
        print("📢 Sending initial test update...")
        trigger_sample_update()
    else:
        print("⚠️ Warning: Please set your CHAT_ID in main.py or Replit Secrets to test broadcasting!")

    # 3. Start bot polling so it stays responsive
    print("👂 Bot is listening for commands. Press Ctrl+C to stop.")
    bot.infinity_polling(skip_pending=True)
