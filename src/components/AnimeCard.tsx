'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  Star, 
  Sparkles, 
  Share2, 
  Check, 
  Flame, 
  Flag, 
  DownloadCloud, 
  CheckCircle2,
  Heart
} from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';
import { useToast } from './Toast';
import { dbService } from '../services/databaseService';
import { posterCacheService } from '../services/posterCacheService';

export interface AnimeCardProps {
  anime: Anime;
  isBookmarked: boolean;
  isTrending?: boolean;
  onToggleBookmark: (anime: Anime) => void;
  onSelect: (anime: Anime) => void;
  onReport?: (anime: Anime) => void;
  onToggleLike?: (anime: Anime) => void;
  onToggleUpvote?: (anime: Anime) => void;
}

const DUB_BADGE_STYLES: Record<DubLanguage, { bg: string; text: string; label: string }> = {
  Tamil: { bg: 'bg-[#b45309]', text: 'text-amber-100', label: 'Tam' },
  Telugu: { bg: 'bg-[#0284c7]', text: 'text-sky-100', label: 'Tel' },
  Hindi: { bg: 'bg-[#059669]', text: 'text-emerald-100', label: 'Hin' },
  Malayalam: { bg: 'bg-[#7c3aed]', text: 'text-purple-100', label: 'Mal' },
  Kannada: { bg: 'bg-indigo-600', text: 'text-indigo-100', label: 'Kan' },
  Bengali: { bg: 'bg-pink-600', text: 'text-pink-100', label: 'Ben' },
};

