import React from 'react';
import { Search, X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { AnimeType, AnimeStatus, DubLanguage } from '../types/anime';
import { ALL_GENRES, ALL_TYPES, ALL_STATUSES, ALL_LANGUAGES } from '../data/animeData';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  selectedGenre: string;
  setSelectedGenre: (genre: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  totalFiltered: number;
  isLoading?: boolean;
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  selectedLanguage,
  setSelectedLanguage,
  selectedGenre,
  setSelectedGenre,
  selectedType,
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
  sortBy,
  setSortBy,
  totalFiltered,
  isLoading,
  onReset,
}) => {
  const hasActiveFilters = 
    searchQuery.trim() !== '' ||
    selectedLanguage !== 'All' ||
    selectedGenre !== 'All Genres' ||
    selectedType !== 'All Types' ||
    selectedStatus !== 'All' ||
    sortBy !== 'Recently Added';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mb-8 space-y-5">
      {/* Search Input Box */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search anime by name..."
          className="w-full bg-[#131926]/90 border border-neutral-700/80 focus:border-purple-500 rounded-xl py-3.5 pl-4 pr-12 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 shadow-md"
        />
        {searchQuery ? (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Language Filter Pills */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2.5">
          Language
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.name;
            return (
              <button
                key={lang.name}
                onClick={() => setSelectedLanguage(lang.name)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400/30'
                    : 'bg-[#171e2e] text-neutral-300 hover:bg-[#20293d] border border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {lang.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Dropdown Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Genre Filter */}
        <div className="flex items-center gap-2 bg-[#131926] border border-neutral-800 rounded-xl px-3 py-2 text-xs">
          <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider shrink-0">
            Genre
          </span>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full bg-transparent text-neutral-200 focus:outline-none cursor-pointer truncate"
          >
            {ALL_GENRES.map((g) => (
              <option key={g} value={g} className="bg-[#131926] text-neutral-200">
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 bg-[#131926] border border-neutral-800 rounded-xl px-3 py-2 text-xs">
          <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider shrink-0">
            Type
          </span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-transparent text-neutral-200 focus:outline-none cursor-pointer"
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#131926] text-neutral-200">
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 bg-[#131926] border border-neutral-800 rounded-xl px-3 py-2 text-xs">
          <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider shrink-0">
            Status
          </span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-transparent text-neutral-200 focus:outline-none cursor-pointer"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[#131926] text-neutral-200">
                {s === 'All' ? 'All Status' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Meta Bar: Results count & Sort */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-neutral-400 animate-pulse font-medium">Loading...</span>
          ) : (
            <span className="text-neutral-400 font-medium">
              <strong className="text-white font-bold">{totalFiltered}</strong> anime found
            </span>
          )}

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 ml-2 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#171e2e] text-neutral-200 border border-neutral-700/80 rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
          >
            <option value="Recently Added">Recently Added</option>
            <option value="Highest Rated">Highest Rated</option>
            <option value="Year (Newest)">Year (Newest)</option>
            <option value="Year (Oldest)">Year (Oldest)</option>
            <option value="Title (A-Z)">Title (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
