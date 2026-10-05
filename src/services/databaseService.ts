import { AnimeRecord, DubReview, WatchlistEntry, SubmissionStatus, StreamingPlatform } from '../types/database';
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
const QUOTA_EXCEEDED_KEY = 'anidub_firestore_quota_exceeded_timestamp';
const LAST_SYNC_KEY = 'anidub_db_last_sync_timestamp';

class DatabaseService {
  private listeners: (() => void)[] = [];
  private isQuotaLimited = false;

  constructor() {
    this.initDatabase();
    this.checkQuotaStatus();
    
    // Auto-sync on load only if data is stale (> 12 hours)
    if (this.shouldSync()) {
      this.syncWithServer();
    }
  }

  /**
   * Starts real-time listeners for essential collections only.
   * Optimized to avoid hitting Firestore quotas.
   */
  public startRealtimeSync() {
    if (this.isQuotaLimited || typeof window === 'undefined') return;
    if (this.listeners.length > 0) return; // Already active

    try {
      // Optimized: Only listen to the main catalog and submissions
      // Other collections like 'anime', 'titles' are likely redundant for real-time updates
      const essentialCollections = ['animes', 'submissions'];
      
      essentialCollections.forEach(collName => {
        const unsub = onSnapshot(collection(db, collName), (snapshot) => {
          const currentRecords = this.getAllAnimeRecords();
          const firestoreMap = new Map<string, AnimeRecord>();
          
          // Seed map with current records to preserve data from other collections
          currentRecords.forEach(r => firestoreMap.set(r.id, r));

          let changed = false;
          snapshot.docChanges().forEach(change => {
            const data = change.doc.data();
            if (change.type === 'removed') {
              if (firestoreMap.has(change.doc.id)) {
                firestoreMap.delete(change.doc.id);
                changed = true;
              }
            } else {
              const normalized = this.normalizeRecord({ ...data, id: change.doc.id });
              if (normalized && normalized.id && normalized.title) {
                // Auto-approve logic for live data
                if (data.status !== 'rejected' && data.submissionStatus !== 'rejected') {
                  normalized.status = 'approved';
                  normalized.submissionStatus = 'approved';
                }
                firestoreMap.set(normalized.id, normalized);
                changed = true;
              }
            }
          });

          if (changed || snapshot.docs.length === 0) {
            const updatedList = Array.from(firestoreMap.values());
            this.saveAnimeRecords(updatedList);
            localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
          }
        }, (err) => {
          if (this.isQuotaExceededError(err)) {
            const isQuota = !String(err?.code || '').toLowerCase().includes('unavailable');
            this.setQuotaExceeded(isQuota);
            this.stopRealtimeSync();
          } else {
            console.warn(`[AniDub DB] Real-time sync error for ${collName}:`, err);
          }
        });
        this.listeners.push(unsub);
      });
    } catch (e) {
      console.warn('[AniDub DB] Failed to start real-time sync:', e);
    }
  }

  /**
   * Stop all active Firestore listeners
   */
  public stopRealtimeSync() {
    this.listeners.forEach(unsub => {
      try {
        unsub();
      } catch {}
    });
    this.listeners = [];
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

  private async setQuotaExceeded(isQuota = true) {
    if (this.isQuotaLimited) return; // Avoid duplicate alerts
    
    this.isQuotaLimited = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUOTA_EXCEEDED_KEY, Date.now().toString());
    }
    this.notify();

