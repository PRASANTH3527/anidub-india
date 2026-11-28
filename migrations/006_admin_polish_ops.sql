-- AniDub India — Admin Dashboard 2.0 (Phase 3.5: Final Polish, Recycle Bin & Power Ops)
-- Idempotent additive migration using standalone tables (zero destructive changes to existing tables).

CREATE TABLE IF NOT EXISTS admin_recycle_bin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT,
  payload_json TEXT NOT NULL,
  deleted_by TEXT,
  deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  restored_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_active
  ON admin_recycle_bin(restored_at, deleted_at DESC);

CREATE TABLE IF NOT EXISTS translation_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  synopsis_text TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'ai',
  saved_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_translation_versions_lookup
  ON translation_versions(anime_id, language_code, created_at DESC);

CREATE TABLE IF NOT EXISTS anime_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  summary TEXT,
  snapshot_json TEXT NOT NULL,
  edited_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anime_revisions_lookup
  ON anime_revisions(anime_id, version_number DESC);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  usage_date TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

