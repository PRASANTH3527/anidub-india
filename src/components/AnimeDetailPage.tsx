import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Star, 
  Calendar, 
  Building2, 
  Tag, 
  Users, 
  Volume2, 
  ExternalLink, 
  Bookmark, 
  CheckCircle2, 
  Share2, 
  Check, 
  Sparkles, 
  Clock, 
  Tv, 
  ThumbsUp, 
  MessageSquare, 
  Send, 
  LogIn,
  Flag
} from 'lucide-react';
import { Anime, WatchlistItem, DubLanguage } from '../types/anime';
import { DubReview } from '../types/database';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { updateSeoTags, buildAnimeSeo } from '../utils/seo';
import DynamicAmbientGlow from './DynamicAmbientGlow';
import { useReducedMotion, useIsMobile } from '../hooks/useMediaQuery';
import { FastAverageColor } from 'fast-average-color';
import { MoreLikeThisSection } from './MoreLikeThisSection';
import { SmartWatchButton } from './SmartWatchButton';

interface AnimeDetailPageProps {
  anime: Anime;
  watchlistItem?: WatchlistItem;
  onToggleWatchlist: (anime: Anime) => void;
  onToggleWatchedStatus: (animeId: string) => void;
  onBack: () => void;
  onSelectSimilarAnime?: (anime: Anime) => void;
  onOpenAuthModal?: () => void;
  onReport?: (anime: Anime) => void;
  allAnime?: Anime[];
}

const DUB_LANGUAGE_BADGES: Record<DubLanguage, { bg: string; text: string; border: string }> = {
  Tamil: { bg: 'bg-amber-950/70', text: 'text-amber-300', border: 'border-amber-700/60' },
  Telugu: { bg: 'bg-sky-950/70', text: 'text-sky-300', border: 'border-sky-700/60' },
  Hindi: { bg: 'bg-emerald-950/70', text: 'text-emerald-300', border: 'border-emerald-700/60' },
  Malayalam: { bg: 'bg-purple-950/70', text: 'text-purple-300', border: 'border-purple-700/60' },
  Kannada: { bg: 'bg-indigo-950/70', text: 'text-indigo-300', border: 'border-indigo-700/60' },
  Bengali: { bg: 'bg-pink-950/70', text: 'text-pink-300', border: 'border-pink-700/60' },
};

const PLATFORM_COLORS: Record<string, string> = {
  Crunchyroll: 'hover:bg-orange-600/20 hover:border-orange-500/50 text-orange-400',
  Netflix: 'hover:bg-indigo-600/20 hover:border-indigo-500/50 text-indigo-400',
  'Prime Video': 'hover:bg-sky-600/20 hover:border-sky-500/50 text-sky-400',
  'Disney+ Hotstar': 'hover:bg-blue-600/20 hover:border-blue-500/50 text-blue-400',
  JioCinema: 'hover:bg-purple-600/20 hover:border-purple-500/50 text-purple-400',
  YouTube: 'hover:bg-violet-600/20 hover:border-violet-500/50 text-violet-400',
};

