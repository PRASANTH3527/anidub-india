import React, { useState, useMemo } from 'react';
import { Sparkles, Star, Play, Bookmark, Clock, Globe, RefreshCw } from 'lucide-react';
import {
  Anime,
  WatchlistItem,
  normalizeAnimeList,
  normalizeWatchlistProp,
} from '../types';
import { PlatformIcon } from './PlatformIcons';
import { OptimizedImage } from './OptimizedImage';
import { EmptyState } from './ui/EclipseState';

export interface RecommendationSystemProps {
  animeList?: any[];
  catalogList?: any[];
  watchlist: any[];
  onSelectAnime: (anime: any) => void;
  onToggleWatchlist: (id: any, e?: any) => void;
  onNavigateCatalog?: () => void;
  mySubscriptions?: string[];
  mySubscriptionsEnabled?: boolean;
  onToggleMySubscriptionsEnabled?: (enabled: boolean) => void;
}

const DUB_LANGUAGES = ['All', 'Tamil', 'Hindi', 'Telugu', 'Malayalam'] as const;
const MOOD_GENRES = ['All', 'Action', 'Fantasy', 'Comedy', 'Sci-Fi', 'Romance', 'Drama'] as const;
const LENGTH_FILTERS = [
  { id: 'any', label: 'Any Length' },
  { id: 'short', label: 'Short (≤13 eps)' },
  { id: 'medium', label: 'Standard (14–26 eps)' },
  { id: 'long', label: 'Long (27+ eps)' },
] as const;

