import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import {
  AlertTriangle,
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
import { getVisiblePageNumbers } from '../utils/pagination';
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
  const [rawAnimeList, setRawAnimeList] = useState<Anime[]>(catalogList || []);

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

  const CATALOG_PAGE_SIZE = 12;

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
  const [freeLegalOnly, setFreeLegalOnly] = useState<boolean>(false);
  const [isSmartFilterOpen, setIsSmartFilterOpen] = useState<boolean>(false);
  const [isOttHubOpen, setIsOttHubOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'success' | 'empty' | 'error' | 'offline'>('loading');
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Seed rawAnimeList from parent catalogList only while initial fetch is pending and local list is empty
  useEffect(() => {
    if (catalogList && catalogList.length > 0 && rawAnimeList.length === 0 && catalogStatus === 'loading') {
      setRawAnimeList(catalogList);
    }
  }, [catalogList, rawAnimeList.length, catalogStatus]);

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

  // Server-Side Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState(effectiveSearch || '');
  const [paginationMeta, setPaginationMeta] = useState<CatalogMeta>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: CATALOG_PAGE_SIZE,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [catalogSummary, setCatalogSummary] = useState<CatalogSummary | null>(null);
  const gridTopRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const activeSubscriptionPlatforms = useMemo(
    () => (mySubscriptionsEnabled && mySubscriptions.length > 0 ? mySubscriptions : []),
    [mySubscriptionsEnabled, mySubscriptions]
  );

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedLanguage,
    selectedGenre,
    selectedPlatform,
    selectedType,
    selectedStatus,
    selectedSort,
    debouncedSearch,
    episodeLength,
    minRating,
    fullyDubbedOnly,
    freeLegalOnly,
    activeSubscriptionPlatforms,
  ]);

  const fetchCatalogPage = useCallback(async (pageToFetch: number) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setCatalogStatus('loading');
    setCatalogError(null);
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
        setCatalogStatus(nextStatus);
        setCatalogError(
          response.error ||
            (nextStatus === 'offline'
              ? 'You appear to be offline. Reconnect and tap Retry.'
              : 'Unable to load the anime catalog right now. Please try again.')
        );
        setRawAnimeList([]);
        return;
      }

      const data = response.data || [];
      const meta = response.meta;

      if (response.summary) {
        setCatalogSummary(response.summary);
      }

      if (data.length > 0 || (meta && meta.totalItems > 0)) {
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
        setRawAnimeList(normalized);
        setCatalogStatus(normalized.length === 0 ? 'empty' : 'success');
        if (meta) {
          setPaginationMeta(meta);
        }
      } else {
        setRawAnimeList([]);
        setCatalogStatus('empty');
        if (meta) {
          setPaginationMeta(meta);
        } else {
          setPaginationMeta({
            currentPage: pageToFetch,
            totalPages: 1,
            totalItems: 0,
            limit: CATALOG_PAGE_SIZE,
            hasNextPage: false,
            hasPrevPage: pageToFetch > 1,
          });
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      console.warn('Failed fetching paginated catalog from Cloudflare:', err);
      setCatalogStatus(offline ? 'offline' : 'error');
      setCatalogError(
        offline
          ? 'You appear to be offline. Reconnect and try again.'
          : err?.message || 'Unable to connect to the catalog API. Please retry.'
      );
      setRawAnimeList([]);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [
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
  ]);

  useEffect(() => {
    fetchCatalogPage(currentPage);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [currentPage, fetchCatalogPage]);

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
    setFreeLegalOnly(false);
    handleSearchChange('');
    onToggleMySubscriptionsEnabled?.(false);
    setCurrentPage(1);
  }, [onToggleMySubscriptionsEnabled]);

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
        case 'freeLegalOnly':
          setFreeLegalOnly(false);
          break;
        case 'mySubscriptions':
          onToggleMySubscriptionsEnabled?.(false);
          break;
      }
    },
    [onToggleMySubscriptionsEnabled]
  );

  const displayedAnime = rawAnimeList;

  const handlePageChange = (nextPage: number) => {
    const bounded = Math.min(Math.max(1, nextPage), paginationMeta.totalPages || 1);
    if (bounded === currentPage || loading) return;
    setCurrentPage(bounded);
    try {
      gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {}
  };

  // Compute dynamic regional dub language filter buttons from backend summary or loaded list
  const dynamicLanguageFilters = useMemo(() => {
    if (catalogSummary?.languageFilters && catalogSummary.languageFilters.length > 0) {
      return catalogSummary.languageFilters;
    }
    return computeDynamicLanguageFilters(catalogList && catalogList.length > 0 ? catalogList : rawAnimeList);
  }, [catalogSummary, catalogList, rawAnimeList]);

  const statsSourceList = useMemo(() => {
    return (catalogList && catalogList.length > 0) ? catalogList : rawAnimeList;
  }, [catalogList, rawAnimeList]);

  const visiblePageNumbers = useMemo(() => {
    return getVisiblePageNumbers(paginationMeta.currentPage, paginationMeta.totalPages, 5);
  }, [paginationMeta.currentPage, paginationMeta.totalPages]);

  const rangeStart = paginationMeta.totalItems === 0
    ? 0
    : ((paginationMeta.currentPage - 1) * paginationMeta.limit) + 1;
  const rangeEnd = Math.min(
    paginationMeta.totalItems,
    rangeStart + Math.max(0, displayedAnime.length - 1)
  );

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
    freeLegalOnly,
  ]);

  return (
    <div
      aria-label="Indian Dubbed Anime Discovery Catalog"
      className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 overflow-x-clip font-sans text-[#F4F3FA] pb-8 box-border"
    >
      {/* 1. COMPACT ABOVE-THE-FOLD EXPLORE HEADER + SEARCH + NATIVE SCRIPT LANGUAGE PILLS */}
      <div className="pt-2.5 sm:pt-5 space-y-2 sm:space-y-3">
        {/* Heading + Discovery Tools Row */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-2xl font-extrabold text-[#F4F3FA] tracking-tight flex items-center gap-1.5 sm:gap-2 min-w-0">
            <ExploreIcon active className="w-5 h-5 sm:w-6 sm:h-6 text-[#B49AF8] shrink-0" />
            <span className="truncate">Find anime in your language</span>
          </h1>

          {/* Mobile Primary Action: Single Random button so heading never truncates on 390px */}
          <div className="flex sm:hidden items-center shrink-0">
            <button
              type="button"
              onClick={onOpenRoulette}
              aria-label="Random Anime"
              className="min-h-[38px] px-3 rounded-xl bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-xs font-bold inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer shrink-0"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Random</span>
            </button>
          </div>

          {/* Desktop Discovery Tools Group (1 primary button on screen: Random) */}
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

        {/* Dedicated Explore Search Box + Compact Recent Searches */}
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#B49AF8] absolute left-3.5 pointer-events-none shrink-0" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search English or Japanese title, alias (e.g. JJK), studio..."
              className="w-full h-11 bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/50 focus:border-[#B49AF8] rounded-xl pl-10 pr-10 text-sm text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-150"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search query"
                className="absolute right-2.5 w-8 h-8 flex items-center justify-center text-[#A1A5B5] hover:text-[#F4F3FA] rounded-lg hover:bg-[#191C29] transition-colors duration-150 cursor-pointer"
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
                  className="inline-flex items-center rounded-lg bg-[#12141E] border border-[#292B39] text-[#F4F3FA] shrink-0 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => handleSearchChange(term)}
                    className="px-2 py-0.5 hover:bg-[#191C29] text-[11px] font-medium transition-colors duration-150 cursor-pointer"
                  >
                    {term}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove recent search ${term}`}
                    onClick={() => setRecentSearches(removeRecentSearch(term, userId))}
                    className="px-1.5 py-0.5 text-[#A1A5B5] hover:text-[#F87171] transition-colors duration-150 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRecentSearches(clearRecentSearches(userId))}
                className="text-[11px] text-[#A1A5B5] hover:text-[#F87171] font-semibold ml-1 shrink-0 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Regional Dub Language Pills with Native Scripts + Expandable Filter/OTT Triggers */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {dynamicLanguageFilters.map((langItem) => {
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
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 border transition-colors duration-150 cursor-pointer ${
                  active
                    ? 'bg-[#B49AF8] text-[#0B0A10] border-[#CBB6FF] font-bold'
                    : 'bg-[#12141E] border-[#292B39] hover:border-[#B49AF8]/50 text-[#F4F3FA]'
                }`}
              >
                <span>{langItem.label}</span>
                {nativeScript && (
                  <span
                    className={`text-[11px] font-medium ${
                      active ? 'text-[#0B0A10]/85' : 'text-[#CBB6FF]'
                    }`}
                  >
                    {nativeScript}
                  </span>
                )}
                {langItem.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                      active
                        ? 'bg-[#0B0A10]/20 text-[#0B0A10]'
                        : 'bg-[#191C29] text-[#A1A5B5]'
                    }`}
                  >
                    {langItem.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Expandable Filters & Sort Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsSmartFilterOpen((prev) => !prev)}
            aria-expanded={isSmartFilterOpen}
            aria-label="Toggle Smart Filters"
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors duration-150 cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
              isSmartFilterOpen || activeAdvancedFilterCount > 0
                ? 'bg-[#191C29] border-[#B49AF8] text-[#F4F3FA]'
                : 'bg-[#12141E] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] hover:border-[#B49AF8]/50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#B49AF8]" />
            <span>Filters</span>
            {activeAdvancedFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#B49AF8] text-[#0B0A10] text-[10px] font-extrabold tabular-nums">
                {activeAdvancedFilterCount}
              </span>
            )}
            {isSmartFilterOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Expandable OTT Coverage Trigger */}
          <button
            type="button"
            onClick={() => setIsOttHubOpen((prev) => !prev)}
            aria-expanded={isOttHubOpen}
            aria-label="Toggle OTT Coverage Hub"
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors duration-150 cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
              isOttHubOpen || mySubscriptionsEnabled
                ? 'bg-[#191C29] border-[#B49AF8] text-[#F4F3FA]'
                : 'bg-[#12141E] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] hover:border-[#B49AF8]/50'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-[#CBB6FF]" />
            <span>OTT Hub</span>
            {mySubscriptionsEnabled && (
              <span className="w-2 h-2 rounded-full bg-[#34D399]" />
            )}
            {isOttHubOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* EXPANDABLE FILTERS & SORT PANEL (Collapsed by default so Anime Cards appear on 1st mobile screen) */}
        {isSmartFilterOpen && (
          <div
            data-testid="smart-filter-drawer"
            className="rounded-2xl bg-[#12141E] border border-[#292B39] p-3.5 sm:p-4 space-y-4 shadow-xl"
          >
            {/* Primary Dropdowns Grid: Genre, Platform, Type, Status, Sort */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
              {[
                { label: 'GENRE', val: selectedGenre, set: setSelectedGenre, opts: GENRES },
                { label: 'PLATFORM', val: selectedPlatform, set: setSelectedPlatform, opts: PLATFORMS },
                { label: 'TYPE', val: selectedType, set: setSelectedType, opts: TYPES },
                { label: 'STATUS', val: selectedStatus, set: setSelectedStatus, opts: STATUSES },
              ].map((item) => (
                <div
                  key={`catalog_filter_${item.label}`}
                  className="relative min-w-0 overflow-hidden flex items-center justify-between bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/50 rounded-xl px-2.5 py-2 transition-colors duration-150"
                >
                  <span className="text-[10px] text-[#A1A5B5] font-bold uppercase tracking-wider shrink-0 pr-1">
                    {item.label}
                  </span>
                  <div className="relative flex items-center min-w-0 flex-1 justify-end">
                    <select
                      value={item.val}
                      onChange={(e) => item.set(e.target.value)}
                      aria-label={`Filter by ${item.label.toLowerCase()}`}
                      className="bg-transparent text-[#F4F3FA] text-xs font-semibold outline-none cursor-pointer text-right appearance-none w-full min-w-0 text-ellipsis pr-4 truncate"
                    >
                      {item.opts.map(o => (
                        <option key={o} value={o} className="bg-[#12141E] text-[#F4F3FA]">
                          {o}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-[#A1A5B5] pointer-events-none shrink-0" />
                  </div>
                </div>
              ))}

              {/* Sort Dropdown */}
              <div className="relative min-w-0 overflow-hidden col-span-2 sm:col-span-1 flex items-center justify-between bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/50 rounded-xl px-2.5 py-2 transition-colors duration-150">
                <span className="text-[10px] text-[#A1A5B5] font-bold uppercase tracking-wider shrink-0 pr-1">
                  SORT
                </span>
                <div className="relative flex items-center min-w-0 flex-1 justify-end">
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    aria-label="Sort catalog"
                    className="bg-transparent text-[#F4F3FA] text-xs font-semibold outline-none cursor-pointer text-right appearance-none w-full min-w-0 text-ellipsis pr-4 truncate"
                  >
                    {SORTS.map(s => (
                      <option key={s.value} value={s.value} className="bg-[#12141E] text-[#F4F3FA]">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-[#A1A5B5] pointer-events-none shrink-0" />
                </div>
              </div>
            </div>

            {/* Smart Filter Controls: Episode Length + Minimum Rating + Quick Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#292B39]">
              {/* Episode Length Buckets */}
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
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors duration-150 cursor-pointer ${
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

              {/* Minimum Rating Slider */}
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
                <div className="flex justify-between text-[10px] text-[#A1A5B5] font-semibold">
                  <span>0</span>
                  <span>5.0</span>
                  <span>7.5</span>
                  <span>10</span>
                </div>
              </div>
            </div>

            {/* Verified Dub & Free Legal Streaming Toggles */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#292B39]">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFullyDubbedOnly((prev) => !prev)}
                  aria-pressed={fullyDubbedOnly}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors duration-150 cursor-pointer inline-flex items-center gap-1.5 ${
                    fullyDubbedOnly
                      ? 'bg-[#34D399]/15 border-[#34D399]/60 text-[#34D399]'
                      : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fully Dubbed Only</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFreeLegalOnly((prev) => !prev)}
                  aria-pressed={freeLegalOnly}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors duration-150 cursor-pointer inline-flex items-center gap-1.5 ${
                    freeLegalOnly
                      ? 'bg-[#B49AF8]/20 border-[#B49AF8] text-[#CBB6FF]'
                      : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Free Legal Streaming Only</span>
                </button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSmartFilterOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* EXPANDABLE OTT COVERAGE & SUBSCRIPTION CALCULATOR */}
        {isOttHubOpen && (
          <div className="pt-1">
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
              onSelectAnime={(a) => onSelectAnime(a as any)}
            />
          </div>
        )}

        {/* Active Filter Chips & Clear All */}
        {activeFilterChips.length > 0 && (
          <div
            data-testid="active-filter-chips"
            className="flex flex-wrap items-center gap-1.5 pt-0.5"
          >
            <span className="text-[11px] font-bold text-[#A1A5B5] mr-1">
              {paginationMeta.totalItems} {paginationMeta.totalItems === 1 ? 'match' : 'matches'}:
            </span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleRemoveChip(chip)}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#191C29] border border-[#B49AF8]/40 text-[11px] font-semibold text-[#CBB6FF] hover:border-[#B49AF8] hover:text-[#F4F3FA] transition-colors duration-150 cursor-pointer"
              >
                <span>{chip.label}</span>
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleShareFilterUrl}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#12141E] border border-[#292B39] text-[11px] font-semibold text-[#F4F3FA] hover:bg-[#191C29] transition-colors duration-150 cursor-pointer"
            >
              <Share2 className="w-3 h-3 text-[#B49AF8]" />
              <span>Share Link</span>
            </button>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F87171]/15 border border-[#F87171]/35 text-[11px] font-semibold text-[#F87171] hover:bg-[#F87171]/25 transition-colors duration-150 cursor-pointer"
            >
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* FOR YOU METADATA BANNER */}
      {feedView === 'foryou' && (
        <div className="mt-3 mb-1">
          <div className="bg-[#12141E] border border-[#292B39] rounded-xl p-3 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#F9C876] shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#F4F3FA]">Curated For You • Indian Regional Dubs</div>
              <div className="text-[11px] text-[#A1A5B5] mt-0.5">
                Tailored to your preferred Tamil, Telugu, Hindi & Malayalam anime dubs.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. POSTER-FIRST ANIME CATALOG GRID (Appears within first mobile viewport 390x844) */}
      <div ref={gridTopRef} className="pt-3 sm:pt-5">
        {/* Compact Grid Status Row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-[#A1A5B5]">
              {catalogStatus === 'error' || catalogStatus === 'offline' ? (
                <span className="text-[#F87171] font-semibold">
                  {catalogStatus === 'offline' ? 'Offline — unable to reach catalog' : 'Unable to load catalog'}
                </span>
              ) : paginationMeta.totalItems > 0 ? (
                <>
                  Showing <strong className="text-[#F4F3FA] font-bold tabular-nums">{rangeStart}–{rangeEnd}</strong> of{' '}
                  <strong className="text-[#F4F3FA] font-bold tabular-nums">{paginationMeta.totalItems}</strong> Titles
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
            <span className="text-[11px] text-[#A1A5B5] tabular-nums">
              Page {paginationMeta.currentPage} of {paginationMeta.totalPages}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <SkeletonGrid count={8} />
          </div>
        ) : catalogStatus === 'error' || catalogStatus === 'offline' ? (
          <div
            role="alert"
            data-testid="catalog-error-banner"
            className="p-6 sm:p-8 rounded-2xl bg-[#12141E] border border-[#F87171]/40 text-center space-y-3 max-w-xl mx-auto my-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F87171]/15 border border-[#F87171]/30 text-[#F87171] flex items-center justify-center mx-auto">
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
                onClick={() => fetchCatalogPage(currentPage)}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : displayedAnime.length === 0 ? (
          <div className="text-center py-12 bg-[#12141E] rounded-2xl border border-[#292B39] space-y-3">
            <p className="text-[#F4F3FA] text-sm font-semibold">No anime matches your selected filters.</p>
            <p className="text-[#A1A5B5] text-xs">Try clearing a language, platform, or search filter.</p>
            <div className="pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleClearAllFilters}
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        ) : (
          <div
            key={`catalog_grid_${paginationMeta.currentPage}_${selectedLanguage}_${selectedGenre}_${selectedPlatform}_${selectedType}_${selectedStatus}_${selectedSort}`}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4"
          >
            {displayedAnime.map((anime, idx) => {
              const isWatchlisted = watchlist.map(Number).includes(Number(anime.id));
              return (
                <AnimeCard
                  key={`catalog_anime_${anime.id}_${idx}`}
                  anime={anime}
                  index={idx}
                  priority={idx < 4}
                  onSelect={(a) => onSelectAnime(a as any)}
                  isBookmarked={isWatchlisted}
                  onToggleBookmark={onToggleWatchlist}
                  onToggleLike={handleLike}
                  onToggleUpvote={handleUpvote}
                />
              );
            })}
          </div>
        )}

        {/* Server-Side Pagination Controls (Next / Previous & Page Numbers) */}
        {paginationMeta.totalItems > 0 && (
          <nav
            aria-label="Catalog pagination"
            className="mt-8 pt-6 border-t border-[#292B39] flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            <div className="text-xs text-[#A1A5B5] flex items-center gap-2">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B49AF8]" />}
              <span>
                Page <strong className="text-[#F4F3FA]">{paginationMeta.currentPage}</strong> of{' '}
                <strong className="text-[#F4F3FA]">{paginationMeta.totalPages}</strong> ({paginationMeta.totalItems} titles)
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-full">
              <button
                type="button"
                onClick={() => handlePageChange(paginationMeta.currentPage - 1)}
                disabled={!paginationMeta.hasPrevPage || loading}
                aria-label="Previous page"
                className="min-h-[40px] inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/50 text-xs font-semibold text-[#F4F3FA] disabled:opacity-40 disabled:pointer-events-none transition-colors duration-150 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1">
                {visiblePageNumbers.map((pageItem, pIdx) =>
                  pageItem === 'ellipsis' ? (
                    <span
                      key={`ellipsis_${pIdx}`}
                      className="px-1.5 text-xs text-[#A1A5B5] select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={`page_btn_${pageItem}`}
                      type="button"
                      onClick={() => handlePageChange(pageItem)}
                      disabled={loading}
                      aria-label={`Page ${pageItem}`}
                      aria-current={pageItem === paginationMeta.currentPage ? 'page' : undefined}
                      className={`min-w-[38px] h-[38px] px-2 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer ${
                        pageItem === paginationMeta.currentPage
                          ? 'bg-[#B49AF8] text-[#0B0A10] border border-[#CBB6FF]'
                          : 'bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/50 text-[#A1A5B5] hover:text-[#F4F3FA]'
                      }`}
                    >
                      {pageItem}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(paginationMeta.currentPage + 1)}
                disabled={!paginationMeta.hasNextPage || loading}
                aria-label="Next page"
                className="min-h-[40px] inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/50 text-xs font-semibold text-[#F4F3FA] disabled:opacity-40 disabled:pointer-events-none transition-colors duration-150 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </nav>
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
            onSelectAnime(found as any);
          } else {
            onSelectAnime({ id: Number(animeId) } as any);
          }
        }}
      />

      {/* Recently Viewed Row (kept below catalog on Homepage so cards show above the fold) */}
      {recentlyViewed && recentlyViewed.length > 0 && (
        <div className="mt-8">
          <Suspense fallback={null}>
            <RecentlyViewedRow
              items={recentlyViewed}
              onSelectAnime={(a) => onSelectAnime(a as any)}
              onClear={onClearRecentlyViewed || (() => {})}
              onRemoveItem={onRemoveRecentlyViewedItem}
              watchlist={watchlist}
              onToggleWatchlist={onToggleWatchlist}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export const CatalogView = React.memo(CatalogViewComponent);
