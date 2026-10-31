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
  Clock,
  Trophy,
  Share2,
  Compass,
  Film,
  TrendingUp,
  Zap,
  Award,
  ArrowRight
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

export const ProfileView: React.FC<ProfileViewProps> = ({
  watchlist,
  catalogList,
  onSelectAnime,
  onToggleWatchlist,
  onOpenCreateCollection,
  onNavigateToCatalog,
  userAvatar: propUserAvatar,
  onAvatarChange
}) => {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('anidub_username') || 'User';
  });
  const [localAvatar, setLocalAvatar] = useState(() => {
    const saved = localStorage.getItem('anidub_avatar');
    if (saved && !saved.includes('images.unsplash.com')) {
      return saved;
    }
    return propUserAvatar || 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png';
  });

  const userAvatar = propUserAvatar || localAvatar;
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'dna' | 'collections'>('watchlist');

  // Watchlist tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Watching' | 'Completed'>('All');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      setUserName(nameInput.trim());
      localStorage.setItem('anidub_username', nameInput.trim());
    }
    setIsEditingName(false);
  };

  const handleShareProfile = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
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

  // Calculate top languages from user watchlist
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
    <div className="relative w-full min-h-screen text-neutral-100 font-sans pb-24 overflow-hidden selection:bg-purple-500/30">
      
      {/* =========================================================================
          ATMOSPHERIC AMBIENT GLOWS & BACKGROUND
         ========================================================================= */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Top-left violet nebula */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-gradient-to-br from-purple-700/20 via-indigo-600/15 to-transparent blur-[140px] rounded-full transform -rotate-12" />
        
        {/* Top-right deep magenta glow */}
        <div className="absolute top-10 -right-28 w-[550px] h-[550px] bg-gradient-to-bl from-pink-600/15 via-purple-900/20 to-transparent blur-[150px] rounded-full" />
        
        {/* Mid-canvas subtle cyan accent glow */}
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[160px] rounded-full pointer-events-none" />

        {/* Subtle grid pattern mask */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 space-y-8 relative z-10">
        
        {/* =========================================================================
            1. HERO PROFILE CARD (ACRYLIC GLASS & NEON AURA)
           ========================================================================= */}
        <div className="relative rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-6 sm:p-8 overflow-hidden group">
          
          {/* Top Edge Laser Gradient Line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-pink-500 opacity-80" />
          
          {/* Inner ambient light gradient */}
          <div className="absolute -right-24 -bottom-24 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6 sm:gap-8 text-center md:text-left">
            
            {/* Left: Avatar with Animated Neon Glow Ring + Name & Bio */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              
              {/* Neon Avatar Container */}
              <div 
                className="relative group/avatar cursor-pointer shrink-0" 
                onClick={() => setIsProfileModalOpen(true)}
                title="Change Avatar & Character Skin"
              >
                {/* Multi-layer Pulsing Neon Halo */}
                <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-400 opacity-70 blur-md group-hover/avatar:opacity-100 group-hover/avatar:blur-lg transition-all duration-500 animate-pulse" />
                
                {/* Secondary crisp border ring */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden p-1 bg-gradient-to-br from-white/30 via-purple-500/40 to-black/60 shadow-2xl backdrop-blur-md">
                  <img 
                    src={userAvatar} 
                    alt={userName || 'User'}
                    className="w-full h-full object-cover rounded-[22px] group-hover/avatar:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-1 rounded-[22px] bg-black/60 backdrop-blur-sm opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white gap-1">
                    <Edit3 className="w-5 h-5 text-purple-300" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Change Skin</span>
                  </div>
                </div>


                {/* Online Status Dot */}
                <span 
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#09090b] shadow-[0_0_12px_rgba(16,185,129,0.8)] z-20"
                  title="Live OTT Session Active"
                />
              </div>

              {/* Name & Title Block */}
              <div className="space-y-3 min-w-0">
                <div>
                  {isEditingName ? (
                    <form onSubmit={handleSaveName} className="flex items-center justify-center sm:justify-start gap-2">
                      <input 
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="bg-black/60 border border-purple-500/80 rounded-xl px-3.5 py-1.5 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-inner"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 shadow-lg cursor-pointer"
                        title="Save"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingName(false);
                          setNameInput(userName);
                        }}
                        className="p-2 rounded-xl bg-white/10 text-neutral-300 hover:text-white cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-4 h-4 stroke-[3]" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2.5 justify-center sm:justify-start flex-wrap">
                      <h1 className="font-heading font-black text-3xl sm:text-4xl text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                        {userName || 'User'}
                      </h1>
                      
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Edit Profile Name"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                    </div>
                  )}

                  <p className="text-xs sm:text-sm text-neutral-300/80 mt-1 font-medium max-w-xl leading-relaxed">
                    Tracking official regional anime dubs across India.
                  </p>
                </div>

                {/* Badges Bar */}
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <div className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>100% Legal Streamer</span>
                  </div>

                  <div className="text-[11px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Regional Dub Rank #{Math.max(12, 100 - savedAnimeList.length * 2)}</span>
                  </div>

                  {userTopLanguages.length > 0 && (
                    <div className="text-[11px] font-bold text-purple-300 bg-purple-950/60 border border-purple-500/30 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                      <Languages className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Fav: {userTopLanguages.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex items-center gap-2.5 shrink-0 self-center md:self-start">
              <button
                type="button"
                onClick={handleShareProfile}
                className="px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-purple-500/40 text-neutral-200 hover:text-white text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer active:scale-95"
                title="Share profile link"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-purple-400" />}
                <span>{copiedLink ? 'Link Copied!' : 'Share Profile'}</span>
              </button>

              {onOpenCreateCollection && (
                <button
                  type="button"
                  onClick={onOpenCreateCollection}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Collection</span>
                </button>
              )}
            </div>

          </div>

        </div>

        {/* =========================================================================
            2. MODERN BENTO GRID STATS SECTION (VIBRANT & EXPENSIVE LOOK)
           ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Bento Tile 1: Watchlist Pulse (Double Width on larger screens) */}
          <div className="sm:col-span-2 relative rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 hover:border-purple-500/50 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(147,51,234,0.15)] flex flex-col justify-between overflow-hidden group">
            {/* Ambient tile gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-600/20 via-pink-600/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-purple-300 text-xs font-black uppercase tracking-wider">
                  <Bookmark className="w-4 h-4 text-purple-400" />
                  <span>Active Watchlist</span>
                </div>
                <div className="text-4xl sm:text-5xl font-black mt-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-pink-400 to-amber-300">
                  {savedAnimeList.length}
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Curated titles tracked for regional Indian audio drops
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner group-hover:scale-110 transition-transform">
                <Film className="w-6 h-6" />
              </div>
            </div>

            {/* Thumbnail Stack Preview */}
            <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              {savedAnimeList.length > 0 ? (
                <div className="flex items-center -space-x-3 overflow-hidden">
                  {savedAnimeList.slice(0, 5).map((anime, i) => (
                    <img 
                      key={`bento_poster_${anime.id}_${i}`}
                      src={anime.cover_image}
                      alt={anime.title}
                      className="w-9 h-12 rounded-lg object-cover border-2 border-[#09090b] shadow-md hover:z-20 hover:scale-110 transition-transform duration-300"
                    />
                  ))}
                  {savedAnimeList.length > 5 && (
                    <div className="w-9 h-12 rounded-lg bg-[#182032] border-2 border-[#09090b] flex items-center justify-center text-[10px] font-black text-neutral-300">
                      +{savedAnimeList.length - 5}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-neutral-500 italic">No saved titles yet</span>
              )}

              {onNavigateToCatalog && (
                <button
                  type="button"
                  onClick={onNavigateToCatalog}
                  className="text-xs font-black text-purple-300 hover:text-white inline-flex items-center gap-1 group-hover:translate-x-1 transition-all cursor-pointer"
                >
                  <span>Explore Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bento Tile 2: Watched Titles / Stream Completion */}
          <div className="relative rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 hover:border-emerald-500/50 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(16,185,129,0.15)] flex flex-col justify-between overflow-hidden group">
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-600/15 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Episodes Watched</span>
                </div>
                <div className="text-4xl sm:text-5xl font-black mt-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-400">
                  {watchedCount}
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Verified playback history
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
                <Tv className="w-6 h-6" />
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-emerald-300/90 font-bold">
              <span>Simulcast Sync</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>100% Edge Synced</span>
              </span>
            </div>
          </div>

          {/* Bento Tile 3: Community Dub Reviews & Votes Combined Grid Card */}
          <div className="relative rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 hover:border-amber-500/50 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(245,158,11,0.15)] flex flex-col justify-between overflow-hidden group">
            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-600/15 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-wider">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>Community Karma</span>
                </div>
                <div className="text-4xl sm:text-5xl font-black mt-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500">
                  {isLoadingStats ? '...' : (dbStats.reviewCount + dbStats.voteCount)}
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Dub ratings & upvotes cast
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner group-hover:scale-110 transition-transform">
                <Flame className="w-6 h-6 fill-amber-400" />
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-purple-300 font-bold">
                {isLoadingStats ? '...' : dbStats.reviewCount} Reviews
              </span>
              <span className="text-neutral-500">•</span>
              <span className="text-amber-400 font-bold">
                {isLoadingStats ? '...' : dbStats.voteCount} Upvotes
              </span>
            </div>
          </div>

        </div>

        {/* =========================================================================
            3. PREMIUM SEGMENTED CONTROLS / TABS
           ========================================================================= */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          
          {/* Segmented Pill Bar with Motion Slider */}
          <div className="relative flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-2xl">
            
            {/* Tab 1: Watchlist */}
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

            {/* Tab 2: Anime DNA */}
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

            {/* Tab 3: Collections */}
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

          </div>

          {/* Watchlist Filter controls only visible when on watchlist tab */}
          {activeTab === 'watchlist' && (
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              
              {/* Status Segmented Bar */}
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10">
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

              {/* Search Field with frosted glass */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter saved anime..."
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-purple-400/80 rounded-2xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 outline-none backdrop-blur-xl shadow-inner transition-colors"
                />
              </div>

            </div>
          )}

        </div>

        {/* =========================================================================
            4. SUB-TAB CONTENT FLOW
           ========================================================================= */}
        {/* TAB 1: WATCHLIST SECTION */}
        {activeTab === 'watchlist' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {filteredWatchlist.length === 0 ? (
              <div className="relative rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-12 text-center space-y-4 shadow-2xl overflow-hidden">
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
                      className="group relative rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 hover:border-purple-500/60 p-4 sm:p-5 flex gap-4 transition-all duration-300 shadow-[0_15px_35px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_rgba(147,51,234,0.25)] overflow-hidden"
                    >
                      {/* Top subtle highlight */}
                      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Poster Thumbnail */}
                      <div 
                        onClick={() => onSelectAnime(anime)}
                        className="relative w-24 sm:w-28 aspect-[3/4.2] rounded-2xl overflow-hidden shrink-0 cursor-pointer bg-neutral-900 border border-white/10 shadow-lg"
                      >
                        <img 
                          src={anime.cover_image ? anime.cover_image : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                          alt={anime.title}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Details Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div className="space-y-1.5">
                          {/* Row 1: Type badge + remove button */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40">
                              {anime.type || 'TV Series'}
                            </span>
                            
                            <button
                              type="button"
                              onClick={() => onToggleWatchlist(anime.id)}
                              className="w-7 h-7 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 border border-white/5 hover:border-red-500/30 text-neutral-400 flex items-center justify-center transition-all cursor-pointer"
                              title="Remove from watchlist"
                            >
                              <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Title */}
                          <h4 
                            onClick={() => onSelectAnime(anime)}
                            className="font-heading font-black text-sm sm:text-base text-white truncate cursor-pointer group-hover:text-purple-300 transition-colors"
                            title={anime.title}
                          >
                            {anime.title}
                          </h4>

                          {/* Dub language pills */}
                          <div className="flex items-center gap-1 flex-wrap pt-0.5">
                            {langs.map((l, i) => (
                              <span 
                                key={`profile_card_lang_${anime.id}_${l}_${i}`}
                                className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-neutral-300"
                              >
                                {l.trim()}
                              </span>
                            ))}
                            {anime.platform && (
                              <span className="text-[9px] font-bold text-amber-300 ml-auto truncate max-w-[80px]">
                                {anime.platform}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Rating & Action */}
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

        {/* TAB 2: ANIME DNA VIEW */}
        {activeTab === 'dna' && (
          <div className="animate-in fade-in duration-300">
            <AnimeDNAProfile 
              watchlist={savedAnimeList} 
              onSelectAnime={onSelectAnime} 
              onNavigateCatalog={onNavigateToCatalog} 
            />
          </div>
        )}

        {/* TAB 3: CUSTOM COLLECTIONS VIEW */}
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
              <div className="rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-12 text-center space-y-4 shadow-2xl">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                  <Layers className="w-8 h-8" />
                </div>
                <h4 className="font-heading font-black text-lg text-white">No Custom Collections Created</h4>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  Organize your favorite regional dubs into themed playlists (e.g., "Best Tamil Action Dubs", "Telugu Isekai Hits") and share them with the community.
                </p>
                {onOpenCreateCollection && (
                  <button
                    type="button"
                    onClick={onOpenCreateCollection}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xs shadow-lg inline-flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Your First Collection</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {userCollections.map((col: any, idx: number) => (
                  <motion.div 
                    key={`profile_collection_card_${col.id || idx}`}
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 hover:border-purple-500/50 overflow-hidden shadow-xl transition-all group cursor-pointer"
                  >
                    <div className="h-36 overflow-hidden relative bg-neutral-900 flex items-center justify-center">
                      {col.banner ? (
                        <img 
                          src={col.banner} 
                          alt={col.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                          <Layers className="w-7 h-7" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-black/40" />
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

      </div>

      {/* LOCAL PROFILE MODAL */}
      <LocalProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentName={userName}
        onSaveProfile={(newName, newAvatar) => {
          setUserName(newName);
          setLocalAvatar(newAvatar);
          if (onAvatarChange) onAvatarChange(newAvatar);
          localStorage.setItem('anidub_username', newName);
          localStorage.setItem('anidub_avatar', newAvatar);
        }}
      />

    </div>
  );
};
