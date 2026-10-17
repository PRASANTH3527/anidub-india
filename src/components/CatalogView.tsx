import React, { useState, useEffect } from 'react';
import { Star, Tv, Filter, ChevronLeft, ChevronRight, Play, Bookmark, ArrowUpDown, Loader2 } from 'lucide-react';
import { HeroBanner } from './HeroBanner';

interface Anime {
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
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CatalogViewProps {
  onSelectAnime: (anime: Anime) => void;
  onPlayAnime: (anime: Anime) => void;
  searchQuery: string;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
}

const GENRES = ['All', 'Action', 'Sci-Fi', 'Fantasy', 'Romance', 'Drama', 'Adventure', 'Mystery', 'Mecha', 'Slice of Life'];
const STATUSES = ['All', 'Airing', 'Completed'];
const SORTS = [
  { label: 'Most Popular', value: 'popularity' },
  { label: 'Highest Rated', value: 'rating' },
  { label: 'Newest Release', value: 'newest' },
  { label: 'Title (A-Z)', value: 'title' },
];

export const CatalogView: React.FC<CatalogViewProps> = ({
  onSelectAnime,
  onPlayAnime,
  searchQuery,
  watchlist,
  onToggleWatchlist
}) => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSort, setSelectedSort] = useState('popularity');
  const [loading, setLoading] = useState(true);

  // Fetch catalog with pagination
  useEffect(() => {
    fetchCatalog();
  }, [pagination.page, selectedGenre, selectedStatus, selectedSort, searchQuery]);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '8',
        sort: selectedSort,
        ...(selectedGenre !== 'All' && { genre: selectedGenre }),
        ...(selectedStatus !== 'All' && { status: selectedStatus }),
        ...(searchQuery && { search: searchQuery }),
      });

      const res = await fetch(`/api/anime?${params.toString()}`);
      const data = await res.json();
      setAnimeList(data.data || []);
      setPagination(data.pagination || { page: 1, limit: 8, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch anime catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const featuredAnime = animeList.length > 0 ? animeList[0] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Banner for first anime when no search query is active */}
      {!searchQuery && selectedGenre === 'All' && pagination.page === 1 && featuredAnime && (
        <HeroBanner
          anime={featuredAnime}
          onSelectAnime={onSelectAnime}
          onPlayAnime={onPlayAnime}
        />
      )}

      {/* Filters & Controls */}
      <div className="space-y-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Genre Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => { setSelectedGenre(g); setPagination(prev => ({ ...prev, page: 1 })); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedGenre === g
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Status & Sort Dropdowns */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-orange-400" />
              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                {STATUSES.map(s => <option key={s} value={s} className="bg-slate-900">Status: {s}</option>)}
              </select>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-orange-400" />
              <select
                value={selectedSort}
                onChange={(e) => { setSelectedSort(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                {SORTS.map(s => <option key={s.value} value={s.value} className="bg-slate-900">{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-2">
            <span>Anime Catalog</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-orange-400 font-semibold">
              {pagination.total} Titles
            </span>
          </h2>
          {searchQuery && (
            <span className="text-xs text-slate-400">
              Showing search results for &ldquo;<span className="text-orange-400 font-medium">{searchQuery}</span>&rdquo;
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : animeList.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/50 rounded-2xl border border-slate-800">
            <p className="text-slate-400 text-sm">No anime found matching your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {animeList.map((anime) => {
              const isWatchlisted = watchlist.includes(anime.id);
              const genresList = anime.genres ? anime.genres.split(',') : [];

              return (
                <div
                  key={anime.id}
                  className="group bg-slate-900 rounded-2xl overflow-hidden border border-slate-800/80 hover:border-orange-500/50 transition-all duration-300 flex flex-col shadow-lg hover:shadow-orange-500/10 hover:-translate-y-1"
                >
                  {/* Poster Image Container */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-slate-950">
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center space-x-1">
                        <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                        {anime.rating}
                      </span>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime.id); }}
                      className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-colors ${
                        isWatchlisted ? 'bg-orange-600 text-white' : 'bg-slate-950/80 text-slate-300 hover:text-white'
                      }`}
                      title={isWatchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isWatchlisted ? 'fill-white' : ''}`} />
                    </button>

                    {/* Hover Play Overlay */}
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                      <button
                        onClick={() => onPlayAnime(anime)}
                        className="p-3.5 rounded-full bg-orange-600 text-white shadow-xl hover:scale-110 transition-transform"
                        title="Watch Episode"
                      >
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </button>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 font-medium">
                      <span className="flex items-center"><Tv className="w-3.5 h-3.5 mr-1 text-orange-400" /> {anime.episodes_count} Eps</span>
                      <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">{anime.status}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1 mb-1 text-[11px] text-slate-400 font-medium">
                        <span>{genresList[0]}</span>
                        <span>•</span>
                        <span>{anime.year}</span>
                      </div>
                      <h3
                        onClick={() => onSelectAnime(anime)}
                        className="font-bold text-slate-100 text-base font-['Space_Grotesk',sans-serif] line-clamp-1 hover:text-orange-400 cursor-pointer transition-colors"
                      >
                        {anime.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                        {anime.synopsis}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        onClick={() => onSelectAnime(anime)}
                        className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        View Details & Episodes →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4">
          <div className="text-xs text-slate-400">
            Showing page <span className="font-bold text-slate-200">{pagination.page}</span> of <span className="font-bold text-slate-200">{pagination.totalPages}</span> ({pagination.total} total items)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
              disabled={pagination.page === 1}
              className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition-colors ${
                    pagination.page === p
                      ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.page + 1, prev.totalPages) }))}
              disabled={pagination.page === pagination.totalPages}
              className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
