import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
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
  User,
  MessageSquare,
  Mic
} from 'lucide-react';
import { useToast } from './Toast';
import { MicPermissionBottomSheet } from './MicPermissionBottomSheet';
import { VoiceVisualizer } from './VoiceVisualizer';

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
  onSelectAnime,
  feedView = 'library',
  setFeedView,
  isAdminAuthenticated,
  onLogout
}) => {
  const shouldReduceMotion = useReducedMotion();
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
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-3">
        
        {/* LEFT: BRAND LOGO WITH 5-TAP ADMIN TRIGGER (Fade in from top) */}
        <motion.div 
          onClick={handleLogoClick}
          initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
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
        </motion.div>

        {/* CENTER SCROLLABLE NAVIGATION ICONS */}
        <nav className="flex items-center gap-1 sm:gap-1.5 flex-grow overflow-x-auto no-scrollbar py-1 justify-center sm:justify-start">
          
          {/* 0. Home Screen / Hero Button */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => {
              setActiveTab('home');
              if (setFeedView) setFeedView('library');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title="Home Screen & Featured Feed"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              activeTab === 'home' && feedView === 'library'
                ? 'bg-[var(--primary-accent)]/20 text-accent-theme border border-primary-theme shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 sm:w-5 sm:h-5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </motion.button>

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

          {/* 2. Search (Mobile Search Drawer Trigger) */}
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => setIsMobileSearchExpanded(!isMobileSearchExpanded)}
            title="Quick Search"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
              isMobileSearchExpanded
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
              <User className="w-3.5 h-3.5" />
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


          {/* Language Switcher */}
          <div className="relative">
            <motion.button
              whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/70 border border-neutral-700/40 text-neutral-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              title="Change Language"
            >
              <Globe className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </motion.button>

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
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
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
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/70 border border-neutral-700/40 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Toggle Visual Theme"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-300" />
            )}
          </motion.button>
        </div>
      </div>

      {/* MOBILE EXPANDABLE SEARCH DRAWER */}
      <AnimatePresence>
        {isMobileSearchExpanded && (
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full px-3 py-2 border-t border-neutral-800/60 bg-[#0d121e]/98 flex items-center gap-2 overflow-hidden"
          >
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder={isListening ? "Listening..." : "Search anime by title, voice actor, or studio..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-[#131926] border rounded-xl pl-9 pr-14 py-2 text-xs text-white placeholder-neutral-500 outline-none transition-colors ${
                  isListening 
                    ? 'border-purple-500/80 ring-4 ring-purple-500/20 bg-purple-950/20 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse placeholder-purple-300' 
                    : 'border-neutral-700/80 focus:border-purple-500'
                }`}
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-neutral-400 hover:text-white"
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
              onClick={() => setIsMobileSearchExpanded(false)}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors cursor-pointer"
              title="Close Search"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
