import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Sparkles, Loader2 } from 'lucide-react';
import { Anime } from '../types/anime';
import { dbService } from '../services/databaseService';
import { supabase } from '../lib/supabase';

interface ScheduleViewProps {
  onSelectAnime: (anime: Anime) => void;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/**
 * Extracts the release day from anime object across multiple possible database keys
 */
export const extractReleaseDay = (anime: any): string => {
  if (!anime) return '';
  const day = 
    anime.release_day ||
    anime.releaseDay ||
    anime.airing_day ||
    anime.airingDay ||
    anime.day ||
    anime.broadcast_day ||
    anime.season_details?.[0]?.release_day ||
    anime.season_details?.[0]?.releaseDay ||
    anime.seasonDetails?.[0]?.release_day ||
    anime.seasonDetails?.[0]?.releaseDay ||
    '';
  return typeof day === 'string' ? day.trim() : '';
};

/**
 * Extracts live episode number and total episode count
 */
export const extractEpisodeCounts = (anime: any): { liveEp?: number; totalEp?: number } => {
  const liveEpRaw = 
    anime.live_episode_number ??
    anime.liveEpisodeNumber ??
    anime.currently_airing_episode ??
    anime.currentlyAiringEpisode ??
    anime.currentEpisode ??
    anime.current_episode ??
    anime.season_details?.[0]?.live_episode_number ??
    anime.season_details?.[0]?.currentlyAiringEpisode ??
    anime.seasonDetails?.[0]?.live_episode_number ??
    anime.seasonDetails?.[0]?.currentlyAiringEpisode;

  const totalEpRaw = 
    anime.total_episodes ??
    anime.totalEpisodes ??
    anime.episodes ??
    anime.episodeCount ??
    anime.episode_count ??
    anime.season_details?.[0]?.episodeCount ??
    anime.season_details?.[0]?.totalEpisodes ??
    anime.seasonDetails?.[0]?.episodeCount ??
    anime.seasonDetails?.[0]?.totalEpisodes;

  const liveEp = liveEpRaw !== undefined && liveEpRaw !== null && liveEpRaw !== '' ? Number(liveEpRaw) : undefined;
  const totalEp = totalEpRaw !== undefined && totalEpRaw !== null && totalEpRaw !== '' ? Number(totalEpRaw) : undefined;

  return { liveEp, totalEp };
};

/**
 * Evaluates whether an anime is completed based on episode count
 * Condition: live_episode_number >= total_episodes (or if all episodes of that season have aired)
 */
export const isAnimeCompletedByEpisodes = (anime: any): boolean => {
  const { liveEp, totalEp } = extractEpisodeCounts(anime);
  if (liveEp !== undefined && totalEp !== undefined && totalEp > 0 && liveEp >= totalEp) {
    return true;
  }

  // Check season details if available
  const seasonDetails = anime.season_details || anime.seasonDetails;
  if (Array.isArray(seasonDetails) && seasonDetails.length > 0) {
    const s = seasonDetails[0];
    const sLive = s.live_episode_number ?? s.currentlyAiringEpisode;
    const sTotal = s.episodeCount ?? s.totalEpisodes;
    if (sLive !== undefined && sTotal !== undefined && Number(sTotal) > 0 && Number(sLive) >= Number(sTotal)) {
      return true;
    }
  }

  return false;
};

/**
 * Case-insensitive match between anime release day and selected tab
 */
export const isMatchingDay = (anime: any, tabDay: string): boolean => {
  const animeDay = extractReleaseDay(anime);
  if (!animeDay || !tabDay) return false;
  return animeDay.trim().toLowerCase() === tabDay.trim().toLowerCase();
};

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onSelectAnime }) => {
  const [selectedDay, setSelectedDay] = useState<string>('Saturday');
  const [airingAnime, setAiringAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSimulcastSchedule = async (skipCache = false) => {
      try {
        const cacheKey = 'simulcast_schedule_data';
        if (!skipCache) {
          const cached = dbService.getFromMemoryCache<Anime[]>(cacheKey);
          if (cached && cached.length > 0) {
            if (isMounted) {
              setAiringAnime(cached);
              setIsLoading(false);
            }
            return;
          }
        }

        // 1. Check live Supabase database - try anime_list first, fallback to animes
        let { data, error } = await supabase
          .from('anime_list')
          .select('*')
          .or('is_deleted.eq.false,is_deleted.is.null');

        if (error || !data || data.length === 0) {
          const res = await supabase
            .from('animes')
            .select('*')
            .or('is_deleted.eq.false,is_deleted.is.null');
          if (res.data && res.data.length > 0) {
            data = res.data;
          }
        }

        // Debug Fallback Requirement: inspect records returned from Supabase
        console.log("Fetched simulcasts:", data);

        let records: any[] = Array.isArray(data) && data.length > 0 ? data : [];
        if (records.length === 0) {
          records = dbService.getAllAnimeRecords();
        }

        // Normalize all records with complete mapping
        const normalizedList = records.map(r => dbService.normalizeRecord(r));

        // Filter for Airing Now / Simulcast schedule:
        // 1. Status is 'Ongoing' (or 'Simulcast' or 'Airing')
        // 2. Moderation is approved (not pending or rejected)
        // 3. Not deleted
        // 4. Automatic completion check: live_episode_number < total_episodes
        // 5. Has an assigned release day
        const validSimulcasts = normalizedList.filter(item => {
          if (item.isDeleted || (item as any).is_deleted) return false;

          // Moderation approval check
          const rawModStatus = String(item.submissionStatus || (item as any).submission_status || item.status || '').toLowerCase();
          if (rawModStatus === 'pending' || rawModStatus === 'rejected') {
            return false;
          }

          // Ongoing / Simulcast check
          const rawStatus = String(item.status || '').toLowerCase();
          const rawAiring = String(item.airingStatus || (item as any).airing_status || '').toLowerCase();
          const isOngoing = 
            rawStatus.includes('ongoing') || 
            rawStatus.includes('simulcast') || 
            rawStatus.includes('airing') ||
            rawAiring.includes('ongoing') || 
            rawAiring.includes('simulcast') || 
            rawAiring.includes('airing');

          if (!isOngoing) return false;

          // Automatic Completion Logic:
          // If live_episode_number >= total_episodes, filter OUT
          if (isAnimeCompletedByEpisodes(item)) {
            return false;
          }

          // Must have an assigned release day
          const day = extractReleaseDay(item);
          return Boolean(day);
        });

        // Deduplicate by lowercase title
        const uniqueMap = new Map<string, Anime>();
        validSimulcasts.forEach(anime => {
          const key = anime.title.trim().toLowerCase();
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, anime);
          }
        });
        const dedupedSimulcasts = Array.from(uniqueMap.values());

        dbService.setMemoryCache(cacheKey, dedupedSimulcasts);

        if (isMounted) {
          setAiringAnime(dedupedSimulcasts);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[ScheduleView] Error loading simulcast schedule:', err);
        // Fallback to local approved anime
        const localApproved = dbService.getApprovedAnime();
        const fallbackOngoing = localApproved.filter(item => {
          const rawAiring = String(item.airingStatus || (item as any).airing_status || item.status || '').toLowerCase();
          const isOngoing = rawAiring.includes('ongoing') || rawAiring.includes('simulcast') || rawAiring.includes('airing');
          return isOngoing && Boolean(extractReleaseDay(item)) && !isAnimeCompletedByEpisodes(item);
        });

        if (isMounted) {
          setAiringAnime(fallbackOngoing);
          setIsLoading(false);
        }
      }
    };

    fetchSimulcastSchedule();

    const unsub = dbService.subscribe(() => {
      fetchSimulcastSchedule(true);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // Filter shows for the selected day tab using case-insensitive day comparison
  const showsForDay = airingAnime.filter(a => isMatchingDay(a, selectedDay));

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

      {/* Days Tabs (Case-insensitive matching) */}
      <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {DAYS.map((day) => {
          const isSelected = selectedDay.toLowerCase() === day.toLowerCase();
          const count = airingAnime.filter((a) => isMatchingDay(a, day)).length;
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

      {/* Loading state indicator */}
      {isLoading && airingAnime.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-theme" />
          <p className="text-xs font-semibold">Syncing simulcast schedule from database...</p>
        </div>
      ) : showsForDay.length > 0 ? (
        /* Shows on selected day */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {showsForDay.map((anime) => {
            const { liveEp, totalEp } = extractEpisodeCounts(anime);
            const animeDay = extractReleaseDay(anime) || selectedDay;

            return (
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
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                        <Clock className="w-3 h-3" />
                        <span>Every {animeDay}</span>
                      </div>
                      {liveEp !== undefined && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-black">
                          EP {liveEp}{totalEp ? ` / ${totalEp}` : ''}
                        </span>
                      )}
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
                      {(anime.dubs || []).map((dub, idx) => (
                        <span
                          key={`${anime.id}-${dub}-${idx}`}
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
            );
          })}
        </div>
      ) : (
        /* Exact empty state required by user */
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

export default ScheduleView;

