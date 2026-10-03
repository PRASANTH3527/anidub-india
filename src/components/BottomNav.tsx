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
    <nav className="fixed top-16 left-0 right-0 z-50 bg-[#0b0f17]/90 backdrop-blur-xl border-b border-neutral-800/60 px-2 py-1 flex items-center justify-around sm:hidden shadow-[0_10px_30px_rgba(0,0,0,0.4)] animate-in slide-in-from-top duration-300">
      {/* Directory */}
      <button
        onClick={() => setActiveTab('library')}
        className={`flex flex-col items-center gap-1 p-2 transition-all active:scale-90 ${
          activeTab === 'library' ? 'text-primary-theme' : 'text-neutral-500'
        }`}
      >
        <Compass className={`w-6 h-6 ${activeTab === 'library' ? 'fill-primary-theme/10' : ''}`} />
        <span className="text-[10px] font-black uppercase tracking-tighter">
          {translate('navDirectory', uiLanguage)}
        </span>
      </button>

      {/* Search Trigger */}
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
        className="flex flex-col items-center gap-1 p-2 text-neutral-500 active:scale-90 transition-all"
      >
        <Search className="w-6 h-6" />
        <span className="text-[10px] font-black uppercase tracking-tighter">Search</span>
      </button>

      {/* For You */}
      <button
        onClick={() => setActiveTab('foryou')}
        className={`flex flex-col items-center gap-1 p-2 transition-all active:scale-90 ${
          activeTab === 'foryou' ? 'text-accent-theme' : 'text-neutral-500'
        }`}
      >
        <Sparkles className={`w-6 h-6 ${activeTab === 'foryou' ? 'fill-accent-theme/10' : ''}`} />
        <span className="text-[10px] font-black uppercase tracking-tighter">
          {translate('navForYou', uiLanguage)}
        </span>
      </button>

      {/* Watchlist */}
      <button
        onClick={() => setActiveTab('watchlist')}
        className={`flex flex-col items-center gap-1 p-2 transition-all active:scale-90 relative ${
          activeTab === 'watchlist' ? 'text-primary-theme' : 'text-neutral-500'
        }`}
      >
        <Bookmark className={`w-6 h-6 ${activeTab === 'watchlist' ? 'fill-primary-theme/10' : ''}`} />
        <span className="text-[10px] font-black uppercase tracking-tighter">
          {translate('navWatchlist', uiLanguage)}
        </span>
        {watchlistCount > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-primary-theme text-white text-[9px] font-black rounded-full px-1 min-w-[14px] text-center border-2 border-[#0b0f17]">
            {watchlistCount}
          </span>
        )}
      </button>

      {/* Profile */}
      <button
        onClick={() => setActiveTab('profile')}
        className={`flex flex-col items-center gap-1 p-2 transition-all active:scale-90 ${
          activeTab === 'profile' ? 'text-primary-theme' : 'text-neutral-500'
        }`}
      >
        <User className={`w-6 h-6 ${activeTab === 'profile' ? 'fill-primary-theme/10' : ''}`} />
        <span className="text-[10px] font-black uppercase tracking-tighter">
          {translate('navProfile', uiLanguage)}
        </span>
      </button>
    </nav>
  );
};
