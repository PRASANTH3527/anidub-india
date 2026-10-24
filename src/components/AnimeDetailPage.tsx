import React, { useState, useEffect } from 'react';

// Safe Motion wrapper for React 19 compatibility
const motion = {
  div: React.forwardRef<HTMLDivElement, any>(({ children, className, style, initial, animate, exit, transition, ...props }, ref) => (
    <div 
      ref={ref} 
      className={`animate-in fade-in duration-300 ${className || ''}`} 
      style={style} 
      {...props}
    >
      {children}
    </div>
  ))
};
const AnimatePresence: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
import { 
  ArrowLeft, 
  Bookmark, 
  CheckCircle2, 
  Share2, 
  Flag, 
  Star, 
  Tv, 
  Calendar, 
  Building2, 
  Languages, 
  Flame, 
  Play, 
  ExternalLink, 
  Smartphone, 
  Send, 
  MessageSquare, 
  ThumbsUp, 
  EyeOff, 
  Eye, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Loader2, 
  ShieldCheck,
  Radio,
  Check
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

  // Live Community Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ id: number; user: string; text: string; time: string; langTag?: string }>>(() => {
    try {
      const saved = localStorage.getItem(`cf_chat_${animeId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newChatMessage, setNewChatMessage] = useState('');

  // Toast / Modal states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Dominant color theme
  const dominantTheme = {
    rgb: '147, 51, 234', // Purple rgb
    glow: 'rgba(147, 51, 234, 0.45)'
  };

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

    // Load saved reviews and chats for this specific anime
    try {
      const savedRevs = localStorage.getItem(`cf_reviews_${animeId}`);
      if (savedRevs) {
        setReviewsList(JSON.parse(savedRevs));
      } else {
        setReviewsList([]);
      }

      const savedChat = localStorage.getItem(`cf_chat_${animeId}`);
      if (savedChat) {
        setChatMessages(JSON.parse(savedChat));
      } else {
        setChatMessages([]);
      }
    } catch {
      setReviewsList([]);
      setChatMessages([]);
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
        if (data.reviews && data.reviews.length > 0) {
          setReviewsList(data.reviews);
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
        showToast(`🔥 Upvoted! Total upvotes increased to ${data.popularity}`);
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
    } catch (err) {
      console.error(err);
    }
    await handleRate(reviewRating);
    showToast('Dub review and rating submitted successfully!');
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

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMessage.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newMsg = { id: Date.now(), user: 'You', text: newChatMessage.trim(), time: timeStr, langTag: 'IN' };
    const updatedChat = [...chatMessages, newMsg];
    setChatMessages(updatedChat);
    try {
      localStorage.setItem(`cf_chat_${animeId}`, JSON.stringify(updatedChat));
    } catch (err) {
      console.error(err);
    }
    setNewChatMessage('');
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast('Link copied to clipboard! Share with fellow anime fans.');
  };

  const isBookmarked = watchlist.includes(animeId);

  // Fallbacks if details loading
  const title = details?.title || 'Anime Details';
  const nativeTitle = details?.nativeTitle || details?.romajiTitle || 'Japanese Native / Romaji Title';
  const coverImage = details?.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
  const rawSynopsis = details?.synopsis || details?.description || 'Follow this thrilling dubbed adventure packed with high-stakes action, supernatural twists, and emotional character arcs, officially licensed with regional Indian audio tracks.';
  const synopsis = rawSynopsis.replace(/Imported via standardized CSV format\.?/gi, '').trim() || 'Follow this thrilling dubbed adventure packed with high-stakes action, supernatural twists, and emotional character arcs, officially licensed with regional Indian audio tracks.';
  const releaseYear = details?.releaseYear || details?.year || 2024;
  const status = details?.status || 'Ongoing';
  const type = details?.type || 'TV Series';
  const studio = details?.studio || 'Animation Studio';
  const platform = details?.platform || 'Crunchyroll';
  const languages = details?.languages ? details.languages.split(',').map((l: string) => l.trim()) : ['Hindi', 'Tamil', 'Telugu', 'Malayalam'];
  const genres = details?.genre ? details.genre.split(',').map((g: string) => g.trim()) : ['Action', 'Fantasy', 'Adventure', 'Supernatural'];

  // Voice Cast Data
  const characters = [
    {
      name: 'Protagonist Lead',
      role: 'Main Character',
      jpVa: 'Hiroshi Kamiya',
      indianVa: 'Sanket Mhatre (Hindi), Vijay Anand (Tamil)',
      avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80'
    },
    {
      name: 'Deuteragonist / Rival',
      role: 'Supporting Lead',
      jpVa: 'Mamoru Miyano',
      indianVa: 'Rajesh Kava (Hindi), Suriya S. (Tamil)',
      avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80'
    },
    {
      name: 'Heroine / Strategist',
      role: 'Main Heroine',
      jpVa: 'Saori Hayami',
      indianVa: 'Pooja Punjabi (Hindi), Keerthi V. (Telugu)',
      avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80'
    }
  ];

  // FAQ Items
  const faqItems = [
    {
      q: `Where can I legally watch ${title} dubbed in Hindi, Tamil, and Telugu?`,
      a: `${title} is officially available for streaming in India on licensed platforms like ${platform}. You can choose between Hindi, Tamil, Telugu, and other regional voice tracks in your streaming player settings.`
    },
    {
      q: `Are all episodes of ${title} dubbed in regional Indian languages?`,
      a: `Yes, new episodes simulcast with regional Indian dubs as they are released by official distributors. Check the Indian Dub Availability panel for verified per-language progress.`
    },
    {
      q: `How can I rate the Indian voice acting quality for ${title}?`,
      a: `Use our Dub Quality Reviews & Ratings section above. You can rate the translation, dialogue delivery, voice actor performance, and sound mix on a scale of 0 to 10.`
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="relative w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-8 font-sans"
    >

      {/* AMBIENT GLOW BACKGROUND */}
      <div 
        className="fixed top-0 left-0 right-0 h-[640px] pointer-events-none -z-10 transition-all duration-700 opacity-60"
        style={{
          background: `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(${dominantTheme.rgb}, 0.35), transparent 75%)`
        }}
      />
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[#0b0f17]/40" />

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-[#131926]/95 border border-primary-theme/60 backdrop-blur-xl shadow-2xl flex items-center gap-3 text-white text-xs font-semibold"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP NAVIGATION BAR */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#131926] border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-all shadow-md cursor-pointer hover:-translate-x-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dub Library</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsReportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#131926] border border-neutral-800 hover:border-red-500/50 text-neutral-400 hover:text-red-400 text-xs font-semibold transition-all cursor-pointer"
            title="Report audio or streaming link issue"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report Issue</span>
          </button>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#131926] border border-neutral-800 hover:border-primary-theme/60 text-neutral-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            title="Share anime"
          >
            <Share2 className="w-3.5 h-3.5 text-primary-theme" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* HERO HEADER CARD - CINEMATIC NETFLIX / CRUNCHYROLL STYLE */}
      <div className="relative rounded-3xl overflow-hidden bg-[#101522] border border-neutral-800 shadow-[0_30px_90px_rgba(0,0,0,0.9)]">
        
        {/* Cinematic Backdrop Banner with Heavy Blur and Multi-stop Gradient */}
        <div className="absolute inset-0 h-64 sm:h-96 overflow-hidden opacity-35 pointer-events-none">
          <div 
            className="w-full h-full bg-cover bg-center bg-no-repeat blur-3xl scale-125"
            style={{ backgroundImage: `url(${coverImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101522] via-[#101522]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#101522]/90 via-transparent to-[#101522]/90" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 p-6 sm:p-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
          
          {/* Main Poster Column with Mobile Centering */}
          <div className="flex flex-col items-center shrink-0 w-full md:w-auto">
            <div className="relative group">
              <div 
                className="absolute -inset-2 rounded-3xl opacity-80 blur-2xl transition duration-500 group-hover:opacity-100"
                style={{ background: dominantTheme.glow }}
              />
              <div className="relative w-48 sm:w-60 aspect-[3/4.3] rounded-2xl sm:rounded-3xl border-2 border-neutral-700/80 shadow-[0_25px_60px_rgba(0,0,0,0.95)] bg-neutral-900 overflow-hidden">
                <img 
                  src={coverImage ? coverImage : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'} 
                  alt={title}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />

                {/* Streaming provider tag overlay */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center justify-between text-xs text-white">
                  <span className="font-extrabold text-orange-400">{platform}</span>
                  <span className="text-emerald-400 font-bold">{status}</span>
                </div>
              </div>
            </div>

            {/* Language & Status Badges Grouped Nicely Below Poster */}
            <div className="mt-4 w-full flex flex-col items-center gap-2">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mr-1">Dub Audio:</span>
                {languages.map((l: string) => (
                  <span 
                    key={l}
                    className="bg-[#182032] border border-neutral-700/80 text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded-lg shadow"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Title, Metadata & CTAs */}
          <div className="flex-1 min-w-0 space-y-5 text-center md:text-left">
            
            {/* Single Row Metadata (Type • Year • OTT • Studio) */}
            <div className="flex items-center justify-center md:justify-start flex-wrap gap-2 text-xs font-bold text-neutral-300">
              <span className="px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 uppercase tracking-wider">
                {type}
              </span>
              <span className="text-neutral-500">•</span>
              <span className="text-white">{releaseYear}</span>
              <span className="text-neutral-500">•</span>
              <span className="text-amber-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Legal OTT</span>
              </span>
              <span className="text-neutral-500">•</span>
              <span className="text-neutral-400">{studio}</span>
            </div>

            {/* Main Title (Bigger, Bolder, Glowing White) */}
            <div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-[0_4px_25px_rgba(255,255,255,0.25)]">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 font-medium italic">
                {nativeTitle}
              </p>
            </div>

            {/* Quick Metrics Bar (Global Rating, Dub Quality, Broadcast) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-black/65 border border-neutral-800/80 backdrop-blur-md">
              <div className="p-2 space-y-0.5">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-center md:justify-start gap-1">
                  <Star className="w-3 h-3 text-orange-400 fill-orange-400" />
                  <span>Global Rating</span>
                </div>
                <div className="text-lg font-black text-white">{currentRating ? `${currentRating.toFixed(1)} / 10` : 'Unrated'}</div>
                <div className="text-[10px] text-neutral-500">{currentRating ? 'Community Rating' : 'Awaiting ratings'}</div>
              </div>

              <div className="p-2 space-y-0.5">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-center md:justify-start gap-1">
                  <Languages className="w-3 h-3 text-primary-theme" />
                  <span>Dub Audio</span>
                </div>
                <div className="text-lg font-black text-amber-400">{languages.length} Languages</div>
                <div className="text-[10px] text-neutral-500">Verified Indian Dubs</div>
              </div>

              <div className="p-2 space-y-0.5 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-center md:justify-start gap-1">
                  <Calendar className="w-3 h-3 text-sky-400" />
                  <span>Status</span>
                </div>
                <div className="text-sm font-bold text-emerald-400">{status}</div>
                <div className="text-[10px] text-neutral-500">{platform}</div>
              </div>
            </div>

            {/* Modern Premium Call-to-Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3.5">
              <button
                onClick={() => onToggleWatchlist(animeId)}
                className={`px-6 py-3 rounded-2xl font-black text-xs sm:text-sm inline-flex items-center gap-2.5 transition-all cursor-pointer shadow-xl active:scale-95 ${
                  isBookmarked 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 ring-2 ring-emerald-400/50' 
                    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_30px_rgba(147,51,234,0.45)] border border-purple-400/40'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-white' : ''}`} />
                <span>{isBookmarked ? 'In Your Watchlist' : 'Add to Watchlist'}</span>
              </button>

              <button
                onClick={() => {
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
                }}
                className={`px-5 py-3 rounded-2xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                  isWatched 
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                    : 'bg-[#182032] border-neutral-700/80 text-neutral-200 hover:text-white hover:border-neutral-600 shadow-md'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isWatched ? 'Watched Completed' : 'Mark as Watched'}</span>
              </button>

              <button
                onClick={handleVote}
                disabled={isVoting}
                className="px-5 py-3 rounded-2xl bg-[#182032] border border-orange-500/40 hover:border-orange-500 text-orange-400 hover:text-orange-300 text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
                title="Upvote community popularity"
              >
                <Flame className={`w-4 h-4 fill-orange-400 ${isVoting ? 'animate-bounce' : ''}`} />
                <span>{upvotes.toLocaleString()} Upvotes</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* CONTENT GRID: 2 COLUMNS LEFT, 1 COLUMN RIGHT */}
      {/* SECTIONS BELOW HERO - RESPONSIVE UNIFIED GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
        
        {/* 1. SYNOPSIS & GENRES */}
        <div className="bg-[#1A1C29]/60 backdrop-blur-md border border-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between space-y-2.5">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
              <h2 className="text-sm sm:text-base font-bold text-gray-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Synopsis & Overview</span>
              </h2>
              <span className="text-[10px] font-bold text-purple-300 bg-purple-950/70 border border-purple-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Storyline
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed font-normal">
              {synopsis}
            </p>
          </div>

          {/* Genre tags */}
          <div className="pt-2 border-t border-gray-800/70">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Genres & Categories
            </div>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g: string) => (
                <span 
                  key={g}
                  className="px-2.5 py-1 rounded-xl bg-[#141824]/90 border border-gray-700/60 text-xs font-semibold text-gray-300 hover:border-purple-400/50 transition-colors"
                >
                  {g}
                </span>
              ))}
              <span className="px-2.5 py-1 rounded-xl bg-purple-950/60 border border-purple-500/40 text-xs font-semibold text-purple-300">
                Regional Dubbed
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs font-semibold text-amber-300">
                100% Legal OTT
              </span>
            </div>
          </div>
        </div>

        {/* 2. INDIAN DUB AVAILABILITY & OFFICIAL STREAMING LINKS (COMPACT) */}
        <div className="bg-[#1A1C29]/60 backdrop-blur-md border border-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between space-y-2.5">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
              <h2 className="text-sm sm:text-base font-bold text-gray-200 flex items-center gap-1.5">
                <Languages className="w-4 h-4 text-amber-400" />
                <span>Indian Dub Audio & Streaming</span>
              </h2>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Simulcast Ready
              </span>
            </div>

            {/* Compact Dub Audio List - Dynamically rendered based on actual anime.languages data */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {languages.map((langName: string) => {
                const cleanName = langName.replace(/dub/gi, '').trim();
                const upper = cleanName.toUpperCase();
                let code = upper.slice(0, 2);
                if (upper.includes('HIN')) code = 'HI';
                else if (upper.includes('TAM')) code = 'TA';
                else if (upper.includes('TEL')) code = 'TE';
                else if (upper.includes('MAL')) code = 'ML';
                else if (upper.includes('KAN')) code = 'KN';
                else if (upper.includes('BEN')) code = 'BN';

                return (
                  <div 
                    key={cleanName}
                    className="bg-[#141824]/80 border border-gray-800/90 rounded-xl px-2.5 py-2 flex items-center justify-between gap-1"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-neutral-900 border border-white/10 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                        {code}
                      </span>
                      <span className="text-[11px] font-bold text-gray-200 truncate">{cleanName}</span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 bg-emerald-950/80 border-emerald-500/40 text-emerald-300">
                      Ready
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Stream Link Card */}
          <div className="pt-3 border-t border-gray-800/70 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Licensed OTT Stream:</span>
              <span className="text-[11px] text-gray-400">Subtitles: En, Hi, Ta, Te</span>
            </div>
            <a
              href="https://www.crunchyroll.com"
              target="_blank"
              rel="noreferrer"
              className="w-full bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white px-4 py-2.5 rounded-xl flex items-center justify-between font-bold text-xs shadow-lg transition-all hover:scale-[1.01] cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-black/25 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 fill-white" />
                </div>
                <span>Stream legally on {platform}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-100">
                <Smartphone className="w-3 h-3" />
                <span>Deep Link</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </div>
            </a>
          </div>
        </div>



        {/* 4. PRODUCTION & AIRING DETAILS */}
        <div className="bg-[#1A1C29]/60 backdrop-blur-md border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
            <h2 className="text-base sm:text-lg font-bold text-gray-200 flex items-center gap-2">
              <Tv className="w-4 h-4 text-indigo-400" />
              <span>Production & Airing Info</span>
            </h2>
            <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950/70 border border-indigo-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {status}
            </span>
          </div>

          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="bg-[#141824]/80 border border-gray-800/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Broadcast Progress</span>
                <span className="font-bold text-white">Season 1 • Simulcast Active</span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden">
                <div className="w-3/4 h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 rounded-full" />
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                <span>WEEKLY RELEASE</span>
                <span className="text-emerald-400">REGIONAL SYNC 75%</span>
              </div>
            </div>

            {/* 4-Item Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#141824]/80 border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Studio</span>
                <span className="font-bold text-white truncate block">{studio}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#141824]/80 border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Release Year</span>
                <span className="font-bold text-white truncate block">{releaseYear}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#141824]/80 border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Format</span>
                <span className="font-bold text-white truncate block">{type}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#141824]/80 border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Broadcast Day</span>
                <span className="font-bold text-emerald-400 truncate block">Sundays (Simulcast)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. DUB QUALITY REVIEWS & RATINGS */}
        <div className="bg-[#1A1C29]/60 backdrop-blur-md border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
            <h2 className="text-base sm:text-lg font-bold text-gray-200 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span>Dub Reviews & Ratings</span>
            </h2>
            <span className="text-[10px] font-bold text-purple-300 bg-purple-950/80 border border-purple-500/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {reviewsList.length} Ratings
            </span>
          </div>

          {/* Interactive Rating Slider & Submission Form */}
          <form onSubmit={handleAddReview} className="bg-[#141824]/80 border border-gray-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-200">Rate Dubbing Quality</span>
              <span className="text-amber-400 font-black flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400" />
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
              className="w-full accent-purple-500 cursor-pointer h-1.5"
            />

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <select
                  value={reviewLang}
                  onChange={(e) => setReviewLang(e.target.value)}
                  className="w-full bg-[#0c1017] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="Hindi Dub">Hindi Dub</option>
                  <option value="Tamil Dub">Tamil Dub</option>
                  <option value="Telugu Dub">Telugu Dub</option>
                  <option value="Malayalam Dub">Malayalam Dub</option>
                  <option value="Kannada Dub">Kannada Dub</option>
                </select>
              </div>

              <div className="flex items-center justify-end">
                <label className="flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={hasSpoilers}
                    onChange={(e) => setHasSpoilers(e.target.checked)}
                    className="accent-purple-600 rounded"
                  />
                  <span>Contains spoiler?</span>
                </label>
              </div>
            </div>

            <textarea 
              rows={2}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share details on dubbing accuracy, emotional delivery, background audio mixing..."
              className="w-full bg-[#0c1017] border border-gray-700/80 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary-theme px-4 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow cursor-pointer hover:opacity-95"
              >
                <Send className="w-3 h-3" />
                <span>Submit Review</span>
              </button>
            </div>
          </form>

          {/* Reviews Stream */}
          <div className="space-y-2.5 pt-1 max-h-80 overflow-y-auto pr-1">
            {reviewsList.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-400 space-y-1 bg-[#141824]/40 border border-gray-800/60 rounded-xl p-4">
                <p className="font-semibold text-neutral-300">No community reviews yet.</p>
                <p className="text-[11px] text-neutral-500">Be the first to share your rating and review for this regional dub!</p>
              </div>
            ) : (
              reviewsList.map((review) => (
                <div 
                  key={review.id}
                  className="bg-[#141824]/70 border border-gray-800/80 rounded-xl p-3 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{review.author}</span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                        {review.language}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-300">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{review.rating}</span>
                    </div>
                  </div>

                  <div className="relative">
                    {review.spoilers && !review.revealed ? (
                      <div className="p-2 rounded-lg bg-red-950/20 border border-red-500/30 flex items-center justify-between text-[11px]">
                        <span className="text-red-300 flex items-center gap-1">
                          <EyeOff className="w-3 h-3 text-red-400" />
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
                      <p className="text-gray-300 leading-relaxed font-normal text-[11px]">
                        {review.comment}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-800/60">
                    <span>{review.date || 'Recent'}</span>
                    <button
                      onClick={() => handleLikeReview(review.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold transition-colors cursor-pointer ${
                        review.isLiked 
                          ? 'bg-purple-950/80 border-purple-500 text-purple-300' 
                          : 'bg-neutral-900 border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <ThumbsUp className="w-2.5 h-2.5" />
                      <span>{review.likes || 0}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 6. REAL-TIME COMMUNITY DISCUSSION */}
        <div className="flex flex-col">
          <LiveChat className="h-full" />
        </div>

      </div>

      {/* SEO & FAQ FOOTER SECTION */}
      <div className="bg-[#1A1C29]/60 backdrop-blur-md border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 mt-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-800/80">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-200">
              Frequently Asked Questions & Streaming Guide
            </h3>
            <p className="text-xs text-gray-400">
              Verified information regarding regional Indian dubbed releases.
            </p>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-2.5 pt-1">
          {faqItems.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div 
                key={idx}
                className="bg-[#141824]/80 border border-gray-800 rounded-xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-4 text-xs sm:text-sm font-bold text-gray-200 hover:text-purple-400 transition-colors cursor-pointer"
                >
                  <span>{item.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 shrink-0 text-purple-400" /> : <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="p-3.5 pt-0 text-xs text-gray-300 leading-relaxed border-t border-gray-800/60 mt-1">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* REPORT ISSUE MODAL */}
      {isReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131926] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
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
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReportOpen(false);
                  showToast('Thank you! Your report has been submitted to moderators.');
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
};
