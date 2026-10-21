import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Star, Flame, Tv, ExternalLink } from 'lucide-react';
import { Anime } from './CatalogView';

export interface MoreLikeThisSectionProps {
  currentAnime: Anime;
  catalogList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  watchlist?: number[];
  onToggleWatchlist?: (animeId: number) => void;
}

export const MoreLikeThisSection: React.FC<MoreLikeThisSectionProps> = ({
  currentAnime,
  catalogList,
  onSelectAnime,
  watchlist = []
}) => {
  // Recommendation match logic matching original codebase
  const getMoreLikeThisRecommendations = () => {
    if (!catalogList || catalogList.length === 0) return [];

    const currentGenres = (currentAnime.genres || '').toLowerCase().split(',').map(g => g.trim());
    const currentPlatform = (currentAnime.platform || '').toLowerCase();

    return catalogList
      .filter(a => a.id !== currentAnime.id)
      .map(anime => {
        let matchScore = 60;
        const animeGenres = (anime.genres || '').toLowerCase().split(',').map(g => g.trim());
        const sharedGenres = currentGenres.filter(g => animeGenres.includes(g));
        
        matchScore += sharedGenres.length * 12;

        const isSamePlatform = currentPlatform && (anime.platform || '').toLowerCase().includes(currentPlatform);
        if (isSamePlatform) matchScore += 15;

        matchScore += Math.round((anime.rating || 8) * 1.5);
        const matchPercent = Math.min(Math.max(matchScore, 75), 98);

        return {
          ...anime,
          matchPercent,
          isSamePlatform,
          sharedGenresCount: sharedGenres.length
        };
      })
      .sort((a, b) => b.matchPercent - a.matchPercent)
      .slice(0, 4);
  };

  const recommendations = getMoreLikeThisRecommendations();

  if (recommendations.length === 0) return null;

  return (
    <section className="pt-8 border-t border-neutral-800 space-y-6 font-sans">
      
      {/* HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-theme/10 border border-primary-theme/25 text-primary-theme text-[11px] font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-accent-theme animate-pulse" />
            <span>Curated Recommendations</span>
          </div>

          <h3 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight">
            More Like This
          </h3>

          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Similar storyline themes, verified regional dubs & animation studios.
          </p>
        </div>

        <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#131929] text-neutral-300 border border-neutral-800 shadow-inner shrink-0 self-start sm:self-auto">
          {recommendations.length} Matches Found
        </div>
      </div>

      {/* CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {recommendations.map((anime) => {
          const isSaved = watchlist.includes(anime.id);

          return (
            <motion.div
              key={anime.id}
              onClick={() => onSelectAnime(anime)}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`group relative flex flex-col justify-between bg-[#131926] border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl cursor-pointer ${
                anime.isSamePlatform ? 'border-primary-theme/60 shadow-lg shadow-purple-950/20' : 'border-neutral-800/90'
              }`}
            >
              {/* TOP MEDIA ROW */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-900">
                <img
                  src={anime.banner_image || anime.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                  alt={anime.title}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#131926] via-transparent to-black/30" />

                {/* MATCH % BADGE */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-black text-emerald-300 shadow-md">
                  <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />
                  <span>{anime.matchPercent}% Match</span>
                </div>

                {/* BOTTOM POSTER METADATA */}
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-bold text-neutral-300">
                  <span className="bg-neutral-900/90 px-2 py-0.5 rounded border border-neutral-700/60 truncate max-w-[110px]">
                    {anime.platform || 'Crunchyroll'}
                  </span>

                  <div className="flex items-center gap-1 text-amber-300">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{anime.rating ? anime.rating.toFixed(1) : '8.8'}</span>
                  </div>
                </div>
              </div>

              {/* CARD BODY */}
              <div className="p-4 flex flex-col justify-between flex-grow space-y-3">
                <div className="space-y-1.5">
                  <h4 className="font-heading font-black text-sm text-white group-hover:text-primary-theme transition-colors line-clamp-1">
                    {anime.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                    {anime.synopsis || 'Explore official Indian dubbed episodes and verified OTT streaming links.'}
                  </p>
                </div>

                {/* SHARED DUB BADGES */}
                <div className="pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    {(anime.languages ? anime.languages.split(/[,/ ]+/) : ['HIN', 'TAM']).slice(0, 3).map((l, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded transition-colors bg-primary-theme/15 text-purple-300 border border-primary-theme/30"
                      >
                        {l.trim()}
                      </span>
                    ))}
                  </div>

                  <span className="text-[10px] font-bold text-neutral-400 group-hover:text-white flex items-center gap-1 transition-colors">
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
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
