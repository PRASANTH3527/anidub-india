import React, { useState } from 'react';
import { 
  Bookmark, 
  Dna, 
  Layers, 
  Edit3, 
  Check, 
  X, 
  Star, 
  Tv, 
  Flame, 
  MessageSquare, 
  Search, 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  Play, 
  ExternalLink,
  ShieldCheck,
  Languages,
  Clock
} from 'lucide-react';
import { Anime } from './CatalogView';
import { LocalProfileModal } from './LocalProfileModal';
import { AnimeDNAProfile } from './AnimeDNAProfile';

export interface ProfileViewProps {
  watchlist: number[];
  catalogList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onToggleWatchlist: (animeId: number) => void;
  onOpenCreateCollection?: () => void;
  onNavigateToCatalog?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  watchlist,
  catalogList,
  onSelectAnime,
  onToggleWatchlist,
  onOpenCreateCollection,
  onNavigateToCatalog
}) => {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('anidub_username') || 'Prasanth';
  });
  const [userAvatar, setUserAvatar] = useState(() => {
    return localStorage.getItem('anidub_avatar') || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80';
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'dna' | 'collections'>('watchlist');

  // Watchlist tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Watching' | 'Completed'>('All');

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      setUserName(nameInput.trim());
      localStorage.setItem('anidub_username', nameInput.trim());
    }
    setIsEditingName(false);
  };

  // Real verified watchlist items strictly matching catalog records
  const savedAnimeList = catalogList.filter((a) => 
    watchlist.some(wId => String(wId) === String(a.id))
  );

  // Real dynamic user stats from local storage & actual state
  const watchedCount = React.useMemo(() => {
    try {
      const watched = JSON.parse(localStorage.getItem('cf_watched_anime_ids') || '[]');
      return Array.isArray(watched) ? watched.length : 0;
    } catch {
      return 0;
    }
  }, []);

  const reviewCount = React.useMemo(() => {
    try {
      const reviews = JSON.parse(localStorage.getItem('cf_user_reviews') || '[]');
      return Array.isArray(reviews) ? reviews.length : 0;
    } catch {
      return 0;
    }
  }, []);

  const upvoteCount = React.useMemo(() => {
    try {
      const upvotes = JSON.parse(localStorage.getItem('cf_user_upvoted_ids') || '[]');
      return Array.isArray(upvotes) ? upvotes.length : 0;
    } catch {
      return 0;
    }
  }, []);

  const userCollections = React.useMemo(() => {
    try {
      const cols = JSON.parse(localStorage.getItem('cf_user_collections') || '[]');
      return Array.isArray(cols) ? cols : [];
    } catch {
      return [];
    }
  }, []);

  const filteredWatchlist = savedAnimeList.filter((anime) => {
    const matchesSearch = !searchQuery.trim() || 
      anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (anime.genres && anime.genres.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'Watching' && anime.status === 'Airing') ||
      (statusFilter === 'Completed' && anime.status !== 'Airing');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      
      {/* 1. PROFILE HEADER CARD */}
      <div className="bg-[#131926] border border-primary-theme rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        
        {/* Glow Element */}
        <div 
          className="absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'var(--primary-glow)' }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          
          {/* Avatar with bottom-right emerald online dot */}
          <div className="relative shrink-0 group cursor-pointer" onClick={() => setIsProfileModalOpen(true)}>
            <img 
              src={userAvatar} 
              alt={userName}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-primary-theme/60 shadow-xl group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Edit3 className="w-5 h-5" />
            </div>
            <span 
              className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#131926] shadow-md"
              title="Online Active Session"
            />
          </div>

          {/* User Info & Inline Edit Form */}
          <div className="flex-1 min-w-0 space-y-3">
            
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3">
              <div>
                {isEditingName ? (
                  <form onSubmit={handleSaveName} className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="bg-[#0b0f17] border border-primary-theme rounded-xl px-3 py-1 text-lg font-black text-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-2 rounded-xl bg-primary-theme text-white hover:opacity-90"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setNameInput(userName);
                      }}
                      className="p-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                    <h1 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight">
                      {userName}
                    </h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                      title="Edit Profile Name"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <span className="badge-primary-theme text-xs font-bold px-3 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Dub Enthusiast</span>
                    </span>
                  </div>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  Indian Regional Anime Explorer • Supporting Official OTT Simulcasts
                </p>
              </div>

              <div className="text-xs text-neutral-400 font-semibold bg-[#182032] border border-neutral-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified OTT Streamer</span>
              </div>
            </div>

            {/* 4 Quick Stat Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <div className="bg-[#182032] border border-neutral-800 px-3 py-2 rounded-xl text-center sm:text-left">
                <div className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                  WATCHLIST
                </div>
                <div className="text-lg font-black text-white">{savedAnimeList.length} Saved</div>
              </div>

              <div className="bg-[#182032] border border-neutral-800 px-3 py-2 rounded-xl text-center sm:text-left">
                <div className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                  TITLES WATCHED
                </div>
                <div className="text-lg font-black text-emerald-400">{watchedCount} Completed</div>
              </div>

              <div className="bg-[#182032] border border-neutral-800 px-3 py-2 rounded-xl text-center sm:text-left">
                <div className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                  DUB REVIEWS
                </div>
                <div className="text-lg font-black text-purple-400">{reviewCount} Reviews</div>
              </div>

              <div className="bg-[#182032] border border-neutral-800 px-3 py-2 rounded-xl text-center sm:text-left">
                <div className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                  COMMUNITY VOTES
                </div>
                <div className="text-lg font-black text-amber-400">{upvoteCount} Upvotes</div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* 2. PROFILE SUB-NAVIGATION */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#131926] border border-neutral-800 w-fit">
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'watchlist'
              ? 'bg-primary-theme text-white shadow-lg'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Watchlist ({savedAnimeList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dna')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'dna'
              ? 'bg-primary-theme text-white shadow-lg'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Dna className="w-3.5 h-3.5" />
          <span>Anime DNA</span>
        </button>

        <button
          onClick={() => setActiveTab('collections')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'collections'
              ? 'bg-primary-theme text-white shadow-lg'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Collections ({userCollections.length})</span>
        </button>
      </div>

      {/* 3. SUB-TAB CONTENT */}
      {/* TAB 1: WATCHLIST */}
      {activeTab === 'watchlist' && (
        <div className="space-y-6">
          
          {/* Header Controls: Search input + 3 status filter pills */}
          <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Status Filter Pills */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(['All', 'Watching', 'Completed'] as const).map((status) => {
                const isActive = statusFilter === status;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary-theme text-white shadow-sm'
                        : 'bg-[#182032] border border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved titles..."
                className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-primary-theme rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none"
              />
            </div>

          </div>

          {/* 2-Column Horizontal Cards */}
          {filteredWatchlist.length === 0 ? (
            <div className="text-center py-16 bg-[#131926]/40 border border-neutral-800 rounded-3xl p-8 space-y-3">
              <Bookmark className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No anime found in watchlist</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Save anime from the main catalog to track episode releases and dub air dates.
              </p>
              {onNavigateToCatalog && (
                <button
                  onClick={onNavigateToCatalog}
                  className="btn-primary-theme px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg mt-2 cursor-pointer"
                >
                  Browse Dub Catalog
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWatchlist.map((anime) => (
                <div 
                  key={anime.id}
                  className="bg-[#131926] border border-neutral-800 hover:border-primary-theme rounded-2xl p-4 flex gap-4 transition-all shadow-md group"
                >
                  {/* Thumbnail */}
                  <img 
                    src={anime.cover_image ? anime.cover_image : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                    alt={anime.title}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                    }}
                    onClick={() => onSelectAnime(anime)}
                    className="w-20 sm:w-24 aspect-[3/4.2] rounded-xl object-cover shrink-0 cursor-pointer border border-neutral-700/60 group-hover:scale-102 transition-transform"
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-500/30">
                          {anime.type || 'TV Series'}
                        </span>
                        <button
                          onClick={() => onToggleWatchlist(anime.id)}
                          className="text-xs text-neutral-400 hover:text-red-400 transition-colors p-1"
                          title="Remove from watchlist"
                        >
                          ✕
                        </button>
                      </div>

                      <h4 
                        onClick={() => onSelectAnime(anime)}
                        className="text-sm font-black text-white truncate cursor-pointer group-hover:text-primary-theme transition-colors mt-1"
                      >
                        {anime.title}
                      </h4>

                      <p className="text-[11px] text-neutral-400">
                        {anime.languages || 'Hindi, Tamil, Telugu'} • {anime.platform || 'Crunchyroll'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-400">
                        ★ {anime.rating || 8.5}/10
                      </span>

                      <button
                        onClick={() => onSelectAnime(anime)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-theme hover:text-white transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-primary-theme" />
                        <span>Watch Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: ANIME DNA */}
      {activeTab === 'dna' && (
        <AnimeDNAProfile 
          watchlist={savedAnimeList} 
          onSelectAnime={onSelectAnime} 
          onNavigateCatalog={onNavigateToCatalog} 
        />
      )}

      {/* TAB 3: COLLECTIONS */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Curated Regional Dub Lists</h3>
              <p className="text-xs text-neutral-400">Personal and community collections of regional anime</p>
            </div>
            {onOpenCreateCollection && (
              <button
                onClick={onOpenCreateCollection}
                className="btn-primary-theme px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Collection</span>
              </button>
            )}
          </div>

          {userCollections.length === 0 ? (
            <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-800 text-neutral-400 flex items-center justify-center">
                <Layers className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-white">No Custom Collections Yet</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                You haven't created any custom collections yet. Group your favorite regional dubs into shareable playlists!
              </p>
              {onOpenCreateCollection && (
                <button
                  onClick={onOpenCreateCollection}
                  className="btn-primary-theme px-5 py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Collection</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {userCollections.map((col: any, idx: number) => (
                <div 
                  key={col.id || idx}
                  className="rounded-2xl bg-[#131926] border border-neutral-800 overflow-hidden shadow-lg hover:border-neutral-700 transition-all group cursor-pointer"
                >
                  <div className="h-32 overflow-hidden relative bg-[#182032] flex items-center justify-center">
                    {col.banner ? (
                      <img 
                        src={col.banner} 
                        alt={col.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                        <Layers className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#131926] via-transparent to-black/40" />
                    <span className="absolute bottom-2 left-3 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-bold text-amber-300 border border-white/10">
                      {col.count || 0} Titles
                    </span>
                  </div>
                  <div className="p-4 space-y-1">
                    <h4 className="text-sm font-bold text-white group-hover:text-primary-theme transition-colors">
                      {col.title}
                    </h4>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {col.desc || 'Curated personal playlist of regional Indian anime dubs.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LOCAL PROFILE MODAL */}
      <LocalProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentName={userName}
        onSaveProfile={(newName, newAvatar) => {
          setUserName(newName);
          setUserAvatar(newAvatar);
          localStorage.setItem('anidub_username', newName);
          localStorage.setItem('anidub_avatar', newAvatar);
        }}
      />

    </div>
  );
};
