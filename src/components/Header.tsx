'use client';

import React, { useState } from 'react';
import { 
  Compass, 
  Search, 
  Sparkles, 
  Bookmark, 
  User, 
  Sun, 
  Moon, 
  Film, 
  Languages,
  BarChart3,
  Cloud
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { DeviceSyncModal } from './DeviceSyncModal';

export type NavTab = 'library' | 'foryou' | 'watchlist' | 'schedule' | 'recommendations' | 'profile' | 'analytics';

export interface HeaderProps {
  activeTab?: NavTab;
  setActiveTab?: (tab: NavTab) => void;
  watchlistCount?: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenSuggestModal?: () => void;
  onOpenAuthModal?: () => void;
  onSecretTrigger?: () => void;
  localProfile?: {
    nickname?: string;
    avatar?: string;
    favoriteLanguage?: string;
  };
  onOpenProfileModal?: () => void;
  uiLanguage?: 'en' | 'ta';
  onToggleLanguage?: () => void;
  isAdmin?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'library',
  setActiveTab = () => {},
  watchlistCount = 0,
  theme = 'dark',
  onToggleTheme = () => {},
  onSecretTrigger,
  onOpenAuthModal,
  onOpenProfileModal,
  localProfile,
  uiLanguage = 'en',
  onToggleLanguage,
  isAdmin = false,
}) => {
  const { avatar: globalAvatar, theme: currentTheme } = useTheme();
  const tapHistoryRef = React.useRef<number[]>([]);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const handleLogoClick = () => {
    if (onSecretTrigger) {
      const now = Date.now();
      tapHistoryRef.current = [...tapHistoryRef.current.filter((t) => now - t < 2500), now];
      if (tapHistoryRef.current.length >= 5) {
        tapHistoryRef.current = [];
        onSecretTrigger();
      }
    }
    setActiveTab('library');
  };

  const handleSearchClick = () => {
    setActiveTab('library');
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]');
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const activeAvatar = globalAvatar || localProfile?.avatar;

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#0b0f17]/90 backdrop-blur-md border-b border-neutral-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          
          {/* 1. Brand Logo (Left flex item) */}
          <div 
            onClick={handleLogoClick}
            className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group select-none shrink-0 active:scale-[0.97] transition-transform"
            title="AniDub India — Click to go to Library"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl btn-primary-theme flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
              <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col hidden xs:flex">
              <div className="flex items-center gap-1">
                <span className="font-heading font-black text-lg sm:text-xl tracking-tight text-white group-hover:text-primary-theme transition-colors">
                  Ani<span className="text-accent-theme">Dub</span>
                </span>
                <span className="bg-gradient-to-r from-orange-500 via-white to-green-500 bg-clip-text text-transparent font-bold text-[8px] sm:text-[10px] tracking-wider uppercase border border-neutral-700/60 rounded px-1">
                  IN
                </span>
              </div>
            </div>
          </div>

          {/* 2. Top Navigation Tabs: Centered Flexbox with Navigation Icons (Zero Bottom Nav) */}
          <nav className="flex items-center justify-center gap-1 sm:gap-2 flex-1 mx-1 sm:mx-4">
            {/* Compass / Directory */}
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-primary-theme'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
              title="Browse Directory"
              aria-label="Browse Directory"
            >
              <Compass className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'library' ? 'scale-110' : ''}`} />
            </button>

            {/* Quick Search */}
            <button
              type="button"
              onClick={handleSearchClick}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-all active:scale-90 cursor-pointer"
              title="Search Anime"
              aria-label="Search Anime"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* For You / Recommendations */}
            <button
              type="button"
              onClick={() => setActiveTab('foryou')}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                activeTab === 'foryou'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
              title="For You & Trending"
              aria-label="For You"
            >
              <Sparkles className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'foryou' ? 'scale-110' : ''}`} />
            </button>

            {/* Watchlist with Count Badge */}
            <button
              type="button"
              onClick={() => setActiveTab('watchlist')}
              className={`relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                activeTab === 'watchlist'
                  ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-primary-theme'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
              title="My Watchlist"
              aria-label="Watchlist"
            >
              <Bookmark className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'watchlist' ? 'scale-110 fill-current' : ''}`} />
              {watchlistCount > 0 && (
                <span className="absolute -top-1 -right-1 btn-primary-theme text-white text-[9px] font-black rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 border border-[#0b0f17] shadow-sm">
                  {watchlistCount}
                </span>
              )}
            </button>

            {/* Admin Analytics (if admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`w-9 h-9 sm:w-10 sm:h-10 hidden md:flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`}
                title="Platform Analytics"
                aria-label="Platform Analytics"
              >
                <BarChart3 className="w-5 h-5 text-accent-theme" />
              </button>
            )}

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
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-primary-theme'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
              title="Profile & Settings"
              aria-label="Profile"
            >
              {activeAvatar ? (
                <div 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 shadow-sm shrink-0"
                  style={{
                    borderColor: activeTab === 'profile' ? 'var(--primary-accent)' : 'var(--primary-border)',
                  }}
                >
                  <img src={activeAvatar || undefined} alt="Profile" className="w-full h-full object-cover object-top" />
                </div>
              ) : (
                <User className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'profile' ? 'scale-110' : ''}`} />
              )}
            </button>
          </nav>

          {/* 3. Global Action Controls (Right flex items: Theme, Language, Sync Devices, Profile) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Sync Devices Button */}
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/80 active:scale-95 border border-neutral-700/40 text-xs font-bold text-neutral-200 hover:text-white transition-all cursor-pointer shadow-sm"
              title="Sync Devices without Login"
            >
              <Cloud className="w-3.5 h-3.5 text-accent-theme" />
              <span>Sync Devices</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={onToggleTheme}
              suppressHydrationWarning
              className="p-2 sm:p-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/80 active:scale-90 border border-neutral-700/40 text-neutral-400 hover:text-white transition-all cursor-pointer shadow-sm"
              title="Toggle Light/Dark Theme"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4.5 h-4.5 sm:w-4 sm:h-4 text-amber-400 transition-transform duration-200" />
              ) : (
                <Moon className="w-4.5 h-4.5 sm:w-4 sm:h-4 text-accent-theme transition-transform duration-200" />
              )}
            </button>

            {/* Bilingual Toggle (EN / தமிழ்) */}
            {onToggleLanguage && (
              <button
                type="button"
                onClick={onToggleLanguage}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/80 active:scale-95 border border-neutral-700/40 text-[10px] font-black text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Switch Language"
              >
                <Languages className="w-3.5 h-3.5 text-accent-theme" />
                <span>{uiLanguage === 'en' ? 'தமிழ்' : 'EN'}</span>
              </button>
            )}

            {/* Login / Auth trigger if available */}
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="hidden xs:flex items-center gap-1 px-2.5 py-1.5 rounded-xl badge-primary-theme text-xs font-semibold active:scale-95 transition-all cursor-pointer"
              >
                <span>Account</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Device Sync Modal */}
      <DeviceSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </>
  );
};

export const Navbar = Header;
export default Header;
