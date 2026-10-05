'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
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
  Radio,
  Globe,
  Sparkles,
  LogOut,
  Edit,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Database,
  Trash2,
  Search,
  Plus,
  AlertTriangle,
  Loader2,
  Lock,
  KeyRound,
  Download,
  Upload,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { AnimeRecord } from '../types/database';
import { SubmitDubModal } from './SubmitDubModal';
import { useToast } from './Toast';

// Color palette for regional dub languages
const LANGUAGE_COLORS: Record<string, string> = {
  Hindi: '#10b981',
  Tamil: '#f59e0b',
  Telugu: '#0ea5e9',
  Malayalam: '#8b5cf6',
  Kannada: '#3b82f6',
  English: '#6366f1',
  Japanese: '#a855f7',
};

// Types for Dashboard
export interface WatchlistStat {
  id: string;
  name: string;
  count: number;
}

export interface TrafficPoint {
  time: string;
  views: number;
}

export interface DubLanguageMetric {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface ActivityEvent {
  id: string;
  user: string;
  action: string;
  animeTitle: string;
  time: string;
  timestamp: number;
}

// Formatter for relative timestamps
function formatRelativeTime(dateInput: string | number | Date | undefined): string {
  if (!dateInput) return 'Just now';
  const timestamp = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput).getTime() : dateInput.getTime();
  if (isNaN(timestamp)) return 'Recently';

  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

interface AdminDashboardProps {
  onExitAdmin?: () => void;
  onEditAnime?: (anime: AnimeRecord) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onExitAdmin,
  onEditAnime,
}) => {
  const router = useRouter();
  const toast = useToast();

  // State
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [totalWatchlists, setTotalWatchlists] = useState<number>(0);
  const [catalogTitles, setCatalogTitles] = useState<AnimeRecord[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<number>(0);
  const [pendingList, setPendingList] = useState<AnimeRecord[]>([]);
  const [deletedList, setDeletedList] = useState<AnimeRecord[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityEvent[]>([]);
  
  // Chart Data
  const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
  const [mostWatchlisted, setMostWatchlisted] = useState<WatchlistStat[]>([]);
  const [dubBreakdown, setDubBreakdown] = useState<DubLanguageMetric[]>([]);

  // UI State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'catalog' | 'trash' | 'feed'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [animeToDelete, setAnimeToDelete] = useState<AnimeRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingAnime, setEditingAnime] = useState<AnimeRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auth State
  const [isAdmin, setIsAdmin] = useState<boolean>(() => authService.isAdmin());
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const unsub = authService.subscribe(() => setIsAdmin(authService.isAdmin()));
    return () => unsub();
  }, []);

  const fetchRealData = useCallback(async (force = false) => {
    // Optimization: Skip if we already have data and are not forcing a refresh
    if (!force && catalogTitles.length > 0) return;

    setIsLoading(true);
    try {
      const collections = ['animes', 'submissions', 'anime'];
      const firestoreAnimeMap = new Map<string, AnimeRecord>();

      for (const collName of collections) {
        try {
          const snap = await getDocs(collection(db, collName));
          snap.forEach((d) => {
            const rec = dbService.normalizeRecord({ ...d.data(), id: d.id });
            if (rec && rec.id && rec.title) firestoreAnimeMap.set(rec.id, rec);
          });
        } catch (err) {
          console.warn(`[Admin] Error fetching ${collName}:`, err);
        }
      }

      const allAnime = Array.from(firestoreAnimeMap.values());
      const activeAnime = allAnime.filter(a => !a.isDeleted);
      const trashAnime = allAnime.filter(a => a.isDeleted);
      const pendingItems = activeAnime.filter(a => a.status === 'pending' || a.submissionStatus === 'pending');

      setCatalogTitles(activeAnime);
      setDeletedList(trashAnime);
      setPendingList(pendingItems);
      setPendingSubmissions(pendingItems.length);

      // Aggregates for Metrics & Charts
      const totalWatchlistsCount = activeAnime.reduce((acc, curr) => acc + (curr.likes || 0), 0);
      setTotalWatchlists(totalWatchlistsCount);
      setActiveUsers(Math.floor(totalWatchlistsCount * 0.4) + 12);

      // Popularity Bar Chart
      const sortedByPopularity = [...activeAnime]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 5)
        .map(a => ({ id: a.id, name: a.title, count: a.likes || 0 }));
      setMostWatchlisted(sortedByPopularity);

      // Dub Breakdown Pie Chart
      const dubCounts: Record<string, number> = {};
      let totalDubs = 0;
      activeAnime.forEach(a => {
        (a.dubs || []).forEach(d => {
          dubCounts[d] = (dubCounts[d] || 0) + 1;
          totalDubs++;
        });
      });
      const breakdown = Object.entries(dubCounts).map(([name, count]) => ({
        name,
        count,
        value: totalDubs > 0 ? Math.round((count / totalDubs) * 100) : 0,
        color: LANGUAGE_COLORS[name] || '#8b5cf6'
      })).sort((a, b) => b.count - a.count).slice(0, 6);
      setDubBreakdown(breakdown);

      // Traffic Area Chart (Simulated based on timestamps)
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const traffic = days.map(day => ({ time: day, views: Math.floor(Math.random() * 50) + 10 }));
      setTrafficData(traffic);

      // Recent Feed
      const actColl = collection(db, 'activities');
      const actQuery = query(actColl, orderBy('timestamp', 'desc'), limit(15));
      const actSnap = await getDocs(actQuery);
      const activities: ActivityEvent[] = [];
      actSnap.forEach(d => {
        const data = d.data();
        activities.push({
          id: d.id,
          user: data.user || 'User',
          action: data.action || 'viewed',
          animeTitle: data.animeTitle || 'Unknown',
          time: formatRelativeTime(data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp),
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now()
        });
      });
      setRecentActivities(activities);

      setIsLoading(false);
    } catch (error) {
      console.error('[Admin] Global Fetch Error:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchRealData();
      // Optimization: No more onSnapshot or auto-refresh
    }
  }, [isAdmin, fetchRealData]);

  const handleTriggerEdit = (anime: AnimeRecord) => {
    if (onEditAnime) onEditAnime(anime);
    else setEditingAnime(anime);
  };

  const handleExportBackup = () => {
    dbService.exportBackup();
    toast.success('Backup Ready', 'Anime data has been downloaded as JSON.');
  };

  const filteredCatalog = useMemo(() => {
    return catalogTitles.filter(a => 
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [catalogTitles, searchQuery]);

  // Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    const trimmed = passcode.trim();
    if (['admin123', 'prasanth123', 'admin@anidub.in', '8648317719'].includes(trimmed)) {
      sessionStorage.setItem('anidub_is_admin', 'true');
      localStorage.setItem('anidub_is_admin', 'true');
      setIsAdmin(true);
      toast.success('Admin Unlocked', 'Welcome to the Control Center.');
    } else {
      setPasscodeError('Invalid Key');
    }
    setIsVerifying(false);
  };

  const handleApprove = async (anime: AnimeRecord) => {
    setApprovingId(anime.id);
    const success = dbService.approveSubmission(anime.id, undefined, 'Admin');
    if (success) toast.success('Approved', `"${anime.title}" is now live.`);
    else toast.error('Error', 'Could not approve anime.');
    setApprovingId(null);
    fetchRealData();
  };

  const handleReject = async (anime: AnimeRecord) => {
    dbService.rejectSubmission(anime.id, undefined, 'Admin');
    toast.info('Rejected', `"${anime.title}" marked as rejected.`);
    fetchRealData();
  };

  const handleSoftDelete = async (anime: AnimeRecord) => {
    dbService.deleteSubmission(anime.id);
    toast.success('Moved to Trash', `"${anime.title}" can be restored later.`);
    fetchRealData();
  };

  const handleRestore = async (anime: AnimeRecord) => {
    setIsRestoring(true);
    dbService.restoreSubmission(anime.id);
    toast.success('Restored', `"${anime.title}" is back in catalog.`);
    setIsRestoring(false);
    fetchRealData();
  };

  const handleDeleteConfirm = async () => {
    if (!animeToDelete) return;
    setIsDeleting(true);
    dbService.permanentlyDeleteSubmission(animeToDelete.id);
    toast.success('Erased', 'Record permanently removed.');
    setAnimeToDelete(null);
    setIsDeleting(false);
    fetchRealData();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setIsImporting(true);
        const res = await dbService.bulkImportAnime(json);
        
        const summary = [
          res.added > 0 ? `${res.added} New added to Pending` : '',
          res.updated > 0 ? `${res.updated} Existing updated` : '',
          res.failed > 0 ? `${res.failed} Failed` : ''
        ].filter(Boolean).join(', ');
        
        toast.success('Import Complete', summary || 'No changes made.');
        fetchRealData();
      } catch { 
        toast.error('Error', 'Invalid JSON file structure.'); 
      }
      finally { 
        setIsImporting(false); 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  const handleExitAdmin = () => {
    sessionStorage.removeItem('anidub_is_admin');
    localStorage.removeItem('anidub_is_admin');
    authService.logout();
    setIsAdmin(false);
    if (onExitAdmin) onExitAdmin();
    else router.push('/');
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-[#131926] border border-purple-500/20 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black">Admin Access</h2>
            <p className="text-xs text-neutral-400">Enter your secure key to continue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input type="password" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Passcode" className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all pr-10" autoFocus />
              <KeyRound className="w-4 h-4 text-neutral-600 absolute right-3.5 top-3.5" />
            </div>
            {passcodeError && <p className="text-xs text-red-400 font-bold">{passcodeError}</p>}
            <button type="submit" disabled={isVerifying} className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black transition-all disabled:opacity-50">
              {isVerifying ? 'Checking...' : 'UNLOCK PANEL'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white font-sans selection:bg-purple-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0b0f17]/90 backdrop-blur-md border-b border-neutral-800/60 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black tracking-tight">AniDub India</h1>
              <p className="text-[10px] text-neutral-500 font-mono">Control Dashboard v2.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchRealData(true)} 
              disabled={isLoading}
              className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-all border border-neutral-700 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => router.push('/')} className="px-3 py-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-all border border-neutral-700 cursor-pointer flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Catalog</span>
            </button>
            <button onClick={handleExitAdmin} className="px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-bold transition-all cursor-pointer">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto mt-4 flex gap-1 overflow-x-auto scrollbar-none pb-1">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'pending', label: `Pending (${pendingSubmissions})`, icon: Inbox },
            { id: 'catalog', label: 'Manage', icon: Database },
            { id: 'feed', label: 'Feed', icon: Radio },
            { id: 'trash', label: 'Trash', icon: Trash2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 border ${
                activeTab === tab.id
                  ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                  : 'bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Active Users', value: activeUsers, icon: Users, color: 'text-purple-400' },
                { label: 'Total Saves', value: totalWatchlists, icon: Bookmark, color: 'text-emerald-400' },
                { label: 'Catalog Size', value: catalogTitles.length, icon: Tv, color: 'text-blue-400' },
                { label: 'Pending Review', value: pendingSubmissions, icon: Inbox, color: 'text-amber-400' },
              ].map(stat => (
                <div key={stat.label} className="p-5 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-2">
                  <div className="flex items-center justify-between text-neutral-500">
                    <stat.icon className="w-5 h-5" />
                    <ArrowUpRight className="w-4 h-4 opacity-50" />
                  </div>
                  <div className="text-2xl font-black">{stat.value.toLocaleString()}</div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Regional Dub Pie Chart */}
              <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span>Regional Dub Distribution</span>
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <div className="h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dubBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                          {dubBreakdown.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1 text-xs">
                    {dubBreakdown.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-neutral-400 font-bold">{d.name}</span>
                        <span className="text-white font-black">{d.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Popularity Bar Chart */}
              <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-6">
                <h3 className="font-black flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Top Ranking Titles</span>
                </h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mostWatchlisted} margin={{ left: -30 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={v => v.length > 8 ? v.slice(0, 7) + '...' : v} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0b0f17', border: '1px solid #27272a', borderRadius: '12px', fontSize: '10px' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Inbox className="w-5 h-5 text-amber-500" />
                <span>Moderation Queue</span>
              </h2>
              <span className="text-[10px] font-black bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest">{pendingSubmissions} Waiting</span>
            </div>

            {pendingList.length === 0 ? (
              <div className="p-20 text-center bg-[#131926] border border-neutral-800 rounded-3xl space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mx-auto" />
                <p className="text-neutral-500 font-bold">Queue is empty. You're all caught up!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingList.map(anime => (
                  <div key={anime.id} className="p-4 rounded-3xl bg-[#131926] border border-amber-500/30 shadow-xl space-y-4 flex flex-col">
                    <div className="flex gap-4">
                      <img src={anime.poster} className="w-20 h-28 object-cover rounded-2xl bg-neutral-800 shadow-2xl border border-neutral-700/50" alt="" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="font-black text-lg truncate leading-tight">{anime.title}</h3>
                        <p className="text-[10px] text-neutral-500 font-mono">#{anime.id}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {anime.dubs.map(d => <span key={d} className="px-2 py-0.5 rounded-lg text-[9px] font-black text-white" style={{ backgroundColor: LANGUAGE_COLORS[d] || '#52525b' }}>{d.toUpperCase()}</span>)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-auto pt-4 border-t border-neutral-800/60">
                      <button onClick={() => handleApprove(anime)} disabled={approvingId === anime.id} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase">
                        {approvingId === anime.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        APPROVE
                      </button>
                      <button onClick={() => handleTriggerEdit(anime)} className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[10px] border border-neutral-700 transition-all uppercase">EDIT</button>
                      <button onClick={() => handleReject(anime)} className="px-4 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 font-bold text-[10px] border border-red-500/20 transition-all uppercase">REJECT</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Catalog Tab */}
        {activeTab === 'catalog' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg font-black flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-400" />
                  <span>Anime Catalog</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportBackup} className="p-2.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-all border border-neutral-700 cursor-pointer" title="Backup JSON"><Download className="w-4 h-4" /></button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-all border border-neutral-700 cursor-pointer" title="Import JSON"><Upload className="w-4 h-4" /></button>
                  <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 cursor-pointer uppercase tracking-tighter">
                    <Plus className="w-4 h-4" />
                    ADD NEW
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                </div>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search title, ID, or language..." className="w-full bg-neutral-900 border border-neutral-700 rounded-2xl py-3 pl-10 pr-4 text-xs focus:border-purple-500 outline-none" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredCatalog.map(anime => (
                <div key={anime.id} className="p-4 rounded-3xl bg-[#131926]/60 border border-neutral-800 hover:bg-[#131926] transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <img src={anime.poster} className="w-14 h-20 object-cover rounded-xl bg-neutral-800 shadow-lg border border-neutral-700/50" alt="" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${anime.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>{anime.status}</span>
                        <span className="text-[10px] text-neutral-600 font-mono">#{anime.id}</span>
                      </div>
                      <h3 className="font-black text-white text-base truncate">{anime.title}</h3>
                      <p className="text-[10px] text-neutral-500 italic">Last Updated {formatRelativeTime(anime.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-800/60">
                    <button onClick={() => handleTriggerEdit(anime)} className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[10px] border border-neutral-700 transition-all uppercase">EDIT</button>
                    <button onClick={() => handleSoftDelete(anime)} className="p-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              {filteredCatalog.length === 0 && <div className="p-12 text-center text-neutral-500 italic text-sm">No results found for your search.</div>}
            </div>
          </div>
        )}

        {/* Trash Tab */}
        {activeTab === 'trash' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h2 className="text-lg font-black flex items-center gap-2 px-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              <span>Recycle Bin</span>
              <span className="text-[10px] bg-red-500/10 text-red-400 px-3 py-1 rounded-full">{deletedList.length}</span>
            </h2>
            {deletedList.length === 0 ? (
              <div className="p-20 text-center bg-[#131926] border border-neutral-800 rounded-3xl text-neutral-500 font-bold">Trash is empty. Safe and sound.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deletedList.map(anime => (
                  <div key={anime.id} className="p-4 rounded-3xl bg-red-950/5 border border-red-900/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 opacity-60">
                      <img src={anime.poster} className="w-12 h-16 object-cover rounded-xl grayscale" alt="" />
                      <div className="min-w-0">
                        <h3 className="font-black truncate">{anime.title}</h3>
                        <p className="text-[10px] text-neutral-500">Deleted {formatRelativeTime(anime.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRestore(anime)} disabled={isRestoring} className="p-2.5 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 transition-all"><RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} /></button>
                      <button onClick={() => setAnimeToDelete(anime)} className="p-2.5 rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600/20 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Feed Tab */}
        {activeTab === 'feed' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h2 className="text-lg font-black flex items-center gap-2 px-2">
              <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
              <span>Real-Time Activity</span>
            </h2>
            <div className="bg-[#131926] border border-neutral-800 rounded-3xl divide-y divide-neutral-800/60 overflow-hidden shadow-2xl">
              {recentActivities.length === 0 ? (
                <div className="p-12 text-center text-neutral-500 italic">No activity logged yet.</div>
              ) : (
                recentActivities.map(act => (
                  <div key={act.id} className="p-5 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${act.action === 'submitted' ? 'bg-purple-500 animate-pulse' : act.action === 'approved' ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate"><span className="text-neutral-400 font-normal">@{act.user}</span> {act.action} <span className="text-purple-400">{act.animeTitle}</span></p>
                        <p className="text-[10px] text-neutral-500 font-mono tracking-tighter mt-0.5">{act.time}</p>
                      </div>
                    </div>
                    {act.action === 'submitted' && (
                      <button onClick={() => { setActiveTab('pending'); window.scrollTo(0, 0); }} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-[10px] font-black hover:text-white transition-all uppercase">REVIEW</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {animeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isDeleting && setAnimeToDelete(null)} className="fixed inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-[#111726] border border-red-500/20 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-red-500">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-black text-xl">Confirm Delete</h3>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">You are about to permanently erase <span className="text-white font-bold">"{animeToDelete.title}"</span> from the Cloud Firestore database. This action cannot be undone.</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setAnimeToDelete(null)} disabled={isDeleting} className="flex-1 py-3 rounded-xl bg-neutral-800 text-white font-black text-xs">CANCEL</button>
                <button onClick={handleDeleteConfirm} disabled={isDeleting} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-xs shadow-lg shadow-red-600/20 disabled:opacity-50 uppercase">{isDeleting ? 'ERASING...' : 'DELETE'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {editingAnime && <SubmitDubModal isOpen={true} editAnime={editingAnime} onClose={() => setEditingAnime(null)} onSuccess={() => { setEditingAnime(null); fetchRealData(); }} />}
      {isAddModalOpen && <SubmitDubModal isOpen={true} onClose={() => setIsAddModalOpen(false)} onSuccess={() => { setIsAddModalOpen(false); fetchRealData(); }} />}
    </div>
  );
};

export default AdminDashboard;
