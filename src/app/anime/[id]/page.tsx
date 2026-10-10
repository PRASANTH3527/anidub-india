import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ANIME_DATABASE } from '../../../data/animeData';
import { supabase } from '../../../lib/supabase';
import { Anime } from '../../../types/anime';

interface PageProps {
  params: Promise<{ id: string }>;
}

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=630&fit=crop&q=85';

/**
 * Helper to fetch anime from static database or live Supabase tables
 */
async function getAnimeRecord(id: string): Promise<Anime | null> {
  // 1. Try static dataset
  const staticFound = ANIME_DATABASE.find((a) => a.id === id);
  if (staticFound) return staticFound;

  // 2. Query Supabase animes table
  try {
    const { data } = await supabase
      .from('animes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      const dubs = Array.isArray(data.dubs) && data.dubs.length > 0 ? data.dubs : ['Tamil'];
      const poster = (data.poster || data.image || data.imageUrl || '').trim() || DEFAULT_BANNER;
      const platforms = Array.isArray(data.platforms) ? data.platforms : [{ name: 'Crunchyroll', url: 'https://www.crunchyroll.com', languages: dubs }];
      const dubDetails = Array.isArray(data.dub_details || data.dubDetails)
        ? (data.dub_details || data.dubDetails)
        : dubs.map((d: any) => ({
            language: d,
            available: true,
            platform: platforms.map((p: any) => p?.name || String(p)),
          }));

      return {
        id: String(data.id),
        title: data.title || 'Untitled Anime',
        romajiTitle: data.romaji_title || data.romajiTitle || '',
        nativeTitle: data.native_title || data.nativeTitle || '',
        poster,
        imageUrl: poster,
        synopsis: data.synopsis || data.description || '',
        type: data.type || 'TV Series',
        episodes: Number(data.episodes) || 12,
        releaseYear: Number(data.release_year || data.releaseYear) || 2024,
        rating: Number(data.rating) || 8.5,
        genres: Array.isArray(data.genres) && data.genres.length > 0 ? data.genres : ['Action', 'Animation'],
        themes: Array.isArray(data.themes) ? data.themes : [],
        dubs,
        dubDetails,
        platforms,
        studio: data.studio || data.animation_studio || 'Animation Studio',
        likes: Number(data.likes || data.upvotes || 0),
        status: data.status || 'Ongoing',
        airingStatus: data.airing_status || data.airingStatus || 'Ongoing',
      };
    }
  } catch (err) {
    console.warn('[AnimeRoute] Supabase animes fetch notice:', err);
  }

  // 3. Fallback query to anime_list table
  try {
    const { data } = await supabase
      .from('anime_list')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      const dubs = Array.isArray(data.dubs) && data.dubs.length > 0 ? data.dubs : ['Tamil'];
      const poster = (data.poster || data.image || data.imageUrl || '').trim() || DEFAULT_BANNER;
      const platforms = Array.isArray(data.platforms) ? data.platforms : [{ name: 'Crunchyroll', url: 'https://www.crunchyroll.com', languages: dubs }];
      const dubDetails = Array.isArray(data.dub_details || data.dubDetails)
        ? (data.dub_details || data.dubDetails)
        : dubs.map((d: any) => ({
            language: d,
            available: true,
            platform: platforms.map((p: any) => p?.name || String(p)),
          }));

      return {
        id: String(data.id),
        title: data.title || 'Untitled Anime',
        romajiTitle: data.romaji_title || data.romajiTitle || '',
        nativeTitle: data.native_title || data.nativeTitle || '',
        poster,
        imageUrl: poster,
        synopsis: data.synopsis || data.description || '',
        type: data.type || 'TV Series',
        episodes: Number(data.episodes) || 12,
        releaseYear: Number(data.release_year || data.releaseYear) || 2024,
        rating: Number(data.rating) || 8.5,
        genres: Array.isArray(data.genres) && data.genres.length > 0 ? data.genres : ['Action', 'Animation'],
        themes: Array.isArray(data.themes) ? data.themes : [],
        dubs,
        dubDetails,
        platforms,
        studio: data.studio || data.animation_studio || 'Animation Studio',
        likes: Number(data.likes || data.upvotes || 0),
        status: data.status || 'Ongoing',
        airingStatus: data.airing_status || data.airingStatus || 'Ongoing',
      };
    }
  } catch (err) {
    console.warn('[AnimeRoute] Supabase anime_list fetch notice:', err);
  }

  return null;
}

