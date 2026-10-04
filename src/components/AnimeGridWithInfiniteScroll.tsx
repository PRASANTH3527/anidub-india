import React, { useMemo, Suspense } from 'react';
import { AnimeCard } from './AnimeCard';
import { SkeletonCard, SkeletonGrid } from './SkeletonGrid';
import { Anime } from '../types/anime';
import { translate, SupportedLanguage } from '../utils/i18n';
import { RefreshCw, Sparkles } from 'lucide-react';

interface AnimeGridWithInfiniteScrollProps {
  animeList: Anime[];
  visibleCount: number;
  trendingAnimeIds: string[];
  localWatchlistIds: string[];
  onToggleWatchlist: (anime: Anime) => void;
  onOpenAnimeDetail: (anime: Anime) => void;
  onReport: (anime: Anime) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  uiLanguage: SupportedLanguage;
  isLoading?: boolean;
}

export const AnimeGridWithInfiniteScroll: React.FC<AnimeGridWithInfiniteScrollProps> = React.memo(({
  animeList,
  visibleCount,
  trendingAnimeIds,
  localWatchlistIds,
  onToggleWatchlist,
  onOpenAnimeDetail,
  onReport,
  sentinelRef,
  uiLanguage,
  isLoading = false,
}) => {
  const visibleAnime = useMemo(() => {
    return animeList.slice(0, visibleCount);
  }, [animeList, visibleCount]);

  if (isLoading) {
    return <SkeletonGrid count={8} />;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6 will-change-transform">
        {visibleAnime.map((anime) => (
          <AnimeCard
            key={anime.id}
            anime={anime}
            isBookmarked={localWatchlistIds.includes(anime.id)}
            isTrending={trendingAnimeIds.includes(anime.id)}
            onToggleBookmark={onToggleWatchlist}
            onSelect={onOpenAnimeDetail}
            onReport={onReport}
          />
        ))}
      </div>

      {/* Infinite Scroll Sentinel & Seamless Loader */}
      <div ref={sentinelRef} className="pt-8 pb-12 flex flex-col items-center justify-center min-h-[160px]">
        {visibleCount < animeList.length ? (
          <div className="flex flex-col items-center gap-6 w-full max-w-6xl">
            {/* Next batch skeleton preview (Netflix-style) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6 w-full opacity-30 grayscale pointer-events-none">
              <SkeletonCard />
              <SkeletonCard className="hidden sm:block" />
              <SkeletonCard className="hidden md:block" />
              <SkeletonCard className="hidden lg:block" />
            </div>
            
            <div className="flex items-center gap-3 px-6 py-3.5 rounded-full bg-[#131929]/95 border border-purple-500/30 text-xs font-black text-neutral-200 shadow-2xl backdrop-blur-md animate-bounce">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span>{translate('loadingBatch', uiLanguage)}</span>
            </div>
          </div>
        ) : animeList.length > 0 ? (
          <div className="text-center pt-8 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 text-[11px] font-black text-neutral-300 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>{translate('allLoaded', uiLanguage)}</span>
            </div>
          </div>
        ) : null}
        
        {animeList.length > 0 && (
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-6 opacity-60">
            {translate('showingTitles', uiLanguage)} <strong className="text-neutral-300">{visibleAnime.length}</strong> {translate('ofTitles', uiLanguage)} <strong className="text-neutral-300">{animeList.length}</strong> {translate('approvedDubs', uiLanguage)}
          </p>
        )}
      </div>
    </div>
  );
});
