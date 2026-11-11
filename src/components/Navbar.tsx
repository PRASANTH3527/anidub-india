import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'motion/react';
import { useUser } from '@clerk/clerk-react';
import { 
  Compass, 
  Search, 
  Sparkles, 
  Bookmark, 
  Calendar, 
  Layers, 
  Trophy,
  Cloud,
  Plus,
  X,
  User,
  MessageSquare,
  Mic,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { useToast } from './Toast';
import { AniDubLogo } from './AniDubLogo';

const MicPermissionBottomSheet = dynamic(() => import('./MicPermissionBottomSheet').then(m => m.MicPermissionBottomSheet), { ssr: false });
const VoiceVisualizer = dynamic(() => import('./VoiceVisualizer').then(m => m.VoiceVisualizer), { ssr: false });

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  watchlistCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
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
  searchQuery,
  setSearchQuery,
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = searchQuery.trim().toLowerCase();
      // Secret Admin Trigger Interception
      if (
        trimmed === '/admin-login' || 
        trimmed === '/admin' || 
        trimmed === 'admin123' || 
        trimmed === 'prasanth123'
      ) {
        e.preventDefault();
        setSearchQuery('');
        setIsSearchOpen(false);
        onUnlockAdmin();
        return;
      }

      // Normal Search Execution
      if (activeTab !== 'home' && activeTab !== 'catalog') {
        setActiveTab('home');
      }
    }
  };

  const isForYouActive = activeTab === 'foryou' || feedView === 'foryou';
  const isDirectoryActive = (activeTab === 'home' || activeTab === 'library' || activeTab === 'catalog') && !isForYouActive;

  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [isPermanentlyBlocked, setIsPermanentlyBlocked] = useState(false);
  const recognitionRef = useRef<any>(null);
  const toast = useToast();

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const startActualVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setShowBottomSheet(false);
        setVoiceTranscript('');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setVoiceTranscript(transcript);
          const isFinal = event.results[0].isFinal;
          
          if (isFinal) {
            const cleanTranscript = transcript.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").trim();
            setSearchQuery(cleanTranscript);
            if (activeTab !== 'home') {
              setActiveTab('home');
              if (setFeedView) setFeedView('library');
            }
            toast.success('Voice Recognized', `Searching for "${cleanTranscript}"`);
            setIsListening(false);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setIsPermanentlyBlocked(true);
          setShowBottomSheet(true);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  const handleVoiceSearch = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice Search Unsupported', 'Your browser does not support speech recognition. Please try Chrome or Safari.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      // 1. Explicitly trigger the browser's native "Allow / Deny" prompt first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. If we reach here, permission was granted. Stop the test stream immediately.
      stream.getTracks().forEach(track => track.stop());

      // 3. Proceed with actual Speech Recognition
      startActualVoiceSearch();
    } catch (err: any) {
      console.warn('Voice Search permission interaction failed:', err.name, err.message);
      setIsListening(false);

      // 4. Handle permanent block / denial (NotAllowedError / DOMException)
      if (
        err.name === 'NotAllowedError' || 
        err.name === 'PermissionDeniedError' || 
        err.name === 'SecurityError' ||
        (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError'))
      ) {
        setIsPermanentlyBlocked(true);
        setShowBottomSheet(true);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-[#0b0f17]/95 backdrop-blur-xl border-b border-neutral-800/80 transition-colors box-border select-none">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        
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
            className="h-7 sm:h-8 w-auto object-contain select-none shrink-0"
          />
        </motion.div>

        {/* EXPANDED INLINE SEARCH (Fills remaining space with flex-1, never squashes the fixed logo) */}
        {isSearchOpen ? (
          <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2">
            <div className="relative flex-1 flex items-center min-w-0">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={isListening ? "Listening..." : "Search anime by title, voice actor, or studio..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  handleSearchKeyDown(e);
                  if (e.key === 'Escape') setIsSearchOpen(false);
                }}
                className={`w-full bg-[#131926] border rounded-xl pl-9 pr-14 py-1.5 text-xs text-white placeholder-neutral-500 outline-none transition-colors ${
                  isListening 
                    ? 'border-purple-500/80 ring-4 ring-purple-500/20 bg-purple-950/20 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse placeholder-purple-300' 
                    : 'border-neutral-700/80 focus:border-purple-500'
                }`}
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-neutral-400 hover:text-white p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`p-1 rounded-lg transition-all cursor-pointer ${
                    isListening
                      ? 'bg-purple-600 text-white animate-pulse shadow-lg ring-2 ring-purple-400'
                      : 'text-neutral-400 hover:text-purple-300 hover:bg-white/5'
                  }`}
                  title={isListening ? 'Listening for voice input...' : 'Search by Voice'}
                >
                  <Mic className={`w-3.5 h-3.5 ${isListening ? 'animate-bounce text-white' : ''}`} />
                </button>
              </div>
            </div>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors cursor-pointer shrink-0"
              title="Close Search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* CENTER SCROLLABLE NAVIGATION ICONS */}
            <nav className="flex items-center gap-1 sm:gap-1.5 flex-grow overflow-x-auto no-scrollbar py-1 justify-start">
          
          {/* 1. Compass (Directory) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('library');
            }}
            title="Explore Catalog Directory"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              isDirectoryActive
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>

          {/* 2. Search (Quick Search Trigger) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="Quick Search"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              isSearchOpen
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>

          {/* 3. Sparkles (For You) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('foryou');
            }}
            title="For You Recommendations"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
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
            className={`relative w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
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
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
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
            className={`relative w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
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
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
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
            className={`flex w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
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
            className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors cursor-pointer shrink-0"
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
        </nav>

        {/* RIGHT UTILITY ACTIONS */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-1">
          
          {/* Primary Search Bar (XL screens) - Fade in from top */}
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
            className="hidden xl:flex items-center relative w-52 2xl:w-64"
          >
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder={isListening ? "Listening..." : "Search anime dubs..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className={`w-full bg-[#131926] border rounded-xl pl-9 pr-14 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors ${
                isListening 
                  ? 'border-purple-500/80 ring-4 ring-purple-500/20 bg-purple-950/20 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse placeholder-purple-300' 
                  : 'border-neutral-800/80 focus:border-purple-500/50'
              }`}
            />
            
            {/* Right Buttons Container inside search input */}
            <div className="absolute right-2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-neutral-400 hover:text-white"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={`p-1 rounded-lg transition-all cursor-pointer ${
                  isListening
                    ? 'bg-purple-600 text-white animate-pulse shadow-lg ring-2 ring-purple-400'
                    : 'text-neutral-400 hover:text-purple-300 hover:bg-white/5'
                }`}
                title={isListening ? 'Listening for voice input...' : 'Search by Voice'}
              >
                <Mic className={`w-3.5 h-3.5 ${isListening ? 'animate-bounce text-white' : ''}`} />
              </button>
            </div>
          </motion.div>

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
        </>
      )}
    </div>

      {/* PERMISSION BOTTOM SHEET */}
      <MicPermissionBottomSheet 
        isOpen={showBottomSheet}
        isPermanentlyBlocked={isPermanentlyBlocked}
        onClose={() => setShowBottomSheet(false)}
        onAllow={() => {
          if (isPermanentlyBlocked) {
            setIsPermanentlyBlocked(false);
          }
          handleVoiceSearch();
        }}
      />

      {/* ACTIVE VOICE VISUALIZER */}
      <VoiceVisualizer 
        isListening={isListening}
        transcript={voiceTranscript}
        onClose={stopListening}
      />
    </header>
  );
};
