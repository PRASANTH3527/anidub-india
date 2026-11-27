-- Additive Migration 005: AniDub India — Admin Dashboard 2.0 (Phase 3: Intelligence, Universe/Cast Ops & Backup Scale)
-- Idempotent additive table and indexes for privacy-safe content demand intelligence.

CREATE TABLE IF NOT EXISTS content_demand_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  anime_id TEXT,
  query_text TEXT,
  language_code TEXT,
  platform_name TEXT,
  result_count INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demand_events_type_date
  ON content_demand_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demand_events_anime
  ON content_demand_events(anime_id, event_type);
