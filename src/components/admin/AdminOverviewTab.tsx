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
  Database,
  MessageSquare,
  Tag,
  TrendingUp,
  Upload,
  FileSpreadsheet,
  HelpCircle,
  Activity,
  Download,
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
  onTriggerCsvUpload?: () => void;
  onDownloadSampleCsv?: () => void;
  onOpenCsvHelp?: () => void;
  onOpenBackupJson?: () => void;
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
  onTriggerCsvUpload,
  onDownloadSampleCsv,
  onOpenCsvHelp,
  onOpenBackupJson,
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

  const languageLegend = [
    { key: 'Hindi', label: 'Hindi Dubbed', color: '#8B5CF6', dotClass: 'bg-purple-500' },
    { key: 'Tamil', label: 'Tamil Dubbed', color: '#06B6D4', dotClass: 'bg-cyan-500' },
    { key: 'Telugu', label: 'Telugu Dubbed', color: '#10B981', dotClass: 'bg-emerald-500' },
    { key: 'Malayalam', label: 'Malayalam Dubbed', color: '#F59E0B', dotClass: 'bg-amber-500' },
    { key: 'Kannada', label: 'Kannada Dubbed', color: '#EC4899', dotClass: 'bg-pink-500' },
    { key: 'Bengali', label: 'Bengali Dubbed', color: '#3B82F6', dotClass: 'bg-blue-500' },
  ];

  const totalLangHits = Math.max(
    1,
    languageLegend.reduce((acc, l) => acc + Number(stats.languageCounts?.[l.key] || 0), 0)
  );

  // Build SVG Donut segments
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;
  const donutSegments = languageLegend.map((lang) => {
    const count = Number(stats.languageCounts?.[lang.key] || 0);
    const fraction = count / totalLangHits;
    const strokeDasharray = `${Math.max(0, fraction * circumference)} ${circumference}`;
    const strokeDashoffset = -cumulativePercent * circumference;
    cumulativePercent += fraction;
    return {
      ...lang,
      count,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const verifiedOttCount = Math.max(
    0,
    (stats.totalAnimeCount || stats.publishedAnimeCount || 0) - (stats.unverifiedDubsCount || 0)
  );
  const communityUpvotesTotal =
    (stats.watchlistCount || 0) + (stats.reviewsCount || 0) + (stats.publishedAnimeCount || 0);

  const handleAlertAction = (alert: (typeof actionableAlerts)[number]) => {
    if (alert.filterLanguage && onFilterCatalogByLanguage) {
      onFilterCatalogByLanguage(alert.filterLanguage);
      return;
    }
    onSetActiveTab(alert.targetTab);
  };

  return (
    <div data-testid="admin-overview-tab" className="space-y-4 text-[var(--text-primary)]">
      {/* 1. 4 CLASSIC FULL-WIDTH DARK STAT CARDS */}
      <div
        data-testid="admin-kpi-bento-grid"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        {/* Card 1: DUBBED CATALOG */}
        <button
          type="button"
          data-testid="kpi-card-published"
          onClick={() => onSetActiveTab('catalog')}
          className="text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-purple-500/50 transition-all flex flex-col justify-between gap-3 shadow-md cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2 w-full">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                DUBBED CATALOG
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-[var(--text-primary)] mt-1.5">
                {(stats.totalAnimeCount || stats.publishedAnimeCount || 0).toLocaleString()}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Cloudflare D1 Records</span>
          </div>
        </button>

        {/* Card 2: VERIFIED OTT LINKS */}
        <button
          type="button"
          data-testid="kpi-card-unverified"
          onClick={() => onSetActiveTab('catalog')}
          className="text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-cyan-500/50 transition-all flex flex-col justify-between gap-3 shadow-md cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2 w-full">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                VERIFIED OTT LINKS
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-[var(--text-primary)] mt-1.5">
                {verifiedOttCount.toLocaleString()}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Active Stream Routing</span>
          </div>
        </button>

        {/* Card 3: PENDING REVIEWS */}
        <button
          type="button"
          data-testid="kpi-card-pending"
          onClick={() => onSetActiveTab('pending')}
          className="text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-amber-500/50 transition-all flex flex-col justify-between gap-3 shadow-md cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2 w-full">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                PENDING REVIEWS
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-[var(--text-primary)] mt-1.5">
                {stats.pendingModerationCount.toLocaleString()}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Awaiting Mod Verification</span>
          </div>
        </button>

        {/* Card 4: COMMUNITY UPVOTES */}
        <button
          type="button"
          data-testid="kpi-card-translations"
          onClick={() => onSetActiveTab('analytics')}
          className="text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-purple-500/50 transition-all flex flex-col justify-between gap-3 shadow-md cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2 w-full">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                COMMUNITY UPVOTES
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-[var(--text-primary)] mt-1.5">
                {communityUpvotesTotal.toLocaleString()}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Real Engagement Total</span>
          </div>
        </button>
      </div>

      {/* 2. REGIONAL AUDIO DISTRIBUTION (DONUT CHART) + TOP DUBBED GENRES (BAR CHART) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Regional Audio Distribution Card */}
        <div
          data-testid="regional-dub-intelligence-card"
          className="lg:col-span-6 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between gap-4 shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                Regional Audio Distribution
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Breakdown of active regional dubs across India
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 text-[11px] font-extrabold whitespace-nowrap">
              Live Telemetry
            </span>
          </div>

          {/* Interactive SVG Donut Chart */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-44 h-44 -rotate-90" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="16"
                  className="text-[var(--bg-elevated)]"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.key}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="16"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    strokeLinecap="butt"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black font-mono tabular-nums text-[var(--text-primary)]">
                  {(stats.totalAnimeCount || stats.publishedAnimeCount || 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)]">
                  TITLES
                </span>
              </div>
            </div>
          </div>

          {/* Language Legend Grid */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
            {languageLegend.map((lang) => {
              const count = Number(stats.languageCounts?.[lang.key] || 0);
              return (
                <button
                  key={lang.key}
                  type="button"
                  onClick={() =>
                    onFilterCatalogByLanguage
                      ? onFilterCatalogByLanguage(lang.key)
                      : onSetActiveTab('catalog')
                  }
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)]/60 hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${lang.dotClass}`} />
                    <span className="text-xs font-bold text-[var(--text-secondary)] truncate">
                      {lang.label}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-[var(--text-primary)] shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top Dubbed Genres Card (Vertical Gradient Bars) */}
        {(() => {
          const rankedGenres = rankGenreCounts(
            stats.genreCounts,
            stats.totalAnimeCount || stats.publishedAnimeCount || 1,
            6
          );
          const maxGenreCount = Math.max(1, rankedGenres[0]?.count || 1);

          return (
            <div
              data-testid="overview-genre-distribution-card"
              className="lg:col-span-6 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between gap-4 shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    Top Dubbed Genres
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Most popular genres in regional audio
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[11px] font-extrabold whitespace-nowrap">
                  Live Counts
                </span>
              </div>

              {rankedGenres.length === 0 ? (
                <div className="px-3 py-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] text-center">
                  No genre tags recorded yet in D1 catalog.
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2.5 items-end h-48 pt-6 pb-2 px-1 border-b border-[var(--border-subtle)]">
                  {rankedGenres.map((item) => {
                    const heightPct = Math.max(
                      16,
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
                        className="h-full flex flex-col items-center justify-end gap-1.5 group cursor-pointer min-w-0"
                        title={`${item.genre}: ${item.count} titles (${item.percentage}%)`}
                      >
                        <span className="text-[10px] font-mono font-extrabold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                          {item.count}
                        </span>
                        <div className="w-full max-w-[38px] bg-[var(--bg-elevated)] rounded-t-xl h-32 flex items-end overflow-hidden">
                          <div
                            className="w-full rounded-t-xl bg-gradient-to-t from-purple-600 via-indigo-500 to-cyan-400 group-hover:opacity-90 transition-all duration-300"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate w-full text-center">
                          {item.genre}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" />
                  Click any genre column to filter catalog
                </span>
                <button
                  type="button"
                  onClick={() => onSetActiveTab('analytics')}
                  className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                >
                  Edge Analytics →
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. ADMIN QUICK OPERATIONS DECK (Classic 2-Column Icon Tile Deck) */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3.5 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
              ADMIN QUICK OPERATIONS DECK
            </h3>
          </div>
          <button
            type="button"
            onClick={onOpenAddModal}
            data-testid="command-center-add-anime"
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Anime</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => (onTriggerCsvUpload ? onTriggerCsvUpload() : onSetActiveTab('backup'))}
            className="p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-emerald-500/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload className="w-5 h-5 text-emerald-400" />
            <div className="text-xs font-extrabold text-[var(--text-primary)]">Import CSV</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Bulk Upload</div>
          </button>

          <button
            type="button"
            onClick={() => (onDownloadSampleCsv ? onDownloadSampleCsv() : onSetActiveTab('backup'))}
            className="p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-purple-500/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-5 h-5 text-purple-400" />
            <div className="text-xs font-extrabold text-[var(--text-primary)]">CSV Template</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Sample File</div>
          </button>

          <button
            type="button"
            onClick={() => (onOpenCsvHelp ? onOpenCsvHelp() : onSetActiveTab('backup'))}
            className="p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-cyan-500/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer"
          >
            <HelpCircle className="w-5 h-5 text-cyan-400" />
            <div className="text-xs font-extrabold text-[var(--text-primary)]">CSV Guide</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Pipe Format</div>
          </button>

          <button
            type="button"
            onClick={() => onSetActiveTab('imdb_checker')}
            className="p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-amber-500/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer"
          >
            <Activity className="w-5 h-5 text-amber-400" />
            <div className="text-xs font-extrabold text-[var(--text-primary)]">IMDb Probe</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Verify Scores</div>
          </button>

          <button
            type="button"
            onClick={() => (onOpenBackupJson ? onOpenBackupJson() : onSetActiveTab('settings'))}
            className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-purple-500/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-5 h-5 text-purple-400" />
            <div className="text-xs font-extrabold text-[var(--text-primary)]">Full Backup</div>
            <div className="text-[11px] text-[var(--text-secondary)]">JSON Snapshot</div>
          </button>
        </div>
      </div>

      {/* 4. LIVE MODERATION & HEALTH STATUS STRIP */}
      <div
        data-testid="needs-your-attention-card"
        className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>System &amp; Moderation Queue Status</span>
          </h3>
          <button
            type="button"
            onClick={() => onSetActiveTab('data_health')}
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-cyan-400 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Data Health</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {healthySummaryText && (
          <div
            data-testid="overview-healthy-strip"
            className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-center gap-2 overflow-x-auto no-scrollbar"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap font-mono tabular-nums">{healthySummaryText}</span>
          </div>
        )}

        {actionableAlerts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {actionableAlerts.map((alert) => {
              const iconEl =
                alert.id === 'moderation' ? (
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                ) : alert.id === 'tickets' ? (
                  <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
                ) : alert.id === 'unverified' ? (
                  <Globe className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Languages className="w-4 h-4 text-purple-400 shrink-0" />
                );

              return (
                <div
                  key={alert.id}
                  data-testid={`overview-alert-${alert.id}`}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {iconEl}
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate tabular-nums">
                      {alert.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAlertAction(alert)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-purple-600 hover:text-white border border-[var(--border-subtle)] text-xs font-bold text-purple-400 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    {alert.actionLabel}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {pendingItems.length > 0 && (
          <div className="pt-2.5 border-t border-[var(--border-subtle)] space-y-2">
            <div className="text-[11px] font-bold text-[var(--text-secondary)]">
              Latest Pending Submissions ({pendingItems.length})
            </div>
            {pendingItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-2"
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
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectPending(item.id)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
