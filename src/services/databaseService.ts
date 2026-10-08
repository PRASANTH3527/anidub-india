// ==============================================================================
// AniDub India — Database Service (Supabase PostgreSQL + 24h IndexedDB Caching)
// ==============================================================================
import { AnimeRecord, DubReview, WatchlistEntry, SubmissionStatus, StreamingPlatform, AnimeCollection } from '../types/database';
import { Anime, DubLanguage } from '../types/anime';
import { supabase } from '../lib/supabase';
import { authService } from './authService';
import { get as idbGet, set as idbSet, del, clear } from 'idb-keyval';

const DB_ANIME_KEY = 'anidub_db_anime_records';
const DB_REVIEWS_KEY = 'anidub_db_reviews';
const DB_WATCHLIST_KEY = 'anidub_db_watchlists';
const DB_COLLECTIONS_KEY = 'anidub_db_collections';
const LAST_SYNC_KEY = 'anidub_db_last_sync_timestamp';
export const CACHE_TIMESTAMP_KEY = 'anidub_catalog_cache_timestamp';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours aggressive cache TTL

export const ADMIN_PENDING_UPLOADS_KEY = 'admin_pending_uploads';
export const USER_PENDING_SUBMISSIONS_KEY = 'user_pending_submissions';

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err || '').toLowerCase();
  const code = String(err.code || '').toLowerCase();
  return (
    code === '429' ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('quota')
  );
}

// Helper to remove any undefined fields before saving to Supabase
export function cleanSupabaseData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanSupabaseData);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        res[key] = cleanSupabaseData(val);
      }
    }
    return res;
  }
  return obj;
}

// Export cleanFirestoreData alias for backwards compatibility
export const cleanFirestoreData = cleanSupabaseData;

// --- TELEGRAM NOTIFICATION CONFIG ---
const TELEGRAM_BOT_TOKEN = '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc'; 
const TELEGRAM_CHAT_ID = '8769442354';

class DatabaseService {
  private listeners: (() => void)[] = [];
  private isQuotaLimited = false;
  private animeRecords: AnimeRecord[] = [];
  private isInitialized = false;

  constructor() {
    this.initDatabase();
  }

