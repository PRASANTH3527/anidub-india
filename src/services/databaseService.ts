import { AnimeRecord, DubReview, WatchlistEntry, SubmissionStatus } from '../types/database';
import { getEnrichedAnimeList } from '../utils/animeHelper';
import { Anime, DubLanguage } from '../types/anime';

const DB_ANIME_KEY = 'anidub_db_anime_records';
const DB_REVIEWS_KEY = 'anidub_db_reviews';
const DB_WATCHLIST_KEY = 'anidub_db_watchlists';

// Initial pre-seeded reviews for realistic community ratings
const INITIAL_REVIEWS: DubReview[] = [
  {
    id: 'rev-1',
    animeId: 'solo-leveling',
    userId: 'user-prasanth',
    userName: 'Prasanth K.',
    userAvatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100&auto=format&fit=crop&q=80',
    language: 'Tamil',
    rating: 5,
    comment: 'The Tamil dub for Sung Jinwoo is mindblowing! Voice modulation in the double dungeon arc gave absolute goosebumps. Crunchyroll did phenomenal casting!',
    createdAt: '2026-09-24T14:30:00Z',
    likes: 42,
  },
  {
    id: 'rev-2',
    animeId: 'solo-leveling',
    userId: 'user-rahul',
    userName: 'Rahul Sharma',
    userAvatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100&auto=format&fit=crop&q=80',
    language: 'Hindi',
    rating: 5,
    comment: 'Hindi dub translation is top-notch. System prompts and dialogue delivery are super crisp. 10/10 recommended for Hindi viewers!',
    createdAt: '2026-09-21T09:15:00Z',
    likes: 29,
  },
  {
    id: 'rev-3',
    animeId: 'demon-slayer',
    userId: 'user-suresh',
    userName: 'Suresh Varma',
    userAvatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=100&auto=format&fit=crop&q=80',
    language: 'Telugu',
    rating: 5,
    comment: 'Telugu dub for Rengoku and Tanjiro in Mugen Train arc was emotional masterclass! Amazing dubbing quality.',
    createdAt: '2026-09-18T18:40:00Z',
    likes: 35,
  },
  {
    id: 'rev-4',
    animeId: 'jujutsu-kaisen',
    userId: 'user-ananya',
    userName: 'Ananya S.',
    userAvatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=100&auto=format&fit=crop&q=80',
    language: 'Tamil',
    rating: 4,
    comment: 'Gojo Satoru Tamil dub voice actor nailed the arrogant yet playful attitude. Hollow Purple scene sounds legendary.',
    createdAt: '2026-09-12T11:20:00Z',
    likes: 21,
  },
];

// Initial pending submissions for Admin Moderation Panel demo
const INITIAL_PENDING_SUBMISSIONS: AnimeRecord[] = [
  {
    id: 'sub-dragon-ball-daima',
    title: 'Dragon Ball Daima',
    romajiTitle: 'Dragon Ball Daima',
    nativeTitle: 'ドラゴンボールDAIMA',
    poster: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=600&auto=format&fit=crop&q=80',
    type: 'Series',
    releaseYear: 2024,
    originalReleaseDate: 'October 11, 2024',
    rating: 8.4,
    episodes: 20,
    status: 'Airing',
    submissionStatus: 'pending',
    genres: ['Action', 'Adventure', 'Fantasy', 'Shonen'],
    themes: ['Super Power', 'Martial Arts', 'Grand Adventure'],
    studio: 'Toei Animation',
    synopsis: 'Due to a conspiracy, Goku and his friends are turned small! To fix things, they set off to a new mysterious world for grand martial arts adventures.',
    characters: [
      {
        characterName: 'Goku (Mini)',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Masako Nozawa',
        indianVA: { language: 'Hindi', actor: 'Ankur Javeri' },
      },
      {
        characterName: 'Glorio',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1560972550-aba3456b5564?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kouki Uchiyama',
      },
    ],
    dubs: ['Hindi', 'Tamil'],
    dubDetails: [
      { language: 'Hindi', available: true, platform: ['Crunchyroll', 'Netflix'], notes: 'Confirmed premiere dub' },
      { language: 'Tamil', available: true, platform: ['Crunchyroll'], notes: 'Scheduled weekly' },
    ],
    platforms: [
      { name: 'Crunchyroll', url: 'https://www.crunchyroll.com' },
      { name: 'Netflix', url: 'https://www.netflix.com' },
    ],
    submittedBy: {
      userId: 'user-community-1',
      userName: 'Karthik Sai',
      userEmail: 'karthik@gmail.com',
    },
    submittedAt: '2026-09-29T10:15:00Z',
  },
  {
    id: 'sub-reze-arc',
    title: 'Chainsaw Man – The Movie: Reze Arc',
    romajiTitle: 'Gekijouban Chainsaw Man: Reze-hen',
    nativeTitle: '劇場版 チェンソーマン レゼ篇',
    poster: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    type: 'Movie',
    releaseYear: 2025,
    originalReleaseDate: 'Summer 2025',
    rating: 8.9,
    status: 'Upcoming',
    submissionStatus: 'pending',
    genres: ['Action', 'Supernatural', 'Shonen', 'Romance'],
    themes: ['Dark Fantasy', 'Devil Hunters', 'Tragic Ambition'],
    studio: 'MAPPA',
    synopsis: 'Denji meets a mysterious girl named Reze working at a local coffee shop on a rainy afternoon, unaware she harbors explosive secrets.',
    characters: [
      {
        characterName: 'Reze (Bomb Devil)',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Reina Ueda',
        indianVA: { language: 'Tamil', actor: 'Soundarya M.' },
      },
      {
        characterName: 'Denji',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kikunosuke Toya',
      },
    ],
    dubs: ['Tamil', 'Telugu', 'Hindi'],
    dubDetails: [
      { language: 'Tamil', available: true, platform: ['Crunchyroll'], notes: 'Theatrical and OTT' },
      { language: 'Telugu', available: true, platform: ['Crunchyroll'] },
      { language: 'Hindi', available: true, platform: ['Crunchyroll'] },
    ],
    platforms: [
      { name: 'Crunchyroll', url: 'https://www.crunchyroll.com' },
    ],
    submittedBy: {
      userId: 'user-community-2',
      userName: 'Vignesh V.',
      userEmail: 'vignesh_anime@outlook.com',
    },
    submittedAt: '2026-09-30T07:22:00Z',
  }
];

