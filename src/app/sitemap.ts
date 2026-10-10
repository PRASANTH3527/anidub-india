import type { MetadataRoute } from 'next';
import { supabase } from '../lib/supabase';
import { ANIME_DATABASE } from '../data/animeData';

export const revalidate = 3600; // revalidate dynamic sitemap hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://anidub.in';

  // 1. Static high-level routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/share`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ];

  // 2. Aggregate all unique anime entries from both static catalog and Supabase
  const animeMap = new Map<string, { id: string; updatedAt?: string }>();

  // Add static anime catalog items
  for (const item of ANIME_DATABASE) {
    if (item?.id) {
      animeMap.set(String(item.id), { id: String(item.id) });
    }
  }

  // Fetch approved entries from Supabase 'animes' table
  try {
    const { data } = await supabase
      .from('animes')
      .select('id, updated_at, submitted_at, status, is_deleted')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .limit(1000);

    if (data && data.length > 0) {
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

  // Also query 'anime_list' table for complete coverage
  try {
    const { data } = await supabase
      .from('anime_list')
      .select('id, updated_at, submitted_at, status, is_deleted')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .limit(1000);

    if (data && data.length > 0) {
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

  // 3. Map dynamic anime detail entries
  const dynamicRoutes: MetadataRoute.Sitemap = Array.from(animeMap.values()).map((entry) => ({
    url: `${baseUrl}/anime/${entry.id}`,
    lastModified: entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...dynamicRoutes];
}
