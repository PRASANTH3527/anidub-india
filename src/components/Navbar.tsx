import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '../lib/clerk';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import {
  Trophy,
  MessageSquare,
  ShieldCheck,
  MoreHorizontal,
  Sparkles,
  Plus,
  MessageCircleHeart,
  ChevronDown,
  ChevronRight,
  X,
  Scale,
  FileText,
} from 'lucide-react';
import { AniDubLogo } from './AniDubLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { SignatureNavIcon, type NavTabIconName } from './IconRegistry';
import { Button } from './ui/Button';

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
  const { user, isSignedIn } = useUser();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Strict authorization check: Hide Admin Dashboard link from unauthorized visitors
  const isAuthorizedAdminUser = Boolean(
    isAdminAuthenticated || (isSignedIn && user && isAuthorizedClerkAdmin(user))
  );

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
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

  const mobileBottomSheet =
    moreMenuOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-testid="mobile-more-bottom-sheet"
            className="md:hidden fixed inset-0 z-[70] flex flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation and tools"
          >
            {/* Backdrop */}
            <div
              onClick={() => setMoreMenuOpen(false)}
              className="fixed inset-0 bg-black/75 transition-opacity duration-150"
              aria-hidden="true"
            />

            {/* Bottom Sheet Surface */}
            <div
              className="relative z-10 w-full rounded-t-3xl bg-[#12141E] border-t border-[#292B39] px-4 pt-2.5 pb-6 max-h-[82vh] overflow-y-auto transition-transform duration-150"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
            >
              {/* Grab Handle */}
              <div className="w-10 h-1.5 rounded-full bg-[#292B39] mx-auto mb-3" />

              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#292B39]">
                <div>
                  <h2 className="text-sm font-bold text-[#F4F3FA]">Quick Shortcuts &amp; Tools</h2>
                  <p className="text-[11px] text-[#A1A5B5]">
                    Discovery tools, community chat, and catalog support
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen(false)}
                  aria-label="Close menu"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-[#191C29] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-150 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Category 1: Discovery Tools */}
                <div className="space-y-1.5">
                  <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                    Discovery Tools
                  </div>
                  <div className="rounded-2xl bg-[#191C29] border border-[#292B39] divide-y divide-[#292B39] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => navigate('foryou', 'foryou')}
                      className={`w-full min-h-[52px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors duration-150 cursor-pointer ${
                        activeTab === 'foryou' ? 'bg-[#B49AF8]/15 text-[#F4F3FA]' : 'text-[#F4F3FA] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-[#B49AF8]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#F4F3FA] truncate">Find Your Next Anime</div>
                          <div className="text-[11px] text-[#A1A5B5] truncate">Filter by verified dub language &amp; OTT</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                    </button>

                    {onOpenCompare && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onOpenCompare();
                        }}
                        className="w-full min-h-[52px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-[#F4F3FA] hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                            <Scale className="w-4 h-4 text-[#CBB6FF]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#F4F3FA] truncate">Compare Anime</div>
                            <div className="text-[11px] text-[#A1A5B5] truncate">Side-by-side Indian dubs &amp; OTT platforms</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate('tierlist')}
                      className={`w-full min-h-[52px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors duration-150 cursor-pointer ${
                        activeTab === 'tierlist' ? 'bg-[#B49AF8]/15 text-[#F4F3FA]' : 'text-[#F4F3FA] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          <Trophy className="w-4 h-4 text-[#F9C876]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#F4F3FA] truncate">Tier List Maker</div>
                          <div className="text-[11px] text-[#A1A5B5] truncate">Rank your favorite Indian dubbed anime</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Category 2: Community & Contributions */}
                <div className="space-y-1.5">
                  <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                    Community &amp; Contributions
                  </div>
                  <div className="rounded-2xl bg-[#191C29] border border-[#292B39] divide-y divide-[#292B39] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => navigate('chat')}
                      className={`w-full min-h-[52px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors duration-150 cursor-pointer ${
                        isChatActive ? 'bg-[#B49AF8]/15 text-[#F4F3FA]' : 'text-[#F4F3FA] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4 text-[#B49AF8]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#F4F3FA] truncate">Community Chat</div>
                          <div className="text-[11px] text-[#A1A5B5] truncate">Live Indian dub discussions</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                    </button>

                    {onSubmitDub && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onSubmitDub();
                        }}
                        className="w-full min-h-[52px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-[#F4F3FA] hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                            <Plus className="w-4 h-4 text-[#34D399]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#F4F3FA] truncate">Submit an Anime or Dub</div>
                            <div className="text-[11px] text-[#A1A5B5] truncate">Add a verified regional dub to the queue</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate('feedback')}
                      className={`w-full min-h-[52px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors duration-150 cursor-pointer ${
                        activeTab === 'feedback' ? 'bg-[#B49AF8]/15 text-[#F4F3FA]' : 'text-[#F4F3FA] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          <MessageCircleHeart className="w-4 h-4 text-[#F87171]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#F4F3FA] truncate">Share Feedback</div>
                          <div className="text-[11px] text-[#A1A5B5] truncate">Report bugs or suggest improvements</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Category 3: App & Legal */}
                <div className="space-y-1.5">
                  <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                    App &amp; Legal
                  </div>
                  <div className="rounded-2xl bg-[#191C29] border border-[#292B39] divide-y divide-[#292B39] overflow-hidden">
                    <div className="px-1.5 py-1">
                      <PWAInstallButton
                        variant="menu-item"
                        onActionComplete={() => setMoreMenuOpen(false)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate('privacy')}
                      className={`w-full min-h-[48px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors duration-150 cursor-pointer ${
                        activeTab === 'privacy' || activeTab === 'copyright'
                          ? 'bg-[#B49AF8]/15 text-[#F4F3FA]'
                          : 'text-[#F4F3FA] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-[#A1A5B5]" />
                        </div>
                        <span className="text-xs font-semibold text-[#F4F3FA] truncate">Privacy &amp; Copyright Policy</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                    </button>

                    {isAuthorizedAdminUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onUnlockAdmin();
                        }}
                        className="w-full min-h-[48px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-[#F9C876] hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-4 h-4 text-[#F9C876]" />
                          </div>
                          <span className="text-xs font-semibold truncate">Admin Dashboard</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#0B0A10] border-b border-[#292B39]">
        <nav
          aria-label="Primary desktop navigation"
          className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3"
        >
          {/* ZONE 1: Brand */}
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-2 select-none cursor-pointer shrink-0 focus:outline-none min-h-[44px]"
            aria-label="AniDub India Home"
          >
            <AniDubLogo size="md" showText={true} />
          </button>

          {/* ZONE 2: Desktop Primary Navigation (Custom Signature SVG Icons + Text Labels) */}
          <div className="hidden md:flex items-center gap-1.5">
            {primaryTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={item.active ? 'page' : undefined}
                className={`relative h-10 min-h-[40px] px-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer border ${
                  item.active
                    ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]/55'
                    : 'text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#12141E] border-transparent'
                }`}
              >
                <SignatureNavIcon
                  name={item.iconName}
                  active={item.active}
                  className={`w-[18px] h-[18px] shrink-0 ${item.active ? 'text-[#B49AF8]' : 'text-[#A1A5B5]'}`}
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

          {/* ZONE 3: Install App + Community Chat Shortcut + More Menu + Authorized Admin */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" ref={moreMenuRef}>
            <div className="hidden lg:block">
              <PWAInstallButton variant="button" />
            </div>

            <Button
              variant="secondary"
              size="sm"
              active={isChatActive}
              onClick={() => navigate('chat')}
              aria-label="Community Chat"
              title="Community Chat"
              leftIcon={<MessageSquare className="w-4 h-4 text-[#B49AF8]" />}
            >
              <span className="hidden sm:inline">Chat</span>
            </Button>

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

            {/* More Menu Trigger (Desktop Popover + Mobile Bottom Sheet) */}
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                active={moreMenuOpen || isMoreActive}
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                aria-expanded={moreMenuOpen}
                aria-haspopup="dialog"
                aria-label="More navigation options"
                leftIcon={
                  moreMenuOpen ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <MoreHorizontal className="w-4 h-4" />
                  )
                }
                rightIcon={
                  <ChevronDown
                    className={`w-3.5 h-3.5 hidden sm:block transition-transform duration-150 ${
                      moreMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                }
              >
                <span className="hidden sm:inline">More</span>
              </Button>

              {/* Desktop Dropdown Menu */}
              {moreMenuOpen && (
                <div
                  role="menu"
                  className="hidden md:block absolute right-0 mt-2 w-64 rounded-2xl bg-[#12141E] border border-[#292B39] shadow-2xl p-1.5 z-50"
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                    Discovery Tools
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('foryou', 'foryou')}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors duration-150 cursor-pointer ${
                      activeTab === 'foryou'
                        ? 'bg-[#B49AF8]/15 text-[#F4F3FA]'
                        : 'text-[#F4F3FA] hover:bg-[#191C29]'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-[#B49AF8] shrink-0" />
                    <div>
                      <div>Find Your Next Anime</div>
                      <div className="text-[10px] text-[#A1A5B5] font-normal">Filter by language &amp; OTT</div>
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
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#F4F3FA] hover:bg-[#191C29] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer"
                    >
                      <Scale className="w-4 h-4 text-[#CBB6FF] shrink-0" />
                      <div>
                        <div>Compare Anime</div>
                        <div className="text-[10px] text-[#A1A5B5] font-normal">Side-by-side dubs &amp; OTTs</div>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('tierlist')}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors duration-150 cursor-pointer ${
                      activeTab === 'tierlist' ? 'bg-[#B49AF8]/15 text-[#F4F3FA]' : 'text-[#F4F3FA] hover:bg-[#191C29]'
                    }`}
                  >
                    <Trophy className="w-4 h-4 text-[#F9C876] shrink-0" />
                    <div>
                      <div>Tier List Maker</div>
                      <div className="text-[10px] text-[#A1A5B5] font-normal">Rank your favorite dubs</div>
                    </div>
                  </button>

                  <div className="my-1.5 border-t border-[#292B39]" />
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                    Community &amp; Support
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('chat')}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors duration-150 cursor-pointer ${
                      isChatActive ? 'bg-[#B49AF8]/15 text-[#F4F3FA]' : 'text-[#F4F3FA] hover:bg-[#191C29]'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-[#B49AF8] shrink-0" />
                    <div>
                      <div>Community Chat</div>
                      <div className="text-[10px] text-[#A1A5B5] font-normal">Live Indian dub discussions</div>
                    </div>
                  </button>

                  {onSubmitDub && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onSubmitDub();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#F4F3FA] hover:bg-[#191C29] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-[#34D399] shrink-0" />
                      <span>Submit an Anime or Dub</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('feedback')}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors duration-150 cursor-pointer ${
                      activeTab === 'feedback' ? 'bg-[#B49AF8]/15 text-[#F4F3FA]' : 'text-[#F4F3FA] hover:bg-[#191C29]'
                    }`}
                  >
                    <MessageCircleHeart className="w-4 h-4 text-[#F87171] shrink-0" />
                    <span>Share Feedback</span>
                  </button>

                  <PWAInstallButton
                    variant="menu-item"
                    onActionComplete={() => setMoreMenuOpen(false)}
                  />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate('privacy')}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors duration-150 cursor-pointer ${
                      activeTab === 'privacy' || activeTab === 'copyright'
                        ? 'bg-[#B49AF8]/15 text-[#F4F3FA]'
                        : 'text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29]'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                    <span>Privacy &amp; Copyright</span>
                  </button>

                  {isAuthorizedAdminUser && (
                    <>
                      <div className="my-1.5 border-t border-[#292B39]" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onUnlockAdmin();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#F9C876] hover:bg-[#191C29] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#F9C876] shrink-0" />
                        <span>Admin Dashboard</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* User Avatar quick shortcut on desktop */}
            {(user?.imageUrl || userAvatar) && (
              <button
                type="button"
                onClick={() => navigate('profile')}
                aria-label="Open Profile"
                className="hidden sm:flex w-10 h-10 rounded-full overflow-hidden border border-[#292B39] hover:border-[#B49AF8] transition-colors duration-150 cursor-pointer shrink-0"
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
      </header>

      {/* Mobile Bottom Sheet Portal */}
      {mobileBottomSheet}

      {/* MOBILE BOTTOM NAVIGATION BAR (4 Destinations with Custom Signature Duotone SVG Icons) */}
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
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] rounded-xl transition-colors duration-150 cursor-pointer ${
                item.active ? 'text-[#B49AF8]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
            >
              {/* Subtle top active bar indicator */}
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
                  className="w-5 h-5"
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#B49AF8] text-[#0B0A10] text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};
