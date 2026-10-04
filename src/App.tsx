'use client';

import React, { useState, useMemo, useEffect, useRef, Suspense, lazy, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Navbar, NavTab } from './components/Navbar';
import { Hero } from './components/Hero';
import { AnimatedStats } from './components/AnimatedStats';
import { FilterBar } from './components/FilterBar';
import { AnimeCard } from './components/AnimeCard';
import { SkeletonGrid, SkeletonCard } from './components/SkeletonGrid';
import { AnimeGridWithInfiniteScroll } from './components/AnimeGridWithInfiniteScroll';
import { AnimeDetailPage } from './components/AnimeDetailPage';
import { RecommendationSystem } from './components/RecommendationSystem';
import { ProfileView } from './components/ProfileView';
import { ScheduleView } from './components/ScheduleView';
import { RecentUpdates } from './components/RecentUpdates';
import { WatchlistView } from './components/WatchlistView';
import { FeedbackSection } from './components/FeedbackSection';
import { SubmitDubModal } from './components/SubmitDubModal';
import { AuthModal } from './components/AuthModal';
import { ReportModal } from './components/ReportModal';
import { SurpriseRouletteModal } from './components/SurpriseRouletteModal';
import { LocalProfileModal, LocalUserProfile, ANIME_AVATAR_PRESETS } from './components/LocalProfileModal';
import { RecentlyViewedRow } from './components/RecentlyViewedRow';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminAnalyticsDashboard } from './components/AdminAnalyticsDashboard';
import { dbService } from './services/databaseService';
import { authService } from './services/authService';
import { AnimeRecord, WatchlistEntry } from './types/database';
import { Anime, WatchlistItem, DubLanguage } from './types/anime';
import { updateSeoTags } from './utils/seo';
import { computeForYouRecommendations, ForYouAnalysis } from './utils/recommendations';
import { getSavedUiLanguage, setSavedUiLanguage, translate, SupportedLanguage } from './utils/i18n';
import { ChevronDown, Frown, Sparkles, PlusCircle, ShieldCheck, X, WifiOff, Dices, Languages, Zap, Activity, RefreshCw, Database } from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';
import { useTheme } from './context/ThemeContext';
import { useReducedMotion, useIsMobile } from './hooks/useMediaQuery';

const INITIAL_VISIBLE_COUNT = 12;

