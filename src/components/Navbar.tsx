import React, { useState } from 'react';
import { 
  Compass, 
  Search, 
  Sparkles, 
  Bookmark, 
  Calendar, 
  Layers, 
  Globe, 
  ChevronUp, 
  ChevronDown, 
  Sun,
  Check,
  X
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  watchlistCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onUnlockAdmin: () => void;
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
  onUnlockAdmin
}) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    const newCount = logoClicks + 1;
    if (newCount >= 5) {
      setLogoClicks(0);
      onUnlockAdmin();
    } else {
      setLogoClicks(newCount);
      clickTimeoutRef.current = setTimeout(() => {
        setLogoClicks(0);
      }, 3000);
      setActiveTab('home');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0a0c14]/95 backdrop-blur-md border-b border-[#1c1c26] h-[66px] font-['Inter',sans-serif]">
      <div className="w-full max-w-[510px] mx-auto px-3.5 h-full flex items-center justify-between">
        
        {/* Left: anidub INDIA Logo */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center cursor-pointer select-none py-1 group shrink-0"
          title="anidub INDIA"
        >
          <img 
            src="/anidub-logo.svg" 
            alt="anidub INDIA" 
            className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-[1.02] active:scale-[0.98]"
          />
        </div>

        {/* Search Overlay */}
        {showSearchInput && (
          <div className="absolute inset-x-0 top-0 h-[66px] bg-[#0a0a10] px-4 flex items-center z-50 border-b border-[#1c1c26]">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              autoFocus
              placeholder="Search anime, genres, dub languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button 
              onClick={() => { setShowSearchInput(false); }}
              className="p-1.5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Right: Exact order & styling */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          
          {/* 1. Compass (has box & border) */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Explore Catalog"
            className="w-[36px] h-[36px] rounded-xl bg-[rgba(139,92,246,0.2)] border border-[#7c3aed] text-[#a78bfa] flex items-center justify-center transition-all shadow-sm"
          >
            <Compass className="w-5 h-5" />
          </button>

          {/* 2. Search (plain icon in tap target) */}
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
            title="Search"
            className="w-[38px] h-[38px] bg-transparent border-0 hover:bg-white/5 rounded-xl text-[#cbd5e1] flex items-center justify-center transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* 3. Sparkles (plain icon) */}
          <button
            onClick={() => setActiveTab('recommender')}
            title="AI Recommender"
            className="w-[38px] h-[38px] bg-transparent border-0 hover:bg-white/5 rounded-xl text-[#cbd5e1] flex items-center justify-center transition-colors"
          >
            <Sparkles className="w-5 h-5" />
          </button>

          {/* 4. Bookmark (plain icon, badge ONLY when count > 0) */}
          <button
            onClick={() => setActiveTab('watchlist')}
            title="Saved Watchlist"
            className="w-[38px] h-[38px] bg-transparent border-0 hover:bg-white/5 rounded-xl text-[#cbd5e1] flex items-center justify-center relative transition-colors"
          >
            <Bookmark className="w-5 h-5" />
            {watchlistCount > 0 && (
              <span className="absolute top-1 right-1 bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* 5. Calendar (plain icon) */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Schedule & Releases"
            className="w-[38px] h-[38px] bg-transparent border-0 hover:bg-white/5 rounded-xl text-[#cbd5e1] flex items-center justify-center transition-colors"
          >
            <Calendar className="w-5 h-5" />
          </button>

          {/* 6. Avatar (30px circle Naruto avatar with 2px ring) */}
          <div className="w-[30px] h-[30px] rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-white/35 shadow-sm cursor-pointer shrink-0" title="User Profile">
            <span className="text-xs">🍥</span>
          </div>

          {/* 7. Layers (plain icon) */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Collections"
            className="w-[38px] h-[38px] bg-transparent border-0 hover:bg-white/5 rounded-xl text-[#cbd5e1] flex items-center justify-center transition-colors"
          >
            <Layers className="w-5 h-5" />
          </button>

          {/* 8. Language pill (~59x33, rounded-full, dark bg, purple-tinted border) */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="w-[59px] h-[33px] px-2.5 rounded-full bg-[#0f1328] border border-purple-500/40 text-purple-300 hover:text-white flex items-center justify-between text-xs font-semibold transition-colors shadow-sm"
            >
              <Globe className="w-4 h-4 shrink-0" />
              {isLangOpen ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0E131F] border border-slate-700/80 shadow-2xl p-2 z-50">
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  SELECT LANGUAGE
                </div>
                <div className="py-1 space-y-0.5">
                  {LANGUAGES.map((lang) => {
                    const isSelected = selectedLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setSelectedLang(lang.code);
                          setIsLangOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                          isSelected 
                            ? 'bg-purple-950/60 text-purple-200 font-bold' 
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="text-base">{lang.flag}</span>
                          <div>
                            <div className="font-semibold text-white text-xs">{lang.native}</div>
                            <div className="text-[10px] text-slate-400">{lang.english}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-purple-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 9. Theme toggle (34px, rounded-xl, bg #1a1a1f, 1px #2d2d34 border, amber #fbbf24 sun) */}
          <button
            title="Theme Toggle"
            className="w-[34px] h-[34px] rounded-xl bg-[#1a1a1f] border border-[#2d2d34] text-[#fbbf24] hover:bg-amber-500/10 flex items-center justify-center transition-colors shrink-0 shadow-sm"
          >
            <Sun className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
};
