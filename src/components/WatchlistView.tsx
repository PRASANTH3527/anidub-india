import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Bookmark,
  Search,
  X,
  Download,
  Plus,
  Scale,
  MoreVertical,
  ExternalLink,
  Trash2,
  ArrowUpDown,
  LogIn,
  CheckCircle2,
} from 'lucide-react';
import { SignInButton } from '../lib/clerk';
import { Anime } from './CatalogView';
import { useToast } from './Toast';
import { Button } from './ui/Button';
import { ConfirmDialog, EmptyState } from './ui/EclipseState';
import { LibraryPageSkeleton } from './SkeletonGrid';
import {
  LIBRARY_STATUSES,
  LIBRARY_STATUS_EVENT,
  buildWatchlistCsv,
  downloadCsvFile,
  getLibraryStatusConfig,
  readLibraryStatusMap,
  resolveEffectiveLibraryStatus,
  setAnimeLibraryStatus,
  type LibraryStatus,
} from '../utils/libraryStatus';
import {
  getAllWatchProgress,
  saveAnimeWatchProgress,
  type WatchProgressEntry,
} from '../utils/watchProgress';
import { ACCOUNT_CHANGED_EVENT } from '../utils/accountIsolation';
import { extractCompactLanguageCodes } from '../utils/languages';
import { normalizeCanonicalOttList } from '../utils/ottHub';
import { cloudflareApi } from '../services/cloudflareApi';

export type LibrarySortOption = 'recent' | 'title' | 'rating';

