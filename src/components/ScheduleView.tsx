import React, { useState, useMemo } from 'react';
import { Calendar, Clock, RefreshCw, Tv, ChevronRight, Search, X, Globe } from 'lucide-react';
import { Anime, normalizeAnimeList } from '../types';
import { PlatformIcon } from './PlatformIcons';
import { OptimizedImage } from './OptimizedImage';
import { SchedulePageSkeleton } from './ui/EclipseState';
import { countAiringSimulcasts } from '../utils/schedule';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { formatLocaleNumber } from '../i18n/languageRegistry';

export interface ScheduleViewProps {
  animeList?: any[];
  catalogList?: any[];
  watchlist?: any[];
  onToggleWatchlist?: (id: any, e?: any) => void;
  onOpenSubmitDubModal?: () => void;
  onSelectAnime: (anime: any) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  onNavigateCatalog?: () => void;
}

const DAYS = [
  { id: 'Monday', short: 'Mon' },
  { id: 'Tuesday', short: 'Tue' },
  { id: 'Wednesday', short: 'Wed' },
  { id: 'Thursday', short: 'Thu' },
  { id: 'Friday', short: 'Fri' },
  { id: 'Saturday', short: 'Sat' },
  { id: 'Sunday', short: 'Sun' },
] as const;

const PRIMARY_LANG_FILTERS = ['All', 'Tamil', 'Hindi', 'Telugu'] as const;
const EXTRA_LANG_FILTERS = ['Malayalam', 'Kannada', 'Bengali'] as const;

