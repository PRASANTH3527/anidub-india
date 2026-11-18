-- Add season_episode_count, official_source_url, and last_verified_date columns to anime table
ALTER TABLE anime ADD COLUMN season_episode_count TEXT DEFAULT '';
ALTER TABLE anime ADD COLUMN official_source_url TEXT DEFAULT '';
ALTER TABLE anime ADD COLUMN last_verified_date TEXT DEFAULT '';
