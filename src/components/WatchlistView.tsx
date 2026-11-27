import React, { useState, useEffect, useMemo } from 'react';
import {
  Bookmark, Trash2, Play, Sparkles, Search, Plus, ArrowUpDown, Download, Cloud,
  CheckCircle2, Clock, MoreHorizontal, RotateCcw
} from 'lucide-react';
import {
  Anime,
  WatchlistItem,
  WatchlistStatus,
  normalizeWatchlistProp,
} from '../types';
import { OptimizedImage } from './OptimizedImage';
import { ConfirmDialog, LibraryPageSkeleton } from './ui/EclipseState';
import { normalizeDubSeasonBreakdowns } from '../utils/dubProgress';
import { cloudflareApi } from '../services/cloudflareApi';
import { useTranslation } from 'react-i18next';

export interface WatchlistViewProps {
  watchlist: any[];
  animeList?: any[];
  catalogList?: any[];
  onSelectAnime: (anime: any) => void;
  onRemoveFromWatchlist?: (id: string, e: React.MouseEvent) => void;
  onToggleWatchlist?: (id: any) => void;
  onUpdateStatus?: (id: string, status: WatchlistStatus) => void;
  onExplore?: () => void;
  onNavigateToCatalog?: () => void;
  onOpenCreateCollection?: () => void;
  onOpenCompare?: () => void;
  isSignedIn?: boolean;
  userId?: string | null;
  user?: { id?: string; name: string; email: string; avatar?: string } | null;
  onOpenAuth?: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  isLoading?: boolean;
}

const STATUS_TABS: ('All' | WatchlistStatus)[] = [
  'All',
  'Watching',
  'Completed',
  'Plan to Watch',
  'On Hold',
  'Dropped',
  'Rewatching',
];

type SortOption = 'updated' | 'title' | 'progress' | 'rating';

