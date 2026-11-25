import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from './OptimizedImage';
import {
  CheckCircle2,
  DownloadCloud,
  Flag,
  Share2,
  Bookmark,
  Star,
  MoreVertical,
} from 'lucide-react';
import { useToast } from './Toast';
import { ReportModal } from './ReportModal';
import {
  isAnimeOffline,
  saveAnimeForOffline,
  removeAnimeFromOffline,
  subscribeOfflineChanges,
} from '../utils/offlineStorage';
import { parsePlatformList } from '../utils/dataNormalization';
import { isCanonicalAiring } from '../utils/animeStatus';
import { normalizeLanguageName, isExcludedLanguage } from '../utils/languages';

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
  priority = false,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(() => isAnimeOffline(anime.id));
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOfflineSaved(isAnimeOffline(anime.id));
    return subscribeOfflineChanges(() => {
      setOfflineSaved(isAnimeOffline(anime.id));
    });
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

  // P0 #3: Never guess Crunchyroll when platform is missing
  const platforms = parsePlatformList(
    anime.platform,
    undefined,
    anime.platforms_data ?? anime.streaming_partners,
    { defaultFallback: [] }
  );
  const primaryPlatformLabel = platforms.length > 0 ? platforms[0] : 'Not verified';
  const extraPlatformCount = platforms.length > 1 ? platforms.length - 1 : 0;

  const langCodes = extractCompactLanguageCodes(anime.languages);
  const visibleLangCodes = langCodes.slice(0, 3);
  const extraLangCount = langCodes.length > 3 ? langCodes.length - 3 : 0;
  const compactLangText =
    visibleLangCodes.length > 0
      ? `${visibleLangCodes.join(' • ')}${extraLangCount > 0 ? ` +${extraLangCount}` : ''}`
      : 'Dub info unverified';

  const isAiring = isCanonicalAiring(anime);
  const numericRating = Number(anime.rating);
  const hasRating = Number.isFinite(numericRating) && numericRating > 0;

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
        className="group relative h-full flex flex-col rounded-2xl bg-[#101522] border border-white/10 hover:border-purple-500/45 overflow-hidden transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/60"
      >
        {/* Uniform 3:4 Poster Container */}
        <div className="relative aspect-[3/4] w-full bg-[#0a0e18] overflow-hidden shrink-0">
          <Image
            src={posterSrc}
            alt={anime.title}
            priority={priority}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />

          {/* Subtle bottom readability gradient */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#101522] via-[#101522]/40 to-transparent pointer-events-none" />

          {/* Top-Left: Status / Rating badge */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            {hasRating && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-bold text-amber-300 tabular-nums">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {numericRating.toFixed(1)}
              </span>
            )}
            {isAiring && (
              <span className="px-2 py-1 rounded-lg bg-emerald-600/85 text-white text-[10px] font-bold uppercase tracking-wide">
                Airing
              </span>
            )}
          </div>

          {/* Top-Right: Single Primary Action (Save/Bookmark) + Clean Overflow Menu */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5" ref={menuRef}>
            {onToggleBookmark && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(anime.id);
                }}
                aria-label={isBookmarked ? `Remove ${anime.title} from Library` : `Save ${anime.title} to Library`}
                aria-pressed={isBookmarked}
                className={`w-9 h-9 rounded-xl backdrop-blur-md border flex items-center justify-center transition-colors cursor-pointer ${
                  isBookmarked
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-black/70 border-white/15 text-neutral-200 hover:bg-black/90 hover:text-white'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label={`More actions for ${anime.title}`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="w-9 h-9 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/15 text-neutral-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[#0e1422] border border-white/15 shadow-2xl p-1 z-30"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleShare}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-neutral-200 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                    <span>Share Link</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleToggleOffline}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-neutral-200 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    {offlineSaved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <DownloadCloud className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    )}
                    <span>{offlineSaved ? 'Saved Offline' : 'Save Info Offline'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleReport}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-rose-300 hover:bg-rose-500/15 flex items-center gap-2 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5 shrink-0" />
                    <span>Report Issue</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean Metadata Body (Uniform Height) */}
        <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between gap-2">
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-purple-200 transition-colors">
              {anime.title}
            </h3>

            {/* Compact Language Summary */}
            <p className="text-[11px] font-semibold tracking-wide text-purple-300 truncate">
              {compactLangText}
            </p>
          </div>

          {/* Honest OTT Platform Footer */}
          <div className="pt-2 border-t border-white/8 flex items-center justify-between gap-2 text-[11px]">
            <span
              className={`font-medium truncate ${
                primaryPlatformLabel === 'Not verified' ? 'text-neutral-500 italic' : 'text-neutral-300'
              }`}
            >
              {primaryPlatformLabel}
              {extraPlatformCount > 0 ? ` +${extraPlatformCount}` : ''}
            </span>
            {anime.year ? (
              <span className="text-neutral-500 font-medium tabular-nums shrink-0">{anime.year}</span>
            ) : null}
          </div>
        </div>
      </article>

      {showReportModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <ReportModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            animeId={anime.id}
            animeTitle={anime.title}
          />,
          document.body
        )}
    </>
  );
};

export const AnimeCard = React.memo(AnimeCardComponent);
