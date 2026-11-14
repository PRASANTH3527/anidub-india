import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { CatalogView } from './components/CatalogView';
import { Bookmark, ShieldCheck, Star, Heart, Tv, Database, Frown, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { cloudflareApi } from './services/cloudflareApi';
import { getCloudflareUrl, CLOUDFLARE_API_URL } from './config/cloudflare';
import { AniDubLogo } from './components/AniDubLogo';
import { useUser, useAuth, useClerk, SignIn, getClerkSessionToken } from './lib/clerk';
import { isAuthorizedClerkAdmin } from './utils/auth';
import {
  mergeGuestAndServerWatchlist,
  readWatchlistFromStorage,
  readWatchlistOwner,
  toggleWatchlistIdLocally,
  writeWatchlistToStorage,
} from './utils/watchlist';
import {
  buildAnimeSeoMeta,
  buildDefaultSeoMeta,
  buildLanguageSeoMeta,
  getLanguageSlug,
  parseLanguageFromPath,
  updateDocumentSeoMeta,
} from './utils/seoMeta';
import { normalizeLanguageName } from './utils/languages';

const ViewLoadingFallback = () => (
  <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-3">
    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
    <span className="text-xs text-neutral-400 font-medium tracking-wide">Loading view...</span>
  </div>
);

const ModalLoadingFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
    <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
  </div>
);

