import React, { useState } from 'react';
import { 
  Volume2, 
  Compass, 
  Search, 
  Sparkles, 
  Bookmark, 
  Calendar, 
  Layers, 
  Globe, 
  ChevronUp, 
  ChevronDown, 
  Moon, 
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

  return (
    <header className="sticky top-0 z-50 bg-[#0b0f19]/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Clean Text Logo with 5-click Easter Egg for Admin Unlock */}
        <div 
          onClick={() => {
            const newCount = logoClicks + 1;
            setLogoClicks(newCount);
            if (newCount === 5) {
              setLogoClicks(0);
              onUnlockAdmin();
            } else {
              setActiveTab('catalog');
            }
          }} 
          className="flex items-center space-x-2 cursor-pointer group select-none"
          title="anidub INDIA"
        >
          {/* Small orange audio horn icon from reference screenshot */}
          <div className="text-orange-500">
            <Volume2 className="w-5 h-5 fill-orange-500 text-orange-500" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1 leading-none">
              <span className="font-bold text-lg text-white font-['Space_Grotesk',sans-serif] tracking-tight">anidub</span>
              <span className="font-bold text-lg text-orange-500 font-['Space_Grotesk',sans-serif]">INDIA</span>
            </div>
            <div className="flex items-center space-x-1 text-[8px] font-bold text-slate-500 tracking-wider uppercase mt-0.5">
              <span>INDIA</span>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>
          </div>
        </div>

        {/* Search Overlay (if active) */}
        {showSearchInput && (
          <div className="absolute inset-x-0 top-0 h-16 bg-[#0B0F17] px-4 flex items-center z-50 border-b border-slate-800">
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

        {/* Small Horizontal Nav Icons (Pixel-perfect to reference screenshot) */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* 1. Compass / Explore icon in purple circle */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Explore Catalog"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              activeTab === 'catalog' 
                ? 'bg-purple-900/60 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]' 
                : 'text-slate-400 hover:text-purple-300 hover:bg-slate-900'
            }`}
          >
            <Compass className="w-4 h-4" />
          </button>

          {/* 2. Search Icon */}
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
            title="Search"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* 3. AI Recommender / Sparkles */}
          <button
            onClick={() => setActiveTab('recommender')}
            title="AI Recommender"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              activeTab === 'recommender'
                ? 'bg-purple-900/60 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* 4. Bookmark / Saved Watchlist */}
          <button
            onClick={() => setActiveTab('watchlist')}
            title="Saved Watchlist"
            className={`w-8 h-8 rounded-full flex items-center justify-center relative transition-all ${
              activeTab === 'watchlist'
                ? 'bg-purple-900/60 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'text-slate-400 hover:text-orange-400 hover:bg-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* 5. Calendar / Schedule */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Schedule & Releases"
            className="w-8 h-8 rounded-full hidden xs:flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <Calendar className="w-4 h-4" />
          </button>

          {/* 6. Naruto Avatar Icon matching reference screenshot */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center overflow-hidden border border-amber-400/50 shadow-sm cursor-pointer shrink-0" title="User Profile">
            <span className="text-xs">🍥</span>
          </div>



          {/* 7. Layers Icon */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Collections"
            className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* 8. Language Selector Pill (🌐 ^) with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-purple-300 hover:text-white text-xs font-semibold hover:border-purple-500/50 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {isLangOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Language Dropdown (Exact match to screenshot) */}
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

          {/* 9. Moon Theme Icon */}
          <button
            title="Dark Theme Active"
            className="w-8 h-8 rounded-full flex items-center justify-center text-purple-400 hover:bg-slate-900 transition-colors"
          >
            <Moon className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
};
