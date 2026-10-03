import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Check, 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft, 
  Film, 
  Star, 
  Bookmark, 
  CheckCircle2, 
  Layers, 
  Tv, 
  ExternalLink 
} from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';
import { ALL_GENRES } from '../data/animeData';
import { ALL_RECOMMENDATION_THEMES } from '../data/animeEnrichment';

interface RecommendationSystemProps {
  animeList: Anime[];
  watchlistIds: string[];
  watchedIds: string[];
  onToggleWatchlist: (anime: Anime) => void;
  onSelectAnime: (anime: Anime) => void;
}

export const RecommendationSystem: React.FC<RecommendationSystemProps> = ({
  animeList,
  watchlistIds,
  watchedIds,
  onToggleWatchlist,
  onSelectAnime,
}) => {
  // Wizard steps: 1: Genres -> 2: Themes -> 3: Previously Watched -> 4: Language Pref -> 5: Results
  const [step, setStep] = useState<number>(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Action', 'Fantasy']);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(['Underdog to OP', 'Dark Fantasy']);
  const [previouslyWatched, setPreviouslyWatched] = useState<string[]>(() => {
    return watchedIds.length > 0 ? watchedIds : [];
  });
  const [preferredLanguage, setPreferredLanguage] = useState<string>('All');
  const [searchWatchedInput, setSearchWatchedInput] = useState('');

  // Toggle helpers
  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length > 1) {
        setSelectedGenres(selectedGenres.filter((g) => g !== genre));
      }
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const toggleTheme = (theme: string) => {
    if (selectedThemes.includes(theme)) {
      if (selectedThemes.length > 1) {
        setSelectedThemes(selectedThemes.filter((t) => t !== theme));
      }
    } else {
      setSelectedThemes([...selectedThemes, theme]);
    }
  };

  const toggleWatched = (animeId: string) => {
    if (previouslyWatched.includes(animeId)) {
      setPreviouslyWatched(previouslyWatched.filter((id) => id !== animeId));
    } else {
      setPreviouslyWatched([...previouslyWatched, animeId]);
    }
  };

  // Recommendation engine scoring
  const recommendations = useMemo(() => {
    if (step !== 5) return [];

    // Score every anime not in previouslyWatched
    const scoredList = animeList
      .filter((anime) => !previouslyWatched.includes(anime.id))
      .map((anime) => {
        let score = 0;
        const reasons: string[] = [];

        // 1. Genre matching (up to 40 points)
        const matchedGenres = anime.genres.filter((g) => selectedGenres.includes(g));
        if (matchedGenres.length > 0) {
          const genreScore = (matchedGenres.length / Math.max(anime.genres.length, selectedGenres.length)) * 40;
          score += genreScore;
          reasons.push(`Matches your love for ${matchedGenres.slice(0, 2).join(' & ')}`);
        }

        // 2. Theme matching (up to 35 points)
        const animeThemes = anime.themes || [];
        const matchedThemes = animeThemes.filter((t) => selectedThemes.includes(t));
        if (matchedThemes.length > 0) {
          const themeScore = (matchedThemes.length / Math.max(animeThemes.length, 1)) * 35;
          score += themeScore;
          reasons.push(`Features "${matchedThemes[0]}" theme`);
        }

        // 3. Previously watched similarity (up to 20 points)
        const watchedAnimeObjs = animeList.filter((a) => previouslyWatched.includes(a.id));
        const sharedStudioOrType = watchedAnimeObjs.some(
          (w) => w.studio === anime.studio || w.genres.some((g) => anime.genres.includes(g))
        );
        if (sharedStudioOrType) {
          score += 15;
          const similarTitle = watchedAnimeObjs.find((w) =>
            w.genres.some((g) => anime.genres.includes(g))
          );
          if (similarTitle) {
            reasons.push(`Similar vibes to ${similarTitle.title}`);
          }
        }

        // 4. Preferred language bonus (up to 10 points)
        if (preferredLanguage !== 'All') {
          if (anime.dubs.includes(preferredLanguage as DubLanguage)) {
            score += 10;
            reasons.push(`Available with ${preferredLanguage} dub`);
          }
        } else {
          score += 5;
        }

        // Base quality boost from rating (up to 10 points)
        const animeRating = anime.rating || 0;
        score += (animeRating / 10) * 10;

        // Cap at 99% match
        const matchPercentage = Math.min(99, Math.max(65, Math.round(score)));

        return {
          anime,
          matchPercentage,
          reasons: reasons.slice(0, 2),
        };
      });

    // Sort descending by match score
    return scoredList.sort((a, b) => b.matchPercentage - a.matchPercentage);
  }, [step, animeList, previouslyWatched, selectedGenres, selectedThemes, preferredLanguage]);

  const handleReset = () => {
    setSelectedGenres(['Action', 'Fantasy']);
    setSelectedThemes(['Underdog to OP', 'Dark Fantasy']);
    setPreviouslyWatched([]);
    setPreferredLanguage('All');
    setStep(1);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Interactive Anime Matchmaker</span>
        </div>
        <h2 className="font-heading font-black text-2xl sm:text-4xl text-white">
          Personalized Anime Recommendations
        </h2>
        <p className="text-xs sm:text-sm text-neutral-400">
          Tell us what you love to watch, your favorite storytelling themes, and what you’ve already seen. We’ll find your next obsession.
        </p>
      </div>

      {/* Progress Stepper */}
      {step < 5 && (
        <div className="max-w-xl mx-auto mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 mb-2">
            <span className={step >= 1 ? 'text-purple-400' : ''}>1. Genres</span>
            <span className={step >= 2 ? 'text-purple-400' : ''}>2. Themes</span>
            <span className={step >= 3 ? 'text-purple-400' : ''}>3. Watched Anime</span>
            <span className={step >= 4 ? 'text-purple-400' : ''}>4. Language</span>
          </div>
          <div className="w-full bg-[#171e2e] h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 1: Favorite Genres */}
      {step === 1 && (
        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto shadow-xl">
          <h3 className="font-heading font-black text-xl text-white mb-1">
            What are your favorite genres?
          </h3>
          <p className="text-xs text-neutral-400 mb-6">
            Select one or more genres you enjoy watching the most.
          </p>

          <div className="flex flex-wrap gap-2.5 mb-8">
            {ALL_GENRES.filter((g) => g !== 'All Genres').map((genre) => {
              const isSelected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400/40'
                      : 'bg-[#182032] text-neutral-300 hover:bg-[#202940] border border-neutral-700/60'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  <span>{genre}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <span className="text-xs text-neutral-400">
              {selectedGenres.length} genres selected
            </span>
            <button
              onClick={() => setStep(2)}
              disabled={selectedGenres.length === 0}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 disabled:opacity-50"
            >
              <span>Next: Select Themes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Themes & Tropes */}
      {step === 2 && (
        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto shadow-xl">
          <h3 className="font-heading font-black text-xl text-white mb-1">
            What story themes & tropes excite you?
          </h3>
          <p className="text-xs text-neutral-400 mb-6">
            Themes give deeper insight into the kind of storytelling you crave.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-8">
            {ALL_RECOMMENDATION_THEMES.map((theme) => {
              const isSelected = selectedThemes.includes(theme);
              return (
                <button
                  key={theme}
                  onClick={() => toggleTheme(theme)}
                  className={`p-3 rounded-xl text-xs font-bold text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400/40'
                      : 'bg-[#182032] text-neutral-300 hover:bg-[#202940] border border-neutral-700/60'
                  }`}
                >
                  <span className="line-clamp-1">{theme}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedThemes.length === 0}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 disabled:opacity-50"
            >
              <span>Next: Watched Anime</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Previously Watched Anime */}
      {step === 3 && (
        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto shadow-xl">
          <h3 className="font-heading font-black text-xl text-white mb-1">
            Which anime have you already watched or liked?
          </h3>
          <p className="text-xs text-neutral-400 mb-4">
            We will exclude these titles from recommendations and use their DNA to recommend similar shows.
          </p>

          {/* Quick search input */}
          <div className="mb-4">
            <input
              type="text"
              value={searchWatchedInput}
              onChange={(e) => setSearchWatchedInput(e.target.value)}
              placeholder="Filter by title to find what you've seen..."
              className="w-full bg-[#182032] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Anime selection grid */}
          <div className="max-h-72 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {animeList
              .filter((a) =>
                searchWatchedInput.trim()
                  ? a.title.toLowerCase().includes(searchWatchedInput.toLowerCase().trim())
                  : true
              )
              .map((anime) => {
                const isWatched = previouslyWatched.includes(anime.id);
                return (
                  <button
                    key={anime.id}
                    onClick={() => toggleWatched(anime.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      isWatched
                        ? 'bg-purple-900/50 border-purple-500 text-white'
                        : 'bg-[#182032] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <img
                      src={anime.poster}
                      alt={anime.title}
                      className="w-8 h-10 object-cover rounded shrink-0"
                    />
                    <div className="overflow-hidden flex-grow">
                      <span className="text-xs font-bold block truncate">
                        {anime.title}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {anime.releaseYear}
                      </span>
                    </div>
                    {isWatched && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                  </button>
                );
              })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">
                {previouslyWatched.length} watched
              </span>
              <button
                onClick={() => setStep(4)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
              >
                <span>Next: Dub Preference</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Language Preference & Generate */}
      {step === 4 && (
        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto shadow-xl">
          <h3 className="font-heading font-black text-xl text-white mb-1">
            Preferred Dubbed Language
          </h3>
          <p className="text-xs text-neutral-400 mb-6">
            Do you prefer anime available in a specific regional Indian dub?
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {['All', 'Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'].map((lang) => {
              const isSelected = preferredLanguage === lang;
              return (
                <button
                  key={lang}
                  onClick={() => setPreferredLanguage(lang)}
                  className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400/40'
                      : 'bg-[#182032] text-neutral-300 hover:bg-[#202940] border border-neutral-700/60'
                  }`}
                >
                  <span>{lang === 'All' ? 'Any Language' : `${lang} Dub`}</span>
                  {isSelected && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => setStep(5)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/40"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Recommendations</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Generated Recommendations Results */}
      {step === 5 && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#131926] border border-neutral-800 rounded-2xl p-5 shadow-lg">
            <div>
              <h3 className="font-heading font-black text-xl text-white">
                Top Picks Just For You
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Calculated based on {selectedGenres.join(', ')} & {selectedThemes.join(', ')}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Questionnaire</span>
            </button>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.slice(0, 10).map(({ anime, matchPercentage, reasons }) => {
              const inWatchlist = watchlistIds.includes(anime.id);
              return (
                <div
                  key={anime.id}
                  className="bg-[#131926] border border-neutral-800/90 hover:border-purple-500/50 rounded-2xl p-4 sm:p-5 flex gap-4 transition-all duration-300 shadow-md group relative overflow-hidden"
                >
                  {/* Poster */}
                  <div
                    onClick={() => onSelectAnime(anime)}
                    className="relative w-28 aspect-[3/4.2] rounded-xl overflow-hidden shrink-0 cursor-pointer shadow-lg"
                  >
                    <img
                      src={anime.poster}
                      alt={anime.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-1.5 left-1.5 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-300 flex items-center gap-1 backdrop-blur-sm">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      <span>{(anime.rating || 0).toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col justify-between flex-grow min-w-0">
                    <div>
                      {/* Match Badge & Type */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="bg-purple-950/80 text-purple-300 border border-purple-700/50 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>{matchPercentage}% Match</span>
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {anime.type} • {anime.releaseYear}
                        </span>
                      </div>

                      {/* Title */}
                      <h4
                        onClick={() => onSelectAnime(anime)}
                        className="font-bold text-base text-white hover:text-purple-300 transition-colors cursor-pointer line-clamp-1"
                      >
                        {anime.title}
                      </h4>

                      {/* Why this matches you */}
                      <div className="mt-2 space-y-1">
                        {(reasons || []).map((r, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium"
                          >
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span className="line-clamp-1">{r}</span>
                          </div>
                        ))}
                      </div>

                      {/* Dub tags */}
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {(anime.dubs || []).map((d) => (
                          <span
                            key={d}
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-3 border-t border-neutral-800/70 mt-3">
                      <button
                        onClick={() => onSelectAnime(anime)}
                        className="flex-grow py-1.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-colors cursor-pointer text-center"
                      >
                        View Info Page
                      </button>

                      <button
                        onClick={() => onToggleWatchlist(anime)}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                          inWatchlist
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                        }`}
                        title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
