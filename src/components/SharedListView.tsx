import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Layers, 
  Copy, 
  Share2, 
  Check, 
  Sparkles, 
  Film, 
  AlertCircle, 
  Loader2,
  ExternalLink
} from 'lucide-react';
import { Anime } from './CatalogView';
import { AnimeCard } from './AnimeCard';

export interface SharedListViewProps {
  collectionId?: string;
  encodedTitle?: string;
  idsString?: string;
  catalogList: Anime[];
  onBack: () => void;
  onSelectAnime: (anime: Anime) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
}

export const SharedListView: React.FC<SharedListViewProps> = ({
  collectionId,
  encodedTitle,
  idsString,
  catalogList,
  onBack,
  onSelectAnime,
  watchlist,
  onToggleWatchlist
}) => {
  const [loading, setLoading] = useState(false);
  const [listTitle, setListTitle] = useState('Shared Regional Anime Collection');
  const [animeIds, setAnimeIds] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (encodedTitle) {
      try {
        setListTitle(decodeURIComponent(encodedTitle));
      } catch {
        setListTitle(encodedTitle);
      }
    }
    if (idsString) {
      const parsed = idsString.split(',').map(s => parseInt(s.trim())).filter(Boolean);
      setAnimeIds(parsed);
    }
  }, [encodedTitle, idsString]);

  const sharedAnimeList = catalogList.filter(a => animeIds.includes(a.id));

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = `Check out this custom anime list "${listTitle}" on Anidub India: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleTelegramShare = () => {
    const text = `Check out this custom anime list "${listTitle}" on Anidub India: ${window.location.href}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(listTitle)}`, '_blank');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 font-sans text-neutral-100">
      
      {/* TOP NAVIGATION */}
      <div className="flex items-center justify-between pb-6 border-b border-neutral-800/80 mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>

        <span className="badge-primary-theme text-[11px] font-bold px-3 py-1 rounded-full">
          Shared Custom Collection
        </span>
      </div>

      {/* HERO HEADER AREA */}
      <div className="relative rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-[#131a29] via-[#0f1522] to-[#090d18] border border-neutral-800 shadow-2xl overflow-hidden mb-10">
        
        {/* BLURRED BACKGROUND GLOW DOTS */}
        <div className="absolute -top-12 -left-12 w-64 h-64 rounded-full bg-primary-theme/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-neutral-300">
                Anonymous User Collection
              </span>
              <span className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-neutral-400">
                {new Date().toLocaleDateString()}
              </span>
              <span className="badge-primary-theme text-[10px] font-bold px-2.5 py-1 rounded-full">
                {sharedAnimeList.length} Titles
              </span>
            </div>

            <h1 className="font-heading font-black text-2xl sm:text-4xl text-white tracking-tight">
              {listTitle}
            </h1>

            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl leading-relaxed">
              A curated list of official regional dubbed anime titles compiled by an Anidub India community member.
            </p>
          </div>

          {/* SHARE PANEL */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary-theme to-orange-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-transform active:scale-95"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : 'Copy Share Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-4 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleTelegramShare}
              className="px-4 py-3 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </button>
          </div>

        </div>
      </div>

      {/* CARDS GRID */}
      {sharedAnimeList.length === 0 ? (
        <div className="p-16 rounded-3xl bg-neutral-900/30 border border-neutral-800 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="font-heading font-black text-lg text-white">No Anime Found in Shared List</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            The requested collection links might be outdated or contain invalid anime identifiers.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2.5 rounded-xl btn-primary-theme text-xs font-bold"
          >
            Return to Home
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
          {sharedAnimeList.map((anime, idx) => {
            const isBookmarked = watchlist.includes(anime.id);
            return (
              <AnimeCard
                key={`shared_anime_${anime.id}_${idx}`}
                anime={anime}
                onSelect={(a) => onSelectAnime(a as any)}
                isBookmarked={isBookmarked}
                onToggleBookmark={onToggleWatchlist}
              />
            );
          })}
        </div>
      )}

      {/* BOTTOM CTA */}
      <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-neutral-900/90 via-neutral-900/50 to-neutral-900/90 border border-neutral-800 text-center space-y-4">
        <h3 className="font-heading font-black text-xl text-white">Want to build your own shareable collection?</h3>
        <p className="text-xs text-neutral-400 max-w-md mx-auto">
          Create customized lists of your favorite regional dubbed anime and share them instantly with friends.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl btn-primary-theme text-xs font-extrabold shadow-lg cursor-pointer inline-flex items-center gap-2"
        >
          <span>Create Custom Collection</span>
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
