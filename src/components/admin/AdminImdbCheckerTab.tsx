import React, { useState, useMemo } from 'react';
import {
  Star,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  Loader2,
  CheckSquare,
  Square,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  buildSafeImdbBatchUpdates,
  type ImdbRatingCandidate,
} from '../../utils/adminLegacyRestore';

export interface AdminImdbCheckerTabProps {
  catalog: any[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onRatingsUpdated?: () => void;
}

export const AdminImdbCheckerTab: React.FC<AdminImdbCheckerTabProps> = ({
  catalog,
  onSuccess,
  onError,
  onRatingsUpdated,
}) => {
  const [filterMode, setFilterMode] = useState<'missing' | 'default' | 'all'>('default');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [batchLimit, setBatchLimit] = useState<number>(8);
  const [offset, setOffset] = useState<number>(0);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyingSingleId, setApplyingSingleId] = useState<number | null>(null);
  const [omdbConfigured, setOmdbConfigured] = useState<boolean>(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [results, setResults] = useState<ImdbRatingCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());

  const localSummary = useMemo(() => {
    let missing = 0;
    let defaultLike = 0;
    for (const item of catalog || []) {
      const score = Number(item?.rating);
      if (!item?.rating || !Number.isFinite(score) || score <= 0) {
        missing += 1;
        defaultLike += 1;
      } else if (score === 8.5 || score === 8.0) {
        defaultLike += 1;
      }
    }
    return {
      total: (catalog || []).length,
      missing,
      defaultLike,
    };
  }, [catalog]);

  const updatableResults = useMemo(
    () =>
      results.filter(
        (r) =>
          r.fetchedRating !== null &&
          (r.status === 'missing_current' || r.status === 'outdated') &&
          !appliedIds.has(r.animeId)
      ),
    [results, appliedIds]
  );

  const handleRunScan = async (nextOffset = 0) => {
    setIsChecking(true);
    try {
      const res = await cloudflareApi.checkAdminImdbRatings({
        filter: filterMode,
        limit: batchLimit,
        offset: nextOffset,
        search: searchQuery.trim() || undefined,
      });

      setResults(res.results || []);
      setOffset(nextOffset);
      setOmdbConfigured(Boolean(res.omdbConfigured));
      setCheckedAt(res.checkedAt);
      setAppliedIds(new Set());

      // Pre-select rows with real verified rating updates (never auto-select Not Found or Matched)
      const autoSelected = (res.results || [])
        .filter(
          (r) =>
            r.fetchedRating !== null &&
            (r.status === 'missing_current' || r.status === 'outdated')
        )
        .map((r) => r.animeId);
      setSelectedIds(autoSelected);

      if ((res.results || []).length === 0) {
        onSuccess('No catalog titles matched this rating filter.');
      } else {
        onSuccess(
          `Checked ${res.results.length} title(s): ${autoSelected.length} ready for verified rating sync.`
        );
      }
    } catch (err: any) {
      onError(err?.message || 'IMDb Ratings Checker request failed.');
    } finally {
      setIsChecking(false);
    }
  };

  const toggleSelectId = (animeId: number) => {
    setSelectedIds((prev) =>
      prev.includes(animeId) ? prev.filter((id) => id !== animeId) : [...prev, animeId]
    );
  };

  const handleToggleSelectAllUpdatable = () => {
    if (selectedIds.length === updatableResults.length && updatableResults.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(updatableResults.map((r) => r.animeId));
    }
  };

  const handleApplySingle = async (row: ImdbRatingCandidate) => {
    if (row.fetchedRating === null) return;
    setApplyingSingleId(row.animeId);
    try {
      const updates = buildSafeImdbBatchUpdates([row], [row.animeId]);
      if (updates.length === 0) {
        onError('No valid fetched score available for this title.');
        return;
      }
      const res = await cloudflareApi.applyAdminImdbRatings(updates);
      if (res.success && res.updatedCount > 0) {
        setAppliedIds((prev) => new Set(prev).add(row.animeId));
        setSelectedIds((prev) => prev.filter((id) => id !== row.animeId));
        setResults((prev) =>
          prev.map((item) =>
            item.animeId === row.animeId
              ? {
                  ...item,
                  currentRating: row.fetchedRating,
                  delta: 0,
                  status: 'matched',
                }
              : item
          )
        );
        onSuccess(`Updated "${row.title}" rating to ★ ${row.fetchedRating.toFixed(1)} in D1!`);
        onRatingsUpdated?.();
      }
    } catch (err: any) {
      onError(err?.message || 'Failed to sync rating to Cloudflare D1.');
    } finally {
      setApplyingSingleId(null);
    }
  };

