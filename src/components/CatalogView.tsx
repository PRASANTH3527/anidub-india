import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { motion } from 'motion/react';
import { 
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Dices, 
  RefreshCw,
  Sparkles, 
  Loader2,
  Search,
  SlidersHorizontal,
  Star,
  CheckCircle2,
  Tv,
  WifiOff,
  X
} from 'lucide-react';
import { calculatePagination, filterAndSortCatalog, getVisiblePageNumbers } from '../utils/pagination';
import { AnimeCard } from './AnimeCard';
import { OttHubSection } from './OttHubSection';
import { LatestDubUpdatesCard } from './LatestDubUpdatesCard';
import { cloudflareApi, type CatalogMeta, type CatalogSummary } from '../services/cloudflareApi';
import { computeDynamicLanguageFilters } from '../utils/languages';
import {
  applySmartFilters,
  buildActiveFilterChips,
  EPISODE_LENGTH_OPTIONS,
  type EpisodeLengthBucket,
  type ActiveFilterChip,
} from '../utils/smartFilters';
import { SkeletonGrid } from './SkeletonGrid';
import { proxyUrl } from '../utils/imgbb';
import { translate, SupportedLanguage } from '../utils/i18n';

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
  'School', 'Mythology', 'Parody'
];
const PLATFORMS = [
  'All Platforms',
  'Crunchyroll',
  'Netflix',
  'JioCinema',
  'JioHotstar',
  'YouTube',
  'YouTube (Muse India)',
  'YouTube (Ani-One)',
  'Disney+ Hotstar',
  'Prime Video',
  'Anime Times',
  'Sony YAY!',
  'Sony LIV',
  'Bilibili',
  'Cartoon Network India',
  'ETV Bal Bharat',
  'Zee5'
];
const TYPES = ['All Types', 'TV Series', 'Movie', 'OVA', 'Special'];
const STATUSES = ['All Status', 'Airing', 'Completed', 'Upcoming'];
const SORTS = [
  { label: '🔥 Most Upvoted', value: 'popularity' },
  { label: '⭐ Highest Rated', value: 'rating' },
  { label: '📅 Newest Release', value: 'newest' },
  { label: '🔤 Title (A-Z)', value: 'title' }
];

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
  onOpenExplore,
  onOpenRecommendations,
  mode = 'home',
  feedView = 'library',
  recentlyViewed = [],
  onClearRecentlyViewed,
  onRemoveRecentlyViewedItem,
  uiLanguage = 'en',
  mySubscriptions = [],
  mySubscriptionsEnabled = false,
  onToggleSubscriptionPlatform,
  onToggleMySubscriptionsEnabled,
  onClearSubscriptions,
}) => {
  const isHomeMode = mode === 'home';
  const lang = uiLanguage || 'en';
  const [rawAnimeList, setRawAnimeList] = useState<Anime[]>(catalogList || []);
  const [internalSearch, setInternalSearch] = useState(searchQuery || '');

  // Keep internalSearch in sync with prop
  useEffect(() => {
    setInternalSearch(searchQuery || '');
  }, [searchQuery]);

  const effectiveSearch = setSearchQuery ? searchQuery : internalSearch;

  const handleSearchChange = (val: string) => {
    setInternalSearch(val);
    if (setSearchQuery) {
      setSearchQuery(val);
    }
  };
  
  // Sync rawAnimeList whenever catalogList prop updates from parent
  useEffect(() => {
    if (catalogList) {
      setRawAnimeList(catalogList);
    }
  }, [catalogList]);

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

  // Filter States
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All Genres');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedSort, setSelectedSort] = useState('popularity');
  const [episodeLength, setEpisodeLength] = useState<EpisodeLengthBucket>('any');
  const [minRating, setMinRating] = useState<number>(0);
  const [fullyDubbedOnly, setFullyDubbedOnly] = useState<boolean>(false);
  const [freeLegalOnly, setFreeLegalOnly] = useState<boolean>(false);
  const [isSmartFilterOpen, setIsSmartFilterOpen] = useState<boolean>(false);
  const [showMoreHomeLanguages, setShowMoreHomeLanguages] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'success' | 'empty' | 'error' | 'offline'>('loading');
  const [catalogError, setCatalogError] = useState<string | null>(null);

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
  const gridTopRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(effectiveSearch || '');
    }, 250);
    return () => clearTimeout(timer);
  }, [effectiveSearch]);

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
      });

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
      setLoading(false);
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

  const quickHomeLanguages = useMemo(() => {
    const primary = ['All', 'Tamil', 'Hindi', 'Telugu'];
    const mapByVal = new Map(dynamicLanguageFilters.map((f) => [f.value.toLowerCase(), f]));
    const primaryItems = primary.map((val) => {
      const found = mapByVal.get(val.toLowerCase());
      return found || { label: val === 'All' ? 'All' : val, value: val, count: 0 };
    });
    const extraItems = dynamicLanguageFilters.filter(
      (f) => !primary.some((p) => p.toLowerCase() === f.value.toLowerCase())
    );
    return { primaryItems, extraItems };
  }, [dynamicLanguageFilters]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 overflow-x-clip font-sans text-slate-100 pb-8 box-border">
      {/* 1. COMPACT SEARCH-FIRST HEADER (HOME vs EXPLORE) */}
      {isHomeMode ? (
        <header className="pt-4 sm:pt-6 pb-3 max-w-3xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight text-center line-clamp-2">
            {translate('hero.title', lang)}
          </h1>

          {/* Search Bar immediately below 2-line hero */}
          <div className="mt-3.5 relative flex items-center">
            <Search className="w-4 h-4 text-purple-400 absolute left-3.5 pointer-events-none shrink-0" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search anime, language, or OTT..."
              aria-label="Search dubbed anime"
              className="w-full h-11 sm:h-12 bg-[#131926] border border-white/15 hover:border-purple-500/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-xl pl-10 pr-10 text-sm text-white placeholder-neutral-500 outline-none transition-colors"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search query"
                className="absolute right-3 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Language Buttons: All, Tamil, Hindi, Telugu, More */}
          <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
            {quickHomeLanguages.primaryItems.map((item) => {
              const active = selectedLanguage.toLowerCase() === item.value.toLowerCase();
              return (
                <button
                  key={`home_lang_${item.value}`}
                  type="button"
                  onClick={() => setSelectedLanguage(item.value)}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-purple-600 text-white border border-purple-400/60'
                      : 'bg-[#131926] text-neutral-300 border border-white/10 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {item.value === 'All' ? 'All' : item.value}
                </button>
              );
            })}

            {quickHomeLanguages.extraItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMoreHomeLanguages((prev) => !prev)}
                aria-expanded={showMoreHomeLanguages}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap border ${
                  showMoreHomeLanguages ||
                  quickHomeLanguages.extraItems.some(
                    (f) => f.value.toLowerCase() === selectedLanguage.toLowerCase()
                  )
                    ? 'bg-purple-600/25 text-purple-200 border-purple-400/50'
                    : 'bg-[#131926] text-neutral-300 border-white/10 hover:border-white/25 hover:text-white'
                }`}
              >
                <span>More</span>
                {showMoreHomeLanguages ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {onOpenExplore && (
              <button
                type="button"
                onClick={onOpenExplore}
                className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
            )}
          </div>

          {showMoreHomeLanguages && quickHomeLanguages.extraItems.length > 0 && (
            <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
              {quickHomeLanguages.extraItems.map((item) => {
                const active = selectedLanguage.toLowerCase() === item.value.toLowerCase();
                return (
                  <button
                    key={`home_extra_lang_${item.value}`}
                    type="button"
                    onClick={() => setSelectedLanguage(item.value)}
                    className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-purple-600 text-white border border-purple-400/60'
                        : 'bg-[#131926] text-neutral-300 border border-white/10 hover:text-white'
                    }`}
                  >
                    {item.value}
                    {item.count > 0 ? ` (${item.count})` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </header>
      ) : (
        /* EXPLORE MODE: Full Catalog Header + Random Anime + OTT Coverage + Full Filters */
        <div className="pt-5 sm:pt-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Compass className="w-6 h-6 text-purple-400 shrink-0" />
                <span>Explore Dubbed Anime</span>
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Filter verified Indian anime dubs by language, OTT platform, genre, and status.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={onOpenRoulette}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-500 hover:to-purple-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Dices className="w-4 h-4 shrink-0" />
                <span>Random Anime</span>
              </button>
              {onOpenRecommendations && (
                <button
                  type="button"
                  onClick={onOpenRecommendations}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Find Your Next Anime</span>
                </button>
              )}
            </div>
          </div>

          {/* Dedicated Explore Search Box */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-purple-400 absolute left-3.5 pointer-events-none shrink-0" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search anime by title, synopsis, studio, genre..."
              className="w-full h-11 bg-[#131926] border border-white/15 hover:border-purple-500/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-xl pl-10 pr-10 text-sm text-white placeholder-neutral-500 outline-none transition-colors"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search query"
                className="absolute right-3 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Regional Dub Audio Filter Strip */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">
                Regional Dub Audio
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {dynamicLanguageFilters.map((langItem) => {
                const active =
                  selectedLanguage.toLowerCase() === langItem.value.toLowerCase() ||
                  (selectedLanguage === 'All' && langItem.value === 'All');
                return (
                  <button
                    key={langItem.value}
                    type="button"
                    onClick={() => setSelectedLanguage(langItem.value)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-purple-600 text-white border border-purple-400/60'
                        : 'bg-[#131926] border border-white/10 hover:border-white/25 text-neutral-300 hover:text-white'
                    }`}
                  >
                    <span>{langItem.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                        active ? 'bg-black/30 text-white' : 'bg-black/40 text-neutral-400'
                      }`}
                    >
                      {langItem.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* OTT Intelligence Hub & Subscription Coverage Calculator */}
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

      {/* 4. FILTER & SORT DROPDOWNS GRID (Shown in Explore mode, or hidden cleanly on Homepage) */}
      {!isHomeMode && (
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        
        {/* Render Dropdowns */}
        {[
          { label: 'GENRE', val: selectedGenre, set: setSelectedGenre, opts: GENRES },
          { label: 'PLATFORM', val: selectedPlatform, set: setSelectedPlatform, opts: PLATFORMS },
          { label: 'TYPE', val: selectedType, set: setSelectedType, opts: TYPES },
          { label: 'STATUS', val: selectedStatus, set: setSelectedStatus, opts: STATUSES }
        ].map((item) => (
          <div 
            key={`catalog_filter_${item.label}`} 
            className="relative min-w-0 overflow-hidden flex items-center justify-between bg-[#1A1C29]/80 border border-gray-700/50 hover:border-purple-500/40 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors duration-200"
          >
            <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider shrink-0 pr-1">
              {item.label}
            </span>
            <div className="relative flex items-center min-w-0 flex-1 justify-end">
              <select
                value={item.val}
                onChange={(e) => item.set(e.target.value)}
                aria-label={`Filter by ${item.label.toLowerCase()}`}
                className="bg-transparent text-white text-xs sm:text-sm font-medium outline-none cursor-pointer text-right appearance-none w-full min-w-0 text-ellipsis pr-5 truncate"
              >
                {item.opts.map(o => <option key={o} value={o} className="bg-[#1A1C29] text-white">{o}</option>)}
              </select>
              <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-gray-400 pointer-events-none shrink-0" />
            </div>
          </div>
        ))}
        
        {/* Sort (Half width or grid item) */}
        <div className="relative min-w-0 overflow-hidden col-span-2 sm:col-span-1 flex items-center justify-between bg-[#1A1C29]/80 border border-gray-700/50 hover:border-purple-500/40 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors duration-200">
          <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider shrink-0 pr-1">
            SORT
          </span>
          <div className="relative flex items-center min-w-0 flex-1 justify-end">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              aria-label="Sort catalog"
              className="bg-transparent text-white text-xs sm:text-sm font-medium outline-none cursor-pointer text-right appearance-none w-full min-w-0 text-ellipsis pr-5 truncate"
            >
              {SORTS.map(s => <option key={s.value} value={s.value} className="bg-[#1A1C29] text-white">{s.label}</option>)}
            </select>
            <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-gray-400 pointer-events-none shrink-0" />
          </div>
        </div>
      </div>
      )}

      {/* 4.5 ADVANCED SMART FILTER ENGINE (Explore mode only) */}
      {!isHomeMode && (
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsSmartFilterOpen((prev) => !prev)}
            aria-expanded={isSmartFilterOpen}
            aria-label="Toggle Smart Filters"
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-2 ${
              isSmartFilterOpen || episodeLength !== 'any' || minRating > 0 || fullyDubbedOnly || freeLegalOnly
                ? 'bg-purple-600/25 border-purple-400/60 text-white'
                : 'bg-[#141b29] border-[#242d46] text-slate-300 hover:text-white hover:border-purple-500/40'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            <span>Smart Filters</span>
            {(episodeLength !== 'any' || minRating > 0 || fullyDubbedOnly || freeLegalOnly) && (
              <span className="px-1.5 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-black">
                {[episodeLength !== 'any', minRating > 0, fullyDubbedOnly, freeLegalOnly].filter(Boolean).length}
              </span>
            )}
            {isSmartFilterOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Quick Inline Toggles always reachable */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFullyDubbedOnly((prev) => !prev)}
              aria-pressed={fullyDubbedOnly}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                fullyDubbedOnly
                  ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-200'
                  : 'bg-[#141b29] border-[#242d46] text-slate-300 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Fully Dubbed Only</span>
            </button>

            <button
              type="button"
              onClick={() => setFreeLegalOnly((prev) => !prev)}
              aria-pressed={freeLegalOnly}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                freeLegalOnly
                  ? 'bg-cyan-600/25 border-cyan-400/60 text-cyan-200'
                  : 'bg-[#141b29] border-[#242d46] text-slate-300 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Free Legal Streaming Only</span>
            </button>
          </div>
        </div>

        {/* Expandable Smart Filter Drawer */}
        {isSmartFilterOpen && (
          <div
            data-testid="smart-filter-drawer"
            className="rounded-2xl bg-[#131926]/95 border border-[#242d46] p-4 grid grid-cols-1 md:grid-cols-2 gap-4 shadow-xl"
          >
            {/* Episode Length Buckets */}
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
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
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-purple-600/30 border-purple-400/70 text-white'
                          : 'bg-[#0e1422] border-[#222b42] text-slate-300 hover:text-white hover:border-slate-600'
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
                  className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"
                >
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Minimum Catalog Score</span>
                </label>
                <span className="text-xs font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
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
                className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                <span>0</span>
                <span>5.0</span>
                <span>7.5</span>
                <span>10</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips & Clear All */}
        {activeFilterChips.length > 0 && (
          <div
            data-testid="active-filter-chips"
            className="flex flex-wrap items-center gap-1.5 pt-0.5"
          >
            <span className="text-[11px] font-bold text-slate-400 mr-1">
              {paginationMeta.totalItems} {paginationMeta.totalItems === 1 ? 'match' : 'matches'}:
            </span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleRemoveChip(chip)}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-[11px] font-bold text-purple-200 hover:bg-purple-500/25 hover:text-white transition-colors cursor-pointer"
              >
                <span>{chip.label}</span>
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/35 text-[11px] font-bold text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* 6. FOR YOU METADATA BANNER */}
      {feedView === 'foryou' && (
        <div className="px-0.5 sm:px-2 md:px-0 mt-6 mb-2">
          <div className="bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-white">Curated For You • Indian Regional Dubs</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                Handpicked based on your preferences in Tamil, Telugu, Hindi & Malayalam anime dubs.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Catalog List Grid with Server-Side Pagination */}
      <div ref={gridTopRef} className={`${isHomeMode ? 'pt-3 sm:pt-4' : 'pt-6 sm:pt-8'}`}>
        {/* 1. GRID HEADER ROW */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-neutral-400">
              {catalogStatus === 'error' || catalogStatus === 'offline' ? (
                <span className="text-rose-300 font-semibold">
                  {catalogStatus === 'offline' ? 'Offline — unable to reach catalog' : 'Unable to load catalog'}
                </span>
              ) : paginationMeta.totalItems > 0 ? (
                <>
                  Showing <strong className="text-white font-bold tabular-nums">{rangeStart}–{rangeEnd}</strong> of{' '}
                  <strong className="text-white font-bold tabular-nums">{paginationMeta.totalItems}</strong> Titles
                </>
              ) : loading ? (
                <span>Loading catalog...</span>
              ) : (
                <>
                  Showing <strong className="text-white font-bold tabular-nums">0</strong> Titles
                </>
              )}
            </span>
          </div>
          {catalogStatus !== 'error' && catalogStatus !== 'offline' && (
            <span className="text-[11px] text-neutral-500 tabular-nums">
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
            className="p-6 sm:p-8 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-center space-y-3 max-w-xl mx-auto my-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center justify-center mx-auto">
              {catalogStatus === 'offline' ? (
                <WifiOff className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-base font-bold text-white">
              {catalogStatus === 'offline' ? 'You are currently offline' : 'Failed to load anime catalog'}
            </h3>
            <p className="text-xs text-rose-200/85 max-w-md mx-auto leading-relaxed">
              {catalogError || 'The catalog service could not be reached. Please check your connection and retry.'}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => fetchCatalogPage(currentPage)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : displayedAnime.length === 0 ? (
          <div className="text-center py-14 bg-[#101522] rounded-2xl border border-white/10 space-y-3">
            <p className="text-neutral-300 text-sm font-semibold">No anime matches your selected filters.</p>
            <p className="text-neutral-500 text-xs">Try clearing a language, platform, or search filter.</p>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="mt-2 min-h-[40px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
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
            className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            <div className="text-xs text-slate-400 flex items-center gap-2">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
              <span>
                Page <strong className="text-white">{paginationMeta.currentPage}</strong> of{' '}
                <strong className="text-white">{paginationMeta.totalPages}</strong> ({paginationMeta.totalItems} titles)
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-full">
              <button
                type="button"
                onClick={() => handlePageChange(paginationMeta.currentPage - 1)}
                disabled={!paginationMeta.hasPrevPage || loading}
                aria-label="Previous page"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#141b29] border border-[#242d46] hover:border-purple-500/50 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1">
                {visiblePageNumbers.map((pageItem, pIdx) =>
                  pageItem === 'ellipsis' ? (
                    <span
                      key={`ellipsis_${pIdx}`}
                      className="px-1.5 text-xs text-slate-500 select-none"
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
                      className={`min-w-[34px] h-[34px] px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        pageItem === paginationMeta.currentPage
                          ? 'bg-gradient-to-r from-[#9333ea] to-[#6366f1] text-white shadow-[0_3px_12px_rgba(147,51,234,0.35)] border border-purple-400/50'
                          : 'bg-[#141b29] border border-[#242d46] hover:border-purple-500/40 text-slate-300 hover:text-white'
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
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#141b29] border border-[#242d46] hover:border-purple-500/50 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* P2 #2: Compact Latest Dub Updates Feed (below catalog so above-the-fold stays search-first) */}
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
