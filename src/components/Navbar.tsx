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
  Shield
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
    <header className="sticky top-0 z-40 w-full max-w-full bg-[#0b0f17]/95 backdrop-blur-xl border-b border-neutral-800/80 transition-colors box-border select-none">
      <div className="w-full max-w-7xl mx-auto px-2.5 min-[390px]:px-3 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 min-[390px]:gap-2 sm:gap-4">
        
        {/* LEFT: BRAND LOGO (Natural width, transparent, no empty box or spacing artifacts) */}
        <motion.div 
          onClick={handleLogoClick}
          initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
          className="flex items-center cursor-pointer select-none group shrink-0"
          title="ANIDUB INDIA - Home"
        >
          <AniDubLogo
            variant="horizontal"
            size="sm"
            hideTrailingLine={true}
            className="h-6 sm:h-8 w-auto object-contain select-none shrink-0"
          />
        </motion.div>

        {/* CENTER SCROLLABLE NAVIGATION ICONS */}
        <nav className="flex items-center flex-1 min-w-0 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-0.5 min-[375px]:gap-1 min-[410px]:gap-1.5 sm:gap-1.5 ml-auto sm:ml-0 shrink-0">
          
          {/* 1. Compass (Directory) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('library');
            }}
            title="Explore Catalog Directory"
            className={`w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              isDirectoryActive
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>

          {/* 3. Sparkles (For You) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('foryou');
            }}
            title="For You Recommendations"
            className={`w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              isForYouActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>

          {/* 4. Bookmark (Watchlist with Badge) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => setActiveTab('watchlist')}
            title="My Saved Anime Watchlist"
            className={`relative w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              activeTab === 'watchlist'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 btn-primary-theme text-white text-[9px] font-black rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 shadow-md">
                {watchlistCount}
              </span>
            )}
          </motion.button>

          {/* 5. Calendar (Schedule) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => setActiveTab('schedule')}
            title="Weekly Simulcast Schedule"
            className={`w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              activeTab === 'schedule'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>

          {/* 5.5 MessageSquare (Live Community Chat) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => setActiveTab('chat')}
            title="Live Community Chat & Dub Discussions"
            className={`relative w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              activeTab === 'chat'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          </motion.button>

          {/* 6. User / Avatar Profile */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => setActiveTab('profile')}
            title="User Profile"
            className={`w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shadow-sm">
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
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => setActiveTab('tierlist')}
            title="Anime Tier List & Community Rankings"
            className={`flex w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              activeTab === 'tierlist'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>

          {/* 8. Layers (Create Collection) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => {
              if (onOpenCollection) onOpenCollection();
            }}
            title="Create Shareable Anime Collection"
            className="w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors cursor-pointer shrink-0"
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
          </div>
        </nav>

        {/* RIGHT UTILITY ACTIONS (Hidden on mobile unless admin button is shown to avoid trailing gap) */}
        <div className={`${isAdminAuthenticated ? 'flex' : 'hidden sm:flex'} items-center gap-1.5 sm:gap-2 shrink-0`}>

          {/* Create List Button (LG screens) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
            onClick={() => {
              if (onOpenCollection) onOpenCollection();
            }}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white text-xs font-bold shadow-md shadow-purple-950/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create List</span>
          </motion.button>

          {/* Cloud Sync Button (SM screens) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
            onClick={() => {
              window.location.reload();
            }}
            title="Refresh Library"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-900/60 text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>Sync</span>
          </motion.button>

          {/* Admin Console Access - Stealth: Only visible once admin is unlocked/authenticated */}
          {isAdminAuthenticated && (
            <motion.button
              whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
              onClick={() => {
                setActiveTab(activeTab === 'admin' ? 'home' : 'admin');
              }}
              className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer border ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                  : 'bg-purple-950/40 text-purple-300 border-purple-500/40 hover:text-white hover:bg-purple-900/60'
              }`}
              title="Admin Dashboard"
            >
              <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />
            </motion.button>
          )}
        </div>
      </div>
    </header>
  );
};
