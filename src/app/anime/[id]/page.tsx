import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ANIME_DATABASE } from '../../../data/animeData';
import { supabase } from '../../../lib/supabase';
import { Anime } from '../../../types/anime';
import { generateAnimeFaqs, buildFaqSchemaOrg } from '../../../utils/seo';

interface PageProps {
  params: Promise<{ id: string }>;
}

const DEFAULT_BANNER = 'https://anidub.in/og-default.png';

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

  const pageCanonical = `${baseUrl}/anime/${anime.id}`;

  return {
    title,
    description,
    keywords: [
      `${anime.title} dubbed`,
      `${anime.title} Tamil dub`,
      `${anime.title} Telugu dub`,
      `${anime.title} Hindi dub`,
      `${anime.title} Malayalam dub`,
      `${anime.title} Kannada dub`,
      `${anime.title} streaming in India`,
      `${anime.title} Crunchyroll India`,
      `${anime.title} Netflix India`,
      `${anime.title} JioHotstar`,
      'Indian anime dub directory',
    ],
    openGraph: {
      title,
      description,
      url: pageCanonical,
      siteName: 'AniDub India',
      locale: 'en_IN',
      type: (anime.type || '').toLowerCase().includes('movie') ? 'video.movie' : 'video.tv_show',
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${anime.title} Official Poster ${dubList} Dub`,
          type: 'image/png',
        },
        ...(posterUrl ? [{
          url: posterUrl,
          width: 600,
          height: 800,
          alt: `${anime.title} Official Poster ${dubList} Dub`,
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
      canonical: pageCanonical,
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
  const seriesJsonLd: Record<string, any> = {
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
    seriesJsonLd.datePublished = `${anime.releaseYear}-01-01`;
  }
  if (!isMovie) {
    seriesJsonLd.numberOfEpisodes = Number(anime.episodes || 12);
    seriesJsonLd.numberOfSeasons = 1;
  }

  // Schema.org FAQPage JSON-LD for rich snippets and long-tail Indian queries
  const faqJsonLd = buildFaqSchemaOrg(anime);
  const faqs = generateAnimeFaqs(anime);

  return (
    <>
      {/* Schema.org TVSeries / Movie JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesJsonLd) }}
      />
      {/* Schema.org FAQPage JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Crawlable Semantic SEO Content for Search Engine Bots */}
      <div className="min-h-screen bg-[#0b0f17] text-neutral-200">
        <header className="max-w-4xl mx-auto px-4 pt-12 pb-6 border-b border-neutral-800">
          <nav className="text-xs text-purple-400 mb-4 flex items-center gap-2">
            <a href="/" className="hover:underline">Home</a>
            <span>/</span>
            <a href={`/?dub=${encodeURIComponent(dubList[0] || 'Tamil')}`} className="hover:underline">
              {dubList[0] || 'Tamil'} Dubbed Anime
            </a>
            <span>/</span>
            <span className="text-neutral-400">{anime.title}</span>
          </nav>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            {anime.title} Dubbed Streaming in India
          </h1>
          <p className="text-sm text-neutral-400">
            Official Indian Dub Availability: {dubList.join(', ')} • Streaming on {platforms.join(', ')}
          </p>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">
          {/* Synopsis & Key Metadata */}
          <section className="bg-[#131926] border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-3">About {anime.title}</h2>
            <p className="text-sm leading-relaxed text-neutral-300">
              {anime.synopsis || `Stream ${anime.title} legally dubbed in Indian regional languages.`}
            </p>
          </section>

          {/* Dynamic Keyword-Rich SEO Paragraphs */}
          <section className="bg-[#131926] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">
              Watch {anime.title} Online in India
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Looking to watch <strong>{anime.title}</strong> with official Indian regional dubs? You can stream <em>{anime.title}</em> legally in India on <strong>{platforms.join(', ')}</strong>. Available audio tracks include <strong>{dubList.join(', ')}</strong> dubs with full subtitle support.
            </p>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Produced by <strong>{anime.studio || 'Official Animation Studio'}</strong> and originally premiering in <strong>{anime.releaseYear || '2024'}</strong>, this {anime.type || 'TV Series'} currently features <strong>{anime.episodes || 12} episodes</strong>. Stream {anime.title} now in crisp 1080p Full HD on licensed Indian anime streaming services.
            </p>
          </section>

          {/* FAQ Accordion Section for SEO and Google Discover */}
          <section className="bg-[#131926] border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Frequently Asked Questions (FAQ)
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-neutral-800 pb-3 last:border-b-0">
                  <h3 className="text-sm font-semibold text-purple-300 mb-1">
                    {faq.question}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Browse More Categories / Internal Linking */}
          <section className="border-t border-neutral-800 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
              Explore More Dubbed Anime
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {dubList.map((lang) => (
                <a
                  key={lang}
                  href={`/?dub=${encodeURIComponent(lang)}`}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
                >
                  {lang} Dubbed Anime
                </a>
              ))}
              {platforms.map((platform) => (
                <a
                  key={platform}
                  href={`/?platform=${encodeURIComponent(platform)}`}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
                >
                  Anime on {platform}
                </a>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Interactive client single-page redirect */}
      <script dangerouslySetInnerHTML={{ __html: `window.location.replace('/#anime/${id}');` }} />
    </>
  );
}
