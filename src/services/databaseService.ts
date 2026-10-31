export type DubLanguage = 'Tamil' | 'Telugu' | 'Hindi' | 'Malayalam' | 'Kannada';

export interface AnimeRecord {
  id: number;
  title: string;
  japanese_title?: string;
  synopsis?: string;
  poster_url?: string;
  banner_url?: string;
  rating?: number;
  popularity?: number;
  episodes_count?: number;
  status?: string;
  release_season?: string;
  genres?: string;
  languages?: string;
  platform?: string;
  studio?: string;
  release_year?: number;
  created_at?: string;
  likesCount?: number;
}

export interface WatchlistEntry {
  id: number;
  user_id: string;
  anime_id: number;
  status?: string;
  created_at?: string;
}

export interface DubReview {
  id: number;
  anime_id: number;
  author: string;
  rating: number;
  language: string;
  comment: string;
  spoilers?: boolean;
  likes?: number;
  date?: string;
}

export interface CustomCollection {
  id: number;
  title: string;
  description?: string;
  anime_ids: number[];
  created_at?: string;
}
import { cloudflareApi } from './cloudflareApi';

type Listener = () => void;

class DatabaseService {
  private cache: AnimeRecord[] | null = null;
  private cacheTimestamp: number = 0;
  private cacheDuration: number = 60 * 1000; // 1 minute cache
  private listeners: Listener[] = []

  public subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  public async getApprovedAnime(force: boolean = false): Promise<AnimeRecord[]> {
    const now = Date.now();
    if (!force && this.cache && (now - this.cacheTimestamp < this.cacheDuration)) {
      return this.cache;
    }

    try {
      const { data } = await cloudflareApi.fetchCatalog({ limit: 100 });
      const rawItems = data || [];
      const items = rawItems.filter((item: any) => 
        item.status !== 'pending' && 
        item.submissionStatus !== 'pending'
      );
      this.cache = items;
      this.cacheTimestamp = now;
      return items;
    } catch (err) {
      console.error('getApprovedAnime error:', err);
      return this.cache || [];
    }
  }

  public async getAllAnimeRecords(): Promise<AnimeRecord[]> {
    return this.getApprovedAnime();
  }

  public async forceRefresh(): Promise<AnimeRecord[]> {
    return this.getApprovedAnime(true);
  }

  public async getApprovedAnimePaginated(cursor: number = 0, limit: number = 20): Promise<{ data: AnimeRecord[]; nextCursor: number | null }> {
    const all = await this.getApprovedAnime();
    const slice = all.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < all.length ? cursor + limit : null;
    return { data: slice, nextCursor };
  }

  public async searchApprovedAnime(
    query?: string,
    lang?: string,
    platform?: string,
    cursor: number = 0,
    limit: number = 20
  ): Promise<{ data: AnimeRecord[]; total: number }> {
    const all = await this.getApprovedAnime();
    const filtered = all.filter(anime => {
      const matchesQuery = !query || query.trim() === '' || 
        anime.title.toLowerCase().includes(query.toLowerCase()) ||
        (anime.genres && anime.genres.toLowerCase().includes(query.toLowerCase()));

      const matchesLang = !lang || lang === 'All' || 
        (anime.languages && anime.languages.toLowerCase().includes(lang.toLowerCase()));

      const matchesPlatform = !platform || platform === 'All Platforms' || 
        (anime.platform && anime.platform.toLowerCase().includes(platform.toLowerCase()));

      return matchesQuery && matchesLang && matchesPlatform;
    });

    const paginated = filtered.slice(cursor, cursor + limit);
    return { data: paginated, total: filtered.length };
  }

  public async getAnimeById(id: number): Promise<AnimeRecord | null> {
    try {
      const data = await cloudflareApi.getAnimeById(id);
      if (data) return data;
    } catch (err) {
      console.warn(`Failed to fetch anime by id ${id} from API, checking local cache:`, err);
    }

    const all = await this.getApprovedAnime();
    return all.find(a => a.id === id) || null;
  }

  public async toggleWatchlist(_userId: string, animeId: number): Promise<{ watchlisted: boolean }> {
    try {
      const { success, watchlisted } = await cloudflareApi.toggleWatchlist(animeId);
      if (success) {
        this.notifyListeners();
        return { watchlisted };
      }
    } catch (err) {
      console.error('toggleWatchlist error:', err);
    }
    this.notifyListeners();
    return { watchlisted: true };
  }

  public async toggleWatchlistStatus(userId: string, animeId: number): Promise<{ watchlisted: boolean }> {
    return this.toggleWatchlist(userId, animeId);
  }

  public async removeFromWatchlist(userId: string, animeId: number): Promise<void> {
    await this.toggleWatchlist(userId, animeId);
  }

  public async getUserWatchlist(_userId: string): Promise<WatchlistEntry[]> {
    try {
      return await cloudflareApi.fetchWatchlist() as WatchlistEntry[];
    } catch (err) {
      console.error('getUserWatchlist error:', err);
    }
    return [];
  }

  public async upvoteAnime(id: number): Promise<{ popularity: number }> {
    try {
      const data = await cloudflareApi.upvoteAnime(id);
      this.notifyListeners();
      return { popularity: data.popularity || 0 };
    } catch (err) {
      console.error('upvoteAnime error:', err);
    }
    this.notifyListeners();
    return { popularity: 1250 };
  }

  public async addReview(reviewData: Omit<DubReview, 'id' | 'date'>): Promise<DubReview> {
    try {
      const data = await cloudflareApi.submitReview(reviewData.anime_id, reviewData);
      if (data.success) {
        this.notifyListeners();
        return data as any;
      }
    } catch (err) {
      console.error('addReview error:', err);
    }
    const fallbackReview: DubReview = {
      id: Date.now(),
      ...reviewData,
      date: 'Just now',
      likes: 1
    };
    this.notifyListeners();
    return fallbackReview;
  }

  public async getReviewsForAnime(animeId: number): Promise<DubReview[]> {
    try {
      return await cloudflareApi.fetchReviews(animeId);
    } catch (err) {
      console.error('getReviewsForAnime error:', err);
    }
    return [];
  }

  public async submitDubInfo(animeData: any): Promise<any> {
    const payload = {
      ...animeData,
      status: 'pending',
      submissionStatus: 'pending'
    };
    const data = await cloudflareApi.createAnime(payload);
    this.notifyListeners();
    return data;
  }

  public async deleteAnime(animeId: any): Promise<void> {
    console.log('Deleting anime ID via Cloudflare API:', animeId);
    await cloudflareApi.deleteAnime(animeId);
    console.log('Deleted anime ID from Cloudflare D1:', animeId);
    this.notifyListeners();
  }

  public async updateAnimeStatus(animeId: any, status: string = 'approved'): Promise<any> {
    const data = await cloudflareApi.approveAnime(animeId);
    this.notifyListeners();
    return data;
  }

  public async clearAllData(): Promise<void> {
    try {
      localStorage.removeItem('cf_anime_watchlist');
      localStorage.removeItem('cf_anime_recently_viewed');
      localStorage.removeItem('cf_admin_token');
      this.cache = [];
      this.cacheTimestamp = 0;
      
      await cloudflareApi.resetDatabase();
    } catch (err) {
      console.error('clearAllData error:', err);
    }
    this.notifyListeners();
  }
}

export const dbService = new DatabaseService();

export const cleanFirestoreData = (data: any) => data;
