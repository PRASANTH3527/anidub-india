import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { 
  Clock, 
  Trash2, 
  Star, 
  Play, 
  Bookmark, 
  X
} from 'lucide-react';

export interface RecentlyViewedAnime {
  id: number;
  title: string;
  cover_image?: string;
  banner_image?: string;
  rating?: number;
  type?: string;
  episodes_count?: number;
  languages?: string;
  genres?: string;
  platform?: string;
  [key: string]: any;
}

export interface RecentlyViewedRowProps {
  items: RecentlyViewedAnime[];
  onSelectAnime: (anime: RecentlyViewedAnime) => void;
  onClear: () => void;
  onRemoveItem?: (id: number) => void;
  watchlist?: number[];
  onToggleWatchlist?: (id: number) => void;
}

const parseLanguageBadges = (raw?: string): string[] => {
  if (!raw) return ['Hin', 'Tam'];
  return raw
    .split(/[,/| ]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(code => {
      const u = code.toUpperCase();
      return !['JAP', 'JPN', 'JAPANESE', 'ENG', 'ENGLISH', 'ROMAJI', 'KOR', 'KOREAN', 'CHI', 'CHINESE'].includes(u);
    })
    .map(code => {
      const u = code.toUpperCase();
      if (u === 'HIN' || u === 'HI') return 'Hin';
      if (u === 'TAM' || u === 'TA') return 'Tam';
      if (u === 'TEL' || u === 'TE') return 'Tel';
      if (u === 'MAL' || u === 'MA') return 'Mal';
      if (u === 'KAN' || u === 'KA') return 'Kan';
      if (u === 'BEN' || u === 'BN') return 'Ben';
      if (u === 'MAR' || u === 'MR') return 'Mar';
      if (u === 'GUJ' || u === 'GU') return 'Guj';
      if (u === 'PUN' || u === 'PA') return 'Pun';
      return code.slice(0, 3);
    })
    .filter(name => {
      const u = name.toUpperCase();
      return !['JAP', 'JPN', 'ENG'].includes(u);
    })
    .slice(0, 3);
};

export const RecentlyViewedRow: React.FC<RecentlyViewedRowProps> = ({
  items,
  onSelectAnime,
  onClear,
  onRemoveItem,
  watchlist = [],
  onToggleWatchlist
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 mb-8 overflow-hidden box-border font-sans">
      
      {/* HEADER ROW */}
      <div className="flex items-center justify-between mb-3.5 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-950/70 border border-purple-600/40 text-purple-400 flex items-center justify-center shadow-sm shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          
          <h2 className="font-heading font-black text-white text-base sm:text-lg tracking-tight truncate">
            Recently Viewed
          </h2>

          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#182033] border border-neutral-700/80 text-purple-300 shrink-0">
            {items.length}
          </span>
        </div>

        {/* ACTIONS: CLEAR ALL BUTTON */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#141b2c] hover:bg-rose-950/40 border border-neutral-800 hover:border-rose-900/50 text-neutral-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Clear all recently viewed history"
          >
            <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400" />
            <span className="hidden xs:inline">Clear All</span>
          </button>
        </div>
      </div>

      {/* HORIZONTAL SCROLL ROW */}
      <div 
        ref={scrollRef}
        className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1.5 px-0.5 select-none w-full max-w-full"
      >
        {items.map((anime, idx) => {
          const isSaved = watchlist.includes(anime.id);
          const langBadges = parseLanguageBadges(anime.languages);

          return (
            <motion.div
              key={anime.id}
              onClick={() => onSelectAnime(anime)}
              initial={shouldReduceMotion ? false : { opacity: 0, x: 20 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
              whileHover={shouldReduceMotion ? undefined : { y: -4, transition: { duration: 0.2 } }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
              className="group relative flex-none w-36 sm:w-44 flex flex-col rounded-2xl bg-[#121829] border border-neutral-800/90 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-950/30 transition-colors cursor-pointer overflow-hidden will-change-transform"
            >
              {/* POSTER WRAPPER */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-900">
                <img
                  src={anime.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                  alt={anime.title}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#121829] via-transparent to-black/40" />

                {/* TOP LEFT: RATING PILL */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/75 backdrop-blur-md text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-amber-500/30 shadow-md">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  <span>{anime.rating ? anime.rating.toFixed(1) : '8.8'}</span>
                </div>

                {/* TOP RIGHT: ACTIONS (BOOKMARK & INDIVIDUAL CIRCULAR CLOSE BUTTON) */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                  {onToggleWatchlist && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(anime.id);
                      }}
                      className={`w-6 h-6 rounded-full backdrop-blur-md flex items-center justify-center transition-all ${
                        isSaved
                          ? 'bg-primary-theme text-white shadow-md'
                          : 'bg-black/75 text-neutral-300 hover:text-white hover:bg-black/90 border border-neutral-700/80'
                      }`}
                      title={isSaved ? 'In Watchlist' : 'Add to Watchlist'}
                    >
                      <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  {/* Circular close button for individual delete */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem?.(anime.id);
                    }}
                    className="w-6 h-6 rounded-full bg-black/75 hover:bg-rose-950/90 border border-neutral-700/80 hover:border-rose-500/60 text-neutral-300 hover:text-rose-300 backdrop-blur-md flex items-center justify-center transition-all shadow-md active:scale-90 cursor-pointer"
                    title="Remove from recently viewed"
                    aria-label="Remove from recently viewed"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>

                {/* QUICK PLAY HOVER OVERLAY */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="w-11 h-11 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg shadow-purple-600/50 transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                {/* BOTTOM DUB BADGES */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 overflow-hidden">
                  {langBadges.map((lang, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase bg-black/80 backdrop-blur-md text-amber-300 border border-neutral-700/80"
                    >
                      {lang}
                    </span>
                  ))}
                  {anime.platform && (
                    <span className="ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold text-neutral-300 bg-neutral-900/90 border border-neutral-700/60 truncate max-w-[60px]">
                      {anime.platform}
                    </span>
                  )}
                </div>
              </div>

              {/* FOOTER METADATA */}
              <div className="p-2.5 flex flex-col justify-between flex-grow">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-neutral-100 group-hover:text-purple-300 truncate transition-colors">
                    {anime.title}
                  </h4>
                  <div className="text-[10px] sm:text-xs text-neutral-400 flex items-center justify-between mt-1">
                    <span className="truncate">{anime.type || 'TV Series'}</span>
                    <span>{anime.episodes_count ? `${anime.episodes_count} Ep` : 'HD Dub'}</span>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-purple-400 font-semibold group-hover:text-purple-300">
                  <span>View Details</span>
                  <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
};
