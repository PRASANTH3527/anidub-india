import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { dbService } from '../../../services/databaseService';
import { AnimeRecord } from '../../../types/database';
import { AnimeCard } from '../../../components/AnimeCard';
import { Navbar } from '../../../components/Navbar';
import { ArrowLeft, Share2, Layers, Users, Calendar } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const collection = await dbService.getPublicCollection(id);

  if (!collection) {
    return {
      title: 'Collection Not Found — AniDub India',
    };
  }

  return {
    title: `${collection.title} — Anime Collection by ${collection.userName} | AniDub India`,
    description: collection.description || `Explore this curated anime collection on AniDub India.`,
    openGraph: {
      title: collection.title,
      description: collection.description,
      type: 'website',
    },
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { id } = await params;
  const collection = await dbService.getPublicCollection(id);

  if (!collection) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-4 text-center">
        <div className="space-y-4">
          <Layers className="w-16 h-16 text-neutral-800 mx-auto" />
          <h1 className="text-2xl font-black text-white">Collection Not Found</h1>
          <p className="text-neutral-500 max-w-xs mx-auto">The list you are looking for might have been deleted or is private.</p>
          <Link href="/" className="inline-block px-6 py-3 rounded-2xl bg-primary-theme text-white font-bold">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const allAnime = dbService.getApprovedAnime();
  const collectionAnime = collection.animeIds
    .map(aid => allAnime.find(a => a.id === aid))
    .filter(Boolean) as AnimeRecord[];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-neutral-100 pb-20 font-sans">
      {/* Header Area */}
      <header className="relative pt-12 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-theme/10 via-transparent to-[#0b0f17] -z-10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-theme/5 blur-[120px] rounded-full -z-20" />
        
        <div className="max-w-6xl mx-auto px-4 space-y-8">
          <Link href="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-bold">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Directory</span>
          </Link>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary-theme/30 shadow-lg">
                  <img src={collection.userAvatar} alt={collection.userName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
               </div>
               <div>
                  <p className="text-xs font-black text-primary-light uppercase tracking-widest">Curated Collection</p>
                  <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                    {collection.title}
                  </h1>
               </div>
            </div>

            <p className="text-neutral-400 max-w-2xl text-sm sm:text-base leading-relaxed">
              {collection.description || "No description provided for this collection."}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800">
                <Users className="w-3.5 h-3.5 text-primary-theme" />
                <span>By {collection.userName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800">
                <Calendar className="w-3.5 h-3.5 text-primary-theme" />
                <span>Updated {new Date(collection.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800">
                <Layers className="w-3.5 h-3.5 text-primary-theme" />
                <span>{collectionAnime.length} Titles</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Grid Area */}
      <main className="max-w-6xl mx-auto px-4 -mt-12">
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 sm:gap-6 space-y-4 sm:space-y-6">
          {collectionAnime.map((anime, idx) => (
            <div key={anime.id} className="break-inside-avoid">
              <AnimeCard
                anime={anime as any}
                isBookmarked={false}
                onToggleBookmark={() => {}}
                onSelect={() => {}}
              />
            </div>
          ))}
        </div>

        {collectionAnime.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <Layers className="w-12 h-12 text-neutral-800 mx-auto" />
            <p className="text-neutral-500 font-bold">This collection is currently empty.</p>
          </div>
        )}
      </main>
    </div>
  );
}
