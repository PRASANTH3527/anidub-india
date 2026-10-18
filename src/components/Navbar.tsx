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
      setActiveTab('catalog');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a10]/90 backdrop-blur-md border-b border-[#1c1c26] h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        
        {/* Left: Logo mark + stacked wordmark */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center space-x-2.5 cursor-pointer group select-none"
          title="anidub INDIA"
        >
          {/* Logo Mark: Orange gradient play-triangle with headphone/sound arcs */}
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-sm shrink-0">
            <svg className="w-3.5 h-3.5 text-white fill-white" viewBox="0 0 24 24">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          {/* Stacked Wordmark */}
          <div className="flex flex-col">
            <span className="font-bold text-[20px] text-[#ff6a00] font-['Space_Grotesk',sans-serif] tracking-tight leading-none lowercase">
              anidub
            </span>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="font-bold text-[10px] text-slate-400 font-['Space_Grotesk',sans-serif] tracking-[0.2em] uppercase leading-none">
                INDIA
              </span>
              <div className="flex items-center space-x-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff9933]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#138808]"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Overlay */}
        {showSearchInput && (
          <div className="absolute inset-x-0 top-0 h-16 bg-[#0a0a10] px-4 flex items-center z-50 border-b border-[#1c1c26]">
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

        {/* Right: Exact order 34px buttons, 4px gap, 20px icons */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          
          {/* 1. Compass */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Explore Catalog"
            className={`w-[34px] h-[34px] rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'catalog' 
                ? 'bg-purple-950/60 text-purple-300 border border-purple-500/50 shadow-sm' 
                : 'bg-[#0f1328] border border-[#1d2542] text-slate-300 hover:text-purple-300'
            }`}
          >
            <Compass className="w-5 h-5" />
          </button>

          {/* 2. Search */}
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
            title="Search"
            className="w-[34px] h-[34px] rounded-xl bg-[#0f1328] border border-[#1d2542] text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* 3. Sparkles */}
          <button
            onClick={() => setActiveTab('recommender')}
            title="AI Recommender"
            className={`w-[34px] h-[34px] rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'recommender'
                ? 'bg-purple-950/60 text-purple-300 border border-purple-500/50 shadow-sm'
                : 'bg-[#0f1328] border border-[#1d2542] text-slate-300 hover:text-amber-400'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </button>

          {/* 4. Bookmark (Badge ONLY when count > 0) */}
          <button
            onClick={() => setActiveTab('watchlist')}
            title="Saved Watchlist"
            className={`w-[34px] h-[34px] rounded-xl flex items-center justify-center relative transition-all ${
              activeTab === 'watchlist'
                ? 'bg-purple-950/60 text-purple-300 border border-purple-500/50 shadow-sm'
                : 'bg-[#0f1328] border border-[#1d2542] text-slate-300 hover:text-orange-400'
            }`}
          >
            <Bookmark className="w-5 h-5" />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* 5. Calendar */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Schedule & Releases"
            className="w-[34px] h-[34px] rounded-xl bg-[#0f1328] border border-[#1d2542] text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <Calendar className="w-5 h-5" />
          </button>

          {/* 6. Avatar (28px circle, Naruto anime character avatar, thin light ring) */}
          <div className="w-[28px] h-[28px] rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center overflow-hidden border border-white/25 shadow-sm cursor-pointer shrink-0" title="User Profile">
            <span className="text-xs">🍥</span>
          </div>

          {/* 7. Layers (my collections) */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Collections"
            className="w-[34px] h-[34px] rounded-xl bg-[#0f1328] border border-[#1d2542] text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <Layers className="w-5 h-5" />
          </button>

          {/* 8. Language pill (purple globe + chevron-down, rounded-full, ~60x34, purple-tinted border) */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="h-[34px] px-3 rounded-full bg-[#0f1328] border border-purple-500/40 text-purple-300 hover:text-white flex items-center space-x-1.5 text-xs font-semibold transition-colors"
            >
              <Globe className="w-4 h-4" />
              {isLangOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
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

          {/* 9. Theme toggle (amber sun in 34px rounded-xl dark button with 1px border) */}
          <button
            title="Theme Toggle"
            className="w-[34px] h-[34px] rounded-xl bg-[#0f1328] border border-[#1d2542] text-amber-400 hover:bg-amber-500/10 flex items-center justify-center transition-colors"
          >
            <Sun className="w-5 h-5" />
          </button>

        </div>

      </div>
    </header>
  );
};
