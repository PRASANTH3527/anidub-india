import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../lib/clerk';
import {
  Compass,
  Bookmark,
  Calendar,
  Trophy,
  User,
  MessageSquare,
  ShieldCheck,
  Shield,
  MoreHorizontal,
  Sparkles,
  Plus,
  MessageCircleHeart,
  ChevronDown,
  X,
  Scale,
  FileText,
} from 'lucide-react';
import { AniDubLogo } from './AniDubLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  watchlistCount: number;
  onUnlockAdmin: () => void;
  onOpenCollection?: () => void;
  onOpenCompare?: () => void;
  onSelectAnime?: (id: number) => void;
  onSubmitDub?: () => void;
  feedView?: string;
  setFeedView?: (view: string) => void;
  isAdminAuthenticated?: boolean;
  onLogout?: () => void;
  userAvatar?: string;
  currentLang?: string;
  setCurrentLang?: (lang: string) => void;
  unreadAlertsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  onUnlockAdmin,
  onOpenCompare,
  onSubmitDub,
  setFeedView,
  isAdminAuthenticated,
  userAvatar,
  unreadAlertsCount = 0,
}) => {
  const { user } = useUser();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [moreMenuOpen]);

  const logoClickCountRef = useRef(0);
  const logoClickTimerRef = useRef<any>(null);

  const handleLogoClick = () => {
    logoClickCountRef.current += 1;
    clearTimeout(logoClickTimerRef.current);

    if (logoClickCountRef.current >= 5) {
      logoClickCountRef.current = 0;
      onUnlockAdmin();
      return;
    }

    logoClickTimerRef.current = setTimeout(() => {
      logoClickCountRef.current = 0;
    }, 1600);

    setActiveTab('explore');
    if (setFeedView) setFeedView('library');
  };

  const navigate = (tab: string, feed?: string) => {
    setMoreMenuOpen(false);
    setActiveTab(tab);
    if (setFeedView && feed) setFeedView(feed);
  };

  const isExploreActive = activeTab === 'explore' || activeTab === 'catalog';
  const isScheduleActive = activeTab === 'schedule';
  const isLibraryActive = activeTab === 'watchlist' || activeTab === 'library';
  const isProfileActive = activeTab === 'profile';
  const isChatActive = activeTab === 'chat';
  const isMoreActive =
    activeTab === 'foryou' ||
    activeTab === 'tierlist' ||
    activeTab === 'feedback' ||
    activeTab === 'privacy' ||
    activeTab === 'copyright' ||
    activeTab === 'admin';

  const primaryDesktopItems = [
    { id: 'explore', label: 'Explore', icon: Compass, active: isExploreActive, onClick: () => navigate('explore', 'library') },
    { id: 'schedule', label: 'Schedule', icon: Calendar, active: isScheduleActive, onClick: () => navigate('schedule') },
    {
      id: 'watchlist',
      label: 'Library',
      icon: Bookmark,
      active: isLibraryActive,
      badge: watchlistCount > 0 ? watchlistCount : undefined,
      onClick: () => navigate('watchlist'),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      active: isProfileActive,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      onClick: () => navigate('profile'),
    },
  ];

  const primaryMobileTabs = [
    { id: 'explore', label: 'Explore', icon: Compass, active: isExploreActive, onClick: () => navigate('explore', 'library') },
    { id: 'schedule', label: 'Schedule', icon: Calendar, active: isScheduleActive, onClick: () => navigate('schedule') },
    {
      id: 'watchlist',
      label: 'Library',
      icon: Bookmark,
      active: isLibraryActive,
      badge: watchlistCount > 0 ? watchlistCount : undefined,
      onClick: () => navigate('watchlist'),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      active: isProfileActive,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      onClick: () => navigate('profile'),
    },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-[#090d16]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* ZONE 1: Brand */}
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-2 select-none cursor-pointer shrink-0 focus:outline-none"
            aria-label="AniDub India Home"
          >
            <AniDubLogo size="md" showText={true} />
          </button>

          {/* ZONE 2: Desktop Primary Navigation (Visible Text Labels) */}
          <div className="hidden md:flex items-center gap-1">
            {primaryDesktopItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  aria-current={item.active ? 'page' : undefined}
                  className={`relative h-10 px-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    item.active
                      ? 'bg-purple-600/20 text-white border border-purple-500/40'
                      : 'text-neutral-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${item.active ? 'text-purple-300' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-bold leading-none tabular-nums">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ZONE 3: Install App + Community Chat Shortcut + More Menu + Admin */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" ref={moreMenuRef}>
            <div className="hidden lg:block">
              <PWAInstallButton variant="button" />
            </div>

            <button
              type="button"
              onClick={() => navigate('chat')}
              aria-label="Community Chat"
              title="Community Chat"
              className={`min-h-[40px] px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                isChatActive
                  ? 'bg-purple-600/20 text-white border-purple-500/40'
                  : 'bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 border-white/10'
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Chat</span>
            </button>

            {isAdminAuthenticated && (
              <button
                type="button"
                onClick={onUnlockAdmin}
                aria-label="Admin Dashboard"
                title="Admin Dashboard"
                className={`min-h-[40px] px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                  activeTab === 'admin'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                    : 'bg-white/5 text-amber-300 hover:bg-amber-500/15 border-white/10'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline">Admin</span>
              </button>
            )}

            {/* More Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                aria-expanded={moreMenuOpen}
                aria-haspopup="menu"
                aria-label="More navigation options"
                className={`min-h-[40px] px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                  moreMenuOpen || isMoreActive
                    ? 'bg-purple-600/20 text-white border-purple-500/40'
                    : 'bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 border-white/10'
                }`}
              >
                {moreMenuOpen ? (
                  <X className="w-4 h-4 shrink-0" />
                ) : (
                  <MoreHorizontal className="w-4 h-4 shrink-0" />
                )}
                <span className="hidden sm:inline">More</span>
                <ChevronDown className={`w-3.5 h-3.5 hidden sm:block transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#101624] border border-white/15 shadow-2xl p-1.5 z-50"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('foryou', 'foryou')}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'foryou'
                        ? 'bg-purple-600/20 text-white'
                        : 'text-neutral-200 hover:bg-white/5'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div>Find Your Next Anime</div>
                      <div className="text-[10px] text-neutral-400 font-normal">Filter by language &amp; OTT</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('chat')}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isChatActive ? 'bg-purple-600/20 text-white' : 'text-neutral-200 hover:bg-white/5'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div>Community Chat</div>
                      <div className="text-[10px] text-neutral-400 font-normal">Live Indian dub discussions</div>
                    </div>
                  </button>

                  {onOpenCompare && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onOpenCompare();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-neutral-200 hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Scale className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div>Compare Anime</div>
                        <div className="text-[10px] text-neutral-400 font-normal">Side-by-side dubs &amp; OTTs</div>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('tierlist')}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'tierlist' ? 'bg-purple-600/20 text-white' : 'text-neutral-200 hover:bg-white/5'
                    }`}
                  >
                    <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div>Tier List Maker</div>
                      <div className="text-[10px] text-neutral-400 font-normal">Rank your favorite dubs</div>
                    </div>
                  </button>

                  <PWAInstallButton
                    variant="menu-item"
                    onActionComplete={() => setMoreMenuOpen(false)}
                  />

                  <div className="my-1.5 border-t border-white/10" />

                  {onSubmitDub && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onSubmitDub();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-neutral-200 hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Submit an Anime or Dub</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('feedback')}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'feedback' ? 'bg-purple-600/20 text-white' : 'text-neutral-200 hover:bg-white/5'
                    }`}
                  >
                    <MessageCircleHeart className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Share Feedback</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('privacy')}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'privacy' || activeTab === 'copyright'
                        ? 'bg-purple-600/20 text-white'
                        : 'text-neutral-300 hover:bg-white/5'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span>Privacy &amp; Copyright</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onUnlockAdmin();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-neutral-300 hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    {isAdminAuthenticated ? (
                      <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Shield className="w-4 h-4 text-neutral-400 shrink-0" />
                    )}
                    <span>Admin Dashboard</span>
                  </button>
                </div>
              )}
            </div>

            {/* User Avatar quick shortcut on desktop */}
            {(user?.imageUrl || userAvatar) && (
              <button
                type="button"
                onClick={() => navigate('profile')}
                aria-label="Open Profile"
                className="hidden sm:flex w-9 h-9 rounded-full overflow-hidden border border-white/15 hover:border-purple-400 transition-colors cursor-pointer shrink-0"
              >
                <img
                  src={user?.imageUrl || userAvatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* MOBILE BOTTOM NAVIGATION BAR (4 Clear Predictable Destinations) */}
      <nav
        aria-label="Mobile primary navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#090d16]/95 backdrop-blur-xl border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="grid grid-cols-4 h-16 px-1">
          {primaryMobileTabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={item.active ? 'page' : undefined}
                aria-label={item.label}
                className={`relative flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] rounded-xl transition-colors cursor-pointer ${
                  item.active ? 'text-purple-300' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
