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
  Languages
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
        
        {/* Brand Logo & Title (Stealth Admin Trigger: 5 rapid taps) */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none shrink-0 active:scale-[0.97] transition-transform"
          title="AniDub India — Tap 5 times to reveal stealth admin panel"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30 group-hover:scale-105 transition-transform duration-200">
            <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-black text-lg sm:text-xl tracking-tight text-white group-hover:text-purple-300 transition-colors">
                Ani<span className="text-purple-400">Dub</span>
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-white to-green-500 bg-clip-text text-transparent font-bold text-[10px] tracking-wider uppercase border border-neutral-700/60 rounded px-1 py-0.2">
                India
              </span>
            </div>
            <span className="text-[9px] text-neutral-400 font-medium hidden md:inline -mt-0.5">
              Regional Dub Directory
            </span>
          </div>
        </div>

        {/* Center Primary Nav Tabs */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
          {/* Library / Directory Tab */}
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme shadow-sm'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{translate('navDirectory', uiLanguage)}</span>
          </button>

          {/* Smart 'For You' Feed Tab */}
          <button
            onClick={() => setActiveTab('foryou')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === 'foryou'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme shadow-sm'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-theme" />
            <span>{translate('navForYou', uiLanguage)}</span>
          </button>

          {/* My Watchlist Tab (Local Favorites) */}
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === 'watchlist'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme shadow-sm'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-theme" />
            <span className="hidden sm:inline">{translate('navWatchlist', uiLanguage)}</span>
            <span className="sm:hidden">{translate('navSaved', uiLanguage)}</span>
            {watchlistCount > 0 && (
              <span className="bg-primary-theme text-white text-[10px] font-black rounded-full px-1.5 py-0.2 min-w-[18px] text-center shadow-sm">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* Schedule Tab */}
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme shadow-sm'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{translate('navSchedule', uiLanguage)}</span>
          </button>

          {/* Matchmaker Recommendations Tab */}
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === 'recommendations'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme shadow-sm'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{translate('navMatchmaker', uiLanguage)}</span>
          </button>

          {/* Profile Tab / Modal Trigger */}
          <button
            onClick={() => {
              if (onOpenProfileModal) {
                onOpenProfileModal();
              } else {
                setActiveTab('profile');
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-primary-theme/20 text-primary-theme border border-primary-theme shadow-sm'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{translate('navProfile', uiLanguage)}</span>
          </button>
        </nav>

        {/* Right Action Toolbar: Bilingual Toggle, Theme Toggle, Submit Dub & Chosen Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Bilingual English / Tamil Language Switcher */}
          {onToggleLanguage && (
            <button
              onClick={onToggleLanguage}
              title={uiLanguage === 'en' ? 'Switch to Tamil (தமிழ்)' : 'Switch to English'}
              className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 active:scale-95 border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white transition-all cursor-pointer shadow-sm"
            >
              <Languages className="w-3.5 h-3.5 text-accent-theme" />
              <span className="text-[11px] font-black">{uiLanguage === 'en' ? 'தமிழ்' : 'ENG'}</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-xl bg-neutral-800/70 hover:bg-neutral-700/80 active:scale-90 border border-neutral-700/60 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 rotate-0 hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-purple-400 rotate-0 hover:-rotate-12 transition-transform duration-300" />
            )}
          </button>

          {/* Add Dub CTA Button */}
          <button
            onClick={onOpenSuggestModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-primary-theme/20 hover:bg-primary-theme/30 active:scale-95 border border-primary-theme text-primary-theme text-xs sm:text-sm font-semibold transition-all cursor-pointer group shadow-sm hidden md:flex"
          >
            <PlusCircle className="w-3.5 h-3.5 text-primary-theme group-hover:rotate-90 transition-transform duration-200" />
            <span>Submit Dub</span>
          </button>

          {/* Local User Profile Avatar Button */}
          {onOpenProfileModal && (
            <button
              onClick={onOpenProfileModal}
              className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-2xl bg-[#141b2c] hover:bg-[#1e273f] border border-neutral-700/80 hover:border-primary-theme transition-all cursor-pointer group active:scale-95 shadow-sm"
              title={`Profile: ${localProfile.nickname} (Click to customize)`}
            >
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-neutral-900 border border-primary-theme group-hover:scale-105 transition-all shrink-0">
                <img
                  src={localProfile.avatar}
                  alt={localProfile.nickname}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col text-left hidden sm:flex">
                <span className="text-[11px] font-bold text-white group-hover:text-primary-theme transition-colors truncate max-w-[80px]">
                  {localProfile.nickname}
                </span>
                <span className="text-[9px] text-primary-theme font-medium -mt-0.5">
                  Profile
                </span>
              </div>
            </button>
          )}

          {/* Google Auth Avatar or Login Fallback */}
          {currentUser && (
            <div 
              onClick={onOpenAuthModal}
              className="flex items-center gap-1 cursor-pointer group active:scale-95"
              title={`Logged in as ${currentUser.displayName}`}
            >
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                className="w-7 h-7 rounded-full object-cover border border-purple-500/60 group-hover:border-purple-400 transition-colors shadow"
              />
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
