-- Additive Migration 003: AniDub India — Anime Details 2.0 (Phase 2)
-- Adds Regional 5-Slider Dub Quality Reviews, Anime Universe / Smart Watch Order links,
-- and Verified Characters & Indian Voice Actors tables without altering existing tables.

CREATE TABLE IF NOT EXISTS dub_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  dub_language TEXT NOT NULL,
  voice_acting INTEGER NOT NULL CHECK (voice_acting BETWEEN 1 AND 10),
  voice_casting INTEGER NOT NULL CHECK (voice_casting BETWEEN 1 AND 10),
  translation_quality INTEGER NOT NULL CHECK (translation_quality BETWEEN 1 AND 10),
  lip_sync INTEGER NOT NULL CHECK (lip_sync BETWEEN 1 AND 10),
  emotional_delivery INTEGER NOT NULL CHECK (emotional_delivery BETWEEN 1 AND 10),
  overall_score REAL NOT NULL,
  review_text TEXT,
  has_spoilers INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(anime_id, user_id, dub_language)
);
CREATE INDEX IF NOT EXISTS idx_dub_reviews_anime_lang
  ON dub_reviews(anime_id, dub_language, status);

CREATE TABLE IF NOT EXISTS anime_franchise_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  franchise_key TEXT NOT NULL,
  anime_id TEXT NOT NULL,
  relation_label TEXT NOT NULL,
  watch_order INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(franchise_key, anime_id)
);
CREATE INDEX IF NOT EXISTS idx_franchise_key
  ON anime_franchise_links(franchise_key, watch_order);

CREATE TABLE IF NOT EXISTS anime_cast_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Main',
  voice_actor_name TEXT NOT NULL,
  dub_language TEXT NOT NULL,
  character_image TEXT,
  actor_image TEXT,
  verified INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cast_anime_lang
  ON anime_cast_entries(anime_id, dub_language);
