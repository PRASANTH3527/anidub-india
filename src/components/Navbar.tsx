import React from 'react';
import { 
  Bookmark, 
  Sparkles, 
  PlusCircle, 
  Compass, 
  Calendar, 
  Film, 
  User, 
  LogIn,
  Sun,
  Moon,
  Heart,
  Languages,
  Search
} from 'lucide-react';
import { authService } from '../services/authService';
import { LocalUserProfile, ANIME_AVATAR_PRESETS } from './LocalProfileModal';
import { SupportedLanguage, translate } from '../utils/i18n';

export type NavTab = 'library' | 'foryou' | 'watchlist' | 'schedule' | 'recommendations' | 'profile';

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
}) => {
  const currentUser = authService.getCurrentUser();
  const tapHistoryRef = React.useRef<number[]>([]);

  const handleLogoClick = () => {
    const now = Date.now();
    // Keep taps from the last 2.5 seconds
    tapHistoryRef.current = [...tapHistoryRef.current.filter((t) => now - t < 2500), now];
    
    if (tapHistoryRef.current.length >= 5) {
      tapHistoryRef.current = [];
      onSecretTrigger();
    }
    setActiveTab('library');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b0f17]/90 backdrop-blur-md border-b border-neutral-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Brand Logo (Compact on mobile) */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group select-none shrink-0 active:scale-[0.97] transition-transform"
          title={translate('stealthHint', uiLanguage)}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30 group-hover:scale-105 transition-transform duration-200">
            <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col hidden xs:flex">
            <div className="flex items-center gap-1">
              <span className="font-heading font-black text-lg sm:text-xl tracking-tight text-white group-hover:text-purple-300 transition-colors">
                Ani<span className="text-purple-400">Dub</span>
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-white to-green-500 bg-clip-text text-transparent font-bold text-[8px] sm:text-[10px] tracking-wider uppercase border border-neutral-700/60 rounded px-1">
                IN
              </span>
            </div>
          </div>
        </div>

        {/* Primary Nav Tabs (Icons only on mobile) */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Library / Directory */}
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 active:scale-90 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme/50 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navDirectory', uiLanguage)}
          >
            <Compass className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden md:inline">{translate('navDirectory', uiLanguage)}</span>
          </button>

          {/* Search Shortcut (New for top nav mobile convenience) */}
          <button
            onClick={() => {
              setActiveTab('library');
              setTimeout(() => {
                const input = document.querySelector('input[type="text"]');
                if (input instanceof HTMLInputElement) {
                  input.focus();
                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs sm:text-sm font-bold text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-all active:scale-90 cursor-pointer"
            title="Search Anime"
          >
            <Search className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden lg:inline">Search</span>
          </button>

          {/* For You */}
          <button
            onClick={() => setActiveTab('foryou')}
            className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 active:scale-90 cursor-pointer ${
              activeTab === 'foryou'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme/50 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navForYou', uiLanguage)}
          >
            <Sparkles className="w-5 h-5 sm:w-4 sm:h-4 text-accent-theme" />
            <span className="hidden md:inline">{translate('navForYou', uiLanguage)}</span>
          </button>

          {/* Watchlist */}
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 active:scale-90 cursor-pointer relative ${
              activeTab === 'watchlist'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme/50 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navWatchlist', uiLanguage)}
          >
            <Bookmark className="w-5 h-5 sm:w-4 sm:h-4 text-primary-theme" />
            <span className="hidden md:inline">{translate('navWatchlist', uiLanguage)}</span>
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 sm:static sm:ml-1 bg-primary-theme text-white text-[9px] font-black rounded-full px-1 py-0.2 min-w-[15px] text-center shadow-sm">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* Profile / Account */}
          <button
            onClick={() => {
              if (onOpenProfileModal) {
                onOpenProfileModal();
              } else {
                setActiveTab('profile');
              }
            }}
            className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 active:scale-90 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme/50 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navProfile', uiLanguage)}
          >
            <User className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden lg:inline">{translate('navProfile', uiLanguage)}</span>
          </button>
        </nav>

        {/* Global Controls (Theme & Lang) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 sm:p-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/80 active:scale-90 border border-neutral-700/40 text-neutral-400 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4.5 h-4.5 sm:w-4 sm:h-4 text-amber-400" />
            ) : (
              <Moon className="w-4.5 h-4.5 sm:w-4 sm:h-4 text-purple-400" />
            )}
          </button>

          {/* Bilingual Toggle (Hidden on narrow mobile) */}
          {onToggleLanguage && (
            <button
              onClick={onToggleLanguage}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/80 active:scale-95 border border-neutral-700/40 text-[10px] font-black text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-accent-theme" />
              <span>{uiLanguage === 'en' ? 'தமிழ்' : 'EN'}</span>
            </button>
          )}

          {/* Auth indicator (Always visible if logged in) */}
          {currentUser && (
            <div 
              onClick={onOpenAuthModal}
              className="p-0.5 rounded-full border border-purple-500/40 cursor-pointer active:scale-90 transition-transform hidden xs:block"
              title={`Logged in as ${currentUser.displayName}`}
            >
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
              />
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
