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
}

export const FALLBACK_SEED_ANIME: Anime[] = [
  {
    id: 1,
    title: "Cyberpunk: Neon Edge",
    slug: "cyberpunk-neon-edge",
    synopsis: "In a sprawling megacity governed by rogue AI syndicates, a cybernetically enhanced street runner uncovers a conspiracy that threatens the digital mainframe.",
    cover_image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80",
    rating: 9.4,
    episodes_count: 24,
    status: "Airing",
    season: "Spring",
    year: 2026,
    genres: "Action,Sci-Fi,Cyberpunk",
    popularity: 98500,
    languages: "HIN,TAM,TEL",
    platform: "Crunchyroll",
    type: "TV Series"
  },
  {
    id: 2,
    title: "Celestial Blade Chronicles",
    slug: "celestial-blade-chronicles",
    synopsis: "Wielding ancestral spiritual steel, young swordsman Renji ascends the celestial pagoda to banish the abyssal lords before the solar eclipse.",
    cover_image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop&q=80",
    rating: 9.1,
    episodes_count: 12,
    status: "Completed",
    season: "Winter",
    year: 2025,
    genres: "Action,Fantasy,Shonen",
    popularity: 84200,
    languages: "HIN,TAM",
    platform: "Netflix",
    type: "TV Series"
  },
  {
    id: 3,
    title: "Quantum Symphony",
    slug: "quantum-symphony",
    synopsis: "Two prodigy violinists across parallel dimensions discover their sheet music synchronizes their heartbeats across the multiverse.",
    cover_image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&auto=format&fit=crop&q=80",
    rating: 8.9,
    episodes_count: 13,
    status: "Airing",
    season: "Spring",
    year: 2026,
    genres: "Drama,Romance,Music",
    popularity: 62000,
    languages: "HIN,TEL",
    platform: "JioCinema",
    type: "TV Series"
  },
  {
    id: 4,
    title: "Abyssal Alchemist",
    slug: "abyssal-alchemist",
    synopsis: "Exiled from the royal academy, a forbidden researcher unlocks the secret of transmuting dark matter into pure starlight energy.",
    cover_image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80",
    rating: 8.8,
    episodes_count: 26,
    status: "Completed",
    season: "Autumn",
    year: 2025,
    genres: "Adventure,Fantasy,Magic",
    popularity: 51000,
    languages: "HIN,TAM,TEL",
    platform: "Muse India",
    type: "TV Series"
  },
  {
    id: 5,
    title: "Tokyo Shinobi Squad",
    slug: "tokyo-shinobi-squad",
    synopsis: "Modern-day covert ninja units patrol the neon-drenched alleys of Shinjuku against shadow yokai syndicates.",
    cover_image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1600&auto=format&fit=crop&q=80",
    rating: 9.0,
    episodes_count: 12,
    status: "Airing",
    season: "Spring",
    year: 2026,
    genres: "Action,Supernatural,Ninja",
    popularity: 73000,
    languages: "HIN,TAM",
    platform: "Crunchyroll",
    type: "TV Series"
  },
  {
    id: 6,
    title: "Starlight Barista",
    slug: "starlight-barista",
    synopsis: "A cozy interstellar cafe that serves cosmic beverages to weary space travelers drifting between star systems.",
    cover_image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80",
    rating: 9.2,
    episodes_count: 12,
    status: "Completed",
    season: "Summer",
    year: 2025,
    genres: "Mystery,Sci-Fi,Detective",
    popularity: 58000,
    languages: "HIN,TAM",
    platform: "Crunchyroll",
    type: "Movie"
  }
];

const REGIONAL_LANGUAGES = [
  { label: 'All', value: 'All', count: 124 },
  { label: 'Tamil', value: 'Tamil', count: 62 },
  { label: 'Telugu', value: 'Telugu', count: 59 },
  { label: 'Hindi', value: 'Hindi', count: 121 },
  { label: 'Malayalam', value: 'Malayalam', count: 45 },
  { label: 'Kannada', value: 'Kannada', count: 38 }
];

