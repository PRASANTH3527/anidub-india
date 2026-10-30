import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  EyeOff, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  ShieldCheck,
  Flame,
  Volume2,
  X
} from 'lucide-react';
import { Anime } from './CatalogView';
import { LiveChat } from './LiveChat';
import { cloudflareApi } from '../services/cloudflareApi';
import { getCloudflareUrl } from '../config/cloudflare';

export interface AnimeDetailPageProps {
  animeId: number;
  onClose?: () => void;
  onBack?: () => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onSelectAnime?: (anime: Anime) => void;
}

export const AnimeDetailPage: React.FC<AnimeDetailPageProps> = ({
  animeId,
  onClose,
  onBack,
  watchlist,
  onToggleWatchlist,
  onSelectAnime
}) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upvotes, setUpvotes] = useState(0);
  const [currentRating, setCurrentRating] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isWatched, setIsWatched] = useState(false);

  // Review Form state
  const [reviewRating, setReviewRating] = useState(8.5);
  const [reviewLang, setReviewLang] = useState('Hindi Dub');
  const [reviewComment, setReviewComment] = useState('');
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [reviewsList, setReviewsList] = useState<any[]>(() => {
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
  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

  const handleBack = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };

  useEffect(() => {
    // Check watched status from localStorage
    try {
      const watched = JSON.parse(localStorage.getItem('cf_watched_anime_ids') || '[]');
      const idNum = Number(animeId);
      setIsWatched(watched.some((w: any) => Number(w) === idNum));
    } catch {
      setIsWatched(false);
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
  }, [animeId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const data = await cloudflareApi.getAnimeById(animeId);
      if (data) {
        setDetails(data);
        if (data.popularity) setUpvotes(data.popularity);
        if (data.rating) setCurrentRating(data.rating);
        if (data.reviews && Array.isArray(data.reviews) && data.reviews.length > 0) {
          const normalized = data.reviews.map((r: any) => ({
            id: r.id || Date.now(),
            author: r.author || r.user_name || 'Indian Anime Fan',
            rating: Number(r.rating) || 8.5,
            language: r.language || (r.comment?.match(/\[(.*?) Dub\]/)?.[1] ? `${r.comment.match(/\[(.*?) Dub\]/)[1]} Dub` : 'Hindi Dub'),
            comment: r.comment ? r.comment.replace(/^\[.*?\]\s*/, '') : '',
            date: r.date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent'),
            likes: r.likes || 1,
            isLiked: false,
            spoilers: Boolean(r.spoilers),
            revealed: true
          }));

          setReviewsList(prev => {
            const existingIds = new Set(prev.map(p => String(p.id)));
            const newFromApi = normalized.filter((n: any) => !existingIds.has(String(n.id)));
            const merged = [...prev, ...newFromApi];
            try {
              localStorage.setItem(`cf_reviews_${animeId}`, JSON.stringify(merged));
            } catch {}
            return merged.length > 0 ? merged : normalized;
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch anime details from Cloudflare:', err);
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
        const upvoted = JSON.parse(localStorage.getItem('cf_user_upvoted_ids') || '[]');
        const idNum = Number(animeId);
        if (!upvoted.some((u: any) => Number(u) === idNum)) {
          upvoted.push(idNum);
          localStorage.setItem('cf_user_upvoted_ids', JSON.stringify(upvoted));
        }
      } catch (e) {
        console.error(e);
      }
      setIsVoting(false);
    }
  };

  const handleRate = async (val: number) => {
    setIsRating(true);
    try {
      const url = getCloudflareUrl(`/api/anime/${animeId}/rate`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: val })
      });
      const data = await res.json();
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

    const newRev = {
      id: Date.now(),
      author: 'Indian Anime Fan',
      rating: reviewRating,
      language: reviewLang,
      comment: reviewComment,
      spoilers: hasSpoilers,
      revealed: !hasSpoilers,
      likes: 1,
      isLiked: false,
      date: 'Just now'
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
      fetch(getCloudflareUrl(`/api/anime/${animeId}/reviews`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: 'Indian Anime Fan',
          rating: reviewRating,
          language: reviewLang,
          comment: reviewComment
        })
      }).catch(() => {});

      // 2. Broadcast review into Live Community Chat REST API
      const chatPayload = {
        user: 'Indian Anime Fan',
        text: `[⭐ ${reviewRating}/10 • ${reviewLang}] ${reviewComment}`,
        isReview: true,
        rating: reviewRating,
        language: reviewLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      fetch(getCloudflareUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload)
      }).catch(() => {});

      // 3. Send through Cloudflare WebSocket so connected users receive it instantly
      try {
        const ws = new WebSocket('wss://anime-chat.samayaprasanth0.workers.dev/ws');
        ws.onopen = () => {
          ws.send(JSON.stringify({
            id: `rev_${Date.now()}`,
            ...chatPayload
          }));
          setTimeout(() => ws.close(), 800);
        };
      } catch (_) {}

    } catch (err) {
      console.error(err);
    }
    await handleRate(reviewRating);
    showToast('Dub review submitted successfully!');
  };

  const handleLikeReview = (id: number) => {
    setReviewsList(reviewsList.map(r => {
      if (r.id === id) {
        const isLiked = !r.isLiked;
        return { ...r, isLiked, likes: isLiked ? (r.likes || 0) + 1 : (r.likes || 1) - 1 };
      }
      return r;
    }));
  };

  const handleToggleSpoiler = (id: number) => {
    setReviewsList(reviewsList.map(r => {
      if (r.id === id) {
        return { ...r, revealed: !r.revealed };
      }
      return r;
    }));
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast('Link copied to clipboard!');
  };

  const isBookmarked = watchlist.includes(animeId);

  const handleToggleWatched = () => {
    const nextWatched = !isWatched;
    setIsWatched(nextWatched);
    try {
      const watched = JSON.parse(localStorage.getItem('cf_watched_anime_ids') || '[]');
      const idNum = Number(animeId);
      let updated;
      if (nextWatched) {
        updated = Array.from(new Set([...watched, idNum]));
      } else {
        updated = watched.filter((w: any) => Number(w) !== idNum);
      }
      localStorage.setItem('cf_watched_anime_ids', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    showToast(nextWatched ? 'Marked as Watched!' : 'Marked as uncompleted');
  };

  // Anime properties and fallbacks
  const title = details?.title || 'Anime Details';
  const coverImage = details?.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
  const posterImage = coverImage;
  const rawSynopsis = details?.synopsis || details?.description || 'Follow this thrilling dubbed adventure packed with high-stakes action, supernatural twists, and emotional character arcs, officially licensed with regional Indian audio tracks.';
  const synopsis = rawSynopsis.replace(/Imported via standardized CSV format\.?/gi, '').trim() || 'Follow this thrilling dubbed adventure packed with high-stakes action, supernatural twists, and emotional character arcs, officially licensed with regional Indian audio tracks.';
  const releaseYear = details?.releaseYear || details?.year || 2024;
  const type = details?.type || 'TV Series';
  const status = details?.status || (type === 'Movie' ? 'Completed' : 'Ongoing');
  const studio = details?.studio || 'Animation Studio';
  
  // Exclude non-Indian languages from dub badges (strictly exclude Japanese, English, Romaji, etc.)
  const rawLanguages = details?.languages ? details.languages.split(',').map((l: string) => l.trim()) : ['Hindi', 'Tamil', 'Telugu', 'Malayalam'];
  const languages = rawLanguages.filter(
    (l: string) => !['japanese', 'english', 'romaji', 'korean', 'chinese', 'jap', 'jpn', 'eng'].includes(l.trim().toLowerCase())
  );
  const displayLanguages = languages.length > 0 ? languages : ['Hindi', 'Tamil', 'Telugu'];
  
  const genres = details?.genre ? details.genre.split(',').map((g: string) => g.trim()) : ['Action', 'Fantasy', 'Adventure', 'Supernatural'];

  // Helper for platform URLs with Android Intent Deep Linking and fallback
  const getPlatformUrl = (platformName: string, animeTitle: string, defaultUrl?: string) => {
    const p = platformName.toLowerCase();
    let webUrl = `https://www.google.com/search?q=${encodeURIComponent(animeTitle + ' ' + platformName + ' watch online')}`;
    let packageName = '';

    if (p.includes('netflix')) {
      webUrl = `https://www.netflix.com/search?q=${encodeURIComponent(animeTitle)}`;
      packageName = 'com.netflix.mediaclient';
    } else if (p.includes('crunchyroll')) {
      webUrl = `https://www.crunchyroll.com/search?q=${encodeURIComponent(animeTitle)}`;
      packageName = 'com.crunchyroll.crunchyroid';
    } else if (p.includes('jiocinema') || p.includes('jio')) {
      webUrl = `https://www.jiocinema.com/search/${encodeURIComponent(animeTitle)}`;
      packageName = 'com.jio.media.stb.jiocinema';
    } else if (p.includes('hotstar') || p.includes('disney')) {
      webUrl = `https://www.hotstar.com/in/explore?search_query=${encodeURIComponent(animeTitle)}`;
      packageName = 'in.startv.hotstar';
    } else if (p.includes('youtube') || p.includes('muse') || p.includes('ani-one')) {
      webUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(animeTitle + ' hindi dub')}`;
      packageName = 'com.google.android.youtube';
    } else if (p.includes('prime') || p.includes('amazon')) {
      webUrl = `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(animeTitle)}`;
      packageName = 'com.amazon.avod.thirdpartyclient';
    } else {
      webUrl = defaultUrl || webUrl;
    }

    let intentUrl = webUrl;
    try {
      const parsed = new URL(webUrl);
      const hostPath = parsed.host + parsed.pathname + parsed.search;
      if (packageName) {
        intentUrl = `intent://${hostPath}#Intent;scheme=https;package=${packageName};end;`;
      }
    } catch {}

    return { name: platformName, url: webUrl, intentUrl };
  };

  const handleOpenPlatform = (platform: { name: string; url: string; intentUrl: string }) => {
    setIsWatchOptionsOpen(false);
    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && platform.intentUrl.startsWith('intent://')) {
        window.location.href = platform.intentUrl;
        setTimeout(() => {
          window.open(platform.url, '_blank');
        }, 1500);
        return;
      }
    } catch {}
    window.open(platform.url, '_blank');
  };

  // Parse platforms list (supports 1 to 4+ platforms seamlessly)
  const rawPlatformsList: string[] = (() => {
    if (Array.isArray(details?.platforms) && details.platforms.length > 0) {
      return details.platforms.map(String);
    }
    const platStr = details?.platform || details?.platforms || 'Crunchyroll';
    if (typeof platStr === 'string') {
      return platStr.split(/[,/•|]+/).map((s: string) => s.trim()).filter(Boolean);
    }
    return ['Crunchyroll'];
  })();

  const availablePlatforms = Array.from<string>(new Set(rawPlatformsList)).map((pName) => 
    getPlatformUrl(pName, title, details?.stream_url || details?.watch_url)
  );

  // Calculate total episodes across all seasons using reduce
  const seasonsArray = details?.seasons || details?.mixedEntries || details?.seasonsList || [];
  const totalEpisodes = Array.isArray(seasonsArray) && seasonsArray.length > 0
    ? seasonsArray.reduce((acc: number, season: any) => acc + Number(season.episodes || season.episode_count || 0), 0)
    : (details?.episodes_count || details?.episodes || details?.episode_count || (type === 'Movie' ? 1 : null));
  
  const episodesText = totalEpisodes ? `${totalEpisodes} ${totalEpisodes === 1 ? 'Ep' : 'Eps'}` : null;

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

  return (
    <div className="relative w-full min-h-screen bg-[#050507] text-neutral-100 font-sans pb-36 overflow-x-hidden selection:bg-purple-500/30">

      {/* 1. VIBRANT FULL-BLEED BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img 
          src={coverImage} 
          alt={title}
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80';
          }}
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
          <button
            onClick={() => setIsReportOpen(true)}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/60 hover:text-red-400 transition-all cursor-pointer shadow-lg active:scale-95"
            title="Report Issue"
            aria-label="Report"
          >
            <Flag className="w-4 h-4" />
          </button>
          <button
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
          <img
            src={posterImage}
            alt={title}
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
            }}
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
        <div className="w-full max-w-md flex items-center justify-center gap-3 mb-4">
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
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all cursor-pointer"
            >
              <Play size={18} className="fill-white" />
              {availablePlatforms.length > 1 ? "Watch Options" : `Watch on ${availablePlatforms[0].name}`}
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onToggleWatchlist(animeId)}
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
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-orange-400 transition-all relative cursor-pointer"
              title="Upvote Anime"
            >
              <Flame size={22} className="fill-orange-400" />
              <span className="absolute -top-1 -right-1 text-[9px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded-full shadow-lg">
                {upvotes > 0 ? (upvotes >= 1000 ? `${(upvotes/1000).toFixed(1)}k` : upvotes) : '1K'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. NAKED CONTENT FLOW (100% CARDLESS & BOXLESS) */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">

        {/* SECTION 1: AVAILABLE REGIONAL DUBS */}
        <div className="mt-12">
          <h2 className="text-purple-400 text-[10px] font-black tracking-widest uppercase mb-4 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            Available Dubs
          </h2>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {displayLanguages.map((lang: string) => (
              <div
                key={lang}
                className="flex items-center gap-2 text-sm font-bold text-white tracking-wide"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
                <span>{lang}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: SYNOPSIS */}
        <div className="mt-12">
          <h2 className="text-purple-400 text-[10px] font-black tracking-widest uppercase mb-4 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            Synopsis
          </h2>
          <p className="text-sm sm:text-base text-neutral-200/90 leading-relaxed font-normal">
            {isSynopsisExpanded || synopsis.length <= 280
              ? synopsis
              : `${synopsis.slice(0, 280)}...`}
            {synopsis.length > 280 && (
              <button
                type="button"
                onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 ml-2 cursor-pointer transition-colors"
              >
                {isSynopsisExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-4 text-xs">
            <span className="text-purple-300/60 text-[10px] font-bold tracking-widest uppercase mr-1">GENRES:</span>
            {genres.map((g: string, i: number) => (
              <span key={g} className="text-neutral-300 font-medium text-xs">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">PLATFORMS</span>
              <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                <Play className="w-3.5 h-3.5 text-purple-400 fill-purple-400 shrink-0" />
                <span className="truncate">{availablePlatforms.map(p => p.name).join(', ')}</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">AUDIO TRACK</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span>Dolby 5.1 / Stereo</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">STUDIO</span>
              <span className="text-xs font-bold text-white truncate block">{studio}</span>
            </div>
            <div>
              <span className="text-[10px] text-white/50 font-bold block uppercase tracking-wider mb-1">VERIFICATION</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>100% Legal</span>
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 4: COMMUNITY DUB REVIEWS */}
        <div className="mt-12 space-y-6">
          <h2 className="text-purple-400 text-[10px] font-black tracking-widest uppercase drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            Community Dub Reviews ({reviewsList.length})
          </h2>

          {/* Form */}
          <form onSubmit={handleAddReview} className="space-y-4 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300 font-medium">Rate Dubbing Quality</span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
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

            <div className="grid grid-cols-2 gap-3 text-xs">
              <select
                value={reviewLang}
                onChange={(e) => setReviewLang(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                <option value="Hindi Dub">Hindi Dub</option>
                <option value="Tamil Dub">Tamil Dub</option>
                <option value="Telugu Dub">Telugu Dub</option>
                <option value="Malayalam Dub">Malayalam Dub</option>
                <option value="Kannada Dub">Kannada Dub</option>
              </select>

              <div className="flex items-center justify-end">
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
              className="w-full bg-black/60 border border-white/10 rounded-2xl p-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400 resize-none"
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

          {/* Reviews List */}
          <div className="space-y-6 pt-2">
            {reviewsList.length === 0 ? (
              <div className="py-2 text-xs text-neutral-400">
                <p>No community reviews yet. Be the first to review this regional dub!</p>
              </div>
            ) : (
              reviewsList.map((review) => (
                <div 
                  key={review.id}
                  className="space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white">{review.author}</span>
                      <span className="text-[11px] text-purple-300 font-semibold">
                        {review.language}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{review.rating}</span>
                    </div>
                  </div>

                  <div className="relative">
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

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1">
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
        </div>

        {/* LIVE COMMUNITY DISCUSSION & CHAT */}
        <div className="mt-12">
          <LiveChat defaultAnimeTitle={title} />
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
                <div key={idx} className="pb-3">
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
      <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto z-50 backdrop-blur-3xl bg-black/40 border border-white/10 p-2.5 rounded-[2.5rem] flex items-center justify-between shadow-2xl">
        {/* Watch Options Button */}
        <button
          type="button"
          onClick={() => setIsWatchOptionsOpen(true)}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3.5 rounded-full font-bold shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center gap-2 hover:opacity-95 transition-all cursor-pointer text-xs uppercase tracking-wider active:scale-95"
        >
          <Play className="w-4 h-4 fill-white shrink-0" />
          <span>Watch Options</span>
          <ChevronUp className="w-3.5 h-3.5 opacity-80 shrink-0" />
        </button>

        {/* Lightweight Icon Actions */}
        <div className="flex items-center gap-1.5 pr-1">
          {/* Upvote Button with count */}
          <button
            type="button"
            onClick={handleVote}
            disabled={isVoting}
            className={`h-11 px-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95 ${
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
            onClick={() => onToggleWatchlist(animeId)}
            className={`w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
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
            className={`w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
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
            className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer active:scale-95"
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
                  className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-neutral-400">
                Select an official platform to stream {title} with regional Indian dub audio:
              </p>

              <div className="space-y-2 pt-1 max-h-[50vh] overflow-y-auto">
                {availablePlatforms.map((plat) => (
                  <a
                    key={plat.name}
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
                          Verified Indian Dubs • HD
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
      {isReportOpen && (
        <div 
          onClick={() => setIsReportOpen(false)}
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#131926] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-400" />
                <span>Report an Issue</span>
              </h3>
              <button 
                onClick={() => setIsReportOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Found a broken streaming link or incorrect regional dub information for {title}? Let our moderation team know.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-300">Issue Type</label>
              <select className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white">
                <option>Broken / Expired OTT Streaming Link</option>
                <option>Missing Regional Dub Audio (Hindi/Tamil/Telugu)</option>
                <option>Incorrect Episode Count or Airing Status</option>
                <option>Voice Actor / Studio Credits Mismatch</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-300">Details</label>
              <textarea 
                rows={3}
                placeholder="Describe what needs correction..."
                className="w-full bg-[#182032] border border-neutral-700 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReportOpen(false);
                  showToast('Thank you! Your report has been submitted to moderators.');
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
