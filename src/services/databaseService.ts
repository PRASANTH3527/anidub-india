import { AnimeRecord, DubReview, WatchlistEntry, SubmissionStatus, StreamingPlatform, AnimeCollection } from '../types/database';
import { Anime, DubLanguage } from '../types/anime';
import { db, rtdb } from '../lib/firebase';
import { ref, set, get as rtdbGet, remove, child, update } from 'firebase/database';
import { authService } from './authService';
import { get, set as idbSet, del, clear } from 'idb-keyval';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

const DB_ANIME_KEY = 'anidub_db_anime_records';
const DB_REVIEWS_KEY = 'anidub_db_reviews';
const DB_WATCHLIST_KEY = 'anidub_db_watchlists';
const DB_COLLECTIONS_KEY = 'anidub_db_collections';
const QUOTA_EXCEEDED_KEY = 'anidub_firestore_quota_exceeded_timestamp';
const LAST_SYNC_KEY = 'anidub_db_last_sync_timestamp';

export const ADMIN_PENDING_UPLOADS_KEY = 'admin_pending_uploads';
export const USER_PENDING_SUBMISSIONS_KEY = 'user_pending_submissions';

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  const name = String(err.name || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code === 'quota-exceeded' ||
    msg.includes('resource-exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    name.includes('quota')
  );
}

// --- TELEGRAM NOTIFICATION CONFIG ---
const TELEGRAM_BOT_TOKEN = '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc'; 
const TELEGRAM_CHAT_ID = '8769442354'; // ENTER YOUR CHANNEL ID HERE (e.g. @mychannel or -100...)

class DatabaseService {
  private listeners: (() => void)[] = [];
  private isQuotaLimited = false;
  private animeRecords: AnimeRecord[] = [];
  private isInitialized = false;

  constructor() {
    this.initDatabase();
    this.checkQuotaStatus();
    
    // Auto-sync on load only if data is stale (> 12 hours)
    if (this.shouldSync()) {
      this.syncWithServer();
    }
  }

  /**
   * DISABLED: No longer using real-time listeners to prevent quota exhaustion.
   * Manual refresh in Admin Panel is the preferred way now.
   */
  public startRealtimeSync() {
    // Disabled as per optimization requirement
  }

