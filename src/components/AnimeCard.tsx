import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import Image from './OptimizedImage';
import {
  CheckCircle2,
  DownloadCloud,
  Flag,
  Share2,
  Star,
  MoreHorizontal,
  ArrowLeftRight,
  ImageOff,
  RefreshCw,
  X,
} from 'lucide-react';
import { useToast } from './Toast';
import { ReportModal } from './ReportModal';
import {
  isAnimeOffline,
  saveAnimeForOffline,
  removeAnimeFromOffline,
  subscribeOfflineChanges,
} from '../utils/offlineStorage';
import { normalizeCanonicalOttList } from '../utils/ottHub';
import { normalizeLanguageName, isExcludedLanguage } from '../utils/languages';

export const TRENDING_VOTE_THRESHOLD = 100;

export interface AnimeCardData {
  id: number;
  title: string;
  slug?: string;
  synopsis?: string;
  cover_image?: string;
  image?: string;
  poster?: string;
  posterUrl?: string;
  poster_url?: string;
  banner_image?: string;
  rating: number;
  episodes_count?: number | null;
  status?: string;
  airing_status?: string;
  season?: string;
  year?: number;
  releaseYear?: number;
  genres?: string;
  popularity?: number;
  languages?: string | string[];
  platform?: string | string[];
  platforms_data?: unknown;
  streaming_partners?: unknown;
  type?: string;
  likesCount?: number;
}

export interface AnimeCardProps {
  anime: AnimeCardData;
  onSelect: (anime: AnimeCardData) => void;
  index?: number;
  priority?: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: number) => void;
  onCompare?: (anime: AnimeCardData) => void;
  isLiked?: boolean;
  onToggleLike?: (id: number, liked?: boolean, newCount?: number) => void;
  isUpvoted?: boolean;
  onToggleUpvote?: (id: number, upvoted?: boolean, newCount?: number) => void;
  isTrending?: boolean;
  isCached?: boolean;
}

export const ParallaxCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`h-full ${className}`}>{children}</div>;

const LANG_ABBR: Record<string, string> = {
  Tamil: 'TAM',
  Hindi: 'HIN',
  Telugu: 'TEL',
  Malayalam: 'MAL',
  Kannada: 'KAN',
  Bengali: 'BEN',
  Marathi: 'MAR',
  Punjabi: 'PUN',
  Gujarati: 'GUJ',
};

const CANONICAL_LANG_ORDER: Record<string, number> = {
  Tamil: 1,
  Hindi: 2,
  Telugu: 3,
  Malayalam: 4,
  Kannada: 5,
  Bengali: 6,
  Marathi: 7,
  Gujarati: 8,
  Punjabi: 9,
};

export function extractOrderedLanguages(rawLangs: unknown): string[] {
  const tokens: string[] = [];
  if (Array.isArray(rawLangs)) {
    for (const item of rawLangs) {
      if (typeof item === 'string') tokens.push(...item.split(/[,/|•+·]+/));
    }
  } else if (typeof rawLangs === 'string') {
    tokens.push(...rawLangs.split(/[,/|•+·]+/));
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const norm = normalizeLanguageName(token);
    if (!norm || isExcludedLanguage(norm)) continue;
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(norm);
    }
  }
  return unique.sort(
    (a, b) => (CANONICAL_LANG_ORDER[a] ?? 99) - (CANONICAL_LANG_ORDER[b] ?? 99)
  );
}

export function extractCompactLanguageCodes(rawLangs: unknown): string[] {
  const ordered = extractOrderedLanguages(rawLangs);
  return ordered.map((norm) => LANG_ABBR[norm] || norm.slice(0, 3).toUpperCase());
}

