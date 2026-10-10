'use client';

import React from 'react';
import { 
  Bookmark, 
  Sparkles, 
  Compass, 
  Calendar, 
  User, 
  Sun, 
  Moon, 
  Languages, 
  BarChart3, 
  Trophy, 
  Cloud 
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

  const activeAvatar = globalAvatar || localProfile?.avatar;
  const isDirectoryActive = activeTab === 'library' && feedView !== 'foryou';
  const isForYouActive = activeTab === 'foryou' || (activeTab === 'library' && feedView === 'foryou');

  // Friendly short labels for mobile buttons to ensure zero truncation across all device widths
  const directoryLabel = uiLanguage === 'ta' ? 'முகப்பு' : 'Directory';
  const forYouLabel = uiLanguage === 'ta' ? 'தேர்வுகள்' : 'For You';
  const watchlistLabel = uiLanguage === 'ta' ? 'பட்டியல்' : 'Watchlist';
  const scheduleLabel = uiLanguage === 'ta' ? 'அட்டவணை' : 'Schedule';

  return (
    <header className="sticky top-0 z-40 w-full max-w-full overflow-hidden bg-[#0b0f17]/95 backdrop-blur-xl border-b border-neutral-800/80 transition-colors box-border select-none">
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3 box-border flex flex-col gap-2 sm:gap-2.5 overflow-hidden">
        
        {/* ROW 1 (Desktop: Brand + Nav Links + Search + Utilities | Mobile: Brand on Left + Utilities & Profile on Right) */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-4 w-full box-border min-w-0">
          
          {/* Brand Logo & Desktop Nav Links */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-5 shrink-0 min-w-0">
            {/* Brand Logo with Stealth Admin Easter Egg */}
            <div 
              onClick={handleLogoClick}
              className="flex items-center cursor-pointer group select-none shrink-0 active:scale-[0.97] transition-transform"
              title={translate('stealthHint', uiLanguage)}
            >
              <BrandLogo size="md" variant={theme === 'dark' ? 'dark' : 'light'} />
            </div>

            {/* Desktop-Only Primary Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1.5 shrink-0">
              {/* 1. Directory Tab */}
              <button
                type="button"
                onClick={() => {
                  if (setFeedView) setFeedView('directory');
                  setActiveTab('library');
                  window.location.hash = 'library';
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isDirectoryActive
                    ? 'btn-primary-theme shadow-md text-white'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/70'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>{translate('navDirectory', uiLanguage)}</span>
              </button>

              {/* 2. For You Tab */}
              <button
                type="button"
                onClick={() => {
                  if (setFeedView) setFeedView('foryou');
                  setActiveTab('foryou');
                  window.location.hash = 'foryou';
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isForYouActive
                    ? 'bg-amber-500 text-black shadow-md font-black'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/70'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{translate('navForYou', uiLanguage)}</span>
              </button>

              {/* 3. My Watchlist Tab */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('watchlist');
                  window.location.hash = 'watchlist';
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'watchlist'
                    ? 'btn-primary-theme shadow-md text-white'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/70'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${activeTab === 'watchlist' ? 'fill-current' : ''}`} />
                <span>{translate('navWatchlist', uiLanguage)}</span>
                {watchlistCount > 0 && (
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-[var(--primary-badge)] text-white border border-primary-theme/40 shadow-sm">
                    {watchlistCount}
                  </span>
                )}
              </button>

              {/* 4. Schedule Tab */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('schedule');
                  window.location.hash = 'schedule';
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'schedule'
                    ? 'btn-primary-theme shadow-md text-white'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/70'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Schedule</span>
              </button>

              {/* 5. Tier List Tab */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tierlist');
                  window.location.hash = 'tierlist';
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'tierlist'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/70'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Tier List</span>
              </button>

              {/* Admin Analytics Tab */}
              {(isAdmin || currentUser?.email === 'prasanth01236@gmail.com') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                    activeTab === 'analytics'
                      ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                  title="View Platform Analytics"
                >
                  <BarChart3 className="w-4 h-4 text-accent-theme" />
                </button>
              )}
            </nav>
          </div>

          {/* Desktop Search Bar (Centered in Row 1 on md: screens) */}
          <div className="hidden md:flex flex-grow max-w-sm lg:max-w-md xl:max-w-lg mx-2 lg:mx-4 min-w-0">
            <PrimarySearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              allAnime={allAnime}
              onSelectAnime={onSelectAnime}
              uiLanguage={uiLanguage}
            />
          </div>

          {/* Right Utility Tools (Profile, Sync, Lang, Theme) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Cloud Sync Button */}
            {onOpenDeviceSync && (
              <button
                type="button"
                onClick={onOpenDeviceSync}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl btn-primary-theme text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md shrink-0"
                title="Anonymous Device Sync via 6-digit code"
              >
                <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Sync</span>
              </button>
            )}

            {/* Language Switcher */}
            {onToggleLanguage && (
              <button
                type="button"
                onClick={onToggleLanguage}
                className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-neutral-800/70 hover:bg-neutral-700/80 active:scale-95 border border-neutral-700/40 text-[10px] sm:text-xs font-black text-neutral-300 hover:text-white transition-all cursor-pointer shrink-0"
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
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-accent-theme" />
              )}
            </button>

            {/* User Profile Button */}
            <button
              type="button"
              onClick={() => {
                if (onOpenProfileModal) {
                  onOpenProfileModal();
                } else {
                  setActiveTab('profile');
                }
              }}
              className={`flex items-center gap-1.5 p-1 sm:p-1.5 pl-1.5 pr-2 sm:pr-3 rounded-xl transition-all cursor-pointer shrink-0 border ${
                activeTab === 'profile'
                  ? 'bg-[var(--primary-accent)]/20 text-accent-theme border-primary-theme shadow-sm'
                  : 'bg-neutral-800/70 border-neutral-700/40 text-neutral-300 hover:text-white hover:bg-neutral-700/80'
              }`}
              title={translate('navProfile', uiLanguage)}
            >
              {activeAvatar ? (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border border-primary-theme/50 shrink-0">
                  <img src={activeAvatar} alt="Profile" className="w-full h-full object-cover object-top" />
                </div>
              ) : (
                <User className="w-4 h-4" />
              )}
              <span className="text-xs font-bold hidden sm:inline max-w-[80px] truncate">
                {localProfile?.nickname || 'Profile'}
              </span>
            </button>
          </div>
        </div>

        {/* ROW 2 (Mobile-Only Navigation Tabs: 4-Column Grid, Zero Horizontal Scrolling, Fully Padded Labels) */}
        <nav 
          aria-label="Mobile Navigation Tabs"
          className="grid grid-cols-4 gap-1.5 w-full md:hidden box-border max-w-full overflow-hidden"
        >
          {/* 1. Directory */}
          <button
            type="button"
            onClick={() => {
              if (setFeedView) setFeedView('directory');
              setActiveTab('library');
              window.location.hash = 'library';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer box-border min-w-0 ${
              isDirectoryActive
                ? 'btn-primary-theme shadow-md text-white'
                : 'text-neutral-300 hover:text-white bg-[#141b2c]/80 hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-tight truncate">{directoryLabel}</span>
          </button>

          {/* 2. For You */}
          <button
            type="button"
            onClick={() => {
              if (setFeedView) setFeedView('foryou');
              setActiveTab('foryou');
              window.location.hash = 'foryou';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer box-border min-w-0 ${
              isForYouActive
                ? 'bg-amber-500 text-black shadow-md font-black'
                : 'text-neutral-300 hover:text-white bg-[#141b2c]/80 hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-tight truncate">{forYouLabel}</span>
          </button>

          {/* 3. Watchlist */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('watchlist');
              window.location.hash = 'watchlist';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`relative flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer box-border min-w-0 ${
              activeTab === 'watchlist'
                ? 'btn-primary-theme shadow-md text-white'
                : 'text-neutral-300 hover:text-white bg-[#141b2c]/80 hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'watchlist' ? 'fill-current' : ''}`} />
            <span className="leading-tight truncate">{watchlistLabel}</span>
            {watchlistCount > 0 && (
              <span className="text-[9px] font-black px-1 py-0.2 rounded-full bg-[var(--primary-badge)] text-white border border-primary-theme/40 leading-none shrink-0">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* 4. Schedule */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('schedule');
              window.location.hash = 'schedule';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer box-border min-w-0 ${
              activeTab === 'schedule'
                ? 'btn-primary-theme shadow-md text-white'
                : 'text-neutral-300 hover:text-white bg-[#141b2c]/80 hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-tight truncate">{scheduleLabel}</span>
          </button>
        </nav>

        {/* ROW 3 (Mobile-Only Primary Search Bar: Spans Full-Width of Header, Completely Stable) */}
        <div className="w-full md:hidden box-border max-w-full overflow-hidden min-w-0">
          <PrimarySearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            allAnime={allAnime}
            onSelectAnime={onSelectAnime}
            uiLanguage={uiLanguage}
          />
        </div>

      </div>
    </header>
  );
};
