/**
 * ============================================================================
 * CLOUDFLARE API CLIENT (Workers + D1 / KV CRUD Service)
 * ============================================================================
 * 
 * Provides unified, production-grade CRUD methods for interacting with
 * Cloudflare Workers and D1 database.
 */

import { CLOUDFLARE_API_URL, getCloudflareUrl, CLOUDFLARE_ENDPOINTS } from '../config/cloudflare';

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
    const url = getCloudflareUrl(`${CLOUDFLARE_ENDPOINTS.CATALOG}${qs ? `?${qs}` : ''}`);

    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(Boolean(options.includePending))
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Cloudflare API fetch failed (${res.status}): ${errText || res.statusText}`);
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
    const url = getCloudflareUrl(CLOUDFLARE_ENDPOINTS.ANIME_BY_ID(id));
    const res = await fetch(url, {
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
    const url = getCloudflareUrl(CLOUDFLARE_ENDPOINTS.CATALOG);
    const res = await fetch(url, {
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
   * UPDATE: Updates an existing anime in Cloudflare D1
   */
  public async updateAnime(id: number | string, payload: Partial<AnimePayload>): Promise<{ success: boolean; id: string | number }> {
    const url = getCloudflareUrl(CLOUDFLARE_ENDPOINTS.ANIME_BY_ID(id));
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to update anime ID ${id} on Cloudflare D1 (Status ${res.status})`);
    }

    return await res.json();
  }

  /**
   * DELETE: Deletes an anime from Cloudflare D1
   */
  public async deleteAnime(id: number | string): Promise<{ success: boolean }> {
    const url = getCloudflareUrl(CLOUDFLARE_ENDPOINTS.ANIME_BY_ID(id));
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(true)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to delete anime ID ${id} from Cloudflare D1 (Status ${res.status})`);
    }

    return await res.json();
  }

  /**
   * APPROVE: Approves a pending submission in Cloudflare D1
   */
  public async approveAnime(id: number | string): Promise<any> {
    const url = getCloudflareUrl(CLOUDFLARE_ENDPOINTS.APPROVE(id));
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ status: 'Airing', submissionStatus: 'approved' })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to approve anime ID ${id} on Cloudflare D1`);
    }

    return await res.json();
  }

  /**
   * VOTE: Registers community upvote in Cloudflare D1
   */
  public async upvoteAnime(id: number | string): Promise<{ success: boolean; popularity: number }> {
    const url = getCloudflareUrl(CLOUDFLARE_ENDPOINTS.VOTE(id));
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(false)
    });

    if (!res.ok) {
      throw new Error(`Failed to upvote anime ID ${id} on Cloudflare API`);
    }

    return await res.json();
  }

  /**
   * UPLOAD: Proxies image upload to ImgBB via Cloudflare Worker backend
   */
  public async uploadImage(base64Image: string, filename?: string): Promise<{ success: boolean; url: string; display_url?: string }> {
    const url = getCloudflareUrl(CLOUDFLARE_ENDPOINTS.UPLOAD);
    const res = await fetch(url, {
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
}

export const cloudflareApi = new CloudflareApiService();
