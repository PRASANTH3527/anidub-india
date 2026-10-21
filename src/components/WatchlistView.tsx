import React, { useState } from 'react';
import { Bookmark, Compass, Search, X, Sparkles, Film, ArrowRight } from 'lucide-react';
import { Anime } from './CatalogView';
import { AnimeCard } from './AnimeCard';

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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWatchlist = watchlist.filter((anime) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchesTitle = anime.title.toLowerCase().includes(query);
    const matchesLang = anime.languages && anime.languages.toLowerCase().includes(query);
    const matchesGenre = anime.genres && anime.genres.toLowerCase().includes(query);
    return matchesTitle || matchesLang || matchesGenre;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-[#121829] border border-primary-theme/30 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-theme flex items-center justify-center text-white shadow-lg shadow-primary-theme/30 ring-2 ring-accent-theme/40 shrink-0">
            <Bookmark className="w-6 h-6 fill-white" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                My Personal Watchlist
              </h1>
              <span className="bg-[#241848] border border-[#4c2f8c] text-[#d8b4fe] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {watchlist.length} {watchlist.length === 1 ? 'saved' : 'saved'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
              Saved locally in your browser. Access your favorite regional dubbed anime instantly without logging in.
            </p>
          </div>
        </div>

        {/* SEARCH BAR IN HEADER */}
        {watchlist.length > 0 && (
          <div className="w-full md:w-72 relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved titles..."
              className="w-full bg-[#121829] border border-neutral-800 focus:border-primary-theme rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* WATCHLIST CONTENT / EMPTY STATE */}
      {watchlist.length === 0 ? (
        <div className="text-center py-20 bg-[#121829]/60 border border-neutral-800 rounded-3xl p-8 max-w-lg mx-auto shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#240f3a] border border-[#581c87] flex items-center justify-center mx-auto text-[#c084fc] shadow-lg">
            <Bookmark className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white">Your Watchlist is Empty</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Explore the dubbed directory and tap the bookmark or heart icon on any anime card to save it here for fast offline access.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onNavigateToCatalog}
              className="btn-primary-theme px-6 py-3 rounded-full inline-flex items-center gap-2 shadow-lg text-white font-bold text-xs tracking-wide cursor-pointer hover:scale-105 transition-all"
            >
              <Compass className="w-4 h-4" />
              <span>Browse Dub Directory</span>
            </button>
          </div>
        </div>
      ) : filteredWatchlist.length === 0 ? (
        <div className="text-center py-16 bg-[#121829]/40 border border-neutral-800 rounded-3xl p-8 max-w-md mx-auto space-y-3">
          <Search className="w-8 h-8 text-neutral-500 mx-auto" />
          <h4 className="text-base font-bold text-white">No matches found</h4>
          <p className="text-xs text-neutral-400">
            No saved titles match "{searchQuery}". Try a different keyword or reset search.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-primary-theme hover:underline font-semibold"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {filteredWatchlist.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              onSelect={(a) => onSelectAnime(a as any)}
              isBookmarked={true}
              onToggleBookmark={onToggleWatchlist}
            />
          ))}
        </div>
      )}

      {/* FOOTER CALL-TO-ACTION */}
      <div className="border-t border-neutral-800/80 pt-8 mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Missing a regional dub?</span>
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Help expand India's verified anime catalog by submitting missing dubbed audio tracks.
          </p>
        </div>
        <button
          onClick={onNavigateToCatalog}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-theme hover:text-white transition-colors"
        >
          <span>Explore All Indian Dubs</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
