# AniDub India — Database Schema & Architecture Guide

This document specifies the database schemas, security rules, and architectural design for **AniDub India** covering Content Moderation, Jikan API Auto-Fill, Google Authentication, User Watchlists, Dynamic SEO, and Dub Quality Reviews.

---

## 1. Firebase Firestore Database Schema

### Collection: `anime` (Directory Catalog & Submissions)
Each document represents an anime title with regional dub information and moderation state.

```typescript
interface AnimeDocument {
  id: string; // e.g., "solo-leveling", "sub-172948291"
  title: string;
  romajiTitle?: string;
  nativeTitle?: string;
  poster: string;
  synopsis: string;
  type: "Series" | "Movie" | "OVA";
  releaseYear: number;
  originalReleaseDate: string; // e.g., "January 7, 2024"
  rating: number; // e.g., 8.9 (MAL / AniDub score)
  episodes?: number;
  status: "Completed" | "Airing" | "Upcoming";
  
  // Content Moderation Status (CRITICAL)
  submissionStatus: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  
  genres: string[]; // ["Action", "Fantasy", "Shonen"]
  themes: string[]; // ["Underdog to OP", "Dungeon Crawling"]
  studio: string;   // "A-1 Pictures"
  
  // Regional Dub Information
  dubs: ("Tamil" | "Telugu" | "Hindi" | "Malayalam" | "Kannada")[];
  dubDetails: {
    language: "Tamil" | "Telugu" | "Hindi" | "Malayalam" | "Kannada";
    available: boolean;
    platform: string[]; // ["Crunchyroll", "Netflix"]
    dubStudio?: string;
    notes?: string;
  }[];
  
  platforms: {
    name: string;
    url: string;
  }[];
  
  // Main Characters & Voice Actors
  characters: {
    characterName: string;
    characterImage: string;
    role: "Main" | "Supporting";
    japaneseVA: string;
    indianVA?: {
      language: string;
      actor: string;
    };
  }[];
  
  submittedBy?: {
    userId: string;
    userName: string;
    userEmail?: string;
  };
  submittedAt: string; // ISO 8601
  reviewedBy?: string;
  reviewedAt?: string;
}
```

### Firestore Security Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if requester is an admin
    function isAdmin() {
      return request.auth != null && 
        (request.auth.token.email == "admin@anidub.in" || request.auth.token.admin == true);
    }
    
    // Anime Collection Rules
    match /anime/{animeId} {
      // Public can ONLY read approved anime
      allow read: if resource.data.submissionStatus == "approved" || isAdmin();
      
      // Anyone can submit new dub info, but forced to status "pending"
      allow create: if request.resource.data.submissionStatus == "pending";
      
      // Only admins can approve, edit, or reject
      allow update, delete: if isAdmin();
    }
    
    // User Watchlists Collection Rules
    match /watchlists/{userId}/items/{animeId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Dub Reviews & Ratings Collection Rules
    match /reviews/{reviewId} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && (request.auth.uid == resource.data.userId || isAdmin());
    }
  }
}
```

---

## 2. Relational SQL Schema (PostgreSQL / Supabase)

```sql
-- 1. Anime Catalog Table
CREATE TYPE anime_type AS ENUM ('Series', 'Movie', 'OVA');
CREATE TYPE submission_status_type AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE anime (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    romaji_title VARCHAR(255),
    native_title VARCHAR(255),
    poster_url TEXT NOT NULL,
    synopsis TEXT NOT NULL,
    type anime_type DEFAULT 'Series',
    release_year INT NOT NULL,
    original_release_date VARCHAR(64),
    rating NUMERIC(3, 1) DEFAULT 8.0,
    episodes INT DEFAULT 12,
    status VARCHAR(32) DEFAULT 'Airing',
    submission_status submission_status_type DEFAULT 'pending' NOT NULL,
    rejection_reason TEXT,
    studio VARCHAR(128) NOT NULL,
    submitted_by VARCHAR(128),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by VARCHAR(128),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast queries: ONLY fetch approved anime on public feeds
CREATE INDEX idx_anime_approved ON anime (submission_status) WHERE submission_status = 'approved';

-- 2. Anime Dubs Availability Table
CREATE TABLE anime_dubs (
    id SERIAL PRIMARY KEY,
    anime_id VARCHAR(64) REFERENCES anime(id) ON DELETE CASCADE,
    language VARCHAR(32) NOT NULL, -- 'Tamil', 'Telugu', 'Hindi', etc.
    platform VARCHAR(64) NOT NULL, -- 'Crunchyroll', 'Netflix', etc.
    platform_url TEXT,
    notes TEXT
);

-- 3. Watchlist Table
CREATE TABLE user_watchlists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    anime_id VARCHAR(64) REFERENCES anime(id) ON DELETE CASCADE,
    status VARCHAR(32) DEFAULT 'plan_to_watch' NOT NULL, -- 'plan_to_watch', 'watched'
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (user_id, anime_id)
);

-- 4. Dub Quality Reviews & Ratings Table
CREATE TABLE dub_reviews (
    id VARCHAR(64) PRIMARY KEY,
    anime_id VARCHAR(64) REFERENCES anime(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL,
    user_name VARCHAR(128) NOT NULL,
    user_avatar TEXT,
    language VARCHAR(32) NOT NULL,
    rating NUMERIC(3, 1) CHECK (rating >= 0 AND rating <= 10) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    likes INT DEFAULT 0
);
```

---

## 3. Implementation Highlights

1. **Content Moderation (`/admin-panel`)**:
   - `dbService.submitDubInfo()` assigns `submissionStatus: "pending"`.
   - Public queries in `App.tsx` strictly run `dbService.getApprovedAnime()`.
   - Admins can review entries on `/admin-panel` to Approve, Edit, or Reject with custom reasons.

2. **Jikan API Integration (`src/services/jikanApi.ts`)**:
   - Debounced endpoint `https://api.jikan.moe/v4/anime?q={query}`.
   - Throttled at 400ms to stay within MyAnimeList API limits.
   - Auto-populates cover image, English title, Romaji, synopsis, release year, and episode count into the form.

3. **Google Authentication & Database Watchlist**:
   - `authService.loginWithGoogle()` manages active user session and admin credentials (`admin@anidub.in`).
   - Watchlists store `userId`, `animeId`, `status: "plan_to_watch" | "watched"` and are editable from the user's profile.

4. **Dynamic SEO Engine (`src/utils/seo.ts`)**:
   - Auto-injects dynamic `<title>`, `<meta name="description">`, `<meta name="keywords">`, and OpenGraph tags with keywords such as *"Tamil dubbed anime"*, *"Telugu anime dubs"*, and *"Hindi dubbed anime"*.
