import React, { useState, useEffect } from 'react';
import { Star, Sparkles, ShieldCheck, Check } from 'lucide-react';

export interface DualRatingProps {
  globalRating?: number | null; // e.g. 8.5
  initialUserRating?: number | null;
  communityScore?: number | null;
  totalVotes?: number;
  onRate?: (score: number) => void;
  className?: string;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Appalling',
  2: 'Horrible',
  3: 'Very Bad',
  4: 'Bad',
  5: 'Average',
  6: 'Fine',
  7: 'Good',
  8: 'Very Good',
  9: 'Great',
  10: 'Masterpiece'
};

export const DualRating: React.FC<DualRatingProps> = ({
  globalRating = 8.5,
  initialUserRating = null,
  communityScore,
  totalVotes = 0,
  onRate,
  className = ''
}) => {
  const [userRating, setUserRating] = useState<number | null>(initialUserRating);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isRatedFeedback, setIsRatedFeedback] = useState(false);

  useEffect(() => {
    if (initialUserRating !== undefined && initialUserRating !== null) {
      setUserRating(initialUserRating);
    }
  }, [initialUserRating]);

  const displayGlobal = typeof globalRating === 'number' && !isNaN(globalRating) ? globalRating : 8.5;
  const currentActiveScore = hoverRating || userRating || 0;

  const handleRate = (score: number) => {
    // 1. Optimistic UI update - stars stay highlighted immediately
    setUserRating(score);
    setIsRatedFeedback(true);
    setTimeout(() => setIsRatedFeedback(false), 2500);

    // 2. Trigger placeholder or external handleRate callback
    if (onRate) {
      onRate(score);
    } else {
      console.log(`[DualRating] User rated: ${score}/10`);
    }
  };

  return (
    <div className={`w-full max-w-lg mx-auto ${className}`}>
      <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 sm:p-5 shadow-2xl text-white">
        {/* Neon Ambient Glows */}
        <div className="absolute -top-14 -right-14 w-36 h-36 bg-amber-500/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-14 -left-14 w-36 h-36 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Dual Rating System
            </span>
            <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              10-Point Scale
            </span>
          </div>

          {/* Dual Score Cards Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1. GLOBAL RATING (Read-only) */}
            <div className="flex flex-col p-3 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.08)] text-left">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                <span>Global Score</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
                  {displayGlobal.toFixed(1)}
                </span>
                <span className="text-xs text-amber-400/80 font-bold">/ 10</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-200/70">
                <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Official Rating</span>
              </div>
            </div>

            {/* 2. COMMUNITY RATING SCORE CARD */}
            <div className="flex flex-col p-3 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-500/25 shadow-[0_0_15px_rgba(168,85,247,0.08)] text-left">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-purple-300">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                <span>Community</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
                  {communityScore !== undefined && communityScore !== null && totalVotes > 0
                    ? Number(communityScore).toFixed(1)
                    : (userRating ? userRating.toFixed(1) : '0.0')}
                </span>
                <span className="text-xs text-purple-300/80 font-bold">/ 10</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-purple-200/70">
                <span>
                  {totalVotes > 0 ? `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}` : 'No votes yet'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. INTERACTIVE 10-STAR COMMUNITY RATING ROW */}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">Rate this Anime</span>
                {userRating && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    You rated: {userRating}/10
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-amber-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)] h-4">
                {currentActiveScore > 0 ? `${currentActiveScore}/10 • ${RATING_LABELS[currentActiveScore] || ''}` : 'Hover & tap to rate'}
              </span>
            </div>

            {/* 10-Star Interactive Bar */}
            <div className="flex items-center justify-between gap-1 p-2 bg-black/40 rounded-xl border border-white/5 touch-manipulation">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => {
                const isLit = currentActiveScore >= star;
                return (
                  <button
                    key={`dual_rating_star_${star}`}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRate(star)}
                    className="p-1 sm:p-1.5 transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none"
                    aria-label={`Rate ${star} out of 10`}
                  >
                    <Star
                      className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-150 ${
                        isLit
                          ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]'
                          : 'text-neutral-600 hover:text-yellow-200/60'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Feedback message on click */}
            {isRatedFeedback && (
              <p className="text-[10px] text-center text-amber-300 font-semibold animate-in fade-in">
                ✨ Optimistic update: Your rating ({userRating}/10) is highlighted!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
