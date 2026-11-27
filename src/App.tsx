import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { CatalogView } from './components/CatalogView';
import { ShieldCheck, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { cloudflareApi } from './services/cloudflareApi';
import { getCloudflareUrl } from './config/cloudflare';
import { AniDubLogo } from './components/AniDubLogo';
import { useUser, useAuth, useClerk, SignIn, getClerkSessionToken } from './lib/clerk';
import { isAuthorizedClerkAdmin } from './utils/auth';
import {
  findMissingAnimeIds,
  mergeGuestAndServerWatchlist,
  normalizeWatchlistIds,
  readWatchlistFromStorage,
  readWatchlistOwner,
  resolveHydratedAnimeList,
  toggleWatchlistIdLocally,
  writeWatchlistToStorage,
} from './utils/watchlist';
import {
  buildAnimeSeoMeta,
  buildDefaultSeoMeta,
  buildLanguageSeoMeta,
  getLanguageSlug,
  parseLanguageFromPath,
  updateDocumentSeoMeta,
} from './utils/seoMeta';
import { normalizeLanguageName } from './utils/languages';
import {
  readMySubscriptions,
  writeMySubscriptions,
  readMySubscriptionsEnabled,
  writeMySubscriptionsEnabled,
} from './utils/ottHub';
import {
  getActiveAccountId,
  normalizeAccountId,
  readScopedJson,
  removeScopedKey,
  transitionAccountStorage,
  writeScopedJson,
} from './utils/accountIsolation';
import { OfflineIndicator } from './components/PWAInstallButton';
import { PageViewSkeleton, DetailModalSkeleton } from './components/SkeletonGrid';
import { Button } from './components/ui/Button';
import { useToast } from './components/Toast';

const ViewLoadingFallback: React.FC<{ tab?: string }> = ({ tab }) => (
  <PageViewSkeleton tab={tab} />
);

const ModalLoadingFallback = () => <DetailModalSkeleton />;

// Code-split heavy, below-the-fold, and non-critical views using React.lazy
const GodModeTracker = lazy(() => import('./components/GodModeTracker').then(m => ({ default: m.GodModeTracker })));
const FeedbackSection = lazy(() => import('./components/FeedbackSection').then(m => ({ default: m.FeedbackSection })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AnimeDetailModal = lazy(() => import('./components/AnimeDetailPage').then(m => ({ default: m.AnimeDetailModal })));
const RouletteModal = lazy(() => import('./components/RouletteModal').then(m => ({ default: m.RouletteModal })));
const CreateCollectionModal = lazy(() => import('./components/CreateCollectionModal').then(m => ({ default: m.CreateCollectionModal })));
const DubInfoModal = lazy(() => import('./components/DubInfoModal').then(m => ({ default: m.DubInfoModal })));
const WatchlistView = lazy(() => import('./components/WatchlistView').then(m => ({ default: m.WatchlistView })));
const WeeklyScheduleView = lazy(() => import('./components/WeeklyScheduleView').then(m => ({ default: m.WeeklyScheduleView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const AnimeTierListMaker = lazy(() => import('./components/AnimeTierListMaker').then(m => ({ default: m.AnimeTierListMaker })));
const RecommendationSystem = lazy(() => import('./components/RecommendationSystem').then(m => ({ default: m.RecommendationSystem })));
const CommunityChatView = lazy(() => import('./components/CommunityChatView').then(m => ({ default: m.CommunityChatView })));
const LanguageLandingView = lazy(() => import('./components/LanguageLandingView').then(m => ({ default: m.LanguageLandingView })));
const LegalPage = lazy(() => import('./components/LegalPage').then(m => ({ default: m.LegalPage })));
const CompareAnimeModal = lazy(() => import('./components/CompareAnimeModal').then(m => ({ default: m.CompareAnimeModal })));



export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [selectedSeoLanguage, setSelectedSeoLanguage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const parsed = parseLanguageFromPath(window.location.pathname);
    return parsed ? parsed.language : null;
  });
  const [feedView, setFeedView] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem('cf_anime_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('cf_anime_lang', currentLang);
  }, [currentLang]);
  
  // Watchlist state (hydrated from localStorage for guests, or D1 on Clerk sign-in)
  const [watchlist, setWatchlist] = useState<number[]>(() => readWatchlistFromStorage());
  const watchlistRef = useRef<number[]>(watchlist);
  watchlistRef.current = watchlist;
  const prevSignedInRef = useRef<boolean>(false);
  const hydratedUserRef = useRef<string | null>(null);

  // Recently viewed state (account-scoped via accountIsolation.ts)
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>(() => {
    try {
      const parsed = readScopedJson<unknown>('cf_anime_recently_viewed', []);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) =>
          item && typeof item === 'object'
            ? item
            : Number.isInteger(Number(item)) && Number(item) > 0
              ? { id: Number(item) }
              : null
        )
        .filter(Boolean);
    } catch {
      return [];
    }
  });

  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [selectedAnimeRecord, setSelectedAnimeRecord] = useState<any | null>(null);
  const [deepLinkLoading, setDeepLinkLoading] = useState(false);
  const [deepLinkNotFoundSlug, setDeepLinkNotFoundSlug] = useState<string | null>(null);
  const deepLinkRequestIdRef = useRef(0);

  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareInitialAnime, setCompareInitialAnime] = useState<any | null>(null);
  const [catalogList, setCatalogList] = useState<any[]>([]);
  const [fullCatalogIndex, setFullCatalogIndex] = useState<any[]>([]);
  const fullCatalogFetchStartedRef = useRef(false);
  const [hydratedByIdList, setHydratedByIdList] = useState<any[]>([]);
  const hydratedByIdFetchedRef = useRef<Set<number>>(new Set());

  // Shared "My Subscriptions" OTT filter state (account-scoped)
  const [mySubscriptions, setMySubscriptions] = useState<string[]>(() => readMySubscriptions());
  const [mySubscriptionsEnabled, setMySubscriptionsEnabled] = useState<boolean>(() =>
    readMySubscriptionsEnabled()
  );

  const handleToggleSubscriptionPlatform = useCallback((platformId: string) => {
    setMySubscriptions((prev) => {
      const exists = prev.includes(platformId);
      const next = exists ? prev.filter((p) => p !== platformId) : [...prev, platformId];
      const saved = writeMySubscriptions(next);
      // Auto-enable filter when user picks their first OTT platform
      if (!exists && prev.length === 0) {
        setMySubscriptionsEnabled(writeMySubscriptionsEnabled(true));
      }
      if (saved.length === 0) {
        setMySubscriptionsEnabled(writeMySubscriptionsEnabled(false));
      }
      return saved;
    });
  }, []);

  const handleToggleMySubscriptionsEnabled = useCallback((enabled: boolean) => {
    setMySubscriptionsEnabled(writeMySubscriptionsEnabled(enabled));
  }, []);

  const handleClearSubscriptions = useCallback(() => {
    setMySubscriptions(writeMySubscriptions([]));
    setMySubscriptionsEnabled(writeMySubscriptionsEnabled(false));
  }, []);

  const ensureFullCatalogIndex = useCallback(async () => {
    if (fullCatalogFetchStartedRef.current) return;
    fullCatalogFetchStartedRef.current = true;
    try {
      const items = await cloudflareApi.fetchCatalogIndex();
      if (Array.isArray(items) && items.length > 0) {
        setFullCatalogIndex(items);
      } else {
        fullCatalogFetchStartedRef.current = false;
      }
    } catch {
      fullCatalogFetchStartedRef.current = false;
    }
  }, []);

  // Lazy-load lightweight full catalog index for discovery tools, OTT Hub counts, Compare, Tier List, Collections & Roulette
  useEffect(() => {
    if (
      activeTab === 'recommendations' ||
      activeTab === 'foryou' ||
      activeTab === 'explore' ||
      activeTab === 'tierlist' ||
      activeTab === 'schedule' ||
      activeTab === 'profile' ||
      feedView === 'foryou' ||
      isRouletteOpen ||
      isCollectionOpen ||
      isCompareOpen
    ) {
      void ensureFullCatalogIndex();
      return;
    }
    const timer = window.setTimeout(() => {
      void ensureFullCatalogIndex();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeTab, feedView, isRouletteOpen, isCollectionOpen, isCompareOpen, ensureFullCatalogIndex]);

  const effectiveFullCatalog = useMemo(
    () => (fullCatalogIndex.length > 0 ? fullCatalogIndex : catalogList),
    [fullCatalogIndex, catalogList]
  );

  const findLoadedAnimeBySlugOrId = useCallback(
    (slugOrId: string | number) => {
      const target = String(slugOrId).trim();
      const targetLower = target.toLowerCase();
      const pools = [
        selectedAnimeRecord ? [selectedAnimeRecord] : [],
        catalogList,
        fullCatalogIndex,
        hydratedByIdList,
      ];
      for (const pool of pools) {
        const match = pool.find(
          (a: any) =>
            a &&
            (String(a.id) === target ||
              (a.slug && String(a.slug).toLowerCase() === targetLower))
        );
        if (match) return match;
      }
      return null;
    },
    [selectedAnimeRecord, catalogList, fullCatalogIndex, hydratedByIdList]
  );

  const activeAnimeSlug = useMemo(() => {
    if (selectedAnimeId === null || selectedAnimeId === undefined) return undefined;
    const found = findLoadedAnimeBySlugOrId(selectedAnimeId);
    return found?.slug || undefined;
  }, [selectedAnimeId, findLoadedAnimeBySlugOrId]);

  // Strict Clerk Admin Authentication State & Account Data Isolation Scope
  const { isSignedIn, user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const { signOut: clerkSignOut } = useClerk();
  const activeUserId = isSignedIn && clerkUser?.id ? clerkUser.id : null;
  const prevAccountScopeRef = useRef<string>(getActiveAccountId());

  // Enforce strict per-account storage isolation on sign-in, account switch, and logout
  useEffect(() => {
    const nextScope = normalizeAccountId(activeUserId);
    const prevScope = prevAccountScopeRef.current;

    if (prevScope !== nextScope) {
      transitionAccountStorage(prevScope, nextScope, {
        purgePreviousUserScopedKeys: false,
      });
      prevAccountScopeRef.current = nextScope;

      // Re-hydrate scoped client state immediately so previous account data never leaks
      const scopedRecent = readScopedJson<unknown>('cf_anime_recently_viewed', [], activeUserId);
      setRecentlyViewed(Array.isArray(scopedRecent) ? scopedRecent : []);
      setMySubscriptions(readMySubscriptions(activeUserId));
      setMySubscriptionsEnabled(readMySubscriptionsEnabled(activeUserId));
    }
  }, [activeUserId]);

  const isClientClerkAdmin = Boolean(isSignedIn && clerkUser && isAuthorizedClerkAdmin(clerkUser));
  const [isServerClerkAdmin, setIsServerClerkAdmin] = useState<boolean>(false);
  const isClerkAdmin = isClientClerkAdmin || isServerClerkAdmin;

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(isClerkAdmin);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDubModalOpen, setIsDubModalOpen] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string>('');
  const [adminPasswordLoading, setAdminPasswordLoading] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);

  const handleOpenCompare = useCallback(
    (initialAnime?: any | null) => {
      setCompareInitialAnime(initialAnime || null);
      setSelectedAnimeId(null);
      setSelectedAnimeRecord(null);
      setIsCompareOpen(true);
      void ensureFullCatalogIndex();
    },
    [ensureFullCatalogIndex]
  );

  const { showToast } = useToast();

  const handleAppToast = useCallback(
    (msg: string, type: 'success' | 'info' | 'error' = 'info') => {
      showToast(
        type === 'error' ? 'Notice' : type === 'success' ? 'Done' : 'AniDub India',
        msg,
        type === 'error' ? 'warning' : type
      );
    },
    [showToast]
  );

  const currentUserSummary = useMemo(() => {
    if (!isSignedIn || !clerkUser) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress || '';
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || email.split('@')[0] || 'Member',
      email,
      avatar: clerkUser.imageUrl,
      isAdmin: isClerkAdmin,
    };
  }, [isSignedIn, clerkUser, isClerkAdmin]);

  const handleNavigateTab = useCallback((nextTab: string) => {
    const resolvedTab = nextTab === 'home' ? 'explore' : nextTab;
    setActiveTab(resolvedTab);
    if (resolvedTab !== 'language') {
      setSelectedSeoLanguage(null);
      if (typeof window !== 'undefined') {
        const pathByTab: Record<string, string> = {
          explore: '/',
          catalog: '/',
          watchlist: '/watchlist',
          schedule: '/schedule',
          chat: '/chat',
          tierlist: '/tierlist',
          foryou: '/recommendations',
          recommendations: '/recommendations',
          feedback: '/feedback',
          privacy: '/privacy',
          terms: '/terms',
          copyright: '/copyright',
          profile: '/profile',
          admin: '/admin',
        };
        const targetPath = pathByTab[resolvedTab];
        if (targetPath && window.location.pathname !== targetPath) {
          window.history.pushState({ tab: resolvedTab }, '', targetPath);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, []);

  const handleOpenLegal = useCallback(
    (page: 'privacy' | 'terms' | 'dmca' = 'privacy') => {
      handleNavigateTab(page === 'dmca' ? 'copyright' : page);
    },
    [handleNavigateTab]
  );

  const handleNavigateLanguage = useCallback((language: string) => {
    const normalized = normalizeLanguageName(language) || 'Hindi';
    const slug = getLanguageSlug(normalized);
    setSelectedAnimeId(null);
    setSelectedSeoLanguage(normalized);
    setActiveTab('language');
    if (typeof window !== 'undefined') {
      const targetPath = `/dubbed-anime/${slug}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ language: normalized }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const resolveDeepLinkAnime = useCallback(
    async (slugOrId: string) => {
      const clean = decodeURIComponent(String(slugOrId || '').trim());
      if (!clean) return;

      const localMatch = findLoadedAnimeBySlugOrId(clean);
      if (localMatch && Number(localMatch.id) > 0) {
        setDeepLinkNotFoundSlug(null);
        setDeepLinkLoading(false);
        setSelectedAnimeRecord(localMatch);
        setSelectedAnimeId(Number(localMatch.id));
        if (typeof window !== 'undefined' && localMatch.slug) {
          const canonicalPath = `/anime/${localMatch.slug}`;
          if (window.location.pathname !== canonicalPath) {
            window.history.replaceState({ animeId: localMatch.id, slug: localMatch.slug }, '', canonicalPath);
          }
        }
        return;
      }

      const reqId = ++deepLinkRequestIdRef.current;
      setDeepLinkLoading(true);
      setDeepLinkNotFoundSlug(null);
      try {
        const fetched = await cloudflareApi.getAnimeById(clean);
        if (reqId !== deepLinkRequestIdRef.current) return;
        if (fetched && Number(fetched.id) > 0) {
          const idNum = Number(fetched.id);
          setSelectedAnimeRecord(fetched);
          setSelectedAnimeId(idNum);
          setDeepLinkNotFoundSlug(null);
          setHydratedByIdList((prev) => {
            if (prev.some((item) => Number(item.id) === idNum)) return prev;
            return [fetched, ...prev];
          });
          if (typeof window !== 'undefined' && fetched.slug) {
            const canonicalPath = `/anime/${fetched.slug}`;
            if (window.location.pathname !== canonicalPath) {
              window.history.replaceState({ animeId: idNum, slug: fetched.slug }, '', canonicalPath);
            }
          }
        } else {
          setSelectedAnimeId(null);
          setSelectedAnimeRecord(null);
          setDeepLinkNotFoundSlug(clean);
        }
      } catch {
        if (reqId !== deepLinkRequestIdRef.current) return;
        setSelectedAnimeId(null);
        setSelectedAnimeRecord(null);
        setDeepLinkNotFoundSlug(clean);
      } finally {
        if (reqId === deepLinkRequestIdRef.current) {
          setDeepLinkLoading(false);
        }
      }
    },
    [findLoadedAnimeBySlugOrId]
  );

  // Deep-link and history navigation handler (always preserves slug in URL when available)
  const handleOpenAnime = useCallback(
    (animeOrId: number | string | { id: number; slug?: string } | null) => {
      setDeepLinkNotFoundSlug(null);
      setDeepLinkLoading(false);

      if (animeOrId === null || animeOrId === undefined) {
        setSelectedAnimeId(null);
        setSelectedAnimeRecord(null);
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/anime/')) {
          const fallbackPath =
            activeTab === 'language' && selectedSeoLanguage
              ? `/dubbed-anime/${getLanguageSlug(selectedSeoLanguage)}`
              : '/';
          window.history.pushState(null, '', fallbackPath);
        }
        return;
      }

      if (typeof animeOrId === 'object') {
        const idNum = Number(animeOrId.id);
        const found = findLoadedAnimeBySlugOrId(idNum);
        const resolvedRecord = { ...(found || {}), ...animeOrId };
        const resolvedSlug = resolvedRecord.slug || found?.slug;
        setSelectedAnimeRecord(resolvedRecord);
        setSelectedAnimeId(idNum);
        if (typeof window !== 'undefined') {
          const targetPath = resolvedSlug ? `/anime/${resolvedSlug}` : `/anime/${idNum}`;
          if (window.location.pathname !== targetPath) {
            window.history.pushState({ animeId: idNum, slug: resolvedSlug }, '', targetPath);
          }
        }
        return;
      }

      const found = findLoadedAnimeBySlugOrId(animeOrId);
      if (found && Number(found.id) > 0) {
        const idNum = Number(found.id);
        setSelectedAnimeRecord(found);
        setSelectedAnimeId(idNum);
        if (typeof window !== 'undefined') {
          const targetPath = found.slug ? `/anime/${found.slug}` : `/anime/${idNum}`;
          if (window.location.pathname !== targetPath) {
            window.history.pushState({ animeId: idNum, slug: found.slug }, '', targetPath);
          }
        }
        return;
      }

      // Not yet in loaded lists: fetch directly from /api/anime/:slugOrId
      if (typeof window !== 'undefined') {
        const targetPath = `/anime/${animeOrId}`;
        if (window.location.pathname !== targetPath) {
          window.history.pushState({ animeId: animeOrId }, '', targetPath);
        }
      }
      void resolveDeepLinkAnime(String(animeOrId));
    },
    [findLoadedAnimeBySlugOrId, resolveDeepLinkAnime, activeTab, selectedSeoLanguage]
  );

  // Handle URL deep-links on initial load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname;
    const languageMatch = parseLanguageFromPath(pathname);
    if (languageMatch) {
      setSelectedSeoLanguage(languageMatch.language);
      setActiveTab('language');
      return;
    }

    if (pathname.startsWith('/anime/')) {
      const slugOrId = pathname.replace(/^\/anime\//, '').split('/')[0].split('?')[0];
      if (slugOrId) {
        void resolveDeepLinkAnime(slugOrId);
      }
    } else if (pathname === '/admin' || pathname === '/admin/analytics') {
      if (isAdminAuthenticated) {
        setActiveTab('admin');
        setIsPasswordModalOpen(false);
      } else {
        setIsPasswordModalOpen(true);
      }
    } else if (pathname === '/explore' || pathname === '/catalog' || pathname === '/home') {
      setActiveTab('explore');
      if (pathname === '/home' && typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/');
      }
    } else if (pathname === '/watchlist' || pathname === '/library') {
      setActiveTab('watchlist');
    } else if (pathname === '/schedule') {
      setActiveTab('schedule');
    } else if (pathname === '/privacy' || pathname === '/privacy-policy') {
      setActiveTab('privacy');
    } else if (pathname === '/terms' || pathname === '/terms-of-service') {
      setActiveTab('terms');
    } else if (pathname === '/copyright' || pathname === '/dmca' || pathname === '/takedown') {
      setActiveTab('copyright');
    } else if (pathname === '/feedback') {
      setActiveTab('feedback');
    } else if (pathname === '/compare') {
      setIsCompareOpen(true);
    } else if (pathname === '/dub-radar' || pathname === '/radar') {
      setActiveTab('explore');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/');
      }
    } else if (pathname === '/dub-requests' || pathname === '/requests') {
      setActiveTab('explore');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/');
      }
    } else if (pathname === '/chat') {
      setActiveTab('chat');
    } else if (pathname === '/tierlist') {
      setActiveTab('tierlist');
    } else if (pathname === '/recommendations') {
      setActiveTab('recommendations');
    } else if (pathname === '/profile') {
      setActiveTab('profile');
    }
  }, [isAdminAuthenticated]);

  // Handle browser back and forward buttons cleanly (including deep-links outside first 24)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const languageMatch = parseLanguageFromPath(pathname);
      if (languageMatch) {
        setSelectedAnimeId(null);
        setSelectedAnimeRecord(null);
        setDeepLinkNotFoundSlug(null);
        setSelectedSeoLanguage(languageMatch.language);
        setActiveTab('language');
        return;
      }

      if (pathname.startsWith('/anime/')) {
        const slugOrId = pathname.replace(/^\/anime\//, '').split('/')[0].split('?')[0];
        if (slugOrId) {
          void resolveDeepLinkAnime(slugOrId);
        }
      } else {
        setSelectedAnimeId(null);
        setSelectedAnimeRecord(null);
        setDeepLinkNotFoundSlug(null);
        setDeepLinkLoading(false);
        setSelectedSeoLanguage(null);
        if (pathname === '/admin' && isAdminAuthenticated) {
          setActiveTab('admin');
        } else if (pathname === '/explore' || pathname === '/catalog' || pathname === '/home') {
          setActiveTab('explore');
        } else if (pathname === '/watchlist' || pathname === '/library') {
          setActiveTab('watchlist');
        } else if (pathname === '/schedule') {
          setActiveTab('schedule');
        } else if (pathname === '/privacy' || pathname === '/privacy-policy') {
          setActiveTab('privacy');
        } else if (pathname === '/terms' || pathname === '/terms-of-service') {
          setActiveTab('terms');
        } else if (pathname === '/copyright' || pathname === '/dmca' || pathname === '/takedown') {
          setActiveTab('copyright');
        } else if (pathname === '/feedback') {
          setActiveTab('feedback');
        } else if (pathname === '/dub-radar' || pathname === '/radar') {
          setActiveTab('explore');
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/');
          }
        } else if (pathname === '/dub-requests' || pathname === '/requests') {
          setActiveTab('explore');
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/');
          }
        } else if (pathname === '/chat') {
          setActiveTab('chat');
        } else if (pathname === '/tierlist') {
          setActiveTab('tierlist');
        } else if (pathname === '/recommendations') {
          setActiveTab('recommendations');
        } else if (pathname === '/profile') {
          setActiveTab('profile');
        } else if (pathname === '/') {
          setActiveTab('explore');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [resolveDeepLinkAnime, isAdminAuthenticated]);

  // Keep document SEO <title>, <meta>, OpenGraph, and canonical URL synchronized on client transitions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;

    if (selectedAnimeId !== null) {
      const matched = findLoadedAnimeBySlugOrId(selectedAnimeId);
      if (matched) {
        updateDocumentSeoMeta(buildAnimeSeoMeta(matched, origin, String(matched.slug || selectedAnimeId)));
        return;
      }
    }

    if (activeTab === 'language' && selectedSeoLanguage) {
      updateDocumentSeoMeta(buildLanguageSeoMeta(selectedSeoLanguage, origin));
      return;
    }

    if (activeTab === 'privacy') {
      const base = buildDefaultSeoMeta(origin);
      updateDocumentSeoMeta({
        ...base,
        title: 'Privacy Policy | AniDub India',
        ogTitle: 'Privacy Policy | AniDub India',
        description:
          'Learn how AniDub India handles account preferences, watchlist sync, and privacy as a legal Indian dubbed anime directory.',
        canonicalUrl: `${origin}/privacy`,
        ogType: 'website',
      });
      return;
    }

    if (activeTab === 'terms') {
      const base = buildDefaultSeoMeta(origin);
      updateDocumentSeoMeta({
        ...base,
        title: 'Terms of Service | AniDub India',
        ogTitle: 'Terms of Service | AniDub India',
        description:
          'Read the Terms of Service for AniDub India, a legal regional anime dub metadata and OTT discovery directory in India.',
        canonicalUrl: `${origin}/terms`,
        ogType: 'website',
      });
      return;
    }

    if (activeTab === 'copyright') {
      const base = buildDefaultSeoMeta(origin);
      updateDocumentSeoMeta({
        ...base,
        title: 'Copyright & Takedown Policy | AniDub India',
        ogTitle: 'Copyright & Takedown Policy | AniDub India',
        description:
          'AniDub India is a legal OTT discovery directory that does not host video streams. Read our DMCA and copyright takedown policy.',
        canonicalUrl: `${origin}/copyright`,
        ogType: 'website',
      });
      return;
    }

    updateDocumentSeoMeta(buildDefaultSeoMeta(origin));
  }, [activeTab, selectedSeoLanguage, selectedAnimeId, findLoadedAnimeBySlugOrId]);

  useEffect(() => {
    fetchCatalogList();
  }, []);

  const fetchCatalogList = async () => {
    setIsCatalogLoading(true);
    try {
      const response = await cloudflareApi.fetchCatalog({ page: 1, limit: 24 });
      
      const data = response?.data;
      if (data && Array.isArray(data) && data.length > 0) {
        const approvedOnly = data.filter((item: any) => 
          (item.submissionStatus === 'approved' || item.approval_status === 'approved' || item.is_published === 1)
        );
        setCatalogList(approvedOnly);
      } else {
        setCatalogList([]);
      }
    } catch (err: any) {
      console.warn('[Catalog API Notice]:', err?.message || err);
      setCatalogList([]);
    } finally {
      setIsCatalogLoading(false);
    }
  };

  // Hydrate watchlist from server/D1 on Clerk login and sync any local guest items
  useEffect(() => {
    if (!isSignedIn || !clerkUser?.id) {
      if (prevSignedInRef.current) {
        prevSignedInRef.current = false;
        hydratedUserRef.current = null;
        const cleared = writeWatchlistToStorage([], 'guest');
        watchlistRef.current = cleared;
        setWatchlist(cleared);
      } else {
        const owner = readWatchlistOwner();
        if (owner === 'guest') {
          const guestIds = readWatchlistFromStorage();
          watchlistRef.current = guestIds;
          setWatchlist(guestIds);
        }
      }
      return;
    }

    prevSignedInRef.current = true;
    if (hydratedUserRef.current === clerkUser.id) return;

    let cancelled = false;
    (async () => {
      try {
        const token = (await getToken()) || (await getClerkSessionToken());
        if (!token || cancelled) return;

        const serverRes = await cloudflareApi.fetchWatchlistDetailed(token);
        if (cancelled || !serverRes.ok) return;

        const localOwner = readWatchlistOwner();
        const guestIds = localOwner === 'guest' ? readWatchlistFromStorage() : [];
        const { mergedIds, toSyncIds } = mergeGuestAndServerWatchlist(serverRes.ids, guestIds);

        if (toSyncIds.length > 0) {
          for (const idToSync of toSyncIds) {
            if (cancelled) return;
            await cloudflareApi.addToWatchlist(idToSync, token);
          }
        }

        if (cancelled) return;
        hydratedUserRef.current = clerkUser.id;
        if (Array.isArray(serverRes.items) && serverRes.items.length > 0) {
          setHydratedByIdList((prev) => {
            const byId = new Map<number, any>();
            for (const item of prev) byId.set(Number(item.id), item);
            for (const item of serverRes.items) {
              const idNum = Number(item.id);
              if (Number.isInteger(idNum) && idNum > 0) {
                hydratedByIdFetchedRef.current.add(idNum);
                byId.set(idNum, item);
              }
            }
            return Array.from(byId.values());
          });
        }
        const persisted = writeWatchlistToStorage(mergedIds, clerkUser.id);
        watchlistRef.current = persisted;
        setWatchlist(persisted);
      } catch (err) {
        console.warn('Watchlist hydration skipped:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, clerkUser?.id, getToken]);

  const addToRecentlyViewed = useCallback(
    (anime: any) => {
      const idNum = Number(anime?.id);
      if (!Number.isInteger(idNum) || idNum <= 0) return;

      setHydratedByIdList((prev) => {
        const existingIdx = prev.findIndex((item) => Number(item.id) === idNum);
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = { ...copy[existingIdx], ...anime };
          return copy;
        }
        return [anime, ...prev];
      });

      setRecentlyViewed((prev) => {
        const filtered = prev.filter((item) => Number(item?.id) !== idNum);
        const updated = [anime, ...filtered].slice(0, 10);
        writeScopedJson('cf_anime_recently_viewed', updated, activeUserId);
        return updated;
      });
    },
    [activeUserId]
  );

  const handleClearRecentlyViewed = useCallback(() => {
    setRecentlyViewed([]);
    removeScopedKey('cf_anime_recently_viewed', activeUserId);
  }, [activeUserId]);

  const handleRemoveRecentlyViewedItem = useCallback(
    (animeId: number) => {
      setRecentlyViewed((prev) => {
        const updated = prev.filter((item) => item.id !== animeId);
        writeScopedJson('cf_anime_recently_viewed', updated, activeUserId);
        return updated;
      });
    },
    [activeUserId]
  );

  const handleToggleWatchlist = useCallback(async (animeId: number) => {
    const idNum = Number(animeId);
    if (!Number.isInteger(idNum) || idNum <= 0) return;

    const previousIds = watchlistRef.current;
    const isCurrentlySaved = previousIds.map(Number).includes(idNum);
    const { ids: nextIds } = toggleWatchlistIdLocally(previousIds, idNum);
    const ownerTag = isSignedIn && clerkUser?.id ? clerkUser.id : 'guest';

    watchlistRef.current = nextIds;
    setWatchlist(nextIds);
    writeWatchlistToStorage(nextIds, ownerTag);

    if (!isSignedIn) {
      return;
    }

    try {
      const token = (await getToken()) || (await getClerkSessionToken());
      if (!token) {
        writeWatchlistToStorage(nextIds, 'guest');
        return;
      }

      const result = isCurrentlySaved
        ? await cloudflareApi.removeFromWatchlist(idNum, token)
        : await cloudflareApi.addToWatchlist(idNum, token);

      if (!result.success) {
        const refreshed = await cloudflareApi.fetchWatchlistDetailed(token);
        if (refreshed.ok) {
          const synced = writeWatchlistToStorage(refreshed.ids, clerkUser?.id || 'guest');
          watchlistRef.current = synced;
          setWatchlist(synced);
        } else {
          // Retain local guest cache if network/server is temporarily unreachable
          writeWatchlistToStorage(nextIds, 'guest');
        }
      }
    } catch (err) {
      console.error('Failed to sync watchlist toggle:', err);
      writeWatchlistToStorage(nextIds, 'guest');
    }
  }, [isSignedIn, clerkUser?.id, getToken]);

  useEffect(() => {
    if (!isSignedIn) {
      setIsServerClerkAdmin(false);
      setIsAdminAuthenticated(false);
      if (activeTab === 'admin') {
        setActiveTab('explore');
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = (await getToken()) || (await getClerkSessionToken());
        const res = await fetch(getCloudflareUrl('/api/admin/verify'), {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.status === 200) {
          if (cancelled) return;
          setIsServerClerkAdmin(true);
          setIsAdminAuthenticated(true);
          setIsPasswordModalOpen(false);
          setAdminAuthError('');
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
            setActiveTab('admin');
          }
          return;
        }

        const data: any = await res.json().catch(() => ({}));
        if (cancelled) return;
        const backendError = data.error || data.message || `HTTP ${res.status}`;
        setIsServerClerkAdmin(false);
        setIsAdminAuthenticated(false);
        setAdminAuthError(`Backend Error: ${backendError}`);
        if (activeTab === 'admin') setActiveTab('explore');
      } catch (err: any) {
        if (!cancelled) {
          setAdminAuthError(`Backend Error: ${err?.message || 'Unable to verify Clerk Admin session.'}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isClientClerkAdmin, activeTab, getToken]);

  const handleVerifyClerkAdminUnlock = async () => {
    if (!isSignedIn) {
      setAdminAuthError('Backend Error: Only the authorized Clerk Administrator can unlock /admin.');
      return;
    }
    setAdminPasswordLoading(true);
    setAdminAuthError('');
    try {
      const token = (await getToken()) || (await getClerkSessionToken());
      const res = await fetch(getCloudflareUrl('/api/admin/verify'), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 200) {
        setIsServerClerkAdmin(true);
        setIsAdminAuthenticated(true);
        setActiveTab('admin');
        setIsPasswordModalOpen(false);
        setAdminAuthError('');
        return;
      }

      const data: any = await res.json().catch(() => ({}));
      const backendError = data.error || data.message || `HTTP ${res.status}`;
      setAdminAuthError(`Backend Error: ${backendError}`);
    } catch (err: any) {
      setAdminAuthError(`Backend Error: ${err?.message || 'Unable to verify Clerk Admin session.'}`);
    } finally {
      setAdminPasswordLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await cloudflareApi.logoutAdmin();
    } catch {}

    setIsAdminAuthenticated(false);
    setActiveTab('explore');
  };

  const recentlyViewedIds = React.useMemo(
    () => normalizeWatchlistIds(recentlyViewed),
    [recentlyViewed]
  );

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Hydrate missing Watchlist & Recently Viewed anime records directly from D1 (?ids=...)
  useEffect(() => {
    const allSavedIds = Array.from(new Set([...watchlist, ...recentlyViewedIds]));
    if (allSavedIds.length === 0) return;

    const notHydratedYet = findMissingAnimeIds(allSavedIds, hydratedByIdList);
    const idsToFetch = notHydratedYet.filter((id) => !hydratedByIdFetchedRef.current.has(id));

    if (idsToFetch.length === 0) return;

    idsToFetch.forEach((id) => hydratedByIdFetchedRef.current.add(id));

    cloudflareApi
      .fetchAnimeByIds(idsToFetch)
      .then((fetchedItems) => {
        if (!isMountedRef.current || !Array.isArray(fetchedItems) || fetchedItems.length === 0) return;
        setHydratedByIdList((prev) => {
          const byId = new Map<number, any>();
          for (const item of prev) byId.set(Number(item.id), item);
          for (const item of fetchedItems) {
            const idNum = Number(item.id);
            if (Number.isInteger(idNum) && idNum > 0) {
              byId.set(idNum, item);
            }
          }
          return Array.from(byId.values());
        });
      })
      .catch((err) => {
        idsToFetch.forEach((id) => hydratedByIdFetchedRef.current.delete(id));
        console.warn('[Saved IDs Hydration Notice]:', err);
      });
  }, [watchlist, recentlyViewedIds, hydratedByIdList]);

  const completeRecentlyViewed = React.useMemo(
    () => recentlyViewed.filter((item) => Boolean(item && item.title)),
    [recentlyViewed]
  );

  // Verified saved watchlist resolved from D1 hydrated items + loaded catalog (never dropped at 24-item pagination boundary)
  const realSavedWatchlist = React.useMemo(
    () => resolveHydratedAnimeList(watchlist, [hydratedByIdList, catalogList, completeRecentlyViewed]).filter(
      (item) => Boolean(item && item.title)
    ),
    [watchlist, hydratedByIdList, catalogList, completeRecentlyViewed]
  );

  // Verified recently viewed resolved directly from D1 hydrated items + loaded catalog
  const realRecentlyViewed = React.useMemo(
    () => resolveHydratedAnimeList(recentlyViewedIds, [hydratedByIdList, catalogList, completeRecentlyViewed]).filter(
      (item) => Boolean(item && item.title)
    ),
    [recentlyViewedIds, hydratedByIdList, catalogList, completeRecentlyViewed]
  );

  const handleToggleLike = useCallback((animeId: number, _liked?: boolean, count?: number) => {
    setCatalogList(prev => prev.map(a => {
      if (a.id === animeId || String(a.id) === String(animeId)) {
        return { ...a, likesCount: count ?? a.likesCount };
      }
      return a;
    }));
  }, []);

  const handleToggleUpvote = useCallback((animeId: number, _upvoted?: boolean, count?: number) => {
    setCatalogList(prev => prev.map(a => {
      if (a.id === animeId || String(a.id) === String(animeId)) {
        return { ...a, popularity: count ?? a.popularity };
      }
      return a;
    }));
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#0B0A10] dark:bg-[#0B0A10] text-[#F4F3FA] flex flex-col font-sans selection:bg-[#B49AF8] selection:text-[#0B0A10] transition-colors duration-200 box-border">
      
      {/* GOD-MODE FIRST-PARTY EDGE ANALYTICS & TELEMETRY TRACKER */}
      <Suspense fallback={null}>
        <GodModeTracker activeTab={activeTab} activeAnimeSlug={activeAnimeSlug} />
      </Suspense>

      {/* OFFLINE STATUS INDICATOR (PWA) */}
      <OfflineIndicator />

      {/* 1. NAVBAR */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        watchlistCount={Math.max(watchlist.length, realSavedWatchlist.length)}
        onUnlockAdmin={() => {
          if (!isAdminAuthenticated || !isClerkAdmin) {
            setIsPasswordModalOpen(true);
            setAdminAuthError('');
          } else {
            if (activeTab !== 'admin') {
              handleNavigateTab('admin');
            } else {
              handleNavigateTab('explore');
            }
          }
        }}
        onOpenCollection={() => setIsCollectionOpen(true)}
        onOpenCompare={() => handleOpenCompare(null)}
        onSubmitDub={() => setIsDubModalOpen(true)}
        onSelectAnime={(id) => handleOpenAnime(id)}
        feedView={feedView}
        setFeedView={setFeedView}
        isAdminAuthenticated={isAdminAuthenticated && isClerkAdmin}
        onLogout={handleAdminLogout}
        currentLang={currentLang}
        setCurrentLang={setCurrentLang}
      />

      {/* 2. ADMIN DASHBOARD (Protected strictly by Clerk Admin Auth) */}
      {activeTab === 'admin' && isAdminAuthenticated && isClerkAdmin && (
        <Suspense fallback={<ViewLoadingFallback />}>
          <AdminDashboard
            catalogList={catalogList}
            onAnimeCreated={(updatedAnime?: any, deletedId?: string | number) => {
              cloudflareApi.clearCatalogIndexCache();
              if (deletedId !== undefined && deletedId !== null) {
                setCatalogList(prev => prev.filter(a => String(a.id) !== String(deletedId)));
                setFullCatalogIndex(prev => prev.filter(a => String(a.id) !== String(deletedId)));
                setRecentlyViewed(prev => prev.filter(a => String(a.id) !== String(deletedId)));
                return;
              }
              if (updatedAnime) {
                const targetId = updatedAnime.id;
                const newCover = updatedAnime.posterUrl || updatedAnime.image || updatedAnime.cover_image || updatedAnime.poster;
                const resolvedStatus = updatedAnime.status || updatedAnime.airing_status || (updatedAnime.type === 'Movie' ? 'Completed' : 'Airing');
                const normalizedItem = {
                  ...updatedAnime,
                  image: newCover,
                  cover_image: newCover,
                  poster: newCover,
                  status: resolvedStatus,
                  airing_status: resolvedStatus,
                };

                setCatalogList(prev => {
                  const exists = prev.some(a => a.id === targetId || String(a.id) === String(targetId));
                  if (exists) {
                    return prev.map(a => (a.id === targetId || String(a.id) === String(targetId)) ? { ...a, ...normalizedItem } : a);
                  } else {
                    return [normalizedItem, ...prev];
                  }
                });

                setFullCatalogIndex(prev => {
                  if (prev.length === 0) return prev;
                  const exists = prev.some(a => a.id === targetId || String(a.id) === String(targetId));
                  if (exists) {
                    return prev.map(a => (a.id === targetId || String(a.id) === String(targetId)) ? { ...a, ...normalizedItem } : a);
                  }
                  return [normalizedItem, ...prev];
                });

                setRecentlyViewed(prev => {
                  const exists = prev.some(a => a.id === targetId || String(a.id) === String(targetId));
                  if (exists) {
                    return prev.map(a => (a.id === targetId || String(a.id) === String(targetId)) ? { ...a, ...normalizedItem } : a);
                  } else {
                    return [normalizedItem, ...prev];
                  }
                });
              } else {
                // Fallback refetch if no payload
                fetchCatalogList();
              }
            }}
            onLogout={handleAdminLogout}
            onNavigateHome={() => handleNavigateTab('explore')}
          />
        </Suspense>
      )}

      {/* 3. MAIN CONTENT VIEWS WITH SMOOTH PAGE TRANSITIONS */}
      <main className="flex-grow w-full max-w-full overflow-x-clip pt-3 sm:pt-5 pb-24 sm:pb-16 transition-colors duration-150 box-border">
        <AnimatePresence mode="wait">
          <motion.div
            key={`page_view_${activeTab}_${activeTab === 'explore' ? feedView : ''}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="w-full min-w-0 max-w-full overflow-x-clip"
          >
            {/* FOR YOU HEADER METADATA BLOCK (WHEN FORYOU FEED ACTIVE) */}
            {feedView === 'foryou' && (activeTab === 'explore' || activeTab === 'catalog') && (
              <div className="w-full max-w-5xl mx-auto px-4 mb-5">
                <div className="p-4 rounded-2xl bg-[#12141E] border border-[#292B39] flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-[#F4F3FA]">Recommended For You</h2>
                    <p className="text-xs text-[#A1A5B5]">Curated specifically based on your watch history and dub preferences.</p>
                  </div>
                </div>
              </div>
            )}

            {/* MAIN EXPLORE CATALOG VIEW */}
            {(activeTab === 'explore' || activeTab === 'catalog') && feedView !== 'foryou' && (
              <CatalogView
                mode="explore"
                catalogList={catalogList}
                fullCatalogIndex={effectiveFullCatalog}
                onSelectAnime={(anime) => {
                  handleOpenAnime(anime);
                  addToRecentlyViewed(anime);
                }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                onToggleLike={handleToggleLike}
                onToggleUpvote={handleToggleUpvote}
                onOpenRoulette={() => setIsRouletteOpen(true)}
                onOpenCollection={() => setIsCollectionOpen(true)}
                onOpenExplore={() => handleNavigateTab('explore')}
                onOpenRecommendations={() => handleNavigateTab('recommendations')}
                onOpenCompare={() => handleOpenCompare(null)}
                userId={activeUserId}
                feedView={feedView}
                recentlyViewed={realRecentlyViewed}
                onClearRecentlyViewed={handleClearRecentlyViewed}
                onRemoveRecentlyViewedItem={handleRemoveRecentlyViewedItem}
                uiLanguage={currentLang as any}
                mySubscriptions={mySubscriptions}
                mySubscriptionsEnabled={mySubscriptionsEnabled}
                onToggleSubscriptionPlatform={handleToggleSubscriptionPlatform}
                onToggleMySubscriptionsEnabled={handleToggleMySubscriptionsEnabled}
                onClearSubscriptions={handleClearSubscriptions}
              />
            )}

            {/* INTERACTIVE RECOMMENDATION SYSTEM (FOR YOU / MATCHMAKER) */}
            {(activeTab === 'recommendations' || activeTab === 'foryou' || ((activeTab === 'explore' || activeTab === 'catalog') && feedView === 'foryou')) && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <RecommendationSystem
                  catalogList={effectiveFullCatalog}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime);
                    addToRecentlyViewed(anime);
                  }}
                  watchlist={watchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  onNavigateCatalog={() => {
                    handleNavigateTab('explore');
                    setFeedView('library');
                  }}
                  mySubscriptions={mySubscriptions}
                  mySubscriptionsEnabled={mySubscriptionsEnabled}
                  onToggleMySubscriptionsEnabled={handleToggleMySubscriptionsEnabled}
                />
              </Suspense>
            )}

            {/* WATCHLIST / STATUS-BASED LIBRARY VIEW */}
            {(activeTab === 'watchlist' || activeTab === 'library') && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <WatchlistView
                  watchlist={realSavedWatchlist}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime);
                    addToRecentlyViewed(anime);
                  }}
                  onToggleWatchlist={handleToggleWatchlist}
                  onNavigateToCatalog={() => handleNavigateTab('explore')}
                  onOpenCreateCollection={() => setIsCollectionOpen(true)}
                  onOpenCompare={() => handleOpenCompare(null)}
                  isSignedIn={Boolean(isSignedIn)}
                  userId={activeUserId}
                />
              </Suspense>
            )}

            {/* WEEKLY SIMULCAST SCHEDULE VIEW */}
            {activeTab === 'schedule' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <WeeklyScheduleView
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime);
                    addToRecentlyViewed(anime);
                  }}
                  watchlist={watchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  onOpenSubmitDubModal={() => setIsDubModalOpen(true)}
                  catalogList={effectiveFullCatalog}
                />
              </Suspense>
            )}





            {/* PROFILE VIEW */}
            {activeTab === 'profile' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <ProfileView
                  watchlist={watchlist}
                  catalogList={effectiveFullCatalog}
                  savedAnimeItems={realSavedWatchlist}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime);
                    addToRecentlyViewed(anime);
                  }}
                  onToggleWatchlist={handleToggleWatchlist}
                  onOpenCreateCollection={() => setIsCollectionOpen(true)}
                  onNavigateToCatalog={() => handleNavigateTab('explore')}
                  onOpenSubmitDub={() => setIsDubModalOpen(true)}
                  onOpenFeedback={() => handleNavigateTab('feedback')}
                  onOpenLegal={handleOpenLegal}
                  onShowToast={handleAppToast}
                />
              </Suspense>
            )}

            {/* TIER LIST MAKER VIEW */}
            {activeTab === 'tierlist' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <AnimeTierListMaker
                  catalogList={effectiveFullCatalog}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime);
                    addToRecentlyViewed(anime);
                  }}
                  onNavigateHome={() => handleNavigateTab('explore')}
                />
              </Suspense>
            )}

            {/* REGIONAL LANGUAGE SEO LANDING VIEW (/dubbed-anime/:language) */}
            {activeTab === 'language' && selectedSeoLanguage && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <LanguageLandingView
                  language={selectedSeoLanguage}
                  catalogList={effectiveFullCatalog}
                  watchlist={watchlist}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime);
                    addToRecentlyViewed(anime);
                  }}
                  onToggleWatchlist={handleToggleWatchlist}
                  onToggleLike={handleToggleLike}
                  onToggleUpvote={handleToggleUpvote}
                  onNavigateLanguage={handleNavigateLanguage}
                  onNavigateHome={() => handleNavigateTab('explore')}
                />
              </Suspense>
            )}

            {/* LIVE COMMUNITY CHAT VIEW */}
            {activeTab === 'chat' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <CommunityChatView
                  onNavigateToCatalog={() => handleNavigateTab('explore')}
                  onSelectAnime={(anime) => {
                    handleOpenAnime(anime);
                    addToRecentlyViewed(anime);
                  }}
                />
              </Suspense>
            )}

            {/* DEDICATED FEEDBACK & SUBMISSION PAGE (/feedback) */}
            {activeTab === 'feedback' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <FeedbackSection
                  mode="full"
                  onSubmitDub={() => setIsDubModalOpen(true)}
                  onNavigateLanguage={handleNavigateLanguage}
                  onOpenLegal={handleOpenLegal}
                  onOpenPrivacy={() => handleNavigateTab('privacy')}
                  onOpenCopyright={() => handleNavigateTab('copyright')}
                  onShowToast={handleAppToast}
                />
              </Suspense>
            )}

            {/* PUBLIC LEGAL PAGES: PRIVACY POLICY (/privacy), TERMS (/terms) & COPYRIGHT/TAKEDOWN (/copyright) */}
            {(activeTab === 'privacy' || activeTab === 'copyright' || activeTab === 'terms') && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <LegalPage
                  page={
                    activeTab === 'copyright'
                      ? 'copyright'
                      : activeTab === 'terms'
                        ? 'terms'
                        : 'privacy'
                  }
                  onNavigateHome={() => handleNavigateTab('explore')}
                  onSwitchLegalPage={(nextPage) => handleNavigateTab(nextPage)}
                  onOpenFeedback={() => handleNavigateTab('feedback')}
                />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* COMPACT FOOTER WITH LEGAL LINKS (Hidden on full feedback page to avoid duplication) */}
      {activeTab !== 'feedback' && activeTab !== 'admin' && (
        <Suspense fallback={null}>
          <FeedbackSection
            mode="footer"
            onSubmitDub={() => setIsDubModalOpen(true)}
            onNavigateLanguage={handleNavigateLanguage}
            onOpenFeedbackPage={() => handleNavigateTab('feedback')}
            onOpenLegal={handleOpenLegal}
            onOpenPrivacy={() => handleNavigateTab('privacy')}
            onOpenCopyright={() => handleNavigateTab('copyright')}
            onShowToast={handleAppToast}
          />
        </Suspense>
      )}


      {/* MODALS WITH SPRING ANIMATEPRESENCE */}
      <AnimatePresence>
        {/* 0. Deep-Link Loading Indicator */}
        {deepLinkLoading && selectedAnimeId === null && (
          <ModalLoadingFallback key="deep-link-loading" />
        )}

        {/* 0.5 Deep-Link 404 Not Found Modal */}
        {deepLinkNotFoundSlug && selectedAnimeId === null && !deepLinkLoading && (
          <div
            key="anime-not-found-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Anime Not Found"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          >
            <div className="max-w-md w-full rounded-2xl bg-[#12141E] border border-[#292B39] p-6 sm:p-8 shadow-2xl text-center space-y-4">
              <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-[#F87171]/15 border border-[#F87171]/30 text-[#F87171] text-xs font-bold uppercase tracking-wider">
                404 • Not Found
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#F4F3FA]">Anime Not Found</h2>
              <p className="text-xs sm:text-sm text-[#A1A5B5] leading-relaxed">
                We couldn&apos;t find a published anime matching{' '}
                <span className="text-[#F4F3FA] font-semibold">&ldquo;{deepLinkNotFoundSlug}&rdquo;</span> in the AniDub India catalog.
              </p>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => handleOpenAnime(null)}
              >
                Back to Catalog
              </Button>
            </div>
          </div>
        )}

        {/* 1. Anime Detail Modal */}
        {selectedAnimeId !== null && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <AnimeDetailModal
              key="anime-detail-modal"
              animeId={selectedAnimeId}
              initialAnime={selectedAnimeRecord}
              allAnime={effectiveFullCatalog}
              user={currentUserSummary}
              onResolvedAnime={(resolved) => {
                setSelectedAnimeRecord(resolved);
                if (typeof window !== 'undefined' && resolved?.slug) {
                  const canonicalPath = `/anime/${resolved.slug}`;
                  if (window.location.pathname !== canonicalPath) {
                    window.history.replaceState(
                      { animeId: resolved.id, slug: resolved.slug },
                      '',
                      canonicalPath
                    );
                  }
                }
              }}
              onSelectAnime={(anime) => {
                handleOpenAnime(anime);
                addToRecentlyViewed(anime);
              }}
              onClose={() => handleOpenAnime(null)}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              onCompareAnime={(anime) => handleOpenCompare(anime)}
              onShowToast={handleAppToast}
            />
          </Suspense>
        )}

        {/* 1.5 Compare Anime Side-by-Side Modal */}
        {isCompareOpen && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <CompareAnimeModal
              key="compare-anime-modal"
              catalogList={effectiveFullCatalog}
              initialLeftAnime={compareInitialAnime}
              onClose={() => setIsCompareOpen(false)}
              onSelectAnime={(anime) => {
                setIsCompareOpen(false);
                handleOpenAnime(anime);
                addToRecentlyViewed(anime);
              }}
            />
          </Suspense>
        )}

        {/* 2. Surprise Me Roulette Modal */}
        {isRouletteOpen && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <RouletteModal
              key="roulette-modal"
              animeList={effectiveFullCatalog}
              onClose={() => setIsRouletteOpen(false)}
              onSelectAnime={(anime) => {
                handleOpenAnime(anime);
                addToRecentlyViewed(anime);
              }}
            />
          </Suspense>
        )}

        {/* 3. Shareable Custom Collection Modal */}
        {isCollectionOpen && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <CreateCollectionModal
              key="collection-modal"
              animeList={effectiveFullCatalog}
              onClose={() => setIsCollectionOpen(false)}
            />
          </Suspense>
        )}

        {/* 4. Submit Dub Info Modal */}
        {isDubModalOpen && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <DubInfoModal
              key="dub-info-modal"
              isOpen={isDubModalOpen}
              onClose={() => setIsDubModalOpen(false)}
              onSubmit={() => {
                setIsDubModalOpen(false);
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* 5. Clerk Admin Authentication Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85">
          <div className="w-full max-w-md bg-[#12141E] border border-[#292B39] rounded-2xl p-6 shadow-2xl relative">
            <div className="text-center mb-5 flex flex-col items-center">
              <AniDubLogo variant="stacked" size="sm" className="mb-3" />
              <h3 className="text-lg font-extrabold text-[#F4F3FA]">Clerk Admin Protection</h3>
              <p className="text-xs text-[#A1A5B5] mt-1">
                Strict Clerk Authentication is required to access <code className="text-[#B49AF8]">/admin</code>
              </p>
            </div>

            {!isSignedIn ? (
              <div className="flex flex-col items-center space-y-4">
                <SignIn />
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setIsPasswordModalOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : isClerkAdmin ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#34D399]/10 border border-[#34D399]/30 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#34D399] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#34D399]">Authorized Clerk Administrator</p>
                    <p className="text-[11px] text-[#A1A5B5] truncate">{clerkUser?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                </div>

                {adminAuthError && (
                  <div className="p-3 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-[11px] text-[#F87171] font-medium text-center break-words">
                    {adminAuthError}
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    onClick={() => setIsPasswordModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    className="flex-1"
                    onClick={handleVerifyClerkAdminUnlock}
                    disabled={adminPasswordLoading}
                  >
                    {adminPasswordLoading ? 'Verifying...' : 'Open Admin Console'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#F87171]/10 border border-[#F87171]/30 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-[#F87171] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#F87171]">Admin Verification Status</p>
                    <p className="text-[11px] text-[#A1A5B5] mt-1">
                      Signed in as <span className="font-mono text-[#F4F3FA]">{clerkUser?.primaryEmailAddress?.emailAddress}</span>.
                    </p>
                    {adminAuthError && (
                      <p className="text-[11px] text-[#F87171] mt-2 font-medium break-words">
                        {adminAuthError}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleVerifyClerkAdminUnlock}
                  disabled={adminPasswordLoading}
                >
                  {adminPasswordLoading ? 'Verifying...' : 'Open Admin Console'}
                </Button>

                <div className="flex gap-2.5 pt-1">
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    onClick={() => setIsPasswordModalOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    className="flex-1"
                    onClick={() => clerkSignOut()}
                    leftIcon={<LogOut className="w-3.5 h-3.5" />}
                  >
                    Switch Account
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
