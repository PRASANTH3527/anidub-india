-- ====================================================================
-- Cloudflare D1 Relational SQL Database Schema
-- Anime Streaming Platform (Cloudflare Pages + Functions + D1 + ImgBB)
-- ====================================================================

-- 1. Users Table (Stores user profiles and ImgBB avatar URLs)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT 'https://i.ibb.co/vzS8G90/default-avatar.png',
  role TEXT DEFAULT 'user',
  bio TEXT DEFAULT 'Anime enthusiast streaming on Cloudflare Edge',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Anime Catalog Table (Stores anime metadata and ImgBB poster & banner URLs)
CREATE TABLE IF NOT EXISTS anime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  synopsis TEXT,
  cover_image TEXT NOT NULL,
  banner_image TEXT NOT NULL,
  rating REAL DEFAULT 0.0,
  episodes_count INTEGER DEFAULT 12,
  status TEXT DEFAULT 'Airing',
  season TEXT DEFAULT 'Spring',
  year INTEGER DEFAULT 2026,
  genres TEXT NOT NULL,
  popularity INTEGER DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  likesCount INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. Episodes Table (Stores anime episode details and ImgBB thumbnail URLs)
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

-- 4. Reviews Table (Community reviews with user avatars from ImgBB)
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  user_id TEXT DEFAULT 'default_user',
  user_name TEXT NOT NULL,
  user_avatar TEXT DEFAULT 'https://i.ibb.co/vzS8G90/default-avatar.png',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  comment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

-- 5. Watchlist Table (User saved favorites)
CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT DEFAULT 'default_user',
  anime_id INTEGER NOT NULL,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, anime_id),
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

-- 6. Feedback Table (User feedback and missing dub submissions)
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_or_insta TEXT,
  email TEXT,
  feedback_text TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 7. Cloudflare & ImgBB Execution Logs Table
CREATE TABLE IF NOT EXISTS cloudflare_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  service TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  details TEXT
);

-- 8. IP-Based User Votes Table (Strictly 1 vote per IP per anime per type)
CREATE TABLE IF NOT EXISTS user_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK(vote_type IN ('like', 'upvote')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_votes_unique ON user_votes(anime_id, ip_address, vote_type);
CREATE INDEX IF NOT EXISTS idx_user_votes_lookup ON user_votes(ip_address, anime_id);

-- Indexes for lightning-fast D1 catalog queries & pagination
CREATE INDEX IF NOT EXISTS idx_anime_popularity ON anime(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_anime_rating ON anime(rating DESC);
CREATE INDEX IF NOT EXISTS idx_anime_genres ON anime(genres);
CREATE INDEX IF NOT EXISTS idx_anime_status ON anime(status);
CREATE INDEX IF NOT EXISTS idx_episodes_anime_id ON episodes(anime_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_reviews_anime_id ON reviews(anime_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, anime_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);

-- 9. Chat Messages Table (Stores real-time chat room messages for history persistence)
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
