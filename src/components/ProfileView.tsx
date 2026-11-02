import React, { useState } from 'react';
import { 
  SignedIn, 
  SignedOut, 
  SignIn, 
  useUser,
  UserProfile 
} from '@clerk/clerk-react';
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
  Clock,
  Trophy,
  Share2,
  Compass,
  Film,
  TrendingUp,
  Zap,
  Award,
  ArrowRight,
  User as UserIcon,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime } from './CatalogView';
import { cloudflareApi } from '../services/cloudflareApi';
import { LocalProfileModal } from './LocalProfileModal';
import { AnimeDNAProfile } from './AnimeDNAProfile';

export interface ProfileViewProps {
  watchlist: number[];
  catalogList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onToggleWatchlist: (animeId: number) => void;
  onOpenCreateCollection?: () => void;
  onNavigateToCatalog?: () => void;
  userAvatar?: string;
  onAvatarChange?: (url: string) => void;
}

// Shared dashboard layout component
const ProfileDashboardBase: React.FC<ProfileViewProps & {
  userName: string;
  userAvatar: string;
  userEmail: string;
  isClerkMode: boolean;
}> = ({
  watchlist,
  catalogList,
  onSelectAnime,
  onToggleWatchlist,
  onOpenCreateCollection,
  onNavigateToCatalog,
  userAvatar: propUserAvatar,
  onAvatarChange,
  userName,
  userAvatar,
  userEmail,
  isClerkMode
}) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'dna' | 'collections' | 'account'>('watchlist');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Watching' | 'Completed'>('All');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareProfile = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const savedAnimeList = catalogList.filter((a) => 
    watchlist.some(wId => String(wId) === String(a.id))
  );

  const watchedCount = React.useMemo(() => {
    try {
      const watched = JSON.parse(localStorage.getItem('cf_watched_anime_ids') || '[]');
      return Array.isArray(watched) ? watched.length : 0;
    } catch {
      return 0;
    }
  }, []);

  const [dbStats, setDbStats] = useState({ reviewCount: 0, voteCount: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const stats = await cloudflareApi.fetchUserStats();
        setDbStats(stats);
      } catch (err) {
        console.warn('Failed to fetch D1 stats:', err);
      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchStats();
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

  const userTopLanguages = React.useMemo(() => {
    const langCounts: Record<string, number> = {};
    savedAnimeList.forEach(anime => {
      if (anime.languages) {
        anime.languages.split(/[,/ ]+/).forEach(l => {
          const clean = l.trim().toUpperCase();
          if (clean && clean.length <= 4) {
            langCounts[clean] = (langCounts[clean] || 0) + 1;
          }
        });
      }
    });
    const sorted = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 4).map(([code]) => code);
  }, [savedAnimeList]);

  return (
    <div className="space-y-8">
      {/* 1. HERO PROFILE CARD */}
      <div className="relative rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.8)] p-6 sm:p-10 overflow-hidden group">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-pink-500 opacity-90" />
        <div className="absolute -right-32 -bottom-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-8 text-center md:text-left">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative group/avatar shrink-0">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 opacity-70 blur-lg animate-pulse" />
              
              <div 
                className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden p-1 bg-gradient-to-br from-white/30 via-purple-500/40 to-black/80 shadow-2xl backdrop-blur-md cursor-pointer"
                onClick={() => !isClerkMode && setIsProfileModalOpen(true)}
                title={isClerkMode ? "Manage avatar in Clerk Account" : "Change Avatar"}
              >
                <img 
                  src={userAvatar} 
                  alt={userName}
                  className="w-full h-full object-cover rounded-[22px]"
                />
              </div>

              <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#09090b] shadow-[0_0_12px_rgba(52,211,153,0.9)] z-20" title="Active Session" />
            </div>

            <div className="space-y-3 min-w-0">
              <div>
                <h1 className="font-heading font-black text-3xl sm:text-4xl text-white tracking-tight drop-shadow-md">
                  {userName}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 font-medium mt-1">{userEmail}</p>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap pt-1">
                <div className="text-[11px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{isClerkMode ? 'Clerk Verified Profile' : 'Active Local Profile'}</span>
                </div>

                <div className="text-[11px] font-bold text-amber-300 bg-amber-950/70 border border-amber-500/30 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Regional Dub Rank #1</span>
                </div>

                {userTopLanguages.length > 0 && (
                  <div className="text-[11px] font-bold text-purple-300 bg-purple-950/70 border border-purple-500/30 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                    <Languages className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Fav: {userTopLanguages.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0 self-center md:self-start">
            {!isClerkMode && (
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="px-5 py-3 rounded-2xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleShareProfile}
              className="px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-purple-500/40 text-neutral-200 hover:text-white text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>{copiedLink ? 'Link Copied!' : 'Share Profile'}</span>
            </button>

            {onOpenCreateCollection && (
              <button
                type="button"
                onClick={onOpenCreateCollection}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>New Collection</span>
              </button>
            )}

            {isClerkMode && (
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className="px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-neutral-200 hover:text-white text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <UserIcon className="w-4 h-4 text-indigo-400" />
                <span>Clerk Account Settings</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 2. BENTO STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="sm:col-span-2 relative rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 hover:border-purple-500/50 p-6 sm:p-8 shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-600/20 via-pink-600/10 to-transparent rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-purple-300 text-xs font-black uppercase tracking-wider">
                <Bookmark className="w-4 h-4 text-purple-400" />
                <span>Active Watchlist</span>
              </div>
              <div className="text-4xl sm:text-5xl font-black mt-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-pink-400 to-amber-300">
                {savedAnimeList.length}
              </div>
              <p className="text-xs text-neutral-400 mt-1.5">
                Curated titles tracked for regional Indian audio drops
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner group-hover:scale-110 transition-transform">
              <Film className="w-6 h-6" />
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
            {savedAnimeList.length > 0 ? (
              <div className="flex items-center -space-x-3 overflow-hidden">
                {savedAnimeList.slice(0, 5).map((anime, i) => (
                  <img 
                    key={`bento_poster_${anime.id}_${i}`}
                    src={anime.cover_image}
                    alt={anime.title}
                    className="w-10 h-14 rounded-xl object-cover border-2 border-[#09090b] shadow-md"
                  />
                ))}
              </div>
            ) : (
              <span className="text-xs text-neutral-500 italic">No saved titles yet</span>
            )}

            {onNavigateToCatalog && (
              <button
                type="button"
                onClick={onNavigateToCatalog}
                className="text-xs font-black text-purple-300 hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Explore Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="relative rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 hover:border-emerald-500/50 p-6 sm:p-8 shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-600/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Episodes Watched</span>
              </div>
              <div className="text-4xl sm:text-5xl font-black mt-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-400">
                {watchedCount}
              </div>
              <p className="text-xs text-neutral-400 mt-1.5">
                Verified playback history
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
              <Tv className="w-6 h-6" />
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-emerald-300/90 font-bold">
            <span>Simulcast Sync</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>100% Edge Synced</span>
            </span>
          </div>
        </div>

        <div className="relative rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 hover:border-amber-500/50 p-6 sm:p-8 shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-44 h-44 bg-amber-600/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Community Karma</span>
              </div>
              <div className="text-4xl sm:text-5xl font-black mt-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500">
                {isLoadingStats ? '...' : (dbStats.reviewCount + dbStats.voteCount)}
              </div>
              <p className="text-xs text-neutral-400 mt-1.5">
                Dub ratings & upvotes cast
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner group-hover:scale-110 transition-transform">
              <Flame className="w-6 h-6 fill-amber-400" />
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-purple-300 font-bold">{isLoadingStats ? '...' : dbStats.reviewCount} Reviews</span>
            <span className="text-neutral-500">•</span>
            <span className="text-amber-400 font-bold">{isLoadingStats ? '...' : dbStats.voteCount} Upvotes</span>
          </div>
        </div>

      </div>

      {/* 3. SEGMENTED TABS */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-4">
        
        <div className="relative flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl">
          
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`relative px-5 py-2.5 rounded-xl text-xs font-black transition-colors duration-300 flex items-center gap-2 cursor-pointer z-10 ${
              activeTab === 'watchlist' ? 'text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {activeTab === 'watchlist' && (
              <motion.div 
                layoutId="profileActiveTabIndicator"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 shadow-[0_0_25px_rgba(168,85,247,0.5)] -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <Bookmark className="w-4 h-4" />
            <span>Watchlist</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeTab === 'watchlist' ? 'bg-black/40 text-white' : 'bg-white/10 text-neutral-400'
            }`}>
              {savedAnimeList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dna')}
            className={`relative px-5 py-2.5 rounded-xl text-xs font-black transition-colors duration-300 flex items-center gap-2 cursor-pointer z-10 ${
              activeTab === 'dna' ? 'text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {activeTab === 'dna' && (
              <motion.div 
                layoutId="profileActiveTabIndicator"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 shadow-[0_0_25px_rgba(168,85,247,0.5)] -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <Dna className="w-4 h-4" />
            <span>Anime DNA</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              AI
            </span>
          </button>

          <button
            onClick={() => setActiveTab('collections')}
            className={`relative px-5 py-2.5 rounded-xl text-xs font-black transition-colors duration-300 flex items-center gap-2 cursor-pointer z-10 ${
              activeTab === 'collections' ? 'text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {activeTab === 'collections' && (
              <motion.div 
                layoutId="profileActiveTabIndicator"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 shadow-[0_0_25px_rgba(168,85,247,0.5)] -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <Layers className="w-4 h-4" />
            <span>Collections</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeTab === 'collections' ? 'bg-black/40 text-white' : 'bg-white/10 text-neutral-400'
            }`}>
              {userCollections.length}
            </span>
          </button>

          {isClerkMode && (
            <button
              onClick={() => setActiveTab('account')}
              className={`relative px-5 py-2.5 rounded-xl text-xs font-black transition-colors duration-300 flex items-center gap-2 cursor-pointer z-10 ${
                activeTab === 'account' ? 'text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {activeTab === 'account' && (
                <motion.div 
                  layoutId="profileActiveTabIndicator"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 shadow-[0_0_25px_rgba(168,85,247,0.5)] -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <UserIcon className="w-4 h-4" />
              <span>Clerk Account</span>
            </button>
          )}

        </div>

        {activeTab === 'watchlist' && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-neutral-900/60 backdrop-blur-xl border border-white/10">
              {(['All', 'Watching', 'Completed'] as const).map((status) => {
                const isActive = statusFilter === status;
                return (
                  <button
                    key={`profile_status_${status}`}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white/20 text-white shadow-sm border border-white/20'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter saved anime..."
                className="w-full bg-neutral-900/60 border border-white/10 focus:border-purple-400/80 rounded-2xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 outline-none backdrop-blur-xl shadow-inner transition-colors"
              />
            </div>
          </div>
        )}

      </div>

      {/* 4. TAB CONTENTS */}
      {activeTab === 'watchlist' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {filteredWatchlist.length === 0 ? (
            <div className="relative rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 p-12 text-center space-y-4 shadow-2xl overflow-hidden">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                <Bookmark className="w-8 h-8" />
              </div>
              <h3 className="font-heading font-black text-xl text-white">Your Watchlist is Empty</h3>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                Save verified regional Indian dubbed anime from the catalog to keep track of new episode drops, dub language availability, and official OTT streaming platforms.
              </p>
              {onNavigateToCatalog && (
                <button
                  onClick={onNavigateToCatalog}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-black text-xs shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] transition-all cursor-pointer active:scale-95 inline-flex items-center gap-2"
                >
                  <Compass className="w-4 h-4" />
                  <span>Browse Official Anime Catalog</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWatchlist.map((anime, idx) => {
                const langs = (anime.languages ? anime.languages.split(/[,/ ]+/) : ['HIN', 'TAM']).slice(0, 3);
                
                return (
                  <motion.div 
                    key={`profile_watchlist_card_${anime.id}_${idx}`}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="group relative rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 hover:border-purple-500/60 p-4 sm:p-5 flex gap-4 transition-all duration-300 shadow-[0_15px_35px_rgba(0,0,0,0.5)] overflow-hidden"
                  >
                    <div 
                      onClick={() => onSelectAnime(anime)}
                      className="relative w-24 sm:w-28 aspect-[3/4.2] rounded-2xl overflow-hidden shrink-0 cursor-pointer bg-neutral-900 border border-white/10 shadow-lg"
                    >
                      <img 
                        src={anime.cover_image}
                        alt={anime.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40">
                            {anime.type || 'TV Series'}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => onToggleWatchlist(anime.id)}
                            className="w-7 h-7 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 border border-white/5 hover:border-red-500/30 text-neutral-400 flex items-center justify-center transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>

                        <h4 
                          onClick={() => onSelectAnime(anime)}
                          className="font-heading font-black text-sm sm:text-base text-white truncate cursor-pointer group-hover:text-purple-300 transition-colors"
                        >
                          {anime.title}
                        </h4>

                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          {langs.map((l, i) => (
                            <span 
                              key={`profile_card_lang_${anime.id}_${l}_${i}`}
                              className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-neutral-300"
                            >
                              {l.trim()}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between mt-2">
                        <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{anime.rating ? anime.rating.toFixed(1) : '8.8'}/10</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => onSelectAnime(anime)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all cursor-pointer active:scale-95"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Watch</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'dna' && (
        <div className="animate-in fade-in duration-300">
          <AnimeDNAProfile 
            watchlist={savedAnimeList} 
            onSelectAnime={onSelectAnime} 
            onNavigateCatalog={onNavigateToCatalog} 
          />
        </div>
      )}

      {activeTab === 'collections' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-black text-xl text-white">Curated Regional Dub Playlists</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Shareable custom anime compilations with regional audio tracks</p>
            </div>

            {onOpenCreateCollection && (
              <button
                type="button"
                onClick={onOpenCreateCollection}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Collection</span>
              </button>
            )}
          </div>

          {userCollections.length === 0 ? (
            <div className="rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 p-12 text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                <Layers className="w-8 h-8" />
              </div>
              <h4 className="font-heading font-black text-lg text-white">No Custom Collections Created</h4>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Organize your favorite regional dubs into themed playlists and share them with the community.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {userCollections.map((col: any, idx: number) => (
                <motion.div 
                  key={`profile_collection_card_${col.id || idx}`}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 hover:border-purple-500/50 overflow-hidden shadow-xl transition-all group cursor-pointer"
                >
                  <div className="h-36 overflow-hidden relative bg-neutral-900 flex items-center justify-center">
                    {col.banner ? (
                      <img src={col.banner} alt={col.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                        <Layers className="w-7 h-7" />
                      </div>
                    )}
                    <span className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-black text-amber-300 border border-white/10 shadow-md">
                      {col.count || 0} Titles
                    </span>
                  </div>

                  <div className="p-5 space-y-1.5">
                    <h4 className="font-heading font-black text-base text-white group-hover:text-purple-300 transition-colors">
                      {col.title}
                    </h4>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {col.desc || 'Curated personal playlist of regional Indian anime dubs.'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'account' && (
        <div className="flex justify-center py-6 animate-in fade-in duration-300">
          <div className="w-full max-w-xl rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 shadow-2xl">
            <div className="text-center space-y-2 mb-6">
              <h3 className="font-heading font-black text-xl text-white">Clerk Account Management</h3>
              <p className="text-xs text-neutral-400">Manage your connected accounts, password, security keys, and profile settings via Clerk.</p>
            </div>
            <UserProfile routing="hash" />
          </div>
        </div>
      )}

      {/* LOCAL PROFILE MODAL */}
      <LocalProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentName={userName}
        onSaveProfile={(newName, newAvatar) => {
          localStorage.setItem('anidub_username', newName);
          localStorage.setItem('anidub_avatar', newAvatar);
          if (onAvatarChange) onAvatarChange(newAvatar);
          window.location.reload();
        }}
      />
    </div>
  );
};

// Clerk-authenticated dashboard wrapper
const ClerkProfileDashboard: React.FC<ProfileViewProps> = (props) => {
  const { user } = useUser();
  const userName = user?.fullName || user?.username || 'Anime Fan';
  const userAvatar = user?.imageUrl || props.userAvatar || 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png';
  const userEmail = user?.primaryEmailAddress?.emailAddress || 'user@anidub.india';

  return (
    <ProfileDashboardBase 
      {...props} 
      userName={userName} 
      userAvatar={userAvatar} 
      userEmail={userEmail} 
      isClerkMode={true} 
    />
  );
};

// Local storage profile dashboard wrapper
const LocalProfileDashboard: React.FC<ProfileViewProps> = (props) => {
  const [userName] = useState(() => localStorage.getItem('anidub_username') || 'Anime Fan');
  const [userAvatar] = useState(() => localStorage.getItem('anidub_avatar') || props.userAvatar || 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png');
  const userEmail = 'guest@anidub.india';

  return (
    <ProfileDashboardBase 
      {...props} 
      userName={userName} 
      userAvatar={userAvatar} 
      userEmail={userEmail} 
      isClerkMode={false} 
    />
  );
};

export const ProfileView: React.FC<ProfileViewProps> = (props) => {
  const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="relative w-full min-h-screen text-neutral-100 font-sans pb-24 overflow-hidden selection:bg-purple-500/30">
      
      {/* Background ambient glows */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-gradient-to-br from-purple-700/20 via-indigo-600/15 to-transparent blur-[140px] rounded-full transform -rotate-12" />
        <div className="absolute top-10 -right-28 w-[550px] h-[550px] bg-gradient-to-bl from-pink-600/15 via-purple-900/20 to-transparent blur-[150px] rounded-full" />
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[160px] rounded-full pointer-events-none" />
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 space-y-8 relative z-10">
        
        {hasClerkKey ? (
          <>
            <SignedOut>
              <div className="flex flex-col items-center justify-center py-24 px-4 space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-3 max-w-lg">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-black tracking-wider uppercase mb-2 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Clerk Authentication</span>
                  </div>
                  <h2 className="font-heading font-black text-3xl sm:text-4xl text-white tracking-tight">Sign in to manage your Anime Profile</h2>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Access your personalized watchlists, custom collections, and verified regional dub karma across all your devices.
                  </p>
                </div>
                
                <div className="w-full max-w-md rounded-3xl bg-neutral-900/80 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 shadow-2xl flex justify-center">
                  <SignIn routing="hash" />
                </div>
              </div>
            </SignedOut>

            <SignedIn>
              <ClerkProfileDashboard {...props} />
            </SignedIn>
          </>
        ) : (
          <LocalProfileDashboard {...props} />
        )}

      </div>
    </div>
  );
};

export default ProfileView;
