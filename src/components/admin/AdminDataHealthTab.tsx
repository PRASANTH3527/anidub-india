import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Edit3,
  Link2,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import type { DataHealthFilter } from './types';
import type { AdminLinkCheckResponse } from '../../services/cloudflareApi';

export interface DataHealthReport {
  items: Array<{
    anime: any;
    issues: Array<{ label: string; severity: 'critical' | 'warning' }>;
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
  dataHealthReport: DataHealthReport;
  healthFilter: DataHealthFilter;
  setHealthFilter: (filter: DataHealthFilter) => void;
  onEditAnime: (anime: any) => void;
  linkCheckReport: AdminLinkCheckResponse | null;
  isCheckingLinks: boolean;
  onRunLinkCheck: () => void;
}

export const AdminDataHealthTab: React.FC<AdminDataHealthTabProps> = ({
  dataHealthReport,
  healthFilter,
  setHealthFilter,
  onEditAnime,
  linkCheckReport,
  isCheckingLinks,
  onRunLinkCheck,
}) => {
  return (
    <div data-testid="admin-data-health-tab" className="space-y-6 text-[var(--text-primary)]">
      {/* Header & Summary */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Data Health &amp; Catalog Quality Audit
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Automated scan for missing official streaming links, unverified dub language tags, missing episode counts, and incomplete broadcast schedules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRunLinkCheck}
            disabled={isCheckingLinks}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isCheckingLinks ? (
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
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {dataHealthReport.summary.healthyCount}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Healthy
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-center">
            <div className="text-base font-black text-amber-600 dark:text-amber-400">
              {dataHealthReport.summary.all}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Needs Fix
            </div>
          </div>
        </div>
      </div>

      {/* Official OTT Link Health Check Results */}
      {linkCheckReport && (
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[var(--accent-primary)]" />
                Official OTT Link Health Report
              </h3>
              {linkCheckReport.note && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{linkCheckReport.note}</p>
              )}
            </div>
            {linkCheckReport.summary && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  Healthy: {linkCheckReport.summary.active}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400">
                  Redirected: {linkCheckReport.summary.redirected}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                  Unverified (Bot Blocked): {linkCheckReport.summary.unverified}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400">
                  Broken: {linkCheckReport.summary.broken}
                </span>
              </div>
            )}
          </div>

          {linkCheckReport.error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {linkCheckReport.error}
            </div>
          )}

          {linkCheckReport.results.length > 0 && (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {linkCheckReport.results.map((item, idx) => (
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
                      {item.status}
                      {item.httpStatus ? ` (${item.httpStatus})` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: 'All Issues', count: dataHealthReport.summary.all },
            {
              id: 'missing_stream_links',
              label: 'Missing Stream Links',
              count: dataHealthReport.summary.missing_stream_links,
            },
            {
              id: 'missing_dub_langs',
              label: 'Missing Dub Langs',
              count: dataHealthReport.summary.missing_dub_langs,
            },
            {
              id: 'missing_episode_counts',
              label: 'Missing Episode Counts',
              count: dataHealthReport.summary.missing_episode_counts,
            },
            {
              id: 'unverified_metadata',
              label: 'Unverified Metadata',
              count: dataHealthReport.summary.unverified_metadata,
            },
            {
              id: 'incomplete_schedule',
              label: 'Incomplete Schedule',
              count: dataHealthReport.summary.incomplete_schedule,
            },
          ] as Array<{ id: DataHealthFilter; label: string; count: number }>
        ).map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setHealthFilter(pill.id)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
              healthFilter === pill.id
                ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>{pill.label}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-black/15">
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* Results List */}
      {dataHealthReport.items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            No Data Health Issues Found
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            All anime entries in this filter pass metadata quality checks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dataHealthReport.items.map(({ anime, issues }) => (
            <div
              key={anime.id}
              className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={
                    anime.posterUrl ||
                    anime.image ||
                    anime.cover_image ||
                    anime.poster ||
                    'https://picsum.photos/seed/anime/80/120'
                  }
                  alt={anime.title}
                  loading="lazy"
                  className="w-12 h-16 rounded-xl object-cover shrink-0 border border-[var(--border-subtle)]"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {anime.title}
                    </h4>
                    <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                      #{anime.id}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {issues.map((issue, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                          issue.severity === 'critical'
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {issue.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onEditAnime(anime)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold flex items-center gap-1.5 shrink-0 self-end sm:self-center"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Fix in Editor
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
