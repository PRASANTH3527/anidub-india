import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ANIME_DATABASE } from '../../../data/animeData';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Next.js Dynamic generateMetadata leveraging the /api/og dynamic image endpoint
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const anime = ANIME_DATABASE.find((a) => a.id === id);

  if (!anime) {
    return {
      title: 'Anime Not Found — AniDub India',
      description: 'Browse regional dubbed anime in Tamil, Telugu, and Hindi on AniDub India.',
    };
  }

  const dubList = (anime.dubs || []).join(', ');
  const title = `${anime.title} (${dubList} Dub) — Where to Watch & Episodes | AniDub India`;
  const description = `Available in ${dubList}. Watch ${anime.title} legally on Crunchyroll, Netflix, and JioCinema. High-quality regional Indian audio directory.`;

  // Dynamically generate OG Image URL
  const ogUrl = new URL('/api/og', 'https://anidub.in');
  ogUrl.searchParams.set('title', anime.title);
  ogUrl.searchParams.set('poster', anime.imageUrl || anime.poster);
  ogUrl.searchParams.set('dubs', (anime.dubs || []).join(','));
  ogUrl.searchParams.set('studio', (anime as any).animationStudio || anime.studio || '');
  ogUrl.searchParams.set('rating', String(anime.rating || '8.5'));
  ogUrl.searchParams.set('type', anime.type || 'TV Series');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'video.other',
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${anime.title} Official Regional Dubs`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl.toString()],
    },
  };
}

export default async function AnimeDynamicRoute({ params }: PageProps) {
  const { id } = await params;
  const anime = ANIME_DATABASE.find((a) => a.id === id);

  if (!anime) {
    redirect('/');
  }

  // Schema.org Structured Data for SEO Rich Snippets
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': anime.type === 'Movie' ? 'Movie' : 'TVSeries',
    name: anime.title,
    alternativeName: [anime.romajiTitle, anime.nativeTitle].filter(Boolean),
    description: anime.synopsis,
    image: anime.imageUrl || anime.poster,
    datePublished: anime.releaseYear ? `${anime.releaseYear}-01-01` : undefined,
    genre: anime.genres,
    productionCompany: {
      '@type': 'Organization',
      name: anime.studio || (anime as any).animationStudio,
    },
    aggregateRating: anime.rating ? {
      '@type': 'AggregateRating',
      ratingValue: anime.rating,
      bestRating: '10',
      worstRating: '1',
      ratingCount: (anime as any).upvotes || (anime as any).likes || 100,
    } : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Client-side navigation to the hash route handled by the root App component */}
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="animate-pulse text-neutral-500 font-bold">Redirecting to {anime.title}...</div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `window.location.href = '/#anime/${id}';` }} />
    </>
  );
}
