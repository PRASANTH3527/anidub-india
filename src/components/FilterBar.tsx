import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  RotateCcw, 
  Sparkles, 
  Flame, 
  Filter, 
  Mic, 
  MicOff, 
  Star, 
  PlayCircle,
  Loader2,
  ArrowRight,
  Compass,
  Film
} from 'lucide-react';
import { ALL_GENRES, ALL_TYPES, ALL_STATUSES, ALL_LANGUAGES, ALL_PLATFORMS } from '../data/animeData';
import { useToast } from './Toast';
import { SupportedLanguage, translate } from '../utils/i18n';
import { AnimeRecord } from '../types/database';
import { useDebounce } from '../hooks/useDebounce';
import { searchAnimeFuzzy } from '../utils/animeSearch';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
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
  feedView?: 'directory' | 'foryou';
  setFeedView?: (view: 'directory' | 'foryou') => void;
  allAnime?: AnimeRecord[];
  onSelectAnime?: (anime: AnimeRecord) => void;
}

export const FilterBar: React.FC<FilterBarProps> = React.memo(({
  searchQuery,
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
  isLoading,
  onReset,
  uiLanguage = 'en',
  feedView = 'directory',
  setFeedView,
  allAnime = [],
  onSelectAnime,
}) => {
  const toast = useToast();
  const lang = uiLanguage || 'en';
  const [isListening, setIsListening] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 220);
  const isTyping = localSearch.trim() !== debouncedSearch.trim();

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

  // Live Auto-Suggest Results powered by multi-field Fuzzy Search
  const liveResults = useMemo(() => {
    const trimmed = localSearch.trim();
    if (!trimmed || trimmed.length < 2) return [];
    return searchAnimeFuzzy(allAnime, trimmed, 8);
  }, [localSearch, allAnime]);

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
          setLocalSearch(cleanText);
          setSearchQuery(cleanText);
          setShowDropdown(true);
          toast.success('Voice Recognized', `Searching for: "${cleanText}"`);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        const err = event?.error;
        if (err === 'not-allowed' || err === 'permission-denied') {
          toast.info('Voice Search', 'Microphone access denied. Please allow microphone permission in your browser.');
        } else if (err === 'audio-capture') {
          toast.info('Voice Search', 'No microphone detected. Please check your audio input device.');
        } else if (err === 'network') {
          toast.info('Voice Search', 'Speech recognition network error. Please check your connection.');
        } else if (err !== 'no-speech') {
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
    selectedPlatform !== 'All Platforms',
    selectedType !== 'All Types',
    selectedStatus !== 'All',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFiltersCount > 0 || (sortBy !== 'Most Upvoted' && sortBy !== 'Newest');

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 mb-8 space-y-5 box-border min-w-0">
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
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-accent-theme transition-colors">
          {isTyping || isLoading ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-accent-theme" />
          ) : (
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
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
          className={`w-full bg-[#121829]/95 border rounded-2xl py-3.5 sm:py-4 pl-11 sm:pl-12 pr-28 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all duration-200 shadow-xl backdrop-blur-md ${
            isListening
              ? 'border-primary-theme ring-4 ring-primary-theme/25 bg-[var(--primary-badge)]/20'
              : 'border-neutral-700/80 group-hover:border-neutral-600 focus:border-accent-theme focus:ring-2 focus:ring-[var(--primary-ring)]'
          }`}
        />

        {/* Live Search & Trending Auto-Suggest Dropdown */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#121829]/98 border border-neutral-700/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl divide-y divide-neutral-800/80">
            {localSearch.trim().length >= 2 ? (
              <>
                {/* Search Header with Live Loading & Match Count */}
                <div className="p-3 bg-[var(--primary-badge)]/25 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isTyping || isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 text-accent-theme animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
                    )}
                    <span className="text-[11px] font-black uppercase tracking-wider text-primary-theme">
                      {isTyping ? 'Searching...' : `Live Results for "${localSearch}"`}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-bold bg-neutral-800/90 px-2.5 py-0.5 rounded-full border border-neutral-700/70">
                    {liveResults.length} {liveResults.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>

                {/* Instant Results List with Thumbnails & Metadata */}
                <div className="max-h-96 overflow-y-auto divide-y divide-neutral-800/50">
                  {liveResults.length > 0 ? (
                    liveResults.map((anime) => {
                      const displayImg = anime.poster || anime.imageUrl;
                      const platforms = Array.isArray(anime.platforms)
                        ? anime.platforms.map((p: any) => (typeof p === 'string' ? p : p?.name)).filter(Boolean)
                        : [];

                      return (
                        <div
                          key={anime.id}
                          onClick={() => {
                            if (onSelectAnime) {
                              onSelectAnime(anime);
                            }
                            setLocalSearch(anime.title);
                            setSearchQuery(anime.title);
                            setShowDropdown(false);
                          }}
                          className="flex items-center gap-3.5 p-3 sm:p-3.5 hover:bg-[var(--primary-accent)]/15 cursor-pointer group transition-colors"
                        >
                          {/* Small Anime Thumbnail Image */}
                          <div className="relative w-11 h-15 rounded-lg overflow-hidden border border-neutral-700/80 bg-neutral-900 shrink-0 shadow-md">
                            {displayImg ? (
                              <img
                                src={displayImg}
                                alt={anime.title}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-500">
                                <Film className="w-4 h-4" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                          </div>

                          {/* Anime Information */}
                          <div className="min-w-0 flex-grow">
                            <div className="flex items-center gap-2">
                              <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-primary-theme transition-colors">
                                {anime.title}
                              </p>
                              {anime.type && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 shrink-0">
                                  {anime.type}
                                </span>
                              )}
                            </div>

                            {/* Romaji Title if distinct from primary title */}
                            {anime.romajiTitle && anime.romajiTitle.toLowerCase() !== anime.title.toLowerCase() && (
                              <p className="text-[10px] text-neutral-400 truncate italic">
                                {anime.romajiTitle}
                              </p>
                            )}

                            {/* Meta, Year & Rating */}
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {anime.releaseYear && (
                                <span className="text-[10px] text-neutral-400 font-medium">
                                  {anime.releaseYear}
                                </span>
                              )}
                              {anime.rating && (
                                <div className="flex items-center gap-0.5 text-amber-400 font-black text-[10px]">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                  <span>{anime.rating}</span>
                                </div>
                              )}
                              {anime.studio && (
                                <span className="text-[10px] text-neutral-500 truncate hidden sm:inline">
                                  • {anime.studio}
                                </span>
                              )}
                            </div>

                            {/* Dub Language Badges & Platforms */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {anime.dubs?.slice(0, 3).map((d, idx) => (
                                <span
                                  key={`${d}-${idx}`}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary-theme/15 text-primary-light border border-primary-theme/30"
                                >
                                  {d} Dub
                                </span>
                              ))}
                              {platforms.slice(0, 2).map((p, idx) => (
                                <span
                                  key={`${p}-${idx}`}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-neutral-800/90 text-neutral-300 border border-neutral-700"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Quick selection arrow */}
                          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-neutral-800/80 text-neutral-400 group-hover:bg-primary-theme group-hover:text-white transition-all shadow-sm">
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* Clear No Results Placeholder */
                    <div className="p-8 text-center space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
                        <Search className="w-6 h-6 text-neutral-400 opacity-60" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">
                          No results found for &ldquo;{localSearch}&rdquo;
                        </p>
                        <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                          We searched English titles, Japanese Romaji, short acronyms, dubs, and platforms.
                        </p>
                      </div>

                      {/* Helpful Search Tips */}
                      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 text-left max-w-md mx-auto text-[11px] text-neutral-400 space-y-1.5">
                        <p className="font-bold text-neutral-300 flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-accent-theme" />
                          <span>Search Tips:</span>
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                          <li>Check for spelling errors (e.g. &ldquo;Demon Slear&rdquo; → Demon Slayer)</li>
                          <li>Search with acronyms: <strong>AOT</strong>, <strong>JJK</strong>, <strong>KNY</strong>, <strong>SL</strong>, <strong>MHA</strong></li>
                          <li>Search by language: &ldquo;Tamil&rdquo;, &ldquo;Telugu&rdquo;, &ldquo;Hindi&rdquo;</li>
                          <li>Search by platform: &ldquo;Crunchyroll&rdquo;, &ldquo;Netflix&rdquo;, &ldquo;JioCinema&rdquo;</li>
                        </ul>
                      </div>

                      {/* Quick recovery chips */}
                      <div className="pt-2">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-2">Try Popular Searches</p>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {['Demon Slayer', 'Solo Leveling', 'Jujutsu Kaisen', 'Attack on Titan', 'Tamil Dub', 'Crunchyroll'].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => {
                                setLocalSearch(chip);
                                setSearchQuery(chip);
                              }}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors cursor-pointer"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : trendingSuggestions.length > 0 && (
              <>
                <div className="p-3 bg-[var(--primary-badge)]/30 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-primary-theme">Trending Right Now</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">Popular Dubs</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-neutral-800/50">
                  {trendingSuggestions.map((anime: AnimeRecord) => (
                    <div
                      key={anime.id}
                      onClick={() => {
                        if (onSelectAnime) {
                          onSelectAnime(anime);
                        }
                        setLocalSearch(anime.title);
                        setSearchQuery(anime.title);
                        setShowDropdown(false);
                      }}
                      className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer group transition-colors"
                    >
                      <img src={anime.poster || undefined} alt={anime.title} loading="lazy" decoding="async" className="w-9 h-12 object-cover rounded-lg border border-neutral-700 group-hover:border-primary-theme shrink-0" />
                      <div className="min-w-0 flex-grow">
                        <p className="text-xs font-bold text-white truncate group-hover:text-primary-theme transition-colors">{anime.title}</p>
                        <p className="text-[10px] text-neutral-400">{anime.type} • {anime.releaseYear} • ★ {anime.rating || '8.0'}</p>
                        <div className="flex gap-1 mt-1">
                          {anime.dubs?.slice(0, 2).map((d, idx) => (
                            <span key={`${d}-${idx}`} className="text-[8px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="ml-auto text-[10px] font-black text-orange-500 flex items-center gap-1 shrink-0">
                        <Flame className="w-3.5 h-3.5" />
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
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {/* Active Search Loading Spinner */}
          {(isTyping || isLoading) && (
            <div className="p-1 text-accent-theme" title="Searching anime catalog...">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}

          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch('');
                setSearchQuery('');
              }}
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
                ? 'bg-primary-theme text-white shadow-lg shadow-primary-theme ring-2 ring-primary-light animate-pulse'
                : 'text-neutral-400 hover:text-accent-theme hover:bg-neutral-800/80'
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
          {ALL_LANGUAGES.map((langItem, idx) => {
            const isSelected = selectedLanguage === langItem.name;
            const count = langItem.name === 'All' ? totalAvailable : languageCounts[langItem.name];

            return (
              <button
                key={`${langItem.name}-${idx}`}
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

      {/* Advanced Multi-Filtering Row: Genre AND Platform AND Type AND Status AND Sort Simultaneously */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
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
            className="w-full bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate"
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
            className="w-full bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate"
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
            className="w-full min-w-0 bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate"
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
            className="w-full min-w-0 bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer truncate"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[#121829] text-neutral-200">
                {s === 'All' ? 'All Status' : s}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order: Most Upvoted, Newest, Oldest, Highest Rated, Title A-Z */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[#121829] border border-neutral-800 hover:border-neutral-700 rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-xs transition-colors min-w-0 overflow-hidden">
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
              <span className="w-2 h-2 rounded-full bg-primary-theme animate-ping" />
              Filtering live catalog...
            </span>
          ) : (
            <span className="text-neutral-400 font-medium">
              Showing <strong className="text-white font-bold">{totalFiltered}</strong> {totalFiltered === 1 ? 'anime' : 'anime titles'}
              {selectedLanguage !== 'All' && (
                <span className="text-primary-theme"> with <strong className="text-accent-theme">{selectedLanguage}</strong> dub</span>
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
});