class DatabaseService {
  private listeners: (() => void)[] = [];

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    try {
      const existing = localStorage.getItem(DB_ANIME_KEY);
      if (!existing) {
        // Seed base approved anime
        const baseApproved = getEnrichedAnimeList().map((a): AnimeRecord => ({
          ...a,
          themes: a.themes || [],
          characters: a.characters || [],
          submissionStatus: 'approved',
          submittedAt: a.addedDate || new Date().toISOString(),
          reviewedBy: 'Admin Moderator',
          reviewedAt: a.addedDate || new Date().toISOString(),
        }));

        // Combine with pending submissions
        const allInitial = [...INITIAL_PENDING_SUBMISSIONS, ...baseApproved];
        localStorage.setItem(DB_ANIME_KEY, JSON.stringify(allInitial));
      }

      if (!localStorage.getItem(DB_REVIEWS_KEY)) {
        localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify(INITIAL_REVIEWS));
      }
    } catch (e) {
      console.error('Database initialization error:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private getAllAnimeRecords(): AnimeRecord[] {
    try {
      const raw = localStorage.getItem(DB_ANIME_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveAnimeRecords(records: AnimeRecord[]) {
    try {
      localStorage.setItem(DB_ANIME_KEY, JSON.stringify(records));
      this.notify();
    } catch (e) {
      console.error('Save anime records error:', e);
    }
  }

  // --- 1. Main public query: ONLY FETCH APPROVED ANIME ---
  public getApprovedAnime(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.submissionStatus === 'approved');
  }

  // --- 2. Admin queries: PENDING & REJECTED ---
  public getPendingSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.submissionStatus === 'pending');
  }

  public getRejectedSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.submissionStatus === 'rejected');
  }

  public getAnimeById(id: string): AnimeRecord | null {
    const all = this.getAllAnimeRecords();
    return all.find((a) => a.id === id) || null;
  }

  // --- 3. User Submission: Saves with status "pending" ---
  public submitDubInfo(data: Omit<AnimeRecord, 'id' | 'submissionStatus' | 'submittedAt'>): AnimeRecord {
    const id = 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newRecord: AnimeRecord = {
      ...data,
      id,
      submissionStatus: 'pending',
      submittedAt: new Date().toISOString(),
    };

    const records = this.getAllAnimeRecords();
    this.saveAnimeRecords([newRecord, ...records]);

    // Send instant Telegram Admin Moderation Alert with inline buttons [Approve] [Reject]
    try {
      import('./telegramService').then(({ telegramService }) => {
        telegramService.sendTelegramModerationAlert(newRecord);
      });
    } catch (e) {
      console.error('Telegram alert trigger error:', e);
    }

    return newRecord;
  }

  // --- 4. Admin Actions: Approve, Edit, Reject ---
  public approveSubmission(id: string, edits?: Partial<AnimeRecord>, reviewerName = 'Admin Moderator'): boolean {
    const records = this.getAllAnimeRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;

    records[index] = {
      ...records[index],
      ...edits,
      submissionStatus: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
    };

    this.saveAnimeRecords(records);

    // Forward/broadcast formatted notification to public Telegram channel
    try {
      import('./telegramService').then(({ telegramService }) => {
        telegramService.broadcastApprovedAnimeToChannel(records[index]);
      });
    } catch (e) {
      console.error('Telegram broadcast trigger error:', e);
    }

    return true;
  }

  public rejectSubmission(id: string, reason: string, reviewerName = 'Admin Moderator'): boolean {
    const records = this.getAllAnimeRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;

    records[index] = {
      ...records[index],
      submissionStatus: 'rejected',
      rejectionReason: reason || 'Information could not be verified from official OTT platforms.',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
    };

    this.saveAnimeRecords(records);
    return true;
  }

  public editSubmission(id: string, edits: Partial<AnimeRecord>): boolean {
    const records = this.getAllAnimeRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;

    records[index] = {
      ...records[index],
      ...edits,
    };

    this.saveAnimeRecords(records);
    return true;
  }

  public deleteSubmission(id: string): boolean {
    const records = this.getAllAnimeRecords();
    const updated = records.filter((r) => r.id !== id);
    this.saveAnimeRecords(updated);
    return true;
  }

  // --- 5. Reviews & Ratings System ---
  public getReviewsForAnime(animeId: string): DubReview[] {
    try {
      const raw = localStorage.getItem(DB_REVIEWS_KEY);
      const all: DubReview[] = raw ? JSON.parse(raw) : [];
      return all
        .filter((r) => r.animeId === animeId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  public addReview(review: Omit<DubReview, 'id' | 'createdAt' | 'likes'>): DubReview {
    const id = 'rev-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newReview: DubReview = {
      ...review,
      id,
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    try {
      const raw = localStorage.getItem(DB_REVIEWS_KEY);
      const all: DubReview[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify([newReview, ...all]));
      this.notify();
    } catch (e) {
      console.error('Error adding review:', e);
    }
    return newReview;
  }

  public likeReview(reviewId: string): void {
    try {
      const raw = localStorage.getItem(DB_REVIEWS_KEY);
      const all: DubReview[] = raw ? JSON.parse(raw) : [];
      const index = all.findIndex((r) => r.id === reviewId);
      if (index !== -1) {
        all[index].likes = (all[index].likes || 0) + 1;
        localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify(all));
        this.notify();
      }
    } catch (e) {
      console.error('Error liking review:', e);
    }
  }

  // --- 6. User Watchlist in Database ---
  public getUserWatchlist(userId: string): WatchlistEntry[] {
    try {
      const raw = localStorage.getItem(DB_WATCHLIST_KEY);
      const all: WatchlistEntry[] = raw ? JSON.parse(raw) : [];
      return all.filter((w) => w.userId === userId);
    } catch {
      return [];
    }
  }

  public toggleWatchlist(userId: string, animeId: string): boolean {
    try {
      const raw = localStorage.getItem(DB_WATCHLIST_KEY);
      let all: WatchlistEntry[] = raw ? JSON.parse(raw) : [];
      const exists = all.some((w) => w.userId === userId && w.animeId === animeId);

      if (exists) {
        all = all.filter((w) => !(w.userId === userId && w.animeId === animeId));
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(all));
        this.notify();
        return false; // Removed
      } else {
        const newEntry: WatchlistEntry = {
          userId,
          animeId,
          status: 'plan_to_watch',
          addedAt: new Date().toISOString(),
        };
        all.push(newEntry);
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(all));
        this.notify();
        return true; // Added
      }
    } catch {
      return false;
    }
  }

  public toggleWatchlistStatus(userId: string, animeId: string): 'plan_to_watch' | 'watched' {
    try {
      const raw = localStorage.getItem(DB_WATCHLIST_KEY);
      const all: WatchlistEntry[] = raw ? JSON.parse(raw) : [];
      const index = all.findIndex((w) => w.userId === userId && w.animeId === animeId);
      if (index !== -1) {
        const nextStatus = all[index].status === 'watched' ? 'plan_to_watch' : 'watched';
        all[index].status = nextStatus;
        if (nextStatus === 'watched') all[index].completedAt = new Date().toISOString();
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(all));
        this.notify();
        return nextStatus;
      }
      return 'plan_to_watch';
    } catch {
      return 'plan_to_watch';
    }
  }

  public removeFromWatchlist(userId: string, animeId: string): void {
    try {
      const raw = localStorage.getItem(DB_WATCHLIST_KEY);
      let all: WatchlistEntry[] = raw ? JSON.parse(raw) : [];
      all = all.filter((w) => !(w.userId === userId && w.animeId === animeId));
      localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(all));
      this.notify();
    } catch (e) {
      console.error('Error removing from watchlist:', e);
    }
  }
}

export const dbService = new DatabaseService();
