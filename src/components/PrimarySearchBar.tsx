'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  Mic, 
  MicOff, 
  Sparkles, 
  Flame, 
  Star, 
  Film, 
  Loader2 
} from 'lucide-react';
import { useToast } from './Toast';
import { SupportedLanguage, translate } from '../utils/i18n';
import { AnimeRecord } from '../types/database';
import { useDebounce } from '../hooks/useDebounce';
import { searchAnimeFuzzy } from '../utils/animeSearch';

interface PrimarySearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  allAnime?: AnimeRecord[];
  onSelectAnime?: (anime: AnimeRecord) => void;
  uiLanguage?: SupportedLanguage;
  className?: string;
  placeholder?: string;
}

export const PrimarySearchBar: React.FC<PrimarySearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  allAnime = [],
  onSelectAnime,
  uiLanguage = 'en',
  className = '',
  placeholder,
}) => {
  const toast = useToast();
  const lang = uiLanguage || 'en';
  const [isListening, setIsListening] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const debouncedSearch = useDebounce(localSearch, 200);
  const isTyping = localSearch.trim() !== debouncedSearch.trim();

  const recognitionRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal search with parent prop
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Update parent when debounced value changes
  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch, setSearchQuery]);

  // Live Auto-Suggest Results powered by multi-field Fuzzy Search
  const liveResults = useMemo(() => {
    const trimmed = localSearch.trim();
    if (!trimmed || trimmed.length < 2) return [];
    return searchAnimeFuzzy(allAnime, trimmed, 8);
  }, [localSearch, allAnime]);

  // Trending Suggestions
  const trendingSuggestions = useMemo(() => {
    return [...allAnime]
      .sort((a, b) => Number(b.likes || b.upvotes || 0) - Number(a.likes || a.upvotes || 0))
      .slice(0, 5);
  }, [allAnime]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Voice Search Handler
  const toggleVoiceSearch = () => {
    if (typeof window === 'undefined') return;

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
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Listening...', 'Speak anime title clearly!');
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

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const displayPlaceholder =
    placeholder ||
    (isListening
      ? translate('searchListening', lang)
      : translate('searchPlaceholder', lang));

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="relative flex items-center w-full">
        {/* Left Search Icon or Loading Spinner */}
        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none text-neutral-400">
          {isTyping ? (
            <Loader2 className="w-4 h-4 animate-spin text-accent-theme" />
          ) : (
            <Search className="w-4 h-4 text-neutral-400" />
          )}
        </div>

        {/* Search Input */}
        <input
          type="text"
          value={localSearch}
          onFocus={() => setShowDropdown(true)}
          onChange={(e) => {
            setLocalSearch(e.target.value);
            if (!showDropdown) setShowDropdown(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowDropdown(false);
            }
          }}
          placeholder={displayPlaceholder}
          className={`w-full bg-[#121829]/90 border rounded-xl sm:rounded-2xl py-2 sm:py-2.5 pl-9 sm:pl-10 pr-16 sm:pr-20 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all duration-200 shadow-md ${
            isListening
              ? 'border-primary-theme ring-2 ring-primary-theme/30 bg-[var(--primary-badge)]/20'
              : 'border-neutral-700/70 hover:border-neutral-600 focus:border-accent-theme focus:ring-1 focus:ring-[var(--primary-ring)]'
          }`}
        />

        {/* Right Search Controls: Clear & Voice Search */}
        <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1">
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                setSearchQuery('');
              }}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-all cursor-pointer"
              title="Clear search"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleVoiceSearch}
            className={`p-1 sm:p-1.5 rounded-lg transition-all cursor-pointer ${
              isListening
                ? 'bg-primary-theme text-white shadow ring-1 ring-primary-light animate-pulse'
                : 'text-neutral-400 hover:text-accent-theme hover:bg-neutral-800/80'
            }`}
            title={isListening ? 'Stop listening' : 'Voice search'}
            aria-label="Voice search"
          >
            {isListening ? (
              <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Live Auto-Suggest & Trending Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#121829]/98 border border-neutral-700/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 backdrop-blur-xl divide-y divide-neutral-800/80 max-w-xl mx-auto">
          {localSearch.trim().length >= 2 ? (
            <>
              {/* Header with Results Count */}
              <div className="p-2.5 bg-[var(--primary-badge)]/25 border-b border-neutral-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-primary-theme text-[11px] uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
                  <span>{isTyping ? 'Searching...' : `Results for "${localSearch}"`}</span>
                </div>
                <span className="text-[10px] text-neutral-400 font-bold bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-700">
                  {liveResults.length} {liveResults.length === 1 ? 'match' : 'matches'}
                </span>
              </div>

              {/* Instant Results List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/50">
                {liveResults.length > 0 ? (
                  liveResults.map((anime) => (
                    <div
                      key={anime.id}
                      onClick={() => {
                        if (onSelectAnime) {
                          onSelectAnime(anime);
                        }
                        setShowDropdown(false);
                      }}
                      className="flex items-center gap-3 p-2.5 sm:p-3 hover:bg-[var(--primary-accent)]/15 cursor-pointer group transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-9 h-12 sm:w-10 sm:h-14 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0 shadow-sm">
                        {anime.poster || anime.imageUrl ? (
                          <img
                            src={anime.poster || anime.imageUrl}
                            alt={anime.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-500">
                            <Film className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-grow">
                        <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-primary-theme transition-colors">
                          {anime.title}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                          <span>{anime.type || 'TV'}</span>
                          <span>•</span>
                          <span>{anime.releaseYear || '2024'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            {anime.rating ? Number(anime.rating).toFixed(1) : '8.5'}
                          </span>
                        </div>

                        {/* Dub Badges */}
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {(anime.dubs || []).slice(0, 3).map((dub, i) => (
                            <span
                              key={`${dub}-${i}`}
                              className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700"
                            >
                              {dub}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-neutral-400">
                    No anime found matching &quot;{localSearch}&quot;.
                  </div>
                )}
              </div>
            </>
          ) : trendingSuggestions.length > 0 ? (
            <>
              <div className="p-2.5 bg-[var(--primary-badge)]/25 border-b border-neutral-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-orange-400 text-[11px] uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Trending Dubbed Anime</span>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-neutral-800/50">
                {trendingSuggestions.map((anime) => (
                  <div
                    key={anime.id}
                    onClick={() => {
                      if (onSelectAnime) {
                        onSelectAnime(anime);
                      }
                      setShowDropdown(false);
                    }}
                    className="flex items-center gap-3 p-2.5 sm:p-3 hover:bg-white/5 cursor-pointer group transition-colors"
                  >
                    <img
                      src={anime.poster || anime.imageUrl}
                      alt={anime.title}
                      className="w-8 h-11 sm:w-9 sm:h-12 object-cover rounded-md border border-neutral-700 shrink-0"
                    />
                    <div className="min-w-0 flex-grow">
                      <p className="text-xs font-bold text-white truncate group-hover:text-primary-theme transition-colors">
                        {anime.title}
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        {anime.type || 'TV'} • {anime.releaseYear || '2024'}
                      </p>
                    </div>
                    <div className="ml-auto text-[10px] font-black text-orange-500 flex items-center gap-1 shrink-0">
                      <Flame className="w-3.5 h-3.5" />
                      {anime.likes || anime.upvotes || 0}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};
