import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Bookmark, Compass, Search, X, Sparkles, ArrowRight, Download, Plus, Scale } from 'lucide-react';
import { Anime } from './CatalogView';
import { AnimeCard } from './AnimeCard';
import { AniDubLogo } from './AniDubLogo';
import { useToast } from './Toast';
import {
  LIBRARY_STATUSES,
  LIBRARY_STATUS_EVENT,
  buildWatchlistCsv,
  downloadCsvFile,
  readLibraryStatusMap,
  resolveEffectiveLibraryStatus,
  setAnimeLibraryStatus,
  type LibraryStatus,
} from '../utils/libraryStatus';
import { getAllWatchProgress } from '../utils/watchProgress';
import { ACCOUNT_CHANGED_EVENT } from '../utils/accountIsolation';

interface WatchlistViewProps {
  watchlist: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onToggleWatchlist: (animeId: number) => void;
  onNavigateToCatalog: () => void;
  onOpenCreateCollection?: () => void;
  onOpenCompare?: () => void;
  isSignedIn?: boolean;
  userId?: string | null;
}

type StatusTabId = 'all' | LibraryStatus;

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  onSelectAnime,
  onToggleWatchlist,
  onNavigateToCatalog,
  onOpenCreateCollection,
  onOpenCompare,
  isSignedIn = false,
  userId = null,
}) => {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTabId>('all');
  const [statusMap, setStatusMap] = useState<Record<number, LibraryStatus>>(() =>
    readLibraryStatusMap(userId)
  );
  const [progressMap, setProgressMap] = useState(() => getAllWatchProgress(undefined, userId));

  // Re-hydrate scoped library statuses & progress when signed-in account changes
  useEffect(() => {
    const syncState = () => {
      setStatusMap(readLibraryStatusMap(userId));
      setProgressMap(getAllWatchProgress(undefined, userId));
    };
    syncState();
    window.addEventListener(LIBRARY_STATUS_EVENT, syncState);
    window.addEventListener(ACCOUNT_CHANGED_EVENT, syncState);
    return () => {
      window.removeEventListener(LIBRARY_STATUS_EVENT, syncState);
      window.removeEventListener(ACCOUNT_CHANGED_EVENT, syncState);
    };
  }, [userId]);

  const enrichedItems = useMemo(() => {
    return watchlist.map((anime) => {
      const idNum = Number(anime.id);
      const progress = progressMap[idNum] || null;
      const effectiveStatus = resolveEffectiveLibraryStatus(idNum, statusMap, progress);
      return { anime, progress, effectiveStatus };
    });
  }, [watchlist, statusMap, progressMap]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusTabId, number> = {
      all: enrichedItems.length,
      watching: 0,
      completed: 0,
      plan_to_watch: 0,
      on_hold: 0,
      dropped: 0,
      rewatching: 0,
    };
    for (const entry of enrichedItems) {
      counts[entry.effectiveStatus] = (counts[entry.effectiveStatus] || 0) + 1;
    }
    return counts;
  }, [enrichedItems]);

  const filteredWatchlist = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return enrichedItems.filter(({ anime, effectiveStatus }) => {
      if (activeStatusTab !== 'all' && effectiveStatus !== activeStatusTab) {
        return false;
      }
      if (!query) return true;
      const matchesTitle = anime.title.toLowerCase().includes(query);
      const matchesLang = Boolean(anime.languages && anime.languages.toLowerCase().includes(query));
      const matchesGenre = Boolean(anime.genres && anime.genres.toLowerCase().includes(query));
      return matchesTitle || matchesLang || matchesGenre;
    });
  }, [enrichedItems, activeStatusTab, searchQuery]);

  const handleStatusChange = (animeId: number, nextStatus: LibraryStatus) => {
    const updated = setAnimeLibraryStatus(animeId, nextStatus, userId);
    setStatusMap(updated);
  };

  const handleExportCsv = () => {
    if (watchlist.length === 0) {
      toast?.info?.('Watchlist Empty', 'Save at least one anime before exporting CSV.');
      return;
    }
    const csv = buildWatchlistCsv(watchlist, statusMap, progressMap);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const ok = downloadCsvFile(`anidub-india-watchlist-${dateStamp}.csv`, csv);
    if (ok) {
      toast?.success?.('CSV Exported', `Exported ${watchlist.length} anime from your library.`);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      {/* HEADER BANNER */}
      <div className="bg-[#121829] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AniDubLogo variant="horizontal" size="sm" className="shrink-0 drop-shadow-md" />
            <div>
              <div className="flex items-center flex-wrap gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  My Library
                </h1>
                <span className="bg-[#241848] border border-[#4c2f8c] text-[#d8b4fe] text-[11px] font-bold px-2.5 py-0.5 rounded-full tabular-nums">
                  {watchlist.length} saved
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
                {isSignedIn
                  ? 'Synced with your signed-in account. Organize anime by status, track progress, or export as CSV.'
                  : 'Stored locally in your browser. Organize anime by watch status, export as CSV, or sign in to sync across devices.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={watchlist.length === 0}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-45 border border-emerald-500/35 text-emerald-200 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Export Watchlist (CSV)</span>
            </button>

            {onOpenCreateCollection && (
              <button
                type="button"
                onClick={onOpenCreateCollection}
                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/35 text-purple-200 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Create Collection</span>
              </button>
            )}

            {onOpenCompare && (
              <button
                type="button"
                onClick={onOpenCompare}
                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Scale className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Compare</span>
              </button>
            )}
          </div>
        </div>

        {/* STATUS TABS + SEARCH ROW */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div
            role="tablist"
            aria-label="Library status filter"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeStatusTab === 'all'}
              onClick={() => setActiveStatusTab('all')}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer border ${
                activeStatusTab === 'all'
                  ? 'bg-purple-600 text-white border-purple-400/60'
                  : 'bg-[#0b0f17] text-neutral-300 border-white/10 hover:text-white'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] opacity-80 tabular-nums">{statusCounts.all}</span>
            </button>

            {LIBRARY_STATUSES.map((status) => {
              const isActive = activeStatusTab === status.id;
              return (
                <button
                  key={status.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveStatusTab(status.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer border ${
                    isActive
                      ? 'bg-purple-600 text-white border-purple-400/60'
                      : 'bg-[#0b0f17] text-neutral-300 border-white/10 hover:text-white'
                  }`}
                >
                  <span>{status.label}</span>
                  <span className="text-[10px] opacity-80 tabular-nums">
                    {statusCounts[status.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {watchlist.length > 0 && (
            <div className="w-full lg:w-64 relative shrink-0">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved titles..."
                aria-label="Search saved titles"
                className="w-full bg-[#0b0f17] border border-white/10 focus:border-purple-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear saved search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WATCHLIST CONTENT / EMPTY STATE */}
      {watchlist.length === 0 ? (
        <div className="text-center py-16 bg-[#121829]/60 border border-neutral-800 rounded-3xl p-8 max-w-lg mx-auto shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#240f3a] border border-[#581c87] flex items-center justify-center mx-auto text-[#c084fc] shadow-lg">
            <Bookmark className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white">Your Library is Empty</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Bookmark any anime in the directory to track it across Watching, Completed, Plan to Watch, On Hold, Dropped, or Rewatching.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl inline-flex items-center gap-2 shadow-lg text-white font-bold text-xs tracking-wide cursor-pointer transition-colors"
            >
              <Compass className="w-4 h-4" />
              <span>Browse Dub Directory</span>
            </button>
          </div>
        </div>
      ) : filteredWatchlist.length === 0 ? (
        <div className="text-center py-14 bg-[#121829]/40 border border-neutral-800 rounded-3xl p-8 max-w-md mx-auto space-y-3">
          <Search className="w-8 h-8 text-neutral-500 mx-auto" />
          <h4 className="text-base font-bold text-white">No anime in this filter</h4>
          <p className="text-xs text-neutral-400">
            {searchQuery
              ? `No saved titles match "${searchQuery}" in this status tab.`
              : 'Move any saved anime into this tab using the status dropdown under its card.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-purple-300 hover:underline font-semibold cursor-pointer"
              >
                Clear Search
              </button>
            )}
            {activeStatusTab !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveStatusTab('all')}
                className="text-xs text-purple-300 hover:underline font-semibold cursor-pointer"
              >
                Show All Saved ({watchlist.length})
              </button>
            )}
          </div>
        </div>
      ) : (
        <motion.div
          key={`watchlist_grid_${activeStatusTab}_${filteredWatchlist.length}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4"
        >
          {filteredWatchlist.map(({ anime, effectiveStatus, progress }, idx) => (
            <div key={`watchlist_anime_${anime.id}_${idx}`} className="flex flex-col gap-1.5">
              <div className="flex-1">
                <AnimeCard
                  anime={anime}
                  index={idx}
                  onSelect={(a) => onSelectAnime(a as any)}
                  isBookmarked={true}
                  onToggleBookmark={onToggleWatchlist}
                />
              </div>

              {/* Per-Card Library Status Switcher */}
              <div className="rounded-xl bg-[#111624] border border-white/10 px-2 py-1.5 flex items-center justify-between gap-1.5">
                <select
                  aria-label={`Library status for ${anime.title}`}
                  value={effectiveStatus}
                  onChange={(e) => handleStatusChange(Number(anime.id), e.target.value as LibraryStatus)}
                  className="w-full bg-transparent text-[11px] font-bold text-neutral-200 outline-none cursor-pointer"
                >
                  {LIBRARY_STATUSES.map((st) => (
                    <option key={st.id} value={st.id} className="bg-[#111624] text-white">
                      {st.label}
                    </option>
                  ))}
                </select>
                {progress && progress.episode > 0 && (
                  <span className="text-[10px] font-semibold text-neutral-400 shrink-0 tabular-nums">
                    S{progress.season}E{progress.episode}
                  </span>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* FOOTER CALL-TO-ACTION */}
      <div className="border-t border-neutral-800/80 pt-8 mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Looking for more official Indian dubs?</span>
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Browse verified Tamil, Hindi, Telugu, Malayalam, and Kannada dubbed anime on legal OTTs.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToCatalog}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-300 hover:text-white transition-colors cursor-pointer"
        >
          <span>Explore All Indian Dubs</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
