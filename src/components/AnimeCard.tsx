import React, { useState } from 'react';
import { Bookmark, Star, Play, Sparkles } from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';

interface AnimeCardProps {
  anime: Anime;
  isBookmarked: boolean;
  onToggleBookmark: (anime: Anime) => void;
  onSelect: (anime: Anime) => void;
}

const DUB_BADGE_STYLES: Record<DubLanguage, { bg: string; text: string; label: string }> = {
  Tamil: { bg: 'bg-[#b45309]', text: 'text-amber-100', label: 'Tam' },
  Telugu: { bg: 'bg-[#0284c7]', text: 'text-sky-100', label: 'Tel' },
  Hindi: { bg: 'bg-[#059669]', text: 'text-emerald-100', label: 'Hin' },
  Malayalam: { bg: 'bg-[#7c3aed]', text: 'text-purple-100', label: 'Mal' },
  Kannada: { bg: 'bg-[#e11d48]', text: 'text-rose-100', label: 'Kan' },
};

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  isBookmarked,
  onToggleBookmark,
  onSelect,
}) => {
  const [imageError, setImageError] = useState(false);
  const displayImage = anime.imageUrl || anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

  return (
    <div
      onClick={() => onSelect(anime)}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-[#131926] border border-neutral-800/80 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-900/20 transition-all duration-300 cursor-pointer select-none"
    >
      {/* Poster Aspect Ratio Container (~2:3 ratio) */}
      <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-neutral-900">
        {!imageError ? (
          <img
            src={displayImage}
            alt={anime.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1e2d] to-[#0f131d] flex flex-col items-center justify-center p-4 text-center">
            <Sparkles className="w-8 h-8 text-purple-400 mb-2 opacity-50" />
            <span className="text-xs font-semibold text-neutral-300">{anime.title}</span>
          </div>
        )}

        {/* Gradient shadow overlay for badge readability & bottom text */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d121c] via-transparent to-black/50 pointer-events-none" />

        {/* Top-Left Dub Badges (Exact match to AniDub India video) */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1 max-w-[80%] z-10">
          {anime.dubs.map((dub) => {
            const badge = DUB_BADGE_STYLES[dub];
            if (!badge) return null;
            return (
              <span
                key={dub}
                className={`${badge.bg} ${badge.text} text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-md backdrop-blur-sm tracking-tight`}
              >
                {badge.label}
              </span>
            );
          })}
        </div>

        {/* Top-Right Bookmark Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(anime);
          }}
          title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
          className={`absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full backdrop-blur-md transition-all duration-200 ${
            isBookmarked
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
              : 'bg-black/50 text-neutral-300 hover:text-white hover:bg-neutral-800/80'
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>

        {/* Bottom Poster Quick Overlay: Rating & Type */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-semibold text-white/90">
          <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>{anime.rating.toFixed(1)}</span>
          </div>

          {anime.status === 'Airing' && (
            <span className="flex items-center gap-1 bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 px-1.5 py-0.5 rounded text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Airing
            </span>
          )}
        </div>
      </div>

      {/* Card Info Section */}
      <div className="p-3 flex flex-col justify-between flex-grow">
        <div>
          {/* Title */}
          <h3 
            className="font-bold text-sm text-neutral-100 line-clamp-1 group-hover:text-purple-300 transition-colors"
            title={anime.title}
          >
            {anime.title}
          </h3>

          {/* Format & Year */}
          <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1">
            <span>{anime.type}</span>
            <span>•</span>
            <span>{anime.releaseYear}</span>
            {anime.episodes && (
              <>
                <span>•</span>
                <span>{anime.episodes} Ep</span>
              </>
            )}
          </div>
        </div>

        {/* Streaming platforms available */}
        <div className="mt-2.5 pt-2 border-t border-neutral-800/70 flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-hidden">
            {anime.platforms.slice(0, 2).map((p) => (
              <span
                key={p.name}
                className="text-[9px] font-semibold bg-[#1a2133] text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700/60 truncate"
              >
                {p.name.replace('YouTube (', '').replace(')', '')}
              </span>
            ))}
            {anime.platforms.length > 2 && (
              <span className="text-[9px] text-neutral-500 font-medium">
                +{anime.platforms.length - 2}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 text-purple-400 group-hover:translate-x-0.5 transition-transform text-[11px] font-medium">
            <Play className="w-3 h-3 fill-current" />
          </div>
        </div>
      </div>
    </div>
  );
};
