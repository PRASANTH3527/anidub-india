import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../lib/clerk';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  LayoutGrid,
  Palette,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AniDubLogo } from './AniDubLogo';
import {
  SignatureNavIcon,
  type NavTabIconName,
  type FeatureBarIconName,
} from './IconRegistry';
import { IconButton } from './ui/Button';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { DesktopLanguagePopover } from './i18n/LanguageSelector';

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

interface ToolMenuItemConfig {
  id: FeatureBarIconName;
  label: string;
  subtitle: string;
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
  unreadAlertsCount = 0,
}) => {
  const { user, isSignedIn } = useUser();
  const { t } = useTranslation(['navigation', 'common']);
  const { openAppearance, isAppearanceOpen, displayName } = useTheme();
  const { languageMeta, openLanguageSelector } = useLanguage();
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  const toolsContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileToolsSheetRef = useRef<HTMLDivElement | null>(null);
  const toolsTriggerRef = useRef<HTMLButtonElement | null>(null);

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

    setIsToolsOpen(false);
    setActiveTab('explore');
    if (setFeedView) setFeedView('library');
  };

  const navigate = (tab: string, feed?: string) => {
    setIsToolsOpen(false);
    setActiveTab(tab);
    if (setFeedView && feed) setFeedView(feed);
  };

  const handleSearchShortcut = () => {
    setIsToolsOpen(false);
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

  // Escape dismiss, outside-click dismiss (desktop), scroll lock & focus trap (mobile bottom sheet)
  useEffect(() => {
    if (!isToolsOpen) return;

    const isMobileViewport =
      typeof window !== 'undefined' && window.innerWidth < 1024;

    const previousOverflow =
      typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (isMobileViewport && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }

    // Move initial focus inside mobile sheet for accessibility
    const focusTimer = window.setTimeout(() => {
      if (isMobileViewport && mobileToolsSheetRef.current) {
        const firstFocusable = mobileToolsSheetRef.current.querySelector<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsToolsOpen(false);
        toolsTriggerRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && isMobileViewport && mobileToolsSheetRef.current) {
        const focusables = Array.from(
          mobileToolsSheetRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (
        !isMobileViewport &&
        toolsContainerRef.current &&
        !toolsContainerRef.current.contains(e.target as Node)
      ) {
        setIsToolsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      if (isMobileViewport && typeof document !== 'undefined') {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [isToolsOpen]);

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
  const isSecondaryToolActive = isForYouActive || isCompareActive || isTierListActive;

  const exploreTab: NavTabConfig = {
    id: 'explore',
    label: t('navigation:explore', 'Explore'),
    iconName: 'explore',
    active: isExploreActive,
    onClick: () => navigate('explore', 'library'),
  };
  const scheduleTab: NavTabConfig = {
    id: 'schedule',
    label: t('navigation:schedule', 'Schedule'),
    iconName: 'schedule',
    active: isScheduleActive,
    onClick: () => navigate('schedule'),
  };
  const chatTab: NavTabConfig = {
    id: 'chat',
    label: t('navigation:chat', 'Chat'),
    iconName: 'chat',
    active: isChatActive,
    onClick: () => navigate('chat'),
  };
  const libraryTab: NavTabConfig = {
    id: 'watchlist',
    label: t('navigation:library', 'Library'),
    iconName: 'library',
    active: isLibraryActive,
    badge: watchlistCount > 0 ? watchlistCount : undefined,
    onClick: () => navigate('watchlist'),
  };
  const profileTab: NavTabConfig = {
    id: 'profile',
    label: t('navigation:profile', 'Profile'),
    iconName: 'profile',
    active: isProfileActive,
    badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
    onClick: () => navigate('profile'),
  };

  // Desktop Top Header (1024px+): Explore, Schedule, Library, Chat, Profile
  const desktopPrimaryTabs: NavTabConfig[] = [
    exploreTab,
    scheduleTab,
    libraryTab,
    chatTab,
    profileTab,
  ];

  // Mobile Bottom Navigation (<1024px): Explore, Schedule, Chat, Library, Profile
  const mobilePrimaryTabs: NavTabConfig[] = [
    exploreTab,
    scheduleTab,
    chatTab,
    libraryTab,
    profileTab,
  ];

  // Secondary Discovery & Contribution Tools (Inside Tools Bottom Sheet / Popover)
  const secondaryTools: ToolMenuItemConfig[] = [
    {
      id: 'foryou',
      label: t('navigation:secondary.forYou', 'For You'),
      subtitle: t('navigation:secondary.forYouSubtitle', 'Personalized anime matchmaker'),
      ariaLabel: `${t('navigation:secondary.forYou', 'For You')} — ${t('navigation:secondary.forYouSubtitle', 'Personalized anime matchmaker')}`,
      active: isForYouActive,
      onClick: () => navigate('recommendations', 'foryou'),
    },
    {
      id: 'compare',
      label: t('navigation:secondary.compare', 'Compare'),
      subtitle: t('navigation:secondary.compareSubtitle', 'Compare two anime side by side'),
      ariaLabel: `${t('navigation:secondary.compare', 'Compare')} — ${t('navigation:secondary.compareSubtitle', 'Compare two anime side by side')}`,
      active: isCompareActive,
      onClick: () => {
        setIsToolsOpen(false);
        if (onOpenCompare) {
          onOpenCompare();
        } else {
          navigate('compare');
        }
      },
    },
    {
      id: 'tierlist',
      label: t('navigation:secondary.tierList', 'Tier List'),
      subtitle: t('navigation:secondary.tierListSubtitle', 'Rank your favorite dubbed anime'),
      ariaLabel: `${t('navigation:secondary.tierList', 'Tier List')} — ${t('navigation:secondary.tierListSubtitle', 'Rank your favorite dubbed anime')}`,
      active: isTierListActive,
      onClick: () => navigate('tierlist'),
    },
    {
      id: 'submit',
      label: t('navigation:secondary.submitAnime', 'Submit Anime'),
      subtitle: t('navigation:secondary.submitAnimeSubtitle', 'Add a missing dubbed title'),
      ariaLabel: `${t('navigation:secondary.submitAnime', 'Submit Anime')} — ${t('navigation:secondary.submitAnimeSubtitle', 'Add a missing dubbed title')}`,
      active: false,
      onClick: () => {
        setIsToolsOpen(false);
        if (onSubmitDub) {
          onSubmitDub();
        }
      },
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] transition-colors duration-180">
        {/* SINGLE-ROW FLAGSHIP HEADER (56px mobile / 64px desktop) */}
        <nav
          aria-label="Primary desktop navigation"
          className="max-w-7xl mx-auto px-2.5 sm:px-6 h-[56px] lg:h-[64px] flex items-center justify-between gap-1.5 sm:gap-2"
        >
          {/* LEFT: AniDub India /logo.png Brand Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleLogoClick();
            }}
            className="inline-flex items-center min-h-[44px] select-none cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60 rounded-[var(--radius-control)]"
            aria-label="AniDub India Home"
          >
            <AniDubLogo size="md" showText={true} />
          </a>

          {/* CENTER (1024px+): 5 Primary Destinations Inline with Logo */}
          <div className="hidden lg:flex items-center gap-1">
            {desktopPrimaryTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={item.active ? 'page' : undefined}
                className={`relative h-11 min-h-[44px] px-3.5 rounded-[var(--radius-control)] text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-180 motion-reduce:transition-none whitespace-nowrap shrink-0 cursor-pointer border ${
                  item.active
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--accent-primary)]/55'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border-transparent'
                }`}
              >
                <SignatureNavIcon
                  name={item.iconName}
                  active={item.active}
                  size={24}
                  className={`w-5 h-5 shrink-0 ${
                    item.active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                  }`}
                />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--accent-primary)] text-[var(--accent-on-primary)] text-[10px] font-bold leading-none tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* RIGHT: Search + Desktop Language Globe + Palette (Appearance) + Tools Menu Trigger */}
          <div ref={toolsContainerRef} className="relative flex items-center gap-1.5 sm:gap-2 shrink-0">
            <IconButton
              variant="secondary"
              active={isExploreActive}
              onClick={handleSearchShortcut}
              aria-label={t('navigation:searchAnime', 'Search Anime')}
              title={t('navigation:searchAnime', 'Search Anime')}
              data-testid="navbar-search-shortcut"
              icon={
                <SignatureNavIcon
                  name="search"
                  active={isExploreActive}
                  size={24}
                  className={`w-5 h-5 ${
                    isExploreActive
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                />
              }
            />

            {/* Desktop Searchable Language Globe Popover (1024px+ only; mobile lives in Tools Sheet & Profile) */}
            <DesktopLanguagePopover onOpen={() => setIsToolsOpen(false)} />

            {/* Palette / Appearance Trigger */}
            <button
              type="button"
              onClick={() => {
                setIsToolsOpen(false);
                openAppearance('presets');
              }}
              aria-label={`${t('navigation:appearanceAndThemes', 'Appearance & Themes')} (${displayName})`}
              aria-expanded={isAppearanceOpen}
              title={`${t('navigation:appearanceAndThemes', 'Appearance & Themes')}: ${displayName}`}
              data-testid="navbar-appearance-trigger"
              className={`h-11 min-h-[44px] w-11 min-w-[44px] rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border transition-colors duration-180 motion-reduce:transition-none inline-flex items-center justify-center cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60 ${
                isAppearanceOpen
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
              }`}
            >
              <Palette
                className={`w-5 h-5 shrink-0 ${
                  isAppearanceOpen
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              />
            </button>

            {/* Tools Trigger: 44x44px Icon Button on Mobile (<1024px) / Compact Pill Dropdown Trigger on Desktop (1024px+) */}
            <button
              ref={toolsTriggerRef}
              type="button"
              onClick={() => setIsToolsOpen((prev) => !prev)}
              aria-expanded={isToolsOpen}
              aria-haspopup="menu"
              aria-label={t('navigation:openToolsMenu', 'Open Tools Menu')}
              title={t('navigation:tools', 'Tools')}
              data-testid="navbar-tools-trigger"
              className={`h-11 min-h-[44px] w-11 min-w-[44px] lg:w-auto lg:px-3.5 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border transition-colors duration-180 motion-reduce:transition-none inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60 ${
                isToolsOpen || isSecondaryToolActive
                  ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
              }`}
            >
              <LayoutGrid
                className={`w-5 h-5 shrink-0 ${
                  isToolsOpen || isSecondaryToolActive
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              />
              <span className="hidden lg:inline text-sm font-semibold text-[var(--text-primary)] max-w-[96px] truncate">
                {t('navigation:tools', 'Tools')}
              </span>
              <ChevronDown
                className={`hidden lg:inline w-4 h-4 text-[var(--text-secondary)] transition-transform duration-180 motion-reduce:transition-none ${
                  isToolsOpen ? 'rotate-180 text-[var(--accent-primary)]' : ''
                }`}
              />
            </button>

            {/* DESKTOP ANCHORED POPOVER DROPDOWN (1024px+) */}
            {isToolsOpen && (
              <div
                role="menu"
                aria-label={t('navigation:toolsSheetTitle', 'Tools & Extras')}
                data-testid="tools-desktop-popover"
                className="hidden lg:block absolute right-0 top-[calc(100%+10px)] w-80 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-2 z-[80]"
                style={{ boxShadow: 'var(--shadow-elevated)' }}
              >
                <div className="px-3 py-2 flex items-center justify-between border-b border-[var(--border-subtle)] mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
                    {t('navigation:toolsSheetTitle', 'Tools & Extras')}
                  </span>
                </div>

                <div className="space-y-1">
                  {secondaryTools.map((tool) => (
                    <button
                      key={`desktop_tool_${tool.id}`}
                      type="button"
                      role="menuitem"
                      onClick={tool.onClick}
                      aria-label={tool.ariaLabel}
                      data-testid={`tool-item-${tool.id}`}
                      className={`w-full min-h-[52px] px-3 py-2.5 rounded-[var(--radius-control)] border text-left flex items-center justify-between gap-3 transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                        tool.active
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/50 text-[var(--text-primary)]'
                          : 'bg-transparent border-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-9 h-9 rounded-[10px] border flex items-center justify-center shrink-0 ${
                            tool.active
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/50 text-[var(--accent-primary)]'
                              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--accent-primary)]'
                          }`}
                        >
                          <SignatureNavIcon
                            name={tool.id}
                            active={tool.active}
                            size={22}
                            className="w-5 h-5"
                          />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">
                            {tool.label}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                            {tool.subtitle}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    </button>
                  ))}

                  {isAuthorizedAdminUser && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsToolsOpen(false);
                        onUnlockAdmin();
                      }}
                      aria-label="Admin Dashboard"
                      className={`w-full min-h-[52px] px-3 py-2.5 rounded-[var(--radius-control)] border text-left flex items-center justify-between gap-3 transition-colors duration-180 cursor-pointer ${
                        activeTab === 'admin'
                          ? 'bg-[#F9C876]/12 border-[#F9C876]/50 text-[var(--text-primary)]'
                          : 'bg-transparent border-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[#F9C876] shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">
                            Admin Dashboard
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                            Manage catalog &amp; submissions
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* MOBILE TOOLS BOTTOM SHEET (<1024px) */}
      {isToolsOpen && (
        <div className="lg:hidden fixed inset-0 z-[80] flex items-end">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setIsToolsOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 backdrop-blur-xs transition-opacity duration-180 motion-reduce:transition-none"
            style={{ backgroundColor: 'var(--backdrop-scrim)' }}
          />

          <div
            ref={mobileToolsSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Discovery Tools"
            data-testid="tools-mobile-bottom-sheet"
            className="relative z-10 w-full rounded-t-2xl bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] overflow-hidden transition-transform duration-180 motion-reduce:transition-none"
            style={{
              boxShadow: 'var(--shadow-elevated)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
            }}
          >
            {/* Drag Handle Pill */}
            <div className="pt-2.5 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-[var(--border-strong)]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 min-w-0">
                <LayoutGrid className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight truncate">
                  {t('navigation:toolsSheetTitle', 'Tools & Extras')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsToolsOpen(false);
                  toolsTriggerRef.current?.focus();
                }}
                aria-label={t('common:close', 'Close')}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 48px+ Tappable Tool Rows */}
            <div className="p-4 space-y-2.5 max-h-[72vh] overflow-y-auto overscroll-contain">
              {secondaryTools.map((tool) => (
                <button
                  key={`mobile_tool_${tool.id}`}
                  type="button"
                  onClick={tool.onClick}
                  aria-label={tool.ariaLabel}
                  data-testid={`mobile-tool-item-${tool.id}`}
                  className={`w-full min-h-[58px] px-3.5 py-3 rounded-[var(--radius-control)] border text-left flex items-center justify-between gap-3 transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                    tool.active
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-10 h-10 rounded-[10px] border flex items-center justify-center shrink-0 ${
                        tool.active
                          ? 'bg-[var(--accent-primary)] border-[var(--accent-hover)] text-[var(--accent-on-primary)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--accent-primary)]'
                      }`}
                    >
                      <SignatureNavIcon
                        name={tool.id}
                        active={tool.active}
                        size={22}
                        className="w-5 h-5"
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">
                        {tool.label}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                        {tool.subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                </button>
              ))}

              {/* Website Language Selector Row (Mobile Tools Sheet) */}
              <button
                type="button"
                onClick={() => {
                  setIsToolsOpen(false);
                  openLanguageSelector();
                }}
                aria-label={`${t('navigation:websiteLanguage', 'Language')} · ${languageMeta.nativeName}`}
                data-testid="mobile-tools-language-btn"
                className="w-full min-h-[58px] px-3.5 py-3 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 text-left flex items-center justify-between gap-3 transition-colors duration-180 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                    <Globe className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">
                      {t('navigation:websiteLanguage', 'Language')} · {languageMeta.nativeName}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                      {t('navigation:websiteLanguageSubtitle', 'Change website display language')}
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--accent-primary)]">
                    {languageMeta.shortBadge}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                </span>
              </button>

              {/* Appearance & Themes Row (Mobile Tools Sheet) */}
              <button
                type="button"
                onClick={() => {
                  setIsToolsOpen(false);
                  openAppearance('presets');
                }}
                aria-label={t('navigation:appearanceAndThemes', 'Appearance & Themes')}
                data-testid="mobile-tools-appearance-btn"
                className="w-full min-h-[58px] px-3.5 py-3 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 text-left flex items-center justify-between gap-3 transition-colors duration-180 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                    <Palette className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">
                      {t('navigation:appearanceAndThemes', 'Appearance & Themes')}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                      {displayName}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              </button>

              {isAuthorizedAdminUser && (
                <button
                  type="button"
                  onClick={() => {
                    setIsToolsOpen(false);
                    onUnlockAdmin();
                  }}
                  aria-label={t('navigation:adminDashboard', 'Admin Dashboard')}
                  className={`w-full min-h-[58px] px-3.5 py-3 rounded-[var(--radius-control)] border text-left flex items-center justify-between gap-3 transition-colors duration-180 cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-[#F9C876]/15 border-[#F9C876] text-[var(--text-primary)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[#F9C876]/50 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[#F9C876] shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">
                        {t('navigation:adminDashboard', 'Admin Dashboard')}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                        {t('navigation:adminDashboardSubtitle', 'Moderate submissions and catalog metadata')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (<1024px: Exactly 5 Evenly Spaced Primary Tabs) */}
      <nav
        aria-label="Mobile primary navigation"
        data-testid="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--bg-canvas)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] transition-colors duration-180"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="grid grid-cols-5 h-[58px] px-1">
          {mobilePrimaryTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-current={item.active ? 'page' : undefined}
              aria-label={item.label}
              className={`relative flex flex-col items-center justify-center gap-1 min-w-0 min-h-[44px] px-0.5 rounded-[var(--radius-control)] transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                item.active
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 w-7 h-0.5 rounded-full bg-[var(--accent-primary)]"
                />
              )}
              <div className="relative flex items-center justify-center">
                <SignatureNavIcon
                  name={item.iconName}
                  active={item.active}
                  size={24}
                  className="w-5 h-5 sm:w-6 sm:h-6"
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-primary)] text-[var(--accent-on-primary)] text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold leading-tight tracking-tight max-w-full truncate">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};
