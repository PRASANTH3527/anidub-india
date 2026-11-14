-- ============================================================================
-- Migration 0004: Community Submission Rate-Limit Logs & Moderation Indexes
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_submission_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  title_slug TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submission_logs_user_time ON community_submission_logs(user_id, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_submission_logs_ip_time ON community_submission_logs(client_ip, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_anime_submission_status ON anime(is_published, status, submissionStatus);
CREATE INDEX IF NOT EXISTS idx_anime_slug ON anime(slug);
