import React, { useState, useEffect } from 'react';
import { Star, Sparkles, ShieldCheck, Check, Loader2, Send } from 'lucide-react';

export interface DualRatingProps {
  globalRating?: number | null; // e.g. 8.5
  initialUserRating?: number | null;
  communityScore?: number | null;
  totalVotes?: number;
  onRate?: (score: number) => Promise<void> | void;
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
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRatedFeedback, setIsRatedFeedback] = useState(false);

  useEffect(() => {
    if (initialUserRating !== undefined && initialUserRating !== null) {
      setUserRating(initialUserRating);
    }
  }, [initialUserRating]);

  const displayGlobal = typeof globalRating === 'number' && !isNaN(globalRating) ? globalRating : 8.5;
  // Visually highlight: hover rating first, then newly selected rating, then saved rating
  const currentActiveScore = hoverRating || selectedRating || userRating || 0;

  // 1. Star tap ONLY selects the rating locally without triggering the API
  const handleSelectStar = (score: number) => {
    setSelectedRating(score);
    setIsSubmitted(false);
  };

  // 2. Explicit submission handler for the "Submit Rating" button
  const handleSubmitRating = async () => {
    if (selectedRating === null || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (onRate) {
        await onRate(selectedRating);
      }
      setUserRating(selectedRating);
      setIsSubmitted(true);
      setIsRatedFeedback(true);
      setTimeout(() => setIsRatedFeedback(false), 3000);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setIsSubmitting(false);
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
                    Saved: {userRating}/10
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-amber-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)] h-4">
                {currentActiveScore > 0 ? `${currentActiveScore}/10 • ${RATING_LABELS[currentActiveScore] || ''}` : 'Tap a star to rate'}
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
                    onClick={() => handleSelectStar(star)}
                    className="p-1 sm:p-1.5 transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none"
                    aria-label={`Select ${star} out of 10`}
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

            {/* SUBMIT RATING BUTTON & STATUS */}
            <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="text-[11px] text-neutral-400">
                {selectedRating !== null ? (
                  <span className="text-amber-300 font-medium">
                    Selected: <strong>{selectedRating}/10</strong> ({RATING_LABELS[selectedRating] || ''})
                  </span>
                ) : userRating ? (
                  <span className="text-neutral-400">
                    Your current score: <strong className="text-white">{userRating}/10</strong>. Tap a star to change.
                  </span>
                ) : (
                  <span>Tap a star above, then click submit</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmitRating}
                disabled={selectedRating === null || isSubmitting || (isSubmitted && selectedRating === userRating)}
                className={`w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                  selectedRating === null || (isSubmitted && selectedRating === userRating)
                    ? 'bg-white/5 border border-white/10 text-neutral-500 cursor-not-allowed'
                    : isSubmitting
                      ? 'bg-purple-600 text-white cursor-wait'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white shadow-lg shadow-orange-950/40 hover:shadow-orange-500/20 hover:scale-[1.02] active:scale-95'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Rating...</span>
                  </>
                ) : isSubmitted && selectedRating === userRating ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Rating Saved!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Rating</span>
                  </>
                )}
              </button>
            </div>

            {/* Feedback message on submit */}
            {isRatedFeedback && (
              <p className="text-[11px] text-center text-emerald-300 font-semibold animate-in fade-in bg-emerald-950/40 border border-emerald-500/30 rounded-lg py-1 px-2.5">
                ✨ Success! Your rating of {userRating}/10 has been recorded.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
