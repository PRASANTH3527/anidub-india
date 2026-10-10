'use client';

import React, { useState } from 'react';
import { 
  Compass, 
  Search, 
  Sparkles, 
  Bookmark, 
  Calendar, 
  User, 
  Sun, 
  Moon, 
  Languages, 
  BarChart3, 
  Trophy, 
  Cloud,
  X
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { PrimarySearchBar } from './PrimarySearchBar';
import { authService } from '../services/authService';
import { LocalUserProfile, ANIME_AVATAR_PRESETS } from './LocalProfileModal';
import { SupportedLanguage, translate } from '../utils/i18n';
import { useTheme } from '../context/ThemeContext';
import { AnimeRecord } from '../types/database';

export type NavTab = 'library' | 'foryou' | 'watchlist' | 'schedule' | 'recommendations' | 'profile' | 'analytics' | 'tierlist';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  watchlistCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSuggestModal: () => void;
  onOpenAuthModal: () => void;
  onSecretTrigger: () => void;
  localProfile?: LocalUserProfile;
  onOpenProfileModal?: () => void;
  uiLanguage?: SupportedLanguage;
  onToggleLanguage?: () => void;
  isAdmin?: boolean;
  onOpenDeviceSync?: () => void;
  // Primary Search & Feed Integration
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  allAnime?: AnimeRecord[];
  onSelectAnime?: (anime: AnimeRecord) => void;
  feedView?: 'directory' | 'foryou';
  setFeedView?: (view: 'directory' | 'foryou') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  theme,
  onToggleTheme,
  onOpenSuggestModal,
  onOpenAuthModal,
  onSecretTrigger,
  localProfile = {
    nickname: 'Anime Fan',
    avatar: ANIME_AVATAR_PRESETS[0].url,
    favoriteLanguage: 'Tamil',
  },
  onOpenProfileModal,
  uiLanguage = 'en',
  onToggleLanguage,
  isAdmin = false,
  onOpenDeviceSync,
  searchQuery = '',
  setSearchQuery = () => {},
  allAnime = [],
  onSelectAnime,
  feedView = 'directory',
  setFeedView,
}) => {
  const { avatar: globalAvatar } = useTheme();
  const currentUser = authService.getCurrentUser();
  const tapHistoryRef = React.useRef<number[]>([]);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

  const handleLogoClick = () => {
    const now = Date.now();
    tapHistoryRef.current = [...tapHistoryRef.current.filter((t) => now - t < 2500), now];
    if (tapHistoryRef.current.length >= 5) {
      tapHistoryRef.current = [];
      onSecretTrigger();
    }
    if (setFeedView) setFeedView('directory');
    setActiveTab('library');
    window.location.hash = 'library';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchIconClick = () => {
    // If mobile, toggle inline search bar dropdown in header
    setIsMobileSearchExpanded((prev) => !prev);
    // If on another tab, return to library to show search results
    if (activeTab !== 'library') {
      if (setFeedView) setFeedView('directory');
      setActiveTab('library');
      window.location.hash = 'library';
    }
  };

  const activeAvatar = globalAvatar || localProfile?.avatar;
  const isDirectoryActive = activeTab === 'library' && feedView !== 'foryou';
  const isForYouActive = activeTab === 'foryou' || (activeTab === 'library' && feedView === 'foryou');

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-[#0b0f17]/95 backdrop-blur-xl border-b border-neutral-800/80 transition-colors box-border select-none">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-4 box-border min-w-0">
        
        {/* 1. Official Brand Logo (Left) */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center cursor-pointer group select-none shrink-0 active:scale-[0.97] transition-transform"
          title={translate('stealthHint', uiLanguage)}
        >
          <BrandLogo size="md" variant={theme === 'dark' ? 'dark' : 'light'} />
        </div>

        {/* 2. Top Navigation Tabs: Clean Icon-Only Design (Zero Text Labels, No Wrapping) */}
        <nav 
          aria-label="Main Navigation"
          className="flex items-center justify-center gap-1 sm:gap-2 flex-1 mx-1 sm:mx-3 min-w-0"
        >
          {/* Compass / Directory */}
          <button
            type="button"
            onClick={() => {
              if (setFeedView) setFeedView('directory');
              setActiveTab('library');
              window.location.hash = 'library';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              isDirectoryActive
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navDirectory', uiLanguage)}
            aria-label="Directory"
          >
            <Compass className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${isDirectoryActive ? 'scale-110 text-accent-theme' : ''}`} />
          </button>

          {/* Quick Search Trigger */}
          <button
            type="button"
            onClick={handleSearchIconClick}
            className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              isMobileSearchExpanded || (searchQuery && searchQuery.trim() !== '')
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title="Search Anime"
            aria-label="Search"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* For You / Recommendations */}
          <button
            type="button"
            onClick={() => {
              if (setFeedView) setFeedView('foryou');
              setActiveTab('foryou');
              window.location.hash = 'foryou';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              isForYouActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navForYou', uiLanguage)}
            aria-label="For You"
          >
            <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${isForYouActive ? 'scale-110 text-amber-400' : ''}`} />
          </button>

          {/* Watchlist with Count Badge */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('watchlist');
              window.location.hash = 'watchlist';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`relative w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              activeTab === 'watchlist'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navWatchlist', uiLanguage)}
            aria-label="Watchlist"
          >
            <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${activeTab === 'watchlist' ? 'scale-110 fill-current' : ''}`} />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 btn-primary-theme text-white text-[9px] font-black rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 border border-[#0b0f17] shadow-sm leading-none">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* Schedule */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('schedule');
              window.location.hash = 'schedule';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              activeTab === 'schedule'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title="Dub Release Schedule"
            aria-label="Schedule"
          >
            <Calendar className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${activeTab === 'schedule' ? 'scale-110' : ''}`} />
          </button>

          {/* Profile & Avatar */}
          <button
            type="button"
            onClick={() => {
              if (onOpenProfileModal) {
                onOpenProfileModal();
              } else {
                setActiveTab('profile');
              }
            }}
            className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navProfile', uiLanguage)}
            aria-label="Profile"
          >
            {activeAvatar ? (
              <div 
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border shadow-sm shrink-0"
                style={{
                  borderColor: activeTab === 'profile' ? 'var(--primary-accent)' : 'rgba(255,255,255,0.2)',
                }}
              >
                <img src={activeAvatar} alt="Profile" className="w-full h-full object-cover object-top" />
              </div>
            ) : (
              <User className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${activeTab === 'profile' ? 'scale-110' : ''}`} />
            )}
          </button>

          {/* Desktop-only Tier List Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('tierlist');
              window.location.hash = 'tierlist';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`hidden lg:flex w-9 h-9 items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              activeTab === 'tierlist'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title="Tier List Maker"
            aria-label="Tier List"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
          </button>

          {/* Admin Analytics Tab */}
          {(isAdmin || currentUser?.email === 'prasanth01236@gmail.com') && (
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`hidden md:flex w-9 h-9 items-center justify-center rounded-xl transition-all cursor-pointer shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
              title="View Platform Analytics"
              aria-label="Analytics"
            >
              <BarChart3 className="w-4 h-4 text-accent-theme" />
            </button>
          )}
        </nav>

        {/* Desktop Search Bar (Expandable on Large Screens) */}
        <div className="hidden xl:flex flex-grow max-w-xs 2xl:max-w-sm mx-2 shrink min-w-0">
          <PrimarySearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            allAnime={allAnime}
            onSelectAnime={onSelectAnime}
            uiLanguage={uiLanguage}
          />
        </div>

        {/* 3. Right Utility Actions (Sync, Language Switcher, Theme Toggle) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Cloud Sync Button */}
          {onOpenDeviceSync && (
            <button
              type="button"
              onClick={onOpenDeviceSync}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl btn-primary-theme text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md shrink-0"
              title="Anonymous Device Sync via 6-digit code"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sync</span>
            </button>
          )}

          {/* Bilingual Switcher (EN / தமிழ்) */}
          {onToggleLanguage && (
            <button
              type="button"
              onClick={onToggleLanguage}
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-xl bg-neutral-800/70 hover:bg-neutral-700/80 active:scale-95 border border-neutral-700/40 text-[10px] sm:text-xs font-black text-neutral-300 hover:text-white transition-all cursor-pointer shrink-0"
              title="Switch Language"
            >
              <Languages className="w-3.5 h-3.5 text-accent-theme" />
              <span>{uiLanguage === 'en' ? 'தமிழ்' : 'EN'}</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/70 hover:bg-neutral-700/80 active:scale-90 border border-neutral-700/40 text-neutral-400 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
            title="Toggle Theme"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-theme" />
            )}
          </button>
        </div>

      </div>

      {/* Expandable Search Drawer for Mobile / Quick Search */}
      {isMobileSearchExpanded && (
        <div className="w-full px-3 py-2 border-t border-neutral-800/60 bg-[#0d121e]/98 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150 box-border">
          <div className="flex-1 min-w-0">
            <PrimarySearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              allAnime={allAnime}
              onSelectAnime={(anime) => {
                if (onSelectAnime) onSelectAnime(anime);
                setIsMobileSearchExpanded(false);
              }}
              uiLanguage={uiLanguage}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSearchExpanded(false)}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Close Search"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
