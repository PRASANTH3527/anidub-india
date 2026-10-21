import React, { useState } from 'react';
import { 
  Flame, 
  CheckCircle2, 
  DownloadCloud, 
  Flag, 
  Share2, 
  Heart, 
  Bookmark, 
  Star 
} from 'lucide-react';

export interface AnimeCardData {
  id: number;
  title: string;
  slug?: string;
  synopsis?: string;
  cover_image: string;
  banner_image?: string;
  rating: number;
  episodes_count?: number;
  status?: string;
  season?: string;
  year?: number;
  releaseYear?: number;
  genres?: string;
  popularity?: number;
  languages?: string | string[];
  platform?: string | string[];
  type?: string;
  likesCount?: number;
}

interface AnimeCardProps {
  anime: AnimeCardData;
  onSelect: (anime: AnimeCardData) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: number) => void;
  isLiked?: boolean;
  onToggleLike?: (id: number) => void;
  isUpvoted?: boolean;
  onToggleUpvote?: (id: number) => void;
  isTrending?: boolean;
  isCached?: boolean;
}

export const ParallaxCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`h-full ${className}`}>
      {children}
    </div>
  );
};

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  onSelect,
  isBookmarked = false,
  onToggleBookmark,
  isLiked = false,
  onToggleLike,
  isUpvoted = false,
  onToggleUpvote,
  isTrending = true,
  isCached = true
}) => {
  const [internalLiked, setInternalLiked] = useState(isLiked);
  const [internalUpvoted, setInternalUpvoted] = useState(isUpvoted);
  const [internalHeartCount, setInternalHeartCount] = useState(
    anime.likesCount || Math.floor((anime.popularity || 1000) / 100) || 120
  );
  const [internalUpvoteCount, setInternalUpvoteCount] = useState(
    anime.popularity || 1200
  );

  // Normalize languages
  const rawLangs = Array.isArray(anime.languages)
    ? anime.languages
    : (anime.languages || 'HIN,TAM,TEL').split(',').map(s => s.trim());

  // Normalize platforms
  const rawPlatforms = Array.isArray(anime.platform)
    ? anime.platform
    : (anime.platform || 'Crunchyroll').split(',').map(s => s.trim());
  const displayedPlatforms = rawPlatforms.slice(0, 2);

  const releaseYear = anime.releaseYear || anime.year || 2026;
  const animeType = anime.type || 'TV Series';
  const isAiring = anime.status === 'Ongoing' || anime.status === 'Airing';

  const getCleanCover = () => {
    if (!anime.cover_image || anime.cover_image.includes('i.ibb.co')) {
      const fallbacks = [
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80'
      ];
      return fallbacks[(anime.id || 0) % fallbacks.length];
    }
    return anime.cover_image;
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleLike) {
      onToggleLike(anime.id);
    } else {
      setInternalLiked(!internalLiked);
      setInternalHeartCount(prev => internalLiked ? prev - 1 : prev + 1);
    }
  };

  const handleUpvoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleUpvote) {
      onToggleUpvote(anime.id);
    } else {
      setInternalUpvoted(!internalUpvoted);
      setInternalUpvoteCount(prev => internalUpvoted ? prev - 1 : prev + 1);
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleBookmark) {
      onToggleBookmark(anime.id);
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: anime.title,
        text: `Watch ${anime.title} with regional Indian dubs!`,
        url: window.location.href
      }).catch(() => {});
    }
  };

  return (
    <ParallaxCard className="h-full">
      <div 
        onClick={() => onSelect(anime)}
        className="group relative flex flex-col h-full bg-[#131926] transition-all duration-300 cursor-pointer select-none rounded-2xl overflow-hidden border border-neutral-800/60 hover:border-purple-500/40 shadow-lg"
      >
        {/* POSTER CONTAINER */}
        <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-neutral-900">
          <img
            src={getCleanCover()}
            alt={anime.title}
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
            }}
            className="w-full h-full object-cover object-center sm:group-hover:scale-105 transition-transform duration-300"
          />
          {/* Bottom gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d121c] via-transparent to-black/40 pointer-events-none" />

          {/* TOP-LEFT BADGES */}
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 pointer-events-none">
            {isTrending && (
              <div className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg border border-purple-400/40">
                <Flame className="w-3 h-3 fill-current text-amber-200" />
                <span>Trending</span>
              </div>
            )}
            {isCached && (
              <div className="inline-flex items-center gap-1 bg-emerald-950/90 text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md border border-emerald-500/40 backdrop-blur-md">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Offline Ready</span>
              </div>
            )}
          </div>

          {/* TOP-RIGHT ACTION BUTTONS */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
            {/* Desktop Only Buttons */}
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="hidden sm:flex p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-neutral-300 hover:text-white transition-all shadow-md"
              title="Download for offline"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="hidden sm:flex p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-neutral-300 hover:text-white transition-all shadow-md"
              title="Report info"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleShareClick}
              className="hidden sm:flex p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-neutral-300 hover:text-white transition-all shadow-md"
              title="Share"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Always Visible Like Button */}
            <button
              onClick={handleLikeClick}
              className={`p-1.5 rounded-full backdrop-blur-md border transition-all active:scale-90 shadow-md ${
                internalLiked 
                  ? 'bg-primary-theme text-white border-primary-light/50 shadow-lg shadow-purple-950/40' 
                  : 'bg-black/60 text-neutral-300 hover:text-primary-theme border-white/10'
              }`}
              title="Like"
            >
              <Heart className={`w-3.5 h-3.5 ${internalLiked ? 'fill-white text-white' : ''}`} />
            </button>

            {/* Always Visible Watchlist Bookmark Button */}
            <button
              onClick={handleBookmarkClick}
              className={`p-1.5 rounded-full backdrop-blur-md border border-white/10 active:scale-90 shadow-md transition-all ${
                isBookmarked 
                  ? 'bg-primary-theme text-white shadow-lg' 
                  : 'bg-black/60 text-neutral-300 hover:text-white'
              }`}
              title="Bookmark"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-white text-white' : ''}`} />
            </button>
          </div>

          {/* POSTER BOTTOM STATS */}
          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white/90 pointer-events-none">
            {/* Left Rating Pill */}
            <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10 shadow-sm">
              <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
              <span className="text-orange-400 font-black">RATING</span>
              <span>{anime.rating ? `${anime.rating.toFixed(1)}/10` : 'N/A'}</span>
            </div>

            {/* Right Airing Badge */}
            {isAiring && (
              <div className="flex items-center gap-1 bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 px-1.5 py-0.5 rounded text-[10px] shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Airing</span>
              </div>
            )}
          </div>
        </div>

        {/* INFO SECTION */}
        <div className="p-3 sm:p-3.5 flex flex-col justify-between flex-grow min-w-0">
          <div>
            {/* Dub Badges */}
            <div className="flex flex-wrap gap-1 mb-2">
              {rawLangs.map((langStr, i) => {
                const upper = langStr.toUpperCase();
                let badgeClass = 'bg-[#059669] text-emerald-100';
                let shortLabel = 'Hin';

                if (upper.includes('TAM')) {
                  badgeClass = 'bg-[#b45309] text-amber-100';
                  shortLabel = 'Tam';
                } else if (upper.includes('TEL')) {
                  badgeClass = 'bg-[#0284c7] text-sky-100';
                  shortLabel = 'Tel';
                } else if (upper.includes('HIN')) {
                  badgeClass = 'bg-[#059669] text-emerald-100';
                  shortLabel = 'Hin';
                } else if (upper.includes('MAL')) {
                  badgeClass = 'bg-[#7c3aed] text-purple-100';
                  shortLabel = 'Mal';
                } else if (upper.includes('KAN')) {
                  badgeClass = 'bg-indigo-600 text-indigo-100';
                  shortLabel = 'Kan';
                } else if (upper.includes('BEN')) {
                  badgeClass = 'bg-pink-600 text-pink-100';
                  shortLabel = 'Ben';
                }

                return (
                  <span
                    key={i}
                    className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm border border-white/5 ${badgeClass}`}
                  >
                    {shortLabel}
                  </span>
                );
              })}
            </div>

            {/* Title */}
            <h3 className="font-bold text-sm text-neutral-100 line-clamp-1 group-hover:text-primary-theme transition-colors leading-snug">
              {anime.title}
            </h3>

            {/* Subtitle / Meta row */}
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1">
              <span>{animeType}</span>
              <span>•</span>
              <span>{releaseYear}</span>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-3 pt-2 border-t border-neutral-800/70 flex items-center justify-between gap-2">
            {/* Left Platforms */}
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
              {displayedPlatforms.map((plat, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-semibold bg-[#1a2133] text-neutral-400 px-1.5 py-0.5 rounded truncate"
                >
                  {plat}
                </span>
              ))}
            </div>

            {/* Right Counters */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Heart Counter Button */}
              <button
                type="button"
                onClick={handleLikeClick}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 ${
                  internalLiked
                    ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme/40'
                    : 'bg-[#161d2f] text-neutral-400 border border-neutral-800'
                }`}
              >
                <Heart className={`w-3 h-3 ${internalLiked ? 'fill-current' : ''}`} />
                <span>{internalHeartCount}</span>
              </button>

              {/* Upvote Counter Button */}
              <button
                type="button"
                onClick={handleUpvoteClick}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 ${
                  internalUpvoted
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : 'bg-[#161d2f] text-neutral-400 border border-neutral-800'
                }`}
              >
                <Flame className={`w-3 h-3 ${internalUpvoted ? 'fill-current' : ''}`} />
                <span>{internalUpvoteCount}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ParallaxCard>
  );
};
