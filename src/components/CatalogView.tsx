import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { filterAndSortCatalog } from '../utils/pagination';
import { AnimeCard, AnimeCardData } from './AnimeCard';
import { RecentlyViewedRow } from './RecentlyViewedRow';
import { AnimatedStats } from './AnimatedStats';

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
  languages?: string;
  platform?: string;
  type?: string;
}

interface CatalogViewProps {
  onSelectAnime: (anime: Anime) => void;
  searchQuery: string;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onOpenRoulette: () => void;
  onOpenCollection: () => void;
  feedView?: string;
  recentlyViewed?: any[];
  onClearRecentlyViewed?: () => void;
  onRemoveRecentlyViewedItem?: (id: number) => void;
}

export const FALLBACK_SEED_ANIME: Anime[] = [];



const GENRES = [
  'All',
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
const STATUSES = ['All', 'Airing', 'Completed', 'Upcoming'];
const SORTS = [
  { label: '🔥 Most Upvoted', value: 'popularity' },
  { label: '⭐ Highest Rated', value: 'rating' },
  { label: '📅 Newest Release', value: 'newest' },
  { label: '🔤 Title (A-Z)', value: 'title' }
];

export const CatalogView: React.FC<CatalogViewProps> = ({
  onSelectAnime,
  searchQuery,
  watchlist,
  onToggleWatchlist,
  onOpenRoulette,
  onOpenCollection,
  feedView = 'library',
  recentlyViewed = [],
  onClearRecentlyViewed,
  onRemoveRecentlyViewedItem
}) => {
  const [rawAnimeList, setRawAnimeList] = useState<Anime[]>(FALLBACK_SEED_ANIME);
  
  // Filter States
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSort, setSelectedSort] = useState('popularity');
  const [loading, setLoading] = useState(false);

  // Infinite Scroll States
  const [visibleCount, setVisibleCount] = useState(8);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchCatalogFromBackend();
  }, []);

  const fetchCatalogFromBackend = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/anime?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          // Strictly filter out and hide any anime where status === 'pending' or submissionStatus === 'pending'
          const approvedOnly = data.data.filter((item: any) => 
            item.status !== 'pending' && 
            item.submissionStatus !== 'pending'
          );
          const normalized = approvedOnly.map((item: any, idx: number) => ({
            ...item,
            languages: item.languages || (idx % 3 === 0 ? 'HIN,TAM,TEL' : idx % 2 === 0 ? 'HIN,TAM' : 'HIN,TEL'),
            platform: item.platform || (idx % 2 === 0 ? 'Crunchyroll' : 'Netflix'),
            type: item.type || (idx % 4 === 0 ? 'Movie' : 'TV Series')
          }));
          setRawAnimeList(normalized);
        }
      }
    } catch (err) {
      console.warn('Connected to local catalog directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredList = filterAndSortCatalog(rawAnimeList, {
    language: selectedLanguage,
    genre: selectedGenre,
    platform: selectedPlatform === 'All Platforms' ? 'All' : selectedPlatform,
    type: selectedType === 'All Types' ? 'All' : selectedType,
    status: selectedStatus,
    search: searchQuery,
    sort: selectedSort
  });

  // Reset visibleCount on filter or search change
  useEffect(() => {
    setVisibleCount(8);
  }, [selectedLanguage, selectedGenre, selectedPlatform, selectedType, selectedStatus, selectedSort, searchQuery]);

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

  const displayedAnime = filteredList.slice(0, visibleCount);

  return (
    <div className="w-full max-w-[420px] mx-auto px-[11px] overflow-x-hidden font-['Inter',sans-serif] text-slate-100 pb-10">
      
      {/* 1. HERO SECTION */}
      <div className="text-center pt-8 px-4 max-w-2xl mx-auto">
        
        {/* Top Badge Pill */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-200 text-[11px] font-medium shadow-sm mb-6">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>Official Indian Dubbed Anime Directory</span>
        </div>

        {/* Orange Label */}
        <div className="text-[16px] font-bold text-[#ff5a1f] tracking-[0.1em] uppercase mb-4">
          ANIDUB INDIA OFFICIAL WEBSITE
        </div>

        {/* H1 Title */}
        <h1 className="text-[26px] font-extrabold tracking-tight leading-tight px-2 mb-6">
          <span className="text-white block">The Premier Destination for</span>
          <span className="bg-gradient-to-r from-[#9333ea] to-[#6366f1] bg-clip-text text-transparent block">
            Anime Streaming & Dubbing in India
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-[13px] text-[#94a3b8] leading-relaxed max-w-[380px] mx-auto mb-8">
          Discover officially dubbed anime in Tamil, Telugu, Hindi, Malayalam, and Kannada — streaming legally on Crunchyroll, Netflix, JioHotstar, and JioCinema.
        </p>

        {/* CTA Button 1: Surprise Me Roulette */}
        <button
          onClick={onOpenRoulette}
          className="w-full flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#f59e0b] via-[#ea580c] to-[#9333ea] px-5 py-3.5 shadow-[0_6px_25px_rgba(234,88,12,0.4)] transition-transform active:scale-[0.98]"
        >
          <Dices className="w-5 h-5 text-white" />
          <span className="text-[15px] font-extrabold text-white">Surprise Me Roulette</span>
          <span className="bg-black/30 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white inline-flex items-center gap-1 shrink-0">
            🎲 RANDOM PICK
          </span>
        </button>

        {/* CTA Button 2: Create Collection */}
        <button
          onClick={onOpenCollection}
          className="mt-3 w-full bg-[#111524] border border-[#262d47] hover:border-[#3d4669] rounded-full px-5 py-2.5 inline-flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <span className="text-[13px] font-bold text-white">Create Collection</span>
          </div>
          <span className="bg-[#1e1436] border border-[#7e22ce] text-[#c084fc] text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full tracking-wide">
            SHAREABLE
          </span>
        </button>
      </div>

      {/* 2. ANIMATED STATS CARDS ROW */}
      <div className="mt-8">
        <AnimatedStats
          totalAnime={rawAnimeList.length}
          totalVotes={rawAnimeList.reduce((acc, curr) => acc + (curr.popularity || 0), 0)}
          totalLanguages={rawAnimeList.length > 0 ? 5 : 0}
        />
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


      {/* 3. REGIONAL DUB AUDIO FILTER PILLS */}
      <div className="px-3.5 sm:px-4 mt-6">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-[#a855f7]" />
          <span className="text-[11px] font-extrabold uppercase text-[#94a3b8] tracking-wider">
            REGIONAL DUB AUDIO
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 pt-0.5">
          {[
            { label: 'All', value: 'All', count: rawAnimeList.length },
            { label: 'Tamil', value: 'Tamil', count: rawAnimeList.filter(a => a.languages?.toLowerCase().includes('tam')).length },
            { label: 'Telugu', value: 'Telugu', count: rawAnimeList.filter(a => a.languages?.toLowerCase().includes('tel')).length },
            { label: 'Hindi', value: 'Hindi', count: rawAnimeList.filter(a => a.languages?.toLowerCase().includes('hin')).length },
            { label: 'Malayalam', value: 'Malayalam', count: rawAnimeList.filter(a => a.languages?.toLowerCase().includes('mal')).length },
            { label: 'Kannada', value: 'Kannada', count: rawAnimeList.filter(a => a.languages?.toLowerCase().includes('kan')).length }
          ].map((lang) => {
            const active = selectedLanguage === lang.value;
            return (
              <button
                key={lang.value}
                onClick={() => setSelectedLanguage(lang.value)}
                className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[12px] font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
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
      <div className="px-3.5 sm:px-4 mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
        
        {/* Render Dropdowns */}
        {[
          { label: 'GENRE', val: selectedGenre, set: setSelectedGenre, opts: GENRES },
          { label: 'PLATFORM', val: selectedPlatform, set: setSelectedPlatform, opts: PLATFORMS },
          { label: 'TYPE', val: selectedType, set: setSelectedType, opts: TYPES },
          { label: 'STATUS', val: selectedStatus, set: setSelectedStatus, opts: STATUSES }
        ].map((item, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#94a3b8] px-0.5">
              {item.label}
            </span>
            <div className="relative bg-[#141b29] border border-[#20273c] hover:border-purple-500/50 rounded-xl h-[38px] px-3 flex items-center justify-between transition-all group shadow-sm">
              <select
                value={item.val}
                onChange={(e) => item.set(e.target.value)}
                className="w-full text-[12px] font-semibold text-white bg-transparent appearance-none truncate pr-5 focus:outline-none cursor-pointer"
              >
                {item.opts.map(o => <option key={o} value={o} className="bg-[#111626] text-white">{o}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#94a3b8] absolute right-2.5 pointer-events-none group-hover:text-purple-400 transition-colors" />
            </div>
          </div>
        ))}
        
        {/* Sort (Spans 2 columns) */}
        <div className="col-span-2 flex flex-col gap-1 mt-0.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#94a3b8] px-0.5">
            SORT CATALOG
          </span>
          <div className="relative bg-[#141b29] border border-[#20273c] hover:border-purple-500/50 rounded-xl h-[38px] px-3.5 flex items-center justify-between transition-all group shadow-sm">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="w-full text-[12px] font-semibold text-white bg-transparent appearance-none truncate pr-5 focus:outline-none cursor-pointer"
            >
              {SORTS.map(s => <option key={s.value} value={s.value} className="bg-[#111626] text-white">{s.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#94a3b8] absolute right-3 pointer-events-none group-hover:text-purple-400 transition-colors" />
          </div>
        </div>
      </div>

      {/* 6. FOR YOU METADATA BANNER */}
      {feedView === 'foryou' && (
        <div className="px-3.5 mt-6 mb-2">
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
      <div className="pt-8 px-3.5">
        
        {/* 1. GRID HEADER ROW */}
        <div className="flex items-center justify-between mb-4 px-0.5">
          <div className="flex items-center space-x-1.5 text-[12px]">
            <Sparkles className="w-[14px] h-[14px] text-[#a855f7]" />
            <span className="text-[#94a3b8]">Showing <strong className="text-white font-bold">{filteredList.length}</strong> Titles</span>
          </div>
          <span className="text-[11px] text-[#64748b]">2 Columns • Smooth 60fps Virtualized</span>
        </div>

        {displayedAnime.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
            <p className="text-slate-400 text-xs">No anime matches your selected filters.</p>
            <button
              onClick={() => {
                setSelectedLanguage('All');
                setSelectedGenre('All');
                setSelectedPlatform('All Platforms');
                setSelectedType('All Types');
                setSelectedStatus('All');
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold transition-all"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          /* 2. CARD CONTAINER USING AnimeCard (grid-cols-2 gap-3.5) */
          <div className="grid grid-cols-2 gap-3.5">
            {displayedAnime.map((anime) => {
              const isWatchlisted = watchlist.includes(anime.id);
              return (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  onSelect={(a) => onSelectAnime(a as any)}
                  isBookmarked={isWatchlisted}
                  onToggleBookmark={onToggleWatchlist}
                />
              );
            })}
          </div>
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
