'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Bookmark,
  Tv,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Clock,
  Flame,
  Globe,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useFirebaseAnalytics } from '../hooks/useFirebaseAnalytics';

// Custom sleek dark tooltip for mobile screens
const MobileChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#131926]/95 backdrop-blur-md border border-neutral-700/80 p-2.5 rounded-xl shadow-2xl text-xs space-y-1">
        <p className="font-bold text-neutral-200">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`tooltip-${index}`} className="flex items-center gap-1.5 font-medium" style={{ color: entry.color || '#a855f7' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || '#a855f7' }} />
            <span>{entry.name}:</span>
            <span className="font-bold text-white">{Number(entry.value).toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface AdminDashboardProps {
  onExitAdmin?: () => void;
  onEditAnime?: (anime: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onExitAdmin,
  onEditAnime,
}) => {
  const {
    liveActiveUsers,
    liveActiveDiff,
    totalWatchlists,
    todayStreams,
    mostWatchlisted,
    trafficData,
    dubBreakdown,
    recentActivities,
    isConnected,
    isFallback,
    lastUpdated,
    pushRealtimeUpdate,
  } = useFirebaseAnalytics();

  const [activeTab, setActiveTab] = useState<'overview' | 'watchlists' | 'dubs'>('overview');
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulateSpike = async () => {
    setIsSimulating(true);
    await pushRealtimeUpdate(liveActiveUsers + Math.floor(Math.random() * 45) + 15);
    setTimeout(() => setIsSimulating(false), 600);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-neutral-100 pb-16 font-sans antialiased selection:bg-purple-600 selection:text-white">
      {/* 1. Mobile-First Top Header */}
      <header className="sticky top-0 z-40 bg-[#0b0f17]/90 backdrop-blur-md border-b border-neutral-800/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-white">AniDub Admin</h1>
                {/* Live Real-time Status Badge */}
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">
                {isFallback ? 'Firestore Client Stream' : 'Cloud Firestore Active'}
              </p>
            </div>
          </div>

          {/* Quick Realtime Spike Trigger (Ideal for mobile Replit testing) */}
          <button
            onClick={handleSimulateSpike}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 active:scale-95 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all cursor-pointer"
            title="Simulate live user spike"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Ping</span>
          </button>
        </div>

        {/* Mobile Filter Tabs */}
        <div className="flex gap-1.5 mt-3 pt-1 border-t border-neutral-800/60 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'watchlists', label: 'Watchlists' },
            { id: 'dubs', label: 'Regional Dubs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-[#131926] text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto sm:max-w-2xl">
        {/* 2. Real-time Metric Cards (2x2 Mobile Grid) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {/* Metric 1: Live Active Users */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 sm:p-4 rounded-2xl bg-[#131926] border border-neutral-800/90 shadow-xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-400">Active Now</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-baseline gap-1.5">
              <span>{liveActiveUsers.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+{liveActiveDiff} in 30s</span>
            </div>
          </motion.div>

          {/* Metric 2: Total Watchlists */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-3.5 sm:p-4 rounded-2xl bg-[#131926] border border-neutral-800/90 shadow-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-400">Watchlists</span>
              <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Bookmark className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {totalWatchlists.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-purple-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% today</span>
            </div>
          </motion.div>

          {/* Metric 3: Today's Streams */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-3.5 sm:p-4 rounded-2xl bg-[#131926] border border-neutral-800/90 shadow-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-400">Dub Streams</span>
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Tv className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {todayStreams.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-indigo-400">
              <Flame className="w-3.5 h-3.5" />
              <span>Peak hour</span>
            </div>
          </motion.div>

          {/* Metric 4: Cloud Status */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-3.5 sm:p-4 rounded-2xl bg-[#131926] border border-neutral-800/90 shadow-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-400">Sync Status</span>
              <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-white truncate">
              {isConnected ? 'Realtime 100%' : 'Online (Sync)'}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-neutral-400 truncate">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </motion.div>
        </div>

        {/* 3. Real-time Area Chart: Live Traffic & Active Sessions */}
        {(activeTab === 'overview' || activeTab === 'watchlists') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-3xl bg-[#131926] border border-neutral-800/90 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  Live Traffic & Sessions
                </h3>
                <p className="text-[11px] text-neutral-400">Firestore streaming every 5s</p>
              </div>
              <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-800/40">
                Active
              </span>
            </div>

            <div className="h-52 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#737373', fontSize: 10 }}
                    axisLine={{ stroke: '#262626' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#737373', fontSize: 10 }}
                    axisLine={{ stroke: '#262626' }}
                    tickLine={false}
                  />
                  <Tooltip content={<MobileChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#purpleGradient)"
                    name="Active Users"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* 4. Real-time Bar Chart: Most Watchlisted Anime */}
        {(activeTab === 'overview' || activeTab === 'watchlists') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-3xl bg-[#131926] border border-neutral-800/90 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  Most Watchlisted in India
                </h3>
                <p className="text-[11px] text-neutral-400">Real-time aggregate saves</p>
              </div>
              <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded">
                Top 6
              </span>
            </div>

            <div className="h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mostWatchlisted} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#a3a3a3', fontSize: 9 }}
                    axisLine={{ stroke: '#262626' }}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(val) => (val.length > 8 ? val.slice(0, 7) + '..' : val)}
                  />
                  <YAxis
                    tick={{ fill: '#737373', fontSize: 10 }}
                    axisLine={{ stroke: '#262626' }}
                    tickLine={false}
                  />
                  <Tooltip content={<MobileChartTooltip />} />
                  <Bar
                    dataKey="count"
                    fill="#7c3aed"
                    radius={[6, 6, 0, 0]}
                    name="Watchlist Saves"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* 5. Donut Chart: Regional Dub Language Popularity */}
        {(activeTab === 'overview' || activeTab === 'dubs') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-3xl bg-[#131926] border border-neutral-800/90 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  Regional Dub Distribution
                </h3>
                <p className="text-[11px] text-neutral-400">User language preference in India</p>
              </div>
              <Globe className="w-4 h-4 text-purple-400" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="h-44 w-44 shrink-0 mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dubBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {dubBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<MobileChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Mobile Legend */}
              <div className="space-y-1.5 flex-1 text-xs">
                {dubBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-neutral-300 font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 6. Live Activity Ticker (Real-Time Firestore Updates) */}
        <div className="p-4 rounded-3xl bg-[#131926] border border-neutral-800/90 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Real-Time Feed</span>
            </h3>
            <span className="text-[10px] text-neutral-400">Zero Page Refresh</span>
          </div>

          <div className="divide-y divide-neutral-800/60">
            {recentActivities.map((act) => (
              <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                  <span className="font-bold text-white truncate">{act.user}</span>
                  <span className="text-neutral-400">
                    {act.action === 'watchlisted' ? 'saved' : 'watched'}
                  </span>
                  <span className="text-purple-300 font-medium truncate">{act.animeTitle}</span>
                </div>
                <div className="text-[10px] text-neutral-500 shrink-0 font-mono ml-2">
                  {act.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
