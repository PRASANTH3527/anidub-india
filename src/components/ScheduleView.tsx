import React, { useState, useEffect } from 'react';
import { Calendar, Play, Clock, Sparkles } from 'lucide-react';
import { Anime, DubLanguage } from '../types/anime';
import { dbService } from '../services/databaseService';

interface ScheduleViewProps {
  onSelectAnime: (anime: Anime) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onSelectAnime }) => {
  const [selectedDay, setSelectedDay] = useState<string>('Saturday');
  const [approvedList, setApprovedList] = useState(() => dbService.getApprovedAnime());

  useEffect(() => {
    const unsub = dbService.subscribe(() => {
      setApprovedList(dbService.getApprovedAnime());
    });
    return () => unsub();
  }, []);

  // STRICT MODERATION: Filter ONLY approved anime marked as 'Ongoing' (or 'Airing') with an assigned release day
  const getAnimeDay = (anime: Anime) => anime.releaseDay || anime.airingDay;

  const airingAnime = approvedList.filter((a) => {
    const isOngoing = a.status === 'Ongoing' || a.airingStatus === 'Ongoing' || a.status === 'Airing';
    return isOngoing && Boolean(getAnimeDay(a));
  });

  const showsForDay = airingAnime.filter((a) => getAnimeDay(a) === selectedDay);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full badge-primary-theme text-xs font-semibold">
          <Calendar className="w-3.5 h-3.5 text-accent-theme" />
          <span>Weekly Indian Dub Broadcast Schedule</span>
        </div>
        <h2 className="font-heading font-black text-2xl sm:text-3xl text-white">
          Airing Now & Simulcast Dubs
        </h2>
        <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto">
          Keep track of which day new episodes with Tamil, Telugu, and Hindi audio are added to Crunchyroll, Netflix, and JioCinema.
        </p>
      </div>

      {/* Days Tabs */}
      <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {DAYS.map((day) => {
          const isSelected = selectedDay === day;
          const count = airingAnime.filter((a) => getAnimeDay(a) === day).length;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'btn-primary-theme text-white shadow-primary-theme'
                  : 'bg-[#131926] text-neutral-400 hover:text-white hover:bg-[#1a2336] border border-neutral-800'
              }`}
            >
              <span>{day}</span>
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-primary-theme text-white' : 'bg-neutral-800 text-neutral-300'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Shows on selected day */}
      {showsForDay.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {showsForDay.map((anime) => (
            <div
              key={anime.id}
              onClick={() => onSelectAnime(anime)}
              className="bg-[#131926] border border-neutral-800 hover:border-primary-theme/50 rounded-xl p-3.5 flex gap-3.5 cursor-pointer group transition-all"
            >
              <img
                src={anime.imageUrl || anime.poster || undefined}
                alt={anime.title}
                loading="lazy"
                decoding="async"
                className="w-20 aspect-[3/4.2] object-cover rounded-lg shrink-0 shadow-md sm:group-hover:scale-102 transition-transform"
              />
              <div className="flex flex-col justify-between flex-grow">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold mb-1">
                    <Clock className="w-3 h-3" />
                    <span>Every {getAnimeDay(anime)}</span>
                  </div>
                  <h4 className="font-bold text-sm text-neutral-100 group-hover:text-primary-theme line-clamp-1">
                    {anime.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {anime.studio}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {(anime.dubs || []).map((dub) => (
                      <span
                        key={dub}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded badge-primary-theme"
                      >
                        {dub} Dub
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/60">
                    <span>{anime.platforms && anime.platforms[0]?.name ? anime.platforms[0].name : 'Crunchyroll'}</span>
                    <span className="text-accent-theme font-semibold group-hover:underline">
                      View details →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-[#131926]/50 border border-neutral-800 rounded-2xl p-8 max-w-md mx-auto">
          <Sparkles className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
          <h4 className="font-bold text-white text-sm mb-1">
            No simulcasts currently scheduled for {selectedDay}
          </h4>
          <p className="text-xs text-neutral-400">
            Check Saturday or Sunday for major weekend episode premieres!
          </p>
        </div>
      )}
    </div>
  );
};
