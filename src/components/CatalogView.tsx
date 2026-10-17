import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Tv, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Bookmark, 
  ArrowUpDown, 
  Loader2, 
  Dices, 
  FolderPlus, 
  Languages, 
  Flame, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  Heart,
  Cloud,
  Flag,
  Share2,
  Check
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

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
    genres: "Slice of Life,Sci-Fi,Cozy",
    popularity: 44000,
    languages: "HIN,TEL",
    platform: "Ani-One",
    type: "TV Series"
  },
  {
    id: 7,
    title: "Titanium Mecha Vanguard",
    slug: "titanium-mecha-vanguard",
    synopsis: "Humanity's last bastion stands inside colossal bipedal armored mechs defending Earth's orbital elevators from colossal alien behemoths.",
    cover_image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80",
    rating: 8.7,
    episodes_count: 24,
    status: "Airing",
    season: "Spring",
    year: 2026,
    genres: "Mecha,Action,Sci-Fi",
    popularity: 68900,
    languages: "HIN,TAM,TEL",
    platform: "Netflix",
    type: "TV Series"
  },
  {
    id: 8,
    title: "Chronos Detective Agency",
    slug: "chronos-detective-agency",
    synopsis: "Private investigators who solve cold cases by jumping back and forth across 24-hour temporal loops in Neo-Tokyo.",
    cover_image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80",
    rating: 8.9,
    episodes_count: 12,
    status: "Completed",
    season: "Fall",
    year: 2025,
    genres: "Mystery,Sci-Fi,Detective",
    popularity: 58000,
    languages: "HIN,TAM",
    platform: "Crunchyroll",
    type: "Movie"
  }
];

