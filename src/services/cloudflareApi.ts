/**
 * ============================================================================
 * CLOUDFLARE API CLIENT (Workers + D1 / KV CRUD Service)
 * ============================================================================
 * 
 * Provides unified, production-grade CRUD methods for interacting with
 * Cloudflare Workers and D1 database.
 */

import {
  CLOUDFLARE_API_URL,
  getCloudflareUrl,
  CLOUDFLARE_ENDPOINTS,
  DEFAULT_FALLBACK_WORKER_URL,
  CHAT_WORKER_HTTP_URL,
} from '../config/cloudflare';
import { getClerkSessionToken } from '../lib/clerk';
import {
  normalizeWatchlistIds,
  readWatchlistFromStorage,
  toggleWatchlistIdLocally,
  writeWatchlistToStorage,
} from '../utils/watchlist';

export interface PartnerEntry {
  name?: string;
  platform?: string;
  url?: string;
  languages?: string[];
  title?: string;
  type?: string;
  episodeCount?: number | string | null;
}

export interface MixedEntry {
  type?: string;
  name?: string;
  episodes?: number | string | null;
  episodeCount?: number | string | null;
}

export interface AnimePayload {
  id?: number | string;
  _id?: number | string;
  anime_id?: number | string;
  title: string;
  hindiTitle?: string;
  slug?: string;
  synopsis?: string;
  description?: string;
  cover_image?: string;
  banner_image?: string;
  posterUrl?: string;
  poster_url?: string;
  poster?: string;
  image?: string;
  rating?: number | string | null;
  popularity?: number;
  likes?: number;
  likesCount?: number;
  episodes_count?: number | null;
  episodes?: number | null;
  episode_count?: number | null;
  status?: string;
  airing_status?: string;
  submissionStatus?: string;
  approval_status?: string;
  is_published?: boolean | number;
  season?: string | null;
  year?: number | null;
  releaseYear?: number;
  release_year?: number;
  genres?: string;
  genre?: string;
  languages?: string | string[];
  platform?: string;
  platforms?: string[] | PartnerEntry[] | string;
  watch_url?: string;
  streamUrl?: string;
  type?: string;
  Type?: string;
  studio?: string;
  episodes_per_season?: string;
  mixedEntries?: MixedEntry[] | string;
  mixed_entries?: MixedEntry[] | string;
  streamingPartners?: PartnerEntry[] | string;
  streaming_partners?: PartnerEntry[] | string;
  platforms_data?: Record<string, unknown> | PartnerEntry[] | string;
  watch_providers?: PartnerEntry[] | string;
  hindi?: boolean;
  tamil?: boolean;
  telugu?: boolean;
  imdbID?: string;
  imdb_id?: string;
  imdbId?: string;
  community_rating?: number;
  communityRating?: number;
  community_votes?: number;
  communityVotes?: number;
  user_rating?: number | null;
  userRating?: number | null;
  reviews?: AnimeReviewResponse[];
  broadcast_day?: string | null;
  broadcast_time?: string | null;
  current_season?: string | null;
  live_episode?: number | null;
  releaseDay?: string;
  airTime?: string;
  season_episode_count?: string;
  official_source_url?: string;
  last_verified_at?: string | null;
  franchise_id?: string;
  relation_type?: string;
  sequence_number?: number | null;
  franchise_entries?: Array<{
    id: number | string;
    title: string;
    slug?: string;
    cover_image?: string;
    year?: number | null;
    type?: string;
    languages?: string;
    relation_type?: string;
    sequence_number?: number | null;
    status?: string;
  }>;
  created_at?: string;
}

export interface AnimeReviewPayload {
  rating?: number;
  language?: string;
  comment?: string;
  spoiler?: boolean;
  spoilers?: boolean;
  is_spoiler?: boolean;
  user_name?: string;
  user_avatar?: string;
}

export interface AnimeReviewResponse {
  id: number;
  anime_id: number;
  user_id?: string;
  author?: string;
  user_name?: string;
  user_avatar?: string;
  rating: number;
  language?: string;
  comment?: string;
  is_spoiler?: boolean;
  spoilers?: boolean;
  likes?: number;
  date?: string;
  created_at?: string;
}

export interface DubUpdateRecord {
  id: number;
  anime_id: number | null;
  anime_title: string;
  update_type: string;
  summary: string;
  created_at: string;
}

export interface InAppAlertRecord {
  id: number;
  anime_id: number | null;
  anime_title: string;
  update_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminLinkCheckItem {
  animeId: number;
  title: string;
  platform: string;
  url: string;
  status: 'Active' | 'Redirected' | 'Broken' | 'Region-restricted' | 'Unverified';
  httpStatus: number | null;
  detail: string;
}

export interface AdminLinkCheckResponse {
  success: boolean;
  checkedAt?: string;
  note?: string;
  error?: string;
  summary?: {
    total: number;
    active: number;
    redirected: number;
    broken: number;
    regionRestricted: number;
    unverified: number;
  };
  results: AdminLinkCheckItem[];
}

export interface FeedbackSubmitPayload {
  name?: string;
  email?: string;
  feedback?: string;
  message?: string;
  type?: string;
  website?: string;
}

export interface FeedbackRecord {
  id: number | string;
  name?: string;
  email?: string;
  feedback: string;
  type?: string;
  status?: string;
  created_at?: string;
}

export interface ChatMessagePayload {
  id?: string | number;
  type?: string;
  token?: string;
  user?: string;
  username?: string;
  user_name?: string;
  user_avatar?: string;
  avatar?: string;
  message?: string;
  text?: string;
  room?: string;
  time?: string;
  timestamp?: number | string;
  reactions?: Record<string, string[]>;
  isAdmin?: boolean;
  isReview?: boolean;
  rating?: number | null;
  language?: string | null;
  clerk_user_id?: string;
  user_id?: string;
  userId?: string;
  reply_to_id?: string | number;
  reply_to_user?: string;
  reply_to_message?: string;
  is_spoiler?: boolean;
}

export interface ChatMessageRecord extends ChatMessagePayload {
  user_id?: string;
  created_at?: string;
  is_admin?: boolean | number;
}

export interface TelegramStatusResponse {
  configured: boolean;
  hasToken?: boolean;
  hasChatId?: boolean;
  chatIdMasked?: string;
  chatId?: string;
  error?: string;
}

export interface HttpStatusError extends Error {
  status?: number;
  statusText?: string;
  alreadyVoted?: boolean;
  rawMessage?: string;
  url?: string;
}

export interface FetchCatalogOptions {
  page?: number;
  limit?: number;
  search?: string;
  language?: string;
  genre?: string;
  platform?: string;
  platforms?: string[];
  type?: string;
  status?: string;
  episodeLength?: string;
  minRating?: number;
  fullyDubbed?: boolean;
  freeLegal?: boolean;
  sort?: string;
  includePending?: boolean;
  fresh?: boolean;
  locale?: string;
  signal?: AbortSignal;
}

export interface AnimeTranslationItem {
  id: number;
  anime_id: string;
  locale: string;
  localized_title: string | null;
  synopsis: string | null;
  description: string | null;
  source_hash: string | null;
  translation_status: 'draft' | 'reviewed' | 'published';
  updated_by: string | null;
  is_locked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocaleCoverageItem {
  locale: string;
  totalAnime: number;
  published: number;
  reviewed: number;
  draft: number;
  missing: number;
  outdated: number;
  percentPublished: number;
}

export interface AdminTranslationsResponse {
  success: boolean;
  tableReady: boolean;
  notice?: string;
  totalAnime: number;
  translations: AnimeTranslationItem[];
  coverage: LocaleCoverageItem[];
  animeSourceHashes: Record<string, string>;
}

export interface CatalogMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CatalogSummary {
  totalAnime: number;
  totalVotes: number;
  totalLanguages: number;
  airingCount?: number;
  languagesList: string[];
  languagesString: string;
  languageFilters?: { label: string; value: string; count: number }[];
}

class CloudflareApiService {
  private catalogIndexCache: AnimePayload[] | null = null;
  private catalogIndexCachedAt = 0;
  private catalogIndexPromise: Promise<AnimePayload[]> | null = null;
  private readonly CATALOG_INDEX_TTL_MS = 2 * 60 * 1000;

  /**
   * Performs a fetch with automatic absolute URL fallback for robustness.
   * If a relative path request fails (due to missing Pages Functions), 
   * it retries using the hardcoded absolute Worker URL.
   */
  private async smartFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = getCloudflareUrl(path);
    const isRelative = !url.startsWith('http://') && !url.startsWith('https://');
    const mergedHeaders: Record<string, string> = {
      ...(options.headers as Record<string, string> | undefined),
    };

    if (!mergedHeaders['Authorization'] && !mergedHeaders['authorization']) {
      const clerkJwt = await getClerkSessionToken();
      if (clerkJwt) {
        mergedHeaders['Authorization'] = `Bearer ${clerkJwt}`;
      }
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers: mergedHeaders,
      cache: 'no-store',
      credentials: options.credentials || (isRelative ? 'same-origin' : 'include')
    };
    
    try {
      const res = await fetch(url, fetchOptions);
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');

      // If valid JSON response, return immediately (whether 2xx or 4xx/5xx error JSON)
      if (isJson) {
        return res;
      }

      // Check if response is an HTML interstitial (e.g. Google Cloud Run cookie check, Cloudflare challenge, or 404/502 HTML)
      const text = await res.clone().text().catch(() => '');
      const isHtml = contentType.includes('text/html') || 
                     text.includes('<!doctype') || 
                     text.includes('<html') || 
                     text.includes('Cookie check');

      if (isHtml) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Backend proxy returned an HTML page instead of JSON. Ensure session cookies or API workers are available.',
            data: [],
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (res.ok) {
        return res;
      }

      return res;
    } catch (err: any) {
      if (err?.name === 'AbortError' || options.signal?.aborted) {
        throw err;
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: err?.message || 'Network error communicating with backend API',
          data: [],
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Generates standard JSON headers; Clerk Bearer JWT is attached automatically in smartFetch.
   */
  private getHeaders(_includeAuth: boolean = false): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * READ: Fetches paginated anime catalog from Cloudflare Worker / D1
   */
  public async fetchCatalog(options: FetchCatalogOptions = {}): Promise<{
    ok: boolean;
    status: 'success' | 'empty' | 'error' | 'offline';
    error: string | null;
    data: AnimePayload[];
    meta: CatalogMeta;
    summary?: CatalogSummary | null;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const requestedPage = Math.max(1, options.page || 1);
    const requestedLimit = Math.max(1, options.limit || 12);

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(requestedPage));
    queryParams.set('limit', String(requestedLimit));
    if (options.search && options.search.trim()) queryParams.set('search', options.search.trim());
    if (options.language && options.language !== 'All') queryParams.set('language', options.language);
    if (options.genre && options.genre !== 'All' && options.genre !== 'All Genres') queryParams.set('genre', options.genre);
    if (options.platform && options.platform !== 'All' && options.platform !== 'All Platforms') queryParams.set('platform', options.platform);
    if (options.platforms && options.platforms.length > 0) queryParams.set('platforms', options.platforms.join(','));
    if (options.type && options.type !== 'All' && options.type !== 'All Types') queryParams.set('type', options.type);
    if (options.status && options.status !== 'All' && options.status !== 'All Status') queryParams.set('status', options.status);
    if (options.episodeLength && options.episodeLength !== 'any') queryParams.set('episodeLength', options.episodeLength);
    if (options.minRating && options.minRating > 0) queryParams.set('minRating', String(options.minRating));
    if (options.fullyDubbed) queryParams.set('fullyDubbed', 'true');
    if (options.freeLegal) queryParams.set('freeLegal', 'true');
    if (options.sort) queryParams.set('sort', options.sort);
    if (options.includePending) queryParams.set('includePending', 'true');
    if (options.locale && options.locale !== 'en') queryParams.set('locale', options.locale);
    if (options.fresh || options.includePending) {
      queryParams.set('fresh', '1');
      queryParams.set('_t', String(Date.now()));
    }

    const qs = queryParams.toString();
    const endpoint = `${CLOUDFLARE_ENDPOINTS.CATALOG}${qs ? `?${qs}` : ''}`;
    const url = getCloudflareUrl(endpoint);

    const fallbackMeta: CatalogMeta = {
      currentPage: requestedPage,
      totalPages: 1,
      totalItems: 0,
      limit: requestedLimit,
      hasNextPage: false,
      hasPrevPage: requestedPage > 1,
    };

    const isBrowserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

    if (isBrowserOffline()) {
      return {
        ok: false,
        status: 'offline',
        error: 'You appear to be offline. Reconnect to the internet and retry.',
        data: [],
        meta: fallbackMeta,
        summary: null,
        total: 0,
        page: requestedPage,
        totalPages: 1,
      };
    }

    let res: Response;
    try {
      res = await this.smartFetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(Boolean(options.includePending)),
        signal: options.signal,
      });
    } catch (networkErr: any) {
      if (networkErr?.name === 'AbortError' || options.signal?.aborted) {
        throw networkErr;
      }
      const offline = isBrowserOffline();
      return {
        ok: false,
        status: offline ? 'offline' : 'error',
        error: offline
          ? 'You appear to be offline. Check your connection and try again.'
          : networkErr?.message || 'Unable to reach the catalog server. Please try again.',
        data: [],
        meta: fallbackMeta,
        summary: null,
        total: 0,
        page: requestedPage,
        totalPages: 1,
      };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let serverMsg = '';
      try {
        const parsedErr = JSON.parse(errText);
        serverMsg = parsedErr.error || parsedErr.message || '';
      } catch {
        serverMsg = errText.slice(0, 140);
      }
      console.warn(`[API Notice] GET ${url} received status ${res.status}: ${errText}.`);
      return {
        ok: false,
        status: 'error',
        error: serverMsg || `Catalog server returned HTTP ${res.status}. Please retry.`,
        data: [],
        meta: fallbackMeta,
        summary: null,
        total: 0,
        page: requestedPage,
        totalPages: 1,
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      console.warn(`[API Notice] Received non-JSON content type (${contentType}) from ${url}.`);
      return {
        ok: false,
        status: 'error',
        error: 'Catalog API returned an unexpected response format. Please retry.',
        data: [],
        meta: fallbackMeta,
        summary: null,
        total: 0,
        page: requestedPage,
        totalPages: 1,
      };
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      return {
        ok: false,
        status: 'error',
        error: 'Failed to parse catalog response. Please retry.',
        data: [],
        meta: fallbackMeta,
        summary: null,
        total: 0,
        page: requestedPage,
        totalPages: 1,
      };
    }

    const data = json?.data || (Array.isArray(json) ? json : []);
    const rawMeta = json?.meta || {};
    const rawPag = json?.pagination || {};

    const currentPage = Number(rawMeta.currentPage ?? rawPag.page ?? requestedPage) || 1;
    const totalItems = Number(rawMeta.totalItems ?? rawPag.total ?? data.length) || 0;
    const resolvedLimit = Number(rawMeta.limit ?? rawPag.limit ?? requestedLimit) || requestedLimit;
    const totalPages = Math.max(1, Number(rawMeta.totalPages ?? rawPag.totalPages ?? Math.ceil(totalItems / resolvedLimit)) || 1);

    const meta: CatalogMeta = {
      currentPage,
      totalPages,
      totalItems,
      limit: resolvedLimit,
      hasNextPage: rawMeta.hasNextPage !== undefined ? Boolean(rawMeta.hasNextPage) : currentPage < totalPages,
      hasPrevPage: rawMeta.hasPrevPage !== undefined ? Boolean(rawMeta.hasPrevPage) : currentPage > 1,
    };

    return {
      ok: true,
      status: data.length === 0 ? 'empty' : 'success',
      error: null,
      data,
      meta,
      summary: json?.summary || null,
      total: meta.totalItems,
      page: meta.currentPage,
      totalPages: meta.totalPages,
    };
  }

