import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Star, Tv, Calendar, Heart, CheckCircle, Play, ExternalLink, Clock, Sparkles,
  Share2, Bell, BellOff, Edit, MessageSquare, Send, ThumbsUp, AlertTriangle, Plus,
  Minus, Flag, ArrowLeft, Layers, ShieldCheck, Globe, Eye, EyeOff, ChevronDown, ChevronUp, Languages
} from 'lucide-react';
import {
  Anime,
  WatchlistStatus,
  normalizeAnimeRecord,
  normalizeAnimeList,
} from '../types';
import { PlatformIcon } from './PlatformIcons';
import { DualRating } from './DualRating';
import { ReportModal } from './ReportModal';
import { cloudflareApi, type AnimeTranslationItem } from '../services/cloudflareApi';
import { generateOttUrl } from '../utils/ottRedirect';
import { OptimizedImage } from './OptimizedImage';
import {
  buildDubProgressBreakdown,
  normalizeDubSeasonBreakdowns,
  NormalizedSeasonBreakdown,
} from '../utils/dubProgress';
import { DetailModalSkeleton } from './ui/EclipseState';
import { buildAnimeJsonLd } from '../utils/seo';
import { useAuth } from '../lib/clerk';
import { getCloudflareWsUrl } from '../config/cloudflare';
import { getVerifiedClerkUsername } from '../utils/chatIdentity';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { formatLocaleDate, formatLocaleNumber, LANGUAGE_REGISTRY } from '../i18n/languageRegistry';

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
  watchlistStatus = 'Plan to Watch',
  onUpdateStatus,
  onSelectAnime,
  onEditAnime,
  onShowToast,
  followedIds = [],
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

  useEffect(() => {
    const rawTarget = animeProp || initialAnime;
    if (animeId !== null && animeId !== undefined && !animeProp) {
      let cancelled = false;
      if (!rawTarget) setFetchingDetail(true);
      cloudflareApi
        .getAnimeById(animeId, undefined, { locale: uiLocale })
        .then((res) => {
          if (cancelled || !res) return;
          setFetchedRecord(res);
          onResolvedAnime?.(res);
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

  const anime: Anime | null = useMemo(() => {
    const raw = animeProp || fetchedRecord || initialAnime;
    if (!raw) return null;
    return normalizeAnimeRecord(raw);
  }, [animeProp, fetchedRecord, initialAnime]);

  // Fetch published localized synopsis/title whenever active UI locale is non-English
  useEffect(() => {
    setShowOriginalSynopsis(false);
    if (!anime?.id || !uiLocale || uiLocale === 'en') {
      setPublishedTranslation(null);
      return;
    }

    // If the record already carries a published overlay for this locale, hydrate immediately
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
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(9);
  const [newIsSpoiler, setNewIsSpoiler] = useState(false);
  const [reviewSyncState, setReviewSyncState] = useState<'idle' | 'posting' | 'failed'>('idle');
  const [lastFailedComment, setLastFailedComment] = useState<string>('');
  const [episodesWatchedBySeason, setEpisodesWatchedBySeason] = useState<Record<number, number>>({ 1: 0 });
  const [selectedProgressSeason, setSelectedProgressSeason] = useState<number>(1);
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

  const dubProgress = useMemo(() => (anime ? buildDubProgressBreakdown(anime) : null), [anime]);
  const seasonBreakdowns: NormalizedSeasonBreakdown[] = useMemo(
    () => (anime ? normalizeDubSeasonBreakdowns(anime) : []),
    [anime]
  );
  const franchiseEntries = useMemo(
    () => (anime ? deriveVerifiedFranchiseOrder(anime, allAnime) : []),
    [anime, allAnime]
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

  useEffect(() => {
    if (!anime) return;
    setActiveTab('overview');
    setSelectedProgressSeason(1);
    setSelectedMatrixSeason(1);
    setIsSynopsisExpanded(false);

    if (followedIds.length > 0) {
      setIsFollowed(followedIds.includes(anime.id));
    } else {
      const follows = JSON.parse(localStorage.getItem('anime_follows') || '[]');
      setIsFollowed(follows.includes(anime.id));
    }

    const fetchReviews = async () => {
      try {
        const cfReviews = await cloudflareApi.getReviews(anime.id);
        if (cfReviews && cfReviews.length > 0) {
          setReviews(cfReviews);
        } else {
          const allReviews = JSON.parse(localStorage.getItem('anime_reviews') || '{}');
          setReviews(Array.isArray(allReviews[anime.id]) ? allReviews[anime.id] : []);
        }
      } catch {
        const allReviews = JSON.parse(localStorage.getItem('anime_reviews') || '{}');
        setReviews(Array.isArray(allReviews[anime.id]) ? allReviews[anime.id] : []);
      }
    };
    fetchReviews();

    const seasonProgressMap = JSON.parse(localStorage.getItem('anime_season_progress_v2') || '{}');
    const LegacyProgress = JSON.parse(localStorage.getItem('anime_progress') || '{}');
    if (seasonProgressMap[anime.id] && typeof seasonProgressMap[anime.id] === 'object') {
      setEpisodesWatchedBySeason(seasonProgressMap[anime.id]);
    } else {
      setEpisodesWatchedBySeason({ 1: Number(LegacyProgress[anime.id]) || 0 });
    }
  }, [anime?.id, followedIds]);

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
      <div className={asPage ? 'max-w-[1280px] mx-auto px-4 py-6' : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm'}>
        <div className="w-full max-w-4xl">
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

  const episodesWatched = episodesWatchedBySeason[selectedProgressSeason] || 0;

  const handleToggleSpoilerShield = () => {
    const next = !spoilerShieldEnabled;
    setSpoilerShieldEnabled(next);
    try {
      localStorage.setItem('anidub_spoiler_shield', String(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleUpdateProgress = async (newCount: number) => {
    const clamped =
      currentSeasonMaxEpisodes !== null
        ? Math.max(0, Math.min(newCount, currentSeasonMaxEpisodes))
        : Math.max(0, newCount);

    const updatedSeasonMap = {
      ...episodesWatchedBySeason,
      [selectedProgressSeason]: clamped,
    };
    setEpisodesWatchedBySeason(updatedSeasonMap);

    const seasonProgressMap = JSON.parse(localStorage.getItem('anime_season_progress_v2') || '{}');
    seasonProgressMap[anime.id] = updatedSeasonMap;
    localStorage.setItem('anime_season_progress_v2', JSON.stringify(seasonProgressMap));

    const totalWatchedAcrossSeasons = Object.values(updatedSeasonMap).reduce(
      (sum: number, val) => sum + (Number(val) || 0),
      0
    );
    const legacyProgress = JSON.parse(localStorage.getItem('anime_progress') || '{}');
    legacyProgress[anime.id] = totalWatchedAcrossSeasons;
    localStorage.setItem('anime_progress', JSON.stringify(legacyProgress));

    try {
      await cloudflareApi.syncWatchlistItem({
        anime_id: anime.id,
        status: watchlistStatus || 'Watching',
        progress: totalWatchedAcrossSeasons,
      });
    } catch {
      // Best-effort offline tolerance
    }
  };

  const handleMarkSeasonComplete = () => {
    if (currentSeasonMaxEpisodes && currentSeasonMaxEpisodes > 0) {
      handleUpdateProgress(currentSeasonMaxEpisodes);
      if (onUpdateStatus && seasonBreakdowns.length <= 1) {
        onUpdateStatus(anime.id, 'Completed');
      }
      if (onShowToast) {
        onShowToast(`Marked Season ${selectedProgressSeason} as completed`, 'success');
      }
    }
  };

  const handleAddReview = async (e?: React.FormEvent, retryText?: string) => {
    if (e) e.preventDefault();
    const commentText = (retryText ?? newComment).trim();
    if (!commentText) return;

    const verifiedReviewerName = getVerifiedClerkUsername(user) || user?.name || 'AnimeFan_IN';
    const autoSpoiler = /spoiler|dies|death|ending|betray|final boss/i.test(commentText);
    const review: ReviewItem = {
      id: Date.now().toString(),
      userName: verifiedReviewerName,
      rating: newRating,
      comment: commentText,
      date: 'Just now',
      likes: 0,
      isSpoiler: newIsSpoiler || autoSpoiler,
    };

    setReviewSyncState('posting');
    try {
      await cloudflareApi.addReview(anime.id, review);
      const updatedReviews = [review, ...reviews];
      setReviews(updatedReviews);

      const allReviews = JSON.parse(localStorage.getItem('anime_reviews') || '{}');
      allReviews[anime.id] = updatedReviews;
      localStorage.setItem('anime_reviews', JSON.stringify(allReviews));

      setNewComment('');
      setNewIsSpoiler(false);
      setLastFailedComment('');
      setReviewSyncState('idle');
      if (onShowToast) onShowToast('Review published', 'success');
    } catch {
      setLastFailedComment(commentText);
      setReviewSyncState('failed');
      if (onShowToast) onShowToast('Could not publish review. Tap Retry.', 'error');
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
    const shareUrl = `${window.location.origin}/anime/${anime.id}`;
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
    if (whereToWatchRef.current) {
      whereToWatchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Strict Data Honesty: Only verified OTT platforms from the record; NEVER default to Crunchyroll
  const verifiedPlatforms = Array.isArray(anime.platforms)
    ? anime.platforms.filter((p) => Boolean(p && p.trim().length > 0))
    : [];

  const lastVerifiedDisplay = anime.lastUpdated
    ? formatLocaleDate(anime.lastUpdated, uiLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : t('common:verified', 'Verified');

  const statusOptions: WatchlistStatus[] = [
    'Watching',
    'Completed',
    'On Hold',
    'Dropped',
    'Plan to Watch',
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

  const tabs: { id: DetailTabId; label: string }[] = [
    { id: 'overview', label: t('animeDetails:tabs.overview', 'Overview') },
    { id: 'seasons-dubs', label: t('animeDetails:tabs.seasonsAndDubs', 'Seasons & Dubs') },
    { id: 'progress', label: t('animeDetails:tabs.watchProgress', 'Watch Progress') },
    {
      id: 'reviews',
      label: t('animeDetails:tabs.reviews', {
        count: formatLocaleNumber(reviews.length, uiLocale),
        defaultValue: `Reviews (${reviews.length})`,
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
  const isLongSynopsis = synopsisText.length > 220;

  const activeMatrixSeason =
    seasonBreakdowns.find((s) => s.seasonNumber === selectedMatrixSeason) || seasonBreakdowns[0];

  const innerContent = (
    <div
      ref={modalContainerRef}
      className={
        asPage
          ? 'w-full overflow-x-clip bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24'
          : 'relative w-full max-w-[calc(100vw-1.5rem)] sm:max-w-4xl max-h-[92vh] overflow-x-clip bg-[var(--bg-canvas)] rounded-t-[20px] sm:rounded-[20px] border border-[var(--border-subtle)] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-180'
      }
    >
      {/* Top Bar for Page or Modal */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to catalog"
          className="min-h-[44px] min-w-[44px] px-3 rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-2 text-[13px] font-semibold transition-colors duration-180 motion-reduce:transition-none"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>{t('common:back', 'Back')}</span>
        </button>

        <div className="flex items-center gap-2">
          {onEditAnime && user?.isAdmin && (
            <button
              type="button"
              onClick={() => onEditAnime(anime)}
              aria-label="Edit Anime Info"
              className="min-h-[44px] px-3 rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-1.5 text-[12px] font-semibold transition-colors duration-180"
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
              className="min-h-[44px] min-w-[44px] rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors duration-180"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className={asPage ? 'max-w-[1040px] mx-auto px-4 sm:px-6 pt-5' : 'overflow-y-auto flex-1 px-4 sm:px-6 pt-5 pb-10'}>
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
        {/* 1. Streaming-First Hero & Action Hierarchy */}
        <section className="relative rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-6 mb-5 overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* 2:3 Poster */}
            <div className="w-28 sm:w-40 aspect-[2/3] rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0 shadow-lg mx-auto sm:mx-0">
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

            {/* Hero Metadata & Action Hierarchy */}
            <div className="flex-1 min-w-0 w-full">
              {/* Compact Metadata Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className={`px-2.5 py-0.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider border ${
                    anime.status === 'Airing'
                      ? 'bg-emerald-500/10 text-[#34D399] border-emerald-500/30'
                      : anime.status === 'Upcoming'
                        ? 'bg-amber-500/10 text-[#F9C876] border-amber-500/30'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {anime.status || 'Status unverified'}
                </span>

                {anime.releaseYear && anime.releaseYear > 0 && (
                  <span className="px-2.5 py-0.5 rounded-[8px] text-[12px] font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    {anime.releaseYear}
                  </span>
                )}

                <span className="px-2.5 py-0.5 rounded-[8px] text-[12px] font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center gap-1">
                  <Tv className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  {anime.episodesCount && anime.episodesCount > 0
                    ? `${formatLocaleNumber(anime.episodesCount, uiLocale)} ${t('animeDetails:episodes', 'Episodes')}`
                    : t('common:countNotVerified', UNVERIFIED_COUNT_LABEL)}
                </span>

                {typeof anime.rating === 'number' && anime.rating > 0 && (
                  <span className="px-2.5 py-0.5 rounded-[8px] text-[12px] font-bold bg-[var(--bg-elevated)] text-[#F9C876] border border-[var(--border-subtle)] flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {anime.rating.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Crisp Title: 24px mobile / 30px desktop — Official English title preserved */}
              <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em] mb-1.5">
                {anime.title}
              </h1>

              {activeLocalizedTitle && activeLocalizedTitle.toLowerCase() !== anime.title.toLowerCase() && (
                <p
                  data-testid="localized-anime-subtitle"
                  className="text-[14px] font-medium text-[var(--accent-primary)] mb-1.5 leading-snug"
                >
                  {activeLocalizedTitle}
                </p>
              )}

              {anime.japaneseTitle && (
                <p className="text-[13px] text-[var(--text-secondary)] mb-3 truncate">{anime.japaneseTitle}</p>
              )}

              {/* Regional Dub Language Pills */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                {Array.isArray(anime.languages) && anime.languages.length > 0 ? (
                  anime.languages.map((lang) => (
                    <span
                      key={lang}
                      className="px-2.5 py-1 rounded-[8px] text-[11px] font-bold uppercase tracking-wider bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border border-[var(--accent-primary)]/35"
                    >
                      {lang} Dub
                    </span>
                  ))
                ) : (
                  <span className="px-2.5 py-1 rounded-[8px] text-[11px] font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    Regional dub languages not verified
                  </span>
                )}
              </div>

              {/* Dual Rating Summary */}
              <div className="mb-4">
                <DualRating
                  animeId={anime.id}
                  officialRating={anime.rating}
                  userRatingsCount={anime.userRatingsCount}
                  userRatingsSum={anime.userRatingsSum}
                />
              </div>

              {/* Streaming-First Action Hierarchy:
                  1. ONE full-width #B49AF8 Primary CTA ("Where to Watch")
                  2. Secondary compact 44x44px action buttons (Save, Follow, Share, Report) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePrimaryWhereToWatchClick}
                  data-testid="hero-where-to-watch-cta"
                  className="w-full sm:flex-1 min-h-[44px] sm:min-h-[48px] px-5 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold text-[14px] flex items-center justify-center gap-2 transition-all duration-180 motion-reduce:transition-none shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" />
                  <span className="truncate">{t('animeDetails:whereToWatch', 'Where to Watch')}</span>
                  {verifiedPlatforms.length > 0 && (
                    <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-canvas)]/15 text-[var(--accent-on-primary)] text-[11px] font-extrabold shrink-0">
                      {verifiedPlatforms.length} OTT{verifiedPlatforms.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>

                {/* Secondary Action Row (44x44px minimum touch targets) */}
                <div className="flex items-center gap-2">
                  {/* Save / Bookmark */}
                  <button
                    type="button"
                    onClick={(e) => onToggleWatchlist(anime.id, e)}
                    aria-label={isInWatchlist ? t('animeDetails:inLibrary', 'In library') : t('animeDetails:addToLibrary', 'Add to library')}
                    className={`flex-1 sm:flex-initial min-h-[44px] min-w-[44px] px-3.5 rounded-[12px] font-semibold text-[13px] flex items-center justify-center gap-1.5 border transition-all duration-180 motion-reduce:transition-none ${
                      isInWatchlist
                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border-[var(--accent-primary)]/40'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
                    }`}
                  >
                    <Heart className={`w-4 h-4 shrink-0 ${isInWatchlist ? 'fill-current text-[var(--accent-primary)]' : ''}`} />
                    <span className="truncate">{isInWatchlist ? t('animeDetails:inLibrary', 'Saved') : t('common:save', 'Save')}</span>
                  </button>

                  {/* Follow for dub updates */}
                  <button
                    type="button"
                    onClick={toggleFollow}
                    aria-label={isFollowed ? t('animeDetails:following', 'Following') : t('animeDetails:follow', 'Follow')}
                    className={`flex-1 sm:flex-initial min-h-[44px] min-w-[44px] px-3.5 rounded-[12px] font-semibold text-[13px] flex items-center justify-center gap-1.5 border transition-all duration-180 motion-reduce:transition-none ${
                      isFollowed
                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border-[var(--accent-primary)]/40'
                        : 'bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)]/60 text-[var(--text-primary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {isFollowed ? <Bell className="w-4 h-4 text-[var(--accent-primary)] shrink-0" /> : <BellOff className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />}
                    <span className="truncate">{isFollowed ? t('animeDetails:following', 'Following') : t('animeDetails:follow', 'Follow')}</span>
                  </button>

                  {/* Share */}
                  <button
                    type="button"
                    onClick={handleShare}
                    aria-label={t('animeDetails:share', 'Share')}
                    title={t('animeDetails:share', 'Share')}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)]/60 text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors duration-180 shrink-0"
                  >
                    <Share2 className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>

                  {/* Report wrong info */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onReportIssue) {
                        onReportIssue(anime);
                      } else {
                        setInternalReportOpen(true);
                      }
                    }}
                    aria-label={t('animeDetails:reportWrongInfo', 'Report wrong info')}
                    title={t('animeDetails:reportWrongInfo', 'Report wrong info')}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors duration-180 shrink-0"
                  >
                    <Flag className="w-4 h-4 text-[#F87171]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Prominent "Where to Watch" Card (Top Priority) */}
        <section
          ref={whereToWatchRef}
          id="where-to-watch-section"
          data-testid="where-to-watch-card"
          className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 mb-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center">
                <Play className="w-4 h-4 text-[var(--accent-primary)] fill-current" />
              </div>
              <div>
                <h2 className="text-[16px] sm:text-[18px] font-bold text-[var(--text-primary)]">
                  {t('animeDetails:whereToWatchIndia', 'Where to Watch (India)')}
                </h2>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {t('animeDetails:streamingNote', 'Official legal streaming platforms verified for India.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[12px] text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Region: <strong className="text-[var(--text-primary)] font-semibold">India</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
                Last verified: <strong className="text-[var(--text-primary)] font-semibold">{lastVerifiedDisplay}</strong>
              </span>
            </div>
          </div>

          {verifiedPlatforms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {verifiedPlatforms.map((platform) => {
                const ottUrl = generateOttUrl(platform, anime.title, anime.streamingLinks?.[platform]);
                const hasDirectLink = Boolean(anime.streamingLinks?.[platform]);
                return (
                  <a
                    key={platform}
                    href={ottUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[52px] px-4 py-3 rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)]/80 border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 flex items-center justify-between gap-3 transition-all duration-180 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                        <PlatformIcon platform={platform} className="w-4 h-4 text-[var(--text-primary)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">{platform}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {hasDirectLink ? 'Direct Verified Link' : 'Official Platform Search (India)'}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-transform">
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
                <AlertTriangle className="w-5 h-5 text-[#F9C876] shrink-0" />
                <div>
                  <div className="text-[14px] font-bold text-[var(--text-primary)]">{t('common:notVerified', 'Not verified')}</div>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {t('animeDetails:noVerifiedPlatforms', 'No verified official OTT streaming link is listed for India yet.')}
                  </p>
                </div>
              </div>
              {onReportIssue && (
                <button
                  type="button"
                  onClick={() => onReportIssue(anime)}
                  className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold shrink-0 transition-colors"
                >
                  Submit verified OTT link
                </button>
              )}
            </div>
          )}
        </section>

        {/* 3. Clean Eclipse Tabs (Overview, Seasons & Dubs, Watch Progress, Reviews) */}
        <div
          role="tablist"
          aria-label="Anime detail sections"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[var(--border-subtle)] mb-5 pb-1"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] px-4 rounded-t-[12px] text-[13px] sm:text-[14px] font-semibold whitespace-nowrap border-b-2 transition-all duration-180 motion-reduce:transition-none ${
                  isActive
                    ? 'border-[var(--accent-primary)] text-[var(--text-primary)] bg-[var(--bg-surface)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-5" role="tabpanel">
            <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
                    {t('animeDetails:synopsis', 'Synopsis')}
                  </h3>
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
                    className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
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
                className={`text-[15px] text-[var(--text-secondary)] leading-[1.6] ${
                  !isSynopsisExpanded && isLongSynopsis ? 'line-clamp-3' : ''
                }`}
              >
                {synopsisText}
              </p>
              {isLongSynopsis && (
                <button
                  type="button"
                  onClick={() => setIsSynopsisExpanded((prev) => !prev)}
                  className="mt-2 min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] inline-flex items-center gap-1.5 transition-colors duration-180"
                >
                  <span>{isSynopsisExpanded ? 'Show Less' : 'Read More'}</span>
                  {isSynopsisExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4 border-t border-[var(--border-subtle)]">
                <div>
                  <div className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Genres
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(anime.genres) && anime.genres.length > 0 ? (
                      anime.genres.map((genre) => (
                        <span
                          key={genre}
                          className="px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-medium"
                        >
                          {genre}
                        </span>
                      ))
                    ) : (
                      <span className="text-[13px] text-[var(--text-secondary)]">Not verified</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Animation Studio
                  </div>
                  <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {anime.studio && anime.studio.trim() ? anime.studio : 'Studio not verified'}
                  </div>
                </div>

                <div>
                  <div className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    SEASONS &amp; EPISODES
                  </div>
                  <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {(anime as any).seasonEpisodeCount ||
                      (anime as any).season_episode_count ||
                      dubProgress?.overallBadgeText ||
                      (anime.episodesCount && anime.episodesCount > 0
                        ? `${anime.episodesCount} Episodes`
                        : UNVERIFIED_COUNT_LABEL)}
                  </div>
                </div>

                <div>
                  <div className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    OFFICIAL SOURCE
                  </div>
                  {(anime as any).officialSourceUrl || (anime as any).official_source_url ? (
                    <a
                      href={(anime as any).officialSourceUrl || (anime as any).official_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] break-all"
                    >
                      <span>Verified Official Announcement</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  ) : (
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                      {verifiedPlatforms.length > 0 ? verifiedPlatforms.join(', ') : 'Source not verified'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Franchise Watch Order: ONLY rendered when verified franchise relationships exist */}
            {franchiseEntries.length > 0 && (
              <div
                data-testid="franchise-watch-order"
                className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[16px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>{t('animeDetails:franchiseOrder', 'Franchise Watch Order')}</span>
                  </h3>
                  <span className="text-[12px] text-[var(--text-secondary)]">{franchiseEntries.length} verified entries</span>
                </div>

                <div className="space-y-2.5">
                  {franchiseEntries.map((entry, idx) => {
                    const isCurrent = entry.id === anime.id;
                    const matchedAnime = allAnime.find((a) => a.id === entry.id);
                    return (
                      <div
                        key={entry.id}
                        onClick={() => {
                          if (!isCurrent && matchedAnime && onSelectAnime) {
                            onSelectAnime(matchedAnime);
                          }
                        }}
                        className={`min-h-[52px] p-3 rounded-[12px] border flex items-center justify-between gap-3 transition-colors ${
                          isCurrent
                            ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/40 text-[var(--text-primary)]'
                            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-bold text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{entry.title}</div>
                            <div className="text-[11px] text-[var(--text-secondary)]">
                              {entry.relationType}
                              {entry.releaseYear ? ` • ${entry.releaseYear}` : ''}
                            </div>
                          </div>
                        </div>
                        {isCurrent ? (
                          <span className="px-2.5 py-1 rounded-[8px] bg-[var(--accent-primary)] text-[var(--accent-on-primary)] text-[11px] font-bold shrink-0">
                            Viewing
                          </span>
                        ) : (
                          <span className="text-[12px] font-semibold text-[var(--accent-primary)] shrink-0">View</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SEASONS & DUBS */}
        {activeTab === 'seasons-dubs' && (
          <div className="space-y-4" role="tabpanel">
            <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Season & Regional Dub Matrix</h3>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {dubProgress?.overallBadgeText || UNVERIFIED_COUNT_LABEL}
                  </p>
                </div>
                {dubProgress?.statusLabel && (
                  <span className="px-2.5 py-1 rounded-[8px] bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border border-[var(--accent-primary)]/30 text-[12px] font-semibold">
                    {dubProgress.statusLabel}
                  </span>
                )}
              </div>

              {/* Desktop Table: Season x Language x Verified OTT Matrix */}
              <div className="hidden sm:block overflow-x-auto rounded-[12px] border border-[var(--border-subtle)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      <th className="py-3 px-4">Season</th>
                      <th className="py-3 px-4">Episodes</th>
                      <th className="py-3 px-4">Tamil / Hindi / Telugu Dubs</th>
                      <th className="py-3 px-4">Verified OTT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                    {seasonBreakdowns.map((season) => (
                      <tr key={season.seasonNumber} className="bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[var(--text-primary)]">
                          {season.title || `Season ${season.seasonNumber}`}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--text-secondary)]">
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
                                  className="px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)]"
                                >
                                  <strong className="text-[var(--accent-hover)]">{l.language}:</strong>{' '}
                                  {l.totalEpisodes
                                    ? `${l.dubbedEpisodes}/${l.totalEpisodes} eps`
                                    : l.dubbedEpisodes > 0
                                      ? `${l.dubbedEpisodes} eps`
                                      : UNVERIFIED_COUNT_LABEL}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[var(--text-secondary)]">{UNVERIFIED_COUNT_LABEL}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {verifiedPlatforms.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {verifiedPlatforms.map((platform) => (
                                <span
                                  key={platform}
                                  className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)]"
                                >
                                  {platform}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[12px] text-[var(--text-secondary)]">Not verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Compact Season Selector Pills + Stacked Language Rows */}
              <div className="sm:hidden space-y-3">
                {seasonBreakdowns.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {seasonBreakdowns.map((season) => {
                      const active = season.seasonNumber === (activeMatrixSeason?.seasonNumber ?? 1);
                      return (
                        <button
                          key={season.seasonNumber}
                          type="button"
                          onClick={() => setSelectedMatrixSeason(season.seasonNumber)}
                          className={`min-h-[44px] px-3.5 rounded-[10px] text-[13px] font-semibold whitespace-nowrap border transition-colors duration-180 ${
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
                    <div className="flex items-center justify-between">
                      <div className="text-[14px] font-bold text-[var(--text-primary)]">
                        {activeMatrixSeason.title || `Season ${activeMatrixSeason.seasonNumber}`}
                      </div>
                      <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                        {activeMatrixSeason.totalEpisodes && activeMatrixSeason.totalEpisodes > 0
                          ? `${activeMatrixSeason.totalEpisodes} Episodes`
                          : UNVERIFIED_COUNT_LABEL}
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
                                  OTT: {verifiedPlatforms.join(', ')}
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[12px] font-bold ${
                                langProgress.isComplete ? 'text-[#34D399]' : 'text-[var(--accent-primary)]'
                              }`}
                            >
                              {langProgress.totalEpisodes
                                ? `${langProgress.dubbedEpisodes} / ${langProgress.totalEpisodes} eps`
                                : langProgress.dubbedEpisodes > 0
                                  ? `${langProgress.dubbedEpisodes} eps verified`
                                  : UNVERIFIED_COUNT_LABEL}
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
            </div>
          </div>
        )}

        {/* TAB 3: WATCH PROGRESS */}
        {activeTab === 'progress' && (
          <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-5" role="tabpanel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
                  {t('animeDetails:progress.title', 'Episode Progress')}
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {t('animeDetails:progress.statusLabel', 'Watchlist Status')}
                </p>
              </div>

              {onUpdateStatus && (
                <select
                  aria-label="Watchlist status"
                  value={watchlistStatus}
                  onChange={(e) => onUpdateStatus(anime.id, e.target.value as WatchlistStatus)}
                  className="min-h-[44px] px-3.5 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  {statusOptions.map((st) => (
                    <option key={st} value={st}>
                      {getLocalizedStatusLabel(st)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Season Selector Pills (44px touch targets) */}
            {seasonBreakdowns.length > 1 && (
              <div>
                <div className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">Select Season</div>
                <div className="flex flex-wrap gap-2">
                  {seasonBreakdowns.map((s) => (
                    <button
                      key={s.seasonNumber}
                      type="button"
                      onClick={() => setSelectedProgressSeason(s.seasonNumber)}
                      className={`min-h-[44px] px-3.5 rounded-[10px] text-[13px] font-semibold border transition-colors ${
                        selectedProgressSeason === s.seasonNumber
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Season {s.seasonNumber}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Episode Counter Bar */}
            <div className="p-4 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[12px] text-[var(--text-secondary)] font-medium">
                  Season {selectedProgressSeason} Progress
                </div>
                <div className="text-[20px] font-bold text-[var(--text-primary)]">
                  {episodesWatched}{' '}
                  <span className="text-[14px] font-normal text-[var(--text-secondary)]">
                    / {currentSeasonMaxEpisodes !== null ? currentSeasonMaxEpisodes : '?'} Episodes
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease watched episodes"
                  onClick={() => handleUpdateProgress(episodesWatched - 1)}
                  disabled={episodesWatched <= 0}
                  className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] disabled:opacity-40 text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Increase watched episodes"
                  onClick={() => handleUpdateProgress(episodesWatched + 1)}
                  disabled={currentSeasonMaxEpisodes !== null && episodesWatched >= currentSeasonMaxEpisodes}
                  className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-[var(--accent-on-primary)] font-bold flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {currentSeasonMaxEpisodes !== null && currentSeasonMaxEpisodes > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkSeasonComplete}
                    className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--accent-hover)] border border-[var(--border-subtle)] text-[12px] font-semibold transition-colors"
                  >
                    Mark season completed
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="space-y-5" role="tabpanel">
            {/* Write a Review Form */}
            <form
              onSubmit={(e) => handleAddReview(e)}
              className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
                  {t('animeDetails:reviews.writeReview', 'Write a review')}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[var(--text-secondary)]">{t('animeDetails:rating', 'Rating')}:</span>
                  <span className="px-2.5 py-1 rounded-[8px] bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border border-[var(--accent-primary)]/30 text-[13px] font-bold">
                    {newRating} / 10
                  </span>
                </div>
              </div>

              {/* Accessible 1-10 Rating Slider + 44px Quick Score Buttons */}
              <div className="space-y-2">
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  aria-label="Review score slider from 1 to 10"
                  value={newRating}
                  onChange={(e) => setNewRating(Number(e.target.value))}
                  className="w-full h-2 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                />
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNewRating(num)}
                      className={`min-h-[44px] rounded-[10px] text-[13px] font-bold border transition-colors duration-180 ${
                        newRating === num
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('animeDetails:reviews.placeholder', 'Share your honest thoughts on the regional dub quality, voice acting, or translation...')}
                className="w-full rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="min-h-[44px] inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newIsSpoiler}
                    onChange={(e) => setNewIsSpoiler(e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                  />
                  <span>Contains spoilers</span>
                </label>

                <div className="flex items-center gap-2">
                  {reviewSyncState === 'failed' && lastFailedComment && (
                    <button
                      type="button"
                      onClick={() => handleAddReview(undefined, lastFailedComment)}
                      className="min-h-[44px] px-3.5 rounded-[12px] bg-red-500/15 text-[#F87171] border border-red-500/30 text-[12px] font-bold"
                    >
                      {t('animeDetails:reviews.failedRetry', 'Failed — Retry')}
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={reviewSyncState === 'posting' || !newComment.trim()}
                    className="min-h-[44px] px-4 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-on-primary)] font-bold text-[13px] inline-flex items-center gap-2 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {reviewSyncState === 'posting'
                        ? t('animeDetails:reviews.posting', 'Posting…')
                        : t('animeDetails:reviews.submit', 'Post Review')}
                    </span>
                  </button>
                </div>
              </div>
            </form>

            {wsReviewError && (
              <div
                role="alert"
                className="rounded-[12px] bg-red-500/10 border border-red-500/30 px-4 py-2.5 flex items-center justify-between gap-2 text-[12px] text-[#F87171]"
              >
                <span>{wsReviewError}</span>
                <button
                  type="button"
                  onClick={() => setWsReviewError(null)}
                  aria-label="Dismiss review notice"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] hover:bg-red-500/15"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Spoiler Shield Controls Bar */}
            <div className="rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px]">
                {spoilerShieldEnabled ? (
                  <EyeOff className="w-4 h-4 text-[var(--accent-primary)]" />
                ) : (
                  <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
                )}
                <span className="font-semibold text-[var(--text-primary)]">Spoiler Shield</span>
                <span className="text-[12px] text-[var(--text-secondary)] hidden sm:inline">
                  {spoilerShieldEnabled ? 'Masks reviews flagged with plot spoilers' : 'Showing all spoilers'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={spoilerShieldEnabled}
                onClick={handleToggleSpoilerShield}
                data-testid="spoiler-shield-toggle"
                className={`min-h-[44px] px-3.5 rounded-[10px] text-[12px] font-bold border transition-colors duration-180 ${
                  spoilerShieldEnabled
                    ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border-[var(--accent-primary)]/40'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                }`}
              >
                {spoilerShieldEnabled ? 'Spoiler Shield: ON' : 'Spoiler Shield: OFF'}
              </button>
            </div>

            {/* Reviews List */}
            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((rev) => {
                  const isMasked = Boolean(rev.isSpoiler && spoilerShieldEnabled && !revealedReviewIds[rev.id]);
                  return (
                    <div
                      key={rev.id}
                      className="rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-bold text-[var(--text-primary)]">{rev.userName}</span>
                          <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] text-[#F9C876] text-[11px] font-bold flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            {rev.rating}/10
                          </span>
                          {rev.isSpoiler && (
                            <span className="px-2 py-0.5 rounded-[6px] bg-amber-500/10 text-[#F9C876] border border-amber-500/30 text-[10px] font-bold uppercase">
                              Spoiler
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)]">{rev.date}</span>
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
                            className="min-h-[44px] px-3 rounded-[8px] bg-[var(--bg-surface)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold"
                          >
                            Reveal Spoiler
                          </button>
                        </div>
                      ) : (
                        <p className="text-[14px] text-[var(--text-primary)] leading-relaxed">{rev.comment}</p>
                      )}

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleLikeReview(rev.id)}
                          className="min-h-[44px] px-3 rounded-[8px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Helpful ({rev.likes})</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 text-center text-[13px] text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)] mb-1">
                  {t('animeDetails:reviews.emptyTitle', 'No reviews yet')}
                </p>
                <p>{t('animeDetails:reviews.emptySubtitle', 'Be the first to share how this Indian dub sounds.')}</p>
              </div>
            )}
          </div>
        )}
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

