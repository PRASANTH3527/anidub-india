'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Dna, 
  Building2, 
  Languages, 
  Film, 
  Clock, 
  Sparkles, 
  TrendingUp,
  Award
} from 'lucide-react';
import { Anime } from '../types/anime';
import { calculateAnimeDNA } from '../utils/animeHelper';

interface AnimeDNAProfileProps {
  watchedAnime: Anime[];
}

export const AnimeDNAProfile: React.FC<AnimeDNAProfileProps> = ({ watchedAnime }) => {
  const dna = useMemo(() => calculateAnimeDNA(watchedAnime), [watchedAnime]);

  if (watchedAnime.length === 0) {
    return (
      <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
          <Dna className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white">DNA Not Found</h3>
          <p className="text-neutral-500 text-sm max-w-xs mx-auto">
            Start adding anime to your watchlist to unlock your personalized Anime DNA profile.
          </p>
        </div>
      </div>
    );
  }

  const hoursWatched = Math.round(dna.totalTimeEstimated / 60);

  return (
    <div className="space-y-6">
      {/* Hero Stats Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Titles', value: dna.totalWatched, icon: Film, color: 'text-primary-theme' },
          { label: 'Hours', value: hoursWatched, icon: Clock, color: 'text-amber-400' },
          { label: 'Studios', value: dna.topStudios.length, icon: Building2, color: 'text-emerald-400' },
          { label: 'DNA Level', value: 'Elite', icon: Award, color: 'text-purple-400' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1 shadow-sm">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <span className="text-xl font-black text-white">{stat.value}</span>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* DNA Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Studio Affinity */}
        <section className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-white">Studio Pedigree</h3>
              <p className="text-[11px] text-neutral-500">Your most watched production houses</p>
            </div>
          </div>

          <div className="space-y-4">
            {dna.topStudios.map((studio, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-end text-xs">
                  <span className="font-bold text-neutral-300">{studio.name}</span>
                  <span className="font-black text-emerald-400">{studio.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${studio.percentage}%` }}
                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-400" 
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Language & Dub Profile */}
        <section className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-theme/10 border border-primary-theme/20 flex items-center justify-center text-primary-theme">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-white">Linguistic DNA</h3>
              <p className="text-[11px] text-neutral-500">Regional audio preferences</p>
            </div>
          </div>

          <div className="space-y-4">
            {dna.topLanguages.map((lang, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-end text-xs">
                  <span className="font-bold text-neutral-300">{lang.name} Dub</span>
                  <span className="font-black text-primary-theme">{lang.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${lang.percentage}%` }}
                    className="h-full bg-gradient-to-r from-primary-theme to-purple-400" 
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Genre Mapping */}
        <section className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-black text-white">Genre Signature</h3>
                <p className="text-[11px] text-neutral-500">Your thematic anime blueprint</p>
              </div>
            </div>
            <TrendingUp className="w-5 h-5 text-neutral-700" />
          </div>

          <div className="flex flex-wrap gap-3">
            {dna.topGenres.map((genre, idx) => (
              <div key={idx} className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex-grow basis-40 space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-xs font-black text-white uppercase tracking-wider">{genre.name}</span>
                   <span className="text-[10px] font-black text-amber-400">{genre.percentage}%</span>
                </div>
                <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${genre.percentage}%` }}
                    className="h-full bg-amber-500" 
                  />
                </div>
                <p className="text-[9px] font-bold text-neutral-500">
                  {genre.count} {genre.count === 1 ? 'title' : 'titles'} in your list
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
