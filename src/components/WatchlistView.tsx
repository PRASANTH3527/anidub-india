import React from 'react';
import { Bookmark, Trash2, ExternalLink, Sparkles } from 'lucide-react';
import { Anime } from '../types/anime';
import { AnimeCard } from './AnimeCard';

interface WatchlistViewProps {
  watchlist: Anime[];
  onToggleBookmark: (anime: Anime) => void;
  onSelectAnime: (anime: Anime) => void;
  onClearWatchlist: () => void;
  onBackToLibrary: () => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  onToggleBookmark,
  onSelectAnime,
  onClearWatchlist,
  onBackToLibrary,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-purple-400 fill-current" />
            <h2 className="font-heading font-black text-2xl text-white">
              My Watchlist
            </h2>
            <span className="bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold px-2 py-0.5 rounded-full">
              {watchlist.length} saved
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Track all the anime you plan to watch dubbed in your native language.
          </p>
        </div>

        {watchlist.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onClearWatchlist}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950/40 text-neutral-300 hover:text-rose-300 border border-neutral-700 hover:border-rose-700/50 text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Watchlist</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid or Empty State */}
      {watchlist.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {watchlist.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              isBookmarked={true}
              onToggleBookmark={onToggleBookmark}
              onSelect={onSelectAnime}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-purple-950/40 border border-purple-800/40 flex items-center justify-center mx-auto text-purple-400">
            <Bookmark className="w-8 h-8 opacity-60" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              Your Watchlist is empty
            </h3>
            <p className="text-xs text-neutral-400">
              Browse the Dub Library and click the bookmark icon on any anime poster to save it here for quick access.
            </p>
          </div>
          <button
            onClick={onBackToLibrary}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 cursor-pointer transition-all"
          >
            Explore Dub Library
          </button>
        </div>
      )}
    </div>
  );
};
