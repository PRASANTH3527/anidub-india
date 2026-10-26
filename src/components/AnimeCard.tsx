import React, { useState, useEffect } from 'react';
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
import { cloudflareApi } from '../services/cloudflareApi';

export interface AnimeCardData {
  id: number;
  title: string;
  slug?: string;
  synopsis?: string;
  cover_image?: string;
  image?: string;
  poster?: string;
  posterUrl?: string;
  poster_url?: string;
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

export interface AnimeCardProps {
  anime: AnimeCardData;
  onSelect: (anime: AnimeCardData) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: number) => void;
  isLiked?: boolean;
  onToggleLike?: (id: number, liked?: boolean, newCount?: number) => void;
  isUpvoted?: boolean;
  onToggleUpvote?: (id: number, upvoted?: boolean, newCount?: number) => void;
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
  isLiked,
  onToggleLike,
  isUpvoted,
  onToggleUpvote,
  isTrending = true,
  isCached = true
}) => {
  const [internalLiked, setInternalLiked] = useState<boolean>(() => {
    if (typeof isLiked === 'boolean') return isLiked;
    try {
      const saved = JSON.parse(localStorage.getItem('cf_user_likes') || '[]');
      return Array.isArray(saved) && saved.includes(anime.id);
    } catch {
      return false;
    }
  });

  const [internalUpvoted, setInternalUpvoted] = useState<boolean>(() => {
    if (typeof isUpvoted === 'boolean') return isUpvoted;
    try {
      const saved = JSON.parse(localStorage.getItem('cf_user_upvotes') || '[]');
      return Array.isArray(saved) && saved.includes(anime.id);
    } catch {
      return false;
    }
  });

  const [internalHeartCount, setInternalHeartCount] = useState<number>(
    Number(anime.likesCount) || 0
  );
  const [internalUpvoteCount, setInternalUpvoteCount] = useState<number>(
    Number(anime.popularity) || 0
  );

  const [isLiking, setIsLiking] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  // Sync state when props change
  useEffect(() => {
    setInternalHeartCount(Number(anime.likesCount) || 0);
  }, [anime.likesCount]);

  useEffect(() => {
    setInternalUpvoteCount(Number(anime.popularity) || 0);
  }, [anime.popularity]);

  useEffect(() => {
    if (typeof isLiked === 'boolean') {
      setInternalLiked(isLiked);
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem('cf_user_likes') || '[]');
        if (Array.isArray(saved)) setInternalLiked(saved.includes(anime.id));
      } catch {}
    }
  }, [anime.id, isLiked]);

  useEffect(() => {
    if (typeof isUpvoted === 'boolean') {
      setInternalUpvoted(isUpvoted);
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem('cf_user_upvotes') || '[]');
        if (Array.isArray(saved)) setInternalUpvoted(saved.includes(anime.id));
      } catch {}
    }
  }, [anime.id, isUpvoted]);

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
    const directUrl = anime.cover_image || (anime as any).posterUrl || (anime as any).image || (anime as any).poster || (anime as any).poster_url;
    if (directUrl && typeof directUrl === 'string' && directUrl.trim().length > 0) {
      return directUrl.trim();
    }
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
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);

    const nextLiked = !internalLiked;
    const delta = nextLiked ? 1 : -1;
    const optimisticCount = Math.max(0, (internalHeartCount || 0) + delta);

    // 1. Instant local and optimistic UI updates
    setInternalLiked(nextLiked);
    setInternalHeartCount(optimisticCount);

    // 2. Persist local user state in localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('cf_user_likes') || '[]');
      const set = new Set(Array.isArray(saved) ? saved : []);
      if (nextLiked) {
        set.add(anime.id);
      } else {
        set.delete(anime.id);
      }
      localStorage.setItem('cf_user_likes', JSON.stringify(Array.from(set)));
    } catch {}

    // 3. Notify parent listener (updates catalogList in App / CatalogView)
    if (onToggleLike) {
      onToggleLike(anime.id, nextLiked, optimisticCount);
    }

    // 4. Send API POST to Cloudflare Worker / D1
    try {
      const res = await cloudflareApi.likeAnime(anime.id, {
        action: nextLiked ? 'like' : 'unlike',
        delta
      });
      if (res && typeof res.likesCount === 'number') {
        setInternalHeartCount(res.likesCount);
        if (onToggleLike && res.likesCount !== optimisticCount) {
          onToggleLike(anime.id, nextLiked, res.likesCount);
        }
      }
    } catch (err) {
      console.warn(`[AniDub] Failed to sync like for anime #${anime.id}:`, err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleUpvoteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVoting) return;
    setIsVoting(true);

    const nextUpvoted = !internalUpvoted;
    const delta = nextUpvoted ? 1 : -1;
    const optimisticCount = Math.max(0, (internalUpvoteCount || 0) + delta);

    // 1. Instant local and optimistic UI updates
    setInternalUpvoted(nextUpvoted);
    setInternalUpvoteCount(optimisticCount);

    // 2. Persist local user state in localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('cf_user_upvotes') || '[]');
      const set = new Set(Array.isArray(saved) ? saved : []);
      if (nextUpvoted) {
        set.add(anime.id);
      } else {
        set.delete(anime.id);
      }
      localStorage.setItem('cf_user_upvotes', JSON.stringify(Array.from(set)));
    } catch {}

    // 3. Notify parent listener (updates catalogList in App / CatalogView)
    if (onToggleUpvote) {
      onToggleUpvote(anime.id, nextUpvoted, optimisticCount);
    }

    // 4. Send API POST to Cloudflare Worker / D1
    try {
      const res = await cloudflareApi.upvoteAnime(anime.id, {
        action: nextUpvoted ? 'up' : 'down',
        delta
      });
      if (res && typeof res.popularity === 'number') {
        setInternalUpvoteCount(res.popularity);
        if (onToggleUpvote && res.popularity !== optimisticCount) {
          onToggleUpvote(anime.id, nextUpvoted, res.popularity);
        }
      }
    } catch (err) {
      console.warn(`[AniDub] Failed to sync upvote for anime #${anime.id}:`, err);
    } finally {
      setIsVoting(false);
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
