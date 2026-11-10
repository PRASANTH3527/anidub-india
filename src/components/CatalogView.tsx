import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Star, 
  Tv, 
  ChevronDown,
  Bookmark, 
  Dices, 
  Layers, 
  Languages, 
  Flame, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  Heart,
  Loader2,
  Search,
  X
} from 'lucide-react';
import { filterAndSortCatalog } from '../utils/pagination';
import { AnimeCard, AnimeCardData } from './AnimeCard';
import { RecentlyViewedRow } from './RecentlyViewedRow';
import { AnimatedStats } from './AnimatedStats';
import { cloudflareApi } from '../services/cloudflareApi';
import { calculateCatalogStats, computeDynamicLanguageFilters } from '../utils/languages';
import { SkeletonGrid } from './SkeletonGrid';
import { proxyUrl } from '../utils/imgbb';
import { translate, SupportedLanguage } from '../utils/i18n';

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
  onSelectAnime: (anime: Anime) => void;
  searchQuery: string;
  setSearchQuery?: (query: string) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onToggleLike?: (animeId: number, liked: boolean, count: number) => void;
  onToggleUpvote?: (animeId: number, upvoted: boolean, count: number) => void;
  onOpenRoulette: () => void;
  onOpenCollection: () => void;
  feedView?: string;
  recentlyViewed?: any[];
  onClearRecentlyViewed?: () => void;
  onRemoveRecentlyViewedItem?: (id: number) => void;
  uiLanguage?: SupportedLanguage;
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
  onSelectAnime,
  searchQuery,
  setSearchQuery,
  watchlist,
  onToggleWatchlist,
  onToggleLike,
  onToggleUpvote,
  onOpenRoulette,
  onOpenCollection,
  feedView = 'library',
  recentlyViewed = [],
  onClearRecentlyViewed,
  onRemoveRecentlyViewedItem,
  uiLanguage = 'en'
}) => {
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

  // Filter States
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All Genres');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedSort, setSelectedSort] = useState('popularity');
  const [loading, setLoading] = useState(false);

  // Infinite Scroll States
  const [visibleCount, setVisibleCount] = useState(8);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const fetchCatalogFromBackend = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await cloudflareApi.fetchCatalog({ limit: 5000 });
      if (data && data.length > 0) {
        // Strictly filter out and hide any anime where status === 'pending' or submissionStatus === 'pending'
        const approvedOnly = data.filter((item: any) => 
          item.status !== 'pending' && 
          item.submissionStatus !== 'pending'
        );
        const normalized = approvedOnly.map((item: any) => ({
          ...item,
          cover_image: proxyUrl(item.cover_image),
          banner_image: proxyUrl(item.banner_image),
          languages: item.languages || '',
          platform: item.platform || 'Crunchyroll',
          type: item.type || 'TV Series'
        }));
        setRawAnimeList(normalized);
      } else {
        setRawAnimeList([]);
      }
    } catch (err) {
      console.warn('Failed fetching catalog from Cloudflare:', err);
      setRawAnimeList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogFromBackend();
  }, [fetchCatalogFromBackend]);

  const currentAnimeList = useMemo(() => {
    return (catalogList && catalogList.length > 0) ? catalogList : rawAnimeList;
  }, [catalogList, rawAnimeList]);

  const filteredList = useMemo(() => {
    return filterAndSortCatalog(currentAnimeList, {
      language: selectedLanguage,
      genre: selectedGenre === 'All Genres' ? 'All' : selectedGenre,
      platform: selectedPlatform === 'All Platforms' ? 'All' : selectedPlatform,
      type: selectedType === 'All Types' ? 'All' : selectedType,
      status: selectedStatus === 'All Status' ? 'All' : selectedStatus,
      search: effectiveSearch,
      sort: selectedSort
    });
  }, [currentAnimeList, selectedLanguage, selectedGenre, selectedPlatform, selectedType, selectedStatus, effectiveSearch, selectedSort]);

  // Reset visibleCount on filter or search change
  useEffect(() => {
    setVisibleCount(8);
  }, [selectedLanguage, selectedGenre, selectedPlatform, selectedType, selectedStatus, selectedSort, effectiveSearch]);

  // IntersectionObserver for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && visibleCount < filteredList.length && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + 8, filteredList.length));
            setIsLoadingMore(false);
          }, 400);
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [visibleCount, filteredList.length, isLoadingMore]);

  const displayedAnime = useMemo(() => {
    return filteredList.slice(0, visibleCount);
  }, [filteredList, visibleCount]);

  // Compute dynamic regional dub language filter buttons directly from database animeList
  const dynamicLanguageFilters = useMemo(() => {
    return computeDynamicLanguageFilters(rawAnimeList);
  }, [rawAnimeList]);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 overflow-x-hidden font-['Inter',sans-serif] text-slate-100 pb-10 box-border">
      
      {/* 1. HERO SECTION */}
      <div className="text-center pt-6 sm:pt-8 px-2 sm:px-4 max-w-3xl mx-auto">
        
        {/* Top Badge Pill */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-200 text-[11px] font-medium shadow-sm mb-5 sm:mb-6">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>Official Indian Dubbed Anime Directory</span>
        </div>

        <h1 className="text-xl sm:text-3xl font-extrabold text-[#FF4500] mb-2 tracking-wide uppercase">
          ANIDUB INDIA OFFICIAL WEBSITE
        </h1>
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#FF4500]">
            {translate('hero.title', lang)}
          </span>
        </h2>

        {/* Hero Subtitle */}
        <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed max-w-xl mx-auto mb-6 sm:mb-8">
          {translate('hero.subtitle', lang)}
        </p>

        {/* Action Buttons */}
        <div className="max-w-md mx-auto w-full space-y-3">
          {/* CTA Button 1: Surprise Me Roulette */}
          <button
            onClick={onOpenRoulette}
            className="w-full flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#f59e0b] via-[#ea580c] to-[#9333ea] px-5 py-3.5 shadow-[0_6px_25px_rgba(234,88,12,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Dices className="w-5 h-5 text-white" />
            <span className="text-[15px] font-extrabold text-white">{translate('surpriseMe', lang)}</span>
            <span className="bg-black/30 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white inline-flex items-center gap-1 shrink-0">
              🎲 {translate('randomPick', lang)}
            </span>
          </button>

          {/* CTA Button 2: Create Collection */}
          <button
            onClick={onOpenCollection}
            className="w-full bg-[#111524] border border-[#262d47] hover:border-purple-500/40 rounded-full px-5 py-2.5 inline-flex items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-white" />
              <span className="text-[13px] font-bold text-white">{translate('createCollection', lang)}</span>
            </div>
            <span className="bg-[#1e1436] border border-[#7e22ce] text-[#c084fc] text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full tracking-wide">
              SHAREABLE
            </span>
          </button>
        </div>
      </div>

      {/* 2. ANIMATED STATS CARDS ROW (DYNAMIC REAL STATS) */}
      <div className="mt-8">
        {(() => {
          const stats = calculateCatalogStats(currentAnimeList);

          return (
            <AnimatedStats
              animeList={currentAnimeList}
              totalAnime={stats.totalAnime}
              totalVotes={stats.totalVotes}
              totalLanguages={stats.totalLanguages}
              languagesList={stats.languagesList}
              languagesString={stats.languagesString}
            />
          );
        })()}
      </div>

      {/* 2.5 RECENTLY VIEWED ROW */}
      {recentlyViewed && recentlyViewed.length > 0 && (
        <div className="mt-2 px-1">
          <RecentlyViewedRow
            items={recentlyViewed}
            onSelectAnime={(a) => onSelectAnime(a as any)}
            onClear={onClearRecentlyViewed || (() => {})}
            onRemoveItem={onRemoveRecentlyViewedItem}
            watchlist={watchlist}
            onToggleWatchlist={onToggleWatchlist}
          />
        </div>
      )}

      {/* 2.8 DEDICATED ANIME SEARCH BOX */}
      <div className="px-0.5 sm:px-2 md:px-0 mt-6">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-purple-400 absolute left-3.5 pointer-events-none shrink-0" />
          <input
            type="text"
            value={effectiveSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search anime by title, voice actor, studio, genre..."
            className="w-full bg-[#131926]/90 border border-neutral-700/80 hover:border-purple-500/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-2xl pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all shadow-md shadow-black/40"
          />
          {effectiveSearch && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {effectiveSearch && (
          <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 pt-1.5 font-mono">
            <span>Filtering for: "{effectiveSearch}"</span>
            <span className="text-purple-300 font-bold">{filteredList.length} matching titles</span>
          </div>
        )}
      </div>

      {/* 3. REGIONAL DUB AUDIO FILTER PILLS */}
      <div className="px-0.5 sm:px-2 md:px-0 mt-6">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-[#a855f7]" />
          <span className="text-[11px] font-extrabold uppercase text-[#94a3b8] tracking-wider">
            REGIONAL DUB AUDIO
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 pt-0.5">
          {dynamicLanguageFilters.map((lang) => {
            const active = selectedLanguage.toLowerCase() === lang.value.toLowerCase() || (selectedLanguage === 'All' && lang.value === 'All');
            return (
              <button
                key={lang.value}
                onClick={() => setSelectedLanguage(lang.value)}
                className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[12px] font-bold shrink-0 transition-all duration-300 cursor-pointer active:scale-95 hover:scale-105 ${
                  active
                    ? 'bg-gradient-to-r from-[#9333ea] to-[#6366f1] text-white shadow-[0_3px_12px_rgba(147,51,234,0.4)] ring-1 ring-purple-400/50'
                    : 'bg-[#141b29] border border-[#20273c] hover:border-neutral-700 text-[#cbd5e1] hover:text-white'
                }`}
              >
                <span>{lang.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${active ? 'bg-black/35 text-white' : 'bg-[#0a0d16] text-[#94a3b8]'}`}>
                  {lang.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. FILTER & SORT DROPDOWNS GRID */}
      <div className="px-0.5 sm:px-2 md:px-0 mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        
        {/* Render Dropdowns */}
        {[
          { label: 'GENRE', val: selectedGenre, set: setSelectedGenre, opts: GENRES },
          { label: 'PLATFORM', val: selectedPlatform, set: setSelectedPlatform, opts: PLATFORMS },
          { label: 'TYPE', val: selectedType, set: setSelectedType, opts: TYPES },
          { label: 'STATUS', val: selectedStatus, set: setSelectedStatus, opts: STATUSES }
        ].map((item) => (
          <div 
            key={`catalog_filter_${item.label}`} 
            className="relative flex items-center justify-between bg-[#1A1C29]/80 border border-gray-700/50 hover:border-purple-500/40 rounded-xl px-3 py-1.5 sm:py-2 transition-colors duration-200"
          >
            <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider shrink-0 pr-1">
              {item.label}
            </span>
            <div className="relative flex items-center min-w-0 flex-1 justify-end">
              <select
                value={item.val}
                onChange={(e) => item.set(e.target.value)}
                className="bg-transparent text-white text-xs sm:text-sm font-medium outline-none cursor-pointer text-right appearance-none w-full min-w-0 text-ellipsis pr-5 truncate"
              >
                {item.opts.map(o => <option key={o} value={o} className="bg-[#1A1C29] text-white">{o}</option>)}
              </select>
              <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-gray-400 pointer-events-none shrink-0" />
            </div>
          </div>
        ))}
        
        {/* Sort (Half width or grid item) */}
        <div className="relative flex items-center justify-between bg-[#1A1C29]/80 border border-gray-700/50 hover:border-purple-500/40 rounded-xl px-3 py-1.5 sm:py-2 transition-colors duration-200">
          <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider shrink-0 pr-1">
            SORT
          </span>
          <div className="relative flex items-center min-w-0 flex-1 justify-end">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="bg-transparent text-white text-xs sm:text-sm font-medium outline-none cursor-pointer text-right appearance-none w-full min-w-0 text-ellipsis pr-5 truncate"
            >
              {SORTS.map(s => <option key={s.value} value={s.value} className="bg-[#1A1C29] text-white">{s.label}</option>)}
            </select>
            <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-gray-400 pointer-events-none shrink-0" />
          </div>
        </div>
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

      {/* 7. Catalog List Grid with exact matching design */}
      <div className="pt-6 sm:pt-8 px-0.5 sm:px-2 md:px-0">
        
        {/* 1. GRID HEADER ROW */}
        <div className="flex items-center justify-between mb-4 px-0.5">
          <div className="flex items-center space-x-1.5 text-[12px]">
            <Sparkles className="w-[14px] h-[14px] text-[#a855f7]" />
            <span className="text-[#94a3b8]">Showing <strong className="text-white font-bold">{filteredList.length}</strong> Titles</span>
          </div>
          <span className="text-[11px] text-[#64748b]">Smooth 60fps Virtualized</span>
        </div>

        {loading ? (
          <div className="space-y-4">
            <SkeletonGrid count={8} />
          </div>
        ) : displayedAnime.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
            <p className="text-slate-400 text-xs">No anime matches your selected filters.</p>
            <button
              onClick={() => {
                setSelectedLanguage('All');
                setSelectedGenre('All Genres');
                setSelectedPlatform('All Platforms');
                setSelectedType('All Types');
                setSelectedStatus('All Status');
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-md"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          /* 2. CARD CONTAINER USING AnimeCard WITH RESPONSIVE COLUMNS & COMPACT MOBILE GAPS */
          <motion.div 
            key={`catalog_grid_${selectedLanguage}_${selectedGenre}_${selectedPlatform}_${selectedType}_${selectedStatus}_${selectedSort}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1.0] }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5 md:gap-4.5"
          >
            {displayedAnime.map((anime, idx) => {
              const isWatchlisted = watchlist.map(Number).includes(Number(anime.id));
              return (
                <AnimeCard
                  key={`catalog_anime_${anime.id}_${idx}`}
                  anime={anime}
                  index={idx}
                  onSelect={(a) => onSelectAnime(a as any)}
                  isBookmarked={isWatchlisted}
                  onToggleBookmark={onToggleWatchlist}
                  onToggleLike={handleLike}
                  onToggleUpvote={handleUpvote}
                />
              );
            })}
          </motion.div>
        )}

        {/* Intersection Observer Sentinel & Loading Spinner */}
        <div ref={sentinelRef} className="py-8 flex items-center justify-center">
          {isLoadingMore && (
            <div className="flex items-center space-x-2 text-purple-400 text-xs font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading more anime titles...</span>
            </div>
          )}
          {visibleCount >= filteredList.length && filteredList.length > 0 && (
            <span className="text-slate-500 text-[11px]">You've reached the end of the catalog 🎉</span>
          )}
        </div>
      </div>

    </div>
  );
};

export const CatalogView = React.memo(CatalogViewComponent);
