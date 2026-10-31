import React, { useState } from 'react';
import { 
  Play, 
  Star, 
  Sparkles, 
  Clock, 
  Tv, 
  ChevronRight, 
  Bookmark, 
  Heart, 
  Radio, 
  Flame, 
  Layers, 
  Dices,
  Info
} from 'lucide-react';
import { Anime } from './CatalogView';

interface PublicHomeViewProps {
  catalogList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onNavigateCatalog: () => void;
  onOpenRoulette: () => void;
  onOpenCollection: () => void;
}

// Language helper to extract and normalize language codes
const parseLanguages = (raw?: string): string[] => {
  if (!raw) return ['Ta', 'Te', 'Hi'];
  const split = raw.split(/[,/| ]+/).map(s => s.trim()).filter(Boolean);
  return split.map(code => {
    const upper = code.toUpperCase();
    if (upper === 'TAM' || upper === 'TA') return 'Ta';
    if (upper === 'TEL' || upper === 'TE') return 'Te';
    if (upper === 'HIN' || upper === 'HI') return 'Hi';
    if (upper === 'ENG' || upper === 'EN') return 'En';
    if (upper === 'MAL' || upper === 'MA') return 'Ma';
    if (upper === 'KAN' || upper === 'KA') return 'Ka';
    if (upper === 'BEN' || upper === 'BE') return 'Be';
    return code.slice(0, 2);
  });
};

const getLanguagePillClass = (lang: string): string => {
  switch (lang) {
    case 'Ta':
      return 'bg-purple-950/70 text-purple-300 border-purple-800/40';
    case 'Te':
      return 'bg-sky-950/70 text-sky-300 border-sky-800/40';
    case 'Hi':
      return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/40';
    case 'En':
      return 'bg-slate-800/80 text-slate-300 border-slate-700/50';
    case 'Ma':
      return 'bg-amber-950/70 text-amber-300 border-amber-800/40';
    case 'Ka':
      return 'bg-pink-950/70 text-pink-300 border-pink-800/40';
    case 'Be':
      return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/40';
    default:
      return 'bg-slate-800/70 text-slate-300 border-slate-700/40';
  }
};

const ART_FALLBACKS: Record<number, { cover: string; banner: string }> = {
  1: {
    cover: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80'
  },
  2: {
    cover: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop&q=80'
  },
  3: {
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&auto=format&fit=crop&q=80'
  },
  4: {
    cover: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80'
  },
  5: {
    cover: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=1600&auto=format&fit=crop&q=80'
  },
  6: {
    cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80'
  }
};

const getAnimeCover = (anime: Anime): string => {
  if (anime.cover_image) {
    return anime.cover_image;
  }
  if (ART_FALLBACKS[anime.id]?.cover) return ART_FALLBACKS[anime.id].cover;
  return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
};

const getAnimeBanner = (anime: Anime): string => {
  if (anime.banner_image) {
    return anime.banner_image;
  }
  if (ART_FALLBACKS[anime.id]?.banner) return ART_FALLBACKS[anime.id].banner;
  return getAnimeCover(anime);
};

