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
  airing_status TEXT DEFAULT 'Airing',
  season TEXT DEFAULT 'Spring',
  year INTEGER DEFAULT 2026,
  genres TEXT NOT NULL,
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
  watch_url TEXT DEFAULT '',
  platforms_data TEXT DEFAULT '',
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
  language TEXT DEFAULT 'Hindi Dub',
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

-- 8. User-Based Votes Table (Strictly 1 vote per user ID per anime per type)
CREATE TABLE IF NOT EXISTS user_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK(vote_type IN ('like', 'upvote')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_votes_unique ON user_votes(anime_id, user_id, vote_type);
CREATE INDEX IF NOT EXISTS idx_user_votes_lookup ON user_votes(user_id, anime_id);

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
  rating REAL,
  language TEXT,
  isReview INTEGER DEFAULT 0,
  clerk_user_id TEXT,
  avatar TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- ====================================================================
-- Initial Seed Catalog Data (Approved Anime Entries)
-- ====================================================================
INSERT OR IGNORE INTO anime (
  id, title, slug, synopsis, cover_image, banner_image, 
  rating, episodes_count, status, season, year, genres, 
  popularity, languages, platform, type, studio, submissionStatus, approval_status, is_published
) VALUES 
(
  1, 
  'Solo Leveling', 
  'solo-leveling', 
  'In a world where hunters battle deadly monsters to protect mankind, Sung Jinwoo, the weakest hunter of them all, finds himself in an endless struggle for survival. After a mysterious incident in a high-rank dungeon, he gains the ability to level up.', 
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800', 
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800', 
  8.7, 12, 'Completed', 'Winter', 2024, 'Action, Fantasy, Adventure', 
  95000, 'Hindi, Tamil, Telugu, English, Japanese', 'Crunchyroll', 'TV Series', 'A-1 Pictures', 'approved', 'approved', 1
),
(
  2, 
  'Demon Slayer: Kimetsu no Yaiba', 
  'demon-slayer', 
  'It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon. To make matters worse, his younger sister Nezuko has been transformed into a demon herself.', 
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800', 
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800', 
  8.9, 26, 'Completed', 'Spring', 2019, 'Action, Supernatural', 
  120000, 'Hindi, Tamil, Telugu, English', 'Netflix', 'TV Series', 'ufotable', 'approved', 'approved', 1
),
(
  3, 
  'Naruto Shippuden', 
  'naruto-shippuden', 
  'Naruto returns to the Hidden Leaf Village after two and a half years of intense training with Jiraiya. Along with his friends, he faces off against the sinister Akatsuki organization while continuing his quest to bring Sasuke back.', 
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800', 
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800', 
  8.3, 500, 'Completed', 'Winter', 2007, 'Action, Adventure', 
  88000, 'Hindi, Tamil', 'Sony YAY!', 'TV Series', 'Studio Pierrot', 'approved', 'approved', 1
),
(
  4, 
  'Jujutsu Kaisen', 
  'jujutsu-kaisen', 
  'A boy swallows a cursed talisman - the finger of a demon - and becomes cursed himself. He enters a shaman school to be able to locate the demons other body parts and thus exorcise himself.', 
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800', 
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800', 
  8.8, 24, 'Completed', 'Fall', 2020, 'Action, Supernatural', 
  110000, 'Hindi, Tamil, Telugu, English', 'Crunchyroll', 'TV Series', 'MAPPA', 'approved', 'approved', 1
);

-- ====================================================================
-- 10. Analytics Tracking Schema (Edge Sessions, Pageviews & Events)
-- ====================================================================

-- 10.1 Analytics Sessions Table (Tracks unique sessions, edge geo, device, OS)
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

-- 10.2 Analytics Pageviews Table (Tracks path, time spent, max scroll depth)
CREATE TABLE IF NOT EXISTS analytics_pageviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  time_spent_seconds INTEGER DEFAULT 0,
  max_scroll_depth INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE
);

-- 10.3 Analytics Events Table (Tracks custom events: outbound clicks, review submissions, upvotes)
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_id TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON analytics_sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_pageviews_session ON analytics_pageviews(session_id);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON analytics_pageviews(path);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);

