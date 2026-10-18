import React from 'react';
import { Bookmark, Sparkles, Compass } from 'lucide-react';
import { Anime } from './CatalogView';

interface WatchlistViewProps {
  watchlist: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onToggleWatchlist: (animeId: number) => void;
  onNavigateToCatalog: () => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  onSelectAnime,
  onToggleWatchlist,
  onNavigateToCatalog
}) => {
  return (
    <div className="w-full max-w-[510px] mx-auto py-6 font-['Inter',sans-serif] text-slate-100">
      
      {/* 2. TOP BANNER CARD */}
      <div className="mx-4 mt-5 p-5 rounded-3xl bg-gradient-to-r from-[#171432] to-[#111324] border border-[#2e2352] flex items-center gap-4 shadow-lg">
        <div className="w-11 h-14 rounded-full bg-gradient-to-b from-[#a855f7] to-[#7c3aed] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.55)]">
          <Bookmark className="w-5 h-5 text-white fill-white" />
        </div>
        <div>
          <div className="flex items-center flex-wrap gap-2.5">
            <h1 className="text-[19px] font-extrabold text-white tracking-tight">My Personal Watchlist</h1>
            <span className="bg-[#241848] border border-[#4c2f8c] text-[#d8b4fe] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              {watchlist.length} saved
            </span>
          </div>
          <p className="text-[12px] text-[#94a3b8] leading-relaxed mt-1.5">
            Saved locally in your browser. Access your favorite regional dubs instantly without logging in.
          </p>
        </div>
      </div>

      {/* 3. WATCHLIST CONTENT / EMPTY STATE */}
      {watchlist.length > 0 ? (
        <div className="grid grid-cols-2 gap-3.5 px-4 mt-4">
          {watchlist.map((anime) => (
            <div
              key={anime.id}
              onClick={() => onSelectAnime(anime)}
              className="group bg-[#0e1320] border border-[#1c2235] rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer hover:border-[#2d3748] transition-all shadow-lg"
            >
              {/* Card content matches CatalogView structure */}
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                <img
                  src={anime.cover_image}
                  alt={anime.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-3">
                <h3 className="font-bold text-white text-[15px] truncate">{anime.title}</h3>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-4 mt-4 py-14 px-6 rounded-3xl bg-[#0d101d] border border-[#1a2035] flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#240f3a] border border-[#581c87] flex items-center justify-center mb-5">
            <Bookmark className="w-[26px] h-[26px] text-[#c084fc]" />
          </div>
          <h3 className="text-[20px] font-extrabold text-white">Your Watchlist is Empty</h3>
          <p className="text-[12.5px] text-[#64748b] mt-2.5 max-w-xs leading-relaxed">
            Explore the dubbed directory and tap the bookmark or heart icon on any anime card to save it here for fast offline access.
          </p>
          <button
            onClick={onNavigateToCatalog}
            className="mt-7 bg-gradient-to-r from-[#9333ea] to-[#6366f1] hover:opacity-95 text-white font-bold text-[13px] px-6 py-3 rounded-full inline-flex items-center gap-2 shadow-[0_6px_25px_rgba(147,51,234,0.5)]"
          >
            <Compass className="w-4 h-4" />
            <span>Browse Dub Directory</span>
          </button>
        </div>
      )}

      {/* 4. BOTTOM CALL-TO-ACTION */}
      <div className="border-t border-[#161b2c] mt-12 pt-10 px-6 text-center">
        <h3 className="text-[20px] font-bold text-white font-['Space_Grotesk',sans-serif]">
          Know a missing dub?
        </h3>
        <p className="text-[13px] text-[#8b92a5] mt-2 max-w-sm mx-auto leading-relaxed">
          Help us build the ultimate Indian anime directory by contributing new titles or regional audio info.
        </p>
      </div>

    </div>
  );
};
