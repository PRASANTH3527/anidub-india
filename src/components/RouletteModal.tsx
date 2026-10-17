import React, { useState, useEffect } from 'react';
import { X, Dices, Play, Star, Sparkles, RefreshCw, Languages, Tv } from 'lucide-react';
import { Anime } from './CatalogView';

interface RouletteModalProps {
  animeList: Anime[];
  onClose: () => void;
  onSelectAnime: (anime: Anime) => void;
}

export const RouletteModal: React.FC<RouletteModalProps> = ({
  animeList,
  onClose,
  onSelectAnime
}) => {
  const [spinning, setSpinning] = useState(true);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);

  const rollRoulette = () => {
    if (!animeList.length) return;
    setSpinning(true);
    let counter = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * animeList.length);
      setSelectedAnime(animeList[randomIndex]);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        setSpinning(false);
      }
    }, 100);
  };

  useEffect(() => {
    rollRoulette();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-orange-500/40 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 text-center">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Dices className="w-4 h-4 animate-spin" />
          <span>Surprise Me Roulette • Indian Anime Dubs</span>
        </div>

        <h2 className="text-2xl font-extrabold text-white font-['Space_Grotesk',sans-serif] mb-2">
          {spinning ? 'Spinning the Wheel...' : "Here's Your Destined Anime!"}
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Randomly picked from our Cloudflare D1 Indian Dubbed Catalog with Hindi, Tamil & Telugu audio tracks.
        </p>

        {selectedAnime && (
          <div className="space-y-6">
            <div className={`relative aspect-[16/10] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl transition-all duration-300 ${spinning ? 'scale-95 blur-xs' : 'scale-100 ring-2 ring-orange-500/50'}`}>
              <img
                src={selectedAnime.banner_image || selectedAnime.cover_image}
                alt={selectedAnime.title}
                onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80"; }}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

              <div className="absolute bottom-3 left-4 right-4 text-left">
                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="px-2 py-0.5 rounded bg-orange-600/90 text-white font-bold text-[10px]">HIN</span>
                  <span className="px-2 py-0.5 rounded bg-purple-600/90 text-white font-bold text-[10px]">TAM</span>
                  <span className="px-2 py-0.5 rounded bg-teal-600/90 text-white font-bold text-[10px]">TEL</span>
                  <span className="flex items-center text-amber-400 font-bold text-xs ml-2">
                    <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                    {selectedAnime.rating}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] line-clamp-1">
                  {selectedAnime.title}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 line-clamp-2 text-left bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              {selectedAnime.synopsis}
            </p>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={rollRoulette}
                disabled={spinning}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} />
                <span>Spin Again</span>
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => { onSelectAnime(selectedAnime); onClose(); }}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/30 transition-all hover:scale-105"
                >
                  View Anime Details
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
