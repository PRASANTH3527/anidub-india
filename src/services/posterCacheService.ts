// ==============================================================================
// AniDub India — PWA Offline Poster Caching Service
// ==============================================================================

export const POSTER_CACHE_NAME = 'anidub-posters-v2';

export interface PosterCacheStats {
  count: number;
  estimatedBytes?: number;
}

class PosterCacheService {
  private isSupported(): boolean {
    return typeof window !== 'undefined' && 'caches' in window;
  }

  /**
   * Check if a specific poster image URL is already cached locally
   */
  async isCached(imageUrl: string): Promise<boolean> {
    if (!this.isSupported() || !imageUrl) return false;
    try {
      const cache = await caches.open(POSTER_CACHE_NAME);
      const match = await cache.match(imageUrl);
      return !!match;
    } catch (err) {
      console.warn('[PosterCache] isCached error:', err);
      return false;
    }
  }

  /**
   * Pre-cache an individual anime poster for 100% offline viewing
   */
  async cachePoster(imageUrl: string): Promise<boolean> {
    if (!this.isSupported() || !imageUrl) return false;
    try {
      const cache = await caches.open(POSTER_CACHE_NAME);
      const existing = await cache.match(imageUrl);
      if (existing) return true;

      // Fetch with no-cors or standard mode
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit',
      });

      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(imageUrl, response.clone());
        return true;
      }
      return false;
    } catch (err) {
      // Fallback attempt with simple Request
      try {
        const cache = await caches.open(POSTER_CACHE_NAME);
        const res = await fetch(new Request(imageUrl, { mode: 'no-cors' }));
        await cache.put(imageUrl, res);
        return true;
      } catch (innerErr) {
        console.warn('[PosterCache] Failed to cache image:', imageUrl, innerErr);
        return false;
      }
    }
  }

  /**
   * Batch pre-cache multiple anime posters (e.g. for watchlist or top trending)
   */
  async cacheMultiplePosters(imageUrls: string[]): Promise<{ success: number; failed: number }> {
    if (!this.isSupported() || !imageUrls.length) return { success: 0, failed: 0 };
    
    let success = 0;
    let failed = 0;

    const uniqueUrls = Array.from(new Set(imageUrls.filter(Boolean)));
    
    // Batch in chunks of 4 to prevent network congestion on mobile
    const chunkSize = 4;
    for (let i = 0; i < uniqueUrls.length; i += chunkSize) {
      const chunk = uniqueUrls.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (url) => {
          const ok = await this.cachePoster(url);
          if (ok) success++;
          else failed++;
        })
      );
    }

    return { success, failed };
  }

  /**
   * Remove a specific poster from cache
   */
  async removePoster(imageUrl: string): Promise<boolean> {
    if (!this.isSupported() || !imageUrl) return false;
    try {
      const cache = await caches.open(POSTER_CACHE_NAME);
      return await cache.delete(imageUrl);
    } catch (err) {
      console.warn('[PosterCache] Delete error:', err);
      return false;
    }
  }

  /**
   * Get total number of cached posters and estimated storage
   */
  async getStats(): Promise<PosterCacheStats> {
    if (!this.isSupported()) return { count: 0 };
    try {
      const cache = await caches.open(POSTER_CACHE_NAME);
      const keys = await cache.keys();
      return {
        count: keys.length,
      };
    } catch (err) {
      console.warn('[PosterCache] getStats error:', err);
      return { count: 0 };
    }
  }

  /**
   * Clear all cached posters to free up mobile storage
   */
  async clearAll(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      return await caches.delete(POSTER_CACHE_NAME);
    } catch (err) {
      console.warn('[PosterCache] clearAll error:', err);
      return false;
    }
  }
}

export const posterCacheService = new PosterCacheService();
