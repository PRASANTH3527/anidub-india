import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Sparkles,
  Flame,
  Clock,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Bookmark,
  ChevronRight,
} from 'lucide-react';
import { Anime } from './CatalogView';
import { cloudflareApi } from '../services/cloudflareApi';
import {
  buildVerifiedScheduleData,
  countAiringSimulcasts,
  SCHEDULE_DAYS,
  type DayName,
  type NormalizedScheduleItem,
} from '../utils/schedule';
import { parsePlatformList } from '../utils/dataNormalization';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EclipseState';
import { SchedulePageSkeleton } from './SkeletonGrid';

export interface ScheduleViewProps {
  onSelectAnime: (anime: Anime) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onOpenSubmitDubModal?: () => void;
  catalogList?: Anime[];
}

const DUB_LANGUAGES = ['All Dubs', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada'];

function getCurrentIstDayName(): DayName {
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'Asia/Kolkata',
    }).format(new Date());
    const matched = SCHEDULE_DAYS.find((d) => d.toLowerCase() === weekday.toLowerCase());
    if (matched) return matched;
  } catch {
    // Fallback below
  }
  return 'Monday';
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onSelectAnime,
  watchlist,
  onToggleWatchlist,
  onOpenSubmitDubModal,
  catalogList,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayName>(() => getCurrentIstDayName());
  const [selectedLanguage, setSelectedLanguage] = useState('All Dubs');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'day' | 'grid'>('day');
  const [animeList, setAnimeList] = useState<NormalizedScheduleItem[]>([]);
  const [unscheduledList, setUnscheduledList] = useState<NormalizedScheduleItem[]>([]);
  const [totalSimulcastsCount, setTotalSimulcastsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyScheduleItems = useCallback((rawItems: any[], apiReportedCount?: number | null) => {
    const { allSimulcasts, scheduledItems, unscheduledItems } = buildVerifiedScheduleData(rawItems);
    setAnimeList(scheduledItems);
    setUnscheduledList(unscheduledItems);
    const dynamicAiringCount = countAiringSimulcasts(rawItems, apiReportedCount);
    setTotalSimulcastsCount(Math.max(dynamicAiringCount, allSimulcasts.length));
  }, []);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const { data, meta, summary } = await cloudflareApi.fetchCatalog({ page: 1, limit: 100, status: 'Airing' });
      const combined = [
        ...(Array.isArray(data) ? data : []),
        ...(Array.isArray(catalogList) ? catalogList : []),
      ];
      const apiAiringCount = summary?.airingCount ?? meta?.totalItems ?? null;
      applyScheduleItems(combined, apiAiringCount);
    } catch (err) {
      console.error('Failed to fetch schedule data from Cloudflare:', err);
      if (catalogList && catalogList.length > 0) {
        applyScheduleItems(catalogList);
      } else {
        applyScheduleItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [applyScheduleItems, catalogList]);

  useEffect(() => {
    if (catalogList && catalogList.length > 0) {
      applyScheduleItems(catalogList);
    }
    void fetchSchedule();
  }, [fetchSchedule, catalogList, applyScheduleItems]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSchedule();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Filter anime by query and language
  const filterAnime = (list: NormalizedScheduleItem[]) => {
    return list.filter((anime) => {
      const matchesQuery =
        !searchQuery.trim() ||
        anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (anime.genres && String(anime.genres).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesLang =
        selectedLanguage === 'All Dubs' ||
        (anime.languages && String(anime.languages).toLowerCase().includes(selectedLanguage.toLowerCase()));

      return matchesQuery && matchesLang;
    });
  };

  const dayAnimeList = filterAnime(
    animeList.filter((a) => a.broadcastDay && a.broadcastDay.toLowerCase() === selectedDay.toLowerCase())
  );
  const filteredUnscheduled = filterAnime(unscheduledList);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 font-sans overflow-x-clip box-border text-[#F4F3FA]">
      {/* 1. HEADER BANNER */}
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#12141E] border border-[#292B39] text-[#B49AF8] text-xs font-semibold max-w-full">
          <Calendar className="w-3.5 h-3.5 text-[#B49AF8] shrink-0" />
          <span className="truncate">Weekly Indian Dub Broadcast Calendar</span>
        </div>

        <h1 className="font-heading font-black text-2xl sm:text-4xl text-[#F4F3FA] tracking-tight">
          Weekly Dub Release Schedule
        </h1>

        <p className="text-xs sm:text-sm text-[#A1A5B5] max-w-2xl mx-auto leading-relaxed">
          Track verified simulcast broadcast days and IST air times for Tamil, Telugu, Hindi, Malayalam, and Kannada dubs across Crunchyroll, Netflix, and JioCinema India.
        </p>

        {/* Quick Stats Row */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12141E] border border-[#292B39] text-xs text-[#A1A5B5]">
            <Flame className="w-3.5 h-3.5 text-[#F9C876] shrink-0" />
            <span data-testid="simulcast-airing-count" className="font-bold text-[#F4F3FA]">{totalSimulcastsCount}</span>
            <span>Simulcasts Airing</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12141E] border border-[#292B39] text-xs text-[#A1A5B5]">
            <Clock className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Verified Schedule (IST)</span>
          </div>

          <button
            onClick={handleRefresh}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 text-xs font-semibold text-[#A1A5B5] hover:text-[#F4F3FA] transition-colors duration-150 cursor-pointer"
            title="Refresh schedule times"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#B49AF8] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. INTERACTIVE CONTROL BAR */}
      <div className="bg-[#12141E] border border-[#292B39] rounded-2xl p-4 mb-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Dub language filter tabs */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 w-full md:w-auto">
          {DUB_LANGUAGES.map((lang) => {
            const isActive = selectedLanguage === lang;
            return (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 shrink-0 cursor-pointer border ${
                  isActive
                    ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                    : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>

        {/* Right: Search input + View Mode Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto min-w-0 justify-between md:justify-end">
          <div className="relative flex-1 min-w-0 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#A1A5B5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search weekly schedule..."
              aria-label="Search weekly schedule"
              className="w-full min-h-[40px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-xl pl-9 pr-3 py-2 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-150"
            />
          </div>

          <div className="flex items-center p-1 rounded-xl bg-[#191C29] border border-[#292B39] shrink-0">
            <button
              onClick={() => setViewMode('day')}
              aria-label="Day View"
              className={`min-w-[36px] min-h-[36px] p-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center justify-center ${
                viewMode === 'day' ? 'bg-[#B49AF8] text-[#0B0A10]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
              title="Day View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Weekly Grid Matrix"
              className={`min-w-[36px] min-h-[36px] p-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center justify-center ${
                viewMode === 'grid' ? 'bg-[#B49AF8] text-[#0B0A10]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
              title="Weekly Grid Matrix"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. DAY TABS (Only shown in Day View) */}
      {viewMode === 'day' && (
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 pb-2 mb-6">
          {SCHEDULE_DAYS.map((day) => {
            const isSelected = selectedDay === day;
            const dayCount = filterAnime(
              animeList.filter((a) => a.broadcastDay && a.broadcastDay.toLowerCase() === day.toLowerCase())
            ).length;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`relative min-h-[40px] px-3.5 py-2 md:px-4 md:py-2.5 rounded-xl text-xs font-bold transition-colors duration-150 shrink-0 flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                    : 'bg-[#12141E] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] hover:border-[#B49AF8]/60'
                }`}
              >
                <span>{day}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-[#0B0A10]/20 text-[#0B0A10]' : 'bg-[#191C29] text-[#A1A5B5]'
                  }`}
                >
                  {dayCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. CONTENT AREA */}
      {loading && totalSimulcastsCount === 0 ? (
        <SchedulePageSkeleton />
      ) : viewMode === 'day' ? (
        /* DAY VIEW */
        <div className="space-y-6">
          {dayAnimeList.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-6 h-6" />}
              title={
                animeList.length === 0
                  ? 'No verified broadcast slots yet'
                  : `No verified broadcast slots for ${selectedDay}`
              }
              description={
                animeList.length === 0
                  ? 'Currently airing titles without verified broadcast days or times are listed below as TBA.'
                  : `No dubbed anime have a verified broadcast slot on ${selectedDay} matching your filters. Check another weekday or submit missing schedule info.`
              }
              actionLabel={onOpenSubmitDubModal ? 'Submit Missing Broadcast Day' : undefined}
              onAction={onOpenSubmitDubModal}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dayAnimeList.map((anime, idx) => (
                <AiringAnimeCard
                  key={`${anime.id}-${selectedDay}-${idx}`}
                  anime={anime}
                  onSelect={() => onSelectAnime(anime as unknown as Anime)}
                  isWatchlisted={watchlist.includes(Number(anime.id))}
                  onToggleWatchlist={() => onToggleWatchlist(Number(anime.id))}
                  mode="full"
                />
              ))}
            </div>
          )}

          {filteredUnscheduled.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#F4F3FA] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#F9C876]" />
                  <span>Airing Simulcasts (Broadcast Day TBA)</span>
                </h2>
                <span className="text-[11px] font-semibold text-[#A1A5B5]">
                  {filteredUnscheduled.length} awaiting verified slot
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUnscheduled.map((anime, idx) => (
                  <AiringAnimeCard
                    key={`${anime.id}-tba-${idx}`}
                    anime={anime}
                    onSelect={() => onSelectAnime(anime as unknown as Anime)}
                    isWatchlisted={watchlist.includes(Number(anime.id))}
                    onToggleWatchlist={() => onToggleWatchlist(Number(anime.id))}
                    mode="full"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* WEEKLY GRID MATRIX VIEW */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {SCHEDULE_DAYS.map((day) => {
              const dayItems = filterAnime(
                animeList.filter((a) => a.broadcastDay && a.broadcastDay.toLowerCase() === day.toLowerCase())
              );

              return (
                <div
                  key={day}
                  className="bg-[#12141E] border border-[#292B39] rounded-2xl p-3 flex flex-col space-y-3 min-h-[300px]"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#292B39]">
                    <span className="text-xs font-black text-[#F4F3FA]">{day.slice(0, 3).toUpperCase()}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#191C29] text-[#B49AF8] border border-[#292B39]">
                      {dayItems.length}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
                    {dayItems.length === 0 ? (
                      <div className="text-center py-8 text-[11px] text-[#A1A5B5] italic">
                        No simulcasts
                      </div>
                    ) : (
                      dayItems.map((anime, idx) => (
                        <AiringAnimeCard
                          key={`${anime.id}-${day}-${idx}`}
                          anime={anime}
                          onSelect={() => onSelectAnime(anime as unknown as Anime)}
                          isWatchlisted={watchlist.includes(Number(anime.id))}
                          onToggleWatchlist={() => onToggleWatchlist(Number(anime.id))}
                          mode="compact"
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredUnscheduled.length > 0 && (
            <div className="bg-[#12141E] border border-[#292B39] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#A1A5B5]">
                  Airing Simulcasts — Day TBA ({filteredUnscheduled.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredUnscheduled.map((anime, idx) => (
                  <AiringAnimeCard
                    key={`${anime.id}-grid-tba-${idx}`}
                    anime={anime}
                    onSelect={() => onSelectAnime(anime as unknown as Anime)}
                    isWatchlisted={watchlist.includes(Number(anime.id))}
                    onToggleWatchlist={() => onToggleWatchlist(Number(anime.id))}
                    mode="compact"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOOTER CALL-TO-ACTION */}
      <div className="mt-12 p-6 rounded-2xl bg-[#12141E] border border-[#292B39] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#191C29] border border-[#292B39] text-[#F9C876] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#F4F3FA]">Know a missing broadcast air time?</h4>
            <p className="text-xs text-[#A1A5B5] mt-0.5">
              Help us maintain India&apos;s most accurate regional dub air-schedule by contributing verified broadcast slots.
            </p>
          </div>
        </div>
        {onOpenSubmitDubModal && (
          <Button
            onClick={onOpenSubmitDubModal}
            variant="primary"
            size="md"
          >
            Submit Dub Airing Info
          </Button>
        )}
      </div>
    </div>
  );
};

/* AIRING ANIME CARD SUB-COMPONENT */
interface AiringAnimeCardProps {
  anime: NormalizedScheduleItem;
  onSelect: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  mode: 'full' | 'compact';
}

const AiringAnimeCard: React.FC<AiringAnimeCardProps> = ({
  anime,
  onSelect,
  isWatchlisted,
  onToggleWatchlist,
  mode,
}) => {
  const languages = anime.languages
    ? typeof anime.languages === 'string'
      ? anime.languages.split(/[,|/]/).map((l: string) => l.trim()).filter(Boolean)
      : Array.isArray(anime.languages)
        ? anime.languages.filter(Boolean)
        : []
    : [];

  const totalEps = anime.totalEpisodes || null;
  const currentEp = anime.currentEpisode && anime.currentEpisode > 0 ? anime.currentEpisode : null;
  const progressPercent =
    currentEp && totalEps ? Math.min(Math.round((currentEp / totalEps) * 100), 100) : null;

  if (mode === 'compact') {
    return (
      <div
        onClick={onSelect}
        className="p-2.5 rounded-xl bg-[#191C29] border border-[#292B39] hover:border-[#B49AF8]/60 transition-colors duration-150 cursor-pointer space-y-1.5 group"
      >
        <div className="flex items-center gap-2">
          <img
            src={anime.cover_image ? anime.cover_image : '/logo.png'}
            alt={anime.title}
            width={32}
            height={44}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = '/logo.png';
            }}
            className="w-8 h-11 rounded-lg object-cover shrink-0 border border-[#292B39]"
          />
          <div className="min-w-0 flex-1">
            <h5 className="text-[11px] font-bold text-[#F4F3FA] truncate group-hover:text-[#B49AF8] transition-colors duration-150 leading-tight">
              {anime.title}
            </h5>
            <div className="text-[10px] text-[#F9C876] font-semibold">{anime.displayAirTime}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] text-[#A1A5B5] gap-2">
          <span className="truncate">
            {parsePlatformList(anime.platform, undefined, undefined, { defaultFallback: [] }).join(', ') || 'Not verified'}
          </span>
          <span className="font-bold text-[#B49AF8] shrink-0">
            {currentEp ? `EP ${currentEp}` : 'TBA'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 transition-colors duration-150 shadow-xl flex flex-col justify-between space-y-4 group min-w-0 overflow-hidden">
      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
        <div
          onClick={onSelect}
          className="relative w-20 sm:w-24 aspect-[3/4.2] rounded-xl overflow-hidden bg-[#191C29] border border-[#292B39] shrink-0 cursor-pointer"
        >
          <img
            src={anime.cover_image ? anime.cover_image : '/logo.png'}
            alt={anime.title}
            width={192}
            height={269}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = '/logo.png';
            }}
            className="w-full h-full object-cover"
          />
          {anime.rating ? (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#0B0A10]/85 border border-[#292B39] text-[9px] font-black text-[#F9C876]">
              {anime.rating} ★
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="px-2.5 py-0.5 rounded-full bg-[#34D399]/10 border border-[#34D399]/35 text-[#34D399] text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 max-w-full truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] shrink-0" />
              <span className="truncate">{anime.broadcastDay || 'Simulcast'}</span>
            </span>

            <button
              onClick={onToggleWatchlist}
              className={`min-w-[36px] min-h-[36px] p-1.5 rounded-xl border transition-colors duration-150 cursor-pointer flex items-center justify-center ${
                isWatchlisted
                  ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                  : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
              title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
              aria-label={isWatchlisted ? `Remove ${anime.title} from Watchlist` : `Add ${anime.title} to Watchlist`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isWatchlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          <h3
            onClick={onSelect}
            className="text-sm sm:text-base font-black text-[#F4F3FA] truncate cursor-pointer group-hover:text-[#B49AF8] transition-colors duration-150 leading-snug"
          >
            {anime.title}
          </h3>

          <div className="flex items-center gap-2 text-xs text-[#A1A5B5] flex-wrap">
            <span className="font-semibold text-[#F9C876] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{anime.displayAirTime}</span>
            </span>
            <span>•</span>
            <span className="text-[#F4F3FA]">
              {parsePlatformList(anime.platform, undefined, undefined, { defaultFallback: [] }).join(', ') || 'Not verified'}
            </span>
          </div>

          {languages.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {languages.slice(0, 4).map((l: string) => (
                <span
                  key={l}
                  className="px-2 py-0.5 rounded-md bg-[#191C29] border border-[#292B39] text-[10px] font-bold text-[#A1A5B5]"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-[#292B39] space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#A1A5B5] font-medium">Broadcast Status</span>
          <span className="text-[#F4F3FA] font-bold">
            {currentEp && totalEps
              ? `Episode ${currentEp} of ${totalEps}`
              : currentEp
                ? `Episode ${currentEp} (Airing)`
                : anime.broadcastDay
                  ? `Airing • ${anime.broadcastDay}`
                  : 'Airing • Broadcast Slot TBA'}
          </span>
        </div>
        {progressPercent !== null && (
          <div className="w-full h-1.5 rounded-full bg-[#191C29] overflow-hidden">
            <div
              className="h-full bg-[#B49AF8] rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-[#A1A5B5] font-semibold">Official Streams</span>

        <button
          onClick={onSelect}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#B49AF8] hover:text-[#CBB6FF] transition-colors duration-150 cursor-pointer"
        >
          <span>View Dub Details</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
