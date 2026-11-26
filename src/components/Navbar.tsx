import React, { useRef } from 'react';
import { useUser } from '../lib/clerk';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import { ShieldCheck } from 'lucide-react';
import { AniDubLogo } from './AniDubLogo';
import { PWAInstallButton } from './PWAInstallButton';
import {
  SignatureNavIcon,
  type NavTabIconName,
  type FeatureBarIconName,
} from './IconRegistry';
import { Button, IconButton } from './ui/Button';

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

interface NavTabConfig {
  id: string;
  label: string;
  iconName: NavTabIconName;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

interface FeatureBarItemConfig {
  id: FeatureBarIconName;
  label: string;
  ariaLabel: string;
  active: boolean;
  onClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  onUnlockAdmin,
  onOpenCompare,
  onSubmitDub,
  feedView,
  setFeedView,
  isAdminAuthenticated,
  userAvatar,
  unreadAlertsCount = 0,
}) => {
  const { user, isSignedIn } = useUser();

  // Strict authorization check: Hide Admin Dashboard link from unauthorized visitors
  const isAuthorizedAdminUser = Boolean(
    isAdminAuthenticated || (isSignedIn && user && isAuthorizedClerkAdmin(user))
  );

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
    setActiveTab(tab);
    if (setFeedView && feed) setFeedView(feed);
  };

  const handleSearchShortcut = () => {
    navigate('explore', 'library');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="Search"]'
        );
        searchInput?.focus();
      }, 120);
    }
  };

  const isForYouActive =
    activeTab === 'foryou' ||
    activeTab === 'recommendations' ||
    ((activeTab === 'explore' || activeTab === 'catalog') && feedView === 'foryou');
  const isExploreActive =
    (activeTab === 'explore' || activeTab === 'catalog') && feedView !== 'foryou';
  const isScheduleActive = activeTab === 'schedule';
  const isLibraryActive = activeTab === 'watchlist' || activeTab === 'library';
  const isProfileActive = activeTab === 'profile';
  const isTierListActive = activeTab === 'tierlist';
  const isChatActive = activeTab === 'chat';
  const isCompareActive = activeTab === 'compare';

  const primaryTabs: NavTabConfig[] = [
    {
      id: 'explore',
      label: 'Explore',
      iconName: 'explore',
      active: isExploreActive,
      onClick: () => navigate('explore', 'library'),
    },
    {
      id: 'schedule',
      label: 'Schedule',
      iconName: 'schedule',
      active: isScheduleActive,
      onClick: () => navigate('schedule'),
    },
    {
      id: 'watchlist',
      label: 'Library',
      iconName: 'library',
      active: isLibraryActive,
      badge: watchlistCount > 0 ? watchlistCount : undefined,
      onClick: () => navigate('watchlist'),
    },
    {
      id: 'profile',
      label: 'Profile',
      iconName: 'profile',
      active: isProfileActive,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      onClick: () => navigate('profile'),
    },
  ];

  // Direct 5-Icon Feature Bar items directly beneath the brand header
  const featureBarItems: FeatureBarItemConfig[] = [
    {
      id: 'foryou',
      label: 'For You',
      ariaLabel: 'For You Matchmaker',
      active: isForYouActive,
      onClick: () => navigate('recommendations', 'foryou'),
    },
    {
      id: 'compare',
      label: 'Compare',
      ariaLabel: 'Compare Anime',
      active: isCompareActive,
      onClick: () => {
        if (onOpenCompare) {
          onOpenCompare();
        } else {
          navigate('compare');
        }
      },
    },
    {
      id: 'tierlist',
      label: 'Tier List',
      ariaLabel: 'Tier List Maker',
      active: isTierListActive,
      onClick: () => navigate('tierlist'),
    },
    {
      id: 'chat',
      label: 'Chat',
      ariaLabel: 'Community Chat',
      active: isChatActive,
      onClick: () => navigate('chat'),
    },
    {
      id: 'submit',
      label: 'Submit',
      ariaLabel: 'Submit Anime or Dub',
      active: false,
      onClick: () => {
        if (onSubmitDub) {
          onSubmitDub();
        }
      },
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#0B0A10] border-b border-[#292B39] overflow-x-clip">
        {/* ROW 1: Compact Brand Header (52px–56px height) + Desktop Primary Tabs + 44x44px Search Shortcut */}
        <nav
          aria-label="Primary desktop navigation"
          className="max-w-7xl mx-auto px-2.5 sm:px-6 h-[54px] sm:h-14 flex items-center justify-between gap-2"
        >
          {/* ZONE 1: Orange ANIDUB INDIA Brand Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleLogoClick();
            }}
            className="inline-flex items-center min-h-[44px] select-none cursor-pointer shrink-0 focus:outline-none rounded-[12px]"
            aria-label="AniDub India Home"
          >
            <AniDubLogo size="md" showText={true} />
          </a>

          {/* ZONE 2: Desktop Primary Navigation (4 Core Destinations) */}
          <div className="hidden md:flex items-center gap-1.5">
            {primaryTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={item.active ? 'page' : undefined}
                className={`relative h-11 min-h-[44px] px-3.5 rounded-[12px] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-180 motion-reduce:transition-none whitespace-nowrap shrink-0 cursor-pointer border ${
                  item.active
                    ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]/55'
                    : 'text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#12141E] border-transparent'
                }`}
              >
                <SignatureNavIcon
                  name={item.iconName}
                  active={item.active}
                  size={24}
                  className={`w-5 h-5 shrink-0 ${item.active ? 'text-[#B49AF8]' : 'text-[#A1A5B5]'}`}
                />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#B49AF8] text-[#0B0A10] text-[10px] font-bold leading-none tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ZONE 3: Search Shortcut (44x44px) + Authorized Admin + User Avatar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden lg:block">
              <PWAInstallButton variant="button" />
            </div>

            {isAuthorizedAdminUser && (
              <Button
                variant="secondary"
                size="sm"
                active={activeTab === 'admin'}
                onClick={onUnlockAdmin}
                aria-label="Admin Dashboard"
                title="Admin Dashboard"
                leftIcon={<ShieldCheck className="w-4 h-4 text-[#F9C876]" />}
              >
                <span className="hidden lg:inline">Admin</span>
              </Button>
            )}

            <IconButton
              variant="secondary"
              active={isExploreActive}
              onClick={handleSearchShortcut}
              aria-label="Search Anime"
              title="Search Anime"
              data-testid="navbar-search-shortcut"
              icon={
                <SignatureNavIcon
                  name="search"
                  active={isExploreActive}
                  size={24}
                  className={`w-5 h-5 ${isExploreActive ? 'text-[#B49AF8]' : 'text-[#A1A5B5]'}`}
                />
              }
            />

            {(user?.imageUrl || userAvatar) && (
              <button
                type="button"
                onClick={() => navigate('profile')}
                aria-label="Open Profile"
                className="hidden sm:flex w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] overflow-hidden border border-[#292B39] hover:border-[#B49AF8] items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
              >
                <img
                  src={user?.imageUrl || userAvatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </button>
            )}
          </div>
        </nav>

        {/* ROW 2: Direct 5-Icon Feature Bar (Sticky beneath brand header, zero horizontal overflow on 360px) */}
        <div
          data-testid="direct-feature-bar"
          aria-label="Direct discovery and community tools"
          className="w-full bg-[#12141E]/90 border-t border-[#292B39]"
        >
          <div className="max-w-7xl mx-auto px-1.5 sm:px-6 py-1 grid grid-cols-5 gap-1 sm:gap-2">
            {featureBarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-label={item.ariaLabel}
                aria-current={item.active ? 'page' : undefined}
                data-testid={`feature-bar-${item.id}`}
                className={`relative min-w-[44px] min-h-[44px] px-1 sm:px-3 py-1.5 rounded-[12px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 border transition-colors duration-180 motion-reduce:transition-none cursor-pointer select-none ${
                  item.active
                    ? 'bg-[#191C29] text-[#B49AF8] border-[#B49AF8]/50'
                    : 'bg-transparent text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29]/60 border-transparent'
                }`}
              >
                {item.active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 sm:bottom-0 sm:top-auto w-6 h-0.5 rounded-full bg-[#B49AF8]"
                  />
                )}
                <SignatureNavIcon
                  name={item.id}
                  active={item.active}
                  size={24}
                  className={`w-6 h-6 shrink-0 ${item.active ? 'text-[#B49AF8]' : 'text-[#A1A5B5]'}`}
                />
                <span
                  className={`text-[11px] sm:text-xs font-semibold leading-none tracking-tight whitespace-nowrap truncate max-w-full ${
                    item.active ? 'text-[#F4F3FA]' : 'text-[#A1A5B5]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR (4 Core Destinations with 24px Custom Duotone SVG Icons) */}
      <nav
        aria-label="Mobile primary navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0B0A10] border-t border-[#292B39]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="grid grid-cols-4 h-14 px-1">
          {primaryTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-current={item.active ? 'page' : undefined}
              aria-label={item.label}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] rounded-[12px] transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                item.active ? 'text-[#B49AF8]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
            >
              {item.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 w-7 h-0.5 rounded-full bg-[#B49AF8]"
                />
              )}
              <div className="relative flex items-center justify-center">
                <SignatureNavIcon
                  name={item.iconName}
                  active={item.active}
                  size={24}
                  className="w-6 h-6"
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#B49AF8] text-[#0B0A10] text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};
