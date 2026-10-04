import { AnimeRecord, DubReview, WatchlistEntry, SubmissionStatus } from '../types/database';
import { Anime, DubLanguage } from '../types/anime';
import { db } from '../lib/firebase';
import { authService } from './authService';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  onSnapshot
} from 'firebase/firestore';

const DB_ANIME_KEY = 'anidub_db_anime_records';
const DB_REVIEWS_KEY = 'anidub_db_reviews';
const DB_WATCHLIST_KEY = 'anidub_db_watchlists';
const CLEAN_SLATE_KEY = 'anidub_purged_mock_strict_firebase_v7';
const QUOTA_EXCEEDED_KEY = 'anidub_firestore_quota_exceeded_timestamp';
const LAST_SYNC_KEY = 'anidub_db_last_sync_timestamp';

class DatabaseService {
  private listeners: (() => void)[] = [];
  private isQuotaLimited = false;

  constructor() {
    this.initDatabase();
    this.checkQuotaStatus();
    this.startRealtimeSync();
  }

  private startRealtimeSync() {
    if (this.isQuotaLimited || typeof window === 'undefined') return;

    try {
      const collections = ['animes', 'anime', 'submissions'];
      
      collections.forEach(collName => {
        onSnapshot(collection(db, collName), (snapshot) => {
          const currentRecords = this.getAllAnimeRecords();
          const firestoreMap = new Map<string, AnimeRecord>();
          
          // Seed map with current records to preserve other collections' data
          currentRecords.forEach(r => firestoreMap.set(r.id, r));

          snapshot.docs.forEach(d => {
            const data = d.data();
            const normalized = this.normalizeRecord({ ...data, id: d.id });
            
            if (normalized && normalized.id && normalized.title) {
              // If it's from main 'animes' or 'anime' collection and lacks status, treat as approved
              // This handles legacy data or direct uploads without explicit status fields
              if ((collName === 'animes' || collName === 'anime') && 
                  (!data.status || data.status === 'pending') && 
                  (!data.submissionStatus || data.submissionStatus === 'pending')) {
                normalized.status = 'approved';
                normalized.submissionStatus = 'approved';
              }
              
              firestoreMap.set(normalized.id, normalized);
            }
          });

          const updatedList = Array.from(firestoreMap.values());
          this.saveAnimeRecords(updatedList);
          localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
        }, (err) => {
          if (this.isQuotaExceededError(err)) {
            this.setQuotaExceeded();
          }
          console.warn(`[AniDub DB] Real-time sync error for ${collName}:`, err);
        });
      });
    } catch (e) {
      console.warn('[AniDub DB] Failed to start real-time sync:', e);
    }
  }

  private checkQuotaStatus() {
    if (typeof window === 'undefined') return;
    const quotaTimestamp = localStorage.getItem(QUOTA_EXCEEDED_KEY);
    if (quotaTimestamp) {
      const hoursSinceExceeded = (Date.now() - Number(quotaTimestamp)) / (1000 * 60 * 60);
      // Reset quota status after 24 hours
      if (hoursSinceExceeded < 24) {
        this.isQuotaLimited = true;
      } else {
        localStorage.removeItem(QUOTA_EXCEEDED_KEY);
        this.isQuotaLimited = false;
      }
    }
  }

  private shouldSync(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.isQuotaLimited) return false;
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    if (!lastSync) return true;
    
