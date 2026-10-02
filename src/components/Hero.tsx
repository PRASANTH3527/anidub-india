import React from 'react';
import { Sparkles, Dices } from 'lucide-react';

interface HeroProps {
  totalCount: number;
  onOpenSurpriseMe?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ totalCount, onOpenSurpriseMe }) => {
  return (
    <section className="relative pt-10 pb-6 sm:pt-14 sm:pb-8 text-center px-4 max-w-4xl mx-auto overflow-hidden">
      {/* Subtle purple radial background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top micro badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/50 border border-purple-800/40 text-purple-300 text-xs font-semibold mb-4 shadow-inner">
        <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
        <span>India's Largest Regional Anime Dub Tracker</span>
      </div>

      {/* Main Title */}
      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-heading tracking-tight text-white leading-tight sm:leading-none mb-3">
        Find Anime Dubbed in <br className="hidden sm:inline" />
        <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent">
          Your Language
        </span>
      </h1>

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-neutral-300/90 max-w-2xl mx-auto font-normal leading-relaxed">
        Discover which anime are dubbed in{' '}
        <span className="text-amber-400 font-semibold">Tamil</span>,{' '}
        <span className="text-sky-400 font-semibold">Telugu</span>,{' '}
        <span className="text-emerald-400 font-semibold">Hindi</span>,{' '}
        <span className="text-violet-400 font-semibold">Malayalam</span>, and{' '}
        <span className="text-rose-400 font-semibold">Kannada</span> — and where to stream them.
      </p>

      {/* Visually Distinct 'Surprise Me' Roulette Trigger */}
      {onOpenSurpriseMe && (
        <div className="mt-5 flex items-center justify-center">
          <button
            onClick={onOpenSurpriseMe}
            className="group relative px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 hover:from-amber-400 hover:via-orange-400 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-amber-300/40"
          >
            <Dices className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>Surprise Me Roulette</span>
            <span className="bg-black/30 text-amber-200 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-black">
              🎲 Random Pick
            </span>
          </button>
        </div>
      )}
    </section>
  );
};
