import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Tv, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Bookmark, 
  Dices, 
  Layers, 
  Languages, 
  Flame, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  Cloud,
  Flag,
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
    <div className="w-full max-w-[420px] mx-auto px-[11px] overflow-x-hidden font-['Inter',sans-serif] text-slate-100">
      
      {/* 2. Hero Section (exact margins: header > badge 41px) */}
      <div className="text-center pt-[41px] max-w-2xl mx-auto">
        
        {/* Badge pill (~234px wide, h30, px14) */}
        <div className="inline-flex items-center space-x-1.5 px-[14px] h-[30px] rounded-full bg-[rgba(76,29,149,0.8)] border border-[rgba(109,40,217,0.7)] text-[#c4b5fd] text-[10px] font-medium shadow-sm">
          <Sparkles className="w-[13px] h-[13px] text-[#c4b5fd] shrink-0" />
          <span>Official Indian Dubbed Anime Directory</span>
        </div>

        {/* Label (badge > label 20px) */}
        <div className="text-[15px] font-bold text-[#ff5a1f] tracking-[0.08em] uppercase mt-[20px]" style={{ lineHeight: '19px' }}>
          ANIDUB INDIA OFFICIAL WEBSITE
        </div>

        {/* H1 Title (label > H1 14px) */}
        <h1 className="text-[22px] font-extrabold tracking-[-0.04em] px-[10px] mt-[14px]" style={{ lineHeight: '32px' }}>
          <span className="text-white block">The Premier Destination for</span>
          <span className="bg-gradient-to-r from-[#9333ea] to-[#6366f1] bg-clip-text text-transparent block whitespace-nowrap">
            Anime Streaming & Dubbing in India
          </span>
        </h1>

        {/* Paragraph (H1 > paragraph 17px, max-w-[372px], 11px, line-height 19.5px) */}
        <p className="text-[11px] text-[#cbd5e1] max-w-[372px] mx-auto font-normal mt-[17px] text-center" style={{ lineHeight: '19.5px' }}>
          Discover officially dubbed anime in Tamil, Telugu, Hindi, Malayalam, and Kannada — streaming legally on Crunchyroll, Netflix, JioHotstar, and JioCinema.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col items-center">
          {/* Button 1 (paragraph > button 1 20px, h40, px21, gap 8px, ~285px wide) */}
          <button
            onClick={onOpenRoulette}
            className="inline-flex items-center justify-center h-[40px] px-[21px] rounded-full bg-gradient-to-r from-[#ff8a00] via-[#ff6a00] to-[#9333ea] hover:opacity-95 text-white font-semibold text-[11px] shadow-[0_0_20px_rgba(255,106,0,0.35)] transition-all cursor-pointer space-x-2 mt-[20px]"
          >
            <Dices className="w-[14px] h-[14px] text-white shrink-0" />
            <span>Surprise Me Roulette</span>
            <span className="inline-flex items-center space-x-1 h-[18px] px-[8px] rounded-full bg-[rgba(30,10,60,0.45)] border border-[rgba(255,255,255,0.2)] text-[#fde68a] text-[9px] font-bold uppercase tracking-[0.05em] ml-1">
              <span>🎲</span>
              <span>RANDOM PICK</span>
            </span>
          </button>

          {/* Button 2 (button 1 > button 2 12px, h40, px22, gap 8px, ~239px wide) */}
          <button
            onClick={onOpenCollection}
            className="inline-flex items-center justify-center h-[40px] px-[22px] rounded-full bg-[#141418] hover:bg-[#1a1a20] text-white font-medium text-[11px] border border-[#2a2a33] transition-all cursor-pointer space-x-2 mt-[12px]"
          >
            <Layers className="w-[14px] h-[14px] text-white shrink-0" />
            <span>Create Collection</span>
            <span className="inline-flex items-center h-[19px] px-[7px] rounded-full bg-transparent border border-[#8b5cf6] text-[#a78bfa] text-[9px] font-bold uppercase ml-1">
              SHAREABLE
            </span>
          </button>
        </div>
      </div>

      {/* 3. Stat Cards (button 2 > stat cards 26px, padding 11px, gap 9px, 3 cards ~127px x 92px) */}
      <div className="grid grid-cols-3 gap-[9px] w-full mt-[26px]">
        
        {/* Card 1 */}
        <div className="bg-[#0d0d16] border-2 border-[#e9e5ff] rounded-[14px] p-[10px] min-h-[92px] flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between">
            <span className="text-[8px] font-semibold text-[#9ca3af] uppercase tracking-[0.08em]" style={{ lineHeight: 1.25 }}>
              DUBBED TITLES
            </span>
            <div className="w-[20px] h-[20px] rounded-[6px] bg-purple-500/15 border-[1.5px] border-purple-500/50 text-purple-400 flex items-center justify-center shrink-0">
              <Tv className="w-[11px] h-[11px]" />
            </div>
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-white tracking-tight flex items-baseline">
              <span>124</span>
              <span className="text-purple-400 text-[10px] font-bold ml-0.5">+</span>
            </div>
            <p className="text-[8px] text-[#cbd5e1] mt-[6px] font-normal flex items-center space-x-1 truncate">
              <CheckCircle2 className="w-[9px] h-[9px] text-emerald-400 shrink-0" />
              <span className="truncate">Verified dubs</span>
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#0d0d16] border-[1.5px] border-orange-500/45 rounded-[14px] p-[10px] min-h-[92px] flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between">
            <span className="text-[8px] font-semibold text-[#9ca3af] uppercase tracking-[0.08em]" style={{ lineHeight: 1.25 }}>
              COMMUNITY<br />VOTES
            </span>
            <div className="w-[20px] h-[20px] rounded-[6px] bg-orange-500/15 border-[1.5px] border-orange-500/50 text-orange-400 flex items-center justify-center shrink-0">
              <Flame className="w-[11px] h-[11px]" />
            </div>
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-white tracking-tight flex items-center space-x-1">
              <span>0</span>
              <span className="text-orange-500 text-[11px]">🔥</span>
            </div>
            <p className="text-[8px] text-[#cbd5e1] mt-[6px] font-normal flex items-center space-x-1 truncate">
              <TrendingUp className="w-[9px] h-[9px] text-orange-400 shrink-0" />
              <span className="truncate">Community upvotes</span>
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#0d0d16] border-[1.5px] border-cyan-500/45 rounded-[14px] p-[10px] min-h-[92px] flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between">
            <span className="text-[8px] font-semibold text-[#9ca3af] uppercase tracking-[0.08em]" style={{ lineHeight: 1.25 }}>
              INDIAN<br />LANGUAGES
            </span>
            <div className="w-[20px] h-[20px] rounded-[6px] bg-cyan-500/15 border-[1.5px] border-cyan-500/50 text-cyan-400 flex items-center justify-center shrink-0">
              <Languages className="w-[11px] h-[11px]" />
            </div>
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-white tracking-tight flex items-baseline space-x-1">
              <span>5</span>
              <span className="text-[#22d3ee] text-[10px] font-semibold">Regions</span>
            </div>
            <p className="text-[8px] text-[#cbd5e1] mt-[6px] font-normal truncate">
              Tamil • Telugu • Hindi
            </p>
          </div>
        </div>

      </div>

      {/* 4. Section Title (22px below cards, side padding 16px, line box 20px) */}
      <div className="w-full mt-[22px] px-[16px]">
        <div className="flex items-center h-[20px] space-x-[8px] text-[10px] font-bold text-[#e5e7eb] uppercase tracking-[0.05em]">
          <Sparkles className="w-[14px] h-[14px] text-purple-400 shrink-0" />
          <span>REGIONAL DUB AUDIO</span>
        </div>

        {/* 5. Chips (8px below title, side padding 12px, gap 9px, h32, px15, radius 12px, 11.5px semibold) */}
        <div className="flex items-center gap-[9px] overflow-x-auto pb-1 pt-[8px] scrollbar-none whitespace-nowrap px-[12px]">
          {REGIONAL_LANGUAGES.map((lang) => {
            const active = selectedLanguage === lang.value;
            return (
              <button
                key={lang.value}
                onClick={() => { setSelectedLanguage(lang.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className={`h-[32px] px-[15px] rounded-[12px] text-[11.5px] font-semibold transition-all shadow-sm flex items-center justify-center shrink-0 ${
                  active
                    ? 'bg-gradient-to-r from-[#6d4aff] to-[#7c3aed] text-white shadow-[0_0_12px_rgba(109,74,255,0.4)]'
                    : 'bg-[#12182f] border border-[#232b4a] text-[#e2e8f0] hover:bg-[#1a2240]'
                }`}
              >
                <span>{lang.label}</span>
              </button>
            );
          })}
        </div>

        {/* 6. Filters (25px below chips, side padding 12px, gap 8px, SORT half width. h33, px11, radius 16px, label 8.5px, value 12px) */}
        <div className="grid grid-cols-2 gap-[8px] px-[12px] pt-[25px]">
          
          {/* Genre */}
          <div className="h-[33px] px-[11px] rounded-[16px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[8.5px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">GENRE</span>
              <select
                value={selectedGenre}
                onChange={(e) => { setSelectedGenre(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[12px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {GENRES.map(g => <option key={g} value={g} className="bg-slate-950 text-white">{g === 'All' ? 'All Genres' : g}</option>)}
              </select>
            </div>
            <ChevronDown className="w-[14px] h-[14px] text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

          {/* Platform */}
          <div className="h-[33px] px-[11px] rounded-[16px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[8.5px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">PLATFORM</span>
              <select
                value={selectedPlatform}
                onChange={(e) => { setSelectedPlatform(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[12px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {PLATFORMS.map(p => <option key={p} value={p} className="bg-slate-950 text-white">{p}</option>)}
              </select>
            </div>
            <ChevronDown className="w-[14px] h-[14px] text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

          {/* Type */}
          <div className="h-[33px] px-[11px] rounded-[16px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[8.5px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">TYPE</span>
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[12px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {TYPES.map(t => <option key={t} value={t} className="bg-slate-950 text-white">{t}</option>)}
              </select>
            </div>
            <ChevronDown className="w-[14px] h-[14px] text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

          {/* Status */}
          <div className="h-[33px] px-[11px] rounded-[16px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[8.5px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">STATUS</span>
              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[12px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {STATUSES.map(s => <option key={s} value={s} className="bg-slate-950 text-white">{s === 'All' ? 'All Status' : s}</option>)}
              </select>
            </div>
            <ChevronDown className="w-[14px] h-[14px] text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

          {/* Sort (half width, col-span-1) */}
          <div className="h-[33px] px-[11px] rounded-[16px] bg-[#0e1327] border border-[#1d2542] flex items-center justify-between cursor-pointer group col-span-1">
            <div className="flex items-center space-x-1.5 w-full overflow-hidden">
              <span className="text-[8.5px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">SORT</span>
              <select
                value={selectedSort}
                onChange={(e) => { setSelectedSort(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-[12px] font-medium text-white focus:outline-none cursor-pointer appearance-none truncate w-full"
              >
                {SORTS.map(s => <option key={s.value} value={s.value} className="bg-slate-950 text-white">{s.label}</option>)}
              </select>
            </div>
            <ChevronDown className="w-[14px] h-[14px] text-slate-400 group-hover:text-purple-400 pointer-events-none shrink-0 ml-1" />
          </div>

        </div>
      </div>

      {/* 7. Catalog List Grid */}
      <div className="pt-4 px-[12px]">
        <div className="flex items-center justify-between mb-3 text-[11px] text-slate-400">
          <span className="flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Showing <strong className="text-white">{filteredList.length}</strong> Titles</span>
          </span>
          <span>2 Columns</span>
        </div>

        {paginatedAnime.length === 0 ? (
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
          <div className="grid grid-cols-2 gap-3">
            {paginatedAnime.map((anime) => {
              const isWatchlisted = watchlist.includes(anime.id);
              const langs = (anime.languages || 'HIN,TAM,TEL').split(',');

              return (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime)}
                  className="group bg-[#0e1222] border border-[#1e2338] hover:border-purple-500/50 rounded-[16px] overflow-hidden shadow-lg transition-all duration-300 flex flex-col justify-between cursor-pointer"
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
                    <div className="absolute top-2 left-2 flex flex-col items-start space-y-1 z-10">
                      <div className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[8px] font-extrabold flex items-center space-x-0.5 shadow-md">
                        <Flame className="w-2.5 h-2.5 text-amber-300" />
                        <span>TRENDING</span>
                      </div>
                    </div>

                    {/* Top-Right Overlays */}
                    <div className="absolute top-2 right-2 flex items-center space-x-1 z-10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); }} 
                        className="w-5 h-5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Cloud"
                      >
                        <Cloud className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime.id); }}
                        className="w-5 h-5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md"
                        title="Bookmark"
                      >
                        <Bookmark className={`w-2.5 h-2.5 ${isWatchlisted ? 'text-orange-400 fill-orange-500/45' : 'text-slate-300'}`} />
                      </button>
                    </div>

                    {/* Bottom-Left Rating */}
                    <div className="absolute bottom-2 left-2 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md text-amber-400 text-[9.5px] font-bold border border-amber-500/30 shadow-md">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      <span>{anime.rating}/10</span>
                    </div>
                  </div>

                  {/* Below Image Content */}
                  <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Language small pills */}
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        {langs.map((l) => (
                          <span
                            key={l}
                            className={`px-1 py-0.5 rounded text-[9px] font-black tracking-wide ${
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
                      <h3 className="font-bold text-white text-[11px] line-clamp-2 group-hover:text-orange-400 transition-colors leading-snug">
                        {anime.title}
                      </h3>
                    </div>

                    {/* Footer Row */}
                    <div className="pt-1.5 border-t border-[#1c2236] flex items-center justify-between text-[10px] text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-[9px] font-semibold text-slate-300">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 shadow-xl mt-6">
          <div className="text-[11px] text-slate-400">
            Page <span className="font-bold text-slate-200">{currentPage}</span> of <span className="font-bold text-slate-200">{totalPages}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
              disabled={currentPage === 1}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.page + 1, totalPages) }))}
              disabled={currentPage === totalPages}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
