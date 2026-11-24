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
    // Re-read localStorage on mount/update
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
      className="rounded-3xl bg-[#111629]/90 border border-white/10 p-5 sm:p-7 space-y-6 shadow-xl"
    >
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/35 flex items-center justify-center text-purple-300">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-heading font-black text-white uppercase tracking-tight">
              My Anime Journey
            </h2>
            <p className="text-xs text-neutral-400">
              Calculated strictly from your logged Watchlist &amp; Episode Progress
            </p>
          </div>
        </div>

        {stats.hasLoggedActivity && (
          <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-bold text-neutral-300 tabular-nums">
            {stats.totalTrackedTitles} Tracked {stats.totalTrackedTitles === 1 ? 'Title' : 'Titles'}
          </span>
        )}
      </div>

      {!stats.hasLoggedActivity ? (
        /* HONEST EMPTY STATE */
        <div className="rounded-2xl bg-black/30 border border-dashed border-white/15 p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-sm sm:text-base font-black text-white">
              Start tracking your Indian-dubbed anime journey
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Add anime to your Watchlist or log episodes watched on any title page to unlock your personal stats, top genres, and preferred dub language breakdown.
            </p>
          </div>
          {onNavigateToCatalog && (
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Compass className="w-4 h-4" />
              <span>Browse Dubbed Catalog</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 4 SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/25 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-emerald-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Anime Completed</span>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-black text-white tabular-nums">
                {stats.completedCount}
              </p>
            </div>

            <div className="rounded-2xl bg-purple-500/[0.07] border border-purple-500/25 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-purple-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Episodes Watched</span>
                <PlayCircle className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-black text-white tabular-nums">
                {stats.episodesWatched}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-500/[0.07] border border-amber-500/25 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Watching</span>
                <Clock className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-black text-white tabular-nums">
                {stats.watchingCount}
              </p>
            </div>

            <div className="rounded-2xl bg-sky-500/[0.07] border border-sky-500/25 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-sky-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Plan to Watch</span>
                <Bookmark className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-black text-white tabular-nums">
                {stats.planToWatchCount}
              </p>
            </div>
          </div>

          {/* CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* FAVORITE GENRES BAR CHART */}
            <div className="rounded-2xl bg-black/30 border border-white/10 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>Favorite Genres</span>
                </h3>
                <span className="text-[10px] text-neutral-500">From your watchlist</span>
              </div>

              {stats.favoriteGenres.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4">
                  Genre data will appear once your saved titles finish syncing.
                </p>
              ) : (
                <div className="space-y-2.5" role="list" aria-label="Favorite Genres Chart">
                  {stats.favoriteGenres.map((item) => (
                    <div key={item.genre} role="listitem" className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-200 truncate">{item.genre}</span>
                        <span className="text-neutral-400 font-semibold tabular-nums">
                          {item.count} {item.count === 1 ? 'title' : 'titles'}
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400 transition-all duration-500"
                          style={{ width: `${Math.max(8, item.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PREFERRED DUB LANGUAGES SEGMENTED BAR */}
            <div className="rounded-2xl bg-black/30 border border-white/10 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                    <Languages className="w-4 h-4 text-amber-400" />
                    <span>Preferred Dub Languages</span>
                  </h3>
                  <span className="text-[10px] text-neutral-500">Indian audio mix</span>
                </div>

                {stats.preferredLanguages.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-4">
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
                      className="w-full h-4 rounded-full bg-white/[0.06] overflow-hidden flex gap-0.5 p-0.5 border border-white/10"
                    >
                      {stats.preferredLanguages.map((lang) => (
                        <div
                          key={`seg_${lang.language}`}
                          title={`${lang.language}: ${lang.percent}% (${lang.count} titles)`}
                          className={`h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 ${lang.barColorClass}`}
                          style={{ width: `${Math.max(4, lang.percent)}%` }}
                        />
                      ))}
                    </div>

                    {/* Readable Inline Summary Line (e.g., Tamil 65% • Hindi 25% • Telugu 10%) */}
                    <p className="text-xs font-bold text-neutral-200 leading-relaxed">
                      {stats.preferredLanguages
                        .map((l) => `${l.language} ${l.percent}%`)
                        .join(' • ')}
                    </p>

                    {/* Detailed Legend Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {stats.preferredLanguages.map((lang) => (
                        <div
                          key={`leg_${lang.language}`}
                          className="rounded-xl bg-white/[0.03] border border-white/10 px-2.5 py-2 flex items-center justify-between gap-2"
                        >
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-200 truncate">
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

              <p className="text-[11px] text-neutral-500 pt-2 border-t border-white/5">
                Tip: Log episode numbers on any anime detail page to keep your progress synced{isSignedIn ? ' to your cloud account' : ' on this device'}.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