const REGIONAL_LANGUAGES = [
  { label: 'All', value: 'All', count: 258 },
  { label: 'Tamil', value: 'Tamil', count: 152 },
  { label: 'Telugu', value: 'Telugu', count: 150 },
  { label: 'Hindi', value: 'Hindi', count: 255 },
  { label: 'Malayalam', value: 'Malayalam', count: 110 },
  { label: 'Kannada', value: 'Kannada', count: 95 }
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
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 8, total: 8, totalPages: 1 });
  
  // Filter States
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSort, setSelectedSort] = useState('popularity');
  const [loading, setLoading] = useState(false);

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

  // Filter & Sort purely on client for snappy UI responsiveness
  const filteredList = filterAndSortCatalog(rawAnimeList, {
    language: selectedLanguage,
    genre: selectedGenre,
    platform: selectedPlatform === 'All Platforms' ? 'All' : selectedPlatform,
    type: selectedType === 'All Types' ? 'All' : selectedType,
    status: selectedStatus,
    search: searchQuery,
    sort: selectedSort
  });

  // Calculate paginated slice (8 items per page for balanced grid)
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const currentPage = Math.min(pagination.page, totalPages);
  const offset = (currentPage - 1) * itemsPerPage;
  const paginatedAnime = filteredList.slice(offset, offset + itemsPerPage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* 2. Hero Section (Sitting directly on background, no container box) */}
      <div className="text-center py-4 sm:py-8 max-w-4xl mx-auto space-y-4 sm:space-y-5">
        
        {/* Badge: Purple glowing pill with sparkle icon */}
        <div className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-purple-950/40 border border-purple-500/30 text-purple-300 text-xs font-semibold shadow-[0_0_15px_rgba(168,85,247,0.15)]">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Official Indian Dubbed Anime Directory</span>
        </div>

        {/* Orange Sub-Heading Label */}
        <div className="text-xs sm:text-sm font-extrabold text-orange-500 tracking-wider uppercase font-['Space_Grotesk',sans-serif]">
          ANIDUB INDIA OFFICIAL WEBSITE
        </div>

        {/* Main Title: Exact colors requested */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black font-['Space_Grotesk',sans-serif] tracking-tight leading-tight">
          <span className="text-white block">The Premier Destination for</span>
          <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent block mt-1">
            Anime Streaming & Dubbing in India
          </span>
        </h1>

        {/* Subtitle / Description */}
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto font-normal leading-relaxed">
          Discover officially dubbed anime in Tamil, Telugu, Hindi, Malayalam, and Kannada — streaming legally on Crunchyroll, Netflix, JioHotstar, and JioCinema.
        </p>

        {/* Action Buttons: Smooth Pill-Shaped (rounded-full) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {/* Button 1: Surprise Me Roulette (Soft orange-to-purple gradient with gentle glow) */}
          <button
            onClick={onOpenRoulette}
            className="flex items-center justify-between pl-5 pr-2 py-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white font-bold text-xs sm:text-sm shadow-[0_0_25px_rgba(249,115,22,0.35)] transition-all duration-300 ease-in-out hover:shadow-lg hover:shadow-orange-500/25 hover:scale-105 active:scale-95 group cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Dices className="w-4 h-4 text-white" />
              <span>Surprise Me Roulette</span>
            </div>
            <span className="ml-3 px-3 py-1 rounded-full bg-purple-950/60 backdrop-blur-sm text-[10px] sm:text-[11px] font-black text-white flex items-center space-x-1 border border-white/20">
              <span>🎲 RANDOM PICK</span>
            </span>
          </button>

          {/* Button 2: Create Collection (Dark with purple outline) */}
          <button
            onClick={onOpenCollection}
            className="flex items-center justify-between pl-5 pr-2 py-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm border border-slate-700/80 hover:border-purple-500/50 shadow-lg shadow-black/40 transition-all hover:scale-105 active:scale-95 group cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <FolderPlus className="w-4 h-4 text-purple-400" />
              <span>Create Collection</span>
            </div>
            <span className="ml-3 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-extrabold tracking-wider">
              SHAREABLE
            </span>
          </button>
        </div>
      </div>

      {/* 3. Analytics / Stat Cards (3-Grid Layout) */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 py-2">
        
        {/* Card 1: DUBBED TITLES (TV icon) + Dynamic Count + Verified dubs (Green check icon) */}
        <div className="bg-[#1a1b26] hover:bg-white/[0.04] border border-white/10 hover:border-orange-500/50 rounded-xl p-3 sm:p-4 relative overflow-hidden shadow-xl transition-all duration-300 ease-in-out group">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/80 to-transparent" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider font-['Space_Grotesk',sans-serif] truncate">
              DUBBED TITLES
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform shrink-0">
              <Tv className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white font-['Space_Grotesk',sans-serif] tracking-tight">
            258+
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-400 mt-1 font-medium flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">Verified dubs</span>
          </p>
        </div>

        {/* Card 2: COMMUNITY VOTES (Fire icon) + Dynamic Count + Community upvotes (Trending up icon) */}
        <div className="bg-[#1a1b26] hover:bg-white/[0.04] border border-white/10 hover:border-amber-500/50 rounded-xl p-3 sm:p-4 relative overflow-hidden shadow-xl transition-all duration-300 ease-in-out group">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/80 to-transparent" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider font-['Space_Grotesk',sans-serif] truncate">
              COMMUNITY VOTES
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform shrink-0">
              <Flame className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white font-['Space_Grotesk',sans-serif] tracking-tight flex items-center space-x-1">
            <span>0</span>
            <span className="text-amber-500 text-sm">🔥</span>
          </div>
          <p className="text-[10px] sm:text-xs text-amber-400 mt-1 font-medium flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">Community upvotes</span>
          </p>
        </div>

        {/* Card 3: INDIAN LANGUAGES (Translate icon) + 5 Regions + Tamil • Telugu • Hindi */}
        <div className="bg-[#1a1b26] hover:bg-white/[0.04] border border-white/10 hover:border-purple-500/50 rounded-xl p-3 sm:p-4 relative overflow-hidden shadow-xl transition-all duration-300 ease-in-out group">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/80 to-transparent" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider font-['Space_Grotesk',sans-serif] truncate">
              INDIAN LANGUAGES
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform shrink-0">
              <Languages className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white font-['Space_Grotesk',sans-serif] tracking-tight">
            5 Regions
          </div>
          <p className="text-[10px] sm:text-xs text-purple-400 mt-1 font-medium flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
            <span className="truncate">Tamil • Telugu • Hindi</span>
          </p>
        </div>

      </div>

      {/* 4. Granular Filtering System */}
      <div className="space-y-4">
        
        {/* Audio Filters: Title ✨ REGIONAL DUB AUDIO */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
            <span>✨ REGIONAL DUB AUDIO</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {REGIONAL_LANGUAGES.map((lang) => {
              const active = selectedLanguage === lang.value;
              const getActiveStyle = () => {
                if (lang.value === 'All') return 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-500 shadow-orange-600/30';
                if (lang.value === 'Tamil') return 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-purple-600/30';
                if (lang.value === 'Telugu') return 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-teal-500 shadow-teal-600/30';
                return 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white border-amber-500 shadow-amber-600/30';
              };

              return (
                <button
                  key={lang.value}
                  onClick={() => { setSelectedLanguage(lang.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  className={`flex items-center space-x-2.5 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md ${
                    active
                      ? `${getActiveStyle()} border scale-105`
                      : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{lang.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    active 
                      ? 'bg-black/30 text-white' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {lang.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dropdown Grid matching reference screenshot layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          
          {/* Dropdown 1: Genre */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Genre</label>
            <div className="relative">
              <select
                value={selectedGenre}
                onChange={(e) => { setSelectedGenre(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none shadow-sm"
              >
                {GENRES.map(g => <option key={g} value={g} className="bg-slate-950">{g === 'All' ? 'All Genres' : g}</option>)}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Dropdown 2: Platform */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Platform</label>
            <div className="relative">
              <select
                value={selectedPlatform}
                onChange={(e) => { setSelectedPlatform(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none shadow-sm"
              >
                {PLATFORMS.map(p => <option key={p} value={p} className="bg-slate-950">{p}</option>)}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Dropdown 3: Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</label>
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none shadow-sm"
              >
                {TYPES.map(t => <option key={t} value={t} className="bg-slate-950">{t}</option>)}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Dropdown 4: Status */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none shadow-sm"
              >
                {STATUSES.map(s => <option key={s} value={s} className="bg-slate-950">{s === 'All' ? 'All Status' : s}</option>)}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Dropdown 5: Sort */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sort</label>
            <div className="relative">
              <select
                value={selectedSort}
                onChange={(e) => { setSelectedSort(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none shadow-sm"
              >
                {SORTS.map(s => <option key={s.value} value={s.value} className="bg-slate-950">🔥 {s.label}</option>)}
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

        </div>

      </div>

      {/* 5. Anime Catalog Grid (The Core): 2-column on mobile, expanding natively on desktop */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-2">
            <span>Anime Catalog</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-orange-400 font-bold">
              {filteredList.length} Titles Found
            </span>
          </h2>
          {searchQuery && (
            <span className="text-xs text-slate-400">
              Filtering for &ldquo;<span className="text-orange-400 font-semibold">{searchQuery}</span>&rdquo;
            </span>
          )}
        </div>

        {paginatedAnime.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/50 rounded-3xl border border-slate-800">
            <p className="text-slate-400 text-sm">No anime matches your selected regional dub filters.</p>
            <button
              onClick={() => {
                setSelectedLanguage('All');
                setSelectedGenre('All');
                setSelectedPlatform('All Platforms');
                setSelectedType('All Types');
                setSelectedStatus('All');
              }}
              className="mt-4 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/30 transition-all"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          /* Responsive Grid: 2-column on mobile, 3-column on tablet, 4-column on desktop */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {paginatedAnime.map((anime) => {
              const isWatchlisted = watchlist.includes(anime.id);
              const langs = (anime.languages || 'HIN,TAM,TEL').split(',');

              return (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime)}
                  className="group bg-slate-900/90 border border-slate-800/80 hover:border-purple-500/30 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300 ease-in-out flex flex-col cursor-pointer"
                >
                  {/* Vertical cover image container (rendered securely from ImgBB URLs) */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-black/30" />

                    {/* Top-Left Overlays: TRENDING & Offline Ready */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col items-start space-y-1 z-10">
                      <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] sm:text-[10px] font-extrabold flex items-center space-x-1 shadow-md">
                        <Flame className="w-3 h-3 text-amber-300" />
                        <span>TRENDING</span>
                      </div>
                      <div className="px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 text-[9px] sm:text-[10px] font-extrabold flex items-center space-x-1 shadow-md">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Offline Ready</span>
                      </div>
                    </div>

                    {/* Top-Right Overlays: Circular icon buttons (Cloud, Flag, Share, Heart, Bookmark) */}
                    <div className="absolute top-2.5 right-2.5 flex items-center space-x-1 z-10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); }} 
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/40 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Cloud / Download"
                      >
                        <Cloud className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); }} 
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/40 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Report / Flag"
                      >
                        <Flag className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); }} 
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/40 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Share"
                      >
                        <Share2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime.id); }}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/40 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md group/heart"
                        title={isWatchlisted ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        <Heart className={`w-3.5 h-3.5 transition-colors ${
                          isWatchlisted ? 'text-rose-400 fill-rose-500/45' : 'text-slate-300 group-hover/heart:text-white'
                        }`} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime.id); }}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/40 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Bookmark"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isWatchlisted ? 'text-orange-400 fill-orange-500/45' : 'text-slate-300'}`} />
                      </button>
                    </div>

                    {/* Bottom-Left overlay (on image): Dark pill with star icon and rating */}
                    <div className="absolute bottom-2.5 left-2.5 flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md text-amber-400 text-[10px] sm:text-xs font-bold border border-amber-500/30 shadow-md">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>⭐ RATING {anime.rating}/10</span>
                    </div>
                  </div>

                  {/* Below Image Content */}
                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5">
                    <div>
                      {/* Below Image: Language small pills (HIN, TAM, TEL in distinct colors: Green, Orange, Blue) */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {langs.map((l) => (
                          <span
                            key={l}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide ${
                              l.trim() === 'HIN' || l.trim() === 'Hindi'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : l.trim() === 'TAM' || l.trim() === 'Tamil'
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                                : l.trim() === 'TEL' || l.trim() === 'Telugu'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                            }`}
                          >
                            {l.trim()}
                          </span>
                        ))}
                      </div>

                      {/* Title: Bold, truncated to 2 lines */}
                      <h3 className="font-bold text-white text-sm sm:text-base font-['Space_Grotesk',sans-serif] line-clamp-2 group-hover:text-orange-400 transition-colors leading-snug">
                        {anime.title}
                      </h3>

                      {/* Subtitle: Type & Year */}
                      <p className="text-[11px] text-slate-400 mt-1 font-medium">
                        {anime.type || 'TV Series'} • {anime.year || '2024'}
                      </p>
                    </div>

                    {/* Footer Row: Platform pill & stat counter pills */}
                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[10px] font-semibold text-slate-300 truncate max-w-[90px]">
                        {anime.platform || 'Crunchyroll'}
                      </span>
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          <Heart className="w-3 h-3 text-rose-400 fill-rose-500/20" />
                          <span>{Math.round((anime.rating || 7) * 20)}</span>
                        </span>
                        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <span>{Math.round((anime.rating || 7) * 20)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl px-6 py-4 shadow-xl">
          <div className="text-xs text-slate-400">
            Page <span className="font-bold text-slate-200">{currentPage}</span> of <span className="font-bold text-slate-200">{totalPages}</span> ({filteredList.length} matching titles)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
              disabled={currentPage === 1}
              className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition-colors ${
                    currentPage === p
                      ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.page + 1, totalPages) }))}
              disabled={currentPage === totalPages}
              className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
