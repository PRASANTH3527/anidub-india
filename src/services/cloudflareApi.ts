/**
 * ============================================================================
 * CLOUDFLARE API CLIENT (Workers + D1 / KV CRUD Service)
 * ============================================================================
 * 
 * Provides unified, production-grade CRUD methods for interacting with
 * Cloudflare Workers and D1 database.
 */

import { CLOUDFLARE_API_URL, getCloudflareUrl, CLOUDFLARE_ENDPOINTS, DEFAULT_FALLBACK_WORKER_URL } from '../config/cloudflare';
import { getClerkSessionToken } from '../lib/clerk';
import {
  normalizeWatchlistIds,
  readWatchlistFromStorage,
  toggleWatchlistIdLocally,
  writeWatchlistToStorage,
} from '../utils/watchlist';

export interface PartnerEntry {
  name?: string;
  url?: string;
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
  platforms?: string[] | string;
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
  created_at?: string;
}

export interface AnimeReviewPayload {
  rating?: number;
  language?: string;
  comment?: string;
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
  spoilers?: boolean;
  likes?: number;
  date?: string;
  created_at?: string;
}

export interface FeedbackSubmitPayload {
  name?: string;
  email?: string;
  feedback: string;
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
  type?: string;
  status?: string;
  sort?: string;
  includePending?: boolean;
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
  languagesList: string[];
  languagesString: string;
  languageFilters?: { label: string; value: string; count: number }[];
}

