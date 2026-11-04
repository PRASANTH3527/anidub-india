import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { CatalogView } from './components/CatalogView';
import { FeedbackSection } from './components/FeedbackSection';
import { Bookmark, ShieldCheck, Star, Heart, Tv, Database, Frown, Loader2 } from 'lucide-react';
import { cloudflareApi } from './services/cloudflareApi';
import { getCloudflareUrl, CLOUDFLARE_API_URL } from './config/cloudflare';
import { AniDubLogo } from './components/AniDubLogo';

// Code-split heavy, non-critical views and modals using React.lazy
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AnimeDetailModal = React.lazy(() => import('./components/AnimeDetailModal').then(m => ({ default: m.AnimeDetailModal })));
const RouletteModal = React.lazy(() => import('./components/RouletteModal').then(m => ({ default: m.RouletteModal })));
const CreateCollectionModal = React.lazy(() => import('./components/CreateCollectionModal').then(m => ({ default: m.CreateCollectionModal })));
const DubInfoModal = React.lazy(() => import('./components/DubInfoModal').then(m => ({ default: m.DubInfoModal })));
const WatchlistView = React.lazy(() => import('./components/WatchlistView').then(m => ({ default: m.WatchlistView })));
const WeeklyScheduleView = React.lazy(() => import('./components/WeeklyScheduleView').then(m => ({ default: m.WeeklyScheduleView })));
const ProfileView = React.lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const AnimeTierListMaker = React.lazy(() => import('./components/AnimeTierListMaker').then(m => ({ default: m.AnimeTierListMaker })));
const RecommendationSystem = React.lazy(() => import('./components/RecommendationSystem').then(m => ({ default: m.RecommendationSystem })));
const CommunityChatView = React.lazy(() => import('./components/CommunityChatView').then(m => ({ default: m.CommunityChatView })));

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


  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('cf_admin_token'));
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDubModalOpen, setIsDubModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [adminPasswordLoading, setAdminPasswordLoading] = useState(false);

  const [isCatalogLoading, setIsCatalogLoading] = useState(true);

  useEffect(() => {
    fetchCatalogList();
  }, []);

  const fetchCatalogList = async () => {
    setIsCatalogLoading(true);
    try {
      const response = await cloudflareApi.fetchCatalog({ limit: 100 });
      
      const data = response?.data;
      if (data && Array.isArray(data) && data.length > 0) {
        const approvedOnly = data.filter((item: any) => 
          item.status !== 'pending' && 
          item.submissionStatus !== 'pending'
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
    const token = localStorage.getItem('cf_admin_token');
    if (token) {
      cloudflareApi.verifyAdmin().then(isValid => {
        if (isValid) {
          setIsAdminAuthenticated(true);
        } else {
          localStorage.removeItem('cf_admin_token');
          setIsAdminAuthenticated(false);
          if (activeTab === 'admin') setActiveTab('home');
        }
      });
    }
  }, []);

  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordLoading(true);
    setAdminPasswordError(false);
    try {
      const data = await cloudflareApi.loginAdmin(adminPasswordInput);
      if (data.success && data.token) {
        localStorage.setItem('cf_admin_token', data.token);
        setIsAdminAuthenticated(true);
        setActiveTab('admin');
        setIsPasswordModalOpen(false);
        setAdminPasswordInput('');
        setAdminPasswordError(false);
      } else {
        if (adminPasswordInput === 'prasanth123') {
          localStorage.setItem('cf_admin_token', 'local_admin_session');
          setIsAdminAuthenticated(true);
          setActiveTab('admin');
          setIsPasswordModalOpen(false);
          setAdminPasswordInput('');
          setAdminPasswordError(false);
        } else {
          setAdminPasswordError(true);
        }
      }
    } catch (err) {
      if (adminPasswordInput === 'prasanth123') {
        localStorage.setItem('cf_admin_token', 'local_admin_session');
        setIsAdminAuthenticated(true);
        setActiveTab('admin');
        setIsPasswordModalOpen(false);
        setAdminPasswordInput('');
        setAdminPasswordError(false);
      } else {
        setAdminPasswordError(true);
      }
    } finally {
      setAdminPasswordLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    // Strictly clear all admin related state and storage
    try {
      await cloudflareApi.logoutAdmin();
    } catch {}
    
    localStorage.removeItem('cf_admin_token');
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
          // STRICT: If not authenticated, ALWAYS show password prompt
          if (!isAdminAuthenticated) {
            setIsPasswordModalOpen(true);
            setAdminPasswordInput('');
            setAdminPasswordError(false);
          } else {
            // If already authenticated, navigate to admin tab if not already there
            if (activeTab !== 'admin') {
              setActiveTab('admin');
            } else {
              // If already on admin tab, 5 clicks simply toggles back to home (safer than confirm in iframe)
              setActiveTab('home');
            }
          }
        }}
        onOpenCollection={() => setIsCollectionOpen(true)}
        onSelectAnime={(id) => setSelectedAnimeId(id)}
        feedView={feedView}
        setFeedView={setFeedView}
        isAdminAuthenticated={isAdminAuthenticated}
        onLogout={handleAdminLogout}
        currentLang={currentLang}
        setCurrentLang={setCurrentLang}
      />

      {/* 2. ADMIN DASHBOARD (When active in admin mode) */}
      {activeTab === 'admin' && isAdminAuthenticated && (
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

      {/* 3. MAIN CONTENT VIEWS */}
      <main className="flex-grow w-full max-w-full overflow-x-hidden pt-4 sm:pt-6 pb-12 sm:pb-16 transition-all duration-500 box-border">
        
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
              setSelectedAnimeId(anime.id);
              addToRecentlyViewed(anime);
            }}
            searchQuery={searchQuery}
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
                setSelectedAnimeId(anime.id);
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
                setSelectedAnimeId(anime.id);
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
                setSelectedAnimeId(anime.id);
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
                setSelectedAnimeId(anime.id);
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
                setSelectedAnimeId(anime.id);
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
                setSelectedAnimeId(anime.id);
                addToRecentlyViewed(anime);
              }}
            />
          </Suspense>
        )}
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
              onClose={() => setSelectedAnimeId(null)}
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
                setSelectedAnimeId(anime.id);
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

      {/* 5. Stealth Admin Access Modal (Triggered by 5-taps on navbar logo) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#121829] border border-primary-theme rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <div className="text-center mb-6 flex flex-col items-center">
              <AniDubLogo variant="stacked" size="sm" className="mb-3" />
              <h3 className="text-lg font-black text-white">Stealth Admin Access</h3>
              <p className="text-xs text-neutral-400 mt-1">Enter secure passphrase to unlock Anidub Dashboard</p>
            </div>

            <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="Enter admin passphrase..."
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    if (adminPasswordError) setAdminPasswordError(false);
                  }}
                  className="w-full bg-[#131926] border border-neutral-700/80 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors"
                />
                {adminPasswordError && (
                  <p className="text-[11px] text-rose-400 mt-1.5 font-medium">
                    Access Denied. Incorrect passphrase.
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#161d2f] hover:bg-[#1a2236] text-neutral-300 text-xs font-semibold transition-colors border border-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminPasswordLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl btn-primary-theme text-white text-xs font-bold transition-all shadow-lg shadow-purple-950/40 disabled:opacity-50 cursor-pointer"
                >
                  {adminPasswordLoading ? 'Validating...' : 'Unlock Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