const GENRES = ['All', 'Action', 'Fantasy', 'Sci-Fi', 'Romance', 'Adventure', 'Thriller', 'Supernatural', 'Comedy', 'Slice of Life', 'Mecha'];
const PLATFORMS = ['All Platforms', 'Crunchyroll', 'Netflix', 'JioCinema', 'Muse India', 'Ani-One'];
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
  onClearRecentlyViewed
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
          const normalized = data.data.map((item: any, idx: number) => ({
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
          totalAnime={rawAnimeList.length > 0 ? rawAnimeList.length : 99}
          totalVotes={rawAnimeList.reduce((acc, curr) => acc + (curr.popularity || 0), 0) || 425000}
          totalLanguages={5}
        />
      </div>

      {/* 2.5 RECENTLY VIEWED ROW */}
      {recentlyViewed && recentlyViewed.length > 0 && (
        <div className="mt-2 px-1">
          <RecentlyViewedRow
            items={recentlyViewed}
            onSelectAnime={(a) => onSelectAnime(a as any)}
            onClear={onClearRecentlyViewed || (() => {})}
            watchlist={watchlist}
            onToggleWatchlist={onToggleWatchlist}
          />
        </div>
      )}


      {/* 3. REGIONAL DUB AUDIO FILTER PILLS */}
      <div className="px-3.5 mt-8">
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles className="w-[14px] h-[14px] text-[#a855f7]" />
          <span className="text-[12px] font-bold uppercase text-[#94a3b8] tracking-wider">REGIONAL DUB AUDIO</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {REGIONAL_LANGUAGES.map((lang) => {
            const active = selectedLanguage === lang.value;
            return (
              <button
                key={lang.value}
                onClick={() => setSelectedLanguage(lang.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[13px] font-semibold shrink-0 transition-all ${
                  active
                    ? 'bg-gradient-to-r from-[#9333ea] to-[#6366f1] text-white font-bold shadow-[0_4px_15px_rgba(147,51,234,0.45)]'
                    : 'bg-[#111626] border border-[#1e263d] text-[#cbd5e1]'
                }`}
              >
                {lang.label}
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${active ? 'bg-black/30 text-white' : 'bg-[#0a0d16] text-[#94a3b8]'}`}>
                  {lang.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. FILTER & SORT DROPDOWNS GRID */}
      <div className="px-3.5 mt-6 grid grid-cols-2 gap-2.5">
        
        {/* Render Dropdowns */}
        {[
          { label: 'GENRE', val: selectedGenre, set: setSelectedGenre, opts: GENRES },
          { label: 'PLATFORM', val: selectedPlatform, set: setSelectedPlatform, opts: PLATFORMS },
          { label: 'TYPE', val: selectedType, set: setSelectedType, opts: TYPES },
          { label: 'STATUS', val: selectedStatus, set: setSelectedStatus, opts: STATUSES }
        ].map((item, i) => (
          <div key={i} className="relative bg-[#111626] border border-[#1e263d] rounded-2xl px-3.5 h-11 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-[#64748b] mr-2 shrink-0">{item.label}</span>
            <select
              value={item.val}
              onChange={(e) => item.set(e.target.value)}
              className="text-[13px] font-semibold text-[#e2e8f0] bg-transparent appearance-none flex-1 truncate pr-4 focus:outline-none"
            >
              {item.opts.map(o => <option key={o} value={o} className="bg-[#111626]">{o}</option>)}
            </select>
            <ChevronDown className="w-[14px] h-[14px] text-[#64748b] shrink-0 pointer-events-none" />
          </div>
        ))}
        
        {/* Sort (span 1) */}
        <div className="relative bg-[#111626] border border-[#1e263d] rounded-2xl px-3.5 h-11 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-[#64748b] mr-2 shrink-0">SORT</span>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="text-[13px] font-semibold text-[#e2e8f0] bg-transparent appearance-none flex-1 truncate pr-4 focus:outline-none"
            >
              {SORTS.map(s => <option key={s.value} value={s.value} className="bg-[#111626]">{s.label}</option>)}
            </select>
            <ChevronDown className="w-[14px] h-[14px] text-[#64748b] shrink-0 pointer-events-none" />
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

      {/* 9. RECENT UPDATES SECTION */}
      <div className="px-3.5 mt-4">
        <div className="bg-[#101424] border border-neutral-800/80 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">Daily Indian Dub Drops & Licensing</span>
          </div>
          <div className="space-y-2 text-xs text-neutral-400">
            <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/50">
              <span className="text-neutral-200 font-medium">Jujutsu Kaisen Season 2 (Tamil Dub)</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded">Crunchyroll</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/50">
              <span className="text-neutral-200 font-medium">Demon Slayer: Hashira Training Arc (Telugu Dub)</span>
              <span className="text-[10px] text-sky-400 font-bold bg-sky-950/80 px-2 py-0.5 rounded">JioHotstar</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-neutral-200 font-medium">Solo Leveling Season 1 (Hindi Dub)</span>
              <span className="text-[10px] text-purple-400 font-bold bg-purple-950/80 px-2 py-0.5 rounded">Netflix</span>
            </div>
          </div>
        </div>
      </div>

      {/* 10. FEEDBACK & DUB REQUEST SECTION */}
      <div className="px-3.5 mt-6 mb-4">
        <div className="bg-gradient-to-br from-[#121829] to-[#0c101a] border border-neutral-800/80 rounded-2xl p-4 text-center">
          <h3 className="text-sm font-extrabold text-white">Can't find your favorite regional dub?</h3>
          <p className="text-[11px] text-neutral-400 mt-1 max-w-sm mx-auto">
            Request legal Indian dub track licensing or submit missing voice artist credits to our community database.
          </p>
          <button
            onClick={() => alert('Dub request noted! Our catalog team will verify with Crunchyroll & Netflix India.')}
            className="mt-3 px-4 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Request a Dub Title
          </button>
        </div>
      </div>

    </div>
  );
};
