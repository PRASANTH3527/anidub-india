import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CatalogView } from './components/CatalogView';
import { AnimeDetailModal } from './components/AnimeDetailModal';
import { WatchPlayerModal } from './components/WatchPlayerModal';
import { CloudflareConsoleView } from './components/CloudflareConsoleView';
import { AiRecommenderView } from './components/AiRecommenderView';
import { AdminPanelView } from './components/AdminPanelView';
import { UserProfileModal } from './components/UserProfileModal';
import { Film, Bookmark, Cloud, Sparkles, ShieldCheck, Play, Star, Tv, Trash2, Image as ImageIcon } from 'lucide-react';

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

  const [currentUser, setCurrentUser] = useState<{ username: string; avatar_url: string }>({
    username: 'Kaito_Cloud',
    avatar_url: 'https://i.ibb.co/vzS8G90/default-avatar.png'
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [playingData, setPlayingData] = useState<{ anime: any; episode: any } | null>(null);
  const [watchlistAnimeList, setWatchlistAnimeList] = useState<any[]>([]);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser({
          username: data.username || 'Kaito_Cloud',
          avatar_url: data.avatar_url || 'https://i.ibb.co/vzS8G90/default-avatar.png'
        });
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
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

  const handlePlayAnime = async (anime: any) => {
    try {
      const res = await fetch(`/api/anime/${anime.id}`);
      const data = await res.json();
      const firstEp = data.episodes?.[0] || {
        id: 1,
        anime_id: anime.id,
        episode_number: 1,
        title: 'Episode 1: Premiere',
        duration: '24m',
        thumbnail_url: anime.cover_image,
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        synopsis: 'The epic beginning of the journey.'
      };
      setPlayingData({ anime: data, episode: firstEp });
    } catch {
      setPlayingData({
        anime,
        episode: {
          id: 1,
          anime_id: anime.id,
          episode_number: 1,
          title: 'Episode 1: Premiere',
          duration: '24m',
          thumbnail_url: anime.cover_image,
          video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          synopsis: 'The epic beginning of the journey.'
        }
      });
    }
  };

  const handlePlaySpecificEpisode = (anime: any, episode: any) => {
    setPlayingData({ anime, episode });
    setSelectedAnimeId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Outfit',sans-serif]">
      
      {/* Navbar with ImgBB avatar and user profile click */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        watchlistCount={watchlist.length}
        searchQuery={searchQuery}
        setSearchQuery={(q) => { setSearchQuery(q); if (activeTab !== 'catalog') setActiveTab('catalog'); }}
        userAvatar={currentUser.avatar_url}
        userName={currentUser.username}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'catalog' && (
          <CatalogView
            onSelectAnime={(anime) => setSelectedAnimeId(anime.id)}
            onPlayAnime={handlePlayAnime}
            searchQuery={searchQuery}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        {activeTab === 'watchlist' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-3">
                  <Bookmark className="w-7 h-7 text-orange-500 fill-orange-500" />
                  <span>My Cloudflare Watchlist</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Saved anime synchronized instantly across your devices via Cloudflare D1 with ImgBB CDN posters.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-orange-400">
                {watchlistAnimeList.length} Saved Titles
              </span>
            </div>

            {watchlistAnimeList.length === 0 ? (
              <div className="text-center py-24 bg-slate-900/50 rounded-3xl border border-slate-800">
                <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-base font-bold text-slate-300">Your watchlist is empty</h3>
                <p className="text-xs text-slate-500 mt-1">Browse the catalog and click the bookmark icon to save titles.</p>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-600/30"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {watchlistAnimeList.map((anime) => (
                  <div
                    key={anime.id}
                    className="group bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-orange-500/50 transition-all flex flex-col shadow-lg"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-slate-950">
                      <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                      
                      <button
                        onClick={() => handleToggleWatchlist(anime.id)}
                        className="absolute top-3 right-3 p-2 rounded-xl bg-orange-600 text-white shadow-lg"
                        title="Remove from Watchlist"
                      >
                        <Bookmark className="w-3.5 h-3.5 fill-white" />
                      </button>

                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 font-medium">
                        <span className="flex items-center"><Tv className="w-3.5 h-3.5 mr-1 text-orange-400" /> {anime.episodes_count} Eps</span>
                        <span className="flex items-center text-amber-400 font-bold"><Star className="w-3.5 h-3.5 fill-amber-400 mr-0.5" /> {anime.rating}</span>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3
                          onClick={() => setSelectedAnimeId(anime.id)}
                          className="font-bold text-slate-100 text-base font-['Space_Grotesk',sans-serif] hover:text-orange-400 cursor-pointer transition-colors line-clamp-1"
                        >
                          {anime.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                          {anime.synopsis}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                        <button
                          onClick={() => setSelectedAnimeId(anime.id)}
                          className="text-xs font-semibold text-orange-400 hover:text-orange-300"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handlePlayAnime(anime)}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Watch</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cloudflare' && <CloudflareConsoleView />}
        {activeTab === 'recommender' && (
          <AiRecommenderView
            onSelectAnime={(anime) => setSelectedAnimeId(anime.id)}
            onPlayAnime={handlePlayAnime}
          />
        )}
        {activeTab === 'admin' && (
          <AdminPanelView
            onAnimeCreated={() => {
              // Anime list updated in D1
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 mt-16 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-orange-600 flex items-center justify-center text-white">
              <Cloud className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-300">Cloudflare Pages & D1 Anime Ecosystem</span>
          </div>
          <div>
            Powered by Cloudflare Pages, D1 Relational SQL, ImgBB Cloud CDN (Zero Card), and Workers API Functions.
          </div>
          <div className="text-slate-600">
            © 2026 Cloudflare + ImgBB. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Anime Detail Modal */}
      {selectedAnimeId !== null && (
        <AnimeDetailModal
          animeId={selectedAnimeId}
          onClose={() => setSelectedAnimeId(null)}
          onPlayEpisode={handlePlaySpecificEpisode}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
          currentUser={currentUser}
        />
      )}

      {/* Watch Player Modal */}
      {playingData !== null && (
        <WatchPlayerModal
          anime={playingData.anime}
          episode={playingData.episode}
          onClose={() => setPlayingData(null)}
          onSelectEpisode={(ep) => setPlayingData(prev => prev ? { ...prev, episode: ep } : null)}
        />
      )}

      {/* User Profile & ImgBB Avatar Modal */}
      {isProfileOpen && (
        <UserProfileModal
          onClose={() => setIsProfileOpen(false)}
          onProfileUpdated={(updated) => {
            setCurrentUser({
              username: updated.username,
              avatar_url: updated.avatar_url
            });
          }}
        />
      )}

    </div>
  );
};
