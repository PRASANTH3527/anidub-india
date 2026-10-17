import React, { useState, useEffect } from 'react';
import { Star, Tv, Filter, ChevronLeft, ChevronRight, Play, Bookmark, ArrowUpDown, Loader2, Dices, FolderPlus, Languages, Flame, Film, Sparkles, Check } from 'lucide-react';
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
  { label: 'All', value: 'All' },
  { label: 'Tamil', value: 'Tamil', tag: 'TAM' },
  { label: 'Telugu', value: 'Telugu', tag: 'TEL' },
  { label: 'Hindi', value: 'Hindi', tag: 'HIN' }
];

const GENRES = ['All', 'Action', 'Fantasy', 'Sci-Fi', 'Romance', 'Adventure', 'Thriller', 'Supernatural', 'Comedy', 'Slice of Life', 'Mecha'];
const PLATFORMS = ['All Platforms', 'Crunchyroll', 'Netflix', 'JioCinema', 'Muse India', 'Ani-One'];
const TYPES = ['All Types', 'TV Series', 'Movie', 'OVA', 'Special'];
const STATUSES = ['All', 'Airing', 'Completed', 'Upcoming'];
const SORTS = [
  { label: 'Most Popular', value: 'popularity' },
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
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 6, total: 8, totalPages: 2 });
  
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
          // Normalize with language tags if not set
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
      console.warn('Connected to fallback D1 catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter & Sort purely on client for instantaneous snappy UI responsiveness
  const filteredList = filterAndSortCatalog(rawAnimeList, {
    language: selectedLanguage,
    genre: selectedGenre,
    platform: selectedPlatform === 'All Platforms' ? 'All' : selectedPlatform,
    type: selectedType === 'All Types' ? 'All' : selectedType,
    status: selectedStatus,
    search: searchQuery,
    sort: selectedSort
  });

  // Calculate paginated slice
  const itemsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const currentPage = Math.min(pagination.page, totalPages);
  const offset = (currentPage - 1) * itemsPerPage;
  const paginatedAnime = filteredList.slice(offset, offset + itemsPerPage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* 1. Main Hero Section */}
      <div className="relative rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950 border border-slate-800/80 p-8 sm:p-12 md:p-16 text-center overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-radial from-orange-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider shadow-sm">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span>Cloudflare D1 & ImgBB Accelerated</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight font-['Space_Grotesk',sans-serif] leading-tight">
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
              The Premier Destination for Anime Streaming & Dubbing in India
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Experience hundreds of top-rated anime series and movies with authentic regional Indian dubbing in Hindi, Tamil, and Telugu. Streamed globally via Cloudflare Pages and high-resolution ImgBB poster CDN.
          </p>

          {/* Action Buttons: Surprise Me Roulette & Create Collection */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={onOpenRoulette}
              className="flex items-center space-x-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm shadow-xl shadow-orange-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Dices className="w-5 h-5 text-white" />
              <span>Surprise Me Roulette (Random Pick)</span>
            </button>

            <button
              onClick={onOpenCollection}
              className="flex items-center space-x-2.5 px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-sm border border-slate-700/80 shadow-lg transition-all hover:scale-105"
            >
              <FolderPlus className="w-5 h-5 text-orange-400" />
              <span>Create Collection (Shareable)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Three Main Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Stat Card 1: DUBBED TITLES */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl hover:border-orange-500/40 transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-['Space_Grotesk',sans-serif]">
              DUBBED TITLES
            </span>
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform">
              <Film className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-['Space_Grotesk',sans-serif] tracking-tight">
            1,240+
          </div>
          <p className="text-xs text-orange-400/90 mt-1 font-medium">
            Available in Full High Definition
          </p>
        </div>

        {/* Stat Card 2: COMMUNITY VOTES */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl hover:border-amber-500/40 transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-['Space_Grotesk',sans-serif]">
              COMMUNITY VOTES
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-['Space_Grotesk',sans-serif] tracking-tight">
            85.4K+
          </div>
          <p className="text-xs text-amber-400/90 mt-1 font-medium">
            Verified Indian Otakus & Fans
          </p>
        </div>

        {/* Stat Card 3: INDIAN LANGUAGES */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl hover:border-orange-500/40 transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-['Space_Grotesk',sans-serif]">
              INDIAN LANGUAGES
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Languages className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-['Space_Grotesk',sans-serif] tracking-tight">
            3 Regional Dubs
          </div>
          <p className="text-xs text-emerald-400/90 mt-1 font-medium">
            Hindi • Tamil • Telugu Audio
          </p>
        </div>

      </div>

      {/* 3. Regional Dub Audio Pill Filters */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <Languages className="w-4 h-4 text-orange-400" />
          <span>REGIONAL DUB AUDIO</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {REGIONAL_LANGUAGES.map((lang) => {
            const active = selectedLanguage === lang.value;
            return (
              <button
                key={lang.value}
                onClick={() => { setSelectedLanguage(lang.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30 scale-105'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{lang.label}</span>
                {lang.tag && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    lang.tag === 'HIN' ? 'bg-amber-500/30 text-amber-200' :
                    lang.tag === 'TAM' ? 'bg-purple-500/30 text-purple-200' :
                    'bg-teal-500/30 text-teal-200'
                  }`}>
                    {lang.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Five Dropdown Filters */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          
          {/* Dropdown 1: Genre */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Genre</label>
            <div className="relative">
              <select
                value={selectedGenre}
                onChange={(e) => { setSelectedGenre(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none"
              >
                {GENRES.map(g => <option key={g} value={g} className="bg-slate-950">{g}</option>)}
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none"
              >
                {STATUSES.map(s => <option key={s} value={s} className="bg-slate-950">{s}</option>)}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Dropdown 5: Sort */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sort</label>
            <div className="relative">
              <select
                value={selectedSort}
                onChange={(e) => { setSelectedSort(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none"
              >
                {SORTS.map(s => <option key={s.value} value={s.value} className="bg-slate-950">{s.label}</option>)}
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

        </div>
      </div>

      {/* 5. Two-Column Anime Card Grid */}
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
              className="mt-4 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-semibold"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          /* 2-COLUMN GRID AS REQUESTED */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginatedAnime.map((anime) => {
              const isWatchlisted = watchlist.includes(anime.id);
              const langs = (anime.languages || 'HIN,TAM,TEL').split(',');

              return (
                <div
                  key={anime.id}
                  className="group bg-slate-900 border border-slate-800/80 hover:border-orange-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-orange-500/10 transition-all duration-300 flex flex-col sm:flex-row"
                >
                  {/* Poster Image Container */}
                  <div 
                    onClick={() => onSelectAnime(anime)}
                    className="relative w-full sm:w-48 aspect-[3/4] sm:aspect-auto flex-shrink-0 overflow-hidden bg-slate-950 cursor-pointer"
                  >
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                    {/* Rating Badge */}
                    <div className="absolute top-3 left-3 flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md text-amber-400 text-xs font-bold border border-amber-500/30 shadow-md">
                      <Star className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                      <span>{anime.rating}</span>
                    </div>

                    {/* Watchlist/Bookmark Toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime.id); }}
                      className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-colors shadow-md ${
                        isWatchlisted ? 'bg-orange-600 text-white' : 'bg-slate-950/80 text-slate-300 hover:text-white'
                      }`}
                      title={isWatchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
                    >
                      <Bookmark className={`w-4 h-4 ${isWatchlisted ? 'fill-white' : ''}`} />
                    </button>

                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 font-medium sm:hidden">
                      <span>{anime.episodes_count} Eps</span>
                      <span className="text-orange-400">{anime.status}</span>
                    </div>
                  </div>

                  {/* Card Content (Right Side in 2-Column layout) */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {/* Language Tags: HIN, TAM, TEL */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {langs.map((l) => (
                          <span
                            key={l}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide ${
                              l === 'HIN'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : l === 'TAM'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            }`}
                          >
                            {l}
                          </span>
                        ))}
                        <span className="text-[11px] text-slate-400 ml-1.5">{anime.year}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[11px] text-orange-400 font-medium">{anime.status}</span>
                      </div>

                      <h3
                        onClick={() => onSelectAnime(anime)}
                        className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] hover:text-orange-400 cursor-pointer transition-colors line-clamp-1"
                      >
                        {anime.title}
                      </h3>

                      <p className="text-xs text-slate-400 line-clamp-3 mt-2 leading-relaxed">
                        {anime.synopsis}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-1 text-xs text-slate-400">
                        <Tv className="w-3.5 h-3.5 text-orange-400 mr-1" />
                        <span>{anime.episodes_count} Episodes</span>
                      </div>

                      <div>
                        <button
                          onClick={() => onSelectAnime(anime)}
                          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md shadow-orange-600/20 transition-all hover:scale-105"
                        >
                          View Details
                        </button>
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
