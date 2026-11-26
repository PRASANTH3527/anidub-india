import React, { useState, useEffect } from 'react';
import { Star, Users, ShieldCheck } from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';

interface DualRatingProps {
  animeId: string;
  officialRating?: number;
  userRatingsCount?: number;
  userRatingsSum?: number;
  onRatingUpdate?: (newRating: number) => void;
}

export const DualRating: React.FC<DualRatingProps> = ({ 
  animeId, 
  officialRating = 0,
  userRatingsCount = 0,
  userRatingsSum = 0,
  onRatingUpdate 
}) => {
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [averageUserRating, setAverageUserRating] = useState<number>(0);
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    const ratingsData = JSON.parse(localStorage.getItem('anime_user_ratings') || '{}');
    const currentAnimeRatings = ratingsData[animeId] || { sum: 0, count: 0, userVote: null };

    const totalCount = userRatingsCount + (currentAnimeRatings.userVote ? 1 : 0);
    const totalSum = userRatingsSum + (currentAnimeRatings.userVote || 0);

    setUserRating(currentAnimeRatings.userVote);
    setTotalVotes(totalCount);
    setAverageUserRating(totalCount > 0 ? Number((totalSum / totalCount).toFixed(1)) : 0);
  }, [animeId, userRatingsCount, userRatingsSum]);

  const handleRate = async (rating: number) => {
    const clamped = Math.min(10, Math.max(1, Math.round(rating)));
    const ratingsData = JSON.parse(localStorage.getItem('anime_user_ratings') || '{}');
    const currentAnimeRatings = ratingsData[animeId] || { sum: 0, count: 0, userVote: null };

    currentAnimeRatings.userVote = clamped;
    ratingsData[animeId] = currentAnimeRatings;
    localStorage.setItem('anime_user_ratings', JSON.stringify(ratingsData));

    const totalCount = userRatingsCount + 1;
    const totalSum = userRatingsSum + clamped;

    setUserRating(clamped);
    setTotalVotes(totalCount);
    const newAvg = Number((totalSum / totalCount).toFixed(1));
    setAverageUserRating(newAvg);

    try {
      await cloudflareApi.rateAnime(animeId, clamped);
    } catch (error) {
      console.error('Failed to sync rating with Cloudflare:', error);
    }

    if (onRatingUpdate) {
      onRatingUpdate(newAvg);
    }
  };

  const hasCatalogScore = typeof officialRating === 'number' && officialRating > 0;
  const hasCommunityScore = totalVotes > 0 && averageUserRating > 0;
  const activePreviewScore = hoveredScore ?? userRating ?? 8;

  return (
    <div
      className="flex flex-col gap-3 bg-[#12141E] p-3.5 sm:p-4 rounded-[12px] border border-[#292B39]"
      data-testid="dual-rating-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Catalog Score */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#B49AF8]" />
          </div>
          <div>
            <div className="text-[11px] text-[#A1A5B5] uppercase font-semibold tracking-wider">Catalog Score</div>
            {hasCatalogScore ? (
              <div className="text-[15px] font-bold text-[#F4F3FA] flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-[#F9C876] fill-current" />
                <span>{officialRating.toFixed(1)}</span>
                <span className="text-[12px] text-[#A1A5B5] font-normal">/ 10</span>
              </div>
            ) : (
              <div className="text-[13px] font-medium text-[#A1A5B5]">Not verified</div>
            )}
          </div>
        </div>

        <div className="hidden sm:block h-8 w-px bg-[#292B39]" />

        {/* Community Score */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-[#CBB6FF]" />
          </div>
          <div>
            <div className="text-[11px] text-[#A1A5B5] uppercase font-semibold tracking-wider flex items-center gap-1">
              <span>Community Score</span>
              {totalVotes > 0 && <span className="text-[#A1A5B5]">({totalVotes})</span>}
            </div>
            {hasCommunityScore ? (
              <div className="text-[15px] font-bold text-[#F4F3FA] flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-[#B49AF8] fill-current" />
                <span>{averageUserRating.toFixed(1)}</span>
                <span className="text-[12px] text-[#A1A5B5] font-normal">/ 10</span>
              </div>
            ) : (
              <div className="text-[13px] font-medium text-[#A1A5B5]" data-testid="community-not-rated">
                Not rated yet
              </div>
            )}
          </div>
        </div>

        {/* Toggle Rate Button (44px touch target) */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className={`min-h-[44px] px-3.5 rounded-[10px] text-[12px] font-semibold border transition-all duration-180 motion-reduce:transition-none flex items-center gap-1.5 ${
            userRating
              ? 'bg-[#B49AF8]/15 text-[#CBB6FF] border-[#B49AF8]/40 hover:bg-[#B49AF8]/25'
              : 'bg-[#191C29] text-[#F4F3FA] border-[#292B39] hover:border-[#B49AF8]/40'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${userRating ? 'text-[#F9C876] fill-current' : 'text-[#B49AF8]'}`} />
          <span>{userRating ? `Your Score: ${userRating}/10` : 'Rate Anime'}</span>
        </button>
      </div>

      {/* Expandable Touch-Friendly 1-10 Rating Control (44px targets + accessible slider) */}
      {isExpanded && (
        <div className="pt-3 border-t border-[#292B39] flex flex-col gap-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[#A1A5B5] font-medium">
              {userRating ? `Your saved score: ${userRating}/10` : 'Tap a score (1–10) or slide to rate'}
            </span>
            <span className="font-bold text-[#CBB6FF]">{activePreviewScore} / 10</span>
          </div>

          <input
            type="range"
            min={1}
            max={10}
            step={1}
            aria-label="Rate this anime from 1 to 10"
            value={userRating ?? 8}
            onChange={(e) => handleRate(Number(e.target.value))}
            className="w-full h-2 bg-[#191C29] rounded-lg appearance-none cursor-pointer accent-[#B49AF8]"
          />

          <div
            className="grid grid-cols-5 sm:grid-cols-10 gap-1.5"
            role="group"
            aria-label="Select score from 1 to 10"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
              const isSelected = userRating === score;
              const isHighlighted = (hoveredScore || userRating || 0) >= score;
              return (
                <button
                  key={score}
                  type="button"
                  aria-label={`Rate ${score} out of 10`}
                  aria-pressed={isSelected}
                  onMouseEnter={() => setHoveredScore(score)}
                  onMouseLeave={() => setHoveredScore(null)}
                  onClick={() => handleRate(score)}
                  className={`min-h-[44px] rounded-[10px] text-[13px] font-bold border transition-all duration-180 motion-reduce:transition-none flex items-center justify-center ${
                    isSelected
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8] shadow-sm'
                      : isHighlighted
                        ? 'bg-[#B49AF8]/15 text-[#CBB6FF] border-[#B49AF8]/40'
                        : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA] hover:border-[#B49AF8]/30'
                  }`}
                >
                  {score}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
