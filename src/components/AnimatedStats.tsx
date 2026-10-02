'use client';

import React, { useState, useEffect } from 'react';
import { Tv, Flame, Languages, CheckCircle2, TrendingUp, Sparkles, Film } from 'lucide-react';
import { SupportedLanguage, translate } from '../utils/i18n';

interface AnimatedStatsProps {
  totalAnime: number;
  totalUpvotes: number;
  languagesCount?: number;
  uiLanguage?: SupportedLanguage;
}

function useCountUp(target: number, duration: number = 1200): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }

    let startTimestamp: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * target));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return count;
}

export const AnimatedStats: React.FC<AnimatedStatsProps> = ({
  totalAnime,
  totalUpvotes,
  languagesCount = 5,
  uiLanguage = 'en',
}) => {
  const lang = uiLanguage || 'en';
  const animatedAnimeCount = useCountUp(totalAnime, 1000);
  const animatedUpvotesCount = useCountUp(totalUpvotes, 1200);
  const animatedLangCount = useCountUp(languagesCount, 800);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        
        {/* 1. Total Anime */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-xl hover:border-purple-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-600/20 transition-all" />
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {translate('statsAnime', lang)}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Tv className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
              {animatedAnimeCount}
            </span>
            <span className="text-purple-400 font-bold text-xs">+</span>
          </div>

          <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Verified official dubs</span>
          </p>
        </div>

        {/* 2. Total Upvotes */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-orange-500/30 rounded-2xl p-4 sm:p-5 shadow-xl hover:border-orange-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-600/10 rounded-full blur-2xl pointer-events-none group-hover:bg-orange-600/20 transition-all" />
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {translate('statsUpvotes', lang)}
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Flame className="w-4 h-4 fill-current" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
              {animatedUpvotesCount}
            </span>
            <span className="text-orange-400 font-bold text-xs">🔥</span>
          </div>

          <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-orange-400 shrink-0" />
            <span>Global community likes</span>
          </p>
        </div>

        {/* 3. Languages Supported */}
        <div className="col-span-2 md:col-span-1 relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-xl hover:border-sky-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-600/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-600/20 transition-all" />
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {translate('statsLanguages', lang)}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Languages className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
              {animatedLangCount}
            </span>
            <span className="text-sky-400 font-bold text-xs">Regions</span>
          </div>

          <p className="text-[11px] text-neutral-400 mt-1 truncate">
            Tamil • Telugu • Hindi • Mal • Kan
          </p>
        </div>

      </div>
    </div>
  );
};
