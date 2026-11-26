import React, { useState, useEffect, useMemo } from 'react';
import Image from './OptimizedImage';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Bookmark,
  CheckCircle2,
  Share2,
  Flag,
  Star,
  Play,
  ExternalLink,
  Send,
  ThumbsUp,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Flame,
  Volume2,
  X,
  Minus,
  Plus,
  Tv,
  Scale,
  Layers,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Anime } from './CatalogView';
import { cloudflareApi } from '../services/cloudflareApi';
import { getCloudflareWsUrl } from '../config/cloudflare';
import { generateRandomUsername } from '../utils/randomUser';
import { getVerifiedClerkUsername } from '../utils/chatIdentity';
import { formatRelativeTime } from '../utils/timestamps';
import { useUser, getClerkSessionToken } from '../lib/clerk';
import { DualRating } from './DualRating';
import { ReportModal } from './ReportModal';
import { DetailModalSkeleton } from './SkeletonGrid';
import { EmptyState } from './ui/EclipseState';
import { buildAnimeJsonLd } from '../utils/seoMeta';
import { parsePlatformList } from '../utils/dataNormalization';
import { normalizeCanonicalOttList, normalizeCanonicalOttName } from '../utils/ottHub';
import { validateOfficialSourceUrl } from '../utils/submissionValidation';
import { resolveCanonicalAnimeStatus } from '../utils/animeStatus';
import { buildDubProgressBreakdown } from '../utils/dubProgress';
import {
  getAnimeWatchProgress,
  saveAnimeWatchProgress,
  computeWatchProgressPercent,
  getSpoilerProtectionEnabled,
  setSpoilerProtectionEnabled,
  SPOILER_PROTECTION_EVENT,
  type WatchProgressEntry,
} from '../utils/watchProgress';

export interface AnimeReviewItem {
  id: number | string;
  author: string;
  user_name?: string;
  rating: number;
  language: string;
  comment: string;
  date: string;
  created_at?: string;
  likes: number;
  isLiked: boolean;
  spoilers: boolean;
  revealed: boolean;
  deliveryStatus?: 'pending' | 'published' | 'failed';
}

export interface RichPlatformEntry {
  name?: string;
  platform?: string;
  url?: string;
  languages?: string[];
}

export interface SeasonEntry {
  name?: string;
  episodes?: number | string;
  episode_count?: number | string;
}

export interface FranchiseEntry {
  id: number;
  title: string;
  slug?: string;
  cover_image?: string;
  year?: number | null;
  type?: string;
  languages?: string;
  relation_type?: string | null;
  sequence_number?: number | null;
  status?: string | null;
}

export interface AnimeDetailRecord extends Omit<Partial<Anime>, 'rating' | 'year'> {
  popularity?: number;
  likes?: number;
  rating?: number | string | null;
  year?: number | null;
  studio?: string;
  genre?: string;
  watch_url?: string;
  community_rating?: number;
  communityRating?: number;
  community_votes?: number;
  communityVotes?: number;
  user_rating?: number | null;
  userRating?: number | null;
  reviews?: Array<{
    id?: number | string;
    author?: string;
    user_name?: string;
    rating?: number | string;
    language?: string;
    comment?: string;
    created_at?: string;
    date?: string | number;
    likes?: number;
    spoilers?: boolean;
  }>;
  description?: string;
  releaseYear?: number;
  airing_status?: string;
  streamUrl?: string;
  platforms?: string[] | string;
  platforms_data?: RichPlatformEntry[] | Record<string, unknown> | string;
  seasons?: SeasonEntry[];
  mixedEntries?: SeasonEntry[];
  seasonsList?: SeasonEntry[];
  episodes_count?: number;
  episodes?: number;
  episode_count?: number;
  season_episode_count?: string;
  official_source_url?: string;
  audio_spec?: string | null;
  duration?: string | null;
  dub_matrix?: unknown;
  last_verified_at?: string | null;
  updated_at?: string | null;
  franchise_id?: string | null;
  relation_type?: string | null;
  sequence_number?: number | null;
  franchise_entries?: FranchiseEntry[];
}

export interface AnimeDetailPageProps {
  animeId: number | string;
  initialAnime?: AnimeDetailRecord | null;
  onResolvedAnime?: (anime: AnimeDetailRecord) => void;
  onClose?: () => void;
  onBack?: () => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onSelectAnime?: (anime: Anime) => void;
  onCompareAnime?: (anime: AnimeDetailRecord) => void;
}

