import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import Image from './OptimizedImage';
import {
  CheckCircle2,
  DownloadCloud,
  Flag,
  Share2,
  Bookmark,
  Star,
  MoreHorizontal,
  Flame,
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
import { isCanonicalAiring } from '../utils/animeStatus';
import { normalizeLanguageName, isExcludedLanguage } from '../utils/languages';

const TRENDING_VOTE_THRESHOLD = 100;

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

function extractCompactLanguageCodes(rawLangs: unknown): string[] {
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
  isTrending = false,
}) => {
  const isPriorityCard = Boolean(priority || (typeof index === 'number' && index < 4));
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState<boolean>(false);
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

  // Never guess Crunchyroll when platform is missing; normalize legacy OTT names canonically
  const platforms = normalizeCanonicalOttList(anime);
  const primaryPlatformLabel = platforms.length > 0 ? platforms[0] : 'Not verified';
  const extraPlatformCount = platforms.length > 1 ? platforms.length - 1 : 0;

  const langCodes = extractCompactLanguageCodes(anime.languages);
  const visibleLangCodes = langCodes.slice(0, 3);
  const extraLangCount = langCodes.length > 3 ? langCodes.length - 3 : 0;
  const compactLangText =
    visibleLangCodes.length > 0
      ? `${visibleLangCodes.join(' · ')}${extraLangCount > 0 ? ` +${extraLangCount}` : ''}`
      : 'Dub info unverified';

  const isAiring = isCanonicalAiring(anime);
  const numericRating = Number(anime.rating);
  const hasRating = Number.isFinite(numericRating) && numericRating > 0;
  const animeType = anime.type || 'TV Series';
  const isMovie = animeType.toLowerCase() === 'movie';
  const displayTypeLabel = isMovie ? 'Movie' : animeType;
  const showTrendingBadge = Boolean(
    isTrending && Number(anime.popularity || 0) >= TRENDING_VOTE_THRESHOLD
  );

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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(anime);
            }
          }}
          className="group relative h-full flex flex-col rounded-2xl bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 overflow-hidden transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B49AF8]/70"
        >
          {/* Cinematic Poster-First 3:4 Artwork Container */}
          <div className="relative aspect-[3/4] w-full bg-[#0B0A10] overflow-hidden shrink-0">
            <Image
              src={posterSrc}
              alt={anime.title}
              width={300}
              height={400}
              priority={isPriorityCard}
              loading={isPriorityCard ? "eager" : "lazy"}
              sizes="(max-width: 640px) 48vw, (max-width: 1024px) 24vw, 220px"
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />

            {/* Measured bottom contrast scrim */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#12141E] via-[#12141E]/40 to-transparent pointer-events-none" />

            {/* Top-Left: Quiet Rating & Status indicators */}
            <div className="absolute top-2 left-2 flex flex-col items-start gap-1 pointer-events-none">
              {hasRating && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0B0A10]/85 border border-[#292B39] text-[11px] font-bold text-[#F9C876] tabular-nums">
                  <Star className="w-3 h-3 fill-[#F9C876] text-[#F9C876]" />
                  {numericRating.toFixed(1)}
                </span>
              )}
              {isAiring && (
                <span className="px-2 py-0.5 rounded-lg bg-[#12141E]/90 border border-[#34D399]/40 text-[#34D399] text-[10px] font-bold uppercase tracking-wide">
                  Airing
                </span>
              )}
              {showTrendingBadge && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-[#12141E]/90 border border-[#F9C876]/40 text-[#F9C876] text-[10px] font-bold uppercase tracking-wide">
                  <Flame className="w-2.5 h-2.5" />
                  Hot
                </span>
              )}
            </div>

            {/* Top-Right: Single Primary Bookmark Button (44x44px hit target) */}
            {onToggleBookmark && (
              <div className="absolute top-1.5 right-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark(anime.id);
                  }}
                  aria-label={isBookmarked ? `Remove ${anime.title} from Library` : `Save ${anime.title} to Library`}
                  aria-pressed={isBookmarked}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus:outline-none"
                >
                  <span
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors duration-150 ${
                      isBookmarked
                        ? 'bg-[#B49AF8] border-[#B49AF8] text-[#0B0A10]'
                        : 'bg-[#0B0A10]/80 border-[#292B39] text-[#F4F3FA] hover:bg-[#191C29] hover:border-[#B49AF8]/50'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Clean Metadata Body (Uniform Height, Overflow menu off the poster) */}
          <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-1.5">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-1">
                <h3 className="text-xs sm:text-sm font-bold text-[#F4F3FA] leading-snug line-clamp-2 min-h-[2.25rem] sm:min-h-[2.5rem] group-hover:text-[#CBB6FF] transition-colors duration-150 flex-1">
                  {anime.title}
                </h3>

                {/* Overflow (...) Menu Trigger positioned cleanly beside title */}
                <div className="relative shrink-0 -mr-1.5 -mt-1" ref={menuRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen((prev) => !prev);
                    }}
                    aria-label={`More actions for ${anime.title}`}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29] flex items-center justify-center transition-colors duration-150 cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-1 w-44 rounded-xl bg-[#191C29] border border-[#292B39] shadow-2xl p-1 z-30"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleShare}
                        className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-[#F4F3FA] hover:bg-[#12141E] flex items-center gap-2 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#B49AF8] shrink-0" />
                        <span>Share Link</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleToggleOffline}
                        className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-[#F4F3FA] hover:bg-[#12141E] flex items-center gap-2 cursor-pointer"
                      >
                        {offlineSaved ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                        ) : (
                          <DownloadCloud className="w-3.5 h-3.5 text-[#CBB6FF] shrink-0" />
                        )}
                        <span>{offlineSaved ? 'Saved Offline' : 'Save Info Offline'}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleReport}
                        className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-[#F87171] hover:bg-[#F87171]/15 flex items-center gap-2 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5 shrink-0" />
                        <span>Report Issue</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Compact Regional Language Summary */}
              <p className="text-[11px] font-semibold tracking-wide text-[#CBB6FF] truncate">
                {compactLangText}
              </p>
            </div>

            {/* Honest OTT Platform Footer */}
            <div className="pt-1.5 border-t border-[#292B39] flex items-center justify-between gap-2 text-[11px]">
              <span
                className={`font-medium truncate ${
                  primaryPlatformLabel === 'Not verified' ? 'text-[#A1A5B5]/70 italic' : 'text-[#A1A5B5]'
                }`}
              >
                {primaryPlatformLabel}
                {extraPlatformCount > 0 ? ` +${extraPlatformCount}` : ''}
              </span>
              {isMovie ? (
                <span className="text-[#A1A5B5] font-semibold shrink-0">{displayTypeLabel}</span>
              ) : anime.year ? (
                <span className="text-[#A1A5B5] font-medium tabular-nums shrink-0">{anime.year}</span>
              ) : (
                <span className="text-[#A1A5B5] font-medium shrink-0">{displayTypeLabel}</span>
              )}
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