interface WatchlistViewProps {
  watchlist: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onToggleWatchlist: (animeId: number) => void;
  onNavigateToCatalog: () => void;
  onOpenCreateCollection?: () => void;
  onOpenCompare?: () => void;
  isSignedIn?: boolean;
  userId?: string | null;
  isLoading?: boolean;
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
  isLoading = false,
}) => {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<LibrarySortOption>('recent');
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTabId>('all');
  const [statusMap, setStatusMap] = useState<Record<number, LibraryStatus>>(() =>
    readLibraryStatusMap(userId)
  );
  const [progressMap, setProgressMap] = useState<Record<number, WatchProgressEntry>>(() =>
    getAllWatchProgress(undefined, userId)
  );
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [pendingRemoveAnime, setPendingRemoveAnime] = useState<Anime | null>(null);

  // Re-hydrate strictly user-scoped library statuses & progress when account changes
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

  // Close overflow menus on outside click
  useEffect(() => {
    if (openMenuId === null) return;
    const handleOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [openMenuId]);

  const enrichedItems = useMemo(() => {
    return watchlist.map((anime, originalIndex) => {
      const idNum = Number(anime.id);
      const progress = progressMap[idNum] || null;
      const effectiveStatus = resolveEffectiveLibraryStatus(idNum, statusMap, progress);
      const totalEps =
        anime.episodes_count && Number(anime.episodes_count) > 0
          ? Number(anime.episodes_count)
          : progress?.totalEpisodes && Number(progress.totalEpisodes) > 0
            ? Number(progress.totalEpisodes)
            : null;
      const langCodes = extractCompactLanguageCodes(anime.languages).slice(0, 3);
      const canonicalOtts = normalizeCanonicalOttList(anime as unknown as Record<string, unknown>);
      const ottLabel = canonicalOtts.length > 0 ? canonicalOtts[0] : 'Not verified';
      const updatedTs = progress?.updatedAt ? Date.parse(progress.updatedAt) || 0 : 0;
      return {
        anime,
        progress,
        effectiveStatus,
        totalEps,
        langCodes,
        ottLabel,
        updatedTs,
        originalIndex,
      };
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
    const filtered = enrichedItems.filter(({ anime, effectiveStatus }) => {
      if (activeStatusTab !== 'all' && effectiveStatus !== activeStatusTab) {
        return false;
      }
      if (!query) return true;
      const matchesTitle = anime.title.toLowerCase().includes(query);
      const matchesLang = Boolean(anime.languages && anime.languages.toLowerCase().includes(query));
      const matchesGenre = Boolean(anime.genres && anime.genres.toLowerCase().includes(query));
      return matchesTitle || matchesLang || matchesGenre;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'title') {
        return a.anime.title.localeCompare(b.anime.title);
      }
      if (sortBy === 'rating') {
        const ratingA = Number(a.anime.rating) || 0;
        const ratingB = Number(b.anime.rating) || 0;
        return ratingB - ratingA;
      }
      // Recently Updated
      if (b.updatedTs !== a.updatedTs) return b.updatedTs - a.updatedTs;
      return a.originalIndex - b.originalIndex;
    });
  }, [enrichedItems, activeStatusTab, searchQuery, sortBy]);

  const handleStatusChange = (animeId: number, nextStatus: LibraryStatus) => {
    const updated = setAnimeLibraryStatus(animeId, nextStatus, userId);
    setStatusMap(updated);
    toast?.info?.('Status Updated', `Moved to ${getLibraryStatusConfig(nextStatus).label}.`);
  };

  const handleQuickIncrementEpisode = (anime: Anime, progress: WatchProgressEntry | null, totalEps: number | null) => {
    const idNum = Number(anime.id);
    const currentSeason = progress?.season ?? 1;
    const currentEpisode = progress?.episode ?? 0;
    const nextEpisode = totalEps ? Math.min(totalEps, currentEpisode + 1) : currentEpisode + 1;
    if (totalEps && currentEpisode >= totalEps) {
      toast?.info?.('Episode Limit Reached', `${anime.title} is already at ${totalEps}/${totalEps} episodes.`);
      return;
    }
    const completed = Boolean(totalEps && nextEpisode >= totalEps);
    const saved = saveAnimeWatchProgress(
      idNum,
      {
        season: currentSeason,
        episode: nextEpisode,
        totalEpisodes: totalEps,
        completed,
      },
      undefined,
      userId
    );
    if (saved) {
      setProgressMap((prev) => ({ ...prev, [idNum]: saved }));
      if (completed) {
        const updatedStatuses = setAnimeLibraryStatus(idNum, 'completed', userId);
        setStatusMap(updatedStatuses);
      } else if (!statusMap[idNum] || statusMap[idNum] === 'plan_to_watch') {
        const updatedStatuses = setAnimeLibraryStatus(idNum, 'watching', userId);
        setStatusMap(updatedStatuses);
      }
      if (isSignedIn && userId) {
        cloudflareApi
          .saveWatchProgress({
            animeId: saved.animeId,
            season: saved.season,
            episode: saved.episode,
            totalEpisodes: saved.totalEpisodes,
            completed: saved.completed,
          })
          .catch(() => {});
      }
      toast?.success?.(
        'Progress Saved',
        `${anime.title}: S${saved.season} Ep ${saved.episode}${totalEps ? `/${totalEps}` : ''}`
      );
    }
  };

  const handleExportCsv = () => {
    if (watchlist.length === 0) {
      toast?.info?.('Library Empty', 'Save at least one anime before exporting CSV.');
      return;
    }
    const csv = buildWatchlistCsv(watchlist, statusMap, progressMap);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const ok = downloadCsvFile(`anidub-india-watchlist-${dateStamp}.csv`, csv);
    if (ok) {
      toast?.success?.('CSV Exported', `Exported ${watchlist.length} anime from your library.`);
    }
  };

  const handleConfirmRemove = () => {
    if (!pendingRemoveAnime) return;
    onToggleWatchlist(Number(pendingRemoveAnime.id));
    setPendingRemoveAnime(null);
  };

  if (isLoading) {
    return <LibraryPageSkeleton />;
  }

  const activeTabLabel =
    activeStatusTab === 'all' ? 'All Saved' : getLibraryStatusConfig(activeStatusTab).label;

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 overflow-x-clip">
      {/* COMPACT ECLIPSE LIBRARY HEADER + STATUS TABS */}
      <header className="bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#F4F3FA] tracking-tight">
                My Library
              </h1>
              <span className="bg-[#191C29] border border-[#292B39] text-[#B49AF8] text-xs font-bold px-2.5 py-0.5 rounded-lg tabular-nums">
                {watchlist.length} saved
              </span>
            </div>
            <p className="text-xs text-[#A1A5B5] mt-1">
              {isSignedIn
                ? 'Synced to your account. Track watch status, episode progress, or export CSV.'
                : 'Saved locally on this device. Sign in to sync your watchlist across devices.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenCreateCollection && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onOpenCreateCollection}
                leftIcon={<Plus className="w-4 h-4" />}
                className="text-xs font-bold"
              >
                New Collection
              </Button>
            )}
            {onOpenCompare && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onOpenCompare}
                leftIcon={<Scale className="w-4 h-4 text-[#B49AF8]" />}
                className="text-xs font-semibold"
              >
                Compare
              </Button>
            )}
          </div>
        </div>

        {/* SIGNED-OUT SYNC BANNER (Strict account isolation) */}
        {!isSignedIn && (
          <div className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#A1A5B5]">
              Sign in to back up your watchlist and episode progress securely to your own account.
            </p>
            <SignInButton mode="modal">
              <button
                type="button"
                className="min-h-[40px] px-3.5 py-2 rounded-[10px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-xs font-bold inline-flex items-center gap-1.5 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In to Sync</span>
              </button>
            </SignInButton>
          </div>
        )}

        {/* HORIZONTAL SCROLLABLE STATUS TAB BAR */}
        <div
          role="tablist"
          aria-label="Library status filter"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeStatusTab === 'all'}
            onClick={() => setActiveStatusTab('all')}
            className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors duration-180 motion-reduce:transition-none cursor-pointer border ${
              activeStatusTab === 'all'
                ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
            }`}
          >
            <span>All</span>
            <span className="text-[11px] opacity-85 tabular-nums">{statusCounts.all}</span>
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
                className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors duration-180 motion-reduce:transition-none cursor-pointer border ${
                  isActive
                    ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                    : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                }`}
              >
                <span>{status.label}</span>
                <span className="text-[11px] opacity-85 tabular-nums">
                  {statusCounts[status.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* COMPACT LIBRARY UTILITY BAR (Search, Sort, Export CSV) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-3 border-t border-[#292B39]">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-[#A1A5B5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search within library..."
              aria-label="Search within library"
              className="w-full h-[44px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-[12px] pl-10 pr-9 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-180 motion-reduce:transition-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear library search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A5B5] hover:text-[#F4F3FA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="sm:col-span-4 relative">
            <ArrowUpDown className="w-4 h-4 text-[#A1A5B5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Sort library"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as LibrarySortOption)}
              className="w-full h-[44px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-[12px] pl-10 pr-3 text-xs font-semibold text-[#F4F3FA] outline-none cursor-pointer transition-colors duration-180"
            >
              <option value="recent" className="bg-[#12141E]">Sort: Recently Updated</option>
              <option value="title" className="bg-[#12141E]">Sort: Title A–Z</option>
              <option value="rating" className="bg-[#12141E]">Sort: Rating</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={watchlist.length === 0}
              className="w-full h-[44px] px-3.5 rounded-[12px] bg-[#191C29] hover:border-[#B49AF8]/60 disabled:opacity-45 border border-[#292B39] text-xs font-bold text-[#F4F3FA] inline-flex items-center justify-center gap-2 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#34D399] shrink-0" />
              <span className="truncate">Export Watchlist (CSV)</span>
            </button>
          </div>
        </div>
      </header>

      {/* LIBRARY CONTENT / TAB-SPECIFIC EMPTY STATES */}
      {watchlist.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="w-6 h-6" />}
          title="Your Library is Empty"
          description="Save dubbed anime from Explore to organize them into Watching, Completed, Plan to Watch, On Hold, Dropped, or Rewatching."
          actionLabel="Browse Explore"
          onAction={onNavigateToCatalog}
        />
      ) : filteredWatchlist.length === 0 ? (
        <EmptyState
          icon={<Search className="w-5 h-5" />}
          title={
            searchQuery
              ? `No matches for "${searchQuery}"`
              : `No titles in ${activeTabLabel}`
          }
          description={
            searchQuery
              ? 'Try another title, language, or clear your search filter.'
              : `You have no saved anime marked as "${activeTabLabel}" yet. Change any title's status or discover more dubs in Explore.`
          }
          actionLabel="Browse Explore"
          onAction={onNavigateToCatalog}
          secondaryActionLabel={activeStatusTab !== 'all' ? `View All Saved (${watchlist.length})` : undefined}
          onSecondaryAction={activeStatusTab !== 'all' ? () => { setActiveStatusTab('all'); setSearchQuery(''); } : undefined}
        />
      ) : (
        <motion.div
          key={`watchlist_grid_${activeStatusTab}_${sortBy}_${filteredWatchlist.length}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {filteredWatchlist.map(({ anime, effectiveStatus, progress, totalEps, langCodes, ottLabel }) => {
            const idNum = Number(anime.id);
            const currentSeason = progress?.season ?? 1;
            const currentEpisode = progress?.episode ?? 0;
            const atLimit = Boolean(totalEps && currentEpisode >= totalEps);
            const statusCfg = getLibraryStatusConfig(effectiveStatus);
            const menuOpen = openMenuId === idNum;

            return (
              <article
                key={`library_card_${idNum}`}
                data-testid="library-anime-card"
                className="relative rounded-[12px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/40 p-3 flex gap-3 transition-colors duration-180 motion-reduce:transition-none"
              >
                {/* Strict 2:3 Poster */}
                <button
                  type="button"
                  onClick={() => onSelectAnime(anime)}
                  className="w-20 sm:w-24 aspect-[2/3] rounded-[10px] overflow-hidden border border-[#292B39] bg-[#191C29] shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B49AF8]"
                  aria-label={`Open ${anime.title}`}
                >
                  <img
                    src={anime.cover_image || '/logo.png'}
                    alt={anime.title}
                    width={96}
                    height={144}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = '/logo.png';
                    }}
                    className="w-full h-full object-cover"
                  />
                </button>

                {/* Card Details & Controls */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectAnime(anime)}
                        className="text-left min-w-0 flex-1 cursor-pointer group"
                      >
                        <h2 className="text-sm font-bold text-[#F4F3FA] group-hover:text-[#B49AF8] line-clamp-2 leading-snug transition-colors duration-180">
                          {anime.title}
                        </h2>
                      </button>

                      {/* Overflow (...) Menu */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(menuOpen ? null : idNum);
                          }}
                          aria-label={`More actions for ${anime.title}`}
                          aria-expanded={menuOpen}
                          className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-[10px] bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/60 text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-180 cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            role="menu"
                            className="absolute right-0 top-11 z-30 w-48 rounded-[12px] bg-[#191C29] border border-[#292B39] shadow-2xl p-1.5 space-y-1"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                onSelectAnime(anime);
                              }}
                              className="w-full min-h-[40px] px-3 py-2 rounded-lg text-left text-xs font-semibold text-[#F4F3FA] hover:bg-[#12141E] inline-flex items-center gap-2 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#B49AF8]" />
                              <span>View Details</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setPendingRemoveAnime(anime);
                              }}
                              className="w-full min-h-[40px] px-3 py-2 rounded-lg text-left text-xs font-semibold text-[#F87171] hover:bg-[#F87171]/10 inline-flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove from Library</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Verified Dub Chips & OTT */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {langCodes.map((code) => (
                        <span
                          key={`lib_lang_${idNum}_${code}`}
                          className="px-1.5 py-0.5 rounded bg-[#191C29] border border-[#292B39] text-[10px] font-bold text-[#CBB6FF]"
                        >
                          {code}
                        </span>
                      ))}
                      <span className="text-[11px] text-[#A1A5B5] truncate">
                        • {ottLabel}
                      </span>
                    </div>
                  </div>

                  {/* Episode Progress + Status Switcher Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-[#292B39]">
                    <div className="flex items-center gap-1.5 bg-[#191C29] border border-[#292B39] rounded-[10px] pl-2.5 pr-1 py-1">
                      <span className="text-[11px] font-bold text-[#F4F3FA] tabular-nums">
                        S{currentSeason} • Ep {currentEpisode}
                        {totalEps ? `/${totalEps}` : ''}
                      </span>
                      <button
                        type="button"
                        disabled={atLimit}
                        onClick={() => handleQuickIncrementEpisode(anime, progress, totalEps)}
                        aria-label={`Increment watched episode for ${anime.title}`}
                        className={`min-w-[34px] min-h-[32px] px-2 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center transition-colors duration-180 cursor-pointer ${
                          atLimit
                            ? 'bg-[#34D399]/15 text-[#34D399] cursor-default'
                            : 'bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10]'
                        }`}
                      >
                        {atLimit ? <CheckCircle2 className="w-3.5 h-3.5" /> : '+1'}
                      </button>
                    </div>

                    <select
                      aria-label={`Library status for ${anime.title}`}
                      value={effectiveStatus}
                      onChange={(e) => handleStatusChange(idNum, e.target.value as LibraryStatus)}
                      className="flex-1 min-w-[120px] min-h-[40px] rounded-[10px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] px-2.5 text-xs font-semibold text-[#F4F3FA] outline-none cursor-pointer"
                    >
                      {LIBRARY_STATUSES.map((st) => (
                        <option key={st.id} value={st.id} className="bg-[#12141E] text-[#F4F3FA]">
                          {st.label}
                        </option>
                      ))}
                    </select>

                    <span className="sr-only">{statusCfg.label}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </motion.div>
      )}

      {/* CONFIRM REMOVAL DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(pendingRemoveAnime)}
        onClose={() => setPendingRemoveAnime(null)}
        onConfirm={handleConfirmRemove}
        title="Remove from Library?"
        description={
          pendingRemoveAnime
            ? `Remove "${pendingRemoveAnime.title}" from your saved library? You can always bookmark it again later.`
            : ''
        }
        confirmLabel="Remove"
        destructive
      />
    </div>
  );
};
