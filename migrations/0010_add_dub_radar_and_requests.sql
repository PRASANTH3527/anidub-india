-- Migration 0010: Dub Release Radar & Public Dub Request Voting
-- Adds structured Indian dub lifecycle tracking (`dub_radar`) and spam-resistant
-- community dub demand voting (`dub_requests` + `dub_request_votes`).

CREATE TABLE IF NOT EXISTS dub_radar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_title TEXT NOT NULL,
  anime_id INTEGER,
  slug TEXT,
  languages TEXT NOT NULL,
  platform TEXT DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'Official Announcement',
  release_date TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dub_radar_stage ON dub_radar(stage);
CREATE INDEX IF NOT EXISTS idx_dub_radar_updated ON dub_radar(updated_at DESC);

CREATE TABLE IF NOT EXISTS dub_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  anime_id INTEGER,
  language TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(normalized_title, language)
);

CREATE INDEX IF NOT EXISTS idx_dub_requests_ranking ON dub_requests(vote_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dub_requests_lang_rank ON dub_requests(language, vote_count DESC);

CREATE TABLE IF NOT EXISTS dub_request_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  voter_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, voter_hash)
);

CREATE INDEX IF NOT EXISTS idx_dub_request_votes_lookup ON dub_request_votes(request_id, voter_hash);
