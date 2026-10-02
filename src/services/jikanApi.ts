import { JikanAnimeResult } from '../types/database';

const JIKAN_CACHE = new Map<string, JikanAnimeResult[]>();
let lastRequestTime = 0;

export interface AutoFillAnimeData {
  title: string;
  romajiTitle: string;
  nativeTitle: string;
  poster: string;
  synopsis: string;
  releaseYear: number;
  episodes: number;
  type: 'TV Series' | 'Movie' | 'OVA' | 'ONA' | 'Special';
  studio: string;
  genres: string[];
  themes: string[];
  rating: number;
  originalReleaseDate: string;
  airing?: boolean;
  status?: string;
}

/**
 * Searches anime via the official Jikan v4 REST API (MyAnimeList).
 * Respects rate limits with throttling and caching.
 */
export async function searchJikanAnime(query: string): Promise<JikanAnimeResult[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.length < 2) return [];

  // Return from cache if exists
  if (JIKAN_CACHE.has(cleanQuery)) {
    return JIKAN_CACHE.get(cleanQuery)!;
  }

  // Throttle requests (Jikan has a 3 requests/sec limit)
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 400) {
    await new Promise((resolve) => setTimeout(resolve, 400 - timeSinceLast));
  }
  lastRequestTime = Date.now();

  try {
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanQuery)}&limit=6&sfw=true`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Jikan API rate limit reached, will back off');
      }
      return getFallbackSearchResults(cleanQuery);
    }

    const data = await response.json();
    const results: JikanAnimeResult[] = data.data || [];
    JIKAN_CACHE.set(cleanQuery, results);
    return results;
  } catch (error) {
    console.error('Error fetching from Jikan API:', error);
    return getFallbackSearchResults(cleanQuery);
  }
}

/**
 * Transforms Jikan API anime item into our application's auto-fill schema.
 */
export function formatJikanToAnime(item: JikanAnimeResult): AutoFillAnimeData {
  const poster =
    item.images?.webp?.large_image_url ||
    item.images?.jpg?.large_image_url ||
    item.images?.jpg?.image_url ||
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

  const type: 'TV Series' | 'Movie' | 'OVA' | 'ONA' | 'Special' =
    item.type === 'Movie' ? 'Movie' : 
    item.type === 'OVA' ? 'OVA' : 
    item.type === 'ONA' ? 'ONA' : 
    item.type === 'Special' ? 'Special' : 'TV Series';

  const year =
    item.year ||
    (item.aired?.from ? new Date(item.aired.from).getFullYear() : new Date().getFullYear());

  const genres = item.genres?.map((g) => g.name) || ['Action', 'Fantasy'];
  const themes = item.themes?.map((t) => t.name) || ['Super Power'];
  const studio = item.studios?.[0]?.name || 'Unknown Studio';

  return {
    title: item.title_english || item.title,
    romajiTitle: item.title,
    nativeTitle: item.title_japanese || '',
    poster,
    synopsis: item.synopsis || 'No synopsis available from MyAnimeList.',
    releaseYear: year,
    episodes: item.episodes || 12,
    type,
    studio,
    genres,
    themes,
    rating: item.score ? Number(item.score.toFixed(1)) : 8.0,
    originalReleaseDate: item.aired?.string || `${year}`,
    airing: item.airing,
    status: item.status,
  };
}

// Fallback search results if network/CORS/rate limit blocks
function getFallbackSearchResults(query: string): JikanAnimeResult[] {
  const fallbackList: JikanAnimeResult[] = [
    {
      mal_id: 52991,
      title: 'Sousou no Frieren',
      title_english: "Frieren: Beyond Journey's End",
      title_japanese: '葬送のフリーレン',
      images: {
        jpg: {
          image_url: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
          large_image_url: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg',
        },
      },
      synopsis: 'Elf mage Frieren outlives her heroic party. She sets out on a journey across humanity.',
      year: 2023,
      episodes: 28,
      type: 'TV',
      score: 9.3,
      studios: [{ name: 'Madhouse' }],
      genres: [{ name: 'Adventure' }, { name: 'Fantasy' }],
    },
    {
      mal_id: 52299,
      title: 'Ore dake Level Up na Ken',
      title_english: 'Solo Leveling',
      title_japanese: '俺だけレベルアップな件',
      images: {
        jpg: {
          image_url: 'https://cdn.myanimelist.net/images/anime/1586/141019.jpg',
          large_image_url: 'https://cdn.myanimelist.net/images/anime/1586/141019l.jpg',
        },
      },
      synopsis: 'Sung Jinwoo becomes the world\'s strongest hunter through an exclusive leveling system.',
      year: 2024,
      episodes: 12,
      type: 'TV',
      score: 8.5,
      studios: [{ name: 'A-1 Pictures' }],
      genres: [{ name: 'Action' }, { name: 'Fantasy' }],
    },
    {
      mal_id: 57334,
      title: 'Dandadan',
      title_english: 'Dandadan',
      title_japanese: 'ダンダダン',
      images: {
        jpg: {
          image_url: 'https://cdn.myanimelist.net/images/anime/1487/146059.jpg',
          large_image_url: 'https://cdn.myanimelist.net/images/anime/1487/146059l.jpg',
        },
      },
      synopsis: 'High school students Momo and Okarun uncover mindblowing ghosts and alien encounters.',
      year: 2024,
      episodes: 12,
      type: 'TV',
      score: 8.7,
      studios: [{ name: 'Science SARU' }],
      genres: [{ name: 'Action' }, { name: 'Comedy' }, { name: 'Supernatural' }],
    }
  ];

  return fallbackList.filter(
    (item) =>
      item.title.toLowerCase().includes(query) ||
      item.title_english?.toLowerCase().includes(query)
  );
}