export const AnimeDetailPage: React.FC<AnimeDetailPageProps> = ({
  animeId,
  initialAnime = null,
  onResolvedAnime,
  onClose,
  onBack,
  watchlist,
  onToggleWatchlist,
  onSelectAnime: _onSelectAnime,
  onCompareAnime,
}) => {
  const { user } = useUser();
  const [details, setDetails] = useState<AnimeDetailRecord | null>(initialAnime);
  const [loading, setLoading] = useState(!initialAnime);
  const [notFound, setNotFound] = useState(false);
  const [selectedDubSeasonIdx, setSelectedDubSeasonIdx] = useState(0);
  const [upvotes, setUpvotes] = useState(Number(initialAnime?.popularity) || 0);
  const [currentRating, setCurrentRating] = useState<number | null>(
    initialAnime?.rating !== undefined && initialAnime?.rating !== null && !Number.isNaN(Number(initialAnime.rating))
      ? Number(initialAnime.rating)
      : null
  );
  const [isVoting, setIsVoting] = useState(false);
  const [_isRating, setIsRating] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const numericAnimeId = Number(details?.id ?? animeId) || 0;

  // Community Rating states
  const [communityRating, setCommunityRating] = useState<number>(0);
  const [communityVotes, setCommunityVotes] = useState<number>(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  // Review Form state
  const [reviewRating, setReviewRating] = useState(8.5);
  const [reviewLang, setReviewLang] = useState('Hindi Dub');
  const [reviewComment, setReviewComment] = useState('');
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [reviewsList, setReviewsList] = useState<AnimeReviewItem[]>(() => {
    try {
      const saved = localStorage.getItem(`cf_reviews_${animeId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Follow for dub updates state
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);

  // Toast / Modal states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportInitialField, setReportInitialField] = useState<string>('OTT Link');
  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'dubs' | 'progress' | 'reviews'>('overview');

  const openReportForField = (field: string) => {
    setReportInitialField(field);
    setIsReportOpen(true);
  };

  // Watch Progress & Spoiler Protection states
  const [watchProgress, setWatchProgress] = useState<WatchProgressEntry | null>(() =>
    getAnimeWatchProgress(animeId)
  );
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [spoilerProtection, setSpoilerProtection] = useState<boolean>(() =>
    getSpoilerProtectionEnabled()
  );
  const [isSynopsisRevealed, setIsSynopsisRevealed] = useState(false);

  useEffect(() => {
    const syncSpoilerPref = () => {
      const enabled = getSpoilerProtectionEnabled();
      setSpoilerProtection(enabled);
      if (enabled) {
        setIsSynopsisRevealed(false);
      }
    };
    window.addEventListener(SPOILER_PROTECTION_EVENT, syncSpoilerPref);
    return () => window.removeEventListener(SPOILER_PROTECTION_EVENT, syncSpoilerPref);
  }, []);

  const handleBack = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };

  useEffect(() => {
    setIsSynopsisRevealed(false);
    // Load watch progress from localStorage
    const localProgress = getAnimeWatchProgress(animeId);
    setWatchProgress(localProgress);

    // Check watched status from localStorage
    try {
      const watched: unknown[] = JSON.parse(localStorage.getItem('cf_watched_anime_ids') || '[]');
      const idNum = Number(animeId);
      setIsWatched(watched.some((w) => Number(w) === idNum) || Boolean(localProgress?.completed));
    } catch {
      setIsWatched(Boolean(localProgress?.completed));
    }

    // Load follow status from localStorage + D1
    try {
      const followKey = user?.id ? `cf_followed_anime_ids_${user.id}` : 'cf_followed_anime_ids';
      const localFollows: unknown[] = JSON.parse(localStorage.getItem(followKey) || '[]');
      const idNum = Number(details?.id ?? animeId);
      setIsFollowing(localFollows.some((fid) => Number(fid) === idNum));
    } catch {
      setIsFollowing(false);
    }

    if (user?.id) {
      cloudflareApi
        .fetchFollows()
        .then((res) => {
          const targetId = Number(details?.id ?? animeId);
          if (Array.isArray(res?.follows)) {
            const ids = res.follows
              .map((f: number | { anime_id?: number }) =>
                typeof f === 'number' ? f : Number(f?.anime_id)
              )
              .filter((n) => Number.isFinite(n) && n > 0);
            const matched = ids.some((fid) => fid === targetId);
            setIsFollowing(matched);
            try {
              localStorage.setItem(`cf_followed_anime_ids_${user.id}`, JSON.stringify(ids));
            } catch {}
          }
        })
        .catch(() => {});
    }

    // Sync watch progress from D1 if signed in
    if (user?.id) {
      cloudflareApi
        .getWatchProgress(animeId)
        .then((remote) => {
          if (remote) {
            const normalizedRemote = saveAnimeWatchProgress(animeId, {
              season: remote.season,
              episode: remote.episode,
              totalEpisodes: remote.totalEpisodes ?? localProgress?.totalEpisodes ?? null,
              completed: remote.completed,
            });
            if (normalizedRemote) {
              setWatchProgress(normalizedRemote);
              if (normalizedRemote.completed) {
                setIsWatched(true);
              }
            }
          }
        })
        .catch(() => {});
    }

    // Check saved user rating locally
    try {
      const savedUserRate = localStorage.getItem(`cf_user_rating_${animeId}_${user?.id || 'anon'}`);
      if (savedUserRate) {
        setUserRating(Number(savedUserRate));
      } else {
        setUserRating(null);
      }
    } catch {
      setUserRating(null);
    }

    // Load saved reviews for this specific anime
    try {
      const savedRevs = localStorage.getItem(`cf_reviews_${animeId}`);
      if (savedRevs) {
        setReviewsList(JSON.parse(savedRevs));
      } else {
        setReviewsList([]);
      }
    } catch {
      setReviewsList([]);
    }

    fetchDetails();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [animeId, user?.id]);

  const fetchDetails = async () => {
    setLoading(true);
    setNotFound(false);
    setSelectedDubSeasonIdx(0);
    try {
      const data = await cloudflareApi.getAnimeById(animeId, user?.id);
      if (data) {
        const record = data as AnimeDetailRecord;
        setDetails(record);
        setNotFound(false);
        onResolvedAnime?.(record);
        if (data.popularity) setUpvotes(Number(data.popularity) || 0);
        if (data.rating !== undefined && data.rating !== null) {
          const parsedRating = Number(data.rating);
          if (!Number.isNaN(parsedRating)) setCurrentRating(parsedRating);
        }
        
        // Populate Community Rating data
        if (data.community_rating !== undefined || data.communityRating !== undefined) {
          const cRating = Number(data.community_rating ?? data.communityRating);
          if (!isNaN(cRating) && cRating > 0) {
            setCommunityRating(cRating);
          }
        }
        if (data.community_votes !== undefined || data.communityVotes !== undefined) {
          setCommunityVotes(Number(data.community_votes ?? data.communityVotes) || 0);
        }
        if (data.user_rating !== undefined || data.userRating !== undefined) {
          const uRate = data.user_rating ?? data.userRating;
          if (uRate !== null && !isNaN(Number(uRate))) {
            setUserRating(Number(uRate));
            try {
              localStorage.setItem(`cf_user_rating_${animeId}_${user?.id || 'anon'}`, String(uRate));
            } catch {}
          }
        }

        if (data.reviews && Array.isArray(data.reviews) && data.reviews.length > 0) {
          const shieldActive = getSpoilerProtectionEnabled();
          const normalized: AnimeReviewItem[] = data.reviews.map((r: NonNullable<AnimeDetailRecord['reviews']>[number]) => ({
            id: r.id || Date.now(),
            author: r.author || r.user_name || 'Indian Anime Fan',
            rating: Number(r.rating) || 8.5,
            language: r.language || (r.comment?.match(/\[(.*?) Dub\]/)?.[1] ? `${r.comment.match(/\[(.*?) Dub\]/)?.[1]} Dub` : 'Hindi Dub'),
            comment: r.comment ? r.comment.replace(/^\[.*?\]\s*/, '') : '',
            date: formatRelativeTime(r.created_at || r.date || Date.now()),
            likes: r.likes || 1,
            isLiked: false,
            spoilers: Boolean(r.spoilers),
            revealed: !(Boolean(r.spoilers) && shieldActive)
          }));

          setReviewsList(prev => {
            const existingIds = new Set(prev.map(p => String(p.id)));
            const newFromApi = normalized.filter((n) => !existingIds.has(String(n.id)));
            const merged = [...prev, ...newFromApi];
            try {
              localStorage.setItem(`cf_reviews_${animeId}`, JSON.stringify(merged));
            } catch {}
            return merged.length > 0 ? merged : normalized;
          });
        }
      } else if (!initialAnime) {
        setDetails(null);
        setNotFound(true);
      }
    } catch (err) {
      console.error('Failed to fetch anime details from Cloudflare:', err);
      if (!initialAnime) {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleVote = async () => {
    setIsVoting(true);
    try {
      const data = await cloudflareApi.upvoteAnime(animeId);
      if (data && data.popularity) {
        setUpvotes(data.popularity);
        showToast(`🔥 Upvoted! Total upvotes: ${data.popularity}`);
      }
    } catch (err) {
      setUpvotes(prev => prev + 1);
      showToast('🔥 Upvoted!');
    } finally {
      try {
        const upvoted: unknown[] = JSON.parse(localStorage.getItem('cf_user_upvoted_ids') || '[]');
        const idNum = Number(animeId);
        if (!upvoted.some((u) => Number(u) === idNum)) {
          upvoted.push(idNum);
          localStorage.setItem('cf_user_upvoted_ids', JSON.stringify(upvoted));
        }
      } catch (e) {
        console.error(e);
      }
      setIsVoting(false);
    }
  };

  // Interactive 10-point Community Rating with Optimistic UI updates
  const handleCommunityRate = async (val: number) => {
    // 1. Instant Optimistic UI Update
    setUserRating(val);
    const previousUserRating = userRating;
    const previousCommunityRating = communityRating || Number(details?.rating || 8.5);
    const previousTotalVotes = communityVotes || 0;

    const newTotalVotes = previousUserRating ? previousTotalVotes : (previousTotalVotes + 1);
    const baseSum = previousCommunityRating * (previousTotalVotes > 0 ? previousTotalVotes : 1);
    const newSum = previousUserRating ? (baseSum - previousUserRating + val) : (baseSum + val);
    const optimisticAvg = newTotalVotes > 0 ? Number((newSum / newTotalVotes).toFixed(1)) : val;
    setCommunityRating(optimisticAvg);
    setCommunityVotes(newTotalVotes);
    showToast(`⭐ Rated ${val} / 10 with the Anidub Community!`);

    try {
      localStorage.setItem(`cf_user_rating_${animeId}_${user?.id || 'anon'}`, String(val));
    } catch {}

    // 2. Optional server sync if authenticated
    if (user?.id) {
      setIsSubmittingRating(true);
      try {
        const res = await cloudflareApi.submitCommunityRating(
          animeId,
          val,
          user.id,
          user.fullName || user.username || user.firstName || 'Anime Fan'
        );
        if (res && res.success) {
          if (res.communityRating !== undefined) {
            setCommunityRating(Number(res.communityRating));
          }
          if (res.totalVotes !== undefined) {
            setCommunityVotes(Number(res.totalVotes));
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('Community rating persisted locally, sync note:', message);
      } finally {
        setIsSubmittingRating(false);
      }
    }
  };

  const handleRate = async (val: number) => {
    setIsRating(true);
    try {
      const data = await cloudflareApi.rateAnime(animeId, val);
      if (data.success) {
        setCurrentRating(data.rating);
        showToast(`⭐ Rated ${val}/10! Global rating updated to ${data.rating}`);
      }
    } catch (err) {
      setCurrentRating(val);
      showToast(`⭐ Rated ${val}/10!`);
    } finally {
      setIsRating(false);
    }
  };

  const handleToggleFollow = async () => {
    if (numericAnimeId <= 0 || isTogglingFollow) return;
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setIsTogglingFollow(true);

    const followKey = user?.id ? `cf_followed_anime_ids_${user.id}` : 'cf_followed_anime_ids';
    try {
      const current: number[] = JSON.parse(localStorage.getItem(followKey) || '[]');
      const updated = nextFollowing
        ? Array.from(new Set([...current, numericAnimeId]))
        : current.filter((id) => Number(id) !== numericAnimeId);
      localStorage.setItem(followKey, JSON.stringify(updated));
    } catch {}

    try {
      if (user?.id) {
        if (nextFollowing) {
          await cloudflareApi.followAnime(numericAnimeId);
        } else {
          await cloudflareApi.unfollowAnime(numericAnimeId);
        }
      }
      showToast(
        nextFollowing
          ? 'Following dub updates for this title'
          : 'Unfollowed dub updates'
      );
    } catch {
      showToast(
        nextFollowing
          ? 'Saved dub follow locally (sign in to sync across devices)'
          : 'Removed dub follow locally'
      );
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const persistReviewsLocal = (items: AnimeReviewItem[]) => {
    try {
      localStorage.setItem(`cf_reviews_${animeId}`, JSON.stringify(items));
    } catch {}
  };

  const submitReviewToServer = async (targetReview: AnimeReviewItem) => {
    setReviewsList((prev) => {
      const next = prev.map((r) =>
        r.id === targetReview.id ? { ...r, deliveryStatus: 'pending' as const } : r
      );
      persistReviewsLocal(next);
      return next;
    });

    try {
      const res = await cloudflareApi.submitReview(animeId, {
        user_name: targetReview.author,
        rating: targetReview.rating,
        language: targetReview.language,
        comment: targetReview.comment,
      });
      const succeeded = Boolean(res && (res.success !== false));
      setReviewsList((prev) => {
        const next = prev.map((r) =>
          r.id === targetReview.id
            ? { ...r, deliveryStatus: succeeded ? ('published' as const) : ('failed' as const) }
            : r
        );
        persistReviewsLocal(next);
        return next;
      });
      if (succeeded) {
        showToast('Review published');
      } else {
        showToast('Review failed to publish — tap Retry');
      }
    } catch {
      setReviewsList((prev) => {
        const next = prev.map((r) =>
          r.id === targetReview.id ? { ...r, deliveryStatus: 'failed' as const } : r
        );
        persistReviewsLocal(next);
        return next;
      });
      showToast('Review could not be synced — tap Retry');
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    const currentUsername = user ? getVerifiedClerkUsername(user) : generateRandomUsername();
    const nowIso = new Date().toISOString();

    const newRev: AnimeReviewItem = {
      id: Date.now(),
      author: currentUsername,
      rating: reviewRating,
      language: reviewLang,
      comment: reviewComment.trim(),
      spoilers: hasSpoilers,
      revealed: !hasSpoilers,
      likes: 1,
      isLiked: false,
      date: formatRelativeTime(nowIso),
      created_at: nowIso,
      deliveryStatus: 'pending',
    };

    const updated = [newRev, ...reviewsList];
    setReviewsList(updated);
    setReviewComment('');
    try {
      persistReviewsLocal(updated);
      const userRevs = JSON.parse(localStorage.getItem('cf_user_reviews') || '[]');
      userRevs.unshift({ ...newRev, animeId });
      localStorage.setItem('cf_user_reviews', JSON.stringify(userRevs));

      // 1. Persist to D1 / SQLite database with explicit pending -> published/failed delivery state
      await submitReviewToServer(newRev);

      // 2. Broadcast review into Live Community Chat REST API with verified Clerk username
      if (user) {
        const chatPayload = {
          user: currentUsername,
          username: currentUsername,
          text: `[⭐ ${reviewRating}/10 • ${reviewLang}] ${newRev.comment}`,
          isReview: true,
          rating: reviewRating,
          language: reviewLang,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        cloudflareApi.sendChatMessage(chatPayload).catch(() => {});

        // 3. Send through Cloudflare WebSocket so connected users receive it instantly
        try {
          const wsToken = await getClerkSessionToken();
          if (wsToken) {
            const ws = new WebSocket(getCloudflareWsUrl('/ws'));
            let sentReview = false;
            ws.onopen = () => {
              ws.send(JSON.stringify({
                type: 'auth',
                token: wsToken,
                username: currentUsername,
              }));
            };
            ws.onmessage = (event) => {
              try {
                const msgData = JSON.parse(event.data);
                if (msgData?.type === 'auth_ok' && !sentReview) {
                  sentReview = true;
                  ws.send(JSON.stringify({
                    id: `rev_${Date.now()}`,
                    ...chatPayload
                  }));
                  setTimeout(() => ws.close(), 800);
                  return;
                }
                if (msgData?.type === 'error' && msgData?.error) {
                  showToast(msgData.error);
                  ws.close();
                }
              } catch {}
            };
          }
        } catch (_) {}
      }

    } catch (err) {
      console.error(err);
    }
    await handleRate(reviewRating);
  };

  const handleLikeReview = (id: number | string) => {
    setReviewsList(reviewsList.map(r => {
      if (r.id === id) {
        const isLiked = !r.isLiked;
        return { ...r, isLiked, likes: isLiked ? (r.likes || 0) + 1 : (r.likes || 1) - 1 };
      }
      return r;
    }));
  };

  const handleToggleSpoiler = (id: number | string) => {
    setReviewsList(reviewsList.map(r => {
      if (r.id === id) {
        return { ...r, revealed: !r.revealed };
      }
      return r;
    }));
  };

  const handleShare = () => {
    const shareSlug = details?.slug || animeId;
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/anime/${encodeURIComponent(String(shareSlug))}`
        : '';
    if (shareUrl) {
      navigator.clipboard?.writeText(shareUrl);
    }
    showToast('Link copied to clipboard!');
  };

  const isBookmarked = watchlist.map(Number).includes(numericAnimeId);

  const handleToggleWatched = () => {
    const nextWatched = !isWatched;
    setIsWatched(nextWatched);
    try {
      const watched: unknown[] = JSON.parse(localStorage.getItem('cf_watched_anime_ids') || '[]');
      const idNum = Number(animeId);
      let updated;
      if (nextWatched) {
        updated = Array.from(new Set([...watched, idNum]));
      } else {
        updated = watched.filter((w) => Number(w) !== idNum);
      }
      localStorage.setItem('cf_watched_anime_ids', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    const maxEps = totalEpisodes && totalEpisodes > 0 ? totalEpisodes : (watchProgress?.episode || 1);
    const saved = saveAnimeWatchProgress(animeId, {
      season: watchProgress?.season ?? 1,
      episode: nextWatched ? maxEps : Math.max(0, watchProgress?.episode ?? 0),
      totalEpisodes: totalEpisodes ?? watchProgress?.totalEpisodes ?? null,
      completed: nextWatched,
    });
    if (saved) {
      setWatchProgress(saved);
      if (user?.id) {
        cloudflareApi
          .saveWatchProgress({
            animeId: saved.animeId,
            season: saved.season,
            episode: saved.episode,
            totalEpisodes: saved.totalEpisodes,
            completed: saved.completed,
          })
          .catch(() => {});
      }
    }
    showToast(nextWatched ? 'Marked as Watched!' : 'Marked as uncompleted');
  };

  const getSeasonEpisodeLimit = (seasonNumber: number): number | null => {
    if (isMovie) return 1;
    if (Array.isArray(seasonsArray) && seasonsArray.length > 0) {
      const seasonEntry = seasonsArray[seasonNumber - 1];
      const count = Number(seasonEntry?.episodes || seasonEntry?.episode_count || 0);
      if (Number.isFinite(count) && count > 0) return count;
    }
    const dubSeasonMatch = dubProgress.seasons[seasonNumber - 1];
    if (dubSeasonMatch) {
      const maxFromDub = dubSeasonMatch.languages.reduce((acc, row) => {
        const total = Number((row as { totalEpisodes?: number }).totalEpisodes || 0);
        return total > acc ? total : acc;
      }, 0);
      if (maxFromDub > 0) return maxFromDub;
    }
    return totalEpisodes && totalEpisodes > 0 ? totalEpisodes : null;
  };

  const handleUpdateWatchProgress = async (patch: {
    season?: number;
    episode?: number;
    completed?: boolean;
  }) => {
    const prev = watchProgress || {
      animeId: Number(animeId),
      season: 1,
      episode: 0,
      totalEpisodes: totalEpisodes ?? null,
      completed: false,
      updatedAt: new Date().toISOString(),
    };
    const maxSeasonCount =
      Array.isArray(seasonsArray) && seasonsArray.length > 0
        ? seasonsArray.length
        : Math.max(1, dubProgress.seasons.length);
    const nextSeason = Math.min(maxSeasonCount, Math.max(1, patch.season ?? prev.season));
    const cap = getSeasonEpisodeLimit(nextSeason);
    const nextEpisode = Math.max(0, patch.episode ?? prev.episode);
    const clampedEpisode = cap ? Math.min(cap, nextEpisode) : nextEpisode;
    const autoCompleted =
      patch.completed !== undefined
        ? patch.completed
        : Boolean(cap && clampedEpisode >= cap && nextSeason >= maxSeasonCount);

    const saved = saveAnimeWatchProgress(animeId, {
      season: nextSeason,
      episode: clampedEpisode,
      totalEpisodes: cap ?? prev.totalEpisodes ?? null,
      completed: autoCompleted,
    });
    if (!saved) return;
    setWatchProgress(saved);

    if (autoCompleted !== isWatched) {
      setIsWatched(autoCompleted);
      try {
        const watched: unknown[] = JSON.parse(localStorage.getItem('cf_watched_anime_ids') || '[]');
        const idNum = Number(animeId);
        const updated = autoCompleted
          ? Array.from(new Set([...watched, idNum]))
          : watched.filter((w) => Number(w) !== idNum);
        localStorage.setItem('cf_watched_anime_ids', JSON.stringify(updated));
      } catch {}
    }

    if (user?.id) {
      setIsSavingProgress(true);
      cloudflareApi
        .saveWatchProgress({
          animeId: saved.animeId,
          season: saved.season,
          episode: saved.episode,
          totalEpisodes: saved.totalEpisodes,
          completed: saved.completed,
        })
        .catch(() => {})
        .finally(() => setIsSavingProgress(false));
    }

    showToast(`Saved progress: S${saved.season} • Ep ${saved.episode}${cap ? `/${cap}` : ''}`);
  };

  const handleToggleSpoilerProtection = () => {
    const next = !spoilerProtection;
    setSpoilerProtection(next);
    setSpoilerProtectionEnabled(next);
    setIsSynopsisRevealed(false);
    setReviewsList((prev) =>
      prev.map((r) => (r.spoilers ? { ...r, revealed: !next } : r))
    );
    showToast(
      next
        ? 'Spoiler Protection enabled — plot synopsis & spoiler messages blurred'
        : 'Spoiler Protection turned off'
    );
  };

  // Anime properties and fallbacks
  const title = details?.title || 'Anime Details';
  const coverImage = details?.cover_image || '/logo.png';
  const posterImage = coverImage;
  const rawSynopsis = details?.synopsis || details?.description || 'Follow this thrilling dubbed adventure packed with high-stakes action, supernatural twists, and emotional character arcs, officially licensed with regional Indian audio tracks.';
  const synopsis = rawSynopsis.replace(/Imported via standardized CSV format\.?/gi, '').trim() || 'Follow this thrilling dubbed adventure packed with high-stakes action, supernatural twists, and emotional character arcs, officially licensed with regional Indian audio tracks.';
  const releaseYear = details?.releaseYear || details?.year || 2024;
  const type = details?.type || 'TV Series';
  const isMovie = String(type).toLowerCase().includes('movie');
  const status = resolveCanonicalAnimeStatus(details);
  const studio = details?.studio || 'Animation Studio';
  const verifiedAudioSpec = typeof details?.audio_spec === 'string' && details.audio_spec.trim() ? details.audio_spec.trim() : '';
  const movieDuration = typeof details?.duration === 'string' && details.duration.trim() ? details.duration.trim() : '';
  const dubProgress = useMemo(
    () => buildDubProgressBreakdown((details as Record<string, unknown> | null) ?? null),
    [details]
  );
  const activeDubSeason =
    dubProgress.seasons[selectedDubSeasonIdx] || dubProgress.overall;
  
  // Exclude non-Indian languages from dub badges (strictly exclude Japanese, English, Romaji, etc.)
  const rawLanguages = details?.languages ? details.languages.split(',').map((l: string) => l.trim()) : ['Hindi', 'Tamil', 'Telugu', 'Malayalam'];
  const languages = rawLanguages.filter(
    (l: string) => !['japanese', 'english', 'romaji', 'korean', 'chinese', 'jap', 'jpn', 'eng'].includes(l.trim().toLowerCase())
  );
  const displayLanguages = languages.length > 0 ? languages : ['Hindi', 'Tamil', 'Telugu'];
  
  useEffect(() => {
    if (displayLanguages.length > 0 && (!reviewLang || !displayLanguages.some((l: string) => reviewLang.includes(l)))) {
      setReviewLang(`${displayLanguages[0]} Dub`);
    }
  }, [details]);
  
  const genres = details?.genre ? details.genre.split(',').map((g: string) => g.trim()) : ['Action', 'Fantasy', 'Adventure', 'Supernatural'];

  // Helper for official OTT URLs — never fabricates unrelated series URLs
  const getPlatformUrl = (platformName: string, animeTitle: string, directUrl?: string, languages?: string[]) => {
    const canonicalName = normalizeCanonicalOttName(platformName) || platformName;
    const p = canonicalName.toLowerCase();
    const cleanedDirect = (directUrl || details?.streamUrl || '').trim();
    const hasVerifiedDirectUrl = /^https?:\/\//i.test(cleanedDirect);
    let webUrl = hasVerifiedDirectUrl ? cleanedDirect : '';

    if (!webUrl) {
      const encodedTitle = encodeURIComponent(animeTitle || '');
      if (p.includes('crunchyroll')) {
        webUrl = `https://www.crunchyroll.com/search?q=${encodedTitle}`;
      } else if (p.includes('netflix')) {
        webUrl = `https://www.netflix.com/search?q=${encodedTitle}`;
      } else if (p.includes('jiohotstar') || p.includes('hotstar') || p.includes('jiocinema')) {
        webUrl = `https://www.hotstar.com/in/explore?search_query=${encodedTitle}`;
      } else if (p.includes('prime') || p.includes('anime times')) {
        webUrl = `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodedTitle}`;
      } else if (p.includes('muse')) {
        webUrl = `https://www.youtube.com/@MuseIndia/search?query=${encodedTitle}`;
      } else if (p.includes('ani-one')) {
        webUrl = `https://www.youtube.com/@AniOneIndia/search?query=${encodedTitle}`;
      } else if (p.includes('youtube')) {
        webUrl = `https://www.youtube.com/results?search_query=${encodedTitle}`;
      } else if (p.includes('sony')) {
        webUrl = `https://www.sonyliv.com/search?q=${encodedTitle}`;
      } else if (p.includes('zee5')) {
        webUrl = `https://www.zee5.com/search?q=${encodedTitle}`;
      }
    }

    return {
      name: canonicalName,
      url: webUrl,
      isDirectUrl: hasVerifiedDirectUrl,
      languages: Array.isArray(languages) ? languages : [],
    };
  };

  const handleOpenPlatform = (platform: { name: string; url: string }) => {
    setIsWatchOptionsOpen(false);
    if (!platform.url) return;

    const ua = navigator.userAgent || navigator.vendor || (window as Window & { opera?: string }).opera || '';
    const isAndroid = /android/i.test(ua);
    const pName = platform.name.toLowerCase();

    if (isAndroid) {
      let packageName = 'com.crunchyroll.crunchyroid';
      if (pName.includes('netflix')) packageName = 'com.netflix.mediaclient';
      else if (pName.includes('jiohotstar') || pName.includes('hotstar')) packageName = 'in.startv.hotstar';
      else if (pName.includes('prime') || pName.includes('anime times')) packageName = 'com.amazon.avod.thirdpartyclient';
      else if (pName.includes('youtube') || pName.includes('muse') || pName.includes('ani-one')) packageName = 'com.google.android.youtube';

      const intentUrl = `intent://${platform.url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=${packageName};end;`;
      try {
        window.location.href = intentUrl;
        return;
      } catch {
        // Fallback to standard HTTPS link
      }
    }

    window.open(platform.url, '_blank', 'noopener,noreferrer');
  };

  // Parse platforms cleanly & canonically — NEVER default to Crunchyroll if unverified
  const rawPlatformsList: string[] = useMemo(() => {
    return normalizeCanonicalOttList({
      platform: details?.platform,
      platforms: details?.platforms,
      platforms_data: details?.platforms_data,
    });
  }, [details?.platform, details?.platforms, details?.platforms_data]);

  const availablePlatforms = (() => {
    let richPlatforms: RichPlatformEntry[] = [];
    try {
      if (details?.platforms_data) {
        richPlatforms = typeof details.platforms_data === 'string' 
          ? JSON.parse(details.platforms_data) 
          : details.platforms_data;
      }
    } catch {}

    return rawPlatformsList.map((pName) => {
      const richMatch = Array.isArray(richPlatforms)
        ? richPlatforms.find((rp) => {
            const rawName = String(rp?.name || rp?.platform || '');
            return (normalizeCanonicalOttName(rawName) || rawName).toLowerCase() === pName.toLowerCase();
          })
        : undefined;
      const normalizedDetailsPlatform = normalizeCanonicalOttName(String(details?.platform || ''));
      const directUrl =
        richMatch?.url ||
        (normalizedDetailsPlatform.toLowerCase() === pName.toLowerCase() ? details?.watch_url : '');
      const partnerLangs = Array.isArray(richMatch?.languages) ? richMatch.languages : [];
      return getPlatformUrl(pName, title, directUrl, partnerLangs);
    });
  })();

  // Calculate total episodes across all seasons using reduce (movies should never fabricate "1 Ep")
  const seasonsArray = details?.seasons || details?.mixedEntries || details?.seasonsList || [];
  const rawTotalEpisodes = Array.isArray(seasonsArray) && seasonsArray.length > 0
    ? seasonsArray.reduce((acc: number, season: SeasonEntry) => acc + Number(season.episodes || season.episode_count || 0), 0)
    : (details?.episodes_count || details?.episodes || details?.episode_count || null);
  const totalEpisodes = isMovie ? null : (rawTotalEpisodes ? Number(rawTotalEpisodes) : null);

  const episodesText = isMovie
    ? (movieDuration || null)
    : (totalEpisodes ? `${totalEpisodes} ${totalEpisodes === 1 ? 'Ep' : 'Eps'}` : null);
  const seasonEpisodeSummary = String(details?.season_episode_count || '').trim();
  const officialSourceValidation = validateOfficialSourceUrl(details?.official_source_url, 'Official Source Link');
  const officialSourceHref = officialSourceValidation.ok && officialSourceValidation.url ? officialSourceValidation.url : '';
  const officialSourceLabel = useMemo(() => {
    if (!officialSourceHref) return '';
    try {
      return new URL(officialSourceHref).hostname.replace(/^www\./, '');
    } catch {
      return 'Official Link';
    }
  }, [officialSourceHref]);
  const activeSeason = watchProgress?.season ?? 1;
  const activeEpisode = watchProgress?.episode ?? 0;
  const maxSeasonsAvailable =
    Array.isArray(seasonsArray) && seasonsArray.length > 0
      ? seasonsArray.length
      : Math.max(1, dubProgress.seasons.length);
  const activeSeasonEpisodeCap = getSeasonEpisodeLimit(activeSeason);
  const progressPercent = computeWatchProgressPercent(
    activeEpisode,
    activeSeasonEpisodeCap ?? totalEpisodes ?? watchProgress?.totalEpisodes ?? null,
    isWatched || Boolean(watchProgress?.completed)
  );

  // Honest Last verified date string (never invents dates)
  const formattedLastVerified = useMemo(() => {
    const raw = details?.last_verified_at || details?.updated_at;
    if (!raw || typeof raw !== 'string') return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [details?.last_verified_at, details?.updated_at]);

  // Franchise watch order entries (sorted chronologically / by sequence_number)
  const franchiseEntries: FranchiseEntry[] = useMemo(() => {
    if (!Array.isArray(details?.franchise_entries) || details.franchise_entries.length === 0) {
      return [];
    }
    return [...details.franchise_entries].sort((a, b) => {
      const seqA = Number(a.sequence_number ?? 9999);
      const seqB = Number(b.sequence_number ?? 9999);
      if (seqA !== seqB) return seqA - seqB;
      return Number(a.year ?? 9999) - Number(b.year ?? 9999);
    });
  }, [details?.franchise_entries]);

  const handleOpenFranchiseEntry = (entry: FranchiseEntry) => {
    if (Number(entry.id) === numericAnimeId) return;
    if (_onSelectAnime) {
      _onSelectAnime({
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        cover_image: entry.cover_image,
        year: entry.year ?? undefined,
        type: entry.type,
        languages: entry.languages || '',
      } as Anime);
      return;
    }
    if (typeof window !== 'undefined') {
      const targetPath = `/anime/${encodeURIComponent(String(entry.slug || entry.id))}`;
      window.history.pushState({}, '', targetPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // FAQ Items
  const faqItems = [
    {
      q: `Where can I legally watch ${title} dubbed in Hindi, Tamil, and Telugu?`,
      a: `${title} is officially available for streaming in India on licensed platforms like ${availablePlatforms.map(p => p.name).join(', ')}. You can select regional voice tracks inside the player audio settings.`
    },
    {
      q: `Are all episodes of ${title} dubbed in regional Indian languages?`,
      a: `Yes, new episodes simulcast with regional Indian dubs as they are released by official distributors.`
    },
    {
      q: `How can I rate the Indian voice acting quality for ${title}?`,
      a: `Use our Community Dub Reviews section below to rate voice delivery, sync, and translation quality.`
    }
  ];

  const animeJsonLd = useMemo(
    () =>
      buildAnimeJsonLd(
        {
          id: animeId,
          slug: details?.slug,
          title,
          synopsis,
          cover_image: posterImage,
          languages: displayLanguages.join(', '),
          type,
          year: releaseYear,
          rating: currentRating ?? details?.rating,
          studio,
          genres: genres.join(', '),
          episodes_count: totalEpisodes,
          popularity: upvotes,
        },
        typeof window !== 'undefined' ? window.location.origin : undefined,
        String(details?.slug || animeId)
      ),
    [
      animeId,
      currentRating,
      details?.rating,
      details?.slug,
      displayLanguages,
      genres,
      posterImage,
      releaseYear,
      studio,
      synopsis,
      title,
      totalEpisodes,
      type,
      upvotes,
    ]
  );

  if (loading && !details) {
    return <DetailModalSkeleton />;
  }

  if (!loading && notFound) {
    return (
      <div className="relative w-full min-h-[70vh] bg-[#0B0A10] text-[#F4F3FA] font-sans flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md w-full rounded-[12px] bg-[#12141E] border border-[#292B39] p-8 space-y-4">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-[#F87171]/15 border border-[#F87171]/30 text-[#F87171] text-xs font-bold uppercase tracking-wider">
            404 • Not Found
          </div>
          <h1 className="text-2xl font-extrabold text-[#F4F3FA]">Anime Not Found</h1>
          <p className="text-sm text-[#A1A5B5] leading-relaxed">
            We couldn&apos;t find a published anime matching <span className="text-[#F4F3FA] font-semibold">&ldquo;{String(animeId)}&rdquo;</span> in the AniDub India catalog.
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="w-full min-h-[44px] py-2.5 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-sm font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-[#0B0A10] text-[#F4F3FA] font-sans pb-32 overflow-x-clip selection:bg-[#B49AF8] selection:text-[#0B0A10]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: animeJsonLd }}
      />

      {/* Top Navigation Bar */}
      <div className="relative z-20 px-4 sm:px-6 py-3.5 flex items-center justify-between max-w-4xl mx-auto">
        <button
          type="button"
          onClick={handleBack}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[#12141E] hover:bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/50 text-[#F4F3FA] flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
          title="Back to Catalog"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {onCompareAnime && details && (
            <button
              type="button"
              onClick={() => onCompareAnime(details)}
              className="min-h-[44px] px-3.5 py-2 rounded-[12px] bg-[#12141E] hover:bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/50 text-xs font-semibold text-[#F4F3FA] inline-flex items-center gap-1.5 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
              title="Compare with another anime"
            >
              <Scale className="w-3.5 h-3.5 text-[#CBB6FF]" />
              <span className="hidden sm:inline">Compare</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleBack}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[#12141E] hover:bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/50 text-[#F4F3FA] flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-[12px] bg-[#12141E] border border-[#292B39] shadow-2xl flex items-center gap-2.5 text-[#F4F3FA] text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#B49AF8] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MAIN CONTENT CONTAINER */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 space-y-5">

        {/* 1. COMPACT CINEMATIC HEADER (ECLIPSE DARK) */}
        <header className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            {/* Strict 2:3 Poster */}
            <div className="w-32 sm:w-36 aspect-[2/3] rounded-[12px] overflow-hidden border border-[#292B39] bg-[#191C29] shrink-0">
              <Image
                src={posterImage}
                alt={title}
                priority
                sizes="(max-width: 640px) 128px, 144px"
                width={144}
                height={216}
                quality={80}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Header Metadata & Touch-Friendly Action Row */}
            <div className="flex-1 min-w-0 w-full text-center sm:text-left space-y-3">
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#F4F3FA] leading-tight break-words">
                  {title}
                </h1>

                <div className="flex items-center justify-center sm:justify-start flex-wrap gap-2 text-xs font-semibold text-[#A1A5B5]">
                  {currentRating !== null && currentRating > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#191C29] border border-[#292B39] text-[#F9C876] font-bold">
                      <Star className="w-3.5 h-3.5 fill-[#F9C876] text-[#F9C876]" />
                      <span>{currentRating.toFixed(1)}</span>
                    </span>
                  )}
                  {releaseYear && (
                    <span className="px-2 py-0.5 rounded-md bg-[#191C29] border border-[#292B39] text-[#F4F3FA]">
                      {releaseYear}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-[#191C29] border border-[#292B39] text-[#CBB6FF]">
                    {type}
                  </span>
                  {episodesText && (
                    <span className="px-2 py-0.5 rounded-md bg-[#191C29] border border-[#292B39] text-[#A1A5B5]">
                      {episodesText}
                    </span>
                  )}
                  {status && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-semibold ${
                        status === 'Airing'
                          ? 'bg-[#34D399]/10 border-[#34D399]/30 text-[#34D399]'
                          : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          status === 'Airing' ? 'bg-[#34D399]' : 'bg-[#A1A5B5]'
                        }`}
                      />
                      <span>{status}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Clean 44px Action Row: Save/Bookmark, Follow, Share, Report wrong info */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => numericAnimeId > 0 && onToggleWatchlist(numericAnimeId)}
                  aria-pressed={isBookmarked}
                  aria-label={isBookmarked ? `Remove ${title} from library` : `Save ${title} to library`}
                  className={`min-h-[44px] px-4 py-2 rounded-[12px] text-xs font-bold inline-flex items-center justify-center gap-2 border transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                    isBookmarked
                      ? 'bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] border-[#B49AF8]'
                      : 'bg-[#191C29] hover:border-[#B49AF8]/60 text-[#F4F3FA] border-[#292B39]'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 shrink-0 ${isBookmarked ? 'fill-[#0B0A10]' : ''}`} />
                  <span>{isBookmarked ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={isTogglingFollow}
                  aria-pressed={isFollowing}
                  aria-label={isFollowing ? `Unfollow dub updates for ${title}` : `Follow dub updates for ${title}`}
                  className={`min-h-[44px] px-4 py-2 rounded-[12px] text-xs font-bold inline-flex items-center justify-center gap-2 border transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                    isFollowing
                      ? 'bg-[#B49AF8]/15 border-[#B49AF8] text-[#CBB6FF]'
                      : 'bg-[#191C29] hover:border-[#B49AF8]/60 text-[#F4F3FA] border-[#292B39]'
                  }`}
                >
                  {isFollowing ? (
                    <BellRing className="w-4 h-4 shrink-0 text-[#B49AF8]" />
                  ) : (
                    <Bell className="w-4 h-4 shrink-0 text-[#A1A5B5]" />
                  )}
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  aria-label={`Share ${title}`}
                  className="min-h-[44px] px-3.5 py-2 rounded-[12px] bg-[#191C29] hover:border-[#B49AF8]/60 border border-[#292B39] text-xs font-semibold text-[#F4F3FA] inline-flex items-center justify-center gap-2 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                >
                  <Share2 className="w-4 h-4 shrink-0 text-[#A1A5B5]" />
                  <span>Share</span>
                </button>

                <button
                  type="button"
                  onClick={() => openReportForField('OTT Link')}
                  aria-label={`Report wrong info for ${title}`}
                  className="min-h-[44px] px-3.5 py-2 rounded-[12px] bg-[#191C29] hover:border-[#F87171]/50 border border-[#292B39] text-xs font-semibold text-[#A1A5B5] hover:text-[#F87171] inline-flex items-center justify-center gap-2 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                >
                  <Flag className="w-4 h-4 shrink-0" />
                  <span>Report wrong info</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* 2. PROMINENT "WHERE TO WATCH" CARD (TOP PRIORITY, IMMEDIATELY BELOW HEADER) */}
        <section
          aria-label="Where to Watch"
          data-testid="where-to-watch-card"
          className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[#B49AF8] text-xs font-bold tracking-wider uppercase">
                Where to Watch (India)
              </h2>
              <p className="text-xs text-[#A1A5B5] mt-0.5">
                Official licensed Indian OTT streaming links
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#191C29] border border-[#292B39] text-[11px] text-[#A1A5B5]">
              <Clock className="w-3.5 h-3.5 text-[#B49AF8]" />
              <span>
                Last verified:{' '}
                <strong className="text-[#F4F3FA] font-semibold">
                  {formattedLastVerified || 'Not verified'}
                </strong>
              </span>
            </div>
          </div>

          {availablePlatforms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availablePlatforms.map((plat) => (
                <div
                  key={`where_to_watch_${plat.name}`}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-[12px] bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/60 transition-colors duration-180 motion-reduce:transition-none"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#F4F3FA] truncate flex items-center gap-2">
                      <span className="truncate">{plat.name}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#34D399]/15 border border-[#34D399]/30 text-[10px] font-bold text-[#34D399] shrink-0">
                        India
                      </span>
                    </div>
                    <div className="text-[11px] text-[#A1A5B5] mt-0.5 truncate">
                      {plat.isDirectUrl ? 'Direct verified link' : 'Official catalog search'}
                      {formattedLastVerified ? ` • ${formattedLastVerified}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenPlatform(plat)}
                    className="min-h-[40px] px-3.5 py-2 rounded-[10px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-[#0B0A10]" />
                    <span>Watch</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-[12px] bg-[#191C29] border border-[#292B39] text-xs text-[#A1A5B5] flex flex-wrap items-center justify-between gap-3">
              <span>
                Official Indian OTT availability: <strong className="text-[#F4F3FA]">Not verified</strong>.
              </span>
              <button
                type="button"
                onClick={() => openReportForField('OTT Link')}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 text-[#B49AF8] font-semibold transition-colors duration-180 cursor-pointer"
              >
                Suggest official link
              </button>
            </div>
          )}
        </section>

        {/* 3. CLEAN ECLIPSE TABS (Overview, Seasons & Dubs, Watch Progress, Reviews) */}
        <div
          role="tablist"
          aria-label="Anime detail sections"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1.5 rounded-[12px] bg-[#12141E] border border-[#292B39]"
        >
          {[
            { id: 'overview' as const, label: 'Overview' },
            { id: 'dubs' as const, label: 'Seasons & Dubs' },
            { id: 'progress' as const, label: 'Watch Progress' },
            { id: 'reviews' as const, label: `Reviews (${reviewsList.length})` },
          ].map((tabItem) => {
            const active = activeDetailTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveDetailTab(tabItem.id)}
                className={`flex-1 min-h-[44px] px-3.5 py-2 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                  active
                    ? 'bg-[#B49AF8] text-[#0B0A10] font-bold'
                    : 'text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29]'
                }`}
              >
                {tabItem.label}
              </button>
            );
          })}
        </div>

        {/* TAB PANEL: OVERVIEW */}
        {activeDetailTab === 'overview' && (
          <div id="detail-section-overview" role="tabpanel" className="space-y-5">
            {/* Synopsis + Genres */}
            <section className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[#B49AF8] text-xs font-bold tracking-wider uppercase">
                  Overview &amp; Synopsis
                </h2>
                <button
                  type="button"
                  onClick={handleToggleSpoilerProtection}
                  aria-pressed={spoilerProtection}
                  aria-label="Toggle spoiler protection"
                  className={`min-h-[40px] px-3 py-1.5 rounded-[10px] text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                    spoilerProtection
                      ? 'bg-[#F9C876]/15 border-[#F9C876]/40 text-[#F9C876]'
                      : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
                  }`}
                >
                  {spoilerProtection ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>Spoiler Shield: {spoilerProtection ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="relative">
                <p
                  className={`text-sm text-[#F4F3FA]/90 leading-relaxed transition-all duration-180 motion-reduce:transition-none ${
                    spoilerProtection && !isSynopsisRevealed
                      ? 'blur-md select-none opacity-60 pointer-events-none'
                      : ''
                  }`}
                >
                  {isSynopsisExpanded || synopsis.length <= 280
                    ? synopsis
                    : `${synopsis.slice(0, 280)}...`}
                  {synopsis.length > 280 && (!spoilerProtection || isSynopsisRevealed) && (
                    <button
                      type="button"
                      onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
                      className="text-xs font-bold text-[#B49AF8] hover:text-[#CBB6FF] ml-2 cursor-pointer transition-colors"
                    >
                      {isSynopsisExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </p>

                {spoilerProtection && !isSynopsisRevealed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsSynopsisRevealed(true)}
                      aria-label="Reveal blurred synopsis"
                      className="min-h-[40px] px-4 py-2 rounded-[10px] bg-[#191C29] border border-[#F9C876]/50 text-[#F9C876] hover:text-[#F4F3FA] text-xs font-bold inline-flex items-center gap-2 shadow-xl cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Reveal Synopsis</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#292B39]">
                <span className="text-[#A1A5B5] text-[11px] font-bold tracking-wider uppercase mr-1">
                  Genres:
                </span>
                {genres.map((g: string, i: number) => (
                  <span
                    key={`detail_genre_${g}_${i}`}
                    className="px-2.5 py-1 rounded-lg bg-[#191C29] border border-[#292B39] text-[#F4F3FA] font-medium text-xs"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </section>

            {/* Stream Specs */}
            <section className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5">
              <h2 className="text-[#B49AF8] text-xs font-bold tracking-wider uppercase mb-3.5">
                Stream Specs
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <span className="text-[10px] text-[#A1A5B5] font-bold block uppercase tracking-wider mb-1">
                    PLATFORMS
                  </span>
                  <span className="text-xs font-bold text-[#F4F3FA] flex items-center gap-1.5 truncate">
                    <Play className="w-3.5 h-3.5 text-[#B49AF8] fill-[#B49AF8] shrink-0" />
                    <span className="truncate">
                      {availablePlatforms.length > 0
                        ? availablePlatforms.map((p) => p.name).join(', ')
                        : 'Not verified'}
                    </span>
                  </span>
                </div>
                {verifiedAudioSpec && (
                  <div className="min-w-0">
                    <span className="text-[10px] text-[#A1A5B5] font-bold block uppercase tracking-wider mb-1">
                      AUDIO TRACK
                    </span>
                    <span className="text-xs font-bold text-[#34D399] flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{verifiedAudioSpec}</span>
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-[10px] text-[#A1A5B5] font-bold block uppercase tracking-wider mb-1">
                    STUDIO
                  </span>
                  <span className="text-xs font-bold text-[#F4F3FA] truncate block">{studio}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[#A1A5B5] font-bold block uppercase tracking-wider mb-1">
                    {isMovie ? 'FORMAT' : <>SEASONS &amp; EPISODES</>}
                  </span>
                  <span className="text-xs font-bold text-[#F4F3FA] truncate block">
                    {isMovie
                      ? movieDuration
                        ? `Movie • ${movieDuration}`
                        : 'Movie'
                      : seasonEpisodeSummary || episodesText || (status === 'Airing' ? 'Ongoing' : 'Not verified')}
                  </span>
                </div>
                {officialSourceHref && (
                  <div className="min-w-0">
                    <span className="text-[10px] text-[#A1A5B5] font-bold block uppercase tracking-wider mb-1">
                      OFFICIAL SOURCE
                    </span>
                    <a
                      href={officialSourceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#CBB6FF] hover:text-[#F4F3FA] inline-flex items-center gap-1 max-w-full truncate underline underline-offset-2"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                      <span className="truncate">{officialSourceLabel || 'Official Site'}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </section>

            {/* Franchise Watch Order (shown when anime belongs to a franchise) */}
            {franchiseEntries.length > 0 && (
              <section
                aria-label="Franchise Watch Order"
                data-testid="franchise-watch-order"
                className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#B49AF8]" />
                    <h2 className="text-[#B49AF8] text-xs font-bold tracking-wider uppercase">
                      Franchise Watch Order
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold text-[#A1A5B5]">
                    {franchiseEntries.length} {franchiseEntries.length === 1 ? 'Entry' : 'Entries'}
                  </span>
                </div>

                <ol className="space-y-2">
                  {franchiseEntries.map((entry, idx) => {
                    const isCurrent = Number(entry.id) === numericAnimeId;
                    return (
                      <li key={`franchise_entry_${entry.id}`}>
                        <button
                          type="button"
                          onClick={() => handleOpenFranchiseEntry(entry)}
                          disabled={isCurrent}
                          className={`w-full min-h-[56px] p-3 rounded-[12px] border text-left flex items-center gap-3 transition-colors duration-180 motion-reduce:transition-none ${
                            isCurrent
                              ? 'bg-[#B49AF8]/12 border-[#B49AF8]/60 cursor-default'
                              : 'bg-[#191C29] border-[#292B39] hover:border-[#B49AF8]/50 cursor-pointer'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 ${
                              isCurrent
                                ? 'bg-[#B49AF8] text-[#0B0A10]'
                                : 'bg-[#12141E] border border-[#292B39] text-[#A1A5B5]'
                            }`}
                          >
                            {entry.sequence_number ?? idx + 1}
                          </span>
                          <div className="w-9 aspect-[2/3] rounded-md overflow-hidden bg-[#12141E] border border-[#292B39] shrink-0">
                            <Image
                              src={entry.cover_image || '/logo.png'}
                              alt={entry.title}
                              loading="lazy"
                              width={36}
                              height={54}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-bold text-[#F4F3FA] truncate">
                              {entry.title}
                            </div>
                            <div className="text-[11px] text-[#A1A5B5] flex flex-wrap items-center gap-1.5 mt-0.5">
                              {entry.relation_type && (
                                <span className="text-[#CBB6FF] font-semibold">{entry.relation_type}</span>
                              )}
                              {entry.year && <span>• {entry.year}</span>}
                              {entry.type && <span>• {entry.type}</span>}
                            </div>
                          </div>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-md bg-[#B49AF8] text-[#0B0A10] text-[10px] font-bold shrink-0">
                              Viewing
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* Dual Rating & FAQ */}
            <DualRating
              globalRating={currentRating ?? 0}
              initialUserRating={userRating}
              communityScore={communityRating || (currentRating ?? 0)}
              totalVotes={communityVotes}
              onRate={handleCommunityRate}
              className="w-full"
            />

            <section className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5">
              <h2 className="text-[#B49AF8] text-xs font-bold tracking-wider uppercase mb-3">
                Frequently Asked Questions
              </h2>
              <div className="divide-y divide-[#292B39]">
                {faqItems.map((item, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div key={`anime_faq_${idx}`} className="py-2">
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full min-h-[44px] py-1.5 flex items-center justify-between text-left text-xs sm:text-sm font-semibold text-[#F4F3FA] hover:text-[#B49AF8] transition-colors duration-180 cursor-pointer"
                      >
                        <span>{item.q}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-[#B49AF8] shrink-0 ml-2" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#A1A5B5] shrink-0 ml-2" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="pt-1 pb-2 text-xs text-[#A1A5B5] leading-relaxed">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB PANEL: SEASONS & DUBS (Season × Language × OTT Matrix) */}
        {activeDetailTab === 'dubs' && (
          <section
            id="detail-section-dubs"
            role="tabpanel"
            aria-label="Indian Dub Availability and Progress"
            className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[#B49AF8] text-xs font-bold tracking-wider uppercase">
                  Season × Language × OTT Matrix
                </h2>
                <p className="text-xs text-[#A1A5B5] mt-0.5">
                  Verified Indian dub episode counts across official platforms
                </p>
              </div>

              {dubProgress.hasMultipleSeasons && (
                <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Dub progress seasons">
                  {dubProgress.seasons.map((season, idx) => {
                    const isActive = idx === selectedDubSeasonIdx;
                    return (
                      <button
                        key={season.seasonKey}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setSelectedDubSeasonIdx(idx)}
                        className={`min-h-[40px] px-3 py-1.5 rounded-[10px] text-xs font-bold border transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                          isActive
                            ? 'bg-[#B49AF8] border-[#B49AF8] text-[#0B0A10]'
                            : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
                        }`}
                      >
                        {season.seasonLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clean Season × Language × OTT Rows */}
            <div className="space-y-3" data-testid="dub-progress-bars">
              {activeDubSeason.languages.map((row) => {
                const rowOttNames = availablePlatforms
                  .filter(
                    (p) =>
                      p.languages.length === 0 ||
                      p.languages.some((l) => l.toLowerCase().includes(row.language.toLowerCase()))
                  )
                  .map((p) => p.name);
                const honestOttLabel =
                  row.status === 'unavailable'
                    ? '—'
                    : rowOttNames.length > 0
                      ? rowOttNames.join(', ')
                      : 'Not verified';
                const honestCountBadge =
                  row.status === 'available' && !/\d/.test(row.badgeText)
                    ? 'Count not verified'
                    : row.badgeText;

                const barColorClass =
                  row.status === 'complete'
                    ? 'bg-[#34D399]'
                    : row.status === 'partial'
                      ? 'bg-[#F9C876]'
                      : row.status === 'available'
                        ? 'bg-[#34D399]/75'
                        : 'bg-[#292B39]';

                const badgeColorClass =
                  row.status === 'complete'
                    ? 'bg-[#34D399]/15 border-[#34D399]/40 text-[#34D399]'
                    : row.status === 'partial'
                      ? 'bg-[#F9C876]/15 border-[#F9C876]/40 text-[#F9C876]'
                      : row.status === 'available'
                        ? 'bg-[#191C29] border-[#292B39] text-[#CBB6FF]'
                        : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5]';

                return (
                  <div
                    key={`dub_bar_${activeDubSeason.seasonKey}_${row.language}`}
                    className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            row.status === 'complete' || row.status === 'available'
                              ? 'bg-[#34D399]'
                              : row.status === 'partial'
                                ? 'bg-[#F9C876]'
                                : 'bg-[#292B39]'
                          }`}
                        />
                        <span
                          className={`font-bold ${
                            row.status === 'unavailable' ? 'text-[#A1A5B5]' : 'text-[#F4F3FA]'
                          }`}
                        >
                          {row.language}
                        </span>
                        <span className="text-[11px] text-[#A1A5B5] truncate">
                          • {honestOttLabel}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border shrink-0 tabular-nums ${badgeColorClass}`}
                      >
                        {honestCountBadge}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[#12141E] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-180 motion-reduce:transition-none ${barColorClass}`}
                        style={{ width: `${row.status === 'unavailable' ? 0 : row.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#292B39] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#A1A5B5]">Spot an outdated dub count or missing language?</span>
              <button
                type="button"
                onClick={() => openReportForField('Dub Language')}
                className="min-h-[38px] px-3 py-1.5 rounded-[10px] bg-[#191C29] border border-[#292B39] hover:border-[#F87171]/50 text-[#A1A5B5] hover:text-[#F87171] font-semibold transition-colors duration-180 cursor-pointer"
              >
                Report dub info
              </button>
            </div>
          </section>
        )}

        {/* TAB PANEL: WATCH PROGRESS */}
        {activeDetailTab === 'progress' && (
          <section
            id="detail-section-progress"
            role="tabpanel"
            aria-label="Watch Progress Tracker"
            className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#B49AF8]">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#B49AF8]">
                    Season-Wise Watch Progress
                  </h2>
                  <p className="text-xs text-[#A1A5B5] mt-0.5 tabular-nums">
                    Season {activeSeason} • Episode {activeEpisode}
                    {activeSeasonEpisodeCap ? ` / ${activeSeasonEpisodeCap}` : ''} ({progressPercent}%)
                    {isSavingProgress ? ' • Syncing…' : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleWatched}
                aria-pressed={isWatched}
                aria-label={isWatched ? 'Mark series as unwatched' : 'Mark series as completed'}
                className={`min-h-[44px] px-4 py-2 rounded-[12px] text-xs font-bold border inline-flex items-center gap-2 transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                  isWatched
                    ? 'bg-[#34D399]/15 border-[#34D399]/40 text-[#34D399]'
                    : 'bg-[#191C29] border-[#292B39] text-[#F4F3FA] hover:border-[#B49AF8]/60'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isWatched ? 'Completed' : 'Mark Completed'}</span>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-[#191C29] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#B49AF8] transition-all duration-180 motion-reduce:transition-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Season & Episode Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-[12px] bg-[#191C29] border border-[#292B39] px-4 py-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5] block">
                    Season
                  </span>
                  <span className="text-[11px] text-[#A1A5B5] tabular-nums">
                    Max {maxSeasonsAvailable}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={activeSeason <= 1}
                    onClick={() =>
                      handleUpdateWatchProgress({
                        season: Math.max(1, activeSeason - 1),
                        episode: 0,
                      })
                    }
                    aria-label="Decrease season"
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 disabled:opacity-40 flex items-center justify-center text-[#F4F3FA] transition-colors duration-180 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="min-w-[2.5rem] text-center text-sm font-extrabold text-[#F4F3FA] tabular-nums">
                    S{activeSeason}
                  </span>
                  <button
                    type="button"
                    disabled={activeSeason >= maxSeasonsAvailable}
                    onClick={() =>
                      handleUpdateWatchProgress({
                        season: Math.min(maxSeasonsAvailable, activeSeason + 1),
                        episode: 0,
                      })
                    }
                    aria-label="Increase season"
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 disabled:opacity-40 flex items-center justify-center text-[#F4F3FA] transition-colors duration-180 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-[12px] bg-[#191C29] border border-[#292B39] px-4 py-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5] block">
                    Episode
                  </span>
                  <span className="text-[11px] text-[#A1A5B5] tabular-nums">
                    {activeSeasonEpisodeCap ? `Limit ${activeSeasonEpisodeCap} eps` : 'No episode limit set'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={activeEpisode <= 0}
                    onClick={() =>
                      handleUpdateWatchProgress({
                        episode: Math.max(0, activeEpisode - 1),
                        completed: false,
                      })
                    }
                    aria-label="Previous episode"
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 disabled:opacity-40 flex items-center justify-center text-[#F4F3FA] transition-colors duration-180 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="min-w-[3.5rem] text-center text-sm font-extrabold text-[#F4F3FA] tabular-nums">
                    Ep {activeEpisode}
                  </span>
                  <button
                    type="button"
                    disabled={Boolean(activeSeasonEpisodeCap && activeEpisode >= activeSeasonEpisodeCap)}
                    onClick={() => handleUpdateWatchProgress({ episode: activeEpisode + 1 })}
                    aria-label="Next watched episode"
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[#B49AF8] hover:bg-[#CBB6FF] disabled:opacity-40 flex items-center justify-center text-[#0B0A10] transition-colors duration-180 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB PANEL: REVIEWS */}
        {activeDetailTab === 'reviews' && (
          <section
            id="detail-section-reviews"
            role="tabpanel"
            className="bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 sm:p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#292B39]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#B49AF8]">
                  <Star className="w-4 h-4 fill-[#B49AF8]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#F4F3FA]">
                    Community Dub Reviews
                  </h2>
                  <p className="text-xs text-[#A1A5B5]">
                    Language-specific ratings on voice acting, sync &amp; script localization
                  </p>
                </div>
              </div>
              <span className="bg-[#191C29] border border-[#292B39] text-[#CBB6FF] text-xs font-bold px-3 py-1 rounded-lg">
                {reviewsList.length} {reviewsList.length === 1 ? 'Review' : 'Reviews'}
              </span>
            </div>

            {/* Review Submission Form */}
            <form onSubmit={handleAddReview} className="space-y-4 bg-[#191C29] border border-[#292B39] rounded-[12px] p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F4F3FA] font-semibold">Rate Dubbing Quality</span>
                <span className="text-[#F9C876] font-bold flex items-center gap-1 bg-[#12141E] border border-[#292B39] px-2.5 py-1 rounded-lg tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-[#F9C876] text-[#F9C876]" />
                  <span>{reviewRating.toFixed(1)} / 10.0</span>
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={reviewRating}
                onChange={(e) => setReviewRating(parseFloat(e.target.value))}
                className="w-full accent-[#B49AF8] cursor-pointer h-1.5 bg-[#12141E] rounded-lg"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <select
                  value={reviewLang}
                  onChange={(e) => setReviewLang(e.target.value)}
                  className="w-full h-[44px] bg-[#12141E] border border-[#292B39] rounded-[12px] px-3.5 text-xs text-[#F4F3FA] focus:outline-none focus:border-[#B49AF8] cursor-pointer"
                >
                  {displayLanguages.map((lang: string, idx: number) => (
                    <option key={`review_opt_${lang}_${idx}`} value={`${lang} Dub`}>
                      {lang} Dub
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-start sm:justify-end">
                  <label className="flex items-center gap-2 text-xs text-[#A1A5B5] cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={hasSpoilers}
                      onChange={(e) => setHasSpoilers(e.target.checked)}
                      className="accent-[#B49AF8] rounded w-4 h-4"
                    />
                    <span>Contains spoilers?</span>
                  </label>
                </div>
              </div>

              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share thoughts on voice acting, audio sync, and regional dialogue..."
                className="w-full bg-[#12141E] border border-[#292B39] rounded-[12px] p-3.5 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] focus:outline-none focus:border-[#B49AF8] resize-none"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2.5 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors duration-180 motion-reduce:transition-none"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Review</span>
                </button>
              </div>
            </form>

            {/* Reviews List */}
            <div className="space-y-3">
              {reviewsList.length === 0 ? (
                <EmptyState
                  title="No dub reviews yet"
                  description="Be the first to review the regional voice acting and audio quality for this title."
                  className="bg-[#191C29]"
                />
              ) : (
                reviewsList.map((review, idx) => (
                  <div
                    key={`review_${review.id}_${idx}`}
                    className="space-y-2.5 text-xs p-4 rounded-[12px] bg-[#191C29] border border-[#292B39]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#F4F3FA]">{review.author}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#12141E] border border-[#292B39] text-[#CBB6FF] font-semibold">
                          {review.language}
                        </span>
                        {review.deliveryStatus === 'pending' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#F9C876]/15 border border-[#F9C876]/30 text-[#F9C876] font-semibold">
                            Posting…
                          </span>
                        )}
                        {review.deliveryStatus === 'published' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#34D399]/15 border border-[#34D399]/30 text-[#34D399] font-semibold">
                            Published
                          </span>
                        )}
                        {review.deliveryStatus === 'failed' && (
                          <button
                            type="button"
                            onClick={() => submitReviewToServer(review)}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-[#F87171]/15 border border-[#F87171]/40 text-[#F87171] font-bold hover:bg-[#F87171]/25 cursor-pointer"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>Failed — Retry</span>
                            <RefreshCw className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#F9C876] bg-[#12141E] px-2 py-0.5 rounded-md border border-[#292B39] tabular-nums">
                        <Star className="w-3 h-3 fill-[#F9C876] text-[#F9C876]" />
                        <span>{review.rating}</span>
                      </div>
                    </div>

                    <div className="relative pt-1">
                      {review.spoilers && !review.revealed ? (
                        <div className="py-1 flex items-center justify-between text-xs text-[#A1A5B5]">
                          <span className="flex items-center gap-1.5">
                            <EyeOff className="w-3.5 h-3.5 text-[#F9C876]" />
                            <span>Contains spoilers</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleSpoiler(review.id)}
                            className="min-h-[36px] px-2.5 font-bold text-[#B49AF8] hover:underline cursor-pointer"
                          >
                            Reveal
                          </button>
                        </div>
                      ) : (
                        <p className="text-[#F4F3FA]/90 leading-relaxed font-normal text-xs sm:text-sm">
                          {review.comment}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#A1A5B5] pt-2 border-t border-[#292B39]">
                      <span>{review.date || 'Recent'}</span>
                      <button
                        type="button"
                        onClick={() => handleLikeReview(review.id)}
                        className={`min-h-[36px] px-2 inline-flex items-center gap-1.5 text-xs transition-colors duration-180 cursor-pointer ${
                          review.isLiked
                            ? 'text-[#B49AF8] font-bold'
                            : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{review.likes || 0}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

      </div>

      {/* 4. STICKY ACTION BAR */}
      <div className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-4 sm:right-4 w-auto max-w-[calc(100vw-1.5rem)] sm:max-w-md mx-auto z-50 bg-[#12141E] border border-[#292B39] p-2 gap-1.5 rounded-2xl flex items-center justify-between shadow-2xl overflow-hidden">
        {/* Watch Options Button */}
        <button
          type="button"
          onClick={() => setIsWatchOptionsOpen(true)}
          className="min-h-[40px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] px-3.5 sm:px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-colors duration-150 cursor-pointer text-[11px] sm:text-xs uppercase tracking-wider min-w-0 shrink"
        >
          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-[#0B0A10] shrink-0" />
          <span className="truncate">Watch Options</span>
          <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
        </button>

        {/* Lightweight Icon Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 pr-0.5 shrink-0">
          {/* Upvote Button with count */}
          <button
            type="button"
            onClick={handleVote}
            disabled={isVoting}
            className={`h-10 sm:h-11 px-2.5 sm:px-3 shrink-0 rounded-xl bg-[#191C29] border border-[#292B39] flex items-center justify-center gap-1 transition-colors duration-150 cursor-pointer disabled:opacity-50 ${
              upvotes > 0
                ? 'text-[#F9C876] border-[#F9C876]/40'
                : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
            }`}
            title={`Upvote (${upvotes} votes)`}
            aria-label="Upvote"
          >
            <Flame className={`w-4 h-4 ${upvotes > 0 ? 'fill-[#F9C876] text-[#F9C876]' : ''}`} />
            <span className="text-xs font-bold tabular-nums">
              {upvotes > 0 ? (upvotes >= 1000 ? `${(upvotes / 1000).toFixed(1)}k` : upvotes) : ''}
            </span>
          </button>

          {/* Watchlist Button */}
          <button
            type="button"
            onClick={() => numericAnimeId > 0 && onToggleWatchlist(numericAnimeId)}
            className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl border flex items-center justify-center transition-colors duration-150 cursor-pointer ${
              isBookmarked
                ? 'bg-[#B49AF8] text-[#0B0A10] border-[#CBB6FF]'
                : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
            }`}
            title={isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}
            aria-label="Watchlist"
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-[#0B0A10] text-[#0B0A10]' : ''}`} />
          </button>

          {/* Mark Watched Button */}
          <button
            type="button"
            onClick={handleToggleWatched}
            className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl border flex items-center justify-center transition-colors duration-150 cursor-pointer ${
              isWatched
                ? 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/40'
                : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
            }`}
            title={isWatched ? 'Completed' : 'Mark as Watched'}
            aria-label="Toggle Watched"
          >
            <CheckCircle2 className={`w-4 h-4 ${isWatched ? 'text-[#34D399]' : ''}`} />
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#A1A5B5] hover:text-[#F4F3FA] transition-colors duration-150 cursor-pointer"
            title="Share Anime"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* WATCH OPTIONS MODAL / DRAWER */}
      <AnimatePresence>
        {isWatchOptionsOpen && (
          <div
            onClick={() => setIsWatchOptionsOpen(false)}
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80"
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#12141E] border-t sm:border border-[#292B39] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#292B39]">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 fill-[#B49AF8] text-[#B49AF8]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#F4F3FA]">
                    Official Streaming Platforms
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWatchOptionsOpen(false)}
                  aria-label="Close streaming platforms modal"
                  className="w-9 h-9 rounded-xl bg-[#191C29] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#A1A5B5]">
                Select an official platform to stream {title} with regional Indian dub audio:
              </p>

              <div className="space-y-2 pt-1 max-h-[50vh] overflow-y-auto">
                {availablePlatforms.map((plat, idx) => (
                  <a
                    key={`detail_plat_${plat.name}_${idx}`}
                    href={plat.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenPlatform(plat);
                    }}
                    className="w-full bg-[#191C29] hover:border-[#B49AF8]/60 border border-[#292B39] rounded-xl p-3.5 flex items-center justify-between text-sm font-semibold text-[#F4F3FA] transition-colors duration-150 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#12141E] border border-[#292B39] flex items-center justify-center text-[#B49AF8]">
                        <Play className="w-4 h-4 fill-[#B49AF8] text-[#B49AF8]" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-[#F4F3FA] group-hover:text-[#B49AF8] transition-colors">
                          {plat.name}
                        </div>
                        <div className="text-[11px] text-[#A1A5B5]">
                          {plat.languages && plat.languages.length > 0
                            ? `${plat.languages.join(', ')} Dubs`
                            : 'Regional Indian Dub Audio'}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#A1A5B5] group-hover:text-[#F4F3FA]" />
                  </a>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsWatchOptionsOpen(false)}
                  className="w-full min-h-[42px] py-2.5 rounded-xl bg-[#191C29] hover:border-[#B49AF8]/50 border border-[#292B39] text-xs font-semibold text-[#A1A5B5] hover:text-[#F4F3FA] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REPORT ISSUE MODAL */}
      {isReportOpen && numericAnimeId > 0 && (
        <ReportModal
          animeId={numericAnimeId}
          animeTitle={title}
          initialField={reportInitialField}
          onClose={() => setIsReportOpen(false)}
          onSuccess={() => showToast(`Reported "${reportInitialField}" correction — thank you!`)}
        />
      )}

    </div>
  );
};

export interface AnimeDetailModalProps {
  animeId: number | string;
  initialAnime?: AnimeDetailRecord | null;
  onResolvedAnime?: (anime: AnimeDetailRecord) => void;
  onClose: () => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onCompareAnime?: (anime: AnimeDetailRecord) => void;
}

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({
  animeId,
  initialAnime = null,
  onResolvedAnime,
  onClose,
  watchlist,
  onToggleWatchlist,
  onCompareAnime,
}) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-0 sm:p-4 md:p-6 font-sans">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        onClick={onClose}
        className="fixed inset-0 bg-[#0B0A10]/90"
      />

      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full max-w-5xl my-0 sm:my-6 rounded-none sm:rounded-2xl border-0 sm:border sm:border-[#292B39] overflow-hidden shadow-2xl z-10 will-change-transform"
      >
        <AnimeDetailPage
          animeId={animeId}
          initialAnime={initialAnime}
          onResolvedAnime={onResolvedAnime}
          onClose={onClose}
          onBack={onClose}
          watchlist={watchlist}
          onToggleWatchlist={onToggleWatchlist}
          onCompareAnime={onCompareAnime}
        />
      </motion.div>
    </div>
  );
};

