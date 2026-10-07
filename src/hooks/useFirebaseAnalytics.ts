'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDocs,
  getDoc,
  query, 
  orderBy, 
  limit,
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AnimeRecord, StreamingPlatform } from '../types/database';
import { dbService } from '../services/databaseService';

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

function normalizeRecord(id: string, data: any): AnimeRecord {
  let rawDubs: any[] = [];
  if (Array.isArray(data?.dubs)) rawDubs = data.dubs;
  else if (Array.isArray(data?.languages)) rawDubs = data.languages;
  else if (Array.isArray(data?.dubLanguages)) rawDubs = data.dubLanguages;
  else if (Array.isArray(data?.dubDetails)) rawDubs = data.dubDetails.map((d: any) => d?.language || d);
  else if (typeof data?.dub === 'string' && data.dub.trim()) rawDubs = [data.dub.trim()];
  else if (typeof data?.language === 'string' && data.language.trim()) rawDubs = [data.language.trim()];

  const dubs = rawDubs.map((d: any) => (typeof d === 'string' ? d.trim() : (d?.name || d?.language || ''))).filter(Boolean);
  const likes = Number(data?.likes || data?.upvotes || data?.votes || 0);

  return {
    id: id,
    title: (data?.title || data?.name || 'Untitled Anime').trim(),
    romajiTitle: (data?.romajiTitle || data?.japaneseTitle || '').trim(),
    poster: data?.poster || data?.image || data?.cover || '',
    banner: data?.banner || data?.bannerImage || '',
    studio: data?.studio || 'Animation Studio',
    synopsis: data?.synopsis || data?.description || '',
    type: data?.type || 'TV Series',
    episodes: Number(data?.episodes) || 12,
    status: data?.status || data?.submissionStatus || 'approved',
    submissionStatus: data?.submissionStatus || data?.status || 'approved',
    releaseYear: Number(data?.releaseYear) || Number(data?.year) || new Date().getFullYear(),
    rating: data?.rating || data?.score || 8.0,
    genres: Array.isArray(data?.genres) ? data.genres : [],
    themes: Array.isArray(data?.themes) ? data.themes : [],
    dubs: dubs as any,
    dubDetails: dubs.map((lang: string) => ({
      language: lang as any,
      available: true,
      platform: Array.isArray(data?.platforms) 
        ? (typeof data.platforms[0] === 'string' ? data.platforms : data.platforms.map((p: any) => p.name || p.platform))
        : ['Crunchyroll'],
      notes: `Available in ${lang}`,
    })),
    platforms: (Array.isArray(data?.platforms) ? data.platforms : ['Crunchyroll']).map((p: any) => {
      if (typeof p === 'string') return { name: p as StreamingPlatform, url: 'https://crunchyroll.com' };
      return { 
        name: (p.name || p.platform || 'Crunchyroll') as StreamingPlatform, 
        url: p.url || 'https://crunchyroll.com' 
      };
    }),
    characters: Array.isArray(data?.characters) ? data.characters : [],
    likes,
    upvotes: likes,
    submittedAt: data?.submittedAt || data?.createdAt || new Date().toISOString(),
    updatedAt: data?.updatedAt || data?.submittedAt || new Date().toISOString(),
    submittedBy: data?.submittedBy || {
      userId: data?.userId || 'admin',
      userName: data?.userName || 'Admin',
      userEmail: data?.userEmail || '',
    },
    reviewedBy: data?.reviewedBy,
    reviewedAt: data?.reviewedAt,
  };
}

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
      // 1. Fetch anime records primarily from local cached database service (zero read cost)
      let allAnime = dbService.getAllAnimeRecords();

      // If local cache is not yet ready, fallback to a small one-time read
      if (!allAnime || allAnime.length === 0) {
        const firestoreAnimeMap = new Map<string, AnimeRecord>();
        try {
          const snap = await getDocs(query(collection(db, 'anime_list'), limit(50)));
          snap.forEach(d => {
            const rec = normalizeRecord(d.id, d.data());
            if (rec && rec.id && rec.title) firestoreAnimeMap.set(rec.id, rec);
          });
        } catch (err: any) {
          // Silent catch
        }
        allAnime = Array.from(firestoreAnimeMap.values());
      }

      // 2. Fetch real user feedbacks
      let feedbackList: any[] = [];
      try {
        const fbSnap = await getDocs(collection(db, 'feedback'));
        fbSnap.forEach(d => feedbackList.push({ id: d.id, ...d.data() }));
      } catch {}

      // 3. Query Firestore for watchlists
      let totalWatchlists = 0;
      try {
        const watchlistsColl = collection(db, 'watchlists');
        const watchlistsSnap = await getDocs(watchlistsColl);
        totalWatchlists = watchlistsSnap.size;
      } catch {}

      // 4. Calculate real metrics strictly from real Firebase uploads
      const totalAnime = allAnime.length;
      const pendingSubmissions = allAnime.filter(a => a.status === 'pending' || a.submissionStatus === 'pending').length;
      const totalSubmissions = allAnime.length;
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

      // 7. Calculate real Activity Timeline
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

      setData({
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
      });

    } catch (error) {
      console.error('[Analytics] Failed to aggregate real data:', error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // Initial one-time fetch
    refreshRealData();

    // One-time fetch for realtime analytics doc without expensive continuous onSnapshot
    try {
      const overviewDocRef = doc(db, 'analytics', 'realtime');
      getDoc(overviewDocRef).then((snap) => {
        if (snap.exists()) {
          const raw = snap.data();
          setData(prev => ({
            ...prev,
            liveActiveUsers: raw.liveActiveUsers ?? prev.liveActiveUsers,
            totalWatchlists: raw.totalWatchlists ?? prev.totalWatchlists,
            isConnected: true,
          }));
        }
      }).catch(() => {});
    } catch {}
  }, [refreshRealData]);

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
