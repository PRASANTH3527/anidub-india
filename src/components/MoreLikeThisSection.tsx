// ==============================================================================
// AniDub India — 'More Like This' Smart Recommendation Component
// Ranks 5-10 related animes based on animationStudio (highest weight) & shared dub languages
// Zero reliance on 'genres'
// ==============================================================================

'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  Building2, 
  Star, 
  ExternalLink, 
  Volume2, 
  Compass, 
  Tv, 
  Flame,
  ArrowRight,
  CheckCircle2,
  Bookmark
} from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';
import { getMoreLikeThisRecommendations, RelatedAnimeMatch } from '../utils/recommendations';

export interface MoreLikeThisSectionProps {
  currentAnime: Anime;
  allAnime: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onToggleWatchlist?: (anime: Anime) => void;
  watchlistIds?: string[];
  limit?: number; // 5 to 10
}

export const MoreLikeThisSection: React.FC<MoreLikeThisSectionProps> = ({
  currentAnime,
  allAnime,
  onSelectAnime,
  onToggleWatchlist,
  watchlistIds = [],
  limit = 8,
}) => {
  // Rank and calculate top 5-10 related anime without relying on genres
  const recommendations: RelatedAnimeMatch[] = useMemo(() => {
    return getMoreLikeThisRecommendations(currentAnime, allAnime, {
      limit: Math.max(5, Math.min(10, limit)),
      minScore: 12,
    });
  }, [currentAnime, allAnime, limit]);

  if (recommendations.length === 0) {
    return null;
  }

  const studioName = (currentAnime as any).animationStudio || currentAnime.studio || 'Studio';

  return (
    <section className="pt-8 border-t border-neutral-800 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-theme/10 border border-primary-theme/25 text-primary-theme text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Studio & Dub Lineage Engine</span>
          </div>
          <h3 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight flex items-center gap-2">
            <span>More Like This</span>
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400">
            Ranked by <strong className="text-neutral-200">{studioName}</strong> production pedigree and matching{' '}
            <strong className="text-neutral-200">{(currentAnime.dubs || []).join(' / ')}</strong> audio availability.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#131929] text-neutral-300 border border-neutral-800 shadow-inner">
            <strong className="text-white font-black">{recommendations.length}</strong> Recommended Titles
          </span>
        </div>
      </div>

      {/* Grid of 5-10 Ranked Related Anime Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {recommendations.map((match, idx) => {
          const { anime, matchPercentage, matchReasons, isSameStudio, sharedDubs } = match;
          const isSaved = watchlistIds.includes(anime.id);
          const poster = anime.poster || anime.imageUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';

          return (
            <motion.div
              key={anime.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              className={`group relative flex flex-col justify-between bg-[#131926] border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer ${
                isSameStudio
                  ? 'border-purple-500/40 hover:border-purple-400 hover:shadow-purple-500/20'
                  : 'border-neutral-800 hover:border-primary-theme/50 hover:shadow-primary-theme/15'
              }`}
              onClick={() => onSelectAnime(anime)}
            >
              {/* Top Media Row */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-900">
                <img
                  src={poster}
                  alt={anime.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#131926] via-transparent to-black/40" />

                {/* Match Percentage Badge */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-black text-emerald-300 shadow-md">
                  <Flame className="w-3 h-3 text-emerald-400 fill-current" />
                  <span>{matchPercentage}% Match</span>
                </div>

                {/* Bookmark Toggle (if handler provided) */}
                {onToggleWatchlist && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist(anime);
                    }}
                    className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg backdrop-blur-md border transition-all cursor-pointer ${
                      isSaved
                        ? 'bg-primary-theme text-white border-primary-light shadow-lg'
                        : 'bg-black/60 text-neutral-300 border-white/10 hover:text-white hover:bg-black/80'
                    }`}
                    title={isSaved ? 'In Watchlist' : 'Add to Watchlist'}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                )}

                {/* Studio Pill */}
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md ${
                      isSameStudio
                        ? 'bg-purple-600/90 text-white border border-purple-400/50'
                        : 'bg-black/75 text-neutral-300 border border-white/10'
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    <span className="truncate max-w-[140px]">{match.studioName}</span>
                  </span>

                  <span className="text-[10px] font-extrabold text-orange-400 bg-black/75 px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    <span>{anime.rating ? anime.rating.toFixed(1) : '8.2'}</span>
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex flex-col justify-between flex-grow space-y-3">
                <div className="space-y-1.5">
                  <h4 className="font-heading font-black text-sm text-white group-hover:text-primary-theme transition-colors line-clamp-1">
                    {anime.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-semibold">
                    <span>{anime.type || 'TV Series'}</span>
                    <span>•</span>
                    <span>{anime.releaseYear}</span>
                    {anime.episodes && (
                      <>
                        <span>•</span>
                        <span>{anime.episodes} EP</span>
                      </>
                    )}
                  </div>

                  {/* Shared Regional Dub Languages */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(anime.dubs || []).slice(0, 3).map((dub) => {
                      const isShared = (currentAnime.dubs || []).includes(dub);
                      return (
                        <span
                          key={dub}
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded transition-colors ${
                            isShared
                              ? 'bg-primary-theme/25 text-primary-light border border-primary-theme/40'
                              : 'bg-neutral-800/80 text-neutral-400 border border-neutral-700/60'
                          }`}
                        >
                          {dub} {isShared && '✓'}
                        </span>
                      );
                    })}
                    {(anime.dubs || []).length > 3 && (
                      <span className="text-[9px] text-neutral-500 font-bold px-1 py-0.5">
                        +{anime.dubs.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Match Reasons Footer */}
                <div className="pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1 text-emerald-400 font-bold truncate max-w-[70%]">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{matchReasons[0] || 'High Audio Parity'}</span>
                  </div>

                  <span className="text-accent-theme font-black flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">
                    <span>Details</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default MoreLikeThisSection;
