import React, { useState, useEffect } from 'react';
import { X, Star, Calendar, Tv, Bookmark, Loader2, CloudLightning, Languages, Film, ExternalLink } from 'lucide-react';

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

  useEffect(() => {
    fetchDetails();
  }, [animeId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anime/${animeId}`);
      const data = await res.json();
      setDetails(data);
    } catch (err) {
      console.error('Failed to fetch anime directory details:', err);
    } finally {
      setLoading(false);
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
  const langList = (details.languages || 'HIN,TAM,TEL').split(',');

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
        <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-950">
          <img
            src={details.banner_image || details.cover_image}
            alt={details.title}
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&auto=format&fit=crop&q=80';
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          
          <div className="absolute top-4 left-4 flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/30 text-xs font-semibold text-purple-300">
            <span>✨ Official Indian Dubbed Directory</span>
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
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
                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/30'
                    : 'bg-slate-950 border-slate-700 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isWatchlisted ? 'fill-white' : ''}`} />
                <span>{isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>
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

          {/* Regional Audio Dubbing & Streaming Directory Info */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                <Languages className="w-4 h-4" />
                <span>Available Regional Indian Dubs</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                {langList.map((lang: string) => (
                  <span
                    key={lang}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      lang === 'HIN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      lang === 'TAM' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                      'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    }`}
                  >
                    {lang === 'HIN' ? 'Hindi Audio Dub' : lang === 'TAM' ? 'Tamil Audio Dub' : 'Telugu Audio Dub'}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-slate-800 sm:pl-6">
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Licensed Platform</span>
              <span className="text-sm font-bold text-white mt-0.5 inline-block">
                {details.platform || 'Crunchyroll & Netflix India'}
              </span>
            </div>
          </div>

          {/* Synopsis */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Synopsis</h3>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              {details.synopsis}
            </p>
          </div>

          {/* Episode Directory Catalog */}
          {details.episodes && details.episodes.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Episode Directory</span>
                <span className="text-xs text-orange-400 font-normal">{details.episodes.length} Episodes Cataloged</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                {details.episodes.map((ep: any) => (
                  <div
                    key={ep.id}
                    className="flex items-center space-x-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl"
                  >
                    <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0">
                      <img
                        src={ep.thumbnail_url || details.cover_image}
                        alt={ep.title}
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&auto=format&fit=crop&q=80';
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        Ep {ep.episode_number}: {ep.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{ep.duration} • Hindi / Tamil / Telugu Dubbed</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