interface UndoProgressAction {
  animeId: string;
  animeTitle: string;
  previousTotal: number;
  newTotal: number;
  previousSeasonMap: Record<number, number>;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  animeList: animeListProp,
  catalogList,
  onSelectAnime,
  onRemoveFromWatchlist,
  onToggleWatchlist,
  onUpdateStatus: onUpdateStatusProp,
  onExplore: onExploreProp,
  onNavigateToCatalog,
  isSignedIn,
  userId,
  user: userProp,
  onOpenAuth,
  onShowToast,
  isLoading = false,
}) => {
  const onExplore = onExploreProp || onNavigateToCatalog || (() => {});
  const user = userProp ?? (isSignedIn ? { id: userId || 'user', name: 'Member', email: '' } : null);
  const { t } = useTranslation(['library', 'common']);

  const getTabLabel = (status: 'All' | WatchlistStatus): string => {
    const keyMap: Record<'All' | WatchlistStatus, string> = {
      All: 'library:tabs.all',
      Watching: 'library:tabs.watching',
      Completed: 'library:tabs.completed',
      'Plan to Watch': 'library:tabs.planToWatch',
      'On Hold': 'library:tabs.onHold',
      Dropped: 'library:tabs.dropped',
      Rewatching: 'library:tabs.rewatching',
    };
    return t(keyMap[status] || status, status);
  };

  const [selectedTab, setSelectedTab] = useState<'All' | WatchlistStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [localStatusVersion, setLocalStatusVersion] = useState(0);
  const [confirmRemoveAnime, setConfirmRemoveAnime] = useState<{ id: string; title: string } | null>(null);
  const [activeOverflowId, setActiveOverflowId] = useState<string | null>(null);
  const [undoBanner, setUndoBanner] = useState<UndoProgressAction | null>(null);

  const handleUpdateStatus = (id: string, status: WatchlistStatus) => {
    try {
      const saved = JSON.parse(localStorage.getItem('anidub_watchlist_status_v2') || '{}');
      saved[String(id)] = status;
      localStorage.setItem('anidub_watchlist_status_v2', JSON.stringify(saved));
      setLocalStatusVersion((v) => v + 1);
    } catch {
      // ignore
    }
    onUpdateStatusProp?.(id, status);
  };

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(id, e);
    } else if (onToggleWatchlist) {
      const num = Number(id);
      onToggleWatchlist(Number.isFinite(num) && num > 0 ? num : id);
    }
  };

  const loadProgressFromStorage = () => {
    try {
      const legacyProgress = JSON.parse(localStorage.getItem('anime_progress') || '{}');
      const seasonProgress = JSON.parse(localStorage.getItem('anime_season_progress_v2') || '{}');
      const merged: Record<string, number> = { ...legacyProgress };
      for (const [animeId, seasonObj] of Object.entries(seasonProgress)) {
        if (seasonObj && typeof seasonObj === 'object') {
          const sum = Object.values(seasonObj as Record<string, number>).reduce(
            (acc, val) => acc + (Number(val) || 0),
            0
          );
          if (sum > 0) merged[animeId] = sum;
        }
      }
      setProgressMap(merged);
    } catch {
      setProgressMap({});
    }
  };

  useEffect(() => {
    loadProgressFromStorage();
    window.addEventListener('storage', loadProgressFromStorage);
    return () => window.removeEventListener('storage', loadProgressFromStorage);
  }, [watchlist]);

  // Normalize watchlist items and enrich with catalog data
  const enrichedItems = useMemo(() => {
    const { items, animePool } = normalizeWatchlistProp(watchlist, animeListProp || catalogList);
    return items
      .map((item) => {
        const anime = animePool.find((a) => String(a.id) === String(item.id));
        if (!anime) return null;
        const watched = progressMap[anime.id] ?? 0;
        const seasons = normalizeDubSeasonBreakdowns(anime);
        const totalVerifiedEpisodes =
          anime.episodesCount && anime.episodesCount > 0
            ? anime.episodesCount
            : seasons.reduce((acc: number, s) => acc + (s.totalEpisodes || 0), 0) || null;
        return {
          ...item,
          anime,
          watched,
          totalVerifiedEpisodes,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [watchlist, animeListProp, catalogList, progressMap, localStatusVersion]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: enrichedItems.length };
    STATUS_TABS.slice(1).forEach((st) => {
      counts[st] = enrichedItems.filter((item) => item.status === st).length;
    });
    return counts;
  }, [enrichedItems]);

  const filteredAndSorted = useMemo(() => {
    const list = enrichedItems.filter((item) => {
      if (selectedTab !== 'All' && item.status !== selectedTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.anime.title.toLowerCase().includes(q) ||
          (item.anime.japaneseTitle && item.anime.japaneseTitle.toLowerCase().includes(q))
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'title') return a.anime.title.localeCompare(b.anime.title);
      if (sortBy === 'rating') return (b.anime.rating || 0) - (a.anime.rating || 0);
      if (sortBy === 'progress') return b.watched - a.watched;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
  }, [enrichedItems, selectedTab, searchQuery, sortBy]);

  const handleIncrementEpisode = async (
    anime: Anime,
    currentWatched: number,
    maxEpisodes: number | null
  ) => {
    if (maxEpisodes !== null && currentWatched >= maxEpisodes) return;
    const nextWatched =
      maxEpisodes !== null ? Math.min(currentWatched + 1, maxEpisodes) : currentWatched + 1;

    const seasonProgressAll = JSON.parse(localStorage.getItem('anime_season_progress_v2') || '{}');
    const prevSeasonObj: Record<number, number> =
      seasonProgressAll[anime.id] && typeof seasonProgressAll[anime.id] === 'object'
        ? { ...seasonProgressAll[anime.id] }
        : { 1: currentWatched };

    // Increment the active season respecting per-season episode caps
    const seasons = normalizeDubSeasonBreakdowns(anime);
    const updatedSeasonObj: Record<number, number> = { ...prevSeasonObj };
    let incremented = false;
    for (const s of seasons) {
      const curr = Number(updatedSeasonObj[s.seasonNumber]) || 0;
      const cap = s.totalEpisodes && s.totalEpisodes > 0 ? s.totalEpisodes : maxEpisodes;
      if (cap === null || curr < cap) {
        updatedSeasonObj[s.seasonNumber] = curr + 1;
        incremented = true;
        break;
      }
    }
    if (!incremented) {
      updatedSeasonObj[1] = (Number(updatedSeasonObj[1]) || 0) + 1;
    }

    seasonProgressAll[anime.id] = updatedSeasonObj;
    localStorage.setItem('anime_season_progress_v2', JSON.stringify(seasonProgressAll));

    const legacyProgress = JSON.parse(localStorage.getItem('anime_progress') || '{}');
    legacyProgress[anime.id] = nextWatched;
    localStorage.setItem('anime_progress', JSON.stringify(legacyProgress));

    setProgressMap((prev) => ({ ...prev, [anime.id]: nextWatched }));

    // Show inline Undo toast bar
    setUndoBanner({
      animeId: anime.id,
      animeTitle: anime.title,
      previousTotal: currentWatched,
      newTotal: nextWatched,
      previousSeasonMap: prevSeasonObj,
    });

    if (maxEpisodes !== null && nextWatched >= maxEpisodes) {
      handleUpdateStatus(anime.id, 'Completed');
    }

    try {
      await cloudflareApi.syncWatchlistItem({
        anime_id: anime.id,
        status: maxEpisodes !== null && nextWatched >= maxEpisodes ? 'Completed' : 'Watching',
        progress: nextWatched,
      });
    } catch {
      // Offline tolerance
    }
  };

  const handleUndoProgress = async () => {
    if (!undoBanner) return;
    const { animeId, previousTotal, previousSeasonMap } = undoBanner;

    const seasonProgressAll = JSON.parse(localStorage.getItem('anime_season_progress_v2') || '{}');
    seasonProgressAll[animeId] = previousSeasonMap;
    localStorage.setItem('anime_season_progress_v2', JSON.stringify(seasonProgressAll));

    const legacyProgress = JSON.parse(localStorage.getItem('anime_progress') || '{}');
    legacyProgress[animeId] = previousTotal;
    localStorage.setItem('anime_progress', JSON.stringify(legacyProgress));

    setProgressMap((prev) => ({ ...prev, [animeId]: previousTotal }));
    setUndoBanner(null);

    if (onShowToast) {
      onShowToast('Reverted episode progress', 'info');
    }
  };

  const handleExportCsv = () => {
    if (enrichedItems.length === 0) return;
    const headers = ['Title', 'Status', 'Episodes Watched', 'Total Verified Episodes', 'Languages', 'OTT Platforms'];
    const rows = enrichedItems.map((item) => [
      `"${item.anime.title.replace(/"/g, '""')}"`,
      `"${item.status}"`,
      String(item.watched),
      item.totalVerifiedEpisodes ? String(item.totalVerifiedEpisodes) : 'Not verified',
      `"${(item.anime.languages || []).join(', ')}"`,
      `"${(item.anime.platforms || []).join(', ')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anidub-library-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    if (onShowToast) onShowToast('Exported Watchlist CSV', 'success');
  };

  if (isLoading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 pb-24">
        <LibraryPageSkeleton />
      </div>
    );
  }

  // EMPTY STATE SIMPLIFICATION (Phase 5 Rule):
  // When watchlist.length === 0, HIDE Search, Sort, CSV Export bars and status tabs.
  if (enrichedItems.length === 0) {
    return (
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[var(--text-primary)]">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em]">
            {t('library:title', 'My Library')}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{t('library:subtitle', '0 saved anime')}</p>
        </div>

        {/* Slim Guest Sign-In Prompt */}
        {!user && (
          <div
            data-testid="library-guest-sync-prompt"
            className="mb-6 rounded-[14px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Cloud className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <p className="text-[13px] sm:text-[14px] text-[var(--text-primary)] font-medium">
                Keep your library safe — <span className="text-[var(--text-secondary)]">Sign in to sync across devices</span>
              </p>
            </div>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[44px] px-4 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--accent-hover)] border border-[var(--accent-primary)]/30 text-[13px] font-semibold shrink-0 transition-colors duration-180"
              >
                Sign in
              </button>
            )}
          </div>
        )}

        {/* Clean Centered Empty State with ONE #B49AF8 "Explore anime" CTA */}
        <div
          data-testid="library-empty-state"
          className="rounded-[18px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-6 py-14 text-center max-w-lg mx-auto my-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-6 h-6 text-[var(--accent-primary)]" />
          </div>
          <h2 className="text-[18px] sm:text-[22px] font-bold text-[var(--text-primary)] mb-2">
            {t('library:emptyTitle', 'Your library is empty')}
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] max-w-sm mx-auto mb-6 leading-relaxed">
            {t('library:emptySubtitle', 'Bookmark anime from Explore to track seasons and regional dubs here.')}
          </p>
          <button
            type="button"
            onClick={onExplore}
            className="min-h-[44px] px-6 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold text-[14px] inline-flex items-center justify-center gap-2 transition-colors duration-180 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('library:browseExplore', 'Explore anime')}</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[var(--text-primary)]">
      {/* Header & Utility Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em]">
            {t('library:title', 'My Library')}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            {enrichedItems.length} saved anime
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          aria-label="Export Watchlist (CSV)"
          className="min-h-[44px] px-3.5 rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold inline-flex items-center gap-2 transition-colors duration-180"
        >
          <Download className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <span>{t('library:exportCsv', 'Export Watchlist (CSV)')}</span>
        </button>
      </div>

      {/* Slim Guest Sign-In Sync Banner when signed out */}
      {!user && (
        <div className="mb-4 rounded-[14px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[13px]">
            <Cloud className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="text-[var(--text-primary)] font-medium">
              Keep your library safe — <span className="text-[var(--text-secondary)]">Sign in to sync across devices</span>
            </span>
          </div>
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--accent-hover)] border border-[var(--border-subtle)] text-[12px] font-semibold shrink-0"
            >
              Sign in
            </button>
          )}
        </div>
      )}

      {/* Undo Progress Toast Banner */}
      {undoBanner && (
        <div
          role="status"
          data-testid="library-undo-toast"
          className="mb-4 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--accent-primary)]/40 px-4 py-2.5 flex items-center justify-between gap-3 animate-in fade-in duration-180"
        >
          <span className="text-[13px] text-[var(--text-primary)]">
            Updated <strong>{undoBanner.animeTitle}</strong> to Episode {undoBanner.newTotal}
          </span>
          <button
            type="button"
            onClick={handleUndoProgress}
            className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--accent-primary)] text-[var(--accent-on-primary)] text-[12px] font-bold inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Status Filter Tabs (44px touch targets) */}
      <div
        role="tablist"
        aria-label="Library status filters"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-4"
      >
        {STATUS_TABS.map((status) => {
          const isActive = selectedTab === status;
          const count = statusCounts[status] ?? 0;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedTab(status)}
              className={`min-h-[44px] px-3.5 rounded-[12px] text-[13px] font-semibold whitespace-nowrap border inline-flex items-center gap-2 transition-all duration-180 motion-reduce:transition-none ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <span>{getTabLabel(status)}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-[6px] text-[11px] font-bold ${
                    isActive ? 'bg-[var(--bg-canvas)]/15 text-[var(--accent-on-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--accent-hover)]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Compact Search & Sort Bar (44px controls) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('library:searchPlaceholder', 'Filter your saved anime...')}
            aria-label="Search saved anime"
            className="w-full min-h-[44px] pl-10 pr-4 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <select
            aria-label="Sort library"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="min-h-[44px] px-3.5 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="updated">Recently Added</option>
            <option value="title">Title (A–Z)</option>
            <option value="progress">Most Watched</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Library Cards Grid */}
      {filteredAndSorted.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredAndSorted.map(({ anime, status, watched, totalVerifiedEpisodes }) => {
            const progressPercent =
              totalVerifiedEpisodes && totalVerifiedEpisodes > 0
                ? Math.min(100, Math.round((watched / totalVerifiedEpisodes) * 100))
                : watched > 0
                  ? 50
                  : 0;
            const isAtMax =
              totalVerifiedEpisodes !== null && totalVerifiedEpisodes > 0 && watched >= totalVerifiedEpisodes;

            return (
              <div
                key={anime.id}
                data-testid="library-anime-card"
                className="relative rounded-[14px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 p-3.5 flex items-center gap-3.5 transition-all duration-180"
              >
                {/* 2:3 Poster */}
                <div
                  onClick={() => onSelectAnime(anime)}
                  className="w-20 sm:w-24 aspect-[2/3] rounded-[10px] overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shrink-0 cursor-pointer"
                >
                  <OptimizedImage
                    src={anime.poster}
                    alt={anime.title}
                    className="w-full h-full object-cover"
                    aspectRatio="portrait"
                  />
                </div>

                {/* Details & Progress */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] text-[var(--accent-hover)] border border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-wider mb-1">
                        {status === 'Completed' ? (
                          <CheckCircle2 className="w-3 h-3 text-[#34D399]" />
                        ) : (
                          <Clock className="w-3 h-3 text-[var(--accent-primary)]" />
                        )}
                        {status}
                      </span>
                      <h3
                        onClick={() => onSelectAnime(anime)}
                        className="text-[14px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent-hover)] leading-[20px] line-clamp-2 cursor-pointer"
                      >
                        {anime.title}
                      </h3>
                    </div>

                    {/* 44x44px Overflow Menu Trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`More actions for ${anime.title}`}
                        onClick={() =>
                          setActiveOverflowId((prev) => (prev === anime.id ? null : anime.id))
                        }
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {activeOverflowId === anime.id && (
                        <div className="absolute right-0 top-12 z-20 w-48 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-xl p-1.5 space-y-1">
                          <select
                            aria-label={`Change status for ${anime.title}`}
                            value={status}
                            onChange={(e) => {
                              handleUpdateStatus(anime.id, e.target.value as WatchlistStatus);
                              setActiveOverflowId(null);
                            }}
                            className="w-full min-h-[44px] px-2.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-primary)]"
                          >
                            {STATUS_TABS.slice(1).map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmRemoveAnime({ id: anime.id, title: anime.title });
                              setActiveOverflowId(null);
                            }}
                            className="w-full min-h-[44px] px-3 rounded-[8px] hover:bg-red-500/15 text-[#F87171] text-[12px] font-semibold flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove from Library</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Episode Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--text-secondary)]">Progress</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {watched} / {totalVerifiedEpisodes ?? '?'} eps
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-180"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Actions: +1 Episode (44x44px) & View Details */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectAnime(anime)}
                      className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold inline-flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      disabled={isAtMax}
                      aria-label={`Increment episode for ${anime.title}`}
                      onClick={() =>
                        handleIncrementEpisode(anime, watched, totalVerifiedEpisodes)
                      }
                      className="min-h-[44px] min-w-[44px] px-3.5 rounded-[10px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-[var(--accent-on-primary)] font-bold text-[12px] inline-flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('library:plusOneEpisode', '+1 Ep')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center">
          <p className="text-[14px] text-[var(--text-secondary)]">
            No saved anime match your current filter.
          </p>
        </div>
      )}

      {/* Confirm Removal Dialog */}
      <ConfirmDialog
        open={Boolean(confirmRemoveAnime)}
        title={t('library:removeTitle', 'Remove from Library?')}
        description={
          confirmRemoveAnime
            ? t('library:removeConfirm', {
                title: confirmRemoveAnime.title,
                defaultValue: `Remove "${confirmRemoveAnime.title}" from your library? Your episode progress can be re-added anytime.`,
              })
            : ''
        }
        confirmLabel={t('library:removeAction', 'Remove')}
        isDestructive={true}
        onCancel={() => setConfirmRemoveAnime(null)}
        onConfirm={() => {
          if (confirmRemoveAnime) {
            handleRemoveItem(confirmRemoveAnime.id, {
              stopPropagation: () => {},
            } as React.MouseEvent);
            setConfirmRemoveAnime(null);
          }
        }}
      />
    </section>
  );
};