class CloudflareApiService {
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
        if (options.method && options.method !== 'GET') {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Backend proxy returned an HTML page instead of JSON. Ensure session cookies are enabled.' 
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        console.warn(`[smartFetch] Intercepted non-JSON response from ${url}. Returning empty JSON.`);
        return new Response(JSON.stringify({ success: false, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (res.ok) {
        return res;
      }

      return res;
    } catch (err: any) {
      if (options.method && options.method !== 'GET') {
        return new Response(JSON.stringify({ success: false, error: err.message || 'Network error' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: false, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
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
    if (options.type && options.type !== 'All' && options.type !== 'All Types') queryParams.set('type', options.type);
    if (options.status && options.status !== 'All' && options.status !== 'All Status') queryParams.set('status', options.status);
    if (options.sort) queryParams.set('sort', options.sort);
    if (options.includePending) queryParams.set('includePending', 'true');

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

    const res = await this.smartFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(Boolean(options.includePending))
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[API Notice] GET ${url} received status ${res.status}: ${errText}.`);
      return {
        data: [],
        meta: fallbackMeta,
        summary: null,
        total: 0,
        page: requestedPage,
        totalPages: 1
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      console.warn(`[API Notice] Received non-JSON content type (${contentType}) from ${url}.`);
      return {
        data: [],
        meta: fallbackMeta,
        summary: null,
        total: 0,
        page: requestedPage,
        totalPages: 1
      };
    }

    const json = await res.json().catch(() => ({ data: [] }));
    const data = json.data || (Array.isArray(json) ? json : []);
    const rawMeta = json.meta || {};
    const rawPag = json.pagination || {};

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
      data,
      meta,
      summary: json.summary || null,
      total: meta.totalItems,
      page: meta.currentPage,
      totalPages: meta.totalPages
    };
  }

  /**
   * READ: Fetches single anime details by ID or slug from Cloudflare Worker / D1
   */
  public async getAnimeById(id: number | string, _userId?: string): Promise<AnimePayload | null> {
    const endpoint = CLOUDFLARE_ENDPOINTS.ANIME_BY_ID(id);
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
  public async uploadCSV(payload: { csvText?: string; animeList?: Record<string, unknown>[] } | string): Promise<{ success: boolean; count?: number; skipped?: number; insertedCount?: number; skippedCount?: number; skippedTitles?: string[]; addedTitles?: string[]; message?: string }> {
    const endpoint = '/api/admin/import-csv';
    const bodyData = typeof payload === 'string' ? { csvText: payload } : payload;

    const res = await this.smartFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(bodyData)
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

    return await res.json();
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
      try {
        const json = await res.json();
        errBody = json.error || json.message || JSON.stringify(json);
      } catch {
        errBody = await res.text().catch(() => res.statusText);
      }
      throw new Error(`[ERROR] Backend returned ${res.status} (${res.statusText}): ${errBody || 'Update rejected'}`);
    }

    return await res.json();
  }

  /**
   * DELETE: Deletes an anime from Cloudflare D1
   */
  public async deleteAnime(id: number | string): Promise<{ success: boolean }> {
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
      // If the anime is already not found on the backend, it is successfully purged/absent
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

    return await res.json().catch(() => ({ success: true }));
  }

  /**
   * REJECT: Rejects a pending submission from Cloudflare D1
   */
  public async rejectAnime(id: number | string): Promise<{ success: boolean }> {
    try {
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

    return await res.json();
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
   * FEEDBACK: Submits user feedback or bug report
   */
  public async submitFeedback(payload: FeedbackSubmitPayload): Promise<{ success: boolean }> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.FEEDBACK, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify(payload)
      });
      return { success: res.ok };
    } catch {
      return { success: false };
    }
  }

  /**
   * CHAT: Fetches recent community chat messages
   */
  public async fetchChatHistory(): Promise<ChatMessageRecord[]> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.CHAT, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : (data.messages || data.data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch chat history:', err);
    }
    return [];
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
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.CHAT, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyWithToken)
      });
      const data = await res.json().catch(() => ({}));
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
   * REVIEWS: Submits a new review for an anime
   */
  public async submitReview(id: number | string, payload: AnimeReviewPayload): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.ANIME_REVIEWS(id), {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
      throw new Error('Failed to submit review');
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
   * REPORT: Submits an issue report for an anime
   */
  public async reportIssue(payload: { animeTitle: string; reason: string; notes?: string }): Promise<{ success: boolean; deliveredToTelegram: boolean }> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.REPORT, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
      throw new Error('Failed to submit report');
    } catch (err: any) {
      console.error('Report issue error:', err);
      throw err;
    }
  }

  /**
   * TELEGRAM: Fetches bot configuration status
   */
  public async fetchTelegramStatus(): Promise<TelegramStatusResponse> {
    try {
      const res = await this.smartFetch('/api/telegram/status');
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Failed to fetch Telegram status:', err);
    }
    return { configured: false };
  }

  /**
   * TELEGRAM: Updates bot credentials
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
   * TELEGRAM: Sends a test notification
   */
  public async testTelegram(payload: Record<string, unknown> = {}): Promise<{ success?: boolean; error?: string; message?: string }> {
    const res = await this.smartFetch('/api/telegram/test', {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  /**
   * FEEDBACK: Fetches all user feedback
   */
  public async fetchFeedback(): Promise<FeedbackRecord[]> {
    try {
      const res = await this.smartFetch('/api/feedback');
      if (res.ok) {
        const data = await res.json();
        return data.feedback || [];
      }
    } catch (err) {
      console.warn('Failed to fetch feedback:', err);
    }
    return [];
  }

  /**
   * FEEDBACK: Deletes / resolves feedback item
   */
  public async deleteFeedback(id: number | string): Promise<{ success: boolean }> {
    try {
      const res = await this.smartFetch(`/api/feedback/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(true)
      });
      return { success: res.ok };
    } catch {
      return { success: false };
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
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch (err) {
      console.warn('[cloudflareApi] trackAnalytics error:', err);
      return false;
    }
  }

  /**
   * GOD-MODE ANALYTICS: Fetch live dashboard metrics from D1 Edge Analytics
   */
  public async fetchAnalyticsDashboard(range: string = 'all'): Promise<any> {
    try {
      const res = await this.smartFetch(`/api/analytics/dashboard?range=${encodeURIComponent(range)}`, {
        headers: this.getHeaders(true)
      });
      if (res.ok) {
        const json = await res.json();
        return json?.data || json;
      }
    } catch (err) {
      console.warn('[cloudflareApi] fetchAnalyticsDashboard error:', err);
    }
    return null;
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
}

export const cloudflareApi = new CloudflareApiService();