    // Silent background Telegram Alert to Admin
    try {
      const message = isQuota 
        ? '⚠️ Admin Alert: Firestore Quota Reached for today! App is now using cached data.'
        : '⚠️ Admin Alert: Firestore backend is currently UNAVAILABLE (Network/Service). App is using cached data.';
      
      fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          title: isQuota ? 'Firestore Quota Reached' : 'Firestore Unavailable',
        }),
      }).catch(() => {});
    } catch (e) {
      // Complete silence
    }
  }

  private isQuotaExceededError(err: any): boolean {
    const msg = String(err?.message || err || '').toLowerCase();
    const code = String(err?.code || '').toLowerCase();
    return (
      msg.includes('quota limit exceeded') || 
      msg.includes('quota exceeded') || 
      code === 'resource-exhausted' ||
      code.includes('quota') ||
      code === 'unavailable' ||
      msg.includes('could not reach cloud firestore backend')
    );
  }

  private initDatabase() {
    if (typeof window === 'undefined') return;
    try {
      // Ensure the keys exist in localStorage without clearing them
      if (!localStorage.getItem(DB_ANIME_KEY)) {
        localStorage.setItem(DB_ANIME_KEY, JSON.stringify([]));
      }
      if (!localStorage.getItem(DB_REVIEWS_KEY)) {
        localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify([]));
      }
      if (!localStorage.getItem(DB_WATCHLIST_KEY)) {
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify([]));
      }
      
      const existing = localStorage.getItem(DB_ANIME_KEY);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Re-normalize existing records to keep them up to date with schema changes
            const normalized = parsed
              .filter((item: any) => item && (item.id || item.title || item.name))
              .map((item) => this.normalizeRecord(item));
            localStorage.setItem(DB_ANIME_KEY, JSON.stringify(normalized));
          }
        } catch (e) {
          console.warn('Cache migration warning:', e);
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
    const rawPlatforms = Array.isArray(data?.platforms) ? data.platforms : ['Crunchyroll'];
    const platforms: { name: StreamingPlatform; url: string }[] = rawPlatforms.map((p: any) => {
      if (typeof p === 'string') {
        return { name: p as StreamingPlatform, url: 'https://crunchyroll.com' };
      }
      return {
        name: (p.name || p.platform || 'Crunchyroll') as StreamingPlatform,
        url: p.url || 'https://crunchyroll.com',
      };
    });

    // Robust title extraction
    const title = (
      data?.title || 
      data?.name || 
      data?.animeTitle || 
      data?.anime_title || 
      data?.title_en || 
      data?.englishTitle || 
      'Untitled Anime'
    ).trim();

    const normalized: AnimeRecord = {
      ...data,
      id: data.id,
      title,
      romajiTitle: (data?.romajiTitle || data?.japaneseTitle || data?.title_jp || '').trim(),
      poster: data?.poster || data?.image || data?.cover || data?.posterImage || '',
      banner: data?.banner || data?.bannerImage || data?.coverImage || '',
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
            platform: Array.isArray(d?.platform) 
              ? d.platform 
              : (d?.platform ? [d.platform] : platforms.map(p => p.name)),
          }))
        : dubs.map((lang: string) => ({
            language: lang as any,
            available: true,
            platform: platforms.map(p => p.name),
            notes: `Available in ${lang}`,
          })),
      platforms,
      characters: Array.isArray(data?.characters) ? data.characters : [],
      likes,
      upvotes: likes,
      createdAt: data?.createdAt || data?.submittedAt || new Date().toISOString(),
      updatedAt: data?.updatedAt || data?.submittedAt || new Date().toISOString(),
    };

    return normalized;
  }

  public getAllAnimeRecords(): AnimeRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(DB_ANIME_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      
      return parsed
        .filter((item: any) => item && (item.id || item.title || item.name))
        .map((item) => this.normalizeRecord(item));
    } catch {
      return [];
    }
  }

  private saveAnimeRecords(records: AnimeRecord[]) {
    try {
      // 100% DATA SAFETY: Never overwrite existing cache with an empty array during sync
      const current = this.getAllAnimeRecords();
      if (records.length === 0 && current.length > 0) {
        console.warn('[AniDub DB] Safety Block: Prevented overwriting cache with empty data.');
        return;
      }
      
      localStorage.setItem(DB_ANIME_KEY, JSON.stringify(records));
      this.notify();
    } catch (e) {
      console.error('Save anime records error:', e);
    }
  }

  // --- 1. Main public query: ONLY FETCH APPROVED ANIME ---
  public getApprovedAnime(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => (a.status === 'approved' || (a as any).submissionStatus === 'approved') && !a.isDeleted);
  }

  // --- 2. Admin queries: PENDING, REJECTED & DELETED ---
  public getPendingSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => (a.status === 'pending' || (a as any).submissionStatus === 'pending') && !a.isDeleted);
  }

  public getRejectedSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => (a.status === 'rejected' || (a as any).submissionStatus === 'rejected') && !a.isDeleted);
  }

  public getDeletedSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.isDeleted === true);
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
    // Soft Delete Implementation
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized deleteSubmission write blocked for id:', id);
      return false;
    }

    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => r.id === id);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };

    this.saveAnimeRecords(records);

    // Sync soft delete to Firestore
    try {
      const update = { isDeleted: true, updatedAt: new Date().toISOString() };
      setDoc(doc(db, 'animes', id), update, { merge: true }).catch(() => {});
      setDoc(doc(db, 'submissions', id), update, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn('Firestore soft delete sync error:', e);
    }

    this.notify();
    return true;
  }

  public restoreSubmission(id: string): boolean {
    if (!authService.isAdmin()) return false;

    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => r.id === id);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      isDeleted: false,
      updatedAt: new Date().toISOString(),
    };

    this.saveAnimeRecords(records);

    try {
      const update = { isDeleted: false, updatedAt: new Date().toISOString() };
      setDoc(doc(db, 'animes', id), update, { merge: true }).catch(() => {});
      setDoc(doc(db, 'submissions', id), update, { merge: true }).catch(() => {});
    } catch {}

    this.notify();
    return true;
  }

  public permanentlyDeleteSubmission(id: string): boolean {
    // CRITICAL SECURITY CHECK: Only authenticated Admins can delete anime records
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized permanent delete write blocked for id:', id);
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
      console.warn('Firestore permanent delete sync error:', e);
    }

    // Global Auto-Cleanup: Remove deleted anime from the current browser's local watchlists
    try {
      const savedWatchlist = localStorage.getItem(DB_WATCHLIST_KEY);
      if (savedWatchlist) {
        const watchlists: WatchlistEntry[] = JSON.parse(savedWatchlist);
        const filteredWatchlists = watchlists.filter((w) => w.animeId !== id);
        localStorage.setItem(DB_WATCHLIST_KEY, JSON.stringify(filteredWatchlists));
      }

      const publicWatchlist = localStorage.getItem('anidub_local_watchlist');
      if (publicWatchlist) {
        const ids: string[] = JSON.parse(publicWatchlist);
        const filteredIds = ids.filter((watchlistId) => watchlistId !== id);
        localStorage.setItem('anidub_local_watchlist', JSON.stringify(filteredIds));
      }
    } catch (e) {
      console.warn('Watchlist cleanup error after deletion:', e);
    }

    // Notify backend
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'delete' }),
    }).catch((e) => console.warn('Delete PUT request error:', e));

    this.notify();
    return true;
  }

  // --- 5. Data Management: Backup & Bulk Import ---
  public exportBackup() {
    const data = this.getAllAnimeRecords();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anidub_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public async bulkImportAnime(jsonData: any[]): Promise<{ success: number; failed: number }> {
    if (!authService.isAdmin() || !Array.isArray(jsonData)) return { success: 0, failed: 0 };
    
    let successCount = 0;
    let failedCount = 0;
    const currentRecords = this.getAllAnimeRecords();
    const newRecords: AnimeRecord[] = [];
    const importPromises: Promise<void>[] = [];

    for (const item of jsonData) {
      try {
        const id = item.id || ('sub-' + Math.random().toString(36).substring(2, 9));
        const normalized = this.normalizeRecord({ 
          ...item, 
          id,
          submittedAt: item.submittedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: item.status || 'approved',
          submissionStatus: item.submissionStatus || 'approved'
        });
        
        if (normalized && normalized.title) {
          newRecords.push(normalized);
          // Directly upload to multiple collections for redundancy as required
          const collections = ['animes', 'anime', 'submissions'];
          collections.forEach(coll => {
            importPromises.push(setDoc(doc(db, coll, id), normalized, { merge: true }));
          });
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error('[Bulk Import Item Error]', err);
        failedCount++;
      }
    }

    // Wait for all Firestore writes to complete
    if (importPromises.length > 0) {
      await Promise.allSettled(importPromises);
    }

    if (newRecords.length > 0) {
      // Merge with existing, avoiding duplicates by ID
      const recordMap = new Map<string, AnimeRecord>();
      currentRecords.forEach(r => recordMap.set(r.id, r));
      newRecords.forEach(r => recordMap.set(r.id, r));
      this.saveAnimeRecords(Array.from(recordMap.values()));
    }

    return { success: successCount, failed: failedCount };
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

  // --- 5. Server Sync: Optimized to reduce reads ---
  public async syncWithServer(): Promise<void> {
    // Check if browser is offline or quota limited
    if (this.isQuotaLimited || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return;
    }

    try {
      const firestoreMap = new Map<string, AnimeRecord>();
      // Optimized: prioritize the main catalog
      const primaryCollections = ['animes', 'submissions'];
      
      // If we are completely empty, we might want to check more legacy names once
      const current = this.getAllAnimeRecords();
      const checkLegacy = current.length === 0;
      const collections = checkLegacy 
        ? ['animes', 'submissions', 'anime', 'anime_records'] 
        : primaryCollections;

      for (const collName of collections) {
        try {
          const snap = await getDocs(collection(db, collName));
          snap.forEach((d) => {
            const data = d.data();
            const normalized = this.normalizeRecord({ ...data, id: d.id });
            
            if (normalized && normalized.id && normalized.title) {
              if (data.status !== 'rejected' && data.submissionStatus !== 'rejected') {
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
            const isQuota = !String(err?.code || '').toLowerCase().includes('unavailable');
            this.setQuotaExceeded(isQuota);
            return; 
          }
        }
      }

      if (firestoreMap.size > 0) {
        const firestoreList = Array.from(firestoreMap.values());
        this.saveAnimeRecords(firestoreList);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
        }
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

  public getAverageRatingForAnime(animeId: string): number {
    const reviews = this.getReviewsForAnime(animeId);
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return Number((sum / reviews.length).toFixed(1));
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
}

export const dbService = new DatabaseService();
