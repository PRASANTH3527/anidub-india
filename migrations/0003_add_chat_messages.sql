-- ============================================================================
-- Migration 0003: Live Community Chat Messages & Verified Identity Columns
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  rating REAL,
  language TEXT,
  isReview INTEGER DEFAULT 0,
  clerk_user_id TEXT,
  avatar TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_clerk_user ON chat_messages(clerk_user_id);
