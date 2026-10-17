import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CatalogView } from './components/CatalogView';
import { AnimeDetailModal } from './components/AnimeDetailModal';
import { AiRecommenderView } from './components/AiRecommenderView';
import { AdminPanelView } from './components/AdminPanelView';
import { RouletteModal } from './components/RouletteModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { FALLBACK_SEED_ANIME } from './components/CatalogView';
import { Bookmark, Tv, Star, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlist, setWatchlist] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('cf_anime_watchlist');
      return saved ? JSON.parse(saved) : [1, 2];
    } catch {
      return [1, 2];
    }
  });

  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [watchlistAnimeList, setWatchlistAnimeList] = useState<any[]>([]);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [catalogList, setCatalogList] = useState<any[]>(FALLBACK_SEED_ANIME);

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

  useEffect(() => {
    if (activeTab === 'watchlist') {
      fetchWatchlistAnime();
    }
  }, [activeTab, watchlist]);

  const fetchWatchlistAnime = async () => {
    try {
      const res = await fetch('/api/watchlist');
      const data = await res.json();
      setWatchlistAnimeList(data.data || []);
    } catch (err) {
      console.error('Failed to fetch watchlist:', err);
    }
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
    }
  };

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-['Outfit',sans-serif]">
      
      {/* Lightweight Anime Directory Navbar (Zero Login/Auth) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        watchlistCount={watchlist.length}
        searchQuery={searchQuery}
        setSearchQuery={(q) => { setSearchQuery(q); if (activeTab !== 'catalog') setActiveTab('catalog'); }}
        onUnlockAdmin={() => {
          setIsPasswordModalOpen(true);
          setAdminPasswordInput('');
          setAdminPasswordError(false);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'catalog' && (
          <CatalogView
            onSelectAnime={(anime) => setSelectedAnimeId(anime.id)}
            searchQuery={searchQuery}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            onOpenRoulette={() => setIsRouletteOpen(true)}
            onOpenCollection={() => setIsCollectionOpen(true)}
          />
        )}

        {activeTab === 'watchlist' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-3">
                  <Bookmark className="w-7 h-7 text-orange-500 fill-orange-500" />
                  <span>My Saved Anime Directory</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Saved regional anime titles bookmarked in your personal collection.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-orange-400">
                {watchlistAnimeList.length} Saved Titles
              </span>
            </div>

            {watchlistAnimeList.length === 0 ? (
              <div className="text-center py-24 bg-slate-900/50 rounded-3xl border border-slate-800">
                <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-base font-bold text-slate-300">Your directory watchlist is empty</h3>
                <p className="text-xs text-slate-500 mt-1">Browse the catalog and click the bookmark icon to save titles.</p>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-600/30"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {watchlistAnimeList.map((anime) => {
                  const langs = (anime.languages || 'HIN,TAM,TEL').split(',');
                  return (
                    <div
                      key={anime.id}
                      onClick={() => setSelectedAnimeId(anime.id)}
                      className="group bg-slate-900/90 rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-800/80 hover:border-orange-500/50 transition-all duration-300 flex flex-col shadow-xl hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] cursor-pointer"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
                        <img 
                          src={anime.cover_image} 
                          alt={anime.title} 
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleWatchlist(anime.id); }}
                          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-rose-600 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-md shadow-rose-600/40 hover:scale-105"
                          title="Remove from Favorites"
                        >
                          <Heart className="w-4 h-4 fill-white text-white" />
                        </button>

                        <div className="absolute bottom-2.5 left-2.5 flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md text-amber-400 text-[10px] sm:text-xs font-bold border border-amber-500/30 shadow-md">
                          <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                          <span>⭐ RATING {anime.rating}/10</span>
                        </div>
                      </div>

                      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            {langs.map((l: string) => (
                              <span
                                key={l}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide ${
                                  l === 'HIN'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : l === 'TAM'
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                }`}
                              >
                                {l}
                              </span>
                            ))}
                            {anime.year && (
                              <span className="text-[10px] text-slate-400 font-medium ml-auto">
                                {anime.year}
                              </span>
                            )}
                          </div>

                          <h3
                            className="font-bold text-white text-sm sm:text-base font-['Space_Grotesk',sans-serif] hover:text-orange-400 cursor-pointer transition-colors line-clamp-2 leading-snug"
                          >
                            {anime.title}
                          </h3>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center text-[11px]">
                            <Tv className="w-3 h-3 text-orange-400 mr-1" />
                            {anime.episodes_count} Eps
                          </span>
                          <span className="text-orange-400 font-semibold text-[11px] group-hover:underline">
                            Details →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommender' && (
          <AiRecommenderView
            onSelectAnime={(anime) => setSelectedAnimeId(anime.id)}
          />
        )}
        {activeTab === 'admin' && (
          <AdminPanelView
            onAnimeCreated={() => {
              fetchCatalogList();
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 mt-16 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-black text-sm text-white tracking-tight font-['Space_Grotesk',sans-serif] lowercase">anidub</span>
            <span className="text-orange-500 font-black text-sm font-['Space_Grotesk',sans-serif]">INDIA</span>
          </div>
          <div className="text-slate-500">
            © 2026 Anidub India. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Anime Detail Directory Modal (Zero Video Player) */}
      {selectedAnimeId !== null && (
        <AnimeDetailModal
          animeId={selectedAnimeId}
          onClose={() => setSelectedAnimeId(null)}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />
      )}

      {/* Surprise Me Roulette Modal */}
      {isRouletteOpen && (
        <RouletteModal
          animeList={catalogList}
          onClose={() => setIsRouletteOpen(false)}
          onSelectAnime={(anime) => setSelectedAnimeId(anime.id)}
        />
      )}

      {/* Shareable Custom Collection Modal */}
      {isCollectionOpen && (
        <CreateCollectionModal
          animeList={catalogList}
          onClose={() => setIsCollectionOpen(false)}
        />
      )}

      {/* Admin Password Prompt Modal (5-click Easter Egg) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto mb-3 text-orange-400">
                🔐
              </div>
              <h3 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif]">Admin Access Required</h3>
              <p className="text-xs text-slate-400 mt-1">Enter secure passphrase to unlock Anidub Dashboard</p>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (adminPasswordInput === 'prasanth123') {
                  setActiveTab('admin');
                  setIsPasswordModalOpen(false);
                  setAdminPasswordInput('');
                  setAdminPasswordError(false);
                } else {
                  setAdminPasswordError(true);
                }
              }}
              className="space-y-4"
            >
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="Enter password..."
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    if (adminPasswordError) setAdminPasswordError(false);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
                {adminPasswordError && (
                  <p className="text-[11px] text-red-400 mt-1.5 font-medium animate-shake">
                    Access Denied. Incorrect password.
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/20"
                >
                  Unlock Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
