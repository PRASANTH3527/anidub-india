import React, { useState, useRef } from 'react';
import { Bookmark, Star, Play, Sparkles, Share2, Check, Flame, Flag, Heart } from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';
import { useToast } from './Toast';
import { dbService } from '../services/databaseService';

interface AnimeCardProps {
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
  const toast = useToast();

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

  const displayImage = anime.imageUrl || anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

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

  // Mobile Swipe Gestures state
  const [dragOffset, setDragOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const hasSwipedRef = useRef(false);

  // 3D Parallax & Glare Effect
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isSwiping) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate tilt (max 10 degrees)
    const tiltX = (y - centerY) / centerY * 10;
    const tiltY = (centerX - x) / centerX * 10;
    
    setTilt({ x: tiltX, y: tiltY });
    
    // Glare position (percentage)
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlare({ x: glareX, y: glareY, opacity: 0.4 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setGlare(prev => ({ ...prev, opacity: 0 }));
  };

  const handleUpvoteDirect = async () => {
    if (isUpvoted) {
      toast.info('Already Upvoted 🔥', `You have already cast your vote for "${anime.title}".`);
      return;
    }

    setIsUpvoting(true);
    const updatedCount = likeCount + 1;
    setLikeCount(updatedCount);
    setIsUpvoted(true);

    try {
      // Store in localStorage so user can only vote once per anime
      const saved = localStorage.getItem('anidub_upvoted_anime_ids');
      const list: string[] = saved ? JSON.parse(saved) : [];
      if (!list.includes(anime.id)) {
        list.push(anime.id);
        localStorage.setItem('anidub_upvoted_anime_ids', JSON.stringify(list));
      }

      // Persist to JSONBin via databaseService PUT request
      await dbService.upvoteAnime(anime.id);
      toast.success('Swiped to Upvote! 🔥', `"${anime.title}" upvoted! Current community votes: ${updatedCount}`);
    } catch (err) {
      console.warn('Error recording upvote:', err);
    } finally {
      setIsUpvoting(false);
    }
  };

  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    handleUpvoteDirect();
  };

