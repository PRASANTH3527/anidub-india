CREATE TABLE IF NOT EXISTS anime_dub_matrix (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id TEXT NOT NULL,
  season_number INTEGER NOT NULL DEFAULT 1,
  language_code TEXT NOT NULL,
  platform_name TEXT,
  region TEXT NOT NULL DEFAULT 'IN',
  dubbed_episodes INTEGER,
  total_episodes INTEGER,
  availability_status TEXT NOT NULL DEFAULT 'unverified' CHECK (availability_status IN ('complete', 'partial', 'announced', 'unavailable', 'unverified')),
  source_url TEXT,
  evidence_note TEXT,
  verified_at TEXT,
  verified_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(anime_id, season_number, language_code, platform_name)
);

CREATE INDEX IF NOT EXISTS idx_dub_matrix_anime ON anime_dub_matrix(anime_id, language_code);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT,
  diff_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_activity_logs(created_at DESC);