  /**
   * READ BY IDS: Fetches full anime details for an array of saved IDs directly from D1 (bypasses pagination caps)
   */
  public async fetchAnimeByIds(ids: (number | string)[]): Promise<AnimePayload[]> {
    const cleanIds = Array.from(
      new Set(
        (ids || [])
          .map((raw) => Number(raw))
          .filter((n) => Number.isInteger(n) && n > 0)
      )
    );
    if (cleanIds.length === 0) return [];

    try {
      const endpoint = `${CLOUDFLARE_ENDPOINTS.CATALOG}?ids=${encodeURIComponent(cleanIds.join(','))}`;
      const res = await this.smartFetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(false),
      });
      if (!res.ok) return [];
      const json = await res.json().catch(() => ({ data: [] }));
      if (Array.isArray(json.data)) return json.data;
      if (Array.isArray(json)) return json;
    } catch (err) {
      console.warn('[fetchAnimeByIds Notice]:', err);
    }
    return [];
  }

  /**
   * READ LIGHTWEIGHT FULL INDEX: Fetches all published anime with lightweight fields
   * from `/api/anime/index` for Matchmaker, Tier List, Collections, and Roulette.
   * Deduplicated & cached in memory for 2 minutes.
   */
  public async fetchCatalogIndex(forceRefresh: boolean = false): Promise<AnimePayload[]> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.catalogIndexCache &&
      this.catalogIndexCache.length > 0 &&
      now - this.catalogIndexCachedAt < this.CATALOG_INDEX_TTL_MS
    ) {
      return this.catalogIndexCache;
    }

    if (!forceRefresh && this.catalogIndexPromise) {
      return this.catalogIndexPromise;
    }

    const reqPromise = (async () => {
      try {
        const indexEndpoint = forceRefresh
          ? `${CLOUDFLARE_ENDPOINTS.CATALOG_INDEX}?fresh=1&_t=${Date.now()}`
          : CLOUDFLARE_ENDPOINTS.CATALOG_INDEX;
        const res = await this.smartFetch(indexEndpoint, {
          method: 'GET',
          headers: this.getHeaders(false),
        });
        if (!res.ok) return this.catalogIndexCache || [];
        const json = await res.json().catch(() => ({ data: [] }));
        const items: AnimePayload[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
            ? json
            : [];
        if (items.length > 0) {
          this.catalogIndexCache = items;
          this.catalogIndexCachedAt = Date.now();
        }
        return items;
      } catch (err) {
        console.warn('[fetchCatalogIndex Notice]:', err);
        return this.catalogIndexCache || [];
      } finally {
        this.catalogIndexPromise = null;
      }
    })();

    this.catalogIndexPromise = reqPromise;
    return reqPromise;
  }

  public clearCatalogIndexCache(): void {
    this.catalogIndexCache = null;
    this.catalogIndexCachedAt = 0;
    this.catalogIndexPromise = null;
  }

  /**
   * READ: Fetches single anime details by ID or slug from Cloudflare Worker / D1
   */
  public async getAnimeById(
    id: number | string,
    _userId?: string,
    options?: { locale?: string }
  ): Promise<AnimePayload | null> {
    const safeSegment = encodeURIComponent(String(id).trim());
    const localeQuery =
      options?.locale && options.locale !== 'en'
        ? `?locale=${encodeURIComponent(options.locale)}`
        : '';
    const endpoint = `${CLOUDFLARE_ENDPOINTS.ANIME_BY_ID(safeSegment)}${localeQuery}`;
    const res = await this.smartFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch anime ID ${id} from Cloudflare API`);
    }

    return await res.json();
  }

  /**
   * READ: Fetches published translation for an anime and locale (gracefully returns null if none/unmigrated)
   */
  public async fetchPublicAnimeTranslation(
    animeId: number | string,
    locale: string
  ): Promise<AnimeTranslationItem | null> {
    if (!animeId || !locale || locale === 'en') return null;
    try {
      const safeId = encodeURIComponent(String(animeId).trim());
      const endpoint = `/api/anime/${safeId}/translations?locale=${encodeURIComponent(locale)}`;
      const res = await this.smartFetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(false),
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      if (!json || !json.translation) return null;
      return json.translation as AnimeTranslationItem;
    } catch {
      return null;
    }
  }

  /**
   * DETAILS 2.0 (Phase 2): Fetches regional 5-slider dub quality reviews & aggregates (safe fallback if unmigrated)
   */
  public async fetchDubReviews(
    animeId: number | string,
    lang?: string,
    clerkToken?: string | null
  ): Promise<{
    tableReady: boolean;
    reviews: import('../utils/animeDetailsV2').DubReviewRecord[];
    summary: import('../utils/animeDetailsV2').DubReviewAggregate;
    byLanguage: Record<string, import('../utils/animeDetailsV2').DubReviewAggregate>;
  }> {
    const emptyAgg = {
      count: 0,
      overall: null,
      voice_acting: null,
      voice_casting: null,
      translation_quality: null,
      lip_sync: null,
      emotional_delivery: null,
    };
    try {
      const safeId = encodeURIComponent(String(animeId).trim());
      const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
      const headers: Record<string, string> = {
        ...this.getHeaders(false),
        ...(clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}),
      };
      const res = await this.smartFetch(`/api/anime/${safeId}/dub-reviews${qs}`, {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        return { tableReady: false, reviews: [], summary: emptyAgg, byLanguage: {} };
      }
      const json = await res.json().catch(() => null);
      return {
        tableReady: json?.tableReady !== false,
        reviews: Array.isArray(json?.reviews) ? json.reviews : [],
        summary: json?.summary || emptyAgg,
        byLanguage: json?.byLanguage && typeof json.byLanguage === 'object' ? json.byLanguage : {},
      };
    } catch {
      return { tableReady: false, reviews: [], summary: emptyAgg, byLanguage: {} };
    }
  }

  /**
   * DETAILS 2.0 (Phase 2): Submits or updates an authenticated user's 5-slider regional dub quality review
   */
  public async submitDubReview(
    animeId: number | string,
    payload: {
      dub_language: string;
      voice_acting: number;
      voice_casting: number;
      translation_quality: number;
      lip_sync: number;
      emotional_delivery: number;
      review_text?: string;
      has_spoilers?: boolean;
      user_name?: string;
    },
    clerkToken?: string | null
  ): Promise<{ success: boolean; review?: import('../utils/animeDetailsV2').DubReviewRecord }> {
    const safeId = encodeURIComponent(String(animeId).trim());
    const headers: Record<string, string> = {
      ...this.getHeaders(false),
      ...(clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}),
    };
    const res = await this.smartFetch(`/api/anime/${safeId}/dub-reviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to publish dub review (HTTP ${res.status})`);
    }
    return { success: true, review: json?.review };
  }

  /**
   * DETAILS 2.0 (Phase 2): Deletes an authenticated user's own regional dub review
   */
  public async deleteDubReview(
    animeId: number | string,
    reviewId: number,
    clerkToken?: string | null
  ): Promise<{ success: boolean }> {
    const safeId = encodeURIComponent(String(animeId).trim());
    const headers: Record<string, string> = {
      ...this.getHeaders(false),
      ...(clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}),
    };
    const res = await this.smartFetch(`/api/anime/${safeId}/dub-reviews/${reviewId}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to delete dub review (HTTP ${res.status})`);
    }
    return { success: true };
  }

  /**
   * DETAILS 2.0 (Phase 2): Fetches verified Anime Universe / Smart Watch Order links from D1
   */
  public async fetchAnimeFranchise(animeId: number | string): Promise<{
    tableReady: boolean;
    franchiseKey: string | null;
    entries: import('../utils/animeDetailsV2').FranchiseLinkItem[];
  }> {
    try {
      const safeId = encodeURIComponent(String(animeId).trim());
      const res = await this.smartFetch(`/api/anime/${safeId}/franchise`, {
        method: 'GET',
        headers: this.getHeaders(false),
      });
      if (!res.ok) return { tableReady: false, franchiseKey: null, entries: [] };
      const json = await res.json().catch(() => null);
      return {
        tableReady: json?.tableReady !== false,
        franchiseKey: json?.franchiseKey || null,
        entries: Array.isArray(json?.entries) ? json.entries : [],
      };
    } catch {
      return { tableReady: false, franchiseKey: null, entries: [] };
    }
  }

  /**
   * DETAILS 2.0 (Phase 2): Fetches verified Characters & Indian Voice Actors from D1
   */
  public async fetchAnimeCast(
    animeId: number | string,
    lang?: string
  ): Promise<{
    tableReady: boolean;
    entries: import('../utils/animeDetailsV2').VerifiedCastEntry[];
    languages: string[];
    byLanguage: Record<string, import('../utils/animeDetailsV2').VerifiedCastEntry[]>;
  }> {
    try {
      const safeId = encodeURIComponent(String(animeId).trim());
      const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
      const res = await this.smartFetch(`/api/anime/${safeId}/cast${qs}`, {
        method: 'GET',
        headers: this.getHeaders(false),
      });
      if (!res.ok) return { tableReady: false, entries: [], languages: [], byLanguage: {} };
      const json = await res.json().catch(() => null);
      return {
        tableReady: json?.tableReady !== false,
        entries: Array.isArray(json?.entries) ? json.entries : [],
        languages: Array.isArray(json?.languages) ? json.languages : [],
        byLanguage: json?.byLanguage && typeof json.byLanguage === 'object' ? json.byLanguage : {},
      };
    } catch {
      return { tableReady: false, entries: [], languages: [], byLanguage: {} };
    }
  }

  /**
   * ADMIN: Fetches all anime translations & per-locale coverage stats
   */
  public async fetchAdminTranslations(filters?: {
    locale?: string;
    status?: string;
    animeId?: string | number;
  }): Promise<AdminTranslationsResponse> {
    const qs = new URLSearchParams();
    if (filters?.locale) qs.set('locale', filters.locale);
    if (filters?.status) qs.set('status', filters.status);
    if (filters?.animeId !== undefined) qs.set('animeId', String(filters.animeId));
    const endpoint = `/api/admin/translations${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await this.smartFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load translations (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json.success),
      tableReady: json.tableReady !== false,
      notice: json.notice,
      totalAnime: Number(json.totalAnime) || 0,
      translations: Array.isArray(json.translations) ? json.translations : [],
      coverage: Array.isArray(json.coverage) ? json.coverage : [],
      animeSourceHashes: (json.animeSourceHashes && typeof json.animeSourceHashes === 'object')
        ? json.animeSourceHashes
        : {},
    };
  }

  /**
   * ADMIN: Upserts an anime translation record (never modifies English catalog tables)
   */
  public async upsertAdminTranslation(payload: {
    anime_id: string | number;
    locale: string;
    localized_title?: string | null;
    synopsis?: string | null;
    description?: string | null;
    translation_status?: 'draft' | 'reviewed' | 'published';
  }): Promise<{ success: boolean; translation: AnimeTranslationItem }> {
    const safeId = encodeURIComponent(String(payload.anime_id).trim());
    const safeLocale = encodeURIComponent(String(payload.locale).trim().toLowerCase());
    const res = await this.smartFetch(`/api/admin/translations/${safeId}/${safeLocale}`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to save translation (HTTP ${res.status})`);
    }
    return json;
  }

  /**
   * ADMIN: Updates workflow status (draft | reviewed | published)
   */
  public async updateAdminTranslationStatus(
    animeId: string | number,
    locale: string,
    translation_status: 'draft' | 'reviewed' | 'published'
  ): Promise<{ success: boolean; translation: AnimeTranslationItem }> {
    const safeId = encodeURIComponent(String(animeId).trim());
    const safeLocale = encodeURIComponent(String(locale).trim().toLowerCase());
    const res = await this.smartFetch(`/api/admin/translations/${safeId}/${safeLocale}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ translation_status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to update translation status (HTTP ${res.status})`);
    }
    return json;
  }

  /**
   * ADMIN: Deletes a translation row from anime_translations only
   */
  public async deleteAdminTranslation(
    animeId: string | number,
    locale: string
  ): Promise<{ success: boolean }> {
    const safeId = encodeURIComponent(String(animeId).trim());
    const safeLocale = encodeURIComponent(String(locale).trim().toLowerCase());
    const res = await this.smartFetch(`/api/admin/translations/${safeId}/${safeLocale}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to delete translation (HTTP ${res.status})`);
    }
    return { success: true };
  }

  /**
   * SUBMIT COMMUNITY ANIME: Allows authenticated normal users to submit anime into the pending moderation queue (/api/anime/submit)
   */
  public async submitCommunityAnime(payload: AnimePayload): Promise<{ success: boolean; id?: number; animeId?: number; submissionStatus?: string; message?: string }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.SUBMIT_ANIME;
    const res = await this.smartFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({
        ...payload,
        status: 'pending',
        submissionStatus: 'pending',
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errorMsg = `Failed to submit anime (Status ${res.status})`;
      try {
        const json = JSON.parse(errText);
        if (json.error) errorMsg = json.error;
      } catch {
        if (errText) errorMsg = errText;
      }
      throw new Error(errorMsg);
    }

    return await res.json();
  }

  /**
   * CREATE: Adds a new anime to Cloudflare D1
   */
  /**
   * UPLOAD / IMPORT CSV: Sends CSV text or array to backend import route
   */
  public async uploadCSV(
    payload:
      | {
          csvText?: string;
          animeList?: Record<string, unknown>[];
          totalRows?: number;
          invalidRows?: number;
          errors?: string[];
        }
      | string
  ): Promise<{
    success: boolean;
    totalRows?: number;
    addedToPending?: number;
    skippedDuplicates?: number;
    duplicateTitles?: string[];
    invalidRows?: number;
    errors?: string[];
    count?: number;
    skipped?: number;
    insertedCount?: number;
    skippedCount?: number;
    skippedTitles?: string[];
    addedTitles?: string[];
    message?: string;
    error?: string;
  }> {
    const endpoint = '/api/admin/import-csv';
    const bodyData = typeof payload === 'string' ? { csvText: payload } : payload;

    const res = await this.smartFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(bodyData),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errorMsg = `CSV Import failed (Status ${res.status})`;
      try {
        const json = JSON.parse(errText);
        if (json.error) errorMsg = json.error;
      } catch {
        if (errText) errorMsg = errText;
      }
      throw new Error(errorMsg);
    }

    return await res.json();
  }

  /**
   * FETCH PENDING: Gets pending moderation queue items
   */
  public async fetchPendingItems(): Promise<AnimePayload[]> {
    const endpoint = '/api/admin/pending';
    try {
      const res = await this.smartFetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(true)
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json.pending || [];
    } catch {
      return [];
    }
  }

  /**
   * CLEAR PENDING QUEUE: Clears all items in pending moderation queue
   */
  public async clearPendingQueue(): Promise<{ success: boolean; message?: string }> {
    const endpoint = '/api/admin/clear-pending';
    try {
      const res = await this.smartFetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(true)
      });
      if (!res.ok) {
        throw new Error(`Failed to clear pending queue (Status ${res.status})`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('[clearPendingQueue Error]:', err);
      throw err;
    }
  }

  public async createAnime(payload: AnimePayload): Promise<{ success: boolean; animeId?: number; data?: any }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.CATALOG;
    const res = await this.smartFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errorMsg = `Failed to create anime (Status ${res.status})`;
      try {
        const json = JSON.parse(errText);
        if (json.error) errorMsg = json.error;
      } catch {
        if (errText) errorMsg = errText;
      }
      throw new Error(errorMsg);
    }

    const created = await res.json();
    this.clearCatalogIndexCache();
    return created;
  }

  /**
   * UPDATE: Updates an existing anime in Cloudflare D1 / Worker
   */
  public async updateAnime(id: number | string, payload: Partial<AnimePayload>): Promise<{ success: boolean; id: string | number; data?: any }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.ANIME_BY_ID(id);
    const cleanPayload = {
      ...payload,
      id: id,
      rating: payload.rating !== undefined ? Number(parseFloat(String(payload.rating)).toFixed(1)) : undefined
    };

    let res: Response;
    try {
      res = await this.smartFetch(endpoint, {
        method: 'PUT',
        headers: this.getHeaders(true),
        body: JSON.stringify(cleanPayload)
      });
    } catch (networkErr: any) {
      throw new Error(`[ERROR] Network/CORS Failed: ${networkErr.message} while reaching ${endpoint}`);
    }

    // Fallback to PATCH if method PUT is not accepted or returned 405
    if (res.status === 405) {
      try {
        res = await this.smartFetch(endpoint, {
          method: 'PATCH',
          headers: this.getHeaders(true),
          body: JSON.stringify(cleanPayload)
        });
      } catch (patchErr: any) {
        throw new Error(`[ERROR] Network/CORS Failed on PATCH: ${patchErr.message} while reaching ${endpoint}`);
      }
    }

    if (!res.ok) {
      let errBody = '';
      let parsedJson: any = null;
      try {
        parsedJson = await res.json();
        errBody = parsedJson.error || parsedJson.message || JSON.stringify(parsedJson);
      } catch {
        errBody = await res.text().catch(() => res.statusText);
      }
      const err: any = new Error(
        res.status === 409
          ? errBody || 'Conflict: This anime was modified in another session.'
          : `[ERROR] Backend returned ${res.status} (${res.statusText}): ${errBody || 'Update rejected'}`
      );
      err.status = res.status;
      if (parsedJson?.conflict) {
        err.conflict = true;
        err.currentRecord = parsedJson.currentRecord;
        err.currentUpdatedAt = parsedJson.currentUpdatedAt;
      }
      throw err;
    }

    const updated = await res.json();
    this.clearCatalogIndexCache();
    return updated;
  }

  /**
   * DELETE: Deletes an anime from Cloudflare D1 (archives into admin_recycle_bin first)
   */
  public async deleteAnime(id: number | string): Promise<{ success: boolean; recycleBinId?: number | null }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.ANIME_BY_ID(id);
    let res: Response;
    try {
      res = await this.smartFetch(endpoint, {
        method: 'DELETE',
        headers: this.getHeaders(true)
      });
    } catch (networkErr: any) {
      console.warn(`[Network Notice] Could not reach ${endpoint} for delete:`, networkErr.message);
      return { success: true };
    }

    if (res.status === 404 || res.status === 204) {
      return { success: true };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errorMsg = `Failed to delete anime ID ${id} (Status ${res.status})`;
      try {
        const json = JSON.parse(errText);
        if (json.error) errorMsg = json.error;
      } catch {
        if (errText) errorMsg = errText;
      }
      if (/not found/i.test(errorMsg)) {
        return { success: true };
      }
      throw new Error(errorMsg);
    }

    const deleted = await res.json().catch(() => ({ success: true }));
    this.clearCatalogIndexCache();
    return deleted;
  }

  /**
   * REJECT: Rejects a pending submission from Cloudflare D1 with optional preset reason and moderator note
   */
  public async rejectAnime(
    id: number | string,
    options?: { reasonPreset?: string | null; moderatorNote?: string | null }
  ): Promise<{ success: boolean; recycleBinId?: number | null }> {
    try {
      const res = await this.smartFetch(`/api/admin/reject/${encodeURIComponent(String(id))}`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(options || {}),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ success: true }));
        this.clearCatalogIndexCache();
        return data;
      }
      return await this.deleteAnime(id);
    } catch (err: any) {
      if (/not found/i.test(err?.message || '')) {
        return { success: true };
      }
      throw err;
    }
  }

  /**
   * APPROVE: Approves a pending submission in Cloudflare D1
   */
  public async approveAnime(id: number | string, status?: string): Promise<any> {
    const endpoint = CLOUDFLARE_ENDPOINTS.APPROVE(id);
    const payload: Record<string, any> = { submissionStatus: 'approved' };
    if (status) {
      payload.status = status;
      payload.airing_status = status;
    }
    const res = await this.smartFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to approve anime ID ${id} on Cloudflare D1`);
    }

    const approved = await res.json();
    this.clearCatalogIndexCache();
    return approved;
  }

  /**
   * LIKE: Registers like increment or decrement in Cloudflare Worker / D1 (Verified via Clerk Bearer JWT)
   */
  public async likeAnime(id: number | string, options?: { action?: 'like' | 'unlike'; delta?: number; userId?: string }): Promise<{ success: boolean; likes?: number; likesCount?: number }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.LIKE(id);
    const { userId: _ignoredUserId, ...safeOptions } = options || {};
    let res: Response;
    try {
      res = await this.smartFetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(false),
        credentials: 'include',
        body: JSON.stringify(safeOptions)
      });
    } catch (networkErr: any) {
      throw new Error(`[Network/Fetch Error] Unable to connect to ${endpoint}: ${networkErr.message}`);
    }

    if (!res.ok) {
      let errDetail = '';
      let isAlreadyVoted = false;
      try {
        const errJson = await res.json();
        errDetail = errJson.message || errJson.error || JSON.stringify(errJson);
        if (errJson.alreadyVoted || errJson.error === 'Already voted' || /already voted/i.test(errDetail)) {
          isAlreadyVoted = true;
        }
      } catch {
        errDetail = await res.text().catch(() => res.statusText);
        if (/already voted/i.test(errDetail)) isAlreadyVoted = true;
      }
      const httpError: HttpStatusError = new Error(isAlreadyVoted ? 'Already voted' : `HTTP ${res.status} (${res.statusText}): ${errDetail || 'Failed to update like'} at ${endpoint}`);
      httpError.status = res.status;
      httpError.statusText = res.statusText;
      httpError.alreadyVoted = isAlreadyVoted;
      httpError.rawMessage = errDetail;
      httpError.url = endpoint;
      throw httpError;
    }

    return await res.json();
  }

  /**
   * VOTE: Registers community upvote in Cloudflare D1 (Verified via Clerk Bearer JWT)
   */
  public async upvoteAnime(id: number | string, options?: { action?: 'up' | 'down'; delta?: number; userId?: string }): Promise<{ success: boolean; upvotes?: number; popularity?: number }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.VOTE(id);
    const { userId: _ignoredUserId, ...safeOptions } = options || {};
    let res: Response;
    try {
      res = await this.smartFetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify(safeOptions)
      });
    } catch (networkErr: any) {
      throw new Error(`[Network/Fetch Error] Unable to connect to ${endpoint}: ${networkErr.message}`);
    }

    if (!res.ok) {
      let errDetail = '';
      let isAlreadyVoted = false;
      try {
        const errJson = await res.json();
        errDetail = errJson.message || errJson.error || JSON.stringify(errJson);
        if (errJson.alreadyVoted || errJson.error === 'Already voted' || /already voted/i.test(errDetail)) {
          isAlreadyVoted = true;
        }
      } catch {
        errDetail = await res.text().catch(() => res.statusText);
        if (/already voted/i.test(errDetail)) isAlreadyVoted = true;
      }
      const httpError: HttpStatusError = new Error(isAlreadyVoted ? 'Already voted' : `HTTP ${res.status} (${res.statusText}): ${errDetail || 'Failed to update upvote'} at ${endpoint}`);
      httpError.status = res.status;
      httpError.statusText = res.statusText;
      httpError.alreadyVoted = isAlreadyVoted;
      httpError.rawMessage = errDetail;
      httpError.url = endpoint;
      throw httpError;
    }

    return await res.json();
  }

  /**
   * VOTE STATUS: Checks if current authenticated user has already voted for this anime
   */
  public async checkVoteStatus(id: number | string, _userId?: string): Promise<{ hasLiked: boolean; hasUpvoted: boolean }> {
    try {
      const endpoint = `/api/anime/${id}/vote-status`;
      const res = await this.smartFetch(endpoint, {
        headers: this.getHeaders(false)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
    return { hasLiked: false, hasUpvoted: false };
  }

  /**
   * UPLOAD: Proxies image upload to ImgBB via Cloudflare Worker backend
   */
  public async uploadImage(base64Image: string, filename?: string, mimeType?: string): Promise<{ success: boolean; url: string; display_url?: string }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.UPLOAD;
    const res = await this.smartFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({
        image: base64Image,
        filename: filename || 'poster.png',
        ...(mimeType ? { mimeType } : {}),
        type: 'POSTER'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload image through Cloudflare backend');
    }

    return await res.json();
  }

  /**
   * USER STATS: Fetches real review and vote counts for the user from D1
   */
  public async fetchUserStats(): Promise<{ reviewCount: number; voteCount: number }> {
    try {
      const endpoint = CLOUDFLARE_ENDPOINTS.USER_STATS;
      const res = await this.smartFetch(endpoint, {
        headers: this.getHeaders(false)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch user stats from server:', err);
    }
    return { reviewCount: 0, voteCount: 0 };
  }

  /**
   * ADMIN: Verifies current Clerk JWT session with backend (/api/admin/verify) and returns detailed status/error
   */
  public async verifyAdminDetailed(explicitToken?: string | null): Promise<{ ok: boolean; error?: string }> {
    try {
      const token = explicitToken || (await getClerkSessionToken());
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.VERIFY_ADMIN, {
        method: 'GET',
        headers: {
          ...this.getHeaders(true),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        return { ok: true };
      }
      const backendError = data.error || data.message || `HTTP ${res.status}`;
      return { ok: false, error: `Backend Error: ${backendError}` };
    } catch (err: any) {
      return { ok: false, error: `Backend Error: ${err?.message || 'Unable to reach /api/admin/verify'}` };
    }
  }

  /**
   * ADMIN: Verifies current Clerk JWT session with backend
   */
  public async verifyAdmin(explicitToken?: string | null): Promise<boolean> {
    const res = await this.verifyAdminDetailed(explicitToken);
    return res.ok;
  }

  /**
   * ADMIN: Verifies Clerk Admin JWT session on the backend without sending client-side email or userId
   */
  public async loginAdmin(explicitToken?: string | null): Promise<{ success: boolean; error?: string }> {
    try {
      const token = explicitToken || (await getClerkSessionToken());
      const authHeaders = {
        ...this.getHeaders(true),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const verifyRes = await this.smartFetch(CLOUDFLARE_ENDPOINTS.VERIFY_ADMIN, {
        method: 'GET',
        headers: authHeaders,
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (verifyRes.status === 200) {
        return { success: true };
      }

      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.LOGIN_ADMIN, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        return { success: true };
      }
      const backendError =
        verifyData.error ||
        verifyData.message ||
        data.error ||
        data.message ||
        `HTTP ${verifyRes.status}`;
      return {
        success: false,
        error: `Backend Error: ${backendError}`
      };
    } catch (err: any) {
      console.error('Admin login error:', err);
      return { success: false, error: `Backend Error: ${err.message}` };
    }
  }

  /**
   * WATCHLIST: Fetches the user's watchlist from Cloudflare D1 with hydration status
   */
  public async fetchWatchlistDetailed(explicitToken?: string | null): Promise<{
    ok: boolean;
    items: AnimePayload[];
    ids: number[];
    unauthenticated?: boolean;
  }> {
    try {
      const token = explicitToken || (await getClerkSessionToken());
      if (!token) {
        return { ok: false, items: [], ids: [], unauthenticated: true };
      }

      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.WATCHLIST, {
        method: 'GET',
        headers: {
          ...this.getHeaders(false),
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        return { ok: false, items: [], ids: [], unauthenticated: true };
      }
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const items = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.watchlist)
          ? data.watchlist
          : [];
        const ids = normalizeWatchlistIds(
          Array.isArray(data.watchlist) && data.watchlist.every((x: any) => typeof x === 'number' || typeof x === 'string')
            ? data.watchlist
            : items
        );
        return { ok: true, items, ids };
      }
    } catch (err) {
      console.warn('Failed to fetch watchlist:', err);
    }
    return { ok: false, items: [], ids: [] };
  }

  /**
   * WATCHLIST: Fetches the user's watchlist from Cloudflare D1
   */
  public async fetchWatchlist(explicitToken?: string | null): Promise<AnimePayload[]> {
    const res = await this.fetchWatchlistDetailed(explicitToken);
    return res.items;
  }

  /**
   * WATCHLIST: Adds an anime to the authenticated user's D1 watchlist via POST /api/watchlist
   */
  public async addToWatchlist(
    animeId: number | string,
    explicitToken?: string | null
  ): Promise<{ success: boolean; watchlisted: boolean; error?: string }> {
    const idNum = Number(animeId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return { success: false, watchlisted: false, error: 'Valid anime_id is required' };
    }
    try {
      const token = explicitToken || (await getClerkSessionToken());
      if (!token) {
        return { success: false, watchlisted: false, error: 'Not authenticated' };
      }
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.WATCHLIST, {
        method: 'POST',
        headers: {
          ...this.getHeaders(false),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ anime_id: idNum }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: true, watchlisted: data.watchlisted !== false };
      }
      const errData = await res.json().catch(() => ({}));
      return { success: false, watchlisted: false, error: errData.error };
    } catch (err: any) {
      return { success: false, watchlisted: false, error: err?.message };
    }
  }

  /**
   * WATCHLIST: Removes an anime from the authenticated user's D1 watchlist via DELETE /api/watchlist
   */
  public async removeFromWatchlist(
    animeId: number | string,
    explicitToken?: string | null
  ): Promise<{ success: boolean; watchlisted: boolean; error?: string }> {
    const idNum = Number(animeId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return { success: false, watchlisted: false, error: 'Valid anime_id is required' };
    }
    try {
      const token = explicitToken || (await getClerkSessionToken());
      if (!token) {
        return { success: false, watchlisted: false, error: 'Not authenticated' };
      }
      const res = await this.smartFetch(`${CLOUDFLARE_ENDPOINTS.WATCHLIST}?anime_id=${idNum}`, {
        method: 'DELETE',
        headers: {
          ...this.getHeaders(false),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ anime_id: idNum }),
      });
      if (res.ok) {
        return { success: true, watchlisted: false };
      }
      const errData = await res.json().catch(() => ({}));
      return { success: false, watchlisted: true, error: errData.error };
    } catch (err: any) {
      return { success: false, watchlisted: true, error: err?.message };
    }
  }

  /**
   * WATCHLIST: Toggles an anime in the watchlist.
   * - Sends DELETE /api/watchlist when removing an already saved anime.
   * - Sends POST /api/watchlist when adding a new anime.
   * - Falls back cleanly to localStorage for guest (unauthenticated) users.
   */
  public async toggleWatchlist(
    animeId: number | string,
    currentlyWatchlisted?: boolean,
    explicitToken?: string | null
  ): Promise<{ success: boolean; watchlisted: boolean; localOnly?: boolean }> {
    const idNum = Number(animeId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return { success: false, watchlisted: false };
    }

    const token = explicitToken || (await getClerkSessionToken());
    if (!token) {
      const currentGuestIds = readWatchlistFromStorage();
      const { ids, watchlisted } = toggleWatchlistIdLocally(currentGuestIds, idNum);
      writeWatchlistToStorage(ids, 'guest');
      return { success: true, watchlisted, localOnly: true };
    }

    let isSaved = currentlyWatchlisted;
    if (isSaved === undefined) {
      const serverRes = await this.fetchWatchlistDetailed(token);
      if (serverRes.ok) {
        isSaved = serverRes.ids.includes(idNum);
      } else {
        isSaved = readWatchlistFromStorage().includes(idNum);
      }
    }

    if (isSaved) {
      return this.removeFromWatchlist(idNum, token);
    }
    return this.addToWatchlist(idNum, token);
  }

  /**
   * FEEDBACK: Submits user feedback or bug report (honest 2xx verification, detailed error reporting)
   */
  public async submitFeedback(
    payload: FeedbackSubmitPayload
  ): Promise<{ success: boolean; error?: string; status?: number }> {
    try {
      const normalizedPayload = {
        ...payload,
        feedback: payload.feedback || payload.message || '',
      };
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.FEEDBACK, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify(normalizedPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success !== false) {
        return { success: true, status: res.status };
      }
      return {
        success: false,
        status: res.status,
        error: data?.error || data?.message || `Server returned HTTP ${res.status}. Please try again.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error while submitting feedback. Your message has been preserved.',
      };
    }
  }

  /**
   * CHAT: Fetches paginated community chat messages (latest 50 first, cursor pagination via beforeId)
   */
  public async fetchChatHistoryPage(options?: {
    limit?: number;
    beforeId?: number | null;
  }): Promise<{
    ok: boolean;
    messages: ChatMessageRecord[];
    hasMore: boolean;
    nextBeforeId: number | null;
    error?: string;
  }> {
    try {
      const qs = new URLSearchParams();
      if (options?.limit && options.limit > 0) qs.set('limit', String(Math.min(options.limit, 100)));
      if (options?.beforeId && options.beforeId > 0) qs.set('beforeId', String(options.beforeId));
      const query = qs.toString();
      const endpoint = `${CLOUDFLARE_ENDPOINTS.CHAT}${query ? `?${query}` : ''}`;
      const res = await this.smartFetch(endpoint, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const messages: ChatMessageRecord[] = Array.isArray(data)
          ? data
          : data.messages || data.data || [];
        return {
          ok: true,
          messages,
          hasMore: Boolean(data?.hasMore),
          nextBeforeId:
            data?.nextBeforeId !== undefined && data?.nextBeforeId !== null
              ? Number(data.nextBeforeId)
              : null,
        };
      }
      return {
        ok: false,
        messages: [],
        hasMore: false,
        nextBeforeId: null,
        error: `Chat server returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      console.warn('Failed to fetch chat history:', err);
      return {
        ok: false,
        messages: [],
        hasMore: false,
        nextBeforeId: null,
        error: err?.message || 'Failed to load chat history',
      };
    }
  }

  /**
   * CHAT: Fetches recent community chat messages (backwards-compatible wrapper)
   */
  public async fetchChatHistory(options?: { limit?: number; beforeId?: number | null }): Promise<ChatMessageRecord[]> {
    const page = await this.fetchChatHistoryPage(options);
    return page.messages;
  }

  /**
   * CHAT: Sends a new message or review to the community chat (User identity verified on backend from Clerk JWT)
   */
  public async sendChatMessage(payload: ChatMessagePayload, explicitToken?: string | null): Promise<{ success: boolean; message?: ChatMessageRecord; error?: string }> {
    try {
      const { clerk_user_id: _ignoredClerkId, user_id: _ignoredUserId, userId: _ignoredUid, ...safePayload } = payload || {};
      const headers = this.getHeaders(false);
      const token = explicitToken || safePayload.token || await getClerkSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const bodyWithToken: ChatMessagePayload = {
        ...safePayload,
        ...(token ? { token } : {}),
      };
      let res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.CHAT, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyWithToken)
      });
      let data = await res.json().catch(() => ({}));

      // If Pages /api/chat lacks CLERK_SECRET_KEY or fails in production, retry directly against the dedicated anime-chat worker
      if (
        (!res.ok || data.success === false) &&
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1' &&
        !window.location.hostname.includes('.run.app') &&
        (res.status === 401 || res.status === 404 || res.status >= 500 || String(data?.error || '').includes('CLERK_SECRET_KEY'))
      ) {
        try {
          const workerRes = await fetch(`${CHAT_WORKER_HTTP_URL}${CLOUDFLARE_ENDPOINTS.CHAT}`, {
            method: 'POST',
            headers,
            cache: 'no-store',
            body: JSON.stringify(bodyWithToken),
          });
          const workerData = await workerRes.json().catch(() => ({}));
          if (workerRes.ok && workerData.success !== false) {
            return { success: true, message: workerData.message || workerData };
          }
          res = workerRes;
          data = workerData;
        } catch {
          // Preserve original error response below
        }
      }

      if (res.ok && data.success !== false) {
        return { success: true, message: data.message || data };
      }
      return { success: false, error: data.error || 'Failed to send message' };
    } catch (err: any) {
      console.warn('Failed to send chat message:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * RATE: Submits a 10-point community rating for an anime via /api/rate (UPSERT; userId extracted from Clerk JWT on backend)
   */
  public async submitCommunityRating(
    id: number | string,
    rating: number,
    _userId?: string,
    username?: string
  ): Promise<{ success: boolean; communityRating: number; totalVotes: number; userRating: number }> {
    try {
      const res = await this.smartFetch('/api/rate', {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({
          anime_id: Number(id),
          rating,
          username
        })
      });
      if (res.ok) {
        return await res.json();
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to submit community rating');
    } catch (err: any) {
      console.error('Community rating error:', err);
      throw err;
    }
  }

  /**
   * GET COMMUNITY RATING: Fetches average community rating and vote count
   */
  public async getCommunityRating(
    id: number | string,
    _userId?: string
  ): Promise<{ communityRating: number; totalVotes: number; userRating: number | null }> {
    try {
      const qs = new URLSearchParams({ anime_id: String(id) });
      const res = await this.smartFetch(`/api/rate?${qs.toString()}`, {
        method: 'GET',
        headers: this.getHeaders(false)
      });
      if (res.ok) {
        return await res.json();
      }
      return { communityRating: 0, totalVotes: 0, userRating: null };
    } catch (err) {
      return { communityRating: 0, totalVotes: 0, userRating: null };
    }
  }

  /**
   * RATE: Submits a star rating for an anime (backwards compatible; userId extracted from Clerk JWT on backend)
   */
  public async rateAnime(id: number | string, rating: number, _userId?: string, username?: string): Promise<{ success: boolean; rating: number; communityRating?: number; totalVotes?: number }> {
    try {
      const res = await this.smartFetch('/api/rate', {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ anime_id: Number(id), rating, username })
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          rating: data.communityRating || data.rating || rating,
          communityRating: data.communityRating,
          totalVotes: data.totalVotes
        };
      }
      throw new Error('Failed to submit rating');
    } catch (err: any) {
      console.error('Rate anime error:', err);
      throw err;
    }
  }

  /**
   * REVIEWS: Submits a new review for an anime (persists spoiler flag and returns server confirmation)
   */
  public async submitReview(
    id: number | string,
    payload: AnimeReviewPayload
  ): Promise<{ success: boolean; message?: string; review?: AnimeReviewResponse }> {
    const isSpoiler = Boolean(payload.spoiler ?? payload.spoilers ?? payload.is_spoiler);
    const requestPayload = {
      ...payload,
      spoiler: isSpoiler,
      spoilers: isSpoiler,
      is_spoiler: isSpoiler,
    };
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.ANIME_REVIEWS(id), {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify(requestPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success !== false) {
        return {
          success: true,
          message: data?.message || 'Review published',
          review: data?.review,
        };
      }
      throw new Error(data?.error || data?.message || `Failed to submit review (HTTP ${res.status})`);
    } catch (err: any) {
      console.error('Submit review error:', err);
      throw err;
    }
  }

  /**
   * REVIEWS: Fetches reviews for a specific anime
   */
  public async fetchReviews(id: number | string): Promise<AnimeReviewResponse[]> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.ANIME_REVIEWS(id), {
        headers: this.getHeaders(false)
      });
      if (res.ok) {
        const data = await res.json();
        return data.reviews || data.data || (Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn(`Failed to fetch reviews for anime ${id}:`, err);
    }
    return [];
  }

  /**
   * NOTIFICATIONS: Fetches recent activity notifications
   */
  public async fetchRecentNotifications(): Promise<any[]> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.NOTIFICATIONS, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        return data.notifications || data.data || [];
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
    return [];
  }

  /**
   * REPORT: Submits an issue report for an anime to POST /api/report
   */
  public async reportIssue(payload: {
    animeId?: number | string;
    anime_id?: number | string;
    animeTitle?: string;
    anime_title?: string;
    field?: string;
    issueType?: string;
    issue_type?: string;
    reason?: string;
    description?: string;
    notes?: string;
  }): Promise<{ success: boolean; reportId?: number | null; deliveredToTelegram?: boolean; error?: string }> {
    const resolvedField = payload.field ? String(payload.field).trim() : '';
    const resolvedIssueType = payload.issueType || payload.issue_type || payload.reason || resolvedField || '';
    const resolvedDescription = payload.description ?? payload.notes ?? '';
    const resolvedAnimeId = payload.animeId ?? payload.anime_id;
    const resolvedAnimeTitle = payload.animeTitle || payload.anime_title || 'Anime';
    const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.REPORT, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({
        animeId: resolvedAnimeId,
        animeTitle: resolvedAnimeTitle,
        field: resolvedField || undefined,
        issueType: resolvedIssueType,
        reason: resolvedIssueType,
        description: resolvedDescription,
        notes: resolvedDescription,
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Failed to submit report (HTTP ${res.status})`);
    }
    return data;
  }

  /**
   * TELEGRAM: Fetches bot configuration status (Admin Auth Required)
   */
  public async fetchTelegramStatus(): Promise<TelegramStatusResponse> {
    try {
      const res = await this.smartFetch('/api/telegram/status', {
        headers: this.getHeaders(true),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Failed to fetch Telegram status:', err);
    }
    return { configured: false };
  }

  /**
   * TELEGRAM: Updates bot credentials (Admin Auth Required)
   */
  public async updateTelegramSettings(payload: { token: string; chatId: string }): Promise<{ success?: boolean; error?: string; message?: string }> {
    const res = await this.smartFetch('/api/telegram/settings', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  /**
   * TELEGRAM: Sends a test notification (Admin Auth Required)
   */
  public async testTelegram(payload: Record<string, unknown> = {}): Promise<{ success?: boolean; error?: string; message?: string }> {
    const res = await this.smartFetch('/api/telegram/test', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  /**
   * FEEDBACK: Fetches all user feedback
   */
  public async fetchFeedback(): Promise<FeedbackRecord[]> {
    try {
      const res = await this.smartFetch('/api/feedback', {
        headers: this.getHeaders(true),
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.feedback) ? data.feedback : [];
        return list.map((f: any) => ({
          ...f,
          status:
            typeof f.status === 'string' && ['open', 'in_progress', 'resolved'].includes(f.status.toLowerCase())
              ? f.status.toLowerCase()
              : 'open',
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch feedback:', err);
    }
    return [];
  }

  /**
   * FEEDBACK: Updates feedback ticket workflow status (open -> in_progress -> resolved)
   */
  public async updateFeedbackStatus(
    id: number | string,
    status: 'open' | 'in_progress' | 'resolved'
  ): Promise<{ success: boolean; status?: 'open' | 'in_progress' | 'resolved'; error?: string }> {
    try {
      const res = await this.smartFetch(`/api/feedback/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify({ status }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.success !== false) {
        return {
          success: true,
          status: (json?.status as 'open' | 'in_progress' | 'resolved') || status,
        };
      }
      return {
        success: false,
        error: json?.error || `Failed to update feedback status (HTTP ${res.status})`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error while updating feedback status',
      };
    }
  }

  /**
   * FEEDBACK: Deletes feedback item
   */
  public async deleteFeedback(id: number | string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await this.smartFetch(`/api/feedback/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(true),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.success !== false) {
        return { success: true };
      }
      return { success: false, error: json?.error || `HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  /**
   * ANALYTICS: Fetches edge performance telemetry
   */
  /**
   * GOD-MODE ANALYTICS: Track edge session, pageview, or event
   */
  public async trackAnalytics(payload: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await this.smartFetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.warn('[cloudflareApi] trackAnalytics error:', err);
      return false;
    }
  }

  /**
   * GOD-MODE ANALYTICS: Fetch live dashboard metrics from D1 Edge Analytics with explicit error diagnostics
   */
  public async fetchAnalyticsDashboardDetailed(
    range: string = 'all'
  ): Promise<{ ok: boolean; data: any | null; error?: string; status?: number }> {
    try {
      const res = await this.smartFetch(`/api/analytics/dashboard?range=${encodeURIComponent(range)}`, {
        headers: this.getHeaders(true),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.success !== false) {
        return {
          ok: true,
          data: json?.data || json,
          status: res.status,
        };
      }
      return {
        ok: false,
        data: null,
        status: res.status,
        error: json?.error || `Analytics server returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        ok: false,
        data: null,
        error: err?.message || 'Unable to connect to D1 Edge Analytics API',
      };
    }
  }

  /**
   * GOD-MODE ANALYTICS: Fetch live dashboard metrics from D1 Edge Analytics
   */
  public async fetchAnalyticsDashboard(range: string = 'all'): Promise<any> {
    const detailed = await this.fetchAnalyticsDashboardDetailed(range);
    return detailed.ok ? detailed.data : null;
  }

  public async fetchAnalytics(): Promise<any> {
    try {
      const res = await this.smartFetch('/api/analytics', {
        headers: this.getHeaders(true)
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Failed to fetch analytics:', err);
    }
    return { totalRequests: 0, cacheHitRatio: '0%', avgLatencyMs: '0ms' };
  }

  /**
   * CLOUDFLARE: Fetches D1 and ImgBB ecosystem status
   */
  public async fetchCloudflareStatus(): Promise<any> {
    try {
      const res = await this.smartFetch('/api/cloudflare/status', {
        headers: this.getHeaders(true)
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Failed to fetch CF status:', err);
    }
    return null;
  }

  /**
   * D1: Executes a parameterized query on the edge database using structured parameters (never raw SQL)
   */
  public async executeD1Query(params: {
    table?: 'anime' | 'users' | 'logs';
    animeId?: number | string;
    title?: string;
    limit?: number;
  }): Promise<any> {
    const res = await this.smartFetch('/api/cloudflare/d1/query', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({
        table: params.table || 'anime',
        animeId: params.animeId,
        title: params.title,
        limit: params.limit || 10
      })
    });
    return await res.json();
  }

  /**
   * ADMIN: Logs out and clears session
   */
  public async logoutAdmin(): Promise<boolean> {
    try {
      await this.smartFetch('/api/admin/logout', {
        method: 'POST',
        headers: this.getHeaders(true)
      }).catch(() => {});
      return true;
    } catch {
      return true;
    }
  }

  /**
   * ADMIN: Resets the D1 database to initial state (requires explicit "DELETE ALL" confirmation)
   */
  public async resetDatabase(confirmPhrase?: string): Promise<{ success: boolean; error?: string }> {
    if (confirmPhrase !== 'DELETE ALL') {
      return { success: false, error: 'Confirmation phrase "DELETE ALL" is required.' };
    }
    try {
      const res = await this.smartFetch('/api/admin/reset-db', {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({ confirm: confirmPhrase })
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data?.error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to reset database' };
    }
  }

  /**
   * WATCH PROGRESS: Fetch saved watch progress from D1 for authenticated user
   */
  public async getWatchProgress(animeId?: number | string): Promise<{
    animeId: number;
    season: number;
    episode: number;
    totalEpisodes: number | null;
    completed: boolean;
    updatedAt: string;
  } | null> {
    if (!animeId) return null;
    try {
      const endpoint = `${CLOUDFLARE_ENDPOINTS.PROGRESS}?anime_id=${encodeURIComponent(String(animeId))}`;
      const res = await this.smartFetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(true),
      });
      if (!res.ok) return null;
      const json: any = await res.json().catch(() => null);
      const row = json?.progress;
      if (!row) return null;
      return {
        animeId: Number(row.anime_id ?? row.animeId ?? animeId),
        season: Number(row.season) || 1,
        episode: Number(row.episode) || 0,
        totalEpisodes: row.total_episodes ?? row.totalEpisodes ?? null,
        completed: Boolean(row.completed),
        updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
      };
    } catch {
      return null;
    }
  }

  /**
   * WATCH PROGRESS: Fetch ALL saved watch progress rows from D1 for authenticated user
   */
  public async getAllWatchProgress(): Promise<
    Array<{
      animeId: number;
      season: number;
      episode: number;
      totalEpisodes: number | null;
      completed: boolean;
      updatedAt: string;
    }>
  > {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.PROGRESS, {
        method: 'GET',
        headers: this.getHeaders(true),
      });
      if (!res.ok) return [];
      const json: any = await res.json().catch(() => null);
      const list = Array.isArray(json?.progress) ? json.progress : [];
      return list
        .map((row: any) => ({
          animeId: Number(row.animeId ?? row.anime_id),
          season: Number(row.season) || 1,
          episode: Number(row.episode) || 0,
          totalEpisodes: row.totalEpisodes ?? row.total_episodes ?? null,
          completed: Boolean(row.completed),
          updatedAt: String(row.updatedAt ?? row.updated_at ?? new Date().toISOString()),
        }))
        .filter((row: any) => Number.isInteger(row.animeId) && row.animeId > 0);
    } catch {
      return [];
    }
  }

  /**
   * WATCH PROGRESS: Persist episode & season progress to D1 for authenticated user
   */
  public async saveWatchProgress(payload: {
    animeId: number;
    season: number;
    episode: number;
    totalEpisodes?: number | null;
    completed?: boolean;
  }): Promise<boolean> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.PROGRESS, {
        method: 'PUT',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * P2 #2: Fetch recent verified dub updates logged by Admin updates
   */
  public async fetchDubUpdates(limit = 12): Promise<DubUpdateRecord[]> {
    try {
      const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
      const res = await this.smartFetch(`/api/dub-updates?limit=${safeLimit}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => ({}));
      return Array.isArray(data?.updates) ? data.updates : Array.isArray(data?.data) ? data.data : [];
    } catch {
      return [];
    }
  }

  /**
   * P2 #5: Authenticated Anime Follows
   */
  public async fetchFollows(explicitToken?: string | null): Promise<{ ok: boolean; follows: number[]; data: any[] }> {
    try {
      const token = explicitToken || (await getClerkSessionToken());
      if (!token) return { ok: false, follows: [], data: [] };
      const res = await this.smartFetch('/api/follows', {
        method: 'GET',
        headers: {
          ...this.getHeaders(false),
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return { ok: false, follows: [], data: [] };
      const json = await res.json().catch(() => ({}));
      return {
        ok: true,
        follows: Array.isArray(json?.follows) ? json.follows.map(Number).filter(Number.isFinite) : [],
        data: Array.isArray(json?.data) ? json.data : [],
      };
    } catch {
      return { ok: false, follows: [], data: [] };
    }
  }

  public async followAnime(
    animeId: number | string,
    explicitToken?: string | null
  ): Promise<{ success: boolean; following: boolean; error?: string }> {
    const idNum = Number(animeId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return { success: false, following: false, error: 'Invalid anime ID' };
    }
    try {
      const token = explicitToken || (await getClerkSessionToken());
      if (!token) return { success: false, following: false, error: 'Sign in required' };
      const res = await this.smartFetch('/api/follows', {
        method: 'POST',
        headers: {
          ...this.getHeaders(false),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ anime_id: idNum }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success !== false) {
        return { success: true, following: true };
      }
      return { success: false, following: false, error: json?.error || 'Failed to follow anime' };
    } catch (err: any) {
      return { success: false, following: false, error: err?.message || 'Network error' };
    }
  }

  public async unfollowAnime(
    animeId: number | string,
    explicitToken?: string | null
  ): Promise<{ success: boolean; following: boolean; error?: string }> {
    const idNum = Number(animeId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return { success: false, following: false, error: 'Invalid anime ID' };
    }
    try {
      const token = explicitToken || (await getClerkSessionToken());
      if (!token) return { success: false, following: true, error: 'Sign in required' };
      const res = await this.smartFetch(`/api/follows?anime_id=${idNum}`, {
        method: 'DELETE',
        headers: {
          ...this.getHeaders(false),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ anime_id: idNum }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success !== false) {
        return { success: true, following: false };
      }
      return { success: false, following: true, error: json?.error || 'Failed to unfollow anime' };
    } catch (err: any) {
      return { success: false, following: true, error: err?.message || 'Network error' };
    }
  }

  /**
   * P2 #5: Real D1 In-App Alerts Inbox
   */
  public async fetchAlerts(
    explicitToken?: string | null
  ): Promise<{ ok: boolean; alerts: InAppAlertRecord[]; unreadCount: number }> {
    try {
      const token = explicitToken || (await getClerkSessionToken());
      if (!token) return { ok: false, alerts: [], unreadCount: 0 };
      const res = await this.smartFetch('/api/alerts', {
        method: 'GET',
        headers: {
          ...this.getHeaders(false),
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return { ok: false, alerts: [], unreadCount: 0 };
      const json = await res.json().catch(() => ({}));
      const alerts: InAppAlertRecord[] = Array.isArray(json?.alerts) ? json.alerts : [];
      const unreadCount =
        typeof json?.unreadCount === 'number'
          ? json.unreadCount
          : alerts.filter((a) => !a.is_read).length;
      return { ok: true, alerts, unreadCount };
    } catch {
      return { ok: false, alerts: [], unreadCount: 0 };
    }
  }

  public async markAlertsRead(alertId?: number, explicitToken?: string | null): Promise<boolean> {
    try {
      const token = explicitToken || (await getClerkSessionToken());
      if (!token) return false;
      const res = await this.smartFetch('/api/alerts/read', {
        method: 'POST',
        headers: {
          ...this.getHeaders(false),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(alertId ? { alertId } : { all: true }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * P2 #4: Admin Official Link Health Checker
   */
  public async checkAdminLinks(options?: { limit?: number; animeIds?: number[] }): Promise<AdminLinkCheckResponse> {
    try {
      const token = await getClerkSessionToken();
      const res = await this.smartFetch('/api/admin/check-links', {
        method: 'POST',
        headers: {
          ...this.getHeaders(true),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          limit: options?.limit ?? 20,
          ...(Array.isArray(options?.animeIds) && options.animeIds.length > 0
            ? { animeIds: options.animeIds }
            : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        return {
          success: true,
          checkedAt: json.checkedAt,
          note: json.note,
          summary: json.summary,
          results: Array.isArray(json.results) ? json.results : [],
        };
      }
      return {
        success: false,
        error: json?.error || `Link check failed (HTTP ${res.status})`,
        results: [],
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to run link health check',
        results: [],
      };
    }
  }

  public async getReviews(id: number | string): Promise<any[]> {
    const list = await this.fetchReviews(id);
    return list.map((r) => ({
      id: String(r.id),
      userName: r.user_name || r.author || 'AnimeFan_IN',
      rating: Number(r.rating) || 8,
      comment: r.comment || '',
      date: r.date || r.created_at || 'Recently',
      likes: Number(r.likes) || 0,
      isSpoiler: Boolean(r.is_spoiler ?? r.spoilers),
    }));
  }

  public async addReview(
    id: number | string,
    review: {
      userName?: string;
      rating?: number;
      comment?: string;
      isSpoiler?: boolean;
      language?: string;
    }
  ): Promise<{ success: boolean }> {
    return this.submitReview(id, {
      user_name: review.userName || 'AnimeFan_IN',
      rating: review.rating ?? 8,
      comment: review.comment || '',
      is_spoiler: Boolean(review.isSpoiler),
      spoiler: Boolean(review.isSpoiler),
      language: review.language,
    });
  }

  public async syncWatchlistItem(payload: {
    anime_id: string | number;
    status?: string;
    progress?: number;
  }): Promise<void> {
    await this.saveWatchProgress({
      animeId: Number(payload.anime_id) || 0,
      season: 1,
      episode: Number(payload.progress) || 0,
      completed: payload.status === 'Completed',
    });
  }

  public async getChatMessages(_room?: string): Promise<any[]> {
    const history = await this.fetchChatHistory({ limit: 50 });
    return history;
  }

  /**
   * ADMIN OPS PRO (Phase 2): 1-Click Metadata Auto-Fill (AniList / Jikan Server-Side Adapter)
   */
  public async searchExternalMetadata(
    query: string,
    provider: 'anilist' | 'jikan' = 'anilist'
  ): Promise<{
    success: boolean;
    provider: 'anilist' | 'jikan';
    candidates: import('../utils/adminOpsPro').ExternalMetadataCandidate[];
    error?: string;
  }> {
    const qs = new URLSearchParams({
      q: query.trim(),
      provider,
    });
    const res = await this.smartFetch(`/api/admin/metadata-search?${qs.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Metadata search failed (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      provider: json?.provider === 'jikan' ? 'jikan' : 'anilist',
      candidates: Array.isArray(json?.candidates) ? json.candidates : [],
    };
  }

  /**
   * ADMIN OPS PRO (Phase 2): Bulk Dub Intelligence & Episode Matrix Editor
   */
  public async fetchAdminDubMatrix(options?: {
    animeId?: string | number;
    language?: string;
  }): Promise<{
    success: boolean;
    tableReady: boolean;
    rows: import('../utils/adminOpsPro').DubMatrixRowInput[];
  }> {
    const qs = new URLSearchParams();
    if (options?.animeId !== undefined && String(options.animeId).trim()) {
      qs.set('animeId', String(options.animeId).trim());
    }
    if (options?.language && options.language !== 'all') {
      qs.set('language', options.language);
    }
    const endpoint = `/api/admin/dub-matrix${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await this.smartFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load dub matrix (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      tableReady: json?.tableReady !== false,
      rows: Array.isArray(json?.rows) ? json.rows : [],
    };
  }

  public async saveAdminDubMatrixBulk(
    entries: import('../utils/adminOpsPro').DubMatrixRowInput[]
  ): Promise<{
    success: boolean;
    tableReady?: boolean;
    savedCount: number;
    affectedAnimeIds: string[];
    notice?: string;
  }> {
    const res = await this.smartFetch('/api/admin/dub-matrix/bulk', {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify({ entries }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Bulk dub matrix update failed (HTTP ${res.status})`);
    }
    this.clearCatalogIndexCache();
    return {
      success: Boolean(json?.success),
      tableReady: json?.tableReady,
      savedCount: Number(json?.savedCount) || 0,
      affectedAnimeIds: Array.isArray(json?.affectedAnimeIds) ? json.affectedAnimeIds : [],
      notice: json?.notice,
    };
  }

  /**
   * ADMIN OPS PRO (Phase 2): Catalog Data Health & QA Scanner
   */
  public async fetchAdminDataHealth(): Promise<{
    success: boolean;
    scannedAt?: string;
    report: import('../utils/adminOpsPro').DataHealthScanReport;
  }> {
    const res = await this.smartFetch('/api/admin/data-health', {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to scan catalog data health (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      scannedAt: json?.scannedAt,
      report: json?.report,
    };
  }

  /**
   * ADMIN OPS PRO (Phase 2): Workers AI Translation Studio Generation & Manual Lock
   */
  public async generateAdminTranslationWithAi(payload: {
    anime_id: string | number;
    locale: string;
    title?: string;
    synopsis?: string;
    forceUnlock?: boolean;
  }): Promise<{
    success: boolean;
    provider?: string;
    locale: string;
    localized_title: string | null;
    synopsis: string;
    description: string;
    source_hash: string;
    savedToDb?: boolean;
  }> {
    const res = await this.smartFetch('/api/admin/translations/generate', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Workers AI translation failed (HTTP ${res.status})`);
    }
    return json;
  }

  public async toggleAdminTranslationLock(
    animeId: string | number,
    locale: string,
    locked: boolean
  ): Promise<{ success: boolean; is_locked: boolean }> {
    const safeId = encodeURIComponent(String(animeId).trim());
    const safeLocale = encodeURIComponent(String(locale).trim().toLowerCase());
    const res = await this.smartFetch(`/api/admin/translations/${safeId}/${safeLocale}/lock`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ locked }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to update translation lock (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      is_locked: Boolean(json?.is_locked),
    };
  }

  /**
   * ADMIN OPS PRO (Phase 2): Unified Moderation Inbox (Pending Submissions, 5-Slider Dub Reviews, General Reviews, Feedback)
   */
  public async fetchAdminModerationInbox(): Promise<{
    success: boolean;
    pendingSubmissions: any[];
    dubReviews: any[];
    generalReviews: any[];
    feedbackItems: any[];
    counts: {
      pendingSubmissions: number;
      dubReviews: number;
      flaggedDubReviews: number;
      generalReviews: number;
      openFeedback: number;
    };
  }> {
    const res = await this.smartFetch('/api/admin/moderation-inbox', {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load moderation inbox (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      pendingSubmissions: Array.isArray(json?.pendingSubmissions) ? json.pendingSubmissions : [],
      dubReviews: Array.isArray(json?.dubReviews) ? json.dubReviews : [],
      generalReviews: Array.isArray(json?.generalReviews) ? json.generalReviews : [],
      feedbackItems: Array.isArray(json?.feedbackItems) ? json.feedbackItems : [],
      counts: json?.counts || {
        pendingSubmissions: 0,
        dubReviews: 0,
        flaggedDubReviews: 0,
        generalReviews: 0,
        openFeedback: 0,
      },
    };
  }

  public async moderateAdminDubReview(
    reviewId: number,
    payload: { status?: 'published' | 'hidden' | 'flagged'; has_spoilers?: boolean }
  ): Promise<{ success: boolean; review?: any }> {
    const res = await this.smartFetch(`/api/admin/dub-reviews/${reviewId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to moderate dub review (HTTP ${res.status})`);
    }
    return json;
  }

  public async moderateAdminGeneralReview(
    reviewId: number,
    payload: { status?: string; is_spoiler?: boolean }
  ): Promise<{ success: boolean }> {
    const res = await this.smartFetch(`/api/admin/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to moderate review (HTTP ${res.status})`);
    }
    return { success: true };
  }

  public async deleteAdminGeneralReview(reviewId: number): Promise<{ success: boolean; recycleBinId?: number | null }> {
    const res = await this.smartFetch(`/api/admin/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to delete review (HTTP ${res.status})`);
    }
    return { success: true, recycleBinId: json?.recycleBinId ?? null };
  }

  public async deleteAdminDubReview(reviewId: number): Promise<{ success: boolean; recycleBinId?: number | null }> {
    const res = await this.smartFetch(`/api/admin/dub-reviews/${reviewId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to delete dub review (HTTP ${res.status})`);
    }
    return { success: true, recycleBinId: json?.recycleBinId ?? null };
  }

  /**
   * ADMIN OPS PRO (Phase 2): Safe CSV Import Dry-Run Preview
   */
  public async dryRunImportCsv(
    animeList: Record<string, unknown>[]
  ): Promise<{
    success: boolean;
    dryRun: boolean;
    report: import('../utils/adminOpsPro').CsvDryRunSummary;
  }> {
    const res = await this.smartFetch('/api/admin/import-csv/dry-run', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ animeList }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `CSV dry-run failed (HTTP ${res.status})`);
    }
    return json;
  }

  /**
   * ADMIN OPS PRO (Phase 2): Admin Activity Log
   */
  public async fetchAdminActivityLogs(filters?: {
    action?: string;
    entityType?: string;
    search?: string;
    limit?: number;
  }): Promise<{
    success: boolean;
    tableReady: boolean;
    logs: import('../utils/adminOpsPro').AdminActivityLogItem[];
  }> {
    const qs = new URLSearchParams();
    if (filters?.action && filters.action !== 'all') qs.set('action', filters.action);
    if (filters?.entityType && filters.entityType !== 'all') qs.set('entityType', filters.entityType);
    if (filters?.search && filters.search.trim()) qs.set('search', filters.search.trim());
    if (filters?.limit) qs.set('limit', String(filters.limit));
    const endpoint = `/api/admin/activity-logs${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await this.smartFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to fetch activity logs (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      tableReady: json?.tableReady !== false,
      logs: Array.isArray(json?.logs) ? json.logs : [],
    };
  }

  // ===========================================================================
  // ADMIN DASHBOARD 2.0 (Phase 3: Intelligence, Universe/Cast Ops & Backup Scale)
  // ===========================================================================

  /**
   * Silent, non-blocking, privacy-safe public telemetry event (POST /api/analytics/event).
   * Uses keepalive: true and swallows errors so public UX is never slowed down.
   */
  public trackDemandEvent(payload: {
    event_type:
      | 'search_query'
      | 'ott_impression'
      | 'ott_click'
      | 'dub_language_filter'
      | 'anime_detail_view'
      | 'watchlist_add'
      | 'translation_request';
    anime_id?: string | number | null;
    query_text?: string | null;
    language_code?: string | null;
    platform_name?: string | null;
    result_count?: number | null;
  }): void {
    try {
      const url = getCloudflareUrl('/api/analytics/event');
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Never block or throw on public telemetry
    }
  }

  /**
   * Franchise / Smart Watch Order Visual Builder APIs
   */
  public async fetchAdminFranchises(franchiseKey?: string): Promise<{
    success: boolean;
    tableReady: boolean;
    franchises: Array<{
      franchise_key: string;
      display_title?: string;
      entry_count: number;
      updated_at: string;
    }>;
    selectedFranchiseKey: string | null;
    entries: import('../utils/adminPhase3Intelligence').AdminFranchiseEntry[];
  }> {
    const qs = franchiseKey ? `?franchiseKey=${encodeURIComponent(franchiseKey)}` : '';
    const res = await this.smartFetch(`/api/admin/franchises${qs}`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load franchise timelines (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      tableReady: json?.tableReady !== false,
      franchises: Array.isArray(json?.franchises) ? json.franchises : [],
      selectedFranchiseKey: json?.selectedFranchiseKey || null,
      entries: Array.isArray(json?.entries) ? json.entries : [],
    };
  }

  public async fetchAdminFranchiseByKey(franchiseKey: string): Promise<{
    success: boolean;
    tableReady: boolean;
    franchiseKey: string;
    displayTitle: string;
    entries: import('../utils/adminPhase3Intelligence').AdminFranchiseEntry[];
  }> {
    const safeKey = encodeURIComponent(franchiseKey.trim());
    const res = await this.smartFetch(`/api/admin/franchises/${safeKey}`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load watch order (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      tableReady: json?.tableReady !== false,
      franchiseKey: String(json?.franchiseKey || franchiseKey),
      displayTitle: String(json?.displayTitle || franchiseKey),
      entries: Array.isArray(json?.entries) ? json.entries : [],
    };
  }

  public async addAdminFranchiseEntry(
    franchiseKey: string,
    payload: {
      anime_id: string | number;
      relation_label: string;
      note?: string | null;
    }
  ): Promise<{
    success: boolean;
    entry?: import('../utils/adminPhase3Intelligence').AdminFranchiseEntry;
    entries?: import('../utils/adminPhase3Intelligence').AdminFranchiseEntry[];
  }> {
    const safeKey = encodeURIComponent(franchiseKey.trim());
    const res = await this.smartFetch(`/api/admin/franchises/${safeKey}/entries`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to add anime to watch order (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      entry: json?.entry,
      entries: Array.isArray(json?.entries) ? json.entries : undefined,
    };
  }

  public async reorderAdminFranchiseEntries(
    franchiseKey: string,
    payload: {
      entryIds?: Array<number | string>;
      animeIds?: Array<number | string>;
    }
  ): Promise<{
    success: boolean;
    updatedCount: number;
    entries?: import('../utils/adminPhase3Intelligence').AdminFranchiseEntry[];
  }> {
    const safeKey = encodeURIComponent(franchiseKey.trim());
    const res = await this.smartFetch(`/api/admin/franchises/${safeKey}/reorder`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to reorder watch order (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      updatedCount: Number(json?.updatedCount) || 0,
      entries: Array.isArray(json?.entries) ? json.entries : undefined,
    };
  }

  public async deleteAdminFranchiseEntryById(
    franchiseKey: string,
    entryId: string | number
  ): Promise<{
    success: boolean;
    recycleBinId?: number | null;
    entries?: import('../utils/adminPhase3Intelligence').AdminFranchiseEntry[];
  }> {
    const safeKey = encodeURIComponent(franchiseKey.trim());
    const safeId = encodeURIComponent(String(entryId).trim());
    const res = await this.smartFetch(`/api/admin/franchises/${safeKey}/entries/${safeId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to remove entry from watch order (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      recycleBinId: json?.recycleBinId ?? null,
      entries: Array.isArray(json?.entries) ? json.entries : undefined,
    };
  }

  public async saveAdminFranchiseEntry(
    franchiseKey: string,
    payload: {
      anime_id: string | number;
      relation_label: string;
      watch_order?: number;
      note?: string | null;
      allowOverwrite?: boolean;
    }
  ): Promise<{ success: boolean; entry?: any }> {
    const safeKey = encodeURIComponent(franchiseKey.trim());
    const res = await this.smartFetch(`/api/admin/franchises/${safeKey}`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to save franchise entry (HTTP ${res.status})`);
    }
    return json;
  }

  public async saveAdminFranchiseOrder(
    franchiseKey: string,
    entries: Array<{
      anime_id: string | number;
      relation_label: string;
      watch_order: number;
      note?: string | null;
    }>
  ): Promise<{ success: boolean; updatedCount: number }> {
    const safeKey = encodeURIComponent(franchiseKey.trim());
    const res = await this.smartFetch(`/api/admin/franchises/${safeKey}`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify({ entries }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to save franchise watch order (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      updatedCount: Number(json?.updatedCount) || entries.length,
    };
  }

  public async deleteAdminFranchiseEntry(
    franchiseKey: string,
    animeId: string | number
  ): Promise<{ success: boolean; recycleBinId?: number | null }> {
    const safeKey = encodeURIComponent(franchiseKey.trim());
    const safeAnimeId = encodeURIComponent(String(animeId).trim());
    const res = await this.smartFetch(`/api/admin/franchises/${safeKey}/${safeAnimeId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to delete franchise entry (HTTP ${res.status})`);
    }
    return { success: true, recycleBinId: json?.recycleBinId ?? null };
  }

  /**
   * Characters & Indian / Japanese Voice Actor Manager APIs
   */
  public async fetchAdminCastEntries(options?: {
    animeId?: string | number;
    lang?: string;
  }): Promise<{
    success: boolean;
    tableReady: boolean;
    entries: import('../utils/adminPhase3Intelligence').AdminCastEntry[];
    supportedLanguages: string[];
  }> {
    const qs = new URLSearchParams();
    if (options?.animeId !== undefined && String(options.animeId).trim()) {
      qs.set('animeId', String(options.animeId).trim());
    }
    if (options?.lang && options.lang !== 'All' && options.lang !== 'all') {
      qs.set('lang', options.lang);
    }
    const endpoint = `/api/admin/cast${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await this.smartFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load cast entries (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      tableReady: json?.tableReady !== false,
      entries: Array.isArray(json?.entries) ? json.entries : [],
      supportedLanguages: Array.isArray(json?.supportedLanguages) ? json.supportedLanguages : [],
    };
  }

  public async createAdminCastEntry(payload: {
    anime_id: string | number;
    character_name: string;
    role: 'Main' | 'Supporting';
    voice_actor_name: string;
    dub_language: string;
    character_image?: string | null;
    actor_image?: string | null;
    verified?: boolean;
  }): Promise<{
    success: boolean;
    entry: import('../utils/adminPhase3Intelligence').AdminCastEntry;
  }> {
    const res = await this.smartFetch('/api/admin/cast', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to create cast entry (HTTP ${res.status})`);
    }
    return json;
  }

  public async updateAdminCastEntry(
    castId: number,
    payload: Partial<{
      anime_id: string | number;
      character_name: string;
      role: 'Main' | 'Supporting';
      voice_actor_name: string;
      dub_language: string;
      character_image: string | null;
      actor_image: string | null;
      verified: boolean;
    }>
  ): Promise<{
    success: boolean;
    entry?: import('../utils/adminPhase3Intelligence').AdminCastEntry;
    verified?: boolean;
  }> {
    const res = await this.smartFetch(`/api/admin/cast/${castId}`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to update cast entry (HTTP ${res.status})`);
    }
    return json;
  }

  public async deleteAdminCastEntry(castId: number): Promise<{ success: boolean; recycleBinId?: number | null }> {
    const res = await this.smartFetch(`/api/admin/cast/${castId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to delete cast entry (HTTP ${res.status})`);
    }
    return { success: true, recycleBinId: json?.recycleBinId ?? null };
  }

  /**
   * Actionable Admin Analytics 2.0 (Real Content Demand Intelligence)
   */
  public async fetchAdminDemandAnalytics(
    timeframe: 'today' | '7d' | '30d' | '90d' = '30d'
  ): Promise<{
    success: boolean;
    tableReady: boolean;
    timeframe: string;
    missingSearches: Array<{
      queryText: string;
      searchCount: number;
      lastSearchedAt: string;
    }>;
    languageDemand: Array<{
      code: string;
      language: string;
      nativeName: string;
      eventCount: number;
      sharePercent: number;
    }>;
    totalLanguageDemandEvents: number;
    ottPerformance: Array<{
      platform: string;
      impressions: number;
      clicks: number;
      ctrPercent: number | null;
      ctrDisplay: string;
    }>;
    highDemandMissingDubs: import('../utils/adminPhase35Polish').HighDemandMissingDubItem[];
    completenessGaps: {
      totalScanned: number;
      flaggedCount: number;
      healthyCount: number;
      countsByCategory: Record<string, number>;
    };
  }> {
    const res = await this.smartFetch(
      `/api/admin/analytics/demand?timeframe=${encodeURIComponent(timeframe)}`,
      {
        method: 'GET',
        headers: this.getHeaders(true),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load content demand analytics (HTTP ${res.status})`);
    }
    return {
      success: Boolean(json?.success),
      tableReady: json?.tableReady !== false,
      timeframe: json?.timeframe || timeframe,
      missingSearches: Array.isArray(json?.missingSearches) ? json.missingSearches : [],
      languageDemand: Array.isArray(json?.languageDemand) ? json.languageDemand : [],
      totalLanguageDemandEvents: Number(json?.totalLanguageDemandEvents) || 0,
      ottPerformance: Array.isArray(json?.ottPerformance) ? json.ottPerformance : [],
      highDemandMissingDubs: Array.isArray(json?.highDemandMissingDubs) ? json.highDemandMissingDubs : [],
      completenessGaps: json?.completenessGaps || {
        totalScanned: 0,
        flaggedCount: 0,
        healthyCount: 0,
        countsByCategory: {},
      },
    };
  }

  /**
   * Full Backup & Recovery Center APIs
   */
  public async fetchAdminBackupStats(): Promise<{
    success: boolean;
    schemaVersion: string;
    counts: Record<import('../utils/adminPhase3Intelligence').CoreContentBackupTable, number>;
    tableReady: Record<import('../utils/adminPhase3Intelligence').CoreContentBackupTable, boolean>;
  }> {
    const res = await this.smartFetch('/api/admin/backup/stats', {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load D1 backup stats (HTTP ${res.status})`);
    }
    return json;
  }

  public async exportFullCatalogCsvFromServer(): Promise<{
    success: boolean;
    rowCount: number;
    exportedAt: string;
    csv: string;
  }> {
    const res = await this.smartFetch('/api/admin/backup/export-csv', {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Server catalog CSV export failed (HTTP ${res.status})`);
    }
    return json;
  }

  public async exportFullContentJsonBackup(): Promise<{
    success: boolean;
    bundle: {
      schemaVersion: string;
      exportedAt: string;
      app: string;
      excludesPrivateCredentials: boolean;
      tableCounts: Record<string, number>;
      tables: Record<string, any[]>;
    };
  }> {
    const res = await this.smartFetch('/api/admin/backup/export-json', {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Full JSON content backup failed (HTTP ${res.status})`);
    }
    return json;
  }

  public async validateContentBackupJson(
    bundle: unknown
  ): Promise<{
    success: boolean;
    dryRun: boolean;
    report: import('../utils/adminPhase3Intelligence').ContentBackupValidationReport;
  }> {
    const res = await this.smartFetch('/api/admin/backup/validate', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ bundle }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Backup dry-run validation failed (HTTP ${res.status})`);
    }
    return json;
  }

  // ===========================================================================
  // ADMIN DASHBOARD 2.0 (Phase 3.5: Final Polish, Recycle Bin & Power Ops)
  // ===========================================================================

  public async fetchAdminRecycleBin(options?: {
    entity_type?: string;
    include_restored?: boolean;
  }): Promise<{
    success: boolean;
    items: Array<{
      id: number;
      entity_type: string;
      entity_id: string;
      title: string | null;
      payload: Record<string, any>;
      deleted_by: string | null;
      deleted_at: string;
      restored_at: string | null;
    }>;
  }> {
    const qs = new URLSearchParams();
    if (options?.entity_type && options.entity_type !== 'all') {
      qs.set('entity_type', options.entity_type);
    }
    if (options?.include_restored) {
      qs.set('include_restored', '1');
    }
    const endpoint = `/api/admin/recycle-bin${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await this.smartFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load Recycle Bin (HTTP ${res.status})`);
    }
    return {
      success: true,
      items: Array.isArray(json?.items) ? json.items : [],
    };
  }

  public async restoreAdminRecycleBinItem(binId: number): Promise<{
    success: boolean;
    restoredId: number;
    entity_type: string;
    entity_id: string;
    message?: string;
  }> {
    const res = await this.smartFetch(`/api/admin/recycle-bin/${binId}/restore`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to restore item (HTTP ${res.status})`);
    }
    this.clearCatalogIndexCache();
    return json;
  }

  public async purgeAdminRecycleBinItem(
    binId: number,
    confirm: string
  ): Promise<{ success: boolean; purgedId: number }> {
    const res = await this.smartFetch(`/api/admin/recycle-bin/${binId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
      body: JSON.stringify({ confirm }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to purge item (HTTP ${res.status})`);
    }
    return json;
  }

  public async fetchAdminAiUsage(): Promise<{
    success: boolean;
    usage: {
      usageDate: string;
      usedToday: number;
      dailyCap: number;
      remaining: number;
      allowed: boolean;
    };
    history: Array<{
      usage_date: string;
      translation_calls: number;
      daily_cap: number;
      updated_at: string;
    }>;
  }> {
    const res = await this.smartFetch('/api/admin/ai-usage', {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load Workers AI daily usage (HTTP ${res.status})`);
    }
    return {
      success: true,
      usage: json?.usage || {
        usageDate: new Date().toISOString().slice(0, 10),
        usedToday: 0,
        dailyCap: 100,
        remaining: 100,
        allowed: true,
      },
      history: Array.isArray(json?.history) ? json.history : [],
    };
  }

  public async updateAdminAiDailyCap(dailyCap: number): Promise<{
    success: boolean;
    usage: {
      usageDate: string;
      usedToday: number;
      dailyCap: number;
      remaining: number;
      allowed: boolean;
    };
  }> {
    const res = await this.smartFetch('/api/admin/ai-usage/cap', {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify({ dailyCap }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to update Workers AI daily cap (HTTP ${res.status})`);
    }
    return json;
  }

  public async fetchAdminTranslationVersions(
    animeId: string | number,
    locale: string
  ): Promise<{
    success: boolean;
    versions: Array<{
      id: number;
      anime_id: number;
      language_code: string;
      synopsis_text: string;
      source_type: string;
      saved_by: string | null;
      created_at: string;
    }>;
  }> {
    const res = await this.smartFetch(
      `/api/admin/translations/${encodeURIComponent(String(animeId))}/${encodeURIComponent(locale)}/versions`,
      {
        method: 'GET',
        headers: this.getHeaders(true),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load translation versions (HTTP ${res.status})`);
    }
    return {
      success: true,
      versions: Array.isArray(json?.versions) ? json.versions : [],
    };
  }

  public async rollbackAdminTranslationVersion(
    animeId: string | number,
    locale: string,
    versionId: number
  ): Promise<{
    success: boolean;
    anime_id: number;
    language_code: string;
    synopsis: string;
  }> {
    const res = await this.smartFetch(
      `/api/admin/translations/${encodeURIComponent(String(animeId))}/${encodeURIComponent(locale)}/rollback`,
      {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({ versionId }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to rollback translation version (HTTP ${res.status})`);
    }
    return json;
  }

  public async fetchAdminAnimeRevisions(animeId: string | number): Promise<{
    success: boolean;
    revisions: Array<{
      id: number;
      anime_id: number;
      revision_summary: string | null;
      snapshot: Record<string, any>;
      edited_by: string | null;
      created_at: string;
    }>;
  }> {
    const res = await this.smartFetch(
      `/api/admin/anime/${encodeURIComponent(String(animeId))}/revisions`,
      {
        method: 'GET',
        headers: this.getHeaders(true),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load anime revision history (HTTP ${res.status})`);
    }
    return {
      success: true,
      revisions: Array.isArray(json?.revisions) ? json.revisions : [],
    };
  }

  public async restoreAdminAnimeRevision(
    animeId: string | number,
    revisionId: number
  ): Promise<{
    success: boolean;
    restoredRevisionId: number;
    anime?: Record<string, any>;
  }> {
    const res = await this.smartFetch(
      `/api/admin/anime/${encodeURIComponent(String(animeId))}/revisions/${revisionId}/restore`,
      {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({}),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to restore anime revision (HTTP ${res.status})`);
    }
    this.clearCatalogIndexCache();
    return json;
  }

  /**
   * RESTORED LEGACY TOOL: IMDb / External Ratings Checker (Strict Clerk Admin Auth)
   */
  public async checkAdminImdbRatings(params: {
    animeIds?: number[];
    filter?: 'missing' | 'default' | 'all';
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<{
    success: boolean;
    checkedAt: string;
    omdbConfigured?: boolean;
    results: Array<{
      animeId: number;
      title: string;
      slug?: string | null;
      coverImage?: string | null;
      year?: number | string | null;
      currentRating: number | null;
      fetchedRating: number | null;
      delta: number | null;
      source: string;
      externalId?: string | null;
      externalUrl?: string | null;
      status: 'missing_current' | 'outdated' | 'matched' | 'not_found';
      note?: string;
    }>;
  }> {
    const res = await this.smartFetch('/api/admin/imdb-ratings/check', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(params),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `IMDb ratings check failed (HTTP ${res.status})`);
    }
    return {
      success: true,
      checkedAt: json?.checkedAt || new Date().toISOString(),
      omdbConfigured: Boolean(json?.omdbConfigured),
      results: Array.isArray(json?.results) ? json.results : [],
    };
  }

  /**
   * RESTORED LEGACY TOOL: Apply verified IMDb / External Ratings in single or batch mode
   */
  public async applyAdminImdbRatings(
    updates: Array<{ animeId: number; rating: number; externalId?: string }>
  ): Promise<{ success: boolean; updatedCount: number; updatedIds: number[] }> {
    const res = await this.smartFetch('/api/admin/imdb-ratings/apply', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ updates }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Failed to apply rating updates (HTTP ${res.status})`);
    }
    this.clearCatalogIndexCache();
    return {
      success: true,
      updatedCount: Number(json?.updatedCount || 0),
      updatedIds: Array.isArray(json?.updatedIds) ? json.updatedIds : [],
    };
  }

  /**
   * RESTORED LEGACY TOOL: Normalize legacy OTT platform tags in D1
   */
  public async normalizeAdminPlatforms(): Promise<{
    success: boolean;
    totalScanned: number;
    updatedCount: number;
    unchangedCount: number;
    updatedSamples: Array<{ id: number | string; before: string; after: string }>;
  }> {
    const res = await this.smartFetch('/api/admin/normalize-platforms', {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Platform normalization failed (HTTP ${res.status})`);
    }
    this.clearCatalogIndexCache();
    return {
      success: true,
      totalScanned: Number(json?.totalScanned || 0),
      updatedCount: Number(json?.updatedCount || 0),
      unchangedCount: Number(json?.unchangedCount || 0),
      updatedSamples: Array.isArray(json?.updatedSamples) ? json.updatedSamples : [],
    };
  }
}

export interface AdminAiUsageSnapshot {
  usageDate: string;
  usedToday: number;
  dailyCap: number;
  remaining: number;
  allowed: boolean;
}

export interface AdminAiUsageResponse {
  success: boolean;
  usage: AdminAiUsageSnapshot;
  history?: Array<{
    usage_date: string;
    translation_calls: number;
    daily_cap: number;
    updated_at: string;
  }>;
}

export interface TranslationVersionRecord {
  id: number;
  anime_id: number;
  language_code: string;
  synopsis_text: string;
  source_type: string;
  saved_by: string | null;
  created_at: string;
}

export interface AnimeRevisionRecord {
  id: number;
  anime_id: number;
  revision_summary: string | null;
  snapshot: Record<string, any>;
  edited_by: string | null;
  created_at: string;
}

export const cloudflareApi = new CloudflareApiService();


