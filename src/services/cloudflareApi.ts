/**
 * ============================================================================
 * CLOUDFLARE API CLIENT (Workers + D1 / KV CRUD Service)
 * ============================================================================
 * 
 * Provides unified, production-grade CRUD methods for interacting with
 * Cloudflare Workers and D1 database.
 */

import { CLOUDFLARE_API_URL, getCloudflareUrl, CLOUDFLARE_ENDPOINTS, DEFAULT_FALLBACK_WORKER_URL } from '../config/cloudflare';

export interface AnimePayload {
  id?: number | string;
  title: string;
  slug?: string;
  synopsis?: string;
  cover_image?: string;
  banner_image?: string;
  rating?: number;
  episodes_count?: number;
  status?: string;
  submissionStatus?: string;
  season?: string;
  year?: number;
  genres?: string;
  languages?: string;
  platform?: string;
  type?: string;
  Type?: string;
  studio?: string;
  episodes_per_season?: string;
  mixedEntries?: any[];
  streamingPartners?: any[];
  [key: string]: any;
}

export interface FetchCatalogOptions {
  page?: number;
  limit?: number;
  search?: string;
  genre?: string;
  status?: string;
  sort?: string;
  includePending?: boolean;
}

class CloudflareApiService {
  /**
   * Performs a fetch with automatic absolute URL fallback for robustness.
   * If a relative path request fails (due to missing Pages Functions), 
   * it retries using the hardcoded absolute Worker URL.
   */
  private async smartFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = getCloudflareUrl(path);
    const fetchOptions: RequestInit = {
      ...options,
      credentials: 'include' // Crucial for cross-origin cookie/session support with Worker fallback
    };
    
