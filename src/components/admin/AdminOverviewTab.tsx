import React from 'react';
import {
  Film,
  Clock,
  Globe,
  Languages,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Database,
  MessageSquare,
  Tag,
} from 'lucide-react';
import type { AdminActiveTab, AdminFeedbackItem, AdminOverviewStats } from './types';
import { partitionOverviewAttentionChecks } from '../../utils/adminShellLayout';
import { rankGenreCounts } from '../../utils/adminLegacyRestore';

export interface AdminOverviewTabProps {
  stats: AdminOverviewStats;
  pendingItems: any[];
  feedbackList: AdminFeedbackItem[];
  onSetActiveTab: (tab: AdminActiveTab) => void;
  onOpenAddModal: () => void;
  onFilterCatalogByLanguage?: (language: string) => void;
  onFilterCatalogByGenre?: (genre: string) => void;
  onApprovePending: (id: number | string) => void;
  onRejectPending: (id: number | string) => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  stats,
  pendingItems,
  feedbackList,
  onSetActiveTab,
  onOpenAddModal,
  onFilterCatalogByLanguage,
  onFilterCatalogByGenre,
  onApprovePending,
  onRejectPending,
}) => {
  const openFeedbackItems = (feedbackList || []).filter(
    (f) => String(f.status || 'open').toLowerCase() !== 'resolved'
  );
  const effectiveOpenTickets = Math.max(openFeedbackItems.length, stats.openFeedbackCount || 0);
  const totalModerationQueue = stats.pendingModerationCount + effectiveOpenTickets;

  const { actionableAlerts, healthySummaryText } = partitionOverviewAttentionChecks(
    stats,
    effectiveOpenTickets
  );

  const languageOrder = [
    { key: 'Hindi', label: 'Hindi', color: 'bg-amber-500' },
    { key: 'Tamil', label: 'Tamil', color: 'bg-rose-500' },
    { key: 'Telugu', label: 'Telugu', color: 'bg-sky-500' },
    { key: 'Malayalam', label: 'Malayalam', color: 'bg-emerald-500' },
    { key: 'Kannada', label: 'Kannada', color: 'bg-purple-500' },
    { key: 'Bengali', label: 'Bengali', color: 'bg-pink-500' },
    { key: 'Unverified', label: 'Unverified', color: 'bg-neutral-500' },
  ];

  const handleAlertAction = (alert: (typeof actionableAlerts)[number]) => {
    if (alert.filterLanguage && onFilterCatalogByLanguage) {
      onFilterCatalogByLanguage(alert.filterLanguage);
      return;
    }
    onSetActiveTab(alert.targetTab);
  };

  return (
    <div data-testid="admin-overview-tab" className="space-y-3 text-[var(--text-primary)]">
      {/* 1. COMPACT TOP HERO BAR (D1 Connected + 3 Inline Action Pills) */}
      <div
        data-testid="admin-overview-hero"
        className="px-3.5 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                stats.d1Connected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            {stats.d1Connected ? 'D1 Connected' : 'D1 Local'}
          </span>
          <span className="text-[var(--text-secondary)] text-xs" aria-hidden="true">
            ·
          </span>
          <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)] whitespace-nowrap">
            {stats.d1Connected ? `${stats.d1LatencyMs}ms` : 'Standby'} ·{' '}
            {stats.totalAnimeCount.toLocaleString()} records
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={onOpenAddModal}
            data-testid="command-center-add-anime"
            className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer hover:opacity-95 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>+ Add</span>
          </button>

          <button
            type="button"
            onClick={() => onSetActiveTab('catalog')}
            className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Film className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            <span>Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => onSetActiveTab('moderation')}
            className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Moderation</span>
            {totalModerationQueue > 0 && (
              <span className="font-mono tabular-nums text-[11px] font-extrabold text-amber-500">
                ({totalModerationQueue})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. COMPACT 2x2 KPI BENTO GRID (2x2 on Mobile, 4-Column Row on Desktop) */}
      <div
        data-testid="admin-kpi-bento-grid"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <button
          type="button"
          data-testid="kpi-card-published"
          onClick={() => onSetActiveTab('catalog')}
          className="text-left p-3 sm:p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/60 transition-colors flex flex-col justify-between gap-2 min-h-[88px] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] truncate">
              Published Anime
            </span>
            <Film className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[var(--text-primary)] leading-tight">
              {stats.publishedAnimeCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5 tabular-nums">
              {stats.reviewsCount.toLocaleString()} reviews
            </p>
          </div>
        </button>

        <button
          type="button"
          data-testid="kpi-card-pending"
          onClick={() => onSetActiveTab('moderation')}
          className="text-left p-3 sm:p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-amber-500/60 transition-colors flex flex-col justify-between gap-2 min-h-[88px] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] truncate">
              Pending
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[var(--text-primary)] leading-tight">
              {totalModerationQueue.toLocaleString()}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5 tabular-nums">
              {stats.pendingModerationCount} dubs · {effectiveOpenTickets} tickets
            </p>
          </div>
        </button>

        <button
          type="button"
          data-testid="kpi-card-unverified"
          onClick={() => {
            if (onFilterCatalogByLanguage) {
              onFilterCatalogByLanguage('Unverified');
            } else {
              onSetActiveTab('dubs');
            }
          }}
          className="text-left p-3 sm:p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-rose-500/60 transition-colors flex flex-col justify-between gap-2 min-h-[88px] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] truncate">
              Unverified Dubs
            </span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[var(--text-primary)] leading-tight">
              {stats.unverifiedDubsCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
              {stats.unverifiedDubsCount > 0 ? 'Needs dub tags' : 'All verified'}
            </p>
          </div>
        </button>

        <button
          type="button"
          data-testid="kpi-card-translations"
          onClick={() => onSetActiveTab('translations')}
          className="text-left p-3 sm:p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-sky-500/60 transition-colors flex flex-col justify-between gap-2 min-h-[88px] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] truncate">
              Missing Translations
            </span>
            <Languages className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[var(--text-primary)] leading-tight">
              {stats.missingTranslationsCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
              {stats.missingTranslationsCount > 0 ? 'Open studio →' : 'Up to date'}
            </p>
          </div>
        </button>
      </div>

      {/* 3. DECLUTTERED NEEDS ATTENTION + REGIONAL DUB INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Needs Your Attention (7 cols on desktop) */}
        <div
          data-testid="needs-your-attention-card"
          className="lg:col-span-7 p-3.5 sm:p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Needs Your Attention</span>
            </h3>
            <button
              type="button"
              onClick={() => onSetActiveTab('data_health')}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Data Health</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Single Compact 1-Line Green Status Strip for all 0-count healthy checks */}
          {healthySummaryText && (
            <div
              data-testid="overview-healthy-strip"
              className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 overflow-x-auto no-scrollbar"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap font-mono tabular-nums">{healthySummaryText}</span>
            </div>
          )}

          {/* Actionable Non-Zero Alerts ONLY */}
          {actionableAlerts.length > 0 && (
            <div className="space-y-2">
              {actionableAlerts.map((alert) => {
                const iconEl =
                  alert.id === 'moderation' ? (
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : alert.id === 'tickets' ? (
                    <MessageSquare className="w-4 h-4 text-sky-500 shrink-0" />
                  ) : alert.id === 'unverified' ? (
                    <Globe className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <Languages className="w-4 h-4 text-purple-500 shrink-0" />
                  );

                return (
                  <div
                    key={alert.id}
                    data-testid={`overview-alert-${alert.id}`}
                    className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {iconEl}
                      <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate tabular-nums">
                        {alert.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAlertAction(alert)}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-on-primary,#fff)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      {alert.actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Compact Inline Fast-Approve Preview ONLY when real pending submissions exist */}
          {pendingItems.length > 0 && (
            <div className="pt-2.5 border-t border-[var(--border-subtle)] space-y-2">
              <div className="text-[11px] font-bold text-[var(--text-secondary)]">
                Latest Pending Submissions
              </div>
              {pendingItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {Array.isArray(item.languages) && item.languages.length > 0
                        ? item.languages.join(', ')
                        : typeof item.languages === 'string' && item.languages.trim()
                          ? item.languages
                          : 'Unverified Dubs'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApprovePending(item.id)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectPending(item.id)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Regional Dub Intelligence (5 cols on desktop) */}
        <div
          data-testid="regional-dub-intelligence-card"
          className="lg:col-span-5 p-3.5 sm:p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span className="truncate">Regional Dub Intelligence</span>
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                  {stats.totalAnimeCount || 0} catalog titles
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSetActiveTab('dubs')}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Dubs Matrix →
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 gap-x-3 gap-y-2">
              {languageOrder.map((lang) => {
                const count = Number(stats.languageCounts?.[lang.key] || 0);
                const denom = Math.max(1, stats.totalAnimeCount || stats.publishedAnimeCount || 1);
                const pct = Math.min(100, Math.round((count / denom) * 100));

                return (
                  <button
                    key={lang.key}
                    type="button"
                    onClick={() =>
                      onFilterCatalogByLanguage
                        ? onFilterCatalogByLanguage(lang.key)
                        : onSetActiveTab('catalog')
                    }
                    className="w-full text-left space-y-1 group cursor-pointer py-0.5"
                  >
                    <div className="flex items-center justify-between text-xs gap-1">
                      <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                        {lang.label}
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-[var(--text-secondary)] shrink-0">
                        {count.toLocaleString()} · {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${lang.color} rounded-full transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              Watchlists: {stats.watchlistCount.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Reports: {stats.reportsCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 4. RESTORED OVERVIEW GENRE DISTRIBUTION CHART (Real D1 Counts, 12-Theme Semantic Tokens) */}
      {(() => {
        const rankedGenres = rankGenreCounts(
          stats.genreCounts,
          stats.totalAnimeCount || stats.publishedAnimeCount || 1,
          10
        );
        const maxGenreCount = Math.max(1, rankedGenres[0]?.count || 1);
        const barColors = [
          'bg-[var(--accent-primary)]',
          'bg-amber-500',
          'bg-sky-500',
          'bg-emerald-500',
          'bg-purple-500',
          'bg-rose-500',
          'bg-pink-500',
          'bg-indigo-500',
          'bg-teal-500',
          'bg-orange-500',
        ];

        return (
          <div
            data-testid="overview-genre-distribution-card"
            className="p-3.5 sm:p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span className="truncate">Catalog Genre Distribution</span>
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                  {rankedGenres.length > 0
                    ? `Top ${rankedGenres.length} genres across ${(stats.totalAnimeCount || 0).toLocaleString()} D1 titles · Click any genre to filter`
                    : 'Live genre tags synced from Cloudflare D1 catalog'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSetActiveTab('analytics')}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Analytics 2.0 →
              </button>
            </div>

            {rankedGenres.length === 0 ? (
              <div className="px-3 py-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] text-center">
                No genre tags recorded yet in D1 catalog.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-2.5">
                {rankedGenres.map((item, idx) => {
                  const relativeWidth = Math.max(
                    6,
                    Math.round((item.count / maxGenreCount) * 100)
                  );
                  return (
                    <button
                      key={item.genre}
                      type="button"
                      data-testid={`overview-genre-bar-${item.genre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      onClick={() =>
                        onFilterCatalogByGenre
                          ? onFilterCatalogByGenre(item.genre)
                          : onSetActiveTab('catalog')
                      }
                      className="w-full text-left space-y-1 group cursor-pointer py-0.5"
                    >
                      <div className="flex items-center justify-between text-xs gap-1.5">
                        <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                          {item.genre}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-[var(--text-secondary)] shrink-0">
                          {item.count.toLocaleString()} · {item.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColors[idx % barColors.length]} rounded-full transition-all duration-300`}
                          style={{ width: `${relativeWidth}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
