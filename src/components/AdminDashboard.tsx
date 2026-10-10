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
  Link2,
  Layers,
  Clock,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dbService, isQuotaError } from '../services/databaseService';
import { syncManager } from '../services/syncManager';
import { authService } from '../services/authService';
import { useUploadProgress } from '../hooks/useUploadProgress';
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
  Bengali: '#db2777',
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

  // Pagination State
  const [lastDocPending, setLastDocPending] = useState<any>(null);
  const [lastDocCatalog, setLastDocCatalog] = useState<any>(null);
  const [hasMorePending, setHasMorePending] = useState(true);
  const [hasMoreCatalog, setHasMoreCatalog] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [catalogDisplayLimit, setCatalogDisplayLimit] = useState(20);
  
  // Chart Data
  const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
  const [mostWatchlisted, setMostWatchlisted] = useState<WatchlistStat[]>([]);
  const [dubBreakdown, setDubBreakdown] = useState<DubLanguageMetric[]>([]);

  // =========================================================================
  // ZERO-QUOTA METRICS & INSIGHTS: Derived strictly from cached catalogTitles
  // =========================================================================

  // 1. Language Distribution (Pie / Donut Chart)
  const languageDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalDubs = 0;
    catalogTitles.forEach(a => {
      (a.dubs || []).forEach(d => {
        counts[d] = (counts[d] || 0) + 1;
        totalDubs++;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        value: count,
        percent: totalDubs > 0 ? Math.round((count / totalDubs) * 100) : 0,
        color: LANGUAGE_COLORS[name] || '#8b5cf6',
      }))
      .sort((a, b) => b.count - a.count);
  }, [catalogTitles]);

  // 2. Genre Distribution (Bar Chart of top catalog genres)
  const genreDistribution = useMemo(() => {
    const genreCounts: Record<string, number> = {};
    catalogTitles.forEach(a => {
      (a.genres || []).forEach(g => {
        const clean = typeof g === 'string' ? g.trim() : '';
        if (clean && clean !== 'All Genres') {
          genreCounts[clean] = (genreCounts[clean] || 0) + 1;
        }
      });
    });
    return Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [catalogTitles]);

  // 3. Anime Status: Ongoing vs Completed ratio (Donut / Pie Chart)
  const statusDistribution = useMemo(() => {
    let ongoing = 0;
    let completed = 0;
    catalogTitles.forEach(a => {
      const status = String(a.airingStatus || a.status || '').toLowerCase();
      if (status.includes('ongoing') || status.includes('airing') || status.includes('simulcast')) {
        ongoing++;
      } else {
        completed++;
      }
    });
    const total = ongoing + completed;
    return [
      {
        name: 'Completed',
        count: completed,
        value: completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        color: '#10b981', // Emerald
      },
      {
        name: 'Ongoing',
        count: ongoing,
        value: ongoing,
        percent: total > 0 ? Math.round((ongoing / total) * 100) : 0,
        color: '#f59e0b', // Amber
      },
    ];
  }, [catalogTitles]);

  // 4. Platform Links Count & Breakdown
  const platformStats = useMemo(() => {
    let totalLinks = 0;
    const platformCounts: Record<string, number> = {};
    catalogTitles.forEach(a => {
      (a.platforms || []).forEach(p => {
        totalLinks++;
        const pName = typeof p === 'string' ? p : (p?.name || 'Other');
        let normName = pName;
        const lower = pName.toLowerCase();
        if (lower.includes('crunchyroll')) normName = 'Crunchyroll';
        else if (lower.includes('netflix')) normName = 'Netflix';
        else if (lower.includes('jio')) normName = 'JioCinema';
        else if (lower.includes('muse')) normName = 'YouTube (Muse)';
        else if (lower.includes('ani-one')) normName = 'YouTube (Ani-One)';
        else if (lower.includes('youtube')) normName = 'YouTube';
        else if (lower.includes('prime')) normName = 'Prime Video';
        else if (lower.includes('hotstar') || lower.includes('disney')) normName = 'Hotstar';

        platformCounts[normName] = (platformCounts[normName] || 0) + 1;
      });
    });

    const breakdown = Object.entries(platformCounts)
      .map(([name, count]) => {
        let color = '#8b5cf6';
        if (name === 'Crunchyroll') color = '#f97316';
        else if (name === 'Netflix') color = '#ef4444';
        else if (name === 'JioCinema') color = '#06b6d4';
        else if (name.includes('YouTube')) color = '#e11d48';
        else if (name.includes('Hotstar')) color = '#3b82f6';
        else if (name.includes('Prime')) color = '#14b8a6';

        return {
          name,
          count,
          percent: totalLinks > 0 ? Math.round((count / totalLinks) * 100) : 0,
          color,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { totalLinks, breakdown };
  }, [catalogTitles]);

  // UI State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'catalog' | 'trash' | 'feed'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [animeToDelete, setAnimeToDelete] = useState<AnimeRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingAnime, setEditingAnime] = useState<AnimeRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pendingUploadsCount, setPendingUploadsCount] = useState<number>(0);

  // Enterprise Serverless Queue Progress Hook (system/upload_status)
  const { 
    progress: serverQueueProgress, 
    startBulkUpload, 
    resetProgress: resetServerProgress 
  } = useUploadProgress();

  const checkPendingUploads = useCallback(async () => {
    try {
      const localItems = dbService.getAdminPendingUploads();
      const idbCount = await syncManager.getAdminPendingCount();
      setPendingUploadsCount(Math.max(localItems.length, idbCount));
    } catch {
      const localItems = dbService.getAdminPendingUploads();
      setPendingUploadsCount(localItems.length);
    }
  }, []);

  useEffect(() => {
    checkPendingUploads();
    const unsub = syncManager.subscribe((status) => {
      setPendingUploadsCount((prev) => Math.max(status.adminQueueCount, prev));
    });
    return () => unsub();
  }, [checkPendingUploads]);

  // Auth State
  const [isAdmin, setIsAdmin] = useState<boolean>(() => authService.isAdmin());
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);


  useEffect(() => {
    const unsub = authService.subscribe(() => setIsAdmin(authService.isAdmin()));
    return () => unsub();
  }, []);

  const catalogTitlesRef = React.useRef(catalogTitles);
  useEffect(() => {
    catalogTitlesRef.current = catalogTitles;
  }, [catalogTitles]);

  const fetchRealData = useCallback(async (force = false) => {
    // Optimization: Skip if we already have data and are not forcing a refresh
    if (!force && catalogTitlesRef.current.length > 0) return;

    setIsLoading(true);
    try {
      // 1. Fetch Paginated PENDING
      const pendingRes = await dbService.getSubmissionsPaginated('pending', null, 20);
      setPendingList(pendingRes.items);
      setLastDocPending(pendingRes.lastDoc);
      setHasMorePending(pendingRes.items.length === 20);
      setPendingSubmissions(pendingRes.items.length); // Rough count for badge

      // 2. Fetch All Approved Catalog
      if (force) {
        await dbService.forceRefresh();
      }
      const allApproved = dbService.getApprovedAnime();
      setCatalogTitles(allApproved);

      // 3. Fetch Trash / Deleted list from Supabase
      try {
        const deletedRes = await dbService.getDeletedSubmissionsFromDb();
        setDeletedList(deletedRes);
      } catch (delErr) {
        console.warn('[Admin] Deleted fetch notice:', delErr);
      }

      // Aggregates for Metrics (Still need a way to get total count cheaply or just use visible list)
      const totalWatchlistsCount = allApproved.reduce((acc, curr) => acc + (curr.likes || 0), 0);
      setTotalWatchlists(totalWatchlistsCount);
      setActiveUsers(Math.floor(totalWatchlistsCount * 0.4) + 12);

      // Popularity Bar Chart
      const sortedByPopularity = [...allApproved]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 5)
        .map(a => ({ id: a.id, name: a.title, count: a.likes || 0 }));
      setMostWatchlisted(sortedByPopularity);

      // Dub Breakdown Pie Chart
      const dubCounts: Record<string, number> = {};
      let totalDubs = 0;
      allApproved.forEach(a => {
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

      // Traffic Area Chart (Simulated)
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      setTrafficData(days.map(day => ({ time: day, views: Math.floor(Math.random() * 50) + 10 })));

      // Recent Feed via Supabase
      try {
        const { data: actRows } = await supabase
          .from('activities')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(15);

        if (actRows) {
          const activities: ActivityEvent[] = actRows.map((data: any) => ({
            id: data.id || `act-${Math.random()}`,
            user: data.user || 'User',
            action: data.action || 'viewed',
            animeTitle: data.animeTitle || 'Unknown',
            time: formatRelativeTime(data.timestamp),
            timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now()
          }));
          setRecentActivities(activities);
        }
      } catch (actErr) {
        console.warn('[Admin] Activities fetch warning:', actErr);
      }
    } catch (error) {
      console.error('[Admin] Global Fetch Error:', error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  const handleManualRefresh = async () => {
    setIsSyncing(true);
    try {
      await fetchRealData(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadMorePending = async () => {
    if (!lastDocPending || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await dbService.getSubmissionsPaginated('pending', lastDocPending, 15);
      setPendingList(prev => [...prev, ...res.items]);
      setLastDocPending(res.lastDoc);
      setHasMorePending(res.items.length === 15);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadMoreCatalog = () => {
    setCatalogDisplayLimit(prev => prev + 20);
  };


  useEffect(() => {
    if (isAdmin) {
      fetchRealData();
      // Optimization: No more onSnapshot or auto-refresh
    }
  }, [isAdmin]);

  // Automated Alert for Background Worker Failures
  useEffect(() => {
    if (serverQueueProgress.status === 'failed') {
      console.log('[Queue] Progress status is FAILED. Alerting user.');
      toast.error(
        'Queue Processing Failed',
        serverQueueProgress.error || 'The background upload worker encountered a fatal error and stopped.'
      );
    } else if (serverQueueProgress.status === 'completed') {
      console.log('[Queue] Progress status is COMPLETED.');
    }
  }, [serverQueueProgress.status, serverQueueProgress.error]);

  // Simulation: Fake Resource Exhausted Error
  const handleSimulateUploadError = async () => {
    console.log('[Simulation] Step 1: STARTING FAKE QUOTA ERROR SIMULATION...');
    setIsImporting(true);
    resetServerProgress();
    
    try {
      const jobId = 'sim_quota_' + Date.now();
      
      console.log('[Simulation] Step 2: Setting initial processing state...');
      await supabase.from('system_status').upsert({
        id: 'upload_status',
        jobId,
        status: 'processing',
        totalItems: 5,
        processedItems: 1,
        percentage: 20,
        error: null,
        updatedAt: new Date().toISOString()
      });

      await new Promise(r => setTimeout(r, 1500));
      
      console.log('[Simulation] Step 3: Triggering FAILED status with Quota message...');
      await supabase.from('system_status').upsert({
        id: 'upload_status',
        jobId,
        status: 'failed',
        error: 'Quota Exceeded (SIMULATED): 8 RESOURCE_EXHAUSTED: Quota exceeded for write requests.',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log('[Simulation] Step 4: SUCCESS. UI should now show failure icon and Dismiss button.');
    } catch (err) {
      console.error('[Simulation] Step X: Simulation execution failed:', err);
    } finally {
      console.log('[Simulation] Step Finally: Local spinner stopped.');
      setIsImporting(false);
    }
  };

  const handleTriggerEdit = (anime: AnimeRecord) => {
    setEditingAnime(anime);
  };

  const csvFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleExportBackup = () => {
    dbService.exportBackup();
    toast.success('Backup Ready', 'Anime data has been downloaded as JSON.');
  };

  const handleExportCsv = () => {
    dbService.exportCsvCatalog();
    toast.success('CSV Exported', 'Anime catalog downloaded as CSV.');
  };

  const handleDownloadCsvTemplate = () => {
    dbService.downloadCsvTemplate();
    toast.success('Template Downloaded', 'CSV import template ready.');
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const res = await dbService.importCsvFile(file);
      toast.success('CSV Import Complete', `Added: ${res.added}, Updated: ${res.updated}, Failed: ${res.failed}`);
      fetchRealData(true);
    } catch (err: any) {
      toast.error('CSV Import Failed', err?.message || 'Could not parse CSV file.');
    } finally {
      setIsImporting(false);
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    }
  };

  const filteredCatalog = useMemo(() => {
    return catalogTitles.filter(a => 
      !a.isDeleted && 
      (a as any).is_deleted !== true && 
      (
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [catalogTitles, searchQuery]);
  const displayedCatalog = useMemo(() => {
    return filteredCatalog.slice(0, catalogDisplayLimit);
  }, [filteredCatalog, catalogDisplayLimit]);
  const hasMoreCatalogDisplay = catalogDisplayLimit < filteredCatalog.length;

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
    console.log('Step 1: handleApprove Clicked', anime.id, anime.title);
    setProcessingId(anime.id);
    
    // CAPTURE CURRENT STATE FOR REVERSION
    const prevPending = [...pendingList];
    const prevCatalog = [...catalogTitles];
    const prevCount = pendingSubmissions;

    try {
      console.log('Step 2: Optimistic UI Update...');
      setPendingList(prev => prev.filter(p => p.id !== anime.id));
      setPendingSubmissions(prev => Math.max(0, prev - 1));
      setCatalogTitles(prev => {
        const next: AnimeRecord[] = [
          { ...anime, status: 'approved' as any, submissionStatus: 'approved' as any },
          ...prev.filter(a => a.id !== anime.id)
        ];
        return next;
      });

      console.log('Step 3: Calling dbService.approveSubmission...');
      const success = await dbService.approveSubmission(anime, undefined, 'Admin');
      
      if (success) {
        console.log('Step 4: Firestore success.');
        toast.success('Approved', `"${anime.title}" is now live.`);
      } else {
        throw new Error('Database service returned failure');
      }
    } catch (err: any) {
      console.error('Step X: handleApprove FAILED. Reverting state...', err);
      setPendingList(prevPending);
      setCatalogTitles(prevCatalog);
      setPendingSubmissions(prevCount);
      toast.error('Approve Failed', isQuotaError(err) ? 'Database limit reached.' : 'An unexpected error occurred.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (anime: AnimeRecord) => {
    console.log('Step 1: handleReject Clicked', anime.id, anime.title);
    setProcessingId(anime.id);

    const prevPending = [...pendingList];
    const prevCatalog = [...catalogTitles];
    const prevCount = pendingSubmissions;

    try {
      console.log('Step 2: Optimistic UI Update...');
      setPendingList(prev => prev.filter(p => p.id !== anime.id));
      setPendingSubmissions(prev => Math.max(0, prev - 1));
      setCatalogTitles(prev => {
        const next: AnimeRecord[] = prev.map(a => a.id === anime.id ? { ...a, status: 'rejected' as any, submissionStatus: 'rejected' as any } : a);
        return next;
      });

      console.log('Step 3: Calling dbService.rejectSubmission...');
      const success = await dbService.rejectSubmission(anime, undefined, 'Admin');
      
      if (success) {
        console.log('Step 4: Firestore success.');
        toast.info('Rejected', `"${anime.title}" marked as rejected.`);
      } else {
        throw new Error('Database service returned failure');
      }
    } catch (err: any) {
      console.error('Step X: handleReject FAILED. Reverting state...', err);
      setPendingList(prevPending);
      setCatalogTitles(prevCatalog);
      setPendingSubmissions(prevCount);
      toast.error('Reject Failed', isQuotaError(err) ? 'Database limit reached.' : 'An error occurred.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSoftDelete = async (anime: AnimeRecord) => {
    console.log('Step 1: handleSoftDelete Clicked', anime.id);
    try {
      console.log('Step 2: Calling dbService.deleteSubmission...');
      await dbService.deleteSubmission(anime.id);
      console.log('Step 3: Database operation verified. Updating local state...');
      toast.success('Moved to Trash', `"${anime.title}" can be restored later.`);
      // Immediately update local state for responsive UI
      setCatalogTitles(prev => prev.filter(a => String(a.id) !== String(anime.id)));
      setPendingList(prev => prev.filter(p => String(p.id) !== String(anime.id)));
      setPendingSubmissions(prev => Math.max(0, prev - 1));
      const deletedItem = dbService.normalizeRecord({ ...anime, isDeleted: true });
      setDeletedList(prev => [deletedItem, ...prev.filter(a => String(a.id) !== String(anime.id))]);
      console.log('Step 4: Local state updated.');
    } catch (err: any) {
      console.error('Step 2b: Soft delete error:', err);
      const errMsg = err?.message || 'Failed to move anime to trash in Supabase.';
      toast.error('Delete Failed', isQuotaError(err) ? 'Database limit reached.' : errMsg);
    }
  };

  const handlePermanentDeleteLive = (anime: AnimeRecord) => {
    setAnimeToDelete(anime);
  };

  const handleRestore = async (anime: AnimeRecord) => {
    console.log('Step 1: handleRestore Clicked', anime.id);
    setIsRestoring(true);
    try {
      console.log('Step 2: Calling dbService.restoreSubmission...');
      await dbService.restoreSubmission(anime.id);
      console.log('Step 3: Database operation verified. Updating local state...');
      toast.success('Restored', `"${anime.title}" is back in catalog.`);
      // Immediately update local state
      setDeletedList(prev => prev.filter(a => String(a.id) !== String(anime.id)));
      const restoredItem = dbService.normalizeRecord({ ...anime, isDeleted: false });
      setCatalogTitles(prev => [restoredItem, ...prev.filter(a => String(a.id) !== String(anime.id))]);
      console.log('Step 4: Local state updated.');
    } catch (err: any) {
      console.error('Step 2b: Restore error:', err);
      const errMsg = err?.message || 'Failed to restore anime in Supabase.';
      toast.error('Restore Failed', isQuotaError(err) ? 'Database limit reached.' : errMsg);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!animeToDelete) return;
    console.log('Step 1: handleDeleteConfirm Clicked', animeToDelete.id);
    setIsDeleting(true);
    try {
      console.log('Step 2: Calling dbService.permanentlyDeleteLiveAnime...');
      await dbService.permanentlyDeleteLiveAnime(animeToDelete.id);
      console.log('Step 3: Database operation verified. Updating local state...');

      // ONLY show success toast if operation genuinely succeeded
      toast.success('Deleted Permanently', `"${animeToDelete.title}" has been removed from the database.`);

      // Immediately update local state across all lists
      setCatalogTitles(prev => prev.filter(a => String(a.id) !== String(animeToDelete.id)));
      setDeletedList(prev => prev.filter(a => String(a.id) !== String(animeToDelete.id)));
      setPendingList(prev => prev.filter(p => String(p.id) !== String(animeToDelete.id)));
      setAnimeToDelete(null);
      console.log('Step 4: Local state updated.');
    } catch (err: any) {
      console.error('Step 2b: Permanent delete error caught:', err);
      // Catch Supabase error (like RLS or foreign key constraints) and show ACTUAL error message in toast
      const errorMsg = err?.message || 'Database deletion failed in Supabase.';
      toast.error('Failed to Delete', isQuotaError(err) ? 'Database limit reached.' : errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };



  const handleResumeUpload = async () => {
    setIsImporting(true);
    try {
      const batchRes = await syncManager.processAdminBatchUpload();
      const legacyRes = await dbService.resumeBulkImport();
      await checkPendingUploads();

      const quotaHit = batchRes.quotaHit || legacyRes.quotaHit;
      const totalRemaining = batchRes.remaining + legacyRes.remaining;
      const totalAdded = batchRes.added + legacyRes.added;

      if (quotaHit) {
        toast.error(
          'Quota Hit Again',
          `${totalRemaining} pending uploads still stored safely in queue. Resume again when traffic reduces.`
        );
      } else {
        const summary = [
          totalAdded > 0 ? `${totalAdded} Processed` : '',
          batchRes.failed > 0 ? `${batchRes.failed} Failed` : ''
        ].filter(Boolean).join(', ');
        toast.success('Resume Upload Complete', summary || 'All queued items processed.');
      }
      fetchRealData(true);
    } catch (err) {
      toast.error('Resume Failed', 'Could not resume pending uploads.');
    } finally {
      setIsImporting(false);
    }
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
              onClick={handleManualRefresh} 
              disabled={isSyncing || isLoading}
              className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-all border border-neutral-700 disabled:opacity-50 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
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


        {/* Real-time Serverless Queue Progress UI (Listening to Firestore system/upload_status) */}
        {(serverQueueProgress.status === 'processing' || 
          serverQueueProgress.status === 'queued' || 
          serverQueueProgress.status === 'failed' ||
          (serverQueueProgress.status === 'completed' && serverQueueProgress.totalItems > 0)) && (
          <div className={`bg-[#131926] border rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-3 duration-300 ${
            serverQueueProgress.status === 'failed' ? 'border-red-500/30' : 'border-purple-500/30'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  serverQueueProgress.status === 'completed' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : serverQueueProgress.status === 'failed'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse'
                }`}>
                  {serverQueueProgress.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : serverQueueProgress.status === 'failed' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white">
                      {serverQueueProgress.status === 'completed' 
                        ? 'Bulk Upload Completed' 
                        : serverQueueProgress.status === 'failed'
                        ? 'Bulk Upload Failed'
                        : 'Serverless Queue Processing'}
                    </h4>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      serverQueueProgress.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : serverQueueProgress.status === 'failed'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      {serverQueueProgress.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {serverQueueProgress.status === 'completed' 
                      ? `Successfully processed ${serverQueueProgress.successCount} of ${serverQueueProgress.totalItems} items into Firestore.` 
                      : serverQueueProgress.status === 'failed'
                      ? `Processing stopped. ${serverQueueProgress.processedItems} items processed before failure.`
                      : `Processing batch ${serverQueueProgress.currentBatch} of ${serverQueueProgress.totalBatches} (${serverQueueProgress.processedItems} / ${serverQueueProgress.totalItems} processed)`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-xl font-black text-white tracking-tight">
                    {serverQueueProgress.processedItems} / {serverQueueProgress.totalItems}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    {serverQueueProgress.percentage}% Processed
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSimulateUploadError}
                    className="px-3 py-1.5 rounded-lg bg-red-900/20 text-red-400 border border-red-900/30 text-[10px] font-black uppercase hover:bg-red-900/30 transition-all"
                  >
                    Simulate Error
                  </button>
                  {serverQueueProgress.status === 'completed' || serverQueueProgress.status === 'failed' ? (
                    <button
                      onClick={() => {
                        resetServerProgress();
                        fetchRealData(true);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-white text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95 ${
                        serverQueueProgress.status === 'failed' ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'
                      }`}
                    >
                      Dismiss
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (confirm('Manually reset progress? This will only clear the UI status, not stop any running background worker.')) {
                          resetServerProgress();
                        }
                      }}
                      className="p-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-all border border-neutral-700 cursor-pointer"
                      title="Reset Progress UI"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-neutral-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    serverQueueProgress.status === 'completed'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 animate-pulse'
                  }`}
                  style={{ width: `${serverQueueProgress.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                <span className="truncate max-w-[220px] sm:max-w-md">
                  {serverQueueProgress.lastProcessedTitle 
                    ? `Current: ${serverQueueProgress.lastProcessedTitle}` 
                    : 'Streaming batched writes...'}
                </span>
                <div className="flex items-center gap-3 font-semibold">
                  <span className="text-emerald-400">{serverQueueProgress.successCount} Successful</span>
                  {serverQueueProgress.failedCount > 0 && (
                    <span className="text-red-400">{serverQueueProgress.failedCount} Failed</span>
                  )}
                  {serverQueueProgress.dlqCount > 0 && (
                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {serverQueueProgress.dlqCount} in DLQ
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Backoff / Rate limit banner if worker is currently retrying */}
            {serverQueueProgress.error && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{serverQueueProgress.error}</span>
              </div>
            )}
          </div>
        )}

        {/* Admin Cloud Fallback (Supabase) Sync Alert */}
        {/* Local Queue Quota Hit Alert & Resume Button */}
        {pendingUploadsCount > 0 && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3.5 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white">
                    {pendingUploadsCount} pending uploads (Quota hit)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 uppercase tracking-widest border border-amber-500/30">
                    Saved in Queue
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Firestore daily quota was reached during bulk import. The remaining items are safely stored locally in IndexedDB / local queue.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
              <button
                onClick={handleResumeUpload}
                disabled={isImporting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isImporting ? 'animate-spin' : ''}`} />
                <span>Resume Upload</span>
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Are you sure you want to discard all ${pendingUploadsCount} pending items from the queue?`)) {
                    await syncManager.clearAdminPendingUploads();
                    dbService.clearAdminPendingUploads();
                    checkPendingUploads();
                    toast.info('Queue Discarded', 'Pending local upload queue cleared.');
                  }
                }}
                className="p-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-700/60 transition-all cursor-pointer"
                title="Discard pending queue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Catalog Size', value: catalogTitles.length, unit: 'Titles', icon: Tv, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { label: 'Platform Links', value: platformStats.totalLinks, unit: 'Active Links', icon: Link2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Total Saves', value: totalWatchlists, unit: 'Upvotes', icon: Bookmark, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Pending Review', value: (pendingList.length > 0 ? pendingList.length : pendingSubmissions), unit: 'Awaiting', icon: Inbox, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map(stat => (
                <div key={stat.label} className="p-5 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-2">
                  <div className="flex items-center justify-between text-neutral-500">
                    <div className={`p-2 rounded-xl ${stat.bg}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{stat.unit}</span>
                  </div>
                  <div className="text-2xl font-black text-white">{stat.value.toLocaleString()}</div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Visual Charts Grid: Recharts Pie & Bar charts (Zero-Quota, Cached) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Regional Dub Language Distribution (Pie Chart) */}
              <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span>Language Distribution</span>
                  </h3>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    {languageDistribution.length} Languages
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={languageDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="count"
                        >
                          {languageDistribution.map((entry, index) => (
                            <Cell key={`lang-cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0b0f17',
                            border: '1px solid #27272a',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                          formatter={(value: any, name: any) => [`${value} Anime`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 flex-1 text-xs w-full">
                    {languageDistribution.slice(0, 6).map((item) => (
                      <div key={item.name} className="flex items-center justify-between bg-black/20 px-3 py-2 rounded-xl border border-neutral-800/80">
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-neutral-300 font-bold truncate text-[11px]">{item.name}</span>
                        </div>
                        <span className="text-white font-black text-[11px] shrink-0">
                          {item.count} <span className="text-neutral-500 font-normal text-[10px]">({item.percent}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Top Genres Distribution (Bar Chart) */}
              <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Genre Distribution</span>
                  </h3>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    Top {genreDistribution.length} Genres
                  </span>
                </div>
                <div className="h-48 w-full">
                  {genreDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={genreDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#a1a1aa', fontSize: 10 }}
                          tickFormatter={(v) => (v.length > 9 ? v.slice(0, 8) + '..' : v)}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{
                            backgroundColor: '#0b0f17',
                            border: '1px solid #27272a',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                          formatter={(value: any) => [`${value} Anime`, 'Count']}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-500">
                      No genre metadata available in catalog
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Anime Status: Ongoing vs Completed Ratio (Donut / Pie Chart) */}
              <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Anime Airing Status Ratio</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold">
                    <span className="text-emerald-400">{statusDistribution[0]?.percent || 0}% Completed</span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-amber-400">{statusDistribution[1]?.percent || 0}% Ongoing</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={4}
                          dataKey="count"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`status-cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0b0f17',
                            border: '1px solid #27272a',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                          formatter={(value: any, name: any) => [`${value} Anime`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 flex-1 w-full text-xs">
                    {statusDistribution.map((s) => (
                      <div key={s.name} className="p-3.5 rounded-2xl bg-black/20 border border-neutral-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="text-neutral-200 font-bold">{s.name}</span>
                          </div>
                          <span className="text-white font-black">{s.count} titles <span className="text-neutral-400 font-normal">({s.percent}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.percent}%`, backgroundColor: s.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Streaming Platform Links Breakdown */}
              <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-cyan-400" />
                    <span>Total Platform Links</span>
                  </h3>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                    {platformStats.totalLinks} Total Links
                  </span>
                </div>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {platformStats.breakdown.length > 0 ? (
                    platformStats.breakdown.map((p) => (
                      <div key={p.name} className="p-3 rounded-2xl bg-black/20 border border-neutral-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-xs font-bold text-neutral-200">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 sm:w-32 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.percent}%`, backgroundColor: p.color }} />
                          </div>
                          <span className="text-xs font-black text-white w-8 text-right">{p.count}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-32 flex items-center justify-center text-xs text-neutral-500">
                      No streaming platform links cataloged yet
                    </div>
                  )}
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
              <span className="text-[10px] font-black bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest">{(pendingList.length > 0 ? pendingList.length : pendingSubmissions)} Waiting</span>
            </div>

            {pendingList.length === 0 ? (
              <div className="p-20 text-center bg-[#131926] border border-neutral-800 rounded-3xl space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mx-auto" />
                <p className="text-neutral-500 font-bold">Queue is empty. You're all caught up!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingList.map(anime => (
                    <div key={anime.id} className="p-4 rounded-3xl bg-[#131926] border border-amber-500/30 shadow-xl space-y-4 flex flex-col">
                      <div className="flex gap-4">
                        <img src={anime.poster || undefined} loading="lazy" decoding="async" className="w-20 h-28 object-cover rounded-2xl bg-neutral-800 shadow-2xl border border-neutral-700/50" alt="" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-black text-lg truncate leading-tight">{anime.title}</h3>
                          <p className="text-[10px] text-neutral-500 font-mono">#{anime.id}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {anime.dubs.map(d => <span key={d} className="px-2 py-0.5 rounded-lg text-[9px] font-black text-white" style={{ backgroundColor: LANGUAGE_COLORS[d] || '#52525b' }}>{d.toUpperCase()}</span>)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-auto pt-4 border-t border-neutral-800/60">
                        <button onClick={() => handleApprove(anime)} disabled={processingId === anime.id} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase">
                          {processingId === anime.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          APPROVE
                        </button>
                        <button onClick={() => handleTriggerEdit(anime)} disabled={processingId === anime.id} className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[10px] border border-neutral-700 transition-all uppercase disabled:opacity-50">EDIT</button>
                        <button onClick={() => handleReject(anime)} disabled={processingId === anime.id} className="px-4 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 font-bold text-[10px] border border-red-500/20 transition-all uppercase disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {processingId === anime.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          REJECT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMorePending && lastDocPending && (
                  <div className="flex justify-center py-6">
                    <button
                      onClick={loadMorePending}
                      disabled={isLoadingMore}
                      className="px-6 py-2.5 bg-[#182032] hover:bg-[#1e293b] border border-neutral-700 rounded-xl text-xs font-bold text-neutral-300 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      Load Next 15 Items
                    </button>
                  </div>
                )}
              </>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    accept=".csv"
                    ref={csvFileInputRef}
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => csvFileInputRef.current?.click()}
                    disabled={isImporting}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all border border-neutral-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Import CSV"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import CSV</span>
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={handleDownloadCsvTemplate}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
                    title="Download CSV Template"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Template</span>
                  </button>
                  <button onClick={handleExportBackup} className="p-2.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-all border border-neutral-700 cursor-pointer" title="Backup JSON"><Download className="w-4 h-4" /></button>
                  <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 cursor-pointer uppercase tracking-tighter">
                    <Plus className="w-4 h-4" />
                    ADD NEW
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search title, ID, or language..." className="w-full bg-neutral-900 border border-neutral-700 rounded-2xl py-3 pl-10 pr-4 text-xs focus:border-purple-500 outline-none" />
              </div>
            </div>

            <div className="space-y-3">
              {displayedCatalog.map(anime => (
                <div key={anime.id} className="p-4 rounded-3xl bg-[#131926]/60 border border-neutral-800 hover:bg-[#131926] transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <img src={anime.poster || undefined} loading="lazy" decoding="async" className="w-14 h-20 object-cover rounded-xl bg-neutral-800 shadow-lg border border-neutral-700/50" alt="" />
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
                    <button onClick={() => handlePermanentDeleteLive(anime)} className="p-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 transition-all cursor-pointer" title="Delete Permanently from Firestore"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              
              {hasMoreCatalogDisplay && (
                <div className="flex justify-center py-8">
                  <button
                    onClick={loadMoreCatalog}
                    disabled={isLoadingMore}
                    className="px-8 py-3 bg-primary-theme hover:bg-primary-theme/90 text-white rounded-2xl text-sm font-black shadow-lg shadow-primary-theme/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                    Show More Anime
                  </button>
                </div>
              )}

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
                      <img src={anime.poster || undefined} loading="lazy" decoding="async" className="w-12 h-16 object-cover rounded-xl grayscale" alt="" />
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
              <p className="text-xs text-neutral-400 leading-relaxed">You are about to permanently erase <span className="text-white font-bold">"{animeToDelete.title}"</span> from the Supabase database. This action cannot be undone.</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setAnimeToDelete(null)} disabled={isDeleting} className="flex-1 py-3 rounded-xl bg-neutral-800 text-white font-black text-xs">CANCEL</button>
                <button onClick={handleDeleteConfirm} disabled={isDeleting} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-xs shadow-lg shadow-red-600/20 disabled:opacity-50 uppercase">{isDeleting ? 'ERASING...' : 'DELETE'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {editingAnime && (
        <SubmitDubModal
          isOpen={true}
          editAnime={editingAnime}
          onClose={() => setEditingAnime(null)}
          onSuccess={(updatedAnime) => {
            const updated = updatedAnime || editingAnime;
            if (updated) {
              const updatedId = String(updated.id);
              // Map through previous state to update just that specific item while keeping all other pending items intact
              setPendingList(prev => {
                if (!Array.isArray(prev) || prev.length === 0) return [updated];
                const exists = prev.some(item => String(item.id) === updatedId);
                if (!exists) return prev;
                return prev.map(item => 
                  String(item.id) === updatedId ? { ...item, ...updated } : item
                );
              });
              setCatalogTitles(prev => {
                if (!Array.isArray(prev) || prev.length === 0) return [updated];
                const exists = prev.some(item => String(item.id) === updatedId);
                if (!exists) return prev;
                return prev.map(item => 
                  String(item.id) === updatedId ? { ...item, ...updated } : item
                );
              });
              setPendingSubmissions(prev => Math.max(prev, 1));
            }
            setEditingAnime(null);
          }}
        />
      )}
      {isAddModalOpen && <SubmitDubModal isOpen={true} onClose={() => setIsAddModalOpen(false)} onSuccess={() => { setIsAddModalOpen(false); fetchRealData(true); }} />}
    </div>
  );
};

export default AdminDashboard;