    try {
      console.log(`[API Request] ${options.method || 'GET'} ${url}`);
      const res = await fetch(url, fetchOptions);
      
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      // If we got a successful JSON response, return it immediately
      if (res.ok && isJson) {
        return res;
      }

      // If it's a 404 or non-JSON, and we are using relative paths (CLOUDFLARE_API_URL is empty),
      // retry with the absolute fallback Worker URL.
      if ((res.status === 404 || !isJson || !res.ok) && !CLOUDFLARE_API_URL) {
        const fallbackBase = DEFAULT_FALLBACK_WORKER_URL.replace(/\/+$/, '');
        const fallbackUrl = `${fallbackBase}${path.startsWith('/') ? path : '/' + path}`;
        console.warn(`[API discovery] Path ${url} returned ${res.status} (JSON: ${isJson}). Retrying with absolute fallback: ${fallbackUrl}`);
        return await fetch(fallbackUrl, fetchOptions);
      }

      return res;
    } catch (err: any) {
      console.warn(`[API Network Error] ${url}: ${err.message}`);
      // If network fails and we are using relative paths, retry with absolute fallback
      if (!CLOUDFLARE_API_URL) {
        const fallbackBase = DEFAULT_FALLBACK_WORKER_URL.replace(/\/+$/, '');
        const fallbackUrl = `${fallbackBase}${path.startsWith('/') ? path : '/' + path}`;
        console.warn(`[API discovery] Network failed for ${url}. Retrying with absolute fallback: ${fallbackUrl}`);
        return await fetch(fallbackUrl, fetchOptions);
      }
      throw err;
    }
  }

  /**
   * Retrieves the current admin authorization token
   */
  private getAdminToken(): string {
    try {
      return localStorage.getItem('cf_admin_token') || 'admin_secret';
    } catch {
      return 'admin_secret';
    }
  }

  /**
   * Generates default headers for Cloudflare Worker requests
   */
  private getHeaders(includeAuth: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (includeAuth) {
      const token = this.getAdminToken();
      headers['x-admin-token'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * READ: Fetches anime catalog from Cloudflare Worker / D1
   */
  public async fetchCatalog(options: FetchCatalogOptions = {}): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const queryParams = new URLSearchParams();
    if (options.limit) queryParams.set('limit', String(options.limit));
    if (options.page) queryParams.set('page', String(options.page));
    if (options.search) queryParams.set('search', options.search);
    if (options.genre && options.genre !== 'All' && options.genre !== 'All Genres') queryParams.set('genre', options.genre);
    if (options.status && options.status !== 'All' && options.status !== 'All Status') queryParams.set('status', options.status);
    if (options.sort) queryParams.set('sort', options.sort);
    if (options.includePending) queryParams.set('includePending', 'true');

    const qs = queryParams.toString();
    const endpoint = `${CLOUDFLARE_ENDPOINTS.CATALOG}${qs ? `?${qs}` : ''}`;
    const url = getCloudflareUrl(endpoint);

    const res = await this.smartFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(Boolean(options.includePending))
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[API Error] GET ${url} failed with status ${res.status}:`, errText);
      throw new Error(`Cloudflare API fetch failed (${res.status}) at ${url}: ${errText || res.statusText}`);
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const bodyText = await res.text().catch(() => 'no body');
      console.error(`[API Error] Expected JSON but received ${contentType} from ${url}. Body:`, bodyText);
      throw new Error(`Cloudflare API returned non-JSON response (${contentType}) from ${url}. Check if the backend is correctly deployed.`);
    }

    const json = await res.json();
    const data = json.data || (Array.isArray(json) ? json : []);
    const pagination = json.pagination || {
      page: options.page || 1,
      total: data.length,
      limit: options.limit || data.length,
      totalPages: 1
    };

    return {
      data,
      total: pagination.total ?? data.length,
      page: pagination.page ?? 1,
      totalPages: pagination.totalPages ?? 1
    };
  }

  /**
   * READ: Fetches single anime details by ID or slug from Cloudflare Worker / D1
   */
  public async getAnimeById(id: number | string): Promise<any> {
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
   * CREATE: Adds a new anime to Cloudflare D1
   */
  public async createAnime(payload: AnimePayload): Promise<{ success: boolean; animeId?: number; data?: any }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.CATALOG;
    const res = await this.smartFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to create anime on Cloudflare D1 (Status ${res.status})`);
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
      const errJson = await res.json().catch(() => ({}));
      if (errJson.error === 'Anime not found' || /not found/i.test(errJson.error || '')) {
        return { success: true };
      }
      throw new Error(errJson.error || `Failed to delete anime ID ${id} from Cloudflare D1 (Status ${res.status})`);
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
   * LIKE: Registers like increment or decrement in Cloudflare Worker / D1 (Strict 1 like per device via Cookie)
   */
  public async likeAnime(id: number | string, options?: { action?: 'like' | 'unlike'; delta?: number }): Promise<{ success: boolean; likes?: number; likesCount?: number }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.LIKE(id);
    let res: Response;
    try {
      res = await this.smartFetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(false),
        credentials: 'include',
        body: JSON.stringify(options || {})
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
      const httpError = new Error(isAlreadyVoted ? 'Already voted' : `HTTP ${res.status} (${res.statusText}): ${errDetail || 'Failed to update like'} at ${endpoint}`);
      (httpError as any).status = res.status;
      (httpError as any).statusText = res.statusText;
      (httpError as any).alreadyVoted = isAlreadyVoted;
      (httpError as any).rawMessage = errDetail;
      (httpError as any).url = endpoint;
      throw httpError;
    }

    return await res.json();
  }

  /**
   * VOTE: Registers community upvote in Cloudflare D1 (Strict 1 vote per device via Cookie)
   */
  public async upvoteAnime(id: number | string, options?: { action?: 'up' | 'down'; delta?: number }): Promise<{ success: boolean; upvotes?: number; popularity?: number }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.VOTE(id);
    let res: Response;
    try {
      res = await this.smartFetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify(options || {})
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
      const httpError = new Error(isAlreadyVoted ? 'Already voted' : `HTTP ${res.status} (${res.statusText}): ${errDetail || 'Failed to update upvote'} at ${endpoint}`);
      (httpError as any).status = res.status;
      (httpError as any).statusText = res.statusText;
      (httpError as any).alreadyVoted = isAlreadyVoted;
      (httpError as any).rawMessage = errDetail;
      (httpError as any).url = endpoint;
      throw httpError;
    }

    return await res.json();
  }

  /**
   * VOTE STATUS: Checks if current client device has already voted for this anime
   */
  public async checkVoteStatus(id: number | string): Promise<{ hasLiked: boolean; hasUpvoted: boolean }> {
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
  public async uploadImage(base64Image: string, filename?: string): Promise<{ success: boolean; url: string; display_url?: string }> {
    const endpoint = CLOUDFLARE_ENDPOINTS.UPLOAD;
    const res = await this.smartFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({
        image: base64Image,
        filename: filename || 'poster.png',
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
   * ADMIN: Verifies current session token
   */
  public async verifyAdmin(): Promise<boolean> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.VERIFY_ADMIN, {
        headers: this.getHeaders(true)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * ADMIN: Authenticates with passphrase
   */
  public async loginAdmin(password: string): Promise<{ success: boolean; token?: string }> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.LOGIN_ADMIN, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false };
    } catch (err) {
      console.error('Admin login error:', err);
      return { success: false };
    }
  }

  /**
   * WATCHLIST: Toggles an anime in the user's watchlist
   */
  public async toggleWatchlist(animeId: number | string): Promise<{ success: boolean; watchlisted: boolean }> {
    try {
      const res = await this.smartFetch(CLOUDFLARE_ENDPOINTS.WATCHLIST, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ anime_id: Number(animeId) })
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, watchlisted: false };
    } catch {
      return { success: false, watchlisted: false };
    }
  }

  /**
   * FEEDBACK: Submits user feedback or bug report
   */
  public async submitFeedback(payload: any): Promise<{ success: boolean }> {
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
}

export const cloudflareApi = new CloudflareApiService();
