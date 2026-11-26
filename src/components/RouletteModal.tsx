import React, { useState, useEffect } from 'react';
import { X, Dices, Play, Star, RefreshCw, Bookmark } from 'lucide-react';
import { Anime } from './CatalogView';
import { Button } from './ui/Button';

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
  onToggleWatchlist,
}) => {
  const [isSpinning, setIsSpinning] = useState(true);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRolledRef = React.useRef(false);

  const rollRoulette = () => {
    if (!animeList.length) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsSpinning(true);
    let counter = 0;
    intervalRef.current = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * animeList.length);
      setSelectedAnime(animeList[randomIndex]);
      counter++;
      if (counter > 15) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsSpinning(false);
      }
    }, 100);
  };

  useEffect(() => {
    if (!hasRolledRef.current && animeList.length > 0) {
      hasRolledRef.current = true;
      rollRoulette();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [animeList.length]);

  const isSaved = selectedAnime ? watchlist.includes(selectedAnime.id) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0A10]/85 backdrop-blur-sm animate-in fade-in duration-150 font-sans">
      {/* MODAL CONTAINER */}
      <div className="relative w-full max-w-lg bg-[#12141E] border border-[#292B39] rounded-2xl p-5 sm:p-6 shadow-2xl z-10 text-[#F4F3FA]">
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          aria-label="Close Surprise Me Roulette"
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-xl bg-[#191C29] hover:bg-[#292B39] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-150 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* TOP BADGE */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#191C29] border border-[#292B39] text-[#B49AF8] text-xs font-semibold mb-2">
            <Dices className={`w-3.5 h-3.5 text-[#B49AF8] ${isSpinning ? 'animate-spin' : ''}`} />
            <span>Surprise Me Roulette</span>
          </div>

          <h2 className="font-heading font-black text-xl sm:text-2xl text-[#F4F3FA] tracking-tight">
            {isSpinning ? 'Spinning Wheel...' : 'Your Destined Regional Dub!'}
          </h2>
          <p className="text-[#A1A5B5] text-xs mt-1">
            Randomly picked from verified Indian OTT anime releases.
          </p>
        </div>

        {selectedAnime && (
          <div className="space-y-4">
            {/* ROULETTE SCREEN CONTAINER */}
            <div
              className={`relative overflow-hidden rounded-2xl bg-[#191C29] border transition-colors duration-150 ${
                isSpinning
                  ? 'border-[#F9C876]'
                  : 'border-[#B49AF8]/60'
              }`}
            >
              {/* POSTER AREA */}
              <div className="relative h-60 sm:h-72 w-full overflow-hidden bg-[#0B0A10]">
                <img
                  src={selectedAnime.banner_image || selectedAnime.cover_image || '/logo.png'}
                  alt={selectedAnime.title}
                  width={512}
                  height={288}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = '/logo.png';
                  }}
                  className={`w-full h-full object-cover transition-transform duration-300 ${isSpinning ? 'scale-105' : 'scale-100'}`}
                />

                {/* GRADIENT OVERLAY */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#12141E] via-[#12141E]/50 to-transparent" />

                {/* TOP RATING & PLATFORM */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-[#0B0A10]/85 text-[#F9C876] text-xs font-bold border border-[#292B39] flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-[#F9C876] text-[#F9C876]" />
                    <span>{selectedAnime.rating ? selectedAnime.rating.toFixed(1) : '8.9'}</span>
                  </span>

                  <span className="px-2.5 py-1 rounded-lg bg-[#0B0A10]/85 text-[#F4F3FA] text-xs font-bold border border-[#292B39]">
                    {selectedAnime.platform || 'Not verified'}
                  </span>
                </div>

                {/* TITLE OVERLAY */}
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="font-heading font-black text-lg sm:text-xl text-[#F4F3FA] tracking-tight line-clamp-1">
                    {selectedAnime.title}
                  </h3>
                  <p className="text-xs text-[#A1A5B5] line-clamp-1 mt-0.5">
                    {selectedAnime.genres || 'Action, Fantasy, Shonen'}
                  </p>
                </div>
              </div>

              {/* BOTTOM CONTENT BAR */}
              <div className="p-4 bg-[#191C29] space-y-3 border-t border-[#292B39]">
                {/* DUBBED IN BADGES */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-[#A1A5B5] mr-1">Dubbed In:</span>
                  {(selectedAnime.languages ? selectedAnime.languages.split(/[,/ ]+/) : ['HIN', 'TAM', 'TEL']).map((lang, idx) => (
                    <span
                      key={`roulette_lang_${selectedAnime.id}_${lang.trim()}_${idx}`}
                      className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-[#12141E] border border-[#292B39] text-[#B49AF8]"
                    >
                      {lang.trim()}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-[#A1A5B5] line-clamp-2 leading-relaxed">
                  {selectedAnime.synopsis || 'Experience the thrilling regional voice acting on official OTT streaming services across India.'}
                </p>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={rollRoulette}
                disabled={isSpinning}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 text-[#F9C876] ${isSpinning ? 'animate-spin' : ''}`} />}
              >
                Spin Again
              </Button>

              <div className="flex items-center gap-2">
                {onToggleWatchlist && (
                  <button
                    type="button"
                    onClick={() => onToggleWatchlist(selectedAnime.id)}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-150 cursor-pointer border ${
                      isSaved
                        ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                        : 'bg-[#191C29] hover:bg-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                    }`}
                    title={isSaved ? 'In Watchlist' : 'Add to Watchlist'}
                    aria-label={isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                )}

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    onSelectAnime(selectedAnime);
                    onClose();
                  }}
                  rightIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                >
                  View Anime Details
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
