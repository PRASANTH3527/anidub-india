import React, { useEffect } from 'react';
import { 
  X, 
  Star, 
  Bookmark, 
  ExternalLink, 
  Calendar, 
  Tv, 
  Film, 
  CheckCircle2, 
  Volume2, 
  Share2, 
  Check 
} from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';

interface AnimeModalProps {
  anime: Anime | null;
  isOpen: boolean;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (anime: Anime) => void;
}

const DUB_LANGUAGE_COLORS: Record<DubLanguage, { bg: string; text: string; border: string }> = {
  Tamil: { bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-700/60' },
  Telugu: { bg: 'bg-sky-950/60', text: 'text-sky-300', border: 'border-sky-700/60' },
  Hindi: { bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-700/60' },
  Malayalam: { bg: 'bg-purple-950/60', text: 'text-purple-300', border: 'border-purple-700/60' },
  Kannada: { bg: 'bg-indigo-950/60', text: 'text-indigo-300', border: 'border-indigo-700/60' },
  Bengali: { bg: 'bg-pink-950/60', text: 'text-pink-300', border: 'border-pink-700/60' },
};

export const AnimeModal: React.FC<AnimeModalProps> = ({
  anime,
  isOpen,
  onClose,
  isBookmarked,
  onToggleBookmark,
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !anime) return null;

  const handleShare = () => {
    const shareText = `Check out "${anime.title}" dubbed in ${anime.dubs.join(', ')} on AniDub India!`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl bg-[#111724] border border-neutral-700/70 rounded-2xl shadow-2xl overflow-hidden z-10 my-auto text-neutral-100 max-h-[90vh] flex flex-col">
        
        {/* Header Banner / Backdrop */}
        <div className="relative h-44 sm:h-56 w-full overflow-hidden bg-gradient-to-r from-primary-theme/40 to-neutral-900 shrink-0">
          <img
            src={anime.poster}
            alt={anime.title}
            className="w-full h-full object-cover blur-md opacity-30 scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111724] via-[#111724]/60 to-transparent" />

          {/* Close & Action Buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
            <button
              onClick={handleShare}
              title="Share Anime"
              className="p-2 rounded-full bg-black/60 hover:bg-neutral-800 text-neutral-300 hover:text-white backdrop-blur-md transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onToggleBookmark(anime)}
              title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
              className={`p-2 rounded-full backdrop-blur-md transition-colors ${
                isBookmarked 
                  ? 'btn-primary-theme text-white' 
                  : 'bg-black/60 hover:bg-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/60 hover:bg-neutral-800 text-neutral-300 hover:text-white backdrop-blur-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Poster and Title Placement */}
          <div className="absolute bottom-4 left-4 sm:left-6 flex items-end gap-4 z-10">
            <img
              src={anime.poster}
              alt={anime.title}
              className="w-24 sm:w-28 aspect-[3/4.2] object-cover rounded-lg shadow-2xl border-2 border-neutral-700/80 shrink-0"
            />
            <div className="mb-1">
              <h2 className="font-heading font-black text-xl sm:text-2xl text-white leading-tight">
                {anime.title}
              </h2>
              {anime.romajiTitle && anime.romajiTitle !== anime.title && (
                <p className="text-xs text-neutral-400 italic">
                  {anime.romajiTitle} {anime.nativeTitle && `• ${anime.nativeTitle}`}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {anime.rating && (
                  <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {anime.rating.toFixed(1)} / 10
                  </span>
                )}
                <span className="text-xs font-semibold bg-neutral-800/80 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700">
                  {anime.type}
                </span>
                <span className="text-xs text-neutral-400 font-medium">
                  {anime.releaseYear}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-grow">
          
          {/* Indian Dub Breakdown Section */}
          <div className="bg-[#182030] rounded-xl p-4 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-4 h-4 text-accent-theme" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary-theme">
                Indian Language Dub Availability
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(anime.dubDetails || []).map((dub) => {
                const colors = DUB_LANGUAGE_COLORS[dub.language] || {
                  bg: 'bg-neutral-800',
                  text: 'text-neutral-200',
                  border: 'border-neutral-700',
                };
                return (
                  <div
                    key={dub.language}
                    className={`flex items-start justify-between p-2.5 rounded-lg border ${colors.bg} ${colors.border}`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${colors.text} shrink-0`} />
                      <div>
                        <span className={`text-xs font-bold ${colors.text}`}>
                          {dub.language} Dub
                        </span>
                        {dub.notes && (
                          <p className="text-[10px] text-neutral-400 leading-tight">
                            {dub.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {(Array.isArray(dub.platform) ? dub.platform : [dub.platform]).filter(Boolean).map((p) => (
                        <span
                          key={p}
                          className="text-[9px] bg-black/40 text-neutral-200 px-1.5 py-0.5 rounded font-medium border border-white/10"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Where to Stream Official Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5 flex items-center gap-1.5">
              <span>Where to Stream</span>
              <span className="text-[10px] text-neutral-500 font-normal">(Official Licensed Streams)</span>
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {(anime.platforms || []).map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#1b2336] hover:bg-primary-theme/20 text-neutral-200 hover:text-white px-3.5 py-2 rounded-xl border border-neutral-700 hover:border-primary-theme/50 text-xs font-semibold transition-all group shadow-sm"
                >
                  <span>{platform.name}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-accent-theme transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Synopsis */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Synopsis
            </h4>
            <p className="text-sm text-neutral-300 leading-relaxed font-normal">
              {anime.synopsis}
            </p>
          </div>

          {/* Anime Meta Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-800 text-xs">
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">Studio</span>
              <span className="font-semibold text-neutral-200">{anime.studio}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">Status</span>
              <span className="font-semibold text-neutral-200">{anime.status}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">Episodes</span>
              <span className="font-semibold text-neutral-200">
                {anime.episodes ? `${anime.episodes} Ep` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">Air Schedule</span>
              <span className="font-semibold text-neutral-200">
                {anime.airingDay ? `Every ${anime.airingDay}` : 'Completed Season'}
              </span>
            </div>
          </div>

          {/* Genres Tags */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {anime.genres.map((genre) => (
              <span
                key={genre}
                className="text-[11px] font-medium bg-[#171e2e] text-neutral-300 border border-neutral-800 px-2.5 py-1 rounded-full"
              >
                {genre}
              </span>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
};