  private async initDatabase() {
    if (typeof window === 'undefined') return;
    try {
      // 1. Load from IndexedDB (Priority)
      const idbData = await idbGet(DB_ANIME_KEY);
      if (idbData && Array.isArray(idbData)) {
        this.animeRecords = idbData.map(item => this.normalizeRecord(item));
        console.log(`[AniDub DB] Loaded ${this.animeRecords.length} records from IndexedDB cache.`);
      } else {
        // 2. Migration: Load from Legacy localStorage if IDB is empty
        const legacyData = localStorage.getItem(DB_ANIME_KEY);
        if (legacyData) {
          try {
            const parsed = JSON.parse(legacyData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.animeRecords = parsed.map(item => this.normalizeRecord(item));
              await idbSet(DB_ANIME_KEY, this.animeRecords);
              localStorage.removeItem(DB_ANIME_KEY);
            }
          } catch (e) {
            console.warn('[AniDub DB] Migration notice:', e);
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

    const dubs = mapLangs(data.dubs || data.languages || data.availableIn || []);

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
      seasonDetails = [{ 
        type: 'Season', 
        label: '1', 
        episodeCount: Number(data.episodes) || 12, 
        languages: dubs.length > 0 ? dubs : ['Tamil'] 
      }];
    }

    let airingStatus: 'Ongoing' | 'Completed' = 'Completed';
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
      id: String(data.id),
      title,
      romajiTitle: (data.romajiTitle || data.romaji_title || data.japaneseTitle || '').trim(),
      poster: data.poster || data.image || data.image_url || '',
      banner: data.banner || data.coverImage || '',
      studio: data.studio || data.animationStudio || data.animation_studio || 'Animation Studio',
      synopsis: data.synopsis || data.description || '',
      type: data.type || 'TV Series',
      episodes: Number(data.episodes) || 12,
      releaseYear: Number(data.releaseYear || data.release_year) || new Date().getFullYear(),
      rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : 0,
      genres: Array.isArray(data.genres) ? data.genres : ['Action'],
      themes: Array.isArray(data.themes) ? data.themes : [],
      dubs: dubs.length > 0 ? dubs : ['Tamil'],
      dubDetails: Array.isArray(data.dubDetails) ? data.dubDetails : (data.dub_details || []),
      platforms: rawPlatforms.map((p: any) => ({
        name: (p.name || 'Crunchyroll') as StreamingPlatform,
        url: p.url || '',
        languages: mapLangs(p.languages || dubs)
      })),
      seasonDetails,
      airingStatus,
      status: data.status || 'approved',
      submissionStatus: data.submissionStatus || data.submission_status || (data.status === 'approved' ? 'approved' : 'pending'),
      submittedAt: data.submittedAt || data.submitted_at || new Date().toISOString(),
      updatedAt: data.updatedAt || data.updated_at || new Date().toISOString(),
      isDeleted: Boolean(data.isDeleted || data.is_deleted),
      likes: Number(data.likes || data.upvotes || 0),
      upvotes: Number(data.upvotes || data.likes || 0),
    };

    return normalized;
  }

  public async saveAnimeRecords(records: AnimeRecord[]): Promise<void> {
    try {
      if (records.length === 0 && this.animeRecords.length > 0) {
        console.warn('[AniDub DB] Safety Block: Prevented overwriting cache with empty data.');
        return;
      }
      
      this.animeRecords = records;
      await idbSet(DB_ANIME_KEY, records);
      this.notify();
    } catch (e) {
      console.error('Save anime records error:', e);
    }
  }

  // --- 1. Paginated Queries with Aggressive 24h Local Caching & Supabase Range Pagination ---
  public async getApprovedAnimePaginated(
    lastDoc: any = null, 
    pageSize = 20, 
    forceRefresh = false
  ): Promise<{ items: AnimeRecord[], lastDoc: any, fromCache?: boolean }> {
    try {
      // 1. AGGRESSIVE CACHING: Check 24-Hour Local Cache
      const cacheTimestamp = typeof window !== 'undefined' ? localStorage.getItem(CACHE_TIMESTAMP_KEY) : null;
      const isCacheFresh = cacheTimestamp && (Date.now() - Number(cacheTimestamp)) < CACHE_TTL_MS;

      // Serve from local IndexedDB cache if fresh or offline
      if (!forceRefresh && isCacheFresh && this.animeRecords.length > 0) {
        const approvedOnly = this.animeRecords
          .filter(a => (a.status === 'approved' || (a as any).submissionStatus === 'approved') && !a.isDeleted)
          .sort((a, b) => a.title.localeCompare(b.title));

        let startIndex = 0;
        if (lastDoc !== null && lastDoc !== undefined) {
          if (typeof lastDoc === 'number') {
            startIndex = lastDoc;
          } else if (typeof lastDoc === 'string') {
            const idx = approvedOnly.findIndex(a => a.id === lastDoc);
            startIndex = idx >= 0 ? idx + 1 : 0;
          } else if (lastDoc?.id) {
            const idx = approvedOnly.findIndex(a => a.id === lastDoc.id);
            startIndex = idx >= 0 ? idx + 1 : 0;
          }
        }

        const items = approvedOnly.slice(startIndex, startIndex + pageSize);
        const nextCursor = startIndex + items.length < approvedOnly.length ? (startIndex + items.length) : null;
        return { items, lastDoc: nextCursor, fromCache: true };
      }

      // 2. STRICT SUPABASE SELECT QUERY with range pagination
      const startIndex = typeof lastDoc === 'number' ? lastDoc : (lastDoc?.id ? this.animeRecords.findIndex(a => a.id === lastDoc.id) + 1 : 0);
      const endIndex = startIndex + pageSize - 1;

      const { data, error } = await supabase
        .from('anime_list')
        .select('*')
        .eq('is_deleted', false)
        .order('title', { ascending: true })
        .range(startIndex, endIndex);

      if (error) {
        console.warn('[Supabase Service] Notice on select anime_list:', error.message);
        // Fallback to local cache
        const approvedOnly = this.getApprovedAnime();
        const items = approvedOnly.slice(startIndex, startIndex + pageSize);
        return { items, lastDoc: null, fromCache: true };
      }

      const items = (data || []).map(row => this.normalizeRecord(row));

      // Cache newly fetched items into IndexedDB
      if (items.length > 0) {
        const existingMap = new Map(this.animeRecords.map(a => [a.id, a]));
        items.forEach(item => existingMap.set(item.id, item));
        this.animeRecords = Array.from(existingMap.values());
        await idbSet(DB_ANIME_KEY, this.animeRecords);
        if (typeof window !== 'undefined') {
          localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        }
      }

      const nextCursor = items.length >= pageSize ? (startIndex + items.length) : null;
      return { items, lastDoc: nextCursor, fromCache: false };
    } catch (err: any) {
      if (err?.code === 'PGRST205' || String(err?.message || '').includes('PGRST205')) {
        console.info('[Supabase Info] Tables not created yet. Using IndexedDB local cache.');
      } else {
        console.error('[Supabase Service] Error fetching approved anime with pagination:', err);
      }
      const approvedOnly = this.getApprovedAnime();
      const items = approvedOnly.slice(0, pageSize);
      return { items, lastDoc: null, fromCache: true };
    }
  }

  public async getSubmissionsPaginated(
    status: 'pending' | 'rejected' = 'pending', 
    lastDoc: any = null, 
    pageSize = 20
  ): Promise<{ items: AnimeRecord[], lastDoc: any }> {
    try {
      const startIndex = typeof lastDoc === 'number' ? lastDoc : 0;
      const endIndex = startIndex + pageSize - 1;

      const tableName = status === 'pending' ? 'pending_animes' : 'anime_list';
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('updated_at', { ascending: false })
        .range(startIndex, endIndex);

      if (error) {
        // Fallback to local records
        const all = status === 'pending' ? this.getPendingSubmissions() : this.getRejectedSubmissions();
        const items = all.slice(startIndex, startIndex + pageSize);
        return { items, lastDoc: null };
      }

      const items = (data || []).map(row => this.normalizeRecord(row));
      const nextCursor = items.length >= pageSize ? (startIndex + items.length) : null;
      return { items, lastDoc: nextCursor };
    } catch (err: any) {
      if (err?.code === 'PGRST205' || String(err?.message || '').includes('PGRST205')) {
        console.info('[Supabase Info] Tables not created yet.');
      } else {
        console.error(`[Supabase Service] Error fetching ${status} submissions:`, err);
      }
      return { items: [], lastDoc: null };
    }
  }

  public getApprovedAnime(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => (a.status === 'approved' || (a as any).submissionStatus === 'approved') && !a.isDeleted);
  }

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

  // Fetch anime detail with local-first cache priority, then single Supabase select fallback
  public async fetchAnimeDetail(id: string): Promise<AnimeRecord | null> {
    // 1. Strict local cache check (Zero Supabase request)
    const cached = this.getAnimeById(id);
    if (cached) return cached;

    // 2. Fetch single row if not in local cache
    try {
      const { data, error } = await supabase
        .from('anime_list')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (data) {
        const item = this.normalizeRecord(data);
        if (!this.animeRecords.some(a => a.id === item.id)) {
          this.animeRecords.push(item);
          await idbSet(DB_ANIME_KEY, this.animeRecords);
        }
        return item;
      }
    } catch (e) {
      console.warn('[dbService] Single anime read notice:', e);
    }
    return null;
  }

  // --- 3. User Submission: Saves to Supabase pending_animes ---
  public async submitDubInfo(data: Omit<AnimeRecord, 'id' | 'submissionStatus' | 'submittedAt'>): Promise<AnimeRecord> {
    const id = ('sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6));
    const newRecord: AnimeRecord = {
      ...data,
      id,
      status: 'pending',
      submissionStatus: 'pending',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('pending_animes')
        .insert([cleanSupabaseData(newRecord)]);

      if (error) {
        console.warn('[Supabase Insert pending_animes notice]:', error.message);
      }
    } catch (err: any) {
      console.warn('[Supabase Submission Notice]:', err);
    }

    // Save locally
    const records = this.getAllAnimeRecords();
    records.unshift(newRecord);
    await this.saveAnimeRecords(records);

    return newRecord;
  }

  // --- 4. Moderation Actions (Approve/Reject/Delete) via Supabase ---
  public async approveSubmission(
    animeOrId: string | AnimeRecord, 
    notes?: string, 
    reviewerName: string = 'Admin (prasanth123)'
  ): Promise<boolean> {
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized approveSubmission write blocked');
      return false;
    }

    const id = typeof animeOrId === 'string' ? animeOrId : animeOrId.id;
    let anime: AnimeRecord | null = typeof animeOrId === 'object' ? animeOrId : null;

    if (!anime) {
      try {
        const { data } = await supabase.from('pending_animes').select('*').eq('id', id).maybeSingle();
        if (data) anime = this.normalizeRecord(data);
      } catch {}
    }

    if (!anime) {
      const records = this.getAllAnimeRecords();
      anime = records.find(r => r.id === id) || null;
    }

    if (!anime) return false;

    const approvedRecord: AnimeRecord = {
      ...anime,
      status: 'approved',
      submissionStatus: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Insert/Upsert into Supabase anime_list table
    try {
      const { error } = await supabase
        .from('anime_list')
        .upsert([cleanSupabaseData(approvedRecord)]);

      if (error) {
        console.warn('[Supabase Approval Upsert Notice]:', error.message);
      }
    } catch (e: any) {
      console.warn('[Supabase Approval Error]:', e);
    }

    // 2. Remove from Supabase pending_animes table
    try {
      await supabase.from('pending_animes').delete().eq('id', id);
    } catch {}

    // 3. Update local cache
    const records = this.getAllAnimeRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx !== -1) {
      records[idx] = approvedRecord;
    } else {
      records.unshift(approvedRecord);
    }
    await this.saveAnimeRecords(records);

    // Telegram Notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://anidub.in';
      const watchUrl = `${siteUrl}/anime/${approvedRecord.id}`;
      
      const caption = [
        `🌟 <b>New Dubbed Anime Live!</b> 🌟`,
        ``,
        `🎬 <b>Title:</b> ${approvedRecord.title}`,
        `🎙️ <b>Languages:</b> ${approvedRecord.dubs.join(' • ')}`,
        `🏷️ <b>Genres:</b> ${approvedRecord.genres.join(', ')}`,
        `📅 <b>Release Year:</b> ${approvedRecord.releaseYear}`,
        ``,
        `🔗 <b>Watch Now:</b> <a href="${watchUrl}">${watchUrl}</a>`,
        ``,
        `✨ <i>Enjoy high-quality Indian dubs on AniDub India!</i>`
      ].join('\n');

      const endpoint = approvedRecord.poster ? 'sendPhoto' : 'sendMessage';
      const body = approvedRecord.poster 
        ? { chat_id: TELEGRAM_CHAT_ID, photo: approvedRecord.poster, caption, parse_mode: 'HTML' }
        : { chat_id: TELEGRAM_CHAT_ID, text: caption, parse_mode: 'HTML' };

      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(err => console.warn('[Telegram Notify Error]', err));
    }

    // Notify backend
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'approve', reviewer: reviewerName }),
    }).catch(() => {});

    return true;
  }

  public async rejectSubmission(
    animeOrId: string | AnimeRecord, 
    reason?: string, 
    reviewerName: string = 'Admin (prasanth123)'
  ): Promise<boolean> {
    if (!authService.isAdmin()) {
      console.error('[Security Violation] Unauthorized rejectSubmission write blocked');
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
      rejectionReason: reason || null,
    };

    await this.saveAnimeRecords(records);

    // Sync rejection to Supabase
    try {
      await supabase
        .from('pending_animes')
        .update({
          status: 'rejected',
          submission_status: 'rejected',
          reviewed_by: reviewerName,
          rejection_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch (e: any) {
      console.warn('Supabase rejection sync notice:', e);
    }

    // Notify backend
    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reject', reviewer: reviewerName, reason }),
    }).catch(() => {});

    return true;
  }

  public async updateAnime(id: string, updatedData: Partial<AnimeRecord>): Promise<boolean> {
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
      id: id,
      updatedAt: new Date().toISOString(),
    };

    await this.saveAnimeRecords(records);

    // Sync update to Supabase
    try {
      await supabase
        .from('anime_list')
        .upsert([cleanSupabaseData({
          ...records[targetIndex],
          updatedAt: new Date().toISOString(),
        })]);
    } catch (e: any) {
      console.warn('Supabase update sync notice:', e);
    }

    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'update', data: updatedData }),
    }).catch(() => {});

    return true;
  }

  public async deleteSubmission(id: string): Promise<boolean> {
    if (!authService.isAdmin()) return false;

    const strId = String(id);
    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => String(r.id) === strId);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };

    await this.saveAnimeRecords(records);

    try {
      const { error } = await supabase.from('anime_list').update({ is_deleted: true, isDeleted: true }).eq('id', strId);
      if (error) {
        await supabase.from('anime_list').update({ is_deleted: true, isDeleted: true }).match({ id: strId });
      }
    } catch (err) {
      console.error('[Supabase Soft Delete Exception]:', err);
    }

    this.notify();
    return true;
  }

  public async restoreSubmission(id: string): Promise<boolean> {
    if (!authService.isAdmin()) return false;

    const strId = String(id);
    const records = this.getAllAnimeRecords();
    const targetIndex = records.findIndex((r) => String(r.id) === strId);
    if (targetIndex === -1) return false;

    records[targetIndex] = {
      ...records[targetIndex],
      isDeleted: false,
      updatedAt: new Date().toISOString(),
    };

    await this.saveAnimeRecords(records);

    try {
      const { error } = await supabase.from('anime_list').update({ is_deleted: false, isDeleted: false }).eq('id', strId);
      if (error) {
        await supabase.from('anime_list').update({ is_deleted: false, isDeleted: false }).match({ id: strId });
      }
    } catch (err) {
      console.error('[Supabase Restore Exception]:', err);
    }

    this.notify();
    return true;
  }

  public async permanentlyDeleteSubmission(id: string): Promise<boolean> {
    if (!authService.isAdmin()) return false;

    const strId = String(id);
    const records = this.getAllAnimeRecords();
    const filtered = records.filter((r) => String(r.id) !== strId);
    await this.saveAnimeRecords(filtered);

    try {
      await supabase.from('pending_animes').delete().eq('id', strId);
      await supabase.from('anime_list').delete().eq('id', strId);
    } catch (err) {
      try {
        await supabase.from('pending_animes').delete().match({ id: strId });
        await supabase.from('anime_list').delete().match({ id: strId });
      } catch (innerErr) {
        console.error('[Supabase Permanent Delete Exception]:', innerErr);
      }
    }

    this.notify();
    return true;
  }

  public async permanentlyDeleteLiveAnime(id: string): Promise<boolean> {
    if (!authService.isAdmin()) return false;

    const strId = String(id);
    try {
      await supabase.from('anime_list').delete().eq('id', strId);
      await supabase.from('pending_animes').delete().eq('id', strId);
    } catch (err) {
      try {
        await supabase.from('anime_list').delete().match({ id: strId });
        await supabase.from('pending_animes').delete().match({ id: strId });
      } catch (innerErr) {
        console.error('[Supabase Live Delete Exception]:', innerErr);
      }
    }

    const records = this.getAllAnimeRecords();
    const filtered = records.filter((r) => String(r.id) !== strId);
    await this.saveAnimeRecords(filtered);

    this.notify();
    return true;
  }

  public exportDatabaseToJson(): void {
    const data = this.getAllAnimeRecords();
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `anidub_catalog_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  public exportDatabaseBackup(): void {
    const backupData = {
      version: '2.0.0-supabase',
      exportedAt: new Date().toISOString(),
      totalRecords: this.animeRecords.length,
      records: this.animeRecords,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anidub_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public exportBackup(): void {
    this.exportDatabaseBackup();
  }

  public exportCsvCatalog(): void {
    const records = this.getAllAnimeRecords();
    const headers = ['id', 'title', 'rating', 'dubs', 'genres', 'episodes', 'releaseYear', 'synopsis', 'poster'];
    const rows = records.map(r => {
      const dubsStr = Array.isArray(r.dubs) ? r.dubs.join(', ') : (r.dubs || '');
      const genresStr = Array.isArray(r.genres) ? r.genres.join(', ') : (r.genres || '');
      const row = [
        r.id || '',
        r.title || '',
        r.rating ?? 0,
        dubsStr,
        genresStr,
        r.episodes ?? 12,
        r.releaseYear ?? 2024,
        r.synopsis || '',
        r.poster || ''
      ];
      return row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anidub_catalog_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public downloadCsvTemplate(): void {
    const headers = ['title', 'rating', 'dubs', 'genres', 'episodes', 'releaseYear', 'synopsis', 'poster'];
    const sampleRows = [
      ['Attack on Titan', '9.0', 'Hindi, Tamil, Telugu, English', 'Action, Drama, Fantasy', '25', '2013', 'After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans.', 'https://picsum.photos/seed/aot/600/900'],
      ['Demon Slayer', '8.7', 'Hindi, Tamil, Malayalam', 'Action, Supernatural, Shonen', '26', '2019', 'A family is attacked by demons and only two members survive - Tanjiro and his sister Nezuko, who is turning into a demon.', 'https://picsum.photos/seed/demonslayer/600/900']
    ];
    const rows = [headers.join(','), ...sampleRows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))];
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anidub_anime_import_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public parseCsvText(csvText: string): any[] {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f.length > 0)) {
        lines.push(currentRow);
      }
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const results: any[] = [];

    for (let r = 1; r < lines.length; r++) {
      const row = lines[r];
      const item: Record<string, any> = {};
      for (let c = 0; c < headers.length; c++) {
        const header = headers[c];
        const val = row[c] || '';

        if (['title', 'name', 'animetitle'].includes(header)) {
          item.title = val;
        } else if (['rating', 'score', 'globalrating', 'starrating'].includes(header)) {
          item.rating = parseFloat(val) || 0;
        } else if (['dubs', 'languages', 'dubbedin', 'audio'].includes(header)) {
          item.dubs = val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : ['Hindi'];
        } else if (['genres', 'genre', 'categories'].includes(header)) {
          item.genres = val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : ['Action'];
        } else if (['episodes', 'totalepisodes', 'eps'].includes(header)) {
          item.episodes = parseInt(val, 10) || 12;
        } else if (['releaseyear', 'year', 'season'].includes(header)) {
          item.releaseYear = parseInt(val, 10) || 2024;
        } else if (['description', 'synopsis', 'summary', 'overview'].includes(header)) {
          item.synopsis = val;
        } else if (['poster', 'posterurl', 'image', 'img', 'banner'].includes(header)) {
          item.poster = val;
        } else {
          item[headers[c]] = val;
        }
      }
      if (item.title) {
        results.push(item);
      }
    }

    return results;
  }

  public async importCsvFile(file: File): Promise<{ added: number; updated: number; failed: number; skipped: number; quotaHit: boolean; remaining: number }> {
    const text = await file.text();
    const parsedData = this.parseCsvText(text);
    if (!parsedData.length) {
      return { added: 0, updated: 0, failed: 1, skipped: 0, quotaHit: false, remaining: 0 };
    }
    return this.bulkImportAnime(parsedData);
  }

  public getAdminPendingUploads(): AnimeRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(ADMIN_PENDING_UPLOADS_KEY);
      return data ? JSON.parse(data) : [];
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
    skipped: number;
    quotaHit: boolean; 
    remaining: number 
  }> {
    const pending = this.getAdminPendingUploads();
    if (!pending.length) {
      return { added: 0, updated: 0, failed: 0, skipped: 0, quotaHit: false, remaining: 0 };
    }
    const res = await this.bulkImportAnime(pending);
    if (!res.quotaHit && res.remaining === 0) {
      this.clearAdminPendingUploads();
    }
    return res;
  }

  public async bulkImportAnime(jsonData: any[]): Promise<{ 
    added: number; 
    updated: number; 
    failed: number; 
    skipped: number;
    quotaHit: boolean; 
    remaining: number 
  }> {
    if (!Array.isArray(jsonData)) {
      return { added: 0, updated: 0, failed: 0, skipped: 0, quotaHit: false, remaining: 0 };
    }

    const existingById = new Map<string, AnimeRecord>();
    const existingByTitle = new Map<string, AnimeRecord>();

    if (this.animeRecords.length > 0) {
      this.animeRecords.forEach(a => {
        if (a.id) existingById.set(String(a.id), a);
        const title = (a.title || '').trim().toLowerCase();
        if (title) existingByTitle.set(title, a);
      });
    }

    const toUpsert: any[] = [];
    let added = 0;
    let updated = 0;
    let failed = 0;

    jsonData.forEach((item, idx) => {
      try {
        const rawTitle = (item.title || item.name || '').trim();
        if (!rawTitle) {
          failed++;
          return;
        }
        const lowerTitle = rawTitle.toLowerCase();

        // Match existing record by ID or by Title for upsert
        const existingMatch = (item.id && existingById.get(String(item.id))) || existingByTitle.get(lowerTitle);
        
        const id = existingMatch ? existingMatch.id : (item.id || `import_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`);

        if (existingMatch) {
          updated++;
        } else {
          added++;
        }

        const normalized = this.normalizeRecord({
          ...item,
          id,
          status: item.status || 'pending',
          submissionStatus: item.submissionStatus || 'pending',
          updatedAt: new Date().toISOString()
        });

        toUpsert.push(cleanSupabaseData(normalized));
      } catch (err) {
        failed++;
      }
    });

    if (toUpsert.length > 0) {
      try {
        const { error } = await supabase.from('pending_animes').upsert(toUpsert);
        if (error) {
          if (error.code === 'PGRST205') {
            console.info('[Supabase Info] pending_animes table not created yet. Using local IndexedDB cache.');
          } else {
            console.warn('[BulkImport] Supabase upsert notice:', error.message);
          }
        }
      } catch (e: any) {
        console.warn('[BulkImport] Supabase upsert error:', e);
      }

      // Merge into local state
      const records = this.getAllAnimeRecords();
      const recordMap = new Map(records.map(r => [r.id, r]));
      toUpsert.forEach(item => recordMap.set(item.id, item));
      this.animeRecords = Array.from(recordMap.values());
      await this.saveAnimeRecords(this.animeRecords);
    }

    return {
      added,
      updated,
      failed,
      skipped: 0,
      quotaHit: false,
      remaining: 0,
    };
  }

  public async syncUserPendingSubmissions(): Promise<{ synced: number; remaining: number }> {
    const rawQueue = localStorage.getItem(USER_PENDING_SUBMISSIONS_KEY);
    if (!rawQueue) return { synced: 0, remaining: 0 };

    let queue: AnimeRecord[] = [];
    try {
      queue = JSON.parse(rawQueue);
    } catch {
      return { synced: 0, remaining: 0 };
    }

    if (!Array.isArray(queue) || queue.length === 0) return { synced: 0, remaining: 0 };

    try {
      await supabase.from('pending_animes').upsert(queue.map(cleanSupabaseData));
      localStorage.removeItem(USER_PENDING_SUBMISSIONS_KEY);
      return { synced: queue.length, remaining: 0 };
    } catch (err: any) {
      console.warn('[Supabase Sync User Submissions Notice]:', err);
      return { synced: 0, remaining: queue.length };
    }
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

    // Update in Supabase
    try {
      await supabase
        .from('anime_list')
        .update({ likes: newLikes, upvotes: newLikes })
        .eq('id', id);
    } catch (e: any) {
      console.warn('Supabase upvote notice:', e);
    }

    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'upvote' }),
    }).catch(() => {});

    this.notify();
    return newLikes;
  }

  public async syncWithServer(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('anime_list')
        .select('*')
        .limit(200);

      if (data && data.length > 0) {
        const records = data.map(item => this.normalizeRecord(item));
        await this.saveAnimeRecords(records);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
          localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        }
      }
    } catch (e: any) {
      console.warn('[Supabase DB] Sync notice:', e);
    }
  }

  public async forceRefresh(): Promise<AnimeRecord[]> {
    await this.syncWithServer();
    return this.getApprovedAnime();
  }

  public getIsQuotaLimited(): boolean {
    return this.isQuotaLimited;
  }

  // --- 5. Dub Reviews Management with Supabase ---
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
      
      // Sync to Supabase reviews table
      try {
        await supabase.from('reviews').insert([cleanSupabaseData(newReview)]);
      } catch (sbErr) {
        console.warn('[Supabase Review Sync Notice]', sbErr);
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

  // --- 6. User Watchlist Persistence with Supabase ---
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

      fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, animeId, action: isAdded ? 'add' : 'remove' }),
      }).catch(err => console.warn('Watchlist sync notice:', err));

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
      
      if (newCollection.isPublic) {
        try {
          await supabase.from('collections').insert([cleanSupabaseData(newCollection)]);
        } catch {}
      }
      
      this.notify();
      return newCollection;
    } catch (e: any) {
      console.error('Error creating collection:', e);
      return newCollection;
    }
  }

  public async getPublicCollection(id: string): Promise<AnimeCollection | null> {
    try {
      const raw = localStorage.getItem(DB_COLLECTIONS_KEY);
      const all: AnimeCollection[] = raw ? JSON.parse(raw) : [];
      const local = all.find(c => c.id === id);
      if (local) return local;
    } catch {}

    try {
      const { data } = await supabase.from('collections').select('*').eq('id', id).maybeSingle();
      if (data) return data as AnimeCollection;
    } catch (e: any) {
      console.error('Error fetching collection from Supabase:', e);
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
}

export const dbService = new DatabaseService();
export default dbService;
