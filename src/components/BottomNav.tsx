import React from 'react';
import { Compass, Sparkles, Search, Bookmark, Calendar, User } from 'lucide-react';
import { NavTab } from './Navbar';
import { SupportedLanguage, translate } from '../utils/i18n';

interface BottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  feedView?: 'directory' | 'foryou';
  setFeedView?: (view: 'directory' | 'foryou') => void;
  watchlistCount: number;
  avatar?: string;
  uiLanguage?: SupportedLanguage;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  feedView = 'directory',
  setFeedView,
  watchlistCount,
  avatar,
  uiLanguage = 'en',
}) => {
  const lang = uiLanguage || 'en';

  const handleDirectoryClick = () => {
    if (setFeedView) setFeedView('directory');
    setActiveTab('library');
    window.location.hash = 'library';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleForYouClick = () => {
    if (setFeedView) setFeedView('foryou');
    setActiveTab('foryou');
    window.location.hash = 'foryou';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchClick = () => {
    setActiveTab('library');
    if (setFeedView) setFeedView('directory');
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]');
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const isDirectoryActive = (activeTab === 'library' && feedView !== 'foryou');
  const isForYouActive = (activeTab === 'foryou' || (activeTab === 'library' && feedView === 'foryou'));

  return (
    <nav 
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0b0f17]/95 backdrop-blur-2xl border-t border-neutral-800/90 shadow-[0_-8px_30px_rgba(0,0,0,0.8)] pb-[max(env(safe-area-inset-bottom),4px)] pt-1 px-1 transition-all"
    >
      <div className="flex items-center justify-around w-full max-w-lg mx-auto">
        {/* 1. Directory Tab */}
        <button
          type="button"
          onClick={handleDirectoryClick}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all active:scale-90 cursor-pointer flex-1 min-w-0 ${
            isDirectoryActive
              ? 'text-accent-theme font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${isDirectoryActive ? 'bg-[var(--primary-accent)]/20 shadow-sm' : ''}`}>
            <Compass className={`w-5 h-5 ${isDirectoryActive ? 'scale-110 text-accent-theme' : ''}`} />
          </div>
          <span className="text-[10px] leading-tight mt-0.5 truncate font-bold">
            {translate('navDirectory', lang)}
          </span>
        </button>

        {/* 2. For You Tab */}
        <button
          type="button"
          onClick={handleForYouClick}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all active:scale-90 cursor-pointer flex-1 min-w-0 ${
            isForYouActive
              ? 'text-amber-400 font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${isForYouActive ? 'bg-amber-500/20 shadow-sm' : ''}`}>
            <Sparkles className={`w-5 h-5 ${isForYouActive ? 'scale-110 text-amber-400' : ''}`} />
          </div>
          <span className="text-[10px] leading-tight mt-0.5 truncate font-bold">
            {translate('navForYou', lang)}
          </span>
        </button>

        {/* 3. Search Bar Focus Tab */}
        <button
          type="button"
          onClick={handleSearchClick}
          className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all active:scale-90 cursor-pointer flex-1 min-w-0 text-neutral-400 hover:text-neutral-200"
        >
          <div className="p-1 rounded-xl hover:bg-neutral-800/60 transition-all">
            <Search className="w-5 h-5" />
          </div>
          <span className="text-[10px] leading-tight mt-0.5 truncate font-bold">
            Search
          </span>
        </button>

        {/* 4. Watchlist Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('watchlist');
            window.location.hash = 'watchlist';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all active:scale-90 cursor-pointer flex-1 min-w-0 ${
            activeTab === 'watchlist'
              ? 'text-accent-theme font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-all ${activeTab === 'watchlist' ? 'bg-[var(--primary-accent)]/20 shadow-sm' : ''}`}>
            <Bookmark className={`w-5 h-5 ${activeTab === 'watchlist' ? 'scale-110 fill-current text-accent-theme' : ''}`} />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 btn-primary-theme text-white text-[9px] font-black rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 border border-[#0b0f17] shadow-sm">
                {watchlistCount}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-tight mt-0.5 truncate font-bold">
            {translate('navWatchlist', lang)}
          </span>
        </button>

        {/* 5. Airing Schedule Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('schedule');
            window.location.hash = 'schedule';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all active:scale-90 cursor-pointer flex-1 min-w-0 ${
            activeTab === 'schedule'
              ? 'text-accent-theme font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeTab === 'schedule' ? 'bg-[var(--primary-accent)]/20 shadow-sm' : ''}`}>
            <Calendar className={`w-5 h-5 ${activeTab === 'schedule' ? 'scale-110 text-accent-theme' : ''}`} />
          </div>
          <span className="text-[10px] leading-tight mt-0.5 truncate font-bold">
            Schedule
          </span>
        </button>

        {/* 6. Profile Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('profile');
            window.location.hash = 'profile';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all active:scale-90 cursor-pointer flex-1 min-w-0 ${
            activeTab === 'profile'
              ? 'text-accent-theme font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-[var(--primary-accent)]/20 shadow-sm' : ''}`}>
            {avatar ? (
              <div 
                className="w-5 h-5 rounded-full overflow-hidden border shrink-0"
                style={{
                  borderColor: activeTab === 'profile' ? 'var(--primary-accent)' : 'var(--primary-border)',
                }}
              >
                <img src={avatar} alt="Profile" className="w-full h-full object-cover object-top" />
              </div>
            ) : (
              <User className={`w-5 h-5 ${activeTab === 'profile' ? 'scale-110 text-accent-theme' : ''}`} />
            )}
          </div>
          <span className="text-[10px] leading-tight mt-0.5 truncate font-bold">
            {translate('navProfile', lang)}
          </span>
        </button>
      </div>
    </nav>
  );
};