    // Only auto-sync if data is older than 12 hours (was 4)
    const hoursSinceSync = (Date.now() - Number(lastSync)) / (1000 * 60 * 60);
    return hoursSinceSync > 12;
  }

  private setQuotaExceeded() {
    this.isQuotaLimited = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUOTA_EXCEEDED_KEY, Date.now().toString());
    }
  }

  private isQuotaExceededError(err: any): boolean {
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes('quota limit exceeded') || msg.includes('quota exceeded');
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
              // Ensure all cached records are normalized but don't strictly purge titles
              const normalized = parsed
                .filter((item: any) => item && (item.id || item.title || item.name))
                .map((item) => this.normalizeRecord(item));
              localStorage.setItem(DB_ANIME_KEY, JSON.stringify(normalized));
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

  private normalizeRecord(data: any): AnimeRecord {
    if (!data) return data;
    
    // Extract languages/dubs safely (Sync with AdminDashboard logic)
    let rawDubs: any[] = [];
    if (Array.isArray(data?.dubs)) {
      rawDubs = data.dubs;
    } else if (Array.isArray(data?.languages)) {
      rawDubs = data.languages;
    } else if (Array.isArray(data?.dubLanguages)) {
      rawDubs = data.dubLanguages;
    } else if (Array.isArray(data?.dubDetails)) {
      rawDubs = data.dubDetails.map((d: any) => d?.language || d);
    } else if (typeof data?.dub === 'string' && data.dub.trim()) {
      rawDubs = [data.dub.trim()];
    } else if (typeof data?.language === 'string' && data.language.trim()) {
      rawDubs = [data.language.trim()];
    }

    const dubs: string[] = rawDubs
      .map((d: any) => (typeof d === 'string' ? d.trim() : (d?.name || d?.language || '')))
      .filter(Boolean);

    const likes = Number(data?.likes || data?.upvotes || data?.votes || 0);
    const platforms = Array.isArray(data?.platforms) ? data.platforms : ['Crunchyroll'];

    const normalized: AnimeRecord = {
      ...data,
      id: data.id,
      title: (data?.title || data?.name || 'Untitled Anime').trim(),
      romajiTitle: (data?.romajiTitle || data?.japaneseTitle || '').trim(),
      poster: data?.poster || data?.image || data?.cover || '',
      banner: data?.banner || data?.bannerImage || '',
      studio: data?.studio || 'Animation Studio',
      synopsis: data?.synopsis || data?.description || '',
      type: data?.type || 'TV Series',
      episodes: Number(data?.episodes) || 12,
      status: data?.status || data?.submissionStatus || 'pending',
      submissionStatus: data?.submissionStatus || data?.status || 'pending',
      releaseYear: Number(data?.releaseYear) || Number(data?.year) || new Date().getFullYear(),
      rating: data?.rating || data?.score || 8.0,
      genres: Array.isArray(data?.genres) ? data.genres : [],
      themes: Array.isArray(data?.themes) ? data.themes : [],
      dubs: dubs as any,
      dubDetails: Array.isArray(data?.dubDetails)
        ? data.dubDetails.map((d: any) => ({
            ...d,
            platform: Array.isArray(d?.platform) ? d.platform : (d?.platform ? [d.platform] : platforms),
          }))
        : dubs.map((lang: string) => ({
            language: lang as any,
            available: true,
            platform: platforms,
            notes: `Available in ${lang}`,
          })),
      platforms,
      characters: Array.isArray(data?.characters) ? data.characters : [],
      likes,
      upvotes: likes,
    };

    return normalized;
  }

  public getAllAnimeRecords(): AnimeRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(DB_ANIME_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      
      // Removed strict title filtering to ensure real data is not blocked
      return parsed
        .filter((item: any) => item && (item.id || item.title || item.name))
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
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized approveSubmission write blocked for id:', id);
      return false;
    }

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
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized rejectSubmission write blocked for id:', id);
      return false;
    }

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
    // CRITICAL SECURITY CHECK: Only authenticated Admins can update anime records
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized updateAnime write blocked for id:', id);
      return false;
    }

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
      setDoc(doc(db, 'anime', id), {
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
    // CRITICAL SECURITY CHECK: Only authenticated Admins can delete anime records
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized deleteSubmission write blocked for id:', id);
      return false;
    }

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
    // Check if browser is offline or quota limited
    if (this.isQuotaLimited || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return;
    }

    try {
      // Query real Firestore collections strictly
      const firestoreMap = new Map<string, AnimeRecord>();
      const collections = ['animes', 'anime', 'submissions'];

      for (const collName of collections) {
        try {
          const snap = await getDocs(collection(db, collName));
          snap.forEach((d) => {
            const data = d.data();
            const normalized = this.normalizeRecord({ ...data, id: d.id });
            
            if (normalized && normalized.id && normalized.title) {
              // If it's from main 'animes' or 'anime' collection and lacks status, treat as approved
              if ((collName === 'animes' || collName === 'anime') && 
                  (!data.status || data.status === 'pending') && 
                  (!data.submissionStatus || data.submissionStatus === 'pending')) {
                normalized.status = 'approved';
                normalized.submissionStatus = 'approved';
              }
              
              if (!firestoreMap.has(normalized.id)) {
                firestoreMap.set(normalized.id, normalized);
              }
            }
          });
        } catch (err) {
          if (this.isQuotaExceededError(err)) {
            this.setQuotaExceeded();
            return; 
          }
          console.warn(`[AniDub DB] Firestore ${collName} sync notice:`, err);
        }
      }

      const firestoreList = Array.from(firestoreMap.values());
      this.saveAnimeRecords(firestoreList);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      }
    } catch (e) {
      console.warn('[AniDub DB] Sync error:', e);
    }
  }

  public async forceRefresh(): Promise<AnimeRecord[]> {
    this.isQuotaLimited = false; // Try resetting on force refresh
    if (typeof window !== 'undefined') {
      localStorage.removeItem(QUOTA_EXCEEDED_KEY);
    }
    await this.syncWithServer();
    return this.getApprovedAnime();
  }

  public getIsQuotaLimited(): boolean {
    return this.isQuotaLimited;
  }

  // --- 5. Dub Reviews Management ---
  public getReviewsForAnime(animeId: string): DubReview[] {
    if (typeof window === 'undefined') return [];
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
    if (typeof window === 'undefined') return [];
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
