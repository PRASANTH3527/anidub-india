import type { MetadataRoute } from 'next';
import { supabase } from '../lib/supabase';
import { getBaseUrl } from '../utils/url';

export const revalidate = 3600; // revalidate dynamic sitemap hourly

const INDIAN_DUB_LANGUAGES = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'Bengali'];
const STREAMING_PLATFORMS = ['Crunchyroll', 'Netflix', 'JioHotstar', 'JioCinema', 'Prime Video', 'Disney+ Hotstar'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  // 1. Static high-level internal routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/share`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  // 2. Category routes for language landing directories
  const languageCategoryRoutes: MetadataRoute.Sitemap = INDIAN_DUB_LANGUAGES.map((lang) => ({
    url: `${baseUrl}/?dub=${encodeURIComponent(lang)}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.85,
  }));

  // 3. Platform routes for streaming directories
  const platformCategoryRoutes: MetadataRoute.Sitemap = STREAMING_PLATFORMS.map((platform) => ({
    url: `${baseUrl}/?platform=${encodeURIComponent(platform)}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  // 4. Aggregate all unique anime entries from Supabase
  const animeMap = new Map<string, { id: string; updatedAt?: string }>();

  // Fetch approved entries from Supabase 'animes' table
  try {
    const { data, error } = await supabase
      .from('animes')
      .select('id, updated_at, submitted_at, status, is_deleted')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .limit(1000);

    if (!error && data && data.length > 0) {
      for (const row of data) {
        if (!row.is_deleted && String(row.status || '').toLowerCase() !== 'rejected') {
          animeMap.set(String(row.id), {
            id: String(row.id),
            updatedAt: row.updated_at || row.submitted_at,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Sitemap] animes query notice:', err);
  }

  // Also query 'anime_list' table for complete coverage if present
  try {
    const { data, error } = await supabase
      .from('anime_list')
      .select('id, updated_at, submitted_at, status, is_deleted')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .limit(1000);

    if (!error && data && data.length > 0) {
      for (const row of data) {
        if (!row.is_deleted && String(row.status || '').toLowerCase() !== 'rejected') {
          if (!animeMap.has(String(row.id))) {
            animeMap.set(String(row.id), {
              id: String(row.id),
              updatedAt: row.updated_at || row.submitted_at,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Sitemap] anime_list query notice:', err);
  }

  // 5. Map dynamic anime detail entries
  const dynamicRoutes: MetadataRoute.Sitemap = Array.from(animeMap.values()).map((entry) => ({
    url: `${baseUrl}/anime/${entry.id}`,
    lastModified: entry.updatedAt ? new Date(entry.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.75,
  }));

  return [
    ...staticRoutes,
    ...languageCategoryRoutes,
    ...platformCategoryRoutes,
    ...dynamicRoutes,
  ];
}
