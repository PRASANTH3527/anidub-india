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
  CheckCircle2 
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
  isTrending,
  onToggleBookmark,
  onSelect,
  onReport,
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

  // Local vote check
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

  const [likeCount, setLikeCount] = useState<number>(() => Number(anime.likes || anime.upvotes || 0));
  const [isUpvoting, setIsUpvoting] = useState(false);

  // Manual 1-Tap Offline Poster Caching
  const handleToggleCachePoster = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpvoted || isUpvoting) {
      if (isUpvoted) {
        toast.info('Already Upvoted 🔥', `You have already cast your vote for "${anime.title}".`);
      }
      return;
    }

    setIsUpvoting(true);
    const updatedCount = likeCount + 1;
    setLikeCount(updatedCount);
    setIsUpvoted(true);

    try {
      const saved = localStorage.getItem('anidub_upvoted_anime_ids');
      const list: string[] = saved ? JSON.parse(saved) : [];
      if (!list.includes(anime.id)) {
        list.push(anime.id);
        localStorage.setItem('anidub_upvoted_anime_ids', JSON.stringify(list));
      }
      await dbService.upvoteAnime(anime.id);
      toast.success('Upvoted! 🔥', `"${anime.title}" upvoted! Community votes: ${updatedCount}`);
    } catch (err) {
      console.warn('Error recording upvote:', err);
    } finally {
      setIsUpvoting(false);
    }
  };

  return (
    <div 
      onClick={() => onSelect(anime)}
      className="group relative flex flex-col h-full bg-[#131926] rounded-2xl overflow-hidden border border-neutral-800/80 hover:border-purple-500/40 hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 cursor-pointer shadow-md hover:shadow-xl hover:shadow-purple-950/20 select-none"
    >
      {/* Poster Section (Lightweight, No 3D Perspective) */}
      <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-neutral-900">
        {!imageError ? (
          <img
            src={displayImage}
            alt={anime.title}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1e2d] to-[#0f131d] flex flex-col items-center justify-center p-4 text-center">
            <Sparkles className="w-8 h-8 text-purple-400 mb-2 opacity-50" />
            <span className="text-xs font-semibold text-neutral-300">{anime.title}</span>
            <span className="text-[10px] text-neutral-500 mt-1">Image Cached Offline</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0d121c] via-transparent to-black/40 pointer-events-none" />

        {/* Top-Left Badges */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5">
          {isTrending && (
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg border border-orange-400/40">
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
          className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5" 
          onClick={(e) => e.stopPropagation()}
        >
          {/* Offline Poster Download Button */}
          <button
            type="button"
            onClick={handleToggleCachePoster}
            title={isCached ? 'Poster cached for offline viewing' : 'Download poster for offline use'}
            className={`p-1.5 rounded-full backdrop-blur-md border transition-all active:scale-90 ${
              isCached 
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40' 
                : 'bg-black/60 text-neutral-300 hover:text-white border-white/10'
            }`}
          >
            <DownloadCloud className={`w-3.5 h-3.5 ${isCaching ? 'animate-bounce text-purple-400' : ''}`} />
          </button>

          {onReport && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReport(anime); }}
              title="Report issue"
              className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-neutral-400 hover:text-rose-400 border border-white/10 active:scale-90 transition-all"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleShare}
            title="Share anime"
            className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-neutral-300 hover:text-white border border-white/10 active:scale-90 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(anime); }}
            title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
            className={`p-1.5 rounded-full backdrop-blur-md border border-white/10 active:scale-90 transition-all ${
              isBookmarked ? 'bg-purple-600 text-white shadow-lg' : 'bg-black/60 text-neutral-300'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Poster Bottom Stats (Rating & Status) */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white/90">
          <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10">
            <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
            <span className="text-orange-400 font-black">CR</span>
            <span>{anime.rating ? anime.rating.toFixed(1) : 'N/A'}</span>
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

          <h3 className="font-bold text-sm text-neutral-100 line-clamp-1 group-hover:text-purple-300 transition-colors">
            {anime.title}
          </h3>

          <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1">
            <span>{anime.type}</span>
            <span>•</span>
            <span>{anime.releaseYear}</span>
          </div>
        </div>

        {/* Bottom Platform and Upvote Bar */}
        <div className="mt-3 pt-2 border-t border-neutral-800/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            {(anime.platforms || []).slice(0, 2).map((p) => (
              <span key={p.name} className="text-[9px] font-semibold bg-[#1a2133] text-neutral-400 px-1.5 py-0.5 rounded truncate">
                {p.name.replace('YouTube (', '').replace(')', '')}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleUpvote}
            disabled={isUpvoting}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black transition-all active:scale-95 ${
              isUpvoted 
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' 
                : 'bg-[#161d2f] text-neutral-400 border border-neutral-800 hover:text-white'
            }`}
          >
            <Flame className={`w-3 h-3 ${isUpvoted ? 'fill-current' : ''}`} />
            <span>{likeCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnimeCard;
