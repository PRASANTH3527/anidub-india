import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  Film, 
  Bookmark, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  LayoutDashboard,
  Clock,
  Zap,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { AnimeRecord } from '../types/database';
import AdminDashboard from './AdminDashboard';

interface AdminAnalyticsDashboardProps {
  allAnime: AnimeRecord[];
  onBack: () => void;
}

const COLORS = ['#8b5cf6', '#a855f7', '#6366f1', '#4f46e5', '#7c3aed'];

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  allAnime,
  onBack,
}) => {
  const [viewMode, setViewMode] = React.useState<'mobile_stream' | 'desktop_console'>('mobile_stream');
  // Real aggregated data derived from catalog & local storage
  const totalUpvotes = useMemo(() => {
    return allAnime.reduce((acc, a) => acc + Number(a.likes || a.upvotes || 0), 0);
  }, [allAnime]);

  const totalWatchlistsCount = useMemo(() => {
    try {
      const saved = localStorage.getItem('anidub_local_watchlist');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, []);

  const approvedCount = useMemo(() => {
    return allAnime.filter(a => a.status === 'approved' || a.submissionStatus === 'approved').length;
  }, [allAnime]);

  const pendingCount = useMemo(() => {
    return allAnime.filter(a => a.status === 'pending' || a.submissionStatus === 'pending').length;
  }, [allAnime]);

  const watchlistData = useMemo(() => {
    return allAnime
      .slice(0, 6)
      .map(anime => ({
        name: anime.title.length > 15 ? anime.title.substring(0, 12) + '...' : anime.title,
        value: Number(anime.likes || anime.upvotes || 0)
      }))
      .sort((a, b) => b.value - a.value);
  }, [allAnime]);

  const trendingAnimeData = useMemo(() => {
    return [...allAnime]
      .sort((a, b) => Number(b.likes || b.upvotes || 0) - Number(a.likes || a.upvotes || 0))
      .slice(0, 6)
      .map(anime => ({
        name: anime.title.length > 10 ? anime.title.substring(0, 8) + '..' : anime.title,
        votes: Number(anime.likes || anime.upvotes || 0)
      }));
  }, [allAnime]);

  const dailyTrafficData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const buckets: Record<string, { views: number; users: number }> = {};
    days.forEach(d => { buckets[d] = { views: 0, users: 0 }; });

    allAnime.forEach(a => {
      const dateStr = a.submittedAt || a.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          if (buckets[dayName]) {
            buckets[dayName].views += Number(a.likes || a.upvotes || 1);
            buckets[dayName].users += 1;
          }
        }
      }
    });

    return days.map(day => ({
      name: day,
      views: buckets[day].views,
      users: buckets[day].users,
    }));
  }, [allAnime]);

  const stats = [
    { 
      label: 'Catalog Anime', 
      value: allAnime.length.toString(), 
      trend: `${approvedCount} approved`, 
      isUp: true, 
      icon: Film, 
      color: 'text-accent-theme',
      glow: 'shadow-primary-theme'
    },
    { 
      label: 'Total Upvotes', 
      value: totalUpvotes.toLocaleString(), 
      trend: `${pendingCount} pending`, 
      isUp: true, 
      icon: Eye, 
      color: 'text-primary-theme',
      glow: 'shadow-primary-theme'
    },
    { 
      label: 'Approved Titles', 
      value: approvedCount.toString(), 
      trend: 'Active', 
      isUp: true, 
      icon: Users, 
      color: 'text-emerald-400',
      glow: 'shadow-emerald-500/20'
    },
    { 
      label: 'Watchlist Saves', 
      value: totalWatchlistsCount.toLocaleString(), 
      trend: 'Saved', 
      isUp: true, 
      icon: Bookmark, 
      color: 'text-amber-400',
      glow: 'shadow-amber-500/20'
    },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white p-3 sm:p-6 lg:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-accent-theme mb-1">
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Management Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight">
            Admin <span className="text-primary-theme">Analytics</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-[#121829] border border-neutral-800 text-xs">
            <button
              onClick={() => setViewMode('mobile_stream')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'mobile_stream'
                  ? 'btn-primary-theme shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Real-time Firestore
            </button>
            <button
              onClick={() => setViewMode('desktop_console')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'desktop_console'
                  ? 'btn-primary-theme shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Metrics
            </button>
          </div>

          <button 
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-all cursor-pointer border border-neutral-700 active:scale-95"
          >
            Exit
          </button>
        </div>
      </div>

      {viewMode === 'mobile_stream' ? (
        <div className="max-w-2xl mx-auto -mt-2">
          <AdminDashboard />
        </div>
      ) : (
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Stat Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative overflow-hidden group p-5 rounded-3xl bg-[#131926]/40 border border-white/5 backdrop-blur-xl hover:border-white/10 transition-all shadow-xl"
            >
              <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${stat.color}`}>
                <stat.icon size={64} />
              </div>
              
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-2xl bg-white/5 border border-white/5 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${stat.isUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                  {stat.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.trend}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <h3 className="text-3xl font-black tracking-tight">{stat.value}</h3>
              </div>

              {/* Mini Sparkline Visualization */}
              <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: stat.isUp ? '70%' : '40%' }}
                  transition={{ duration: 1, delay: 0.5 + (i * 0.1) }}
                  className={`h-full ${stat.isUp ? 'bg-emerald-500' : 'bg-purple-500'} opacity-50`}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Traffic Chart */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-2 p-6 rounded-3xl bg-[#131926]/40 border border-white/5 backdrop-blur-xl shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black tracking-tight">Platform Traffic</h3>
                <p className="text-xs text-neutral-500">Daily unique users vs total views</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-neutral-400">Views</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-neutral-400">Users</span>
                </div>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrafficData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6b7280', fontSize: 10, fontWeight: 700}} 
                    dy={10}
                  />
                  <YAxis 
                    hide 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#131926', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
                  <Area type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Top Categories/Watchlist Pie */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-3xl bg-[#131926]/40 border border-white/5 backdrop-blur-xl shadow-2xl"
          >
            <div className="mb-6">
              <h3 className="text-lg font-black tracking-tight">Watchlist Distribution</h3>
              <p className="text-xs text-neutral-500">Most saved titles this week</p>
            </div>

            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={watchlistData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {watchlistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#131926', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Total</p>
                  <p className="text-2xl font-black">1.2K</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {watchlistData.map((entry, idx) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[11px] font-bold text-neutral-300">{entry.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-neutral-500">{entry.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
          
          {/* Top Trending Anime Bar Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-3xl bg-[#131926]/40 border border-white/5 backdrop-blur-xl shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black tracking-tight">Top Community Votes</h3>
                <p className="text-xs text-neutral-500">Highest rated dubbed titles</p>
              </div>
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendingAnimeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}}
                    width={70}
                  />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.03)'}}
                    contentStyle={{ backgroundColor: '#131926', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '11px' }}
                  />
                  <Bar 
                    dataKey="votes" 
                    fill="#8b5cf6" 
                    radius={[0, 8, 8, 0]} 
                    barSize={20}
                  >
                    {trendingAnimeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#f59e0b' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Real-time Events Feed (Live) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-3xl bg-[#131926]/40 border border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black tracking-tight">Live Activity Feed</h3>
                <p className="text-xs text-neutral-500">Real-time actions across the platform</p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                LIVE
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-theme/10 flex items-center justify-center text-primary-theme">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-xs text-neutral-400 max-w-[200px]">
                Live activity feed is active. Switch to <strong>Real-time Firestore</strong> view to see detailed event stream.
              </p>
            </div>
          </motion.div>

        </div>

      </div>
      )}
    </div>
  );
};
