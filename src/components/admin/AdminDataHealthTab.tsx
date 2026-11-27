import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Edit3,
  Link2,
  Loader2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { DataHealthFilter } from './types';
import { cloudflareApi, type AdminLinkCheckResponse } from '../../services/cloudflareApi';
import {
  scanCatalogDataHealth,
  type DataHealthScanReport,
  type DataHealthIssueCategory,
  type AnimeEditorTabId,
} from '../../utils/adminOpsPro';
import {
  scanExtendedDataHealth,
  type ExtendedDataHealthReport,
} from '../../utils/adminPhase35Polish';

type ExtendedDataHealthCategory =
  | 'orphan_franchise_links'
  | 'conflicting_watch_order'
  | 'unverified_cast_entries'
  | 'missing_external_ids';

interface ExtendedDataHealthIssue {
  category: ExtendedDataHealthCategory;
  entityId: string;
  animeId?: number;
  title: string;
  label: string;
  detail: string;
  severity: 'critical' | 'warning';
  targetTab: 'franchises' | 'cast' | 'editor';
}

function normalizeExtendedHealthReport(ext: ExtendedDataHealthReport | null | undefined): {
  issues: ExtendedDataHealthIssue[];
  countsByCategory: Record<ExtendedDataHealthCategory, number>;
} {
  const safe = ext || {
    orphanFranchiseLinks: [],
    conflictingWatchOrders: [],
    unverifiedCastEntries: [],
    missingExternalIds: [],
  };
  const issues: ExtendedDataHealthIssue[] = [];

  for (const item of safe.orphanFranchiseLinks || []) {
    issues.push({
      category: 'orphan_franchise_links',
      entityId: String(item.id ?? item.anime_id),
      animeId: item.anime_id,
      title: item.franchise_title || item.franchise_key,
      label: 'Orphan Franchise Link',
      detail: `Franchise "${item.franchise_key}" (order #${item.watch_order}) points to missing anime #${item.anime_id}.`,
      severity: 'critical',
      targetTab: 'franchises',
    });
  }

  for (const item of safe.conflictingWatchOrders || []) {
    issues.push({
      category: 'conflicting_watch_order',
      entityId: `${item.franchise_key}-${item.watch_order}`,
      title: `Franchise "${item.franchise_key}"`,
      label: 'Conflicting Watch Order',
      detail: `Multiple entries (${item.anime_ids.map((id) => `#${id}`).join(', ')}) share watch_order #${item.watch_order}.`,
      severity: 'warning',
      targetTab: 'franchises',
    });
  }

  for (const item of safe.unverifiedCastEntries || []) {
    issues.push({
      category: 'unverified_cast_entries',
      entityId: String(item.id),
      animeId: item.anime_id,
      title: `${item.character_name} — ${item.voice_actor_name}`,
      label: 'Unverified Cast',
      detail: `${item.anime_title} (${item.language} dub) voice actor credit is pending verification.`,
      severity: 'warning',
      targetTab: 'cast',
    });
  }

  for (const item of safe.missingExternalIds || []) {
    issues.push({
      category: 'missing_external_ids',
      entityId: String(item.anime_id),
      animeId: item.anime_id,
      title: item.title,
      label: 'Missing External ID',
      detail: `No MAL, AniList, or external catalog ID linked for "${item.title}".`,
      severity: 'warning',
      targetTab: 'editor',
    });
  }

  return {
    issues,
    countsByCategory: {
      orphan_franchise_links: (safe.orphanFranchiseLinks || []).length,
      conflicting_watch_order: (safe.conflictingWatchOrders || []).length,
      unverified_cast_entries: (safe.unverifiedCastEntries || []).length,
      missing_external_ids: (safe.missingExternalIds || []).length,
    },
  };
}

export interface DataHealthReport {
  items: Array<{
    anime: any;
    issues: Array<{ label: string; severity: 'critical' | 'warning'; targetEditorTab?: AnimeEditorTabId }>;
  }>;
  summary: {
    all: number;
    missing_stream_links: number;
    missing_dub_langs: number;
    missing_episode_counts: number;
    unverified_metadata: number;
    incomplete_schedule: number;
    healthyCount: number;
  };
}

export interface AdminDataHealthTabProps {
  dataHealthReport?: DataHealthReport;
  catalogList?: any[];
  healthFilter: DataHealthFilter;
  setHealthFilter: (filter: DataHealthFilter) => void;
  onEditAnime: (anime: any, targetEditorTab?: AnimeEditorTabId) => void;
  onJumpToFranchises?: () => void;
  onJumpToCast?: () => void;
  linkCheckReport: AdminLinkCheckResponse | null;
  isCheckingLinks: boolean;
  onRunLinkCheck: () => void;
}

