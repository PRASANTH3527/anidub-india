import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Users,
  Eye,
  Clock,
  Compass,
  Globe,
  MapPin,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  ArrowUpRight,
  ExternalLink,
  AlertCircle,
  BarChart3,
  Search,
  Plus,
  Languages,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cloudflareApi } from '../services/cloudflareApi';
import { calculateDevicePercentage } from '../utils/analytics';
import { computeOttPerformanceCtr } from '../utils/adminPhase3Intelligence';

type DemandAnalyticsState = Awaited<
  ReturnType<typeof cloudflareApi.fetchAdminDemandAnalytics>
>;

export interface AnalyticsDashboardProps {
  onNavigateHome?: () => void;
  onSelectAnimeSlug?: (slug: string) => void;
  onAddMissingAnimeTitle?: (title: string) => void;
  onJumpToDataHealth?: (filterKey?: string) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  onSelectAnimeSlug,
  onAddMissingAnimeTitle,
  onJumpToDataHealth,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [demandData, setDemandData] = useState<DemandAnalyticsState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  // Phase 3 Timeframe Selector: 'today' | '7d' | '30d' | '90d'
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d'>('30d');
  // Do NOT run aggressive polling by default — manual refresh is primary
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [isTabVisible, setIsTabVisible] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );

  const fetchAnalytics = useCallback(
    async (showSpin = true) => {
      if (showSpin) setIsRefreshing(true);
      try {
        const [detailedRes, demandRes] = await Promise.all([
          cloudflareApi.fetchAnalyticsDashboardDetailed(timeRange),
          cloudflareApi.fetchAdminDemandAnalytics(timeRange).catch(() => null),
        ]);

        if (demandRes && demandRes.success) {
          setDemandData(demandRes);
        }

        if (detailedRes.ok && detailedRes.data) {
          setData(detailedRes.data);
          setErrorMsg(null);
          setLastRefreshedAt(new Date().toLocaleTimeString());
        } else if (demandRes && demandRes.success) {
          // Even if edge visitor telemetry has no rows yet, demand intelligence succeeded
          setErrorMsg(null);
          setLastRefreshedAt(new Date().toLocaleTimeString());
        } else {
          setErrorMsg(
            detailedRes.error || 'Failed to load analytics data from Cloudflare D1.'
          );
        }
      } catch (err: any) {
        setErrorMsg(
          err?.message || 'Unable to connect to Cloudflare D1 Analytics endpoint.'
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [timeRange]
  );

  useEffect(() => {
    setLoading(true);
    void fetchAnalytics(true);
  }, [fetchAnalytics]);

  // Visibility-aware optional refresh (only when explicitly enabled by admin)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      if (visible && autoRefresh) {
        void fetchAnalytics(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoRefresh, fetchAnalytics]);

  useEffect(() => {
    if (!autoRefresh || !isTabVisible) return;
    const interval = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void fetchAnalytics(false);
      }
    }, 60000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, isTabVisible, fetchAnalytics]);

  const formatSeconds = (sec: number): string => {
    if (!sec || isNaN(sec)) return '0s';
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const getCountryFlag = (code: string): string => {
    const c = (code || '').toUpperCase();
    if (c === 'IN') return '🇮🇳';
    if (c === 'US') return '🇺🇸';
    if (c === 'GB' || c === 'UK') return '🇬🇧';
    if (c === 'AE') return '🇦🇪';
    if (c === 'CA') return '🇨🇦';
    if (c === 'AU') return '🇦🇺';
    if (c === 'JP') return '🇯🇵';
    if (c === 'SG') return '🇸🇬';
    if (c === 'DE') return '🇩🇪';
    return '🌐';
  };

  const getDeviceIcon = (type: string) => {
    const lower = (type || '').toLowerCase();
    if (lower.includes('mobile')) return <Smartphone className="w-3.5 h-3.5 text-sky-500" />;
    if (lower.includes('tablet')) return <Tablet className="w-3.5 h-3.5 text-purple-500" />;
    return <Monitor className="w-3.5 h-3.5 text-emerald-500" />;
  };

  const liveCount = data?.liveUsersCount ?? 0;
  const totalSessions = data?.totalSessions ?? 0;
  const uniqueVisitors = data?.uniqueVisitors ?? 0;
  const totalPageviews = data?.totalPageviews ?? 0;
  const avgDuration = formatSeconds(data?.avgDurationSeconds || 0);
  const avgScroll = data?.avgScrollDepth ?? 0;
  const bounceRate = data?.bounceRatePercent ?? 0;

  const topPagesList: any[] = Array.isArray(data?.topPages) ? data.topPages : [];
  const regionsList: any[] = Array.isArray(data?.regions)
    ? data.regions
    : Array.isArray(data?.cities)
      ? data.cities
      : [];
  const citiesList: any[] = Array.isArray(data?.cities) ? data.cities : [];
  const countriesList: any[] = Array.isArray(data?.countries) ? data.countries : [];
  const devicesList: any[] = Array.isArray(data?.devices) ? data.devices : [];
  const browsersList: any[] = Array.isArray(data?.browsers) ? data.browsers : [];
  const osList: any[] = Array.isArray(data?.os) ? data.os : [];
  const outboundList: any[] = Array.isArray(data?.outboundClicks) ? data.outboundClicks : [];
  const recentEventsList: any[] = Array.isArray(data?.recentEvents) ? data.recentEvents : [];

  const totalDeviceVisitors = devicesList.reduce((acc, d) => acc + (Number(d.count) || 0), 0);

  // Phase 3 Content Demand Intelligence arrays
  const missingSearches = demandData?.missingSearches || [];
  const regionalLanguageDemand = demandData?.languageDemand || [];
  const ottPerformance = demandData?.ottPerformance || [];
  const completenessGaps = demandData?.completenessGaps || null;

  const maxLanguageDemandEvents = Math.max(
    ...regionalLanguageDemand.map((l) => Number(l.eventCount) || 0),
    1
  );

  const getProviderBadge = (provider: string, url: string) => {
    const p = `${provider || ''} ${url || ''}`.toLowerCase();
    if (p.includes('crunchyroll')) {
      return { name: 'Crunchyroll', color: 'text-orange-500 bg-orange-500/15 border-orange-500/30' };
    }
    if (p.includes('netflix')) {
      return { name: 'Netflix', color: 'text-red-500 bg-red-500/15 border-red-500/30' };
    }
    if (p.includes('hotstar') || p.includes('jio')) {
      return { name: 'JioHotstar', color: 'text-blue-500 bg-blue-500/15 border-blue-500/30' };
    }
    if (p.includes('prime') || p.includes('amazon')) {
      return { name: 'Prime Video', color: 'text-sky-500 bg-sky-500/15 border-sky-500/30' };
    }
    if (p.includes('youtube') || p.includes('muse') || p.includes('ani-one')) {
      return { name: 'YouTube (Muse/Ani-One)', color: 'text-rose-500 bg-rose-500/15 border-rose-500/30' };
    }
    if (p.includes('bilibili')) {
      return { name: 'Bilibili', color: 'text-cyan-500 bg-cyan-500/15 border-cyan-500/30' };
    }
    return {
      name: provider || 'Official Stream',
      color: 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/30',
    };
  };

  return (
    <div
      data-testid="analytics-dashboard"
      className="w-full max-w-full overflow-x-clip space-y-6 pb-8 text-[var(--text-primary)]"
    >
      {/* 1. ANALYTICS HEADER & TIMEFRAME / MANUAL REFRESH CONTROLS */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t('common.live', 'CONTENT DEMAND INTELLIGENCE 2.0')}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-semibold">
                Cloudflare D1 • Zero Fake Metrics
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-[var(--accent-primary)] shrink-0" />
              <span>Actionable Admin Analytics &amp; Demand Intelligence</span>
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl">
              Real D1 zero-result search demand, regional Indian dub language popularity, verified OTT click-through conversion rates (CTR), and catalog completeness gaps.
            </p>
          </div>

          {/* Timeframe Selector (Today, 7D, 30D, 90D) + Manual Refresh Button */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <div
              data-testid="analytics-timeframe-selector"
              className="flex items-center p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
            >
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: '7d', label: '7D' },
                  { id: '30d', label: '30D' },
                  { id: '90d', label: '90D' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`analytics-timeframe-${tab.id}`}
                  onClick={() => setTimeRange(tab.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeRange === tab.id
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
              title="Toggle optional 60s background refresh (Off by default)"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-[var(--text-secondary)]'
                }`}
              />
              {autoRefresh ? 'Auto (60s)' : 'Manual Mode'}
            </button>

            <button
              type="button"
              onClick={() => void fetchAnalytics(true)}
              disabled={isRefreshing}
              data-testid="analytics-refresh-btn"
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              title="Refresh Telemetry"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PHASE 3 ACTIONABLE CONTENT DEMAND INTELLIGENCE GRID */}
      <div
        data-testid="analytics-demand-intelligence-section"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5"
      >
        {/* Card A: Most Searched Missing Anime (Zero-Result Searches + 1-Click Add to Catalog) */}
        <div
          data-testid="analytics-missing-searches-card"
          className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-500" />
                <span>Most Searched Missing Anime</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Real zero-result public search queries in D1 ({timeRange.toUpperCase()}) with 1-click catalog creation.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono font-bold text-[var(--text-secondary)] shrink-0">
              {missingSearches.length} Queries
            </span>
          </div>

          {missingSearches.length === 0 ? (
            <div className="py-8 px-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center space-y-1.5">
              <Search className="w-6 h-6 text-[var(--text-secondary)] opacity-60 mx-auto" />
              <div className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                No data yet — 0 zero-result searches recorded
              </div>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                When users search for an anime title that returns 0 catalog matches, it will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {missingSearches.map((item, idx) => (
                <div
                  key={`${item.queryText}-${idx}`}
                  className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-[var(--text-primary)] truncate">
                      &ldquo;{item.queryText}&rdquo;
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {item.searchCount} {item.searchCount === 1 ? 'search' : 'searches'} · Last seen{' '}
                      {item.lastSearchedAt
                        ? new Date(item.lastSearchedAt).toLocaleDateString()
                        : 'recently'}
                    </div>
                  </div>
                  {onAddMissingAnimeTitle && (
                    <button
                      type="button"
                      data-testid={`add-missing-anime-btn-${idx}`}
                      onClick={() => onAddMissingAnimeTitle(item.queryText)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Catalog</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card B: Regional Dub Language Demand */}
        <div
          data-testid="analytics-regional-dub-demand-card"
          className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Languages className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Regional Dub Language Demand</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Real Explore filter activations, OTT clicks &amp; catalog coverage across 6 Indian languages.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono font-bold text-[var(--text-secondary)] shrink-0">
              6 Languages
            </span>
          </div>

          {regionalLanguageDemand.length === 0 ? (
            <div className="py-8 px-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center space-y-1.5">
              <Languages className="w-6 h-6 text-[var(--text-secondary)] opacity-60 mx-auto" />
              <div className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                No data yet
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Regional language filter &amp; OTT click events will populate as visitors browse.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {regionalLanguageDemand.map((lang) => {
                const pct =
                  lang.eventCount > 0
                    ? Math.max(
                        6,
                        Math.round((lang.eventCount / maxLanguageDemandEvents) * 100)
                      )
                    : 0;
                return (
                  <div
                    key={lang.code}
                    className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono font-extrabold uppercase text-[10px] text-[var(--accent-primary)]">
                          {lang.code}
                        </span>
                        <span className="font-extrabold text-[var(--text-primary)]">
                          {lang.language}
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          ({lang.nativeName})
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-[var(--text-secondary)] font-mono">
                        <span>{lang.eventCount} events</span>
                        <span>•</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {lang.sharePercent}% share
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card C: OTT Performance & CTR (OTT Clicks / OTT Impressions * 100, showing "—" when impressions are 0) */}
        <div
          data-testid="analytics-ott-ctr-card"
          className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>OTT Performance &amp; Conversion CTR</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Calculated as <code className="font-mono">OTT Clicks / OTT Impressions × 100</code> (displays <code className="font-mono">&mdash;</code> when impressions are 0).
              </p>
            </div>
          </div>

          {ottPerformance.length === 0 ? (
            <div className="py-8 px-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center space-y-1.5">
              <ExternalLink className="w-6 h-6 text-[var(--text-secondary)] opacity-60 mx-auto" />
              <div className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                No data yet — 0 OTT impressions or clicks recorded
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Impressions and outbound clicks from the Anime Details &ldquo;Where to Watch (India)&rdquo; hub are tracked automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[11px] font-extrabold uppercase text-[var(--text-secondary)]">
                    <th className="py-2.5 px-3">OTT Platform</th>
                    <th className="py-2.5 px-3 text-right">Impressions</th>
                    <th className="py-2.5 px-3 text-right">Clicks</th>
                    <th className="py-2.5 px-3 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  {ottPerformance.map((row) => {
                    const computed = computeOttPerformanceCtr(row.clicks, row.impressions);
                    const badge = getProviderBadge(row.platform, '');
                    return (
                      <tr key={row.platform} className="hover:bg-[var(--bg-elevated)]/60">
                        <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${badge.color}`}
                          >
                            {row.platform}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[var(--text-secondary)]">
                          {Number(row.impressions || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {Number(row.clicks || 0).toLocaleString()}
                        </td>
                        <td
                          data-testid={`ott-ctr-display-${row.platform}`}
                          className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-500"
                        >
                          {row.ctrDisplay || computed.display}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Card D: Catalog Completeness Gaps (Direct Jump Links to Data Health QA) */}
        <div
          data-testid="analytics-completeness-gaps-card"
          className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4"
        >
          <div>
            <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-500" />
              <span>Catalog Completeness Gaps</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Real-time D1 catalog metadata coverage with direct 1-click jumps to Data Health QA.
            </p>
          </div>

          {!completenessGaps ? (
            <div className="py-8 px-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
              Scanning D1 catalog completeness...
            </div>
          ) : (
            <div className="space-y-2">
              {[
                {
                  key: 'missing_dub_langs',
                  label: 'Unverified / Missing Indian Dub Tags',
                  count: Number(completenessGaps.countsByCategory?.unverified_dubs || 0),
                },
                {
                  key: 'missing_stream_links',
                  label: 'Missing Artwork / Stream Metadata',
                  count: Number(completenessGaps.countsByCategory?.missing_artwork || 0),
                },
                {
                  key: 'missing_episode_counts',
                  label: 'Missing or Inconsistent Episode Counts',
                  count: Number(completenessGaps.countsByCategory?.inconsistent_episodes || 0),
                },
                {
                  key: 'unverified_metadata',
                  label: 'Short or Missing English Synopsis',
                  count: Number(completenessGaps.countsByCategory?.missing_synopsis || 0),
                },
              ].map((gap) => (
                <div
                  key={gap.key}
                  className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {gap.label}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {gap.count} of {completenessGaps.totalScanned} scanned titles
                    </div>
                  </div>
                  {onJumpToDataHealth && (
                    <button
                      type="button"
                      onClick={() => onJumpToDataHealth(gap.key)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-extrabold text-[var(--accent-primary)] shrink-0 cursor-pointer"
                    >
                      Inspect &rarr;
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. EXPLICIT LOADING / ERROR STATES FOR EDGE VISITOR TELEMETRY */}
      {loading && !data && !demandData && (
        <div
          data-testid="analytics-loading-state"
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center space-y-3"
        >
          <RefreshCw className="w-7 h-7 text-[var(--accent-primary)] animate-spin mx-auto" />
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Loading Cloudflare D1 Analytics...
          </p>
        </div>
      )}

      {errorMsg && !demandData && (
        <div
          data-testid="analytics-error-state"
          className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                API / D1 Analytics Error
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] break-words">
                {errorMsg}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchAnalytics(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Query
          </button>
        </div>
      )}

      {/* 4. EDGE VISITOR SUMMARY KPI CARDS */}
      {(!loading || data) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-emerald-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Live Right Now
                </span>
                <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                  {liveCount}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  active
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-2">Active within last 3m</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Unique Visitors
                </span>
                <Users className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                {uniqueVisitors.toLocaleString()}
              </span>
              <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                {totalSessions.toLocaleString()} total sessions
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Total Pageviews
                </span>
                <Eye className="w-4 h-4 text-sky-500" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                {totalPageviews.toLocaleString()}
              </span>
              <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                {totalSessions > 0 ? (totalPageviews / totalSessions).toFixed(1) : '0.0'} views /
                session
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Avg. Time on Page
                </span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                {avgDuration}
              </span>
              <p className="text-[11px] text-[var(--text-secondary)] mt-2">Active engagement</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Avg. Scroll Depth
                </span>
                <Compass className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                  {avgScroll}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, avgScroll)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Bounce Rate
                </span>
                <ArrowUpRight className="w-4 h-4 text-rose-500" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                {bounceRate}%
              </span>
              <p className="text-[11px] text-[var(--text-secondary)] mt-2">Single-page sessions</p>
            </div>
          </div>

          {/* 5. TOP PAGES & OUTBOUND STREAM CLICKS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
                    Top Pages &amp; Anime Discovery
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Most visited paths with average dwell time and scroll depth
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
                  Top {topPagesList.length}
                </span>
              </div>

              {topPagesList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                  <Eye className="w-7 h-7 text-[var(--text-secondary)] opacity-50 mb-2" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    No pageviews recorded yet
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Browse the catalog or open an anime page to generate real-time D1 telemetry.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {topPagesList.map((page: any, idx: number) => {
                    const maxViews = Math.max(
                      ...topPagesList.map((p: any) => Number(p.views) || 1),
                      1
                    );
                    const pct = Math.round(((Number(page.views) || 0) / maxViews) * 100);
                    const isAnimePage =
                      typeof page.path === 'string' && page.path.startsWith('/anime/');
                    const animeSlug = isAnimePage ? page.path.replace('/anime/', '') : null;

                    return (
                      <div
                        key={page.path || idx}
                        className="relative overflow-hidden rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 transition-all"
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-[var(--accent-primary)]/10 pointer-events-none transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-black text-[var(--text-secondary)] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  onClick={() =>
                                    animeSlug && onSelectAnimeSlug && onSelectAnimeSlug(animeSlug)
                                  }
                                  className={`text-xs sm:text-sm font-bold truncate ${
                                    isAnimePage
                                      ? 'text-[var(--accent-primary)] hover:underline cursor-pointer'
                                      : 'text-[var(--text-primary)]'
                                  }`}
                                >
                                  {page.path}
                                </span>
                                {isAnimePage && (
                                  <span className="px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] text-[10px] font-bold uppercase shrink-0">
                                    Anime
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
                            <div className="hidden sm:block">
                              <span className="text-[10px] text-[var(--text-secondary)] block uppercase">
                                Avg Time
                              </span>
                              <span className="text-xs font-bold text-[var(--text-primary)]">
                                {formatSeconds(Number(page.avgTime) || 0)}
                              </span>
                            </div>
                            <div className="hidden sm:block">
                              <span className="text-[10px] text-[var(--text-secondary)] block uppercase">
                                Scroll
                              </span>
                              <span className="text-xs font-bold text-[var(--text-primary)]">
                                {Number(page.avgScroll) || 0}%
                              </span>
                            </div>
                            <div className="min-w-[54px]">
                              <span className="text-[10px] text-[var(--text-secondary)] block uppercase">
                                Views
                              </span>
                              <span className="text-sm font-black text-[var(--text-primary)]">
                                {Number(page.views).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-emerald-500" />
                    OTT Platform Outbound URLs
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Direct outbound links clicked by visitors
                  </p>
                </div>
              </div>

              {outboundList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center px-4">
                  <ExternalLink className="w-7 h-7 text-[var(--text-secondary)] opacity-50 mb-2" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    No outbound OTT clicks yet
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Clicks on official streaming links in Anime Details are tracked automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {outboundList.map((item: any, idx: number) => {
                    const badge = getProviderBadge(item.provider, item.url);
                    return (
                      <div
                        key={`${item.url}-${idx}`}
                        className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.color}`}
                            >
                              {badge.name}
                            </span>
                          </div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate block font-mono"
                          >
                            {item.url}
                          </a>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            {item.clicks}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)] block uppercase">
                            clicks
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 6. GEOGRAPHY, DEVICES & REAL-TIME EVENT STREAM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  Regional Geography
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Cloudflare Edge region &amp; city attribution
                </p>

                {regionsList.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] py-8 text-center">
                    No regional session data yet
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {regionsList.slice(0, 7).map((item: any, idx: number) => {
                      const regionLabel = item.region || item.city || 'Unknown';
                      const countryLabel = item.country || 'Unknown';
                      return (
                        <div
                          key={`${regionLabel}-${idx}`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base shrink-0" title={countryLabel}>
                              {getCountryFlag(countryLabel)}
                            </span>
                            <div className="min-w-0">
                              <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate block">
                                {regionLabel}
                              </span>
                              <span className="text-[11px] text-[var(--text-secondary)] block">
                                {countryLabel === 'IN' ? 'India' : countryLabel}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-black text-[var(--text-primary)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
                            {item.count} {Number(item.count) === 1 ? 'visit' : 'visits'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {citiesList.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                      Top Cities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {citiesList.slice(0, 6).map((c: any, i: number) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-semibold"
                        >
                          {c.city || 'Unknown'}{' '}
                          <strong className="text-[var(--accent-primary)]">({c.count})</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {countriesList.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-[var(--text-secondary)] uppercase font-bold flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> Top Countries:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {countriesList.slice(0, 4).map((c: any, i: number) => (
                      <span
                        key={i}
                        className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1"
                      >
                        {getCountryFlag(c.country)} {c.country || 'Unknown'} ({c.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-5">
              <div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2 mb-1">
                  <Smartphone className="w-4 h-4 text-sky-500" />
                  Device &amp; Platform Split
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                  Unique visitors by form factor, browser, and OS
                </p>

                <div className="space-y-2">
                  {devicesList.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
                      No device telemetry yet
                    </p>
                  ) : (
                    devicesList.map((d: any, idx: number) => {
                      const pct = calculateDevicePercentage(
                        Number(d.count) || 0,
                        totalDeviceVisitors
                      );
                      return (
                        <div key={d.device || idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] capitalize">
                              {getDeviceIcon(d.device)}
                              {d.device || 'Desktop'}
                            </span>
                            <span className="text-[var(--text-secondary)] font-mono">
                              {d.count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                    Browsers
                  </span>
                  <div className="space-y-1.5">
                    {browsersList.map((b: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-primary)] truncate">{b.browser}</span>
                        <span className="font-bold text-[var(--text-secondary)]">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                    Operating Systems
                  </span>
                  <div className="space-y-1.5">
                    {osList.map((o: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-primary)] truncate">{o.os}</span>
                        <span className="font-bold text-[var(--text-secondary)]">{o.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    Live Action Feed
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Real-time searches, filter changes &amp; interactions
                  </p>
                </div>
                {lastRefreshedAt && (
                  <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                    {lastRefreshedAt}
                  </span>
                )}
              </div>

              {recentEventsList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="w-6 h-6 text-[var(--text-secondary)] opacity-50 mb-2" />
                  <p className="text-xs text-[var(--text-secondary)]">
                    Waiting for custom interaction events...
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {recentEventsList.map((evt: any, idx: number) => (
                    <div
                      key={evt.id || idx}
                      className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-[var(--accent-primary)] block truncate">
                          {evt.event_type}
                        </span>
                        {evt.target_id && (
                          <span className="text-[var(--text-secondary)] truncate block font-mono text-[11px]">
                            {evt.target_id}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-[var(--text-secondary)] block">
                          {evt.region || evt.city || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
