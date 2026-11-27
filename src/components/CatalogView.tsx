import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import {
  AlertTriangle,
  ArrowUp,
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
import { CANONICAL_OTT_FILTER_OPTIONS } from '../utils/ottHub';
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
  { label: 'Newest Release', value: 'newest' },
  { label: 'Title (A-Z)', value: 'title' },
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
  const [isMoreLanguagesOpen, setIsMoreLanguagesOpen] = useState<boolean>(false);
  const [isOttHubOpen, setIsOttHubOpen] = useState<boolean>(false);

  const [debouncedSearch, setDebouncedSearch] = useState(effectiveSearch || '');

  const activeSubscriptionPlatforms = useMemo(
    () => (mySubscriptionsEnabled && mySubscriptions.length > 0 ? mySubscriptions : []),
    [mySubscriptionsEnabled, mySubscriptions]
  );

  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        q: debouncedSearch.trim().toLowerCase(),
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
      debouncedSearch,
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
          search: debouncedSearch,
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
      debouncedSearch,
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
    setEpisodeLength('any');
    setMinRating(0);
    setFullyDubbedOnly(false);
    setVerifiedOnly(false);
    setFreeLegalOnly(false);
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

  // Core primary language pills: All, Tamil, Hindi, Telugu; remaining languages grouped under More
  const { primaryLanguagePills, extraLanguagePills } = useMemo(() => {
    const primaryOrder = ['all', 'tamil', 'hindi', 'telugu'];
    const byKey = new Map(
      dynamicLanguageFilters.map((item) => [item.value.toLowerCase(), item])
    );

    const primary = [
      byKey.get('all') || { label: 'All', value: 'All', count: 0 },
      byKey.get('tamil') || { label: 'Tamil', value: 'Tamil', count: 0 },
      byKey.get('hindi') || { label: 'Hindi', value: 'Hindi', count: 0 },
      byKey.get('telugu') || { label: 'Telugu', value: 'Telugu', count: 0 },
    ];

    const extra = dynamicLanguageFilters.filter(
      (item) => !primaryOrder.includes(item.value.toLowerCase())
    );

    return { primaryLanguagePills: primary, extraLanguagePills: extra };
  }, [dynamicLanguageFilters]);

  const isExtraLanguageActive = useMemo(() => {
    const current = selectedLanguage.toLowerCase();
    return !['all', 'tamil', 'hindi', 'telugu'].includes(current);
  }, [selectedLanguage]);

  const statsSourceList = useMemo(() => {
    return (catalogList && catalogList.length > 0) ? catalogList : rawAnimeList;
  }, [catalogList, rawAnimeList]);

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

  return (
    <div
      aria-label="Indian Dubbed Anime Discovery Catalog"
      className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 overflow-x-clip font-sans text-[#F4F3FA] pb-8 box-border"
    >
      {/* 1. COMPACT, DISCOVERY-FIRST TOP SECTION (Visible above the fold on 390x844) */}
      <div className="pt-2 sm:pt-4 space-y-2">
        {/* Heading + Discovery Tools Row */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-2xl font-extrabold text-[#F4F3FA] tracking-tight flex items-center gap-1.5 sm:gap-2 min-w-0">
            <ExploreIcon active className="w-5 h-5 sm:w-6 sm:h-6 text-[#B49AF8] shrink-0" />
            <span className="truncate">Find anime in your language</span>
          </h1>

          {/* Mobile Primary Action: Single Random button (44px height) so heading never truncates on 390px */}
          <div className="flex sm:hidden items-center shrink-0">
            <button
              type="button"
              onClick={onOpenRoulette}
              aria-label="Random Anime"
              className="h-[44px] min-h-[44px] px-3.5 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-xs font-bold inline-flex items-center gap-1.5 transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
            >
              <Dices className="w-4 h-4" />
              <span>Random</span>
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
                leftIcon={<Scale className="w-3.5 h-3.5 text-[#CBB6FF]" />}
              >
                <span>Compare</span>
              </Button>
            )}
            {onOpenRecommendations && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenRecommendations}
                aria-label="Find Your Next Anime"
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#CBB6FF]" />}
              >
                <span>Matchmaker</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenRoulette}
              leftIcon={<Dices className="w-3.5 h-3.5" />}
            >
              <span>Random Anime</span>
            </Button>
          </div>
        </div>

        {/* 2. PROMINENT SEARCH BAR (44px height, 12px radius, 44x44px clear button when typing) */}
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#B49AF8] absolute left-3.5 pointer-events-none shrink-0" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search English or Japanese title, alias (e.g. JJK), studio..."
              className="w-full h-[44px] min-h-[44px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/50 focus:border-[#B49AF8] rounded-[12px] pl-10 pr-12 text-sm text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-180 motion-reduce:transition-none"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search query"
                className="absolute right-0.5 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#A1A5B5] hover:text-[#F4F3FA] rounded-[12px] hover:bg-[#191C29] transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {recentSearches.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs py-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A1A5B5] shrink-0">
                <Clock className="w-3 h-3 text-[#B49AF8]" />
                Recent:
              </span>
              {recentSearches.slice(0, 5).map((term) => (
                <div
                  key={`recent_explore_${term}`}
                  className="inline-flex items-center min-h-[40px] rounded-[12px] bg-[#12141E] border border-[#292B39] text-[#F4F3FA] shrink-0 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => handleSearchChange(term)}
                    className="min-h-[40px] px-3 py-1 hover:bg-[#191C29] text-xs font-medium transition-colors duration-180 cursor-pointer"
                  >
                    {term}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove recent search ${term}`}
                    onClick={() => setRecentSearches(removeRecentSearch(term, userId))}
                    className="w-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#A1A5B5] hover:text-[#F87171] hover:bg-[#191C29] transition-colors duration-180 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRecentSearches(clearRecentSearches(userId))}
                className="min-h-[40px] px-2.5 rounded-[12px] text-xs text-[#A1A5B5] hover:text-[#F87171] font-semibold ml-0.5 shrink-0 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* 2b. LANGUAGE FILTER PILLS (All, Tamil, Hindi, Telugu, More at 44px height) + PINNED FILTERS BUTTON (44px) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
            {primaryLanguagePills.map((langItem) => {
              const active =
                selectedLanguage.toLowerCase() === langItem.value.toLowerCase() ||
                (selectedLanguage === 'All' && langItem.value === 'All');
              const nativeScript = NATIVE_LANGUAGE_SCRIPT[langItem.value.toLowerCase()];
              return (
                <button
                  key={langItem.value}
                  type="button"
                  onClick={() => setSelectedLanguage(langItem.value)}
                  aria-pressed={active}
                  className={`h-[44px] min-h-[44px] px-3 sm:px-3.5 py-2 rounded-[12px] text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 border transition-all duration-180 motion-reduce:transition-none cursor-pointer ${
                    active
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#CBB6FF] font-bold'
                      : 'bg-[#12141E] border-[#292B39] hover:border-[#B49AF8]/50 text-[#F4F3FA]'
                  }`}
                >
                  <span>{langItem.label}</span>
                  {nativeScript && (
                    <span
                      className={`hidden sm:inline text-[11px] font-medium ${
                        active ? 'text-[#0B0A10]/85' : 'text-[#CBB6FF]'
                      }`}
                    >
                      {nativeScript}
                    </span>
                  )}
                </button>
              );
            })}

            {/* More Languages Pill */}
            <button
              type="button"
              onClick={() => setIsMoreLanguagesOpen((prev) => !prev)}
              aria-expanded={isMoreLanguagesOpen}
              aria-pressed={isExtraLanguageActive}
              className={`h-[44px] min-h-[44px] px-3 sm:px-3.5 py-2 rounded-[12px] text-xs font-semibold shrink-0 inline-flex items-center gap-1 border transition-all duration-180 motion-reduce:transition-none cursor-pointer ${
                isExtraLanguageActive
                  ? 'bg-[#B49AF8] text-[#0B0A10] border-[#CBB6FF] font-bold'
                  : isMoreLanguagesOpen
                    ? 'bg-[#191C29] border-[#B49AF8] text-[#F4F3FA]'
                    : 'bg-[#12141E] border-[#292B39] hover:border-[#B49AF8]/50 text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
            >
              <span>{isExtraLanguageActive ? selectedLanguage : 'More'}</span>
              {isMoreLanguagesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Pinned 44px Filters Button (never clipped on 360px/390px mobile) */}
          <button
            type="button"
            onClick={() => setIsSmartFilterOpen((prev) => !prev)}
            aria-expanded={isSmartFilterOpen}
            aria-label="Toggle Smart Filters"
            className={`h-[44px] min-h-[44px] px-3 sm:px-3.5 py-2 rounded-[12px] text-xs font-semibold border transition-all duration-180 motion-reduce:transition-none cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
              isSmartFilterOpen || activeAdvancedFilterCount > 0
                ? 'bg-[#191C29] border-[#B49AF8] text-[#F4F3FA]'
                : 'bg-[#12141E] border-[#292B39] text-[#F4F3FA] hover:border-[#B49AF8]/50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[#B49AF8]" />
            <span>Filters</span>
            {activeAdvancedFilterCount > 0 && (
              <span
                data-testid="active-filter-count-badge"
                className="px-1.5 py-0.5 rounded-md bg-[#B49AF8] text-[#0B0A10] text-[10px] font-extrabold tabular-nums"
              >
                {activeAdvancedFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Extra Regional Languages Tray (When "More" is clicked) */}
        {isMoreLanguagesOpen && (
          <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-[12px] bg-[#12141E] border border-[#292B39]">
            {(extraLanguagePills.length > 0
              ? extraLanguagePills
              : [
                  { label: 'Malayalam', value: 'Malayalam', count: 0 },
                  { label: 'Kannada', value: 'Kannada', count: 0 },
                  { label: 'Bengali', value: 'Bengali', count: 0 },
                  { label: 'Marathi', value: 'Marathi', count: 0 },
                  { label: 'English', value: 'English', count: 0 },
                  { label: 'Japanese', value: 'Japanese', count: 0 },
                ]
            ).map((langItem) => {
              const active = selectedLanguage.toLowerCase() === langItem.value.toLowerCase();
              const nativeScript = NATIVE_LANGUAGE_SCRIPT[langItem.value.toLowerCase()];
              return (
                <button
                  key={`more_lang_${langItem.value}`}
                  type="button"
                  onClick={() => {
                    setSelectedLanguage(langItem.value);
                    setIsMoreLanguagesOpen(false);
                  }}
                  aria-pressed={active}
                  className={`min-h-[42px] px-3.5 py-1.5 rounded-[12px] text-xs font-semibold inline-flex items-center gap-1.5 border transition-all duration-180 cursor-pointer ${
                    active
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#CBB6FF] font-bold'
                      : 'bg-[#191C29] border-[#292B39] hover:border-[#B49AF8]/50 text-[#F4F3FA]'
                  }`}
                >
                  <span>{langItem.label}</span>
                  {nativeScript && (
                    <span className={`text-[11px] ${active ? 'text-[#0B0A10]/85' : 'text-[#CBB6FF]'}`}>
                      {nativeScript}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 4. COLLAPSIBLE SINGLE-LINE OTT COVERAGE / SUBSCRIPTIONS STRIP (Slim 44px height) */}
        <div className="rounded-[12px] bg-[#12141E] border border-[#292B39] overflow-hidden">
          <button
            type="button"
            onClick={() => setIsOttHubOpen((prev) => !prev)}
            aria-expanded={isOttHubOpen}
            aria-label="Toggle OTT Coverage Hub"
            className="w-full h-[44px] min-h-[44px] px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-left hover:bg-[#191C29] transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Tv className="w-4 h-4 text-[#B49AF8] shrink-0" />
              <span className="font-semibold text-[#F4F3FA] truncate">
                My Subscriptions &amp; OTT Coverage
              </span>
              {mySubscriptionsEnabled && mySubscriptions.length > 0 ? (
                <span className="px-1.5 py-0.5 rounded bg-[#34D399]/15 border border-[#34D399]/35 text-[10px] font-bold text-[#34D399] shrink-0">
                  {mySubscriptions.length} Active
                </span>
              ) : (
                <span className="hidden sm:inline text-[11px] text-[#A1A5B5] truncate">
                  Filter by Crunchyroll, Netflix, JioHotstar &amp; free legal streams
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#B49AF8] shrink-0">
              <span>{isOttHubOpen ? 'Hide' : 'Expand'}</span>
              {isOttHubOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {isOttHubOpen && (
            <div className="p-3 border-t border-[#292B39] bg-[#0B0A10]/40">
              <OttHubSection
                catalogIndex={fullCatalogIndex && fullCatalogIndex.length > 0 ? fullCatalogIndex : statsSourceList}
                selectedPlatform={selectedPlatform}
                activeLanguage={selectedLanguage}
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
          )}
        </div>

        {/* 3. UNIFIED FILTER & SORT BOTTOM SHEET (MOBILE) / PANEL (DESKTOP) */}
        {isSmartFilterOpen && (
          <div className="fixed inset-0 z-[75] sm:static sm:z-auto flex items-end sm:block">
            {/* Mobile Backdrop */}
            <div
              onClick={() => setIsSmartFilterOpen(false)}
              className="fixed inset-0 bg-[#0B0A10]/80 backdrop-blur-xs sm:hidden"
              aria-hidden="true"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Catalog Filters"
              data-testid="smart-filter-drawer"
              className="relative z-10 w-full max-h-[86vh] overflow-y-auto rounded-t-3xl sm:rounded-[12px] bg-[#12141E] border-t sm:border border-[#292B39] p-4 sm:p-5 space-y-4 shadow-2xl"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
            >
              {/* Mobile Drag Handle */}
              <div className="sm:hidden w-10 h-1.5 rounded-full bg-[#292B39] mx-auto -mt-1 mb-1" />

              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#292B39]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#B49AF8]" />
                  <h2 className="text-sm sm:text-base font-bold text-[#F4F3FA]">Filter &amp; Sort Anime</h2>
                  {activeAdvancedFilterCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#B49AF8]/15 border border-[#B49AF8]/35 text-[#B49AF8] text-[11px] font-bold">
                      {activeAdvancedFilterCount} active
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsSmartFilterOpen(false)}
                  aria-label="Close filters"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[#191C29] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-180 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Consolidated Languages Section inside Unified Filter Sheet */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                  Dub Languages
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ...primaryLanguagePills,
                    ...(extraLanguagePills.length > 0
                      ? extraLanguagePills
                      : [
                          { label: 'Malayalam', value: 'Malayalam', count: 0 },
                          { label: 'Kannada', value: 'Kannada', count: 0 },
                          { label: 'Bengali', value: 'Bengali', count: 0 },
                          { label: 'Marathi', value: 'Marathi', count: 0 },
                        ]),
                  ].map((langItem) => {
                    const active =
                      selectedLanguage.toLowerCase() === langItem.value.toLowerCase() ||
                      (selectedLanguage === 'All' && langItem.value === 'All');
                    return (
                      <button
                        key={`sheet_lang_${langItem.value}`}
                        type="button"
                        onClick={() => setSelectedLanguage(langItem.value)}
                        aria-pressed={active}
                        className={`min-h-[42px] px-3 py-1.5 rounded-[12px] text-xs font-semibold border transition-colors duration-180 cursor-pointer ${
                          active
                            ? 'bg-[#B49AF8] text-[#0B0A10] border-[#CBB6FF] font-bold'
                            : 'bg-[#191C29] border-[#292B39] text-[#F4F3FA] hover:border-[#B49AF8]/50'
                        }`}
                      >
                        {langItem.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Selectors: OTT Platforms, Genre, Format Type, Release Status, Sort By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-[#292B39]">
                {[
                  { label: 'STREAMING PLATFORM', aria: 'Filter by platform', val: selectedPlatform, set: setSelectedPlatform, opts: PLATFORMS },
                  { label: 'GENRE', aria: 'Filter by genre', val: selectedGenre, set: setSelectedGenre, opts: GENRES },
                  { label: 'TYPE', aria: 'Filter by type', val: selectedType, set: setSelectedType, opts: TYPES },
                  { label: 'RELEASE STATUS', aria: 'Filter by status', val: selectedStatus, set: setSelectedStatus, opts: STATUSES },
                ].map((item) => (
                  <div
                    key={`catalog_filter_${item.label}`}
                    className="flex flex-col justify-center min-h-[48px] gap-1 bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/50 rounded-[12px] px-3 py-2 transition-colors duration-180"
                  >
                    <span className="text-[10px] text-[#A1A5B5] font-bold uppercase tracking-wider">
                      {item.label}
                    </span>
                    <div className="relative flex items-center">
                      <select
                        value={item.val}
                        onChange={(e) => item.set(e.target.value)}
                        aria-label={item.aria}
                        className="bg-transparent text-[#F4F3FA] text-xs font-semibold outline-none cursor-pointer appearance-none w-full pr-5 truncate"
                      >
                        {item.opts.map((o) => (
                          <option key={o} value={o} className="bg-[#12141E] text-[#F4F3FA]">
                            {o}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-[#A1A5B5] pointer-events-none" />
                    </div>
                  </div>
                ))}

                {/* Sort Dropdown */}
                <div className="flex flex-col justify-center min-h-[48px] gap-1 bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/50 rounded-[12px] px-3 py-2 transition-colors duration-180">
                  <span className="text-[10px] text-[#A1A5B5] font-bold uppercase tracking-wider">
                    SORT BY
                  </span>
                  <div className="relative flex items-center">
                    <select
                      value={selectedSort}
                      onChange={(e) => setSelectedSort(e.target.value)}
                      aria-label="Sort catalog"
                      className="bg-transparent text-[#F4F3FA] text-xs font-semibold outline-none cursor-pointer appearance-none w-full pr-5 truncate"
                    >
                      {SORTS.map((s) => (
                        <option key={s.value} value={s.value} className="bg-[#12141E] text-[#F4F3FA]">
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-[#A1A5B5] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Dub Availability Toggles */}
              <div className="space-y-2 pt-2 border-t border-[#292B39]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                  Dub Availability &amp; Verification
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifiedOnly((prev) => !prev)}
                    aria-pressed={verifiedOnly}
                    className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-xs font-semibold border transition-all duration-180 cursor-pointer inline-flex items-center gap-2 ${
                      verifiedOnly
                        ? 'bg-[#B49AF8] border-[#CBB6FF] text-[#0B0A10] font-bold'
                        : 'bg-[#191C29] border-[#292B39] text-[#F4F3FA] hover:border-[#B49AF8]/50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Verified availability only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFullyDubbedOnly((prev) => !prev)}
                    aria-pressed={fullyDubbedOnly}
                    className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-xs font-semibold border transition-all duration-180 cursor-pointer inline-flex items-center gap-2 ${
                      fullyDubbedOnly
                        ? 'bg-[#B49AF8] border-[#CBB6FF] text-[#0B0A10] font-bold'
                        : 'bg-[#191C29] border-[#292B39] text-[#F4F3FA] hover:border-[#B49AF8]/50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Fully dubbed seasons only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFreeLegalOnly((prev) => !prev)}
                    aria-pressed={freeLegalOnly}
                    className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-xs font-semibold border transition-all duration-180 cursor-pointer inline-flex items-center gap-2 ${
                      freeLegalOnly
                        ? 'bg-[#B49AF8] border-[#CBB6FF] text-[#0B0A10] font-bold'
                        : 'bg-[#191C29] border-[#292B39] text-[#F4F3FA] hover:border-[#B49AF8]/50'
                    }`}
                  >
                    <Tv className="w-4 h-4 shrink-0" />
                    <span>Free Legal Streaming Only</span>
                  </button>
                </div>
              </div>

              {/* Episode Length + Minimum Rating */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#292B39]">
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                    Episode Length
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EPISODE_LENGTH_OPTIONS.map((opt) => {
                      const active = episodeLength === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEpisodeLength(opt.id)}
                          aria-pressed={active}
                          className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-xs font-semibold border transition-colors duration-180 cursor-pointer ${
                            active
                              ? 'bg-[#B49AF8] border-[#CBB6FF] text-[#0B0A10] font-bold'
                              : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="smart-filter-min-rating"
                      className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5] flex items-center gap-1.5"
                    >
                      <Star className="w-3.5 h-3.5 text-[#F9C876] fill-[#F9C876]" />
                      <span>Minimum Catalog Score</span>
                    </label>
                    <span className="text-xs font-bold text-[#F9C876] bg-[#191C29] border border-[#292B39] px-2 py-0.5 rounded-lg">
                      {minRating > 0 ? `${minRating.toFixed(1)} / 10` : 'Any Rating'}
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
                    className="w-full accent-[#B49AF8] cursor-pointer h-2 bg-[#191C29] rounded-lg"
                  />
                </div>
              </div>

              {/* Sticky Filter Drawer Footer: Reset & Show results (#B49AF8) CTA */}
              <div className="sticky bottom-0 bg-[#12141E] flex items-center justify-between gap-3 pt-3 border-t border-[#292B39]">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleClearAllFilters}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  aria-label="Apply Filters"
                  onClick={() => setIsSmartFilterOpen(false)}
                >
                  Show results ({totalCatalogCount})
                </Button>
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
            <span className="text-xs font-bold text-[#A1A5B5] mr-1">
              {totalCatalogCount} {totalCatalogCount === 1 ? 'match' : 'matches'}:
            </span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleRemoveChip(chip)}
                aria-label={`Remove filter ${chip.label}`}
                className="min-h-[40px] sm:min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#191C29] border border-[#B49AF8]/40 text-xs font-semibold text-[#CBB6FF] hover:border-[#B49AF8] hover:text-[#F4F3FA] transition-colors duration-180 cursor-pointer"
              >
                <span>{chip.label}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleShareFilterUrl}
              className="min-h-[40px] sm:min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#12141E] border border-[#292B39] text-xs font-semibold text-[#F4F3FA] hover:bg-[#191C29] transition-colors duration-180 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#B49AF8]" />
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
          <div className="bg-[#12141E] border border-[#292B39] rounded-[12px] p-3 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#F9C876] shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#F4F3FA]">Curated For You • Indian Regional Dubs</div>
              <div className="text-[11px] text-[#A1A5B5] mt-0.5">
                Tailored to your preferred Tamil, Telugu, Hindi &amp; Malayalam anime dubs.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. POSTER-FIRST ANIME CATALOG GRID (Hybrid Infinite Scroll) */}
      <div ref={gridTopRef} className="pt-3 sm:pt-5">
        {/* Compact Grid Status Row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-[#A1A5B5]">
              {catalogStatus === 'error' || catalogStatus === 'offline' ? (
                <span className="text-[#F87171] font-semibold">
                  {catalogStatus === 'offline' ? 'Offline — unable to reach catalog' : 'Unable to load catalog'}
                </span>
              ) : displayedAnime.length > 0 ? (
                <>
                  Showing <strong className="text-[#F4F3FA] font-bold tabular-nums">{displayedAnime.length}</strong> of{' '}
                  <strong className="text-[#F4F3FA] font-bold tabular-nums">{totalCatalogCount}</strong> Titles
                </>
              ) : loading ? (
                <span>Loading catalog...</span>
              ) : (
                <>
                  Showing <strong className="text-[#F4F3FA] font-bold tabular-nums">0</strong> Titles
                </>
              )}
            </span>
          </div>
          {catalogStatus !== 'error' && catalogStatus !== 'offline' && (
            <span className="text-xs text-[#A1A5B5] tabular-nums">
              Batch {paginationMeta.currentPage} of {Math.max(1, paginationMeta.totalPages)}
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
            className="p-6 sm:p-8 rounded-[12px] bg-[#12141E] border border-[#F87171]/40 text-center space-y-3 max-w-xl mx-auto my-4"
          >
            <div className="w-12 h-12 rounded-[12px] bg-[#F87171]/15 border border-[#F87171]/30 text-[#F87171] flex items-center justify-center mx-auto">
              {catalogStatus === 'offline' ? (
                <WifiOff className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-base font-bold text-[#F4F3FA]">
              {catalogStatus === 'offline' ? 'You are currently offline' : 'Failed to load anime catalog'}
            </h3>
            <p className="text-xs text-[#A1A5B5] max-w-md mx-auto leading-relaxed">
              {catalogError || 'The catalog service could not be reached. Please check your connection and retry.'}
            </p>
            <div className="pt-1">
              <Button
                variant="danger"
                size="md"
                onClick={() => fetchCatalogBatch(1, 'reset')}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : displayedAnime.length === 0 ? (
          <div className="text-center py-12 bg-[#12141E] rounded-[12px] border border-[#292B39] space-y-3">
            <p className="text-[#F4F3FA] text-sm font-semibold">No anime matches your selected filters.</p>
            <p className="text-[#A1A5B5] text-xs">Try clearing a language, platform, or search filter.</p>
            <div className="pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={handleClearAllFilters}
              >
                Reset All Filters
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
                    className="flex flex-col rounded-[12px] bg-[#12141E] border border-[#292B39] overflow-hidden"
                    aria-hidden="true"
                  >
                    <div className="aspect-[2/3] w-full bg-[#191C29] animate-pulse motion-reduce:animate-none" />
                    <div className="p-2.5 sm:p-3 space-y-2">
                      <div className="h-4 w-5/6 rounded-md bg-[#191C29] animate-pulse motion-reduce:animate-none" />
                      <div className="h-3.5 w-3/5 rounded-md bg-[#191C29] animate-pulse motion-reduce:animate-none" />
                      <div className="pt-1.5 border-t border-[#292B39]/70 flex items-center justify-between">
                        <div className="h-3 w-16 rounded bg-[#191C29] animate-pulse motion-reduce:animate-none" />
                        <div className="h-3 w-12 rounded bg-[#191C29] animate-pulse motion-reduce:animate-none" />
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Hybrid Infinite Scroll Footer States */}
            <div className="mt-8 pt-6 border-t border-[#292B39] flex flex-col items-center justify-center gap-3">
              {/* 1. Loading Next Batch Indicator */}
              {isFetchingNextPage && (
                <div
                  data-testid="infinite-scroll-loading"
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-[12px] bg-[#12141E] border border-[#292B39] text-xs font-semibold text-[#A1A5B5]"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-[#B49AF8] shrink-0" />
                  <span>Automatically loading next batch...</span>
                </div>
              )}

              {/* 2. Next-Batch Error Strip (keeps already-loaded anime intact + 44px Retry button) */}
              {appendError && !isFetchingNextPage && (
                <div
                  role="alert"
                  data-testid="infinite-scroll-error"
                  className="w-full max-w-xl px-4 py-3 rounded-[12px] bg-[#12141E] border border-[#F87171]/40 flex flex-col sm:flex-row items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 text-xs text-[#F4F3FA] text-center sm:text-left">
                    <AlertTriangle className="w-4 h-4 text-[#F87171] shrink-0" />
                    <span>{appendError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryNextBatch}
                    className="h-[44px] min-h-[44px] px-4 rounded-[12px] bg-[#191C29] border border-[#F87171]/50 hover:border-[#F87171] text-xs font-bold text-[#F4F3FA] inline-flex items-center gap-1.5 transition-colors duration-180 cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#F87171]" />
                    <span>Retry</span>
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
                    className="h-[44px] min-h-[44px] px-6 py-2.5 rounded-[12px] bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8] text-sm font-bold text-[#F4F3FA] inline-flex items-center justify-center gap-2 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                  >
                    <span>Load more anime</span>
                  </button>
                  <span className="text-xs text-[#A1A5B5]">
                    Manual continuation after 48 titles
                  </span>
                </div>
              )}

              {/* 4. End of Catalog Indicator */}
              {!isFetchingNextPage && !appendError && !paginationMeta.hasNextPage && displayedAnime.length > 0 && (
                <div
                  data-testid="infinite-scroll-end"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] bg-[#12141E] border border-[#292B39] text-xs font-semibold text-[#A1A5B5]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#B49AF8] shrink-0" />
                  <span>You&apos;re all caught up</span>
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
          className="fixed bottom-20 md:bottom-6 right-4 z-40 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8] text-[#B49AF8] shadow-xl flex items-center justify-center transition-all duration-180 motion-reduce:transition-none cursor-pointer"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export const CatalogView = React.memo(CatalogViewComponent);
