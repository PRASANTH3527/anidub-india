import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Star, Flame, ExternalLink } from 'lucide-react';
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
}) => {
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
          sharedGenresCount: sharedGenres.length,
        };
      })
      .sort((a, b) => b.matchPercent - a.matchPercent)
      .slice(0, 4);
  };

  const recommendations = getMoreLikeThisRecommendations();

  if (recommendations.length === 0) return null;

  return (
    <section className="pt-8 border-t border-[#292B39] space-y-5 font-sans">
      {/* HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#191C29] border border-[#292B39] text-[#B49AF8] text-[11px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#B49AF8]" />
            <span>Curated Recommendations</span>
          </div>

          <h3 className="font-extrabold text-xl sm:text-2xl text-[#F4F3FA] tracking-tight">
            More Like This
          </h3>

          <p className="text-xs sm:text-sm text-[#A1A5B5] mt-1">
            Similar storyline themes, verified regional dubs &amp; animation studios.
          </p>
        </div>

        <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#12141E] text-[#A1A5B5] border border-[#292B39] shrink-0 self-start sm:self-auto">
          {recommendations.length} Matches Found
        </div>
      </div>

      {/* CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {recommendations.map((anime, idx) => (
          <motion.div
            key={`more_like_${anime.id}_${idx}`}
            onClick={() => onSelectAnime(anime)}
            transition={{ duration: 0.16 }}
            className={`group relative flex flex-col justify-between bg-[#12141E] border rounded-2xl overflow-hidden transition-colors duration-150 cursor-pointer ${
              anime.isSamePlatform ? 'border-[#B49AF8]/50 hover:border-[#B49AF8]' : 'border-[#292B39] hover:border-[#B49AF8]/50'
            }`}
          >
            {/* TOP MEDIA ROW */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#191C29]">
              <img
                src={anime.banner_image || anime.cover_image || '/logo.png'}
                alt={anime.title}
                width={400}
                height={250}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.src = '/logo.png';
                }}
                className="w-full h-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#12141E] via-transparent to-black/30" />

              {/* MATCH % BADGE */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0B0A10]/90 border border-[#292B39] text-[10px] font-bold text-[#34D399]">
                <Flame className="w-3 h-3 text-[#F9C876] fill-[#F9C876]" />
                <span>{anime.matchPercent}% Match</span>
              </div>

              {/* BOTTOM POSTER METADATA */}
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-bold text-[#F4F3FA]">
                <span className="bg-[#0B0A10]/90 px-2 py-0.5 rounded border border-[#292B39] truncate max-w-[110px]">
                  {anime.platform || 'Not verified'}
                </span>

                <div className="flex items-center gap-1 text-[#F9C876]">
                  <Star className="w-3 h-3 fill-[#F9C876] text-[#F9C876]" />
                  <span>{anime.rating ? anime.rating.toFixed(1) : '8.8'}</span>
                </div>
              </div>
            </div>

            {/* CARD BODY */}
            <div className="p-3.5 flex flex-col justify-between flex-grow space-y-2.5">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[#F4F3FA] group-hover:text-[#B49AF8] transition-colors duration-150 line-clamp-1">
                  {anime.title}
                </h4>
                <p className="text-[11px] text-[#A1A5B5] line-clamp-2 leading-relaxed">
                  {anime.synopsis || 'Explore official Indian dubbed episodes and verified OTT streaming links.'}
                </p>
              </div>

              {/* SHARED DUB BADGES */}
              <div className="pt-2 border-t border-[#292B39] flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1">
                  {(anime.languages ? anime.languages.split(/[,/ ]+/) : ['HIN', 'TAM']).slice(0, 3).map((l, i) => (
                    <span
                      key={`more_like_${anime.id}_lang_${i}`}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#191C29] text-[#CBB6FF] border border-[#292B39]"
                    >
                      {l.trim()}
                    </span>
                  ))}
                </div>

                <span className="text-[10px] font-bold text-[#A1A5B5] group-hover:text-[#F4F3FA] flex items-center gap-1 transition-colors duration-150">
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
