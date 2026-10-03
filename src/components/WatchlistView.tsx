'use client';

import React, { useState, useMemo } from 'react';
import { Bookmark, Sparkles, Trash2, Search, Compass, Heart, Film, DownloadCloud, CheckCircle2 } from 'lucide-react';
import { Anime } from '../types/anime';
import { AnimeCard } from './AnimeCard';
import { posterCacheService } from '../services/posterCacheService';
import { useToast } from './Toast';

interface WatchlistViewProps {
  watchlistIds: string[];
  allAnime: Anime[];
  trendingAnimeIds?: string[];
  onToggleWatchlist: (anime: Anime) => void;
  onSelectAnime: (anime: Anime) => void;
  onClearWatchlist: () => void;
  onBrowseLibrary: () => void;
  onReport?: (anime: Anime) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlistIds,
  allAnime,
  trendingAnimeIds = [],
  onToggleWatchlist,
  onSelectAnime,
  onClearWatchlist,
  onBrowseLibrary,
  onReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCachingAll, setIsCachingAll] = useState(false);
  const toast = useToast();

  // Find all approved anime matching the watchlist IDs
  const bookmarkedAnime = useMemo(() => {
    return allAnime.filter((anime) => watchlistIds.includes(anime.id));
  }, [allAnime, watchlistIds]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return bookmarkedAnime;
    const q = searchQuery.toLowerCase().trim();
    return bookmarkedAnime.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.dubs || []).some((d) => d.toLowerCase().includes(q)) ||
        (a.genres || []).some((g) => g.toLowerCase().includes(q))
    );
  }, [bookmarkedAnime, searchQuery]);

  const handleCacheAllPosters = async () => {
    if (bookmarkedAnime.length === 0 || isCachingAll) return;
    setIsCachingAll(true);
    toast.info('Caching Watchlist Posters...', `Downloading posters for ${bookmarkedAnime.length} anime so you can view offline.`);

    const urls = bookmarkedAnime
      .map((a) => a.imageUrl || a.poster)
      .filter(Boolean) as string[];

    const result = await posterCacheService.cacheMultiplePosters(urls);
    setIsCachingAll(false);

    toast.success(
      'Watchlist Cached Offline! 💾',
      `Successfully stored ${result.success} anime poster(s) in local PWA cache.`
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-[#121829] border border-purple-500/30 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/40">
            <Bookmark className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-black text-xl sm:text-2xl text-white tracking-tight">
                My Personal Watchlist
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {bookmarkedAnime.length} {bookmarkedAnime.length === 1 ? 'saved' : 'saved'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Saved locally in your browser. Access your favorite regional dubs instantly without logging in.
            </p>
          </div>
        </div>

        {/* Actions */}
        {bookmarkedAnime.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCacheAllPosters}
              disabled={isCachingAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <DownloadCloud className={`w-3.5 h-3.5 ${isCachingAll ? 'animate-bounce text-purple-400' : ''}`} />
              <span>{isCachingAll ? 'Saving Offline...' : 'Save All Posters Offline'}</span>
            </button>
            <button
              onClick={onClearWatchlist}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 active:scale-95 text-rose-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Watchlist</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Filter if has items */}
      {bookmarkedAnime.length > 3 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within your saved watchlist..."
            className="w-full bg-[#121829] border border-neutral-800 focus:border-purple-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
          />
        </div>
      )}

      {/* Grid of Saved Anime */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {filteredItems.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              isBookmarked={true}
              isTrending={trendingAnimeIds.includes(anime.id)}
              onToggleBookmark={onToggleWatchlist}
              onSelect={onSelectAnime}
              onReport={onReport}
            />
          ))}
        </div>
      ) : bookmarkedAnime.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 bg-[#121829]/60 border border-neutral-800 rounded-3xl p-8 max-w-lg mx-auto shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center mx-auto text-purple-400 shadow-xl">
            <Bookmark className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-heading font-black text-xl text-white">
              Your Watchlist is Empty
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Explore the dubbed directory and tap the bookmark or heart icon on any anime card to save it here for fast offline access.
            </p>
          </div>
          <button
            onClick={onBrowseLibrary}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Browse Dub Directory</span>
          </button>
        </div>
      ) : (
        /* No Search Match in Watchlist */
        <div className="text-center py-12 bg-[#121829]/40 border border-neutral-800 rounded-2xl p-6 max-w-md mx-auto">
          <Search className="w-6 h-6 text-neutral-500 mx-auto mb-2" />
          <p className="text-xs text-neutral-400">
            No saved anime matches &quot;{searchQuery}&quot;
          </p>
        </div>
      )}

    </div>
  );
};