export const AnimeCard: React.FC<AnimeCardProps> = React.memo(({
  anime,
  isBookmarked,
  isTrending,
  onToggleBookmark,
  onSelect,
  onReport,
  onToggleLike,
  onToggleUpvote,
}) => {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const toast = useToast();

  const displayImage = anime.imageUrl || anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

  // Check offline poster cache status
  useEffect(() => {
    let isMounted = true;
    posterCacheService.isCached(displayImage).then((cached) => {
      if (isMounted) setIsCached(cached);
    });
    return () => {
      isMounted = false;
    };
  }, [displayImage]);

  // Like (Heart) state
  const [isLiked, setIsLiked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('anidub_liked_anime_ids');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.includes(anime.id)) return true;
        }
      } catch {}
    }
    return Boolean(isBookmarked);
  });

  const [heartCount, setHeartCount] = useState<number>(() => {
    return Number(anime.likes || 0);
  });
  const [isLiking, setIsLiking] = useState(false);

  // Sync isLiked if isBookmarked changes from external state
  useEffect(() => {
    if (isBookmarked) {
      setIsLiked(true);
    }
  }, [isBookmarked]);

  // Upvote (Fire) state
  const [isUpvoted, setIsUpvoted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('anidub_upvoted_anime_ids');
        if (saved) {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) && parsed.includes(anime.id);
        }
      } catch {}
    }
    return false;
  });

  const [upvoteCount, setUpvoteCount] = useState<number>(() => {
    return Number(anime.upvotes || anime.likes || 0);
  });
  const [isUpvoting, setIsUpvoting] = useState(false);

  // Manual 1-Tap Offline Poster Caching
  const handleToggleCachePoster = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isCaching) return;

    if (isCached) {
      const removed = await posterCacheService.removePoster(displayImage);
      if (removed) {
        setIsCached(false);
        toast.info('Removed from Offline Cache', `Poster for "${anime.title}" freed from device cache.`);
      }
    } else {
      setIsCaching(true);
      const success = await posterCacheService.cachePoster(displayImage);
      setIsCaching(false);
      if (success) {
        setIsCached(true);
        toast.success('Saved for Offline! 💾', `Poster for "${anime.title}" cached. You can now view it without internet.`);
      } else {
        toast.error('Caching Failed', 'Could not cache poster. Check network connection.');
      }
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const shareUrl = `${window.location.origin}/#anime/${anime.id}`;
    const dubList = (anime.dubs || []).join(', ');
    const shareData = {
      title: `${anime.title} — AniDub India`,
      text: `Stream ${anime.title} dubbed in ${dubList || 'regional Indian languages'} on AniDub India!`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Link Copied!', `Share link for "${anime.title}" copied to clipboard.`);
        setTimeout(() => setCopied(false), 2200);
      } catch (err) {
        toast.info('Share URL', shareUrl);
      }
    }
  };

  // Like (Heart) Handler
  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isLiking) return;
    setIsLiking(true);

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setHeartCount((prev) => Math.max(0, nextLiked ? prev + 1 : prev - 1));

    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('anidub_liked_anime_ids');
        let list: string[] = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(list)) list = [];
        if (nextLiked) {
          if (!list.includes(anime.id)) list.push(anime.id);
        } else {
          list = list.filter((id) => id !== anime.id);
        }
        localStorage.setItem('anidub_liked_anime_ids', JSON.stringify(list));
      }
    } catch {}

    if (onToggleLike) {
      onToggleLike(anime);
    } else if (onToggleBookmark && nextLiked !== isBookmarked) {
      onToggleBookmark(anime);
    }

    if (nextLiked) {
      toast.success('Liked! ❤️', `Added "${anime.title}" to favorites.`);
    } else {
      toast.info('Unliked', `Removed "${anime.title}" from favorites.`);
    }

    setTimeout(() => setIsLiking(false), 200);
  };

  // Upvote (Fire) Handler
  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isUpvoting) return;
    setIsUpvoting(true);

    const nextUpvoted = !isUpvoted;
    setIsUpvoted(nextUpvoted);
    const newCount = Math.max(0, nextUpvoted ? upvoteCount + 1 : upvoteCount - 1);
    setUpvoteCount(newCount);

    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('anidub_upvoted_anime_ids');
        let list: string[] = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(list)) list = [];
        if (nextUpvoted) {
          if (!list.includes(anime.id)) list.push(anime.id);
        } else {
          list = list.filter((id) => id !== anime.id);
        }
        localStorage.setItem('anidub_upvoted_anime_ids', JSON.stringify(list));
      }

      if (nextUpvoted) {
        await dbService.upvoteAnime(anime.id);
        toast.success('Upvoted! 🔥', `"${anime.title}" upvoted! Community votes: ${newCount}`);
      } else {
        toast.info('Vote Removed', `Removed upvote for "${anime.title}".`);
      }
    } catch (err) {
      console.warn('Error handling upvote:', err);
    } finally {
      setIsUpvoting(false);
    }

    if (onToggleUpvote) {
      onToggleUpvote(anime);
    }
  };

  return (
    <div 
      onClick={() => onSelect(anime)}
      className="group relative flex flex-col h-full bg-[#131926] rounded-2xl overflow-hidden border border-neutral-800/80 hover:border-primary-theme sm:hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 cursor-pointer shadow-md hover:shadow-xl hover:shadow-primary-theme/20 select-none will-change-transform"
    >
      {/* Poster Section (Lightweight, No 3D Perspective) */}
      <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-neutral-900">
        {!imageError ? (
          <img
            src={displayImage}
            alt={anime.title}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center sm:group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1e2d] to-[#0f131d] flex flex-col items-center justify-center p-4 text-center">
            <Sparkles className="w-8 h-8 text-accent-theme mb-2 opacity-50" />
            <span className="text-xs font-semibold text-neutral-300">{anime.title}</span>
            <span className="text-[10px] text-neutral-500 mt-1">Image Cached Offline</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0d121c] via-transparent to-black/40 pointer-events-none" />

        {/* Top-Left Badges */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 pointer-events-none">
          {isTrending && (
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg border border-purple-400/40">
              <Flame className="w-3 h-3 fill-current text-amber-200" />
              <span>Trending</span>
            </span>
          )}

          {isCached && (
            <span className="inline-flex items-center gap-1 bg-emerald-950/90 text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md border border-emerald-500/40 backdrop-blur-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Offline Ready</span>
            </span>
          )}
        </div>

        {/* Top-Right Action Buttons */}
        <div 
          className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 pointer-events-auto" 
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Offline Poster Download Button */}
          <button
            type="button"
            onClick={handleToggleCachePoster}
            onMouseDown={(e) => e.stopPropagation()}
            title={isCached ? 'Poster cached for offline viewing' : 'Download poster for offline use'}
            className={`p-1.5 rounded-full backdrop-blur-md border transition-all active:scale-90 cursor-pointer pointer-events-auto ${
              isCached 
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40' 
                : 'bg-black/60 text-neutral-300 hover:text-white border-white/10'
            }`}
          >
            <DownloadCloud className={`w-3.5 h-3.5 ${isCaching ? 'animate-bounce text-accent-theme' : ''}`} />
          </button>

          {onReport && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReport(anime); }}
              onMouseDown={(e) => e.stopPropagation()}
              title="Report issue"
              className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-neutral-400 hover:text-primary-theme border border-white/10 active:scale-90 transition-all cursor-pointer pointer-events-auto"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleShare}
            onMouseDown={(e) => e.stopPropagation()}
            title="Share anime"
            className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-neutral-300 hover:text-white border border-white/10 active:scale-90 transition-all cursor-pointer pointer-events-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>

          {/* Like (Heart) Button in Top-Right Overlay */}
          <button
            type="button"
            onClick={handleLike}
            onMouseDown={(e) => e.stopPropagation()}
            title={isLiked ? 'Unlike' : 'Like'}
            className={`p-1.5 rounded-full backdrop-blur-md border transition-all active:scale-90 cursor-pointer pointer-events-auto ${
              isLiked 
                ? 'bg-primary-theme text-white border-primary-light/50 shadow-lg shadow-purple-950/40' 
                : 'bg-black/60 text-neutral-300 hover:text-primary-theme border-white/10'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current text-white' : ''}`} />
          </button>

          {/* Watchlist (Bookmark) Button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(anime); }}
            onMouseDown={(e) => e.stopPropagation()}
            title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
            className={`p-1.5 rounded-full backdrop-blur-md border border-white/10 active:scale-90 transition-all cursor-pointer pointer-events-auto ${
              isBookmarked ? 'bg-primary-theme text-white shadow-lg' : 'bg-black/60 text-neutral-300 hover:text-white'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Poster Bottom Stats (Rating & Status) */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white/90 pointer-events-none">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10">
              <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
              <span className="text-orange-400 font-black">CR</span>
              <span>{anime.rating ? anime.rating.toFixed(1) : 'N/A'}</span>
            </div>
            {dbService.getAverageRatingForAnime(anime.id) > 0 && (
              <div className="flex items-center gap-1 bg-primary-theme/80 px-2 py-0.5 rounded-md backdrop-blur-sm border border-primary-light/30">
                <Heart className="w-3 h-3 text-white fill-current" />
                <span className="text-white font-black">USER</span>
                <span>{dbService.getAverageRatingForAnime(anime.id)}</span>
              </div>
            )}
          </div>
          {anime.status === 'Ongoing' && (
            <span className="flex items-center gap-1 bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 px-1.5 py-0.5 rounded text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Airing
            </span>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3.5 flex flex-col justify-between flex-grow">
        <div>
          {/* Dub Badges */}
          <div className="flex flex-wrap gap-1 mb-2">
            {(anime.dubs || []).map((lang) => {
              const style = DUB_BADGE_STYLES[lang] || { bg: 'bg-neutral-700', text: 'text-neutral-100', label: lang.substring(0, 3) };
              return (
                <span key={lang} className={`${style.bg} ${style.text} text-[7px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm border border-white/5`}>
                  {style.label}
                </span>
              );
            })}
          </div>

          <h3 className="font-bold text-sm text-neutral-100 line-clamp-1 group-hover:text-primary-theme transition-colors">
            {anime.title}
          </h3>

          <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1">
            <span>{anime.type}</span>
            <span>•</span>
            <span>{anime.releaseYear}</span>
          </div>
        </div>

        {/* Bottom Platform and Like/Upvote Bar */}
        <div 
          className="mt-3 pt-2 border-t border-neutral-800/70 flex items-center justify-between gap-2 relative z-10 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 min-w-0">
            {(anime.platforms || []).slice(0, 2).map((p) => (
              <span key={p.name} className="text-[9px] font-semibold bg-[#1a2133] text-neutral-400 px-1.5 py-0.5 rounded truncate">
                {p.name.replace('YouTube (', '').replace(')', '')}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Like (Heart) Button */}
            <button
              type="button"
              onClick={handleLike}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isLiking}
              title={isLiked ? 'Unlike' : 'Like'}
              className={`pointer-events-auto flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black transition-all active:scale-90 cursor-pointer ${
                isLiked 
                  ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme/40' 
                  : 'bg-[#161d2f] text-neutral-400 border border-neutral-800 hover:text-primary-theme hover:border-primary-theme/30'
              }`}
            >
              <Heart className={`w-3 h-3 ${isLiked ? 'fill-primary-theme text-primary-theme' : ''}`} />
              <span>{heartCount}</span>
            </button>

            {/* Upvote (Fire) Button */}
            <button
              type="button"
              onClick={handleUpvote}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isUpvoting}
              title={isUpvoted ? 'Upvoted' : 'Upvote'}
              className={`pointer-events-auto flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black transition-all active:scale-90 cursor-pointer ${
                isUpvoted 
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' 
                  : 'bg-[#161d2f] text-neutral-400 border border-neutral-800 hover:text-orange-400 hover:border-orange-500/30'
              }`}
            >
              <Flame className={`w-3 h-3 ${isUpvoted ? 'fill-orange-500 text-orange-500' : ''}`} />
              <span>{upvoteCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AnimeCard;
