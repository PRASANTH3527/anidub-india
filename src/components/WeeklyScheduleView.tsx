import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Sparkles, 
  Flame, 
  CheckCircle2, 
  Heart, 
  Bookmark, 
  Star, 
  Cloud 
} from 'lucide-react';
import { Anime } from './CatalogView';

interface WeeklyScheduleViewProps {
  onSelectAnime: (anime: Anime) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onOpenSubmitDubModal: () => void;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const WeeklyScheduleView: React.FC<WeeklyScheduleViewProps> = ({
  onSelectAnime,
  watchlist,
  onToggleWatchlist,
  onOpenSubmitDubModal
}) => {
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnimeList();
  }, []);

  const fetchAnimeList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/anime?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const normalized = data.data.map((item: any, idx: number) => ({
            ...item,
            languages: item.languages || (idx % 3 === 0 ? 'HIN,TAM,TEL' : idx % 2 === 0 ? 'HIN,TAM' : 'HIN,TEL'),
            platform: item.platform || (idx % 2 === 0 ? 'Crunchyroll' : 'Netflix'),
            type: item.type || (idx % 4 === 0 ? 'Movie' : 'TV Series'),
            releaseDay: item.releaseDay || WEEKDAYS[idx % WEEKDAYS.length]
          }));
          setAnimeList(normalized);
        }
      }
    } catch (err) {
      console.error('Failed to fetch schedule anime:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAnime = animeList.filter(anime => {
    const day = (anime as any).releaseDay || 'Monday';
    return day.toLowerCase() === selectedDay.toLowerCase();
  });

  return (
    <div className="w-full max-w-[510px] mx-auto px-4 py-6 font-['Inter',sans-serif] text-slate-100">
      
      {/* 1. TOP HEADER SECTION */}
      <div className="text-center pt-8 pb-6 px-4">
        {/* Top Pill Badge */}
        <div className="inline-flex items-center gap-2 bg-[#2e1065]/80 border border-[#7e22ce]/60 rounded-full px-4 py-1.5 shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-[#c084fc]" />
          <span className="text-[12px] font-medium text-[#d8b4fe]">Weekly Indian Dub Broadcast Schedule</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-[26px] font-extrabold text-white tracking-tight text-center mt-4 font-['Space_Grotesk',sans-serif]">
          Airing Now & Simulcast Dubs
        </h1>

        {/* Subtitle */}
        <p className="text-[13px] text-[#8b92a5] text-center max-w-md mx-auto leading-relaxed mt-2.5">
          Keep track of which day new episodes with Tamil, Telugu, and Hindi audio are added to Crunchyroll, Netflix, and JioCinema.
        </p>
      </div>

      {/* 2. WEEKDAY SELECTOR TABS (Horizontal Scroll) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 px-4 scrollbar-none whitespace-nowrap">
        {WEEKDAYS.map((day) => {
          const active = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all shrink-0 cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-[#9333ea] to-[#7c3aed] text-white font-bold shadow-[0_6px_20px_rgba(147,51,234,0.45)]'
                  : 'bg-[#111524] border border-[#1e243b] text-[#94a3b8] font-medium hover:border-[#2e3656]'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* 3. SCHEDULE CONTENT / EMPTY STATE CARD */}
      <div className="px-4 mt-2">
        {filteredAnime.length > 0 ? (
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {filteredAnime.map((anime) => {
              const isWatchlisted = watchlist.includes(anime.id);
              const langs = (anime.languages || 'HIN,TAM,TEL').split(',').map(l => l.trim());
              const typeStr = anime.type || 'TV Series';
              const yrStr = anime.year || 2026;
              const plats = anime.platform ? anime.platform.split(',').map(p => p.trim()) : ['Crunchyroll'];
              const platDisplay = plats.length === 1 ? plats[0] : plats.map(p => p[0].toUpperCase()).join(', ');

              return (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime)}
                  className="group bg-[#0e1320] border border-[#1c2235] rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer hover:border-[#2d3748] transition-all shadow-lg"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e1320] via-transparent to-transparent pointer-events-none" />

                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
                      <div className="bg-gradient-to-r from-[#a855f7] to-[#7c3aed] rounded-full px-2.5 py-0.5 flex items-center space-x-1 shadow-md">
                        <Flame className="w-[11px] h-[11px] text-white fill-white" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">TRENDING</span>
                      </div>
                      <div className="bg-[#062e22]/90 border border-[#10b981]/50 rounded-full px-2.5 py-0.5 flex items-center space-x-1 shadow-md">
                        <CheckCircle2 className="w-[10px] h-[10px] text-[#34d399]" />
                        <span className="text-[10px] font-medium text-[#34d399]">Offline Ready</span>
                      </div>
                    </div>

                    <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5 z-10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); }} 
                        className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-md"
                        title="Favorite"
                      >
                        <Heart className="w-[13px] h-[13px]" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime.id); }}
                        className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-md"
                        title="Bookmark"
                      >
                        <Bookmark className={`w-[13px] h-[13px] ${isWatchlisted ? 'text-orange-400 fill-orange-400' : 'text-white'}`} />
                      </button>
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 z-10">
                      <div className="bg-[#090b10]/95 border border-white/10 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5 shadow-md">
                        <Star className="w-3 h-3 fill-[#f97316] text-[#f97316]" />
                        <span className="text-[10px] font-bold text-[#f97316] uppercase tracking-wide">RATING</span>
                        <span className="text-[11px] font-bold text-white">{anime.rating}/10</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0e1320] flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {langs.map((l) => {
                          const upper = l.toUpperCase();
                          let bgClass = 'bg-[#059669]';
                          let label = 'HIN';
                          if (upper.includes('TAM')) { bgClass = 'bg-[#d97706]'; label = 'TAM'; }
                          else if (upper.includes('TEL')) { bgClass = 'bg-[#0284c7]'; label = 'TEL'; }
                          else if (upper.includes('MAL')) { bgClass = 'bg-[#9333ea]'; label = 'MAL'; }
                          else if (upper.includes('HIN')) { bgClass = 'bg-[#059669]'; label = 'HIN'; }

                          return (
                            <span
                              key={l}
                              className={`${bgClass} rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>

                      <h3 className="font-bold text-white text-[15px] truncate mt-2 leading-snug">
                        {anime.title}
                      </h3>

                      <div className="text-[11px] text-[#8b92a5] mt-0.5">
                        {typeStr} • {yrStr}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#1a2035] flex items-center justify-between gap-1 text-[11px]">
                      <span className="bg-[#151b2d] border border-[#232b42] rounded-md px-2 py-0.5 text-[#94a3b8] font-medium truncate">
                        {platDisplay}
                      </span>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <div className="bg-[#151b2d] border border-[#232b42] rounded-full px-2 py-0.5 flex items-center space-x-1">
                          <Heart className="w-[11px] h-[11px] text-[#94a3b8]" />
                          <span className="text-[11px] text-[#cbd5e1]">{Math.floor((anime.popularity || 1000) / 100)}</span>
                        </div>
                        <div className="bg-[#151b2d] border border-[#232b42] rounded-full px-2 py-0.5 flex items-center space-x-1">
                          <Flame className="w-[11px] h-[11px] text-[#94a3b8]" />
                          <span className="text-[11px] text-[#cbd5e1]">{anime.popularity || 1200}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State Card */
          <div className="bg-[#101422] border border-[#1c2235] rounded-3xl py-14 px-6 text-center my-2 flex flex-col items-center justify-center">
            <Sparkles className="w-9 h-9 text-[#475569] mb-4" strokeWidth={1.5} />
            <h3 className="text-[15px] font-bold text-white">
              No simulcasts currently scheduled for {selectedDay}
            </h3>
            <p className="text-[12px] text-[#64748b] mt-1.5 max-w-xs leading-normal">
              Check Saturday or Sunday for major weekend episode premieres!
            </p>
          </div>
        )}
      </div>

      {/* 4. BOTTOM CALL-TO-ACTION */}
      <div className="border-t border-[#161b2c] mt-10 pt-10 px-6 text-center">
        <h3 className="text-[20px] font-bold text-white font-['Space_Grotesk',sans-serif]">
          Know a missing dub?
        </h3>
        <p className="text-[13px] text-[#8b92a5] mt-2 max-w-sm mx-auto leading-relaxed">
          Help us build the ultimate Indian anime directory by contributing new titles or regional audio info.
        </p>
        <button
          onClick={onOpenSubmitDubModal}
          className="mt-5 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#9333ea] to-[#7c3aed] hover:opacity-95 text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all cursor-pointer"
        >
          Submit Dub Info
        </button>
      </div>

    </div>
  );
};
