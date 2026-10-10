'use client';

import React from 'react';
import { 
  RotateCcw, 
  Sparkles, 
  SlidersHorizontal,
  X,
  Filter
} from 'lucide-react';
import { ALL_GENRES, ALL_TYPES, ALL_STATUSES, ALL_LANGUAGES, ALL_PLATFORMS } from '../data/animeData';
import { SupportedLanguage, translate } from '../utils/i18n';

interface FilterBarProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  selectedGenre: string;
  setSelectedGenre: (genre: string) => void;
  selectedPlatform?: string;
  setSelectedPlatform?: (platform: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  totalFiltered: number;
  totalAvailable?: number;
  languageCounts?: Record<string, number>;
  isLoading?: boolean;
  onReset: () => void;
  uiLanguage?: SupportedLanguage;
}

export const FilterBar: React.FC<FilterBarProps> = React.memo(({
  searchQuery = '',
  setSearchQuery,
  selectedLanguage,
  setSelectedLanguage,
  selectedGenre,
  setSelectedGenre,
  selectedPlatform = 'All Platforms',
  setSelectedPlatform,
  selectedType,
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
  sortBy,
  setSortBy,
  totalFiltered,
  totalAvailable = 0,
  languageCounts = {},
  onReset,
  uiLanguage = 'en',
}) => {
  const lang = uiLanguage || 'en';

  const activeFiltersCount = [
    searchQuery.trim() !== '',
    selectedLanguage !== 'All',
    selectedGenre !== 'All Genres',
    selectedPlatform !== 'All Platforms',
    selectedType !== 'All Types',
    selectedStatus !== 'All',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFiltersCount > 0 || (sortBy !== 'Most Upvoted' && sortBy !== 'Newest');

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 mb-8 space-y-4 box-border min-w-0">
      
      {/* Active Search Query Filter Feedback Chip (if searching from top navbar) */}
      {searchQuery.trim() !== '' && (
        <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-[var(--primary-badge)]/25 border border-primary-theme/30 text-xs text-neutral-200">
          <div className="flex items-center gap-2 truncate">
            <Filter className="w-3.5 h-3.5 text-accent-theme shrink-0" />
            <span className="truncate">
              Searching for: <strong className="text-white">&quot;{searchQuery}&quot;</strong> ({totalFiltered} {totalFiltered === 1 ? 'title' : 'titles'} found)
            </span>
          </div>
          {setSearchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-neutral-400 hover:text-white flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      )}

      {/* Language Filter Pills with Dynamic Counts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1">
          <span className="flex items-center gap-1.5 text-neutral-300">
            <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
            {translate('regionalDubAudio', lang)}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="text-primary-theme hover:underline flex items-center gap-1 text-[11px] font-bold lowercase tracking-normal active:scale-95 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{translate('resetFilters', lang)}</span>
            </button>
          )}
        </div>

        {/* Scrollable Regional Dub Language Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none w-full max-w-full">
          {ALL_LANGUAGES.map((langItem, idx) => {
            const isSelected = selectedLanguage === langItem.name;
            const count = langItem.name === 'All' ? totalAvailable : languageCounts[langItem.name];

            return (
              <button
                key={`${langItem.name}-${idx}`}
                type="button"
                onClick={() => setSelectedLanguage(langItem.name)}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer flex items-center gap-2 active:scale-95 ${
                  isSelected
                    ? 'active-tab-theme text-white shadow-primary-theme ring-2 ring-accent-theme'
                    : 'bg-[#141b2c] text-neutral-300 hover:text-white hover:bg-[#1c253d] border border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <span>{langItem.name}</span>
                {count !== undefined && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? 'bg-[var(--primary-badge)] text-white' : 'bg-[#0f1422] text-neutral-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Multi-Filtering Row: Genre, Platform, Type, Status, Sort */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 pt-1 w-full box-border">
        {/* Genre Filter */}
        <div className={`flex items-center gap-1.5 sm:gap-2 bg-[#121829] border rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-xs transition-colors min-w-0 overflow-hidden ${
          selectedGenre !== 'All Genres' ? 'border-primary-theme bg-[var(--primary-badge)]/20' : 'border-neutral-800 hover:border-neutral-700'
        }`}>
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0">
            Genre
          </span>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full min-w-0 bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate text-xs"
          >
            {ALL_GENRES.map((g) => (
              <option key={g} value={g} className="bg-[#121829] text-neutral-200">
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Platform Filter */}
        <div className={`flex items-center gap-1.5 sm:gap-2 bg-[#121829] border rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-xs transition-colors min-w-0 overflow-hidden ${
          selectedPlatform !== 'All Platforms' ? 'border-primary-theme bg-[var(--primary-badge)]/20' : 'border-neutral-800 hover:border-neutral-700'
        }`}>
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0">
            Platform
          </span>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform && setSelectedPlatform(e.target.value)}
            className="w-full min-w-0 bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate text-xs"
          >
            {ALL_PLATFORMS.map((p) => (
              <option key={p} value={p} className="bg-[#121829] text-neutral-200">
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className={`flex items-center gap-1.5 sm:gap-2 bg-[#121829] border rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-xs transition-colors min-w-0 overflow-hidden ${
          selectedType !== 'All Types' ? 'border-primary-theme bg-[var(--primary-badge)]/20' : 'border-neutral-800 hover:border-neutral-700'
        }`}>
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0">
            Type
          </span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full min-w-0 bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate text-xs"
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#121829] text-neutral-200">
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Airing Status Filter */}
        <div className={`flex items-center gap-1.5 sm:gap-2 bg-[#121829] border rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-xs transition-colors min-w-0 overflow-hidden ${
          selectedStatus !== 'All' ? 'border-primary-theme bg-[var(--primary-badge)]/20' : 'border-neutral-800 hover:border-neutral-700'
        }`}>
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0">
            Status
          </span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full min-w-0 bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate text-xs"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[#121829] text-neutral-200">
                {s === 'All' ? 'All Status' : s}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[#121829] border border-neutral-800 hover:border-neutral-700 rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-xs transition-colors min-w-0 overflow-hidden">
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0">
            Sort
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full min-w-0 bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate text-xs"
          >
            <option value="Most Upvoted" className="bg-[#121829] text-neutral-200">🔥 Most Upvoted</option>
            <option value="Newest" className="bg-[#121829] text-neutral-200">Newest (Year)</option>
            <option value="Oldest" className="bg-[#121829] text-neutral-200">Oldest</option>
            <option value="Highest Rated" className="bg-[#121829] text-neutral-200">★ Highest Rated</option>
            <option value="Title (A-Z)" className="bg-[#121829] text-neutral-200">Title (A-Z)</option>
          </select>
        </div>
      </div>

    </div>
  );
});

export default FilterBar;
