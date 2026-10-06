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
  redirect(`/#anime/${id}`);
}
