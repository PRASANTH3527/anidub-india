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
  MessageSquare,
  ShieldAlert,
  Activity,
  Database,
} from 'lucide-react';
import type { AdminActiveTab, AdminFeedbackItem, AdminOverviewStats } from './types';

export interface AdminOverviewTabProps {
  stats: AdminOverviewStats;
  pendingItems: any[];
  feedbackList: AdminFeedbackItem[];
  onSetActiveTab: (tab: AdminActiveTab) => void;
  onOpenAddModal: () => void;
  onFilterCatalogByLanguage?: (language: string) => void;
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
  onApprovePending,
  onRejectPending,
}) => {
  const openFeedbackItems = (feedbackList || []).filter(
    (f) => String(f.status || 'open').toLowerCase() !== 'resolved'
  );
  const totalModerationQueue = stats.pendingModerationCount + stats.openFeedbackCount;

  const languageOrder = [
    { key: 'Hindi', label: 'Hindi Dubs', color: 'bg-amber-500' },
    { key: 'Tamil', label: 'Tamil Dubs', color: 'bg-rose-500' },
    { key: 'Telugu', label: 'Telugu Dubs', color: 'bg-sky-500' },
    { key: 'Malayalam', label: 'Malayalam Dubs', color: 'bg-emerald-500' },
    { key: 'Kannada', label: 'Kannada Dubs', color: 'bg-purple-500' },
    { key: 'Bengali', label: 'Bengali Dubs', color: 'bg-pink-500' },
    { key: 'Unverified', label: 'Unverified / No Dub Tags', color: 'bg-neutral-500' },
  ];

  return (
    <div data-testid="admin-overview-tab" className="space-y-6 text-[var(--text-primary)]">
      {/* 1. COMMAND CENTER HEADER & QUICK ACTIONS */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {stats.d1Connected ? `Cloudflare D1 Connected (${stats.d1LatencyMs}ms)` : 'D1 Local Runtime'}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              {stats.totalAnimeCount.toLocaleString()} total records
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Admin Command Center
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Real-time Cloudflare D1 catalog health, regional dub coverage, and community moderation queue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenAddModal}
            data-testid="command-center-add-anime"
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Anime
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTab('catalog')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs sm:text-sm font-bold flex items-center gap-2 transition-all"
          >
            <Film className="w-4 h-4 text-[var(--accent-primary)]" />
            Open Catalog
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTab('moderation')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs sm:text-sm font-bold flex items-center gap-2 transition-all"
          >
            <Clock className="w-4 h-4 text-amber-500" />
            Open Moderation
            {totalModerationQueue > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-extrabold">
                {totalModerationQueue}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. FOUR CORE D1 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onSetActiveTab('catalog')}
          className="text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 transition-all flex flex-col justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Published Anime
            </span>
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary)]/15 flex items-center justify-center text-[var(--accent-primary)]">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {stats.publishedAnimeCount.toLocaleString()}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Live in public catalog • {stats.reviewsCount.toLocaleString()} reviews
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSetActiveTab('moderation')}
          className="text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-amber-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Pending &amp; Open Feedback
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {totalModerationQueue.toLocaleString()}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {stats.pendingModerationCount} pending dubs • {stats.openFeedbackCount} open tickets
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onFilterCatalogByLanguage) {
              onFilterCatalogByLanguage('Unverified');
            } else {
              onSetActiveTab('dubs');
            }
          }}
          className="text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-rose-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Unverified Dubs
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {stats.unverifiedDubsCount.toLocaleString()}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Anime entries without verified regional dub tags
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSetActiveTab('translations')}
          className="text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-sky-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Missing Translations
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-500">
              <Languages className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {stats.missingTranslationsCount.toLocaleString()}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Titles awaiting native regional synopsis translation
            </p>
          </div>
        </button>
      </div>

      {/* 3. ACTIONABLE "NEEDS YOUR ATTENTION" & REGIONAL DUB COVERAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Needs Your Attention (7 cols) */}
        <div
          data-testid="needs-your-attention-card"
          className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Needs Your Attention
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Priority action items detected across Cloudflare D1 tables
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSetActiveTab('data_health')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1"
            >
              Data Health <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Action Item 1: Pending Submissions */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    {stats.pendingModerationCount > 0
                      ? `${stats.pendingModerationCount} Pending Community Dub Submissions`
                      : 'Pending Moderation Queue Clear'}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {stats.pendingModerationCount > 0
                      ? 'Verify OTT partner links and dub language tags before publishing.'
                      : 'All community anime submissions have been reviewed.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSetActiveTab('moderation')}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-on-primary,#fff)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] shrink-0 transition-all"
              >
                Review Queue
              </button>
            </div>

            {/* Action Item 2: Open User Feedback Tickets */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    {openFeedbackItems.length > 0
                      ? `${openFeedbackItems.length} Open User Feedback Tickets`
                      : 'No Open User Feedback Tickets'}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {openFeedbackItems.length > 0
                      ? `Latest from ${openFeedbackItems[0]?.name || openFeedbackItems[0]?.author || 'Community Member'}`
                      : 'All user feedback tickets are resolved.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSetActiveTab('moderation')}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-on-primary,#fff)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] shrink-0 transition-all"
              >
                Open Tickets
              </button>
            </div>

            {/* Action Item 3: Unverified Dubs */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    {stats.unverifiedDubsCount > 0
                      ? `${stats.unverifiedDubsCount} Anime With Unverified Dub Languages`
                      : 'All Catalog Entries Have Verified Dub Tags'}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Entries without explicit regional dub tags remain marked Unverified (never auto-defaulted).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onFilterCatalogByLanguage) {
                    onFilterCatalogByLanguage('Unverified');
                  } else {
                    onSetActiveTab('dubs');
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-on-primary,#fff)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] shrink-0 transition-all"
              >
                Inspect Dubs
              </button>
            </div>

            {/* Action Item 4: Missing Native Synopsis Translations */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Languages className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    {stats.missingTranslationsCount > 0
                      ? `${stats.missingTranslationsCount} Titles Missing Native Translations`
                      : 'Native Synopsis Translations Up to Date'}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Manage additive Tamil, Hindi, Telugu, Malayalam, Kannada &amp; Bengali synopses.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSetActiveTab('translations')}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-on-primary,#fff)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] shrink-0 transition-all"
              >
                Translations
              </button>
            </div>
          </div>

          {/* Inline Fast Approval Preview when pending items exist */}
          {pendingItems.length > 0 && (
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                Latest Pending Submissions
              </span>
              {pendingItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h5 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                      {item.title}
                    </h5>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {Array.isArray(item.languages) && item.languages.length > 0
                        ? item.languages.join(', ')
                        : typeof item.languages === 'string' && item.languages.trim()
                          ? item.languages
                          : 'Unverified Dubs'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApprovePending(item.id)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectPending(item.id)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Regional Dub Coverage Breakdown (5 cols) */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between gap-5 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--accent-primary)]" />
                  Regional Dub Intelligence
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Verified D1 language distribution across {stats.totalAnimeCount || 0} titles
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSetActiveTab('dubs')}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)]"
              >
                Manage Dubs
              </button>
            </div>

            <div className="space-y-3">
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
                    className="w-full text-left space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                        {lang.label}
                      </span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {count.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${lang.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5 font-semibold">
              <Database className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Watchlist saves: {stats.watchlistCount.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Reports: {stats.reportsCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
