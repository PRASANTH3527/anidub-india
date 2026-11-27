import React, { useRef } from 'react';
import Image from './OptimizedImage';
import { motion, useReducedMotion } from 'motion/react';
import {
  Clock,
  Trash2,
  Star,
  Play,
  Bookmark,
  X,
} from 'lucide-react';
import { parsePlatformList } from '../utils/dataNormalization';

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
  if (!raw) return [];
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

const RecentlyViewedRowComponent: React.FC<RecentlyViewedRowProps> = ({
  items,
  onSelectAnime,
  onClear,
  onRemoveItem,
  watchlist = [],
  onToggleWatchlist,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 mb-8 overflow-hidden box-border font-sans">
      {/* HEADER ROW */}
      <div className="flex items-center justify-between mb-3.5 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>

          <h2 className="font-heading font-black text-[var(--text-primary)] text-base sm:text-lg tracking-tight truncate">
            Recently Viewed
          </h2>

          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent-primary)] shrink-0">
            {items.length}
          </span>
        </div>

        {/* ACTIONS: CLEAR ALL BUTTON */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[#F87171]/40 text-[var(--text-secondary)] hover:text-[#F87171] transition-colors duration-150 cursor-pointer"
            title="Clear all recently viewed history"
            aria-label="Clear all recently viewed history"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#F87171]" />
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
          const isSaved = watchlist.map(Number).includes(Number(anime.id));
          const langBadges = parseLanguageBadges(anime.languages);

          return (
            <motion.div
              key={`recently_viewed_${anime.id}_${idx}`}
              onClick={() => onSelectAnime(anime)}
              initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.16, delay: Math.min(idx * 0.04, 0.2) }}
              className="group relative flex-none w-36 sm:w-44 flex flex-col rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/60 transition-colors duration-150 cursor-pointer overflow-hidden"
            >
              {/* POSTER WRAPPER */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--bg-elevated)]">
                <Image
                  src={anime.cover_image || '/logo.png'}
                  alt={anime.title}
                  loading="lazy"
                  sizes="(max-width: 640px) 144px, 176px"
                  width={176}
                  height={235}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-canvas)]/90 via-transparent to-[var(--bg-canvas)]/30" />

                {/* TOP LEFT: RATING PILL */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-[var(--bg-canvas)]/85 text-[#F9C876] px-2 py-0.5 rounded-lg text-[10px] font-bold border border-[var(--border-subtle)]">
                  <Star className="w-2.5 h-2.5 fill-[#F9C876] text-[#F9C876]" />
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
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 border ${
                        isSaved
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-canvas)]/85 text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                      }`}
                      title={isSaved ? 'In Watchlist' : 'Add to Watchlist'}
                      aria-label={isSaved ? `Remove ${anime.title} from Watchlist` : `Add ${anime.title} to Watchlist`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem?.(anime.id);
                    }}
                    className="w-7 h-7 rounded-lg bg-[var(--bg-canvas)]/85 hover:bg-[#F87171]/20 border border-[var(--border-subtle)] hover:border-[#F87171]/50 text-[var(--text-secondary)] hover:text-[#F87171] flex items-center justify-center transition-colors duration-150 cursor-pointer"
                    title="Remove from recently viewed"
                    aria-label="Remove from recently viewed"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>

                {/* QUICK PLAY HOVER OVERLAY */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)] text-[var(--accent-on-primary)] flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                {/* BOTTOM DUB BADGES */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 overflow-hidden">
                  {langBadges.map((lang, idx) => (
                    <span
                      key={`rv_lang_${anime.id}_${lang}_${idx}`}
                      className="px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase bg-[var(--bg-canvas)]/90 text-[#F9C876] border border-[var(--border-subtle)]"
                    >
                      {lang}
                    </span>
                  ))}
                  {anime.platform && (
                    <span className="ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold text-[var(--text-secondary)] bg-[var(--bg-elevated)]/90 border border-[var(--border-subtle)] truncate max-w-[72px]">
                      {parsePlatformList(anime.platform)[0] || anime.platform}
                    </span>
                  )}
                </div>
              </div>

              {/* FOOTER METADATA */}
              <div className="p-2.5 flex flex-col justify-between flex-grow">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] truncate transition-colors duration-150">
                    {anime.title}
                  </h4>
                  <div className="text-[10px] sm:text-xs text-[var(--text-secondary)] flex items-center justify-between mt-1">
                    <span className="truncate">{anime.type || 'TV Series'}</span>
                    <span>{anime.episodes_count ? `${anime.episodes_count} Ep` : 'HD Dub'}</span>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--accent-primary)] font-semibold">
                  <span>View Details</span>
                  <span>→</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export const RecentlyViewedRow = React.memo(RecentlyViewedRowComponent);
export default RecentlyViewedRow;