export const RecommendationSystem: React.FC<RecommendationSystemProps> = ({
  animeList: animeListProp,
  catalogList,
  watchlist: watchlistProp,
  onSelectAnime,
  onToggleWatchlist,
}) => {
  const animeList = useMemo(
    () => normalizeAnimeList(animeListProp || catalogList || []),
    [animeListProp, catalogList]
  );
  const { items: watchlist } = useMemo(
    () => normalizeWatchlistProp(watchlistProp, animeList),
    [watchlistProp, animeList]
  );

  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedLength, setSelectedLength] = useState<string>('any');

  const watchlistIds = useMemo(() => new Set(watchlist.map((item) => String(item.id))), [watchlist]);

  // Extract user's favorite genres/languages from saved watchlist to personalize ranking
  const userPreferences = useMemo(() => {
    const genreScores: Record<string, number> = {};
    const langScores: Record<string, number> = {};
    watchlist.forEach((item) => {
      const found = animeList.find((a) => String(a.id) === String(item.id));
      if (!found) return;
      (found.genres || []).forEach((g: string) => {
        genreScores[g] = (genreScores[g] || 0) + 1;
      });
      (found.languages || []).forEach((l: string) => {
        langScores[l] = (langScores[l] || 0) + 1;
      });
    });
    return { genreScores, langScores };
  }, [watchlist, animeList]);

  const recommendations = useMemo(() => {
    const filtered = animeList.filter((anime) => {
      if (selectedLanguage !== 'All') {
        if (!Array.isArray(anime.languages) || !anime.languages.includes(selectedLanguage as any)) {
          return false;
        }
      }
      if (selectedGenre !== 'All') {
        if (!Array.isArray(anime.genres) || !anime.genres.includes(selectedGenre)) {
          return false;
        }
      }
      if (selectedLength !== 'any') {
        const eps = anime.episodesCount || 0;
        if (selectedLength === 'short' && (eps <= 0 || eps > 13)) return false;
        if (selectedLength === 'medium' && (eps < 14 || eps > 26)) return false;
        if (selectedLength === 'long' && eps < 27) return false;
      }
      return true;
    });

    return [...filtered]
      .map((anime) => {
        let matchScore = (anime.rating || 7) * 10;
        (anime.genres || []).forEach((g) => {
          matchScore += (userPreferences.genreScores[g] || 0) * 8;
        });
        (anime.languages || []).forEach((l) => {
          matchScore += (userPreferences.langScores[l] || 0) * 6;
        });
        if (!watchlistIds.has(anime.id)) {
          matchScore += 5;
        }
        return { anime, matchScore };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 12);
  }, [animeList, selectedLanguage, selectedGenre, selectedLength, userPreferences, watchlistIds]);

  const handleResetFilters = () => {
    setSelectedLanguage('All');
    setSelectedGenre('All');
    setSelectedLength('any');
  };

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[#F4F3FA]">
      {/* Compact Header (24px mobile / 30px desktop) */}
      <div className="mb-5">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#B49AF8] mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Personalized Discovery</span>
        </div>
        <h1 className="text-[24px] sm:text-[30px] font-bold text-[#F4F3FA] leading-[1.2] tracking-[-0.02em]">
          For You
        </h1>
        <p className="text-[13px] sm:text-[14px] text-[#A1A5B5] mt-1">
          Curated regional dub picks tailored to your language, genre mood, and episode length
        </p>
      </div>

      {/* Unified Preference Filter Card (#12141E surface, 44px pills) */}
      <div className="rounded-[16px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5 mb-6 space-y-4">
        {/* Dub Language Pills */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#A1A5B5] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#B49AF8]" />
              <span>Dub Language</span>
            </span>
            {(selectedLanguage !== 'All' || selectedGenre !== 'All' || selectedLength !== 'any') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#191C29] hover:bg-[#292B39] text-[#CBB6FF] text-[12px] font-semibold inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset preferences</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {DUB_LANGUAGES.map((lang) => {
              const active = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  className={`min-h-[44px] px-4 rounded-[12px] text-[13px] font-semibold whitespace-nowrap border transition-all duration-180 motion-reduce:transition-none ${
                    active
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                      : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                  }`}
                >
                  {lang === 'All' ? 'All Languages' : `${lang} Dub`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Genre / Mood & Watch Length Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-[#292B39]">
          <div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#A1A5B5] block mb-2">
              Genre &amp; Mood
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {MOOD_GENRES.map((genre) => {
                const active = selectedGenre === genre;
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => setSelectedGenre(genre)}
                    className={`min-h-[44px] px-3.5 rounded-[12px] text-[13px] font-semibold whitespace-nowrap border transition-all duration-180 ${
                      active
                        ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                        : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#A1A5B5] flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-[#B49AF8]" />
              <span>Watch Length</span>
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {LENGTH_FILTERS.map((len) => {
                const active = selectedLength === len.id;
                return (
                  <button
                    key={len.id}
                    type="button"
                    onClick={() => setSelectedLength(len.id)}
                    className={`min-h-[44px] px-3.5 rounded-[12px] text-[13px] font-semibold whitespace-nowrap border transition-all duration-180 ${
                      active
                        ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                        : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                    }`}
                  >
                    {len.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Poster-First 2:3 Results Grid */}
      {recommendations.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {recommendations.map(({ anime }) => {
            const isSaved = watchlistIds.has(anime.id);
            const verifiedPlatforms = Array.isArray(anime.platforms)
              ? anime.platforms.filter((p) => Boolean(p && p.trim()))
              : [];

            return (
              <div
                key={anime.id}
                onClick={() => onSelectAnime(anime)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectAnime(anime);
                  }
                }}
                className="group rounded-[14px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/50 overflow-hidden flex flex-col transition-all duration-180 cursor-pointer"
              >
                {/* 2:3 Poster Slot */}
                <div className="relative aspect-[2/3] w-full bg-[#191C29] overflow-hidden">
                  <OptimizedImage
                    src={anime.poster}
                    alt={anime.title}
                    width={300}
                    height={450}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-180"
                    aspectRatio="portrait"
                  />

                  {/* Rating Chip */}
                  {typeof anime.rating === 'number' && anime.rating > 0 && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-[8px] bg-[#0B0A10]/85 backdrop-blur-md border border-[#292B39] flex items-center gap-1 text-[11px] font-bold text-[#F9C876]">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{anime.rating.toFixed(1)}</span>
                    </div>
                  )}

                  {/* 44x44px Bookmark Button */}
                  <button
                    type="button"
                    aria-label={isSaved ? `Remove ${anime.title} from Library` : `Save ${anime.title} to Library`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist(anime.id, e);
                    }}
                    className={`absolute top-1.5 right-1.5 w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] backdrop-blur-md border flex items-center justify-center transition-colors ${
                      isSaved
                        ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                        : 'bg-[#0B0A10]/80 text-[#F4F3FA] border-[#292B39] hover:border-[#B49AF8]'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#F4F3FA] group-hover:text-[#CBB6FF] leading-[20px] line-clamp-2 min-h-[40px]">
                      {anime.title}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(anime.languages || []).slice(0, 3).map((lang) => (
                        <span
                          key={lang}
                          className="px-1.5 py-0.5 rounded-[5px] bg-[#191C29] text-[#CBB6FF] border border-[#292B39] text-[10px] font-bold uppercase"
                        >
                          {lang.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#292B39] flex items-center justify-between text-[11px] text-[#A1A5B5]">
                    {verifiedPlatforms.length > 0 ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#F4F3FA] truncate">
                        <PlatformIcon platform={verifiedPlatforms[0]} className="w-3 h-3 text-[#B49AF8]" />
                        <span className="truncate">{verifiedPlatforms[0]}</span>
                      </span>
                    ) : (
                      <span>OTT unverified</span>
                    )}
                    <Play className="w-3.5 h-3.5 text-[#B49AF8] shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No matching recommendations"
          description="Try selecting 'All Languages' or widening your watch length filter to discover more dubbed titles."
          actionLabel="Reset filters"
          onAction={handleResetFilters}
        />
      )}
    </section>
  );
};