  const handleBatchApplySelected = async () => {
    const updates = buildSafeImdbBatchUpdates(results, selectedIds);
    if (updates.length === 0) {
      onError('Select at least one title with a verified fetched rating first.');
      return;
    }

    setIsApplying(true);
    try {
      const res = await cloudflareApi.applyAdminImdbRatings(updates);
      if (res.success) {
        const syncedSet = new Set(res.updatedIds);
        setAppliedIds((prev) => new Set([...prev, ...syncedSet]));
        setSelectedIds((prev) => prev.filter((id) => !syncedSet.has(id)));
        setResults((prev) =>
          prev.map((item) =>
            syncedSet.has(item.animeId) && item.fetchedRating !== null
              ? {
                  ...item,
                  currentRating: item.fetchedRating,
                  delta: 0,
                  status: 'matched',
                }
              : item
          )
        );
        onSuccess(`Batch synced verified ratings for ${res.updatedCount} anime title(s) in D1!`);
        onRatingsUpdated?.();
      }
    } catch (err: any) {
      onError(err?.message || 'Batch rating sync failed.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      data-testid="admin-imdb-checker-tab"
      className="max-w-6xl mx-auto space-y-4 text-[var(--text-primary)]"
    >
      {/* 1. Compact Header & Scan Controls */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Star className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
                IMDb &amp; External Ratings Checker
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Audit missing or outdated catalog ratings against live IMDb (OMDb) &amp; MyAnimeList (Jikan) metadata. Approve single rows or batch sync safely—zero auto-overwrites, zero fake scores.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
              Missing: <strong className="text-[var(--text-primary)]">{localSummary.missing}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
              Default (8.0/8.5): <strong className="text-amber-500">{localSummary.defaultLike}</strong>
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Scan Scope
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'missing', label: 'Missing' },
                  { id: 'default', label: 'Outdated' },
                  { id: 'all', label: 'All Titles' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setFilterMode(opt.id);
                    setOffset(0);
                  }}
                  className={`min-h-[44px] px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    filterMode === opt.id
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Filter by Title (Optional)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Solo Leveling, Naruto..."
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Batch Size
            </label>
            <select
              value={batchLimit}
              onChange={(e) => setBatchLimit(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
            >
              <option value={5}>5 titles</option>
              <option value={8}>8 titles</option>
              <option value={12}>12 titles</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              data-testid="imdb-run-check-btn"
              onClick={() => void handleRunScan(0)}
              disabled={isChecking}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{isChecking ? 'Checking...' : 'Check Ratings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Batch Action Bar */}
      {results.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleToggleSelectAllUpdatable}
              disabled={updatableResults.length === 0}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {selectedIds.length === updatableResults.length && updatableResults.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-[var(--accent-primary)]" />
              ) : (
                <Square className="w-4 h-4 text-[var(--text-secondary)]" />
              )}
              <span>
                Select Updatable ({updatableResults.length})
              </span>
            </button>

            <span className="text-[11px] font-mono text-[var(--text-secondary)]">
              Source: {omdbConfigured ? 'IMDb (OMDb) + MAL (Jikan)' : 'MAL (Jikan Live) · Add OMDB_API_KEY for IMDb direct'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRunScan(offset + batchLimit)}
              disabled={isChecking}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
            >
              Next Batch →
            </button>
            <button
              type="button"
              data-testid="imdb-batch-apply-btn"
              onClick={() => void handleBatchApplySelected()}
              disabled={isApplying || selectedIds.length === 0}
              className="min-h-[40px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Approve &amp; Sync Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Results Comparison List */}
      {results.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-2">
          <Sparkles className="w-9 h-9 text-amber-500 mx-auto" />
          <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
            Ready to Audit Live Catalog Ratings
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            Click <strong>Check Ratings</strong> above to scan a batch of anime against live IMDb/OMDb &amp; MyAnimeList scores and compare before approving any update.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {results.map((row) => {
            const canApply =
              row.fetchedRating !== null &&
              (row.status === 'missing_current' || row.status === 'outdated') &&
              !appliedIds.has(row.animeId);
            const isSelected = selectedIds.includes(row.animeId);
            const isSynced = appliedIds.has(row.animeId) || row.status === 'matched';

            return (
              <div
                key={row.animeId}
                data-testid={`imdb-row-${row.animeId}`}
                className="p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <button
                    type="button"
                    disabled={!canApply}
                    onClick={() => toggleSelectId(row.animeId)}
                    aria-label={`Select ${row.title}`}
                    className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-primary)] disabled:opacity-30 cursor-pointer shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-[var(--accent-primary)]" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  <img
                    src={row.coverImage || '/logo.png'}
                    alt={row.title}
                    loading="lazy"
                    className="w-11 h-14 rounded-lg object-cover border border-[var(--border-subtle)] shrink-0"
                  />

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                        {row.title}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                        #{row.animeId}
                        {row.year ? ` · ${row.year}` : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-secondary)]">
                        {row.source}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-2 flex-wrap">
                      <span>{row.note}</span>
                      {row.externalUrl && (
                        <a
                          href={row.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          <span>Verify Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Current vs Fetched Score + Action */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
                    <div className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center">
                      <div className="text-[10px] text-[var(--text-secondary)]">Current</div>
                      <div className="font-extrabold text-[var(--text-primary)]">
                        {row.currentRating !== null ? `★ ${row.currentRating.toFixed(1)}` : '—'}
                      </div>
                    </div>

                    <span className="text-[var(--text-secondary)] font-bold">→</span>

                    <div
                      className={`px-2.5 py-1 rounded-lg border text-center ${
                        row.fetchedRating !== null
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <div className="text-[10px]">Fetched</div>
                      <div className="font-extrabold">
                        {row.fetchedRating !== null ? `★ ${row.fetchedRating.toFixed(1)}` : 'N/A'}
                      </div>
                    </div>

                    {row.delta !== null && Math.abs(row.delta) >= 0.1 && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                          row.delta > 0
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {row.delta > 0 ? `+${row.delta.toFixed(1)}` : row.delta.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {isSynced ? (
                    <span className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Synced</span>
                    </span>
                  ) : row.fetchedRating === null ? (
                    <span className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-bold inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Unmatched</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={applyingSingleId === row.animeId || isApplying}
                      onClick={() => void handleApplySingle(row)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {applyingSingleId === row.animeId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Approve</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {checkedAt && (
            <div className="text-[11px] text-right font-mono text-[var(--text-secondary)] pt-1">
              Last live check: {new Date(checkedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
