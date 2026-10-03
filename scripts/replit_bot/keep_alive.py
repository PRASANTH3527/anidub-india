from flask import Flask
from threading import Thread

app = Flask('')

@app.route('/')
def home():
    return "AniDub Telegram Bot is Alive 24/7!"

def run():
    # Runs on port 8080 (standard for Replit webview & UptimeRobot)
    app.run(host='0.0.0.0', port=8080)

def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()
