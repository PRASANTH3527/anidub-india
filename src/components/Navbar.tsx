import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useUser } from '../lib/clerk';
import { 
  Compass, 
  Sparkles, 
  Bookmark, 
  Calendar, 
  Layers, 
  Trophy,
  Cloud,
  Plus,
  User,
  MessageSquare,
  ShieldCheck,
  Shield,
} from 'lucide-react';
import { AniDubLogo } from './AniDubLogo';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  watchlistCount: number;
  onUnlockAdmin: () => void;
  onOpenCollection?: () => void;
  onSelectAnime?: (id: number) => void;
  feedView?: string;
  setFeedView?: (view: string) => void;
  isAdminAuthenticated?: boolean;
  onLogout?: () => void;
  userAvatar?: string;
  currentLang?: string;
  setCurrentLang?: (lang: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  onUnlockAdmin,
  onOpenCollection,
  onSelectAnime,
  feedView = 'library',
  setFeedView,
  isAdminAuthenticated,
  onLogout,
  userAvatar,
  currentLang = 'en',
  setCurrentLang
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { user } = useUser();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return true; // Default dark
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const logoClickCountRef = useRef(0);
  const logoClickTimerRef = useRef<any>(null);

  const handleLogoClick = () => {
    logoClickCountRef.current += 1;
    clearTimeout(logoClickTimerRef.current);

    if (logoClickCountRef.current >= 5) {
      logoClickCountRef.current = 0;
      onUnlockAdmin();
      return;
    }

    logoClickTimerRef.current = setTimeout(() => {
      logoClickCountRef.current = 0;
    }, 1600);

    if (activeTab !== 'home') {
      setActiveTab('home');
      if (setFeedView) setFeedView('library');
    }
  };

  const isForYouActive = activeTab === 'foryou' || feedView === 'foryou';
  const isDirectoryActive = (activeTab === 'home' || activeTab === 'library' || activeTab === 'catalog') && !isForYouActive;

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-full overflow-x-clip bg-[#0b0f17]/95 backdrop-blur-xl border-b border-neutral-800/80 transition-colors box-border select-none">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          
          {/* LEFT: BRAND LOGO */}
          <motion.button 
            type="button"
            onClick={handleLogoClick}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
            className="flex items-center cursor-pointer select-none group shrink-0 min-h-[44px] max-w-[140px] sm:max-w-none bg-transparent border-0 p-0 overflow-hidden"
            title="ANIDUB INDIA - Home"
            aria-label="ANIDUB INDIA - Home"
          >
            <AniDubLogo
              variant="horizontal"
              size="sm"
              hideTrailingLine={true}
              className="h-6 sm:h-8 w-auto object-contain select-none shrink-0"
            />
          </motion.button>

          {/* MOBILE TOP QUICK ACTIONS (>=44x44px touch targets for Dub Radar, Requests, Schedule, Admin) */}
          <div className="flex sm:hidden items-center gap-0.5 shrink-0">




            <motion.button
              type="button"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
              onClick={() => setActiveTab('schedule')}
              title="Weekly Simulcast Schedule"
              aria-label="Weekly Simulcast Schedule"
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'schedule'
                  ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              <Calendar className="w-5 h-5" />
            </motion.button>

            {isAdminAuthenticated && (
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                onClick={() => setActiveTab(activeTab === 'admin' ? 'home' : 'admin')}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer border shrink-0 ${
                  activeTab === 'admin'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                    : 'bg-purple-950/40 text-purple-300 border-purple-500/40'
                }`}
                title="Admin Dashboard"
                aria-label="Admin Dashboard"
              >
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </motion.button>
            )}
          </div>

          {/* DESKTOP NAVIGATION ICONS (sm and up) */}
          <nav aria-label="Primary Navigation" className="hidden sm:flex items-center flex-1 min-w-0 max-w-full overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 1. Compass (Directory) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => {
                  setActiveTab('home');
                  if (setFeedView) setFeedView('library');
                }}
                title="Explore Catalog Directory"
                aria-label="Explore Catalog Directory"
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
                  isDirectoryActive
                    ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <Compass className="w-5 h-5" />
              </motion.button>

              {/* 2. Sparkles (For You / Matchmaker) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => {
                  setActiveTab('home');
                  if (setFeedView) setFeedView('foryou');
                }}
                title="For You Matchmaker"
                aria-label="For You Matchmaker"
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
                  isForYouActive
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <Sparkles className="w-5 h-5" />
              </motion.button>

              {/* 3. Bookmark (Watchlist with Badge) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => setActiveTab('watchlist')}
                title="My Saved Anime Watchlist"
                aria-label="My Saved Anime Watchlist"
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'watchlist'
                    ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <Bookmark className="w-5 h-5" />
                {watchlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 btn-primary-theme text-white text-[9px] font-black rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 shadow-md">
                    {watchlistCount}
                  </span>
                )}
              </motion.button>

              {/* 4. Calendar (Schedule) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => setActiveTab('schedule')}
                title="Weekly Simulcast Schedule"
                aria-label="Weekly Simulcast Schedule"
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'schedule'
                    ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <Calendar className="w-5 h-5" />
              </motion.button>





              {/* 5. MessageSquare (Live Community Chat) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => setActiveTab('chat')}
                title="Live Community Chat & Dub Discussions"
                aria-label="Live Community Chat & Dub Discussions"
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'chat'
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-400 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              </motion.button>

              {/* 6. User / Avatar Profile */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => setActiveTab('profile')}
                title="User Profile"
                aria-label="User Profile"
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'profile'
                    ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shadow-sm">
                  {user ? (
                    <img 
                      src={localStorage.getItem('anidub_anime_avatar') || 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png'} 
                      alt="Profile" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                </div>
              </motion.button>

              {/* 7. Trophy (Tier List / Rankings) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => setActiveTab('tierlist')}
                title="Anime Tier List & Community Rankings"
                aria-label="Anime Tier List & Community Rankings"
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'tierlist'
                    ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <Trophy className="w-5 h-5" />
              </motion.button>

              {/* 8. Layers (Create Collection) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => {
                  if (onOpenCollection) onOpenCollection();
                }}
                title="Create Shareable Anime Collection"
                aria-label="Create Shareable Anime Collection"
                className="w-10 h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors cursor-pointer shrink-0"
              >
                <Layers className="w-5 h-5" />
              </motion.button>
            </div>
          </nav>

          {/* DESKTOP RIGHT UTILITY ACTIONS */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <motion.button
              type="button"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
              onClick={() => {
                if (onOpenCollection) onOpenCollection();
              }}
              aria-label="Create Shareable Anime List"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white text-xs font-bold shadow-md shadow-purple-950/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create List</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
              onClick={() => {
                window.location.reload();
              }}
              title="Refresh Library"
              aria-label="Refresh Library"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-900/60 text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>Sync</span>
            </motion.button>

            {isAdminAuthenticated && (
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                onClick={() => {
                  setActiveTab(activeTab === 'admin' ? 'home' : 'admin');
                }}
                className={`p-2 rounded-xl transition-colors cursor-pointer border ${
                  activeTab === 'admin'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                    : 'bg-purple-950/40 text-purple-300 border-purple-500/40 hover:text-white hover:bg-purple-900/60'
                }`}
                title="Admin Dashboard"
                aria-label="Admin Dashboard"
              >
                <ShieldCheck className="w-4.5 h-4.5 text-amber-400" />
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE 5-TAB BOTTOM NAVIGATION BAR (>=44x44px touch targets with visible labels) */}
      <nav
        aria-label="Mobile primary navigation"
        data-testid="mobile-bottom-nav"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0b0f17]/95 backdrop-blur-xl border-t border-neutral-800/90 px-1 pb-[env(safe-area-inset-bottom,0px)] select-none"
      >
        <div className="grid grid-cols-5 items-center max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('library');
            }}
            aria-label="Home"
            aria-current={isDirectoryActive ? 'page' : undefined}
            className={`min-h-[52px] min-w-[44px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
              isDirectoryActive ? 'text-purple-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('foryou');
            }}
            aria-label="Explore Matchmaker"
            aria-current={isForYouActive ? 'page' : undefined}
            className={`min-h-[52px] min-w-[44px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
              isForYouActive ? 'text-amber-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>Explore</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('watchlist')}
            aria-label="Watchlist"
            aria-current={activeTab === 'watchlist' ? 'page' : undefined}
            className={`relative min-h-[52px] min-w-[44px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'watchlist' ? 'text-purple-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span className="relative">
              <Bookmark className="w-5 h-5" />
              {watchlistCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 btn-primary-theme text-white text-[9px] font-black rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 shadow-md">
                  {watchlistCount}
                </span>
              )}
            </span>
            <span>Watchlist</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            aria-label="Community Chat"
            aria-current={activeTab === 'chat' ? 'page' : undefined}
            className={`relative min-h-[52px] min-w-[44px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'chat' ? 'text-purple-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span className="relative">
              <MessageSquare className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
            </span>
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            aria-label="Profile"
            aria-current={activeTab === 'profile' ? 'page' : undefined}
            className={`min-h-[52px] min-w-[44px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'profile' ? 'text-purple-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <User className="w-5 h-5" />
            <span>Profile</span>
          </button>
        </div>
      </nav>
    </>
  );
};
