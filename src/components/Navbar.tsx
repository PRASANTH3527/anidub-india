import React from 'react';
import { Cloud, Database, Cpu, Film, Bookmark, Sparkles, ShieldCheck, Search, Image as ImageIcon, User } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  watchlistCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  searchQuery,
  setSearchQuery
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('catalog')} 
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-lg text-white tracking-tight font-['Space_Grotesk',sans-serif]">Cloudflare</span>
              <span className="text-orange-500 font-bold text-lg font-['Space_Grotesk',sans-serif]">Anime</span>
            </div>
            <div className="flex items-center space-x-2 text-[10px] text-orange-400/90 font-medium tracking-wide uppercase">
              <span className="flex items-center"><Database className="w-3 h-3 mr-0.5 inline" /> D1 SQL</span>
              <span>•</span>
              <span className="flex items-center"><ImageIcon className="w-3 h-3 mr-0.5 inline" /> ImgBB</span>
              <span>•</span>
              <span className="flex items-center"><Cpu className="w-3 h-3 mr-0.5 inline" /> Workers</span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'catalog' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 relative ${
              activeTab === 'watchlist' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Watchlist</span>
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {watchlistCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cloudflare')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'cloudflare' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4 text-orange-400" />
            <span>CF & D1 Console</span>
          </button>

          <button
            onClick={() => setActiveTab('recommender')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'recommender' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Recommender</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'admin' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Admin & ImgBB</span>
          </button>
        </nav>

        {/* Search & User Profile Button */}
        <div className="flex items-center space-x-3">
          <div className="relative hidden lg:block w-44 xl:w-56">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search anime, genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Regional Anime Directory Badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-semibold text-orange-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Indian Anime Directory</span>
          </div>

          {/* Mobile Tab Toggles */}
          <div className="flex md:hidden space-x-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`p-2 rounded-lg ${activeTab === 'catalog' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-300'}`}
            >
              <Film className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('cloudflare')}
              className={`p-2 rounded-lg ${activeTab === 'cloudflare' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-300'}`}
            >
              <Cloud className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`p-2 rounded-lg ${activeTab === 'admin' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-300'}`}
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
