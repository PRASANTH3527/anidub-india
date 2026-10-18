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
    <header className="sticky top-0 z-50 bg-[#0a0a10]/90 backdrop-blur-md border-b border-purple-500/20 h-[56px] pl-[12px] font-['Inter',sans-serif]">
      <div className="w-full max-w-[420px] mx-auto h-full flex items-center justify-between">
        
        {/* Logo (~84px wide block) */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center space-x-2 cursor-pointer select-none group shrink-0"
          title="anidub INDIA"
        >
          {/* Mark 20px */}
          <div className="w-[20px] h-[20px] shrink-0 flex items-center justify-center text-[#ff6a00]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>

          {/* Text block */}
          <div className="flex flex-col justify-center leading-none">
            <span className="font-bold text-[18px] text-[#ff6a00] tracking-[-0.03em]" style={{ lineHeight: 1 }}>
              anidub
            </span>
            <div className="flex items-center space-x-1 mt-0.5">
              <span className="font-bold text-[8px] text-[#e5e7eb] tracking-[0.25em]" style={{ lineHeight: 1 }}>
                INDIA
              </span>
              <div className="flex items-center space-x-[1px]">
                <span className="w-[7px] h-[7px] rounded-full bg-[#ff9933] inline-block" />
                <span className="w-[7px] h-[7px] rounded-full bg-white inline-block" />
                <span className="w-[7px] h-[7px] rounded-full bg-[#138808] inline-block" />
              </div>
            </div>
          </div>
        </div>

        {/* Search Overlay */}
        {showSearchInput && (
          <div className="absolute inset-x-0 top-0 h-[56px] bg-[#0a0a10] px-3 flex items-center z-50 border-b border-[#1c1c26]">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              autoFocus
              placeholder="Search anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button 
              onClick={() => { setShowSearchInput(false); }}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right Icons & Controls (flex-shrink 0, no overflow) */}
        <div className="flex items-center shrink-0 space-x-1 pr-[6px]">
          
          {/* Compass */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Explore Catalog"
            className={`w-[32px] h-[32px] rounded-[10px] flex items-center justify-center shrink-0 shadow-sm transition-colors ${
              activeTab === 'catalog' || activeTab === 'home'
                ? 'bg-[#2e1065] border border-[#7e22ce] text-[#c084fc]'
                : 'bg-transparent border-0 text-[#cbd5e1] hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
          </button>

          {/* Search */}
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
            title="Search"
            className="w-[30px] h-[30px] bg-transparent border-0 text-[#cbd5e1] hover:text-white flex items-center justify-center shrink-0"
          >
            <Search className="w-[17px] h-[17px]" />
          </button>

          {/* Sparkles */}
          <button
            onClick={() => setActiveTab('catalog')}
            title="Recommendations"
            className="w-[30px] h-[30px] bg-transparent border-0 text-[#cbd5e1] hover:text-white flex items-center justify-center shrink-0"
          >
            <Sparkles className="w-[17px] h-[17px]" />
          </button>

          {/* Bookmark */}
          <button
            onClick={() => setActiveTab('watchlist')}
            title="Saved Watchlist"
            className={`w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shrink-0 relative transition-colors ${
              activeTab === 'watchlist'
                ? 'bg-[#1f122b] border border-[#f43f5e]/60 text-[#fb7185]'
                : 'bg-transparent border-0 text-[#cbd5e1] hover:text-white'
            }`}
          >
            <Bookmark className="w-[17px] h-[17px]" />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">
                {watchlistCount}
              </span>
            )}
          </button>

          {/* Calendar */}
          <button
            onClick={() => setActiveTab('schedule')}
            title="Schedule & Releases"
            className={`w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shrink-0 transition-colors ${
              activeTab === 'schedule'
                ? 'bg-[#2e1065] border border-[#7e22ce] text-[#c084fc] shadow-sm'
                : 'bg-transparent border-0 text-[#cbd5e1] hover:text-white'
            }`}
          >
            <Calendar className="w-[17px] h-[17px]" />
          </button>

          {/* Avatar (Zoro green-haired anime avatar) */}
          <div 
            className="w-[26px] h-[26px] rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-purple-500/40 shadow-sm cursor-pointer shrink-0" 
            title="User Profile"
          >
            <img 
              src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100&auto=format&fit=crop&q=80" 
              alt="Avatar" 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=100&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          {/* Language pill: 文A தமிழ் */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="h-[26px] px-2.5 rounded-full bg-[#2e1065] border border-[#7e22ce] text-[#d8b4fe] hover:text-white flex items-center gap-1 text-[11px] font-semibold transition-colors shadow-sm"
            >
              <span>文A</span>
              <span>தமிழ்</span>
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

          {/* Theme toggle: circular with amber Sun */}
          <button
            title="Theme Toggle"
            className="w-[26px] h-[26px] rounded-full bg-[#111726] border border-[#1e263d] text-amber-400 hover:bg-amber-500/10 flex items-center justify-center shrink-0 shadow-sm"
          >
            <Sun className="w-[13px] h-[13px]" />
          </button>

        </div>

      </div>
    </header>
  );
};
