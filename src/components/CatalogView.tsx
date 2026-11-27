import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Dices,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  Loader2,
  Search,
  SlidersHorizontal,
  Star,
  CheckCircle2,
  Tv,
  WifiOff,
  X,
} from 'lucide-react';
import { AnimeCard } from './AnimeCard';
import { OttHubSection } from './OttHubSection';
import { LatestDubUpdatesCard } from './LatestDubUpdatesCard';
import { Button } from './ui/Button';
import { ExploreIcon } from './IconRegistry';
import { cloudflareApi, type CatalogMeta, type CatalogSummary } from '../services/cloudflareApi';
import { computeDynamicLanguageFilters } from '../utils/languages';
import {
  buildActiveFilterChips,
  EPISODE_LENGTH_OPTIONS,
  type EpisodeLengthBucket,
  type ActiveFilterChip,
} from '../utils/smartFilters';
import { SkeletonGrid } from './SkeletonGrid';
import { proxyUrl } from '../utils/imgbb';
import type { SupportedLanguage } from '../utils/i18n';
import {
  CANONICAL_OTT_FILTER_OPTIONS,
  calculateSubscriptionCoverage,
} from '../utils/ottHub';
import {
  addRecentSearch,
  buildShareableFilterQuery,
  clearRecentSearches,
  parseFiltersFromSearchParams,
  readPreferredLanguage,
  readRecentSearches,
  removeRecentSearch,
  writePreferredLanguage,
} from '../utils/searchFilterState';
import { ACCOUNT_CHANGED_EVENT } from '../utils/accountIsolation';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { formatLocaleNumber, normalizeRegionalSearchQuery } from '../i18n/languageRegistry';

const RecentlyViewedRow = lazy(() => import('./RecentlyViewedRow').then(m => ({ default: m.RecentlyViewedRow })));

export interface Anime {
  id: number;
  title: string;
  slug: string;
  synopsis: string;
  cover_image: string;
  banner_image: string;
  rating: number;
  episodes_count: number;
  status: string;
  season: string;
  year: number;
  releaseYear?: number;
  genres: string;
  popularity: number;
  likesCount?: number;
  languages?: string;
  platform?: string;
  type?: string;
  streamUrl?: string;
}

export interface CatalogViewProps {
  catalogList?: any[];
  fullCatalogIndex?: any[];
  onSelectAnime: (anime: Anime) => void;
  searchQuery: string;
  setSearchQuery?: (query: string) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onToggleLike?: (animeId: number, liked: boolean, count: number) => void;
  onToggleUpvote?: (animeId: number, upvoted: boolean, count: number) => void;
  onOpenRoulette: () => void;
  onOpenCollection: () => void;
  onOpenExplore?: () => void;
  onOpenRecommendations?: () => void;
  onOpenCompare?: () => void;
  userId?: string | null;
  mode?: 'home' | 'explore';
  feedView?: string;
  recentlyViewed?: any[];
  onClearRecentlyViewed?: () => void;
  onRemoveRecentlyViewedItem?: (id: number) => void;
  uiLanguage?: SupportedLanguage;
  mySubscriptions?: string[];
  mySubscriptionsEnabled?: boolean;
  onToggleSubscriptionPlatform?: (platformId: string) => void;
  onToggleMySubscriptionsEnabled?: (enabled: boolean) => void;
  onClearSubscriptions?: () => void;
}

export const FALLBACK_SEED_ANIME: Anime[] = [];

export const CATALOG_BATCH_SIZE = 12;
export const CATALOG_BATCHES_PER_CYCLE = 4;
export const CATALOG_AUTO_LOAD_CYCLE_LIMIT = CATALOG_BATCH_SIZE * CATALOG_BATCHES_PER_CYCLE; // 48 anime per cycle

/**
 * Strictly deduplicates appended anime batches by unique Anime ID so duplicate cards never render.
 */
