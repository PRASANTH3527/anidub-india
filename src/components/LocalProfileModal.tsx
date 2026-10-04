'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
  User, 
  X, 
  Check, 
  Sparkles, 
  Zap, 
  Search, 
  Film, 
  Share2,
  Download,
  Upload,
  Languages,
  Database,
  Cloud,
  Lock,
  RefreshCw
} from 'lucide-react';
import { DubLanguage } from '../types/anime';
import { useToast } from './Toast';
import { ANIME_AVATARS_50, AnimeAvatarPreset } from '../data/animeAvatars50';
import { SupportedLanguage, getSavedUiLanguage, setSavedUiLanguage, translate } from '../utils/i18n';
import { cloudSyncService } from '../services/cloudSyncService';
import { useTheme, LocalUserProfile } from '../context/ThemeContext';

export type { LocalUserProfile };
export { ANIME_AVATARS_50, type AnimeAvatarPreset } from '../data/animeAvatars50';
export const ANIME_AVATAR_PRESETS = ANIME_AVATARS_50;

interface LocalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: LocalUserProfile;
  onSaveProfile: (profile: LocalUserProfile) => void;
  uiLanguage?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  onRestoreSuccess?: () => void;
}

const POPULAR_SERIES_FILTER = [
  'All (50)',
  'Naruto',
  'One Piece',
  'Demon Slayer',
  'Jujutsu Kaisen',
  'Bleach',
  'Attack on Titan',
  'My Hero Academia',
  'Hunter x Hunter',
];

