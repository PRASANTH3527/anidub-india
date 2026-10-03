import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, SlidersHorizontal, RotateCcw, Sparkles, Flame, Filter, Mic, MicOff, Star, PlayCircle } from 'lucide-react';
import { ALL_GENRES, ALL_TYPES, ALL_STATUSES, ALL_LANGUAGES } from '../data/animeData';
import { useToast } from './Toast';
import { SupportedLanguage, translate } from '../utils/i18n';
import { AnimeRecord } from '../types/database';
import { useDebounce } from '../hooks/useDebounce';

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
  totalAvailable?: number;
  languageCounts?: Record<string, number>;
  isLoading?: boolean;
  onReset: () => void;
  uiLanguage?: SupportedLanguage;
  feedView?: 'directory' | 'foryou';
  setFeedView?: (view: 'directory' | 'foryou') => void;
  allAnime?: AnimeRecord[];
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
  totalAvailable = 0,
  languageCounts = {},
  isLoading,
  onReset,
  uiLanguage = 'en',
  feedView = 'directory',
  setFeedView,
  allAnime = [],
}) => {
  const toast = useToast();
  const lang = uiLanguage || 'en';
  const [isListening, setIsListening] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 500);

  const recognitionRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal search with parent prop (for resets)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Update parent when debounced value changes
  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch]);

  // Live Results for Dropdown (Netflix-level: Fetch results based on debounced search to prevent excessive "API" calls)
  const liveResults = useMemo(() => {
    if (!debouncedSearch.trim() || debouncedSearch.length < 2) return [];
    const query = debouncedSearch.toLowerCase().trim();
    return allAnime.filter(anime => 
      anime.title.toLowerCase().includes(query) || 
      anime.romajiTitle?.toLowerCase().includes(query)
    ).slice(0, 6);
  }, [debouncedSearch, allAnime]);

  // Trending Suggestions logic
  const trendingSuggestions = useMemo(() => {
    return [...allAnime]
      .sort((a, b) => Number(b.likes || b.upvotes || 0) - Number(a.likes || a.upvotes || 0))
      .slice(0, 5);
  }, [allAnime]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleVoiceSearch = () => {
    if (typeof window === 'undefined') return;

    // Check for standard or webkit SpeechRecognition
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      toast.info(
        'Voice Search Unsupported',
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Optimized for Indian English/Hindi anime pronunciation

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Listening...', 'Speak now to search anime titles!');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          const cleanText = transcript.trim();
          setSearchQuery(cleanText);
          toast.success('Voice Recognized', `Searching for: "${cleanText}"`);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          toast.info('Voice Search', 'Could not detect voice. Please try again or type directly.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      setIsListening(false);
      toast.info('Voice Search Error', 'Microphone access could not be started.');
    }
  };

  const activeFiltersCount = [
    searchQuery.trim() !== '',
    selectedLanguage !== 'All',
    selectedGenre !== 'All Genres',
    selectedType !== 'All Types',
    selectedStatus !== 'All',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFiltersCount > 0 || (sortBy !== 'Most Upvoted' && sortBy !== 'Newest');

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-6 space-y-4">
      {/* Homepage Feed Selector: All Dubs Directory vs Smart 'For You' */}
      {setFeedView && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-neutral-800/60">
          <div className="flex items-center p-1 rounded-2xl bg-[#0e1422] border border-neutral-800/80 shadow-inner">
            <button
              onClick={() => setFeedView('directory')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                feedView === 'directory'
                  ? 'btn-primary-theme shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>{translate('navDirectory', lang)}</span>
              <span className="text-[10px] opacity-75 font-semibold">({totalAvailable})</span>
            </button>

            <button
              onClick={() => setFeedView('foryou')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                feedView === 'foryou'
                  ? 'btn-primary-theme shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
              <span>{translate('navForYou', lang)}</span>
            </button>
          </div>

          {/* Mobile Swipe Gesture Hint Pill */}
          <div className="text-[11px] text-neutral-400 font-medium bg-[#121829] px-3 py-1.5 rounded-xl border border-neutral-800 flex items-center gap-1">
            <span>{translate('swipeHint', lang)}</span>
          </div>
        </div>
      )}

      {/* Search Bar Container */}
      <div className="relative group" ref={dropdownRef}>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-purple-400 transition-colors">
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <input
          type="text"
          value={localSearch}
          onFocus={() => setShowDropdown(true)}
          onChange={(e) => {
            setLocalSearch(e.target.value);
            if (!showDropdown) setShowDropdown(true);
          }}
          placeholder={
            isListening
              ? translate('searchListening', lang)
              : translate('searchPlaceholder', lang)
          }
          className={`w-full bg-[#121829]/95 border rounded-2xl py-3.5 sm:py-4 pl-11 sm:pl-12 pr-24 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all duration-200 shadow-xl backdrop-blur-md ${
            isListening
              ? 'border-rose-500 ring-4 ring-rose-500/25 bg-rose-950/20'
              : 'border-neutral-700/80 group-hover:border-neutral-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
          }`}
        />

        {/* Live Search & Trending Dropdown */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#121829]/98 border border-neutral-700/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl">
            {localSearch.trim().length >= 2 ? (
              <>
                <div className="p-3 bg-purple-950/30 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-200">Matching Titles</span>
                  </div>
                  <span className="text-[9px] text-neutral-500 font-bold uppercase">{liveResults.length} Results</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/50">
                  {liveResults.length > 0 ? (
                    liveResults.map((anime) => (
                      <div
                        key={anime.id}
                        onClick={() => {
                          setLocalSearch(anime.title);
                          setShowDropdown(false);
                        }}
                        className="flex items-center gap-3 p-3 hover:bg-purple-600/10 cursor-pointer group transition-colors"
                      >
                        <div className="relative w-10 h-14 rounded-lg overflow-hidden border border-neutral-700 shrink-0">
                          <img src={anime.poster} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                        </div>
                        <div className="min-w-0 flex-grow">
                          <p className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">{anime.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-neutral-400">{anime.type} • {anime.releaseYear}</span>
                            <div className="flex items-center gap-0.5 text-orange-500 font-black text-[9px]">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              {anime.rating || '8.0'}
                            </div>
                          </div>
                          <div className="flex gap-1 mt-1">
                            {anime.dubs?.slice(0, 2).map(d => (
                              <span key={d} className="text-[8px] px-1 py-0.2 bg-neutral-800 text-neutral-400 rounded border border-neutral-700">{d}</span>
                            ))}
                          </div>
                        </div>
                        <PlayCircle className="w-5 h-5 text-neutral-600 group-hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100" />
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Search className="w-8 h-8 text-neutral-700 mx-auto mb-2 opacity-20" />
                      <p className="text-xs text-neutral-500 font-medium">No matches found for "{localSearch}"</p>
                    </div>
                  )}
                </div>
              </>
            ) : trendingSuggestions.length > 0 && (
              <>
                <div className="p-3 bg-purple-950/30 border-b border-neutral-800 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-200">Trending Right Now</span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-neutral-800/50">
                  {trendingSuggestions.map((anime: AnimeRecord) => (
                    <div
                      key={anime.id}
                      onClick={() => {
                        setLocalSearch(anime.title);
                        setShowDropdown(false);
                      }}
                      className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer group transition-colors"
                    >
                      <img src={anime.poster} className="w-8 h-10 object-cover rounded-lg border border-neutral-700 group-hover:border-purple-500/50" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">{anime.title}</p>
                        <p className="text-[10px] text-neutral-500">{anime.type} • {anime.releaseYear} • ★ {anime.rating || '8.0'}</p>
                      </div>
                      <div className="ml-auto text-[10px] font-black text-orange-500 flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        {anime.likes || anime.upvotes || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Right Search Bar Action Controls */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="text-neutral-400 hover:text-white p-1.5 rounded-xl hover:bg-neutral-800/80 active:scale-90 transition-all cursor-pointer"
              title="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Native Voice Search Button */}
          <button
            type="button"
            onClick={toggleVoiceSearch}
            className={`p-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 flex items-center justify-center ${
              isListening
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-2 ring-rose-400 animate-pulse'
                : 'text-neutral-400 hover:text-purple-300 hover:bg-neutral-800/80'
            }`}
            title={isListening ? 'Listening to speech... click to stop' : 'Search with your voice'}
            aria-label="Voice Search"
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Language Filter Pills with Dynamic Counts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1">
          <span className="flex items-center gap-1.5 text-neutral-300">
            <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
            {translate('regionalDubAudio', lang)}
          </span>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="text-primary-theme hover:underline flex items-center gap-1 text-[11px] font-bold lowercase tracking-normal active:scale-95 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{translate('resetFilters', lang)}</span>
            </button>
          )}
        </div>

        {/* Scrollable Language Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          {ALL_LANGUAGES.map((langItem) => {
            const isSelected = selectedLanguage === langItem.name;
            const count = langItem.name === 'All' ? totalAvailable : languageCounts[langItem.name];

            return (
              <button
                key={langItem.name}
                onClick={() => setSelectedLanguage(langItem.name)}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer flex items-center gap-2 active:scale-95 ${
                  isSelected
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/40'
                    : 'bg-[#141b2c] text-neutral-300 hover:text-white hover:bg-[#1c253d] border border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <span>{langItem.name}</span>
                {count !== undefined && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? 'bg-purple-800 text-white' : 'bg-[#0f1422] text-neutral-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Multi-Filtering Row: Genre AND Type AND Status AND Sort Simultaneously */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        {/* Genre Filter */}
        <div className={`flex items-center gap-2 bg-[#121829] border rounded-xl px-3 py-2 text-xs transition-colors ${
          selectedGenre !== 'All Genres' ? 'border-purple-500/70 bg-purple-950/20' : 'border-neutral-800 hover:border-neutral-700'
        }`}>
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0">
            Genre
          </span>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate"
          >
            {ALL_GENRES.map((g) => (
              <option key={g} value={g} className="bg-[#121829] text-neutral-200">
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className={`flex items-center gap-2 bg-[#121829] border rounded-xl px-3 py-2 text-xs transition-colors ${
          selectedType !== 'All Types' ? 'border-purple-500/70 bg-purple-950/20' : 'border-neutral-800 hover:border-neutral-700'
        }`}>
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0">
            Type
          </span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer"
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#121829] text-neutral-200">
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Airing Status Filter */}
        <div className={`flex items-center gap-2 bg-[#121829] border rounded-xl px-3 py-2 text-xs transition-colors ${
          selectedStatus !== 'All' ? 'border-purple-500/70 bg-purple-950/20' : 'border-neutral-800 hover:border-neutral-700'
        }`}>
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0">
            Status
          </span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[#121829] text-neutral-200">
                {s === 'All' ? 'All Status' : s}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order: Most Upvoted, Newest, Oldest, Highest Rated, Title A-Z */}
        <div className="flex items-center gap-2 bg-[#121829] border border-neutral-800 hover:border-neutral-700 rounded-xl px-3 py-2 text-xs transition-colors">
          <span className="text-neutral-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider shrink-0 flex items-center gap-1">
            Sort
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate"
          >
            <option value="Most Upvoted" className="bg-[#121829] text-neutral-200">🔥 Most Upvoted</option>
            <option value="Newest" className="bg-[#121829] text-neutral-200">Newest (Year)</option>
            <option value="Oldest" className="bg-[#121829] text-neutral-200">Oldest (Year)</option>
            <option value="Highest Rated" className="bg-[#121829] text-neutral-200">Highest Rated ★</option>
            <option value="Recently Added" className="bg-[#121829] text-neutral-200">Recently Added</option>
            <option value="Title A-Z" className="bg-[#121829] text-neutral-200">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Meta Bar: Results count & Active Combined Filters Summary */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs px-1">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-neutral-400 animate-pulse font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              Filtering live catalog...
            </span>
          ) : (
            <span className="text-neutral-400 font-medium">
              Showing <strong className="text-white font-bold">{totalFiltered}</strong> {totalFiltered === 1 ? 'anime' : 'anime titles'}
              {selectedLanguage !== 'All' && (
                <span className="text-purple-300"> with <strong className="text-purple-200">{selectedLanguage}</strong> dub</span>
              )}
            </span>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/30">
            <Filter className="w-3 h-3 text-amber-400" />
            <span>{activeFiltersCount} {activeFiltersCount === 1 ? 'filter' : 'filters'} active</span>
          </span>
        )}
      </div>
    </div>
  );
};
