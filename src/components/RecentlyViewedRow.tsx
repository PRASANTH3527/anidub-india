'use client';

import React, { useRef } from 'react';
import { 
  Clock, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Bookmark, 
  Play,
  Film
} from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';
import { AnimeRecord } from '../types/database';
import { SupportedLanguage, translate } from '../utils/i18n';

interface RecentlyViewedRowProps {
  recentlyViewedIds: string[];
  allAnime: AnimeRecord[];
  onSelectAnime: (anime: Anime) => void;
  onToggleWatchlist: (anime: Anime) => void;
  watchlistIds: string[];
  onClearHistory: () => void;
  uiLanguage?: SupportedLanguage;
}

const DUB_BADGE_STYLES: Record<DubLanguage, { bg: string; text: string; label: string }> = {
  Tamil: { bg: 'bg-[#b45309]', text: 'text-amber-100', label: 'Tam' },
  Telugu: { bg: 'bg-[#0284c7]', text: 'text-sky-100', label: 'Tel' },
  Hindi: { bg: 'bg-[#059669]', text: 'text-emerald-100', label: 'Hin' },
  Malayalam: { bg: 'bg-[#7c3aed]', text: 'text-purple-100', label: 'Mal' },
  Kannada: { bg: 'bg-[#e11d48]', text: 'text-rose-100', label: 'Kan' },
};

export const RecentlyViewedRow: React.FC<RecentlyViewedRowProps> = ({
  recentlyViewedIds,
  allAnime,
  onSelectAnime,
  onToggleWatchlist,
  watchlistIds,
  onClearHistory,
  uiLanguage = 'en',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lang = uiLanguage || 'en';

  // Map IDs in order of recent viewing
  const recentAnimeList: Anime[] = recentlyViewedIds
    .map((id) => allAnime.find((a) => a.id === id))
    .filter((a): a is AnimeRecord => !!a);

  if (recentAnimeList.length === 0) {
    return null;
  }

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 mb-8">
      {/* Header with Title, Count, Clear Button and Scroll Arrows */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-950/70 border border-purple-600/40 flex items-center justify-center text-purple-400 shadow-sm">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-black text-white text-base sm:text-lg tracking-tight">
                {translate('recentlyViewedTitle', lang)}
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-[#182033] border border-neutral-700/80 text-purple-300">
                {recentAnimeList.length}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 hidden sm:block">
              Jump back into the titles you explored recently
            </p>
          </div>
        </div>

        {/* Action Controls: Clear History & Scroll Arrows */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#141b2c] hover:bg-[#1f2940] active:scale-95 text-neutral-400 hover:text-rose-400 text-xs font-semibold transition-all border border-neutral-800 cursor-pointer"
            title="Clear recently viewed history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{translate('clearHistory', lang)}</span>
          </button>

          {recentAnimeList.length > 3 && (
            <div className="flex items-center gap-1">
              <button
                onClick={scrollLeft}
                aria-label="Scroll recently viewed left"
                className="p-1.5 rounded-xl bg-[#141b2c] hover:bg-[#1f2940] active:scale-90 text-neutral-300 hover:text-white transition-all border border-neutral-800 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={scrollRight}
                aria-label="Scroll recently viewed right"
                className="p-1.5 rounded-xl bg-[#141b2c] hover:bg-[#1f2940] active:scale-90 text-neutral-300 hover:text-white transition-all border border-neutral-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Row (Scrollbar hidden via no-scrollbar) */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-1 px-1 select-none"
      >
        {recentAnimeList.map((anime) => {
          const isSaved = watchlistIds.includes(anime.id);
          const poster =
            anime.imageUrl ||
            anime.poster ||
            'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&fit=crop&q=80';

          return (
            <div
              key={`recent-${anime.id}`}
              onClick={() => onSelectAnime(anime)}
              className="group relative flex-none w-36 sm:w-44 flex flex-col rounded-2xl bg-[#121829] border border-neutral-800/90 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-950/30 transition-all duration-300 overflow-hidden cursor-pointer active:scale-[0.98]"
            >
              {/* Poster Image Container */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-900">
                <img
                  src={poster}
                  alt={anime.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#121829] via-[#121829]/20 to-transparent" />

                {/* Rating Pill */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/75 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300 shadow">
                  <Star className="w-3 h-3 fill-current text-amber-400" />
                  <span>{anime.rating?.toFixed(1) || '8.5'}</span>
                </div>

                {/* Bookmark Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatchlist(anime);
                  }}
                  className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                    isSaved
                      ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                      : 'bg-black/60 border-white/15 text-neutral-300 hover:text-white hover:bg-black/80'
                  }`}
                  title={isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                </button>

                {/* Quick Play Hover Indicator */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg shadow-purple-600/40 backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Dub Badges (Clamped) */}
                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                  {(anime.dubs || []).slice(0, 3).map((dub) => {
                    const badge = DUB_BADGE_STYLES[dub];
                    return (
                      <span
                        key={dub}
                        className={`${badge?.bg || 'bg-neutral-800'} ${badge?.text || 'text-white'} text-[9px] font-extrabold px-1.5 py-0.2 rounded shadow-sm`}
                      >
                        {badge?.label || dub}
                      </span>
                    );
                  })}
                  {(anime.dubs || []).length > 3 && (
                    <span className="bg-neutral-800 text-neutral-300 text-[9px] font-bold px-1 py-0.2 rounded">
                      +{(anime.dubs || []).length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-2.5 flex flex-col justify-between flex-grow">
                <h4 className="font-heading font-black text-xs sm:text-sm text-white group-hover:text-purple-300 transition-colors truncate">
                  {anime.title}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1">
                  <span>{anime.type || 'TV Series'}</span>
                  <span>{anime.releaseYear || '2024'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
