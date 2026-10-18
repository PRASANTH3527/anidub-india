import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Tv, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Bookmark, 
  ArrowUpDown, 
  Loader2, 
  Dices, 
  Layers, 
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

  const filteredList = filterAndSortCatalog(rawAnimeList, {
    language: selectedLanguage,
    genre: selectedGenre,
    platform: selectedPlatform === 'All Platforms' ? 'All' : selectedPlatform,
    type: selectedType === 'All Types' ? 'All' : selectedType,
    status: selectedStatus,
    search: searchQuery,
    sort: selectedSort
  });

  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const currentPage = Math.min(pagination.page, totalPages);
  const offset = (currentPage - 1) * itemsPerPage;
  const paginatedAnime = filteredList.slice(offset, offset + itemsPerPage);

  return (
    <div className="w-full max-w-[510px] mx-auto px-3.5 py-6 space-y-6 overflow-x-hidden font-['Inter',sans-serif] text-slate-100">
      
      {/* 2. Hero Section */}
      <div className="text-center pt-4 pb-2 max-w-2xl mx-auto space-y-3">
        
        {/* Badge pill */}
        <div className="inline-flex items-center space-x-1.5 px-4 h-[36px] rounded-full bg-[rgba(76,29,149,0.8)] border border-[rgba(124,58,237,0.6)] text-[#c4b5fd] text-xs font-medium shadow-sm">
          <Sparkles className="w-4 h-4 text-[#c4b5fd]" />
          <span>Official Indian Dubbed Anime Directory</span>
        </div>

        {/* Sub-Heading Label */}
        <div className="text-[18px] font-bold text-[#ff5a1f] tracking-[0.1em] uppercase">
          ANIDUB INDIA OFFICIAL WEBSITE
        </div>

        {/* H1 Title */}
        <h1 className="text-[25px] font-extrabold tracking-tight leading-[1.15]">
          <span className="text-white block">The Premier Destination for</span>
          <span className="bg-gradient-to-r from-[#9333ea] to-[#6366f1] bg-clip-text text-transparent block mt-1">
            Anime Streaming & Dubbing in India
          </span>
        </h1>

        {/* Paragraph */}
        <p className="text-[13px] text-[#cbd5e1] max-w-[448px] mx-auto font-normal leading-[1.6] text-center">
          Discover officially dubbed anime in Tamil, Telugu, Hindi, Malayalam, and Kannada — streaming legally on Crunchyroll, Netflix, JioHotstar, and JioCinema.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col items-center space-y-4 pt-2">
          {/* Button 1 */}
          <button
            onClick={onOpenRoulette}
            className="inline-flex items-center justify-between h-[48px] px-[22px] rounded-full bg-gradient-to-r from-[#ff8a00] via-[#ff6a00] to-[#9333ea] hover:opacity-95 text-white font-semibold text-[13px] shadow-[0_0_25px_rgba(255,106,0,0.35)] transition-all cursor-pointer space-x-2.5"
          >
            <div className="flex items-center space-x-2">
              <Dices className="w-5 h-5 text-white shrink-0" />
              <span>Surprise Me Roulette</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-950/60 border border-white/20 text-[#fde68a] text-[11px] font-bold uppercase tracking-wider">
              🎲 RANDOM PICK
            </span>
          </button>

          {/* Button 2 */}
          <button
            onClick={onOpenCollection}
            className="inline-flex items-center justify-between h-[48px] px-6 rounded-full bg-[#141418] hover:bg-[#1a1a20] text-white font-medium text-[13px] border border-[#2a2a33] transition-all cursor-pointer space-x-2.5"
          >
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-white shrink-0" />
              <span>Create Collection</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-transparent border border-[#8b5cf6] text-[#a78bfa] text-[11px] font-bold uppercase tracking-wider">
              SHAREABLE
            </span>
          </button>
        </div>
      </div>

      {/* 3. Stat Cards (3 equal columns, gap 2.5, min-h-[111px], p-3) */}
      <div className="grid grid-cols-3 gap-2.5 w-full mt-8">
        
        {/* Card 1 */}
        <div className="bg-[#0d0d16] border-2 border-[#e9e5ff]/50 rounded-2xl p-3 min-h-[111px] flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.1em] leading-tight">
              DUBBED TITLES
            </span>
            <div className="w-[26px] h-[26px] rounded-lg bg-purple-500/15 border border-purple-500/50 text-purple-400 flex items-center justify-center shrink-0">
              <Tv className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-[22px] font-extrabold text-white tracking-tight flex items-baseline">
              <span>124</span>
              <span className="text-purple-400 text-xs font-bold ml-0.5">+</span>
            </div>
            <p className="text-[9.5px] text-[#cbd5e1] mt-0.5 font-medium flex items-center space-x-1 truncate">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Verified dubs</span>
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#0d0d16] border border-orange-500/45 rounded-2xl p-3 min-h-[111px] flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.1em] leading-tight">
              COMMUNITY<br />VOTES
            </span>
            <div className="w-[26px] h-[26px] rounded-lg bg-orange-500/15 border border-orange-500/50 text-orange-400 flex items-center justify-center shrink-0">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-[22px] font-extrabold text-white tracking-tight flex items-center space-x-1">
              <span>0</span>
              <span className="text-orange-500 text-xs">🔥</span>
            </div>
            <p className="text-[9.5px] text-[#cbd5e1] mt-0.5 font-medium flex items-center space-x-1 truncate">
              <TrendingUp className="w-3 h-3 text-orange-400 shrink-0" />
              <span className="truncate">Community upvotes</span>
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#0d0d16] border border-cyan-500/45 rounded-2xl p-3 min-h-[111px] flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.1em] leading-tight">
              INDIAN<br />LANGUAGES
            </span>
            <div className="w-[26px] h-[26px] rounded-lg bg-cyan-500/15 border border-cyan-500/50 text-cyan-400 flex items-center justify-center shrink-0">
              <Languages className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-[22px] font-extrabold text-white tracking-tight flex items-baseline space-x-1">
              <span>5</span>
              <span className="text-cyan-400 text-[13px] font-semibold">Regions</span>
            </div>
            <p className="text-[9.5px] text-[#cbd5e1] mt-0.5 font-medium truncate">
              Tamil • Telugu • Hindi
            </p>
          </div>
        </div>

      </div>

      {/* 4. Section Title (30px below cards) */}
      <div className="w-full mt-[30px] mb-3 space-y-3">
        <div className="flex items-center space-x-2 text-[12px] font-bold text-[#e5e7eb] uppercase tracking-[0.05em]">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>REGIONAL DUB AUDIO</span>
        </div>

        {/* 5. Language Chips (h39, 14px semibold, radius 14px) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none whitespace-nowrap">
          {REGIONAL_LANGUAGES.map((lang) => {
            const active = selectedLanguage === lang.value;
            return (
              <button
                key={lang.value}
                onClick={() => { setSelectedLanguage(lang.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className={`h-[39px] px-4 rounded-[14px] text-[14px] font-semibold transition-all shadow-sm flex items-center justify-center shrink-0 ${
                  active
                    ? 'bg-gradient-to-r from-[#6d4aff] to-[#7c3aed] text-white shadow-[0_0_15px_rgba(109,74,255,0.4)]'
                    : 'bg-[#12182f] border border-[#232b4a] text-[#e2e8f0] hover:bg-[#1a2240]'
                }`}
              >
                <span>{lang.label}</span>
              </button>
            );
          })}
        </div>

        {/* 6. Filters (h40, 13px medium, label 10px; SORT half-width) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          
          {/* Genre */}
          <div className="h-[40px] px-3 rounded-[12px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">GENRE</span>
              <select
                value={selectedGenre}
                onChange={(e) => { setSelectedGenre(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[13px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {GENRES.map(g => <option key={g} value={g} className="bg-slate-950 text-white">{g === 'All' ? 'All Genres' : g}</option>)}
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

          {/* Platform */}
          <div className="h-[40px] px-3 rounded-[12px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">PLATFORM</span>
              <select
                value={selectedPlatform}
                onChange={(e) => { setSelectedPlatform(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[13px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {PLATFORMS.map(p => <option key={p} value={p} className="bg-slate-950 text-white">{p}</option>)}
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

          {/* Type */}
          <div className="h-[40px] px-3 rounded-[12px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">TYPE</span>
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[13px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {TYPES.map(t => <option key={t} value={t} className="bg-slate-950 text-white">{t}</option>)}
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

          {/* Status */}
          <div className="h-[40px] px-3 rounded-[12px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">STATUS</span>
              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[13px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {STATUSES.map(s => <option key={s} value={s} className="bg-slate-950 text-white">{s === 'All' ? 'All Status' : s}</option>)}
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

          {/* Sort (half-width) */}
          <div className="h-[40px] px-3 rounded-[12px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group col-span-1">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">SORT</span>
              <select
                value={selectedSort}
                onChange={(e) => { setSelectedSort(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[13px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {SORTS.map(s => <option key={s.value} value={s.value} className="bg-slate-950 text-white">{s.label}</option>)}
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

        </div>
      </div>

      {/* 7. Catalog List Grid */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4 text-xs text-slate-400">
          <span className="flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Showing <strong className="text-white">{filteredList.length}</strong> Titles</span>
          </span>
          <span>2 Columns • Smooth 60fps</span>
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
          <div className="grid grid-cols-2 gap-3.5">
            {paginatedAnime.map((anime) => {
              const isWatchlisted = watchlist.includes(anime.id);
              const langs = (anime.languages || 'HIN,TAM,TEL').split(',');

              return (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime)}
                  className="group bg-[#0e1222] border border-[#1e2338] hover:border-purple-500/50 rounded-[20px] overflow-hidden shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  {/* Vertical cover image */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e1222] via-transparent to-black/30" />

                    {/* Top-Left Overlays */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col items-start space-y-1 z-10">
                      <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-extrabold flex items-center space-x-1 shadow-md">
                        <Flame className="w-3 h-3 text-amber-300" />
                        <span>TRENDING</span>
                      </div>
                      <div className="px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 text-[9px] font-extrabold flex items-center space-x-1 shadow-md">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Offline Ready</span>
                      </div>
                    </div>

                    {/* Top-Right Overlays */}
                    <div className="absolute top-2.5 right-2.5 flex items-center space-x-1 z-10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); }} 
                        className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Cloud / Download"
                      >
                        <Cloud className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); }} 
                        className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Report / Flag"
                      >
                        <Flag className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime.id); }}
                        className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Bookmark"
                      >
                        <Bookmark className={`w-3 h-3 ${isWatchlisted ? 'text-orange-400 fill-orange-500/45' : 'text-slate-300'}`} />
                      </button>
                    </div>

                    {/* Bottom-Left Rating */}
                    <div className="absolute bottom-2.5 left-2.5 flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md text-amber-400 text-[10px] font-bold border border-amber-500/30 shadow-md">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{anime.rating}/10</span>
                    </div>
                  </div>

                  {/* Below Image Content */}
                  <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Language small pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
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

                      {/* Title */}
                      <h3 className="font-bold text-white text-xs sm:text-sm line-clamp-2 group-hover:text-orange-400 transition-colors leading-snug">
                        {anime.title}
                      </h3>
                    </div>

                    {/* Footer Row */}
                    <div className="pt-2 border-t border-[#1c2236] flex items-center justify-between text-[11px] text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] font-semibold text-slate-300">
                        {anime.platform || 'Crunchyroll'}
                      </span>
                      <span className="text-purple-400 font-semibold group-hover:underline">
                        Details →
                      </span>
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
