import React, { useState, useEffect } from 'react';
import { Tv, Flame, Languages, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react';

export interface AnimatedStatsProps {
  totalAnime?: number;
  totalVotes?: number;
  totalLanguages?: number;
}

export const AnimatedStats: React.FC<AnimatedStatsProps> = ({
  totalAnime = 0,
  totalVotes = 0,
  totalLanguages = 0
}) => {
  const [animeCount, setAnimeCount] = useState(0);
  const [votesCount, setVotesCount] = useState(0);
  const [langCount, setLangCount] = useState(0);

  // Smooth number count-up effect on mount
  useEffect(() => {
    const duration = 1200; // ms
    const frameRate = 30;
    const totalFrames = Math.round(duration / (1000 / frameRate));
    let frame = 0;

    const timer = setInterval(() => {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setAnimeCount(Math.round(totalAnime * easeProgress));
      setVotesCount(Math.round(totalVotes * easeProgress));
      setLangCount(Math.round(totalLanguages * easeProgress));

      if (frame >= totalFrames) {
        clearInterval(timer);
      }
    }, 1000 / frameRate);

    return () => clearInterval(timer);
  }, [totalAnime, totalVotes, totalLanguages]);

  const formattedVotes = votesCount >= 1000 
    ? `${(votesCount / 1000).toFixed(1).replace(/\.0$/, '')}k` 
    : `${votesCount.toLocaleString()}`;

  return (
    <div className="w-full max-w-5xl mx-auto px-2.5 sm:px-4 mb-3 sm:mb-6 box-border">
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5 md:gap-4 w-full box-border">
        
        {/* CARD 1: TOTAL ANIME */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-primary-theme/30 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 md:p-5 shadow-lg hover:border-primary-theme/50 transition-all duration-300 group flex flex-col justify-between min-w-0 box-border">
          {/* Subtle Background Accent Glow */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary-theme/10 rounded-full blur-2xl pointer-events-none group-hover:bg-primary-theme/20 transition-all duration-500" />
          
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 break-words whitespace-normal leading-tight">
              Dubbed Titles
            </span>
            <div className="w-4 h-4 xs:w-5 xs:h-5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-primary-theme/20 border border-primary-theme/30 text-primary-theme flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110">
              <Tv className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="my-0.5 sm:my-2">
            <div className="font-heading font-black text-sm xs:text-base sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight flex items-baseline gap-0.5">
              <span>{animeCount}</span>
              <span className="text-primary-theme text-[10px] xs:text-xs sm:text-lg md:text-xl font-bold">+</span>
            </div>
          </div>

          <div className="mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5 text-[9px] xs:text-[10px] sm:text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>100% Legal Dubs</span>
          </div>
        </div>

        {/* CARD 2: COMMUNITY VOTES */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-orange-500/30 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 md:p-5 shadow-lg hover:border-orange-500/50 transition-all duration-300 group flex flex-col justify-between min-w-0 box-border">
          {/* Subtle Background Accent Glow */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-orange-500/20 transition-all duration-500" />
          
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 break-words whitespace-normal leading-tight">
              Community Votes
            </span>
            <div className="w-4 h-4 xs:w-5 xs:h-5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110">
              <Flame className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="my-0.5 sm:my-2">
            <div className="font-heading font-black text-sm xs:text-base sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight flex items-baseline gap-1">
              <span>{formattedVotes}</span>
              <span className="text-orange-400 text-[10px] xs:text-xs sm:text-base">🔥</span>
            </div>
          </div>

          <div className="mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5 text-[9px] xs:text-[10px] sm:text-xs text-orange-400/90 font-medium">
            <TrendingUp className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Community Upvotes</span>
          </div>
        </div>

        {/* CARD 3: LANGUAGES SUPPORTED */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-sky-500/30 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 md:p-5 shadow-lg hover:border-sky-500/50 transition-all duration-300 group flex flex-col justify-between min-w-0 box-border">
          {/* Subtle Background Accent Glow */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-all duration-500" />
          
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 break-words whitespace-normal leading-tight">
              Languages
            </span>
            <div className="w-4 h-4 xs:w-5 xs:h-5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-600/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110">
              <Languages className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="my-0.5 sm:my-2">
            <div className="font-heading font-black text-sm xs:text-base sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight flex items-baseline gap-1">
              <span>{langCount}</span>
              <span className="text-sky-400 text-[10px] xs:text-xs sm:text-lg font-bold">Regions</span>
            </div>
          </div>

          <div className="mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5 text-[9px] xs:text-[10px] sm:text-xs text-sky-300/80 font-medium">
            <Sparkles className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-sky-400" />
            <span>Tamil • Telugu • Hindi</span>
          </div>
        </div>

      </div>
    </div>
  );
};
