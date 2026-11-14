-- ============================================================================
-- Migration 0002: Watchlist Table & User-Anime Composite Index
-- ============================================================================

CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  anime_id INTEGER NOT NULL,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, anime_id),
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, anime_id);
