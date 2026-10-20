import React from 'react';
import { X, Share2, Bookmark, Star, Tv, ExternalLink, Calendar, Building2, Languages, Film, Sparkles, Check } from 'lucide-react';
import { Anime } from './CatalogView';

export interface AnimeModalProps {
  anime: Anime;
  isOpen: boolean;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (id: number) => void;
  onSelectAnime?: (anime: Anime) => void;
}

const DUB_LANGUAGE_COLORS: Record<string, string> = {
  Hindi: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  Tamil: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
  Telugu: 'bg-sky-950/80 text-sky-300 border-sky-500/40',
  Malayalam: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
  Kannada: 'bg-pink-950/80 text-pink-300 border-pink-500/40'
};

export const AnimeModal: React.FC<AnimeModalProps> = ({
  anime,
  isOpen,
  onClose,
  isBookmarked,
  onToggleBookmark
}) => {
  if (!isOpen || !anime) return null;

  const [copied, setCopied] = React.useState(false);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const genresList = (anime.genres || '').split(',').map(g => g.trim()).filter(Boolean);
  const langsList = (anime.languages || 'Hindi, Tamil, Telugu').split(/[,/| ]+/).map(s => s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* MODAL CONTAINER */}
      <div className="relative w-full max-w-3xl bg-[#111724] border border-neutral-700/70 rounded-2xl shadow-2xl overflow-hidden z-10 my-auto text-neutral-100 max-h-[90vh] flex flex-col font-sans">
        
        {/* HEADER BANNER */}
        <div className="relative h-44 sm:h-56 w-full overflow-hidden bg-gradient-to-r from-primary-theme/40 to-neutral-900 shrink-0">
          <img
            src={anime.banner_image || anime.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80'}
            alt={anime.title}
            className="absolute inset-0 w-full h-full object-cover blur-md opacity-30 scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111724] via-[#111726]/60 to-transparent" />

          {/* CLOSE & ACTION BUTTONS */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-xl bg-black/60 hover:bg-black/80 text-neutral-300 hover:text-white backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer"
              title="Share Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => onToggleBookmark(anime.id)}
              className={`w-9 h-9 rounded-xl backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer ${
                isBookmarked 
                  ? 'bg-primary-theme text-white shadow-lg' 
                  : 'bg-black/60 hover:bg-black/80 text-neutral-300 hover:text-white'
              }`}
              title={isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-black/60 hover:bg-black/80 text-neutral-300 hover:text-white backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* POSTER & TITLE */}
          <div className="absolute bottom-4 left-4 sm:left-6 flex items-end gap-4 z-10">
            <div className="w-20 sm:w-24 aspect-[3/4.2] rounded-xl overflow-hidden bg-neutral-900 border-2 border-neutral-700 shadow-2xl shrink-0 hidden xs:block">
              <img
                src={anime.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                alt={anime.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1.5 pb-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{anime.rating ? anime.rating.toFixed(1) : '8.9'}</span>
                </span>
                <span className="text-[11px] font-bold text-neutral-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-md">
                  {anime.type || 'TV Series'} • {anime.year || 2026}
                </span>
              </div>

              <h2 className="font-heading font-black text-xl sm:text-2xl text-white tracking-tight drop-shadow-md">
                {anime.title}
              </h2>
            </div>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-grow">
          
          {/* SYNOPSIS */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Synopsis</h4>
            <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
              {anime.synopsis || 'Explore this official Indian dubbed anime title streaming legally across authorized OTT distributors.'}
            </p>
          </div>

          {/* INDIAN DUB BREAKDOWN */}
          <div className="bg-[#182030] rounded-xl p-4 border border-neutral-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
              <Languages className="w-4 h-4 text-primary-theme" />
              <span>Verified Indian Dub Availability</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {langsList.map((lang, idx) => {
                const badgeColor = DUB_LANGUAGE_COLORS[lang] || 'bg-neutral-800 text-neutral-300 border-neutral-700';
                return (
                  <div key={idx} className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${badgeColor}`}>
                    <span>{lang} Dub</span>
                    <span className="text-[10px] font-extrabold uppercase">Verified</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WHERE TO STREAM */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Where to Stream (Legal OTT)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href={`https://www.crunchyroll.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#1b2336] hover:bg-primary-theme/20 text-neutral-200 hover:text-white px-3.5 py-2.5 rounded-xl border border-neutral-700 hover:border-primary-theme/50 text-xs font-semibold transition-all group shadow-sm justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center font-black text-[10px]">CR</div>
                  <span>Crunchyroll India</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
              </a>

              <a
                href={`https://www.netflix.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#1b2336] hover:bg-primary-theme/20 text-neutral-200 hover:text-white px-3.5 py-2.5 rounded-xl border border-neutral-700 hover:border-primary-theme/50 text-xs font-semibold transition-all group shadow-sm justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center font-black text-[10px]">NF</div>
                  <span>Netflix India</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
              </a>
            </div>
          </div>

          {/* SYNOPSIS & META DETAILS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-800 text-xs">
            <div className="bg-[#171e2e] p-3 rounded-xl border border-neutral-800/80">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Status</span>
              <span className="font-bold text-white mt-0.5 block">{anime.status || 'Airing'}</span>
            </div>

            <div className="bg-[#171e2e] p-3 rounded-xl border border-neutral-800/80">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Episodes</span>
              <span className="font-bold text-white mt-0.5 block">{anime.episodes_count || 12} Episodes</span>
            </div>

            <div className="bg-[#171e2e] p-3 rounded-xl border border-neutral-800/80">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Season</span>
              <span className="font-bold text-white mt-0.5 block">{anime.season || 'Spring'} {anime.year || 2026}</span>
            </div>

            <div className="bg-[#171e2e] p-3 rounded-xl border border-neutral-800/80">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Platform</span>
              <span className="font-bold text-white mt-0.5 block">{anime.platform || 'Crunchyroll'}</span>
            </div>
          </div>

          {/* GENRES TAGS */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Genres</h4>
            <div className="flex flex-wrap gap-1.5">
              {genresList.map((g, i) => (
                <span key={i} className="text-[11px] font-medium bg-[#171e2e] text-neutral-300 border border-neutral-800 px-2.5 py-1 rounded-full">
                  {g}
                </span>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
