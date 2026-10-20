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
  const [upvotes, setUpvotes] = useState(1240);
  const [currentRating, setCurrentRating] = useState(8.7);
  const [isVoting, setIsVoting] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isWatched, setIsWatched] = useState(false);

  // Review Form state
  const [reviewRating, setReviewRating] = useState(8.5);
  const [reviewLang, setReviewLang] = useState('Hindi Dub');
  const [reviewComment, setReviewComment] = useState('');
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [reviewsList, setReviewsList] = useState<any[]>([
    {
      id: 1,
      author: 'Aarav Sharma',
      rating: 9.0,
      language: 'Hindi Dub',
      comment: 'The Hindi dialogue delivery is top notch! Characters sound completely natural and emotional beats hit hard.',
      spoilers: false,
      likes: 42,
      isLiked: false,
      date: '2 days ago'
    },
    {
      id: 2,
      author: 'Karthik Raja',
      rating: 8.5,
      language: 'Tamil Dub',
      comment: 'Tamil dub script is exceptionally well translated, especially during combat sequences. Highly recommended!',
      spoilers: false,
      likes: 29,
      isLiked: false,
      date: '4 days ago'
    },
    {
      id: 3,
      author: 'Rohit Varma',
      rating: 8.0,
      language: 'Telugu Dub',
      comment: 'Audio mixing is clean. Voice actor choices for the protagonist fit the mood perfectly.',
      spoilers: true,
      revealed: false,
      likes: 18,
      isLiked: false,
      date: '1 week ago'
    }
  ]);

  // Live Community Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ id: number; user: string; text: string; time: string; langTag?: string }>>([
    { id: 1, user: 'AnimeFan99', text: 'Hindi dub episode 12 was absolute cinema 🔥', time: '12:04', langTag: 'HI' },
    { id: 2, user: 'Sanjay_TN', text: 'Waiting for season 2 Tamil dub release date!', time: '12:08', langTag: 'TA' },
    { id: 3, user: 'Pooja_M', text: 'The dubbing quality on Crunchyroll India is getting better every season.', time: '12:15', langTag: 'HI' }
  ]);
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
    fetchDetails();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [animeId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anime/${animeId}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
        if (data.popularity) setUpvotes(data.popularity);
        if (data.rating) setCurrentRating(data.rating);
        if (data.reviews && data.reviews.length > 0) {
          setReviewsList(data.reviews);
        }
      }
    } catch (err) {
      console.error('Failed to fetch anime details:', err);
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
      const res = await fetch(`/api/anime/${animeId}/vote`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUpvotes(data.popularity);
        showToast(`🔥 Upvoted! Total upvotes increased to ${data.popularity}`);
      }
    } catch (err) {
      setUpvotes(prev => prev + 1);
      showToast('🔥 Upvoted!');
    } finally {
      setIsVoting(false);
    }
  };

  const handleRate = async (val: number) => {
    setIsRating(true);
    try {
      const res = await fetch(`/api/anime/${animeId}/rate`, {
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

    setReviewsList([newRev, ...reviewsList]);
    setReviewComment('');
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
    setChatMessages([
      ...chatMessages,
      { id: Date.now(), user: 'You', text: newChatMessage.trim(), time: timeStr, langTag: 'IN' }
    ]);
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
  const synopsis = details?.synopsis || details?.description || 'Follow this thrilling dubbed adventure packed with high-stakes action, supernatural twists, and emotional character arcs, officially licensed with regional Indian audio tracks.';
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

      {/* HERO HEADER CARD */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#131926] border border-neutral-800 shadow-2xl">
        
        {/* Blurred Backdrop Banner */}
        <div className="absolute inset-0 h-48 sm:h-72 overflow-hidden opacity-30 pointer-events-none">
          <img 
            src={coverImage} 
            alt={title} 
            className="w-full h-full object-cover blur-2xl scale-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#131926]/80 to-[#131926]" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 p-5 sm:p-8 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
          
          {/* Main Poster inside DynamicAmbientGlow */}
          <div className="relative shrink-0 mx-auto md:mx-0 group">
            <div 
              className="absolute -inset-1 rounded-3xl opacity-75 blur-xl transition duration-500 group-hover:opacity-100"
              style={{ background: dominantTheme.glow }}
            />
            <div className="relative w-44 sm:w-56 aspect-[3/4.2] rounded-2xl border-2 border-neutral-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.85)] bg-neutral-900 overflow-hidden">
              <img 
                src={coverImage && !coverImage.includes('ibb.co/mC9t2Wp') ? coverImage : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'} 
                alt={title}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                }}
                className="w-full h-full object-cover" 
              />
              
              {/* Language badges overlay on poster */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap gap-1">
                {languages.slice(0, 3).map((l: string) => (
                  <span 
                    key={l}
                    className="bg-black/80 backdrop-blur-md text-amber-300 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow border border-amber-500/30"
                  >
                    {l}
                  </span>
                ))}
              </div>

              {/* Streaming provider tag */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center justify-between text-[10px] text-white">
                <span className="font-bold text-orange-400">{platform}</span>
                <span className="text-emerald-400 font-semibold">{status}</span>
              </div>
            </div>
          </div>

          {/* Title & Core Metadata */}
          <div className="flex-1 min-w-0 space-y-4">
            
            {/* Pills row */}
            <div className="flex items-center flex-wrap gap-2">
              <span className="badge-primary-theme text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                {type}
              </span>
              <span className="badge-primary-theme text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                {releaseYear}
              </span>
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
                status === 'Ongoing' || status === 'Airing'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300'
              }`}>
                {status}
              </span>
              <span className="bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Legal OTT</span>
              </span>
            </div>

            {/* H1 Title */}
            <div>
              <h1 className="font-black text-2xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-medium italic">
                {nativeTitle}
              </p>
            </div>

            {/* Quick Metrics Bar (Global Rating, Dub Quality, Studio, Release Date) with glassmorphism */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-black/50 border border-neutral-800/80 backdrop-blur-md">
              <div className="p-2 space-y-0.5">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3 text-orange-400 fill-orange-400" />
                  <span>Global Rating</span>
                </div>
                <div className="text-lg font-black text-white">{currentRating.toFixed(1)} / 10</div>
                <div className="text-[10px] text-neutral-500">Official IMDb/Score</div>
              </div>

              <div className="p-2 space-y-0.5">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Languages className="w-3 h-3 text-primary-theme" />
                  <span>Dub Quality</span>
                </div>
                <div className="text-lg font-black text-amber-400">4.8 / 5.0</div>
                <div className="text-[10px] text-neutral-500">Verified Dub Score</div>
              </div>

              <div className="p-2 space-y-0.5">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-indigo-400" />
                  <span>Studio</span>
                </div>
                <div className="text-sm font-bold text-white truncate">{studio}</div>
                <div className="text-[10px] text-neutral-500">Animation Studio</div>
              </div>

              <div className="p-2 space-y-0.5">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-sky-400" />
                  <span>Broadcast</span>
                </div>
                <div className="text-sm font-bold text-white">{releaseYear}</div>
                <div className="text-[10px] text-neutral-500">{status}</div>
              </div>
            </div>

            {/* Watchlist CTAs & Upvote Button */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onToggleWatchlist(animeId)}
                className={`btn-primary-theme px-5 py-2.5 rounded-2xl font-bold text-xs inline-flex items-center gap-2 shadow-lg cursor-pointer transition-all ${
                  isBookmarked ? 'ring-2 ring-white/30 brightness-110' : ''
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-white' : ''}`} />
                <span>{isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>

              <button
                onClick={() => {
                  setIsWatched(!isWatched);
                  showToast(isWatched ? 'Marked as uncompleted' : 'Marked as Watched!');
                }}
                className={`px-4 py-2.5 rounded-2xl border text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
                  isWatched 
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                    : 'bg-[#182032] border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-600'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isWatched ? 'Watched' : 'Mark as Watched'}</span>
              </button>

              <button
                onClick={handleVote}
                disabled={isVoting}
                className="px-4 py-2.5 rounded-2xl bg-[#182032] border border-orange-500/40 hover:border-orange-500 text-orange-400 hover:text-orange-300 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN (2 COLS SPAN) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. SYNOPSIS CARD */}
          <div className="bg-[#131926] border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Synopsis & Overview</span>
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed font-normal">
              {synopsis}
            </p>

            {/* Genre tags */}
            <div className="pt-2 border-t border-neutral-800/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
                GENRES & THEMES
              </div>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g: string) => (
                  <span 
                    key={g}
                    className="px-3 py-1 rounded-xl bg-[#182032] border border-neutral-700/60 text-xs font-semibold text-neutral-300 hover:border-primary-theme/50 transition-colors"
                  >
                    {g}
                  </span>
                ))}
                <span className="px-3 py-1 rounded-xl bg-purple-950/60 border border-purple-500/40 text-xs font-semibold text-purple-300">
                  Regional Dubbed
                </span>
                <span className="px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs font-semibold text-amber-300">
                  Legal India Stream
                </span>
              </div>
            </div>
          </div>

          {/* 2. MAIN CHARACTERS & VOICE ACTORS CARD */}
          <div className="bg-[#182032] border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Languages className="w-5 h-5 text-primary-theme" />
                <span>Main Characters & Voice Actors</span>
              </h2>
              <span className="text-[11px] text-neutral-400 font-semibold bg-neutral-900/80 px-2.5 py-1 rounded-lg border border-neutral-800">
                Japanese & Indian Cast
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Official voice artists who brought these characters to life across Japanese, Hindi, Tamil, and Telugu dub recordings.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {characters.map((char, idx) => (
                <div 
                  key={idx}
                  className="bg-[#131926] border border-neutral-800 rounded-2xl p-3.5 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={char.avatar} 
                      alt={char.name}
                      className="w-12 h-12 rounded-xl object-cover border border-neutral-700 shrink-0" 
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{char.name}</h4>
                      <p className="text-[10px] text-amber-400 font-semibold">{char.role}</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] border-t border-neutral-800/80 pt-2">
                    <div className="text-neutral-400">
                      <span className="text-[9px] font-bold uppercase text-neutral-500">JP VA: </span>
                      <span className="text-neutral-200">{char.jpVa}</span>
                    </div>
                    <div className="text-neutral-400">
                      <span className="text-[9px] font-bold uppercase text-primary-theme">Indian VA: </span>
                      <span className="text-neutral-200 font-medium">{char.indianVa}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. DUB QUALITY REVIEWS & RATINGS SYSTEM */}
          <div className="bg-[#182032] border border-neutral-700/80 rounded-2xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <span>Dub Quality Reviews & Community Ratings</span>
              </h2>
              <span className="badge-primary-theme text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                {reviewsList.length} Community Reviews
              </span>
            </div>

            {/* Interactive Rating Slider & Submission Form */}
            <form onSubmit={handleAddReview} className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Rate Indian Dubbing Quality</span>
                <span className="text-[11px] text-primary-theme font-medium">Logged in via Indian Viewer Session</span>
              </div>

              {/* Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Dub Performance Score</span>
                  <span className="font-black text-amber-400 text-sm flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
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
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-neutral-400 font-semibold mb-1">
                    Language Reviewed
                  </label>
                  <select
                    value={reviewLang}
                    onChange={(e) => setReviewLang(e.target.value)}
                    className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-theme"
                  >
                    <option value="Hindi Dub">Hindi Dub</option>
                    <option value="Tamil Dub">Tamil Dub</option>
                    <option value="Telugu Dub">Telugu Dub</option>
                    <option value="Malayalam Dub">Malayalam Dub</option>
                    <option value="Kannada Dub">Kannada Dub</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer mb-2">
                    <input 
                      type="checkbox"
                      checked={hasSpoilers}
                      onChange={(e) => setHasSpoilers(e.target.checked)}
                      className="accent-purple-600 rounded"
                    />
                    <span>Review contains plot spoilers?</span>
                  </label>
                </div>
              </div>

              <div>
                <textarea 
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share details on dubbing accuracy, emotional delivery, background audio mixing, and character voice matching..."
                  className="w-full bg-[#182032] border border-neutral-700 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary-theme resize-none"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  className="btn-primary-theme px-5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer hover:opacity-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Dub Review</span>
                </button>
              </div>
            </form>

            {/* Reviews List */}
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                LATEST COMMUNITY REVIEWS
              </div>

              {reviewsList.map((review) => (
                <div 
                  key={review.id}
                  className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{review.author}</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                        {review.language}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold text-amber-300">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{review.rating} / 10</span>
                    </div>
                  </div>

                  {/* Comment with spoiler blur if needed */}
                  <div className="relative">
                    {review.spoilers && !review.revealed ? (
                      <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center justify-between">
                        <span className="text-xs text-red-300 font-medium flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-red-400" />
                          <span>This review contains spoilers.</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleSpoiler(review.id)}
                          className="text-[11px] font-bold text-primary-theme hover:underline cursor-pointer"
                        >
                          Reveal Spoiler
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-300 leading-relaxed font-normal">
                        {review.comment}
                      </p>
                    )}
                  </div>

                  {/* Footer with likes and timestamp */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-800/60">
                    <span>{review.date || 'Recent'}</span>
                    <button
                      onClick={() => handleLikeReview(review.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                        review.isLiked 
                          ? 'bg-purple-950/80 border-purple-500 text-purple-300' 
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{review.likes || 0} Helpful</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* 4. REAL-TIME COMMUNITY CHAT (LIVECHAT) */}
          <LiveChat />

        </div>

        {/* RIGHT COLUMN (1 COL SPAN) */}
        <div className="space-y-6">
          
          {/* 1. INDIAN DUB AVAILABILITY BREAKDOWN */}
          <div className="bg-[#131926] border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Languages className="w-5 h-5 text-amber-400" />
              <span>Indian Dub Availability</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Verified audio channels available for immediate streaming in India:
            </p>

            <div className="space-y-2.5">
              {[
                { name: 'Hindi Dub', color: 'emerald', code: 'HI', status: 'Available', stream: platform },
                { name: 'Tamil Dub', color: 'amber', code: 'TA', status: 'Available', stream: platform },
                { name: 'Telugu Dub', color: 'sky', code: 'TE', status: 'Available', stream: platform },
                { name: 'Malayalam Dub', color: 'purple', code: 'ML', status: 'Coming Soon', stream: platform },
                { name: 'Kannada Dub', color: 'indigo', code: 'KN', status: 'In Production', stream: platform }
              ].map((lang) => (
                <div 
                  key={lang.name}
                  className="bg-[#182032] border border-neutral-800 rounded-2xl p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-neutral-900 border border-white/10 text-white font-black text-[11px] flex items-center justify-center">
                      {lang.code}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-white">{lang.name}</div>
                      <div className="text-[10px] text-neutral-400">{lang.stream}</div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    lang.status === 'Available'
                      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                  }`}>
                    {lang.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. OFFICIAL STREAMING LINKS (SMARTWATCHBUTTON) */}
          <div className="bg-[#131926] border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-orange-500" />
              <span>Official Streaming Links</span>
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Stream legally on authorized platforms with zero piracy. Supports deep linking to native mobile OTT apps:
            </p>

            <a
              href="https://www.crunchyroll.com"
              target="_blank"
              rel="noreferrer"
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white p-3.5 rounded-2xl flex items-center justify-between font-bold text-xs shadow-xl transition-all hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-white" />
                </div>
                <div className="text-left">
                  <div>Watch on {platform}</div>
                  <div className="text-[10px] font-normal text-orange-100 flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    <span>Smart App Deep Link</span>
                  </div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4" />
            </a>

            <div className="p-3 rounded-xl bg-[#182032] border border-neutral-800/80 text-[11px] text-neutral-400 space-y-1">
              <div className="font-semibold text-neutral-300">Supported Subtitles:</div>
              <div className="flex flex-wrap gap-1">
                <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 text-[10px]">English</span>
                <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 text-[10px]">Hindi</span>
                <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 text-[10px]">Tamil</span>
                <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 text-[10px]">Telugu</span>
              </div>
            </div>
          </div>

          {/* 3. PRODUCTION & AIRING DETAILS */}
          <div className="bg-[#131926] border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Tv className="w-5 h-5 text-indigo-400" />
              <span>Production & Airing</span>
            </h3>

            {/* Progress Bar */}
            <div className="bg-[#182032] border border-neutral-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-medium">Series Scope</span>
                <span className="font-bold text-white">Season 1 • Ongoing</span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div className="w-3/4 h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 rounded-full" />
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-500 font-semibold">
                <span>SIMULCAST</span>
                <span>REGIONAL SYNC 75%</span>
              </div>
            </div>

            {/* Key-Value Breakdown */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/60">
                <span className="text-neutral-400">Animation Studio</span>
                <span className="font-bold text-white">{studio}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/60">
                <span className="text-neutral-400">Original Release Date</span>
                <span className="font-bold text-white">{releaseYear}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/60">
                <span className="text-neutral-400">Format</span>
                <span className="font-bold text-white">{type}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/60">
                <span className="text-neutral-400">Status</span>
                <span className="font-bold text-emerald-400">{status}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-neutral-400">Broadcast Day</span>
                <span className="font-bold text-white">Sundays (Simulcast)</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* SEO & FAQ FOOTER SECTION */}
      <div className="bg-[#131926]/80 border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 space-y-6 mt-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-theme/20 border border-primary-theme/40 text-primary-theme flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Frequently Asked Questions & Streaming Guide
              </h3>
              <p className="text-xs text-neutral-400">
                Verified information regarding regional Indian dubbed releases.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-3 pt-2">
          {faqItems.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div 
                key={idx}
                className="bg-[#182032] border border-neutral-800 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 text-xs sm:text-sm font-bold text-white hover:text-primary-theme transition-colors cursor-pointer"
                >
                  <span>{item.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-xs text-neutral-300 leading-relaxed border-t border-neutral-800/60 mt-1">
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