// Code-split heavy, below-the-fold, and non-critical views using React.lazy
const GodModeTracker = lazy(() => import('./components/GodModeTracker').then(m => ({ default: m.GodModeTracker })));
const FeedbackSection = lazy(() => import('./components/FeedbackSection').then(m => ({ default: m.FeedbackSection })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AnimeDetailModal = lazy(() => import('./components/AnimeDetailPage').then(m => ({ default: m.AnimeDetailModal })));
const RouletteModal = lazy(() => import('./components/RouletteModal').then(m => ({ default: m.RouletteModal })));
const CreateCollectionModal = lazy(() => import('./components/CreateCollectionModal').then(m => ({ default: m.CreateCollectionModal })));
const DubInfoModal = lazy(() => import('./components/DubInfoModal').then(m => ({ default: m.DubInfoModal })));
const WatchlistView = lazy(() => import('./components/WatchlistView').then(m => ({ default: m.WatchlistView })));
const WeeklyScheduleView = lazy(() => import('./components/WeeklyScheduleView').then(m => ({ default: m.WeeklyScheduleView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const AnimeTierListMaker = lazy(() => import('./components/AnimeTierListMaker').then(m => ({ default: m.AnimeTierListMaker })));
const RecommendationSystem = lazy(() => import('./components/RecommendationSystem').then(m => ({ default: m.RecommendationSystem })));
const CommunityChatView = lazy(() => import('./components/CommunityChatView').then(m => ({ default: m.CommunityChatView })));
const LanguageLandingView = lazy(() => import('./components/LanguageLandingView').then(m => ({ default: m.LanguageLandingView })));

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedSeoLanguage, setSelectedSeoLanguage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const parsed = parseLanguageFromPath(window.location.pathname);
    return parsed ? parsed.language : null;
  });
  const [feedView, setFeedView] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem('cf_anime_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('cf_anime_lang', currentLang);
  }, [currentLang]);
  
  // Watchlist state (hydrated from localStorage for guests, or D1 on Clerk sign-in)
  const [watchlist, setWatchlist] = useState<number[]>(() => readWatchlistFromStorage());
  const watchlistRef = useRef<number[]>(watchlist);
  watchlistRef.current = watchlist;
  const prevSignedInRef = useRef<boolean>(false);
  const hydratedUserRef = useRef<string | null>(null);

  // Recently viewed state (strictly real state - defaults to empty)
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('cf_anime_recently_viewed');
      if (saved) return JSON.parse(saved);
      return [];
    } catch {
      return [];
    }
  });

  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [catalogList, setCatalogList] = useState<any[]>([]);

  const activeAnimeSlug = useMemo(() => {
    if (selectedAnimeId === null || selectedAnimeId === undefined) return undefined;
    const found = catalogList.find(a => a.id === selectedAnimeId || String(a.id) === String(selectedAnimeId));
    return found?.slug || undefined;
  }, [selectedAnimeId, catalogList]);

  // Strict Clerk Admin Authentication State
  const { isSignedIn, user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const { signOut: clerkSignOut } = useClerk();
  const isClientClerkAdmin = Boolean(isSignedIn && clerkUser && isAuthorizedClerkAdmin(clerkUser));
  const [isServerClerkAdmin, setIsServerClerkAdmin] = useState<boolean>(false);
  const isClerkAdmin = isClientClerkAdmin || isServerClerkAdmin;

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(isClerkAdmin);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDubModalOpen, setIsDubModalOpen] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string>('');
  const [adminPasswordLoading, setAdminPasswordLoading] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);

  const handleNavigateTab = useCallback((nextTab: string) => {
    setActiveTab(nextTab);
    if (nextTab !== 'language') {
      setSelectedSeoLanguage(null);
      if (typeof window !== 'undefined') {
        const pathByTab: Record<string, string> = {
          home: '/',
          catalog: '/',
          watchlist: '/watchlist',
          schedule: '/schedule',
          chat: '/chat',
          tierlist: '/tierlist',
          recommendations: '/recommendations',
          profile: '/profile',
          admin: '/admin',
        };
        const targetPath = pathByTab[nextTab];
        if (targetPath && window.location.pathname !== targetPath) {
          window.history.pushState({ tab: nextTab }, '', targetPath);
        }
      }
    }
  }, []);

  const handleNavigateLanguage = useCallback((language: string) => {
    const normalized = normalizeLanguageName(language) || 'Hindi';
    const slug = getLanguageSlug(normalized);
    setSelectedAnimeId(null);
    setSelectedSeoLanguage(normalized);
    setActiveTab('language');
    if (typeof window !== 'undefined') {
      const targetPath = `/dubbed-anime/${slug}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ language: normalized }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Deep-link and history navigation handler
  const handleOpenAnime = useCallback((animeId: number | null) => {
    setSelectedAnimeId(animeId);
    if (typeof window !== 'undefined') {
      if (animeId !== null) {
        const found = catalogList.find(a => a.id === animeId || String(a.id) === String(animeId));
        const targetPath = found?.slug ? `/anime/${found.slug}` : `/anime/${animeId}`;
        if (window.location.pathname !== targetPath) {
          window.history.pushState({ animeId }, '', targetPath);
        }
      } else {
        if (window.location.pathname.startsWith('/anime/')) {
          const fallbackPath =
            activeTab === 'language' && selectedSeoLanguage
              ? `/dubbed-anime/${getLanguageSlug(selectedSeoLanguage)}`
              : '/';
          window.history.pushState(null, '', fallbackPath);
        }
      }
    }
  }, [catalogList, activeTab, selectedSeoLanguage]);

  // Handle URL deep-links on initial load and catalog ready
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname;
    const languageMatch = parseLanguageFromPath(pathname);
    if (languageMatch) {
      setSelectedSeoLanguage(languageMatch.language);
      setActiveTab('language');
      return;
    }

    if (pathname.startsWith('/anime/')) {
      const slugOrId = pathname.replace(/^\/anime\//, '').split('/')[0].split('?')[0];
      if (slugOrId) {
        if (catalogList.length > 0) {
          const matched = catalogList.find(a => a.slug === slugOrId || String(a.id) === slugOrId);
          if (matched && selectedAnimeId !== matched.id) {
            setSelectedAnimeId(matched.id);
          }
        }
      }
    } else if (pathname === '/admin' || pathname === '/admin/analytics') {
      if (isAdminAuthenticated) {
        setActiveTab('admin');
        setIsPasswordModalOpen(false);
      } else {
        setIsPasswordModalOpen(true);
      }
    } else if (pathname === '/watchlist') {
      setActiveTab('watchlist');
    } else if (pathname === '/schedule') {
      setActiveTab('schedule');
    } else if (pathname === '/chat') {
      setActiveTab('chat');
    } else if (pathname === '/tierlist') {
      setActiveTab('tierlist');
    } else if (pathname === '/recommendations') {
      setActiveTab('recommendations');
    } else if (pathname === '/profile') {
      setActiveTab('profile');
    }
  }, [catalogList, isAdminAuthenticated]);

  // Handle browser back and forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const languageMatch = parseLanguageFromPath(pathname);
      if (languageMatch) {
        setSelectedAnimeId(null);
        setSelectedSeoLanguage(languageMatch.language);
        setActiveTab('language');
        return;
      }

      if (pathname.startsWith('/anime/')) {
        const slugOrId = pathname.replace(/^\/anime\//, '').split('/')[0].split('?')[0];
        const matched = catalogList.find(a => a.slug === slugOrId || String(a.id) === slugOrId);
        if (matched) {
          setSelectedAnimeId(matched.id);
        }
      } else {
        setSelectedAnimeId(null);
        setSelectedSeoLanguage(null);
        if (pathname === '/admin' && isAdminAuthenticated) {
          setActiveTab('admin');
        } else if (pathname === '/watchlist') {
          setActiveTab('watchlist');
        } else if (pathname === '/schedule') {
          setActiveTab('schedule');
        } else if (pathname === '/chat') {
          setActiveTab('chat');
        } else if (pathname === '/tierlist') {
          setActiveTab('tierlist');
        } else if (pathname === '/recommendations') {
          setActiveTab('recommendations');
        } else if (pathname === '/profile') {
          setActiveTab('profile');
        } else if (pathname === '/') {
          setActiveTab('home');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [catalogList, isAdminAuthenticated]);

  // Keep document SEO <title>, <meta>, OpenGraph, and canonical URL synchronized on client transitions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;

    if (selectedAnimeId !== null) {
      const matched = catalogList.find(
        (a) => a.id === selectedAnimeId || String(a.id) === String(selectedAnimeId)
      );
      if (matched) {
        updateDocumentSeoMeta(buildAnimeSeoMeta(matched, origin, String(selectedAnimeId)));
        return;
      }
    }

    if (activeTab === 'language' && selectedSeoLanguage) {
      updateDocumentSeoMeta(buildLanguageSeoMeta(selectedSeoLanguage, origin));
      return;
    }

    updateDocumentSeoMeta(buildDefaultSeoMeta(origin));
  }, [activeTab, selectedSeoLanguage, selectedAnimeId, catalogList]);

  useEffect(() => {
    fetchCatalogList();
  }, []);

  const fetchCatalogList = async () => {
    setIsCatalogLoading(true);
    try {
      const response = await cloudflareApi.fetchCatalog({ page: 1, limit: 24 });
      
      const data = response?.data;
      if (data && Array.isArray(data) && data.length > 0) {
        const approvedOnly = data.filter((item: any) => 
          (item.submissionStatus === 'approved' || item.approval_status === 'approved' || item.is_published === 1)
        );
        setCatalogList(approvedOnly);
      } else {
        setCatalogList([]);
      }
    } catch (err: any) {
      console.warn('[Catalog API Notice]:', err?.message || err);
      setCatalogList([]);
    } finally {
      setIsCatalogLoading(false);
    }
  };

  // Hydrate watchlist from server/D1 on Clerk login and sync any local guest items
  useEffect(() => {
    if (!isSignedIn || !clerkUser?.id) {
      if (prevSignedInRef.current) {
        prevSignedInRef.current = false;
        hydratedUserRef.current = null;
        const cleared = writeWatchlistToStorage([], 'guest');
        watchlistRef.current = cleared;
        setWatchlist(cleared);
      } else {
        const owner = readWatchlistOwner();
        if (owner === 'guest') {
          const guestIds = readWatchlistFromStorage();
          watchlistRef.current = guestIds;
          setWatchlist(guestIds);
        }
      }
      return;
    }

    prevSignedInRef.current = true;
    if (hydratedUserRef.current === clerkUser.id) return;

    let cancelled = false;
    (async () => {
      try {
        const token = (await getToken()) || (await getClerkSessionToken());
        if (!token || cancelled) return;

        const serverRes = await cloudflareApi.fetchWatchlistDetailed(token);
        if (cancelled || !serverRes.ok) return;

        const localOwner = readWatchlistOwner();
        const guestIds = localOwner === 'guest' ? readWatchlistFromStorage() : [];
        const { mergedIds, toSyncIds } = mergeGuestAndServerWatchlist(serverRes.ids, guestIds);

        if (toSyncIds.length > 0) {
          for (const idToSync of toSyncIds) {
            if (cancelled) return;
            await cloudflareApi.addToWatchlist(idToSync, token);
          }
        }

        if (cancelled) return;
        hydratedUserRef.current = clerkUser.id;
        const persisted = writeWatchlistToStorage(mergedIds, clerkUser.id);
        watchlistRef.current = persisted;
        setWatchlist(persisted);
      } catch (err) {
        console.warn('Watchlist hydration skipped:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, clerkUser?.id, getToken]);

  const addToRecentlyViewed = useCallback((anime: any) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(item => item.id !== anime.id);
      const updated = [anime, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('cf_anime_recently_viewed', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const handleClearRecentlyViewed = useCallback(() => {
    setRecentlyViewed([]);
    try {
      localStorage.removeItem('cf_anime_recently_viewed');
    } catch {}
  }, []);

  const handleRemoveRecentlyViewedItem = useCallback((animeId: number) => {
    setRecentlyViewed(prev => {
      const updated = prev.filter(item => item.id !== animeId);
      try {
        localStorage.setItem('cf_anime_recently_viewed', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const handleToggleWatchlist = useCallback(async (animeId: number) => {
    const idNum = Number(animeId);
    if (!Number.isInteger(idNum) || idNum <= 0) return;

    const previousIds = watchlistRef.current;
    const isCurrentlySaved = previousIds.map(Number).includes(idNum);
    const { ids: nextIds } = toggleWatchlistIdLocally(previousIds, idNum);
    const ownerTag = isSignedIn && clerkUser?.id ? clerkUser.id : 'guest';

    watchlistRef.current = nextIds;
    setWatchlist(nextIds);
    writeWatchlistToStorage(nextIds, ownerTag);

    if (!isSignedIn) {
      return;
    }

    try {
      const token = (await getToken()) || (await getClerkSessionToken());
      if (!token) {
        writeWatchlistToStorage(nextIds, 'guest');
        return;
      }

      const result = isCurrentlySaved
        ? await cloudflareApi.removeFromWatchlist(idNum, token)
        : await cloudflareApi.addToWatchlist(idNum, token);

      if (!result.success) {
        const refreshed = await cloudflareApi.fetchWatchlistDetailed(token);
        if (refreshed.ok) {
          const synced = writeWatchlistToStorage(refreshed.ids, clerkUser?.id || 'guest');
          watchlistRef.current = synced;
          setWatchlist(synced);
        } else {
          // Retain local guest cache if network/server is temporarily unreachable
          writeWatchlistToStorage(nextIds, 'guest');
        }
      }
    } catch (err) {
      console.error('Failed to sync watchlist toggle:', err);
      writeWatchlistToStorage(nextIds, 'guest');
    }
  }, [isSignedIn, clerkUser?.id, getToken]);

  useEffect(() => {
    if (!isSignedIn) {
      setIsServerClerkAdmin(false);
      setIsAdminAuthenticated(false);
      if (activeTab === 'admin') {
        setActiveTab('home');
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = (await getToken()) || (await getClerkSessionToken());
        const res = await fetch(getCloudflareUrl('/api/admin/verify'), {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.status === 200) {
          if (cancelled) return;
          setIsServerClerkAdmin(true);
          setIsAdminAuthenticated(true);
          setIsPasswordModalOpen(false);
          setAdminAuthError('');
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
            setActiveTab('admin');
          }
          return;
        }

        const data: any = await res.json().catch(() => ({}));
        if (cancelled) return;
        const backendError = data.error || data.message || `HTTP ${res.status}`;
        setIsServerClerkAdmin(false);
        setIsAdminAuthenticated(false);
        setAdminAuthError(`Backend Error: ${backendError}`);
        if (activeTab === 'admin') setActiveTab('home');
      } catch (err: any) {
        if (!cancelled) {
          setAdminAuthError(`Backend Error: ${err?.message || 'Unable to verify Clerk Admin session.'}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isClientClerkAdmin, activeTab, getToken]);

  const handleVerifyClerkAdminUnlock = async () => {
    if (!isSignedIn) {
      setAdminAuthError('Backend Error: Only the authorized Clerk Administrator can unlock /admin.');
      return;
    }
    setAdminPasswordLoading(true);
    setAdminAuthError('');
    try {
      const token = (await getToken()) || (await getClerkSessionToken());
      const res = await fetch(getCloudflareUrl('/api/admin/verify'), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 200) {
        setIsServerClerkAdmin(true);
        setIsAdminAuthenticated(true);
        setActiveTab('admin');
        setIsPasswordModalOpen(false);
        setAdminAuthError('');
        return;
      }

      const data: any = await res.json().catch(() => ({}));
      const backendError = data.error || data.message || `HTTP ${res.status}`;
      setAdminAuthError(`Backend Error: ${backendError}`);
    } catch (err: any) {
      setAdminAuthError(`Backend Error: ${err?.message || 'Unable to verify Clerk Admin session.'}`);
    } finally {
      setAdminPasswordLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await cloudflareApi.logoutAdmin();
    } catch {}

    setIsAdminAuthenticated(false);
    setActiveTab('home');
  };

  // Verified real saved watchlist strictly matching actual catalog records
  const realSavedWatchlist = React.useMemo(() => {
    return catalogList.filter(anime => 
      watchlist.some(wId => String(wId) === String(anime.id))
    );
  }, [catalogList, watchlist]);

  // Verified real recently viewed strictly matching actual catalog records
  const realRecentlyViewed = React.useMemo(() => {
    return recentlyViewed.filter(rv => 
      catalogList.some(a => String(a.id) === String(rv.id))
    );
  }, [catalogList, recentlyViewed]);

  // AUTO-CLEANUP: If items disappear from catalog, remove them from source watchlist/recently-viewed states
  useEffect(() => {
    if (isCatalogLoading || catalogList.length === 0) return;

    // 1. Cleanup Watchlist
    const validWatchlist = watchlist.filter(wId => 
      catalogList.some(a => String(a.id) === String(wId))
    );
    if (validWatchlist.length !== watchlist.length) {
      watchlistRef.current = validWatchlist;
      setWatchlist(validWatchlist);
      writeWatchlistToStorage(validWatchlist, isSignedIn && clerkUser?.id ? clerkUser.id : 'guest');
    }

    // 2. Cleanup Recently Viewed
    const validRecentlyViewed = recentlyViewed.filter(rv => 
      catalogList.some(a => String(a.id) === String(rv.id))
    );
    if (validRecentlyViewed.length !== recentlyViewed.length) {
      setRecentlyViewed(validRecentlyViewed);
    }
  }, [catalogList, isCatalogLoading]);

  const handleToggleLike = useCallback((animeId: number, _liked?: boolean, count?: number) => {
    setCatalogList(prev => prev.map(a => {
      if (a.id === animeId || String(a.id) === String(animeId)) {
        return { ...a, likesCount: count ?? a.likesCount };
      }
      return a;
    }));
  }, []);

  const handleToggleUpvote = useCallback((animeId: number, _upvoted?: boolean, count?: number) => {
    setCatalogList(prev => prev.map(a => {
      if (a.id === animeId || String(a.id) === String(animeId)) {
        return { ...a, popularity: count ?? a.popularity };
      }
      return a;
    }));
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#0b0f17] dark:bg-[#0b0f17] text-neutral-100 flex flex-col font-sans selection:bg-primary-theme selection:text-white transition-colors duration-300 box-border">
      
      {/* GOD-MODE FIRST-PARTY EDGE ANALYTICS & TELEMETRY TRACKER */}
      <Suspense fallback={null}>
        <GodModeTracker activeTab={activeTab} activeAnimeSlug={activeAnimeSlug} />
      </Suspense>

      {/* 1. NAVBAR */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        watchlistCount={realSavedWatchlist.length}
        onUnlockAdmin={() => {
          if (!isAdminAuthenticated || !isClerkAdmin) {
            setIsPasswordModalOpen(true);
            setAdminAuthError('');
          } else {
            if (activeTab !== 'admin') {
              handleNavigateTab('admin');
            } else {
              handleNavigateTab('home');
            }
          }
        }}
        onOpenCollection={() => setIsCollectionOpen(true)}
        onSelectAnime={(id) => handleOpenAnime(id)}
        feedView={feedView}
        setFeedView={setFeedView}
        isAdminAuthenticated={isAdminAuthenticated && isClerkAdmin}
        onLogout={handleAdminLogout}
        currentLang={currentLang}
        setCurrentLang={setCurrentLang}
      />

      {/* 2. ADMIN DASHBOARD (Protected strictly by Clerk Admin Auth) */}
      {activeTab === 'admin' && isAdminAuthenticated && isClerkAdmin && (
        <Suspense fallback={<ViewLoadingFallback />}>
          <AdminDashboard
            catalogList={catalogList}
            onAnimeCreated={(updatedAnime?: any, deletedId?: string | number) => {
              if (deletedId !== undefined && deletedId !== null) {
                setCatalogList(prev => prev.filter(a => String(a.id) !== String(deletedId)));
                setRecentlyViewed(prev => prev.filter(a => String(a.id) !== String(deletedId)));
                return;
              }
              if (updatedAnime) {
                const targetId = updatedAnime.id;
                const newCover = updatedAnime.posterUrl || updatedAnime.image || updatedAnime.cover_image || updatedAnime.poster;
                const normalizedItem = {
                  ...updatedAnime,
                  image: newCover,
                  cover_image: newCover,
                  poster: newCover,
                  status: updatedAnime.status || updatedAnime.airing_status || (updatedAnime.type === 'Movie' ? 'Completed' : 'Airing'),
                  airing_status: updatedAnime.airing_status || updatedAnime.status || (updatedAnime.type === 'Movie' ? 'Completed' : 'Airing')
                };

                setCatalogList(prev => {
                  const exists = prev.some(a => a.id === targetId || String(a.id) === String(targetId));
                  if (exists) {
                    return prev.map(a => (a.id === targetId || String(a.id) === String(targetId)) ? { ...a, ...normalizedItem } : a);
                  } else {
                    return [normalizedItem, ...prev];
                  }
                });

                setRecentlyViewed(prev => {
                  const exists = prev.some(a => a.id === targetId || String(a.id) === String(targetId));
                  if (exists) {
                    return prev.map(a => (a.id === targetId || String(a.id) === String(targetId)) ? { ...a, ...normalizedItem } : a);
                  } else {
                    return [normalizedItem, ...prev];
                  }
                });
              } else {
                // Fallback refetch if no payload
                fetchCatalogList();
              }
            }}
            onLogout={handleAdminLogout}
            onNavigateHome={() => setActiveTab('home')}
          />
        </Suspense>
      )}

      {/* 3. MAIN CONTENT VIEWS WITH SMOOTH PAGE TRANSITIONS */}
      <main className="flex-grow w-full max-w-full overflow-x-hidden pt-4 sm:pt-6 pb-12 sm:pb-16 transition-all duration-500 box-border">
        <AnimatePresence mode="wait">
          <motion.div
            key={`page_view_${activeTab}_${activeTab === 'home' ? feedView : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {/* FOR YOU HEADER METADATA BLOCK (WHEN FORYOU FEED ACTIVE) */}
            {feedView === 'foryou' && (activeTab === 'home' || activeTab === 'catalog') && (
              <div className="w-full max-w-5xl mx-auto px-4 mb-6">
                <div className="p-5 rounded-3xl bg-primary-theme/5 border border-primary-theme/10 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-white">Recommended For You</h2>
                    <p className="text-xs text-neutral-400">Curated specifically based on your watch history and dub preferences.</p>
                  </div>
                </div>
              </div>
            )}

            {/* MAIN CATALOG & FEED VIEW */}
            {(activeTab === 'home' || activeTab === 'catalog') && feedView !== 'foryou' && (
              <CatalogView
                catalogList={catalogList}
                onSelectAnime={(anime) => {
                  handleOpenAnime(anime.id);
                  addToRecentlyViewed(anime);
                }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                onToggleLike={handleToggleLike}
                onToggleUpvote={handleToggleUpvote}
                onOpenRoulette={() => setIsRouletteOpen(true)}
                onOpenCollection={() => setIsCollectionOpen(true)}
                feedView={feedView}
                recentlyViewed={realRecentlyViewed}
                onClearRecentlyViewed={handleClearRecentlyViewed}
                onRemoveRecentlyViewedItem={handleRemoveRecentlyViewedItem}
                uiLanguage={currentLang as any}
              />
            )}

            {/* INTERACTIVE RECOMMENDATION SYSTEM (FOR YOU / MATCHMAKER) */}
            {(activeTab === 'recommendations' || ((activeTab === 'home' || activeTab === 'catalog') && feedView === 'foryou')) && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <RecommendationSystem
                  catalogList={catalogList}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime.id);
                    addToRecentlyViewed(anime);
                  }}
                  watchlist={watchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  onNavigateCatalog={() => {
                    setActiveTab('home');
                    setFeedView('library');
                  }}
                />
              </Suspense>
            )}

            {/* WATCHLIST VIEW */}
            {activeTab === 'watchlist' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <WatchlistView
                  watchlist={realSavedWatchlist}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime.id);
                    addToRecentlyViewed(anime);
                  }}
                  onToggleWatchlist={handleToggleWatchlist}
                  onNavigateToCatalog={() => setActiveTab('home')}
                  isSignedIn={Boolean(isSignedIn)}
                />
              </Suspense>
            )}

            {/* WEEKLY SIMULCAST SCHEDULE VIEW */}
            {activeTab === 'schedule' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <WeeklyScheduleView
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime.id);
                    addToRecentlyViewed(anime);
                  }}
                  watchlist={watchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  onOpenSubmitDubModal={() => setIsDubModalOpen(true)}
                  catalogList={catalogList}
                />
              </Suspense>
            )}

            {/* PROFILE VIEW */}
            {activeTab === 'profile' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <ProfileView
                  watchlist={watchlist}
                  catalogList={catalogList}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime.id);
                    addToRecentlyViewed(anime);
                  }}
                  onToggleWatchlist={handleToggleWatchlist}
                  onOpenCreateCollection={() => setIsCollectionOpen(true)}
                  onNavigateToCatalog={() => setActiveTab('home')}
                />
              </Suspense>
            )}

            {/* TIER LIST MAKER VIEW */}
            {activeTab === 'tierlist' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <AnimeTierListMaker
                  catalogList={catalogList}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime.id);
                    addToRecentlyViewed(anime);
                  }}
                  onNavigateHome={() => setActiveTab('home')}
                />
              </Suspense>
            )}

            {/* REGIONAL LANGUAGE SEO LANDING VIEW (/dubbed-anime/:language) */}
            {activeTab === 'language' && selectedSeoLanguage && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <LanguageLandingView
                  language={selectedSeoLanguage}
                  catalogList={catalogList}
                  watchlist={watchlist}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime.id);
                    addToRecentlyViewed(anime);
                  }}
                  onToggleWatchlist={handleToggleWatchlist}
                  onToggleLike={handleToggleLike}
                  onToggleUpvote={handleToggleUpvote}
                  onNavigateLanguage={handleNavigateLanguage}
                  onNavigateHome={() => handleNavigateTab('home')}
                />
              </Suspense>
            )}

            {/* LIVE COMMUNITY CHAT VIEW */}
            {activeTab === 'chat' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <CommunityChatView
                  onNavigateToCatalog={() => handleNavigateTab('home')}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime.id);
                    addToRecentlyViewed(anime);
                  }}
                />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FEEDBACK SECTION / FOOTER */}
      <Suspense fallback={null}>
        <FeedbackSection
          onSubmitDub={() => setIsDubModalOpen(true)}
          onNavigateLanguage={handleNavigateLanguage}
        />
      </Suspense>


      {/* MODALS WITH SPRING ANIMATEPRESENCE */}
      <AnimatePresence>
        {/* 1. Anime Detail Modal */}
        {selectedAnimeId !== null && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <AnimeDetailModal
              key="anime-detail-modal"
              animeId={selectedAnimeId}
              onClose={() => handleOpenAnime(null)}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </Suspense>
        )}

        {/* 2. Surprise Me Roulette Modal */}
        {isRouletteOpen && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <RouletteModal
              key="roulette-modal"
              animeList={catalogList}
              onClose={() => setIsRouletteOpen(false)}
              onSelectAnime={(anime) => {
                handleOpenAnime(anime.id);
                addToRecentlyViewed(anime);
              }}
            />
          </Suspense>
        )}

        {/* 3. Shareable Custom Collection Modal */}
        {isCollectionOpen && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <CreateCollectionModal
              key="collection-modal"
              animeList={catalogList}
              onClose={() => setIsCollectionOpen(false)}
            />
          </Suspense>
        )}

        {/* 4. Submit Dub Info Modal */}
        {isDubModalOpen && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <DubInfoModal
              key="dub-info-modal"
              isOpen={isDubModalOpen}
              onClose={() => setIsDubModalOpen(false)}
              onSubmit={() => {
                setIsDubModalOpen(false);
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* 5. Clerk Admin Authentication Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#121829] border border-primary-theme rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <div className="text-center mb-5 flex flex-col items-center">
              <AniDubLogo variant="stacked" size="sm" className="mb-3" />
              <h3 className="text-lg font-black text-white">Clerk Admin Protection</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Strict Clerk Authentication is required to access <code className="text-purple-400">/admin</code>
              </p>
            </div>

            {!isSignedIn ? (
              <div className="flex flex-col items-center space-y-4">
                <SignIn />
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#161d2f] hover:bg-[#1a2236] text-neutral-300 text-xs font-semibold transition-colors border border-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : isClerkAdmin ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-300">Authorized Clerk Administrator</p>
                    <p className="text-[11px] text-neutral-300 truncate">{clerkUser?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                </div>

                {adminAuthError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-400 font-medium text-center break-words">
                    {adminAuthError}
                  </div>
                )}

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#161d2f] hover:bg-[#1a2236] text-neutral-300 text-xs font-semibold transition-colors border border-neutral-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyClerkAdminUnlock}
                    disabled={adminPasswordLoading}
                    className="flex-1 px-4 py-2.5 rounded-xl btn-primary-theme text-white text-xs font-bold transition-all shadow-lg shadow-purple-950/40 disabled:opacity-50 cursor-pointer"
                  >
                    {adminPasswordLoading ? 'Verifying...' : 'Open Admin Console'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-rose-300">Admin Verification Status</p>
                    <p className="text-[11px] text-neutral-300 mt-1">
                      Signed in as <span className="font-mono text-white">{clerkUser?.primaryEmailAddress?.emailAddress}</span>.
                    </p>
                    {adminAuthError && (
                      <p className="text-[11px] text-rose-300 mt-2 font-medium break-words">
                        {adminAuthError}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyClerkAdminUnlock}
                  disabled={adminPasswordLoading}
                  className="w-full px-4 py-2.5 rounded-xl btn-primary-theme text-white text-xs font-bold transition-all shadow-lg shadow-purple-950/40 disabled:opacity-50 cursor-pointer"
                >
                  {adminPasswordLoading ? 'Verifying...' : 'Open Admin Console'}
                </button>

                <div className="flex space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#161d2f] hover:bg-[#1a2236] text-neutral-300 text-xs font-semibold transition-colors border border-neutral-800 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => clerkSignOut()}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Switch Account</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
