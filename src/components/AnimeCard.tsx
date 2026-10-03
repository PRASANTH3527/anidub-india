import React, { useState, useRef } from 'react';
import { Bookmark, Star, Play, Sparkles, Share2, Check, Flame, Flag, Heart } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
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
      const saved = localStorage.getItem('anidub_upvoted_anime_ids');
      const list: string[] = saved ? JSON.parse(saved) : [];
      if (!list.includes(anime.id)) {
        list.push(anime.id);
        localStorage.setItem('anidub_upvoted_anime_ids', JSON.stringify(list));
      }
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

  // --- Framer Motion 3D Tilt Logic ---
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // --- Swipe Logic (Framer Motion Drag) ---
  const dragX = useMotionValue(0);
  const backgroundOpacityLeft = useTransform(dragX, [0, 80], [0, 1]);
  const backgroundOpacityRight = useTransform(dragX, [0, -80], [0, 1]);

  const onDragEnd = (_: any, info: any) => {
    const offset = info.offset.x;
    if (offset > 50) {
      // Swipe Right -> Watchlist
      onToggleBookmark(anime);
      toast.success(
        !isBookmarked ? 'Added to Watchlist! 💜' : 'Removed from Watchlist',
        `"${anime.title}" ${!isBookmarked ? 'saved to your watchlist' : 'removed from watchlist'}.`
      );
    } else if (offset < -50) {
      // Swipe Left -> Upvote
      handleUpvoteDirect();
    }
  };

  return (
    <motion.div
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative group perspective-1000"
    >
      {/* Background Indicators for Swipe */}
      <motion.div 
        style={{ opacity: backgroundOpacityLeft }}
        className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-purple-600/40 via-purple-600/20 to-transparent flex items-center pl-4 z-0 rounded-2xl"
      >
        <Heart className="w-6 h-6 text-rose-400 fill-current animate-pulse" />
      </motion.div>
      <motion.div 
        style={{ opacity: backgroundOpacityRight }}
        className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-orange-600/40 via-amber-600/20 to-transparent flex items-center justify-end pr-4 z-0 rounded-2xl"
      >
        <Flame className="w-6 h-6 text-orange-400 fill-current animate-pulse" />
      </motion.div>

      {/* Main Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={onDragEnd}
        style={{ x: dragX, transformStyle: "preserve-3d" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect(anime)}
        className="relative z-10 flex flex-col rounded-2xl overflow-hidden bg-[#131926] border border-neutral-800/80 hover:border-purple-500/50 transition-colors duration-300 cursor-pointer shadow-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(139,92,246,0.15)]"
      >
        {/* Dynamic Glare Overlay */}
        <motion.div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, rgba(255,255,255,0.05), transparent 70%)",
            opacity: useTransform(mouseXSpring, [-0.5, 0.5], [0, 0.3]),
          }}
        />

        {/* Poster Section */}
        <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-neutral-900">
          {!imageError ? (
            <motion.img
              src={displayImage}
              alt={anime.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover object-center"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4 }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1a1e2d] to-[#0f131d] flex flex-col items-center justify-center p-4 text-center">
              <Sparkles className="w-8 h-8 text-purple-400 mb-2 opacity-50" />
              <span className="text-xs font-semibold text-neutral-300">{anime.title}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#0d121c] via-transparent to-black/40 pointer-events-none" />

          {/* Badges & Actions */}
          <div className="absolute top-2.5 left-2.5 z-10">
            {isTrending && (
              <motion.span 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg border border-orange-400/40"
              >
                <Flame className="w-3 h-3 fill-current text-amber-200" />
                <span>Trending</span>
              </motion.span>
            )}
          </div>

          <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {onReport && (
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); onReport(anime); }}
                className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-neutral-400 hover:text-rose-400 border border-white/10"
              >
                <Flag className="w-3.5 h-3.5" />
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShare}
              className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-neutral-300 hover:text-white border border-white/10"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(anime); }}
              className={`p-1.5 rounded-full backdrop-blur-md border border-white/10 ${isBookmarked ? 'bg-purple-600 text-white shadow-lg' : 'bg-black/60 text-neutral-300'}`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            </motion.button>
          </div>

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
        <div className="p-3.5 flex flex-col justify-between flex-grow bg-[#131926]">
          <div style={{ transform: "translateZ(30px)" }}>
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

          <div className="mt-3 pt-2 border-t border-neutral-800/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              {(anime.platforms || []).slice(0, 2).map((p) => (
                <span key={p.name} className="text-[9px] font-semibold bg-[#1a2133] text-neutral-400 px-1.5 py-0.5 rounded truncate">
                  {p.name.replace('YouTube (', '').replace(')', '')}
                </span>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleUpvote}
              disabled={isUpvoting}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black transition-all ${isUpvoted ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-[#161d2f] text-neutral-400 border border-neutral-800'}`}
            >
              <Flame className={`w-3 h-3 ${isUpvoted ? 'fill-current' : ''}`} />
              <span>{likeCount}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
