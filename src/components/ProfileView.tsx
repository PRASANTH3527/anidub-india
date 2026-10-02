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
  ExternalLink 
} from 'lucide-react';
import { Anime, WatchlistItem, DubLanguage, UserProfile } from '../types/anime';

interface ProfileViewProps {
  allAnime: Anime[];
  watchlistItems: WatchlistItem[];
  onToggleWatchedStatus: (animeId: string) => void;
  onRemoveFromWatchlist: (animeId: string) => void;
  onSelectAnime: (anime: Anime) => void;
  onNavigateToTab: (tab: 'library' | 'recommendations') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  allAnime,
  watchlistItems,
  onToggleWatchedStatus,
  onRemoveFromWatchlist,
  onSelectAnime,
  onNavigateToTab,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'plan_to_watch' | 'watched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // User profile state stored in localStorage
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('anidub_user_profile');
      return saved ? JSON.parse(saved) : {
        username: 'Community Member',
        bio: 'Tracking regional Indian dubbed anime releases in Tamil, Telugu, Hindi, Malayalam, and Kannada!',
        favoriteLanguage: 'Tamil' as DubLanguage,
        avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80',
      };
    } catch {
      return {
        username: 'Community Member',
        bio: 'Tracking regional Indian dubbed anime releases!',
        favoriteLanguage: 'Tamil' as DubLanguage,
        avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80',
      };
    }
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(profile.username);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editLang, setEditLang] = useState<DubLanguage>(profile.favoriteLanguage);

  const saveProfile = () => {
    const updated: UserProfile = {
      ...profile,
      username: editName.trim() || 'AnimeOtaku_IN',
      bio: editBio.trim(),
      favoriteLanguage: editLang,
    };
    setProfile(updated);
    localStorage.setItem('anidub_user_profile', JSON.stringify(updated));
    setIsEditingProfile(false);
  };

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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Profile Header Card */}
      <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* Avatar */}
          <div className="relative group">
            <img
              src={profile.avatar}
              alt={profile.username}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-purple-500/50 shadow-xl"
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
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Bio</label>
                  <input
                    type="text"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
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
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
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
                    {profile.username}
                  </h2>
                  <span className="bg-purple-950/80 text-purple-300 border border-purple-800/40 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>{profile.favoriteLanguage} Dub Enthusiast</span>
                  </span>
                  <button
                    onClick={() => {
                      setEditName(profile.username);
                      setEditBio(profile.bio);
                      setEditLang(profile.favoriteLanguage);
                      setIsEditingProfile(true);
                    }}
                    className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="Edit Profile"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-neutral-400 max-w-xl">
                  {profile.bio}
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
                <span className="font-extrabold text-purple-300 text-sm">~{totalEpisodesWatched} ep</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist Section */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-800">
          <div>
            <h3 className="font-heading font-black text-xl text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-purple-400" />
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
              className="w-full bg-[#131926] border border-neutral-700 rounded-xl py-2 pl-3 pr-8 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
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
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
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
                  className="bg-[#131926] border border-neutral-800 hover:border-purple-500/40 rounded-2xl p-4 flex gap-4 transition-all duration-200 shadow-md group"
                >
                  {/* Poster Thumbnail */}
                  <div
                    onClick={() => onSelectAnime(anime)}
                    className="relative w-20 aspect-[3/4.2] rounded-xl overflow-hidden shrink-0 cursor-pointer shadow-md group-hover:scale-102 transition-transform"
                  >
                    <img
                      src={anime.poster}
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
                        className="font-bold text-sm text-white hover:text-purple-300 transition-colors cursor-pointer truncate"
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
                          className="text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                        >
                          Details →
                        </button>
                        <button
                          onClick={() => onRemoveFromWatchlist(anime.id)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
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
            <div className="w-12 h-12 rounded-2xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center mx-auto text-purple-400">
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
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

    </div>
  );
};
