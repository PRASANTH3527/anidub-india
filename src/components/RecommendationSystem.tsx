import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  Check, 
  Star, 
  Tv, 
  Bookmark, 
  ExternalLink, 
  Languages, 
  Flame, 
  Compass, 
  Heart, 
  Zap, 
  Film, 
  CheckCircle2,
  Smile,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { Anime } from './CatalogView';

export interface RecommendationSystemProps {
  catalogList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  watchlist?: number[];
  onToggleWatchlist?: (animeId: number) => void;
  onNavigateCatalog?: () => void;
}

interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

const STEP_1_VIBES: OptionItem[] = [
  { id: 'action', label: 'Action & Shonen', sublabel: 'Epic fights, superpowers & tournaments', icon: <Flame className="w-4 h-4 text-orange-400" /> },
  { id: 'fantasy', label: 'Dark Fantasy & Magic', sublabel: 'Swords, mythical realms & demons', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
  { id: 'scifi', label: 'Cyberpunk & Sci-Fi', sublabel: 'Futuristic AI, mechas & cyber warfare', icon: <Zap className="w-4 h-4 text-cyan-400" /> },
  { id: 'thriller', label: 'Psychological & Mystery', sublabel: 'Mind games, crime & high stakes suspense', icon: <Compass className="w-4 h-4 text-indigo-400" /> },
  { id: 'romance', label: 'Romance & Drama', sublabel: 'Emotional bonds, music & heartwarming stories', icon: <Heart className="w-4 h-4 text-rose-400" /> },
  { id: 'comedy', label: 'Comedy & Slice of Life', sublabel: 'Relaxing, laughter & everyday adventures', icon: <Smile className="w-4 h-4 text-amber-400" /> }
];

const STEP_2_LANGUAGES: OptionItem[] = [
  { id: 'any', label: 'Any Regional Dub', sublabel: 'Show all available Indian languages', icon: <Languages className="w-4 h-4 text-primary-theme" /> },
  { id: 'HIN', label: 'Hindi (हिन्दी)', sublabel: 'Hindi dubbed tracks & voice casts', icon: <span className="text-xs font-bold text-emerald-400">HI</span> },
  { id: 'TAM', label: 'Tamil (தமிழ்)', sublabel: 'Tamil dubbed releases & dialogues', icon: <span className="text-xs font-bold text-purple-400">TA</span> },
  { id: 'TEL', label: 'Telugu (తెలుగు)', sublabel: 'Telugu dubbed audio streaming', icon: <span className="text-xs font-bold text-sky-400">TE</span> },
  { id: 'MAL', label: 'Malayalam (മലയാളം)', sublabel: 'Malayalam dubbing & voice artists', icon: <span className="text-xs font-bold text-amber-400">ML</span> },
  { id: 'KAN', label: 'Kannada (ಕನ್ನಡ)', sublabel: 'Kannada audio availability', icon: <span className="text-xs font-bold text-pink-400">KN</span> }
];

const STEP_3_PLATFORMS: OptionItem[] = [
  { id: 'all', label: 'All Authorized OTTs', sublabel: 'Across all licensed Indian services', icon: <Tv className="w-4 h-4 text-neutral-300" /> },
  { id: 'Crunchyroll', label: 'Crunchyroll India', sublabel: 'Largest regional dubbed anime catalog', icon: <span className="text-xs font-bold text-orange-400">CR</span> },
  { id: 'Netflix', label: 'Netflix India', sublabel: 'Multi-lingual dubbed worldwide originals', icon: <span className="text-xs font-bold text-red-500">NF</span> },
  { id: 'JioCinema', label: 'JioCinema / JioHotstar', sublabel: 'Accessible streaming in Indian languages', icon: <span className="text-xs font-bold text-blue-400">JC</span> },
  { id: 'Muse India', label: 'Muse India / YouTube', sublabel: 'Free legal OTT broadcast releases', icon: <span className="text-xs font-bold text-emerald-400">YT</span> }
];

const STEP_4_LENGTHS: OptionItem[] = [
  { id: 'any', label: 'Any Episode Count', sublabel: 'From single seasons to long-running epics', icon: <Film className="w-4 h-4 text-neutral-300" /> },
  { id: 'short', label: 'Quick Binge (12–13 Episodes)', sublabel: 'Fast single-season complete story arcs', icon: <Zap className="w-4 h-4 text-emerald-400" /> },
  { id: 'medium', label: 'Classic Run (24+ Episodes)', sublabel: 'Multi-cour deep character development', icon: <Flame className="w-4 h-4 text-amber-400" /> },
  { id: 'airing', label: 'Currently Airing Simulcast', sublabel: 'Fresh weekly dubbed episodes', icon: <TrendingUp className="w-4 h-4 text-purple-400" /> }
];

export const RecommendationSystem: React.FC<RecommendationSystemProps> = ({
  catalogList,
  onSelectAnime,
  watchlist = [],
  onToggleWatchlist,
  onNavigateCatalog
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedVibe, setSelectedVibe] = useState<string>('action');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('any');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedLength, setSelectedLength] = useState<string>('any');

  // Match calculations
  const calculateMatches = () => {
    return catalogList.map((anime) => {
      let score = 50;

      // 1. Vibe / Genre matching
      const genres = (anime.genres || '').toLowerCase();
      if (selectedVibe === 'action' && (genres.includes('action') || genres.includes('shonen'))) score += 30;
      else if (selectedVibe === 'fantasy' && (genres.includes('fantasy') || genres.includes('magic') || genres.includes('supernatural'))) score += 30;
      else if (selectedVibe === 'scifi' && (genres.includes('sci-fi') || genres.includes('cyberpunk') || genres.includes('mecha'))) score += 30;
      else if (selectedVibe === 'thriller' && (genres.includes('thriller') || genres.includes('mystery') || genres.includes('drama'))) score += 30;
      else if (selectedVibe === 'romance' && (genres.includes('romance') || genres.includes('drama') || genres.includes('slice'))) score += 30;
      else if (selectedVibe === 'comedy' && (genres.includes('comedy') || genres.includes('slice'))) score += 30;
      else score += 10;

      // 2. Language matching
      const langs = (anime.languages || '').toUpperCase();
      if (selectedLanguage === 'any') {
        score += 20;
      } else if (langs.includes(selectedLanguage)) {
        score += 25;
      }

      // 3. Platform matching
      const plat = (anime.platform || '').toLowerCase();
      if (selectedPlatform === 'all') {
        score += 15;
      } else if (plat.includes(selectedPlatform.toLowerCase())) {
        score += 20;
      }

      // 4. Length matching
      if (selectedLength === 'any') {
        score += 10;
      } else if (selectedLength === 'short' && (anime.episodes_count || 12) <= 16) {
        score += 15;
      } else if (selectedLength === 'medium' && (anime.episodes_count || 12) >= 20) {
        score += 15;
      } else if (selectedLength === 'airing' && (anime.status || '').toLowerCase() === 'airing') {
        score += 15;
      }

      // 5. Rating bonus
      score += Math.min(Math.round((anime.rating || 8) * 1.5), 15);

      const matchPercent = Math.min(Math.max(score, 78), 99);

      return {
        ...anime,
        matchPercent
      };
    }).sort((a, b) => b.matchPercent - a.matchPercent);
  };

  const matchedAnime = calculateMatches();
  const topMatches = matchedAnime.slice(0, 6);

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const handleRestart = () => {
    setCurrentStep(1);
    setSelectedVibe('action');
    setSelectedLanguage('any');
    setSelectedPlatform('all');
    setSelectedLength('any');
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 font-sans">
      
      {/* 1. TOP BANNER */}
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full badge-primary-theme text-xs font-semibold shadow-sm mb-2">
          <Sparkles className="w-3.5 h-3.5 text-accent-theme animate-pulse" />
          <span>Interactive Anime Matchmaker</span>
        </div>
        
        <h2 className="font-heading font-black text-2xl sm:text-4xl text-white tracking-tight">
          Personalized Anime Recommendations
        </h2>
        
        <p className="text-neutral-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Find your next binge in seconds. Tell us your vibe, preferred Indian regional dub audio, and authorized streaming platform.
        </p>
      </div>

      {/* 2. STEPPER PROGRESS */}
      <div className="max-w-3xl mx-auto mb-8 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-400 px-1">
          <span className="text-primary-theme">
            {currentStep === 5 ? 'Matches Ready' : `Step ${currentStep} of 4`}
          </span>
          <span className="text-neutral-500 text-[11px]">
            {currentStep === 1 && 'Genre & Mood'}
            {currentStep === 2 && 'Regional Audio'}
            {currentStep === 3 && 'Authorized OTT'}
            {currentStep === 4 && 'Format & Pacing'}
            {currentStep === 5 && `${topMatches.length} Top Recommendations`}
          </span>
        </div>

        <div className="w-full bg-[#171e2e] h-2 rounded-full overflow-hidden">
          <div 
            className="bg-primary-theme h-full transition-all duration-300 rounded-full"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* 3. STEP PANELS (STEPS 1 - 4) */}
      {currentStep < 5 && (
        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto shadow-xl">
          
          {/* STEP 1: VIBE / GENRE */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-heading font-black text-lg sm:text-xl text-white">
                  What genre or story vibe are you craving?
                </h3>
                <p className="text-neutral-400 text-xs sm:text-sm mt-1">
                  Select your primary storyline preference for tailored regional dub discoveries.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STEP_1_VIBES.map((opt) => {
                  const isSelected = selectedVibe === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedVibe(opt.id)}
                      className={`px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-start gap-3 text-left ${
                        isSelected
                          ? 'active-tab-theme text-white ring-2 ring-accent-theme/40'
                          : 'bg-[#182032] text-neutral-300 hover:bg-[#202940] border border-neutral-700/60'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{opt.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white flex items-center justify-between">
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-primary-theme" />}
                        </div>
                        <p className="text-[11px] text-neutral-400 font-normal mt-0.5">
                          {opt.sublabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: REGIONAL DUB LANGUAGE */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-heading font-black text-lg sm:text-xl text-white">
                  Which Indian regional dub audio do you want?
                </h3>
                <p className="text-neutral-400 text-xs sm:text-sm mt-1">
                  We verify authentic licensed regional voice casts and dub studios across India.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STEP_2_LANGUAGES.map((opt) => {
                  const isSelected = selectedLanguage === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedLanguage(opt.id)}
                      className={`px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-start gap-3 text-left ${
                        isSelected
                          ? 'active-tab-theme text-white ring-2 ring-accent-theme/40'
                          : 'bg-[#182032] text-neutral-300 hover:bg-[#202940] border border-neutral-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-black/40 border border-neutral-700/70 flex items-center justify-center shrink-0">
                        {opt.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white flex items-center justify-between">
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-primary-theme" />}
                        </div>
                        <p className="text-[11px] text-neutral-400 font-normal mt-0.5">
                          {opt.sublabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: PLATFORM */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-heading font-black text-lg sm:text-xl text-white">
                  Where do you usually stream?
                </h3>
                <p className="text-neutral-400 text-xs sm:text-sm mt-1">
                  100% legal, officially authorized OTTs operating legally with Indian licenses.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STEP_3_PLATFORMS.map((opt) => {
                  const isSelected = selectedPlatform === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedPlatform(opt.id)}
                      className={`px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-start gap-3 text-left ${
                        isSelected
                          ? 'active-tab-theme text-white ring-2 ring-accent-theme/40'
                          : 'bg-[#182032] text-neutral-300 hover:bg-[#202940] border border-neutral-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-black/40 border border-neutral-700/70 flex items-center justify-center shrink-0">
                        {opt.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white flex items-center justify-between">
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-primary-theme" />}
                        </div>
                        <p className="text-[11px] text-neutral-400 font-normal mt-0.5">
                          {opt.sublabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: FORMAT / LENGTH */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-heading font-black text-lg sm:text-xl text-white">
                  What pacing fits your schedule?
                </h3>
                <p className="text-neutral-400 text-xs sm:text-sm mt-1">
                  Choose between quick weekend binges or long-running shonen franchises.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STEP_4_LENGTHS.map((opt) => {
                  const isSelected = selectedLength === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedLength(opt.id)}
                      className={`px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-start gap-3 text-left ${
                        isSelected
                          ? 'active-tab-theme text-white ring-2 ring-accent-theme/40'
                          : 'bg-[#182032] text-neutral-300 hover:bg-[#202940] border border-neutral-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-black/40 border border-neutral-700/70 flex items-center justify-center shrink-0">
                        {opt.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white flex items-center justify-between">
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-primary-theme" />}
                        </div>
                        <p className="text-[11px] text-neutral-400 font-normal mt-0.5">
                          {opt.sublabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-between pt-6 border-t border-neutral-800/80 mt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                currentStep === 1 
                  ? 'opacity-40 cursor-not-allowed bg-neutral-900 text-neutral-500' 
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl text-xs font-bold btn-primary-theme text-white shadow-lg flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
            >
              <span>{currentStep === 4 ? 'Find My Matches' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      )}

      {/* 4. STEP 5: RESULTS VIEW */}
      {currentStep === 5 && (
        <div className="space-y-6">
          
          {/* HEADER ACTION BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#131926] border border-neutral-800 rounded-2xl p-5 shadow-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-heading font-black text-lg text-white">
                  Curated Regional Dub Recommendations
                </h3>
              </div>
              <p className="text-neutral-400 text-xs mt-1">
                Found {topMatches.length} anime aligned with your genre, regional audio, and OTT choices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRestart}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#182032] hover:bg-[#202940] border border-neutral-700/80 text-neutral-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Quiz</span>
              </button>

              {onNavigateCatalog && (
                <button
                  onClick={onNavigateCatalog}
                  className="px-4 py-2 rounded-xl text-xs font-bold btn-primary-theme text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <span>Explore Full Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* RESULTS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topMatches.map((anime) => {
              const isSaved = watchlist.includes(anime.id);

              return (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime)}
                  className="bg-[#131926] border border-neutral-800/90 hover:border-primary-theme/50 rounded-2xl p-4 sm:p-5 flex gap-4 shadow-md group relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-purple-950/20"
                >
                  {/* POSTER */}
                  <div className="w-24 sm:w-28 aspect-[3/4.2] rounded-xl overflow-hidden bg-neutral-900 shrink-0 relative">
                    <img
                      src={anime.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                      alt={anime.title}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* MATCH PERCENTAGE PILL */}
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500/40 text-[9px] font-black text-emerald-300 backdrop-blur-xs">
                      {anime.matchPercent}% Match
                    </div>
                  </div>

                  {/* INFO CONTENT */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      {/* PLATFORM & RATING ROW */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-neutral-400 bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800 truncate">
                          {anime.platform || 'Crunchyroll'}
                        </span>

                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{anime.rating ? anime.rating.toFixed(1) : '8.9'}</span>
                        </div>
                      </div>

                      {/* TITLE */}
                      <h4 className="font-heading font-black text-sm sm:text-base text-white group-hover:text-primary-theme transition-colors line-clamp-1">
                        {anime.title}
                      </h4>

                      {/* GENRES */}
                      <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                        {anime.genres || 'Action, Shonen, Adventure'}
                      </p>

                      {/* SYNOPSIS SNIPPET */}
                      <p className="text-[11px] text-neutral-300/90 line-clamp-2 mt-1.5 leading-relaxed">
                        {anime.synopsis || 'Experience the thrilling regional dub voice acting on official OTT platforms.'}
                      </p>
                    </div>

                    {/* BOTTOM DUB BAR & CTAS */}
                    <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {(anime.languages ? anime.languages.split(/[,/ ]+/) : ['HIN', 'TAM']).slice(0, 3).map((l, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase bg-primary-theme/10 border border-primary-theme/30 text-purple-300"
                          >
                            {l.trim()}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onToggleWatchlist && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleWatchlist(anime.id);
                            }}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                              isSaved
                                ? 'bg-primary-theme text-white'
                                : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300'
                            }`}
                            title={isSaved ? 'In Watchlist' : 'Save to Watchlist'}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                          </button>
                        )}

                        <span className="text-[11px] font-bold text-primary-theme flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          <span>Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
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
