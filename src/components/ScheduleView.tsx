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
  Compass,
} from 'lucide-react';
import { Anime } from './CatalogView';
import { extractCompactLanguageCodes } from './AnimeCard';
import { cloudflareApi } from '../services/cloudflareApi';
import {
  buildVerifiedScheduleData,
  countAiringSimulcasts,
  SCHEDULE_DAYS,
  type DayName,
  type NormalizedScheduleItem,
} from '../utils/schedule';
import { normalizeCanonicalOttList } from '../utils/ottHub';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EclipseState';
import { SchedulePageSkeleton } from './SkeletonGrid';

export interface ScheduleViewProps {
  onSelectAnime: (anime: Anime) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
  onOpenSubmitDubModal?: () => void;
  onBrowseExplore?: () => void;
  catalogList?: Anime[];
}

const PRIMARY_DUB_LANGUAGES = [
  { id: 'All', label: 'All' },
  { id: 'Tamil', label: 'Tamil' },
  { id: 'Hindi', label: 'Hindi' },
  { id: 'Telugu', label: 'Telugu' },
] as const;

const EXTRA_DUB_LANGUAGES = ['Malayalam', 'Kannada'] as const;

export const DAY_SHORT_LABELS: Record<DayName, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

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

export function resolveHonestBroadcastTime(item: Pick<NormalizedScheduleItem, 'airTime' | 'displayAirTime'>): string {
  const raw = (item.airTime || '').trim();
  if (!raw || /tba|unverified|unknown/i.test(raw)) {
    return 'Time not verified';
  }
  return /ist/i.test(raw) ? raw : `${raw} IST`;
}