/**
 * Next.js Dynamic generateMetadata for SEO, WhatsApp, and Telegram OpenGraph cards
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const anime = await getAnimeRecord(id);

  if (!anime) {
    return {
      title: 'Anime Not Found — AniDub India',
      description: 'Discover regional dubbed anime in Tamil, Telugu, Hindi, Malayalam, and Kannada on AniDub India.',
    };
  }

  const dubList = (anime.dubs || []).join(', ') || 'Regional Indian Languages';
  const platforms = Array.isArray(anime.platforms)
    ? anime.platforms.map((p: any) => p?.name || String(p)).filter(Boolean).join(', ')
    : 'Crunchyroll, Netflix, JioCinema';

  // Standard SEO Title & Description matching requirement 1
  const title = `${anime.title} Dubbed Streaming in India - AniDub India`;
  const description = `Stream ${anime.title} legally dubbed in ${dubList} in India on ${platforms}. Episode guides, voice cast, and official streaming links on AniDub India.`;

  const posterUrl = anime.imageUrl || anime.poster || DEFAULT_BANNER;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://anidub.in';

  // Dynamic Open Graph Image endpoint
  const ogUrl = new URL('/api/og', baseUrl);
  ogUrl.searchParams.set('title', anime.title);
  ogUrl.searchParams.set('poster', posterUrl);
  ogUrl.searchParams.set('dubs', (anime.dubs || []).join(','));
  ogUrl.searchParams.set('studio', (anime as any).animationStudio || anime.studio || '');
  ogUrl.searchParams.set('rating', String(anime.rating || '8.5'));
  ogUrl.searchParams.set('type', anime.type || 'TV Series');

  return {
    title,
    description,
    keywords: [
      `${anime.title} dubbed`,
      `${anime.title} Tamil dub`,
      `${anime.title} Telugu dub`,
      `${anime.title} Hindi dub`,
      `${anime.title} Malayalam dub`,
      `${anime.title} streaming in India`,
      `${anime.title} Crunchyroll India`,
      `${anime.title} Netflix India`,
      'Indian anime dub directory',
    ],
    openGraph: {
      title,
      description,
      url: `${baseUrl}/anime/${anime.id}`,
      siteName: 'AniDub India',
      locale: 'en_IN',
      type: (anime.type || '').toLowerCase().includes('movie') ? 'video.movie' : 'video.tv_show',
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${anime.title} Dubbed Streaming in India`,
          type: 'image/png',
        },
        ...(posterUrl ? [{
          url: posterUrl,
          width: 600,
          height: 800,
          alt: `${anime.title} Poster`,
        }] : []),
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl.toString()],
    },
    alternates: {
      canonical: `${baseUrl}/anime/${anime.id}`,
    },
  };
}

export default async function AnimeDynamicRoute({ params }: PageProps) {
  const { id } = await params;
  const anime = await getAnimeRecord(id);

  if (!anime) {
    redirect('/');
  }

  const isMovie = (anime.type || '').toLowerCase().includes('movie');
  const dubList = Array.isArray(anime.dubs) ? anime.dubs : ['Tamil'];
  const platforms = Array.isArray(anime.platforms)
    ? anime.platforms.map((p: any) => p?.name || String(p)).filter(Boolean)
    : ['Crunchyroll'];

  // Schema.org Structured Data (TVSeries / Movie) for Google Rich Snippets
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    name: anime.title,
    alternateName: [anime.romajiTitle, (anime as any).nativeTitle].filter(Boolean),
    description: anime.synopsis || `Stream ${anime.title} legally dubbed in Indian regional languages on ${platforms.join(', ')}.`,
    image: anime.imageUrl || anime.poster || DEFAULT_BANNER,
    genre: Array.isArray(anime.genres) ? anime.genres : ['Animation', 'Action'],
    inLanguage: dubList.map((lang: string) => lang.toLowerCase()),
    productionCompany: {
      '@type': 'Organization',
      name: anime.studio || (anime as any).animationStudio || 'Animation Studio',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(anime.rating || '8.5'),
      bestRating: '10',
      worstRating: '1',
      ratingCount: Number((anime as any).upvotes || anime.likes || 120),
    },
    offers: platforms.map((platform: string) => ({
      '@type': 'Offer',
      name: platform,
      category: 'Subscription',
      eligibleRegion: {
        '@type': 'Country',
        name: 'IN',
      },
    })),
  };

  if (anime.releaseYear) {
    jsonLd.datePublished = `${anime.releaseYear}-01-01`;
  }

  if (!isMovie) {
    jsonLd.numberOfEpisodes = Number(anime.episodes || 12);
    jsonLd.numberOfSeasons = 1;
  }

  return (
    <>
      {/* Schema.org TVSeries / Movie JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Client-side immediate navigation to single-page modal and experience */}
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="animate-pulse text-neutral-400 font-bold text-sm">
          Loading {anime.title} on AniDub India...
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `window.location.replace('/#anime/${id}');` }} />
    </>
  );
}
