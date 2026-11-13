import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { CatalogView } from './components/CatalogView';
import { Bookmark, ShieldCheck, Star, Heart, Tv, Database, Frown, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { cloudflareApi } from './services/cloudflareApi';
import { getCloudflareUrl, CLOUDFLARE_API_URL } from './config/cloudflare';
import { AniDubLogo } from './components/AniDubLogo';
import { useUser, useClerk, SignIn } from '@clerk/nextjs';
import { isAuthorizedClerkAdmin } from './utils/auth';

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

// Dynamically import heavy, below-the-fold, and non-critical views using next/dynamic
const GodModeTracker = dynamic(() => import('./components/GodModeTracker').then(m => m.GodModeTracker), { ssr: false });
const FeedbackSection = dynamic(() => import('./components/FeedbackSection').then(m => m.FeedbackSection), { ssr: false });
const AdminDashboard = dynamic(() => import('./components/AdminDashboard').then(m => m.AdminDashboard), { loading: ViewLoadingFallback, ssr: false });
const AnimeDetailModal = dynamic(() => import('./components/AnimeDetailModal').then(m => m.AnimeDetailModal), { loading: ModalLoadingFallback, ssr: false });
const RouletteModal = dynamic(() => import('./components/RouletteModal').then(m => m.RouletteModal), { loading: ModalLoadingFallback, ssr: false });
const CreateCollectionModal = dynamic(() => import('./components/CreateCollectionModal').then(m => m.CreateCollectionModal), { loading: ModalLoadingFallback, ssr: false });
const DubInfoModal = dynamic(() => import('./components/DubInfoModal').then(m => m.DubInfoModal), { loading: ModalLoadingFallback, ssr: false });
const WatchlistView = dynamic(() => import('./components/WatchlistView').then(m => m.WatchlistView), { loading: ViewLoadingFallback, ssr: false });
const WeeklyScheduleView = dynamic(() => import('./components/WeeklyScheduleView').then(m => m.WeeklyScheduleView), { loading: ViewLoadingFallback, ssr: false });
const ProfileView = dynamic(() => import('./components/ProfileView').then(m => m.ProfileView), { loading: ViewLoadingFallback, ssr: false });
const AnimeTierListMaker = dynamic(() => import('./components/AnimeTierListMaker').then(m => m.AnimeTierListMaker), { loading: ViewLoadingFallback, ssr: false });
const RecommendationSystem = dynamic(() => import('./components/RecommendationSystem').then(m => m.RecommendationSystem), { loading: ViewLoadingFallback, ssr: false });
const CommunityChatView = dynamic(() => import('./components/CommunityChatView').then(m => m.CommunityChatView), { loading: ViewLoadingFallback, ssr: false });

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [feedView, setFeedView] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem('cf_anime_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('cf_anime_lang', currentLang);
  }, [currentLang]);
  
  // Watchlist state (strictly real state - defaults to empty)
  const [watchlist, setWatchlist] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('cf_anime_watchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean out legacy fake [1, 2] mock placeholder if present
        if (Array.isArray(parsed)) {
          if (parsed.length === 2 && parsed[0] === 1 && parsed[1] === 2) {
            localStorage.removeItem('cf_anime_watchlist');
            return [];
          }
          return parsed.map(Number).filter(id => !isNaN(id));
        }
      }
      return [];
    } catch {
      return [];
    }
  });

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
          window.history.pushState(null, '', '/');
        }
      }
    }
  }, [catalogList]);

  // Handle URL deep-links on initial load and catalog ready
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname;
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
      if (pathname.startsWith('/anime/')) {
        const slugOrId = pathname.replace(/^\/anime\//, '').split('/')[0].split('?')[0];
        const matched = catalogList.find(a => a.slug === slugOrId || String(a.id) === slugOrId);
        if (matched) {
          setSelectedAnimeId(matched.id);
        }
      } else {
        setSelectedAnimeId(null);
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

  useEffect(() => {
    fetchCatalogList();
  }, []);

  const fetchCatalogList = async () => {
    setIsCatalogLoading(true);
    try {
      const response = await cloudflareApi.fetchCatalog({ limit: 5000 });
      
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

  useEffect(() => {
    try {
      localStorage.setItem('cf_anime_watchlist', JSON.stringify(watchlist));
    } catch {}
  }, [watchlist]);

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
    try {
      const data = await cloudflareApi.toggleWatchlist(idNum);
      if (data.watchlisted) {
        setWatchlist(prev => Array.from(new Set([...prev.map(Number), idNum])));
      } else {
        setWatchlist(prev => prev.map(Number).filter(id => id !== idNum));
      }
    } catch (err) {
      console.error('Failed to toggle watchlist:', err);
      // Optimistic fallback
      setWatchlist(prev => {
        const normalized = prev.map(Number);
        return normalized.includes(idNum) 
          ? normalized.filter(id => id !== idNum) 
          : [...normalized, idNum];
      });
    }
  }, []);

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
    cloudflareApi.verifyAdminDetailed().then(detail => {
      if (cancelled) return;
      if (detail.ok) {
        setIsServerClerkAdmin(true);
        setIsAdminAuthenticated(true);
        setIsPasswordModalOpen(false);
        setAdminAuthError('');
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
          setActiveTab('admin');
        }
      } else if (isClientClerkAdmin) {
        cloudflareApi.loginAdmin().then(res => {
          if (cancelled) return;
          if (res.success) {
            setIsServerClerkAdmin(true);
            setIsAdminAuthenticated(true);
            setIsPasswordModalOpen(false);
            setAdminAuthError('');
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
              setActiveTab('admin');
            }
          } else {
            setIsServerClerkAdmin(false);
            setIsAdminAuthenticated(false);
            if (res.error) setAdminAuthError(res.error);
            if (activeTab === 'admin') setActiveTab('home');
          }
        });
      } else {
        setIsServerClerkAdmin(false);
        setIsAdminAuthenticated(false);
        if (detail.error) setAdminAuthError(detail.error);
        if (activeTab === 'admin') setActiveTab('home');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isClientClerkAdmin, activeTab]);

  const handleVerifyClerkAdminUnlock = async () => {
    if (!isSignedIn) {
      setAdminAuthError('Only the authorized Clerk Administrator can unlock /admin.');
      return;
    }
    setAdminPasswordLoading(true);
    setAdminAuthError('');
    try {
      const data = await cloudflareApi.loginAdmin();
      if (data.success) {
        setIsServerClerkAdmin(true);
        setIsAdminAuthenticated(true);
        setActiveTab('admin');
        setIsPasswordModalOpen(false);
        setAdminAuthError('');
      } else {
        setAdminAuthError(data.error || 'Access Denied. Clerk Admin session verification failed.');
      }
    } catch {
      setAdminAuthError('Unable to verify Clerk Admin session.');
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
      setWatchlist(validWatchlist);
    }

    // 2. Cleanup Recently Viewed
    const validRecentlyViewed = recentlyViewed.filter(rv => 
      catalogList.some(a => String(a.id) === String(rv.id))
    );
    if (validRecentlyViewed.length !== recentlyViewed.length) {
      setRecentlyViewed(validRecentlyViewed);
    }
  }, [catalogList, isCatalogLoading]);

  const handleToggleLike = useCallback((animeId: number, _liked: boolean, count: number) => {
    setCatalogList(prev => prev.map(a => {
      if (a.id === animeId || String(a.id) === String(animeId)) {
        return { ...a, likesCount: count };
      }
      return a;
    }));
  }, []);

  const handleToggleUpvote = useCallback((animeId: number, _upvoted: boolean, count: number) => {
    setCatalogList(prev => prev.map(a => {
      if (a.id === animeId || String(a.id) === String(animeId)) {
        return { ...a, popularity: count };
      }
      return a;
    }));
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#0b0f17] dark:bg-[#0b0f17] text-neutral-100 flex flex-col font-sans selection:bg-primary-theme selection:text-white transition-colors duration-300 box-border">
      
      {/* GOD-MODE FIRST-PARTY EDGE ANALYTICS & TELEMETRY TRACKER */}
      <GodModeTracker activeTab={activeTab} activeAnimeSlug={activeAnimeSlug} />

      {/* 1. NAVBAR */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        watchlistCount={realSavedWatchlist.length}
        searchQuery={searchQuery}
        setSearchQuery={(q) => { 
          setSearchQuery(q); 
          if (activeTab !== 'home' && activeTab !== 'catalog') setActiveTab('home'); 
        }}
        onUnlockAdmin={() => {
          if (!isAdminAuthenticated || !isClerkAdmin) {
            setIsPasswordModalOpen(true);
            setAdminAuthError('');
          } else {
            if (activeTab !== 'admin') {
              setActiveTab('admin');
            } else {
              setActiveTab('home');
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

            {/* LIVE COMMUNITY CHAT VIEW */}
            {activeTab === 'chat' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <CommunityChatView
                  onNavigateToCatalog={() => setActiveTab('home')}
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
      <FeedbackSection
        onSubmitDub={() => setIsDubModalOpen(true)}
      />


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
                  <p className="text-[11px] text-rose-400 font-medium text-center">
                    {adminAuthError}
                  </p>
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
                  <div>
                    <p className="text-xs font-bold text-rose-300">Admin Verification Status</p>
                    <p className="text-[11px] text-neutral-300 mt-1">
                      Signed in as <span className="font-mono text-white">{clerkUser?.primaryEmailAddress?.emailAddress}</span>.
                    </p>
                    {adminAuthError && (
                      <p className="text-[11px] text-rose-300 mt-2 font-medium">
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
