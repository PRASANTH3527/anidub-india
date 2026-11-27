import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Star, Tv, Calendar, Heart, CheckCircle, Play, ExternalLink,
  Share2, Bell, BellOff, Edit, ThumbsUp, AlertTriangle, Plus,
  Minus, Flag, ArrowLeft, ShieldCheck, Globe,
  ChevronDown, ChevronUp, Languages, RotateCcw, CheckCheck, Trash2, Compass
} from 'lucide-react';
import {
  Anime,
  WatchlistStatus,
  normalizeAnimeRecord,
  normalizeAnimeList,
} from '../types';
import { PlatformIcon } from './PlatformIcons';
import { ReportModal } from './ReportModal';
import { cloudflareApi, type AnimeTranslationItem } from '../services/cloudflareApi';
import { generateOttUrl } from '../utils/ottRedirect';
import { OptimizedImage } from './OptimizedImage';
import {
  buildDubProgressBreakdown,
  normalizeDubSeasonBreakdowns,
  NormalizedSeasonBreakdown,
} from '../utils/dubProgress';
import {
  buildIndianDubIntelligenceCards,
  computeEpisodeProgressStats,
  createWatchedSetFromCount,
  getEpisodeRanges,
  markAllEpisodesWatched,
  readPersonalWatchStatus,
  readStoredWatchedEpisodesBySeason,
  resolveSingleHeroRating,
  shouldResetDetailTabOnPropChange,
  toggleEpisodeNumber,
  writePersonalWatchStatus,
  writeStoredWatchedEpisodesBySeason,
  type IndianDubStatus,
} from '../utils/animeDetailIntelligence';
import { DetailModalSkeleton } from './ui/EclipseState';
import { buildAnimeJsonLd } from '../utils/seo';
import { useAuth } from '../lib/clerk';
import { getCloudflareWsUrl } from '../config/cloudflare';
import { getVerifiedClerkUsername } from '../utils/chatIdentity';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { formatLocaleDate, formatLocaleNumber, LANGUAGE_REGISTRY } from '../i18n/languageRegistry';
import {
  resolveOfficialTrailerFromAnime,
  type DubReviewAggregate,
  type DubReviewRecord,
  type FranchiseLinkItem,
  type VerifiedCastEntry,
} from '../utils/animeDetailsV2';
import { OfficialTrailerCard } from './details/OfficialTrailerCard';
import { AnimeUniverseSection } from './details/AnimeUniverseSection';
import { VerifiedCastSection } from './details/VerifiedCastSection';
import { RegionalDubReviewsPanel } from './details/RegionalDubReviewsPanel';

export interface FranchiseEntry {
  id: string;
  title: string;
  releaseYear?: number;
  relationType: 'Prequel' | 'Sequel' | 'Current' | 'Side Story' | 'Main Story';
  seasonNumber?: number;
  poster?: string;
}

export interface AnimeDetailPageProps {
  anime?: any | null;
  animeId?: number | string | null;
  initialAnime?: any | null;
  onResolvedAnime?: (resolved: any) => void;
  allAnime?: any[];
  onClose: () => void;
  isInWatchlist?: boolean;
  watchlist?: any[];
  onToggleWatchlist: (id: any, e?: any) => void;
  watchlistStatus?: WatchlistStatus;
  onUpdateStatus?: (id: string, status: WatchlistStatus) => void;
  onSelectAnime?: (anime: any) => void;
  onEditAnime?: (anime: any) => void;
  onCompareAnime?: (anime: any) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  followedIds?: string[];
  onToggleFollow?: (id: string, e?: React.MouseEvent) => void;
  onReportIssue?: (anime: Anime) => void;
  onWriteReview?: () => void;
  user?: { id?: string; name?: string; email?: string; isAdmin?: boolean } | null;
  asPage?: boolean;
  isLoading?: boolean;
}

interface ReviewItem {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  likes: number;
  isSpoiler?: boolean;
}

type DetailTabId = 'overview' | 'seasons-dubs' | 'progress' | 'reviews';

const UNVERIFIED_COUNT_LABEL = 'Episode count not verified';
const LEGACY_UNVERIFIED_COUNT_FALLBACK = 'Count not verified';

/**
 * Derive verified franchise entries strictly from catalog relationships or normalized root title
 * when multiple distinct catalog entries exist. Never fabricates external titles.
 */
export function deriveVerifiedFranchiseOrder(animeInput: any, catalogInput: any[] = []): FranchiseEntry[] {
  if (!animeInput) return [];
  const anime = normalizeAnimeRecord(animeInput);
  if (Array.isArray(animeInput.franchise_entries) && animeInput.franchise_entries.length > 1) {
    return animeInput.franchise_entries.map((entry: any, idx: number) => ({
      id: String(entry.id),
      title: String(entry.title || ''),
      releaseYear: Number(entry.year || entry.releaseYear) || undefined,
      relationType:
        String(entry.id) === String(anime.id)
          ? 'Current'
          : (entry.relation_type as FranchiseEntry['relationType']) || 'Main Story',
      seasonNumber: Number(entry.sequence_number) || idx + 1,
      poster: entry.cover_image || entry.poster,
    }));
  }

  const catalog = normalizeAnimeList(catalogInput);
  if (catalog.length <= 1) return [];

  const getBaseFranchiseKey = (title: string) =>
    title
      .toLowerCase()
      .replace(/\s*(?:season\s*\d+|part\s*\d+|cour\s*\d+|s\d+|:\s*.*)$/i, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

  const currentBase = getBaseFranchiseKey(anime.title);
  if (!currentBase || currentBase.length < 4) return [];

  const related = catalog
    .filter((item) => {
      if (item.id === anime.id) return true;
      const itemBase = getBaseFranchiseKey(item.title);
      return itemBase === currentBase || item.title.toLowerCase().startsWith(currentBase);
    })
    .sort((a, b) => (a.releaseYear || 9999) - (b.releaseYear || 9999));

  if (related.length <= 1) return [];

  const currentIndex = related.findIndex((r) => r.id === anime.id);

  return related.map((item, idx) => {
    let relationType: FranchiseEntry['relationType'] = 'Main Story';
    if (item.id === anime.id) {
      relationType = 'Current';
    } else if (idx < currentIndex) {
      relationType = 'Prequel';
    } else {
      relationType = 'Sequel';
    }
    return {
      id: item.id,
      title: item.title,
      releaseYear: item.releaseYear && item.releaseYear > 1900 ? item.releaseYear : undefined,
      relationType,
      seasonNumber: idx + 1,
      poster: item.poster,
    };
  });
}

function getDubStatusBadgeClasses(status: IndianDubStatus): string {
  switch (status) {
    case 'Complete':
      return 'bg-[#34D399]/15 text-[#059669] dark:text-[#34D399] border-[#34D399]/40';
    case 'Partial':
      return 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/35';
    case 'Announced':
      return 'bg-[#FBBF24]/15 text-[#B45309] dark:text-[#FBBF24] border-[#FBBF24]/40';
    case 'Listed':
      return 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-strong)]';
    default:
      return 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]';
  }
}

