import React, { useState, useEffect, useRef } from 'react';
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

export function extractCompactLanguageCodes(rawLangs: unknown): string[] {
  const tokens: string[] = [];
  if (Array.isArray(rawLangs)) {
    for (const item of rawLangs) {
      if (typeof item === 'string') tokens.push(...item.split(/[,/|•+]+/));
    }
  } else if (typeof rawLangs === 'string') {
    tokens.push(...rawLangs.split(/[,/|•+]+/));
  }
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const norm = normalizeLanguageName(token);
    if (!norm || isExcludedLanguage(norm)) continue;
    const code = LANG_ABBR[norm] || norm.slice(0, 3).toUpperCase();
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const posterSrc =
    anime.cover_image ||
    anime.posterUrl ||
    anime.poster_url ||
    anime.poster ||
    anime.image ||
    '/logo.png';

  // Never default to Crunchyroll when platform is missing; normalize legacy OTT names canonically
  const platforms = normalizeCanonicalOttList(anime);
  const primaryPlatformLabel = platforms.length > 0 ? platforms[0] : 'Not verified';
  const extraPlatformCount = platforms.length > 1 ? platforms.length - 1 : 0;

  const langCodes = extractCompactLanguageCodes(anime.languages);
  const visibleLangCodes = langCodes.slice(0, 3);
  const extraLangCount = langCodes.length > 3 ? langCodes.length - 3 : 0;

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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="h-full"
      >
        <article
          onClick={() => onSelect(anime)}
          role="button"
          tabIndex={0}
          data-testid="anime-card"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(anime);
            }
          }}
          className="group relative h-full flex flex-col rounded-[12px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 active:scale-[0.99] overflow-hidden transition-all duration-180 motion-reduce:transition-none motion-reduce:active:scale-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B49AF8]/70"
        >
          {/* Cinematic Poster-First 2:3 Artwork Container */}
          <div
            data-testid="anime-card-poster"
            className="relative aspect-[2/3] w-full bg-[#191C29] overflow-hidden shrink-0"
          >
            {/* Subtle dark skeleton placeholder until artwork resolves */}
            {!imageLoaded && (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[#191C29] animate-pulse motion-reduce:animate-none pointer-events-none"
              />
            )}

            <Image
              src={posterSrc}
              alt={anime.title}
              width={300}
              height={450}
              priority={isPriorityCard}
              loading={isPriorityCard ? "eager" : "lazy"}
              onLoad={() => setImageLoaded(true)}
              sizes="(max-width: 640px) 48vw, (max-width: 1024px) 24vw, 220px"
              className="w-full h-full object-cover transition-transform duration-180 motion-reduce:transition-none group-hover:scale-[1.02]"
            />

            {/* At most ONE subtle top-left rating pill (only if a verified rating exists) */}
            {hasRating && (
              <div className="absolute top-2 left-2 pointer-events-none">
                <span
                  data-testid="anime-card-rating"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] bg-[#0B0A10]/90 border border-[#292B39] text-[11px] font-bold text-[#F9C876] tabular-nums"
                >
                  <Star className="w-3 h-3 fill-[#F9C876] text-[#F9C876]" />
                  {numericRating.toFixed(1)}
                </span>
              </div>
            )}

            {/* Top-Right: Single Primary Bookmark/Save Button (44x44px touch target, 180ms duotone lavender fill) */}
            {onToggleBookmark && (
              <div className="absolute top-1 right-1">
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
                  className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus:outline-none"
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

          {/* Clean, Honest Metadata Footer */}
          <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-2">
            <div className="space-y-1.5">
              {/* Title: Crisp #F4F3FA text, strictly clamped to 2 lines with consistent min-height */}
              <h3
                data-testid="anime-card-title"
                className="text-xs sm:text-sm font-bold text-[#F4F3FA] leading-snug line-clamp-2 min-h-[2.25rem] sm:min-h-[2.5rem] group-hover:text-[#CBB6FF] transition-colors duration-180 motion-reduce:transition-none"
              >
                {anime.title}
              </h3>

              {/* Language Badges: Compact regional dub pills (e.g., TAM, HIN, TEL) in muted elevated chips (#191C29) */}
              <div
                data-testid="anime-card-languages"
                className="flex items-center flex-wrap gap-1 min-h-[20px]"
              >
                {visibleLangCodes.length > 0 ? (
                  <>
                    {visibleLangCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] bg-[#191C29] border border-[#292B39] text-[10px] font-bold tracking-wider text-[#F4F3FA] uppercase leading-none"
                      >
                        {code}
                      </span>
                    ))}
                    {extraLangCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] bg-[#191C29] border border-[#292B39] text-[10px] font-semibold text-[#A1A5B5] leading-none">
                        +{extraLangCount}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] bg-[#191C29] border border-[#292B39] text-[10px] font-medium text-[#A1A5B5] leading-none">
                    Unverified dub
                  </span>
                )}
              </div>
            </div>

            {/* Footer Bar: Verified OTT Platform (never defaults to Crunchyroll) + Overflow (...) Menu */}
            <div className="pt-1.5 border-t border-[#292B39] flex items-center justify-between gap-1.5 text-[11px]">
              <div className="min-w-0 flex items-center gap-1.5 truncate">
                <span
                  data-testid="anime-card-platform"
                  className={`font-medium truncate ${
                    primaryPlatformLabel === 'Not verified'
                      ? 'text-[#A1A5B5]/75 italic'
                      : 'text-[#A1A5B5]'
                  }`}
                >
                  {primaryPlatformLabel}
                  {extraPlatformCount > 0 ? ` +${extraPlatformCount}` : ''}
                </span>
                {isMovie && (
                  <span className="text-[10px] text-[#A1A5B5]/80 font-semibold shrink-0">
                    · {displayTypeLabel}
                  </span>
                )}
              </div>

              {/* Compact Overflow (...) Menu Button in Card Footer */}
              <div className="relative shrink-0 -mr-1 -my-1" ref={menuRef}>
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
                  className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-[8px] text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29] flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    data-testid="anime-card-overflow-menu"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 bottom-full mb-1.5 w-44 rounded-[12px] bg-[#191C29] border border-[#292B39] shadow-2xl p-1 z-30"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleShare}
                      className="w-full px-3 py-2 rounded-[8px] text-left text-xs font-medium text-[#F4F3FA] hover:bg-[#12141E] flex items-center gap-2 transition-colors duration-180 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#B49AF8] shrink-0" />
                      <span>Share</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleCompare}
                      className="w-full px-3 py-2 rounded-[8px] text-left text-xs font-medium text-[#F4F3FA] hover:bg-[#12141E] flex items-center gap-2 transition-colors duration-180 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#CBB6FF] shrink-0" />
                      <span>Compare</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleToggleOffline}
                      className="w-full px-3 py-2 rounded-[8px] text-left text-xs font-medium text-[#F4F3FA] hover:bg-[#12141E] flex items-center gap-2 transition-colors duration-180 cursor-pointer"
                    >
                      {offlineSaved ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                      ) : (
                        <DownloadCloud className="w-3.5 h-3.5 text-[#A1A5B5] shrink-0" />
                      )}
                      <span>{offlineSaved ? 'Saved Offline' : 'Save Info Offline'}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleReport}
                      className="w-full px-3 py-2 rounded-[8px] text-left text-xs font-medium text-[#F87171] hover:bg-[#F87171]/15 flex items-center gap-2 transition-colors duration-180 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5 shrink-0" />
                      <span>Report wrong info</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>
      </motion.div>

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
