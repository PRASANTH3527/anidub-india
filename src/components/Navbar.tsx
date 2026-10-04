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
  Search,
  BarChart3
} from 'lucide-react';
import { authService } from '../services/authService';
import { LocalUserProfile, ANIME_AVATAR_PRESETS } from './LocalProfileModal';
import { SupportedLanguage, translate } from '../utils/i18n';
import { useTheme } from '../context/ThemeContext';

export type NavTab = 'library' | 'foryou' | 'watchlist' | 'schedule' | 'recommendations' | 'profile' | 'analytics';

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
}) => {
  const { avatar: globalAvatar, theme: currentTheme } = useTheme();
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

  const activeAvatar = globalAvatar || localProfile?.avatar;

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b0f17]/90 backdrop-blur-md border-b border-neutral-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Brand Logo (Compact on mobile) */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group select-none shrink-0 active:scale-[0.97] transition-transform"
          title={translate('stealthHint', uiLanguage)}
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

        {/* Primary Nav Tabs: Centered between Logo and Theme Toggle (Icon-only, no text labels) */}
        <nav className="flex items-center justify-center gap-1 sm:gap-2 flex-1 mx-1 sm:mx-4">
          {/* 1. Directory */}
          <button
            onClick={() => setActiveTab('library')}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-primary-theme'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navDirectory', uiLanguage)}
            aria-label={translate('navDirectory', uiLanguage)}
          >
            <Compass className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'library' ? 'scale-110' : ''}`} />
          </button>

          {/* 2. Search */}
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
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-all active:scale-90 cursor-pointer"
            title="Search Anime"
            aria-label="Search Anime"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* 3. For You */}
          <button
            onClick={() => setActiveTab('foryou')}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
              activeTab === 'foryou'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navForYou', uiLanguage)}
            aria-label={translate('navForYou', uiLanguage)}
          >
            <Sparkles className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'foryou' ? 'scale-110' : ''}`} />
          </button>

          {/* 4. Watchlist */}
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
              activeTab === 'watchlist'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-primary-theme'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
            title={translate('navWatchlist', uiLanguage)}
            aria-label={translate('navWatchlist', uiLanguage)}
          >
            <Bookmark className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'watchlist' ? 'scale-110 fill-current' : ''}`} />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 btn-primary-theme text-white text-[9px] font-black rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 border border-[#0b0f17] shadow-sm">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* Admin Analytics (Hidden for public) */}
          {(isAdmin || currentUser?.email === 'prasanth01236@gmail.com') && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-9 h-9 sm:w-10 sm:h-10 hidden md:flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
              title="View Platform Analytics"
              aria-label="Platform Analytics"
            >
              <BarChart3 className="w-5 h-5 text-accent-theme" />
            </button>
          )}

          {/* 5. Profile & Avatar */}
          <button
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
            title={translate('navProfile', uiLanguage)}
            aria-label={translate('navProfile', uiLanguage)}
          >
            {activeAvatar ? (
              <div 
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 shadow-sm shrink-0"
                style={{
                  borderColor: activeTab === 'profile' ? 'var(--primary-accent)' : 'var(--primary-border)',
                }}
              >
                <img src={activeAvatar} alt="Profile" className="w-full h-full object-cover object-top" />
              </div>
            ) : (
              <User className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'profile' ? 'scale-110' : ''}`} />
            )}
          </button>
        </nav>

        {/* Global Controls (Theme & Lang) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            suppressHydrationWarning
            className="p-2 sm:p-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/80 active:scale-90 border border-neutral-700/40 text-neutral-400 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4.5 h-4.5 sm:w-4 sm:h-4 text-amber-400" />
            ) : (
              <Moon className="w-4.5 h-4.5 sm:w-4 sm:h-4 text-accent-theme" />
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
