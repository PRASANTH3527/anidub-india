import React, { useState, useRef } from 'react';
import { 
  Compass, 
  Search, 
  Sparkles, 
  Bookmark, 
  Calendar, 
  Layers, 
  Trophy,
  Cloud,
  Globe, 
  Sun,
  Moon,
  Plus,
  Check,
  X,
  User
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  watchlistCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onUnlockAdmin: () => void;
  onOpenCollection?: () => void;
  feedView?: string;
  setFeedView?: (view: string) => void;
  isAdminAuthenticated?: boolean;
  onLogout?: () => void;
}

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', native: 'English', english: 'English' },
  { code: 'ta', flag: '🇮🇳', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', flag: '🇮🇳', native: 'తెలుగు', english: 'Telugu' },
  { code: 'hi', flag: '🇮🇳', native: 'हिन्दी', english: 'Hindi' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  searchQuery,
  setSearchQuery,
  onUnlockAdmin,
  onOpenCollection,
  feedView = 'library',
  setFeedView,
  isAdminAuthenticated,
  onLogout
}) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [logoClicks, setLogoClicks] = useState(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    const nextCount = logoClicks + 1;
    
    if (nextCount >= 5) {
      // Immediate Reset and Trigger
      onUnlockAdmin();
      setLogoClicks(0);
    } else {
      setLogoClicks(nextCount);
      // Time-bound reset: Clear counter if next click doesn't happen within 2 seconds
      clickTimeoutRef.current = setTimeout(() => {
        setLogoClicks(0);
      }, 2000);
    }

    // Navigation fallback
    if (activeTab !== 'home') {
      setActiveTab('home');
      if (setFeedView) setFeedView('library');
    }
  };

  const isForYouActive = activeTab === 'foryou' || feedView === 'foryou';
  const isDirectoryActive = (activeTab === 'home' || activeTab === 'library' || activeTab === 'catalog') && !isForYouActive;

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-[#0b0f17]/95 backdrop-blur-xl border-b border-neutral-800/80 transition-colors box-border select-none">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-3">
        
        {/* LEFT: BRAND LOGO WITH 5-TAP ADMIN TRIGGER */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center space-x-2 cursor-pointer select-none group shrink-0"
          title="anidub INDIA (Tap 5 times for Admin Access)"
        >
          {/* Logo Icon */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-[#ea580c] to-[#f59e0b] p-0.5 shadow-md flex items-center justify-center text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-4.5 sm:h-4.5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>

          {/* Typography */}
          <div className="flex flex-col justify-center leading-none">
            <span className="font-extrabold text-[17px] sm:text-[19px] text-[#ff6a00] tracking-tight" style={{ lineHeight: 1 }}>
              anidub
            </span>
            <div className="flex items-center space-x-1 mt-0.5">
              <span className="font-bold text-[8px] sm:text-[9px] text-neutral-300 tracking-[0.25em]" style={{ lineHeight: 1 }}>
                INDIA
              </span>
              <div className="flex items-center space-x-[2px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff9933] inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#138808] inline-block" />
              </div>
            </div>
          </div>
        </div>

        {/* CENTER SCROLLABLE NAVIGATION ICONS */}
        <nav className="flex items-center gap-1 sm:gap-1.5 flex-grow overflow-x-auto no-scrollbar py-1 justify-center sm:justify-start">
          
          {/* 1. Compass (Directory) */}
          <button
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('library');
            }}
            title="Explore Catalog Directory"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              isDirectoryActive
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* 2. Search (Mobile Search Drawer Trigger) */}
          <button
            onClick={() => setIsMobileSearchExpanded(!isMobileSearchExpanded)}
            title="Quick Search"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              isMobileSearchExpanded
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* 3. Sparkles (For You) */}
          <button
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('foryou');
            }}
            title="For You Recommendations"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              isForYouActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* 4. Bookmark (Watchlist with Badge) */}
          <button
            onClick={() => setActiveTab('watchlist')}
            title="My Saved Anime Watchlist"
            className={`relative w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
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
          </button>

          {/* 5. Calendar (Schedule) */}
          <button
            onClick={() => setActiveTab('schedule')}
            title="Weekly Simulcast Schedule"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              activeTab === 'schedule'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* 6. User / Avatar Profile */}
          <button
            onClick={() => setActiveTab('profile')}
            title="User Profile"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shadow-sm">
              <User className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* 7. Trophy (Tier List / Rankings) */}
          <button
            onClick={() => setActiveTab('tierlist')}
            title="Anime Tier List & Community Rankings"
            className={`flex w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 items-center justify-center rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              activeTab === 'tierlist'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* 8. Layers (Create Collection) */}
          <button
            onClick={() => {
              if (onOpenCollection) onOpenCollection();
            }}
            title="Create Shareable Anime Collection"
            className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-all duration-200 active:scale-90 cursor-pointer shrink-0"
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </nav>

        {/* RIGHT UTILITY ACTIONS */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-1">
          
          {/* Primary Search Bar (XL screens) */}
          <div className="hidden xl:flex items-center relative w-52 2xl:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search anime dubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131926] border border-neutral-800/80 rounded-xl pl-9 pr-7 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Create List Button (LG screens) */}
          <button
            onClick={() => {
              if (onOpenCollection) onOpenCollection();
            }}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white text-xs font-bold shadow-md shadow-purple-950/30 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create List</span>
          </button>

          {/* Cloud Sync Button (SM screens) */}
          <button
            onClick={() => {
              window.location.reload();
            }}
            title="D1 Cloudflare Sync"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-900/60 text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Cloud className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>Sync</span>
          </button>

          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/70 border border-neutral-700/40 text-neutral-300 hover:text-white transition-all duration-200 active:scale-90 flex items-center gap-1"
              title="Change Language"
            >
              <Globe className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-[#121829] border border-neutral-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2.5 py-1">
                  Audio & Display
                </div>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLang(lang.code);
                      setIsLangOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      selectedLang === lang.code
                        ? 'bg-purple-950/60 text-purple-300 font-bold'
                        : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{lang.flag}</span>
                      <span>{lang.native}</span>
                    </span>
                    {selectedLang === lang.code && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sun / Moon Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/70 border border-neutral-700/40 text-neutral-300 hover:text-white transition-all duration-200 active:scale-90"
            title="Toggle Visual Theme"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-300" />
            )}
          </button>
        </div>
      </div>

      {/* MOBILE EXPANDABLE SEARCH DRAWER */}
      {isMobileSearchExpanded && (
        <div className="w-full px-3 py-2 border-t border-neutral-800/60 bg-[#0d121e]/98 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Search anime by title, voice actor, or studio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131926] border border-neutral-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setIsMobileSearchExpanded(false)}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
            title="Close Search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
