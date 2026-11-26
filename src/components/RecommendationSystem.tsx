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
  Languages,
  Flame,
  Compass,
  Heart,
  Zap,
  Film,
  Smile,
  TrendingUp,
  Sword,
  Target,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime } from './CatalogView';
import { isCanonicalAiring } from '../utils/animeStatus';
import { matchesSelectedPlatforms } from '../utils/ottHub';
import { Button } from './ui/Button';

export interface RecommendationSystemProps {
  catalogList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  watchlist?: number[];
  onToggleWatchlist?: (animeId: number) => void;
  onNavigateCatalog?: () => void;
  mySubscriptions?: string[];
  mySubscriptionsEnabled?: boolean;
  onToggleMySubscriptionsEnabled?: (enabled: boolean) => void;
}

interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

const STEP_1_VIBES: OptionItem[] = [
  { id: 'action', label: 'Action & Shonen', sublabel: 'Epic fights, superpowers & tournaments', icon: <Flame className="w-4 h-4 text-[#F9C876]" /> },
  { id: 'fantasy', label: 'Dark Fantasy & Magic', sublabel: 'Swords, mythical realms & demons', icon: <Sparkles className="w-4 h-4 text-[#B49AF8]" /> },
  { id: 'scifi', label: 'Cyberpunk & Sci-Fi', sublabel: 'Futuristic AI, mechas & cyber warfare', icon: <Zap className="w-4 h-4 text-[#34D399]" /> },
  { id: 'thriller', label: 'Psychological & Mystery', sublabel: 'Mind games, crime & high stakes suspense', icon: <Compass className="w-4 h-4 text-[#CBB6FF]" /> },
  { id: 'romance', label: 'Romance & Drama', sublabel: 'Emotional bonds, music & heartwarming stories', icon: <Heart className="w-4 h-4 text-[#F87171]" /> },
  { id: 'comedy', label: 'Comedy & Slice of Life', sublabel: 'Relaxing, laughter & everyday adventures', icon: <Smile className="w-4 h-4 text-[#F9C876]" /> },
];

const STEP_2_LANGUAGES: OptionItem[] = [
  { id: 'any', label: 'Any Regional Dub', sublabel: 'Show all available Indian languages', icon: <Languages className="w-4 h-4 text-[#B49AF8]" /> },
  { id: 'HIN', label: 'Hindi (हिन्दी)', sublabel: 'Hindi dubbed tracks & voice casts', icon: <span className="text-xs font-bold text-[#34D399]">HI</span> },
  { id: 'TAM', label: 'Tamil (தமிழ்)', sublabel: 'Tamil dubbed releases & dialogues', icon: <span className="text-xs font-bold text-[#B49AF8]">TA</span> },
  { id: 'TEL', label: 'Telugu (తెలుగు)', sublabel: 'Telugu dubbed audio streaming', icon: <span className="text-xs font-bold text-[#CBB6FF]">TE</span> },
  { id: 'MAL', label: 'Malayalam (മലയാളം)', sublabel: 'Malayalam dubbing & voice artists', icon: <span className="text-xs font-bold text-[#F9C876]">ML</span> },
  { id: 'KAN', label: 'Kannada (ಕನ್ನಡ)', sublabel: 'Kannada audio availability', icon: <span className="text-xs font-bold text-[#F87171]">KN</span> },
];

const STEP_3_PLATFORMS: OptionItem[] = [
  { id: 'all', label: 'All Authorized OTTs', sublabel: 'Across all licensed Indian services', icon: <Tv className="w-4 h-4 text-[#F4F3FA]" /> },
  { id: 'Crunchyroll', label: 'Crunchyroll India', sublabel: 'Largest regional dubbed anime catalog', icon: <span className="text-xs font-bold text-[#F9C876]">CR</span> },
  { id: 'Netflix', label: 'Netflix India', sublabel: 'Multi-lingual dubbed worldwide originals', icon: <span className="text-xs font-bold text-[#F87171]">NF</span> },
  { id: 'JioCinema', label: 'JioCinema / JioHotstar', sublabel: 'Accessible streaming in Indian languages', icon: <span className="text-xs font-bold text-[#B49AF8]">JC</span> },
  { id: 'Muse India', label: 'Muse India / YouTube', sublabel: 'Free legal OTT broadcast releases', icon: <span className="text-xs font-bold text-[#34D399]">YT</span> },
];

