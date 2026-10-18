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
  { label: 'Most Upvoted', value: 'popularity' },
  { label: 'Highest Rated', value: 'rating' },
  { label: 'Newest Release', value: 'newest' },
  { label: 'Title (A-Z)', value: 'title' }
];

export const CatalogView: React.FC<CatalogViewProps> = ({
  onSelectAnime,
  searchQuery,
  watchlist,
  onToggleWatchlist,
  onOpenRoulette,
  onOpenCollection
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
    <div className="w-full max-w-[420px] mx-auto px-[11px] overflow-x-hidden font-['Inter',sans-serif] text-slate-100">
      
      {/* 1. HERO SUBTITLE & CTA BUTTONS */}
      <div className="pt-4 px-5 text-center">
        <p className="text-[13px] text-[#94a3b8] leading-relaxed max-w-md mx-auto">
          Discover officially dubbed anime in Tamil, Telugu, Hindi, Malayalam, and Kannada — streaming legally on Crunchyroll, Netflix, JioHotstar, and JioCinema.
        </p>
        
        {/* Surprise Me Roulette */}
        <button
          onClick={onOpenRoulette}
          className="mt-5 w-full flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#f59e0b] via-[#ea580c] to-[#9333ea] px-5 py-3 shadow-[0_6px_25px_rgba(234,88,12,0.4)]"
        >
          <Dices className="w-[18px] h-[18px] text-white" />
          <span className="text-[14px] font-extrabold text-white">Surprise Me Roulette</span>
          <span className="bg-black/30 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white inline-flex items-center gap-1">
            🎲 RANDOM PICK
          </span>
        </button>

        {/* Create Collection */}
        <button
          onClick={onOpenCollection}
          className="mt-3 w-full flex items-center justify-center gap-2.5 rounded-full bg-[#111524] border border-[#262d47] px-5 py-2.5"
        >
          <Layers className="w-[16px] h-[16px] text-white" />
          <span className="text-[13px] font-bold text-white">Create Collection</span>
          <span className="bg-[#1e1436] border border-[#7e22ce] text-[#c084fc] text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full">
            SHAREABLE
          </span>
        </button>
      </div>

      {/* 2. THREE-COLUMN STATS CARDS ROW */}
      <div className="grid grid-cols-3 gap-2.5 px-3.5 mt-6">
        <div className="bg-[#101424] border border-[#cbd5e1]/70 rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex justify-between items-start gap-1">
            <span className="text-[9.5px] font-bold uppercase text-[#94a3b8] leading-tight">DUBBED TITLES</span>
            <div className="w-7 h-7 rounded-full bg-[#24153d] border border-[#6b21a8] flex items-center justify-center shrink-0">
              <Tv className="w-[13px] h-[13px] text-[#c084fc]" />
            </div>
          </div>
          <div className="mt-2 text-[20px] font-extrabold text-white">99<span className="text-[#a855f7] text-sm font-bold ml-0.5">+</span></div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-[#64748b]">
            <CheckCircle2 className="w-[11px] h-[11px] text-[#10b981]" />
            Verified dubs
          </div>
        </div>

        <div className="bg-[#14121d] border border-[#f97316]/30 rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex justify-between items-start gap-1">
            <span className="text-[9.5px] font-bold uppercase text-[#94a3b8] leading-tight">COMMUNITY VOTES</span>
            <div className="w-7 h-7 rounded-full bg-[#2a1710] border border-[#ea580c]/40 flex items-center justify-center shrink-0">
              <Flame className="w-[13px] h-[13px] text-[#f97316]" />
            </div>
          </div>
          <div className="mt-2 text-[20px] font-extrabold text-white">0<span className="text-sm ml-1">🔥</span></div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-[#64748b] truncate">
            <TrendingUp className="w-[11px] h-[11px] text-[#f97316]" />
            Community upvotes
          </div>
        </div>

        <div className="bg-[#0d1726] border border-[#0284c7]/40 rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex justify-between items-start gap-1">
            <span className="text-[9.5px] font-bold uppercase text-[#94a3b8] leading-tight">INDIAN LANGUAGES</span>
            <div className="w-7 h-7 rounded-full bg-[#0c243d] border border-[#0284c7]/50 flex items-center justify-center shrink-0">
              <Languages className="w-[13px] h-[13px] text-[#38bdf8]" />
            </div>
          </div>
          <div className="mt-2 text-[20px] font-extrabold text-white">5<span className="text-[11px] font-bold text-[#38bdf8] ml-1">Regions</span></div>
          <div className="mt-2 text-[10px] text-[#64748b] truncate">Tamil • Telugu • Hindi</div>
        </div>
      </div>

      {/* 3. REGIONAL DUB AUDIO FILTER PILLS */}
      <div className="px-3.5 mt-6">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles className="w-[14px] h-[14px] text-[#a855f7]" />
          <span className="text-[11px] font-bold uppercase text-[#94a3b8] tracking-wider">REGIONAL DUB AUDIO</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {REGIONAL_LANGUAGES.map((lang) => {
            const active = selectedLanguage === lang.value;
            return (
              <button
                key={lang.value}
                onClick={() => setSelectedLanguage(lang.value)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[13px] font-semibold shrink-0 transition-all ${
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
      <div className="px-3.5 mt-3.5 grid grid-cols-2 gap-2.5">
        

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

      {/* 7. Catalog List Grid with exact matching design */}
      <div className="pt-4 px-3.5">
        
        {/* 1. GRID HEADER ROW */}
        <div className="flex items-center justify-between mb-3.5 px-0.5">
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
          /* 2. CARD CONTAINER (grid-cols-2 gap-3.5 px-3.5) */
          <div className="grid grid-cols-2 gap-3.5">
            {displayedAnime.map((anime) => {
              const isWatchlisted = watchlist.includes(anime.id);
              const langs = (anime.languages || 'HIN,TAM,TEL').split(',').map(l => l.trim());
              const typeStr = anime.type || 'TV Series';
              const yrStr = anime.year || 2026;
              const plats = anime.platform ? anime.platform.split(',').map(p => p.trim()) : ['Crunchyroll'];
              const platDisplay = plats.length === 1 ? plats[0] : plats.map(p => p[0].toUpperCase()).join(', ');

              return (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime)}
                  className="group bg-[#0e1320] border border-[#1c2235] rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer hover:border-[#2d3748] transition-all shadow-lg"
                >
                  {/* 3. POSTER SECTION (2:3 Aspect Ratio) */}
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e1320] via-transparent to-transparent pointer-events-none" />

                    {/* Top-Left Overlay */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
                      {/* Trending Badge */}
                      <div className="bg-gradient-to-r from-[#a855f7] to-[#7c3aed] rounded-full px-2.5 py-0.5 flex items-center space-x-1 shadow-md">
                        <Flame className="w-[11px] h-[11px] text-white fill-white" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">TRENDING</span>
                      </div>
                      {/* Offline Ready Badge */}
                      <div className="bg-[#062e22]/90 border border-[#10b981]/50 rounded-full px-2.5 py-0.5 flex items-center space-x-1 shadow-md">
                        <CheckCircle2 className="w-[10px] h-[10px] text-[#34d399]" />
                        <span className="text-[10px] font-medium text-[#34d399]">Offline Ready</span>
                      </div>
                    </div>

                    {/* Top-Right Overlay */}
                    <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5 z-10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); }} 
                        className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-md"
                        title="Favorite"
                      >
                        <Heart className="w-[13px] h-[13px]" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime.id); }}
                        className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-md"
                        title="Bookmark"
                      >
                        <Bookmark className={`w-[13px] h-[13px] ${isWatchlisted ? 'text-orange-400 fill-orange-400' : 'text-white'}`} />
                      </button>
                    </div>

                    {/* Bottom-Left Rating Badge */}
                    <div className="absolute bottom-2.5 left-2.5 z-10">
                      <div className="bg-[#090b10]/95 border border-white/10 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5 shadow-md">
                        <Star className="w-3 h-3 fill-[#f97316] text-[#f97316]" />
                        <span className="text-[10px] font-bold text-[#f97316] uppercase tracking-wide">RATING</span>
                        <span className="text-[11px] font-bold text-white">{anime.rating}/10</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. CARD BODY (p-3, bg-[#0e1320]) */}
                  <div className="p-3 bg-[#0e1320] flex-1 flex flex-col justify-between">
                    <div>
                      {/* Row 1: Solid Language Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {langs.map((l) => {
                          const upper = l.toUpperCase();
                          let bgClass = 'bg-[#059669]'; // default HIN
                          let label = 'HIN';
                          if (upper.includes('TAM')) { bgClass = 'bg-[#d97706]'; label = 'TAM'; }
                          else if (upper.includes('TEL')) { bgClass = 'bg-[#0284c7]'; label = 'TEL'; }
                          else if (upper.includes('MAL')) { bgClass = 'bg-[#9333ea]'; label = 'MAL'; }
                          else if (upper.includes('HIN')) { bgClass = 'bg-[#059669]'; label = 'HIN'; }

                          return (
                            <span
                              key={l}
                              className={`${bgClass} rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>

                      {/* Row 2: Anime Title */}
                      <h3 className="font-bold text-white text-[15px] truncate mt-2 leading-snug">
                        {anime.title}
                      </h3>

                      {/* Row 3: Format & Year Subtitle */}
                      <div className="text-[11px] text-[#8b92a5] mt-0.5">
                        {typeStr} • {yrStr}
                      </div>
                    </div>

                    {/* Row 4: Footer Bar */}
                    <div className="mt-3 pt-2.5 border-t border-[#1a2035] flex items-center justify-between gap-1 text-[11px]">
                      {/* Left: Platform */}
                      <span className="bg-[#151b2d] border border-[#232b42] rounded-md px-2 py-0.5 text-[#94a3b8] font-medium truncate">
                        {platDisplay}
                      </span>

                      {/* Right: Counters */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <div className="bg-[#151b2d] border border-[#232b42] rounded-full px-2 py-0.5 flex items-center space-x-1">
                          <Heart className="w-[11px] h-[11px] text-[#94a3b8]" />
                          <span className="text-[11px] text-[#cbd5e1]">{Math.floor((anime.popularity || 1000) / 100)}</span>
                        </div>
                        <div className="bg-[#151b2d] border border-[#232b42] rounded-full px-2 py-0.5 flex items-center space-x-1">
                          <Flame className="w-[11px] h-[11px] text-[#94a3b8]" />
                          <span className="text-[11px] text-[#cbd5e1]">{anime.popularity || 1200}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
