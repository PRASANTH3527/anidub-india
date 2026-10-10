import { SupportedLanguage, mapDubLanguageToUiLang, setSavedUiLanguage } from '../utils/i18n';
import React, { useState, useMemo } from 'react';
import { 
  User, 
  Bookmark, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Search, 
  Sparkles, 
  Edit3, 
  Check, 
  Flame, 
  Tv, 
  Eye, 
  ExternalLink,
  Dna,
  Layers,
  PlusCircle,
  Share2
} from 'lucide-react';
import { Anime, WatchlistItem, DubLanguage, UserProfile } from '../types/anime';
import { useTheme } from '../context/ThemeContext';
import { AnimeDNAProfile } from './AnimeDNAProfile';
import { dbService } from '../services/databaseService';
import { AnimeCollection } from '../types/database';
import { useToast } from './Toast';

interface ProfileViewProps {
  uiLanguage?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  allAnime: Anime[];
  watchlistItems: WatchlistItem[];
  onToggleWatchedStatus: (animeId: string) => void;
  onRemoveFromWatchlist: (animeId: string) => void;
  onSelectAnime: (anime: Anime) => void;
  onNavigateToTab: (tab: 'library' | 'recommendations') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  uiLanguage,
  onLanguageChange,
  allAnime,
  watchlistItems,
  onToggleWatchedStatus,
  onRemoveFromWatchlist,
  onSelectAnime,
  onNavigateToTab,
}) => {
  const { 
    nickname: globalNickname, 
    avatar: globalAvatar, 
    userProfile: globalProfile,
    updateUserProfile 
  } = useTheme();

  const [filterStatus, setFilterStatus] = useState<'all' | 'plan_to_watch' | 'watched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [profileTab, setProfileTab] = useState<'watchlist' | 'dna' | 'collections'>('watchlist');
  const toast = useToast();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(globalNickname);
  const [editBio, setEditBio] = useState(globalProfile.favoriteLanguage || 'Tamil');
  const [editLang, setEditLang] = useState<DubLanguage>((globalProfile.favoriteLanguage as DubLanguage) || 'Tamil');

  // Map watchlist items with anime data
  const combinedList = useMemo(() => {
    return (watchlistItems || []).map((item) => {
      const anime = (allAnime || []).find((a) => a.id === item.animeId);
      return {
        item,
        anime,
      };
    }).filter((entry): entry is { item: WatchlistItem; anime: Anime } => entry.anime !== undefined);
  }, [watchlistItems, allAnime]);

  // Filtered by status and search
  const filteredList = useMemo(() => {
    return combinedList.filter(({ item, anime }) => {
      if (filterStatus === 'plan_to_watch' && item.status !== 'plan_to_watch') return false;
      if (filterStatus === 'watched' && item.status !== 'watched') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return anime.title.toLowerCase().includes(q) || anime.genres.some(g => g.toLowerCase().includes(q));
      }
      return true;
    });
  }, [combinedList, filterStatus, searchQuery]);

  const watchedCount = combinedList.filter((c) => c.item.status === 'watched').length;
  const planToWatchCount = combinedList.filter((c) => c.item.status === 'plan_to_watch').length;
  
  // Total estimated episodes completed
  const totalEpisodesWatched = useMemo(() => {
    return combinedList
      .filter((c) => c.item.status === 'watched')
      .reduce((sum, c) => sum + (c.anime.episodes || 12), 0);
  }, [combinedList]);

  const saveProfile = () => {
    updateUserProfile({
      nickname: editName.trim() || 'Anime Fan',
      favoriteLanguage: editLang,
    });
    const targetUiLang = mapDubLanguageToUiLang(editLang);
    setSavedUiLanguage(targetUiLang);
    onLanguageChange?.(targetUiLang);
    setIsEditingProfile(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Profile Header Card */}
      <div className="bg-[#131926] border border-primary-theme rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Glow */}
        <div 
          className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: 'var(--primary-glow)' }}
        />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* Avatar */}
          <div className="relative group">
            <img
              src={globalAvatar || undefined}
              alt={globalNickname}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 shadow-xl"
              style={{
                borderColor: 'var(--primary-accent)',
                boxShadow: `0 0 20px var(--primary-glow)`,
              }}
            />
            <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-[#131926] rounded-full" />
          </div>

          {/* User Info / Edit form */}
          <div className="flex-grow text-center sm:text-left space-y-2">
            {isEditingProfile ? (
              <div className="space-y-3 max-w-md">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Username</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#182032] border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Preferred Dub</label>
                  <select
                    value={editLang}
                    onChange={(e) => setEditLang(e.target.value as DubLanguage)}
                    className="w-full bg-[#182032] border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="Tamil">Tamil</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Kannada">Kannada</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveProfile}
                    className="px-3 py-1 btn-primary-theme text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h2 className="font-heading font-black text-2xl text-white">
                    {globalNickname}
                  </h2>
                  <span className="badge-primary-theme text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-accent-theme" />
                    <span>{globalProfile.favoriteLanguage} Dub Enthusiast</span>
                  </span>
                  <button
                    onClick={() => {
                      setEditName(globalNickname);
                      setEditLang((globalProfile.favoriteLanguage as DubLanguage) || 'Tamil');
                      setIsEditingProfile(true);
                    }}
                    className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="Edit Profile"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-neutral-400 max-w-xl">
                  Tracking regional Indian dubbed anime releases in Tamil, Telugu, Hindi, Malayalam, and Kannada!
                </p>
              </>
            )}

            {/* Quick Stat Badges */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-3 text-xs">
              <div className="bg-[#182032] border border-neutral-800 px-3 py-1.5 rounded-xl">
                <span className="text-neutral-500 block text-[10px] uppercase font-bold">Total Saved</span>
                <span className="font-extrabold text-white text-sm">{combinedList.length} titles</span>
              </div>
              <div className="bg-[#182032] border border-neutral-800 px-3 py-1.5 rounded-xl">
                <span className="text-neutral-500 block text-[10px] uppercase font-bold">Watched</span>
                <span className="font-extrabold text-emerald-400 text-sm">{watchedCount} completed</span>
              </div>
              <div className="bg-[#182032] border border-neutral-800 px-3 py-1.5 rounded-xl">
                <span className="text-neutral-500 block text-[10px] uppercase font-bold">Plan to Watch</span>
                <span className="font-extrabold text-amber-400 text-sm">{planToWatchCount} queue</span>
              </div>
              <div className="bg-[#182032] border border-neutral-800 px-3 py-1.5 rounded-xl">
                <span className="text-neutral-500 block text-[10px] uppercase font-bold">Episodes Seen</span>
                <span className="font-extrabold text-primary-theme text-sm">~{totalEpisodesWatched} ep</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Profile Sub-Navigation */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#131926] border border-neutral-800 w-fit">
        {[
          { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
          { id: 'dna', label: 'Anime DNA', icon: Dna },
          { id: 'collections', label: 'Collections', icon: Layers },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setProfileTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              profileTab === tab.id
                ? 'bg-primary-theme text-white shadow-lg'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area based on Active Tab */}
      {profileTab === 'watchlist' && (
        <div className="space-y-5 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-800">
            <div>
              <h3 className="font-heading font-black text-xl text-white flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-accent-theme" />
                <span>My Watchlist</span>
              </h3>
              <p className="text-xs text-neutral-400">
                Manage what you're watching, mark completed anime, and track your progress.
              </p>
            </div>

            {/* Search bar inside Watchlist */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in watchlist..."
                className="w-full bg-[#131926] border border-neutral-700 rounded-xl py-2 pl-3 pr-8 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-accent-theme"
              />
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

        {/* Watchlist Filter Status Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'active-tab-theme text-white'
                : 'bg-[#131926] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            All ({combinedList.length})
          </button>
          <button
            onClick={() => setFilterStatus('plan_to_watch')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'plan_to_watch'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'bg-[#131926] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Plan to Watch ({planToWatchCount})</span>
          </button>
          <button
            onClick={() => setFilterStatus('watched')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'watched'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-[#131926] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Watched / Completed ({watchedCount})</span>
          </button>
        </div>

        {/* Watchlist Items List */}
        {filteredList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredList.map(({ item, anime }) => {
              const isWatched = item.status === 'watched';
              return (
                <div
                  key={anime.id}
                  className="bg-[#131926] border border-neutral-800 hover:border-primary-theme rounded-2xl p-4 flex gap-4 transition-all duration-200 shadow-md group"
                >
                  {/* Poster Thumbnail */}
                  <div
                    onClick={() => onSelectAnime(anime)}
                    className="relative w-20 aspect-[3/4.2] rounded-xl overflow-hidden shrink-0 cursor-pointer shadow-md group-hover:scale-102 transition-transform"
                  >
                    <img
                      src={anime.poster || undefined}
                      alt={anime.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info & Controls */}
                  <div className="flex flex-col justify-between flex-grow min-w-0">
                    <div>
                      {/* Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        {isWatched ? (
                          <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Watched</span>
                          </span>
                        ) : (
                          <span className="bg-amber-950/80 text-amber-300 border border-amber-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Plan to Watch</span>
                          </span>
                        )}

                        <span className="text-[10px] text-neutral-500">
                          {anime.type} • {anime.releaseYear}
                        </span>
                      </div>

                      {/* Title */}
                      <h4
                        onClick={() => onSelectAnime(anime)}
                        className="font-bold text-sm text-white hover:text-accent-theme transition-colors cursor-pointer truncate"
                      >
                        {anime.title}
                      </h4>

                      {/* Dub tags */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(anime.dubs || []).map((d) => (
                          <span
                            key={d}
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#182032] text-neutral-300 border border-neutral-700/60"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-neutral-800/80 mt-2 text-xs">
                      {/* Toggle status button */}
                      <button
                        onClick={() => onToggleWatchedStatus(anime.id)}
                        className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isWatched
                            ? 'bg-neutral-800 text-neutral-300 hover:text-amber-300 hover:bg-neutral-700'
                            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/60'
                        }`}
                      >
                        {isWatched ? (
                          <>
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span className="text-[11px]">Move to Plan to Watch</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-[11px]">Mark as Watched</span>
                          </>
                        )}
                      </button>

                      {/* View & Remove */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectAnime(anime)}
                          className="text-[11px] text-accent-theme hover:brightness-110 font-medium cursor-pointer"
                        >
                          Details →
                        </button>
                        <button
                          onClick={() => onRemoveFromWatchlist(anime.id)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-purple-400 hover:bg-purple-950/30 transition-colors cursor-pointer"
                          title="Remove from Watchlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-[#131926]/40 border border-neutral-800 rounded-3xl p-8 max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-theme/10 border border-primary-theme/20 flex items-center justify-center mx-auto text-primary-theme">
              <Bookmark className="w-6 h-6 opacity-60" />
            </div>
            <h4 className="font-bold text-white text-base">
              {searchQuery ? 'No matching anime in watchlist' : 'Your watchlist is empty'}
            </h4>
            <p className="text-xs text-neutral-400">
              {searchQuery
                ? 'Try searching with another keyword.'
                : 'Browse the Dub Library or take the Recommendation Quiz to find your next anime!'}
            </p>
            {!searchQuery && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => onNavigateToTab('library')}
                  className="px-4 py-2 btn-primary-theme text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Browse Library
                </button>
                <button
                  onClick={() => onNavigateToTab('recommendations')}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Get Recommendations
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )}

    {/* Anime DNA Profile Tab */}
      {profileTab === 'dna' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="pb-6 mb-6 border-b border-neutral-800">
              <h3 className="font-heading font-black text-xl text-white flex items-center gap-2">
                <Dna className="w-5 h-5 text-emerald-400" />
                <span>Your Anime DNA</span>
              </h3>
              <p className="text-xs text-neutral-400">
                Deep analysis of your watching habits, studio preferences, and linguistic profile.
              </p>
           </div>
           <AnimeDNAProfile watchedAnime={combinedList.filter(l => l.item.status === 'watched').map(l => l.anime)} />
        </div>
      )}

      {/* Collections Management Tab */}
      {profileTab === 'collections' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
              <div>
                <h3 className="font-heading font-black text-xl text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary-theme" />
                  <span>Custom Collections</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Curate your own public lists and share them with the community.
                </p>
              </div>
              <button 
                onClick={() => {
                  toast.info('Feature Coming Soon', 'Custom collection creation is being finalized with Firestore sync.');
                }}
                className="flex items-center gap-2 px-4 py-2 btn-primary-theme text-white text-xs font-black rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New List</span>
              </button>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Sample Static List for UX Demo */}
              <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-5 space-y-4 hover:border-primary-theme/50 transition-colors group cursor-pointer">
                 <div className="aspect-[2/1] bg-neutral-900 rounded-2xl overflow-hidden flex gap-0.5">
                    {combinedList.slice(0, 3).map((l, i) => (
                      <img key={i} src={l.anime.poster || undefined} className="w-1/3 h-full object-cover opacity-60" />
                    ))}
                    {combinedList.length === 0 && <div className="w-full h-full flex items-center justify-center text-neutral-800 font-black text-2xl italic">EMPTY</div>}
                 </div>
                 <div className="space-y-1">
                    <h4 className="font-black text-white group-hover:text-primary-theme transition-colors">My Top 10 All-Time Favorites</h4>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{combinedList.length} Items • Public</p>
                 </div>
                 <div className="flex items-center justify-between pt-2 border-t border-neutral-800/50">
                    <div className="flex items-center gap-2">
                       <img src={globalAvatar || undefined} className="w-5 h-5 rounded-full border border-primary-theme/30" />
                       <span className="text-[10px] font-bold text-neutral-400">{globalNickname}</span>
                    </div>
                    <Share2 className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition-colors" />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
