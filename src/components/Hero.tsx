import React from 'react';
import { Sparkles, Dices, ShieldCheck } from 'lucide-react';
import { SupportedLanguage, translate } from '../utils/i18n';

interface HeroProps {
  totalCount: number;
  onOpenSurpriseMe?: () => void;
  uiLanguage?: SupportedLanguage;
}

export const Hero: React.FC<HeroProps> = ({ totalCount, onOpenSurpriseMe, uiLanguage = 'en' }) => {
  const lang = uiLanguage || 'en';

  return (
    <section className="relative pt-6 sm:pt-10 pb-6 sm:pb-8 text-center px-4 max-w-4xl mx-auto overflow-hidden w-full box-border">
      {/* Subtle radial background glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-2xl pointer-events-none -z-10 opacity-20 will-change-transform" 
        style={{ background: 'var(--primary-glow)' }}
      />

      {/* Top micro badge */}
      <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full badge-primary-theme text-[11px] sm:text-xs font-semibold mb-4 sm:mb-5 shadow-inner border border-primary-theme/30 max-w-full">
        <Sparkles className="w-3.5 h-3.5 text-accent-theme animate-pulse shrink-0" />
        <span className="truncate">Official Indian Dubbed Anime Directory</span>
        <span className="hidden sm:inline text-neutral-500">•</span>
        <span className="hidden sm:inline-flex items-center gap-1 text-emerald-400 font-bold shrink-0">
          <ShieldCheck className="w-3 h-3" /> 100% Legal OTT
        </span>
      </div>

      {/* Homepage Main H1 forcefully targeting "Anidub India Official Website" */}
      <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black font-heading tracking-tight text-white leading-snug sm:leading-tight mb-4 break-words">
        <span className="block text-lg sm:text-2xl lg:text-3xl text-[#ff5722] font-black uppercase tracking-wider mb-2">
          Anidub India Official Website
        </span>
        <span className="text-white">
          The Premier Destination for{' '}
        </span>
        <br className="hidden sm:inline" />
        <span 
          className="bg-clip-text text-transparent inline-block"
          style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          Anime Streaming &amp; Dubbing in India
        </span>
      </h1>

      {/* Subtitle with relaxed, readable line-height */}
      <p className="text-xs sm:text-sm md:text-base text-neutral-300 max-w-2xl mx-auto font-normal leading-relaxed sm:leading-loose px-2 mb-2">
        {lang === 'ta'
          ? 'இந்தியாவில் தமிழ், தெலுங்கு, இந்தி, மலையாளம் மற்றும் கன்னடம் ஆகிய மொழிகளில் அதிகாரப்பூர்வமாக டப் செய்யப்பட்ட அனிமே தொடர்களைக் கண்டறியுங்கள்.'
          : 'Discover officially dubbed anime in Tamil, Telugu, Hindi, Malayalam, and Kannada — streaming legally on Crunchyroll, Netflix, JioHotstar, and JioCinema.'}
      </p>

      {/* Visually Distinct 'Surprise Me' Roulette Trigger */}
      {onOpenSurpriseMe && (
        <div className="mt-5 sm:mt-6 flex items-center justify-center">
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
