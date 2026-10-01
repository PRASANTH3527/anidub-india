import React from 'react';
import { 
  Bookmark, 
  Sparkles, 
  PlusCircle, 
  Compass, 
  Calendar, 
  Film, 
  User, 
  LogIn 
} from 'lucide-react';
import { authService } from '../services/authService';

export type NavTab = 'library' | 'recommendations' | 'schedule' | 'profile';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  watchlistCount: number;
  onOpenSuggestModal: () => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  onOpenSuggestModal,
  onOpenAuthModal,
}) => {
  const currentUser = authService.getCurrentUser();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b0f17]/90 backdrop-blur-md border-b border-neutral-800/80">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('library')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none shrink-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30 group-hover:scale-105 transition-transform duration-200">
            <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-black text-lg sm:text-xl tracking-tight text-white">
                Ani<span className="text-purple-400">Dub</span>
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-white to-green-500 bg-clip-text text-transparent font-bold text-[10px] tracking-wider uppercase border border-neutral-700/60 rounded px-1 py-0.2">
                India
              </span>
            </div>
            <span className="text-[9px] text-neutral-400 font-medium hidden md:inline -mt-0.5">
              Regional Dub Directory
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Dub Library</span>
            <span className="sm:hidden">Library</span>
          </button>

          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === 'recommendations'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
            <span className="hidden md:inline">Recommendations</span>
            <span className="md:hidden">Match</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden md:inline">Airing Now</span>
            <span className="md:hidden">Airing</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Profile</span>
            {watchlistCount > 0 && (
              <span className="bg-purple-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center -ml-0.5">
                {watchlistCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Action Toolbar: Add Dub & Google Auth Profile */}
        <div className="flex items-center gap-2">
          {/* Add Dub CTA Button */}
          <button
            onClick={onOpenSuggestModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer group shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 group-hover:rotate-90 transition-transform duration-200" />
            <span className="hidden sm:inline">Submit Dub</span>
            <span className="sm:hidden">Submit</span>
          </button>

          {/* User Auth Avatar / Login */}
          {currentUser ? (
            <div 
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 pl-1 cursor-pointer group"
              title={`Logged in as ${currentUser.displayName} (${currentUser.role})`}
            >
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                className="w-8 h-8 rounded-full object-cover border border-purple-500/60 group-hover:border-purple-400 transition-colors shadow"
              />
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Login</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
