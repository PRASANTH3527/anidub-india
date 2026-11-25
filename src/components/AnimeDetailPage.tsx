import React, { useState, useEffect, useMemo } from 'react';
import Image from './OptimizedImage';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { 
  ArrowLeft, 
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
  Scale
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

  // Toast / Modal states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportInitialField, setReportInitialField] = useState<string>('OTT Link');
  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

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

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    const currentUsername = user ? getVerifiedClerkUsername(user) : generateRandomUsername();
    const nowIso = new Date().toISOString();

    const newRev = {
      id: Date.now(),
      author: currentUsername,
      rating: reviewRating,
      language: reviewLang,
      comment: reviewComment,
      spoilers: hasSpoilers,
      revealed: !hasSpoilers,
      likes: 1,
      isLiked: false,
      date: formatRelativeTime(nowIso),
      created_at: nowIso
    };

    const updated = [newRev, ...reviewsList];
    setReviewsList(updated);
    setReviewComment('');
    try {
      localStorage.setItem(`cf_reviews_${animeId}`, JSON.stringify(updated));
      const userRevs = JSON.parse(localStorage.getItem('cf_user_reviews') || '[]');
      userRevs.unshift({ ...newRev, animeId });
      localStorage.setItem('cf_user_reviews', JSON.stringify(userRevs));

      // 1. Persist to D1 / SQLite database
      cloudflareApi.submitReview(animeId, {
        user_name: currentUsername,
        rating: reviewRating,
        language: reviewLang,
        comment: reviewComment
      }).catch(() => {});

      // 2. Broadcast review into Live Community Chat REST API with verified Clerk username
      if (user) {
        const chatPayload = {
          user: currentUsername,
          username: currentUsername,
          text: `[⭐ ${reviewRating}/10 • ${reviewLang}] ${reviewComment}`,
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
    showToast('Dub review submitted successfully!');
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
    const nextSeason = Math.max(1, patch.season ?? prev.season);
    const nextEpisode = Math.max(0, patch.episode ?? prev.episode);
    const cap = totalEpisodes && totalEpisodes > 0 ? totalEpisodes : null;
    const clampedEpisode = cap ? Math.min(cap, nextEpisode) : nextEpisode;
    const autoCompleted =
      patch.completed !== undefined
        ? patch.completed
        : Boolean(cap && clampedEpisode >= cap);

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

    showToast(`Saved progress: S${saved.season} • Ep ${saved.episode}`);
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
  const progressPercent = computeWatchProgressPercent(
    activeEpisode,
    totalEpisodes ?? watchProgress?.totalEpisodes ?? null,
    isWatched || Boolean(watchProgress?.completed)
  );

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

  if (!loading && notFound) {
    return (
      <div className="relative w-full min-h-[70vh] bg-[#050507] text-neutral-100 font-sans flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md w-full rounded-3xl bg-[#111726] border border-white/10 p-8 shadow-2xl space-y-4">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-extrabold uppercase tracking-wider">
            404 • Not Found
          </div>
          <h1 className="text-2xl font-black text-white">Anime Not Found</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            We couldn&apos;t find a published anime matching <span className="text-white font-semibold">&ldquo;{String(animeId)}&rdquo;</span> in the AniDub India catalog.
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold transition-all cursor-pointer shadow-lg"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-[#050507] text-neutral-100 font-sans pb-36 overflow-x-clip selection:bg-purple-500/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: animeJsonLd }}
      />

      {/* 1. VIBRANT FULL-BLEED BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image 
          src={coverImage} 
          alt={title}
          loading="lazy"
          sizes="100vw"
          width={640}
          height={360}
          quality={60}
          className="w-full h-full object-cover blur-[100px] opacity-70 saturate-[1.5]" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050507]/90"></div>
      </div>

      {/* Top Floating Navigation Bar */}
      <div className="relative z-20 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto">
        <button
          onClick={handleBack}
          className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95"
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
              className="px-3 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-white/85 hover:text-white hover:bg-white/15 inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
              title="Compare with another anime"
            >
              <Scale className="w-3.5 h-3.5 text-purple-300" />
              <span className="hidden sm:inline">Compare</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => openReportForField('OTT Link')}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/60 hover:text-red-400 transition-all cursor-pointer shadow-lg active:scale-95"
            title="Report Specific Field"
            aria-label="Report Specific Field"
          >
            <Flag className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-black/80 backdrop-blur-xl border border-white/20 shadow-2xl flex items-center gap-2.5 text-white text-xs font-semibold animate-in fade-in duration-200">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. CINEMATIC HERO (TOP SECTION) */}
      <div className="relative z-10 px-4 flex flex-col items-center text-center max-w-3xl mx-auto mt-6">
        {/* Poster */}
        <div className="relative w-44 h-64 mx-auto mb-6">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-48 bg-purple-600 blur-[70px] opacity-50 pointer-events-none"></div>
          <Image
            src={posterImage}
            alt={title}
            priority
            sizes="176px"
            width={176}
            height={256}
            quality={80}
            className="relative w-44 h-64 rounded-2xl shadow-[0_20px_50px_rgba(168,85,247,0.4)] border border-white/10 object-cover z-10"
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-black text-center text-white drop-shadow-2xl mb-3 relative z-10 leading-tight max-w-xl">
          {title}
        </h1>

        {/* Meta details: simple text separated by dots, NO pills or backgrounds */}
        <div className="flex items-center justify-center flex-wrap gap-2 text-xs font-semibold text-white/80 relative z-10 mb-8">
          {currentRating && (
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{currentRating.toFixed(1)} / 10</span>
            </span>
          )}
          {currentRating && releaseYear && <span>•</span>}
          {releaseYear && <span>{releaseYear}</span>}
          <span>•</span>
          <span className="text-purple-300 font-medium">{type}</span>
          {episodesText && (
            <>
              <span>•</span>
              <span>{episodesText}</span>
            </>
          )}
          {status && (
            <>
              <span>•</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{status}</span>
              </span>
            </>
          )}
        </div>

        {/* INLINE ACTION BAR */}
        <div className="w-full max-w-md min-w-0 flex items-center justify-center gap-2 sm:gap-3 mb-4">
          {availablePlatforms.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (availablePlatforms.length === 1) {
                  handleOpenPlatform(availablePlatforms[0]);
                } else {
                  setIsWatchOptionsOpen(true);
                }
              }}
              className="flex-1 min-w-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all cursor-pointer truncate"
            >
              <Play size={16} className="fill-white shrink-0" />
              <span className="truncate">{availablePlatforms.length > 1 ? "Watch Options" : `Watch on ${availablePlatforms[0].name}`}</span>
            </button>
          )}

          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => numericAnimeId > 0 && onToggleWatchlist(numericAnimeId)}
              aria-label={isBookmarked ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
              className={`w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all cursor-pointer ${
                isBookmarked ? 'text-purple-400 bg-purple-500/20 border-purple-500/40' : 'text-white'
              }`}
              title={isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}
            >
              <Bookmark size={20} className={isBookmarked ? 'fill-purple-400' : ''} />
            </button>
            <button
              type="button"
              onClick={handleVote}
              disabled={isVoting}
              aria-label={`Upvote ${title}`}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-orange-400 transition-all relative cursor-pointer"
              title="Upvote Anime"
            >
              <Flame size={22} className="fill-orange-400" />
              <span className="absolute -top-1 -right-1 text-[9px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded-full shadow-lg">
                {upvotes > 0 ? (upvotes >= 1000 ? `${(upvotes/1000).toFixed(1)}k` : upvotes) : '0'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. CONTENT FLOW */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">

        {/* SECTION 0: WHERE TO WATCH (OFFICIAL OTT LINKS + REPORT SPECIFIC FIELD) */}
        <section
          aria-label="Where to Watch"
          className="mt-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-xl space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-purple-400 text-[10px] font-black tracking-widest uppercase">
                Where to Watch (India)
              </h2>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Official licensed OTT platforms — AniDub India never hosts pirated video streams
              </p>
            </div>
            <button
              type="button"
              onClick={() => openReportForField('OTT Link')}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/35 text-[11px] font-semibold text-neutral-300 hover:text-rose-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Flag className="w-3 h-3" />
              <span>Report Specific Field</span>
            </button>
          </div>

          {availablePlatforms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availablePlatforms.map((plat) => (
                <button
                  key={`where_to_watch_${plat.name}`}
                  type="button"
                  onClick={() => handleOpenPlatform(plat)}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/35 hover:bg-white/[0.07] border border-white/10 hover:border-purple-400/40 text-left transition-all cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{plat.name}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {plat.isDirectUrl ? 'Direct official link • India' : 'Official platform lookup • India'}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-purple-300 shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 text-xs text-neutral-400 flex flex-wrap items-center justify-between gap-3">
              <span>Official Indian OTT streaming platform is currently <strong className="text-neutral-200">Not verified</strong>.</span>
              <button
                type="button"
                onClick={() => openReportForField('OTT Link')}
                className="text-purple-300 hover:text-purple-200 font-bold underline underline-offset-2 cursor-pointer"
              >
                Suggest official link
              </button>
            </div>
          )}

          {/* Quick Field-Specific Report Shortcuts */}
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-neutral-500 font-semibold">Spot an inaccuracy? Report:</span>
            {(['OTT Link', 'Dub Language', 'Episode Count', 'Release Schedule'] as const).map((fieldLabel) => (
              <button
                key={`report_field_${fieldLabel}`}
                type="button"
                onClick={() => openReportForField(fieldLabel)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/35 text-neutral-300 hover:text-rose-200 font-semibold transition-colors cursor-pointer"
              >
                {fieldLabel}
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 1: VISUAL DUB PROGRESS BARS (PER INDIAN LANGUAGE & SEASON) */}
        <section
          aria-label="Indian Dub Availability and Progress"
          className="mt-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-xl space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-purple-400 text-[10px] font-black tracking-widest uppercase drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                Indian Dub Availability &amp; Progress
              </h2>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Color-coded regional audio status across major Indian languages
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
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-purple-600/30 border-purple-400/60 text-white'
                          : 'bg-black/30 border-white/10 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {season.seasonLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3" data-testid="dub-progress-bars">
            {activeDubSeason.languages.map((row) => {
              const barColorClass =
                row.status === 'complete'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                  : row.status === 'partial'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : row.status === 'available'
                      ? 'bg-gradient-to-r from-emerald-500/80 to-teal-400/80'
                      : 'bg-neutral-700/60';

              const badgeColorClass =
                row.status === 'complete'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : row.status === 'partial'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : row.status === 'available'
                      ? 'bg-teal-500/15 border-teal-500/35 text-teal-300'
                      : 'bg-neutral-800/70 border-neutral-700/60 text-neutral-400';

              return (
                <div key={`dub_bar_${activeDubSeason.seasonKey}_${row.language}`} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          row.status === 'complete' || row.status === 'available'
                            ? 'bg-emerald-400'
                            : row.status === 'partial'
                              ? 'bg-amber-400'
                              : 'bg-neutral-600'
                        }`}
                      />
                      <span className={`font-bold ${row.status === 'unavailable' ? 'text-neutral-500' : 'text-white'}`}>
                        {row.language}
                      </span>
                      <span className="text-[11px] text-neutral-400 truncate">
                        — {row.label}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badgeColorClass}`}>
                      {row.badgeText}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-white/[0.07] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColorClass}`}
                      style={{ width: `${row.status === 'unavailable' ? 0 : row.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 1.5: WATCH PROGRESS TRACKER */}
        <section
          aria-label="Watch Progress Tracker"
          className="mt-10 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-xl space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-purple-300">
                  Watch Progress Tracker
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Season {activeSeason} • Episode {activeEpisode}
                  {totalEpisodes ? ` of ${totalEpisodes}` : ''} ({progressPercent}%)
                  {isSavingProgress ? ' • Syncing…' : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleWatched}
              aria-pressed={isWatched}
              aria-label={isWatched ? 'Mark series as unwatched' : 'Mark series as completed'}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                isWatched
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/[0.04] border-white/10 text-neutral-300 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isWatched ? 'Completed' : 'Mark Completed'}</span>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Season & Episode Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between rounded-2xl bg-black/35 border border-white/10 px-3.5 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Season
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateWatchProgress({ season: Math.max(1, activeSeason - 1) })}
                  aria-label="Decrease season"
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="min-w-[2.25rem] text-center text-xs font-black text-white">
                  S{activeSeason}
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateWatchProgress({ season: activeSeason + 1 })}
                  aria-label="Increase season"
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-black/35 border border-white/10 px-3.5 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Episode
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateWatchProgress({
                      episode: Math.max(0, activeEpisode - 1),
                      completed: false,
                    })
                  }
                  aria-label="Previous episode"
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="min-w-[3.25rem] text-center text-xs font-black text-white">
                  Ep {activeEpisode}
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateWatchProgress({ episode: activeEpisode + 1 })}
                  aria-label="Next watched episode"
                  className="w-7 h-7 rounded-lg bg-purple-600/80 hover:bg-purple-500 flex items-center justify-center text-white cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: SYNOPSIS WITH SPOILER PROTECTION */}
        <div className="mt-12">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-purple-400 text-[10px] font-black tracking-widest uppercase drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
              Synopsis
            </h2>
            <button
              type="button"
              onClick={handleToggleSpoilerProtection}
              aria-pressed={spoilerProtection}
              aria-label="Toggle spoiler protection"
              className={`px-3 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                spoilerProtection
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.04] border-white/10 text-neutral-400 hover:text-white'
              }`}
            >
              {spoilerProtection ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>Spoiler Protection: {spoilerProtection ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="relative">
            <p
              className={`text-sm sm:text-base text-neutral-200/90 leading-relaxed font-normal transition-all duration-300 ${
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
                  className="text-xs font-bold text-purple-400 hover:text-purple-300 ml-2 cursor-pointer transition-colors"
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
                  className="px-4 py-2 rounded-xl bg-black/85 border border-amber-500/40 text-amber-300 hover:text-white hover:border-amber-400 text-xs font-bold inline-flex items-center gap-2 shadow-xl backdrop-blur-md cursor-pointer transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Spoiler Shield Active — Click to Reveal Synopsis</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-4 text-xs">
            <span className="text-purple-300/60 text-[10px] font-bold tracking-widest uppercase mr-1">GENRES:</span>
            {genres.map((g: string, i: number) => (
              <span key={`detail_genre_${g}_${i}`} className="text-neutral-300 font-medium text-xs">
                {g}{i < genres.length - 1 ? ' • ' : ''}
              </span>
            ))}
          </div>
        </div>

        {/* SECTION 3: STREAM SPECS */}
        <div className="mt-12">
          <h2 className="text-purple-400 text-[10px] font-black tracking-widest uppercase mb-4 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            Stream Specs
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="min-w-0">
              <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">PLATFORMS</span>
              <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                <Play className="w-3.5 h-3.5 text-purple-400 fill-purple-400 shrink-0" />
                <span className="truncate">{availablePlatforms.map(p => p.name).join(', ')}</span>
              </span>
            </div>
            {verifiedAudioSpec && (
              <div className="min-w-0">
                <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">AUDIO TRACK</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{verifiedAudioSpec}</span>
                </span>
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">STUDIO</span>
              <span className="text-xs font-bold text-white truncate block">{studio}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">
                {isMovie ? 'FORMAT' : <>SEASONS &amp; EPISODES</>}
              </span>
              <span className="text-xs font-bold text-white truncate block">
                {isMovie
                  ? (movieDuration ? `Movie • ${movieDuration}` : 'Movie')
                  : (seasonEpisodeSummary || episodesText || (status === 'Airing' ? 'Ongoing' : 'TBA'))}
              </span>
            </div>
            {officialSourceHref && (
              <div className="min-w-0">
                <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">OFFICIAL SOURCE</span>
                <a
                  href={officialSourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 max-w-full truncate underline underline-offset-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{officialSourceLabel || 'Official Site'}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: COMMUNITY DUB REVIEWS (Dedicated Clean Card/Box) */}
        <section className="mt-12 bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-md">
                <Star className="w-4 h-4 fill-purple-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                  Community Dub Reviews
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Ratings on voice acting, regional audio sync & script localization
                </p>
              </div>
            </div>
            <span className="bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[11px] font-bold px-3 py-1 rounded-full">
              {reviewsList.length} {reviewsList.length === 1 ? 'Review' : 'Reviews'}
            </span>
          </div>

          {/* Review Submission Form */}
          <form onSubmit={handleAddReview} className="space-y-4 pt-1 bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300 font-semibold">Rate Dubbing Quality</span>
              <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
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
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-white/20 rounded-lg"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <select
                value={reviewLang}
                onChange={(e) => setReviewLang(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                {displayLanguages.map((lang: string, idx: number) => (
                  <option key={`review_opt_${lang}_${idx}`} value={`${lang} Dub`}>{lang} Dub</option>
                ))}
              </select>

              <div className="flex items-center justify-start sm:justify-end">
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={hasSpoilers}
                    onChange={(e) => setHasSpoilers(e.target.checked)}
                    className="accent-purple-500 rounded"
                  />
                  <span>Contains spoilers?</span>
                </label>
              </div>
            </div>

            <textarea 
              rows={2}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share thoughts on voice acting, sync, and regional dialogue delivery..."
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400 resize-none"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-900/40 transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Review</span>
              </button>
            </div>
          </form>

          {/* Reviews List Scrollable Container */}
          <div className="max-h-[420px] overflow-y-auto pr-1 space-y-4 pt-2 scrollbar-thin scrollbar-thumb-purple-600/50">
            {reviewsList.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-400 bg-black/20 border border-white/5 rounded-2xl p-4">
                <p>No community reviews yet for this title. Be the first to rate this regional dub above!</p>
              </div>
            ) : (
              reviewsList.map((review, idx) => (
                <div 
                  key={`review_${review.id}_${idx}`}
                  className="space-y-2 text-xs p-4 rounded-2xl bg-black/30 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white">{review.author}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 font-semibold">
                        {review.language}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{review.rating}</span>
                    </div>
                  </div>

                  <div className="relative pt-1">
                    {review.spoilers && !review.revealed ? (
                      <div className="py-1 flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Contains spoilers</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleSpoiler(review.id)}
                          className="font-bold text-purple-400 hover:underline cursor-pointer"
                        >
                          Reveal
                        </button>
                      </div>
                    ) : (
                      <p className="text-neutral-300/90 leading-relaxed font-normal text-xs">
                        {review.comment}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-white/5">
                    <span>{review.date || 'Recent'}</span>
                    <button
                      type="button"
                      onClick={() => handleLikeReview(review.id)}
                      className={`inline-flex items-center gap-1.5 text-[11px] transition-colors cursor-pointer ${
                        review.isLiked 
                          ? 'text-purple-400 font-bold' 
                          : 'text-neutral-400 hover:text-white'
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

        {/* DUAL RATING SYSTEM (GLOBAL SCORE & COMMUNITY SCORE) - PLACED DIRECTLY BELOW COMMUNITY DUB REVIEWS */}
        <div className="mt-8">
          <DualRating
            globalRating={details?.rating ? Number(details.rating) : 8.5}
            initialUserRating={userRating}
            communityScore={communityRating || (details?.rating ? Number(details.rating) : 8.5)}
            totalVotes={communityVotes}
            onRate={handleCommunityRate}
            className="w-full"
          />
        </div>

        {/* SECTION 5: FREQUENTLY ASKED QUESTIONS */}
        <div className="mt-12">
          <h2 className="text-purple-400 text-[10px] font-black tracking-widest uppercase mb-4 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={`anime_faq_${idx}`} className="pb-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full py-2 flex items-center justify-between text-left text-sm font-semibold text-white/90 hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    <span>{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-purple-400 shrink-0 ml-2" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/40 shrink-0 ml-2" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="pt-1 text-xs text-neutral-300/80 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. STICKY ACTION BAR */}
      <div className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-4 sm:right-4 w-auto max-w-[calc(100vw-1.5rem)] sm:max-w-md mx-auto z-50 backdrop-blur-3xl bg-black/40 border border-white/10 p-2 sm:p-2.5 gap-1.5 rounded-[2.5rem] flex items-center justify-between shadow-2xl overflow-hidden">
        {/* Watch Options Button */}
        <button
          type="button"
          onClick={() => setIsWatchOptionsOpen(true)}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3.5 sm:px-6 py-2.5 sm:py-3.5 rounded-full font-bold shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center gap-1.5 sm:gap-2 hover:opacity-95 transition-all cursor-pointer text-[11px] sm:text-xs uppercase tracking-wider active:scale-95 min-w-0 shrink"
        >
          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white shrink-0" />
          <span className="truncate">Watch Options</span>
          <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80 shrink-0" />
        </button>

        {/* Lightweight Icon Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 pr-0.5 sm:pr-1 shrink-0">
          {/* Upvote Button with count */}
          <button
            type="button"
            onClick={handleVote}
            disabled={isVoting}
            className={`h-9 sm:h-11 px-2.5 sm:px-3 shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95 ${
              upvotes > 0
                ? 'text-orange-400 border-orange-500/30 bg-orange-500/10'
                : 'text-white/80 hover:text-white'
            }`}
            title={`Upvote (${upvotes} votes)`}
            aria-label="Upvote"
          >
            <Flame className={`w-4 h-4 ${upvotes > 0 ? 'fill-orange-400 text-orange-400' : ''}`} />
            <span className="text-xs font-bold">
              {upvotes > 0 ? (upvotes >= 1000 ? `${(upvotes/1000).toFixed(1)}k` : upvotes) : ''}
            </span>
          </button>

          {/* Watchlist Button */}
          <button
            type="button"
            onClick={() => numericAnimeId > 0 && onToggleWatchlist(numericAnimeId)}
            className={`w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isBookmarked
                ? 'text-purple-400 border-purple-500/40 bg-purple-500/15'
                : 'text-white/80 hover:text-white'
            }`}
            title={isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}
            aria-label="Watchlist"
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-purple-400 text-purple-400' : ''}`} />
          </button>

          {/* Mark Watched Button */}
          <button
            type="button"
            onClick={handleToggleWatched}
            className={`w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isWatched
                ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15'
                : 'text-white/80 hover:text-white'
            }`}
            title={isWatched ? 'Completed' : 'Mark as Watched'}
            aria-label="Toggle Watched"
          >
            <CheckCircle2 className={`w-4 h-4 ${isWatched ? 'text-emerald-400' : ''}`} />
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer active:scale-95"
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
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          >
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0b0c10] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 fill-purple-400 text-purple-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Official Streaming Platforms
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWatchOptionsOpen(false)}
                  aria-label="Close streaming platforms modal"
                  className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-neutral-400">
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
                    className="w-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between text-sm font-semibold text-white transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform">
                        <Play className="w-4 h-4 fill-purple-400 text-purple-400" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-white group-hover:text-purple-300 transition-colors">
                          {plat.name}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {plat.languages && plat.languages.length > 0
                            ? `${plat.languages.join(', ')} Dubs`
                            : 'Regional Indian Dub Audio'}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-white" />
                  </a>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsWatchOptionsOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white cursor-pointer"
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
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={onClose}
        className="fixed inset-0 bg-[#0f1115]/90 backdrop-blur-xl"
      />

      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 50 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 45 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-5xl my-0 sm:my-6 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl z-10 will-change-transform"
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

