import React, { useState, useEffect } from 'react';
import { Star, Sparkles, ShieldCheck, Check, Loader2, Send } from 'lucide-react';
import { Button } from './ui/Button';

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
  10: 'Masterpiece',
};

export const DualRating: React.FC<DualRatingProps> = ({
  globalRating = 8.5,
  initialUserRating = null,
  communityScore,
  totalVotes = 0,
  onRate,
  className = '',
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
  const currentActiveScore = hoverRating || selectedRating || userRating || 0;

  const handleSelectStar = (score: number) => {
    setSelectedRating(score);
    setIsSubmitted(false);
  };

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
    <div className={`w-full ${className}`}>
      <div className="relative overflow-hidden rounded-2xl bg-[#12141E] border border-[#292B39] p-4 sm:p-5 text-[#F4F3FA]">
        <div className="relative z-10 flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5]">
              Dual Rating System
            </span>
            <span className="text-[11px] text-[#F9C876] bg-[#191C29] border border-[#292B39] px-2.5 py-0.5 rounded-lg font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#F9C876]" />
              10-Point Scale
            </span>
          </div>

          {/* Dual Score Cards Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1. CATALOG SCORE (Read-only) */}
            <div className="flex flex-col p-3.5 rounded-xl bg-[#191C29] border border-[#292B39] text-left">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F9C876]">
                <Star className="w-3.5 h-3.5 fill-[#F9C876] text-[#F9C876]" />
                <span>Catalog Score</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#F4F3FA] tracking-tight tabular-nums">
                  {displayGlobal.toFixed(1)}
                </span>
                <span className="text-xs text-[#A1A5B5] font-bold">/ 10</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[#A1A5B5]">
                <ShieldCheck className="w-3 h-3 text-[#F9C876] shrink-0" />
                <span>Catalog Score</span>
              </div>
            </div>

            {/* 2. COMMUNITY RATING SCORE CARD */}
            <div className="flex flex-col p-3.5 rounded-xl bg-[#191C29] border border-[#292B39] text-left">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#CBB6FF]">
                <Sparkles className="w-3.5 h-3.5 text-[#B49AF8]" />
                <span>Community</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#F4F3FA] tracking-tight tabular-nums">
                  {communityScore !== undefined && communityScore !== null && totalVotes > 0
                    ? Number(communityScore).toFixed(1)
                    : userRating
                      ? userRating.toFixed(1)
                      : '0.0'}
                </span>
                <span className="text-xs text-[#A1A5B5] font-bold">/ 10</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[#A1A5B5]">
                <span>
                  {totalVotes > 0 ? `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}` : 'No votes yet'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. INTERACTIVE 10-STAR COMMUNITY RATING ROW */}
          <div className="pt-3 border-t border-[#292B39] flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#F4F3FA] text-xs">Rate this Anime</span>
                {userRating && (
                  <span className="text-[10px] font-semibold text-[#34D399] bg-[#34D399]/10 border border-[#34D399]/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Saved: {userRating}/10
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-[#F9C876] h-4">
                {currentActiveScore > 0
                  ? `${currentActiveScore}/10 • ${RATING_LABELS[currentActiveScore] || ''}`
                  : 'Tap a star to rate'}
              </span>
            </div>

            {/* 10-Star Interactive Bar */}
            <div className="flex items-center justify-between gap-0.5 sm:gap-1 p-1.5 sm:p-2 bg-[#191C29] rounded-xl border border-[#292B39] touch-manipulation">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => {
                const isLit = currentActiveScore >= star;
                return (
                  <button
                    key={`dual_rating_star_${star}`}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleSelectStar(star)}
                    className="p-1.5 transition-colors duration-150 cursor-pointer focus:outline-none"
                    aria-label={`Select ${star} out of 10`}
                  >
                    <Star
                      className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-150 ${
                        isLit
                          ? 'fill-[#F9C876] text-[#F9C876]'
                          : 'text-[#A1A5B5]/45 hover:text-[#F9C876]/70'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* SUBMIT RATING BUTTON & STATUS */}
            <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="text-[11px] text-[#A1A5B5]">
                {selectedRating !== null ? (
                  <span className="text-[#F9C876] font-medium">
                    Selected: <strong>{selectedRating}/10</strong> ({RATING_LABELS[selectedRating] || ''})
                  </span>
                ) : userRating ? (
                  <span className="text-[#A1A5B5]">
                    Your current score: <strong className="text-[#F4F3FA]">{userRating}/10</strong>. Tap a star to change.
                  </span>
                ) : (
                  <span>Tap a star above, then click submit</span>
                )}
              </div>

              <Button
                variant={
                  selectedRating === null || (isSubmitted && selectedRating === userRating)
                    ? 'secondary'
                    : 'primary'
                }
                size="sm"
                onClick={handleSubmitRating}
                disabled={selectedRating === null || isSubmitting || (isSubmitted && selectedRating === userRating)}
                className="w-full sm:w-auto"
                leftIcon={
                  isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isSubmitted && selectedRating === userRating ? (
                    <Check className="w-3.5 h-3.5 text-[#34D399]" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )
                }
              >
                {isSubmitting
                  ? 'Saving Rating...'
                  : isSubmitted && selectedRating === userRating
                    ? 'Rating Saved!'
                    : 'Submit Rating'}
              </Button>
            </div>

            {isRatedFeedback && (
              <p className="text-[11px] text-center text-[#34D399] font-semibold bg-[#34D399]/10 border border-[#34D399]/30 rounded-lg py-1.5 px-2.5">
                Success! Your rating of {userRating}/10 has been recorded.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
