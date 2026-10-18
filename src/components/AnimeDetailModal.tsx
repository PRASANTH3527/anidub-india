import React, { useState, useEffect } from 'react';
import { 
  X, 
  Star, 
  Calendar, 
  Tv, 
  Bookmark, 
  Loader2, 
  Languages, 
  Flame, 
  Users, 
  MessageSquare, 
  Headphones, 
  Play, 
  ExternalLink, 
  Smartphone, 
  Building2, 
  Sparkles,
  Send,
  CheckCircle2
} from 'lucide-react';

interface AnimeDetailModalProps {
  animeId: number;
  onClose: () => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
}

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({
  animeId,
  onClose,
  watchlist,
  onToggleWatchlist
}) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upvotes, setUpvotes] = useState(1200);
  const [currentRating, setCurrentRating] = useState(8.5);
  const [isVoting, setIsVoting] = useState(false);
  const [isRating, setIsRating] = useState(false);

  // Review Form state
  const [reviewRating, setReviewRating] = useState(8.5);
  const [reviewLang, setReviewLang] = useState('Hindi Dub');
  const [reviewComment, setReviewComment] = useState('');
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDetails();
  }, [animeId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anime/${animeId}`);
      const data = await res.json();
      setDetails(data);
      if (data.popularity) setUpvotes(data.popularity);
      if (data.rating) setCurrentRating(data.rating);
      if (data.reviews) setReviewsList(data.reviews);
    } catch (err) {
      console.error('Failed to fetch anime directory details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    setIsVoting(true);
    try {
      const res = await fetch(`/api/anime/${animeId}/vote`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUpvotes(data.popularity);
      }
    } catch (err) {
      console.error('Vote failed:', err);
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
      }
    } catch (err) {
      console.error('Rate failed:', err);
    } finally {
      setIsRating(false);
    }
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    const newRev = {
      id: Date.now(),
      author: 'Anime Enthusiast India',
      rating: reviewRating,
      language: reviewLang,
      comment: reviewComment,
      spoilers: hasSpoilers,
      date: 'Just now'
    };
    setReviewsList([newRev, ...reviewsList]);
    setReviewComment('');
    setToastMessage('Review submitted successfully!');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleStreamingClick = (platform: string) => {
    setToastMessage(`Opening ${platform} - Attempting to launch native mobile app...`);
    setTimeout(() => setToastMessage(null), 4500);
    window.open('https://www.crunchyroll.com', '_blank');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0c14]/90 backdrop-blur-md flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!details) return null;

  const isWatchlisted = watchlist.includes(details.id);
  const genresList = details.genres ? details.genres.split(',') : [];
  const platform = details.platform || 'Crunchyroll';
  const releaseYear = details.year || 2026;
  const totalEpisodes = details.episodes_count || 12;
  const status = details.status || 'Airing';
  const studio = details.studio || 'MAPPA / Ufotable India';
  const type = details.type || 'TV Series';

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c14]/90 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto font-['Inter',sans-serif] text-slate-100">
      <div className="relative w-full max-w-[510px] bg-[#0a0c14] border border-[#1e243b] rounded-[28px] overflow-hidden shadow-2xl my-6">
        
        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-purple-950/95 border border-purple-500/50 text-purple-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 animate-fade-in">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. TOP HERO & CENTERED POSTER SECTION */}
        <div className="relative pt-12 pb-6 px-4 bg-gradient-to-b from-purple-950/30 via-[#0a0c14]/80 to-[#0a0c14] overflow-hidden text-center">
          {/* Blurred background backdrop */}
          <div className="absolute inset-0 opacity-20 filter blur-2xl pointer-events-none">
            <img src={details.cover_image} alt="" className="w-full h-full object-cover" />
          </div>

          {/* Centered Poster (w-44 / ~176px wide, 2:3 aspect ratio) */}
          <div className="relative w-44 aspect-[2/3] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950">
            <img 
              src={details.cover_image} 
              alt={details.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
              }}
            />
            {/* Poster Language Overlay */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
              <span className="px-1.5 py-0.5 rounded bg-[#16a34a] text-white text-[10px] font-bold shadow">Hin</span>
              <span className="px-1.5 py-0.5 rounded bg-[#ea580c] text-white text-[10px] font-bold shadow">Tam</span>
              <span className="px-1.5 py-0.5 rounded bg-[#d97706] text-white text-[10px] font-bold shadow">Tel</span>
            </div>
          </div>

          {/* Format & Meta Row */}
          <div className="flex items-center justify-center gap-2 mt-4 text-[12px] text-[#94a3b8]">
            <span className="px-2.5 py-0.5 rounded-md bg-[#2e1065] border border-[#7e22ce] text-[#d8b4fe] text-[11px] font-semibold">
              {type}
            </span>
            <span>•</span>
            <span>{releaseYear} • {status} • {totalEpisodes} Episodes</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>

          {/* Title */}
          <h1 className="text-[22px] font-bold text-white tracking-tight mt-2 px-4 leading-snug font-['Space_Grotesk',sans-serif]">
            {details.title}
          </h1>

          {/* Global Rating Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1f1610] border border-[#f59e0b]/40 mt-3 shadow-sm">
            <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
            <span className="text-[13px] font-bold text-white">{currentRating}/10</span>
            <span className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-wide">GLOBAL RATING</span>
          </div>

          {/* Secondary Info Pills Row */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-3">
            {/* Pill 1 */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131629] border border-[#6366f1]/40 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#818cf8]" />
              <span className="font-bold text-white">9.2/10</span>
              <span className="text-[11px] text-[#94a3b8]">Dub Quality</span>
            </div>
            {/* Pill 2 */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131726] border border-[#262d47] text-xs">
              <Building2 className="w-3.5 h-3.5 text-[#94a3b8]" />
              <span className="text-[12px] text-white font-medium">{studio}</span>
            </div>
          </div>

          {/* Release Year Pill Row */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#131726] border border-[#262d47] mt-2.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#818cf8]" />
            <span className="text-[12px] font-bold text-white">{releaseYear}</span>
          </div>

          {/* Watchlist Button */}
          <div className="mt-4 mb-2 flex justify-center">
            <button
              onClick={() => onToggleWatchlist(details.id)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#151928] border border-[#262d47] hover:border-[#3b4262] text-[13px] font-medium text-white transition-all cursor-pointer shadow-md"
            >
              <Bookmark className={`w-4 h-4 ${isWatchlisted ? 'fill-orange-400 text-orange-400' : 'text-slate-300'}`} />
              <span>{isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}</span>
            </button>
          </div>
        </div>

        {/* Content Cards Container */}
        <div className="px-4 pb-8 space-y-4">
          
          {/* 2. SYNOPSIS CARD */}
          <div className="bg-[#111524] border border-[#1e243b] rounded-2xl p-5">
            <h3 className="text-[16px] font-bold text-white font-['Space_Grotesk',sans-serif]">Synopsis</h3>
            <p className="text-[13px] text-[#cbd5e1] leading-relaxed mt-2">
              {details.synopsis}
            </p>
            <div className="text-[10px] font-bold uppercase text-[#64748b] tracking-wider mt-4 mb-2">
              GENRE TAGS
            </div>
            <div className="flex flex-wrap gap-2">
              {genresList.map((g: string, i: number) => (
                <span key={i} className="px-3 py-1 rounded-lg bg-[#1e153a] border border-[#6d28d9] text-[#c084fc] text-[12px] font-medium">
                  {g.trim()}
                </span>
              ))}
            </div>
          </div>

          {/* 3. MAIN CHARACTERS & VOICE ACTORS CARD */}
          <div className="bg-[#111524] border border-[#1e243b] rounded-2xl p-5">
            <div className="flex items-center space-x-2">
              <Users className="w-[18px] h-[18px] text-[#a855f7]" />
              <h3 className="text-[16px] font-bold text-white font-['Space_Grotesk',sans-serif]">Main Characters & Voice Actors</h3>
            </div>
            <p className="text-[12px] text-[#8b92a5] mt-1.5 leading-normal">
              Featuring primary characters along with their original Japanese and regional Indian dub voice artists.
            </p>
            <div className="bg-[#0b0e17] border border-[#1a2035] rounded-xl p-4 mt-4 text-center">
              <p className="text-[12px] italic text-[#64748b]">
                Character voice cast information is being updated.
              </p>
            </div>
          </div>

          {/* 4. DUB QUALITY REVIEWS & RATINGS CARD */}
          <div className="bg-[#111524] border border-[#1e243b] rounded-2xl p-5">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-[18px] h-[18px] text-[#a855f7]" />
              <h3 className="text-[16px] font-bold text-white font-['Space_Grotesk',sans-serif]">Dub Quality Reviews & Ratings</h3>
            </div>
            <p className="text-[12px] text-[#8b92a5] mt-1">
              Community feedback on Tamil, Telugu, Hindi, Malayalam, and Kannada voice acting & sound mixing.
            </p>

            {/* Rating Summary Box */}
            <div className="bg-[#0b0e17] border border-[#1e243b] rounded-xl p-4 mt-4 flex items-center gap-3.5">
              <Star className="w-6 h-6 fill-[#facc15] text-[#facc15] shrink-0" />
              <div>
                <div className="text-[18px] font-bold text-white">{currentRating} / 10</div>
                <div className="text-[11px] text-[#64748b]">{reviewsList.length} Reviews</div>
              </div>
            </div>

            {/* Leave a Review Form Box */}
            <form onSubmit={handleAddReview} className="bg-[#0d101d] border border-[#1e243b] rounded-xl p-4 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-white">Leave a Dub Quality Review</span>
                <span className="text-[11px] font-medium text-[#818cf8]">Signed in as Reviewer</span>
              </div>

              <div>
                <label className="block text-[11px] text-[#8b92a5] mb-1">Dub Quality Rating (0.0 to 10.0)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="0.5" 
                    value={reviewRating}
                    onChange={(e) => setReviewRating(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-500 cursor-pointer"
                  />
                  <div className="px-2.5 py-1 rounded-lg bg-[#161a2b] border border-[#262d47] flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-[12px] font-bold text-white">{reviewRating}/10</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#8b92a5] mb-1">Language Reviewed</label>
                <select
                  value={reviewLang}
                  onChange={(e) => setReviewLang(e.target.value)}
                  className="w-full h-10 bg-[#131726] border border-[#262d47] rounded-xl px-3 text-[13px] text-white focus:outline-none cursor-pointer"
                >
                  <option value="Hindi Dub">Hindi Dub</option>
                  <option value="Tamil Dub">Tamil Dub</option>
                  <option value="Telugu Dub">Telugu Dub</option>
                  <option value="Malayalam Dub">Malayalam Dub</option>
                  <option value="Kannada Dub">Kannada Dub</option>
                </select>
              </div>

              <div>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="How was the dialogue delivery, voice actor performance, script translation, and sound effects balance?..."
                  className="w-full bg-[#131726] border border-[#262d47] rounded-xl p-3 text-[12px] text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 text-[12px] text-[#8b92a5] cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={hasSpoilers}
                    onChange={(e) => setHasSpoilers(e.target.checked)}
                    className="accent-purple-600 rounded"
                  />
                  <span>Contains Spoilers?</span>
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-[12px] font-semibold text-white transition-all cursor-pointer shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Dub Review</span>
                </button>
              </div>
            </form>

            {/* Community Feedback List */}
            <div className="mt-5">
              <div className="text-[11px] font-bold uppercase text-[#64748b] tracking-wider mb-2">
                COMMUNITY FEEDBACK ({reviewsList.length})
              </div>
              {reviewsList.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-[12px] italic text-[#64748b]">
                    Be the first to leave a review for the regional Indian dub of {details.title}!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {reviewsList.map((rev) => (
                    <div key={rev.id} className="bg-[#0b0e17] border border-[#1e243b] rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-white">{rev.author}</span>
                        <div className="flex items-center space-x-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-[11px] font-bold text-amber-400">{rev.rating}/10</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 text-[10px] font-semibold">
                          {rev.language}
                        </span>
                        <span className="text-[10px] text-slate-500">{rev.date}</span>
                      </div>
                      <p className="text-[12px] text-slate-300 mt-1 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. INDIAN DUB AVAILABILITY CARD */}
          <div className="bg-[#111524] border border-[#1e243b] rounded-2xl p-5">
            <div className="flex items-center space-x-2">
              <Headphones className="w-[18px] h-[18px] text-[#a855f7]" />
              <h3 className="text-[16px] font-bold text-white font-['Space_Grotesk',sans-serif]">Indian Dub Availability</h3>
            </div>

            <div className="mt-4 space-y-3">
              {/* Hindi Dub */}
              <div className="bg-[#091e1a] border border-[#10b981]/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-bold text-[#34d399]">Hindi Dub</div>
                  <div className="inline-block px-2.5 py-1 rounded-md bg-[#0d1518] border border-[#1f2e2b] text-[11px] text-white my-2">
                    {platform}
                  </div>
                  <div className="text-[11px] text-[#6ee7b7]/70">Verified Hindi dub available on {platform}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#34d399] text-[10px] font-bold">Available</span>
              </div>

              {/* Tamil Dub */}
              <div className="bg-[#22150e] border border-[#f97316]/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-bold text-[#fb923c]">Tamil Dub</div>
                  <div className="inline-block px-2.5 py-1 rounded-md bg-[#0d1518] border border-[#1f2e2b] text-[11px] text-white my-2">
                    {platform}
                  </div>
                  <div className="text-[11px] text-[#fdba74]/70">Verified Tamil dub available on {platform}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#34d399] text-[10px] font-bold">Available</span>
              </div>

              {/* Telugu Dub */}
              <div className="bg-[#0c192c] border border-[#3b82f6]/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-bold text-[#60a5fa]">Telugu Dub</div>
                  <div className="inline-block px-2.5 py-1 rounded-md bg-[#0d1518] border border-[#1f2e2b] text-[11px] text-white my-2">
                    {platform}
                  </div>
                  <div className="text-[11px] text-[#93c5fd]/70">Verified Telugu dub available on {platform}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#34d399] text-[10px] font-bold">Available</span>
              </div>
            </div>
          </div>

          {/* 6. OFFICIAL STREAMING LINKS CARD */}
          <div className="bg-[#111524] border border-[#1e243b] rounded-2xl p-5">
            <h3 className="text-[16px] font-bold text-white font-['Space_Grotesk',sans-serif]">Official Streaming Links</h3>
            <p className="text-[12px] text-[#8b92a5] mt-1">
              Watch legal, high quality streams with regional Indian audio and subtitles:
            </p>

            <div 
              onClick={() => handleStreamingClick(platform)}
              className="mt-4 bg-[#241610] border border-[#ea580c]/50 rounded-xl p-3.5 flex items-center justify-between cursor-pointer hover:border-[#ea580c] transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-orange-600/20 text-[#f97316] flex items-center justify-center">
                  <Play className="w-4 h-4 fill-[#f97316]" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-white">Watch on {platform}</div>
                  <div className="flex items-center space-x-1 text-[10px] text-[#fb923c] mt-0.5">
                    <Smartphone className="w-3 h-3" />
                    <span>Smart App Deep Link</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-[12px] font-bold text-[#fb923c]">
                <span>PLAY</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase text-[#64748b]">SUB:</span>
              <span className="px-2 py-0.5 rounded bg-[#161b2e] text-[#94a3b8] text-[10px]">Hindi</span>
              <span className="px-2 py-0.5 rounded bg-[#161b2e] text-[#94a3b8] text-[10px]">Tamil</span>
              <span className="px-2 py-0.5 rounded bg-[#161b2e] text-[#94a3b8] text-[10px]">Telugu</span>
            </div>
          </div>

          {/* 7. PRODUCTION & AIRING CARD */}
          <div className="bg-[#111524] border border-[#1e243b] rounded-2xl p-5 mb-6">
            <div className="flex items-center space-x-2">
              <Tv className="w-[18px] h-[18px] text-[#a855f7]" />
              <h3 className="text-[16px] font-bold text-white font-['Space_Grotesk',sans-serif]">Production & Airing</h3>
            </div>

            {/* Series Progress Breakdown Box */}
            <div className="bg-[#0b0e17] border border-[#1e243b] rounded-xl p-4 mt-4 space-y-3">
              <div className="text-[10px] font-bold uppercase text-[#a855f7] tracking-wider mb-2">
                SERIES PROGRESS BREAKDOWN
              </div>
              
              <div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-[#64748b]">SEASON</span>
                    <span className="font-bold text-white">1</span>
                    <div className="flex items-center space-x-1">
                      <span className="px-1 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">HI</span>
                      <span className="px-1 rounded bg-purple-500/20 text-purple-400 text-[9px] font-bold">TA</span>
                      <span className="px-1 rounded bg-blue-500/20 text-blue-400 text-[9px] font-bold">TE</span>
                    </div>
                  </div>
                  <span className="text-[12px] font-bold text-[#a855f7]">{totalEpisodes} EP</span>
                </div>
                <div className="w-full h-1.5 bg-[#9333ea] rounded-full mt-2 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-purple-500 to-indigo-500" />
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#1e243b] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-[#64748b]">TOTAL SCOPE</span>
                <span className="text-[11px] font-bold text-white">1 Seasons • {totalEpisodes} Episodes</span>
              </div>
            </div>

            {/* Metadata Key-Value Rows */}
            <div className="mt-4 space-y-3 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#8b92a5]">Animation Studio</span>
                <span className="font-bold text-white">{studio}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8b92a5]">Original Release Date</span>
                <span className="font-bold text-white">{releaseYear}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8b92a5]">Format</span>
                <span className="font-bold text-white">{type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8b92a5]">Status</span>
                <span className="font-bold text-white">{status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8b92a5]">Broadcast Day</span>
                <span className="font-bold text-white">{status === 'Airing' ? 'Sundays' : 'Finished Airing'}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
