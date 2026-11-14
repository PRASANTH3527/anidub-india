-- ============================================================================
-- Migration 0001: Initial Schema (Users, Anime Catalog, Episodes, Reviews,
-- Feedback, Votes, Ratings, Cloudflare Logs, and Edge Analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT 'https://i.ibb.co/vzS8G90/default-avatar.png',
  role TEXT DEFAULT 'user',
  bio TEXT DEFAULT 'Anime enthusiast streaming on Cloudflare Edge',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  synopsis TEXT,
  cover_image TEXT NOT NULL,
  banner_image TEXT NOT NULL,
  rating REAL DEFAULT 0.0,
  episodes_count INTEGER DEFAULT 12,
  status TEXT DEFAULT 'Airing',
  airing_status TEXT DEFAULT 'Airing',
  season TEXT DEFAULT 'Spring',
  year INTEGER DEFAULT 2026,
  genres TEXT NOT NULL DEFAULT 'Action',
  popularity INTEGER DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  likesCount INTEGER DEFAULT 0,
  languages TEXT DEFAULT 'HIN,TAM,TEL',
  platform TEXT DEFAULT 'Crunchyroll',
  type TEXT DEFAULT 'TV Series',
  studio TEXT DEFAULT 'Unknown Studio',
  submissionStatus TEXT DEFAULT 'approved',
  approval_status TEXT DEFAULT 'approved',
  is_published INTEGER DEFAULT 0,
  episodes_per_season TEXT DEFAULT '',
  mixedEntries TEXT DEFAULT '',
  mixed_entries TEXT DEFAULT '',
  watch_url TEXT DEFAULT '',
  platforms_data TEXT DEFAULT '',
  streaming_partners TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration TEXT DEFAULT '24m',
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  synopsis TEXT,
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  user_id TEXT DEFAULT 'default_user',
  user_name TEXT NOT NULL,
  user_avatar TEXT DEFAULT 'https://i.ibb.co/vzS8G90/default-avatar.png',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  language TEXT DEFAULT 'Hindi Dub',
  comment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_or_insta TEXT,
  email TEXT,
  feedback_text TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cloudflare_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  service TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  details TEXT
);

CREATE TABLE IF NOT EXISTS user_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK(vote_type IN ('like', 'upvote')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  anime_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, anime_id),
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id TEXT PRIMARY KEY,
  clerk_user_id TEXT,
  ip_hash TEXT,
  country TEXT DEFAULT 'IN',
  region TEXT DEFAULT 'Unknown',
  city TEXT DEFAULT 'Unknown',
  os TEXT DEFAULT 'Unknown',
  browser TEXT DEFAULT 'Unknown',
  device_type TEXT DEFAULT 'Desktop',
  referrer TEXT DEFAULT '',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_pageviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  time_spent_seconds INTEGER DEFAULT 0,
  max_scroll_depth INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_id TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE
);

-- Indexes for fast D1 catalog queries & pagination
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_votes_unique ON user_votes(anime_id, user_id, vote_type);
CREATE INDEX IF NOT EXISTS idx_user_votes_lookup ON user_votes(user_id, anime_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_anime ON user_ratings(anime_id);
CREATE INDEX IF NOT EXISTS idx_anime_popularity ON anime(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_anime_rating ON anime(rating DESC);
CREATE INDEX IF NOT EXISTS idx_anime_genres ON anime(genres);
CREATE INDEX IF NOT EXISTS idx_anime_status ON anime(status);
CREATE INDEX IF NOT EXISTS idx_episodes_anime_id ON episodes(anime_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_reviews_anime_id ON reviews(anime_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON analytics_sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_pageviews_session ON analytics_pageviews(session_id);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON analytics_pageviews(path);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
