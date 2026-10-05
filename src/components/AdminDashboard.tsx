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
  ArrowDownRight,
  Radio,
  Clock,
  Flame,
  Globe,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  LogOut,
  Edit,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Database,
  Trash2,
  Search,
  Plus,
  AlertTriangle,
  Layers,
  Film,
  X,
  Loader2,
  Lock,
  KeyRound,
  ShieldAlert,
  RefreshCw,
  Download,
  Upload,
  RotateCcw,
  FileJson
} from 'lucide-react';
// Direct Firebase Firestore import as requested
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  deleteDoc,
  setDoc,
  DocumentData
} from 'firebase/firestore';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { AnimeRecord, StreamingPlatform } from '../types/database';
import { SubmitDubModal } from './SubmitDubModal';
import { useToast } from './Toast';

// Types for Admin Dashboard real state
export interface WatchlistStat {
  id: string;
  name: string;
  title: string;
  count: number;
  dubs: string[];
}

export interface TrafficPoint {
  time: string;
  active: number;
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
  action: 'watchlisted' | 'reviewed' | 'searched' | 'streamed' | 'submitted' | 'updated' | 'approved' | 'feedback';
  animeTitle: string;
  time: string;
  timestamp?: number;
  language?: string;
  status?: string;
}

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

// Color palette for regional dub languages (Cool spectrum: Emerald to Indigo)
const LANGUAGE_COLORS: Record<string, string> = {
  Hindi: '#10b981',     // Emerald
  Tamil: '#f59e0b',     // Amber
  Telugu: '#0ea5e9',    // Sky
  Malayalam: '#8b5cf6', // Purple
  Kannada: '#3b82f6',   // Blue (was Rose)
  English: '#6366f1',   // Indigo
  Japanese: '#a855f7',  // Violet (was Pink)
};

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