  // Touch Swipe Handlers for Mobile (Swipe Right -> Upvote, Swipe Left -> Watchlist)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    hasSwipedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    // 1. Horizontal Swipe Logic (Intact)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      setIsSwiping(true);
      hasSwipedRef.current = true;
      const clamped = Math.max(-80, Math.min(80, diffX));
      setDragOffset(clamped);
    }

    // 2. Mobile Tilt Logic
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Subtle tilt for mobile touch (max 5 degrees to not interfere with visibility)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const tiltX = (y - centerY) / centerY * 5;
    const tiltY = (centerX - x) / centerX * 5;
    
    setTilt({ x: tiltX, y: tiltY });
    setGlare({ x: (x / rect.width) * 100, y: (y / rect.height) * 100, opacity: 0.3 });
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const finalOffset = dragOffset;

    // Reset visual offset
    setDragOffset(0);
    setIsSwiping(false);
    touchStartRef.current = null;

    if (Math.abs(finalOffset) >= 48) {
      if (finalOffset > 48) {
        // Swiped Right -> Upvote (Fire)
        handleUpvoteDirect();
      } else if (finalOffset < -48) {
        // Swiped Left -> Add/Remove Watchlist (Heart)
        onToggleBookmark(anime);
        toast.success(
          !isBookmarked ? 'Added to Watchlist! 💜' : 'Removed from Watchlist',
          `"${anime.title}" ${!isBookmarked ? 'saved to your watchlist' : 'removed from watchlist'}.`
        );
      }
      setTimeout(() => {
        hasSwipedRef.current = false;
      }, 250);
    } else {
      setTimeout(() => {
        hasSwipedRef.current = false;
      }, 50);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl select-none group bg-[#0d121c]">
      {/* Background Left Reveal Indicator: Swipe Right -> Upvote (Fire) */}
      <div 
        className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-orange-600/40 via-amber-600/20 to-transparent flex items-center pl-3.5 z-0 pointer-events-none transition-opacity duration-150"
        style={{ opacity: dragOffset > 10 ? Math.min(1, dragOffset / 45) : 0 }}
      >
        <div className="flex items-center gap-1 text-orange-400 font-extrabold text-xs">
          <Flame className="w-5 h-5 fill-current text-orange-400 animate-pulse" />
          <span className="text-[11px] font-black">Upvote</span>
        </div>
      </div>

      {/* Background Right Reveal Indicator: Swipe Left -> Watchlist (Heart) */}
      <div 
        className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-rose-600/40 via-purple-600/20 to-transparent flex items-center justify-end pr-3.5 z-0 pointer-events-none transition-opacity duration-150"
        style={{ opacity: dragOffset < -10 ? Math.min(1, Math.abs(dragOffset) / 45) : 0 }}
      >
        <div className="flex items-center gap-1 text-rose-400 font-extrabold text-xs">
          <span className="text-[11px] font-black">Save</span>
          <Heart className="w-5 h-5 fill-current text-rose-400 animate-pulse" />
        </div>
      </div>

      {/* Interactive Swipable Card Body */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (!hasSwipedRef.current && Math.abs(dragOffset) < 10) {
            onSelect(anime);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          setDragOffset(0);
          setIsSwiping(false);
          touchStartRef.current = null;
          handleMouseLeave();
        }}
        style={{
          transform: `translateX(${dragOffset}px) perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.1, 0.8, 0.3, 1)',
          transformStyle: 'preserve-3d',
        }}
        className="relative z-10 flex flex-col rounded-2xl overflow-hidden bg-[#131926] border border-neutral-800/80 hover:border-primary-theme hover:shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(139,92,246,0.2)] active:scale-[0.99] transition-all duration-300 cursor-pointer"
      >
        {/* Dynamic Glare/Shine Effect */}
        <div 
          className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}), transparent 80%)`,
            mixBlendMode: 'soft-light'
          }}
        />

        {/* Poster Aspect Ratio Container (~2:3 ratio) */}
        <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-neutral-900" style={{ transform: 'translateZ(20px)' }}>
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

        {/* Top-Left: Trending Badge & Dub Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1 max-w-[70%] z-10">
          {/* Trending Indicator */}
          {isTrending && (
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg shadow-orange-600/40 border border-orange-400/40 animate-pulse">
              <Flame className="w-3 h-3 fill-current text-amber-200" />
              <span>Trending</span>
            </span>
          )}

          {/* Regional Dub Badges */}
          <div className="flex flex-wrap gap-1">
            {(anime.dubs || []).map((dub) => {
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
        </div>

        {/* Top-Right Quick Action Group: Report, Native Share & Bookmark */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          {/* Report Issue Flag Button */}
          {onReport && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReport(anime);
              }}
              title="Report broken link or wrong info"
              className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/90 active:scale-90 transition-all cursor-pointer border border-white/10"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Native Web Share Button */}
          <button
            onClick={handleShare}
            title={copied ? 'Link Copied!' : 'Share Anime'}
            className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-neutral-300 hover:text-white hover:bg-neutral-800/90 active:scale-90 transition-all cursor-pointer border border-white/10"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Bookmark Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(anime);
            }}
            title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all duration-200 active:scale-90 cursor-pointer border border-white/10 ${
              isBookmarked
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
                : 'bg-black/60 text-neutral-300 hover:text-white hover:bg-neutral-800/90'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Bottom Poster Quick Overlay: Rating & Type */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-semibold text-white/90">
          <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>{anime.rating?.toFixed(1) || '8.0'}</span>
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
      <div className="p-3.5 flex flex-col justify-between flex-grow" style={{ transform: 'translateZ(30px)' }}>
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
            <span>{anime.type || 'Series'}</span>
            <span>•</span>
            <span>{anime.releaseYear || '2024'}</span>
            {anime.episodes && (
              <>
                <span>•</span>
                <span>{anime.episodes} Ep</span>
              </>
            )}
          </div>
        </div>

        {/* Card Footer: Platforms & Upvote / Fire button */}
        <div className="mt-2.5 pt-2 border-t border-neutral-800/70 flex items-center justify-between gap-2" style={{ transform: 'translateZ(10px)' }}>
          {/* Streaming Platforms */}
          <div className="flex items-center gap-1 overflow-hidden min-w-0">
            {(anime.platforms || []).slice(0, 2).map((p) => (
              <span
                key={p.name}
                className="text-[9px] font-semibold bg-[#1a2133] text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700/60 truncate"
              >
                {p.name.replace('YouTube (', '').replace(')', '')}
              </span>
            ))}
            {(anime.platforms?.length || 0) > 2 && (
              <span className="text-[9px] text-neutral-500 font-medium">
                +{(anime.platforms?.length || 0) - 2}
              </span>
            )}
          </div>

          {/* Global Community Upvote / Fire Button */}
          <button
            onClick={handleUpvote}
            disabled={isUpvoting}
            title={isUpvoted ? `You upvoted this anime! (${likeCount} votes)` : `Upvote "${anime.title}" (${likeCount} votes)`}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all active:scale-90 cursor-pointer shrink-0 ${
              isUpvoted
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm shadow-orange-500/20'
                : 'bg-[#161d2f] hover:bg-orange-950/40 text-neutral-300 hover:text-orange-400 border border-neutral-700/60 hover:border-orange-500/40'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${isUpvoted ? 'fill-current text-orange-400' : 'text-orange-400'}`} />
            <span>{likeCount}</span>
          </button>
        </div>
      </div>
    </div>
    </div>
  );
};
