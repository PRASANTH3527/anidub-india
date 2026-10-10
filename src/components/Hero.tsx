import React from 'react';
import { Sparkles, Dices } from 'lucide-react';
import { SupportedLanguage, translate } from '../utils/i18n';

interface HeroProps {
  totalCount: number;
  onOpenSurpriseMe?: () => void;
  uiLanguage?: SupportedLanguage;
}

export const Hero: React.FC<HeroProps> = ({ totalCount, onOpenSurpriseMe, uiLanguage = 'en' }) => {
  const lang = uiLanguage || 'en';
  
  return (
    <section className="relative pt-10 pb-6 sm:pt-14 sm:pb-8 text-center px-4 max-w-4xl mx-auto overflow-hidden">
      {/* Subtle radial background glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-xl pointer-events-none -z-10 opacity-20 will-change-transform" 
        style={{ background: 'var(--primary-glow)' }}
      />

      {/* Top micro badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full badge-primary-theme text-xs font-semibold mb-4 shadow-inner">
        <Sparkles className="w-3.5 h-3.5 text-accent-theme animate-pulse" />
        <span>{translate('heroBadge', lang)}</span>
      </div>

      {/* Main Title */}
      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-heading tracking-tight text-white leading-tight sm:leading-none mb-3">
        {translate('heroTitlePart1', lang)} <br className="hidden sm:inline" />
        <span 
          className="bg-clip-text text-transparent"
          style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          {translate('heroTitlePart2', lang)}
        </span>
      </h1>

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-neutral-300/90 max-w-2xl mx-auto font-normal leading-relaxed">
        {translate('heroSubtitle', lang)}
      </p>

      {/* Visually Distinct 'Surprise Me' Roulette Trigger */}
      {onOpenSurpriseMe && (
        <div className="mt-5 flex items-center justify-center">
          <button
            onClick={onOpenSurpriseMe}
            className="group relative px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-[var(--primary-accent)] hover:from-amber-400 hover:via-orange-400 hover:brightness-110 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-amber-300/40"
          >
            <Dices className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>{translate('surpriseMe', lang)}</span>
            <span className="bg-black/30 text-amber-200 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-black">
              🎲 {translate('randomPick', lang)}
            </span>
          </button>
        </div>
      )}
    </section>
  );
};
