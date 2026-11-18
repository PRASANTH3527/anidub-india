-- Add verified broadcast schedule columns for Weekly Dub Release Schedule
ALTER TABLE anime ADD COLUMN broadcast_day TEXT DEFAULT NULL;
ALTER TABLE anime ADD COLUMN broadcast_time TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_anime_broadcast_day ON anime(broadcast_day);