export const AnimeDetailPage: React.FC<AnimeDetailPageProps> = ({
  anime: animeProp,
  animeId,
  initialAnime,
  onResolvedAnime,
  allAnime = [],
  onClose,
  isInWatchlist: isInWatchlistProp,
  watchlist,
  onToggleWatchlist,
  watchlistStatus: watchlistStatusProp,
  onUpdateStatus,
  onSelectAnime,
  onEditAnime,
  onShowToast,
  followedIds,
  onToggleFollow,
  onReportIssue,
  user,
  asPage = false,
  isLoading: isLoadingProp = false,
}) => {
  const { getToken } = useAuth();
  const { t } = useTranslation(['animeDetails', 'common', 'library']);
  const { language: uiLocale } = useLanguage();
  const [fetchedRecord, setFetchedRecord] = useState<any | null>(null);
  const [fetchingDetail, setFetchingDetail] = useState<boolean>(false);
  const [internalReportOpen, setInternalReportOpen] = useState<boolean>(false);
  const [wsReviewError, setWsReviewError] = useState<string | null>(null);
  const [publishedTranslation, setPublishedTranslation] = useState<AnimeTranslationItem | null>(null);
  const [showOriginalSynopsis, setShowOriginalSynopsis] = useState<boolean>(false);

  const onResolvedAnimeRef = useRef(onResolvedAnime);
  useEffect(() => {
    onResolvedAnimeRef.current = onResolvedAnime;
  }, [onResolvedAnime]);

  useEffect(() => {
    const rawTarget = animeProp || initialAnime;
    if (animeId !== null && animeId !== undefined && !animeProp) {
      let cancelled = false;
      if (!rawTarget) setFetchingDetail(true);
      cloudflareApi
        .getAnimeById(animeId, undefined, { locale: uiLocale })
        .then((res) => {
          if (cancelled || !res) return;
          const record = (res as any).data && typeof (res as any).data === 'object' ? (res as any).data : res;
          if (!record || (!record.id && !record.title)) return;
          setFetchedRecord(record);
          onResolvedAnimeRef.current?.(record);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setFetchingDetail(false);
        });
      return () => {
        cancelled = true;
      };
    } else {
      setFetchedRecord(null);
      setFetchingDetail(false);
    }
  }, [animeId, animeProp, uiLocale]);

  const rawAnimeRecord = animeProp || fetchedRecord || initialAnime;
  const anime: Anime | null = useMemo(() => {
    if (!rawAnimeRecord) return null;
    return normalizeAnimeRecord(rawAnimeRecord);
  }, [rawAnimeRecord]);

  // Fetch published localized synopsis/title whenever active UI locale is non-English
  useEffect(() => {
    setShowOriginalSynopsis(false);
    if (!anime?.id || !uiLocale || uiLocale === 'en') {
      setPublishedTranslation(null);
      return;
    }

    if (
      anime.hasPublishedTranslation &&
      anime.translationLocale === uiLocale &&
      (anime.localizedSynopsis || anime.localizedTitle || anime.localizedDescription)
    ) {
      setPublishedTranslation({
        id: 0,
        anime_id: String(anime.id),
        locale: uiLocale,
        localized_title: anime.localizedTitle || null,
        synopsis: anime.localizedSynopsis || null,
        description: anime.localizedDescription || null,
        source_hash: null,
        translation_status: 'published',
        updated_by: null,
        created_at: '',
        updated_at: '',
      });
      return;
    }

    let cancelled = false;
    cloudflareApi
      .fetchPublicAnimeTranslation(anime.id, uiLocale)
      .then((tr) => {
        if (!cancelled) setPublishedTranslation(tr);
      })
      .catch(() => {
        if (!cancelled) setPublishedTranslation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    anime?.id,
    anime?.hasPublishedTranslation,
    anime?.translationLocale,
    anime?.localizedSynopsis,
    anime?.localizedTitle,
    anime?.localizedDescription,
    uiLocale,
  ]);

  const isLoading = isLoadingProp || (fetchingDetail && !anime);

  const isInWatchlist = useMemo(() => {
    if (typeof isInWatchlistProp === 'boolean') return isInWatchlistProp;
    if (!anime || !Array.isArray(watchlist)) return false;
    return watchlist.some((item) => {
      const idVal = item && typeof item === 'object' ? item.id : item;
      return String(idVal) === String(anime.id);
    });
  }, [isInWatchlistProp, watchlist, anime]);

  const [activeTab, setActiveTab] = useState<DetailTabId>('overview');
  const [isFollowed, setIsFollowed] = useState(false);
  const [personalWatchStatus, setPersonalWatchStatus] = useState<WatchlistStatus>(
    watchlistStatusProp || 'Plan to Watch'
  );
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [dubReviews, setDubReviews] = useState<DubReviewRecord[]>([]);
  const [dubReviewsSummary, setDubReviewsSummary] = useState<DubReviewAggregate>({
    count: 0,
    overall: null,
    voice_acting: null,
    voice_casting: null,
    translation_quality: null,
    lip_sync: null,
    emotional_delivery: null,
  });
  const [dubReviewsByLanguage, setDubReviewsByLanguage] = useState<
    Record<string, DubReviewAggregate>
  >({});
  const [activeDubLangFilter, setActiveDubLangFilter] = useState<string>('All');
  const [dubReviewSubmitState, setDubReviewSubmitState] = useState<'idle' | 'posting' | 'failed'>(
    'idle'
  );
  const [dubReviewSubmitError, setDubReviewSubmitError] = useState<string | null>(null);
  const [d1FranchiseEntries, setD1FranchiseEntries] = useState<FranchiseLinkItem[]>([]);
  const [verifiedCastEntries, setVerifiedCastEntries] = useState<VerifiedCastEntry[]>([]);
  const [verifiedCastLanguages, setVerifiedCastLanguages] = useState<string[]>([]);
  const [verifiedCastByLanguage, setVerifiedCastByLanguage] = useState<
    Record<string, VerifiedCastEntry[]>
  >({});
  const [watchedEpisodesBySeason, setWatchedEpisodesBySeason] = useState<Record<number, number[]>>({
    1: [],
  });
  const [progressUndoSnapshot, setProgressUndoSnapshot] = useState<Record<number, number[]> | null>(
    null
  );
  const [selectedProgressSeason, setSelectedProgressSeason] = useState<number>(1);
  const [selectedEpisodeChunkIdx, setSelectedEpisodeChunkIdx] = useState<number>(0);
  const [selectedMatrixSeason, setSelectedMatrixSeason] = useState<number>(1);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [spoilerShieldEnabled, setSpoilerShieldEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('anidub_spoiler_shield');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [revealedReviewIds, setRevealedReviewIds] = useState<Record<string, boolean>>({});

  const modalContainerRef = useRef<HTMLDivElement>(null);
  const whereToWatchRef = useRef<HTMLElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const lastInitializedAnimeIdRef = useRef<string | null>(null);
  const lastTrackedOttImpressionAnimeIdRef = useRef<string | null>(null);

  const mergedAnimeRecord = useMemo(
    () => (anime ? { ...(rawAnimeRecord || {}), ...anime } : null),
    [anime, rawAnimeRecord]
  );
  const dubProgress = useMemo(
    () => (mergedAnimeRecord ? buildDubProgressBreakdown(mergedAnimeRecord) : null),
    [mergedAnimeRecord]
  );
  const seasonBreakdowns: NormalizedSeasonBreakdown[] = useMemo(
    () => (mergedAnimeRecord ? normalizeDubSeasonBreakdowns(mergedAnimeRecord) : []),
    [mergedAnimeRecord]
  );
  const indianDubCards = useMemo(
    () =>
      mergedAnimeRecord
        ? buildIndianDubIntelligenceCards(mergedAnimeRecord, dubProgress)
        : [],
    [mergedAnimeRecord, dubProgress]
  );
  const franchiseEntries = useMemo(
    () => (anime ? deriveVerifiedFranchiseOrder(anime, allAnime) : []),
    [anime, allAnime]
  );
  const heroRating = useMemo(() => (anime ? resolveSingleHeroRating(anime) : null), [anime]);
  const officialTrailer = useMemo(
    () => resolveOfficialTrailerFromAnime(mergedAnimeRecord),
    [mergedAnimeRecord]
  );

  // Accessibility: Focus trap, Escape key to close, and background scroll lock when rendered as modal
  useEffect(() => {
    if (asPage || !anime) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalContainerRef.current) {
        const focusable = modalContainerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [asPage, anime, onClose]);

  /**
   * ROOT-CAUSE TAB BUG FIX:
   * Anime initialization runs ONLY when `anime?.id` actually changes to a different anime.
   * Never depends on `followedIds`, watchlist updates, or parent callback references so
   * `activeTab`, selected season, and reviews NEVER snap back to Overview during interactions.
   */
  useEffect(() => {
    const nextId = anime?.id ? String(anime.id) : null;
    if (!shouldResetDetailTabOnPropChange(lastInitializedAnimeIdRef.current, nextId) || !nextId) {
      return;
    }
    lastInitializedAnimeIdRef.current = nextId;

    setActiveTab('overview');
    setSelectedProgressSeason(1);
    setSelectedEpisodeChunkIdx(0);
    setSelectedMatrixSeason(1);
    setIsSynopsisExpanded(false);
    setProgressUndoSnapshot(null);
    setActiveDubLangFilter('All');
    setDubReviewSubmitState('idle');
    setDubReviewSubmitError(null);
    setD1FranchiseEntries([]);
    setVerifiedCastEntries([]);
    setVerifiedCastLanguages([]);
    setVerifiedCastByLanguage({});

    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    setWatchedEpisodesBySeason(readStoredWatchedEpisodesBySeason(nextId, storage));
    setPersonalWatchStatus(
      readPersonalWatchStatus(nextId, watchlistStatusProp || 'Plan to Watch', storage)
    );

    let cancelled = false;
    const fetchDetailsData = async () => {
      let token: string | null = null;
      if (user?.id) {
        try {
          token = await getToken();
        } catch {
          token = null;
        }
      }

      const [legacyRes, dubReviewsRes, franchiseRes, castRes] = await Promise.allSettled([
        cloudflareApi.getReviews(nextId),
        cloudflareApi.fetchDubReviews(nextId, undefined, token),
        cloudflareApi.fetchAnimeFranchise(nextId),
        cloudflareApi.fetchAnimeCast(nextId),
      ]);

      if (cancelled) return;

      if (legacyRes.status === 'fulfilled' && legacyRes.value && legacyRes.value.length > 0) {
        setReviews(legacyRes.value);
      } else {
        try {
          const allReviews = JSON.parse(localStorage.getItem('anime_reviews') || '{}');
          setReviews(Array.isArray(allReviews[nextId]) ? allReviews[nextId] : []);
        } catch {
          setReviews([]);
        }
      }

      if (dubReviewsRes.status === 'fulfilled') {
        setDubReviews(dubReviewsRes.value.reviews);
        setDubReviewsSummary(dubReviewsRes.value.summary);
        setDubReviewsByLanguage(dubReviewsRes.value.byLanguage);
      } else {
        setDubReviews([]);
      }

      if (franchiseRes.status === 'fulfilled') {
        setD1FranchiseEntries(franchiseRes.value.entries);
      }

      if (castRes.status === 'fulfilled') {
        setVerifiedCastEntries(castRes.value.entries);
        setVerifiedCastLanguages(castRes.value.languages);
        setVerifiedCastByLanguage(castRes.value.byLanguage);
      }
    };
    void fetchDetailsData();

    return () => {
      cancelled = true;
    };
  }, [anime?.id]);

  // Separate effect for Follow state sync (never resets activeTab or progress)
  const followedIdsKey = Array.isArray(followedIds) ? followedIds.join(',') : '__local__';
  useEffect(() => {
    if (!anime?.id) return;
    if (Array.isArray(followedIds) && followedIds.length > 0) {
      setIsFollowed(followedIds.includes(anime.id));
    } else {
      try {
        const follows = JSON.parse(localStorage.getItem('anime_follows') || '[]');
        setIsFollowed(Array.isArray(follows) && follows.includes(anime.id));
      } catch {
        setIsFollowed(false);
      }
    }
  }, [anime?.id, followedIdsKey]);

  // Separate effect for external watchlist status prop updates (never resets activeTab)
  useEffect(() => {
    if (watchlistStatusProp) {
      setPersonalWatchStatus(watchlistStatusProp);
    }
  }, [watchlistStatusProp]);

  // Silent Phase 3 & 3.5 Demand Intelligence: track anime_detail_view, OTT impressions & non-English translation requests
  useEffect(() => {
    if (!anime?.id) return;
    const animeIdStr = String(anime.id);
    if (lastTrackedOttImpressionAnimeIdRef.current !== animeIdStr) {
      lastTrackedOttImpressionAnimeIdRef.current = animeIdStr;
      void cloudflareApi.trackDemandEvent({
        event_type: 'anime_detail_view',
        anime_id: animeIdStr,
        language_code: uiLocale,
      });
      const platforms = Array.isArray(anime.platforms)
        ? anime.platforms.filter((p) => Boolean(p && p.trim().length > 0))
        : [];
      for (const platformName of platforms) {
        void cloudflareApi.trackDemandEvent({
          event_type: 'ott_impression',
          anime_id: animeIdStr,
          platform_name: platformName,
          language_code: uiLocale,
        });
      }
    }
    if (uiLocale && uiLocale !== 'en') {
      void cloudflareApi.trackDemandEvent({
        event_type: 'translation_request',
        anime_id: animeIdStr,
        language_code: uiLocale,
      });
    }
  }, [anime?.id, anime?.platforms, uiLocale]);

  // Live authenticated WebSocket listener for real-time review updates & error propagation
  useEffect(() => {
    if (!anime?.id || typeof WebSocket === 'undefined') return;
    let isMounted = true;
    let ws: WebSocket | null = null;
    try {
      const wsUrl = getCloudflareWsUrl('/ws');
      ws = new WebSocket(wsUrl);
      ws.onopen = async () => {
        if (!isMounted || !ws || ws.readyState !== WebSocket.OPEN) return;
        if (user) {
          try {
            const token = await getToken();
            if (token && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'auth',
                  token,
                  username: getVerifiedClerkUsername(user) || user.name || 'AnimeFan_IN',
                })
              );
            }
          } catch {
            // Non-fatal auth handshake fallback
          }
        }
      };
      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msgData = JSON.parse(event.data);
          if (msgData?.type === 'error') {
            const errMsg = msgData.error || msgData.message || 'Live update error.';
            setWsReviewError(errMsg);
            return;
          }
          if (msgData?.type === 'review' && String(msgData.anime_id) === String(anime.id)) {
            setReviews((prev) => {
              const incomingId = String(msgData.id || Date.now());
              if (prev.some((r) => r.id === incomingId)) return prev;
              return [
                {
                  id: incomingId,
                  userName: msgData.user_name || msgData.userName || 'AnimeFan_IN',
                  rating: Number(msgData.rating) || 8,
                  comment: msgData.comment || '',
                  date: 'Just now',
                  likes: 0,
                  isSpoiler: Boolean(msgData.isSpoiler),
                },
                ...prev,
              ];
            });
          }
        } catch {
          // Ignore malformed payloads
        }
      };
    } catch {
      // Fallback to REST reviews
    }
    return () => {
      isMounted = false;
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, [anime?.id, user, getToken]);

  if (isLoading) {
    return (
      <div
        className={
          asPage
            ? 'max-w-[1280px] mx-auto px-4 sm:px-6 py-6'
            : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm'
        }
      >
        <div className="w-full max-w-4xl mx-auto">
          <DetailModalSkeleton />
        </div>
      </div>
    );
  }

  if (!anime) return null;

  const currentSeasonObj =
    seasonBreakdowns.find((s) => s.seasonNumber === selectedProgressSeason) || seasonBreakdowns[0];
  const currentSeasonMaxEpisodes =
    currentSeasonObj && currentSeasonObj.totalEpisodes && currentSeasonObj.totalEpisodes > 0
      ? currentSeasonObj.totalEpisodes
      : anime.episodesCount && anime.episodesCount > 0
        ? anime.episodesCount
        : null;

  const currentSeasonWatchedList = watchedEpisodesBySeason[selectedProgressSeason] || [];
  const episodeStats = computeEpisodeProgressStats(
    currentSeasonWatchedList,
    currentSeasonMaxEpisodes
  );
  const episodeRanges =
    currentSeasonMaxEpisodes && currentSeasonMaxEpisodes > 50
      ? getEpisodeRanges(currentSeasonMaxEpisodes, 50)
      : [];
  const activeEpisodeRange =
    episodeRanges[selectedEpisodeChunkIdx] ||
    (currentSeasonMaxEpisodes
      ? { index: 0, start: 1, end: currentSeasonMaxEpisodes, label: `1–${currentSeasonMaxEpisodes}` }
      : null);

  const persistWatchedBySeason = async (
    nextBySeason: Record<number, number[]>,
    saveUndo = true,
    overrideStatus?: WatchlistStatus
  ) => {
    if (saveUndo) {
      setProgressUndoSnapshot(watchedEpisodesBySeason);
    }
    setWatchedEpisodesBySeason(nextBySeason);
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    const totalWatchedAcrossSeasons = writeStoredWatchedEpisodesBySeason(
      anime.id,
      nextBySeason,
      storage
    );

    const effectiveStatus = overrideStatus || personalWatchStatus || 'Watching';
    if (user?.id) {
      try {
        await cloudflareApi.syncWatchlistItem({
          anime_id: anime.id,
          status: effectiveStatus,
          progress: totalWatchedAcrossSeasons,
        });
      } catch {
        // Best-effort offline tolerance
      }
    }
  };

  const handleToggleEpisode = (episodeNumber: number) => {
    const nextSeasonList = toggleEpisodeNumber(
      currentSeasonWatchedList,
      episodeNumber,
      currentSeasonMaxEpisodes
    );
    const nextBySeason = {
      ...watchedEpisodesBySeason,
      [selectedProgressSeason]: nextSeasonList,
    };
    const nextStats = computeEpisodeProgressStats(nextSeasonList, currentSeasonMaxEpisodes);
    let nextStatus = personalWatchStatus;
    if (nextStats.isCompleted && seasonBreakdowns.length <= 1) {
      nextStatus = 'Completed';
      setPersonalWatchStatus('Completed');
      writePersonalWatchStatus(anime.id, 'Completed', typeof window !== 'undefined' ? window.localStorage : null);
      onUpdateStatus?.(anime.id, 'Completed');
    } else if (nextStats.watchedCount > 0 && personalWatchStatus === 'Plan to Watch') {
      nextStatus = 'Watching';
      setPersonalWatchStatus('Watching');
      writePersonalWatchStatus(anime.id, 'Watching', typeof window !== 'undefined' ? window.localStorage : null);
      onUpdateStatus?.(anime.id, 'Watching');
    }
    void persistWatchedBySeason(nextBySeason, true, nextStatus);
  };

  const handleStepEpisodeCount = (nextCount: number) => {
    const nextList = createWatchedSetFromCount(nextCount, currentSeasonMaxEpisodes);
    const nextBySeason = {
      ...watchedEpisodesBySeason,
      [selectedProgressSeason]: nextList,
    };
    void persistWatchedBySeason(nextBySeason, true);
  };

  const handleMarkAllWatched = () => {
    if (!currentSeasonMaxEpisodes || currentSeasonMaxEpisodes <= 0) return;
    const nextList = markAllEpisodesWatched(currentSeasonMaxEpisodes);
    const nextBySeason = {
      ...watchedEpisodesBySeason,
      [selectedProgressSeason]: nextList,
    };
    let nextStatus = personalWatchStatus;
    if (seasonBreakdowns.length <= 1) {
      nextStatus = 'Completed';
      setPersonalWatchStatus('Completed');
      writePersonalWatchStatus(anime.id, 'Completed', typeof window !== 'undefined' ? window.localStorage : null);
      onUpdateStatus?.(anime.id, 'Completed');
    }
    void persistWatchedBySeason(nextBySeason, true, nextStatus);
    onShowToast?.(`Marked Season ${selectedProgressSeason} as watched`, 'success');
  };

  const handleResetSeasonProgress = () => {
    const nextBySeason = {
      ...watchedEpisodesBySeason,
      [selectedProgressSeason]: [],
    };
    void persistWatchedBySeason(nextBySeason, true);
    onShowToast?.(`Reset Season ${selectedProgressSeason} progress`, 'info');
  };

  const handleUndoProgress = () => {
    if (!progressUndoSnapshot) return;
    const snapshot = progressUndoSnapshot;
    setProgressUndoSnapshot(null);
    void persistWatchedBySeason(snapshot, false);
    onShowToast?.('Progress change undone', 'info');
  };

  const handlePersonalStatusChange = (nextStatus: WatchlistStatus) => {
    setPersonalWatchStatus(nextStatus);
    writePersonalWatchStatus(
      anime.id,
      nextStatus,
      typeof window !== 'undefined' ? window.localStorage : null
    );
    onUpdateStatus?.(anime.id, nextStatus);
    if (!isInWatchlist) {
      onToggleWatchlist(anime.id);
    }
    if (user?.id) {
      const totalWatched = Object.values(watchedEpisodesBySeason).reduce(
        (sum, list) => sum + list.length,
        0
      );
      void cloudflareApi
        .syncWatchlistItem({
          anime_id: anime.id,
          status: nextStatus,
          progress: totalWatched,
        })
        .catch(() => {});
    }
  };

  const handleToggleSpoilerShield = () => {
    const next = !spoilerShieldEnabled;
    setSpoilerShieldEnabled(next);
    try {
      localStorage.setItem('anidub_spoiler_shield', String(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleSubmitDubReview = async (payload: {
    dub_language: string;
    voice_acting: number;
    voice_casting: number;
    translation_quality: number;
    lip_sync: number;
    emotional_delivery: number;
    review_text?: string;
    has_spoilers?: boolean;
  }) => {
    if (!user?.id) {
      setDubReviewSubmitError('Please sign in to publish your regional dub rating.');
      throw new Error('Authentication required');
    }

    setDubReviewSubmitState('posting');
    setDubReviewSubmitError(null);
    try {
      const token = await getToken();
      const verifiedReviewerName = getVerifiedClerkUsername(user) || user?.name || 'AnimeFan_IN';
      await cloudflareApi.submitDubReview(
        anime.id,
        {
          ...payload,
          user_name: verifiedReviewerName,
        },
        token
      );
      const refreshed = await cloudflareApi.fetchDubReviews(anime.id, undefined, token);
      setDubReviews(refreshed.reviews);
      setDubReviewsSummary(refreshed.summary);
      setDubReviewsByLanguage(refreshed.byLanguage);
      setDubReviewSubmitState('idle');
      onShowToast?.(`${payload.dub_language} dub rating published`, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Could not publish dub review. Tap Retry.';
      setDubReviewSubmitError(msg);
      setDubReviewSubmitState('failed');
      onShowToast?.('Could not publish dub review. Tap Retry.', 'error');
      throw err;
    }
  };

  const handleDeleteDubReview = async (reviewId: number) => {
    if (!user?.id) return;
    try {
      const token = await getToken();
      await cloudflareApi.deleteDubReview(anime.id, reviewId, token);
      const refreshed = await cloudflareApi.fetchDubReviews(anime.id, undefined, token);
      setDubReviews(refreshed.reviews);
      setDubReviewsSummary(refreshed.summary);
      setDubReviewsByLanguage(refreshed.byLanguage);
      onShowToast?.('Dub review removed', 'info');
    } catch (err: any) {
      onShowToast?.(err?.message || 'Could not delete dub review', 'error');
    }
  };

  const handleLikeReview = (reviewId: string) => {
    const updatedReviews = reviews.map((r) => (r.id === reviewId ? { ...r, likes: r.likes + 1 } : r));
    setReviews(updatedReviews);
    const allReviews = JSON.parse(localStorage.getItem('anime_reviews') || '{}');
    allReviews[anime.id] = updatedReviews;
    localStorage.setItem('anime_reviews', JSON.stringify(allReviews));
  };

  const toggleFollow = (e: React.MouseEvent) => {
    if (onToggleFollow) {
      onToggleFollow(anime.id, e);
      setIsFollowed(!isFollowed);
      return;
    }
    const follows = JSON.parse(localStorage.getItem('anime_follows') || '[]');
    let newFollows: string[];
    if (isFollowed) {
      newFollows = follows.filter((id: string) => id !== anime.id);
      if (onShowToast) onShowToast(`Unfollowed ${anime.title}`, 'info');
    } else {
      newFollows = [...follows, anime.id];
      if (onShowToast) onShowToast(`Following ${anime.title} for dub updates`, 'success');
    }
    localStorage.setItem('anime_follows', JSON.stringify(newFollows));
    setIsFollowed(!isFollowed);
  };

  const handleShare = () => {
    const slugOrId = anime.slug || anime.id;
    const shareUrl = `${window.location.origin}/anime/${slugOrId}`;
    if (navigator.share) {
      navigator
        .share({
          title: `${anime.title} — Regional Dub Guide`,
          text: `Check out verified regional dub and OTT details for ${anime.title} on AniDub India`,
          url: shareUrl,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      if (onShowToast) onShowToast('Link copied to clipboard', 'info');
    }
  };

  const handlePrimaryWhereToWatchClick = () => {
    if (activeTab !== 'overview') {
      setActiveTab('overview');
      requestAnimationFrame(() => {
        whereToWatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    if (whereToWatchRef.current) {
      whereToWatchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Strict Data Honesty: Only verified OTT platforms from the record; NEVER default to Crunchyroll
  const verifiedPlatforms = Array.isArray(anime.platforms)
    ? anime.platforms.filter((p) => Boolean(p && p.trim().length > 0))
    : [];

  const updatedDateDisplay = anime.lastUpdated
    ? formatLocaleDate(anime.lastUpdated, uiLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const statusOptions: WatchlistStatus[] = [
    'Watching',
    'Completed',
    'Plan to Watch',
    'On Hold',
    'Dropped',
    'Rewatching',
  ];

  const getLocalizedStatusLabel = (status: WatchlistStatus): string => {
    const keyMap: Record<WatchlistStatus, string> = {
      Watching: 'library:tabs.watching',
      Completed: 'library:tabs.completed',
      'Plan to Watch': 'library:tabs.planToWatch',
      'On Hold': 'library:tabs.onHold',
      Dropped: 'library:tabs.dropped',
      Rewatching: 'library:tabs.rewatching',
    };
    return t(keyMap[status] || status, status);
  };

  const totalReviewCount = dubReviews.length + reviews.length;

  const tabs: { id: DetailTabId; label: string; shortLabel?: string }[] = [
    { id: 'overview', label: t('animeDetails:tabs.overview', 'Overview') },
    { id: 'seasons-dubs', label: t('animeDetails:tabs.seasonsAndDubs', 'Seasons & Dubs') },
    { id: 'progress', label: t('animeDetails:tabs.watchProgress', 'Watch Progress') },
    {
      id: 'reviews',
      label: t('animeDetails:tabs.reviews', {
        count: formatLocaleNumber(totalReviewCount, uiLocale),
        defaultValue: `Reviews (${totalReviewCount})`,
      }),
    },
  ];

  const activeLocaleMeta = LANGUAGE_REGISTRY.find((lang) => lang.code === uiLocale);
  const activeLocalizedTitle =
    uiLocale !== 'en' && publishedTranslation?.localized_title
      ? publishedTranslation.localized_title.trim()
      : uiLocale !== 'en' && anime.hasPublishedTranslation && anime.translationLocale === uiLocale && anime.localizedTitle
        ? anime.localizedTitle.trim()
        : null;
  const activeLocalizedSynopsis =
    uiLocale !== 'en' && publishedTranslation?.synopsis
      ? publishedTranslation.synopsis.trim()
      : uiLocale !== 'en' && anime.hasPublishedTranslation && anime.translationLocale === uiLocale && anime.localizedSynopsis
        ? anime.localizedSynopsis.trim()
        : null;
  const hasLocalizedSynopsis = Boolean(activeLocalizedSynopsis);
  const originalEnglishSynopsis =
    anime.synopsis || t('animeDetails:noSynopsis', 'No verified synopsis available yet.');
  const synopsisText =
    hasLocalizedSynopsis && !showOriginalSynopsis
      ? (activeLocalizedSynopsis as string)
      : originalEnglishSynopsis;
  const isLongSynopsis = synopsisText.length > 240;

  const activeMatrixSeason =
    seasonBreakdowns.find((s) => s.seasonNumber === selectedMatrixSeason) || seasonBreakdowns[0];

  const posterIsPlaceholderLogo =
    !anime.poster || anime.poster === '/logo.png' || anime.poster.endsWith('/logo.png');
  const backdropUrl = anime.bannerImage || (!posterIsPlaceholderLogo ? anime.poster : '');
  const isFallbackBlurredBanner = !anime.bannerImage && Boolean(backdropUrl);
  const animeFormatLabel = anime.type || 'Series';
  const publicationStatusLabel = anime.status || null;
  const episodeMetaLabel =
    anime.episodesCount && anime.episodesCount > 0
      ? `${formatLocaleNumber(anime.episodesCount, uiLocale)} ${t('animeDetails:episodes', 'Episodes')}`
      : null;

  const seasonEpisodeDisplay =
    (anime as any).seasonEpisodeCount ||
    (anime as any).season_episode_count ||
    dubProgress?.overallBadgeText ||
    (anime.episodesCount && anime.episodesCount > 0
      ? `${anime.episodesCount} Episodes`
      : UNVERIFIED_COUNT_LABEL);

  const officialSourceUrl = (anime as any).officialSourceUrl || (anime as any).official_source_url;
  const hasVerifiedGenres = Array.isArray(anime.genres) && anime.genres.length > 0;
  const hasVerifiedStudio = Boolean(anime.studio && anime.studio.trim().length > 0);

  const renderPrimaryActions = (isDesktopSidebar: boolean) => (
    <div className={isDesktopSidebar ? 'space-y-2.5' : 'space-y-2.5 mt-4'}>
      {/* 48px Primary CTA */}
      <button
        type="button"
        onClick={handlePrimaryWhereToWatchClick}
        data-testid="hero-where-to-watch-cta"
        className="w-full min-h-[48px] px-5 rounded-[var(--radius-control)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold text-[14px] flex items-center justify-center gap-2 transition-colors duration-180 motion-reduce:transition-none shadow-sm cursor-pointer"
      >
        <Play className="w-4 h-4 fill-current shrink-0" />
        <span className="truncate">{t('animeDetails:whereToWatch', 'Where to Watch')}</span>
        {verifiedPlatforms.length > 0 && (
          <span className="px-2 py-0.5 rounded-[6px] bg-black/15 text-[var(--accent-on-primary)] text-[11px] font-extrabold tabular-nums shrink-0">
            {verifiedPlatforms.length} OTT
          </span>
        )}
      </button>

      {/* Library & Personal Watch Status (Desktop Sidebar stacks neatly; Mobile uses crisp horizontal action row) */}
      {isDesktopSidebar ? (
        <>
          <button
            type="button"
            onClick={(e) => onToggleWatchlist(anime.id, e)}
            aria-label={
              isInWatchlist
                ? t('animeDetails:inLibrary', 'In library')
                : t('animeDetails:addToLibrary', 'Add to library')
            }
            className={`w-full min-h-[44px] px-4 rounded-[var(--radius-control)] font-semibold text-[13px] flex items-center justify-center gap-2 border transition-colors duration-180 cursor-pointer ${
              isInWatchlist
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)]'
            }`}
          >
            <Heart
              className={`w-4 h-4 shrink-0 ${
                isInWatchlist ? 'fill-current text-[var(--accent-primary)]' : ''
              }`}
            />
            <span className="truncate">
              {isInWatchlist
                ? t('animeDetails:inLibrary', 'In Library')
                : t('animeDetails:addToLibrary', 'Add to Library')}
            </span>
          </button>

          <div className="space-y-1">
            <label
              htmlFor="desktop-personal-status-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
            >
              My Watch Status
            </label>
            <select
              id="desktop-personal-status-select"
              aria-label="Personal watch status"
              value={personalWatchStatus}
              onChange={(e) => handlePersonalStatusChange(e.target.value as WatchlistStatus)}
              className="w-full min-h-[44px] px-3 rounded-[var(--radius-control)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
            >
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {getLocalizedStatusLabel(st)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFollow}
              data-testid="detail-follow-btn"
              aria-label={
                isFollowed
                  ? t('animeDetails:following', 'Following')
                  : t('animeDetails:follow', 'Follow')
              }
              className={`flex-1 min-h-[44px] px-3 rounded-[var(--radius-control)] font-semibold text-[13px] flex items-center justify-center gap-1.5 border transition-colors duration-180 cursor-pointer ${
                isFollowed
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                  : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              {isFollowed ? (
                <Bell className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              ) : (
                <BellOff className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              )}
              <span>
                {isFollowed
                  ? t('animeDetails:following', 'Following')
                  : t('animeDetails:follow', 'Follow')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              aria-label={t('animeDetails:share', 'Share')}
              title={t('animeDetails:share', 'Share')}
              className="min-h-[44px] min-w-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 transition-colors duration-180 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onReportIssue) onReportIssue(anime);
                else setInternalReportOpen(true);
              }}
              aria-label={t('animeDetails:reportWrongInfo', 'Report wrong info')}
              title={t('animeDetails:reportWrongInfo', 'Report wrong info')}
              className="min-h-[44px] min-w-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 transition-colors duration-180 cursor-pointer"
            >
              <Flag className="w-4 h-4 text-[#F87171]" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => onToggleWatchlist(anime.id, e)}
            aria-label={
              isInWatchlist
                ? t('animeDetails:inLibrary', 'In library')
                : t('animeDetails:addToLibrary', 'Add to library')
            }
            className={`flex-1 min-h-[44px] min-w-[44px] px-3 rounded-[var(--radius-control)] font-semibold text-[13px] flex items-center justify-center gap-1.5 border transition-colors duration-180 cursor-pointer ${
              isInWatchlist
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)]'
            }`}
          >
            <Heart
              className={`w-4 h-4 shrink-0 ${
                isInWatchlist ? 'fill-current text-[var(--accent-primary)]' : ''
              }`}
            />
            <span className="truncate">
              {isInWatchlist
                ? t('animeDetails:inLibrary', 'Saved')
                : t('common:save', 'Library')}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleFollow}
            data-testid="detail-follow-btn-mobile"
            aria-label={
              isFollowed
                ? t('animeDetails:following', 'Following')
                : t('animeDetails:follow', 'Follow')
            }
            className={`flex-1 min-h-[44px] min-w-[44px] px-3 rounded-[var(--radius-control)] font-semibold text-[13px] flex items-center justify-center gap-1.5 border transition-colors duration-180 cursor-pointer ${
              isFollowed
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)]'
            }`}
          >
            {isFollowed ? (
              <Bell className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            ) : (
              <BellOff className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            )}
            <span className="truncate">
              {isFollowed
                ? t('animeDetails:following', 'Following')
                : t('animeDetails:follow', 'Follow')}
            </span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label={t('animeDetails:share', 'Share')}
            title={t('animeDetails:share', 'Share')}
            className="min-h-[44px] min-w-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 transition-colors duration-180 cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (onReportIssue) onReportIssue(anime);
              else setInternalReportOpen(true);
            }}
            aria-label={t('animeDetails:reportWrongInfo', 'Report wrong info')}
            title={t('animeDetails:reportWrongInfo', 'Report wrong info')}
            className="min-h-[44px] min-w-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 transition-colors duration-180 cursor-pointer"
          >
            <Flag className="w-4 h-4 text-[#F87171]" />
          </button>
        </div>
      )}
    </div>
  );

  const innerContent = (
    <div
      ref={modalContainerRef}
      data-testid="anime-detail-page"
      className={
        asPage
          ? 'w-full overflow-x-clip bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24'
          : 'relative w-full max-w-[calc(100vw-1.5rem)] sm:max-w-5xl max-h-[92vh] overflow-x-clip bg-[var(--bg-canvas)] rounded-t-[20px] sm:rounded-[20px] border border-[var(--border-subtle)] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-180'
      }
    >
      {/* Structured Data SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: buildAnimeJsonLd(
            {
              id: anime.id,
              title: anime.title,
              synopsis: anime.synopsis,
              poster: anime.poster,
              releaseYear: anime.releaseYear,
              rating: anime.rating,
              episodesCount: anime.episodesCount,
              languages: anime.languages,
              genres: anime.genres,
              studio: anime.studio,
            },
            'https://anidub.in',
            undefined,
            {
              locale: uiLocale,
              translation: publishedTranslation,
            }
          ),
        }}
      />

      {/* Compact Sticky Top Sub-Navigation Strip */}
      <div
        className={`${
          asPage ? 'sticky top-14 lg:top-16 z-30' : 'sticky top-0 z-30'
        } flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 h-[52px] bg-[var(--bg-canvas)]/92 backdrop-blur-md border-b border-[var(--border-subtle)]`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            data-testid="detail-back-button"
            aria-label="Back to catalog"
            className="min-h-[44px] min-w-[44px] px-3 rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-2 text-[13px] font-semibold shrink-0 transition-colors duration-180 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t('common:back', 'Back')}</span>
          </button>
          <span className="text-[13px] font-semibold text-[var(--text-secondary)] truncate hidden sm:inline">
            {anime.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onEditAnime && user?.isAdmin && (
            <button
              type="button"
              onClick={() => onEditAnime(anime)}
              aria-label="Edit Anime Info"
              className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-1.5 text-[12px] font-semibold transition-colors duration-180 cursor-pointer"
            >
              <Edit className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
          {!asPage && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail view"
              className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors duration-180 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Content Area */}
      <div className={asPage ? 'w-full' : 'overflow-y-auto flex-1 pb-10'}>
        {/* 1. COMPACT CINEMATIC BACKDROP BANNER */}
        <div className="relative w-full h-[188px] sm:h-[220px] lg:h-[310px] overflow-hidden bg-[var(--bg-elevated)] select-none">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt=""
              aria-hidden="true"
              width={1280}
              height={320}
              loading="lazy"
              className={`w-full h-full object-cover object-center ${
                isFallbackBlurredBanner
                  ? 'scale-110 blur-[12px] opacity-45'
                  : 'opacity-80'
              }`}
            />
          ) : null}
          {/* Theme-aware restrained gradient scrim into --bg-canvas (WCAG AA safe in Dark & Light themes) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, color-mix(in srgb, var(--bg-canvas) 45%, transparent) 52%, var(--bg-canvas) 100%)',
            }}
          />
        </div>

        {/* 2. EDITORIAL TWO-COLUMN CONTAINER (Desktop 1024px+ / Compact Single-Column Mobile) */}
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 -mt-20 sm:-mt-24 lg:-mt-32 relative z-10">
          <div className="lg:grid lg:grid-cols-[276px_minmax(0,1fr)] lg:gap-8 items-start">
            {/* DESKTOP STICKY LEFT SIDEBAR */}
            <aside className="hidden lg:flex lg:flex-col gap-4 lg:sticky lg:top-[132px]">
              <div className="w-full aspect-[2/3] rounded-[var(--radius-card)] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl">
                <OptimizedImage
                  src={anime.poster}
                  alt={anime.title}
                  width={320}
                  height={480}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  aspectRatio="portrait"
                  priority={true}
                />
              </div>

              {renderPrimaryActions(true)}

              {/* Compact Key Facts Card (Only verified facts shown) */}
              <div className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Anime Facts
                </h2>
                <dl className="space-y-2.5 text-[13px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--text-secondary)]">Format</dt>
                    <dd className="font-semibold text-[var(--text-primary)] text-right">{animeFormatLabel}</dd>
                  </div>
                  {publicationStatusLabel && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--text-secondary)]">Release Status</dt>
                      <dd className="font-semibold text-[var(--text-primary)] text-right">
                        {publicationStatusLabel}
                      </dd>
                    </div>
                  )}
                  {anime.releaseYear && anime.releaseYear > 0 && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--text-secondary)]">Year</dt>
                      <dd className="font-semibold text-[var(--text-primary)] tabular-nums text-right">
                        {anime.releaseYear}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--text-secondary)]">Episodes</dt>
                    <dd className="font-semibold text-[var(--text-primary)] tabular-nums text-right">
                      {episodeMetaLabel || LEGACY_UNVERIFIED_COUNT_FALLBACK}
                    </dd>
                  </div>
                  {hasVerifiedStudio && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--text-secondary)]">Studio</dt>
                      <dd className="font-semibold text-[var(--text-primary)] text-right truncate">
                        {anime.studio}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </aside>

            {/* RIGHT PRIMARY CONTENT COLUMN (AND MOBILE FULL FLOW) */}
            <div className="min-w-0">
              {/* HERO HEADER BLOCK */}
              <header className="mb-5">
                {/* Mobile Poster + Compact Title Row */}
                <div className="flex items-end gap-3.5 sm:gap-5 lg:block">
                  <div className="lg:hidden w-[104px] sm:w-[120px] aspect-[2/3] rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl shrink-0">
                    <OptimizedImage
                      src={anime.poster}
                      alt={anime.title}
                      width={240}
                      height={360}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      aspectRatio="portrait"
                      priority={true}
                    />
                  </div>

                  <div className="flex-1 min-w-0 pb-0.5 lg:pb-0">
                    {/* Publication Status + Single Clean Rating Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {publicationStatusLabel && (
                        <span
                          data-testid="publication-status-badge"
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
                            anime.status === 'Airing'
                              ? 'text-[#059669] dark:text-[#34D399]'
                              : anime.status === 'Upcoming'
                                ? 'text-[#B45309] dark:text-[#FBBF24]'
                                : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              anime.status === 'Airing'
                                ? 'bg-[#34D399]'
                                : anime.status === 'Upcoming'
                                  ? 'bg-[#FBBF24]'
                                  : 'bg-[var(--text-muted)]'
                            }`}
                          />
                          {publicationStatusLabel}
                        </span>
                      )}

                      {heroRating && (
                        <>
                          {publicationStatusLabel && (
                            <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
                          )}
                          <span
                            data-testid="hero-single-rating"
                            className="inline-flex items-center gap-1 text-[13px] font-bold text-[var(--text-primary)] tabular-nums"
                          >
                            <Star className="w-3.5 h-3.5 fill-[#FBBF24] text-[#FBBF24]" />
                            {heroRating.value.toFixed(1)}
                            <span className="text-[11px] font-normal text-[var(--text-muted)]">/10</span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Official English Title (Untouched) */}
                    <h1 className="text-[22px] sm:text-[28px] lg:text-[34px] font-extrabold text-[var(--text-primary)] leading-[1.15] tracking-[-0.02em] break-words">
                      {anime.title}
                    </h1>

                    {activeLocalizedTitle &&
                      activeLocalizedTitle.toLowerCase() !== anime.title.toLowerCase() && (
                        <p
                          data-testid="localized-anime-subtitle"
                          className="text-[14px] sm:text-[15px] font-semibold text-[var(--accent-primary)] mt-1 leading-snug"
                        >
                          {activeLocalizedTitle}
                        </p>
                      )}

                    {anime.japaneseTitle && (
                      <p className="text-[12px] sm:text-[13px] text-[var(--text-secondary)] mt-0.5 truncate">
                        {anime.japaneseTitle}
                      </p>
                    )}

                    {/* Clean Unboxed Metadata Strip (dot-separated, zero pill clutter) */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[12px] sm:text-[13px] text-[var(--text-secondary)] font-medium">
                      {anime.releaseYear && anime.releaseYear > 0 && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          {anime.releaseYear}
                        </span>
                      )}
                      {anime.releaseYear && anime.releaseYear > 0 && (
                        <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
                      )}
                      <span>{animeFormatLabel}</span>
                      {episodeMetaLabel && (
                        <>
                          <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Tv className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            {episodeMetaLabel}
                          </span>
                        </>
                      )}
                      {hasVerifiedGenres && (
                        <>
                          <span className="hidden sm:inline text-[var(--text-muted)]" aria-hidden="true">·</span>
                          <span className="hidden sm:inline text-[var(--text-secondary)]">
                            {anime.genres.slice(0, 3).join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Indian Dub Availability Summary Strip (High above the fold on Mobile & Desktop) */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {indianDubCards.length > 0 ? (
                    <>
                      {indianDubCards.map((card) => (
                        <button
                          key={card.language}
                          type="button"
                          onClick={() => setActiveTab('seasons-dubs')}
                          className="min-h-[34px] px-2.5 py-1 rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                          <span className="w-5 h-5 rounded-[6px] bg-[var(--accent-soft)] text-[var(--accent-primary)] text-[11px] font-bold flex items-center justify-center shrink-0">
                            {card.scriptBadge}
                          </span>
                          <span>{card.language}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            {card.status}
                          </span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                      Indian dub availability not verified yet
                    </span>
                  )}
                </div>

                {/* Mobile Primary & Secondary Actions (Above the fold!) */}
                <div className="lg:hidden">{renderPrimaryActions(false)}</div>
              </header>

              {/* 3. STICKY NAVIGATION TABS (Overview | Seasons & Dubs | Watch Progress | Reviews) */}
              <div
                role="tablist"
                aria-label="Anime detail sections"
                data-testid="anime-detail-tablist"
                className={`${
                  asPage ? 'sticky top-[104px] lg:top-[112px] z-20 pt-1' : 'sticky top-[52px] z-20 pt-1'
                } -mx-4 px-4 sm:mx-0 sm:px-0 bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] mb-6`}
              >
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        data-testid={`detail-tab-${tab.id}`}
                        aria-selected={isActive}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative min-h-[44px] px-3 sm:px-4 text-[13px] sm:text-[14px] font-semibold whitespace-nowrap border-b-2 transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                          isActive
                            ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                            : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6" role="tabpanel" data-testid="detail-panel-overview">
                  {/* Synopsis Card with On-Demand Auto-Translation + Show Original Toggle */}
                  <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
                          {t('animeDetails:synopsis', 'Synopsis')}
                        </h2>
                        {hasLocalizedSynopsis && !showOriginalSynopsis && (
                          <span
                            data-testid="synopsis-localized-badge"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
                          >
                            <Languages className="w-3 h-3" />
                            {activeLocaleMeta?.nativeName || uiLocale.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {hasLocalizedSynopsis && (
                        <button
                          type="button"
                          data-testid="toggle-original-synopsis"
                          onClick={() => setShowOriginalSynopsis((prev) => !prev)}
                          className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors cursor-pointer"
                        >
                          <Languages className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          {showOriginalSynopsis
                            ? `${activeLocaleMeta?.nativeName || uiLocale.toUpperCase()}`
                            : 'Original English'}
                        </button>
                      )}
                    </div>

                    <p
                      data-testid="anime-synopsis-text"
                      className={`text-[14px] sm:text-[15px] text-[var(--text-secondary)] leading-[1.68] ${
                        !isSynopsisExpanded && isLongSynopsis ? 'line-clamp-4' : ''
                      }`}
                    >
                      {synopsisText}
                    </p>

                    {isLongSynopsis && (
                      <button
                        type="button"
                        onClick={() => setIsSynopsisExpanded((prev) => !prev)}
                        className="mt-2.5 min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--accent-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>{isSynopsisExpanded ? 'Show Less' : 'Read More'}</span>
                        {isSynopsisExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </section>

                  {/* Prominent "Where to Watch (India)" Verified OTT Hub */}
                  <section
                    ref={whereToWatchRef}
                    id="where-to-watch-section"
                    data-testid="where-to-watch-card"
                    className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
                          <Play className="w-4 h-4 text-[var(--accent-primary)] fill-current" />
                        </div>
                        <div>
                          <h2 className="text-[16px] sm:text-[17px] font-bold text-[var(--text-primary)]">
                            {t('animeDetails:whereToWatchIndia', 'Where to Watch (India)')}
                          </h2>
                          <p className="text-[12px] text-[var(--text-secondary)]">
                            {t('animeDetails:streamingNote', 'Official legal streaming platforms verified for India.')}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                          <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          India
                        </span>
                        {updatedDateDisplay && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] tabular-nums">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
                            Updated {updatedDateDisplay}
                          </span>
                        )}
                      </div>
                    </div>

                    {verifiedPlatforms.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {verifiedPlatforms.map((platform) => {
                          const ottUrl = generateOttUrl(
                            platform,
                            anime.title,
                            anime.streamingLinks?.[platform]
                          );
                          const hasDirectLink = Boolean(anime.streamingLinks?.[platform]);
                          return (
                            <a
                              key={platform}
                              href={ottUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                void cloudflareApi.trackDemandEvent({
                                  event_type: 'ott_click',
                                  anime_id: String(anime.id),
                                  platform_name: platform,
                                  language_code: uiLocale,
                                });
                              }}
                              className="min-h-[56px] px-4 py-3 rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 flex items-center justify-between gap-3 transition-colors duration-180 group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                                  <PlatformIcon
                                    platform={platform}
                                    className="w-4 h-4 text-[var(--text-primary)]"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">
                                    {platform}
                                  </div>
                                  <div className="text-[11px] text-[var(--text-secondary)]">
                                    {hasDirectLink
                                      ? 'Direct Verified Link'
                                      : 'Official Platform Search (India)'}
                                  </div>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-transform shrink-0">
                                Watch
                                <ExternalLink className="w-3.5 h-3.5" />
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        data-testid="ott-not-verified"
                        className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-[#FBBF24] shrink-0" />
                          <div>
                            <div className="text-[14px] font-bold text-[var(--text-primary)]">
                              {t('common:notVerified', 'Not verified')}
                            </div>
                            <p className="text-[12px] text-[var(--text-secondary)]">
                              {t(
                                'animeDetails:noVerifiedPlatforms',
                                'No verified official OTT streaming link is listed for India yet.'
                              )}
                            </p>
                          </div>
                        </div>
                        {onReportIssue && (
                          <button
                            type="button"
                            onClick={() => onReportIssue(anime)}
                            className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold shrink-0 transition-colors cursor-pointer"
                          >
                            Submit verified OTT link
                          </button>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Lazy-Loaded Official Trailer (Hides completely when no verified YouTube trailer exists) */}
                  <OfficialTrailerCard
                    trailer={officialTrailer}
                    animeTitle={anime.title}
                    fallbackPoster={anime.poster}
                  />

                  {/* Structured Anime Information Card (Gracefully hides unverified optional fields) */}
                  <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5">
                    <h2 className="text-[16px] font-bold text-[var(--text-primary)] mb-4">
                      Anime Information
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          SEASONS &amp; EPISODES
                        </div>
                        <div className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                          {seasonEpisodeDisplay}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          OFFICIAL SOURCE
                        </div>
                        {officialSourceUrl ? (
                          <a
                            href={officialSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--accent-primary)] hover:underline break-all"
                          >
                            <span>Official Announcement</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        ) : (
                          <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                            {verifiedPlatforms.length > 0
                              ? verifiedPlatforms.join(', ')
                              : 'Source not verified'}
                          </div>
                        )}
                      </div>

                      {hasVerifiedStudio && (
                        <div>
                          <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                            Animation Studio
                          </div>
                          <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                            {anime.studio}
                          </div>
                        </div>
                      )}

                      {hasVerifiedGenres && (
                        <div>
                          <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                            Genres
                          </div>
                          <div className="text-[14px] font-medium text-[var(--text-primary)]">
                            {anime.genres.join(' · ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Anime Universe & Smart Watch Order (Hides completely when no verified links exist) */}
                  <AnimeUniverseSection
                    data-testid="franchise-watch-order"
                    d1Entries={d1FranchiseEntries}
                    fallbackEntries={franchiseEntries}
                    currentAnimeId={anime.id}
                    allAnime={allAnime}
                    onSelectAnime={onSelectAnime}
                    titleLabel={t('animeDetails:franchiseOrder', 'Anime Universe & Watch Order')}
                  />

                  {/* Verified Characters & Indian Voice Actors (Hides completely when no verified cast exists) */}
                  <VerifiedCastSection
                    entries={verifiedCastEntries}
                    languages={verifiedCastLanguages}
                    byLanguage={verifiedCastByLanguage}
                  />
                </div>
              )}

              {/* TAB 2: SEASONS & DUBS (INDIAN DUB INTELLIGENCE HUB) */}
              {activeTab === 'seasons-dubs' && (
                <div className="space-y-5" role="tabpanel" data-testid="detail-panel-dubs">
                  {/* Indian Dub Intelligence Language Cards */}
                  <section
                    data-testid="indian-dub-intelligence-grid"
                    className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div>
                        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
                          Indian Dub Intelligence
                        </h2>
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          Honest per-language availability from verified catalog records.
                        </p>
                      </div>
                      {dubProgress?.overallBadgeText && (
                        <span className="text-[12px] font-semibold text-[var(--text-secondary)] tabular-nums">
                          {dubProgress.overallBadgeText}
                        </span>
                      )}
                    </div>

                    {indianDubCards.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {indianDubCards.map((card) => (
                          <div
                            key={card.language}
                            data-testid={`dub-intel-card-${card.language.toLowerCase()}`}
                            className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3.5 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-9 h-9 rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/25 text-[15px] font-extrabold flex items-center justify-center shrink-0">
                                  {card.scriptBadge}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">
                                    {card.language} Dub
                                  </div>
                                  <div className="text-[11px] text-[var(--text-secondary)] truncate">
                                    {card.platforms.length > 0
                                      ? card.platforms.join(', ')
                                      : 'OTT not verified'}
                                  </div>
                                </div>
                              </div>

                              <span
                                data-testid={`dub-status-${card.language.toLowerCase()}`}
                                className={`px-2 py-0.5 rounded-[6px] text-[11px] font-bold border shrink-0 ${getDubStatusBadgeClasses(
                                  card.status
                                )}`}
                              >
                                {card.status}
                              </span>
                            </div>

                            {card.episodesDubbed !== null ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[12px] tabular-nums">
                                  <span className="text-[var(--text-secondary)]">
                                    {card.totalEpisodes
                                      ? `${card.episodesDubbed} / ${card.totalEpisodes} episodes dubbed`
                                      : `${card.episodesDubbed} dubbed episodes verified`}
                                  </span>
                                  {card.progressPercent !== null && (
                                    <span className="font-bold text-[var(--text-primary)]">
                                      {card.progressPercent}%
                                    </span>
                                  )}
                                </div>
                                {card.progressPercent !== null && (
                                  <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-300"
                                      style={{
                                        width: `${card.progressPercent}%`,
                                        backgroundColor:
                                          card.status === 'Complete'
                                            ? '#34D399'
                                            : 'var(--accent-primary)',
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[12px] text-[var(--text-secondary)]">
                                {card.status === 'Announced'
                                  ? 'Dub announced — episode count pending release'
                                  : UNVERIFIED_COUNT_LABEL}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 text-[13px] text-[var(--text-secondary)]">
                        No verified Indian dub language records are available for this title yet.
                      </div>
                    )}
                  </section>

                  {/* Season × Language Matrix */}
                  <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                          Season &amp; Regional Dub Breakdown
                        </h3>
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          {dubProgress?.overallBadgeText || UNVERIFIED_COUNT_LABEL}
                        </p>
                      </div>
                      {dubProgress?.statusLabel && (
                        <span className="px-2.5 py-1 rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 text-[12px] font-semibold">
                          {dubProgress.statusLabel}
                        </span>
                      )}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto rounded-[12px] border border-[var(--border-subtle)]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            <th className="py-3 px-4">Season</th>
                            <th className="py-3 px-4">Episodes</th>
                            <th className="py-3 px-4">Regional Dubs</th>
                            <th className="py-3 px-4">OTT Platforms</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                          {seasonBreakdowns.map((season) => (
                            <tr
                              key={season.seasonNumber}
                              className="bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
                            >
                              <td className="py-3.5 px-4 font-bold text-[var(--text-primary)]">
                                {season.title || `Season ${season.seasonNumber}`}
                              </td>
                              <td className="py-3.5 px-4 text-[var(--text-secondary)] tabular-nums">
                                {season.totalEpisodes && season.totalEpisodes > 0
                                  ? `${season.totalEpisodes} eps`
                                  : `${UNVERIFIED_COUNT_LABEL} (${LEGACY_UNVERIFIED_COUNT_FALLBACK})`}
                              </td>
                              <td className="py-3.5 px-4">
                                {season.languages.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {season.languages.map((l) => (
                                      <span
                                        key={l.language}
                                        className="px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] tabular-nums"
                                      >
                                        <strong className="text-[var(--accent-primary)]">
                                          {l.language}:
                                        </strong>{' '}
                                        {l.totalEpisodes
                                          ? `${l.dubbedEpisodes}/${l.totalEpisodes} eps`
                                          : l.dubbedEpisodes > 0
                                            ? `${l.dubbedEpisodes} eps`
                                            : LEGACY_UNVERIFIED_COUNT_FALLBACK}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[var(--text-secondary)]">
                                    {LEGACY_UNVERIFIED_COUNT_FALLBACK}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                {verifiedPlatforms.length > 0 ? (
                                  <span className="text-[12px] font-medium text-[var(--text-primary)]">
                                    {verifiedPlatforms.join(', ')}
                                  </span>
                                ) : (
                                  <span className="text-[12px] text-[var(--text-secondary)]">
                                    Not verified
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Season Pills + Stacked Rows */}
                    <div className="sm:hidden space-y-3">
                      {seasonBreakdowns.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                          {seasonBreakdowns.map((season) => {
                            const active =
                              season.seasonNumber === (activeMatrixSeason?.seasonNumber ?? 1);
                            return (
                              <button
                                key={season.seasonNumber}
                                type="button"
                                onClick={() => setSelectedMatrixSeason(season.seasonNumber)}
                                className={`min-h-[44px] px-3.5 rounded-[10px] text-[13px] font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                                }`}
                              >
                                Season {season.seasonNumber}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {activeMatrixSeason && (
                        <div className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[14px] font-bold text-[var(--text-primary)]">
                              {activeMatrixSeason.title || `Season ${activeMatrixSeason.seasonNumber}`}
                            </div>
                            <span className="text-[12px] font-medium text-[var(--text-secondary)] tabular-nums">
                              {activeMatrixSeason.totalEpisodes && activeMatrixSeason.totalEpisodes > 0
                                ? `${activeMatrixSeason.totalEpisodes} Episodes`
                                : LEGACY_UNVERIFIED_COUNT_FALLBACK}
                            </span>
                          </div>

                          {activeMatrixSeason.languages.length > 0 ? (
                            <div className="space-y-2">
                              {activeMatrixSeason.languages.map((langProgress) => (
                                <div
                                  key={langProgress.language}
                                  className="p-2.5 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                                      {langProgress.language} Dub
                                    </span>
                                    {verifiedPlatforms.length > 0 && (
                                      <div className="text-[11px] text-[var(--text-secondary)]">
                                        {verifiedPlatforms.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                  <span
                                    className={`text-[12px] font-bold tabular-nums ${
                                      langProgress.isComplete
                                        ? 'text-[#059669] dark:text-[#34D399]'
                                        : 'text-[var(--accent-primary)]'
                                    }`}
                                  >
                                    {langProgress.totalEpisodes
                                      ? `${langProgress.dubbedEpisodes}/${langProgress.totalEpisodes} eps`
                                      : langProgress.dubbedEpisodes > 0
                                        ? `${langProgress.dubbedEpisodes} eps`
                                        : LEGACY_UNVERIFIED_COUNT_FALLBACK}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[12px] text-[var(--text-secondary)]">
                              Per-language episode counts have not been verified for this season.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 3: WATCH PROGRESS (ADVANCED SEASON & EPISODE EXPLORER) */}
              {activeTab === 'progress' && (
                <div
                  className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-5"
                  role="tabpanel"
                  data-testid="detail-panel-progress"
                >
                  {/* Header: Strictly separates Personal Watch Status from Anime Publication Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
                        {t('animeDetails:progress.title', 'Episode Progress')}
                      </h2>
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        Track individual episodes · Release status:{' '}
                        <strong className="text-[var(--text-primary)]">
                          {publicationStatusLabel || 'Unverified'}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="progress-personal-status-select"
                        className="text-[12px] font-medium text-[var(--text-secondary)] hidden sm:inline"
                      >
                        My Status:
                      </label>
                      <select
                        id="progress-personal-status-select"
                        aria-label="Personal watchlist status"
                        data-testid="personal-watch-status-select"
                        value={personalWatchStatus}
                        onChange={(e) =>
                          handlePersonalStatusChange(e.target.value as WatchlistStatus)
                        }
                        className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                      >
                        {statusOptions.map((st) => (
                          <option key={st} value={st}>
                            {getLocalizedStatusLabel(st)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Multi-Season Selector Pills (only when multi-season data exists) */}
                  {seasonBreakdowns.length > 1 && (
                    <div>
                      <div className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
                        Select Season
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {seasonBreakdowns.map((s) => (
                          <button
                            key={s.seasonNumber}
                            type="button"
                            onClick={() => {
                              setSelectedProgressSeason(s.seasonNumber);
                              setSelectedEpisodeChunkIdx(0);
                            }}
                            className={`min-h-[44px] px-3.5 rounded-[10px] text-[13px] font-semibold border transition-colors cursor-pointer ${
                              selectedProgressSeason === s.seasonNumber
                                ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {s.title || `Season ${s.seasonNumber}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Continue Watching & Progress Meter Card */}
                  <div className="p-4 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--accent-primary)]">
                          <Compass className="w-3.5 h-3.5" />
                          <span data-testid="continue-watching-indicator">
                            {episodeStats.isCompleted
                              ? `Season ${selectedProgressSeason} Completed`
                              : episodeStats.nextEpisode
                                ? `Continue Watching · Next: Episode ${episodeStats.nextEpisode}`
                                : `Season ${selectedProgressSeason}`}
                          </span>
                        </div>
                        <div
                          data-testid="progress-watched-summary"
                          className="text-[20px] font-extrabold text-[var(--text-primary)] tabular-nums mt-0.5"
                        >
                          {episodeStats.watchedCount}
                          <span className="text-[14px] font-medium text-[var(--text-secondary)]">
                            {' '}
                            / {currentSeasonMaxEpisodes !== null ? currentSeasonMaxEpisodes : '?'}{' '}
                            Episodes
                          </span>
                          {currentSeasonMaxEpisodes !== null && (
                            <span className="ml-2 text-[13px] font-bold text-[var(--accent-primary)]">
                              · {episodeStats.percent}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bulk Controls (44px min height) */}
                      <div className="flex flex-wrap items-center gap-2">
                        {currentSeasonMaxEpisodes !== null && currentSeasonMaxEpisodes > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllWatched}
                            data-testid="mark-all-watched-btn"
                            disabled={episodeStats.isCompleted}
                            className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-45 text-[var(--accent-on-primary)] text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <CheckCheck className="w-4 h-4" />
                            <span>Mark all watched</span>
                          </button>
                        )}

                        {progressUndoSnapshot && (
                          <button
                            type="button"
                            onClick={handleUndoProgress}
                            data-testid="undo-progress-btn"
                            className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                            <span>Undo</span>
                          </button>
                        )}

                        {episodeStats.watchedCount > 0 && (
                          <button
                            type="button"
                            onClick={handleResetSeasonProgress}
                            data-testid="reset-progress-btn"
                            className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[#F87171] border border-[var(--border-subtle)] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {currentSeasonMaxEpisodes !== null && (
                      <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${episodeStats.percent}%`,
                            backgroundColor: episodeStats.isCompleted
                              ? '#34D399'
                              : 'var(--accent-primary)',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Interactive Numbered Episode Grid (when verified total episode count exists) */}
                  {currentSeasonMaxEpisodes !== null &&
                  currentSeasonMaxEpisodes > 0 &&
                  activeEpisodeRange ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
                          Tap an episode to mark watched or unwatched
                        </span>
                        {episodeRanges.length > 1 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            {episodeRanges.map((chunk) => (
                              <button
                                key={chunk.label}
                                type="button"
                                onClick={() => setSelectedEpisodeChunkIdx(chunk.index)}
                                className={`min-h-[36px] px-3 rounded-[8px] text-[12px] font-bold tabular-nums border transition-colors cursor-pointer ${
                                  activeEpisodeRange.index === chunk.index
                                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {chunk.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        data-testid="episode-grid"
                        className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2"
                      >
                        {Array.from(
                          { length: activeEpisodeRange.end - activeEpisodeRange.start + 1 },
                          (_, idx) => activeEpisodeRange.start + idx
                        ).map((epNum) => {
                          const isWatched = currentSeasonWatchedList.includes(epNum);
                          const isNext = !isWatched && episodeStats.nextEpisode === epNum;
                          return (
                            <button
                              key={epNum}
                              type="button"
                              data-testid={`episode-cell-${epNum}`}
                              aria-pressed={isWatched}
                              aria-label={`Episode ${epNum}${isWatched ? ' watched' : ''}`}
                              onClick={() => handleToggleEpisode(epNum)}
                              className={`min-h-[44px] min-w-[44px] rounded-[10px] text-[13px] font-bold tabular-nums border flex items-center justify-center transition-all duration-150 cursor-pointer ${
                                isWatched
                                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)] shadow-xs'
                                  : isNext
                                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/60'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50'
                              }`}
                            >
                              {epNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Honest Fallback Stepper when total episode count is unverified */
                    <div className="p-4 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-[13px] text-[var(--text-secondary)]">
                        Total episode count is not verified yet. Use quick counters to log watched
                        episodes.
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-label="Decrease watched episodes"
                          onClick={() => handleStepEpisodeCount(episodeStats.watchedCount - 1)}
                          disabled={episodeStats.watchedCount <= 0}
                          className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] disabled:opacity-40 text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Increase watched episodes"
                          onClick={() => handleStepEpisodeCount(episodeStats.watchedCount + 1)}
                          className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: REGIONAL 5-SLIDER DUB REVIEWS */}
              {activeTab === 'reviews' && (
                <div className="space-y-5" role="tabpanel" data-testid="detail-panel-reviews">
                  <RegionalDubReviewsPanel
                    animeTitle={anime.title}
                    availableLanguages={indianDubCards.map((c) => c.language)}
                    dubReviews={dubReviews}
                    summary={dubReviewsSummary}
                    byLanguage={dubReviewsByLanguage}
                    activeLangFilter={activeDubLangFilter}
                    onSelectLangFilter={setActiveDubLangFilter}
                    spoilerShieldEnabled={spoilerShieldEnabled}
                    onToggleSpoilerShield={handleToggleSpoilerShield}
                    user={user}
                    submitState={dubReviewSubmitState}
                    submitError={dubReviewSubmitError}
                    onSubmitDubReview={handleSubmitDubReview}
                    onDeleteDubReview={handleDeleteDubReview}
                    postingLabel={t('animeDetails:reviews.posting', 'Posting…')}
                    retryLabel={t('animeDetails:reviews.failedRetry', 'Failed — Retry')}
                  />

                  {wsReviewError && (
                    <div
                      role="alert"
                      className="rounded-[12px] bg-red-500/10 border border-red-500/30 px-4 py-2.5 flex items-center justify-between gap-2 text-[12px] text-[#DC2626] dark:text-[#F87171]"
                    >
                      <span>{wsReviewError}</span>
                      <button
                        type="button"
                        onClick={() => setWsReviewError(null)}
                        aria-label="Dismiss review notice"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] hover:bg-red-500/15 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Preserved Community Reviews from earlier endpoint (shown only if records exist) */}
                  {reviews.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h3 className="text-[14px] font-bold text-[var(--text-secondary)]">
                        Community Notes ({reviews.length})
                      </h3>
                      {reviews.map((rev) => {
                        const isMasked = Boolean(
                          rev.isSpoiler && spoilerShieldEnabled && !revealedReviewIds[rev.id]
                        );
                        return (
                          <div
                            key={rev.id}
                            className="rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[14px] font-bold text-[var(--text-primary)]">
                                  {rev.userName}
                                </span>
                                <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] text-[#B45309] dark:text-[#FBBF24] text-[11px] font-bold tabular-nums flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-current" />
                                  {rev.rating}/10
                                </span>
                                {rev.isSpoiler && (
                                  <span className="px-2 py-0.5 rounded-[6px] bg-[#FBBF24]/15 text-[#B45309] dark:text-[#FBBF24] border border-[#FBBF24]/30 text-[10px] font-bold uppercase">
                                    Spoiler
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[var(--text-secondary)]">
                                {rev.date}
                              </span>
                            </div>

                            {isMasked ? (
                              <div className="p-3 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
                                <span className="text-[13px] text-[var(--text-secondary)]">
                                  This review is hidden by Spoiler Shield.
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRevealedReviewIds((prev) => ({ ...prev, [rev.id]: true }))
                                  }
                                  className="min-h-[44px] px-3 rounded-[8px] bg-[var(--bg-surface)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold cursor-pointer"
                                >
                                  Reveal Spoiler
                                </button>
                              </div>
                            ) : (
                              <p className="text-[14px] text-[var(--text-primary)] leading-relaxed">
                                {rev.comment}
                              </p>
                            )}

                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => handleLikeReview(rev.id)}
                                className="min-h-[44px] px-3 rounded-[8px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                <span className="tabular-nums">Helpful ({rev.likes})</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {internalReportOpen && (
        <ReportModal
          anime={anime}
          onClose={() => setInternalReportOpen(false)}
          onSubmitSuccess={() => {
            setInternalReportOpen(false);
            onShowToast?.('Correction report submitted', 'success');
          }}
        />
      )}
    </div>
  );

  if (asPage) {
    return innerContent;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${anime.title} details`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-180"
    >
      {innerContent}
    </div>
  );
};

export const AnimeDetailModal = AnimeDetailPage;