const SCANNER_CATEGORIES: Array<{
  id: 'all' | DataHealthIssueCategory | ExtendedDataHealthCategory;
  label: string;
}> = [
  { id: 'all', label: 'All Flagged Issues' },
  { id: 'missing_artwork', label: 'Missing Posters / Banners' },
  { id: 'missing_synopsis', label: 'Missing Synopsis' },
  { id: 'duplicate_titles', label: 'Potential Duplicates' },
  { id: 'inconsistent_episodes', label: 'Inconsistent Episodes' },
  { id: 'unverified_dubs', label: 'Unverified Dub Claims' },
  { id: 'stale_verification', label: 'Stale Verification (>90d)' },
  { id: 'missing_translations', label: 'Missing Translations' },
  { id: 'orphan_franchise_links', label: 'Orphan Franchise Links' },
  { id: 'conflicting_watch_order', label: 'Conflicting Watch Order' },
  { id: 'unverified_cast_entries', label: 'Unverified Cast Entries' },
  { id: 'missing_external_ids', label: 'Missing External IDs' },
];

export const AdminDataHealthTab: React.FC<AdminDataHealthTabProps> = ({
  catalogList = [],
  healthFilter,
  setHealthFilter,
  onEditAnime,
  onJumpToFranchises,
  onJumpToCast,
  linkCheckReport,
  isCheckingLinks,
  onRunLinkCheck,
}) => {
  const [serverScanReport, setServerScanReport] = useState<DataHealthScanReport | null>(null);
  const [extendedIssues, setExtendedIssues] = useState<ExtendedDataHealthIssue[]>([]);
  const [extendedCounts, setExtendedCounts] = useState<Record<ExtendedDataHealthCategory, number>>({
    orphan_franchise_links: 0,
    conflicting_watch_order: 0,
    unverified_cast_entries: 0,
    missing_external_ids: 0,
  });
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Phase 3.5: Bounded chunked OTT link checker with live progress & Cancel
  const [chunkedLinkReport, setChunkedLinkReport] = useState<AdminLinkCheckResponse | null>(null);
  const [chunkedRunning, setChunkedRunning] = useState(false);
  const [chunkedProgress, setChunkedProgress] = useState<{
    checkedBatches: number;
    totalBatches: number;
    checkedLinks: number;
  } | null>(null);
  const cancelLinksRef = useRef(false);

  const runServerScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const res: any = await cloudflareApi.fetchAdminDataHealth();
      if (res.report) {
        setServerScanReport(res.report);
      }
      const extRaw: ExtendedDataHealthReport | undefined = res.report?.extended || res.extended;
      if (extRaw) {
        const normalized = normalizeExtendedHealthReport(extRaw);
        setExtendedIssues(normalized.issues);
        setExtendedCounts(normalized.countsByCategory);
      } else {
        const localExt = scanExtendedDataHealth({
          animeRows: catalogList.map((a) => ({
            id: Number(a.id),
            title: String(a.title || ''),
            slug: a.slug ?? null,
            mal_id: a.mal_id ?? null,
            anilist_id: a.anilist_id ?? null,
            external_id: a.external_id ?? null,
          })),
          franchiseRows: [],
          castRows: [],
        });
        const normalized = normalizeExtendedHealthReport(localExt);
        setExtendedIssues(normalized.issues);
        setExtendedCounts(normalized.countsByCategory);
      }
    } catch (err: any) {
      setScanError(err?.message || 'Unable to run server Data Health scan; using local catalog audit.');
      const localExt = scanExtendedDataHealth({
        animeRows: catalogList.map((a) => ({
          id: Number(a.id),
          title: String(a.title || ''),
          slug: a.slug ?? null,
          mal_id: a.mal_id ?? null,
          anilist_id: a.anilist_id ?? null,
          external_id: a.external_id ?? null,
        })),
        franchiseRows: [],
        castRows: [],
      });
      const normalized = normalizeExtendedHealthReport(localExt);
      setExtendedIssues(normalized.issues);
      setExtendedCounts(normalized.countsByCategory);
    } finally {
      setIsScanning(false);
    }
  }, [catalogList]);

  useEffect(() => {
    runServerScan();
  }, [runServerScan]);

  const handleRunBoundedChunkedLinks = async () => {
    const withUrls = catalogList
      .filter((a) => a.watch_url || a.streamUrl || a.official_source_url || (Array.isArray(a.streaming_partners) && a.streaming_partners.length > 0))
      .slice(0, 60);

    if (withUrls.length === 0) {
      onRunLinkCheck();
      return;
    }

    cancelLinksRef.current = false;
    setChunkedRunning(true);
    const CHUNK_SIZE = 10;
    const chunks: number[][] = [];
    for (let i = 0; i < withUrls.length; i += CHUNK_SIZE) {
      chunks.push(withUrls.slice(i, i + CHUNK_SIZE).map((a) => Number(a.id)).filter(Number.isFinite));
    }

    const aggregatedResults: AdminLinkCheckResponse['results'] = [];
    const summary = {
      total: 0,
      active: 0,
      redirected: 0,
      broken: 0,
      regionRestricted: 0,
      unverified: 0,
    };

    setChunkedProgress({ checkedBatches: 0, totalBatches: chunks.length, checkedLinks: 0 });

    for (let i = 0; i < chunks.length; i++) {
      if (cancelLinksRef.current) break;
      try {
        const res = await cloudflareApi.checkAdminLinks({ animeIds: chunks[i], limit: 15 });
        if (Array.isArray(res.results)) {
          aggregatedResults.push(...res.results);
        }
        if (res.summary) {
          summary.total += res.summary.total || 0;
          summary.active += res.summary.active || 0;
          summary.redirected += res.summary.redirected || 0;
          summary.broken += res.summary.broken || 0;
          summary.regionRestricted += res.summary.regionRestricted || 0;
          summary.unverified += res.summary.unverified || 0;
        }
        setChunkedLinkReport({
          success: true,
          checkedAt: new Date().toISOString(),
          summary: { ...summary },
          results: [...aggregatedResults],
          note: cancelLinksRef.current
            ? 'Cancelled mid-scan — showing results collected before cancellation.'
            : `Scanned ${i + 1}/${chunks.length} bounded batches (read-only; never auto-modifies links).`,
        });
      } catch {
        // Continue remaining chunks cleanly
      }
      setChunkedProgress({
        checkedBatches: i + 1,
        totalBatches: chunks.length,
        checkedLinks: aggregatedResults.length,
      });
    }

    setChunkedRunning(false);
  };

  const activeLinkReport = chunkedLinkReport || linkCheckReport;
  const effectiveCheckingLinks = chunkedRunning || isCheckingLinks;

  // Fallback local scan if server scan hasn't resolved yet
  const activeScanReport: DataHealthScanReport = useMemo(() => {
    if (serverScanReport) return serverScanReport;
    return scanCatalogDataHealth(catalogList);
  }, [serverScanReport, catalogList]);

  const animeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of catalogList) {
      map.set(String(a.id), a);
    }
    return map;
  }, [catalogList]);

  const isExtendedFilter = (
    f: string
  ): f is ExtendedDataHealthCategory =>
    f === 'orphan_franchise_links' ||
    f === 'conflicting_watch_order' ||
    f === 'unverified_cast_entries' ||
    f === 'missing_external_ids';

  const filteredIssues = useMemo(() => {
    if (isExtendedFilter(healthFilter)) return [];
    if (healthFilter === 'all') return activeScanReport.issues;
    return activeScanReport.issues.filter((iss) => iss.category === healthFilter);
  }, [activeScanReport, healthFilter]);

  const filteredExtendedIssues = useMemo(() => {
    if (healthFilter === 'all') return extendedIssues;
    if (isExtendedFilter(healthFilter)) {
      return extendedIssues.filter((iss) => iss.category === healthFilter);
    }
    return [];
  }, [extendedIssues, healthFilter]);

  const totalCombinedIssues = activeScanReport.issues.length + extendedIssues.length;

  return (
    <div data-testid="admin-data-health-tab" className="space-y-6 text-[var(--text-primary)]">
      {/* Header & Summary */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Catalog Data Health &amp; QA Scanner
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Read-only production QA scan for artwork, synopses, duplicates, episodes, dub claims, translations, orphan franchise links, conflicting watch orders, unverified cast, and missing AniList/MAL IDs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={runServerScan}
            disabled={isScanning}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${isScanning ? 'animate-spin' : ''}`} />
            <span>Re-Scan D1</span>
          </button>

          <button
            type="button"
            onClick={handleRunBoundedChunkedLinks}
            disabled={effectiveCheckingLinks}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {effectiveCheckingLinks ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking OTT Links...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Check Official OTT Links
              </>
            )}
          </button>

          {chunkedRunning && (
            <button
              type="button"
              onClick={() => {
                cancelLinksRef.current = true;
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-500 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}

          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {activeScanReport.healthyCount}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Healthy
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-center">
            <div className="text-base font-black text-amber-600 dark:text-amber-400">
              {activeScanReport.flaggedCount + extendedIssues.length}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Flagged
            </div>
          </div>
        </div>
      </div>

      {/* Live Bounded OTT Link Check Progress Bar */}
      {chunkedRunning && chunkedProgress && (
        <div
          data-testid="ott-link-check-progress"
          className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--accent-primary)]/40 space-y-2"
        >
          <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
            <span>
              Bounded OTT Link Audit: Batch {chunkedProgress.checkedBatches} / {chunkedProgress.totalBatches} ({chunkedProgress.checkedLinks} links checked)
            </span>
            <span className="font-mono text-[var(--accent-primary)]">
              {chunkedProgress.totalBatches > 0
                ? Math.round((chunkedProgress.checkedBatches / chunkedProgress.totalBatches) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] transition-all duration-300"
              style={{
                width: `${
                  chunkedProgress.totalBatches > 0
                    ? Math.round((chunkedProgress.checkedBatches / chunkedProgress.totalBatches) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {scanError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Official OTT Link Health Check Results */}
      {activeLinkReport && (
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[var(--accent-primary)]" />
                SSRF-Protected Official OTT Link Health Report
              </h3>
              {activeLinkReport.note && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{activeLinkReport.note}</p>
              )}
            </div>
            {activeLinkReport.summary && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  OK: {activeLinkReport.summary.active}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400">
                  Redirected: {activeLinkReport.summary.redirected}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                  Blocked/403 or Timeout: {activeLinkReport.summary.unverified + activeLinkReport.summary.regionRestricted}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400">
                  Confirmed Broken: {activeLinkReport.summary.broken}
                </span>
              </div>
            )}
          </div>

          {activeLinkReport.error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {activeLinkReport.error}
            </div>
          )}

          {activeLinkReport.results.length > 0 && (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {activeLinkReport.results.map((item, idx) => (
                <div
                  key={`${item.animeId}-${item.platform}-${idx}`}
                  className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--text-primary)] truncate">
                      {item.title}{' '}
                      <span className="text-[var(--text-secondary)]">({item.platform})</span>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] truncate inline-flex items-center gap-1 max-w-full"
                    >
                      <span className="truncate">{item.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-bold uppercase text-[10px] border ${
                        item.status === 'Active'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : item.status === 'Redirected'
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                            : item.status === 'Unverified' || item.status === 'Region-restricted'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                      }`}
                    >
                      {item.status === 'Active'
                        ? 'OK'
                        : item.status === 'Broken'
                          ? 'Confirmed Broken'
                          : item.status === 'Region-restricted'
                            ? 'Blocked/403'
                            : item.detail?.toLowerCase().includes('timed out')
                              ? 'Timeout'
                              : 'Blocked/403'}
                      {item.httpStatus ? ` (${item.httpStatus})` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scanner Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {SCANNER_CATEGORIES.map((pill) => {
          const count =
            pill.id === 'all'
              ? totalCombinedIssues
              : isExtendedFilter(pill.id)
                ? extendedCounts[pill.id] || 0
                : activeScanReport.countsByCategory[pill.id as DataHealthIssueCategory] || 0;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setHealthFilter(pill.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                healthFilter === pill.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{pill.label}</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-black/15">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Flagged Issues List */}
      {filteredIssues.length === 0 && filteredExtendedIssues.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            No Data Health Issues Found
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            All anime entries in this QA category pass production quality checks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExtendedIssues.slice(0, 80).map((ext, idx) => {
            const matchedAnime = ext.animeId ? animeById.get(String(ext.animeId)) : null;
            return (
              <div
                key={`ext-${ext.category}-${ext.entityId}-${idx}`}
                data-testid={`extended-health-issue-${ext.category}`}
                className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {ext.title}
                    </h4>
                    <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                      #{ext.entityId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                        ext.severity === 'critical'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {ext.label}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 break-words">
                    {ext.detail}
                  </p>
                </div>

                {ext.targetTab === 'franchises' && onJumpToFranchises ? (
                  <button
                    type="button"
                    onClick={onJumpToFranchises}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Open Franchise Builder
                  </button>
                ) : ext.targetTab === 'cast' && onJumpToCast ? (
                  <button
                    type="button"
                    onClick={onJumpToCast}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Open Cast Manager
                  </button>
                ) : matchedAnime ? (
                  <button
                    type="button"
                    onClick={() => onEditAnime(matchedAnime, 'identity')}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Fix in Editor</span>
                  </button>
                ) : null}
              </div>
            );
          })}
          {filteredIssues.slice(0, 120).map((issue, idx) => {
            const fullAnime = animeById.get(String(issue.animeId)) || {
              id: issue.animeId,
              title: issue.title,
              slug: issue.slug,
              cover_image: issue.cover_image,
            };
            return (
              <div
                key={`${issue.animeId}-${issue.category}-${idx}`}
                className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={issue.cover_image || '/logo.png'}
                    alt={issue.title}
                    loading="lazy"
                    className="w-12 h-16 rounded-xl object-cover shrink-0 border border-[var(--border-subtle)]"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {issue.title}
                      </h4>
                      <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                        #{issue.animeId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                          issue.severity === 'critical'
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {issue.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 break-words">
                      {issue.detail}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={`fix-in-editor-${issue.animeId}`}
                  onClick={() => onEditAnime(fullAnime, issue.targetEditorTab)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Fix in Editor</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
