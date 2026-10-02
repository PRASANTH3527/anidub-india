'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Dices, 
  X, 
  Sparkles, 
  Play, 
  Bookmark, 
  Star, 
  RotateCw, 
  Check, 
  ExternalLink,
  Flame,
  Tv
} from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';
import { useToast } from './Toast';

interface SurpriseRouletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  animeList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onToggleWatchlist: (anime: Anime) => void;
  watchlistIds: string[];
}

const DUB_BADGE_STYLES: Record<DubLanguage, { bg: string; text: string; label: string }> = {
  Tamil: { bg: 'bg-[#b45309]', text: 'text-amber-100', label: 'Tamil' },
  Telugu: { bg: 'bg-[#0284c7]', text: 'text-sky-100', label: 'Telugu' },
  Hindi: { bg: 'bg-[#059669]', text: 'text-emerald-100', label: 'Hindi' },
  Malayalam: { bg: 'bg-[#7c3aed]', text: 'text-purple-100', label: 'Malayalam' },
  Kannada: { bg: 'bg-[#e11d48]', text: 'text-rose-100', label: 'Kannada' },
};

export const SurpriseRouletteModal: React.FC<SurpriseRouletteModalProps> = ({
  isOpen,
  onClose,
  animeList,
  onSelectAnime,
  onToggleWatchlist,
  watchlistIds,
}) => {
  const toast = useToast();
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayAnime, setDisplayAnime] = useState<Anime | null>(null);
  const [spinCount, setSpinCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startSpin = () => {
    if (animeList.length === 0) return;
    setIsSpinning(true);

    let speed = 60; // initial ms between flips
    let elapsed = 0;
    const totalDuration = 1800; // spin duration

    const cycle = () => {
      const randomIndex = Math.floor(Math.random() * animeList.length);
      setDisplayAnime(animeList[randomIndex]);
      elapsed += speed;

      // Progressively decelerate the roulette
      if (elapsed > totalDuration * 0.7) {
        speed += 40;
      } else if (elapsed > totalDuration * 0.4) {
        speed += 15;
      }

      if (elapsed < totalDuration) {
        timerRef.current = setTimeout(cycle, speed);
      } else {
        // Final pick
        const finalPick = animeList[Math.floor(Math.random() * animeList.length)];
        setDisplayAnime(finalPick);
        setIsSpinning(false);
        setSpinCount((c) => c + 1);
      }
    };

    cycle();
  };

  useEffect(() => {
    if (isOpen) {
      startSpin();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsSpinning(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentAnime = displayAnime || animeList[0];
  if (!currentAnime) return null;

  const isBookmarked = watchlistIds.includes(currentAnime.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-[#121829] border border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
              <Dices className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-heading font-black text-white text-base sm:text-lg flex items-center gap-1.5">
                Surprise Me Roulette
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-[11px] text-neutral-400">
                {isSpinning ? 'Spinning through Indian dubbed anime...' : 'Random approved anime match!'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Roulette Screen */}
        <div className="py-4">
          <div className={`relative overflow-hidden rounded-2xl bg-neutral-900 border transition-all duration-300 ${
            isSpinning 
              ? 'border-amber-500 shadow-xl shadow-amber-500/20 scale-[0.99] ring-2 ring-amber-400/40' 
              : 'border-purple-500/50 shadow-2xl shadow-purple-900/30'
          }`}>
            
            {/* Poster + Overlay */}
            <div className="relative h-60 sm:h-72 w-full overflow-hidden bg-neutral-950">
              <img
                src={currentAnime.imageUrl || currentAnime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&fit=crop&q=80'}
                alt={currentAnime.title}
                className={`w-full h-full object-cover transition-all ${
                  isSpinning ? 'blur-sm scale-105' : 'blur-0 scale-100 duration-500'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121829] via-[#121829]/50 to-transparent" />

              {/* Status Indicator */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                {isSpinning ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider shadow-lg animate-pulse">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    Roulette Rolling...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                    <Sparkles className="w-3 h-3" />
                    Match Found!
                  </span>
                )}
              </div>

              {/* Rating Pill */}
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/70 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full text-xs font-bold text-amber-300">
                <Star className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>{currentAnime.rating?.toFixed(1) || '8.5'}</span>
              </div>

              {/* Bottom Card Preview on Poster */}
              <div className="absolute bottom-3 left-3 right-3">
                <h4 className="font-heading font-black text-xl text-white drop-shadow-md truncate">
                  {currentAnime.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-neutral-300 mt-1">
                  <span>{currentAnime.type || 'TV Series'}</span>
                  <span>•</span>
                  <span>{currentAnime.releaseYear || '2024'}</span>
                  {currentAnime.studio && (
                    <>
                      <span>•</span>
                      <span className="text-purple-300 font-medium truncate">{currentAnime.studio}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Content Bar */}
            <div className="p-4 bg-[#141b2c] space-y-3">
              {/* Regional Dub Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-neutral-400 mr-1">
                  Dubbed in:
                </span>
                {(currentAnime.dubs || []).map((dub) => {
                  const badge = DUB_BADGE_STYLES[dub];
                  return (
                    <span
                      key={dub}
                      className={`${badge?.bg || 'bg-neutral-800'} ${badge?.text || 'text-white'} text-[10px] font-extrabold px-2 py-0.5 rounded shadow-sm`}
                    >
                      {dub}
                    </span>
                  );
                })}
              </div>

              {/* Synopsis */}
              <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                {currentAnime.synopsis}
              </p>

              {/* Platforms */}
              {currentAnime.platforms && currentAnime.platforms.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <Tv className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Stream legally on:</span>
                  <strong className="text-white font-semibold">
                    {currentAnime.platforms.map((p) => p.name).join(', ')}
                  </strong>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
          {/* Spin Again CTA */}
          <button
            onClick={startSpin}
            disabled={isSpinning}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1c2438] hover:bg-[#25304a] active:scale-95 text-amber-300 border border-amber-500/30 hover:border-amber-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
            <span>Spin Again 🎲</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2 justify-end">
            {/* Add to Watchlist */}
            <button
              onClick={() => {
                onToggleWatchlist(currentAnime);
              }}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                isBookmarked
                  ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                  : 'bg-[#182033] border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current text-purple-400' : ''}`} />
              <span>{isBookmarked ? 'Saved' : 'Save'}</span>
            </button>

            {/* View Details */}
            <button
              onClick={() => {
                onSelectAnime(currentAnime);
                onClose();
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>View Anime Details</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
