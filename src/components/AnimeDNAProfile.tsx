import React from 'react';
import { motion } from 'motion/react';
import { Dna, Sparkles, Trophy, Building2, Languages, Film, ArrowRight } from 'lucide-react';
import { Anime } from './CatalogView';

export interface AnimeDNAProfileProps {
  watchlist: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onNavigateCatalog?: () => void;
}

export const AnimeDNAProfile: React.FC<AnimeDNAProfileProps> = ({
  watchlist,
  onSelectAnime,
  onNavigateCatalog
}) => {
  if (!watchlist || watchlist.length === 0) {
    return (
      <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-8 text-center space-y-4 font-sans">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-800 text-neutral-500 flex items-center justify-center">
          <Dna className="w-7 h-7" />
        </div>
        <h3 className="font-heading font-black text-xl text-white">Your Anime DNA is Uncharted</h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
          Add at least 3 anime titles to your watchlist to unlock your personalized studio pedigree, linguistic distribution, and genre signature DNA.
        </p>
        {onNavigateCatalog && (
          <button
            type="button"
            onClick={onNavigateCatalog}
            className="px-6 py-2.5 rounded-xl btn-primary-theme text-xs font-extrabold shadow-lg cursor-pointer inline-flex items-center gap-2"
          >
            <span>Explore Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Calculate DNA metrics
  const totalCount = watchlist.length;
  const avgRating = (watchlist.reduce((acc, curr) => acc + (curr.rating || 8.0), 0) / totalCount).toFixed(1);
  const totalEpisodes = watchlist.reduce((acc, curr) => acc + (curr.episodes_count || 12), 0);

  // Genre tally
  const genreMap: Record<string, number> = {};
  watchlist.forEach(anime => {
    const genres = (anime.genres || '').split(',').map(g => g.trim());
    genres.forEach(g => {
      if (g) genreMap[g] = (genreMap[g] || 0) + 1;
    });
  });

  const sortedGenres = Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Language tally
  const langMap: Record<string, number> = { Hindi: 0, Tamil: 0, Telugu: 0, Malayalam: 0, Kannada: 0 };
  watchlist.forEach(anime => {
    const langs = (anime.languages || '').toUpperCase();
    if (langs.includes('HIN') || langs.includes('HI')) langMap.Hindi++;
    if (langs.includes('TAM') || langs.includes('TA')) langMap.Tamil++;
    if (langs.includes('TEL') || langs.includes('TE')) langMap.Telugu++;
    if (langs.includes('MAL') || langs.includes('MA')) langMap.Malayalam++;
    if (langs.includes('KAN') || langs.includes('KA')) langMap.Kannada++;
  });

  // Studio / Platform tally
  const platformMap: Record<string, number> = {};
  watchlist.forEach(anime => {
    const plat = anime.platform || 'Crunchyroll';
    platformMap[plat] = (platformMap[plat] || 0) + 1;
  });

  const sortedPlatforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="space-y-6 font-sans">
      
      {/* HERO STATS CARD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-600/40 text-purple-400 flex items-center justify-center mb-1">
            <Film className="w-4 h-4" />
          </div>
          <span className="font-heading font-black text-xl sm:text-2xl text-white">{totalCount}</span>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Watched Titles</span>
        </div>

        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-amber-950/80 border border-amber-600/40 text-amber-400 flex items-center justify-center mb-1">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="font-heading font-black text-xl sm:text-2xl text-white">{avgRating}</span>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Avg Score</span>
        </div>

        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-sky-950/80 border border-sky-600/40 text-sky-400 flex items-center justify-center mb-1">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-heading font-black text-xl sm:text-2xl text-white">{totalEpisodes}</span>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Episodes</span>
        </div>

        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-600/40 text-emerald-400 flex items-center justify-center mb-1">
            <Dna className="w-4 h-4" />
          </div>
          <span className="font-heading font-black text-xl sm:text-2xl text-white">98%</span>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">DNA Match Index</span>
        </div>
      </div>

      {/* DNA DETAILS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* STUDIO / PLATFORM PEDIGREE BLOCK */}
        <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-black text-base text-white">Platform & Studio Pedigree</h4>
              <p className="text-xs text-neutral-400">Authorized OTT streaming concentration</p>
            </div>
          </div>

          <div className="space-y-4">
            {sortedPlatforms.map(([plat, count], i) => {
              const pct = Math.round((count / totalCount) * 100);
              return (
                <div key={plat} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                    <span>{plat}</span>
                    <span className="text-neutral-400">{count} titles ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LINGUISTIC DNA BLOCK */}
        <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-theme/10 border border-primary-theme/30 text-primary-theme flex items-center justify-center">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-black text-base text-white">Linguistic Dub DNA</h4>
              <p className="text-xs text-neutral-400">Regional Indian audio preferences</p>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(langMap).map(([lang, count], i) => {
              const pct = Math.round((count / Math.max(totalCount, 1)) * 100);
              return (
                <div key={lang} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                    <span>{lang} Dub</span>
                    <span className="text-neutral-400">{count} titles ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GENRE SIGNATURE BLOCK */}
        <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 md:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-black text-base text-white">Genre Signature Analysis</h4>
              <p className="text-xs text-neutral-400">Dominant storyline tropes & thematic preferences</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {sortedGenres.map(([genre, count], i) => {
              const pct = Math.round((count / totalCount) * 100);
              return (
                <div
                  key={genre}
                  className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex-grow basis-40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{genre}</span>
                    <span className="text-xs font-extrabold text-orange-400">{pct}%</span>
                  </div>
                  <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.15 }}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full"
                    />
                  </div>
                  <div className="text-[10px] text-neutral-500 font-medium">
                    Based on {count} watchlist titles
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