export const AnimeDetailPage: React.FC<AnimeDetailPageProps> = ({
  anime,
  watchlistItem,
  onToggleWatchlist,
  onToggleWatchedStatus,
  onBack,
  onSelectSimilarAnime,
  onOpenAuthModal,
  onReport,
  allAnime = [],
}) => {
  const currentUser = authService.getCurrentUser();
  const [copied, setCopied] = useState(false);

  // Reviews & Rating System state
  const [reviews, setReviews] = useState<DubReview[]>([]);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [languageInput, setLanguageInput] = useState<DubLanguage>(anime.dubs[0] || 'Tamil');
  const [commentInput, setCommentInput] = useState<string>('');
  const [isSpoilerInput, setIsSpoilerInput] = useState(false);
  const [unblurredReviews, setUnblurredReviews] = useState<Set<string>>(new Set());
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // Dynamic Dominant Color Theming (fast-average-color)
  const [dominantTheme, setDominantTheme] = useState<{
    hex: string;
    rgb: string;
    rgba: string;
    gradient: string;
    isReady: boolean;
  }>({
    hex: '#7c3aed',
    rgb: 'rgb(124, 58, 237)',
    rgba: 'rgba(124, 58, 237, 0.45)',
    gradient: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(124, 58, 237, 0.45) 0%, rgba(19, 25, 38, 0.85) 55%, #0b0f17 100%)',
    isReady: false,
  });

  const heroImage = anime.imageUrl || anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

  useEffect(() => {
    if (!heroImage) return;
    const fac = new FastAverageColor();
    let isCancelled = false;

    fac
      .getColorAsync(heroImage, {
        algorithm: 'dominant',
        crossOrigin: 'anonymous',
        mode: 'precision',
        defaultColor: [124, 58, 237, 255],
      })
      .then((color) => {
        if (isCancelled) return;
        const [r, g, b] = color.value;
        const rgba = `rgba(${r}, ${g}, ${b}, 0.5)`;
        const gradient = `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(${r}, ${g}, ${b}, 0.55) 0%, rgba(19, 25, 38, 0.85) 55%, #0b0f17 100%)`;
        setDominantTheme({
          hex: color.hex,
          rgb: `rgb(${r}, ${g}, ${b})`,
          rgba,
          gradient,
          isReady: true,
        });
      })
      .catch((err) => {
        if (isCancelled) return;
        console.warn('[AnimeDetailPage] CORS or color extraction error, using fallback:', err?.message || err);
        setDominantTheme({
          hex: '#7c3aed',
          rgb: 'rgb(124, 58, 237)',
          rgba: 'rgba(124, 58, 237, 0.45)',
          gradient: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(124, 58, 237, 0.45) 0%, rgba(19, 25, 38, 0.85) 55%, #0b0f17 100%)',
          isReady: true,
        });
      });

    return () => {
      isCancelled = true;
      fac.destroy();
    };
  }, [heroImage]);

  // Auto-inject SEO tags on mount and update when anime changes
  useEffect(() => {
    updateSeoTags(buildAnimeSeo(anime));
  }, [anime]);

  // Load reviews from database
  const loadReviews = () => {
    setReviews(dbService.getReviewsForAnime(anime.id));
  };

  useEffect(() => {
    loadReviews();
    const unsub = dbService.subscribe(loadReviews);
    return () => unsub();
  }, [anime.id]);

  const isBookmarked = !!watchlistItem;
  const isWatched = watchlistItem?.status === 'watched';

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(`Watch "${anime.title}" dubbed in ${anime.dubs.join(', ')} on AniDub: ${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Submit new review
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }

    setIsSubmittingReview(true);
    try {
      await dbService.addReview({
        animeId: anime.id,
        userId: currentUser.uid,
        userName: currentUser.displayName,
        userAvatar: currentUser.photoURL,
        language: languageInput,
        rating: ratingInput,
        comment: commentInput.trim(),
        isSpoiler: isSpoilerInput,
      });

      setCommentInput('');
      setIsSpoilerInput(false);
      toast.success('Review Submitted', 'Thank you for your feedback!');
      loadReviews();
    } catch (err: any) {
      console.error('[Review submission error]:', err);
      const isQuota = isQuotaError && isQuotaError(err);
      toast.error(
        isQuota ? 'Database limit reached' : 'Review Failed',
        isQuota 
          ? 'Database limit reached. Please try again later.' 
          : 'Could not submit review. Please check your connection and try again.'
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleLike = (reviewId: string) => {
    dbService.likeReview(reviewId);
  };

  // Average community dub rating
  const averageDubScore = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '4.8';

  // Similar anime: dynamically filter and show up to 3 other approved anime sharing the same language
  const similarShows = allAnime
    .filter((a) => {
      if (a.id === anime.id) return false;
      const sharesLanguage = (a.dubs || []).some((dub) => (anime.dubs || []).includes(dub));
      return sharesLanguage;
    })
    .slice(0, 3);

  const isReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const shouldReduceAnimation = isReducedMotion || isMobile;

  return (
    <motion.div 
      initial={shouldReduceAnimation ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceAnimation ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-8"
    >
      {/* Dynamic Dominant Color Themed Background at top of Details Page */}
      <div 
        className="fixed top-0 left-0 right-0 h-[520px] pointer-events-none -z-10 transition-all duration-700 ease-out"
        style={{
          background: dominantTheme.gradient,
        }}
        aria-hidden="true"
      >
        {/* Dark overlay ensuring text remains crystal clear and readable without overpowering glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#0b0f17]/75 to-[#0b0f17]" />
      </div>

      {/* Top Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#131926]/90 hover:bg-[#1a2336] text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-colors cursor-pointer group shadow-sm backdrop-blur-md"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Dub Library</span>
        </button>

        <div className="flex items-center gap-2">
          {onReport && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onReport(anime)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131926]/90 hover:bg-purple-950/40 text-neutral-400 hover:text-purple-300 border border-neutral-800 hover:border-purple-500/40 text-xs font-semibold transition-all cursor-pointer active:scale-95 backdrop-blur-md"
              title="Report broken link or wrong info"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report Issue</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131926]/90 hover:bg-[#1a2336] text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-colors cursor-pointer backdrop-blur-md"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </motion.button>
        </div>
      </div>

      {/* Main Hero Header Card (Motion Wrapper) */}
      <motion.div 
        initial={shouldReduceAnimation ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative rounded-3xl overflow-hidden bg-[#131926] border border-neutral-800 shadow-2xl"
      >
        {/* Blurred Backdrop Banner with dynamic dominant color gradient & dark overlay */}
        <div 
          className="relative h-64 sm:h-80 w-full overflow-hidden transition-colors duration-700"
          style={{
            background: `linear-gradient(135deg, ${dominantTheme.rgba} 0%, rgba(19, 25, 38, 0.9) 65%, #131926 100%)`
          }}
        >
          <img
            src={heroImage}
            alt={anime.title}
            loading="lazy"
            decoding="async"
            crossOrigin="anonymous"
            className="w-full h-full object-cover blur-lg opacity-30 scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#131926] via-[#131926]/75 to-black/30" />
        </div>

        {/* Content overlapping banner */}
        <div className="relative px-6 sm:px-10 pb-8 -mt-36 sm:-mt-48 flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          
          {/* Main Poster with Spotify/Apple TV Cinematic Dynamic Ambient Glow */}
          <DynamicAmbientGlow imageUrl={heroImage} className="shrink-0 mx-auto md:mx-0 group">
            {/* Poster Card (Shared Element Transition) */}
            <motion.div 
              layoutId={shouldReduceAnimation ? undefined : `anime-poster-${anime.id}`}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative z-10 w-44 sm:w-56 aspect-[3/4.2] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border-2 border-neutral-700/80 bg-neutral-900 sm:group-hover:scale-[1.02] transition-transform duration-300"
            >
              <motion.img
                layoutId={shouldReduceAnimation ? undefined : `anime-poster-img-${anime.id}`}
                src={heroImage}
                alt={anime.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1 max-w-[80%]">
                {(anime.dubs || []).map((dub) => (
                  <span
                    key={dub}
                    className="bg-black/80 backdrop-blur-md text-amber-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded shadow border border-white/10"
                  >
                    {dub.slice(0, 3)}
                  </span>
                ))}
              </div>
            </motion.div>
          </DynamicAmbientGlow>

          {/* Title & Core Metadata */}
          <div className="flex-grow space-y-4 text-center md:text-left">
            <div>
              {/* Type, Year & Status pill */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                <span className="badge-primary-theme text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {anime.type}
                </span>
                <span className="text-xs text-neutral-400 font-semibold">
                  {anime.releaseYear}
                </span>
                <span className="text-xs text-neutral-400 font-semibold">•</span>
                <span className="text-xs text-neutral-400 font-semibold">
                  {anime.status}
                </span>
                {anime.episodes && (
                  <>
                    <span className="text-xs text-neutral-400 font-semibold">•</span>
                    <span className="text-xs text-neutral-400 font-semibold">
                      {anime.episodes} Episodes
                    </span>
                  </>
                )}
              </div>

              {/* Main Title */}
              <h1 className="font-heading font-black text-2xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
                {anime.title}
              </h1>

              {/* Romaji & Native Title */}
              {anime.romajiTitle && (
                <p className="text-sm text-neutral-400 font-medium mt-1">
                  {anime.romajiTitle} {anime.nativeTitle && `• ${anime.nativeTitle}`}
                </p>
              )}
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 sm:gap-4 pt-1">
              <div className="flex items-center gap-1.5 bg-black/50 border border-neutral-700/80 px-3 py-1.5 rounded-xl">
                <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span className="font-extrabold text-white text-sm">{anime.rating ? anime.rating.toFixed(1) : 'N/A'}</span>
                <span className="text-[11px] text-orange-500 font-black">CR RATING</span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/50 border border-primary-theme/60 px-3 py-1.5 rounded-xl">
                <Volume2 className="w-4 h-4 text-accent-theme" />
                <span className="font-extrabold text-primary-theme text-sm">★ {averageDubScore}</span>
                <span className="text-[11px] text-neutral-400">Dub Quality</span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/50 border border-neutral-700/80 px-3 py-1.5 rounded-xl">
                <Building2 className="w-4 h-4 text-accent-theme" />
                <span className="text-xs text-neutral-200 font-semibold">{anime.studio}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/50 border border-neutral-700/80 px-3 py-1.5 rounded-xl">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-neutral-200 font-semibold">
                  {anime.originalReleaseDate || `${anime.releaseYear}`}
                </span>
              </div>
            </div>

            {/* Watchlist CTAs */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onToggleWatchlist(anime)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                  isBookmarked
                    ? 'btn-primary-theme text-white'
                    : 'bg-[#1a2336] hover:bg-[#222e47] text-neutral-200 border border-neutral-700 hover:border-primary-theme/50'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                <span>{isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </motion.button>

              {isBookmarked && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onToggleWatchedStatus(anime.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isWatched
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      : 'bg-[#182032] text-neutral-300 border-neutral-700 hover:border-emerald-500'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 ${isWatched ? 'text-emerald-400' : 'text-neutral-500'}`} />
                  <span>{isWatched ? 'Completed / Watched' : 'Mark as Watched'}</span>
                </motion.button>
              )}
            </div>

          </div>

        </div>
      </motion.div>

      {/* Main Grid: Details, Characters & Dub Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Synopsis, Characters, Themes */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Synopsis Section */}
          <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-3">
            <h2 className="font-heading font-black text-lg text-white">
              Synopsis
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed font-normal">
              {anime.synopsis}
            </p>

            {/* Genres & Themes Badges */}
            <div className="pt-4 border-t border-neutral-800/80 space-y-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                  Genre Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(anime.genres || []).map((genre) => (
                    <span
                      key={genre}
                      className="text-xs font-semibold bg-[#182032] text-accent-theme border border-neutral-700/80 px-3 py-1 rounded-full"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>

              {anime.themes && anime.themes.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                    Themes & Tropes
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(anime.themes || []).map((theme) => (
                      <span
                        key={theme}
                        className="text-xs font-semibold bg-[#182032] text-neutral-300 border border-neutral-700/80 px-3 py-1 rounded-full"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Characters & Voice Actors Section (Fulfills exact prompt requirement) */}
          <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-theme" />
              <h2 className="font-heading font-black text-lg text-white">
                Main Characters & Voice Actors
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              Featuring primary characters along with their original Japanese and regional Indian dub voice artists.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {anime.characters && anime.characters.length > 0 ? (
                (anime.characters || []).map((char, index) => (
                  <div
                    key={index}
                    className="bg-[#182032] border border-neutral-800 rounded-2xl p-3 flex gap-3 items-center"
                  >
                    <img
                      src={char.characterImage}
                      alt={char.characterName}
                      loading="lazy"
                      decoding="async"
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-neutral-700"
                    />
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-xs text-white truncate">
                           {char.characterName}
                        </h4>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded badge-primary-theme shrink-0">
                          {char.role}
                        </span>
                      </div>

                      <div className="text-[11px] text-neutral-400 mt-1 space-y-0.5">
                        <div className="truncate">
                          <span className="text-neutral-500 font-medium">JA:</span> {char.japaneseVA}
                        </div>
                        {char.indianVA && (
                          <div className="truncate text-amber-300/90 font-medium">
                            <span className="text-neutral-500">Dub ({char.indianVA.language}):</span> {char.indianVA.actor}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-xs text-neutral-500 italic py-2">
                  Character voice cast information is being updated.
                </div>
              )}
            </div>
          </div>

          {/* 5. Ratings & Comments System (Dub Quality Reviews) */}
          <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-accent-theme" />
                  <h3 className="font-heading font-black text-xl text-white">
                    Dub Quality Reviews & Ratings
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Community feedback on Tamil, Telugu, Hindi, Malayalam, and Kannada voice acting & sound mixing.
                </p>
              </div>

              {/* Overall Dub Quality badge */}
              <div className="flex items-center gap-2 bg-[#182032] border border-primary-theme/60 px-4 py-2 rounded-2xl shrink-0">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <div>
                  <span className="font-black text-white text-base leading-none block">
                    {averageDubScore} / 5
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                  </span>
                </div>
              </div>
            </div>

            {/* Leave a Review Form */}
            <div className="bg-[#182032] border border-neutral-700/80 rounded-2xl p-5 space-y-4">
              <h4 className="font-bold text-sm text-white flex items-center justify-between">
                <span>Leave a Dub Quality Review</span>
                {currentUser ? (
                  <span className="text-[11px] text-accent-theme font-medium">
                    Posting as: <strong>{currentUser.displayName}</strong>
                  </span>
                ) : (
                  <button
                    onClick={onOpenAuthModal}
                    className="text-xs text-accent-theme hover:text-primary-theme underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign in with Google to Review</span>
                  </button>
                )}
              </h4>

              <form onSubmit={handleReviewSubmit} className="space-y-3.5">
                {/* Star rating selector */}
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                      Dub Quality Rating (1 to 5 Stars)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const active = (hoverRating || ratingInput) >= star;
                        return (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setRatingInput(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 cursor-pointer transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                active
                                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                                  : 'text-neutral-600'
                              }`}
                            />
                          </button>
                        );
                      })}
                      <span className="text-xs font-bold text-amber-300 ml-2">
                        {ratingInput} of 5 Stars
                      </span>
                    </div>
                  </div>

                  {/* Language being reviewed */}
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                      Language Reviewed
                    </label>
                    <select
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value as DubLanguage)}
                      className="bg-[#131926] border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-theme cursor-pointer"
                    >
                      {anime.dubs.map((l) => (
                        <option key={l} value={l}>
                          {l} Dub
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Comment textarea */}
                <div>
                  <textarea
                    rows={3}
                    required
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="How was the dialogue delivery, voice actor performance, script translation, and sound effects balance?..."
                    className="w-full bg-[#131926] border border-neutral-700/80 focus:border-primary-theme rounded-xl p-3 text-xs text-white placeholder-neutral-500 outline-none focus:ring-1 focus:ring-primary-theme resize-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={isSpoilerInput}
                        onChange={(e) => setIsSpoilerInput(e.target.checked)}
                        className="peer h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-primary-theme focus:ring-primary-theme/30 cursor-pointer appearance-none transition-all checked:bg-primary-theme"
                      />
                      <Check className="absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100 left-0.5 pointer-events-none transition-opacity" />
                    </div>
                    <span className="text-[11px] font-bold text-neutral-400 group-hover:text-neutral-300">Contains Spoilers?</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingReview || !commentInput.trim()}
                    className="px-5 py-2.5 rounded-xl btn-primary-theme disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Dub Review</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Reviews Feed */}
            <div className="space-y-3.5 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Community Feedback ({reviews.length})
              </h4>

              {reviews.length > 0 ? (
                reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-[#182032] border border-neutral-800 rounded-2xl p-4 space-y-2.5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={rev.userAvatar}
                          alt={rev.userName}
                          loading="lazy"
                          decoding="async"
                          className="w-8 h-8 rounded-full object-cover border border-primary-theme/40"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{rev.userName}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded badge-primary-theme">
                              {rev.language} Dub
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-500">
                            {new Date(rev.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      {rev.isSpoiler && !unblurredReviews.has(rev.id) ? (
                        <div 
                          onClick={() => {
                            const next = new Set(unblurredReviews);
                            next.add(rev.id);
                            setUnblurredReviews(next);
                          }}
                          className="relative p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 cursor-pointer overflow-hidden group"
                        >
                          <p className="text-xs text-neutral-300 blur-md select-none">
                            {rev.comment}
                          </p>
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-full border border-amber-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Spoiler Content
                            </span>
                            <span className="text-[9px] text-neutral-400 mt-2 font-bold">Tap to reveal review</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          {rev.comment}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <button
                        onClick={() => handleLike(rev.id)}
                        className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-accent-theme transition-colors cursor-pointer group"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        <span>Helpful ({rev.likes})</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-500 italic py-3 text-center">
                  Be the first to leave a review for the regional Indian dub of {anime.title}!
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Right 1 Column: Dub Status, Production Details & Streaming */}
        <div className="space-y-6">
          
          {/* Dub Status Breakdown Card */}
          <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-accent-theme" />
              <h3 className="font-heading font-black text-base text-white">
                Indian Dub Availability
              </h3>
            </div>

            <div className="space-y-2.5">
              {(anime.dubDetails || []).map((dub) => {
                const badge = DUB_LANGUAGE_BADGES[dub.language] || {
                  bg: 'bg-neutral-800',
                  text: 'text-neutral-200',
                  border: 'border-neutral-700',
                };
                return (
                  <div
                    key={dub.language}
                    className={`p-3 rounded-xl border ${badge.bg} ${badge.border} flex flex-col gap-1.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${badge.text}`}>
                        {dub.language} Dub
                      </span>
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.2 rounded font-semibold">
                        Available
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(dub.platform) ? dub.platform : [dub.platform]).filter(Boolean).map((p) => (
                        <span
                          key={p}
                          className="text-[9px] bg-black/40 text-neutral-300 px-1.5 py-0.5 rounded border border-white/10 font-medium"
                        >
                          {p}
                        </span>
                      ))}
                    </div>

                    {dub.notes && (
                      <p className="text-[10px] text-neutral-400 italic">
                        {dub.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Official Licensed Streaming Links */}
          <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-3">
            <h3 className="font-heading font-black text-base text-white">
              Official Streaming Links
            </h3>
            <p className="text-xs text-neutral-400">
              Watch legal, high quality streams with regional Indian audio and subtitles:
            </p>

            <div className="space-y-2 pt-1">
              {(anime.platforms || []).map((p) => (
                <SmartWatchButton
                  key={p.name}
                  platformName={p.name}
                  webUrl={p.url}
                  languages={p.languages}
                />
              ))}
            </div>
          </div>

          {/* Anime Production Details Panel */}
          <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-3.5 text-xs font-medium">
            <h3 className="font-heading font-black text-base text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-accent-theme" />
              <span>Production & Airing</span>
            </h3>

            <div className="space-y-2.5 divide-y divide-neutral-800/80 text-neutral-300">
              {/* Progress Summary (Dynamic Mixed Entries) */}
              {(anime.seasonDetails && anime.seasonDetails.length > 0) ? (
                <div className="bg-primary-theme/10 rounded-xl p-3 border border-primary-theme/20 mb-2 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-accent-theme">
                    <span>Series Progress Breakdown</span>
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {anime.seasonDetails.map((s, idx) => (
                      <div key={idx} className="bg-black/40 border border-white/5 rounded-lg p-2 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-neutral-500 uppercase leading-none mb-0.5">{s.type}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-white">{s.label}</span>
                            {s.languages && s.languages.length > 0 && (
                              <div className="flex gap-0.5">
                                {s.languages.map(l => (
                                  <span key={l} className="text-[7px] font-bold px-1 py-0.2 rounded badge-primary-theme">
                                    {l.substring(0, 2)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-accent-theme text-[10px] font-black">{s.episodeCount} EP</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-primary-theme/20">
                    <span className="text-[10px] font-bold text-accent-theme uppercase">Total Scope</span>
                    <span className="text-white text-[10px] font-black">
                      {anime.seasonDetails.filter(s => s.type === 'Season').length} Seasons • {anime.episodes} Episodes
                    </span>
                  </div>
                </div>
              ) : (anime.totalSeasons || anime.episodesPerSeason) && (
                <div className="bg-primary-theme/10 rounded-xl p-3 border border-primary-theme/20 mb-2 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-accent-theme">
                    <span>Series Scope</span>
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="flex gap-4">
                    {anime.totalSeasons && (
                      <div className="flex flex-col">
                        <span className="text-white text-base font-black leading-tight">{anime.totalSeasons}</span>
                        <span className="text-neutral-500 text-[9px] uppercase">Seasons</span>
                      </div>
                    )}
                    {anime.episodesPerSeason && (
                      <div className="flex flex-col">
                        <span className="text-white text-base font-black leading-tight">{anime.episodesPerSeason}</span>
                        <span className="text-neutral-500 text-[9px] uppercase">Eps/Season</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Current Live Status for Ongoing Anime */}
              {anime.status === 'Ongoing' && (anime.currentSeason || anime.currentlyAiringEpisode) && (
                <div className="bg-amber-950/20 rounded-xl p-3 border border-amber-500/30 mb-2 space-y-2 animate-pulse">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-amber-500">
                    <span>Live Airing Now</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  </div>
                  <div className="flex gap-4">
                    {anime.currentSeason && (
                      <div className="flex flex-col">
                        <span className="text-amber-200 text-base font-black leading-tight">S{anime.currentSeason}</span>
                        <span className="text-amber-600/80 text-[9px] uppercase">Current Season</span>
                      </div>
                    )}
                    {anime.currentlyAiringEpisode && (
                      <div className="flex flex-col">
                        <span className="text-amber-200 text-base font-black leading-tight">EP {anime.currentlyAiringEpisode}</span>
                        <span className="text-amber-600/80 text-[9px] uppercase">Airing Now</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <span className="text-neutral-500">Animation Studio</span>
                <span className="font-bold text-white">{anime.studio}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-neutral-500">Original Release Date</span>
                <span className="font-bold text-white">
                  {anime.originalReleaseDate || `${anime.releaseYear}`}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-neutral-500">Format</span>
                <span className="font-bold text-white">{anime.type}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-neutral-500">Status</span>
                <span className="font-bold text-white">{anime.status}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-neutral-500">Broadcast Day</span>
                <span className="font-bold text-white">
                  {anime.airingDay ? `Every ${anime.airingDay}` : 'Finished Airing'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Smart 'More Like This' Recommendation Section */}
      <MoreLikeThisSection
        currentAnime={anime}
        allAnime={allAnime}
        onSelectAnime={(selected) => onSelectSimilarAnime?.(selected)}
        onToggleWatchlist={onToggleWatchlist}
        limit={8}
      />

    </motion.div>
  );
};
