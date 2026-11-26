import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  PlayCircle,
  Clock,
  Bookmark,
  BarChart3,
  Languages,
  Compass,
  Sparkles,
} from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';
import {
  WATCHED_IDS_STORAGE_KEY,
  getAllWatchProgress,
  type WatchProgressEntry,
} from '../utils/watchProgress';
import { computePersonalAnimeStats } from '../utils/personalStats';
import { Button } from './ui/Button';

interface PersonalAnimeStatsProps {
  watchlist: number[];
  catalogList: any[];
  savedAnimeItems?: any[];
  isSignedIn?: boolean;
  onNavigateToCatalog?: () => void;
}

function readLegacyWatchedIds(): number[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WATCHED_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

export const PersonalAnimeStats: React.FC<PersonalAnimeStatsProps> = ({
  watchlist,
  catalogList,
  savedAnimeItems = [],
  isSignedIn = false,
  onNavigateToCatalog,
}) => {
  const [progressMap, setProgressMap] = useState<Record<number, WatchProgressEntry>>(() =>
    getAllWatchProgress()
  );
  const [watchedIds, setWatchedIds] = useState<number[]>(() => readLegacyWatchedIds());

  useEffect(() => {
    setProgressMap(getAllWatchProgress());
    setWatchedIds(readLegacyWatchedIds());

    if (!isSignedIn) return;
    let cancelled = false;
    cloudflareApi
      .getAllWatchProgress()
      .then((remoteRows) => {
        if (cancelled || !Array.isArray(remoteRows) || remoteRows.length === 0) return;
        setProgressMap((prev) => {
          const merged: Record<number, WatchProgressEntry> = { ...prev };
          for (const row of remoteRows) {
            const existing = merged[row.animeId];
            if (!existing || new Date(row.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
              merged[row.animeId] = row;
            }
          }
          return merged;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, watchlist.length]);

  const combinedCatalog = useMemo(() => {
    const byId = new Map<number, any>();
    for (const item of [...savedAnimeItems, ...catalogList]) {
      if (!item || typeof item !== 'object') continue;
      const id = Number(item.id);
      if (Number.isInteger(id) && id > 0 && !byId.has(id)) {
        byId.set(id, item);
      }
    }
    return Array.from(byId.values());
  }, [catalogList, savedAnimeItems]);

  const stats = useMemo(
    () =>
      computePersonalAnimeStats({
        watchlistIds: watchlist,
        catalogItems: combinedCatalog,
        progressMap,
        watchedIds,
      }),
    [watchlist, combinedCatalog, progressMap, watchedIds]
  );

  return (
    <section
      data-testid="personal-anime-stats"
      aria-label="My Anime Journey"
      className="rounded-2xl bg-[#12141E] border border-[#292B39] p-5 sm:p-7 space-y-6 shadow-xl"
    >
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292B39] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#B49AF8]">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-heading font-black text-[#F4F3FA] uppercase tracking-tight">
              My Anime Journey
            </h2>
            <p className="text-xs text-[#A1A5B5]">
              Calculated strictly from your logged Watchlist &amp; Episode Progress
            </p>
          </div>
        </div>

        {stats.hasLoggedActivity && (
          <span className="px-3 py-1 rounded-full bg-[#191C29] border border-[#292B39] text-[11px] font-bold text-[#A1A5B5] tabular-nums">
            {stats.totalTrackedTitles} Tracked {stats.totalTrackedTitles === 1 ? 'Title' : 'Titles'}
          </span>
        )}
      </div>

      {!stats.hasLoggedActivity ? (
        /* HONEST EMPTY STATE */
        <div className="rounded-2xl bg-[#191C29]/60 border border-dashed border-[#292B39] p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#12141E] border border-[#292B39] flex items-center justify-center text-[#B49AF8]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-sm sm:text-base font-black text-[#F4F3FA]">
              Start tracking your Indian-dubbed anime journey
            </h3>
            <p className="text-xs text-[#A1A5B5] leading-relaxed">
              Add anime to your Watchlist or log episodes watched on any title page to unlock your personal stats, top genres, and preferred dub language breakdown.
            </p>
          </div>
          {onNavigateToCatalog && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onNavigateToCatalog}
              leftIcon={<Compass className="w-4 h-4" />}
            >
              Browse Dubbed Catalog
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 4 SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#191C29] border border-[#292B39] p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[#34D399]">
                <span className="text-[10px] font-black uppercase tracking-wider">Anime Completed</span>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-black text-[#F4F3FA] tabular-nums">
                {stats.completedCount}
              </p>
            </div>

            <div className="rounded-xl bg-[#191C29] border border-[#292B39] p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[#B49AF8]">
                <span className="text-[10px] font-black uppercase tracking-wider">Episodes Watched</span>
                <PlayCircle className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-black text-[#F4F3FA] tabular-nums">
                {stats.episodesWatched}
              </p>
            </div>

            <div className="rounded-xl bg-[#191C29] border border-[#292B39] p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[#F9C876]">
                <span className="text-[10px] font-black uppercase tracking-wider">Watching</span>
                <Clock className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-black text-[#F4F3FA] tabular-nums">
                {stats.watchingCount}
              </p>
            </div>

            <div className="rounded-xl bg-[#191C29] border border-[#292B39] p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[#CBB6FF]">
                <span className="text-[10px] font-black uppercase tracking-wider">Plan to Watch</span>
                <Bookmark className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-black text-[#F4F3FA] tabular-nums">
                {stats.planToWatchCount}
              </p>
            </div>
          </div>

          {/* CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* FAVORITE GENRES BAR CHART */}
            <div className="rounded-xl bg-[#191C29] border border-[#292B39] p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#F4F3FA] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#B49AF8]" />
                  <span>Favorite Genres</span>
                </h3>
                <span className="text-[10px] text-[#A1A5B5]">From your watchlist</span>
              </div>

              {stats.favoriteGenres.length === 0 ? (
                <p className="text-xs text-[#A1A5B5] py-4">
                  Genre data will appear once your saved titles finish syncing.
                </p>
              ) : (
                <div className="space-y-2.5" role="list" aria-label="Favorite Genres Chart">
                  {stats.favoriteGenres.map((item) => (
                    <div key={item.genre} role="listitem" className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#F4F3FA] truncate">{item.genre}</span>
                        <span className="text-[#A1A5B5] font-semibold tabular-nums">
                          {item.count} {item.count === 1 ? 'title' : 'titles'}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#12141E] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#B49AF8] transition-all duration-300"
                          style={{ width: `${Math.max(8, item.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PREFERRED DUB LANGUAGES SEGMENTED BAR */}
            <div className="rounded-xl bg-[#191C29] border border-[#292B39] p-4 sm:p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#F4F3FA] flex items-center gap-2">
                    <Languages className="w-4 h-4 text-[#F9C876]" />
                    <span>Preferred Dub Languages</span>
                  </h3>
                  <span className="text-[10px] text-[#A1A5B5]">Indian audio mix</span>
                </div>

                {stats.preferredLanguages.length === 0 ? (
                  <p className="text-xs text-[#A1A5B5] py-4">
                    Add Indian-dubbed anime to your watchlist to see your regional language split.
                  </p>
                ) : (
                  <>
                    {/* Horizontal Segmented Bar */}
                    <div
                      role="img"
                      aria-label={stats.preferredLanguages
                        .map((l) => `${l.language} ${l.percent}%`)
                        .join(', ')}
                      className="w-full h-4 rounded-full bg-[#12141E] overflow-hidden flex gap-0.5 p-0.5 border border-[#292B39]"
                    >
                      {stats.preferredLanguages.map((lang) => (
                        <div
                          key={`seg_${lang.language}`}
                          title={`${lang.language}: ${lang.percent}% (${lang.count} titles)`}
                          className={`h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 ${lang.barColorClass}`}
                          style={{ width: `${Math.max(4, lang.percent)}%` }}
                        />
                      ))}
                    </div>

                    {/* Readable Inline Summary Line (e.g., Tamil 65% • Hindi 25% • Telugu 10%) */}
                    <p className="text-xs font-bold text-[#F4F3FA] leading-relaxed">
                      {stats.preferredLanguages
                        .map((l) => `${l.language} ${l.percent}%`)
                        .join(' • ')}
                    </p>

                    {/* Detailed Legend Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {stats.preferredLanguages.map((lang) => (
                        <div
                          key={`leg_${lang.language}`}
                          className="rounded-xl bg-[#12141E] border border-[#292B39] px-2.5 py-2 flex items-center justify-between gap-2"
                        >
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F4F3FA] truncate">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${lang.dotColorClass}`} />
                            <span className="truncate">{lang.language}</span>
                          </span>
                          <span className={`text-xs font-black tabular-nums ${lang.textColorClass}`}>
                            {lang.percent}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <p className="text-[11px] text-[#A1A5B5] pt-2 border-t border-[#292B39]">
                Tip: Log episode numbers on any anime detail page to keep your progress synced{isSignedIn ? ' to your cloud account' : ' on this device'}.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
