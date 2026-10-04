import React from 'react';
import { 
  Compass, 
  Sparkles, 
  Bookmark, 
  User,
  Search
} from 'lucide-react';
import { NavTab } from './Navbar';
import { SupportedLanguage, translate } from '../utils/i18n';

interface BottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  watchlistCount: number;
  uiLanguage: SupportedLanguage;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  uiLanguage
}) => {
  return (
    <nav 
      aria-label="Mobile Navigation"
      className="sticky top-16 z-30 w-full bg-[#0b0f17]/95 backdrop-blur-xl border-b border-neutral-800/80 px-2 py-2 flex items-center justify-around sm:hidden shadow-lg transition-all"
    >
      <div className="w-full max-w-md mx-auto grid grid-cols-5 place-items-center">
        {/* Directory / Library */}
        <button
          onClick={() => setActiveTab('library')}
          aria-label={translate('navDirectory', uiLanguage)}
          title={translate('navDirectory', uiLanguage)}
          className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 active:scale-90 cursor-pointer ${
            activeTab === 'library'
              ? 'text-purple-400 bg-purple-500/15 border border-purple-500/30 shadow-[0_0_14px_rgba(168,85,247,0.35)]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
          }`}
        >
          <Compass className={`w-6 h-6 transition-transform duration-200 ${activeTab === 'library' ? 'scale-110' : ''}`} />
        </button>

        {/* Search */}
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
          aria-label="Search"
          title="Search Anime"
          className="flex items-center justify-center w-11 h-11 rounded-2xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 transition-all duration-300 active:scale-90 cursor-pointer"
        >
          <Search className="w-6 h-6" />
        </button>

        {/* For You */}
        <button
          onClick={() => setActiveTab('foryou')}
          aria-label={translate('navForYou', uiLanguage)}
          title={translate('navForYou', uiLanguage)}
          className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 active:scale-90 cursor-pointer ${
            activeTab === 'foryou'
              ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
          }`}
        >
          <Sparkles className={`w-6 h-6 transition-transform duration-200 ${activeTab === 'foryou' ? 'scale-110' : ''}`} />
        </button>

        {/* Watchlist */}
        <button
          onClick={() => setActiveTab('watchlist')}
          aria-label={translate('navWatchlist', uiLanguage)}
          title={translate('navWatchlist', uiLanguage)}
          className={`relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 active:scale-90 cursor-pointer ${
            activeTab === 'watchlist'
              ? 'text-purple-400 bg-purple-500/15 border border-purple-500/30 shadow-[0_0_14px_rgba(168,85,247,0.35)]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
          }`}
        >
          <Bookmark className={`w-6 h-6 transition-transform duration-200 ${activeTab === 'watchlist' ? 'fill-purple-400/20 scale-110' : ''}`} />
          {watchlistCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-black rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 border-2 border-[#0b0f17] shadow-md animate-in zoom-in-50">
              {watchlistCount}
            </span>
          )}
        </button>

        {/* User Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          aria-label={translate('navProfile', uiLanguage)}
          title={translate('navProfile', uiLanguage)}
          className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 active:scale-90 cursor-pointer ${
            activeTab === 'profile'
              ? 'text-purple-400 bg-purple-500/15 border border-purple-500/30 shadow-[0_0_14px_rgba(168,85,247,0.35)]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
          }`}
        >
          <User className={`w-6 h-6 transition-transform duration-200 ${activeTab === 'profile' ? 'scale-110' : ''}`} />
        </button>
      </div>
    </nav>
  );
};
