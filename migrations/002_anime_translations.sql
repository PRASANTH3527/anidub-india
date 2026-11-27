-- Additive Phase 2 Migration: Multilingual Anime Synopsis & Metadata Translations
-- Preserves all existing anime table columns and English source records untouched.

CREATE TABLE IF NOT EXISTS anime_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  localized_title TEXT,
  synopsis TEXT,
  description TEXT,
  source_hash TEXT,
  translation_status TEXT NOT NULL DEFAULT 'draft' CHECK (translation_status IN ('draft', 'reviewed', 'published')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(anime_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_anime_translations_locale_status
  ON anime_translations(locale, translation_status);

CREATE INDEX IF NOT EXISTS idx_anime_translations_anime_id
  ON anime_translations(anime_id);
