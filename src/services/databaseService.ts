import { AnimeRecord, DubReview, WatchlistEntry, SubmissionStatus } from '../types/database';
import { Anime, DubLanguage } from '../types/anime';

const DB_ANIME_KEY = 'anidub_db_anime_records';
const DB_REVIEWS_KEY = 'anidub_db_reviews';
const DB_WATCHLIST_KEY = 'anidub_db_watchlists';
const CLEAN_SLATE_KEY = 'anidub_fresh_empty_slate_v2';

class DatabaseService {
  private listeners: (() => void)[] = [];

  constructor() {
    this.initDatabase();
    this.syncWithServer();

    if (typeof window !== 'undefined') {
      setInterval(() => this.syncWithServer(), 8000);
      window.addEventListener('focus', () => this.syncWithServer());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncWithServer();
        }
      });
    }
  }

  private initDatabase() {
    try {
      // Clear legacy dummy/mock placeholder data to start completely fresh
      if (!localStorage.getItem(CLEAN_SLATE_KEY)) {
        localStorage.setItem(DB_ANIME_KEY, JSON.stringify([]));
        localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify([]));
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify([]));
        localStorage.removeItem('anidub_feedback');
        localStorage.setItem(CLEAN_SLATE_KEY, 'true');
      } else {
        const existing = localStorage.getItem(DB_ANIME_KEY);
        if (!existing) {
          localStorage.setItem(DB_ANIME_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(DB_REVIEWS_KEY)) {
          localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify([]));
        }
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

  private normalizeRecord(r: any): AnimeRecord {
    if (!r) return r;
    const dubs = Array.isArray(r.dubs) ? r.dubs : [];
    const platforms = Array.isArray(r.platforms) ? r.platforms : [];
    const genres = Array.isArray(r.genres) ? r.genres : [];
    const themes = Array.isArray(r.themes) ? r.themes : [];
    const characters = Array.isArray(r.characters) ? r.characters : [];
    const dubDetails = Array.isArray(r.dubDetails)
      ? r.dubDetails.map((d: any) => ({
          ...d,
          platform: Array.isArray(d?.platform) ? d.platform : (d?.platform ? [d.platform] : ['Crunchyroll']),
        }))
      : dubs.map((lang: string) => ({
          language: lang,
          available: true,
          platform: platforms.map((p: any) => p?.name || p),
          notes: `Available in ${lang}`,
        }));

    return {
      ...r,
      dubs,
      genres,
      themes,
      platforms,
      characters,
      dubDetails,
    };
  }

  private getAllAnimeRecords(): AnimeRecord[] {
    try {
      const raw = localStorage.getItem(DB_ANIME_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((item) => this.normalizeRecord(item)) : [];
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

    // Asynchronously sync with backend submissions API
    fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord),
    }).catch((e) => console.warn('Sync to /api/submissions failed:', e));

    return newRecord;
  }

  // --- 4. Moderation Actions (Approve/Reject) ---
  public approveSubmission(id: string, notes?: string, reviewerName: string = 'Telegram Admin Bot'): boolean {
    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => r.id === id);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      submissionStatus: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
    };

    this.saveAnimeRecords(records);

    // Notify backend
    fetch('/api/submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'approve', reviewer: reviewerName }),
    }).catch(() => {});

    return true;
  }

  public rejectSubmission(id: string, reason?: string, reviewerName: string = 'Telegram Admin Bot'): boolean {
    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => r.id === id);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      submissionStatus: 'rejected',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
    };

    this.saveAnimeRecords(records);

    // Notify backend
    fetch('/api/submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reject', reviewer: reviewerName, reason }),
    }).catch(() => {});

    return true;
  }

  // --- 5. Server Sync: Pulls updates approved via Telegram Webhook ---
  public async syncWithServer(): Promise<void> {
    try {
      const res = await fetch(`/api/submissions?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return;

      const serverList: AnimeRecord[] = json.data;
      const localList = this.getAllAnimeRecords();
      let hasChanges = false;
      const merged = [...localList];

      for (const serverItem of serverList) {
        const normalized = this.normalizeRecord(serverItem);
        const localIdx = merged.findIndex((l) => l.id === normalized.id);
        if (localIdx !== -1) {
          if (
            merged[localIdx].submissionStatus !== normalized.submissionStatus ||
            merged[localIdx].status !== normalized.status
          ) {
            merged[localIdx] = {
              ...merged[localIdx],
              ...normalized,
              submissionStatus: normalized.submissionStatus,
              status: normalized.submissionStatus === 'approved' ? 'Ongoing' : merged[localIdx].status,
              reviewedBy: normalized.reviewedBy || merged[localIdx].reviewedBy,
              reviewedAt: normalized.reviewedAt || merged[localIdx].reviewedAt,
            };
            hasChanges = true;
          }
        } else {
          // New submission approved or stored on server
          merged.unshift(normalized);
          hasChanges = true;
        }
      }

      if (hasChanges || (serverList.length > 0 && localList.length === 0)) {
        this.saveAnimeRecords(merged);
      }
    } catch (e) {
      console.warn('Sync with server error:', e);
    }
  }

  public async forceRefresh(): Promise<AnimeRecord[]> {
    await this.syncWithServer();
    return this.getApprovedAnime();
  }

  // --- 5. Dub Reviews Management ---
  public getReviewsForAnime(animeId: string): DubReview[] {
    try {
      const raw = localStorage.getItem(DB_REVIEWS_KEY);
      const all: DubReview[] = raw ? JSON.parse(raw) : [];
      return all.filter((r) => r.animeId === animeId);
    } catch {
      return [];
    }
  }

  public addReview(reviewData: Omit<DubReview, 'id' | 'createdAt' | 'likes'>): DubReview {
    const newReview: DubReview = {
      ...reviewData,
      id: 'rev-' + Date.now().toString(36),
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
      let all: DubReview[] = raw ? JSON.parse(raw) : [];
      all = all.map((r) => (r.id === reviewId ? { ...r, likes: r.likes + 1 } : r));
      localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify(all));
      this.notify();
    } catch (e) {
      console.error('Error liking review:', e);
    }
  }

  // --- 6. User Watchlist Persistence ---
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
      const existingIndex = all.findIndex((w) => w.userId === userId && w.animeId === animeId);

      if (existingIndex > -1) {
        all.splice(existingIndex, 1);
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(all));
        this.notify();
        return false;
      } else {
        const entry: WatchlistEntry = {
          userId,
          animeId,
          status: 'plan_to_watch',
          addedAt: new Date().toISOString(),
        };
        all.push(entry);
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(all));
        this.notify();
        return true;
      }
    } catch {
      return false;
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

  public toggleWatchlistStatus(userId: string, animeId: string): 'watched' | 'plan_to_watch' {
    try {
      const raw = localStorage.getItem(DB_WATCHLIST_KEY);
      let all: WatchlistEntry[] = raw ? JSON.parse(raw) : [];
      const entry = all.find((w) => w.userId === userId && w.animeId === animeId);

      if (entry) {
        entry.status = entry.status === 'watched' ? 'plan_to_watch' : 'watched';
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(all));
        this.notify();
        return entry.status;
      }
      return 'plan_to_watch';
    } catch {
      return 'plan_to_watch';
    }
  }

  // --- Helper to wipe and start completely fresh anytime ---
  public resetToEmptySlate(): void {
    localStorage.setItem(DB_ANIME_KEY, JSON.stringify([]));
    localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify([]));
    localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify([]));
    this.notify();
  }
}

export const dbService = new DatabaseService();
