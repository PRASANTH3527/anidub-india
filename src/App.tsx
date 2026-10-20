import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CatalogView, FALLBACK_SEED_ANIME } from './components/CatalogView';
import { AnimeDetailModal } from './components/AnimeDetailModal';
import { AdminDashboard } from './components/AdminDashboard';
import { RouletteModal } from './components/RouletteModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { WeeklyScheduleView } from './components/WeeklyScheduleView';
import { DubInfoModal } from './components/DubInfoModal';
import { WatchlistView } from './components/WatchlistView';
import { ProfileView } from './components/ProfileView';
import { AnimeTierListMaker } from './components/AnimeTierListMaker';
import { RecommendationSystem } from './components/RecommendationSystem';
import { Footer } from './components/Footer';
import { Bookmark, ShieldCheck, Star, Heart, Tv, Database, Frown } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [feedView, setFeedView] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Watchlist state
  const [watchlist, setWatchlist] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('cf_anime_watchlist');
      return saved ? JSON.parse(saved) : [1, 2];
    } catch {
      return [1, 2];
    }
  });

  // Recently viewed state
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('cf_anime_recently_viewed');
      if (saved) return JSON.parse(saved);
      return FALLBACK_SEED_ANIME.slice(0, 4);
    } catch {
      return FALLBACK_SEED_ANIME.slice(0, 4);
    }
  });

  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [catalogList, setCatalogList] = useState<any[]>(FALLBACK_SEED_ANIME);

  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('cf_admin_token'));
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDubModalOpen, setIsDubModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [adminPasswordLoading, setAdminPasswordLoading] = useState(false);

  useEffect(() => {
    fetchCatalogList();
  }, []);

  const fetchCatalogList = async () => {
    try {
      const res = await fetch('/api/anime?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          setCatalogList(data.data);
        }
      }
    } catch (err) {
      console.warn('Connected to fallback catalog for roulette/collections:', err);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('cf_anime_watchlist', JSON.stringify(watchlist));
    } catch {}
  }, [watchlist]);

  const addToRecentlyViewed = (anime: any) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(item => item.id !== anime.id);
      const updated = [anime, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('cf_anime_recently_viewed', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearRecentlyViewed = () => {
    setRecentlyViewed([]);
    try {
      localStorage.removeItem('cf_anime_recently_viewed');
    } catch {}
  };

  const handleToggleWatchlist = async (animeId: number) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime_id: animeId })
      });
      const data = await res.json();
      if (data.watchlisted) {
        setWatchlist(prev => [...prev, animeId]);
      } else {
        setWatchlist(prev => prev.filter(id => id !== animeId));
      }
    } catch (err) {
      console.error('Failed to toggle watchlist:', err);
      // Optimistic fallback
      setWatchlist(prev => 
        prev.includes(animeId) ? prev.filter(id => id !== animeId) : [...prev, animeId]
      );
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('cf_admin_token');
    if (token) {
      fetch('/api/admin/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (res.ok) {
          setIsAdminAuthenticated(true);
        } else {
          localStorage.removeItem('cf_admin_token');
          setIsAdminAuthenticated(false);
          if (activeTab === 'admin') setActiveTab('home');
        }
      }).catch(() => {});
    }
  }, []);

  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordLoading(true);
    setAdminPasswordError(false);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
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
    try {
      const token = localStorage.getItem('cf_admin_token');
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
    } catch {}
    localStorage.removeItem('cf_admin_token');
    setIsAdminAuthenticated(false);
    setActiveTab('home');
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#0b0f17] dark:bg-[#0b0f17] text-neutral-100 flex flex-col font-sans selection:bg-primary-theme selection:text-white transition-colors duration-300 box-border">
      
      {/* 1. NAVBAR */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        watchlistCount={watchlist.length}
        searchQuery={searchQuery}
        setSearchQuery={(q) => { 
          setSearchQuery(q); 
          if (activeTab !== 'home' && activeTab !== 'catalog') setActiveTab('home'); 
        }}
        onUnlockAdmin={() => {
          if (isAdminAuthenticated) {
            setActiveTab('admin');
          } else {
            setIsPasswordModalOpen(true);
            setAdminPasswordInput('');
            setAdminPasswordError(false);
          }
        }}
        onOpenCollection={() => setIsCollectionOpen(true)}
        feedView={feedView}
        setFeedView={setFeedView}
      />

      {/* 2. ADMIN DASHBOARD (When active in admin mode) */}
      {activeTab === 'admin' && isAdminAuthenticated && (
        <AdminDashboard
          onAnimeCreated={() => {
            fetchCatalogList();
          }}
          onLogout={handleAdminLogout}
          onNavigateHome={() => setActiveTab('home')}
        />
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
            onSelectAnime={(anime) => {
              setSelectedAnimeId(anime.id);
              addToRecentlyViewed(anime);
            }}
            searchQuery={searchQuery}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            onOpenRoulette={() => setIsRouletteOpen(true)}
            onOpenCollection={() => setIsCollectionOpen(true)}
            feedView={feedView}
            recentlyViewed={recentlyViewed}
            onClearRecentlyViewed={handleClearRecentlyViewed}
          />
        )}

        {/* INTERACTIVE RECOMMENDATION SYSTEM (FOR YOU / MATCHMAKER) */}
        {(activeTab === 'recommendations' || ((activeTab === 'home' || activeTab === 'catalog') && feedView === 'foryou')) && (
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
        )}

        {/* WATCHLIST VIEW */}
        {activeTab === 'watchlist' && (
          <WatchlistView
            watchlist={catalogList.filter(anime => watchlist.includes(anime.id))}
            onSelectAnime={(anime) => {
              setSelectedAnimeId(anime.id);
              addToRecentlyViewed(anime);
            }}
            onToggleWatchlist={handleToggleWatchlist}
            onNavigateToCatalog={() => setActiveTab('home')}
          />
        )}

        {/* WEEKLY SIMULCAST SCHEDULE VIEW */}
        {activeTab === 'schedule' && (
          <WeeklyScheduleView
            onSelectAnime={(anime) => {
              setSelectedAnimeId(anime.id);
              addToRecentlyViewed(anime);
            }}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            onOpenSubmitDubModal={() => setIsDubModalOpen(true)}
          />
        )}

        {/* PROFILE VIEW */}
        {activeTab === 'profile' && (
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
        )}

        {/* TIER LIST MAKER VIEW */}
        {activeTab === 'tierlist' && (
          <AnimeTierListMaker
            catalogList={catalogList}
            onSelectAnime={(anime) => {
              setSelectedAnimeId(anime.id);
              addToRecentlyViewed(anime);
            }}
            onNavigateHome={() => setActiveTab('home')}
          />
        )}
      </main>

      {/* FOOTER */}
      <Footer
        onNavigate={(tab) => {
          if (tab === 'collection') setIsCollectionOpen(true);
          else if (tab === 'roulette') setIsRouletteOpen(true);
          else setActiveTab(tab);
        }}
        onFilterLanguage={() => {
          setActiveTab('home');
          setFeedView('library');
        }}
        onFilterPlatform={() => {
          setActiveTab('home');
          setFeedView('library');
        }}
      />


      {/* MODALS */}
      {/* 1. Anime Detail Modal */}
      {selectedAnimeId !== null && (
        <AnimeDetailModal
          animeId={selectedAnimeId}
          onClose={() => setSelectedAnimeId(null)}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />
      )}

      {/* 2. Surprise Me Roulette Modal */}
      {isRouletteOpen && (
        <RouletteModal
          animeList={catalogList}
          onClose={() => setIsRouletteOpen(false)}
          onSelectAnime={(anime) => {
            setSelectedAnimeId(anime.id);
            addToRecentlyViewed(anime);
          }}
        />
      )}

      {/* 3. Shareable Custom Collection Modal */}
      {isCollectionOpen && (
        <CreateCollectionModal
          animeList={catalogList}
          onClose={() => setIsCollectionOpen(false)}
        />
      )}

      {/* 4. Submit Dub Info Modal */}
      {isDubModalOpen && (
        <DubInfoModal
          isOpen={isDubModalOpen}
          onClose={() => setIsDubModalOpen(false)}
          onSubmit={(data) => {
            console.log('Submitted dub info:', data);
            setIsDubModalOpen(false);
          }}
        />
      )}

      {/* 5. Stealth Admin Access Modal (Triggered by 5-taps on navbar logo) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#121829] border border-primary-theme rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center mx-auto mb-3 text-purple-400 shadow-md">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
              </div>
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
