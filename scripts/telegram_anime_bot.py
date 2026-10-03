#!/usr/bin/env python3
"""
=============================================================
AniDub India — Automated Anime Updates Telegram Bot (Replit)
=============================================================

Features:
- Dedicated ONLY to automated anime release notifications
- Uses Bot Token from @BotFather
- Fetches new seasonal anime releases (via Jikan API v4 / RSS)
- Sends poster photo with rich formatted HTML caption
- Includes inline button with "▶️ Watch Now" link to website
- Broadcasts to your target Telegram Channel (@channel_name or -100...)
- Keeps a local `seen_anime.json` history to prevent duplicates
- Includes built-in lightweight keep-alive web server for Replit 24/7 uptime
"""

import os
import json
import time
import html
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests

# -------------------------------------------------------------
# Configuration (Replit Secrets or Environment Variables)
# -------------------------------------------------------------
# In Replit: Go to the 'Tools' -> 'Secrets' tab (lock icon) to add these:
BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
CHANNEL_ID = os.environ.get("CHANNEL_ID", "").strip()  # e.g., "@AniDubUpdates" or "-1001234567890"
SITE_URL = os.environ.get("SITE_URL", "https://anidub.in").strip()
CHECK_INTERVAL_SECONDS = int(os.environ.get("CHECK_INTERVAL_SECONDS", 1800))  # 30 minutes default

SEEN_CACHE_FILE = "seen_anime.json"

