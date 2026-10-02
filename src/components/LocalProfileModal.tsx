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
  Flame, 
  Share2,
  Download,
  Upload,
  Languages,
  Database
} from 'lucide-react';
import { DubLanguage } from '../types/anime';
import { useToast } from './Toast';
import { ANIME_AVATARS_50, AnimeAvatarPreset } from '../data/animeAvatars50';
import { ANIME_THEMES, applyAnimeTheme, getSavedAnimeTheme, AnimeTheme } from '../utils/theme';
import { SupportedLanguage, getSavedUiLanguage, setSavedUiLanguage, translate } from '../utils/i18n';

export { ANIME_AVATARS_50, type AnimeAvatarPreset };
export const ANIME_AVATAR_PRESETS = ANIME_AVATARS_50;

export interface LocalUserProfile {
  nickname: string;
  avatar: string;
  favoriteLanguage?: DubLanguage | 'All';
  theme?: string;
}

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
  const [nickname, setNickname] = useState(currentProfile.nickname || 'Anime Fan');
  const [selectedAvatar, setSelectedAvatar] = useState(
    currentProfile.avatar || ANIME_AVATARS_50[0].url
  );
  const [favLanguage, setFavLanguage] = useState<DubLanguage | 'All'>(
    currentProfile.favoriteLanguage || 'Tamil'
  );
  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    return currentProfile.theme || getSavedAnimeTheme().id;
  });

  const handleSelectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);
    const theme = applyAnimeTheme(themeId);
    toast.info('Theme Preview', `Accent theme switched to ${theme.name}`);
  };

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
          theme: selectedThemeId,
        },
        watchlist: JSON.parse(localStorage.getItem('anidub_local_watchlist') || '[]'),
        upvotes: JSON.parse(localStorage.getItem('anidub_upvoted_anime_ids') || '[]'),
        recentlyViewed: JSON.parse(localStorage.getItem('anidub_recently_viewed') || '[]'),
        theme: localStorage.getItem('anidub_accent_theme') || selectedThemeId,
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

        // Restore theme
        if (data.theme) {
          localStorage.setItem('anidub_accent_theme', data.theme);
          setSelectedThemeId(data.theme);
          applyAnimeTheme(data.theme);
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
          if (data.profile.theme) {
            setSelectedThemeId(data.profile.theme);
            applyAnimeTheme(data.profile.theme);
          }
          const restoredProfile: LocalUserProfile = {
            nickname: data.profile.nickname || 'Anime Fan',
            avatar: data.profile.avatar || selectedAvatar,
            favoriteLanguage: data.profile.favoriteLanguage || 'Tamil',
            theme: data.profile.theme || selectedThemeId,
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

    applyAnimeTheme(selectedThemeId);

    const updated: LocalUserProfile = {
      nickname: cleanNick,
      avatar: selectedAvatar,
      favoriteLanguage: favLanguage,
      theme: selectedThemeId,
    };

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
      <div className="relative w-full max-w-2xl bg-[#121829] border border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-white text-base sm:text-lg flex items-center gap-1.5">
                {translate('profileModalTitle', uiLang)}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-300">
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

        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          
          {/* Active DP Preview Card */}
          <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#0c101a] border border-neutral-800/90 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-purple-500 ring-4 ring-purple-500/30 shadow-xl bg-neutral-900 shrink-0 transition-transform duration-300">
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
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

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-800/50 text-[11px] text-purple-200 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
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
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-purple-500 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
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
                        ? 'bg-purple-600 text-white shadow-sm'
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
            <div className="max-h-64 sm:max-h-72 overflow-y-auto pr-1.5 space-y-2 scrollbar-thin scrollbar-thumb-purple-600/50 scrollbar-track-neutral-900/60 hover:scrollbar-thumb-purple-500">
              {filteredAvatars.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-2.5">
                  {filteredAvatars.map((preset) => {
                    const isSelected = selectedAvatar === preset.url;

                    return (
                      <button
                        type="button"
                        key={preset.id}
                        onClick={() => setSelectedAvatar(preset.url)}
                        title={`${preset.character} (${preset.series})`}
                        className={`group relative flex flex-col items-center p-2 rounded-2xl transition-all cursor-pointer select-none active:scale-95 ${
                          isSelected
                            ? 'bg-purple-950/80 border border-purple-500/80 shadow-lg shadow-purple-950/60'
                            : 'bg-[#131929]/70 hover:bg-[#1a2338] border border-neutral-800/80 hover:border-neutral-700'
                        }`}
                      >
                        {/* Circular Image Frame with Ring Highlight Animation */}
                        <div className="relative">
                          <div
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-neutral-900 transition-all duration-200 ${
                              isSelected
                                ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-[#0a0e17] border-2 border-purple-300 scale-105 shadow-md shadow-purple-600/40 animate-pulse'
                                : 'border border-neutral-700/80 group-hover:border-purple-400/60 group-hover:scale-105'
                            }`}
                          >
                            <img
                              src={preset.url}
                              alt={preset.name}
                              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-110"
                              loading="lazy"
                            />
                          </div>

                          {/* Selected Checkmark Badge */}
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full flex items-center justify-center border-2 border-[#0a0e17] shadow-md animate-in zoom-in-75 duration-150">
                              <Check className="w-3 h-3 text-white stroke-[3]" />
                            </div>
                          )}

                          {/* Electric Lightning Indicator for Zenitsu / Killua */}
                          {preset.isElectric && !isSelected && (
                            <div
                              className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow-md border border-neutral-900"
                              title="Thunder / Lightning"
                            >
                              <Zap className="w-2.5 h-2.5 text-black fill-current" />
                            </div>
                          )}
                        </div>

                        {/* Name label */}
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold text-center mt-1.5 truncate w-full tracking-tight ${
                            isSelected
                              ? 'text-purple-200 font-black'
                              : 'text-neutral-300 group-hover:text-white'
                          }`}
                        >
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
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
                    className="text-xs text-purple-400 hover:text-purple-300 font-bold"
                  >
                    Reset Search Filter
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Anime Accent Theme Selector */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
                <span>Primary Accent Theme</span>
              </label>
              <span className="text-[11px] text-neutral-400 font-medium">
                Applied instantly across app
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ANIME_THEMES.map((theme) => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <button
                    type="button"
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all cursor-pointer select-none active:scale-95 ${
                      isSelected
                        ? 'bg-[#1a2035] border-2 shadow-md'
                        : 'bg-[#0d121f] border border-neutral-800 hover:border-neutral-700'
                    }`}
                    style={{
                      borderColor: isSelected ? theme.primary : undefined,
                      boxShadow: isSelected ? `0 0 14px ${theme.glow}` : undefined,
                    }}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: theme.previewColor }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-neutral-300'}`}>
                        {theme.name.split(' (')[0]}
                      </span>
                      <span className="text-[9px] text-neutral-500 truncate">
                        {theme.character}
                      </span>
                    </div>
                  </button>
                );
              })}
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
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-purple-500 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-colors"
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
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-purple-500 rounded-2xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-white outline-none cursor-pointer"
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
                  <Languages className="w-3 h-3 text-purple-400" />
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
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 active:scale-95 text-purple-200 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
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
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 active:scale-95 text-purple-300 hover:text-white border border-purple-600/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Share your Otaku profile & stats"
            >
              <Share2 className="w-3.5 h-3.5 text-purple-400" />
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
                <span>{translate('saveProfileAndTheme', uiLang)}</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
