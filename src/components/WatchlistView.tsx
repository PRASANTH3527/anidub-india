import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Bookmark, Compass, Search, X, Sparkles, ArrowRight, Download, Plus, Scale } from 'lucide-react';
import { Anime } from './CatalogView';
import { AnimeCard } from './AnimeCard';
import { AniDubLogo } from './AniDubLogo';
import { useToast } from './Toast';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EclipseState';
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
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-200">
      {/* HEADER BANNER */}
      <div className="bg-[#12141E] border border-[#292B39] rounded-2xl p-5 sm:p-7 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AniDubLogo variant="horizontal" size="sm" className="shrink-0" />
            <div>
              <div className="flex items-center flex-wrap gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-[#F4F3FA] tracking-tight">
                  My Library
                </h1>
                <span className="bg-[#191C29] border border-[#292B39] text-[#B49AF8] text-[11px] font-bold px-2.5 py-0.5 rounded-full tabular-nums">
                  {watchlist.length} saved
                </span>
              </div>
              <p className="text-xs text-[#A1A5B5] mt-1 max-w-xl leading-relaxed">
                {isSignedIn
                  ? 'Synced with your signed-in account. Organize anime by status, track progress, or export as CSV.'
                  : 'Stored locally in your browser. Organize anime by watch status, export as CSV, or sign in to sync across devices.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              disabled={watchlist.length === 0}
              leftIcon={<Download className="w-3.5 h-3.5 text-[#34D399]" />}
              className="text-xs font-bold"
            >
              Export Watchlist (CSV)
            </Button>

            {onOpenCreateCollection && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenCreateCollection}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs font-bold"
              >
                Create Collection
              </Button>
            )}

            {onOpenCompare && (
              <Button
                type="button"
                variant="elevated"
                size="sm"
                onClick={onOpenCompare}
                leftIcon={<Scale className="w-3.5 h-3.5 text-[#B49AF8]" />}
                className="text-xs font-semibold"
              >
                Compare
              </Button>
            )}
          </div>
        </div>

        {/* STATUS TABS + SEARCH ROW */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 border-t border-[#292B39]">
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
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors duration-150 cursor-pointer border ${
                activeStatusTab === 'all'
                  ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                  : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] opacity-85 tabular-nums">{statusCounts.all}</span>
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
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors duration-150 cursor-pointer border ${
                    isActive
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                      : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                  }`}
                >
                  <span>{status.label}</span>
                  <span className="text-[10px] opacity-85 tabular-nums">
                    {statusCounts[status.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {watchlist.length > 0 && (
            <div className="w-full lg:w-64 relative shrink-0">
              <Search className="w-4 h-4 text-[#A1A5B5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved titles..."
                aria-label="Search saved titles"
                className="w-full min-h-[40px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-xl pl-9 pr-8 py-2 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-150"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear saved search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1A5B5] hover:text-[#F4F3FA] cursor-pointer"
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
        <EmptyState
          icon={<Bookmark className="w-6 h-6" />}
          title="Your Library is Empty"
          description="Bookmark any anime in the directory to track it across Watching, Completed, Plan to Watch, On Hold, Dropped, or Rewatching."
          actionLabel="Browse Dub Directory"
          onAction={onNavigateToCatalog}
        />
      ) : filteredWatchlist.length === 0 ? (
        <div className="text-center py-12 bg-[#12141E] border border-[#292B39] rounded-2xl p-8 max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#191C29] border border-[#292B39] flex items-center justify-center mx-auto text-[#A1A5B5]">
            <Search className="w-5 h-5" />
          </div>
          <h4 className="text-base font-bold text-[#F4F3FA]">No anime in this filter</h4>
          <p className="text-xs text-[#A1A5B5]">
            {searchQuery
              ? `No saved titles match "${searchQuery}" in this status tab.`
              : 'Move any saved anime into this tab using the status dropdown under its card.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            {searchQuery && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-xs"
              >
                Clear Search
              </Button>
            )}
            {activeStatusTab !== 'all' && (
              <Button
                type="button"
                variant="elevated"
                size="sm"
                onClick={() => setActiveStatusTab('all')}
                className="text-xs"
              >
                Show All Saved ({watchlist.length})
              </Button>
            )}
          </div>
        </div>
      ) : (
        <motion.div
          key={`watchlist_grid_${activeStatusTab}_${filteredWatchlist.length}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
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
              <div className="rounded-xl bg-[#12141E] border border-[#292B39] px-2.5 py-2 flex items-center justify-between gap-1.5">
                <select
                  aria-label={`Library status for ${anime.title}`}
                  value={effectiveStatus}
                  onChange={(e) => handleStatusChange(Number(anime.id), e.target.value as LibraryStatus)}
                  className="w-full bg-transparent text-[11px] font-bold text-[#F4F3FA] outline-none cursor-pointer"
                >
                  {LIBRARY_STATUSES.map((st) => (
                    <option key={st.id} value={st.id} className="bg-[#12141E] text-[#F4F3FA]">
                      {st.label}
                    </option>
                  ))}
                </select>
                {progress && progress.episode > 0 && (
                  <span className="text-[10px] font-semibold text-[#A1A5B5] shrink-0 tabular-nums">
                    S{progress.season}E{progress.episode}
                  </span>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* FOOTER CALL-TO-ACTION */}
      <div className="border-t border-[#292B39] pt-8 mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <h4 className="text-sm font-bold text-[#F4F3FA] flex items-center justify-center sm:justify-start gap-1.5">
            <Sparkles className="w-4 h-4 text-[#F9C876]" />
            <span>Looking for more official Indian dubs?</span>
          </h4>
          <p className="text-xs text-[#A1A5B5] mt-0.5">
            Browse verified Tamil, Hindi, Telugu, Malayalam, and Kannada dubbed anime on legal OTTs.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToCatalog}
          className="min-h-[40px] px-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#B49AF8] hover:text-[#CBB6FF] transition-colors duration-150 cursor-pointer"
        >
          <span>Explore All Indian Dubs</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