const AvatarItem = React.memo(({ 
  preset, 
  isSelected, 
  onSelect 
}: { 
  preset: AnimeAvatarPreset; 
  isSelected: boolean; 
  onSelect: (url: string) => void;
}) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(preset.url)}
      title={`${preset.character} (${preset.series})`}
      className={`group relative flex flex-col items-center p-2 rounded-2xl transition-all cursor-pointer select-none active:scale-95 ${
        isSelected
          ? 'bg-[var(--primary-badge)]/40 border border-primary-theme shadow-lg shadow-primary-theme'
          : 'bg-[#131929]/70 hover:bg-[#1a2338] border border-neutral-800/80 hover:border-neutral-700'
      }`}
    >
      <div className="relative">
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-neutral-900 transition-all duration-200 ${
            isSelected
              ? 'ring-4 ring-accent-theme ring-offset-2 ring-offset-[#0a0e17] border-2 scale-105 shadow-md shadow-primary-theme'
              : 'border border-neutral-700/80 group-hover:scale-105'
          }`}
          style={{
            borderColor: isSelected ? 'var(--primary-accent)' : undefined,
          }}
        >
          <img
            src={preset.url}
            alt={preset.name}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
            decoding="async"
          />
        </div>

        {isSelected && (
          <div className="absolute -top-1 -right-1 w-5 h-5 btn-primary-theme rounded-full flex items-center justify-center border-2 border-[#0a0e17] shadow-md animate-in zoom-in-75 duration-150">
            <Check className="w-3 h-3 text-white stroke-[3]" />
          </div>
        )}

        {preset.isElectric && !isSelected && (
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow-md border border-neutral-900"
            title="Thunder / Lightning"
          >
            <Zap className="w-2.5 h-2.5 text-black fill-current" />
          </div>
        )}
      </div>

      <span
        className={`text-[10px] sm:text-[11px] font-bold text-center mt-1.5 truncate w-full tracking-tight ${
          isSelected
            ? 'text-primary-theme font-black'
            : 'text-neutral-300 group-hover:text-white'
        }`}
      >
        {preset.name}
      </span>
    </button>
  );
});

export const LocalProfileModal: React.FC<LocalProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSaveProfile,
  uiLanguage = getSavedUiLanguage(),
  onLanguageChange,
  onRestoreSuccess,
}) => {
  const toast = useToast();
  const uiLang = uiLanguage || getSavedUiLanguage();
  
  const { 
    theme: currentTheme, 
    themeId: globalThemeId, 
    setTheme: setGlobalTheme, 
    avatar: globalAvatar, 
    setAvatar: setGlobalAvatar, 
    updateUserProfile 
  } = useTheme();

  // Tab State
  const [activeModalTab, setActiveModalTab] = useState<'identity' | 'sync'>('identity');

  const [nickname, setNickname] = useState(currentProfile.nickname || 'Anime Fan');
  const [selectedAvatar, setSelectedAvatar] = useState(
    currentProfile.avatar || globalAvatar || ANIME_AVATARS_50[0].url
  );
  const [favLanguage, setFavLanguage] = useState<DubLanguage | 'All'>(
    currentProfile.favoriteLanguage || 'Tamil'
  );

  // Cloud Sync State
  const [cloudUsername, setCloudUsername] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Avatar search & series category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('All (50)');

  // Filtered avatars list
  const filteredAvatars = useMemo(() => {
    return ANIME_AVATARS_50.filter((item) => {
      // Category filter
      if (selectedSeries !== 'All (50)') {
        if (!item.series.toLowerCase().includes(selectedSeries.toLowerCase())) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchFull = item.character.toLowerCase().includes(q);
        const matchSeries = item.series.toLowerCase().includes(q);
        if (!matchName && !matchFull && !matchSeries) return false;
      }
      return true;
    });
  }, [searchQuery, selectedSeries]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Watchlist count for shareable profile stats
  const [watchlistCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('anidub_local_watchlist');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed.length;
        }
      } catch {}
    }
    return 0;
  });

  const handleCloudBackup = async () => {
    if (!cloudUsername || !cloudPassword) {
      toast.error('Missing Credentials', 'Please enter a username and password.');
      return;
    }
    setIsSyncing(true);
    const result = await cloudSyncService.backupToCloud(cloudUsername, cloudPassword);
    setIsSyncing(false);
    if (result.success) {
      toast.success('Cloud Backup Saved!', 'Your watchlist and profile are now synced to JSONBin.');
    } else {
      toast.error('Backup Failed', result.error || 'Check your credentials.');
    }
  };

  const handleCloudRestore = async () => {
    if (!cloudUsername || !cloudPassword) {
      toast.error('Missing Credentials', 'Please enter your username and password.');
      return;
    }
    setIsSyncing(true);
    const result = await cloudSyncService.restoreFromCloud(cloudUsername, cloudPassword);
    setIsSyncing(false);
    if (result.success) {
      toast.success('Profile Restored!', 'Data successfully fetched from cloud. Refreshing...');
      onRestoreSuccess?.();
    } else {
      toast.error('Restore Failed', result.error || 'User not found or wrong password.');
    }
  };

  const handleExportData = () => {
    try {
      const cleanNick = nickname.trim() || 'Anime Fan';
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        appName: 'AniDub India',
        profile: {
          nickname: cleanNick,
          avatar: selectedAvatar,
          favoriteLanguage: favLanguage,
        },
        watchlist: JSON.parse(localStorage.getItem('anidub_local_watchlist') || '[]'),
        upvotes: JSON.parse(localStorage.getItem('anidub_upvoted_anime_ids') || '[]'),
        recentlyViewed: JSON.parse(localStorage.getItem('anidub_recently_viewed') || '[]'),
        uiLanguage: localStorage.getItem('anidub_ui_lang') || 'en',
      };

      const jsonBlob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(jsonBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `anidub-backup-${cleanNick.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        translate('exportSuccess', uiLang),
        'Profile, watchlist, DP & theme saved to your device.'
      );
    } catch {
      toast.info('Export Failed', 'Could not generate backup file.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (!data || typeof data !== 'object') {
          throw new Error('Invalid JSON format');
        }

        // Restore watchlist if present
        if (Array.isArray(data.watchlist)) {
          localStorage.setItem('anidub_local_watchlist', JSON.stringify(data.watchlist));
        }

        // Restore upvotes if present
        if (Array.isArray(data.upvotes)) {
          localStorage.setItem('anidub_upvoted_anime_ids', JSON.stringify(data.upvotes));
        }

        // Restore recently viewed
        if (Array.isArray(data.recentlyViewed)) {
          localStorage.setItem('anidub_recently_viewed', JSON.stringify(data.recentlyViewed));
        }

        // Restore UI Language
        if (data.uiLanguage && (data.uiLanguage === 'en' || data.uiLanguage === 'ta')) {
          setSavedUiLanguage(data.uiLanguage);
          onLanguageChange?.(data.uiLanguage);
        }

        // Restore Profile
        if (data.profile) {
          if (data.profile.nickname) setNickname(data.profile.nickname);
          if (data.profile.avatar) setSelectedAvatar(data.profile.avatar);
          if (data.profile.favoriteLanguage) setFavLanguage(data.profile.favoriteLanguage);
          const restoredProfile: LocalUserProfile = {
            nickname: data.profile.nickname || 'Anime Fan',
            avatar: data.profile.avatar || selectedAvatar,
            favoriteLanguage: data.profile.favoriteLanguage || 'Tamil',
          };
          onSaveProfile(restoredProfile);
        }

        toast.success(
          translate('importSuccess', uiLang),
          'Restored all watchlist items, custom DP avatar, and theme!'
        );

        onRestoreSuccess?.();
      } catch {
        toast.info(
          translate('importInvalid', uiLang),
          'Please ensure this is an uncorrupted AniDub backup .json file.'
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const currentSelectedPreset =
    ANIME_AVATARS_50.find((p) => p.url === selectedAvatar) || ANIME_AVATARS_50[0];

  const handleShareProfile = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://anidub-india.web.app';
    const charName = currentSelectedPreset.character || currentSelectedPreset.name;
    const cleanNick = nickname.trim() || 'Anime Fan';
    const shareText = `Check out my Otaku Profile on AniDub India! 🎌\nAvatar: ${charName} (${currentSelectedPreset.series})\nWatchlist: ${watchlistCount} anime saved\nFavorite Dubs: ${favLanguage}\nJoin me at ${origin}`;

    if (navigator.share && navigator.canShare && navigator.canShare({ text: shareText })) {
      try {
        await navigator.share({
          title: `${cleanNick}'s Otaku Profile — AniDub India`,
          text: shareText,
          url: origin,
        });
        toast.success('Profile Shared!', 'Shared your AniDub profile successfully.');
      } catch (err) {
        // User dismissed share dialog
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Profile Stats Copied!', 'Copied to clipboard. Share your Otaku stats anywhere!');
      } catch {
        toast.info('Otaku Profile Stats', shareText);
      }
    } else {
      toast.info('Otaku Profile Stats', shareText);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nickname.trim() || 'Anime Fan';

    setGlobalAvatar(selectedAvatar);

    const updated: LocalUserProfile = {
      nickname: cleanNick,
      avatar: selectedAvatar,
      favoriteLanguage: favLanguage,
    };

    updateUserProfile(updated);
    onSaveProfile(updated);
    toast.success('Profile Saved!', `Welcome, ${cleanNick}! Set to ${currentSelectedPreset.name}.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-2xl bg-[#121829] border border-primary-theme rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200"
        style={{
          boxShadow: `0 20px 50px -10px var(--primary-glow)`,
        }}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl btn-primary-theme flex items-center justify-center text-white shadow-lg shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-white text-base sm:text-lg flex items-center gap-1.5">
                {translate('profileModalTitle', uiLang)}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full badge-primary-theme">
                  50 Top Characters
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                {translate('profileModalSubtitle', uiLang)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#0a0e17] border-b border-neutral-800">
          <button
            onClick={() => setActiveModalTab('identity')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeModalTab === 'identity'
                ? 'active-tab-theme text-white'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{translate('identityTabTitle', uiLang)}</span>
          </button>
          <button
            onClick={() => setActiveModalTab('sync')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeModalTab === 'sync'
                ? 'active-tab-theme text-white'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>{translate('cloudTabTitle', uiLang)}</span>
          </button>
        </div>

        {activeModalTab === 'identity' ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-3">
            
            {/* Active DP Preview Card */}
            <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#0c101a] border border-neutral-800/90 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div 
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 shadow-xl bg-neutral-900 shrink-0 transition-transform duration-300"
                    style={{
                      borderColor: 'var(--primary-accent)',
                      boxShadow: `0 0 16px var(--primary-glow)`,
                    }}
                  >
                    <img
                      src={selectedAvatar}
                      alt={currentSelectedPreset.name}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  {currentSelectedPreset.isElectric && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border border-black animate-pulse" title="Thunder Style Character">
                      <Zap className="w-3 h-3 text-black fill-current" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent-theme">
                    Selected Character DP
                  </span>
                  <h4 className="font-heading font-black text-sm sm:text-base text-white">
                    {currentSelectedPreset.character}
                  </h4>
                  <span className="text-xs text-neutral-400 font-medium">
                    {currentSelectedPreset.series}
                  </span>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl badge-primary-theme text-[11px] font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
                <span>Instant Navbar Sync</span>
              </div>
            </div>

            {/* Avatar Gallery Controls: Search & Category Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Select From 50 Top Anime Avatars</span>
                </label>
                <span className="text-[11px] text-neutral-400 font-medium">
                  Showing <strong className="text-white">{filteredAvatars.length}</strong> of 50
                </span>
              </div>

              {/* Quick Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search characters (e.g., Zenitsu, Gojo, Luffy, Levi, Zoro, Deku)..."
                  className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Anime Series Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none text-[11px]">
                {POPULAR_SERIES_FILTER.map((series) => {
                  const isSelected = selectedSeries === series;
                  return (
                    <button
                      type="button"
                      key={series}
                      onClick={() => setSelectedSeries(series)}
                      className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                        isSelected
                          ? 'active-tab-theme text-white'
                          : 'bg-[#151c2e] text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                      }`}
                    >
                      {series}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Highly Optimized, Beautifully Scrollable 50 Avatars Grid */}
            <div className="relative rounded-2xl bg-[#0a0e17] border border-neutral-800/90 p-2 sm:p-3">
              <div className="max-h-64 sm:max-h-72 overflow-y-auto pr-1.5 space-y-2 scrollbar-thin">
                {filteredAvatars.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-2.5">
                    {filteredAvatars.map((preset) => (
                      <AvatarItem
                        key={preset.id}
                        preset={preset}
                        isSelected={selectedAvatar === preset.url}
                        onSelect={(url) => {
                          setSelectedAvatar(url);
                          setGlobalAvatar(url);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-neutral-400 space-y-2">
                    <p className="text-xs">No anime character matched "{searchQuery}"</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSeries('All (50)');
                      }}
                      className="text-xs text-accent-theme hover:underline font-bold"
                    >
                      Reset Search Filter
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Nickname & Language Configuration Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Nickname Input */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Your Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. ZenitsuFan, GojoDomain, DubOtaku..."
                  maxLength={24}
                  required
                  className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-colors"
                />
              </div>

              {/* Favorite Dub Language */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Favorite Dub Language
                </label>
                <select
                  value={favLanguage}
                  onChange={(e) => setFavLanguage(e.target.value as any)}
                  className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-2xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-white outline-none cursor-pointer"
                >
                  <option value="Tamil" className="bg-[#121829]">Tamil Dubs (தமிழ்)</option>
                  <option value="Telugu" className="bg-[#121829]">Telugu Dubs (తెలుగు)</option>
                  <option value="Hindi" className="bg-[#121829]">Hindi Dubs (हिंदी)</option>
                  <option value="Malayalam" className="bg-[#121829]">Malayalam Dubs (മലയാളം)</option>
                  <option value="Kannada" className="bg-[#121829]">Kannada Dubs (ಕನ್ನಡ)</option>
                  <option value="All" className="bg-[#121829]">All Indian Regional Dubs</option>
                </select>
              </div>
            </div>

            {/* Hidden File Input for Data Restore */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json,application/json"
              className="hidden"
            />

            {/* Profile Backup & Restore Box */}
            <div className="p-3.5 rounded-2xl bg-[#0d121f] border border-neutral-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div>
                  <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-accent-theme" />
                    <span>{translate('backupSectionTitle', uiLang)}</span>
                  </h4>
                  <p className="text-[10px] text-neutral-400">
                    {translate('backupSectionSubtitle', uiLang)}
                  </p>
                </div>

                {/* Language Switcher in Profile */}
                <div className="flex items-center gap-1 shrink-0 self-start sm:self-auto">
                  <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1 mr-1">
                    <Languages className="w-3 h-3 text-accent-theme" />
                    <span>UI:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = uiLang === 'en' ? 'ta' : 'en';
                      setSavedUiLanguage(next);
                      onLanguageChange?.(next);
                    }}
                    className="px-2 py-1 rounded-lg bg-[#141b2c] hover:bg-[#1e273f] text-neutral-200 hover:text-white border border-neutral-700 text-[10px] font-bold transition-all cursor-pointer"
                  >
                    {uiLang === 'en' ? '🇮🇳 தமிழ்' : '🇬🇧 English'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExportData}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl badge-primary-theme hover:brightness-110 active:scale-95 text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-accent-theme" />
                  <span>{translate('exportBackupBtn', uiLang)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#141b2c] hover:bg-[#1c253d] active:scale-95 text-neutral-200 hover:text-white border border-neutral-700/80 text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{translate('importBackupBtn', uiLang)}</span>
                </button>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-3 border-t border-neutral-800">
              {/* Share My Profile Button */}
              <button
                type="button"
                onClick={handleShareProfile}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl badge-primary-theme hover:brightness-110 active:scale-95 text-xs font-bold transition-all cursor-pointer shadow-sm"
                title="Share your Otaku profile & stats"
              >
                <Share2 className="w-3.5 h-3.5 text-accent-theme" />
                <span>{translate('shareProfile', uiLang)}</span>
              </button>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {translate('cancel', uiLang)}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl btn-primary-theme active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{translate('saveProfile', uiLang)}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-5 py-6">
            <div className="p-4 rounded-3xl bg-[#0d121f] border border-neutral-800 space-y-4 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl badge-primary-theme flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-accent-theme" />
                </div>
                <div>
                  <h4 className="font-heading font-black text-white text-lg">{translate('cloudTabTitle', uiLang)}</h4>
                  <p className="text-xs text-neutral-400">{translate('cloudSyncSubtitle', uiLang)}</p>
                </div>
              </div>

              <div className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">
                    {translate('cloudUsername', uiLang)}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      value={cloudUsername}
                      onChange={(e) => setCloudUsername(e.target.value)}
                      placeholder="Enter a unique username..."
                      className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-neutral-600 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">
                    {translate('cloudPassword', uiLang)}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="password"
                      value={cloudPassword}
                      onChange={(e) => setCloudPassword(e.target.value)}
                      placeholder="Secret password..."
                      className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-neutral-600 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleCloudBackup}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl btn-primary-theme disabled:opacity-50 text-white text-sm font-black transition-all active:scale-95 cursor-pointer"
                >
                  {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  <span>{translate('cloudBackupBtn', uiLang)}</span>
                </button>
                <button
                  onClick={handleCloudRestore}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#141b2c] border border-neutral-800 hover:bg-[#1c253d] disabled:opacity-50 text-neutral-200 text-sm font-black transition-all active:scale-95 cursor-pointer"
                >
                  {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{translate('cloudRestoreBtn', uiLang)}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl badge-primary-theme text-center">
                <p className="text-[10px] font-bold text-primary-theme leading-relaxed uppercase tracking-tighter">
                  {translate('cloudSafeNote', uiLang)}
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={onClose}
                className="px-8 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {translate('cancel', uiLang)}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