const STEP_4_LENGTHS: OptionItem[] = [
  { id: 'any', label: 'Any Episode Count', sublabel: 'From single seasons to long-running epics', icon: <Film className="w-4 h-4 text-[#F4F3FA]" /> },
  { id: 'short', label: 'Quick Binge (12–13 Episodes)', sublabel: 'Fast single-season complete story arcs', icon: <Zap className="w-4 h-4 text-[#34D399]" /> },
  { id: 'medium', label: 'Classic Run (24+ Episodes)', sublabel: 'Multi-cour deep character development', icon: <Flame className="w-4 h-4 text-[#F9C876]" /> },
  { id: 'airing', label: 'Currently Airing Simulcast', sublabel: 'Fresh weekly dubbed episodes', icon: <TrendingUp className="w-4 h-4 text-[#B49AF8]" /> },
];

export const RecommendationSystem: React.FC<RecommendationSystemProps> = ({
  catalogList,
  onSelectAnime,
  watchlist = [],
  onToggleWatchlist,
  onNavigateCatalog,
  mySubscriptions = [],
  mySubscriptionsEnabled = false,
  onToggleMySubscriptionsEnabled,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedVibes, setSelectedVibes] = useState<string[]>(['action']);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['any']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['all']);
  const [selectedLength, setSelectedLength] = useState<string>('any');

  const toggleSelection = (id: string, current: string[], setter: (val: string[]) => void, exclusiveId?: string) => {
    if (exclusiveId && id === exclusiveId) {
      setter([exclusiveId]);
      return;
    }

    let next = [...current];
    if (exclusiveId && next.includes(exclusiveId)) {
      next = next.filter(i => i !== exclusiveId);
    }

    if (next.includes(id)) {
      if (next.length > 1) {
        setter(next.filter(i => i !== id));
      }
    } else {
      setter([...next, id]);
    }
  };

  // Filter candidate pool by My Subscriptions when enabled
  const usingSubscriptionFilter = Boolean(mySubscriptionsEnabled && mySubscriptions.length > 0);
  const eligibleCatalog = usingSubscriptionFilter
    ? catalogList.filter((anime) => matchesSelectedPlatforms(anime as any, mySubscriptions))
    : catalogList;

  // Match calculations
  const calculateMatches = () => {
    return eligibleCatalog.map((anime) => {
      let score = 50;

      // 1. Vibe / Genre matching
      const genres = (anime.genres || '').toLowerCase();
      let vibeScore = 0;
      selectedVibes.forEach(vibe => {
        if (vibe === 'action' && (genres.includes('action') || genres.includes('shonen'))) vibeScore += 30;
        else if (vibe === 'fantasy' && (genres.includes('fantasy') || genres.includes('magic') || genres.includes('supernatural'))) vibeScore += 30;
        else if (vibe === 'scifi' && (genres.includes('sci-fi') || genres.includes('cyberpunk') || genres.includes('mecha'))) vibeScore += 30;
        else if (vibe === 'thriller' && (genres.includes('thriller') || genres.includes('mystery') || genres.includes('drama'))) vibeScore += 30;
        else if (vibe === 'romance' && (genres.includes('romance') || genres.includes('drama') || genres.includes('slice'))) vibeScore += 30;
        else if (vibe === 'comedy' && (genres.includes('comedy') || genres.includes('slice'))) vibeScore += 30;
      });
      score += Math.min(vibeScore, 40);

      // 2. Language matching
      const langs = (anime.languages || '').toUpperCase();
      if (selectedLanguages.includes('any')) {
        score += 20;
      } else {
        let langMatch = false;
        selectedLanguages.forEach(l => {
          if (langs.includes(l)) langMatch = true;
        });
        if (langMatch) score += 25;
      }

      // 3. Platform matching
      const plat = (anime.platform || '').toLowerCase();
      if (selectedPlatforms.includes('all')) {
        score += 15;
      } else {
        let platMatch = false;
        selectedPlatforms.forEach(p => {
          if (plat.includes(p.toLowerCase())) platMatch = true;
        });
        if (platMatch) score += 20;
      }

      // 4. Length matching
      if (selectedLength === 'any') {
        score += 10;
      } else if (selectedLength === 'short' && (anime.episodes_count || 12) <= 16) {
        score += 15;
      } else if (selectedLength === 'medium' && (anime.episodes_count || 12) >= 20) {
        score += 15;
      } else if (selectedLength === 'airing' && isCanonicalAiring(anime as any)) {
        score += 15;
      }

      // 5. Rating bonus
      score += Math.min(Math.round((anime.rating || 8) * 1.5), 15);

      const matchPercent = Math.min(Math.max(score, 78), 99);

      return {
        ...anime,
        matchPercent,
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
    setSelectedVibes(['action']);
    setSelectedLanguages(['any']);
    setSelectedPlatforms(['all']);
    setSelectedLength('any');
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 font-sans text-[#F4F3FA]">
      {/* 1. TOP BANNER */}
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#12141E] border border-[#292B39] text-[#B49AF8] text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-[#B49AF8]" />
          <span>Interactive Anime Matchmaker</span>
        </div>

        <h2 className="font-heading font-black text-2xl sm:text-4xl text-[#F4F3FA] tracking-tight">
          Personalized Anime Recommendations
        </h2>

        <p className="text-[#A1A5B5] text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Find your next binge in seconds. Tell us your vibe, preferred Indian regional dub audio, and authorized streaming platform.
        </p>

        {usingSubscriptionFilter && (
          <div className="pt-2 inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-[#34D399]/10 border border-[#34D399]/35 text-[#34D399] text-[11px] font-bold">
            <Tv className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Filtered to your OTTs: {mySubscriptions.join(', ')} ({eligibleCatalog.length} titles)</span>
            {onToggleMySubscriptionsEnabled && (
              <button
                type="button"
                onClick={() => onToggleMySubscriptionsEnabled(false)}
                className="underline text-[#34D399] hover:text-[#F4F3FA] ml-1 cursor-pointer"
              >
                Show all
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. STEPPER PROGRESS */}
      <div className="max-w-3xl mx-auto mb-8 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#A1A5B5] px-1">
          <div className="flex items-center gap-2">
            <div className="bg-[#191C29] text-[#B49AF8] px-2 py-0.5 rounded border border-[#292B39] flex items-center gap-1">
              <Sword className="w-3 h-3" />
              <span>LVL {currentStep}</span>
            </div>
            <span className="text-[#A1A5B5]">
              {currentStep === 5 ? 'Quest Complete' : 'Exploration Phase'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3 text-[#B49AF8]" />
            <span className="text-[#B49AF8]">
              {currentStep === 5 ? 'Matches Ready' : `EXP: ${(currentStep / 5) * 100}%`}
            </span>
          </div>
        </div>

        {/* CLEAN PROGRESS BAR */}
        <div className="relative h-2.5 bg-[#12141E] rounded-full border border-[#292B39] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / 5) * 100}%` }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full rounded-full bg-[#B49AF8]"
          />
        </div>

        <div className="flex justify-between items-center text-[11px] font-bold">
          <span className="text-[#A1A5B5]">
            {currentStep === 1 && 'Genre & Mood Selection'}
            {currentStep === 2 && 'Regional Audio Synthesis'}
            {currentStep === 3 && 'Authorized OTT Grid'}
            {currentStep === 4 && 'Format & Pacing Parameters'}
            {currentStep === 5 && `Results Deciphered: ${topMatches.length} matches found`}
          </span>
          {currentStep < 5 && (
            <div className="flex items-center gap-1.5 text-[#B49AF8]">
              <Sparkles className="w-3 h-3" />
              <span>{matchedAnime.filter(a => a.matchPercent > 80).length} High-Rank Matches</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {currentStep < 5 ? (
          <motion.div
            key={`recommendation_step_${currentStep}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="bg-[#12141E] border border-[#292B39] rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto shadow-xl relative overflow-hidden"
          >
            {/* LIVE RESULTS FLOATING BADGE */}
            <div className="absolute top-4 right-4 hidden sm:flex items-center gap-2 bg-[#34D399]/10 border border-[#34D399]/30 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-[#34D399]" />
              <span className="text-[10px] font-black text-[#34D399] uppercase tracking-wider">
                {matchedAnime.length} Potential Matches
              </span>
            </div>

            {/* STEP 1: VIBE / GENRE */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-heading font-black text-lg sm:text-xl text-[#F4F3FA]">
                    What genre or story vibe are you craving?
                  </h3>
                  <p className="text-[#A1A5B5] text-xs sm:text-sm mt-1">
                    Select one or more vibes for tailored regional dub discoveries.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STEP_1_VIBES.map((opt) => {
                    const isSelected = selectedVibes.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleSelection(opt.id, selectedVibes, setSelectedVibes)}
                        className={`px-4 py-3.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer flex items-start gap-3 text-left border ${
                          isSelected
                            ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]'
                            : 'bg-[#191C29]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#F4F3FA] flex items-center justify-between">
                            <span>{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#B49AF8]" />}
                          </div>
                          <p className="text-[11px] text-[#A1A5B5] font-normal mt-0.5">
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
                  <h3 className="font-heading font-black text-lg sm:text-xl text-[#F4F3FA]">
                    Which Indian regional dub audio do you want?
                  </h3>
                  <p className="text-[#A1A5B5] text-xs sm:text-sm mt-1">
                    Select multiple to find anime with any of these regional voice casts.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STEP_2_LANGUAGES.map((opt) => {
                    const isSelected = selectedLanguages.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleSelection(opt.id, selectedLanguages, setSelectedLanguages, 'any')}
                        className={`px-4 py-3.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer flex items-start gap-3 text-left border ${
                          isSelected
                            ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]'
                            : 'bg-[#191C29]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#F4F3FA] flex items-center justify-between">
                            <span>{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#B49AF8]" />}
                          </div>
                          <p className="text-[11px] text-[#A1A5B5] font-normal mt-0.5">
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
                  <h3 className="font-heading font-black text-lg sm:text-xl text-[#F4F3FA]">
                    Where do you usually stream?
                  </h3>
                  <p className="text-[#A1A5B5] text-xs sm:text-sm mt-1">
                    Select your preferred authorized OTT platforms.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STEP_3_PLATFORMS.map((opt) => {
                    const isSelected = selectedPlatforms.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleSelection(opt.id, selectedPlatforms, setSelectedPlatforms, 'all')}
                        className={`px-4 py-3.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer flex items-start gap-3 text-left border ${
                          isSelected
                            ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]'
                            : 'bg-[#191C29]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#F4F3FA] flex items-center justify-between">
                            <span>{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#B49AF8]" />}
                          </div>
                          <p className="text-[11px] text-[#A1A5B5] font-normal mt-0.5">
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
                  <h3 className="font-heading font-black text-lg sm:text-xl text-[#F4F3FA]">
                    What pacing fits your schedule?
                  </h3>
                  <p className="text-[#A1A5B5] text-xs sm:text-sm mt-1">
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
                        className={`px-4 py-3.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer flex items-start gap-3 text-left border ${
                          isSelected
                            ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]'
                            : 'bg-[#191C29]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#F4F3FA] flex items-center justify-between">
                            <span>{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#B49AF8]" />}
                          </div>
                          <p className="text-[11px] text-[#A1A5B5] font-normal mt-0.5">
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
            <div className="flex items-center justify-between pt-6 border-t border-[#292B39] mt-6">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleBack}
                disabled={currentStep === 1}
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Back
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                {currentStep === 4 ? 'Find My Matches' : 'Continue'}
              </Button>
            </div>
          </motion.div>
        ) : (
          /* 4. STEP 5: RESULTS VIEW */
          <motion.div
            key="recommendation_step_5_results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* HEADER ACTION BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12141E] border border-[#292B39] rounded-2xl p-5 shadow-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
                  <h3 className="font-heading font-black text-lg text-[#F4F3FA]">
                    Curated Regional Dub Recommendations
                  </h3>
                </div>
                <p className="text-[#A1A5B5] text-xs mt-1">
                  Found {topMatches.length} anime aligned with your genre, regional audio, and OTT choices.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleRestart}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Retake Quiz
                </Button>

                {onNavigateCatalog && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={onNavigateCatalog}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Explore Full Catalog
                  </Button>
                )}
              </div>
            </div>

            {/* RESULTS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topMatches.map((anime, index) => {
                const isSaved = watchlist.includes(anime.id);

                return (
                  <motion.div
                    key={`recommendation_match_${anime.id}_${index}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                    onClick={() => onSelectAnime(anime)}
                    className="bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 rounded-2xl p-4 sm:p-5 flex gap-4 shadow-md group relative overflow-hidden transition-colors duration-150 cursor-pointer"
                  >
                    {/* POSTER */}
                    <div className="w-24 sm:w-28 aspect-[3/4.2] rounded-xl overflow-hidden bg-[#191C29] shrink-0 relative border border-[#292B39]">
                      <img
                        src={anime.cover_image || '/logo.png'}
                        alt={anime.title}
                        width={200}
                        height={280}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.src = '/logo.png';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* MATCH PERCENTAGE PILL */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#0B0A10]/90 border border-[#34D399]/40 text-[9px] font-black text-[#34D399]">
                        {anime.matchPercent}% Match
                      </div>
                    </div>

                    {/* INFO CONTENT */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        {/* PLATFORM & RATING ROW */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-bold text-[#A1A5B5] bg-[#191C29] px-2 py-0.5 rounded border border-[#292B39] truncate">
                            {anime.platform || 'Not verified'}
                          </span>

                          <div className="flex items-center gap-1 text-[10px] font-bold text-[#F9C876]">
                            <Star className="w-3 h-3 fill-[#F9C876] text-[#F9C876]" />
                            <span>{anime.rating ? anime.rating.toFixed(1) : '8.9'}</span>
                          </div>
                        </div>

                        {/* TITLE */}
                        <h4 className="font-heading font-black text-sm sm:text-base text-[#F4F3FA] group-hover:text-[#B49AF8] transition-colors duration-150 line-clamp-1">
                          {anime.title}
                        </h4>

                        {/* GENRES */}
                        <p className="text-[10px] text-[#A1A5B5] line-clamp-1 mt-0.5">
                          {anime.genres || 'Action, Shonen, Adventure'}
                        </p>

                        {/* SYNOPSIS SNIPPET */}
                        <p className="text-[11px] text-[#A1A5B5] line-clamp-2 mt-1.5 leading-relaxed">
                          {anime.synopsis || 'Experience the thrilling regional dub voice acting on official OTT platforms.'}
                        </p>
                      </div>

                      {/* BOTTOM DUB BAR & CTAS */}
                      <div className="mt-3 pt-2 border-t border-[#292B39] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {(anime.languages ? anime.languages.split(/[,/ ]+/) : ['HIN', 'TAM']).slice(0, 3).map((l, i) => (
                            <span
                              key={`rec_match_${anime.id}_lang_${l}_${i}`}
                              className="px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase bg-[#191C29] border border-[#292B39] text-[#B49AF8]"
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
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 border ${
                                isSaved
                                  ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                                  : 'bg-[#191C29] hover:bg-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                              }`}
                              title={isSaved ? 'In Watchlist' : 'Save to Watchlist'}
                              aria-label={isSaved ? `Remove ${anime.title} from Watchlist` : `Add ${anime.title} to Watchlist`}
                            >
                              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                            </button>
                          )}

                          <span className="text-[11px] font-bold text-[#B49AF8] flex items-center gap-1">
                            <span>Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
