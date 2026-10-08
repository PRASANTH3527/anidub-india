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

// Helper to format AnimeRecord into exact Supabase 'animes' table columns
export function formatAnimeForSupabase(record: Partial<AnimeRecord>): Record<string, any> {
  const defaultCover = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
  const poster = (record.poster || (record as any).imageUrl || (record as any).image || '').trim() || defaultCover;
  const dubs = Array.isArray(record.dubs) && record.dubs.length > 0 ? record.dubs : ['Tamil'];
  const platforms = Array.isArray(record.platforms) && record.platforms.length > 0
    ? record.platforms
    : [{ name: 'Crunchyroll', url: 'https://www.crunchyroll.com', languages: dubs }];

  const rawStatus = String(record.status || (record as any).submissionStatus || (record as any).submission_status || 'pending').toLowerCase().trim();
  const modStatus = (rawStatus === 'approved' || rawStatus === 'rejected') ? rawStatus : 'pending';

  const row: Record<string, any> = {
    id: String(record.id),
    title: (record.title || 'Untitled').trim(),
    romaji_title: record.romajiTitle || (record as any).romaji_title || '',
    poster: poster,
    banner: (record.banner || '').trim() || poster,
    studio: record.studio || (record as any).animationStudio || 'Animation Studio',
    synopsis: record.synopsis || '',
    type: record.type || 'TV Series',
    episodes: Number(record.episodes) || 12,
    release_year: Number(record.releaseYear || (record as any).release_year) || new Date().getFullYear(),
    rating: Number(record.rating) || 0,
    genres: Array.isArray(record.genres) && record.genres.length > 0 ? record.genres : ['Action'],
    themes: Array.isArray(record.themes) ? record.themes : [],
    dubs: dubs,
    dub_details: record.dubDetails || (record as any).dub_details || [],
    platforms: platforms,
    season_details: record.seasonDetails || (record as any).season_details || [],
    airing_status: record.airingStatus || (record as any).airing_status || 'Completed',
    status: modStatus,
    submission_status: modStatus,
    submitted_at: record.submittedAt || (record as any).submitted_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_deleted: Boolean(record.isDeleted || (record as any).is_deleted),
    likes: Number(record.likes || (record as any).upvotes || 0),
    views: Number((record as any).views || 0),
  };
  return cleanSupabaseData(row);
}

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
      this.syncWithServer();
      this.syncLocalApprovedToSupabase();
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

    const defaultCover = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
    const poster = (data.poster || data.image || data.image_url || data.imageUrl || '').trim() || defaultCover;
    const banner = (data.banner || data.coverImage || '').trim() || poster;

    const platforms = rawPlatforms.length > 0
      ? rawPlatforms.map((p: any) => ({
          name: (p?.name || 'Crunchyroll') as StreamingPlatform,
          url: p?.url || 'https://www.crunchyroll.com',
          languages: mapLangs(p?.languages || dubs)
        }))
      : [{
          name: 'Crunchyroll' as StreamingPlatform,
          url: 'https://www.crunchyroll.com',
          languages: dubs.length > 0 ? dubs : ['Tamil']
        }];

    // Strict moderation status check
    const rawStatus = String(data.submission_status || data.submissionStatus || data.status || '').toLowerCase().trim();
    let modStatus: 'pending' | 'approved' | 'rejected' = 'approved';
    if (rawStatus === 'pending') {
      modStatus = 'pending';
    } else if (rawStatus === 'rejected') {
      modStatus = 'rejected';
    } else {
      modStatus = 'approved';
    }

    const normalized: AnimeRecord = {
      ...data,
      id: String(data.id),
      title,
      romajiTitle: (data.romajiTitle || data.romaji_title || data.japaneseTitle || '').trim(),
      poster,
      banner,
      studio: data.studio || data.animationStudio || data.animation_studio || 'Animation Studio',
      synopsis: data.synopsis || data.description || '',
      type: data.type || 'TV Series',
      episodes: Number(data.episodes) || 12,
      releaseYear: Number(data.releaseYear || data.release_year) || new Date().getFullYear(),
      rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : 0,
      genres: Array.isArray(data.genres) && data.genres.length > 0 ? data.genres : ['Action'],
      themes: Array.isArray(data.themes) ? data.themes : [],
      dubs: dubs.length > 0 ? dubs : ['Tamil'],
      dubDetails: Array.isArray(data.dubDetails) ? data.dubDetails : (data.dub_details || []),
      platforms,
      seasonDetails,
      airingStatus,
      status: modStatus,
      submissionStatus: modStatus,
      submittedAt: data.submittedAt || data.submitted_at || new Date().toISOString(),
      updatedAt: data.updatedAt || data.updated_at || new Date().toISOString(),
      isDeleted: data.is_deleted === true || data.is_deleted === 'true' || data.isDeleted === true || data.isDeleted === 'true',
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

  // --- 0. Sync Locally Approved Anime to Supabase ---
  public async syncLocalApprovedToSupabase(): Promise<void> {
    try {
      const approved = this.getApprovedAnime();
      if (!approved || approved.length === 0) return;

      for (const anime of approved) {
        if (anime.isDeleted || (anime as any).is_deleted === true) continue;
        const row = formatAnimeForSupabase(anime);
        row.status = 'approved';
        row.submission_status = 'approved';
        row.is_deleted = false;
        
        try {
          await supabase
            .from('animes')
            .upsert([row], { onConflict: 'id' });
        } catch {}
      }
    } catch (e) {
      // Non-blocking sync
    }
  }

  // --- 1. Paginated Queries with Aggressive 24h Local Caching & Supabase Range Pagination ---
  public async getApprovedAnimePaginated(
    lastDoc: any = null, 
    pageSize = 20, 
    forceRefresh = false
  ): Promise<{ items: AnimeRecord[], lastDoc: any, fromCache?: boolean }> {
    try {
      // 1. Check Local Cache (Only if fresh and not forceRefresh)
      const cacheTimestamp = typeof window !== 'undefined' ? localStorage.getItem(CACHE_TIMESTAMP_KEY) : null;
      const isCacheFresh = cacheTimestamp && (Date.now() - Number(cacheTimestamp)) < CACHE_TTL_MS;

      if (!forceRefresh && isCacheFresh && this.animeRecords.length > 0) {
        const approvedOnly = this.animeRecords
          .filter(a => a.status === 'approved' && !a.isDeleted)
          .sort((a, b) => a.title.localeCompare(b.title));

        if (approvedOnly.length > 0) {
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
      }

      // 2. Query Supabase animes table
      const startIndex = typeof lastDoc === 'number' ? lastDoc : (lastDoc?.id ? this.animeRecords.findIndex(a => a.id === lastDoc.id) + 1 : 0);
      const endIndex = startIndex + pageSize - 1;

      let { data, error } = await supabase
        .from('animes')
        .select('*')
        .or('is_deleted.eq.false,is_deleted.is.null')
        .or('status.ilike.approved,submission_status.ilike.approved,status.is.null')
        .order('title', { ascending: true })
        .range(startIndex, endIndex);

      // Always check anime_list to merge any additional approved records
      try {
        const fallbackRes = await supabase
          .from('anime_list')
          .select('*')
          .or('is_deleted.eq.false,is_deleted.is.null')
          .or('status.ilike.approved,submission_status.ilike.approved,status.is.null')
          .limit(100);

        if (fallbackRes.data && fallbackRes.data.length > 0) {
          if (!data || data.length === 0) {
            data = fallbackRes.data;
            error = null;
          } else {
            const currentIds = new Set(data.map((r: any) => String(r.id)));
            for (const row of fallbackRes.data) {
              if (!currentIds.has(String(row.id))) {
                data.push(row);
                currentIds.add(String(row.id));
              }
            }
          }
        }
      } catch (e) {
        // Non-blocking
      }

      if (error && (!data || data.length === 0)) {
        console.warn('[Supabase Service] Notice on select animes:', error.message);
        const approvedOnly = this.getApprovedAnime();
        const items = approvedOnly.slice(startIndex, startIndex + pageSize);
        return { items, lastDoc: null, fromCache: true };
      }

      let items = (data || [])
        .map(row => this.normalizeRecord(row))
        .filter(a => a.status === 'approved' && !a.isDeleted);

      // Cache live database state into IndexedDB
      if (items.length > 0) {
        const existingMap = new Map(this.animeRecords.map(a => [a.id, a]));
        items.forEach(item => existingMap.set(item.id, item));
        this.animeRecords = Array.from(existingMap.values()).filter(a => !a.isDeleted);
        await idbSet(DB_ANIME_KEY, this.animeRecords);
        if (typeof window !== 'undefined') {
          localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        }
      }

      const nextCursor = items.length >= pageSize ? (startIndex + items.length) : null;
      return { items, lastDoc: nextCursor, fromCache: false };
    } catch (err: any) {
      console.error('[Supabase Service] Error fetching approved anime with pagination:', err);
      const approvedOnly = this.getApprovedAnime();
      const items = approvedOnly.slice(0, pageSize);
      return { items, lastDoc: null, fromCache: true };
    }
  }

  public async searchApprovedAnime(
    searchQuery: string = '',
    selectedLang: string = 'All',
    selectedPlatform: string = 'All Platforms',
    lastDoc: any = null,
    pageSize = 30
  ): Promise<{ items: AnimeRecord[], lastDoc: any }> {
    try {
      const startIndex = typeof lastDoc === 'number' ? lastDoc : 0;
      const endIndex = startIndex + pageSize - 1;

      let query = supabase
        .from('animes')
        .select('*')
        .or('is_deleted.eq.false,is_deleted.is.null')
        .or('status.ilike.approved,submission_status.ilike.approved,status.is.null');

      if (searchQuery && searchQuery.trim() !== '') {
        query = query.ilike('title', `%${searchQuery.trim()}%`);
      }

      if (selectedLang && selectedLang !== 'All') {
        query = query.contains('dubs', [selectedLang]);
      }

      let { data, error } = await query
        .order('title', { ascending: true })
        .range(startIndex, endIndex);

      // Also merge any approved titles from anime_list that might not be in animes
      try {
        let fallbackQuery = supabase
          .from('anime_list')
          .select('*')
          .or('is_deleted.eq.false,is_deleted.is.null')
          .or('status.ilike.approved,submission_status.ilike.approved,status.is.null');

        if (searchQuery && searchQuery.trim() !== '') {
          fallbackQuery = fallbackQuery.ilike('title', `%${searchQuery.trim()}%`);
        }
        if (selectedLang && selectedLang !== 'All') {
          fallbackQuery = fallbackQuery.contains('dubs', [selectedLang]);
        }

        const fallbackRes = await fallbackQuery
          .order('title', { ascending: true })
          .limit(100);

        if (fallbackRes.data && fallbackRes.data.length > 0) {
          if (!data || data.length === 0) {
            data = fallbackRes.data;
          } else {
            const currentIds = new Set(data.map((r: any) => String(r.id)));
            for (const row of fallbackRes.data) {
              if (!currentIds.has(String(row.id))) {
                data.push(row);
                currentIds.add(String(row.id));
              }
            }
          }
        }
      } catch (e) {
        // Non-blocking
      }

      let items = (data || [])
        .map(row => this.normalizeRecord(row))
        .filter(a => a.status === 'approved' && !a.isDeleted);

      // Filter by platform in JavaScript to safely handle JSONB objects
      if (selectedPlatform && selectedPlatform !== 'All' && selectedPlatform !== 'All Platforms') {
        const target = selectedPlatform.toLowerCase();
        items = items.filter(a => a.platforms?.some(p => {
          const pName = typeof p === 'string' ? p : p?.name;
          return pName && pName.toLowerCase().includes(target);
        }));
      }

      const nextCursor = items.length >= pageSize ? (startIndex + items.length) : null;
      return { items, lastDoc: nextCursor };
    } catch (err) {
      console.warn('[Supabase Search Error]:', err);
      let approvedOnly = this.getApprovedAnime();
      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        approvedOnly = approvedOnly.filter(a => a.title.toLowerCase().includes(q));
      }
      if (selectedLang && selectedLang !== 'All') {
        approvedOnly = approvedOnly.filter(a => a.dubs?.includes(selectedLang as any));
      }
      if (selectedPlatform && selectedPlatform !== 'All' && selectedPlatform !== 'All Platforms') {
        approvedOnly = approvedOnly.filter(a => a.platforms?.some(p => (typeof p === 'string' ? p : p?.name)?.toLowerCase().includes(selectedPlatform.toLowerCase())));
      }
      const items = approvedOnly.slice(0, pageSize);
      return { items, lastDoc: null };
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

      // 1. Query animes table for status = status or submission_status = status (case-insensitive)
      let { data, error } = await supabase
        .from('animes')
        .select('*')
        .or(`status.ilike.${status},submission_status.ilike.${status}`)
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('updated_at', { ascending: false })
        .range(startIndex, endIndex);

      // 2. Also check pending_animes if status is pending
      if (status === 'pending') {
        try {
          const pendingRes = await supabase
            .from('pending_animes')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50);
          if (pendingRes.data && pendingRes.data.length > 0) {
            if (!data || data.length === 0) {
              data = pendingRes.data;
              error = null;
            } else {
              const currentIds = new Set(data.map((r: any) => String(r.id)));
              for (const row of pendingRes.data) {
                if (!currentIds.has(String(row.id))) {
                  data.push(row);
                  currentIds.add(String(row.id));
                }
              }
            }
          }
        } catch {}
      }

      const localSubmissions = status === 'pending' ? this.getPendingSubmissions() : this.getRejectedSubmissions();
      const dbItems = (data || [])
        .map(row => this.normalizeRecord(row))
        .filter(a => a.status === status && !a.isDeleted);

      // Merge database items and local submissions, deduplicated by ID
      const mergedMap = new Map<string, AnimeRecord>();
      // First populate with local submissions so all pending items are preserved
      localSubmissions.forEach(item => mergedMap.set(String(item.id), item));
      // Then overlay/update with fresh database items
      dbItems.forEach(item => mergedMap.set(String(item.id), item));

      const mergedList = Array.from(mergedMap.values()).filter(a => a.status === status && !a.isDeleted);
      const items = mergedList.slice(startIndex, startIndex + pageSize);
      const nextCursor = (startIndex + items.length < mergedList.length) ? (startIndex + items.length) : null;
      return { items, lastDoc: nextCursor };
    } catch (err: any) {
      const all = status === 'pending' ? this.getPendingSubmissions() : this.getRejectedSubmissions();
      const items = all.slice(0, pageSize);
      return { items, lastDoc: null };
    }
  }

  public getApprovedAnime(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.status === 'approved' && !a.isDeleted);
  }

  public getPendingSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.status === 'pending' && !a.isDeleted);
  }

  public getRejectedSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.status === 'rejected' && !a.isDeleted);
  }

  public getDeletedSubmissions(): AnimeRecord[] {
    const all = this.getAllAnimeRecords();
    return all.filter((a) => a.isDeleted === true);
  }

  public async getDeletedSubmissionsFromDb(): Promise<AnimeRecord[]> {
    try {
      const { data, error } = await supabase
        .from('animes')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });

      if (data && data.length > 0) {
        return data.map(r => this.normalizeRecord(r));
      }
      return this.getDeletedSubmissions();
    } catch {
      return this.getDeletedSubmissions();
    }
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

  // --- 3. User Submission: Saves directly to Supabase animes as 'pending' for Admin review ---
  public async submitDubInfo(data: Omit<AnimeRecord, 'id' | 'submissionStatus' | 'submittedAt'>): Promise<AnimeRecord> {
    const id = ('anime-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6));
    const newRecord: AnimeRecord = {
      ...data,
      id,
      status: 'pending',
      submissionStatus: 'pending',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dbRow = formatAnimeForSupabase(newRecord);
    dbRow.status = 'pending';
    dbRow.submission_status = 'pending';

    try {
      const { error } = await supabase
        .from('animes')
        .insert([dbRow]);
      if (error) {
        console.warn('[Supabase Insert animes Notice]:', error.message);
      }
    } catch (err: any) {
      console.warn('[Supabase Insert animes Exception]:', err);
    }

    try {
      await supabase
        .from('pending_animes')
        .insert([dbRow]);
    } catch (err: any) {
      // Non-blocking fallback
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
        const { data } = await supabase.from('animes').select('*').eq('id', id).maybeSingle();
        if (data) anime = this.normalizeRecord(data);
      } catch {}
    }

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

    const dbRow = formatAnimeForSupabase(approvedRecord);
    dbRow.status = 'approved';
    dbRow.submission_status = 'approved';
    dbRow.is_deleted = false;

    // 1. Update/Upsert into Supabase animes table
    try {
      const { error: animesErr } = await supabase
        .from('animes')
        .upsert([dbRow], { onConflict: 'id' });

      if (animesErr) {
        console.warn('[Supabase Approval upsert animes notice]:', animesErr.message);
        await supabase
          .from('animes')
          .update({
            status: 'approved',
            submission_status: 'approved',
            is_deleted: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }
    } catch (e: any) {
      console.warn('[Supabase animes approval error]:', e);
    }

    // 2. Also upsert into anime_list table for backwards compatibility
    try {
      await supabase
        .from('anime_list')
        .upsert([dbRow], { onConflict: 'id' });
    } catch (e: any) {
      console.warn('[Supabase anime_list approval error]:', e);
    }

    // 3. Remove from Supabase pending_animes table
    try {
      await supabase.from('pending_animes').delete().eq('id', id);
    } catch {}

    // 4. Update local cache
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

    // Sync rejection to Supabase animes and pending_animes
    try {
      await supabase
        .from('animes')
        .update({
          status: 'rejected',
          submission_status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch (e: any) {
      console.warn('Supabase animes rejection notice:', e);
    }

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

    // Sync update to Supabase animes and anime_list
    const row = formatAnimeForSupabase(records[targetIndex]);
    try {
      await supabase
        .from('animes')
        .upsert([row], { onConflict: 'id' });
    } catch (e: any) {
      console.warn('Supabase animes update sync notice:', e);
    }

    try {
      await supabase
        .from('anime_list')
        .upsert([row], { onConflict: 'id' });
    } catch (e: any) {
      console.warn('Supabase anime_list update sync notice:', e);
    }

    fetch('/api/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'update', data: updatedData }),
    }).catch(() => {});

    return true;
  }

  public async deleteSubmission(id: string): Promise<boolean> {
    if (!authService.isAdmin()) {
      throw new Error('Unauthorized: Admin privileges required to soft-delete anime.');
    }

    const strId = String(id);
    let updateSuccess = false;
    let lastError: any = null;

    let { data, error } = await supabase
      .from('animes')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', strId)
      .select('id, is_deleted');

    if (!error && data && data.length > 0) {
      updateSuccess = true;
    } else {
      lastError = error;
      if (!isNaN(Number(strId))) {
        const numRes = await supabase
          .from('animes')
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq('id', Number(strId))
          .select('id, is_deleted');
        if (!numRes.error && numRes.data && numRes.data.length > 0) {
          updateSuccess = true;
          error = null;
          lastError = null;
        } else if (numRes.error) {
          lastError = numRes.error;
        }
      }
    }

    if (!updateSuccess) {
      const errMsg = lastError?.message || lastError?.details || 'Record not found in Supabase or soft-delete blocked by database permissions.';
      console.error('[Supabase Soft Delete Error]:', errMsg, lastError);
      throw new Error(errMsg);
    }

    // Update local cache
    this.animeRecords = this.animeRecords.map((r) =>
      String(r.id) === strId ? { ...r, isDeleted: true, updatedAt: new Date().toISOString() } : r
    );
    await idbSet(DB_ANIME_KEY, this.animeRecords);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }

    this.notify();
    return true;
  }

  public async restoreSubmission(id: string): Promise<boolean> {
    if (!authService.isAdmin()) {
      throw new Error('Unauthorized: Admin privileges required to restore anime.');
    }

    const strId = String(id);
    let updateSuccess = false;
    let lastError: any = null;

    let { data, error } = await supabase
      .from('animes')
      .update({ is_deleted: false, updated_at: new Date().toISOString() })
      .eq('id', strId)
      .select('id, is_deleted');

    if (!error && data && data.length > 0) {
      updateSuccess = true;
    } else {
      lastError = error;
      if (!isNaN(Number(strId))) {
        const numRes = await supabase
          .from('animes')
          .update({ is_deleted: false, updated_at: new Date().toISOString() })
          .eq('id', Number(strId))
          .select('id, is_deleted');
        if (!numRes.error && numRes.data && numRes.data.length > 0) {
          updateSuccess = true;
          error = null;
          lastError = null;
        } else if (numRes.error) {
          lastError = numRes.error;
        }
      }
    }

    if (!updateSuccess) {
      const errMsg = lastError?.message || lastError?.details || 'Record not found in Supabase or restore blocked by database permissions.';
      console.error('[Supabase Restore Error]:', errMsg, lastError);
      throw new Error(errMsg);
    }

    this.animeRecords = this.animeRecords.map((r) =>
      String(r.id) === strId ? { ...r, isDeleted: false, updatedAt: new Date().toISOString() } : r
    );
    await idbSet(DB_ANIME_KEY, this.animeRecords);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }

    this.notify();
    return true;
  }

  public async permanentlyDeleteSubmission(id: string): Promise<boolean> {
    return this.permanentlyDeleteLiveAnime(id);
  }

  public async permanentlyDeleteLiveAnime(id: string): Promise<boolean> {
    if (!authService.isAdmin()) {
      throw new Error('Unauthorized: Admin privileges required to delete anime.');
    }

    const strId = String(id);
    let supabaseSuccess = false;
    let lastError: any = null;

    // Optional cleanup of child relations (non-blocking if tables do not exist)
    try {
      await supabase.from('dub_reviews').delete().eq('anime_id', strId);
    } catch {}
    try {
      await supabase.from('reviews').delete().eq('anime_id', strId);
    } catch {}
    try {
      await supabase.from('watchlists').delete().eq('anime_id', strId);
    } catch {}

    // 1. Attempt Hard Delete with .select('id') to verify rows actually deleted
    let { data: hardData, error: hardErr } = await supabase
      .from('animes')
      .delete()
      .eq('id', strId)
      .select('id');

    // If string ID didn't match and ID is numeric, also try numeric ID
    if (!hardErr && (!hardData || hardData.length === 0) && !isNaN(Number(strId))) {
      const numHard = await supabase
        .from('animes')
        .delete()
        .eq('id', Number(strId))
        .select('id');
      if (!numHard.error && numHard.data && numHard.data.length > 0) {
        hardData = numHard.data;
        hardErr = null;
      }
    }

    if (!hardErr && hardData && hardData.length > 0) {
      // Hard delete genuinely succeeded and removed the row!
      supabaseSuccess = true;
    } else {
      // Hard delete was either blocked by RLS (0 rows returned or error) or foreign key constraint
      lastError = hardErr;
      console.warn('[Supabase Hard Delete Notice]:', hardErr?.message || '0 rows deleted with hard delete, attempting soft delete fallback...');

      // 2. Fallback to Soft Delete: set is_deleted = true in Supabase 'animes'
      let { data: softData, error: softErr } = await supabase
        .from('animes')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', strId)
        .select('id, is_deleted');

      if (!softErr && (!softData || softData.length === 0) && !isNaN(Number(strId))) {
        const numSoft = await supabase
          .from('animes')
          .update({
            is_deleted: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', Number(strId))
          .select('id, is_deleted');
        if (!numSoft.error && numSoft.data && numSoft.data.length > 0) {
          softData = numSoft.data;
          softErr = null;
        } else if (numSoft.error) {
          softErr = numSoft.error;
        }
      }

      if (!softErr && softData && softData.length > 0) {
        supabaseSuccess = true;
        lastError = null;
      } else {
        lastError = softErr || hardErr;
      }
    }

    // 3. Strictly verify success: if Supabase rejected both hard and soft delete, throw the exact error
    if (!supabaseSuccess) {
      const errMsg =
        lastError?.message ||
        lastError?.details ||
        lastError?.hint ||
        'Database deletion failed in Supabase. Check table permissions (RLS) or foreign key constraints.';
      console.error('[Supabase Delete Fatal Error]:', errMsg, lastError);
      throw new Error(errMsg);
    }

    // 4. Update local cache ONLY AFTER Supabase genuinely succeeds
    this.animeRecords = this.animeRecords.filter((r) => String(r.id) !== strId);
    await idbSet(DB_ANIME_KEY, this.animeRecords);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }

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
      // 1. Fetch from live animes table
      let { data, error } = await supabase
        .from('animes')
        .select('*')
        .limit(200);

      // 2. Also check anime_list to merge any additional records
      try {
        const fallbackRes = await supabase
          .from('anime_list')
          .select('*')
          .limit(200);
        if (fallbackRes.data && fallbackRes.data.length > 0) {
          if (!data || data.length === 0) {
            data = fallbackRes.data;
          } else {
            const currentIds = new Set(data.map((r: any) => String(r.id)));
            for (const row of fallbackRes.data) {
              if (!currentIds.has(String(row.id))) {
                data.push(row);
                currentIds.add(String(row.id));
              }
            }
          }
        }
      } catch (e) {
        // Non-blocking
      }

      if (data && data.length > 0) {
        const records = data.map(item => this.normalizeRecord(item));
        const mergedMap = new Map(this.animeRecords.map(a => [String(a.id), a]));
        records.forEach(item => mergedMap.set(String(item.id), item));
        await this.saveAnimeRecords(Array.from(mergedMap.values()));
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