const AnimeCardComponent: React.FC<AnimeCardProps> = ({
  anime,
  onSelect,
  index,
  priority = false,
  isBookmarked = false,
  onToggleBookmark,
  onCompare,
}) => {
  const isPriorityCard = Boolean(priority || (typeof index === 'number' && index < 4));
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageFailed, setImageFailed] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const syncOffline = () => {
      Promise.resolve(isAnimeOffline(anime.id))
        .then((saved) => {
          if (active) setOfflineSaved(Boolean(saved));
        })
        .catch(() => {});
    };
    syncOffline();
    const unsub = subscribeOfflineChanges(syncOffline);
    return () => {
      active = false;
      unsub();
    };
  }, [anime.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const rawPosterSrc = (
    anime.cover_image ||
    anime.posterUrl ||
    anime.poster_url ||
    anime.poster ||
    anime.image ||
    ''
  ).trim();

  const hasValidPosterUrl = Boolean(rawPosterSrc && rawPosterSrc !== '/logo.png');
  const posterSrcWithRetry =
    hasValidPosterUrl && retryCount > 0
      ? `${rawPosterSrc}${rawPosterSrc.includes('?') ? '&' : '?'}retry=${retryCount}`
      : rawPosterSrc;

  useEffect(() => {
    setImageFailed(!hasValidPosterUrl);
    setImageLoaded(false);
  }, [rawPosterSrc, hasValidPosterUrl]);

  const handleRetryImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFailed(false);
    setImageLoaded(false);
    setRetryCount((c) => c + 1);
  };

  // Never default to Crunchyroll when platform is missing; normalize legacy OTT names canonically
  const platforms = normalizeCanonicalOttList(anime);
  const primaryPlatformLabel = platforms.length > 0 ? platforms[0] : 'Not verified';
  const extraPlatformCount = platforms.length > 1 ? platforms.length - 1 : 0;

  const orderedLanguages = extractOrderedLanguages(anime.languages);
  const visibleLanguageNames = orderedLanguages.slice(0, 3);
  const extraLangCount = orderedLanguages.length > 3 ? orderedLanguages.length - 3 : 0;
  const orderedLanguageText =
    visibleLanguageNames.length > 0
      ? visibleLanguageNames.join(' · ')
      : 'Unverified dub';

  const numericRating = Number(anime.rating);
  const hasRating = Number.isFinite(numericRating) && numericRating > 0;
  const animeType = anime.type || 'TV Series';
  const isMovie = animeType.toLowerCase() === 'movie';
  const displayTypeLabel = isMovie ? 'Movie' : animeType;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const shareUrl = `${window.location.origin}/anime/${anime.slug || anime.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${anime.title} — AniDub India`,
          text: `Check verified Indian dub availability for ${anime.title} on AniDub India.`,
          url: shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast?.success('Link Copied', `Share link for ${anime.title} copied to clipboard.`);
      }
    } catch {
      // User cancelled native share
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (onCompare) {
      onCompare(anime);
      return;
    }
    const compareTrigger = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Compare Anime"]'
    );
    if (compareTrigger) {
      compareTrigger.click();
    } else {
      onSelect(anime);
    }
  };

  const handleToggleOffline = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (offlineSaved) {
      removeAnimeFromOffline(anime.id);
      setOfflineSaved(false);
      toast?.info('Removed Offline Copy', `${anime.title} removed from offline info cache.`);
    } else {
      saveAnimeForOffline(anime as any);
      setOfflineSaved(true);
      toast?.success('Saved Offline', `${anime.title} info saved for offline viewing.`);
    }
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setShowReportModal(true);
  };

  // Mobile Bottom Sheet for Card Overflow Menu
  const mobileOverflowSheet =
    menuOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Actions for ${anime.title}`}
            data-testid="anime-card-overflow-sheet"
            className="sm:hidden fixed inset-0 z-[85] flex flex-col justify-end"
          >
            <div
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/80 transition-opacity duration-180"
              aria-hidden="true"
            />
            <div
              className="relative z-10 w-full rounded-t-3xl bg-[#12141E] border-t border-[#292B39] px-4 pt-2.5 pb-6 space-y-3 shadow-2xl"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1.5 rounded-full bg-[#292B39] mx-auto" />
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#292B39]">
                <div className="min-w-0">
                  <h4 className="text-[14px] font-semibold text-[#F4F3FA] truncate">
                    {anime.title}
                  </h4>
                  <p className="text-xs text-[#A1A5B5] truncate">
                    {orderedLanguageText} · {primaryPlatformLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close actions menu"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[#191C29] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-180 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-[12px] bg-[#191C29] border border-[#292B39] text-left text-xs font-semibold text-[#F4F3FA] hover:border-[#B49AF8]/50 flex items-center gap-3 transition-colors duration-180 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#B49AF8] shrink-0" />
                  <span>Share anime</span>
                </button>

                <button
                  type="button"
                  onClick={handleCompare}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-[12px] bg-[#191C29] border border-[#292B39] text-left text-xs font-semibold text-[#F4F3FA] hover:border-[#B49AF8]/50 flex items-center gap-3 transition-colors duration-180 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4 text-[#CBB6FF] shrink-0" />
                  <span>Compare anime</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleOffline}
                  aria-label="Save Info Offline"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-[12px] bg-[#191C29] border border-[#292B39] text-left text-xs font-semibold text-[#F4F3FA] hover:border-[#B49AF8]/50 flex items-center gap-3 transition-colors duration-180 cursor-pointer"
                >
                  {offlineSaved ? (
                    <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
                  ) : (
                    <DownloadCloud className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                  )}
                  <span>{offlineSaved ? 'Saved offline' : 'Save information offline'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReport}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-[12px] bg-[#F87171]/10 border border-[#F87171]/35 text-left text-xs font-semibold text-[#F87171] hover:bg-[#F87171]/20 flex items-center gap-3 transition-colors duration-180 cursor-pointer"
                >
                  <Flag className="w-4 h-4 text-[#F87171] shrink-0" />
                  <span>Report incorrect information</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="h-full"
      >
        <article
          data-testid="anime-card"
          className="group relative h-full flex flex-col rounded-[12px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 sm:hover:scale-[1.02] active:scale-[0.99] overflow-hidden transition-all duration-180 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
        >
          {/* Cinematic Poster-First 2:3 Artwork Container */}
          <div
            data-testid="anime-card-poster"
            className="relative aspect-[2/3] w-full bg-[#191C29] overflow-hidden shrink-0"
          >
            {/* Subtle dark skeleton placeholder until artwork resolves */}
            {!imageLoaded && !imageFailed && (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[#191C29] animate-pulse motion-reduce:animate-none pointer-events-none"
              />
            )}

            {imageFailed ? (
              <div
                data-testid="anime-card-poster-fallback"
                onClick={() => onSelect(anime)}
                className="absolute inset-0 bg-[#191C29] p-3 flex flex-col items-center justify-center text-center gap-2 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-[12px] bg-[#12141E] border border-[#292B39] text-[#A1A5B5] flex items-center justify-center">
                  <ImageOff className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[#A1A5B5]">Poster unavailable</span>
                {hasValidPosterUrl && (
                  <button
                    type="button"
                    onClick={handleRetryImage}
                    className="min-h-[36px] px-3 py-1 rounded-[10px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8] text-[11px] font-semibold text-[#F4F3FA] inline-flex items-center gap-1.5 transition-colors duration-180 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-[#B49AF8]" />
                    <span>Retry image</span>
                  </button>
                )}
              </div>
            ) : (
              <div
                onClick={() => onSelect(anime)}
                className="w-full h-full cursor-pointer"
              >
                <Image
                  src={posterSrcWithRetry}
                  fallbackSrc=""
                  alt={anime.title}
                  width={300}
                  height={450}
                  priority={isPriorityCard}
                  loading={isPriorityCard ? "eager" : "lazy"}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageFailed(true)}
                  sizes="(max-width: 640px) 48vw, (max-width: 1024px) 24vw, 220px"
                  className="w-full h-full object-cover transition-transform duration-180 motion-reduce:transition-none"
                />
              </div>
            )}

            {/* At most ONE subtle top-left rating pill (only if a verified rating exists) */}
            {hasRating && (
              <div className="absolute top-2 left-2 pointer-events-none">
                <span
                  data-testid="anime-card-rating"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] bg-[#0B0A10]/90 border border-[#292B39] text-[12px] font-bold text-[#F9C876] tabular-nums"
                >
                  <Star className="w-3 h-3 fill-[#F9C876] text-[#F9C876]" />
                  {numericRating.toFixed(1)}
                </span>
              </div>
            )}

            {/* Top-Right: Single Primary Bookmark/Save Button (44x44px touch target, 180ms duotone lavender fill) */}
            {onToggleBookmark && (
              <div className="absolute top-1 right-1 z-10">
                <button
                  type="button"
                  data-testid="anime-card-bookmark"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark(anime.id);
                  }}
                  aria-label={
                    isBookmarked
                      ? `Remove ${anime.title} from Library`
                      : `Save ${anime.title} to Library`
                  }
                  aria-pressed={isBookmarked}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B49AF8]/70 rounded-[12px]"
                >
                  <span
                    className={`w-9 h-9 rounded-[10px] border flex items-center justify-center transition-all duration-180 motion-reduce:transition-none ${
                      isBookmarked
                        ? 'bg-[#191C29]/95 border-[#B49AF8] text-[#B49AF8]'
                        : 'bg-[#0B0A10]/85 border-[#292B39] text-[#F4F3FA] hover:bg-[#191C29] hover:border-[#B49AF8]/50'
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="w-4 h-4 transition-all duration-180 motion-reduce:transition-none"
                    >
                      <path
                        d="M6 4.75C6 3.7835 6.7835 3 7.75 3H16.25C17.2165 3 18 3.7835 18 4.75V20.25L12 16.5L6 20.25V4.75Z"
                        fill={isBookmarked ? '#B49AF8' : 'none'}
                        fillOpacity={isBookmarked ? 0.3 : 0}
                        stroke={isBookmarked ? '#B49AF8' : 'currentColor'}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Clean, Honest Metadata Footer (12px padding) */}
          <div className="p-3 flex flex-col flex-1 justify-between gap-2 bg-[#12141E]">
            {/* Primary Card Selection Trigger (Non-nested button for keyboard & screen-reader accessibility) */}
            <button
              type="button"
              data-testid="anime-card-select"
              onClick={() => onSelect(anime)}
              aria-label={`Open details for ${anime.title}`}
              className="w-full text-left space-y-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B49AF8]/70 rounded-[8px]"
            >
              {/* Title: 14px, font-weight 600, 20px line-height, #F4F3FA, clamped to 2 lines with fixed 40px min-height */}
              <h3
                data-testid="anime-card-title"
                className="text-[14px] font-semibold text-[#F4F3FA] leading-[20px] line-clamp-2 min-h-[40px] group-hover:text-[#CBB6FF] transition-colors duration-180 motion-reduce:transition-none"
              >
                {anime.title}
              </h3>

              {/* Regional Language Labels in Consistent Order (Tamil · Hindi · Telugu) */}
              <div
                data-testid="anime-card-languages"
                className="flex items-center flex-wrap gap-1 min-h-[22px]"
              >
                <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#191C29] border border-[#292B39] text-[11px] sm:text-[12px] font-medium text-[#A1A5B5] leading-tight truncate max-w-full">
                  {orderedLanguageText}
                  {extraLangCount > 0 ? ` +${extraLangCount}` : ''}
                </span>
              </div>
            </button>

            {/* Footer Bar: Compact 12px Star Rating + Verified OTT Platform + 44x44px Overflow (...) Menu */}
            <div className="pt-1.5 border-t border-[#292B39] flex items-center justify-between gap-1.5 text-[12px] min-h-[38px]">
              <button
                type="button"
                onClick={() => onSelect(anime)}
                tabIndex={-1}
                aria-hidden="true"
                className="min-w-0 flex items-center gap-1.5 truncate text-left cursor-pointer"
              >
                {hasRating && (
                  <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-[#F9C876] tabular-nums shrink-0">
                    <Star className="w-3 h-3 fill-[#F9C876] text-[#F9C876]" />
                    <span>{numericRating.toFixed(1)}</span>
                    <span className="text-[#292B39] mx-0.5">·</span>
                  </span>
                )}
                <span
                  data-testid="anime-card-platform"
                  className={`text-[11px] sm:text-[12px] font-medium truncate ${
                    primaryPlatformLabel === 'Not verified'
                      ? 'text-[#A1A5B5]/75 italic'
                      : 'text-[#A1A5B5]'
                  }`}
                >
                  {primaryPlatformLabel}
                  {extraPlatformCount > 0 ? ` +${extraPlatformCount}` : ''}
                </span>
                {isMovie && (
                  <span className="text-[11px] text-[#A1A5B5]/80 font-semibold shrink-0">
                    · {displayTypeLabel}
                  </span>
                )}
              </button>

              {/* 44x44px Overflow (...) Menu Button in Card Footer */}
              <div className="relative shrink-0 -mr-1.5 -my-1.5" ref={menuRef}>
                <button
                  type="button"
                  data-testid="anime-card-overflow-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((prev) => !prev);
                  }}
                  aria-label={`More actions for ${anime.title}`}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29] flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B49AF8]/70"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {/* Desktop Anchored Context Menu */}
                {menuOpen && (
                  <div
                    role="menu"
                    data-testid="anime-card-overflow-menu"
                    onClick={(e) => e.stopPropagation()}
                    className="hidden sm:block absolute right-0 bottom-full mb-1.5 w-56 rounded-[12px] bg-[#191C29] border border-[#292B39] shadow-2xl p-1.5 z-30 space-y-0.5"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleShare}
                      className="w-full min-h-[44px] px-3 py-2 rounded-[10px] text-left text-xs font-semibold text-[#F4F3FA] hover:bg-[#12141E] flex items-center gap-2.5 transition-colors duration-180 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-[#B49AF8] shrink-0" />
                      <span>Share anime</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleCompare}
                      className="w-full min-h-[44px] px-3 py-2 rounded-[10px] text-left text-xs font-semibold text-[#F4F3FA] hover:bg-[#12141E] flex items-center gap-2.5 transition-colors duration-180 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-[#CBB6FF] shrink-0" />
                      <span>Compare anime</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      aria-label="Save Info Offline"
                      onClick={handleToggleOffline}
                      className="w-full min-h-[44px] px-3 py-2 rounded-[10px] text-left text-xs font-semibold text-[#F4F3FA] hover:bg-[#12141E] flex items-center gap-2.5 transition-colors duration-180 cursor-pointer"
                    >
                      {offlineSaved ? (
                        <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
                      ) : (
                        <DownloadCloud className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                      )}
                      <span>{offlineSaved ? 'Saved offline' : 'Save information offline'}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleReport}
                      className="w-full min-h-[44px] px-3 py-2 rounded-[10px] text-left text-xs font-semibold text-[#F87171] hover:bg-[#F87171]/15 flex items-center gap-2.5 transition-colors duration-180 cursor-pointer"
                    >
                      <Flag className="w-4 h-4 text-[#F87171] shrink-0" />
                      <span>Report incorrect information</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>
      </motion.div>

      {mobileOverflowSheet}

      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          animeId={anime.id}
          animeTitle={anime.title}
        />
      )}
    </>
  );
};

export const AnimeCard = React.memo(AnimeCardComponent);