function AppContent() {
  const toast = useToast();
  const { 
    userProfile: localProfile, 
    updateUserProfile: handleSaveLocalProfile 
  } = useTheme();

  const isReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const shouldReduceAnimation = isReducedMotion || isMobile;

  // 1. Theme State (Dark / Light Mode)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Bilingual UI State (English / Tamil)
  const [uiLanguage, setUiLanguage] = useState<SupportedLanguage>('en');

  const handleToggleLanguage = () => {
    const next = uiLanguage === 'en' ? 'ta' : 'en';
    setUiLanguage(next);
    setSavedUiLanguage(next);
    toast.success(
      next === 'ta' ? 'மொழி மாற்றப்பட்டது' : 'Language Changed',
      next === 'ta' ? 'இடைமுகம் இப்போது தமிழில் உள்ளது.' : 'Interface is now in English.'
    );
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('anidub_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    toast.info('Theme Changed', `Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} mode.`);
  };

  // 2. Offline Mode Support: detect connectivity changes
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back Online', 'Connected to live database.');
      dbService.syncWithServer();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.info('Offline Mode Active', 'Browsing cached catalog and your local watchlist.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 3. Reactive DB State: Home & Search feeds ONLY fetch approved anime
  const [approvedAnime, setApprovedAnime] = useState<AnimeRecord[]>(() => dbService.getApprovedAnime());
  const [allAnimeRecords, setAllAnimeRecords] = useState<AnimeRecord[]>(() => dbService.getAllAnimeRecords());
  
  // Auth state
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Local User Profile State (persisted in localStorage)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // 'Surprise Me' Roulette Modal State
  const [isSurpriseModalOpen, setIsSurpriseModalOpen] = useState(false);

  // Recently Viewed History (Keeps maximum 10 most recent anime IDs in localStorage)
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);

  // Local Watchlist (Zero login required, persists in browser localStorage)
  const [localWatchlistIds, setLocalWatchlistIds] = useState<string[]>([]);

  // Initial client hydration effect from localStorage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('anidub_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
      }

      setUiLanguage(getSavedUiLanguage());

      const savedRecent = localStorage.getItem('anidub_recently_viewed');
      if (savedRecent) {
        const parsedRecent = JSON.parse(savedRecent);
        if (Array.isArray(parsedRecent)) setRecentlyViewedIds(parsedRecent.slice(0, 10));
      }

      const savedWatchlist = localStorage.getItem('anidub_local_watchlist');
      if (savedWatchlist) {
        const parsedWatchlist = JSON.parse(savedWatchlist);
        if (Array.isArray(parsedWatchlist)) setLocalWatchlistIds(parsedWatchlist);
      }
    } catch (e) {
      console.warn('Storage sync warning:', e);
    }
  }, []);

  const trackRecentlyViewed = (animeId: string) => {
    if (!animeId) return;
    setRecentlyViewedIds((prev) => {
      const filtered = prev.filter((id) => id !== animeId);
      const updated = [animeId, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('anidub_recently_viewed', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearRecentlyViewed = () => {
    setRecentlyViewedIds([]);
    try {
      localStorage.removeItem('anidub_recently_viewed');
    } catch {}
    toast.info('History Cleared', 'Recently viewed history was cleared.');
  };

  // Report Modal state
  const [reportingAnime, setReportingAnime] = useState<{ id: string; title: string; poster?: string } | null>(null);

  // Filtered Watchlist (Only IDs that exist in the main database)
  // This ensures the badge count in the Navbar is always accurate even if items are deleted by admin
  const filteredWatchlistIds = useMemo(() => {
    return localWatchlistIds.filter(id => approvedAnime.some(anime => anime.id === id));
  }, [localWatchlistIds, approvedAnime]);

  // Ghost Data Cleanup Effect:
  // If an anime is deleted by an admin, we automatically prune it from the user's local storage
  useEffect(() => {
    if (approvedAnime.length > 0 && localWatchlistIds.length > 0) {
      const validIds = localWatchlistIds.filter(id => approvedAnime.some(anime => anime.id === id));
      if (validIds.length !== localWatchlistIds.length) {
        setLocalWatchlistIds(validIds);
        localStorage.setItem('anidub_local_watchlist', JSON.stringify(validIds));
      }
    }
  }, [approvedAnime]); // Only trigger when the master list changes

  // Watchlist entries from DB (for signed in user sync)
  const [dbWatchlist, setDbWatchlist] = useState<WatchlistEntry[]>(() => {
    return dbService.getUserWatchlist(authService.getCurrentUser()?.uid || 'guest');
  });

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('library');
  const [viewingAnimeId, setViewingAnimeId] = useState<string | null>(null);

  // Advanced Multi-Filtering & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedGenre, setSelectedGenre] = useState<string>('All Genres');
  const [selectedType, setSelectedType] = useState<string>('All Types');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Most Upvoted');
  const [feedView, setFeedView] = useState<'directory' | 'foryou'>('directory');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Secret Admin State (persisted in session)
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('anidub_is_admin') === 'true';
    }
    return false;
  });
  const [showSecretLogin, setShowSecretLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleSecretLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword.trim() === 'prasanth123') {
      setIsAdmin(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('anidub_is_admin', 'true');
      }
      setShowSecretLogin(false);
      setAdminPassword('');
      setAdminError('');
      toast.success('Stealth Admin Activated', 'Full moderation, analytics & approval controls unlocked.');
    } else {
      setAdminError('Invalid password. Please enter the correct passphrase.');
      setAdminPassword('');
    }
  };

  const handleExitAdmin = () => {
    setIsAdmin(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('anidub_is_admin');
    }
    toast.info('Exited Admin Mode', 'Switched back to standard public browsing.');
  };

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [animeToEdit, setAnimeToEdit] = useState<AnimeRecord | null>(null);

  const handleEditAnime = (anime: AnimeRecord) => {
    if (!isAdmin) {
      toast.error('Unauthorized', 'Admin privileges required to edit anime details.');
      return;
    }
    setAnimeToEdit(anime);
    setIsSubmitModalOpen(true);
  };

  const handleOpenSubmitModal = () => {
    setAnimeToEdit(null);
    setIsSubmitModalOpen(true);
  };

  // Initial server sync to load fresh approved anime immediately only if stale
  useEffect(() => {
    // Only force refresh if explicitly needed (e.g. first time or very old)
    // databaseService.constructor already handles conditional sync
    // We just need to make sure the state is updated if it DOES sync
    const checkAndSync = async () => {
      // If we have no data, we MUST sync
      const current = dbService.getApprovedAnime();
      if (current.length === 0) {
        setIsLoading(true);
        try {
          const freshList = await dbService.forceRefresh();
          setApprovedAnime(freshList);
        } finally {
          setIsLoading(false);
        }
      }
    };
    checkAndSync();
  }, []);

  // Subscribe to DB & Auth changes
  useEffect(() => {
    const unsubDb = dbService.subscribe(() => {
      setApprovedAnime(dbService.getApprovedAnime());
      setAllAnimeRecords(dbService.getAllAnimeRecords());
      if (currentUser) {
        setDbWatchlist(dbService.getUserWatchlist(currentUser.uid));
      }
    });

    const unsubAuth = authService.subscribe((user) => {
      setCurrentUser(user);
      if (user) {
        setDbWatchlist(dbService.getUserWatchlist(user.uid));
      }
    });

    return () => {
      unsubDb();
      unsubAuth();
    };
  }, [currentUser]);

  // Dynamic Routing & SEO Hash Sync
  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash.replace('#', '');
      
      if (hash.startsWith('anime/')) {
        const id = hash.replace('anime/', '');
        trackRecentlyViewed(id);
        setViewingAnimeId(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setViewingAnimeId(null);
      if (hash === 'watchlist') {
        setActiveTab('watchlist');
        updateSeoTags({
          title: 'My Watchlist & Favorites — AniDub India',
          description: 'View your saved dubbed anime titles, personal favorites, and streaming links.',
        });
      } else if (hash === 'recommendations') {
        setActiveTab('recommendations');
        updateSeoTags({
          title: 'Anime Recommendation Matchmaker — AniDub India',
          description: 'Find personalized anime titles dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada.',
        });
      } else if (hash === 'schedule') {
        setActiveTab('schedule');
        updateSeoTags({
          title: 'Airing Now & Simulcast Dub Schedule — AniDub India',
          description: 'Weekly schedule of new Indian dubbed episodes premiering on Crunchyroll, Netflix, and JioCinema.',
        });
      } else if (hash === 'profile') {
        setActiveTab('profile');
        updateSeoTags({
          title: 'My Profile & Watchlist — AniDub India',
          description: 'Manage your saved Indian dubbed anime, track watched episodes, and review dub quality.',
        });
      } else if (hash === 'admin/dashboard' || hash === 'analytics') {
        setActiveTab('analytics');
        updateSeoTags({
          title: 'Admin Analytics — AniDub India',
          description: 'Backend analytics and platform performance tracking.',
        });
      } else {
        setActiveTab('library');
        updateSeoTags({
          title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
          description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally.',
          keywords: ['Tamil dubbed anime', 'Telugu anime dubs', 'Hindi dubbed anime online', 'Kannada anime dubs'],
        });
      }
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Open anime detail
  const handleOpenAnimeDetail = useCallback((anime: Anime) => {
    trackRecentlyViewed(anime.id);
    setViewingAnimeId(anime.id);
    window.location.hash = `anime/${anime.id}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBackToLibrary = useCallback(() => {
    setViewingAnimeId(null);
    window.location.hash = activeTab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleTabChange = useCallback((tab: NavTab) => {
    setViewingAnimeId(null);
    setActiveTab(tab);
    if (tab === 'foryou') {
      setFeedView('foryou');
      setActiveTab('library'); // Use library view to render the feed
    } else if (tab === 'library') {
      setFeedView('directory');
    }
    window.location.hash = tab;
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRestoreSuccess = useCallback(() => {
    // Force refresh state from localStorage after a successful backup import
    window.location.reload();
  }, []);

  // Local Watchlist Toggle (No account required, saved in localStorage & PWA Background Sync)
  const handleToggleWatchlist = useCallback((anime: Anime) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    setLocalWatchlistIds((prev) => {
      let updated: string[];
      if (prev.includes(anime.id)) {
        updated = prev.filter((id) => id !== anime.id);
        toast.info('Removed from Watchlist', `"${anime.title}" was removed.`);
      } else {
        updated = [...prev, anime.id];
        if (isOffline) {
          toast.info(
            'Saved Offline - Will sync when connected',
            `"${anime.title}" was saved locally. It will automatically sync once your connection is restored.`
          );
        } else {
          toast.success('Saved to Watchlist!', `"${anime.title}" saved to your personal local favorites.`);
        }
      }
      localStorage.setItem('anidub_local_watchlist', JSON.stringify(updated));
      return updated;
    });

    const uid = currentUser?.uid || 'guest';
    dbService.toggleWatchlist(uid, anime.id);
  }, [currentUser]);

  // PWA Background Sync event listener
  useEffect(() => {
    const handleSyncComplete = (e: any) => {
      const count = e.detail?.count || 0;
      if (count > 0) {
        toast.success(
          'Synced with Cloud',
          `${count} offline watchlist ${count === 1 ? 'item was' : 'items were'} synced successfully.`
        );
      }
    };

    window.addEventListener('pwa-sync-completed', handleSyncComplete);
    return () => window.removeEventListener('pwa-sync-completed', handleSyncComplete);
  }, []);

  const handleClearWatchlist = () => {
    if (confirm('Clear all saved anime from your personal watchlist?')) {
      setLocalWatchlistIds([]);
      localStorage.setItem('anidub_local_watchlist', JSON.stringify([]));
      toast.info('Watchlist Cleared', 'All local favorites were removed.');
    }
  };

  const handleToggleWatchedStatus = useCallback((animeId: string) => {
    const userId = currentUser?.uid || 'guest';
    const newStatus = dbService.toggleWatchlistStatus(userId, animeId);
    if (newStatus === 'watched') {
      toast.success('Marked as Watched', 'Updated your episode progress.');
    } else {
      toast.info('Marked as Plan to Watch', 'Moved back to queue.');
    }
  }, [currentUser]);

  const handleRemoveFromWatchlist = useCallback((animeId: string) => {
    setLocalWatchlistIds((prev) => {
      const updated = prev.filter((id) => id !== animeId);
      localStorage.setItem('anidub_local_watchlist', JSON.stringify(updated));
      return updated;
    });
    if (currentUser) {
      dbService.removeFromWatchlist(currentUser.uid, animeId);
    }
    toast.info('Removed from Watchlist', 'Item removed from your list.');
  }, [currentUser]);

  // Language counts for filter pills
  const languageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const anime of approvedAnime) {
      for (const dub of anime.dubs || []) {
        counts[dub] = (counts[dub] || 0) + 1;
      }
    }
    return counts;
  }, [approvedAnime]);

  // Total Community Upvotes calculation
  const totalCommunityUpvotes = useMemo(() => {
    return approvedAnime.reduce((acc, a) => acc + Number(a.likes || a.upvotes || 0), 0);
  }, [approvedAnime]);

  // Trending anime: top 3 with highest community upvotes (if likes > 0)
  const trendingAnimeIds = useMemo(() => {
    const withLikes = approvedAnime.filter((a) => Number(a.likes || a.upvotes || 0) > 0);
    if (withLikes.length === 0) return [];
    const sorted = [...withLikes].sort((a, b) => Number(b.likes || b.upvotes || 0) - Number(a.likes || a.upvotes || 0));
    return sorted.slice(0, 3).map((a) => a.id);
  }, [approvedAnime]);

  // Convert DB watchlist to UI format
  const watchlistItemsForUI: WatchlistItem[] = useMemo(() => {
    return (dbWatchlist || []).map((entry) => ({
      animeId: entry.animeId,
      status: entry.status,
      addedAt: entry.addedAt,
      completedAt: entry.completedAt,
    }));
  }, [dbWatchlist]);

  const watchedAnimeIds = useMemo(
    () => (dbWatchlist || []).filter((w) => w.status === 'watched').map((w) => w.animeId),
    [dbWatchlist]
  );

  // Find currently viewed anime
  const currentViewingAnime = useMemo(() => {
    if (!viewingAnimeId) return null;
    return approvedAnime.find((a) => a.id === viewingAnimeId) || null;
  }, [viewingAnimeId, approvedAnime]);

  // ==========================================================================
  // 1. Advanced Multi-Filtering Engine: Search AND Language AND Genre AND Status
  // ==========================================================================
  const filteredApprovedAnime = useMemo(() => {
    return approvedAnime.filter((anime) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = anime.title.toLowerCase().includes(query);
        const matchesRomaji = anime.romajiTitle?.toLowerCase().includes(query);
        const matchesStudio = anime.studio.toLowerCase().includes(query);
        const matchesGenre = anime.genres.some((g) => g.toLowerCase().includes(query));
        const matchesTheme = anime.themes?.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesRomaji && !matchesStudio && !matchesGenre && !matchesTheme) {
          return false;
        }
      }

      // Language filter
      if (selectedLanguage !== 'All') {
        if (!anime.dubs.includes(selectedLanguage as DubLanguage)) {
          return false;
        }
      }

      // Genre filter
      if (selectedGenre !== 'All Genres') {
        if (!anime.genres.includes(selectedGenre)) {
          return false;
        }
      }

      // Type filter
      if (selectedType !== 'All Types') {
        if (anime.type !== selectedType) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus !== 'All') {
        const matchAiring = anime.status === selectedStatus || anime.airingStatus === selectedStatus;
        if (!matchAiring) {
          return false;
        }
      }

      return true;
    });
  }, [approvedAnime, searchQuery, selectedLanguage, selectedGenre, selectedType, selectedStatus]);

  // ==========================================================================
  // Sorting Engine: Most Upvoted, Newest, Oldest, Recently Added, Highest Rated, Title A-Z
  // ==========================================================================
  const sortedApprovedAnime = useMemo(() => {
    const list = [...filteredApprovedAnime];

    if (sortBy === 'Most Upvoted') {
      list.sort((a, b) => Number(b.likes || b.upvotes || 0) - Number(a.likes || a.upvotes || 0));
    } else if (sortBy === 'Newest') {
      list.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
    } else if (sortBy === 'Oldest') {
      list.sort((a, b) => (a.releaseYear || 0) - (b.releaseYear || 0));
    } else if (sortBy === 'Highest Rated') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'Title A-Z') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'Recently Added') {
      list.sort((a, b) => {
        const timeA = new Date(a.submittedAt || 0).getTime();
        const timeB = new Date(b.submittedAt || 0).getTime();
        return timeB - timeA;
      });
    }

    return list;
  }, [filteredApprovedAnime, sortBy]);

  // ==========================================================================
  // Smart 'For You' Recommendation Engine
  // ==========================================================================
  const forYouData = useMemo<ForYouAnalysis>(() => {
    return computeForYouRecommendations(
      approvedAnime,
      filteredWatchlistIds,
      recentlyViewedIds,
      localProfile
    );
  }, [approvedAnime, filteredWatchlistIds, recentlyViewedIds, localProfile]);

  // Combined sorting logic that respects the active feed view
  const activeSortedAnime = useMemo(() => {
    if (feedView === 'foryou') {
      // Recommendations are already sorted by affinity score in computeForYouRecommendations
      return forYouData.recommendedAnime;
    }
    return sortedApprovedAnime;
  }, [feedView, forYouData.recommendedAnime, sortedApprovedAnime]);

  // ==========================================================================
  // Infinite Scroll Pagination Engine (IntersectionObserver)
  // ==========================================================================
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Automatically load next batch as sentinel enters viewport
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setVisibleCount((prev) => {
            if (prev < activeSortedAnime.length) {
              return prev + 12;
            }
            return prev;
          });
        }
      },
      {
        rootMargin: '300px',
        threshold: 0.05,
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [activeSortedAnime.length]);

  const visibleAnime = useMemo(() => {
    return activeSortedAnime.slice(0, visibleCount);
  }, [activeSortedAnime, visibleCount]);

  const handleLanguageFilter = (lang: string) => {
    setSelectedLanguage(lang);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedLanguage('All');
    setSelectedGenre('All Genres');
    setSelectedType('All Types');
    setSelectedStatus('All');
    setSortBy('Most Upvoted');
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] dark:bg-[#0b0f17] text-neutral-100 flex flex-col font-sans selection:bg-primary-theme selection:text-white transition-colors duration-300">
      {/* Secret Password Modal */}
      {showSecretLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#121829] border border-primary-theme rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
               style={{ boxShadow: '0 20px 50px -10px var(--primary-glow)' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-heading font-black text-white flex items-center gap-2 text-base">
                <ShieldCheck className="w-5 h-5 text-accent-theme" />
                Stealth Admin Access
              </h3>
              <button 
                onClick={() => {
                  setShowSecretLogin(false);
                  setAdminError('');
                  setAdminPassword('');
                }} 
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Enter the security passphrase to unlock live moderation & approval controls.
            </p>

            <form onSubmit={handleSecretLogin} className="space-y-3.5">
              <div>
                <input 
                  autoFocus
                  type="password"
                  placeholder="Enter admin password..."
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (adminError) setAdminError('');
                  }}
                  className={`w-full bg-[#0a0d14] border ${adminError ? 'border-purple-500 ring-1 ring-purple-500' : 'border-neutral-700/80 focus:border-primary-theme focus:ring-1 focus:ring-primary-theme'} rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none transition-all`}
                />
                {adminError && (
                  <p className="text-xs text-purple-400 font-medium mt-1.5">{adminError}</p>
                )}
              </div>

              <button 
                type="submit"
                className="w-full py-3 btn-primary-theme active:scale-[0.98] text-white text-xs font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Unlock Live Dashboard</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      {activeTab !== 'analytics' && (
        <>
          <Navbar
            activeTab={activeTab === 'library' && feedView === 'foryou' ? 'foryou' : activeTab}
            setActiveTab={handleTabChange}
            watchlistCount={filteredWatchlistIds.length}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onOpenSuggestModal={handleOpenSubmitModal}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onSecretTrigger={() => !isAdmin && setShowSecretLogin(true)}
            localProfile={localProfile}
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
            uiLanguage={uiLanguage}
            onToggleLanguage={handleToggleLanguage}
            isAdmin={isAdmin}
          />
        </>
      )}

      {/* 2. Gentle Offline Mode & Quota Banners */}
      {isOffline && (
        <div className="sticky top-16 z-30 bg-gradient-to-r from-amber-950/95 via-amber-900/95 to-yellow-950/95 border-b border-amber-600/40 text-amber-200 px-4 py-2 text-xs shadow-lg backdrop-blur-md transition-all duration-300">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full justify-center text-center">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong>Offline Mode Active:</strong> You are browsing the cached anime catalog. Your saved Watchlist and details remain fully accessible!
            </span>
          </div>
        </div>
      )}

      {dbService.getIsQuotaLimited() && !isOffline && (
        <div className="sticky top-16 z-30 bg-gradient-to-r from-purple-950/95 via-purple-900/95 to-indigo-950/95 border-b border-purple-600/40 text-purple-200 px-4 py-2 text-xs shadow-lg backdrop-blur-md transition-all duration-300">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full justify-center text-center">
            <Zap className="w-4 h-4 text-purple-400 shrink-0 animate-pulse" />
            <span>
              <strong>Firestore Quota Reached:</strong> Live updates are paused for today. You are viewing cached data from your last successful sync.
            </span>
          </div>
        </div>
      )}

      <main className="flex-grow pt-4 sm:pt-6 pb-12 transition-all duration-500">
        {/* Stealth Admin Dashboard Integration */}
        {isAdmin && activeTab === 'library' && (
          <div className="mb-6">
             <AdminDashboard 
               onExitAdmin={handleExitAdmin} 
               onEditAnime={handleEditAnime}
             />
          </div>
        )}

        {/* 1. Dedicated Information Page (Route #anime/:id) */}
        <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8"><SkeletonGrid count={4} /></div>}>
          <AnimatePresence mode="wait">
            {currentViewingAnime ? (
              <AnimeDetailPage
                key={`anime-detail-${currentViewingAnime.id}`}
                anime={currentViewingAnime}
                watchlistItem={watchlistItemsForUI.find((w) => w.animeId === currentViewingAnime.id)}
                onToggleWatchlist={handleToggleWatchlist}
                onToggleWatchedStatus={handleToggleWatchedStatus}
                onBack={handleBackToLibrary}
                onSelectSimilarAnime={handleOpenAnimeDetail}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onReport={(anime) => setReportingAnime(anime)}
                allAnime={approvedAnime}
              />
            ) : (
              <motion.div
                key="catalog-view"
                initial={shouldReduceAnimation ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceAnimation ? { opacity: 1 } : { opacity: 0 }}
                transition={shouldReduceAnimation ? { duration: 0 } : { duration: 0.25 }}
              >
              {/* 2. Main Dub Library (ONLY FETCHES APPROVED ANIME) */}
              {activeTab === 'library' && (
                <>
                  <Hero 
                    totalCount={approvedAnime.length} 
                    onOpenSurpriseMe={() => setIsSurpriseModalOpen(true)}
                    uiLanguage={uiLanguage}
                  />

                  {/* 3. Animated Stats Counter Section */}
                  <AnimatedStats
                    totalAnime={approvedAnime.length}
                    totalUpvotes={totalCommunityUpvotes}
                    languagesCount={5}
                    uiLanguage={uiLanguage}
                  />

                  {/* 4. Recently Viewed Horizontal Row */}
                  <RecentlyViewedRow
                    recentlyViewedIds={recentlyViewedIds}
                    allAnime={approvedAnime}
                    onSelectAnime={handleOpenAnimeDetail}
                    onToggleWatchlist={handleToggleWatchlist}
                    watchlistIds={localWatchlistIds}
                    onClearHistory={handleClearRecentlyViewed}
                    uiLanguage={uiLanguage}
                  />

                  <FilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={(q) => {
                      setSearchQuery(q);
                      setVisibleCount(INITIAL_VISIBLE_COUNT);
                    }}
                    selectedLanguage={selectedLanguage}
                    setSelectedLanguage={handleLanguageFilter}
                    selectedGenre={selectedGenre}
                    setSelectedGenre={(g) => {
                      setSelectedGenre(g);
                      setVisibleCount(INITIAL_VISIBLE_COUNT);
                    }}
                    selectedType={selectedType}
                    setSelectedType={(t) => {
                      setSelectedType(t);
                      setVisibleCount(INITIAL_VISIBLE_COUNT);
                    }}
                    selectedStatus={selectedStatus}
                    setSelectedStatus={(s) => {
                      setSelectedStatus(s);
                      setVisibleCount(INITIAL_VISIBLE_COUNT);
                    }}
                    sortBy={sortBy}
                    setSortBy={(s) => {
                      setSortBy(s);
                      setVisibleCount(INITIAL_VISIBLE_COUNT);
                    }}
                    totalFiltered={activeSortedAnime.length}
                    totalAvailable={approvedAnime.length}
                    languageCounts={languageCounts}
                    isLoading={isLoading}
                    onReset={handleResetFilters}
                    uiLanguage={uiLanguage}
                    feedView={feedView}
                    setFeedView={(view) => {
                      setFeedView(view);
                      setVisibleCount(INITIAL_VISIBLE_COUNT);
                    }}
                    allAnime={approvedAnime}
                  />

                  {/* For You Logic Metadata (Subtle Info) */}
                  {feedView === 'foryou' && (
                    <div className="max-w-5xl mx-auto px-4 mb-6">
                      <div className="p-5 rounded-3xl bg-primary-theme/5 border border-primary-theme/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary-theme/10 flex items-center justify-center text-primary-theme">
                            <Activity className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-heading font-black text-white text-lg">
                              {translate('forYouTitle', uiLanguage)}
                            </h3>
                            <p className="text-xs text-neutral-400">
                              {translate('forYouSubtitle', uiLanguage)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="px-3 py-1.5 rounded-xl bg-[#131929] border border-neutral-800 text-[10px] font-bold text-neutral-400">
                            <span className="text-primary-theme mr-1">{translate('forYouLanguageMatch', uiLanguage)}:</span>
                            <span className="text-neutral-200">{forYouData.preferredLanguage}</span>
                          </div>
                          <div className="px-3 py-1.5 rounded-xl bg-[#131929] border border-neutral-800 text-[10px] font-bold text-neutral-400">
                            <span className="text-primary-theme mr-1">{translate('forYouTopGenres', uiLanguage)}:</span>
                            <span className="text-neutral-200">{forYouData.topGenres.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="max-w-6xl mx-auto px-4">
                    <Suspense fallback={<SkeletonGrid count={8} />}>
                      {isLoading ? (
                        <SkeletonGrid count={8} />
                      ) : approvedAnime.length > 0 ? (
                        <AnimeGridWithInfiniteScroll
                          animeList={activeSortedAnime}
                          visibleCount={visibleCount}
                          trendingAnimeIds={trendingAnimeIds}
                          localWatchlistIds={localWatchlistIds}
                          onToggleWatchlist={handleToggleWatchlist}
                          onOpenAnimeDetail={handleOpenAnimeDetail}
                          onReport={(anime) => setReportingAnime(anime)}
                          sentinelRef={sentinelRef}
                          uiLanguage={uiLanguage}
                          isLoading={isLoading}
                        />
                      ) : (
                        <div className="text-center py-16 bg-[#131926]/50 border border-neutral-800 rounded-3xl p-8 max-w-lg mx-auto shadow-xl">
                          <div className="w-14 h-14 rounded-2xl bg-primary-theme/10 border border-primary-theme/20 flex items-center justify-center mx-auto mb-4 text-primary-theme">
                            <Database className="w-7 h-7" />
                          </div>
                          <h3 className="font-heading font-black text-xl text-white mb-2">
                            {dbService.getIsQuotaLimited() 
                              ? 'Live Updates Paused' 
                              : 'Connecting to Live Database...'}
                          </h3>
                          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                            {dbService.getIsQuotaLimited() 
                              ? 'We have reached the daily Firestore quota limit. You are currently viewing cached data. Live updates will resume in 24 hours.' 
                              : "We're connecting to the live Firestore collections. If you have uploaded anime recently, they should appear here momentarily."}
                          </p>
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                              onClick={async () => {
                                setIsLoading(true);
                                try {
                                  const fresh = await dbService.forceRefresh();
                                  setApprovedAnime(fresh);
                                  toast.success('Sync Attempted', dbService.getIsQuotaLimited() ? 'Sync restricted by quota limit.' : `${fresh.length} anime records found.`);
                                } finally {
                                  setIsLoading(false);
                                }
                              }}
                              disabled={dbService.getIsQuotaLimited()}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-all border border-neutral-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                              <span>{dbService.getIsQuotaLimited() ? 'Quota Restricted' : 'Force Database Refresh'}</span>
                            </button>
                            <button
                              onClick={() => setIsSubmitModalOpen(true)}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 btn-primary-theme text-white text-xs font-black py-3 px-6 rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 group"
                            >
                              <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                              <span>Submit New Dub</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </Suspense>

                    {/* Filter fallback empty state */}
                    {approvedAnime.length > 0 && activeSortedAnime.length === 0 && (
                      <div className="text-center py-16 bg-[#131926]/50 border border-neutral-800 rounded-3xl p-8 max-w-lg mx-auto shadow-xl">
                        <Frown className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
                        <h3 className="font-heading font-black text-lg text-white mb-1">
                          No Approved Dubbed Anime Found
                        </h3>
                        <p className="text-xs text-neutral-400 mb-6 px-4 leading-relaxed">
                          No anime matches your filter criteria. Try choosing another regional language or resetting filters.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4">
                          <button
                            onClick={handleResetFilters}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-all cursor-pointer border border-neutral-700"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <RecentUpdates />
                </>
              )}

              {/* 3. My Watchlist Tab (Personal Local Favorites) */}
              {activeTab === 'watchlist' && (
                <WatchlistView
                  watchlistIds={filteredWatchlistIds}
                  allAnime={approvedAnime}
                  trendingAnimeIds={trendingAnimeIds}
                  onToggleWatchlist={handleToggleWatchlist}
                  onSelectAnime={handleOpenAnimeDetail}
                  onClearWatchlist={handleClearWatchlist}
                  onBrowseLibrary={() => handleTabChange('library')}
                  onReport={(anime) => setReportingAnime(anime)}
                />
              )}

              {/* 4. Recommendation Matchmaker */}
              {activeTab === 'recommendations' && (
                <RecommendationSystem
                  animeList={approvedAnime}
                  watchlistIds={localWatchlistIds}
                  watchedIds={watchedAnimeIds}
                  onToggleWatchlist={handleToggleWatchlist}
                  onSelectAnime={handleOpenAnimeDetail}
                />
              )}

              {/* 5. Airing & Simulcast Schedule */}
              {activeTab === 'schedule' && (
                <ScheduleView onSelectAnime={handleOpenAnimeDetail} />
              )}

              {/* 6. User Profile Tab */}
              {activeTab === 'profile' && (
                <ProfileView
                  allAnime={approvedAnime}
                  watchlistItems={watchlistItemsForUI}
                  onToggleWatchedStatus={handleToggleWatchedStatus}
                  onRemoveFromWatchlist={handleRemoveFromWatchlist}
                  onSelectAnime={handleOpenAnimeDetail}
                  onNavigateToTab={(tab) => handleTabChange(tab)}
                />
              )}

              {/* 7. Admin Analytics Dashboard */}
              {activeTab === 'analytics' && (
                <AdminAnalyticsDashboard 
                  allAnime={allAnimeRecords}
                  onBack={() => handleTabChange('library')}
                />
              )}
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </main>

      {/* Footer & Feedback */}
      <FeedbackSection 
        onOpenSuggestModal={handleOpenSubmitModal}
      />

      {/* Submit Dub Info Modal */}
      <SubmitDubModal
        isOpen={isSubmitModalOpen}
        editAnime={animeToEdit}
        onClose={() => {
          setIsSubmitModalOpen(false);
          setAnimeToEdit(null);
        }}
        onSuccess={() => {
          dbService.syncWithServer().then(() => {
            setApprovedAnime(dbService.getApprovedAnime());
          });
        }}
      />

      {/* Google Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={() => {
          if (currentUser) {
            setDbWatchlist(dbService.getUserWatchlist(currentUser.uid));
          }
        }}
      />

      {/* User Issue Report Modal with Telegram Alert */}
      <ReportModal
        isOpen={!!reportingAnime}
        anime={reportingAnime}
        onClose={() => setReportingAnime(null)}
      />

      {/* 'Surprise Me' Roulette Modal */}
      <SurpriseRouletteModal
        isOpen={isSurpriseModalOpen}
        onClose={() => setIsSurpriseModalOpen(false)}
        animeList={approvedAnime}
        onSelectAnime={handleOpenAnimeDetail}
        onToggleWatchlist={handleToggleWatchlist}
        watchlistIds={localWatchlistIds}
      />

      {/* Local User Profile Customization Modal */}
      <LocalProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentProfile={localProfile}
        onSaveProfile={handleSaveLocalProfile}
        uiLanguage={uiLanguage}
        onLanguageChange={(lang) => {
          setUiLanguage(lang);
        }}
        onRestoreSuccess={handleRestoreSuccess}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