function getLanguageAbbrev(lang: string): string {
  const map: Record<string, string> = {
    Tamil: 'TAM',
    Hindi: 'HIN',
    Telugu: 'TEL',
    Malayalam: 'MAL',
    Kannada: 'KAN',
    Bengali: 'BEN',
    Japanese: 'JPN',
    English: 'ENG',
  };
  return map[lang] || lang.slice(0, 3).toUpperCase();
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  animeList: animeListProp,
  catalogList,
  onSelectAnime,
  onRefresh,
  isLoading,
}) => {
  const { t } = useTranslation(['schedule', 'common']);
  const { language: uiLocale } = useLanguage();
  const animeList = useMemo(
    () => normalizeAnimeList(animeListProp || catalogList || []),
    [animeListProp, catalogList]
  );

  const airingSimulcastCount = useMemo(() => countAiringSimulcasts(animeList), [animeList]);

  const todayIndex = new Date().getDay();
  const adjustedTodayIndex = todayIndex === 0 ? 6 : todayIndex - 1;
  const todayId = DAYS[adjustedTodayIndex].id;

  const [selectedDay, setSelectedDay] = useState<string>(todayId);
  const [selectedLang, setSelectedLang] = useState<string>('All');
  const [showMoreLangs, setShowMoreLangs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'day' | 'weekly'>('day');

  // Strict Data Honesty: Only anime with status === 'Airing' AND an explicit verified broadcastDay
  const verifiedScheduledAnime = useMemo(() => {
    return animeList.filter((a) => {
      if (a.status !== 'Airing') return false;
      if (!a.broadcastDay || !DAYS.some((d) => d.id.toLowerCase() === a.broadcastDay?.toLowerCase())) {
        return false;
      }
      if (selectedLang !== 'All' && (!Array.isArray(a.languages) || !a.languages.includes(selectedLang as any))) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          a.title.toLowerCase().includes(q) ||
          (a.japaneseTitle && a.japaneseTitle.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [animeList, selectedLang, searchQuery]);

  // Currently airing anime (even without a verified day/time) so users always get value
  const currentlyAiringFallback = useMemo(() => {
    return animeList.filter((a) => {
      if (a.status !== 'Airing') return false;
      if (selectedLang !== 'All' && (!Array.isArray(a.languages) || !a.languages.includes(selectedLang as any))) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          a.title.toLowerCase().includes(q) ||
          (a.japaneseTitle && a.japaneseTitle.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [animeList, selectedLang, searchQuery]);

  const scheduleByDay = useMemo(() => {
    const grouped: Record<string, Anime[]> = {};
    DAYS.forEach((d) => {
      grouped[d.id] = [];
    });
    verifiedScheduledAnime.forEach((anime) => {
      const matchedDay = DAYS.find((d) => d.id.toLowerCase() === anime.broadcastDay?.toLowerCase());
      if (matchedDay) {
        grouped[matchedDay.id].push(anime);
      }
    });
    return grouped;
  }, [verifiedScheduledAnime]);

  if (isLoading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 pb-24">
        <SchedulePageSkeleton />
      </div>
    );
  }

  const currentDaySlots = scheduleByDay[selectedDay] || [];

  const renderScheduleCard = (anime: Anime, isFallbackUnverified = false) => {
    const verifiedPlatforms = Array.isArray(anime.platforms)
      ? anime.platforms.filter((p) => Boolean(p && p.trim().length > 0))
      : [];
    const verifiedTime =
      !isFallbackUnverified && anime.broadcastTime && anime.broadcastTime.trim().length > 0
        ? anime.broadcastTime.trim()
        : null;

    return (
      <div
        key={anime.id}
        onClick={() => onSelectAnime(anime)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectAnime(anime);
          }
        }}
        data-testid="schedule-anime-card"
        className="group rounded-[14px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 p-3 sm:p-3.5 flex items-center gap-3.5 transition-all duration-180 motion-reduce:transition-none cursor-pointer"
      >
        {/* 2:3 Mini Poster */}
        <div className="w-16 sm:w-[72px] aspect-[2/3] rounded-[10px] overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shrink-0">
          <OptimizedImage
            src={anime.poster}
            alt={anime.title}
            width={144}
            height={216}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-180"
            aspectRatio="portrait"
          />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Verified Broadcast Time or Honest Unverified State */}
          <div className="flex flex-wrap items-center gap-2">
            {verifiedTime ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border border-[var(--accent-primary)]/30 text-[11px] font-bold">
                <Clock className="w-3 h-3 text-[var(--accent-primary)]" />
                {verifiedTime} IST
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[11px] font-medium">
                <Clock className="w-3 h-3 text-[var(--text-secondary)]" />
                {t('schedule:timeNotVerified', 'Time not verified')}
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[11px] font-medium">
              <Tv className="w-3 h-3 text-[var(--accent-primary)]" />
              {anime.episodesCount && anime.episodesCount > 0 ? `${anime.episodesCount} EPS` : 'Airing'}
            </span>
          </div>

          {/* Anime Title (14px, max 2 lines) */}
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-hover)] leading-[20px] line-clamp-2 transition-colors">
            {anime.title}
          </h3>

          {/* Regional Dub Badges & Verified OTT Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1">
              {Array.isArray(anime.languages) && anime.languages.length > 0 ? (
                anime.languages.slice(0, 4).map((lang) => (
                  <span
                    key={lang}
                    className="px-1.5 py-0.5 rounded-[5px] bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[10px] font-bold tracking-wider"
                  >
                    {getLanguageAbbrev(lang)}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-[var(--text-secondary)]">Dub language unverified</span>
              )}
            </div>

            {verifiedPlatforms.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)]">
                <PlatformIcon platform={verifiedPlatforms[0]} className="w-3 h-3 text-[var(--accent-primary)]" />
                <span className="truncate max-w-[100px]">{verifiedPlatforms[0]}</span>
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-secondary)]">OTT not verified</span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] shrink-0 transition-colors" />
      </div>
    );
  };

  return (
    <section
      aria-label="Release Schedule"
      className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[var(--text-primary)]"
    >
      {/* Compact Header & Controls */}
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                <Calendar className="w-3.5 h-3.5" />
                <span>Indian Standard Time (IST) • Official Streams</span>
              </div>
              <span
                data-testid="simulcast-airing-count"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-emerald-500/10 border border-emerald-500/30 text-[#34D399] text-[11px] font-bold"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                {t('schedule:airingCount', {
                  count: formatLocaleNumber(airingSimulcastCount, uiLocale),
                  defaultValue: `${airingSimulcastCount} Airing`,
                })}
              </span>
            </div>
            <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em]">
              {t('schedule:title', 'Release Schedule')}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {t('schedule:subtitle', 'Verified weekly Indian regional dub simulcast schedule')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Day View vs Weekly Overview (44px targets) */}
            <div className="inline-flex rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-1">
              <button
                type="button"
                onClick={() => setViewMode('day')}
                className={`min-h-[44px] px-3.5 rounded-[10px] text-[12px] font-semibold transition-all duration-180 motion-reduce:transition-none ${
                  viewMode === 'day'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Day View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`min-h-[44px] px-3.5 rounded-[10px] text-[12px] font-semibold transition-all duration-180 motion-reduce:transition-none ${
                  viewMode === 'weekly'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Weekly Overview
              </button>
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh schedule"
                title="Refresh schedule"
                className="min-h-[44px] min-w-[44px] px-3 rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-colors duration-180"
              >
                <RefreshCw className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Input + Language Filter Pills (All 44px touch targets) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Language Filter Pills */}
          <div
            role="group"
            aria-label="Filter schedule by dub language"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5"
          >
            {PRIMARY_LANG_FILTERS.map((lang) => {
              const active = selectedLang === lang;
              const pillLabel =
                lang === 'All'
                  ? t('common:all', 'All')
                  : t(`common:languages.${lang.toLowerCase()}`, lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLang(lang)}
                  className={`min-h-[44px] px-4 rounded-[12px] text-[13px] font-semibold whitespace-nowrap border transition-all duration-180 motion-reduce:transition-none ${
                    active
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  {pillLabel}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowMoreLangs((prev) => !prev)}
              aria-expanded={showMoreLangs}
              className={`min-h-[44px] px-3.5 rounded-[12px] text-[13px] font-semibold whitespace-nowrap border transition-all duration-180 ${
                EXTRA_LANG_FILTERS.includes(selectedLang as any)
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              {EXTRA_LANG_FILTERS.includes(selectedLang as any)
                ? t(`common:languages.${selectedLang.toLowerCase()}`, selectedLang)
                : 'More'}
            </button>

            {showMoreLangs &&
              EXTRA_LANG_FILTERS.map((lang) => {
                const active = selectedLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLang(lang)}
                    className={`min-h-[44px] px-3.5 rounded-[12px] text-[13px] font-semibold whitespace-nowrap border transition-all duration-180 ${
                      active
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {t(`common:languages.${lang.toLowerCase()}`, lang)}
                  </button>
                );
              })}
          </div>

          {/* Search Input (44px height) */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter airing anime..."
              aria-label="Filter airing anime"
              className="w-full min-h-[44px] pl-10 pr-10 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear schedule filter"
                className="w-11 h-11 min-w-[44px] min-h-[44px] absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Clean 7-Day Selector (Mon-Sun) with 44px touch targets & NO repeated 0 badges */}
        {viewMode === 'day' && (
          <div
            role="tablist"
            aria-label="Select day of the week"
            className="grid grid-cols-7 gap-1.5 sm:gap-2 bg-[var(--bg-surface)] p-1.5 rounded-[14px] border border-[var(--border-subtle)]"
          >
            {DAYS.map((day) => {
              const isSelected = selectedDay === day.id;
              const isToday = todayId === day.id;
              const dayCount = scheduleByDay[day.id]?.length || 0;
              const dayKey = day.id.toLowerCase();
              return (
                <button
                  key={day.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedDay(day.id)}
                  className={`min-h-[44px] min-w-0 px-1 sm:px-3 py-2 rounded-[10px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-[13px] font-semibold transition-all duration-180 motion-reduce:transition-none ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] font-bold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <span className="truncate max-w-full">{t(`schedule:shortDays.${dayKey}`, day.short)}</span>
                  {isToday && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0" title={t('schedule:today', 'Today')} />
                  )}
                  {dayCount > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
                        isSelected ? 'bg-[var(--bg-canvas)]/20 text-[var(--accent-on-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--accent-hover)]'
                      }`}
                    >
                      {dayCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Schedule Body */}
      {viewMode === 'day' ? (
        currentDaySlots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {currentDaySlots.map((anime) => renderScheduleCard(anime, false))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Calm, compact Eclipse empty banner for selected day (no duplicate CTAs) */}
            <div
              data-testid="schedule-empty-state"
              className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
                    {t('schedule:emptyTitle', {
                      day: t(`schedule:days.${selectedDay.toLowerCase()}`, selectedDay),
                      defaultValue: `No confirmed release today (${selectedDay})`,
                    })}
                  </h2>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {t('schedule:emptySubtitle', 'Check another day or browse currently airing titles in Explore.')}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-secondary)] shrink-0">
                <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Data Honesty Verified
              </span>
            </div>

            {/* Directly display "Currently airing" anime list so the screen still delivers immediate value */}
            {currentlyAiringFallback.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[18px] sm:text-[22px] font-bold text-[var(--text-primary)]">
                    Currently airing ({currentlyAiringFallback.length})
                  </h2>
                  <span className="text-[12px] text-[var(--text-secondary)]">
                    Official Indian regional dubs in progress
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {currentlyAiringFallback.map((anime) => renderScheduleCard(anime, true))}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        /* Weekly Overview Mode: Collapse empty days so we never render 7 dead columns */
        <div className="space-y-6">
          {verifiedScheduledAnime.length > 0 ? (
            DAYS.filter((d) => (scheduleByDay[d.id]?.length || 0) > 0).map((day) => (
              <div key={day.id} className="space-y-3">
                <h2 className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>{t(`schedule:days.${day.id.toLowerCase()}`, day.id)}</span>
                  <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] text-[var(--accent-primary)] text-[12px]">
                    {scheduleByDay[day.id].length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {scheduleByDay[day.id].map((anime) => renderScheduleCard(anime, false))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-6">
              <div
                data-testid="schedule-empty-state"
                className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-5 py-4 flex items-center gap-3.5"
              >
                <Calendar className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
                <div>
                  <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
                    Broadcast times haven&apos;t been verified yet
                  </h2>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    Showing all currently airing regional dub series across Indian OTT platforms.
                  </p>
                </div>
              </div>

              {currentlyAiringFallback.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {currentlyAiringFallback.map((anime) => renderScheduleCard(anime, true))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