# Set up logging
logging.basicConfig(
    format="%(asctime)s - [%(levelname)s] - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("AnimeBot")

# -------------------------------------------------------------
# Cache for deduplication
# -------------------------------------------------------------
def load_seen_anime() -> set:
    if os.path.exists(SEEN_CACHE_FILE):
        try:
            with open(SEEN_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data)
        except Exception as e:
            logger.warning(f"Could not load cache file: {e}")
    return set()

def save_seen_anime(seen_set: set):
    try:
        # Keep last 500 items to avoid file bloating
        items = list(seen_set)[-500:]
        with open(SEEN_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f)
    except Exception as e:
        logger.error(f"Failed to save seen anime: {e}")

# -------------------------------------------------------------
# Telegram API Methods
# -------------------------------------------------------------
def send_telegram_update(anime: dict) -> bool:
    """Send photo with caption and inline button to Telegram Channel."""
    if not BOT_TOKEN or not CHANNEL_ID:
        logger.error("BOT_TOKEN or CHANNEL_ID is not configured!")
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"

    title = html.escape(anime.get("title", "Unknown Title"))
    jp_title = html.escape(anime.get("title_japanese") or "")
    score = anime.get("score") or "N/A"
    episodes = anime.get("episodes") or "Ongoing"
    genres = html.escape(", ".join(anime.get("genres", []))) or "Action, Adventure"
    synopsis = html.escape((anime.get("synopsis") or "No synopsis available.")[:240].strip()) + "..."
    watch_link = anime.get("url") or f"{SITE_URL}?anime={anime.get('id')}"

    caption = (
        f"🔥 <b>NEW ANIME UPDATE</b>\n\n"
        f"🎬 <b>{title}</b>\n"
    )
    if jp_title:
        caption += f"🇯🇵 <i>{jp_title}</i>\n"

    caption += (
        f"\n🎙️ <b>Regional Audio:</b> Tamil • Telugu • Hindi\n"
        f"⭐ <b>Score:</b> {score} / 10 | 📺 <b>Episodes:</b> {episodes}\n"
        f"🏷️ <b>Genres:</b> {genres}\n\n"
        f"📝 <i>{synopsis}</i>\n\n"
        f"⚡ <i>Available with Indian dubbing & legal streaming!</i>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📢 Powered by <a href='{SITE_URL}'>AniDub India</a>"
    )

    # Inline 'Watch Now' button pointing directly to website
    reply_markup = {
        "inline_keyboard": [
            [
                {"text": "▶️ Watch Now / Details", "url": watch_link},
                {"text": "🌐 Visit Website", "url": SITE_URL}
            ]
        ]
    }

    payload = {
        "chat_id": CHANNEL_ID,
        "photo": anime.get("poster"),
        "caption": caption,
        "parse_mode": "HTML",
        "reply_markup": json.dumps(reply_markup)
    }

    try:
        response = requests.post(url, data=payload, timeout=20)
        res_json = response.json()
        if res_json.get("ok"):
            logger.info(f"✅ Broadcasted successfully: {title}")
            return True
        else:
            logger.error(f"❌ Telegram API Error: {res_json.get('description')}")
            return False
    except Exception as e:
        logger.error(f"❌ Network error while sending to Telegram: {e}")
        return False

# -------------------------------------------------------------
# Data Fetcher (Jikan API / Season releases)
# -------------------------------------------------------------
def fetch_latest_anime() -> list:
    """Fetch currently airing & recent anime releases from Jikan REST API."""
    api_url = "https://api.jikan.moe/v4/seasons/now?limit=12"
    headers = {"User-Agent": "AniDubTelegramBot/1.0"}
    
    try:
        resp = requests.get(api_url, headers=headers, timeout=15)
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            results = []
            for item in data:
                genres = [g.get("name") for g in item.get("genres", []) if g.get("name")]
                poster = (
                    item.get("images", {}).get("jpg", {}).get("large_image_url") or
                    item.get("images", {}).get("jpg", {}).get("image_url")
                )
                if not poster:
                    continue

                mal_id = str(item.get("mal_id"))
                results.append({
                    "id": mal_id,
                    "title": item.get("title_english") or item.get("title"),
                    "title_japanese": item.get("title_japanese"),
                    "score": item.get("score"),
                    "episodes": item.get("episodes"),
                    "genres": genres[:3],
                    "synopsis": item.get("synopsis"),
                    "poster": poster,
                    "url": f"{SITE_URL}?q={requests.utils.quote(item.get('title', ''))}"
                })
            return results
        else:
            logger.warning(f"Jikan API responded with status {resp.status_code}")
    except Exception as e:
        logger.error(f"Failed to fetch anime releases: {e}")
    
    return []

# -------------------------------------------------------------
# Periodic Worker Loop
# -------------------------------------------------------------
def run_updater_loop():
    logger.info("🚀 Starting Anime Updates Polling Loop...")
    seen = load_seen_anime()
    logger.info(f"Loaded {len(seen)} previously posted anime from cache.")

    first_run = len(seen) == 0

    while True:
        try:
            logger.info("🔍 Checking for new anime updates...")
            releases = fetch_latest_anime()
            new_count = 0

            # If brand new run, initialize with the top items so we don't dump 20 posts at once
            if first_run:
                logger.info("Initializing first-run: Posting latest top release and caching the rest.")
                if releases:
                    # Post only the top 1 newest release to verify configuration
                    top_anime = releases[0]
                    if send_telegram_update(top_anime):
                        seen.add(top_anime["id"])
                    for item in releases[1:]:
                        seen.add(item["id"])
                    save_seen_anime(seen)
                first_run = False
            else:
                for anime in releases:
                    anime_id = anime["id"]
                    if anime_id not in seen:
                        logger.info(f"✨ Found new release: {anime['title']}")
                        success = send_telegram_update(anime)
                        if success:
                            seen.add(anime_id)
                            save_seen_anime(seen)
                            new_count += 1
                            # Respect Telegram rate-limits: pause 3s between broadcasts
                            time.sleep(3)

            logger.info(f"Scan complete. {new_count} new posts sent. Sleeping for {CHECK_INTERVAL_SECONDS}s.")
        except Exception as err:
            logger.error(f"Error in updater loop: {err}")

        time.sleep(CHECK_INTERVAL_SECONDS)

# -------------------------------------------------------------
# Replit Keep-Alive Web Server (for UptimeRobot 24/7 hosting)
# -------------------------------------------------------------
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        html_content = """
        <html>
            <head><title>AniDub Telegram Bot</title></head>
            <body style="font-family:sans-serif;background:#0b0f17;color:#f3f4f6;text-align:center;padding:50px;">
                <h1 style="color:#a855f7;">🤖 AniDub Anime Updates Bot</h1>
                <p>Status: <span style="color:#22c55e;font-weight:bold;">Running 24/7</span></p>
                <p>Posting updates to Telegram Channel.</p>
            </body>
        </html>
        """
        self.wfile.write(html_content.encode("utf-8"))

    def log_message(self, format, *args):
        # Suppress routine health check log spam
        return

def start_keep_alive_server():
    server = HTTPServer(("0.0.0.0", 8080), HealthCheckHandler)
    logger.info("🌐 Keep-alive HTTP server started on port 8080 for Replit.")
    server.serve_forever()

# -------------------------------------------------------------
# Main Entry Point
# -------------------------------------------------------------
if __name__ == "__main__":
    logger.info("=== Starting AniDub Telegram Updates Bot ===")
    
    # 1. Start Keep-Alive server in background thread (keeps Replit alive)
    server_thread = threading.Thread(target=start_keep_alive_server, daemon=True)
    server_thread.start()

    # 2. Run the main polling loop
    run_updater_loop()
