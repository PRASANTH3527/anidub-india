import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime } from './CatalogView';
import { isCanonicalAiring } from '../utils/animeStatus';
import { matchesSelectedPlatforms, normalizeCanonicalOttList } from '../utils/ottHub';
import { extractCompactLanguageCodes } from '../utils/languages';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EclipseState';
import { SkeletonGrid } from './SkeletonGrid';

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
  { id: 'action', label: 'Action & Shonen', sublabel: 'Battles, superpowers & high energy', icon: <Flame className="w-4 h-4 text-[#F9C876]" /> },
  { id: 'fantasy', label: 'Dark Fantasy & Magic', sublabel: 'Mythical realms, swords & supernatural', icon: <Sparkles className="w-4 h-4 text-[#B49AF8]" /> },
  { id: 'scifi', label: 'Sci-Fi & Cyberpunk', sublabel: 'Futuristic worlds, AI & mecha', icon: <Zap className="w-4 h-4 text-[#34D399]" /> },
  { id: 'thriller', label: 'Mystery & Thriller', sublabel: 'Suspense, mind games & investigations', icon: <Compass className="w-4 h-4 text-[#CBB6FF]" /> },
  { id: 'romance', label: 'Romance & Drama', sublabel: 'Emotional stories & character arcs', icon: <Heart className="w-4 h-4 text-[#F87171]" /> },
  { id: 'comedy', label: 'Comedy & Slice of Life', sublabel: 'Lighthearted & everyday adventures', icon: <Smile className="w-4 h-4 text-[#F9C876]" /> },
];

const STEP_2_LANGUAGES: OptionItem[] = [
  { id: 'any', label: 'Any Regional Dub', sublabel: 'All verified Indian audio tracks', icon: <Languages className="w-4 h-4 text-[#B49AF8]" /> },
  { id: 'TAM', label: 'Tamil', sublabel: 'Tamil dubbed releases', icon: <span className="text-xs font-bold text-[#B49AF8]">TA</span> },
  { id: 'HIN', label: 'Hindi', sublabel: 'Hindi dubbed releases', icon: <span className="text-xs font-bold text-[#34D399]">HI</span> },
  { id: 'TEL', label: 'Telugu', sublabel: 'Telugu dubbed releases', icon: <span className="text-xs font-bold text-[#CBB6FF]">TE</span> },
  { id: 'MAL', label: 'Malayalam', sublabel: 'Malayalam dubbed releases', icon: <span className="text-xs font-bold text-[#F9C876]">ML</span> },
  { id: 'KAN', label: 'Kannada', sublabel: 'Kannada dubbed releases', icon: <span className="text-xs font-bold text-[#F87171]">KN</span> },
];

const STEP_3_PLATFORMS: OptionItem[] = [
  { id: 'all', label: 'All Official OTTs', sublabel: 'Across licensed Indian platforms', icon: <Tv className="w-4 h-4 text-[#F4F3FA]" /> },
  { id: 'Crunchyroll', label: 'Crunchyroll India', sublabel: 'Regional dubbed simulcasts & catalog', icon: <span className="text-xs font-bold text-[#F9C876]">CR</span> },
  { id: 'Netflix', label: 'Netflix India', sublabel: 'Multi-language dubbed originals & series', icon: <span className="text-xs font-bold text-[#F87171]">NF</span> },
  { id: 'JioHotstar', label: 'JioHotstar', sublabel: 'Indian language anime streams', icon: <span className="text-xs font-bold text-[#B49AF8]">JH</span> },
  { id: 'Muse India', label: 'Muse India / YouTube', sublabel: 'Free official regional streams', icon: <span className="text-xs font-bold text-[#34D399]">YT</span> },
];

