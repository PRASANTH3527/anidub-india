-- Migration 0005: Anime Issue Reports Table

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER,
  anime_title TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reporter_user_id TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_anime_id ON reports(anime_id);
