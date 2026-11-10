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
  Sparkles, 
  RefreshCw, 
  ArrowUpRight, 
  ExternalLink, 
  TrendingUp, 
  Sliders, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Play,
  Film,
  Zap,
  BarChart3,
  Layers,
  Search,
  MessageSquare
} from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';
import { calculateDevicePercentage } from '../utils/analytics';

export interface AnalyticsDashboardProps {
  onNavigateHome?: () => void;
  onSelectAnimeSlug?: (slug: string) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  onNavigateHome,
  onSelectAnimeSlug
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<string>('all'); // 'today' | '24h' | '7d' | 'all'
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  const fetchAnalytics = useCallback(async (showSpin = true) => {
    if (showSpin) setIsRefreshing(true);
    try {
      const res = await cloudflareApi.fetchAnalyticsDashboard(timeRange);
      if (res) {
        setData(res);
        setLastRefreshedAt(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('[AnalyticsDashboard] Error fetching analytics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics(true);
  }, [fetchAnalytics]);

  // Auto-refresh interval (15s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAnalytics(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAnalytics]);

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
    if (lower.includes('mobile')) return <Smartphone className="w-3.5 h-3.5 text-sky-400" />;
    if (lower.includes('tablet')) return <Tablet className="w-3.5 h-3.5 text-purple-400" />;
    return <Monitor className="w-3.5 h-3.5 text-emerald-400" />;
  };

  // Strictly real data from database - defaults to 0 when empty
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
    : (Array.isArray(data?.cities) ? data.cities : []);
  const citiesList: any[] = Array.isArray(data?.cities) ? data.cities : [];
  const countriesList: any[] = Array.isArray(data?.countries) ? data.countries : [];
  const devicesList: any[] = Array.isArray(data?.devices) ? data.devices : [];
  const browsersList: any[] = Array.isArray(data?.browsers) ? data.browsers : [];
  const outboundClicksList: any[] = Array.isArray(data?.outboundClicks) 
    ? data.outboundClicks 
    : (Array.isArray(data?.eventsBreakdown) ? data.eventsBreakdown : []);
  const recentEventsList: any[] = Array.isArray(data?.recentEvents) ? data.recentEvents : [];

  return (
    <div className="w-full space-y-6 text-slate-100 font-sans animate-in fade-in duration-300">
      
      {/* 1. TOP HEADER & TELEMETRY CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0f1422]/90 border border-neutral-800/80 backdrop-blur-xl rounded-3xl p-4 sm:p-6 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/40">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>Custom Edge Analytics</span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    D1 + Edge Telemetry
                  </span>
                </h1>
              </div>
              <p className="text-xs text-neutral-400">
                100% Real-Time First-Party Tracking via Cloudflare Edge Headers & Clerk Auth (Zero Third-Party Trackers)
              </p>
            </div>
          </div>
        </div>

        {/* Live Users Counter & Range Switcher */}
        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-center">
          {/* Live Users Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-950/40">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${liveCount > 0 ? 'bg-emerald-400' : 'bg-neutral-500'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${liveCount > 0 ? 'bg-emerald-500' : 'bg-neutral-500'}`} />
            </span>
            <span className="text-xs font-black tracking-wide">{liveCount} LIVE NOW</span>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center bg-[#141b2b] border border-neutral-800 rounded-xl p-1 text-xs">
            {[
              { id: 'today', label: 'Today' },
              { id: '24h', label: '24h' },
              { id: '7d', label: '7d' },
              { id: 'all', label: 'All' }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setTimeRange(r.id)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  timeRange === r.id 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-[#141b2b] border border-neutral-800 text-neutral-400 hover:text-white hover:border-purple-500/50 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Refresh Analytics Stream"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. CORE KPI METRICS GRID (100% REAL DATA FROM D1) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Live Now */}
        <div className="bg-[#111726]/90 border border-emerald-500/30 rounded-2xl p-4 shadow-lg flex flex-col justify-between group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Live Active</span>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{liveCount}</div>
          <div className="text-[10px] text-emerald-300 font-semibold mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active in 3m</span>
          </div>
        </div>

        {/* KPI 2: Total Sessions */}
        <div className="bg-[#111726]/90 border border-neutral-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Sessions</span>
            <Compass className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{totalSessions.toLocaleString()}</div>
          <div className="text-[10px] text-neutral-400 font-medium mt-1">
            {uniqueVisitors.toLocaleString()} Unique Visitors
          </div>
        </div>

        {/* KPI 3: Pageviews */}
        <div className="bg-[#111726]/90 border border-neutral-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between group hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Pageviews</span>
            <Eye className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{totalPageviews.toLocaleString()}</div>
          <div className="text-[10px] text-neutral-400 font-medium mt-1">
            {totalSessions > 0 ? (totalPageviews / totalSessions).toFixed(1) : '0.0'} views/session
          </div>
        </div>

        {/* KPI 4: Avg Session Time */}
        <div className="bg-[#111726]/90 border border-neutral-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Avg Duration</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{avgDuration}</div>
          <div className="text-[10px] text-amber-300 font-medium mt-1">
            Time on page
          </div>
        </div>

        {/* KPI 5: Avg Scroll Depth */}
        <div className="bg-[#111726]/90 border border-neutral-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between group hover:border-pink-500/40 transition-all">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Scroll Depth</span>
            <TrendingUp className="w-3.5 h-3.5 text-pink-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{avgScroll}%</div>
          <div className="text-[10px] text-neutral-400 font-medium mt-1">
            Deep page reads
          </div>
        </div>

        {/* KPI 6: Bounce Rate */}
        <div className="bg-[#111726]/90 border border-neutral-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Bounce Rate</span>
            <Sliders className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{bounceRate}%</div>
          <div className="text-[10px] text-neutral-400 font-medium mt-1">
            Single page sessions
          </div>
        </div>
      </div>

      {/* 3. ROW 2: TOP PERFORMING ANIME & GEOGRAPHIC TRAFFIC */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* TOP PERFORMING ANIME & PAGES (7 cols) */}
        <div className="lg:col-span-7 bg-[#101625]/90 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-black text-white tracking-wide">Top Visited Anime & Routes</h2>
            </div>
            <span className="text-[11px] text-neutral-500">Sorted by Pageviews</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-neutral-500 border-b border-neutral-800/60 pb-2">
                  <th className="font-semibold py-2">Path / Anime</th>
                  <th className="font-semibold py-2 text-right">Views</th>
                  <th className="font-semibold py-2 text-right">Avg Time</th>
                  <th className="font-semibold py-2 text-right">Max Scroll</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40">
                {topPagesList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-400 text-xs">
                      No data available yet
                    </td>
                  </tr>
                ) : (
                  topPagesList.map((page: any, idx: number) => {
                    const isAnime = (page.path || '').startsWith('/anime/');
                    return (
                      <tr key={`top_page_${idx}`} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 font-medium text-white flex items-center gap-2">
                          <span className="w-5 text-[11px] font-mono text-neutral-500">#{idx + 1}</span>
                          <span className="truncate max-w-[200px] sm:max-w-[280px]">
                            {page.path}
                          </span>
                          {isAnime && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                              Anime
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-black text-amber-300">
                          {Number(page.views || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right font-mono text-neutral-300">
                          {formatSeconds(Number(page.avgTime || 0))}
                        </td>
                        <td className="py-2.5 text-right font-mono text-emerald-400">
                          {Number(page.avgScroll || 0)}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GEOGRAPHIC TRAFFIC: CITIES & COUNTRIES (5 cols) */}
        <div className="lg:col-span-5 bg-[#101625]/90 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-black text-white tracking-wide">Geographic Traffic</h2>
            </div>
            <span className="text-[11px] text-neutral-500">Edge Detected</span>
          </div>

          {/* Top States / Regions */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
              Top States / Regions
            </span>
            {regionsList.length === 0 ? (
              <div className="py-6 text-center text-neutral-500 text-xs">
                No data available yet
              </div>
            ) : (
              regionsList.slice(0, 6).map((regionItem: any, idx: number) => {
                const maxRegion = regionsList[0]?.count || 1;
                const pct = Math.round((Number(regionItem.count || 0) / maxRegion) * 100);
                const regionName = regionItem.region || regionItem.city || 'Unknown Region';
                return (
                  <div key={`region_${idx}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-neutral-200">
                        <span>{getCountryFlag(regionItem.country)}</span>
                        <span>{regionName}</span>
                        <span className="text-[10px] text-neutral-500">({regionItem.country || 'N/A'})</span>
                      </span>
                      <span className="font-bold text-white font-mono">{regionItem.count}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Countries Summary */}
          <div className="pt-3 border-t border-neutral-800/80">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2">
              Top Countries
            </span>
            {countriesList.length === 0 ? (
              <div className="text-neutral-500 text-xs">
                No data available yet
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {countriesList.map((c: any, i: number) => (
                  <div key={`country_${i}`} className="px-2.5 py-1 rounded-xl bg-neutral-800/50 border border-neutral-700/60 text-xs flex items-center gap-1.5 font-medium">
                    <span>{getCountryFlag(c.country)}</span>
                    <span className="text-white font-bold">{c.country}</span>
                    <span className="text-neutral-400 font-mono text-[10px]">({c.count})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 4. ROW 3: DEVICE BREAKDOWN & RECENT TELEMETRY EVENTS STREAM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* DEVICE, BROWSER & OUTBOUND CLICKS (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Device & Browser Breakdown */}
          <div className="bg-[#101625]/90 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-black text-white tracking-wide">Devices & Browsers</h2>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-semibold">Unique Visitors</span>
            </div>

            {/* Devices Bar */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Unique Devices</span>
              {devicesList.length === 0 ? (
                <div className="py-4 text-center text-neutral-500 text-xs">
                  No data available yet
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {devicesList.map((d: any, idx: number) => {
                    const totalUniqueDevices = uniqueVisitors || devicesList.reduce((sum: number, item: any) => sum + Number(item.count || 0), 0) || 1;
                    const pct = calculateDevicePercentage(Number(d.count || 0), totalUniqueDevices);
                    return (
                      <div key={`dev_${idx}`} className="bg-neutral-800/40 border border-neutral-700/40 rounded-xl p-2.5 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1 text-neutral-300">
                          {getDeviceIcon(d.device)}
                          <span className="text-xs font-bold capitalize">{d.device}</span>
                        </div>
                        <div className="text-sm font-black text-white">{d.count}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Browsers */}
            <div className="pt-2 border-t border-neutral-800/80 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Top Browsers (Unique Visitors)</span>
              {browsersList.length === 0 ? (
                <div className="text-neutral-500 text-xs">
                  No data available yet
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 text-xs">
                  {browsersList.map((b: any, i: number) => (
                    <span key={`browser_${i}`} className="px-2.5 py-1 rounded-xl bg-neutral-800/60 border border-neutral-700/60 text-neutral-200">
                      <strong className="text-white">{b.browser}</strong>: {b.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Outbound Link Clicks (Crunchyroll, Netflix, JioCinema, etc.) */}
          <div className="bg-[#101625]/90 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-black text-white tracking-wide">Outbound Streaming Clicks</h2>
              </div>
              <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                Direct OTT Redirects
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {outboundClicksList.length === 0 ? (
                <div className="py-4 text-center text-neutral-500 text-xs">
                  No data available yet
                </div>
              ) : (
                outboundClicksList.map((ev: any, idx: number) => {
                  const label = (ev.event_type || ev.provider || 'outbound_click').replace(/_/g, ' ');
                  const count = ev.count ?? ev.clicks ?? 0;
                  return (
                    <div key={`ev_breakdown_${idx}`} className="flex items-center justify-between py-1.5 border-b border-neutral-800/40 last:border-0">
                      <span className="font-medium text-neutral-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                        <span className="capitalize">{label}</span>
                      </span>
                      <span className="font-black text-white font-mono">{count}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* REAL-TIME EVENT STREAM FEED (7 cols) */}
        <div className="lg:col-span-7 bg-[#101625]/90 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h2 className="text-sm font-black text-white tracking-wide">Live Event Stream</h2>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Real-Time Feed</span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-600/40">
            {recentEventsList.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 text-xs flex flex-col items-center justify-center gap-2">
                <Activity className="w-6 h-6 text-neutral-600" />
                <span>No data available yet</span>
              </div>
            ) : (
              recentEventsList.map((ev: any, idx: number) => (
                <div 
                  key={`stream_event_${idx}`} 
                  className="bg-black/30 border border-white/5 hover:border-purple-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0 text-purple-300">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white capitalize truncate">
                        {(ev.event_type || 'interaction').replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate max-w-[260px] sm:max-w-md">
                        {ev.target_id || 'Page interaction'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1 justify-end">
                      {ev.country && <span>{getCountryFlag(ev.country)}</span>}
                      <span>{ev.region || ev.city || 'Edge Node'}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      {ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : 'Just now'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
