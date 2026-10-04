import { AnimeRecord, DubReview, WatchlistEntry, SubmissionStatus } from '../types/database';
import { Anime, DubLanguage } from '../types/anime';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';

const DB_ANIME_KEY = 'anidub_db_anime_records';
const DB_REVIEWS_KEY = 'anidub_db_reviews';
const DB_WATCHLIST_KEY = 'anidub_db_watchlists';
const CLEAN_SLATE_KEY = 'anidub_purged_mock_strict_firebase_v7';

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
    if (typeof window === 'undefined') return;
    try {
      // Completely wipe any legacy dummy/mock placeholder data from localStorage
      if (!localStorage.getItem(CLEAN_SLATE_KEY)) {
        localStorage.setItem(DB_ANIME_KEY, JSON.stringify([]));
        localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify([]));
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify([]));
        localStorage.removeItem('anidub_cached_catalog');
        localStorage.removeItem('anidub_feedback');
        localStorage.setItem(CLEAN_SLATE_KEY, 'true');
      } else {
        const existing = localStorage.getItem(DB_ANIME_KEY);
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            if (Array.isArray(parsed)) {
              // Strictly purge any dummy anime
              const sanitized = parsed.filter((item: any) => {
                if (!item || !item.title || !item.id) return false;
                const title = (item.title || '').trim().toLowerCase();
                const id = (item.id || '').trim().toLowerCase();
                if (title.startsWith('anime submission #') || title.startsWith('dummy anime') || title.startsWith('test anime')) return false;
                if (id.startsWith('sub_test') || id.startsWith('sub_refactor') || id === 'sub-test-1' || id === 'test-jujutsu') return false;
                return true;
              });
              localStorage.setItem(DB_ANIME_KEY, JSON.stringify(sanitized));
            }
          } catch {}
        } else {
          localStorage.setItem(DB_ANIME_KEY, JSON.stringify([]));
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

    const likes = Number(r.likes || r.upvotes || 0);

    return {
      ...r,
      likes,
      upvotes: likes,
      dubs,
      genres,
      themes,
      platforms,
      characters,
      dubDetails,
    };
  }

  public getAllAnimeRecords(): AnimeRecord[] {
    try {
      const raw = localStorage.getItem(DB_ANIME_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item: any) => {
          if (!item || !item.title || !item.id) return false;
          const title = (item.title || '').trim();
          const id = (item.id || '').trim();
          if (title.startsWith('Anime Submission #') || title.startsWith('Dummy Anime') || title.startsWith('Test Anime')) return false;
          if (id.startsWith('sub_test') || id.startsWith('sub_refactor') || id === 'sub-test-1' || id === 'test-jujutsu') return false;
          return true;
        })
        .map((item) => this.normalizeRecord(item));
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
    return all.filter((a) => a.status === 'approved' || (a as any).submissionStatus === 'approved');
  }

  // --- 2. Admin queries: PENDING & REJECTED ---
  public getPendingSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.status === 'pending' || (a as any).submissionStatus === 'pending');
  }

  public getRejectedSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.status === 'rejected' || (a as any).submissionStatus === 'rejected');
  }

  public getAnimeById(id: string): AnimeRecord | null {
    const all = this.getAllAnimeRecords();
    return all.find((a) => a.id === id) || null;
  }

  // --- 3. User Submission: Saves with status "pending" to Firestore ---
  public submitDubInfo(data: Omit<AnimeRecord, 'id' | 'submissionStatus' | 'submittedAt'>): AnimeRecord {
    const id = 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newRecord: AnimeRecord = {
      ...data,
      id,
      status: 'pending',
      submissionStatus: 'pending',
      submittedAt: new Date().toISOString(),
    };

    const records = this.getAllAnimeRecords();
    this.saveAnimeRecords([newRecord, ...records]);

    // Persist directly to Firestore real database
    try {
      setDoc(doc(db, 'submissions', id), newRecord).catch((e) => console.warn('Firestore submissions setDoc error:', e));
      setDoc(doc(db, 'animes', id), newRecord).catch((e) => console.warn('Firestore animes setDoc error:', e));
      setDoc(doc(db, 'activities', `act-${id}`), {
        user: newRecord.submittedBy?.userName || 'Community User',
        action: 'submitted',
        animeTitle: newRecord.title,
        timestamp: new Date(),
        language: newRecord.dubs?.[0] || 'Tamil',
        status: 'pending'
      }).catch(() => {});
    } catch (fsErr) {
      console.warn('Firestore write error in submitDubInfo:', fsErr);
    }

    // Asynchronously notify backend submissions API
    fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord),
    }).catch((e) => console.warn('Sync to /api/submissions failed:', e));

    return newRecord;
  }

  // --- 4. Moderation Actions (Approve/Reject/Delete) ---
  public approveSubmission(id: string, notes?: string, reviewerName: string = 'Admin (prasanth123)'): boolean {
    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => r.id === id);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      status: 'approved',
      submissionStatus: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveAnimeRecords(records);

    // Sync approval to Firestore
    try {
      setDoc(doc(db, 'animes', id), records[targetIndex], { merge: true }).catch(() => {});
      setDoc(doc(db, 'submissions', id), {
        status: 'approved',
        submissionStatus: 'approved',
        reviewedBy: reviewerName,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn('Firestore approval sync error:', e);
    }

    // Notify backend via PUT request
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'approve', reviewer: reviewerName }),
    }).catch((e) => console.warn('Approve PUT request error:', e));

    return true;
  }

  public rejectSubmission(id: string, reason?: string, reviewerName: string = 'Admin (prasanth123)'): boolean {
    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => r.id === id);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      status: 'rejected',
      submissionStatus: 'rejected',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rejectionReason: reason,
    };

    this.saveAnimeRecords(records);

    // Sync rejection to Firestore
    try {
      setDoc(doc(db, 'submissions', id), {
        status: 'rejected',
        submissionStatus: 'rejected',
        reviewedBy: reviewerName,
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn('Firestore rejection sync error:', e);
    }

    // Notify backend via PUT request
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reject', reviewer: reviewerName, reason }),
    }).catch((e) => console.warn('Reject PUT request error:', e));

    return true;
  }

  public updateAnime(id: string, updatedData: Partial<AnimeRecord>): boolean {
    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => r.id === id);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      ...updatedData,
      id: id, // Ensure ID remains same
      updatedAt: new Date().toISOString(),
    };

    this.saveAnimeRecords(records);

    // Sync update to Firestore
    try {
      setDoc(doc(db, 'animes', id), {
        ...updatedData,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn('Firestore update sync error:', e);
    }

    // Notify backend via PUT request
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'update', data: updatedData }),
    }).catch((e) => console.warn('Update PUT request error:', e));

    return true;
  }

  public deleteSubmission(id: string): boolean {
    const records = this.getAllAnimeRecords();
    const filtered = records.filter((r) => r.id !== id);
    this.saveAnimeRecords(filtered);

    // Delete directly from Firestore
    try {
      deleteDoc(doc(db, 'animes', id)).catch(() => {});
      deleteDoc(doc(db, 'anime', id)).catch(() => {});
      deleteDoc(doc(db, 'submissions', id)).catch(() => {});
    } catch (e) {
      console.warn('Firestore delete sync error:', e);
    }

    // Global Auto-Cleanup: Remove deleted anime from the current browser's local watchlists
    try {
      const savedWatchlist = localStorage.getItem(DB_WATCHLIST_KEY);
      if (savedWatchlist) {
        const watchlists: WatchlistEntry[] = JSON.parse(savedWatchlist);
        const filteredWatchlists = watchlists.filter((w) => w.animeId !== id);
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(filteredWatchlists));
      }

      // Also clean up the public local_watchlist key used for guest users
      const publicWatchlist = localStorage.getItem('anidub_local_watchlist');
      if (publicWatchlist) {
        const ids: string[] = JSON.parse(publicWatchlist);
        const filteredIds = ids.filter((watchlistId) => watchlistId !== id);
        localStorage.setItem('anidub_local_watchlist', JSON.stringify(filteredIds));
      }
    } catch (e) {
      console.warn('Watchlist cleanup error after deletion:', e);
    }

    // Notify backend via PUT / DELETE
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'delete' }),
    }).catch((e) => console.warn('Delete PUT request error:', e));

    this.notify();
    return true;
  }

  public async upvoteAnime(id: string): Promise<number> {
    const records = this.getAllAnimeRecords();
    const idx = records.findIndex((r) => r.id === id);
    let newLikes = 1;

    if (idx !== -1) {
      newLikes = Number(records[idx].likes || records[idx].upvotes || 0) + 1;
      records[idx] = {
        ...records[idx],
        likes: newLikes,
        upvotes: newLikes,
      };
      this.saveAnimeRecords(records);
    }

    // Update in Firestore
    try {
      setDoc(doc(db, 'animes', id), { likes: newLikes, upvotes: newLikes }, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn('Firestore upvote error:', e);
    }

    try {
      await fetch('/api/submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'upvote' }),
      });
    } catch (e) {
      console.warn('Upvote PUT request error:', e);
    }

    this.notify();
    return newLikes;
  }

  // --- 5. Server Sync: Strictly syncs from Firestore database ---
  public async syncWithServer(): Promise<void> {
    // Check if browser is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    try {
      // Query real Firestore collections strictly
      const firestoreMap = new Map<string, AnimeRecord>();

      try {
        const animesSnap = await getDocs(collection(db, 'animes'));
        animesSnap.forEach((d) => {
          const item = d.data() as AnimeRecord;
          const normalized = this.normalizeRecord({ ...item, id: d.id });
          if (normalized && normalized.id && normalized.title) {
            firestoreMap.set(normalized.id, normalized);
          }
        });
      } catch (err) {
        console.warn('[AniDub DB] Firestore animes sync notice:', err);
      }

      try {
        const subsSnap = await getDocs(collection(db, 'submissions'));
        subsSnap.forEach((d) => {
          if (!firestoreMap.has(d.id)) {
            const item = d.data() as AnimeRecord;
            const normalized = this.normalizeRecord({ ...item, id: d.id });
            if (normalized && normalized.id && normalized.title) {
              firestoreMap.set(normalized.id, normalized);
            }
          }
        });
      } catch (err) {
        console.warn('[AniDub DB] Firestore submissions sync notice:', err);
      }

      const firestoreList = Array.from(firestoreMap.values());
      // STRICT: Save exactly what is in Firestore to localStorage cache without merging mock data!
      this.saveAnimeRecords(firestoreList);
    } catch (e) {
      console.warn('[AniDub DB] Sync error:', e);
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

      let isAdded = false;
      if (existingIndex > -1) {
        all.splice(existingIndex, 1);
        isAdded = false;
      } else {
        const entry: WatchlistEntry = {
          userId,
          animeId,
          status: 'plan_to_watch',
          addedAt: new Date().toISOString(),
        };
        all.push(entry);
        isAdded = true;
      }
      
      localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(all));
      this.notify();

      // PWA Background Sync: Intercepted by Service Worker
      fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, animeId, action: isAdded ? 'add' : 'remove' }),
      }).catch(err => console.warn('Offline sync queued:', err));

      return isAdded;
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