  /**
   * DISABLED
   */
  public stopRealtimeSync() {
    // Disabled as per optimization requirement
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

  private async initDatabase() {
    if (typeof window === 'undefined') return;
    try {
      // 1. Load from IndexedDB (Priority)
      const idbData = await get(DB_ANIME_KEY);
      if (idbData && Array.isArray(idbData)) {
        this.animeRecords = idbData.map(item => this.normalizeRecord(item));
        console.log(`[AniDub DB] Loaded ${this.animeRecords.length} records from IndexedDB.`);
      } else {
        // 2. Migration: Load from Legacy localStorage if IDB is empty
        const legacyData = localStorage.getItem(DB_ANIME_KEY);
        if (legacyData) {
          try {
            const parsed = JSON.parse(legacyData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.animeRecords = parsed.map(item => this.normalizeRecord(item));
              console.log(`[AniDub DB] Migrated ${this.animeRecords.length} records from localStorage to IndexedDB.`);
              // Persist to IDB and clear legacy
              await idbSet(DB_ANIME_KEY, this.animeRecords);
              localStorage.removeItem(DB_ANIME_KEY);
            }
          } catch (e) {
            console.warn('[AniDub DB] Migration failed:', e);
          }
        }
      }

      this.isInitialized = true;
      this.notify();
    } catch (e) {
      console.error('Database initialization error:', e);
    }
  }

  public getAllAnimeRecords(): AnimeRecord[] {
    return this.animeRecords;
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

  public normalizeRecord(data: any): AnimeRecord {
    if (!data) return data;
    
    // STRICT Mapping for Language Codes to UI Names
    const langCodeToFull: Record<string, DubLanguage> = {
      'Ta': 'Tamil',
      'Te': 'Telugu',
      'Hi': 'Hindi',
      'Ma': 'Malayalam',
      'Ka': 'Kannada',
      'Be': 'Bengali',
      'Tamil': 'Tamil',
      'Telugu': 'Telugu',
      'Hindi': 'Hindi',
      'Malayalam': 'Malayalam',
      'Kannada': 'Kannada',
      'Bengali': 'Bengali'
    };

    const mapLangs = (langs: any): DubLanguage[] => {
      if (!Array.isArray(langs)) return [];
      return langs
        .map(l => (typeof l === 'string' ? langCodeToFull[l] || l : (l?.name || l?.language || '')))
        .filter(Boolean) as DubLanguage[];
    };

    // Extract Top-Level Dubs
    const dubs = mapLangs(data.dubs || data.languages || data.availableIn || []);

    // STRICT Seasons (mixedEntries) Mapping
    let seasonDetails: any[] = [];
    const rawSeasons = data.seasons || data.mixedEntries || data.seasonDetails || [];
    if (Array.isArray(rawSeasons)) {
      seasonDetails = rawSeasons.map((s: any) => ({
        type: s.type || 'Season',
        label: String(s.seasonNumber || s.number || s.label || '1'),
        episodeCount: Number(s.episodes || s.episodeCount || 12),
        languages: mapLangs(s.availableIn || s.languages || dubs)
      }));
    } else {
      // Default fallback if no seasons array found
      seasonDetails = [{ 
        type: 'Season', 
        label: '1', 
        episodeCount: Number(data.episodes) || 12, 
        languages: dubs.length > 0 ? dubs : ['Tamil'] 
      }];
    }

    // Status Mapping: "Ongoing" -> "Ongoing" (UI handles display as "Ongoing (Simulcast)")
    let airingStatus: 'Ongoing' | 'Completed' = 'Completed';
    // Prioritize airingStatus field, fallback to status if it's not a moderation state
    const statusVal = String(data.status || '').toLowerCase();
    const isModerationStatus = ['pending', 'approved', 'rejected'].includes(statusVal);
    const rawAiringStatus = String(data.airingStatus || (!isModerationStatus ? data.status : '') || '').toLowerCase();

    if (rawAiringStatus.includes('ongoing') || rawAiringStatus.includes('airing') || rawAiringStatus.includes('simulcast')) {
      airingStatus = 'Ongoing';
    } else if (rawAiringStatus.includes('completed') || rawAiringStatus.includes('finished')) {
      airingStatus = 'Completed';
    }

    const title = (data.title || data.name || 'Untitled').trim();

    const rawPlatforms = Array.isArray(data.platforms) 
      ? data.platforms 
      : (Array.isArray(data.streamingPartners) ? data.streamingPartners : []);

    const normalized: AnimeRecord = {
      ...data,
      id: data.id,
      title,
      romajiTitle: (data.romajiTitle || data.japaneseTitle || '').trim(),
      poster: data.poster || data.image || '',
      banner: data.banner || data.coverImage || '',
      studio: data.studio || data.animationStudio || 'Animation Studio',
      synopsis: data.synopsis || data.description || '',
      type: data.type || 'TV Series',
      episodes: Number(data.episodes) || 12,
      status: data.status || 'pending', // Moderation status
      airingStatus, // Actual show status (Ongoing/Completed)
      submissionStatus: data.submissionStatus || 'pending',
      releaseYear: Number(data.releaseYear || data.year) || new Date().getFullYear(),
      rating: Number(data.rating || data.score) || 8.0,
      genres: Array.isArray(data.genres) ? data.genres : [],
      dubs,
      seasonDetails,
      mixedEntries: seasonDetails, // Redundant field for strict JSON support if needed
      platforms: rawPlatforms.length > 0 ? rawPlatforms.map((p: any) => ({
        name: (p.name || p.platform || p) as StreamingPlatform,
        url: p.url || '#',
        languages: mapLangs(p.languages || p.availableIn || dubs)
      })) : [{ name: 'Crunchyroll', url: '#', languages: dubs }],
      updatedAt: new Date().toISOString(),
    };

    return normalized;
  }

  private async saveAnimeRecords(records: AnimeRecord[]) {
    try {
      // 100% DATA SAFETY: Never overwrite existing cache with an empty array during sync
      if (records.length === 0 && this.animeRecords.length > 0) {
        console.warn('[AniDub DB] Safety Block: Prevented overwriting cache with empty data.');
        return;
      }
      
      this.animeRecords = records;
      await idbSet(DB_ANIME_KEY, records);
      this.notify();
    } catch (e) {
      console.error('Save anime records error:', e);
      // Fallback to localStorage for small updates if IDB fails (though unlikely)
      if (!isQuotaError(e)) {
        try {
          localStorage.setItem(DB_ANIME_KEY, JSON.stringify(records));
        } catch {}
      }
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

  // --- 3. User Submission: Saves with status "pending" to Firestore with RTDB Fallback ---
  public async submitDubInfo(data: Omit<AnimeRecord, 'id' | 'submissionStatus' | 'submittedAt'>): Promise<AnimeRecord> {
    const id = 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newRecord: AnimeRecord = {
      ...data,
      id,
      status: 'pending',
      submissionStatus: 'pending',
      submittedAt: new Date().toISOString(),
    };

    const records = this.getAllAnimeRecords();
    await this.saveAnimeRecords([newRecord, ...records]);

    let isQuotaHit = false;

    // Persist directly to Firestore real database
    try {
      const sanitized = {
        ...newRecord,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'submissions', id), sanitized);
      await setDoc(doc(db, 'animes', id), sanitized);
      await setDoc(doc(db, 'activities', `act-${id}`), {
        user: newRecord.submittedBy?.userName || 'Community User',
        action: 'submitted',
        animeTitle: newRecord.title,
        timestamp: new Date(),
        language: newRecord.dubs?.[0] || 'Tamil',
        status: 'pending'
      });
    } catch (fsErr: any) {
      console.warn('Firestore write error in submitDubInfo:', fsErr);
      if (this.isQuotaExceededError(fsErr)) {
        isQuotaHit = true;
        this.setQuotaExceeded(true);
      } else {
        throw fsErr;
      }
    }

    // RTDB Fallback if Firestore Quota Hit
    if (isQuotaHit) {
      try {
        await this.saveToRtdbFallback('pending_submissions', newRecord);
      } catch (rtdbErr) {
        console.error('[RTDB Fallback Error]', rtdbErr);
      }
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
  public async approveSubmission(animeOrId: string | AnimeRecord, notes?: string, reviewerName: string = 'Admin (prasanth123)'): Promise<boolean> {
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized approveSubmission write blocked for id:', typeof animeOrId === 'string' ? animeOrId : animeOrId.id);
      return false;
    }

    const id = typeof animeOrId === 'string' ? animeOrId : animeOrId.id;
    const records = this.getAllAnimeRecords();
    let targetIndex = records.findIndex((r) => r.id === id);
    
    let anime: AnimeRecord;
    if (targetIndex === -1) {
      if (typeof animeOrId === 'string') return false; // Can't approve by ID if not in cache and no record provided
      anime = { ...animeOrId };
      records.unshift(anime);
      targetIndex = 0;
    } else {
      anime = records[targetIndex];
    }

    records[targetIndex] = {
      ...anime,
      status: 'approved',
      submissionStatus: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveAnimeRecords(records);

    // --- TELEGRAM NOTIFICATION (Auto-trigger on Approval) ---
    const approvedAnime = records[targetIndex];
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://anidub.in';
      const watchUrl = `${siteUrl}/anime/${approvedAnime.id}`;
      
      const caption = [
        `🌟 <b>New Dubbed Anime Live!</b> 🌟`,
        ``,
        `🎬 <b>Title:</b> ${approvedAnime.title}`,
        `🎙️ <b>Languages:</b> ${approvedAnime.dubs.join(' • ')}`,
        `🏷️ <b>Genres:</b> ${approvedAnime.genres.join(', ')}`,
        `📅 <b>Release Year:</b> ${approvedAnime.releaseYear}`,
        ``,
        `🔗 <b>Watch Now:</b> <a href="${watchUrl}">${watchUrl}</a>`,
        ``,
        `✨ <i>Enjoy high-quality Indian dubs on AniDub India!</i>`
      ].join('\n');

      const endpoint = approvedAnime.poster ? 'sendPhoto' : 'sendMessage';
      const body = approvedAnime.poster 
        ? { chat_id: TELEGRAM_CHAT_ID, photo: approvedAnime.poster, caption, parse_mode: 'HTML' }
        : { chat_id: TELEGRAM_CHAT_ID, text: caption, parse_mode: 'HTML' };

      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(err => console.warn('[Telegram Notify Error]', err));
    }

    // Sync approval to Firestore
    try {
      await setDoc(doc(db, 'animes', id), records[targetIndex], { merge: true });
      await setDoc(doc(db, 'submissions', id), {
        status: 'approved',
        submissionStatus: 'approved',
        reviewedBy: reviewerName,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e: any) {
      console.warn('Firestore approval sync error:', e);
      if (isQuotaError(e)) throw e;
    }

    // Notify backend via PUT request
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'approve', reviewer: reviewerName }),
    }).catch((e) => console.warn('Approve PUT request error:', e));

    return true;
  }

  public async rejectSubmission(animeOrId: string | AnimeRecord, reason?: string, reviewerName: string = 'Admin (prasanth123)'): Promise<boolean> {
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized rejectSubmission write blocked for id:', typeof animeOrId === 'string' ? animeOrId : animeOrId.id);
      return false;
    }

    const id = typeof animeOrId === 'string' ? animeOrId : animeOrId.id;
    const records = this.getAllAnimeRecords();
    let targetIndex = records.findIndex((r) => r.id === id);

    let anime: AnimeRecord;
    if (targetIndex === -1) {
      if (typeof animeOrId === 'string') return false;
      anime = { ...animeOrId };
      records.unshift(anime);
      targetIndex = 0;
    } else {
      anime = records[targetIndex];
    }

    records[targetIndex] = {
      ...anime,
      status: 'rejected',
      submissionStatus: 'rejected',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rejectionReason: reason,
    };

    await this.saveAnimeRecords(records);

    // Sync rejection to Firestore across all relevant collections
    try {
      const updatePayload = {
        status: 'rejected',
        submissionStatus: 'rejected',
        reviewedBy: reviewerName,
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
      };
      
      await setDoc(doc(db, 'submissions', id), updatePayload, { merge: true });
      try {
        await setDoc(doc(db, 'animes', id), updatePayload, { merge: true });
      } catch {}
      try {
        await setDoc(doc(db, 'anime', id), updatePayload, { merge: true });
      } catch {}
    } catch (e: any) {
      console.warn('Firestore rejection sync error:', e);
      if (isQuotaError(e)) throw e;
    }

    // Notify backend via PUT request
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reject', reviewer: reviewerName, reason }),
    }).catch((e) => console.warn('Reject PUT request error:', e));