export function deduplicateAnimeById<T extends { id: number | string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of existing) {
    if (!item || item.id === undefined || item.id === null) continue;
    const key = String(item.id).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  for (const item of incoming) {
    if (!item || item.id === undefined || item.id === null) continue;
    const key = String(item.id).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

/**
 * Determines whether automatic infinite scroll should pause after completing a 48-anime (4-batch) cycle.
 */
export function shouldPauseAutoLoadCycle(
  batchesLoadedInCycle: number,
  totalLoadedItems: number,
  hasNextPage: boolean
): boolean {
  if (!hasNextPage) return false;
  if (batchesLoadedInCycle >= CATALOG_BATCHES_PER_CYCLE) return true;
  if (
    totalLoadedItems > 0 &&
    totalLoadedItems % CATALOG_AUTO_LOAD_CYCLE_LIMIT === 0 &&
    batchesLoadedInCycle > 0
  ) {
    return true;
  }
  return false;
}

interface ExploreCatalogCacheSnapshot {
  filterSignature: string;
  items: Anime[];
  meta: CatalogMeta;
  summary: CatalogSummary | null;
  batchesInCycle: number;
  isCyclePaused: boolean;
  scrollY: number;
}

let exploreCatalogMemoryCache: ExploreCatalogCacheSnapshot | null = null;
const EXPLORE_SCROLL_STORAGE_KEY = 'anidub_explore_scroll_y_v1';

const GENRES = [
  'All Genres',
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai',
  'Mystery', 'Romance', 'Sci-Fi', 'Shonen', 'Seinen', 'Shoujo', 'Josei',
  'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Mecha', 'Psychological',
  'Music', 'Military', 'Historical', 'Martial Arts', 'Ecchi', 'Gourmet', 'Workplace',
  'School', 'Mythology', 'Parody',
];
const PLATFORMS: string[] = [...CANONICAL_OTT_FILTER_OPTIONS];
const TYPES = ['All Types', 'TV Series', 'Movie', 'OVA', 'Special'];
const STATUSES = ['All Status', 'Airing', 'Completed', 'Upcoming'];
const SORTS = [
  { label: 'Most Upvoted', value: 'popularity' },
  { label: 'Highest Rated', value: 'rating' },
  { label: 'Newest', value: 'newest' },
  { label: 'A–Z', value: 'title' },
];

const FEATURED_PLATFORMS = [
  'All Platforms',
  'Crunchyroll',
  'Netflix',
  'JioHotstar',
  'Anime Times',
  'Muse India',
  'Prime Video',
];

export const NATIVE_LANGUAGE_SCRIPT: Record<string, string> = {
  tamil: 'தமிழ்',
  hindi: 'हिन्दी',
  telugu: 'తెలుగు',
  malayalam: 'മലയാളം',
  kannada: 'ಕನ್ನಡ',
  bengali: 'বাংলা',
  marathi: 'मराठी',
  gujarati: 'ગુજરાતી',
  punjabi: 'ਪੰਜਾਬੀ',
};

const CatalogViewComponent: React.FC<CatalogViewProps> = ({
  catalogList,
  fullCatalogIndex = [],
  onSelectAnime,
  searchQuery,
  setSearchQuery,
  watchlist,
  onToggleWatchlist,
  onToggleLike,
  onToggleUpvote,
  onOpenRoulette,
  onOpenRecommendations,
  onOpenCompare,
  userId = null,
  feedView = 'library',
  recentlyViewed = [],
  onClearRecentlyViewed,
  onRemoveRecentlyViewedItem,
  mySubscriptions = [],
  mySubscriptionsEnabled = false,
  onToggleSubscriptionPlatform,
  onToggleMySubscriptionsEnabled,
  onClearSubscriptions,
}) => {
  const toast = useToast();
  const { t } = useTranslation(['explore', 'common']);
  const { language: uiLocale } = useLanguage();

  // Parse initial shareable URL query params once on mount
  const initialUrlFilters = useMemo(() => {
    if (typeof window === 'undefined') return {};
    return parseFiltersFromSearchParams(window.location.search);
  }, []);

  const [internalSearch, setInternalSearch] = useState(
    () => initialUrlFilters.search || searchQuery || ''
  );

  // Sync URL ?q= into parent searchQuery on initial load if present
  useEffect(() => {
    if (initialUrlFilters.search && setSearchQuery && !searchQuery) {
      setSearchQuery(initialUrlFilters.search);
    }
  }, [initialUrlFilters.search]);

  // Keep internalSearch in sync with prop
  useEffect(() => {
    setInternalSearch(searchQuery || '');
  }, [searchQuery]);

  const effectiveSearch = setSearchQuery ? searchQuery : internalSearch;

  const handleSearchChange = useCallback(
    (val: string) => {
      setInternalSearch(val);
      if (setSearchQuery) {
        setSearchQuery(val);
      }
    },
    [setSearchQuery]
  );

  const CATALOG_PAGE_SIZE = CATALOG_BATCH_SIZE;

  // Filter States (URL params take priority, then persisted saved language preference)
  const [selectedLanguage, setSelectedLanguageState] = useState<string>(() => {
    if (initialUrlFilters.language) return initialUrlFilters.language;
    return readPreferredLanguage(userId);
  });
  const [selectedGenre, setSelectedGenre] = useState<string>(
    () => initialUrlFilters.genre || 'All Genres'
  );
  const [selectedPlatform, setSelectedPlatform] = useState<string>(
    () => initialUrlFilters.platform || 'All Platforms'
  );
  const [selectedType, setSelectedType] = useState<string>(
    () => initialUrlFilters.type || 'All Types'
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    () => initialUrlFilters.status || 'All Status'
  );
  const [selectedSort, setSelectedSort] = useState<string>(
    () => initialUrlFilters.sort || 'popularity'
  );
  const [episodeLength, setEpisodeLength] = useState<EpisodeLengthBucket>('any');
  const [minRating, setMinRating] = useState<number>(0);
  const [fullyDubbedOnly, setFullyDubbedOnly] = useState<boolean>(false);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [freeLegalOnly, setFreeLegalOnly] = useState<boolean>(false);
  const [isSmartFilterOpen, setIsSmartFilterOpen] = useState<boolean>(false);
  const [isOttHubOpen, setIsOttHubOpen] = useState<boolean>(false);
  const [genreSearchQuery, setGenreSearchQuery] = useState<string>('');
  const [isAllGenresExpanded, setIsAllGenresExpanded] = useState<boolean>(false);
  const [isAllPlatformsExpanded, setIsAllPlatformsExpanded] = useState<boolean>(false);

  // Lock background scroll & support Escape dismiss while Filter or OTT bottom sheet is open
  useEffect(() => {
    if (!isSmartFilterOpen && !isOttHubOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSmartFilterOpen(false);
        setIsOttHubOpen(false);
      }
    };
    const previousOverflow = typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [isSmartFilterOpen, isOttHubOpen]);

  const [debouncedSearch, setDebouncedSearch] = useState(effectiveSearch || '');

  const activeSubscriptionPlatforms = useMemo(
    () => (mySubscriptionsEnabled && mySubscriptions.length > 0 ? mySubscriptions : []),
    [mySubscriptionsEnabled, mySubscriptions]
  );

  const normalizedApiSearch = useMemo(
    () => normalizeRegionalSearchQuery(debouncedSearch),
    [debouncedSearch]
  );

  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        q: normalizedApiSearch.trim().toLowerCase(),
        lang: selectedLanguage,
        genre: selectedGenre,
        platform: selectedPlatform,
        type: selectedType,
        status: selectedStatus,
        sort: selectedSort,
        epLen: episodeLength,
        minRating,
        fullyDubbedOnly,
        verifiedOnly,
        freeLegalOnly,
        subs: activeSubscriptionPlatforms,
      }),
    [
      normalizedApiSearch,
      selectedLanguage,
      selectedGenre,
      selectedPlatform,
      selectedType,
      selectedStatus,
      selectedSort,
      episodeLength,
      minRating,
      fullyDubbedOnly,
      verifiedOnly,
      freeLegalOnly,
      activeSubscriptionPlatforms,
    ]
  );

  const hasMatchingCache =
    exploreCatalogMemoryCache !== null &&
    exploreCatalogMemoryCache.filterSignature === filterSignature &&
    exploreCatalogMemoryCache.items.length > 0;

  const [rawAnimeList, setRawAnimeList] = useState<Anime[]>(() =>
    hasMatchingCache && exploreCatalogMemoryCache
      ? exploreCatalogMemoryCache.items
      : deduplicateAnimeById([], (catalogList || []).slice(0, CATALOG_PAGE_SIZE))
  );
  const [loading, setLoading] = useState<boolean>(() => !hasMatchingCache);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState<boolean>(false);
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'success' | 'empty' | 'error' | 'offline'>(() =>
    hasMatchingCache ? 'success' : 'loading'
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [appendError, setAppendError] = useState<string | null>(null);

  // Hybrid Infinite Scroll Cycle Tracking (4 batches of 12 = 48 anime per auto-load cycle)
  const [batchesInCycle, setBatchesInCycle] = useState<number>(() =>
    hasMatchingCache && exploreCatalogMemoryCache ? exploreCatalogMemoryCache.batchesInCycle : 1
  );
  const [isCyclePaused, setIsCyclePaused] = useState<boolean>(() =>
    hasMatchingCache && exploreCatalogMemoryCache ? exploreCatalogMemoryCache.isCyclePaused : false
  );

  const [paginationMeta, setPaginationMeta] = useState<CatalogMeta>(() =>
    hasMatchingCache && exploreCatalogMemoryCache
      ? exploreCatalogMemoryCache.meta
      : {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          limit: CATALOG_PAGE_SIZE,
          hasNextPage: false,
          hasPrevPage: false,
        }
  );
  const [catalogSummary, setCatalogSummary] = useState<CatalogSummary | null>(() =>
    hasMatchingCache && exploreCatalogMemoryCache ? exploreCatalogMemoryCache.summary : null
  );

  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);

  const gridTopRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const restoredFilterSignatureRef = useRef<string | null>(
    hasMatchingCache ? filterSignature : null
  );

  const handleLike = useCallback((animeId: number, liked?: boolean, newCount?: number) => {
    setRawAnimeList(prev => prev.map(a => {
      if (a.id === animeId || String(a.id) === String(animeId)) {
        return { ...a, likesCount: newCount !== undefined ? newCount : (Number(a.likesCount) || 0) + (liked ? 1 : -1) };
      }
      return a;
    }));
    if (onToggleLike) onToggleLike(animeId, Boolean(liked), newCount ?? 0);
  }, [onToggleLike]);

  const handleUpvote = useCallback((animeId: number, upvoted?: boolean, newCount?: number) => {
    setRawAnimeList(prev => prev.map(a => {
      if (a.id === animeId || String(a.id) === String(animeId)) {
        return { ...a, popularity: newCount !== undefined ? newCount : (Number(a.popularity) || 0) + (upvoted ? 1 : -1) };
      }
      return a;
    }));
    if (onToggleUpvote) onToggleUpvote(animeId, Boolean(upvoted), newCount ?? 0);
  }, [onToggleUpvote]);

  // Seed rawAnimeList from parent catalogList only while initial fetch is pending and local list is empty
  useEffect(() => {
    if (catalogList && catalogList.length > 0 && rawAnimeList.length === 0 && catalogStatus === 'loading') {
      setRawAnimeList(deduplicateAnimeById([], catalogList.slice(0, CATALOG_PAGE_SIZE)));
    }
  }, [catalogList, rawAnimeList.length, catalogStatus, CATALOG_PAGE_SIZE]);

  // Recent searches (account-scoped)
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readRecentSearches(userId)
  );

  const setSelectedLanguage = useCallback(
    (nextLang: string) => {
      const persisted = writePreferredLanguage(nextLang, userId);
      setSelectedLanguageState(persisted);
    },
    [userId]
  );

  // Re-hydrate account-scoped preferred language & recent searches on account change/logout
  useEffect(() => {
    const syncScopedPrefs = () => {
      const urlParsed =
        typeof window !== 'undefined'
          ? parseFiltersFromSearchParams(window.location.search)
          : {};
      if (!urlParsed.language) {
        setSelectedLanguageState(readPreferredLanguage(userId));
      }
      setRecentSearches(readRecentSearches(userId));
    };
    window.addEventListener(ACCOUNT_CHANGED_EVENT, syncScopedPrefs);
    return () => window.removeEventListener(ACCOUNT_CHANGED_EVENT, syncScopedPrefs);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = (effectiveSearch || '').trim();
      setDebouncedSearch(effectiveSearch || '');
      if (trimmed.length >= 2) {
        setRecentSearches(addRecentSearch(trimmed, userId));
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [effectiveSearch, userId]);

  // Sync active catalog filters to shareable URL query string
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname;
    if (pathname !== '/' && pathname !== '/explore' && pathname !== '/catalog') return;

    const queryStr = buildShareableFilterQuery({
      search: debouncedSearch,
      language: selectedLanguage,
      platform: selectedPlatform,
      genre: selectedGenre,
      type: selectedType,
      status: selectedStatus,
      sort: selectedSort,
    });

    const nextUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, [
    debouncedSearch,
    selectedLanguage,
    selectedPlatform,
    selectedGenre,
    selectedType,
    selectedStatus,
    selectedSort,
  ]);

  const handleShareFilterUrl = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const shareUrl = window.location.href;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast?.success('Filter Link Copied', 'Shareable catalog URL copied to your clipboard.');
      }
    } catch {
      toast?.info('Share URL', shareUrl);
    }
  }, [toast]);

  // Keep memory cache in sync with loaded pages for instant restoration on back navigation
  useEffect(() => {
    if (catalogStatus === 'success' && rawAnimeList.length > 0) {
      exploreCatalogMemoryCache = {
        filterSignature,
        items: rawAnimeList,
        meta: paginationMeta,
        summary: catalogSummary,
        batchesInCycle,
        isCyclePaused,
        scrollY:
          typeof window !== 'undefined'
            ? window.scrollY || exploreCatalogMemoryCache?.scrollY || 0
            : 0,
      };
    }
  }, [
    filterSignature,
    rawAnimeList,
    paginationMeta,
    catalogSummary,
    batchesInCycle,
    isCyclePaused,
    catalogStatus,
  ]);

  // Restore saved scroll position when returning to Explore with cached pages
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let savedY = exploreCatalogMemoryCache?.scrollY || 0;
    try {
      const storedRaw = window.sessionStorage.getItem(EXPLORE_SCROLL_STORAGE_KEY);
      if (storedRaw) {
        const parsed = JSON.parse(storedRaw);
        if (parsed && parsed.filterSignature === filterSignature && Number(parsed.scrollY) > 0) {
          savedY = Number(parsed.scrollY);
        }
      }
    } catch {
      // ignore storage errors
    }

    if (savedY > 0 && rawAnimeList.length > 0) {
      const rafId = window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: 'auto' });
      });
      return () => window.cancelAnimationFrame(rafId);
    }
  }, []);

  // Track window scroll for Back-to-Top floating button & scroll restoration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      setShowBackToTop(currentY > 480);
      if (exploreCatalogMemoryCache && exploreCatalogMemoryCache.filterSignature === filterSignature) {
        exploreCatalogMemoryCache.scrollY = currentY;
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filterSignature]);

  const handleSelectAnimeWithScrollSave = useCallback(
    (anime: Anime) => {
      if (typeof window !== 'undefined') {
        const currentY = window.scrollY || document.documentElement.scrollTop || 0;
        if (exploreCatalogMemoryCache) {
          exploreCatalogMemoryCache.scrollY = currentY;
        }
        try {
          window.sessionStorage.setItem(
            EXPLORE_SCROLL_STORAGE_KEY,
            JSON.stringify({ filterSignature, scrollY: currentY })
          );
        } catch {
          // ignore storage quota errors
        }
      }
      onSelectAnime(anime);
    },
    [filterSignature, onSelectAnime]
  );

  const handleScrollToTop = useCallback(() => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, []);

  const normalizeBatchItems = useCallback(
    (data: any[]): Anime[] => {
      const approvedOnly = data.filter(
        (item: any) => item.status !== 'pending' && item.submissionStatus !== 'pending'
      );
      const normalized = approvedOnly.map((item: any) => ({
        ...item,
        cover_image: proxyUrl(item.cover_image || item.cover_url),
        banner_image: proxyUrl(item.banner_image || item.cover_image || item.cover_url),
        languages: item.languages || '',
        platform: item.platform || '',
        type: item.type || 'TV Series',
      }));
      return verifiedOnly
        ? normalized.filter((item: any) => {
            const p = String(item.platform || '').trim();
            return Boolean(p && p.toLowerCase() !== 'not verified' && p.toLowerCase() !== 'none');
          })
        : normalized;
    },
    [verifiedOnly]
  );

  const fetchCatalogBatch = useCallback(
    async (pageToFetch: number, mode: 'reset' | 'auto' | 'manual') => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      isFetchingRef.current = true;

      const isInitialReset = pageToFetch === 1 || mode === 'reset';

      if (isInitialReset) {
        setLoading(true);
        setIsFetchingNextPage(false);
        setCatalogStatus('loading');
        setCatalogError(null);
        setAppendError(null);
      } else {
        setIsFetchingNextPage(true);
        setAppendError(null);
      }

      try {
        const response = await cloudflareApi.fetchCatalog({
          page: pageToFetch,
          limit: CATALOG_PAGE_SIZE,
          search: normalizedApiSearch,
          language: selectedLanguage,
          genre: selectedGenre,
          platform: selectedPlatform,
          type: selectedType,
          status: selectedStatus,
          sort: selectedSort,
          episodeLength,
          minRating,
          fullyDubbed: fullyDubbedOnly,
          freeLegal: freeLegalOnly,
          platforms: activeSubscriptionPlatforms,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!response.ok) {
          const nextStatus = response.status === 'offline' ? 'offline' : 'error';
          const errMsg =
            response.error ||
            (nextStatus === 'offline'
              ? 'You appear to be offline. Reconnect and tap Retry.'
              : 'Unable to load the next batch of anime right now. Please try again.');

          if (isInitialReset) {
            setCatalogStatus(nextStatus);
            setCatalogError(errMsg);
            setRawAnimeList([]);
          } else {
            // Keep already-loaded anime intact and show compact retry strip
            setAppendError(errMsg);
          }
          return;
        }

        const data = response.data || [];
        const meta = response.meta;

        if (response.summary) {
          setCatalogSummary(response.summary);
        }

        const filteredNormalized = normalizeBatchItems(data);
        const resolvedMeta: CatalogMeta = meta || {
          currentPage: pageToFetch,
          totalPages: filteredNormalized.length >= CATALOG_PAGE_SIZE ? pageToFetch + 1 : pageToFetch,
          totalItems: filteredNormalized.length,
          limit: CATALOG_PAGE_SIZE,
          hasNextPage: filteredNormalized.length >= CATALOG_PAGE_SIZE,
          hasPrevPage: pageToFetch > 1,
        };

        setPaginationMeta(resolvedMeta);

        if (isInitialReset) {
          const dedupedInitial = deduplicateAnimeById([], filteredNormalized);
          setRawAnimeList(dedupedInitial);
          setCatalogStatus(dedupedInitial.length === 0 ? 'empty' : 'success');
          setBatchesInCycle(1);
          setIsCyclePaused(false);
        } else {
          setRawAnimeList((prev) => {
            const merged = deduplicateAnimeById(prev, filteredNormalized);
            const nextBatches = mode === 'manual' ? 1 : batchesInCycle + 1;
            const shouldPause = shouldPauseAutoLoadCycle(
              nextBatches,
              merged.length,
              Boolean(resolvedMeta.hasNextPage)
            );
            setBatchesInCycle(nextBatches);
            setIsCyclePaused(shouldPause);
            return merged;
          });
          setCatalogStatus('success');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          return;
        }
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const errMsg = offline
          ? 'You appear to be offline. Reconnect and try again.'
          : err?.message || 'Unable to connect to the catalog API. Please retry.';

        if (isInitialReset) {
          setCatalogStatus(offline ? 'offline' : 'error');
          setCatalogError(errMsg);
          setRawAnimeList([]);
        } else {
          setAppendError(errMsg);
        }
      } finally {
        if (!controller.signal.aborted) {
          isFetchingRef.current = false;
          setLoading(false);
          setIsFetchingNextPage(false);
        }
      }
    },
    [
      CATALOG_PAGE_SIZE,
      normalizedApiSearch,
      selectedLanguage,
      selectedGenre,
      selectedPlatform,
      selectedType,
      selectedStatus,
      selectedSort,
      episodeLength,
      minRating,
      fullyDubbedOnly,
      freeLegalOnly,
      activeSubscriptionPlatforms,
      normalizeBatchItems,
      batchesInCycle,
    ]
  );

  // Reset list to page 1 and reset the 48-item cycle whenever filters or search change
  useEffect(() => {
    if (restoredFilterSignatureRef.current === filterSignature && rawAnimeList.length > 0) {
      // Skip initial re-fetch because we restored exact cached pages for this filterSignature
      restoredFilterSignatureRef.current = null;
      return;
    }
    restoredFilterSignatureRef.current = null;
    setBatchesInCycle(0);
    setIsCyclePaused(false);
    setAppendError(null);
    fetchCatalogBatch(1, 'reset');

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [filterSignature]);

  const handleLoadMoreManual = useCallback(() => {
    if (loading || isFetchingNextPage || isFetchingRef.current || !paginationMeta.hasNextPage) {
      return;
    }
    setIsCyclePaused(false);
    fetchCatalogBatch(paginationMeta.currentPage + 1, 'manual');
  }, [loading, isFetchingNextPage, paginationMeta.hasNextPage, paginationMeta.currentPage, fetchCatalogBatch]);

  const handleRetryNextBatch = useCallback(() => {
    if (loading || isFetchingNextPage || isFetchingRef.current) return;
    const nextPage = paginationMeta.currentPage + 1;
    fetchCatalogBatch(nextPage, isCyclePaused ? 'manual' : 'auto');
  }, [loading, isFetchingNextPage, paginationMeta.currentPage, isCyclePaused, fetchCatalogBatch]);

  // IntersectionObserver with rootMargin: "500px" (400-600px prefetch distance)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    if (
      loading ||
      isFetchingNextPage ||
      catalogStatus !== 'success' ||
      !paginationMeta.hasNextPage ||
      isCyclePaused ||
      Boolean(appendError)
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (
          firstEntry &&
          firstEntry.isIntersecting &&
          !isFetchingRef.current &&
          !loading &&
          !isFetchingNextPage &&
          paginationMeta.hasNextPage &&
          !isCyclePaused &&
          !appendError
        ) {
          fetchCatalogBatch(paginationMeta.currentPage + 1, 'auto');
        }
      },
      {
        root: null,
        rootMargin: '500px',
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    loading,
    isFetchingNextPage,
    catalogStatus,
    paginationMeta.hasNextPage,
    paginationMeta.currentPage,
    isCyclePaused,
    appendError,
    fetchCatalogBatch,
  ]);

  const activeFilterChips = useMemo(
    () =>
      buildActiveFilterChips({
        search: effectiveSearch,
        language: selectedLanguage,
        genre: selectedGenre,
        platform: selectedPlatform,
        type: selectedType,
        status: selectedStatus,
        episodeLength,
        minRating,
        fullyDubbedOnly,
        verifiedOnly,
        freeLegalOnly,
        mySubscriptionsEnabled,
        mySubscriptions,
      }),
    [
      effectiveSearch,
      selectedLanguage,
      selectedGenre,
      selectedPlatform,
      selectedType,
      selectedStatus,
      episodeLength,
      minRating,
      fullyDubbedOnly,
      verifiedOnly,
      freeLegalOnly,
      mySubscriptionsEnabled,
      mySubscriptions,
    ]
  );

  const handleClearAllFilters = useCallback(() => {
    setSelectedLanguage('All');
    setSelectedGenre('All Genres');
    setSelectedPlatform('All Platforms');
    setSelectedType('All Types');
    setSelectedStatus('All Status');
    setSelectedSort('popularity');
    setEpisodeLength('any');
    setMinRating(0);
    setFullyDubbedOnly(false);
    setVerifiedOnly(false);
    setFreeLegalOnly(false);
    setGenreSearchQuery('');
    handleSearchChange('');
    onToggleMySubscriptionsEnabled?.(false);
    setBatchesInCycle(0);
    setIsCyclePaused(false);
    setAppendError(null);
  }, [onToggleMySubscriptionsEnabled, setSelectedLanguage, handleSearchChange]);

  const handleRemoveChip = useCallback(
    (chip: ActiveFilterChip) => {
      switch (chip.category) {
        case 'search':
          handleSearchChange('');
          break;
        case 'language':
          setSelectedLanguage('All');
          break;
        case 'genre':
          setSelectedGenre('All Genres');
          break;
        case 'platform':
          setSelectedPlatform('All Platforms');
          break;
        case 'type':
          setSelectedType('All Types');
          break;
        case 'status':
          setSelectedStatus('All Status');
          break;
        case 'episodeLength':
          setEpisodeLength('any');
          break;
        case 'minRating':
          setMinRating(0);
          break;
        case 'fullyDubbedOnly':
          setFullyDubbedOnly(false);
          break;
        case 'verifiedOnly':
          setVerifiedOnly(false);
          break;
        case 'freeLegalOnly':
          setFreeLegalOnly(false);
          break;
        case 'mySubscriptions':
          onToggleMySubscriptionsEnabled?.(false);
          break;
      }
    },
    [onToggleMySubscriptionsEnabled, setSelectedLanguage, handleSearchChange]
  );

  const displayedAnime = rawAnimeList;

  // Compute dynamic regional dub language filter buttons from backend summary or loaded list
  const dynamicLanguageFilters = useMemo(() => {
    if (catalogSummary?.languageFilters && catalogSummary.languageFilters.length > 0) {
      return catalogSummary.languageFilters;
    }
    return computeDynamicLanguageFilters(catalogList && catalogList.length > 0 ? catalogList : rawAnimeList);
  }, [catalogSummary, catalogList, rawAnimeList]);

  // Single-row ordered language rail: All, Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali (+ any additional backend languages)
  const languageRailPills = useMemo(() => {
    const coreOrder = ['all', 'tamil', 'hindi', 'telugu', 'malayalam', 'kannada', 'bengali'];
    const byKey = new Map(
      dynamicLanguageFilters.map((item) => [item.value.toLowerCase(), item])
    );

    const coreDefaults: Record<string, { label: string; value: string; count: number }> = {
      all: { label: 'All', value: 'All', count: 0 },
      tamil: { label: 'Tamil', value: 'Tamil', count: 0 },
      hindi: { label: 'Hindi', value: 'Hindi', count: 0 },
      telugu: { label: 'Telugu', value: 'Telugu', count: 0 },
      malayalam: { label: 'Malayalam', value: 'Malayalam', count: 0 },
      kannada: { label: 'Kannada', value: 'Kannada', count: 0 },
      bengali: { label: 'Bengali', value: 'Bengali', count: 0 },
    };

    const orderedCore = coreOrder.map((key) => byKey.get(key) || coreDefaults[key]);
    const remaining = dynamicLanguageFilters.filter(
      (item) => !coreOrder.includes(item.value.toLowerCase())
    );

    return [...orderedCore, ...remaining];
  }, [dynamicLanguageFilters]);

  const statsSourceList = useMemo(() => {
    return (catalogList && catalogList.length > 0) ? catalogList : rawAnimeList;
  }, [catalogList, rawAnimeList]);

  const ottCatalogIndex = useMemo(() => {
    return fullCatalogIndex && fullCatalogIndex.length > 0 ? fullCatalogIndex : statsSourceList;
  }, [fullCatalogIndex, statsSourceList]);

  const ottSummaryCoverage = useMemo(() => {
    const coverageLang = selectedLanguage && selectedLanguage !== 'All' ? selectedLanguage : 'All';
    return calculateSubscriptionCoverage(ottCatalogIndex, mySubscriptions, coverageLang);
  }, [ottCatalogIndex, mySubscriptions, selectedLanguage]);

  const filteredGenreOptions = useMemo(() => {
    const q = genreSearchQuery.trim().toLowerCase();
    if (!q) return GENRES;
    return GENRES.filter((g) => g === 'All Genres' || g.toLowerCase().includes(q));
  }, [genreSearchQuery]);

  const visiblePlatformOptions = useMemo(() => {
    const secondary = PLATFORMS.filter((p) => !FEATURED_PLATFORMS.includes(p));
    const hasSecondarySelected = secondary.includes(selectedPlatform);
    if (isAllPlatformsExpanded || hasSecondarySelected) {
      return [...FEATURED_PLATFORMS, ...secondary];
    }
    return FEATURED_PLATFORMS;
  }, [isAllPlatformsExpanded, selectedPlatform]);

  const totalCatalogCount = Math.max(paginationMeta.totalItems, displayedAnime.length);

  const activeAdvancedFilterCount = useMemo(() => {
    return [
      selectedGenre !== 'All Genres',
      selectedPlatform !== 'All Platforms',
      selectedType !== 'All Types',
      selectedStatus !== 'All Status',
      selectedSort !== 'popularity',
      episodeLength !== 'any',
      minRating > 0,
      fullyDubbedOnly,
      verifiedOnly,
      freeLegalOnly,
    ].filter(Boolean).length;
  }, [
    selectedGenre,
    selectedPlatform,
    selectedType,
    selectedStatus,
    selectedSort,
    episodeLength,
    minRating,
    fullyDubbedOnly,
    verifiedOnly,
    freeLegalOnly,
  ]);

  const totalResettableFilterCount = useMemo(() => {
    return activeAdvancedFilterCount + (selectedLanguage !== 'All' ? 1 : 0);
  }, [activeAdvancedFilterCount, selectedLanguage]);

  return (
    <div
      aria-label="Indian Dubbed Anime Discovery Catalog"
      className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 overflow-x-clip font-sans text-[var(--text-primary)] pb-8 box-border"
    >
      {/* 1. COMPACT, DISCOVERY-FIRST TOP SECTION (Visible above the fold on 390x844) */}
      <div className="pt-2 sm:pt-4 space-y-2">
        {/* Heading + Discovery Tools Row */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight flex items-center gap-1.5 sm:gap-2 min-w-0">
            <ExploreIcon active className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--accent-primary)] shrink-0" />
            <span className="line-clamp-2 leading-snug">{t('explore:heading', 'Find anime in your language')}</span>
          </h1>

          {/* Mobile Primary Action: Single Random button (44px height) so heading never truncates on 390px */}
          <div className="flex sm:hidden items-center shrink-0">
            <button
              type="button"
              onClick={onOpenRoulette}
              aria-label={t('explore:randomAnime', 'Random Anime')}
              className="h-[44px] min-h-[44px] max-w-[140px] px-3.5 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] text-xs font-bold inline-flex items-center gap-1.5 transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
            >
              <Dices className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('explore:random', 'Random')}</span>
            </button>
          </div>

          {/* Desktop Discovery Tools Group */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {onOpenCompare && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenCompare}
                aria-label="Compare Anime"
                leftIcon={<Scale className="w-3.5 h-3.5 text-[var(--accent-hover)]" />}
              >
                <span>{t('explore:compare', 'Compare')}</span>
              </Button>
            )}
            {onOpenRecommendations && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenRecommendations}
                aria-label="Find Your Next Anime"
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-[var(--accent-hover)]" />}
              >
                <span>{t('explore:matchmaker', 'Matchmaker')}</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenRoulette}
              leftIcon={<Dices className="w-3.5 h-3.5" />}
            >
              <span>{t('explore:randomAnime', 'Random Anime')}</span>
            </Button>
          </div>
        </div>

        {/* 2. PROMINENT SEARCH BAR (44px height, 12px radius, 44x44px clear button when typing) */}
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[var(--accent-primary)] absolute left-3.5 pointer-events-none shrink-0" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('explore:searchPlaceholder', 'Search English or Japanese title, alias (e.g. JJK), studio...')}
              className="w-full h-[44px] min-h-[44px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] rounded-[12px] pl-10 pr-12 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-180 motion-reduce:transition-none"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label={t('common:clear', 'Clear search query')}
                className="absolute right-0.5 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[12px] hover:bg-[var(--bg-elevated)] transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {recentSearches.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs py-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
                <Clock className="w-3 h-3 text-[var(--accent-primary)]" />
                Recent:
              </span>
              {recentSearches.slice(0, 5).map((term) => (
                <div
                  key={`recent_explore_${term}`}
                  className="inline-flex items-center min-h-[40px] rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] shrink-0 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => handleSearchChange(term)}
                    className="min-h-[40px] px-3 py-1 hover:bg-[var(--bg-elevated)] text-xs font-medium transition-colors duration-180 cursor-pointer"
                  >
                    {term}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove recent search ${term}`}
                    onClick={() => setRecentSearches(removeRecentSearch(term, userId))}
                    className="w-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-[var(--text-secondary)] hover:text-[#F87171] hover:bg-[var(--bg-elevated)] transition-colors duration-180 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRecentSearches(clearRecentSearches(userId))}
                className="min-h-[40px] px-2.5 rounded-[12px] text-xs text-[var(--text-secondary)] hover:text-[#F87171] font-semibold ml-0.5 shrink-0 cursor-pointer"
              >
                {t('common:clear', 'Clear')}
              </button>
            </div>
          )}
        </div>

        {/* 2b. SLEEK SINGLE-ROW HORIZONTAL LANGUAGE PILL RAIL + PINNED FILTERS BUTTON */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <div
              data-testid="explore-language-rail"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pr-8 py-0.5"
            >
              {languageRailPills.map((langItem) => {
                const active =
                  selectedLanguage.toLowerCase() === langItem.value.toLowerCase() ||
                  (selectedLanguage === 'All' && langItem.value === 'All');
                const nativeScript = NATIVE_LANGUAGE_SCRIPT[langItem.value.toLowerCase()];
                const pillLabel =
                  langItem.value === 'All'
                    ? t('common:all', 'All')
                    : t(`common:languages.${langItem.value.toLowerCase()}`, langItem.label);
                return (
                  <button
                    key={langItem.value}
                    type="button"
                    onClick={() => setSelectedLanguage(langItem.value)}
                    aria-pressed={active}
                    className={`h-[40px] min-h-[40px] min-w-[56px] px-4 rounded-full text-xs font-semibold shrink-0 inline-flex items-center justify-center gap-1.5 border transition-all duration-180 motion-reduce:transition-none cursor-pointer ${
                      active
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-hover)] font-bold'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{pillLabel}</span>
                    {nativeScript && nativeScript !== pillLabel && (
                      <span
                        className={`hidden sm:inline text-[11px] font-medium ${
                          active ? 'text-[var(--accent-on-primary)]/85' : 'text-[var(--accent-hover)]'
                        }`}
                      >
                        {nativeScript}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Subtle right-edge fade cue */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-canvas)] via-[var(--bg-canvas)]/80 to-transparent"
            />
          </div>

          {/* Pinned 44px Elevated Filters Button (never pushed down or clipped on 360px/390px) */}
          <button
            type="button"
            onClick={() => setIsSmartFilterOpen((prev) => !prev)}
            aria-expanded={isSmartFilterOpen}
            aria-label="Toggle Smart Filters"
            className={`h-[44px] min-h-[44px] max-w-[140px] px-3.5 rounded-full text-xs font-semibold border transition-all duration-180 motion-reduce:transition-none cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
              isSmartFilterOpen || activeAdvancedFilterCount > 0
                ? 'bg-[var(--bg-elevated)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="truncate">{t('explore:filters', 'Filters')}</span>
            {activeAdvancedFilterCount > 0 && (
              <span
                data-testid="active-filter-count-badge"
                className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-on-primary)] text-[10px] font-extrabold tabular-nums inline-flex items-center justify-center shrink-0"
              >
                {activeAdvancedFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* 4. COMPACT SINGLE-LINE 44px OTT SUBSCRIPTIONS TRIGGER STRIP (Opens Dedicated Bottom Sheet) */}
        <button
          type="button"
          onClick={() => setIsOttHubOpen(true)}
          aria-expanded={isOttHubOpen}
          aria-label="Toggle OTT Coverage Hub"
          data-testid="ott-coverage-trigger"
          className="w-full h-[44px] min-h-[44px] px-3.5 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-elevated)] flex items-center justify-between gap-2 text-xs text-left transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Tv className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="font-semibold text-[var(--text-primary)] truncate">
              {t('explore:mySubscriptionsHeader', 'My Subscriptions & OTT Coverage')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {mySubscriptionsEnabled && mySubscriptions.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#34D399] tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                <span className="sm:hidden">
                  {mySubscriptions.length} {mySubscriptions.length === 1 ? 'OTT' : 'OTTs'} ·{' '}
                  {ottSummaryCoverage.percentage}%
                </span>
                <span className="hidden sm:inline">
                  {mySubscriptions.length} {mySubscriptions.length === 1 ? 'OTT' : 'OTTs'} active ·{' '}
                  {ottSummaryCoverage.percentage}% coverage
                </span>
              </span>
            ) : mySubscriptions.length > 0 ? (
              <span className="text-[11px] font-medium text-[var(--text-secondary)] tabular-nums">
                My OTTs: Off · {mySubscriptions.length} saved
              </span>
            ) : (
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                {t('explore:myOttsOff', 'My OTTs: Off')}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          </div>
        </button>

        {/* 3. FLAGSHIP "FILTER & SORT ANIME" BOTTOM SHEET (Eclipse Dark, Zero Native select dropdown) */}
        {isSmartFilterOpen && (
          <div className="fixed inset-0 z-[75] flex items-end sm:items-center sm:justify-center sm:p-4">
            {/* Dimmed Backdrop */}
            <div
              onClick={() => setIsSmartFilterOpen(false)}
              className="fixed inset-0 bg-[var(--bg-canvas)]/80 backdrop-blur-xs transition-opacity duration-180 motion-reduce:transition-none"
              aria-hidden="true"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Filter & Sort Anime"
              data-testid="smart-filter-drawer"
              className="relative z-10 w-full sm:max-w-2xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border-t sm:border border-[var(--border-subtle)] shadow-2xl overflow-hidden transition-transform duration-180 motion-reduce:transition-none"
            >
              {/* Mobile Drag Handle Pill */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-[var(--bg-surface)] shrink-0">
                <div className="w-10 h-1 rounded-full bg-[var(--border-subtle)]" />
              </div>

              {/* Sticky Top Header */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <div className="flex items-center gap-2 min-w-0">
                  <SlidersHorizontal className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight truncate">
                    {t('explore:filterSheet.title', 'Filter & Sort Anime')}
                  </h2>
                  {totalResettableFilterCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/35 text-[var(--accent-hover)] text-[11px] font-bold tabular-nums shrink-0">
                      {totalResettableFilterCount}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsSmartFilterOpen(false)}
                  aria-label="Close filters"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Filter Body (Comfortable pb-10 clearance above pinned footer) */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-4 pb-10 space-y-6">
                {/* 1. QUICK SORT (1-Tap Segmented Chip Grid — NO select dropdown) */}
                <section className="space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t('explore:filterSheet.quickSort', 'Quick Sort')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SORTS.map((sortOpt) => {
                      const active = selectedSort === sortOpt.value;
                      const sortKeyMap: Record<string, string> = {
                        popularity: 'explore:filterSheet.sort.popular',
                        rating: 'explore:filterSheet.sort.rating',
                        newest: 'explore:filterSheet.sort.year',
                        title: 'explore:filterSheet.sort.title',
                      };
                      return (
                        <button
                          key={`sort_chip_${sortOpt.value}`}
                          type="button"
                          onClick={() => setSelectedSort(sortOpt.value)}
                          aria-pressed={active}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-180 motion-reduce:transition-none cursor-pointer inline-flex items-center justify-center text-center ${
                            active
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-hover)] font-bold'
                              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                          }`}
                        >
                          {t(sortKeyMap[sortOpt.value] || sortOpt.label, sortOpt.label)}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 2. DUB LANGUAGES (Balanced Grid Pills) */}
                <section className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t('explore:filterSheet.dubLanguages', 'Dub Languages')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {languageRailPills.map((langItem) => {
                      const active =
                        selectedLanguage.toLowerCase() === langItem.value.toLowerCase() ||
                        (selectedLanguage === 'All' && langItem.value === 'All');
                      const sheetLangLabel =
                        langItem.value === 'All'
                          ? t('common:all', 'All')
                          : t(`common:languages.${langItem.value.toLowerCase()}`, langItem.label);
                      return (
                        <button
                          key={`sheet_lang_${langItem.value}`}
                          type="button"
                          onClick={() => setSelectedLanguage(langItem.value)}
                          aria-pressed={active}
                          className={`min-h-[42px] min-w-[74px] px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-180 motion-reduce:transition-none cursor-pointer inline-flex items-center justify-center ${
                            active
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-hover)] font-bold'
                              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                          }`}
                        >
                          {sheetLangLabel}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 3. STREAMING PLATFORM (Interactive Brand Chips — NO select dropdown) */}
                <section className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {t('explore:filterSheet.ottPlatforms', 'OTT Platforms')}
                    </span>
                    {PLATFORMS.length > FEATURED_PLATFORMS.length && (
                      <button
                        type="button"
                        onClick={() => setIsAllPlatformsExpanded((prev) => !prev)}
                        className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          {isAllPlatformsExpanded
                            ? 'Show fewer'
                            : `All platforms (${PLATFORMS.length - 1})`}
                        </span>
                        {isAllPlatformsExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {visiblePlatformOptions.map((platformOpt) => {
                      const active = selectedPlatform === platformOpt;
                      const displayLabel = platformOpt === 'All Platforms' ? 'All' : platformOpt;
                      return (
                        <button
                          key={`platform_chip_${platformOpt}`}
                          type="button"
                          onClick={() => setSelectedPlatform(platformOpt)}
                          aria-pressed={active}
                          className={`min-h-[40px] min-w-[60px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-180 motion-reduce:transition-none cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                            active
                              ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--text-primary)] font-bold'
                              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />}
                          <span>{displayLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 4. TYPE & RELEASE STATUS (Compact 2-Row Segmented Pills — NO select dropdown) */}
                <section className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {t('explore:filterSheet.type', 'Type')}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {TYPES.map((typeOpt) => {
                        const active = selectedType === typeOpt;
                        const label = typeOpt === 'All Types' ? t('common:all', 'All') : typeOpt;
                        return (
                          <button
                            key={`type_pill_${typeOpt}`}
                            type="button"
                            onClick={() => setSelectedType(typeOpt)}
                            aria-pressed={active}
                            className={`min-h-[40px] min-w-[60px] px-3.5 py-1.5 rounded-full text-xs font-semibold border shrink-0 transition-all duration-180 motion-reduce:transition-none cursor-pointer ${
                              active
                                ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-hover)] font-bold'
                                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {t('explore:filterSheet.releaseStatus', 'Release Status')}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {STATUSES.map((statusOpt) => {
                        const active = selectedStatus === statusOpt;
                        const statusKeyMap: Record<string, string> = {
                          Airing: 'explore:filterSheet.statuses.airing',
                          Completed: 'explore:filterSheet.statuses.completed',
                          Upcoming: 'explore:filterSheet.statuses.upcoming',
                        };
                        const label =
                          statusOpt === 'All Status'
                            ? t('common:all', 'All')
                            : t(statusKeyMap[statusOpt] || statusOpt, statusOpt);
                        return (
                          <button
                            key={`status_pill_${statusOpt}`}
                            type="button"
                            onClick={() => setSelectedStatus(statusOpt)}
                            aria-pressed={active}
                            className={`min-h-[40px] min-w-[60px] px-3.5 py-1.5 rounded-full text-xs font-semibold border shrink-0 transition-all duration-180 motion-reduce:transition-none cursor-pointer ${
                              active
                                ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-hover)] font-bold'
                                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* 5. GENRE (Interactive Chip Selector + Inline Quick Filter — NO select dropdown) */}
                <section className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {t('explore:filterSheet.genre', 'Genre')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAllGenresExpanded((prev) => !prev)}
                      className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isAllGenresExpanded ? 'Compact row' : 'Expand all'}</span>
                      {isAllGenresExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Optional Inline Genre Search */}
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={genreSearchQuery}
                      onChange={(e) => setGenreSearchQuery(e.target.value)}
                      placeholder="Filter genres (e.g. Action, Isekai, Romance)..."
                      aria-label="Filter genres"
                      className="w-full h-[40px] min-h-[40px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-xl pl-9 pr-10 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-180"
                    />
                    {genreSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setGenreSearchQuery('')}
                        aria-label="Clear genre filter"
                        className="absolute right-0.5 w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div
                    className={
                      isAllGenresExpanded || genreSearchQuery.trim().length > 0
                        ? 'flex flex-wrap gap-1.5'
                        : 'flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5'
                    }
                  >
                    {filteredGenreOptions.map((genreOpt) => {
                      const active = selectedGenre === genreOpt;
                      const label = genreOpt === 'All Genres' ? 'All' : genreOpt;
                      return (
                        <button
                          key={`genre_chip_${genreOpt}`}
                          type="button"
                          onClick={() => setSelectedGenre(genreOpt)}
                          aria-pressed={active}
                          className={`min-h-[38px] min-w-[56px] px-3.5 py-1.5 rounded-full text-xs font-semibold border shrink-0 transition-all duration-180 motion-reduce:transition-none cursor-pointer ${
                            active
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-hover)] font-bold'
                              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {filteredGenreOptions.length === 1 && genreSearchQuery.trim() && (
                      <span className="text-xs text-[var(--text-secondary)] py-2 px-1">
                        No matching genres for &ldquo;{genreSearchQuery.trim()}&rdquo;
                      </span>
                    )}
                  </div>
                </section>

                {/* 6. DUB AVAILABILITY & VERIFICATION (Grouped Eclipse Card with iOS-Style Switches) */}
                <section className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t('explore:filterSheet.dubAvailability', 'Dub Availability')}
                  </div>
                  <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                    {[
                      {
                        key: 'verifiedOnly',
                        label: t('explore:filterSheet.verifiedOnly', 'Verified availability only'),
                        description: 'Confirmed Indian regional audio & streaming metadata',
                        checked: verifiedOnly,
                        toggle: () => setVerifiedOnly((prev) => !prev),
                      },
                      {
                        key: 'fullyDubbedOnly',
                        label: t('explore:filterSheet.fullyDubbedOnly', 'Fully dubbed seasons only'),
                        description: 'Exclude incomplete or partial-episode dub runs',
                        checked: fullyDubbedOnly,
                        toggle: () => setFullyDubbedOnly((prev) => !prev),
                      },
                      {
                        key: 'freeLegalOnly',
                        label: 'Free legal streaming only',
                        description: 'Muse India, Ani-One & official YouTube channels',
                        checked: freeLegalOnly,
                        toggle: () => setFreeLegalOnly((prev) => !prev),
                      },
                    ].map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        role="switch"
                        aria-checked={row.checked}
                        onClick={row.toggle}
                        className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-surface)]/35 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {row.label}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {row.description}
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-180 motion-reduce:transition-none ${
                            row.checked
                              ? 'bg-[var(--accent-primary)] border-[var(--accent-hover)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-180 motion-reduce:transition-none ${
                              row.checked
                                ? 'translate-x-5 bg-[var(--accent-on-primary)]'
                                : 'translate-x-1 bg-[var(--text-secondary)]'
                            }`}
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* 7. EPISODE LENGTH & MINIMUM CATALOG SCORE */}
                <section className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      Episode Length
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {EPISODE_LENGTH_OPTIONS.map((opt) => {
                        const active = episodeLength === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setEpisodeLength(opt.id)}
                            aria-pressed={active}
                            className={`min-h-[40px] px-3.5 py-2 rounded-full text-xs font-semibold border transition-all duration-180 motion-reduce:transition-none cursor-pointer ${
                              active
                                ? 'bg-[var(--accent-primary)] border-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold'
                                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="smart-filter-min-rating"
                        className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
                      >
                        <Star className="w-4 h-4 text-[#F9C876] fill-[#F9C876]" />
                        <span>Minimum Catalog Score</span>
                      </label>
                      <span className="text-xs font-bold text-[#F9C876] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-0.5 rounded-full tabular-nums">
                        {minRating > 0 ? `${minRating.toFixed(1)} / 10` : 'Any Score'}
                      </span>
                    </div>
                    <input
                      id="smart-filter-min-rating"
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={minRating}
                      onChange={(e) => setMinRating(parseFloat(e.target.value))}
                      className="w-full accent-[var(--accent-primary)] cursor-pointer h-2 bg-[var(--bg-surface)] rounded-lg"
                    />
                  </div>
                </section>
              </div>

              {/* Sticky Bottom Action Bar: Ghost Reset + Prominent #B49AF8 Show results (N) */}
              <div
                className="shrink-0 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-4 sm:px-5 py-3 flex items-center gap-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
              >
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="min-h-[46px] px-4 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border border-transparent hover:border-[var(--border-subtle)] transition-colors duration-180 motion-reduce:transition-none cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>{t('explore:filterSheet.resetFilters', 'Reset')}</span>
                  {totalResettableFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--accent-hover)] tabular-nums">
                      {totalResettableFilterCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Apply Filters"
                  onClick={() => setIsSmartFilterOpen(false)}
                  className="min-h-[46px] flex-1 px-5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] text-sm font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer inline-flex items-center justify-center tabular-nums"
                >
                  {t('explore:filterSheet.showResultsCount', {
                    count: formatLocaleNumber(totalCatalogCount, uiLocale),
                    defaultValue: `Show results (${totalCatalogCount})`,
                  })}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4b. DEDICATED "MY SUBSCRIPTIONS & OTT COVERAGE" BOTTOM SHEET */}
        {isOttHubOpen && (
          <div className="fixed inset-0 z-[75] flex items-end sm:items-center sm:justify-center sm:p-4">
            {/* Dimmed Backdrop */}
            <div
              onClick={() => setIsOttHubOpen(false)}
              className="fixed inset-0 bg-[var(--bg-canvas)]/80 backdrop-blur-xs transition-opacity duration-180 motion-reduce:transition-none"
              aria-hidden="true"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="My Subscriptions & OTT Coverage"
              data-testid="ott-subscriptions-sheet"
              className="relative z-10 w-full sm:max-w-2xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border-t sm:border border-[var(--border-subtle)] shadow-2xl overflow-hidden transition-transform duration-180 motion-reduce:transition-none"
            >
              {/* Mobile Drag Handle Pill */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-[var(--bg-surface)] shrink-0">
                <div className="w-10 h-1 rounded-full bg-[var(--border-subtle)]" />
              </div>

              {/* Sticky Top Header */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <div className="flex items-center gap-2 min-w-0">
                  <Tv className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight truncate">
                    {t('explore:ottSheet.title', 'My Subscriptions & OTT Coverage')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOttHubOpen(false)}
                  aria-label="Close OTT subscriptions sheet"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Sheet Body */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-4 pb-8">
                <OttHubSection
                  mode="sheet"
                  catalogIndex={ottCatalogIndex}
                  selectedPlatform={selectedPlatform}
                  activeLanguage={selectedLanguage}
                  onCloseSheet={() => setIsOttHubOpen(false)}
                  onSelectPlatform={(platformName) => {
                    setSelectedPlatform(platformName);
                    if (platformName !== 'All Platforms') {
                      gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  mySubscriptions={mySubscriptions}
                  mySubscriptionsEnabled={mySubscriptionsEnabled}
                  onToggleSubscriptionPlatform={(id) => onToggleSubscriptionPlatform?.(id)}
                  onToggleMySubscriptionsEnabled={(enabled) => onToggleMySubscriptionsEnabled?.(enabled)}
                  onClearSubscriptions={() => onClearSubscriptions?.()}
                  onSelectAnime={(a) => handleSelectAnimeWithScrollSave(a as any)}
                />
              </div>

              {/* Sticky Bottom Action Bar */}
              <div
                className="shrink-0 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-4 sm:px-5 py-3 flex items-center gap-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
              >
                <button
                  type="button"
                  onClick={() => onClearSubscriptions?.()}
                  disabled={mySubscriptions.length === 0}
                  className="min-h-[46px] px-4 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
                >
                  {t('common:clear', 'Clear')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOttHubOpen(false)}
                  className="min-h-[46px] flex-1 px-5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] text-sm font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer inline-flex items-center justify-center"
                >
                  {t('explore:ottSheet.done', 'Done')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selected Active Filters as Removable 40-44px Chips above the Anime Grid */}
        {activeFilterChips.length > 0 && (
          <div
            data-testid="active-filter-chips"
            className="flex flex-wrap items-center gap-1.5 pt-0.5"
          >
            <span className="text-xs font-bold text-[var(--text-secondary)] mr-1">
              {totalCatalogCount} {totalCatalogCount === 1 ? 'match' : 'matches'}:
            </span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleRemoveChip(chip)}
                aria-label={`Remove filter ${chip.label}`}
                className="min-h-[40px] sm:min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--accent-primary)]/40 text-xs font-semibold text-[var(--accent-hover)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors duration-180 cursor-pointer"
              >
                <span>{chip.label}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleShareFilterUrl}
              className="min-h-[40px] sm:min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-180 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Share Link</span>
            </button>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="min-h-[40px] sm:min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#F87171]/15 border border-[#F87171]/35 text-xs font-semibold text-[#F87171] hover:bg-[#F87171]/25 transition-colors duration-180 cursor-pointer"
            >
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* FOR YOU METADATA BANNER */}
      {feedView === 'foryou' && (
        <div className="mt-2.5 mb-1">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-3 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#F9C876] shrink-0" />
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)]">Curated For You • Indian Regional Dubs</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Tailored to your preferred Tamil, Telugu, Hindi &amp; Malayalam anime dubs.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. POSTER-FIRST ANIME CATALOG GRID (Hybrid Infinite Scroll) */}
      <div ref={gridTopRef} className="pt-3 sm:pt-5">
        {/* Compact Grid Status Row */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center space-x-1.5 text-xs min-w-0">
            <span className="text-[var(--text-secondary)] truncate">
              {catalogStatus === 'error' || catalogStatus === 'offline' ? (
                <span className="text-[#F87171] font-semibold">
                  {catalogStatus === 'offline' ? 'Offline — unable to reach catalog' : 'Unable to load catalog'}
                </span>
              ) : displayedAnime.length > 0 ? (
                <span className="tabular-nums font-medium">
                  {t('explore:showingTitlesOf', {
                    shown: formatLocaleNumber(displayedAnime.length, uiLocale),
                    total: formatLocaleNumber(totalCatalogCount, uiLocale),
                    defaultValue: `Showing ${displayedAnime.length} of ${totalCatalogCount} Titles`,
                  })}
                </span>
              ) : loading ? (
                <span>{t('explore:loadingCatalog', 'Loading catalog...')}</span>
              ) : (
                <span className="tabular-nums">
                  {t('explore:showingTitles', {
                    count: formatLocaleNumber(0, uiLocale),
                    defaultValue: 'Showing 0 Titles',
                  })}
                </span>
              )}
            </span>
          </div>
          {catalogStatus !== 'error' && catalogStatus !== 'offline' && (
            <span className="text-xs text-[var(--text-secondary)] tabular-nums shrink-0">
              {t('explore:batchIndicator', {
                current: formatLocaleNumber(paginationMeta.currentPage, uiLocale),
                total: formatLocaleNumber(Math.max(1, paginationMeta.totalPages), uiLocale),
                defaultValue: `Batch ${paginationMeta.currentPage} of ${Math.max(1, paginationMeta.totalPages)}`,
              })}
            </span>
          )}
        </div>

        {loading && displayedAnime.length === 0 ? (
          <div className="space-y-4">
            <SkeletonGrid count={12} />
          </div>
        ) : catalogStatus === 'error' || catalogStatus === 'offline' ? (
          <div
            role="alert"
            data-testid="catalog-error-banner"
            className="p-6 sm:p-8 rounded-[12px] bg-[var(--bg-surface)] border border-[#F87171]/40 text-center space-y-3 max-w-xl mx-auto my-4"
          >
            <div className="w-12 h-12 rounded-[12px] bg-[#F87171]/15 border border-[#F87171]/30 text-[#F87171] flex items-center justify-center mx-auto">
              {catalogStatus === 'offline' ? (
                <WifiOff className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {catalogStatus === 'offline' ? 'You are currently offline' : 'Failed to load anime catalog'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
              {catalogError || 'The catalog service could not be reached. Please check your connection and retry.'}
            </p>
            <div className="pt-1">
              <Button
                variant="danger"
                size="md"
                onClick={() => fetchCatalogBatch(1, 'reset')}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                {t('common:retry', 'Retry')}
              </Button>
            </div>
          </div>
        ) : displayedAnime.length === 0 ? (
          <div className="text-center py-12 bg-[var(--bg-surface)] rounded-[12px] border border-[var(--border-subtle)] space-y-3 px-4">
            <p className="text-[var(--text-primary)] text-sm font-semibold">
              {t('explore:noAnimeMatchesTitle', 'No anime matches your selected filters.')}
            </p>
            <p className="text-[var(--text-secondary)] text-xs">
              {t('explore:noAnimeMatchesSubtitle', 'Try clearing a language, platform, or search filter.')}
            </p>
            <div className="pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={handleClearAllFilters}
              >
                {t('explore:resetAllFilters', 'Reset All Filters')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Responsive Grid: Mobile (<768px) = 2 cols, Tablet (768-1023px) = 3-4 cols, Desktop (1024px+) = 5-6 cols */}
            <div
              data-testid="explore-infinite-grid"
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"
            >
              {displayedAnime.map((anime, idx) => {
                const isWatchlisted = watchlist.map(Number).includes(Number(anime.id));
                return (
                  <AnimeCard
                    key={`catalog_anime_${anime.id}`}
                    anime={anime}
                    index={idx}
                    priority={false}
                    onSelect={(a) => handleSelectAnimeWithScrollSave(a as any)}
                    isBookmarked={isWatchlisted}
                    onToggleBookmark={onToggleWatchlist}
                    onToggleLike={handleLike}
                    onToggleUpvote={handleUpvote}
                  />
                );
              })}

              {/* Matching 2:3 Eclipse Dark skeleton cards (#191C29) appended while loading next batch */}
              {isFetchingNextPage &&
                Array.from({ length: 6 }).map((_, sIdx) => (
                  <div
                    key={`infinite_skeleton_${sIdx}`}
                    data-testid="infinite-scroll-skeleton-card"
                    className="flex flex-col rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden"
                    aria-hidden="true"
                  >
                    <div className="aspect-[2/3] w-full bg-[var(--bg-elevated)] animate-pulse motion-reduce:animate-none" />
                    <div className="p-2.5 sm:p-3 space-y-2">
                      <div className="h-4 w-5/6 rounded-md bg-[var(--bg-elevated)] animate-pulse motion-reduce:animate-none" />
                      <div className="h-3.5 w-3/5 rounded-md bg-[var(--bg-elevated)] animate-pulse motion-reduce:animate-none" />
                      <div className="pt-1.5 border-t border-[var(--border-subtle)]/70 flex items-center justify-between">
                        <div className="h-3 w-16 rounded bg-[var(--bg-elevated)] animate-pulse motion-reduce:animate-none" />
                        <div className="h-3 w-12 rounded bg-[var(--bg-elevated)] animate-pulse motion-reduce:animate-none" />
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Hybrid Infinite Scroll Footer States */}
            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] flex flex-col items-center justify-center gap-3">
              {/* 1. Loading Next Batch Indicator */}
              {isFetchingNextPage && (
                <div
                  data-testid="infinite-scroll-loading"
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)] shrink-0" />
                  <span>{t('explore:autoLoadingNextBatch', 'Automatically loading next batch...')}</span>
                </div>
              )}

              {/* 2. Next-Batch Error Strip (keeps already-loaded anime intact + 44px Retry button) */}
              {appendError && !isFetchingNextPage && (
                <div
                  role="alert"
                  data-testid="infinite-scroll-error"
                  className="w-full max-w-xl px-4 py-3 rounded-[12px] bg-[var(--bg-surface)] border border-[#F87171]/40 flex flex-col sm:flex-row items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 text-xs text-[var(--text-primary)] text-center sm:text-left">
                    <AlertTriangle className="w-4 h-4 text-[#F87171] shrink-0" />
                    <span>{appendError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryNextBatch}
                    className="h-[44px] min-h-[44px] px-4 rounded-[12px] bg-[var(--bg-elevated)] border border-[#F87171]/50 hover:border-[#F87171] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors duration-180 cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#F87171]" />
                    <span>{t('common:retry', 'Retry')}</span>
                  </button>
                </div>
              )}

              {/* 3. Pause After 48 Anime Cycle: Manual "Load more anime" Button */}
              {!isFetchingNextPage && !appendError && paginationMeta.hasNextPage && isCyclePaused && (
                <div
                  data-testid="infinite-scroll-cycle-pause"
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <button
                    type="button"
                    onClick={handleLoadMoreManual}
                    className="h-[44px] min-h-[44px] px-6 py-2.5 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                  >
                    <span>{t('explore:loadMoreAnime', 'Load more anime')}</span>
                  </button>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {t('explore:manualContinuationHelper', 'Manual continuation after 48 titles')}
                  </span>
                </div>
              )}

              {/* 4. End of Catalog Indicator */}
              {!isFetchingNextPage && !appendError && !paginationMeta.hasNextPage && displayedAnime.length > 0 && (
                <div
                  data-testid="infinite-scroll-end"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span>{t('explore:allCaughtUp', "You're all caught up")}</span>
                </div>
              )}

              {/* Screen-reader / keyboard pagination fallback landmarks */}
              <div className="sr-only" aria-hidden="true">
                <button type="button" aria-label="Previous page" disabled={!paginationMeta.hasPrevPage}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Page {paginationMeta.currentPage} of {paginationMeta.totalPages}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={!paginationMeta.hasNextPage}
                  onClick={handleLoadMoreManual}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* IntersectionObserver Sentinel (500px rootMargin prefetch trigger) */}
              <div
                ref={loadMoreSentinelRef}
                data-testid="infinite-scroll-sentinel"
                className="w-full h-1 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </>
        )}
      </div>

      {/* Compact Latest Dub Updates Feed (below catalog so above-the-fold stays search-first) */}
      <LatestDubUpdatesCard
        className="mt-8"
        limit={6}
        onSelectAnime={(animeId) => {
          const found =
            displayedAnime.find((a) => String(a.id) === String(animeId)) ||
            (fullCatalogIndex || []).find((a: any) => String(a.id) === String(animeId));
          if (found) {
            handleSelectAnimeWithScrollSave(found as any);
          } else {
            handleSelectAnimeWithScrollSave({ id: Number(animeId) } as any);
          }
        }}
      />

      {/* Recently Viewed Row (kept below catalog on Homepage so cards show above the fold) */}
      {recentlyViewed && recentlyViewed.length > 0 && (
        <div className="mt-8">
          <Suspense fallback={null}>
            <RecentlyViewedRow
              items={recentlyViewed}
              onSelectAnime={(a) => handleSelectAnimeWithScrollSave(a as any)}
              onClear={onClearRecentlyViewed || (() => {})}
              onRemoveItem={onRemoveRecentlyViewedItem}
              watchlist={watchlist}
              onToggleWatchlist={onToggleWatchlist}
            />
          </Suspense>
        </div>
      )}

      {/* Floating 44x44px Circular Back to Top Button (Safely above mobile bottom navigation bar) */}
      {showBackToTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          aria-label="Back to top"
          data-testid="explore-back-to-top"
          className="fixed bottom-20 md:bottom-6 right-4 z-40 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--accent-primary)] shadow-xl flex items-center justify-center transition-all duration-180 motion-reduce:transition-none cursor-pointer"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export const CatalogView = React.memo(CatalogViewComponent);
