import React from 'react';
import { Tv, Flame, Languages, CheckCircle2, TrendingUp } from 'lucide-react';
import { SupportedLanguage } from '../utils/i18n';
import { translate } from '../utils/i18n';

interface AnimatedStatsProps {
  totalAnime: number;
  totalUpvotes: number;
  languagesCount: number;
  uiLanguage?: SupportedLanguage;
}

export const AnimatedStats: React.FC<AnimatedStatsProps> = ({
  totalAnime,
  totalUpvotes,
  languagesCount,
  uiLanguage = 'en',
}) => {
  const lang = uiLanguage || 'en';

  return (
    <div className="w-full max-w-5xl mx-auto px-2.5 sm:px-4 mb-6 sm:mb-8 box-border">
      {/* Responsive Side-by-Side 3-Card Grid for Mobile, Tablet and Desktop */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5 md:gap-4 w-full box-border">
        {/* 1. Total Anime */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-primary-theme/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-lg hover:border-primary-theme/50 transition-all duration-300 group flex flex-col justify-between min-w-0 box-border">
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-primary-theme/10 rounded-full blur-xl pointer-events-none group-hover:bg-primary-theme/20 transition-all" />
          {/* Card Header */}
          <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 truncate">
              {translate('statsAnime', lang)}
            </span>
            <div className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-primary-theme/20 border border-primary-theme/30 flex items-center justify-center text-primary-theme shrink-0">
              <Tv className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </div>
          {/* Metric Value */}
          <div className="flex items-baseline gap-0.5 sm:gap-1.5 my-0.5">
            <span className="font-heading font-black text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight leading-none">
              {totalAnime.toLocaleString()}
            </span>
            <span className="text-primary-theme font-extrabold text-[10px] sm:text-xs">+</span>
          </div>
          {/* Subtitle Footnote */}
          <p className="text-[8px] xs:text-[9px] sm:text-[11px] text-neutral-400 mt-1 flex items-center gap-1 truncate">
            <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
            <span className="truncate">Verified dubs</span>
          </p>
        </div>

        {/* 2. Total Upvotes (Strictly Read-Only Summary Card) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-orange-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-lg hover:border-orange-500/50 transition-all duration-300 group flex flex-col justify-between min-w-0 box-border">
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-orange-600/10 rounded-full blur-xl pointer-events-none group-hover:bg-orange-600/20 transition-all" />
          {/* Card Header */}
          <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 truncate">
              {translate('statsUpvotes', lang)}
            </span>
            <div className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Flame className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
            </div>
          </div>
          {/* Metric Value */}
          <div className="flex items-baseline gap-0.5 sm:gap-1.5 my-0.5">
            <span className="font-heading font-black text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight leading-none truncate">
              {totalUpvotes.toLocaleString()}
            </span>
            <span className="text-orange-400 font-bold text-[10px] sm:text-xs">
              🔥
            </span>
          </div>
          {/* Subtitle Footnote */}
          <p className="text-[8px] xs:text-[9px] sm:text-[11px] text-neutral-400 mt-1 flex items-center gap-1 truncate">
            <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-400 shrink-0" />
            <span className="truncate">Community upvotes</span>
          </p>
        </div>

        {/* 3. Languages Supported */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-sky-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-lg hover:border-sky-500/50 transition-all duration-300 group flex flex-col justify-between min-w-0 box-border">
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-sky-600/10 rounded-full blur-xl pointer-events-none group-hover:bg-sky-600/20 transition-all" />
          {/* Card Header */}
          <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 truncate">
              {translate('statsLanguages', lang)}
            </span>
            <div className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Languages className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </div>
          {/* Metric Value */}
          <div className="flex items-baseline gap-0.5 sm:gap-1.5 my-0.5">
            <span className="font-heading font-black text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight leading-none">
              {languagesCount}
            </span>
            <span className="text-sky-400 font-bold text-[9px] sm:text-xs truncate">Regions</span>
          </div>
          {/* Subtitle Footnote */}
          <p className="text-[8px] xs:text-[9px] sm:text-[11px] text-neutral-400 mt-1 truncate">
            Tamil • Telugu • Hindi
          </p>
        </div>
      </div>
    </div>
  );
};