const STEP_4_LENGTHS: OptionItem[] = [
  { id: 'any', label: 'Any Length', sublabel: 'Single seasons, movies & long epics', icon: <Film className="w-4 h-4 text-[#F4F3FA]" /> },
  { id: 'short', label: 'Quick Watch (12–16 Eps)', sublabel: 'Compact single-season runs', icon: <Zap className="w-4 h-4 text-[#34D399]" /> },
  { id: 'medium', label: 'Multi-Cour (24+ Eps)', sublabel: 'Deeper long-running arcs', icon: <Flame className="w-4 h-4 text-[#F9C876]" /> },
  { id: 'airing', label: 'Currently Airing', sublabel: 'Weekly dubbed releases', icon: <TrendingUp className="w-4 h-4 text-[#B49AF8]" /> },
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

  const toggleSelection = (
    id: string,
    current: string[],
    setter: (val: string[]) => void,
    exclusiveId?: string
  ) => {
    if (exclusiveId && id === exclusiveId) {
      setter([exclusiveId]);
      return;
    }

    let next = [...current];
    if (exclusiveId && next.includes(exclusiveId)) {
      next = next.filter((i) => i !== exclusiveId);
    }

    if (next.includes(id)) {
      if (next.length > 1) {
        setter(next.filter((i) => i !== id));
      }
    } else {
      setter([...next, id]);
    }
  };

  const usingSubscriptionFilter = Boolean(mySubscriptionsEnabled && mySubscriptions.length > 0);
  const eligibleCatalog = useMemo(
    () =>
      usingSubscriptionFilter
        ? catalogList.filter((anime) => matchesSelectedPlatforms(anime as unknown as Record<string, unknown>, mySubscriptions))
        : catalogList,
    [catalogList, usingSubscriptionFilter, mySubscriptions]
  );

  const matchedAnime = useMemo(() => {
    return eligibleCatalog
      .map((anime) => {
        let score = 45;

        // 1. Vibe / Genre matching
        const genres = (anime.genres || '').toLowerCase();
        let vibeScore = 0;
        selectedVibes.forEach((vibe) => {
          if (vibe === 'action' && (genres.includes('action') || genres.includes('shonen'))) vibeScore += 28;
          else if (vibe === 'fantasy' && (genres.includes('fantasy') || genres.includes('magic') || genres.includes('supernatural'))) vibeScore += 28;
          else if (vibe === 'scifi' && (genres.includes('sci-fi') || genres.includes('cyberpunk') || genres.includes('mecha'))) vibeScore += 28;
          else if (vibe === 'thriller' && (genres.includes('thriller') || genres.includes('mystery') || genres.includes('drama'))) vibeScore += 28;
          else if (vibe === 'romance' && (genres.includes('romance') || genres.includes('drama') || genres.includes('slice'))) vibeScore += 28;
          else if (vibe === 'comedy' && (genres.includes('comedy') || genres.includes('slice'))) vibeScore += 28;
        });
        score += Math.min(vibeScore, 36);

        // 2. Language matching
        const langCodes = extractCompactLanguageCodes(anime.languages);
        if (selectedLanguages.includes('any')) {
          score += 18;
        } else {
          const langMatch = selectedLanguages.some((l) => langCodes.includes(l));
          if (langMatch) score += 24;
        }

        // 3. Platform matching
        const canonicalPlatforms = normalizeCanonicalOttList(anime as unknown as Record<string, unknown>);
        if (selectedPlatforms.includes('all')) {
          score += 12;
        } else {
          const platMatch = selectedPlatforms.some((p) =>
            canonicalPlatforms.some((cp) => cp.toLowerCase().includes(p.toLowerCase()))
          );
          if (platMatch) score += 18;
        }

        // 4. Length matching
        if (selectedLength === 'any') {
          score += 8;
        } else if (selectedLength === 'short' && anime.episodes_count && anime.episodes_count <= 16) {
          score += 14;
        } else if (selectedLength === 'medium' && anime.episodes_count && anime.episodes_count >= 20) {
          score += 14;
        } else if (selectedLength === 'airing' && isCanonicalAiring(anime as unknown as Record<string, unknown>)) {
          score += 14;
        }

        // 5. Rating bonus (only if verified rating > 0)
        const ratingNum = Number(anime.rating);
        if (Number.isFinite(ratingNum) && ratingNum > 0) {
          score += Math.min(Math.round(ratingNum * 1.2), 12);
        }

        const matchPercent = Math.min(Math.max(score, 62), 99);
        return {
          ...anime,
          matchPercent,
          canonicalPlatforms,
          langCodes,
        };
      })
      .sort((a, b) => b.matchPercent - a.matchPercent);
  }, [eligibleCatalog, selectedVibes, selectedLanguages, selectedPlatforms, selectedLength]);

  const topMatches = matchedAnime.slice(0, 6);

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const handleRestart = () => {
    setCurrentStep(1);
    setSelectedVibes(['action']);
    setSelectedLanguages(['any']);
    setSelectedPlatforms(['all']);
    setSelectedLength('any');
  };

  if (catalogList.length === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-4">
        <div className="h-20 rounded-[12px] bg-[#12141E] border border-[#292B39] animate-pulse" />
        <SkeletonGrid count={4} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-5 sm:py-7 font-sans text-[#F4F3FA] overflow-x-clip">
      {/* HEADER */}
      <header className="text-center max-w-2xl mx-auto mb-6 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F4F3FA] tracking-tight">
          Anime Matchmaker
        </h1>
        <p className="text-[#A1A5B5] text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Pick your vibe, preferred Indian dub language, and official OTT platform for tailored matches.
        </p>

        {usingSubscriptionFilter && (
          <div className="pt-1 inline-flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[#34D399]/10 border border-[#34D399]/35 text-[#34D399] text-xs font-semibold">
            <Tv className="w-3.5 h-3.5" />
            <span>My OTTs: {mySubscriptions.join(', ')} ({eligibleCatalog.length})</span>
            {onToggleMySubscriptionsEnabled && (
              <button
                type="button"
                onClick={() => onToggleMySubscriptionsEnabled(false)}
                className="underline hover:text-[#F4F3FA] cursor-pointer"
              >
                Show all
              </button>
            )}
          </div>
        )}
      </header>

      {/* CLEAN STEP PROGRESS */}
      <div className="max-w-3xl mx-auto mb-6 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[#A1A5B5]">
          <span>
            {currentStep <= 4 ? `Step ${currentStep} of 4` : 'Your Matches'}
          </span>
          <span className="text-[#B49AF8] tabular-nums">
            {currentStep <= 4
              ? `${eligibleCatalog.length} catalog titles`
              : `${topMatches.length} recommendations`}
          </span>
        </div>

        <div className="h-2 bg-[#12141E] rounded-full border border-[#292B39] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#B49AF8] transition-all duration-180 motion-reduce:transition-none"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {currentStep < 5 ? (
          <motion.div
            key={`recommendation_step_${currentStep}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 sm:p-6 max-w-3xl mx-auto space-y-5"
          >
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#F4F3FA]">Choose your story vibe</h2>
                  <p className="text-[#A1A5B5] text-xs mt-1">Select one or more genres you enjoy.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STEP_1_VIBES.map((opt) => {
                    const isSelected = selectedVibes.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleSelection(opt.id, selectedVibes, setSelectedVibes)}
                        className={`min-h-[56px] px-4 py-3 rounded-[12px] text-xs font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer flex items-start gap-3 text-left border ${
                          isSelected
                            ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]'
                            : 'bg-[#191C29]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">{opt.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#F4F3FA] flex items-center justify-between gap-2">
                            <span className="truncate">{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#B49AF8] shrink-0" />}
                          </div>
                          <p className="text-[11px] text-[#A1A5B5] font-normal mt-0.5">{opt.sublabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#F4F3FA]">Preferred Indian dub language</h2>
                  <p className="text-[#A1A5B5] text-xs mt-1">Select one or more regional dub tracks.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STEP_2_LANGUAGES.map((opt) => {
                    const isSelected = selectedLanguages.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleSelection(opt.id, selectedLanguages, setSelectedLanguages, 'any')}
                        className={`min-h-[56px] px-4 py-3 rounded-[12px] text-xs font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer flex items-start gap-3 text-left border ${
                          isSelected
                            ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]'
                            : 'bg-[#191C29]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#F4F3FA] flex items-center justify-between gap-2">
                            <span className="truncate">{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#B49AF8] shrink-0" />}
                          </div>
                          <p className="text-[11px] text-[#A1A5B5] font-normal mt-0.5">{opt.sublabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#F4F3FA]">Where do you stream?</h2>
                  <p className="text-[#A1A5B5] text-xs mt-1">Select your preferred official Indian OTT services.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STEP_3_PLATFORMS.map((opt) => {
                    const isSelected = selectedPlatforms.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleSelection(opt.id, selectedPlatforms, setSelectedPlatforms, 'all')}
                        className={`min-h-[56px] px-4 py-3 rounded-[12px] text-xs font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer flex items-start gap-3 text-left border ${
                          isSelected
                            ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]'
                            : 'bg-[#191C29]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#F4F3FA] flex items-center justify-between gap-2">
                            <span className="truncate">{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#B49AF8] shrink-0" />}
                          </div>
                          <p className="text-[11px] text-[#A1A5B5] font-normal mt-0.5">{opt.sublabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#F4F3FA]">Series length &amp; pacing</h2>
                  <p className="text-[#A1A5B5] text-xs mt-1">Choose a quick binge or a longer ongoing series.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STEP_4_LENGTHS.map((opt) => {
                    const isSelected = selectedLength === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedLength(opt.id)}
                        className={`min-h-[56px] px-4 py-3 rounded-[12px] text-xs font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer flex items-start gap-3 text-left border ${
                          isSelected
                            ? 'bg-[#191C29] text-[#F4F3FA] border-[#B49AF8]'
                            : 'bg-[#191C29]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#12141E] border border-[#292B39] flex items-center justify-center shrink-0">
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#F4F3FA] flex items-center justify-between gap-2">
                            <span className="truncate">{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#B49AF8] shrink-0" />}
                          </div>
                          <p className="text-[11px] text-[#A1A5B5] font-normal mt-0.5">{opt.sublabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-[#292B39]">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleBack}
                disabled={currentStep === 1}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {currentStep === 4 ? 'Show Matches' : 'Continue'}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="recommendation_step_5_results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 sm:p-5">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#F4F3FA]">
                  Recommended Indian Dubs
                </h2>
                <p className="text-[#A1A5B5] text-xs mt-0.5">
                  Showing {topMatches.length} verified catalog matches
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleRestart}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                >
                  Retake
                </Button>
                {onNavigateCatalog && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={onNavigateCatalog}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Browse Explore
                  </Button>
                )}
              </div>
            </div>

            {topMatches.length === 0 ? (
              <EmptyState
                title="No matching titles found"
                description="Try broadening your OTT subscription filter or retaking the matchmaker with another language."
                actionLabel="Retake Matchmaker"
                onAction={handleRestart}
                secondaryActionLabel={onNavigateCatalog ? 'Browse Explore' : undefined}
                onSecondaryAction={onNavigateCatalog}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {topMatches.map((anime, index) => {
                  const isSaved = watchlist.includes(anime.id);
                  const ratingNum = Number(anime.rating);
                  const hasVerifiedRating = Number.isFinite(ratingNum) && ratingNum > 0;
                  const honestOtt =
                    anime.canonicalPlatforms.length > 0 ? anime.canonicalPlatforms[0] : 'Not verified';

                  return (
                    <article
                      key={`recommendation_match_${anime.id}_${index}`}
                      onClick={() => onSelectAnime(anime)}
                      className="bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 rounded-[12px] p-3.5 flex gap-3.5 group transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                    >
                      {/* Strict 2:3 Poster */}
                      <div className="w-24 sm:w-28 aspect-[2/3] rounded-[10px] overflow-hidden bg-[#191C29] shrink-0 relative border border-[#292B39]">
                        <img
                          src={anime.cover_image || '/logo.png'}
                          alt={anime.title}
                          width={112}
                          height={168}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.src = '/logo.png';
                          }}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#0B0A10]/90 border border-[#34D399]/40 text-[10px] font-bold text-[#34D399] tabular-nums">
                          {anime.matchPercent}%
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-[#A1A5B5] bg-[#191C29] px-2 py-0.5 rounded-md border border-[#292B39] truncate">
                              {honestOtt}
                            </span>
                            {hasVerifiedRating && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F9C876] shrink-0 tabular-nums">
                                <Star className="w-3 h-3 fill-[#F9C876]" />
                                <span>{ratingNum.toFixed(1)}</span>
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-[#F4F3FA] group-hover:text-[#B49AF8] transition-colors duration-180 line-clamp-2 leading-snug">
                            {anime.title}
                          </h3>

                          {anime.genres && (
                            <p className="text-[11px] text-[#A1A5B5] line-clamp-1">{anime.genres}</p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#292B39] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            {anime.langCodes.slice(0, 3).map((code) => (
                              <span
                                key={`rec_match_${anime.id}_${code}`}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#191C29] border border-[#292B39] text-[#CBB6FF]"
                              >
                                {code}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {onToggleWatchlist && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleWatchlist(anime.id);
                                }}
                                className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-[10px] flex items-center justify-center transition-colors duration-180 border cursor-pointer ${
                                  isSaved
                                    ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                                    : 'bg-[#191C29] hover:border-[#B49AF8]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                                }`}
                                aria-label={isSaved ? `Remove ${anime.title} from library` : `Save ${anime.title}`}
                              >
                                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                              </button>
                            )}
                            <span className="text-xs font-bold text-[#B49AF8] inline-flex items-center gap-1">
                              <span>Details</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
