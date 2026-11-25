-- Migration 0011: P0 & P2 Reliability, Franchise Watch Order, Dub Updates Feed, Follows & In-App Alerts
-- Safe additive schema evolution for AniDub India (Cloudflare D1)

-- 1. P0 #4: Persist explicit spoiler flag on user reviews
ALTER TABLE reviews ADD COLUMN is_spoiler INTEGER NOT NULL DEFAULT 0;

-- 2. P2 #1 & #3: Franchise Watch Order & Last Verified timestamp on anime
ALTER TABLE anime ADD COLUMN franchise_id TEXT DEFAULT '';
ALTER TABLE anime ADD COLUMN relation_type TEXT DEFAULT '';
ALTER TABLE anime ADD COLUMN sequence_number INTEGER DEFAULT NULL;
ALTER TABLE anime ADD COLUMN last_verified_at TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_anime_franchise_seq
  ON anime(franchise_id, sequence_number);

-- 3. P2 #2: Recent Dub Updates Feed (auto-logged on Admin anime updates/approvals)
CREATE TABLE IF NOT EXISTS dub_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER,
  anime_title TEXT NOT NULL,
  update_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dub_updates_created_at
  ON dub_updates(id DESC);

-- 4. P2 #5: Anime Follow system & real In-App Alerts inbox
CREATE TABLE IF NOT EXISTS anime_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  anime_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, anime_id)
);

CREATE INDEX IF NOT EXISTS idx_anime_follows_user
  ON anime_follows(user_id);

CREATE INDEX IF NOT EXISTS idx_anime_follows_anime
  ON anime_follows(anime_id);

CREATE TABLE IF NOT EXISTS in_app_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  anime_id INTEGER,
  anime_title TEXT NOT NULL,
  update_type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_in_app_alerts_user_read
  ON in_app_alerts(user_id, is_read, id DESC);
