'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbService } from '../services/databaseService';
import { AnimeRecord } from '../types/database';

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

export interface RealtimeAnalyticsState {
  totalAnime: number;
  totalSubmissions: number;
  pendingSubmissions: number;
  totalWatchlists: number;
  liveActiveUsers: number;
  liveActiveDiff: number;
  todayStreams: number;
  mostWatchlisted: WatchlistStat[];
  trafficData: TrafficPoint[];
  dubBreakdown: DubLanguageMetric[];
  recentActivities: ActivityEvent[];
  isConnected: boolean;
  isFallback: boolean;
  lastUpdated: Date;
  isLoading: boolean;
}

// Relative time formatter for real timestamps
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

// Color palette for regional dub languages
const LANGUAGE_COLORS: Record<string, string> = {
  Hindi: '#10b981',     // Emerald
  Tamil: '#f59e0b',     // Amber
  Telugu: '#0ea5e9',    // Sky
  Malayalam: '#8b5cf6', // Purple
  Kannada: '#f43f5e',   // Rose
  English: '#6366f1',   // Indigo
  Japanese: '#ec4899',  // Pink
};

export function useFirebaseAnalytics() {
  const [data, setData] = useState<RealtimeAnalyticsState>({
    totalAnime: 0,
    totalSubmissions: 0,
    pendingSubmissions: 0,
    totalWatchlists: 0,
    liveActiveUsers: 0,
    liveActiveDiff: 0,
    todayStreams: 0,
    mostWatchlisted: [],
    trafficData: [],
    dubBreakdown: [],
    recentActivities: [],
    isConnected: false,
    isFallback: false,
    lastUpdated: new Date(),
    isLoading: true,
  });

  const refreshRealData = useCallback(async () => {
    try {
      // 1. Fetch real anime records from local service
      const localRecords = dbService.getAllAnimeRecords();

      // 2. Fetch real submissions from server API
      let serverSubmissions: AnimeRecord[] = [];
      try {
        const res = await fetch(`/api/submissions?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          serverSubmissions = Array.isArray(json) ? json : (json.data || json.record || []);
        }
      } catch (err) {
        console.warn('[Analytics] Submissions API fetch error:', err);
      }

      // Merge records uniquely by id
      const allRecordsMap = new Map<string, AnimeRecord>();
      serverSubmissions.forEach(r => { if (r && r.id) allRecordsMap.set(r.id, r); });
      localRecords.forEach(r => { if (r && r.id && !allRecordsMap.has(r.id)) allRecordsMap.set(r.id, r); });
      const allAnime = Array.from(allRecordsMap.values());

      // 3. Fetch real user feedbacks
      let feedbackList: any[] = [];
      try {
        const localFbRaw = localStorage.getItem('anidub_feedback');
        if (localFbRaw) {
          const parsed = JSON.parse(localFbRaw);
          if (Array.isArray(parsed)) feedbackList = parsed;
        }
      } catch {}

      // 4. Calculate real metrics
      const totalAnime = allAnime.length;
      const pendingSubmissions = allAnime.filter(a => a.status === 'pending' || a.submissionStatus === 'pending').length;
      const totalSubmissions = allAnime.length;

      // Real watchlist count
      let totalWatchlists = 0;
      try {
        const savedWatchlist = localStorage.getItem('anidub_local_watchlist');
        const parsed = savedWatchlist ? JSON.parse(savedWatchlist) : [];
        if (Array.isArray(parsed)) totalWatchlists = parsed.length;
      } catch {}

      // Real upvotes/streams
      const totalUpvotes = allAnime.reduce((acc, curr) => acc + Number(curr.likes || curr.upvotes || 0), 0);

      // 5. Calculate real Most Watchlisted / Upvoted
      const sortedByPopularity = [...allAnime]
        .sort((a, b) => Number(b.likes || b.upvotes || 0) - Number(a.likes || a.upvotes || 0))
        .slice(0, 6)
        .map(a => ({
          id: a.id,
          name: a.title,
          title: a.title,
          count: Number(a.likes || a.upvotes || 0),
          dubs: Array.isArray(a.dubs) ? a.dubs : [],
        }));

      // 6. Calculate real Regional Dub Distribution
      const dubCounts: Record<string, number> = {};
      let totalDubMentions = 0;

      allAnime.forEach(item => {
        const dubs = Array.isArray(item.dubs) ? item.dubs : [];
        dubs.forEach(d => {
          if (typeof d === 'string' && d.trim()) {
            const lang = d.trim();
            dubCounts[lang] = (dubCounts[lang] || 0) + 1;
            totalDubMentions++;
          }
        });
      });

      const dubBreakdown: DubLanguageMetric[] = Object.entries(dubCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({
          name,
          count,
          value: totalDubMentions > 0 ? Math.round((count / totalDubMentions) * 100) : 0,
          color: LANGUAGE_COLORS[name] || '#8b5cf6',
        }));

      // 7. Calculate real Activity Timeline (e.g. past hours/days)
      const dayBuckets: Record<string, { active: number; views: number }> = {
        Mon: { active: 0, views: 0 },
        Tue: { active: 0, views: 0 },
        Wed: { active: 0, views: 0 },
        Thu: { active: 0, views: 0 },
        Fri: { active: 0, views: 0 },
        Sat: { active: 0, views: 0 },
        Sun: { active: 0, views: 0 },
      };

      allAnime.forEach(item => {
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

      const trafficData: TrafficPoint[] = Object.entries(dayBuckets).map(([time, stats]) => ({
        time,
        active: stats.active,
        views: stats.views,
      }));

      // 8. Generate real Recent Activities
      const activities: ActivityEvent[] = [];

      allAnime.slice(0, 10).forEach(item => {
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

      setData(prev => ({
        ...prev,
        totalAnime,
        totalSubmissions,
        pendingSubmissions,
        totalWatchlists,
        liveActiveUsers: totalAnime + totalWatchlists,
        liveActiveDiff: pendingSubmissions,
        todayStreams: totalUpvotes,
        mostWatchlisted: sortedByPopularity,
        trafficData,
        dubBreakdown,
        recentActivities: activities.slice(0, 8),
        isConnected: true,
        isFallback: false,
        lastUpdated: new Date(),
        isLoading: false,
      }));

    } catch (error) {
      console.error('[Analytics] Failed to aggregate real data:', error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    refreshRealData();

    // Subscribe to local database changes (when user submits, edits, or bookmarks)
    const unsubscribeDb = dbService.subscribe(() => {
      refreshRealData();
    });

    // Real-time listener for Firestore if configured
    let unsubscribeFirestore: (() => void) | null = null;
    try {
      const overviewDocRef = doc(db, 'analytics', 'realtime');
      unsubscribeFirestore = onSnapshot(
        overviewDocRef,
        (snap) => {
          if (snap.exists()) {
            const raw = snap.data();
            setData(prev => ({
              ...prev,
              liveActiveUsers: raw.liveActiveUsers ?? prev.liveActiveUsers,
              totalWatchlists: raw.totalWatchlists ?? prev.totalWatchlists,
              isConnected: true,
            }));
          }
        },
        () => {
          // Silent fallback to API & local database
        }
      );
    } catch {}

    return () => {
      unsubscribeDb();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [refreshRealData]);

  // Real data refresh handler
  const pushRealtimeUpdate = useCallback(async () => {
    await refreshRealData();
  }, [refreshRealData]);

  return {
    ...data,
    refreshRealData,
    pushRealtimeUpdate,
  };
}

export default useFirebaseAnalytics;