export function resolveHonestSchedulePlatforms(item: NormalizedScheduleItem): string[] {
  const rawPlatform = typeof item.platform === 'string' && item.platform === 'OTT Simulcast' ? '' : item.platform;
  return normalizeCanonicalOttList({
    ...item,
    platform: rawPlatform,
  });
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onSelectAnime,
  watchlist,
  onToggleWatchlist,
  onOpenSubmitDubModal,
  onBrowseExplore,
  catalogList,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayName>(() => getCurrentIstDayName());
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [showMoreLanguages, setShowMoreLanguages] = useState(false);
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
      const { data, meta, summary } = await cloudflareApi.fetchCatalog({
        page: 1,
        limit: 100,
        status: 'Airing',
      });
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

  const handleNavigateExplore = () => {
    if (onBrowseExplore) {
      onBrowseExplore();
      return;
    }
    const exploreNavBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Explore"]');
    if (exploreNavBtn) {
      exploreNavBtn.click();
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const filterAnime = useCallback(
    (list: NormalizedScheduleItem[]) => {
      return list.filter((anime) => {
        const matchesQuery =
          !searchQuery.trim() ||
          anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (anime.genres && String(anime.genres).toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesLang =
          selectedLanguage === 'All' ||
          selectedLanguage === 'All Dubs' ||
          (anime.languages &&
            String(anime.languages).toLowerCase().includes(selectedLanguage.toLowerCase()));

        return matchesQuery && matchesLang;
      });
    },
    [searchQuery, selectedLanguage]
  );

  const dayAnimeList = filterAnime(
    animeList.filter(
      (a) => a.broadcastDay && a.broadcastDay.toLowerCase() === selectedDay.toLowerCase()
    )
  );
  const filteredAllScheduled = filterAnime(animeList);
  const filteredUnscheduled = filterAnime(unscheduledList);

  const activeDaysWithSlots = SCHEDULE_DAYS.map((day) => ({
    day,
    items: filterAnime(
      animeList.filter((a) => a.broadcastDay && a.broadcastDay.toLowerCase() === day.toLowerCase())
    ),
  })).filter((entry) => entry.items.length > 0);

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-3 sm:pt-5 pb-12 font-sans overflow-x-clip box-border text-[#F4F3FA]">
      {/* 1. COMPACT ECLIPSE HEADER */}
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#F4F3FA] tracking-tight">
              Release Schedule
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] bg-[#12141E] border border-[#292B39] text-[11px] font-semibold text-[#A1A5B5]">
              <Flame className="w-3.5 h-3.5 text-[#F9C876] shrink-0" />
              <span data-testid="simulcast-airing-count" className="font-bold text-[#F4F3FA]">
                {totalSimulcastsCount}
              </span>
              <span>Airing</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-[#12141E] border border-[#292B39] text-[11px] text-[#A1A5B5]">
              <Clock className="w-3.5 h-3.5 text-[#34D399]" />
              <span>Official Streams (IST)</span>
            </span>

            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh schedule"
              className="min-h-[40px] px-3 py-1.5 rounded-[10px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 text-xs font-semibold text-[#A1A5B5] hover:text-[#F4F3FA] inline-flex items-center gap-1.5 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#B49AF8] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <div className="flex items-center p-0.5 rounded-[10px] bg-[#12141E] border border-[#292B39]">
              <button
                type="button"
                onClick={() => setViewMode('day')}
                aria-label="Day View"
                aria-pressed={viewMode === 'day'}
                className={`min-w-[38px] min-h-[38px] px-2 rounded-[8px] text-xs font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer flex items-center justify-center ${
                  viewMode === 'day'
                    ? 'bg-[#B49AF8] text-[#0B0A10]'
                    : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
                title="Day View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Weekly Overview"
                aria-pressed={viewMode === 'grid'}
                className={`min-w-[38px] min-h-[38px] px-2 rounded-[8px] text-xs font-bold transition-colors duration-180 motion-reduce:transition-none cursor-pointer flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-[#B49AF8] text-[#0B0A10]'
                    : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
                title="Weekly Overview"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Language Filter Pills (All, Tamil, Hindi, Telugu) + Compact Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div
            role="group"
            aria-label="Filter schedule by dub language"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          >
            {PRIMARY_DUB_LANGUAGES.map((lang) => {
              const isActive = selectedLanguage === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setSelectedLanguage(lang.id)}
                  aria-pressed={isActive}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-[10px] text-xs font-bold transition-colors duration-180 motion-reduce:transition-none shrink-0 cursor-pointer border ${
                    isActive
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                      : 'bg-[#12141E] border-[#292B39] text-[#F4F3FA] hover:bg-[#191C29] hover:border-[#B49AF8]/50'
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowMoreLanguages((prev) => !prev)}
              aria-expanded={showMoreLanguages}
              className={`min-h-[40px] px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors duration-180 motion-reduce:transition-none shrink-0 cursor-pointer border ${
                EXTRA_DUB_LANGUAGES.includes(selectedLanguage as any)
                  ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8] font-bold'
                  : 'bg-[#12141E] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29]'
              }`}
            >
              {EXTRA_DUB_LANGUAGES.includes(selectedLanguage as any) ? selectedLanguage : 'More'}
            </button>
          </div>

          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 text-[#A1A5B5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter airing titles..."
              aria-label="Search weekly schedule"
              className="w-full h-[40px] bg-[#12141E] border border-[#292B39] focus:border-[#B49AF8] rounded-[10px] pl-8 pr-3 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-180 motion-reduce:transition-none"
            />
          </div>
        </div>

        {showMoreLanguages && (
          <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-[10px] bg-[#12141E] border border-[#292B39]">
            <span className="text-[11px] font-semibold text-[#A1A5B5] px-1.5">More Dubs:</span>
            {EXTRA_DUB_LANGUAGES.map((lang) => {
              const isActive = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setSelectedLanguage(lang);
                    setShowMoreLanguages(false);
                  }}
                  className={`min-h-[36px] px-3 py-1 rounded-[8px] text-xs font-semibold border transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                    isActive
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8] font-bold'
                      : 'bg-[#191C29] text-[#F4F3FA] border-[#292B39] hover:border-[#B49AF8]/50'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        )}

        {/* Horizontal Day Selector (Mon-Sun) with 44px touch targets and 180ms transitions */}
        {viewMode === 'day' && (
          <div
            role="tablist"
            aria-label="Select broadcast day of week"
            data-testid="schedule-day-selector"
            className="grid grid-cols-7 gap-1.5 pt-1"
          >
            {SCHEDULE_DAYS.map((day) => {
              const isSelected = selectedDay === day;
              const shortLabel = DAY_SHORT_LABELS[day];
              const dayCount = filterAnime(
                animeList.filter(
                  (a) => a.broadcastDay && a.broadcastDay.toLowerCase() === day.toLowerCase()
                )
              ).length;

              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`${day} (${dayCount} releases)`}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[44px] min-w-[44px] px-1.5 py-2 rounded-[12px] text-xs font-bold transition-all duration-180 motion-reduce:transition-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                      : 'bg-[#12141E] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29]'
                  }`}
                >
                  <span>{shortLabel}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold tabular-nums leading-tight ${
                      isSelected
                        ? 'bg-[#0B0A10]/20 text-[#0B0A10]'
                        : dayCount > 0
                          ? 'bg-[#191C29] text-[#CBB6FF]'
                          : 'bg-[#191C29]/60 text-[#A1A5B5]/70'
                    }`}
                  >
                    {dayCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* 2. SCHEDULE CONTENT AREA (Collapsed Empty States — Zero Dead Columns) */}
      {loading && totalSimulcastsCount === 0 ? (
        <SchedulePageSkeleton />
      ) : viewMode === 'day' ? (
        <div className="space-y-6">
          {dayAnimeList.length === 0 ? (
            <div data-testid="schedule-empty-state">
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title={`No verified dub releases scheduled for ${selectedDay}`}
                description={
                  animeList.length === 0
                    ? 'We only display weekday broadcast slots once an official Indian OTT release day and time are verified.'
                    : `No verified regional dub episodes are scheduled for ${selectedDay}${
                        selectedLanguage !== 'All' ? ` in ${selectedLanguage}` : ''
                      }. Try another day or browse the full catalog.`
                }
                actionLabel="Browse Explore Catalog"
                onAction={handleNavigateExplore}
                secondaryActionLabel={
                  onOpenSubmitDubModal ? 'Submit Verified Broadcast Slot' : undefined
                }
                onSecondaryAction={onOpenSubmitDubModal}
              />
            </div>
          ) : (
            <div
              data-testid="schedule-day-cards"
              className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
            >
              {dayAnimeList.map((anime, idx) => (
                <AiringAnimeCard
                  key={`${anime.id}-${selectedDay}-${idx}`}
                  anime={anime}
                  onSelect={() => onSelectAnime(anime as unknown as Anime)}
                  isWatchlisted={watchlist.includes(Number(anime.id))}
                  onToggleWatchlist={() => onToggleWatchlist(Number(anime.id))}
                />
              ))}
            </div>
          )}

          {filteredUnscheduled.length > 0 && (
            <section
              aria-label="Airing simulcasts awaiting verified weekday"
              className="space-y-3 pt-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-[#F4F3FA] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#F9C876] shrink-0" />
                  <span>Currently Airing (Broadcast Day Not Verified)</span>
                </h2>
                <span className="text-[11px] font-semibold text-[#A1A5B5] shrink-0">
                  {filteredUnscheduled.length} {filteredUnscheduled.length === 1 ? 'title' : 'titles'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredUnscheduled.map((anime, idx) => (
                  <AiringAnimeCard
                    key={`${anime.id}-unscheduled-${idx}`}
                    anime={anime}
                    onSelect={() => onSelectAnime(anime as unknown as Anime)}
                    isWatchlisted={watchlist.includes(Number(anime.id))}
                    onToggleWatchlist={() => onToggleWatchlist(Number(anime.id))}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* WEEKLY OVERVIEW (Collapses empty days — never renders 7 dead empty columns) */
        <div className="space-y-6">
          {filteredAllScheduled.length === 0 ? (
            <div data-testid="schedule-empty-state">
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title="No verified dub releases scheduled for this week"
                description="We never guess or fabricate broadcast times. Browse the Explore directory or check Latest Dub Updates while weekday slots are being verified."
                actionLabel="Browse Explore Catalog"
                onAction={handleNavigateExplore}
                secondaryActionLabel={
                  onOpenSubmitDubModal ? 'Submit Verified Broadcast Slot' : undefined
                }
                onSecondaryAction={onOpenSubmitDubModal}
              />
            </div>
          ) : (
            <div
              data-testid="schedule-active-days-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {activeDaysWithSlots.map(({ day, items }) => (
                <section
                  key={day}
                  aria-label={`${day} schedule`}
                  className="bg-[#12141E] border border-[#292B39] rounded-[12px] p-3.5 flex flex-col space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#292B39]">
                    <span className="text-xs font-extrabold text-[#F4F3FA] uppercase tracking-wider">
                      {day}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#191C29] text-[#B49AF8] border border-[#292B39]">
                      {items.length} {items.length === 1 ? 'Slot' : 'Slots'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((anime, idx) => (
                      <AiringAnimeCard
                        key={`${anime.id}-${day}-${idx}`}
                        anime={anime}
                        onSelect={() => onSelectAnime(anime as unknown as Anime)}
                        isWatchlisted={watchlist.includes(Number(anime.id))}
                        onToggleWatchlist={() => onToggleWatchlist(Number(anime.id))}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {filteredUnscheduled.length > 0 && (
            <section
              aria-label="Airing simulcasts awaiting verified weekday"
              className="space-y-3 pt-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-[#F4F3FA] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#F9C876] shrink-0" />
                  <span>Currently Airing (Broadcast Day Not Verified)</span>
                </h2>
                <span className="text-[11px] font-semibold text-[#A1A5B5] shrink-0">
                  {filteredUnscheduled.length} {filteredUnscheduled.length === 1 ? 'title' : 'titles'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredUnscheduled.map((anime, idx) => (
                  <AiringAnimeCard
                    key={`${anime.id}-grid-unscheduled-${idx}`}
                    anime={anime}
                    onSelect={() => onSelectAnime(anime as unknown as Anime)}
                    isWatchlisted={watchlist.includes(Number(anime.id))}
                    onToggleWatchlist={() => onToggleWatchlist(Number(anime.id))}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 3. FOOTER CONTRIBUTION STRIP */}
      <div className="mt-8 p-4 sm:p-5 rounded-[12px] bg-[#12141E] border border-[#292B39] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#191C29] border border-[#292B39] text-[#B49AF8] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#F4F3FA]">
              Know a verified Indian dub broadcast time?
            </h3>
            <p className="text-[11px] sm:text-xs text-[#A1A5B5] mt-0.5">
              We only list confirmed IST air times from official OTT platforms. Help keep the schedule accurate.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={handleNavigateExplore} variant="secondary" size="sm">
            <Compass className="w-3.5 h-3.5" />
            <span>Explore Catalog</span>
          </Button>
          {onOpenSubmitDubModal && (
            <Button onClick={onOpenSubmitDubModal} variant="primary" size="sm">
              Submit Airing Info
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/* CLEAN HORIZONTAL / COMPACT SCHEDULE CARD SUB-COMPONENT */
interface AiringAnimeCardProps {
  anime: NormalizedScheduleItem;
  onSelect: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
}

const AiringAnimeCard: React.FC<AiringAnimeCardProps> = ({
  anime,
  onSelect,
  isWatchlisted,
  onToggleWatchlist,
}) => {
  const langCodes = extractCompactLanguageCodes(anime.languages);
  const visibleLangCodes = langCodes.slice(0, 4);
  const extraLangCount = langCodes.length > 4 ? langCodes.length - 4 : 0;

  const platforms = resolveHonestSchedulePlatforms(anime);
  const primaryPlatform = platforms.length > 0 ? platforms[0] : 'Not verified';
  const extraPlatformCount = platforms.length > 1 ? platforms.length - 1 : 0;

  const honestBroadcastTime = resolveHonestBroadcastTime(anime);
  const isTimeVerified = honestBroadcastTime !== 'Time not verified';

  const currentSeasonLabel =
    typeof anime.current_season === 'string' && anime.current_season.trim()
      ? anime.current_season.trim()
      : typeof anime.season === 'string' && anime.season.trim()
        ? anime.season.trim()
        : null;

  const currentEp =
    anime.currentEpisode && anime.currentEpisode > 0
      ? anime.currentEpisode
      : anime.live_episode && Number(anime.live_episode) > 0
        ? Number(anime.live_episode)
        : null;
  const totalEps = anime.totalEpisodes && anime.totalEpisodes > 0 ? anime.totalEpisodes : null;

  const episodeSummary = currentEp
    ? totalEps
      ? `${currentSeasonLabel ? `${currentSeasonLabel} • ` : ''}Ep ${currentEp}/${totalEps}`
      : `${currentSeasonLabel ? `${currentSeasonLabel} • ` : ''}Ep ${currentEp}`
    : currentSeasonLabel
      ? `${currentSeasonLabel} • Airing`
      : 'Episode count not verified';

  return (
    <article
      onClick={onSelect}
      role="button"
      tabIndex={0}
      data-testid="schedule-anime-card"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group relative p-3 sm:p-3.5 rounded-[12px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 transition-all duration-180 motion-reduce:transition-none flex items-start gap-3 sm:gap-3.5 cursor-pointer min-w-0 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B49AF8]/70"
    >
      {/* 2:3 Mini Poster */}
      <div className="relative w-16 sm:w-20 aspect-[2/3] rounded-[8px] overflow-hidden bg-[#191C29] border border-[#292B39] shrink-0">
        <img
          src={anime.cover_image ? anime.cover_image : '/logo.png'}
          alt={anime.title}
          width={80}
          height={120}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = '/logo.png';
          }}
          className="w-full h-full object-cover transition-transform duration-180 motion-reduce:transition-none group-hover:scale-[1.02]"
        />
      </div>

      {/* Card Body */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
        <div className="space-y-1.5">
          {/* Top Row: Verified Broadcast Time (IST) + 44x44px Bookmark Action */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span
              data-testid="schedule-card-time"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-bold border truncate ${
                isTimeVerified
                  ? 'bg-[#191C29] border-[#34D399]/40 text-[#34D399]'
                  : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5]'
              }`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">{honestBroadcastTime}</span>
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchlist();
              }}
              aria-label={
                isWatchlisted
                  ? `Remove ${anime.title} from Watchlist`
                  : `Add ${anime.title} to Watchlist`
              }
              aria-pressed={isWatchlisted}
              className="w-11 h-11 min-w-[44px] min-h-[44px] -my-2 -mr-2 flex items-center justify-center cursor-pointer shrink-0 focus:outline-none"
            >
              <span
                className={`w-8 h-8 rounded-[8px] border flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none ${
                  isWatchlisted
                    ? 'bg-[#191C29] border-[#B49AF8] text-[#B49AF8]'
                    : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] hover:border-[#B49AF8]/50'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isWatchlisted ? 'fill-current' : ''}`} />
              </span>
            </button>
          </div>

          {/* Title (Max 2 Lines) */}
          <h3
            data-testid="schedule-card-title"
            className="text-xs sm:text-sm font-bold text-[#F4F3FA] line-clamp-2 leading-snug group-hover:text-[#CBB6FF] transition-colors duration-180 motion-reduce:transition-none"
          >
            {anime.title}
          </h3>

          {/* Current Season/Episode & Regional Dub Badges (TAM, HIN, TEL) */}
          <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
            <span className="text-[11px] font-semibold text-[#CBB6FF]">{episodeSummary}</span>

            {visibleLangCodes.length > 0 && (
              <>
                <span className="text-[#292B39]">•</span>
                <div className="flex items-center flex-wrap gap-1">
                  {visibleLangCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] bg-[#191C29] border border-[#292B39] text-[10px] font-bold tracking-wider text-[#F4F3FA] uppercase leading-none"
                    >
                      {code}
                    </span>
                  ))}
                  {extraLangCount > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] bg-[#191C29] border border-[#292B39] text-[10px] font-semibold text-[#A1A5B5] leading-none">
                      +{extraLangCount}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card Footer: Verified OTT Platform Badge */}
        <div className="pt-1.5 border-t border-[#292B39] flex items-center justify-between gap-2 text-[11px]">
          <span
            data-testid="schedule-card-platform"
            className={`inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#191C29] border border-[#292B39] text-[10px] font-semibold truncate ${
              primaryPlatform === 'Not verified' ? 'text-[#A1A5B5]/75 italic' : 'text-[#F4F3FA]'
            }`}
          >
            {primaryPlatform}
            {extraPlatformCount > 0 ? ` +${extraPlatformCount}` : ''}
          </span>

          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#B49AF8] group-hover:text-[#CBB6FF] shrink-0">
            <span>Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
};
