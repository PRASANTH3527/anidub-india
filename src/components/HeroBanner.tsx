import React from 'react';
import { Play, Star, Calendar, Tv, Sparkles, CloudLightning } from 'lucide-react';

interface Anime {
  id: number;
  title: string;
  slug: string;
  synopsis: string;
  cover_image: string;
  banner_image: string;
  rating: number;
  episodes_count: number;
  status: string;
  season: string;
  year: number;
  genres: string;
  popularity: number;
}

interface HeroBannerProps {
  anime: Anime;
  onSelectAnime: (anime: Anime) => void;
  onPlayAnime: (anime: Anime) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ anime, onSelectAnime, onPlayAnime }) => {
  if (!anime) return null;

  const genresList = anime.genres ? anime.genres.split(',') : [];

  return (
    <div className="relative w-full h-[460px] md:h-[540px] rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 mb-10 group">
      {/* Background Banner Image */}
      <div className="absolute inset-0">
        <img
          src={anime.banner_image || anime.cover_image}
          alt={anime.title}
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80';
          }}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent" />
      </div>


      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 flex flex-col justify-end z-10 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {genresList.map((g, i) => (
            <span key={`hero_genre_${g.trim()}_${i}`} className="px-2.5 py-0.5 rounded-md bg-orange-500/20 text-orange-300 text-xs font-semibold border border-orange-500/30">
              {g.trim()}
            </span>
          ))}
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-1" />
            {anime.rating}
          </span>
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-800/80 text-slate-300 text-xs font-medium">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            {anime.season} {anime.year}
          </span>
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-800/80 text-slate-300 text-xs font-medium">
            <Tv className="w-3.5 h-3.5 mr-1" />
            {anime.episodes_count} Episodes
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight font-['Space_Grotesk',sans-serif] mb-3 drop-shadow-md">
          {anime.title}
        </h1>

        <p className="text-sm md:text-base text-slate-300 line-clamp-2 md:line-clamp-3 mb-6 font-normal leading-relaxed">
          {anime.synopsis}
        </p>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => onPlayAnime(anime)}
            className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-600/30 hover:scale-105"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Watch Episode 1</span>
          </button>

          <button
            onClick={() => onSelectAnime(anime)}
            className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-all border border-slate-700/80 backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span>More Details</span>
          </button>
        </div>
      </div>
    </div>
  );
};
