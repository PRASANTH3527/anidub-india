import React, { useState, useEffect } from 'react';
import { X, Dices, Play, Star, Sparkles, RefreshCw, Bookmark, Tv } from 'lucide-react';
import { Anime } from './CatalogView';

export interface RouletteModalProps {
  animeList: Anime[];
  onClose: () => void;
  onSelectAnime: (anime: Anime) => void;
  watchlist?: number[];
  onToggleWatchlist?: (animeId: number) => void;
}

export const RouletteModal: React.FC<RouletteModalProps> = ({
  animeList,
  onClose,
  onSelectAnime,
  watchlist = [],
  onToggleWatchlist
}) => {
  const [isSpinning, setIsSpinning] = useState(true);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);

  const rollRoulette = () => {
    if (!animeList.length) return;
    setIsSpinning(true);
    let counter = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * animeList.length);
      setSelectedAnime(animeList[randomIndex]);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 100);
  };

  useEffect(() => {
    rollRoulette();
  }, [animeList]);

  const isSaved = selectedAnime ? watchlist.includes(selectedAnime.id) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      
      {/* MODAL CONTAINER */}
      <div className="relative w-full max-w-lg bg-[#121829] border border-primary-theme/40 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-neutral-100">
        
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-md"
        >
          <X className="w-4 h-4" />
        </button>

        {/* TOP BADGE */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full badge-primary-theme text-xs font-semibold shadow-sm mb-2">
            <Dices className={`w-3.5 h-3.5 text-accent-theme ${isSpinning ? 'animate-spin' : ''}`} />
            <span>Surprise Me Roulette</span>
          </div>

          <h2 className="font-heading font-black text-xl sm:text-2xl text-white tracking-tight">
            {isSpinning ? 'Spinning Wheel...' : "Your Destined Regional Dub!"}
          </h2>
          <p className="text-neutral-400 text-xs mt-1">
            Randomly picked from verified Indian OTT anime releases.
          </p>
        </div>

        {selectedAnime && (
          <div className="space-y-4">
            
            {/* ROULETTE SCREEN CONTAINER */}
            <div className={`relative overflow-hidden rounded-2xl bg-neutral-900 border transition-all duration-300 ${
              isSpinning 
                ? 'border-amber-500 shadow-xl shadow-amber-500/20 scale-[0.99] ring-2 ring-amber-400/40' 
                : 'border-primary-theme/50 shadow-2xl shadow-primary-theme/30'
            }`}>
              
              {/* POSTER AREA */}
              <div className="relative h-60 sm:h-72 w-full overflow-hidden bg-neutral-950">
                <img
                  src={selectedAnime.banner_image || selectedAnime.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                  alt={selectedAnime.title}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                  }}
                  className={`w-full h-full object-cover transition-transform duration-500 ${isSpinning ? 'scale-110 blur-[1px]' : 'scale-100'}`}
                />

                {/* GRADIENT OVERLAY */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#121829] via-[#121829]/50 to-transparent" />

                {/* TOP RATING & PLATFORM */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1 shadow-md">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{selectedAnime.rating ? selectedAnime.rating.toFixed(1) : '8.9'}</span>
                  </span>

                  <span className="px-2.5 py-1 rounded-lg bg-neutral-900/90 backdrop-blur-md text-neutral-200 text-xs font-bold border border-neutral-700 shadow-md">
                    {selectedAnime.platform || 'Crunchyroll'}
                  </span>
                </div>

                {/* TITLE OVERLAY */}
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="font-heading font-black text-lg sm:text-xl text-white tracking-tight drop-shadow-md line-clamp-1">
                    {selectedAnime.title}
                  </h3>
                  <p className="text-xs text-neutral-300 line-clamp-1 mt-0.5">
                    {selectedAnime.genres || 'Action, Fantasy, Shonen'}
                  </p>
                </div>
              </div>

              {/* BOTTOM CONTENT BAR */}
              <div className="p-4 bg-[#141b2c] space-y-3">
                
                {/* DUBBED IN BADGES */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 mr-1">Dubbed In:</span>
                  {(selectedAnime.languages ? selectedAnime.languages.split(/[,/ ]+/) : ['HIN', 'TAM', 'TEL']).map((lang, idx) => (
                    <span
                      key={`roulette_lang_${selectedAnime.id}_${lang.trim()}_${idx}`}
                      className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-primary-theme/20 border border-primary-theme/40 text-purple-300"
                    >
                      {lang.trim()}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                  {selectedAnime.synopsis || 'Experience the thrilling regional voice acting on official OTT streaming services across India.'}
                </p>

              </div>

            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-between gap-3 pt-2">
              
              {/* SPIN AGAIN */}
              <button
                type="button"
                onClick={rollRoulette}
                disabled={isSpinning}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c2438] hover:bg-[#252f4a] text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>Spin Again</span>
              </button>

              <div className="flex items-center gap-2">
                {/* SAVE / BOOKMARK */}
                {onToggleWatchlist && (
                  <button
                    type="button"
                    onClick={() => onToggleWatchlist(selectedAnime.id)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                      isSaved
                        ? 'bg-primary-theme text-white shadow-md'
                        : 'bg-[#1c2438] hover:bg-[#252f4a] text-neutral-300 border border-neutral-700'
                    }`}
                    title={isSaved ? 'In Watchlist' : 'Add to Watchlist'}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                )}

                {/* VIEW DETAILS */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectAnime(selectedAnime);
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-theme to-[var(--primary-accent)] hover:opacity-95 text-white text-xs font-extrabold shadow-lg shadow-primary-theme/30 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
                >
                  <span>View Anime Details</span>
                  <Play className="w-3 h-3 fill-current" />
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
