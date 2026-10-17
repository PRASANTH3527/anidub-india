import React, { useState, useEffect } from 'react';
import { X, Play, Star, Calendar, Tv, Bookmark, MessageSquare, Send, Loader2, CloudLightning } from 'lucide-react';

interface AnimeDetailModalProps {
  animeId: number;
  onClose: () => void;
  onPlayEpisode: (anime: any, episode: any) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  currentUser?: { username: string; avatar_url: string };
}

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({
  animeId,
  onClose,
  onPlayEpisode,
  watchlist,
  onToggleWatchlist,
  currentUser
}) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(currentUser?.username || 'Kaito_Cloud');
  const [rating, setRating] = useState('10');
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [animeId]);

  useEffect(() => {
    if (currentUser?.username) {
      setUserName(currentUser.username);
    }
  }, [currentUser]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anime/${animeId}`);
      const data = await res.json();
      setDetails(data);
    } catch (err) {
      console.error('Failed to fetch anime details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !comment) return;
    setSubmittingReview(true);
    try {
      await fetch(`/api/anime/${animeId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: userName,
          user_avatar: currentUser?.avatar_url || 'https://i.ibb.co/vzS8G90/default-avatar.png',
          rating: parseInt(rating),
          comment
        })
      });
      setComment('');
      fetchDetails();
    } catch (err) {
      console.error('Failed to add review:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!details) return null;

  const isWatchlisted = watchlist.includes(details.id);
  const genresList = details.genres ? details.genres.split(',') : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Banner header */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          <img
            src={details.banner_image || details.cover_image}
            alt={details.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
          
          <div className="absolute top-4 left-4 flex items-center space-x-2 bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-full border border-orange-500/30 text-xs font-medium text-orange-400">
            <CloudLightning className="w-3.5 h-3.5" />
            <span>Cloudflare D1 & ImgBB CDN</span>
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {genresList.map((g: string, i: number) => (
                  <span key={i} className="px-2.5 py-0.5 rounded-md bg-orange-500/20 text-orange-300 text-xs font-semibold border border-orange-500/30">
                    {g.trim()}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white font-['Space_Grotesk',sans-serif]">
                {details.title}
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => onToggleWatchlist(details.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors border ${
                  isWatchlisted
                    ? 'bg-orange-600 border-orange-500 text-white'
                    : 'bg-slate-950 border-slate-700 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isWatchlisted ? 'fill-white' : ''}`} />
                <span>{isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>

              {details.episodes && details.episodes.length > 0 && (
                <button
                  onClick={() => onPlayEpisode(details, details.episodes[0])}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Play Ep 1</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Metadata Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-medium">Rating</span>
              <div className="flex items-center space-x-1 mt-0.5 text-amber-400 font-bold text-base">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>{details.rating} / 10</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-medium">Episodes</span>
              <div className="flex items-center space-x-1 mt-0.5 text-slate-200 font-bold text-base">
                <Tv className="w-4 h-4 text-orange-400" />
                <span>{details.episodes_count} Broadcasts</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-medium">Season / Year</span>
              <div className="flex items-center space-x-1 mt-0.5 text-slate-200 font-bold text-base">
                <Calendar className="w-4 h-4 text-orange-400" />
                <span>{details.season} {details.year}</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-medium">Status</span>
              <div className="mt-0.5">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  {details.status}
                </span>
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Synopsis</h3>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              {details.synopsis}
            </p>
          </div>

          {/* Episodes Playlist */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Episodes List</span>
              <span className="text-xs text-orange-400 font-normal">{details.episodes?.length || 0} available</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
              {details.episodes?.map((ep: any) => (
                <div
                  key={ep.id}
                  onClick={() => onPlayEpisode(details, ep)}
                  className="group flex items-center space-x-3 p-3 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-orange-500/40 rounded-xl cursor-pointer transition-all"
                >
                  <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0">
                    <img src={ep.thumbnail_url || details.cover_image} alt={ep.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-transparent transition-colors flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate group-hover:text-orange-400 transition-colors">
                      Episode {ep.episode_number}: {ep.title}
                    </div>
                    <div className="text-[11px] text-slate-400">{ep.duration} • Cloudflare HLS Stream</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews Section with ImgBB Avatars */}
          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-orange-400" />
              <span>Community Reviews ({details.reviews?.length || 0})</span>
            </h3>

            {/* Reviews List */}
            <div className="space-y-3 mb-6 max-h-48 overflow-y-auto pr-2">
              {details.reviews?.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No reviews yet. Be the first to share your review!</p>
              ) : (
                details.reviews?.map((rev: any) => (
                  <div key={rev.id} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0 mt-0.5">
                      <img
                        src={rev.user_avatar || 'https://i.ibb.co/vzS8G90/default-avatar.png'}
                        alt={rev.user_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">{rev.user_name}</span>
                        <div className="flex items-center space-x-1 text-amber-400 text-xs">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{rev.rating}/10</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Review Form */}
            <form onSubmit={handleAddReview} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Your Name (e.g. AnimeFanX)"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(num => (
                    <option key={num} value={num}>{num} / 10 Stars</option>
                  ))}
                </select>
              </div>
              <textarea
                placeholder="Write your review about the animation, storyline, and Cloudflare D1 streaming performance..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                rows={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition-colors shadow-md shadow-orange-600/30 disabled:opacity-50"
                >
                  {submittingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Submit Review</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