    return true;
  }

  public async updateAnime(id: string, updatedData: Partial<AnimeRecord>): Promise<boolean> {
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

    await this.saveAnimeRecords(records);

    // Sync update to Firestore
    try {
      await setDoc(doc(db, 'animes', id), {
        ...updatedData,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      try {
        await setDoc(doc(db, 'anime', id), {
          ...updatedData,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch {}
    } catch (e: any) {
      console.warn('Firestore update sync error:', e);
      if (isQuotaError(e)) throw e;
    }

    // Notify backend via PUT request
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'update', data: updatedData }),
    }).catch((e) => console.warn('Update PUT request error:', e));

    return true;
  }

  public async deleteSubmission(id: string): Promise<boolean> {
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

    await this.saveAnimeRecords(records);

    // Sync soft delete to Firestore
    try {
      const update = { isDeleted: true, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, 'animes', id), update, { merge: true });
      await setDoc(doc(db, 'submissions', id), update, { merge: true });
    } catch (e: any) {
      console.warn('Firestore soft delete sync error:', e);
      if (isQuotaError(e)) throw e;
    }

    this.notify();
    return true;
  }

  public async restoreSubmission(id: string): Promise<boolean> {
    if (!authService.isAdmin()) return false;

    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => r.id === id);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      isDeleted: false,
      updatedAt: new Date().toISOString(),
    };

    await this.saveAnimeRecords(records);

    try {
      const update = { isDeleted: false, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, 'animes', id), update, { merge: true });
      await setDoc(doc(db, 'submissions', id), update, { merge: true });
    } catch (e: any) {
      if (isQuotaError(e)) throw e;
    }

    this.notify();
    return true;
  }

  public async permanentlyDeleteSubmission(id: string): Promise<boolean> {
    // CRITICAL SECURITY CHECK: Only authenticated Admins can delete anime records
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized permanent delete write blocked for id:', id);
      return false;
    }

    const records = this.getAllAnimeRecords();
    const filtered = records.filter((r) => r.id !== id);
    await this.saveAnimeRecords(filtered);

    // Delete directly from Firestore
    try {
      await deleteDoc(doc(db, 'animes', id));
      await deleteDoc(doc(db, 'anime', id));
      await deleteDoc(doc(db, 'submissions', id));
    } catch (e: any) {
      console.warn('Firestore permanent delete sync error:', e);
      if (isQuotaError(e)) throw e;
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
    } catch (cleanErr) {
      console.warn('Watchlist cleanup error:', cleanErr);
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

  public async bulkImportAnime(jsonData: any[], isResume = false): Promise<{ 
    added: number; 
    updated: number; 
    failed: number; 
    quotaHit: boolean; 
    remaining: number 
  }> {
    if (!authService.isAdmin() || !Array.isArray(jsonData)) {
      return { added: 0, updated: 0, failed: 0, quotaHit: false, remaining: 0 };
    }
    
    // 1. If fresh import (not resume), save the entire JSON array to localStorage first
    if (!isResume) {
      try {
        localStorage.setItem(ADMIN_PENDING_UPLOADS_KEY, JSON.stringify(jsonData));
      } catch (err) {
        console.warn('[Bulk Import] Could not save initial queue to localStorage:', err);
      }
    }

    let queue: any[] = [];
    try {
      const stored = localStorage.getItem(ADMIN_PENDING_UPLOADS_KEY);
      queue = stored ? JSON.parse(stored) : [...jsonData];
    } catch {
      queue = [...jsonData];
    }

    let addedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let quotaHit = false;

    const currentRecords = this.getAllAnimeRecords();
    const newItemsForLocal: AnimeRecord[] = [];

    // Process each anime in the local queue
    while (queue.length > 0) {
      const item = queue[0];
      try {
        const rawTitle = (item.title || item.name || '').trim();
        if (!rawTitle) {
          failedCount++;
          // Remove invalid item from queue and update storage
          queue.shift();
          try {
            if (queue.length > 0) {
              localStorage.setItem(ADMIN_PENDING_UPLOADS_KEY, JSON.stringify(queue));
            } else {
              localStorage.removeItem(ADMIN_PENDING_UPLOADS_KEY);
            }
          } catch {}
          continue;
        }

        const existing = currentRecords.find(r => 
          (item.id && r.id === item.id) ||
          r.title.toLowerCase().trim() === rawTitle.toLowerCase()
        );

        const finalId = existing ? existing.id : (item.id || ('sub-' + Math.random().toString(36).substring(2, 9)));
        
        const jsonStatus = String(item.status || item.airingStatus || '').toLowerCase();
        let airingStatus: 'Ongoing' | 'Completed' = 'Completed';
        if (jsonStatus.includes('ongoing') || jsonStatus.includes('airing') || jsonStatus.includes('simulcast')) {
          airingStatus = 'Ongoing';
        }

        const normalized = this.normalizeRecord({ 
          ...(existing || {}), 
          ...item, 
          id: finalId,
          airingStatus: airingStatus,
          status: 'pending',
          submissionStatus: 'pending',
          isDeleted: false,
          createdAt: item.createdAt || existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          submittedAt: item.submittedAt || existing?.submittedAt || new Date().toISOString()
        });

        normalized.status = 'pending';
        normalized.submissionStatus = 'pending';

        if (normalized && normalized.title) {
          const subRef = doc(db, 'submissions', finalId);
          const animeRef = doc(db, 'animes', finalId);
          const actRef = doc(db, 'activities', `act-import-${finalId}-${Date.now()}`);

          const batch = writeBatch(db);
          batch.set(subRef, normalized, { merge: true });
          batch.set(animeRef, normalized, { merge: true });
          batch.set(actRef, {
            user: 'Admin (Bulk)',
            action: existing ? 'updated' : 'submitted',
            animeTitle: normalized.title,
            timestamp: serverTimestamp(),
            language: normalized.dubs?.[0] || 'Tamil',
            status: 'pending'
          });

          await batch.commit();

          // SUCCESS: Remove this anime from local queue immediately
          queue.shift();
          try {
            if (queue.length > 0) {
              localStorage.setItem(ADMIN_PENDING_UPLOADS_KEY, JSON.stringify(queue));
            } else {
              localStorage.removeItem(ADMIN_PENDING_UPLOADS_KEY);
            }
          } catch (e) {
            console.warn('[Bulk Import] LocalStorage update warning:', e);
          }

          newItemsForLocal.push(normalized);
          if (existing) updatedCount++; else addedCount++;
        } else {
          failedCount++;
          queue.shift();
          try {
            if (queue.length > 0) {
              localStorage.setItem(ADMIN_PENDING_UPLOADS_KEY, JSON.stringify(queue));
            } else {
              localStorage.removeItem(ADMIN_PENDING_UPLOADS_KEY);
            }
          } catch {}
        }
      } catch (err: any) {
        console.error('[Bulk Import Item Error]', err);
        // Check if resource-exhausted (quota limit) error occurs
        if (isQuotaError(err)) {
          console.warn(`[Bulk Import Quota Hit] Breaking loop and saving ${queue.length} remaining items to RTDB fallback.`);
          quotaHit = true;
          this.setQuotaExceeded(true);

          // 1. RTDB Cloud Fallback: Save all remaining un-uploaded items in one go
          try {
            const rtdbBatch: Record<string, any> = {};
            queue.forEach(item => {
              const id = item.id || ('batch-' + Math.random().toString(36).substring(2, 9));
              rtdbBatch[id] = { ...item, fallbackAt: new Date().toISOString() };
            });
            await update(ref(rtdb, 'admin_pending_uploads'), rtdbBatch);
          } catch (rtdbErr) {
            console.error('[RTDB Admin Fallback Error]', rtdbErr);
          }

          // 2. Clear local localStorage queue to avoid double processing (it's now in RTDB)
          try {
            localStorage.removeItem(ADMIN_PENDING_UPLOADS_KEY);
          } catch {}

          break; // STOP THE LOOP IMMEDIATELY!
        } else {
          // Other error on this individual item (e.g., malformed payload)
          failedCount++;
          queue.shift();
          try {
            if (queue.length > 0) {
              localStorage.setItem(ADMIN_PENDING_UPLOADS_KEY, JSON.stringify(queue));
            } else {
              localStorage.removeItem(ADMIN_PENDING_UPLOADS_KEY);
            }
          } catch {}
        }
      }
    }

    // Merge successfully uploaded items into local memory/cache
    if (newItemsForLocal.length > 0) {
      const mergedRecords = [...currentRecords];
      newItemsForLocal.forEach(newItem => {
        const idx = mergedRecords.findIndex(r => r.id === newItem.id);
        if (idx !== -1) mergedRecords[idx] = newItem;
        else mergedRecords.push(newItem);
      });
      await this.saveAnimeRecords(mergedRecords);
    }

    if (queue.length === 0) {
      try {
        localStorage.removeItem(ADMIN_PENDING_UPLOADS_KEY);
      } catch {}
    }

    return { 
      added: addedCount, 
      updated: updatedCount, 
      failed: failedCount, 
      quotaHit, 
      remaining: queue.length 
    };
  }

  public getAdminPendingUploads(): any[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(ADMIN_PENDING_UPLOADS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public clearAdminPendingUploads(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(ADMIN_PENDING_UPLOADS_KEY);
    } catch {}
  }

  public async resumeBulkImport(): Promise<{ 
    added: number; 
    updated: number; 
    failed: number; 
    quotaHit: boolean; 
    remaining: number 
  }> {
    const queue = this.getAdminPendingUploads();
    if (!queue || queue.length === 0) {
      return { added: 0, updated: 0, failed: 0, quotaHit: false, remaining: 0 };
    }
    return this.bulkImportAnime(queue, true);
  }

  public submitDubInfoLocally(newRecord: AnimeRecord): AnimeRecord {
    const records = this.getAllAnimeRecords();
    const existingIndex = records.findIndex((r) => r.id === newRecord.id);
    if (existingIndex !== -1) {
      records[existingIndex] = newRecord;
    } else {
      records.unshift(newRecord);
    }
    this.saveAnimeRecords(records);
    return newRecord;
  }

  public async syncUserPendingSubmissions(): Promise<{ synced: number; remaining: number }> {
    if (typeof window === 'undefined') return { synced: 0, remaining: 0 };
    let queue: AnimeRecord[] = [];
    try {
      const raw = localStorage.getItem(USER_PENDING_SUBMISSIONS_KEY);
      if (!raw) return { synced: 0, remaining: 0 };
      queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return { synced: 0, remaining: 0 };
    } catch {
      return { synced: 0, remaining: 0 };
    }

    let synced = 0;
    while (queue.length > 0) {
      const item = queue[0];
      try {
        const docData = {
          ...item,
          status: 'pending',
          submissionStatus: 'pending',
          createdAt: item.createdAt || new Date().toISOString(),
          serverCreatedAt: serverTimestamp(),
        };

        const batch = writeBatch(db);
        batch.set(doc(db, 'submissions', item.id), docData, { merge: true });
        batch.set(doc(db, 'animes', item.id), docData, { merge: true });
        batch.set(doc(db, 'activities', `act-${item.id}`), {
          user: item.submittedBy?.userName || 'Community User',
          action: 'submitted',
          animeTitle: item.title,
          timestamp: serverTimestamp(),
          language: item.dubs?.[0] || 'Tamil',
          status: 'pending'
        });

        await batch.commit();

        // Successful upload! Remove from local queue
        queue.shift();
        synced++;
        if (queue.length > 0) {
          localStorage.setItem(USER_PENDING_SUBMISSIONS_KEY, JSON.stringify(queue));
        } else {
          localStorage.removeItem(USER_PENDING_SUBMISSIONS_KEY);
        }
      } catch (err: any) {
        if (isQuotaError(err)) {
          // Still resource-exhausted; keep remaining items safely in localStorage and stop
          try {
            localStorage.setItem(USER_PENDING_SUBMISSIONS_KEY, JSON.stringify(queue));
          } catch {}
          break;
        } else {
          // If specific document format error, remove it to prevent indefinite queue blockage
          queue.shift();
          try {
            if (queue.length > 0) {
              localStorage.setItem(USER_PENDING_SUBMISSIONS_KEY, JSON.stringify(queue));
            } else {
              localStorage.removeItem(USER_PENDING_SUBMISSIONS_KEY);
            }
          } catch {}
        }
      }
    }

    if (queue.length === 0) {
      try {
        localStorage.removeItem(USER_PENDING_SUBMISSIONS_KEY);
      } catch {}
    }

    return { synced, remaining: queue.length };
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
      await this.saveAnimeRecords(records);
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
        await this.saveAnimeRecords(firestoreList);
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

  public async addReview(reviewData: Omit<DubReview, 'id' | 'createdAt' | 'likes'>): Promise<DubReview> {
    const reviewId = 'rev-' + Date.now().toString(36);
    const newReview: DubReview = {
      ...reviewData,
      id: reviewId,
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    try {
      const raw = localStorage.getItem(DB_REVIEWS_KEY);
      const all: DubReview[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(DB_REVIEWS_KEY, JSON.stringify([newReview, ...all]));
      
      // Sync to Firestore
      try {
        await setDoc(doc(db, 'reviews', reviewId), {
          ...newReview,
          serverCreatedAt: serverTimestamp(),
        });
      } catch (fsErr: any) {
        console.warn('[Firestore Review Sync Error]', fsErr);
        if (isQuotaError(fsErr)) {
          throw fsErr; // Re-throw to let component handle quota hit
        }
      }
      
      this.notify();
    } catch (e) {
      console.error('Error adding review:', e);
      throw e;
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

  // --- 7. Public Anime Collections ---
  public async createCollection(data: Omit<AnimeCollection, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'views'>): Promise<AnimeCollection> {
    const id = 'col-' + Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    const newCollection: AnimeCollection = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      likes: 0,
      views: 0
    };

    try {
      const raw = localStorage.getItem(DB_COLLECTIONS_KEY);
      const all: AnimeCollection[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(DB_COLLECTIONS_KEY, JSON.stringify([newCollection, ...all]));
      
      // Persist to Firestore if public
      if (newCollection.isPublic) {
        await setDoc(doc(db, 'collections', id), newCollection);
      }
      
      this.notify();
      return newCollection;
    } catch (e) {
      console.error('Error creating collection:', e);
      return newCollection;
    }
  }

  public async getPublicCollection(id: string): Promise<AnimeCollection | null> {
    // Try local cache first
    try {
      const raw = localStorage.getItem(DB_COLLECTIONS_KEY);
      const all: AnimeCollection[] = raw ? JSON.parse(raw) : [];
      const local = all.find(c => c.id === id);
      if (local) return local;
    } catch {}

    // Fallback to Firestore
    try {
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'collections', id));
      if (snap.exists()) {
        return snap.data() as AnimeCollection;
      }
    } catch (e) {
      console.error('Error fetching public collection:', e);
    }
    return null;
  }

  public getUserCollections(userId: string): AnimeCollection[] {
    try {
      const raw = localStorage.getItem(DB_COLLECTIONS_KEY);
      const all: AnimeCollection[] = raw ? JSON.parse(raw) : [];
      return all.filter(c => c.userId === userId);
    } catch {
      return [];
    }
  }

  // --- 8. RTDB Cloud Fallback Queue ---
  public async saveToRtdbFallback(node: string, data: any): Promise<boolean> {
    try {
      const id = data.id || ('fallback-' + Date.now().toString(36));
      await set(ref(rtdb, `${node}/${id}`), {
        ...data,
        fallbackAt: new Date().toISOString(),
      });
      return true;
    } catch (e) {
      console.error(`[RTDB Fallback Error] Failed to save to ${node}:`, e);
      return false;
    }
  }

  public async getPendingRtdbSubmissions(): Promise<any[]> {
    try {
      const dbRef = ref(rtdb);
      const snapshot = await rtdbGet(child(dbRef, 'pending_submissions'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.entries(data).map(([id, val]: [string, any]) => ({
          ...val,
          id: val.id || id,
        }));
      }
      return [];
    } catch (e) {
      console.error('[RTDB Fetch Error] Could not get pending submissions:', e);
      return [];
    }
  }

  public async syncRtdbToFirestore(): Promise<{ success: number; failed: number }> {
    const pending = await this.getPendingRtdbSubmissions();
    if (pending.length === 0) return { success: 0, failed: 0 };

    let successCount = 0;
    let failedCount = 0;
    const CHUNK_SIZE = 150; // 150 items * 2 docs = 300 ops (well under 500 limit)

    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      const syncedIds: string[] = [];

      for (const item of chunk) {
        try {
          const id = item.id;
          const sanitized = this.normalizeRecord(item);
          batch.set(doc(db, 'animes', id), sanitized, { merge: true });
          batch.set(doc(db, 'submissions', id), sanitized, { merge: true });
          syncedIds.push(id);
        } catch (err) {
          console.error(`[RTDB Sync] Failed to prepare item ${item.id}:`, err);
          failedCount++;
        }
      }

      if (syncedIds.length > 0) {
        try {
          await batch.commit();
          // Upon success, delete from RTDB
          for (const id of syncedIds) {
            await remove(ref(rtdb, `pending_submissions/${id}`));
          }
          successCount += syncedIds.length;
        } catch (err) {
          console.error('[RTDB Sync] Firestore batch commit failed:', err);
          failedCount += chunk.length - (chunk.length - syncedIds.length);
        }
      }
    }

    this.notify();
    return { success: successCount, failed: failedCount };
  }

  public async getAdminPendingRtdbUploads(): Promise<any[]> {
    try {
      const dbRef = ref(rtdb);
      const snapshot = await rtdbGet(child(dbRef, 'admin_pending_uploads'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.entries(data).map(([id, val]: [string, any]) => ({
          ...val,
          id: val.id || id,
        }));
      }
      return [];
    } catch (e) {
      console.error('[RTDB Admin Fetch Error] Could not get admin pending uploads:', e);
      return [];
    }
  }

  public async syncAdminRtdbToFirestore(): Promise<{ success: number; failed: number }> {
    const pending = await this.getAdminPendingRtdbUploads();
    if (pending.length === 0) return { success: 0, failed: 0 };

    let successCount = 0;
    let failedCount = 0;
    const CHUNK_SIZE = 150; // 150 items * 2 docs = 300 ops

    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      const syncedIds: string[] = [];

      for (const item of chunk) {
        try {
          const id = item.id;
          const normalized = this.normalizeRecord({
            ...item,
            status: 'pending',
            submissionStatus: 'pending'
          });
          
          batch.set(doc(db, 'animes', id), normalized, { merge: true });
          batch.set(doc(db, 'submissions', id), normalized, { merge: true });
          
          syncedIds.push(id);
        } catch (err) {
          console.error(`[RTDB Admin Sync] Failed item ${item.id}:`, err);
          failedCount++;
        }
      }

      if (syncedIds.length > 0) {
        try {
          await batch.commit();
          // Clear from RTDB upon success
          for (const id of syncedIds) {
            await remove(ref(rtdb, `admin_pending_uploads/${id}`));
          }
          successCount += syncedIds.length;
        } catch (err) {
          console.error('[RTDB Admin Sync] Commit failed:', err);
          failedCount += chunk.length - (chunk.length - syncedIds.length);
        }
      }
    }

    this.notify();
    return { success: successCount, failed: failedCount };
  }
}

export const dbService = new DatabaseService();