export const PublicHomeView: React.FC<PublicHomeViewProps> = ({
  catalogList,
  onSelectAnime,
  watchlist,
  onToggleWatchlist,
  onNavigateCatalog,
  onOpenRoulette,
  onOpenCollection
}) => {
  // 1. Featured Anime for Hero Section (Highest rated or first entry)
  const featuredList = [...catalogList].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredAnime = featuredList[featuredIndex] || catalogList[0];

  // 2. Airing Now (status === 'Ongoing' or 'Airing')
  const ongoingAnime = catalogList.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'ongoing' || s === 'airing';
  });

  // If none explicitly marked, fallback to top titles
  const airingNowList = ongoingAnime.length > 0 ? ongoingAnime : catalogList.slice(0, 4);

  // 3. Recently Updated (Latest entries, sorted by year/id desc)
  const recentlyUpdatedList = [...catalogList]
    .sort((a, b) => (b.year || 2025) - (a.year || 2025) || b.id - a.id)
    .slice(0, 6);

  return (
    <div className="w-full max-w-[510px] mx-auto px-4 py-5 space-y-7 text-slate-100 bg-[#0a0c14] font-['Inter',sans-serif]">

      {/* 1. HERO SECTION */}
      {featuredAnime && (
        <section className="relative rounded-[26px] overflow-hidden bg-[#0e1222] border border-[#1e2338] shadow-2xl group">
          {/* Backdrop Image with Multi-Gradient Overlay */}
          <div className="relative h-[240px] sm:h-[260px] w-full overflow-hidden bg-slate-950">
            <img 
              src={getAnimeBanner(featuredAnime)} 
              alt={featuredAnime.title}
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80';
              }}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
            />
            {/* Dark gradient fade into bottom container */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e1222] via-[#0e1222]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0e1222]/90 via-[#0e1222]/30 to-transparent" />

            {/* Top Badges */}
            <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between z-10">
              <span className="px-3 py-1 rounded-full bg-[#ff6a00] text-slate-950 text-[10.5px] font-extrabold uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-orange-500/20">
                <Flame className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                <span>Featured Spotlight</span>
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWatchlist(featuredAnime.id);
                }}
                className={`w-8 h-8 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${
                  watchlist.includes(featuredAnime.id)
                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                    : 'bg-black/50 text-white/80 border-white/15 hover:text-white hover:bg-black/70'
                }`}
                title="Bookmark Anime"
              >
                <Heart className={`w-4 h-4 ${watchlist.includes(featuredAnime.id) ? 'fill-white' : ''}`} />
              </button>
            </div>

            {/* Quick Carousel Indicators if multiple featured available */}
            {featuredList.length > 1 && (
              <div className="absolute bottom-3 right-4 z-10 flex items-center space-x-1.5">
                {featuredList.slice(0, 4).map((_, idx) => (
                  <button
                    key={`featured_indicator_${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFeaturedIndex(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === featuredIndex ? 'w-5 bg-purple-500' : 'w-1.5 bg-white/30 hover:bg-white/60'
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Hero Content Body */}
          <div className="p-4 sm:p-5 -mt-6 relative z-10 space-y-3">
            {/* Meta Row: Rating, Year, Languages */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold flex items-center space-x-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                <span>{featuredAnime.rating || 9.0}</span>
              </span>

              {featuredAnime.year && (
                <span className="text-slate-400 font-medium">
                  {featuredAnime.year}
                </span>
              )}

              <span className="text-slate-500">•</span>

              {/* Language Pills */}
              <div className="flex items-center space-x-1">
                {parseLanguages(featuredAnime.languages).slice(0, 3).map((lang, lIdx) => (
                  <span
                    key={`featured_lang_${featuredAnime.id}_${lang}_${lIdx}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getLanguagePillClass(lang)}`}
                  >
                    {lang}
                  </span>
                ))}
              </div>

              {featuredAnime.status && (
                <span className="ml-auto text-[10.5px] font-bold uppercase tracking-wider text-purple-400">
                  {featuredAnime.status}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-white font-['Space_Grotesk',sans-serif] tracking-tight leading-snug">
              {featuredAnime.title}
            </h1>

            {/* Synopsis */}
            {featuredAnime.synopsis && (
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {featuredAnime.synopsis}
              </p>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center space-x-2.5">
              <button
                onClick={() => onSelectAnime(featuredAnime)}
                className="flex-1 h-11 px-5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-purple-600/30 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>View Details</span>
              </button>

              <button
                onClick={onNavigateCatalog}
                className="h-11 px-4 rounded-xl bg-[#151a2d] border border-[#232b45] text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 hover:bg-[#1c243f] transition-colors cursor-pointer"
                title="Browse Full Anime Catalog"
              >
                <span>Catalog</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* QUICK ACTIONS BAR (Roulette & Collection) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onOpenRoulette}
          className="p-3.5 rounded-2xl bg-[#0f1428] border border-[#1e2646] hover:border-orange-500/40 flex items-center space-x-3 transition-all group text-left cursor-pointer shadow-lg shadow-black/20"
        >
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0 group-hover:scale-105 transition-transform">
            <Dices className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors">
              Roulette
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Random dub pick
            </div>
          </div>
        </button>

        <button
          onClick={onOpenCollection}
          className="p-3.5 rounded-2xl bg-[#0f1428] border border-[#1e2646] hover:border-purple-500/40 flex items-center space-x-3 transition-all group text-left cursor-pointer shadow-lg shadow-black/20"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
              Collections
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Create list & share
            </div>
          </div>
        </button>
      </div>

      {/* 2. AIRING NOW (Horizontal Scrollable Section) */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Space_Grotesk',sans-serif] tracking-tight flex items-center space-x-1.5">
                <span>Airing Now</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-800/40 text-rose-300 text-[10px] font-bold">
                  {airingNowList.length} LIVE
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onNavigateCatalog}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center space-x-1 transition-colors"
          >
            <span>See all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Cards Container */}
        <div className="flex gap-3 overflow-x-auto pb-2 pt-1 -mx-4 px-4 scrollbar-none snap-x">
          {airingNowList.map((anime, aIdx) => {
            const langs = parseLanguages(anime.languages);
            return (
              <div
                key={`airing_card_${anime.id}_${aIdx}`}
                onClick={() => onSelectAnime(anime)}
                className="w-[140px] sm:w-[150px] shrink-0 snap-start bg-[#0e1222] border border-[#1e2338] hover:border-purple-500/50 rounded-[20px] overflow-hidden group cursor-pointer shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                {/* 2:3 Poster Area */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src={getAnimeCover(anime)}
                    alt={anime.title}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1222] via-transparent to-black/30" />

                  {/* Blinking Live Badge */}
                  <div className="absolute top-2 left-2 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/90 backdrop-blur-md text-white text-[9px] font-extrabold uppercase shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>ONGOING</span>
                  </div>

                  {/* Rating Tag */}
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-amber-300 text-[10px] font-bold border border-amber-500/20 flex items-center space-x-0.5">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    <span>{anime.rating || 9.0}</span>
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-3 space-y-1.5">
                  {/* Language Pills */}
                  <div className="flex flex-wrap gap-1">
                    {langs.slice(0, 2).map((l, lIdx) => (
                      <span
                        key={`airing_lang_${anime.id}_${l}_${lIdx}`}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${getLanguagePillClass(l)}`}
                      >
                        {l}
                      </span>
                    ))}
                    {langs.length > 2 && (
                      <span className="text-[9px] text-slate-500 font-bold self-center">
                        +{langs.length - 2}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                    {anime.title}
                  </h3>

                  {/* Episodes count */}
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{anime.episodes_count || 12} Episodes</span>
                    <span className="text-purple-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. RECENTLY UPDATED (Responsive Grid of Latest Approved Anime) */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <div>
              <h2 className="text-base font-bold text-white font-['Space_Grotesk',sans-serif] tracking-tight">
                Recently Updated
              </h2>
            </div>
          </div>

          <button
            onClick={onNavigateCatalog}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center space-x-1 transition-colors"
          >
            <span>Explore all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          {recentlyUpdatedList.map((anime, rIdx) => {
            const langs = parseLanguages(anime.languages);
            const isSaved = watchlist.map(Number).includes(Number(anime.id));

            return (
              <div
                key={`recent_card_${anime.id}_${rIdx}`}
                onClick={() => onSelectAnime(anime)}
                className="group bg-[#0e1222] border border-[#1e2338] hover:border-purple-500/50 rounded-[22px] overflow-hidden shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer"
              >
                {/* 2:3 Vertical Poster */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src={getAnimeCover(anime)}
                    alt={anime.title}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1222] via-transparent to-black/25" />

                  {/* Top Rating Chip */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center space-x-1 shadow-md">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{anime.rating || 9.0}</span>
                  </div>

                  {/* Bookmark Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist(anime.id);
                    }}
                    className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${
                      isSaved
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                        : 'bg-black/50 text-white/80 border-white/15 hover:text-white hover:bg-black/75'
                    }`}
                    title="Bookmark"
                  >
                    <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
                  </button>

                  {/* Year & Season tag at bottom of poster */}
                  {anime.year && (
                    <div className="absolute bottom-2 left-2.5 text-[10px] font-medium text-slate-300 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md">
                      {anime.year}
                    </div>
                  )}
                </div>

                {/* Card Details */}
                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    {/* Available Languages Pills */}
                    <div className="flex flex-wrap gap-1">
                      {langs.slice(0, 3).map((l, lIdx) => (
                        <span
                          key={`recent_lang_${anime.id}_${l}_${lIdx}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getLanguagePillClass(l)}`}
                        >
                          {l}
                        </span>
                      ))}
                      {langs.length > 3 && (
                        <span className="text-[10px] text-slate-500 font-bold self-center">
                          +{langs.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Anime Title */}
                    <h3 className="font-bold text-white text-xs sm:text-sm line-clamp-1 group-hover:text-purple-300 transition-colors leading-snug">
                      {anime.title}
                    </h3>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-[#1c2236] flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">
                      {anime.episodes_count || 12} Episodes
                    </span>
                    <span className="text-purple-400 font-semibold group-hover:underline flex items-center">
                      <span>Details</span>
                      <ChevronRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All Button */}
        <div className="pt-2">
          <button
            onClick={onNavigateCatalog}
            className="w-full h-11 rounded-2xl bg-[#11172c] border border-[#202948] hover:border-purple-500/50 text-slate-200 hover:text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 group cursor-pointer shadow-lg"
          >
            <span>Explore Entire Anime Directory</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-purple-400" />
          </button>
        </div>
      </section>

    </div>
  );
};