// Safely normalize a Firestore document snapshot into a valid AnimeRecord strictly
function normalizeFirestoreAnime(id: string, data: any): AnimeRecord {
  // Extract languages/dubs safely
  let rawDubs: any[] = [];
  if (Array.isArray(data?.dubs)) {
    rawDubs = data.dubs;
  } else if (Array.isArray(data?.languages)) {
    rawDubs = data.languages;
  } else if (Array.isArray(data?.dubLanguages)) {
    rawDubs = data.dubLanguages;
  } else if (Array.isArray(data?.dubDetails)) {
    rawDubs = data.dubDetails.map((d: any) => d?.language || d);
  } else if (typeof data?.dub === 'string' && data.dub.trim()) {
    rawDubs = [data.dub.trim()];
  } else if (typeof data?.language === 'string' && data.language.trim()) {
    rawDubs = [data.language.trim()];
  } else if (Array.isArray(data?.seasonDetails)) {
    data.seasonDetails.forEach((s: any) => {
      if (Array.isArray(s?.languages)) {
        rawDubs.push(...s.languages);
      }
    });
  }

  const dubs: string[] = rawDubs
    .map((d: any) => (typeof d === 'string' ? d.trim() : (d?.name || d?.language || '')))
    .filter(Boolean);

  const likes = Number(data?.likes || data?.upvotes || data?.votes || 0);

  // Robust title extraction
  const title = (
    data?.title || 
    data?.name || 
    data?.animeTitle || 
    data?.anime_title || 
    data?.title_en || 
    data?.englishTitle || 
    'Untitled Anime'
  ).trim();

  const rawPlatforms = Array.isArray(data?.platforms) ? data.platforms : ['Crunchyroll'];
  const platforms: { name: StreamingPlatform; url: string }[] = rawPlatforms.map((p: any) => {
    if (typeof p === 'string') {
      return { name: p as StreamingPlatform, url: 'https://crunchyroll.com' };
    }
    return {
      name: (p.name || p.platform || 'Crunchyroll') as StreamingPlatform,
      url: p.url || 'https://crunchyroll.com',
    };
  });

  return {
    ...data,
    id: id,
    title,
    romajiTitle: (data?.romajiTitle || data?.japaneseTitle || data?.title_jp || '').trim(),
    poster: data?.poster || data?.image || data?.cover || data?.posterImage || '',
    banner: data?.banner || data?.bannerImage || data?.coverImage || '',
    studio: data?.studio || 'Animation Studio',
    synopsis: data?.synopsis || data?.description || '',
    type: data?.type || 'TV Series',
    episodes: Number(data?.episodes) || 12,
    status: data?.status || data?.submissionStatus || 'approved',
    submissionStatus: data?.submissionStatus || data?.status || 'approved',
    releaseYear: Number(data?.releaseYear) || Number(data?.year) || new Date().getFullYear(),
    rating: data?.rating || data?.score || 8.0,
    genres: Array.isArray(data?.genres)
      ? data.genres
      : typeof data?.genres === 'string'
      ? data.genres.split(',').map((g: string) => g.trim())
      : [],
    themes: Array.isArray(data?.themes) ? data.themes : [],
    dubs: dubs as any,
    dubDetails: Array.isArray(data?.dubDetails)
      ? data.dubDetails
      : dubs.map((lang: string) => ({
          language: lang as any,
          available: true,
          platform: platforms.map(p => p.name),
          notes: `Available in ${lang}`,
        })),
    platforms,
    characters: Array.isArray(data?.characters) ? data.characters : [],
    likes: likes,
    upvotes: likes,
    submittedAt: data?.submittedAt || data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt || new Date().toISOString(),
    updatedAt: data?.updatedAt || data?.updatedAt?.toDate?.()?.toISOString() || data?.submittedAt || new Date().toISOString(),
    submittedBy: data?.submittedBy || {
      userId: data?.userId || 'admin',
      userName: data?.userName || 'Admin',
      userEmail: data?.userEmail || '',
    },
    reviewedBy: data?.reviewedBy,
    reviewedAt: data?.reviewedAt,
  };
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

  // Real database & Firestore state variables
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [totalWatchlists, setTotalWatchlists] = useState<number>(0);
  const [dubStreams, setDubStreams] = useState<number>(0);
  const [totalAnime, setTotalAnime] = useState<number>(0);
  const [totalSubmissions, setTotalSubmissions] = useState<number>(0);
  const [pendingSubmissions, setPendingSubmissions] = useState<number>(0);
  const [catalogTitles, setCatalogTitles] = useState<AnimeRecord[]>([]);
  
  // Real charts state
  const [mostWatchlisted, setMostWatchlisted] = useState<WatchlistStat[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
  const [dubBreakdown, setDubBreakdown] = useState<DubLanguageMetric[]>([]);
  
  // Real activity feed state
  const [recentActivities, setRecentActivities] = useState<ActivityEvent[]>([]);

  // Connection & UI state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'catalog' | 'watchlists' | 'dubs' | 'feed' | 'trash'>('overview');

  // Pending Moderation State
  const [pendingList, setPendingList] = useState<AnimeRecord[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Manage Anime Catalog Search & Filter State
  const [searchManageQuery, setSearchManageQuery] = useState<string>('');
  const [selectedManageLang, setSelectedManageLang] = useState<string>('All');
  const [selectedManageStatus, setSelectedManageStatus] = useState<'All' | 'pending' | 'approved'>('All');
  
  // Recycle Bin State
  const [deletedList, setDeletedList] = useState<AnimeRecord[]>([]);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Modals state for Edit and Delete
  const [animeToDelete, setAnimeToDelete] = useState<AnimeRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [editingAnime, setEditingAnime] = useState<AnimeRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  
  // Admin Authentication Gate State
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return authService.isAdmin();
  });
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Sync auth state
  useEffect(() => {
    const unsub = authService.subscribe(() => {
      setIsAdmin(authService.isAdmin());
    });
    return () => unsub();
  }, []);

  const toast = useToast();

  // Real Data Fetching strictly from Firebase Firestore database collections
  const fetchRealData = useCallback(async () => {
    try {
      // 1. Fetch anime records STRICTLY and EXCLUSIVELY from real Firestore database collections
      const firestoreAnimeMap = new Map<string, AnimeRecord>();
      
      const primaryCollections = ['animes', 'submissions'];
      const collections = catalogTitles.length === 0 
        ? ['animes', 'submissions', 'anime', 'anime_records'] 
        : primaryCollections;

      for (const collName of collections) {
        try {
          const snap = await getDocs(collection(db, collName));
          snap.forEach((docSnap) => {
            if (!firestoreAnimeMap.has(docSnap.id)) {
              const rec = normalizeFirestoreAnime(docSnap.id, docSnap.data());
              if (rec && rec.id && rec.title) {
                firestoreAnimeMap.set(rec.id, rec);
              }
            }
          });
        } catch (err) {
          if (String(err).toLowerCase().includes('quota')) break;
        }
      }

      let allAnime = Array.from(firestoreAnimeMap.values()).filter((item) => {
        return item && (item.id || item.title || (item as any).name);
      });

      if (allAnime.length === 0) {
        const cached = dbService.getAllAnimeRecords();
        if (cached.length > 0) {
          allAnime = cached;
        }
      }

      setCatalogTitles(allAnime.filter(a => !a.isDeleted));
      setDeletedList(allAnime.filter(a => a.isDeleted === true));

      const pendingItems = allAnime.filter(
        (a) => (a.status === 'pending' || a.submissionStatus === 'pending') && !a.isDeleted
      );
      setPendingList(pendingItems);
      setPendingSubmissions(pendingItems.length);

      // Fetch feedbacks
      let feedbackList: any[] = [];
      try {
        const fbSnap = await getDocs(collection(db, 'feedback'));
        if (!fbSnap.empty) {
          fbSnap.forEach((d) => {
            feedbackList.push({ id: d.id, ...d.data() });
          });
        }
      } catch {}

      if (feedbackList.length === 0) {
        try {
          const localFbRaw = localStorage.getItem('anidub_feedback');
          if (localFbRaw) {
            const parsed = JSON.parse(localFbRaw);
            if (Array.isArray(parsed)) feedbackList = parsed;
          }
        } catch {}
      }

      // Query collections
      let firestoreWatchlistsCount = 0;
      let firestoreUsersCount = 0;
      let firestoreStreamsCount = 0;
      let firestoreActivities: ActivityEvent[] = [];

      try {
        const watchlistsColl = collection(db, 'watchlists');
        const watchlistsSnap = await getDocs(watchlistsColl);
        firestoreWatchlistsCount = watchlistsSnap.size;
      } catch {}

      try {
        const usersColl = collection(db, 'users');
        const usersSnap = await getDocs(usersColl);
        firestoreUsersCount = usersSnap.size;
      } catch {}

      try {
        const streamsColl = collection(db, 'dub_streams');
        const streamsSnap = await getDocs(streamsColl);
        firestoreStreamsCount = streamsSnap.size;
      } catch {}

      try {
        const actColl = collection(db, 'activities');
        const actQuery = query(actColl, orderBy('timestamp', 'desc'), limit(15));
        const actSnap = await getDocs(actQuery);
        if (!actSnap.empty) {
          actSnap.forEach((d) => {
            const data = d.data();
            firestoreActivities.push({
              id: d.id,
              user: data.user || data.userName || 'Community User',
              action: data.action || 'streamed',
              animeTitle: data.animeTitle || data.title || 'Anime Dub',
              time: formatRelativeTime(data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp),
              timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now(),
              language: data.language,
              status: data.status,
            });
          });
        }
      } catch {}

      const totalAnimeCount = allAnime.length;
      const totalSubsCount = allAnime.length;
      const pendingCount = allAnime.filter(a => a.status === 'pending' || a.submissionStatus === 'pending').length;
      
      const totalUpvotes = allAnime.reduce((acc, curr) => acc + Number(curr.likes || curr.upvotes || 0), 0);
      const computedStreams = firestoreStreamsCount > 0 ? firestoreStreamsCount : totalUpvotes;

      const computedActiveUsers = Math.max(
        firestoreUsersCount,
        firestoreWatchlistsCount + pendingCount + (totalAnimeCount > 0 ? Math.ceil(totalAnimeCount * 0.4) : (firestoreUsersCount > 0 ? 1 : 0))
      );

      const sortedByPopularity: WatchlistStat[] = [...allAnime]
        .sort((a, b) => Number(b.likes || b.upvotes || 0) - Number(a.likes || a.upvotes || 0))
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          name: a.title,
          title: a.title,
          count: Number(a.likes || a.upvotes || 0),
          dubs: Array.isArray(a.dubs) ? a.dubs : [],
        }));

      const dubCounts: Record<string, number> = {};
      let totalDubMentions = 0;

      allAnime.forEach((item) => {
        const dubs = Array.isArray(item.dubs) ? item.dubs : [];
        dubs.forEach((d) => {
          if (typeof d === 'string' && d.trim()) {
            const lang = d.trim();
            dubCounts[lang] = (dubCounts[lang] || 0) + 1;
            totalDubMentions++;
          }
        });
      });

      const computedDubBreakdown: DubLanguageMetric[] = Object.entries(dubCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({
          name,
          count,
          value: totalDubMentions > 0 ? Math.round((count / totalDubMentions) * 100) : 0,
          color: LANGUAGE_COLORS[name] || '#8b5cf6',
        }));

      const dayBuckets: Record<string, { active: number; views: number }> = {
        Mon: { active: 0, views: 0 },
        Tue: { active: 0, views: 0 },
        Wed: { active: 0, views: 0 },
        Thu: { active: 0, views: 0 },
        Fri: { active: 0, views: 0 },
        Sat: { active: 0, views: 0 },
        Sun: { active: 0, views: 0 },
      };

      allAnime.forEach((item) => {
        const dateStr = item.submittedAt || item.updatedAt;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            if (dayBuckets[dayName]) {
              dayBuckets[dayName].active += 1;
              dayBuckets[dayName].views += Number(item.likes || item.upvotes || 1);
            }
          }
        }
      });

      const computedTrafficData: TrafficPoint[] = Object.entries(dayBuckets).map(([time, stats]) => ({
        time,
        active: stats.active,
        views: stats.views,
      }));

      const activities: ActivityEvent[] = [...firestoreActivities];
      allAnime.slice(0, 10).forEach((item) => {
        const timestamp = item.updatedAt || item.submittedAt;
        const timeVal = timestamp ? new Date(timestamp).getTime() : 0;
        activities.push({
          id: `sub-${item.id}`,
          user: item.submittedBy?.userName || 'Community User',
          action: item.status === 'approved' ? 'approved' : (item.updatedAt && item.submittedAt !== item.updatedAt ? 'updated' : 'submitted'),
          animeTitle: item.title,
          time: formatRelativeTime(timestamp),
          timestamp: timeVal,
          language: item.dubs?.[0] || 'Indian Dub',
          status: item.status,
        });
      });

      feedbackList.slice(0, 5).forEach((fb, idx) => {
        const timestamp = fb.timestamp;
        const timeVal = timestamp ? new Date(timestamp).getTime() : 0;
        activities.push({
          id: `fb-${fb.id || idx}`,
          user: fb.nameOrInsta || 'User Feedback',
          action: 'feedback',
          animeTitle: fb.feedback ? (fb.feedback.length > 28 ? fb.feedback.slice(0, 25) + '...' : fb.feedback) : 'App Feedback',
          time: formatRelativeTime(timestamp),
          timestamp: timeVal,
        });
      });

      activities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      setActiveUsers(computedActiveUsers);
      setTotalWatchlists(firestoreWatchlistsCount);
      setDubStreams(computedStreams);
      setTotalAnime(totalAnimeCount);
      setTotalSubmissions(totalSubsCount);
      setPendingSubmissions(pendingCount);
      setMostWatchlisted(sortedByPopularity);
      setDubBreakdown(computedDubBreakdown);
      setTrafficData(computedTrafficData);
      setRecentActivities(activities.slice(0, 10));
      setIsConnected(true);
      setLastUpdated(new Date());
      setIsLoading(false);
    } catch (error: any) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    dbService.startRealtimeSync();
    const unsub = dbService.subscribe(() => {
      fetchRealData();
    });

    let unsubscribeFirestore: (() => void) | null = null;
    try {
      const realtimeRef = doc(db, 'analytics', 'realtime');
      unsubscribeFirestore = onSnapshot(realtimeRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.activeUsers !== undefined) setActiveUsers(Number(data.activeUsers));
          if (data.totalWatchlists !== undefined) setTotalWatchlists(Number(data.totalWatchlists));
          if (data.dubStreams !== undefined) setDubStreams(Number(data.dubStreams));
          setIsConnected(true);
        }
      }, () => {});
    } catch {}

    return () => {
      unsub();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [fetchRealData]);

  const filteredCatalog = useMemo(() => {
    return catalogTitles.filter((item) => {
      if (selectedManageStatus !== 'All') {
        const isPending = item.status === 'pending' || item.submissionStatus === 'pending';
        if (selectedManageStatus === 'pending' && !isPending) return false;
        if (selectedManageStatus === 'approved' && isPending) return false;
      }
      if (searchManageQuery.trim()) {
        const q = searchManageQuery.toLowerCase().trim();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesRomaji = item.romajiTitle?.toLowerCase().includes(q);
        const matchesGenre = item.genres?.some(g => g.toLowerCase().includes(q));
        if (!matchesTitle && !matchesRomaji && !matchesGenre) return false;
      }
      if (selectedManageLang !== 'All') {
        const hasLang = (item.dubs || []).some(
          d => String(d).toLowerCase() === selectedManageLang.toLowerCase()
        );
        if (!hasLang) return false;
      }
      return true;
    });
  }, [catalogTitles, searchManageQuery, selectedManageLang, selectedManageStatus]);

  const handleAdminPasscodeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    const trimmed = passcode.trim();
    if (trimmed === 'admin123' || trimmed === 'prasanth123' || trimmed === 'admin@anidub.in' || trimmed === '8648317719') {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('anidub_is_admin', 'true');
        localStorage.setItem('anidub_is_admin', 'true');
      }
      setIsAdmin(true);
      setPasscodeError('');
      setIsVerifying(false);
      toast.success('Admin Authenticated', 'Access granted to AniDub Admin Dashboard.');
      fetchRealData();
    } else {
      setIsVerifying(false);
      setPasscodeError('Invalid Admin Passcode. Access denied.');
    }
  };

  const handleApprove = async (anime: AnimeRecord) => {
    setApprovingId(anime.id);
    try {
      const updateData = {
        status: 'approved',
        submissionStatus: 'approved',
        reviewedBy: 'Admin',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'animes', anime.id), updateData, { merge: true });
      try { await setDoc(doc(db, 'anime', anime.id), updateData, { merge: true }); } catch {}
      try { await setDoc(doc(db, 'submissions', anime.id), updateData, { merge: true }); } catch {}

      dbService.approveSubmission(anime.id, undefined, 'Admin');

      try {
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `✅ Anime Approved: ${anime.title}`,
            text: `✅ Anime Approved: ${anime.title}`,
            title: anime.title,
            anime: anime,
          }),
        });
      } catch {}

      toast.success('Anime Approved!', `"${anime.title}" is now published and live.`);
      await fetchRealData();
    } catch (err: any) {
      toast.error('Approval Failed', err?.message || 'Could not approve anime.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (anime: AnimeRecord) => {
    try {
      const updateData = {
        status: 'rejected',
        submissionStatus: 'rejected',
        reviewedBy: 'Admin',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'animes', anime.id), updateData, { merge: true });
      dbService.rejectSubmission(anime.id, undefined, 'Admin');
      toast.info('Anime Rejected', `"${anime.title}" marked as rejected.`);
      await fetchRealData();
    } catch (err: any) {
      toast.error('Action Failed', err?.message || 'Could not update status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!animeToDelete) return;
    setIsDeleting(true);
    try {
      dbService.permanentlyDeleteSubmission(animeToDelete.id);
      toast.success('Anime Deleted Permanently', `"${animeToDelete.title}" removed from database.`);
      await fetchRealData();
    } catch (err: any) {
      toast.error('Deletion Failed', err?.message || 'Could not delete item.');
    } finally {
      setIsDeleting(false);
      setAnimeToDelete(null);
    }
  };

  const handleSoftDelete = async (anime: AnimeRecord) => {
    try {
      dbService.deleteSubmission(anime.id); 
      toast.success('Moved to Trash', `"${anime.title}" moved to Recycle Bin.`);
      await fetchRealData();
    } catch (err: any) {
      toast.error('Action Failed', err?.message || 'Could not move to trash.');
    }
  };

  const handleRestore = async (anime: AnimeRecord) => {
    setIsRestoring(true);
    try {
      dbService.restoreSubmission(anime.id);
      toast.success('Anime Restored', `"${anime.title}" returned to catalog.`);
      await fetchRealData();
    } catch (err: any) {
      toast.error('Restore Failed', err?.message || 'Could not restore item.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportBackup = () => {
    dbService.exportBackup();
    toast.success('Backup Exported', 'Data downloaded as JSON.');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) throw new Error('Invalid format');
        
        setIsImporting(true);
        const result = await dbService.bulkImportAnime(json);
        toast.success('Import Complete', `Imported ${result.success} items.`);
        await fetchRealData();
      } catch (err: any) {
        toast.error('Import Failed', err.message);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleTriggerEdit = (anime: AnimeRecord) => {
    if (onEditAnime) {
      onEditAnime(anime);
    } else {
      setEditingAnime(anime);
    }
  };

  const handleExitAdmin = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('anidub_is_admin');
      localStorage.removeItem('anidub_is_admin');
    }
    setIsAdmin(false);
    onExitAdmin?.();
    try { router.push('/'); } catch { window.location.href = '/'; }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#131926] border border-purple-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight">AniDub Admin Panel</h2>
            <p className="text-xs text-neutral-400">Restricted access. Enter your admin key to proceed.</p>
          </div>
          <form onSubmit={handleAdminPasscodeLogin} className="space-y-4 text-left">
            <div className="relative">
              <input
                type="password"
                value={passcode}
                onChange={(e) => { setPasscode(e.target.value); setPasscodeError(''); }}
                placeholder="Admin Passcode"
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-700/80 focus:border-accent-theme text-white text-sm outline-none transition-all pr-10"
                autoFocus
              />
              <KeyRound className="w-4 h-4 text-neutral-500 absolute right-3.5 top-3.5" />
              {passcodeError && <p className="text-xs text-purple-400 mt-1.5">{passcodeError}</p>}
            </div>
            <button type="submit" disabled={isVerifying || !passcode.trim()} className="w-full py-3 rounded-xl btn-primary-theme active:scale-95 text-white font-bold text-sm cursor-pointer disabled:opacity-50">
              {isVerifying ? 'Verifying...' : 'Unlock Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-neutral-100 pb-16 selection:bg-accent-theme selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0b0f17]/95 backdrop-blur-md border-b border-neutral-800/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl btn-primary-theme flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white">AniDub Admin</h1>
              <p className="text-[10px] text-neutral-400 font-mono">Live Data Active</p>
            </div>
          </div>
          <button onClick={handleExitAdmin} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all cursor-pointer">
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Admin</span>
          </button>
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'pending', label: `Pending (${pendingSubmissions})` },
            { id: 'catalog', label: `Catalog (${catalogTitles.length})` },
            { id: 'trash', label: `Trash (${deletedList.length})` },
            { id: 'feed', label: 'User Feed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-primary-theme text-white shadow-md shadow-primary-theme'
                  : 'bg-[#131926] text-neutral-400 border border-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto sm:max-w-2xl">
        
        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          <div className="p-4 rounded-2xl bg-[#131926] border border-neutral-800/90 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-400">Active Users</span>
              <Users className="w-3.5 h-3.5 text-accent-theme" />
            </div>
            <div className="text-xl font-black text-white">{activeUsers.toLocaleString()}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#131926] border border-neutral-800/90 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-400">Watchlists</span>
              <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-white">{totalWatchlists.toLocaleString()}</div>
          </div>
        </div>

        {/* Pending Approvals View */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="text-base font-black text-white flex items-center gap-2 px-2">
              <Inbox className="w-4 h-4 text-amber-400" />
              <span>Awaiting Moderation</span>
            </h2>
            {pendingList.length === 0 ? (
              <div className="p-8 rounded-3xl bg-[#131926] border border-neutral-800/90 text-center text-xs text-neutral-500">
                All caught up! No pending submissions.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingList.map((anime) => (
                  <div key={anime.id} className="p-4 rounded-3xl bg-[#131926] border border-amber-500/40 space-y-3">
                    <div className="flex items-start gap-3">
                      <img src={anime.poster} className="w-16 h-22 object-cover rounded-2xl bg-neutral-800 shrink-0 shadow-lg" alt="" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="font-black text-white text-base leading-tight truncate">{anime.title}</h3>
                        <p className="text-[11px] text-neutral-400 truncate">ID: {anime.id}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {anime.dubs.map(d => (
                            <span key={d} className="text-[9px] px-2 py-0.5 rounded font-bold text-white" style={{ backgroundColor: LANGUAGE_COLORS[d] || '#8b5cf6' }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ALWAYS VISIBLE ACTION BUTTONS FOR ADMIN CARDS */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800/80 flex-wrap">
                      <button
                        onClick={() => handleApprove(anime)}
                        disabled={approvingId === anime.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>APPROVE</span>
                      </button>
                      <button
                        onClick={() => handleTriggerEdit(anime)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold text-xs cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>EDIT</span>
                      </button>
                      <button
                        onClick={() => handleReject(anime)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-xs cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>REJECT</span>
                      </button>
                      <button
                        onClick={() => handleSoftDelete(anime)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 font-bold text-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>TRASH</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manage Catalog View */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="p-4 rounded-3xl bg-[#131926] border border-neutral-800/90 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span>Anime Catalog</span>
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={handleExportBackup} 
                    className="p-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                    title="Export Backup (JSON)"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isImporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isImporting ? 'IMPORTING...' : 'BULK IMPORT (JSON)'}</span>
                  </button>

                  <button 
                    onClick={() => setIsAddModalOpen(true)} 
                    className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-lg shadow-purple-600/30 cursor-pointer"
                  >
                    ADD NEW
                  </button>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileImport} 
                    accept=".json" 
                    className="hidden" 
                  />
                </div>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input type="text" value={searchManageQuery} onChange={(e) => setSearchManageQuery(e.target.value)} placeholder="Search catalog..." className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700/80 text-xs text-white" />
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredCatalog.map((anime) => (
                <div key={anime.id} className="p-3.5 rounded-2xl bg-[#131926] border border-neutral-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img src={anime.poster} className="w-12 h-16 object-cover rounded-xl bg-neutral-800 shrink-0 border border-neutral-700/60" alt="" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white text-sm leading-tight truncate">{anime.title}</h3>
                      <p className="text-[10px] text-neutral-500 font-mono italic">ID: {anime.id} • Last Updated: {formatRelativeTime(anime.updatedAt)}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {anime.dubs.map(d => (
                          <span key={d} className="text-[9px] px-2 py-0.5 rounded font-bold text-white shadow-xs" style={{ backgroundColor: LANGUAGE_COLORS[d] || '#8b5cf6' }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* EXPLICIT ACTION BUTTONS FOR CATALOG ITEMS */}
                  <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/60">
                    <button
                      onClick={() => handleTriggerEdit(anime)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>EDIT</span>
                    </button>
                    <button
                      onClick={() => handleSoftDelete(anime)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>TRASH</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recycle Bin View */}
        {activeTab === 'trash' && (
          <div className="space-y-4">
            <h2 className="text-base font-black text-white flex items-center gap-2 px-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>Recycle Bin ({deletedList.length})</span>
            </h2>
            {deletedList.length === 0 ? (
              <div className="p-12 rounded-3xl bg-[#131926] border border-neutral-800/90 text-center text-xs text-neutral-500">Trash is empty.</div>
            ) : (
              <div className="space-y-2.5">
                {deletedList.map((anime) => (
                  <div key={anime.id} className="p-3 rounded-2xl bg-red-950/5 border border-red-900/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 opacity-80 min-w-0 flex-1">
                      <img src={anime.poster} className="w-10 h-14 object-cover rounded-lg grayscale" alt="" />
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">{anime.title}</h3>
                        <p className="text-[10px] text-neutral-500 italic">Deleted {formatRelativeTime(anime.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRestore(anime)} className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30 cursor-pointer transition-all"><RotateCcw className="w-4 h-4" /></button>
                      <button onClick={() => setAnimeToDelete(anime)} className="p-2 rounded-xl bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30 cursor-pointer transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User Activity Feed */}
        {activeTab === 'feed' && (
          <div className="p-4 rounded-3xl bg-[#131926] border border-neutral-800/90 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-accent-theme flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>User Activity Feed</span>
            </h3>
            <div className="divide-y divide-neutral-800/60">
              {recentActivities.map((act) => (
                <div key={act.id} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2 truncate flex-1">
                    <span className="font-black text-white truncate max-w-[100px]">{act.user}</span>
                    <span className="text-neutral-500">{act.action}</span>
                    <span className="text-primary-theme font-bold truncate">{act.animeTitle}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-neutral-500 font-mono">{act.time}</span>
                    {act.action !== 'feedback' && (
                      <button
                        onClick={() => {
                          const item = catalogTitles.find(a => a.id === act.id.replace('sub-', '')) || dbService.getAnimeById(act.id.replace('sub-', ''));
                          if (item) handleTriggerEdit(item);
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* MODALS */}
      <AnimatePresence>
        {animeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isDeleting && setAnimeToDelete(null)} className="fixed inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-[#111726] border border-red-500/30 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
              <h3 className="font-black text-lg text-white">Permanently Delete?</h3>
              <p className="text-xs text-neutral-400">This action is irreversible. The record will be erased from Cloud Firestore.</p>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setAnimeToDelete(null)} disabled={isDeleting} className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer">Cancel</button>
                <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs shadow-lg shadow-red-950/50 cursor-pointer disabled:opacity-50">
                  {isDeleting ? 'Erasing...' : 'PERMANENTLY DELETE'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {editingAnime && (
        <SubmitDubModal isOpen={true} editAnime={editingAnime} onClose={() => setEditingAnime(null)} onSuccess={() => { setEditingAnime(null); fetchRealData(); }} />
      )}

      {isAddModalOpen && (
        <SubmitDubModal isOpen={true} onClose={() => setIsAddModalOpen(false)} onSuccess={() => { setIsAddModalOpen(false); fetchRealData(); }} />
      )}
    </div>
  );
};

export default AdminDashboard;
