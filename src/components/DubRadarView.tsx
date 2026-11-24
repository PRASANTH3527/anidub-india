import React, { useEffect, useMemo, useState } from 'react';
import {
  Radio,
  ExternalLink,
  Calendar,
  Tv,
  Search,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Megaphone,
  Loader2,
} from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';
import {
  DUB_RADAR_LANGUAGES,
  DUB_RADAR_STAGES,
  DUB_RADAR_STAGE_META,
  buildCatalogFallbackRadarEntries,
  filterDubRadarEntries,
  getDubRadarStageIndex,
  normalizeDubRadarRow,
  type DubRadarEntry,
  type DubRadarStage,
} from '../utils/dubRadar';

interface DubRadarViewProps {
  catalogList: any[];
  onSelectAnime?: (animeOrId: any) => void;
  onNavigateRequests?: () => void;
  onNavigateHome?: () => void;
}

const LANGUAGE_PILL_STYLES: Record<string, string> = {
  Hindi: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
  Tamil: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  Telugu: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
  Malayalam: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  Kannada: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
};

export const DubRadarView: React.FC<DubRadarViewProps> = ({
  catalogList,
  onSelectAnime,
  onNavigateRequests,
  onNavigateHome,
}) => {
  const [serverEntries, setServerEntries] = useState<DubRadarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cloudflareApi
      .fetchDubRadar()
      .then((rows) => {
        if (cancelled) return;
        setServerEntries(rows.map((r) => normalizeDubRadarRow(r)));
      })
      .catch(() => {
        if (!cancelled) setServerEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge verified D1 radar entries with honest catalog-derived fallback entries (never duplicate same title)
  const allEntries = useMemo(() => {
    const merged: DubRadarEntry[] = [...serverEntries];
    const existingKeys = new Set(
      serverEntries.map((e) => e.anime_title.trim().toLowerCase())
    );
    const existingIds = new Set(
      serverEntries
        .map((e) => (e.anime_id ? Number(e.anime_id) : null))
        .filter((id): id is number => id !== null)
    );

    const catalogFallbacks = buildCatalogFallbackRadarEntries(catalogList);
    for (const item of catalogFallbacks) {
      const titleKey = item.anime_title.trim().toLowerCase();
      if (existingKeys.has(titleKey)) continue;
      if (item.anime_id && existingIds.has(item.anime_id)) continue;
      merged.push(item);
    }
    return merged;
  }, [serverEntries, catalogList]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allEntries.length };
    for (const stage of DUB_RADAR_STAGES) {
      counts[stage] = 0;
    }
    for (const entry of allEntries) {
      counts[entry.stage] = (counts[entry.stage] || 0) + 1;
    }
    return counts;
  }, [allEntries]);

  const filteredEntries = useMemo(
    () =>
      filterDubRadarEntries(allEntries, {
        language: selectedLanguage,
        stage: selectedStage,
        search: searchQuery,
      }),
    [allEntries, selectedLanguage, selectedStage, searchQuery]
  );

  return (
    <div
      data-testid="dub-radar-view"
      className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 box-border"
    >
      {/* HEADER BANNER */}
      <section className="rounded-3xl bg-gradient-to-br from-[#12182b] via-[#0e1424] to-[#141126] border border-white/10 p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/35 text-purple-300 text-[11px] font-black uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Indian Dub Lifecycle Tracker</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight">
              Dub Release Radar
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Track verified Indian anime dubs across every milestone — from official announcements and studio production to scheduled OTT launches and full-season releases.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onNavigateRequests && (
              <button
                type="button"
                onClick={onNavigateRequests}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-purple-950/40 transition-all cursor-pointer active:scale-95"
              >
                <Megaphone className="w-4 h-4" />
                <span>Vote on Dub Requests</span>
              </button>
            )}
          </div>
        </div>

        {/* 5-STAGE LIFECYCLE LEGEND */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {DUB_RADAR_STAGES.map((stage, idx) => {
            const meta = DUB_RADAR_STAGE_META[stage];
            const isSelected = selectedStage === stage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setSelectedStage(isSelected ? 'All' : stage)}
                className={`text-left p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-500/20 border-purple-400/60 shadow-md'
                    : 'bg-black/30 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono text-neutral-400">STEP {idx + 1}</span>
                  <span className="text-[11px] font-black text-white tabular-nums">
                    {stageCounts[stage] ?? 0}
                  </span>
                </div>
                <p className="text-xs font-bold text-white mt-1 truncate">{meta.shortLabel}</p>
                <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">{stage}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* FILTER BAR: LANGUAGES, STAGE & SEARCH */}
      <section className="rounded-2xl bg-[#101524] border border-white/10 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Language Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['All', ...DUB_RADAR_LANGUAGES].map((lang) => {
              const active = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    active
                      ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                      : 'bg-white/[0.03] text-neutral-300 border-white/10 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {lang === 'All' ? 'All Languages' : lang}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter radar by anime or OTT..."
              aria-label="Filter Dub Release Radar"
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
            />
          </div>
        </div>

        {/* Stage Filter Row + Active Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedStage('All')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                selectedStage === 'All'
                  ? 'bg-white/15 text-white border-white/30'
                  : 'bg-transparent text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              All Stages ({allEntries.length})
            </button>
            {DUB_RADAR_STAGES.map((stage) => (
              <button
                key={`filter_${stage}`}
                type="button"
                onClick={() => setSelectedStage(stage)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  selectedStage === stage
                    ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                    : 'bg-transparent text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-semibold text-neutral-400">
            Showing <strong className="text-white">{filteredEntries.length}</strong> tracked dub{filteredEntries.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {/* RADAR TIMELINE CARDS */}
      {loading && allEntries.length === 0 ? (
        <div className="rounded-3xl bg-[#101524] border border-white/10 p-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
          <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
          <span className="text-xs font-medium">Loading Dub Release Radar...</span>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-3xl bg-[#101524] border border-white/10 p-10 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Radio className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-black text-white">No radar entries match this filter</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              We only list verified Indian dub milestones — never rumors or unconfirmed dates. Try clearing filters or vote for an anime on Dub Requests.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {(selectedLanguage !== 'All' || selectedStage !== 'All' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedLanguage('All');
                  setSelectedStage('All');
                  setSearchQuery('');
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            {onNavigateRequests && (
              <button
                type="button"
                onClick={onNavigateRequests}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
              >
                Request a Dub
              </button>
            )}
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                Back to Catalog
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const activeStageIdx = getDubRadarStageIndex(entry.stage);
            const stageMeta = DUB_RADAR_STAGE_META[entry.stage];
            const canOpenDetail = Boolean(entry.anime_id && onSelectAnime);

            return (
              <article
                key={String(entry.id)}
                className="rounded-3xl bg-[#101524] border border-white/10 hover:border-purple-500/35 p-4 sm:p-6 shadow-xl transition-colors space-y-5"
              >
                {/* TOP META ROW */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {entry.cover_image ? (
                      <img
                        src={entry.cover_image}
                        alt={entry.anime_title}
                        width={56}
                        height={80}
                        loading="lazy"
                        className="w-14 h-20 rounded-xl object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-20 rounded-xl bg-gradient-to-br from-purple-900/50 to-indigo-900/40 border border-white/10 flex items-center justify-center text-purple-300 font-black text-lg shrink-0">
                        {entry.anime_title.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${stageMeta.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stageMeta.dotClass}`} />
                          <span>{entry.stage}</span>
                        </span>
                        {entry.isCatalogDerived && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold text-neutral-400">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Catalog Sync</span>
                          </span>
                        )}
                      </div>

                      <h2 className="text-base sm:text-lg font-black text-white leading-snug break-words">
                        {canOpenDetail ? (
                          <button
                            type="button"
                            onClick={() =>
                              onSelectAnime?.({
                                id: entry.anime_id,
                                slug: entry.slug || undefined,
                                title: entry.anime_title,
                              })
                            }
                            className="text-left hover:text-purple-300 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>{entry.anime_title}</span>
                            <ArrowRight className="w-4 h-4 shrink-0 text-purple-400" />
                          </button>
                        ) : (
                          entry.anime_title
                        )}
                      </h2>

                      {/* Languages + Platform + Release Date */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {entry.languages.map((lang) => (
                          <span
                            key={`${entry.id}_${lang}`}
                            className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${
                              LANGUAGE_PILL_STYLES[lang] ||
                              'bg-white/10 text-neutral-200 border-white/15'
                            }`}
                          >
                            {lang}
                          </span>
                        ))}

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-neutral-300 text-[11px] font-semibold">
                          <Tv className="w-3 h-3 text-purple-400" />
                          <span>{entry.platform || 'Platform TBA'}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-neutral-300 text-[11px] font-semibold">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          <span>{entry.release_date || 'TBA'}</span>
                        </span>
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-neutral-400 leading-relaxed">{entry.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* VERIFIED SOURCE LINK (ONLY WHEN PRESENT) */}
                  {entry.source_url && (
                    <a
                      href={entry.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/35 text-cyan-300 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 self-start transition-colors"
                    >
                      <span>Verified Source</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* 5-STAGE LIFECYCLE VISUAL STEPPER */}
                <div className="pt-3 border-t border-white/10">
                  <div
                    role="list"
                    aria-label={`${entry.anime_title} dub lifecycle progress`}
                    className="grid grid-cols-5 gap-1.5 sm:gap-2"
                  >
                    {DUB_RADAR_STAGES.map((stageName: DubRadarStage, stepIndex) => {
                      const isReached = stepIndex <= activeStageIdx;
                      const isCurrent = stepIndex === activeStageIdx;
                      const meta = DUB_RADAR_STAGE_META[stageName];

                      return (
                        <div
                          key={`${entry.id}_step_${stageName}`}
                          role="listitem"
                          className="flex flex-col gap-1.5 min-w-0"
                        >
                          <div className="flex items-center gap-1">
                            <div
                              className={`h-2 flex-1 rounded-full transition-all ${
                                isReached
                                  ? stepIndex === 4
                                    ? 'bg-emerald-400'
                                    : isCurrent
                                      ? 'bg-gradient-to-r from-purple-500 to-cyan-400'
                                      : 'bg-purple-500/80'
                                  : 'bg-white/10'
                              }`}
                            />
                          </div>
                          <div className="flex items-center gap-1 min-w-0">
                            {isReached && (
                              <CheckCircle2
                                className={`w-3 h-3 shrink-0 hidden sm:inline ${
                                  stepIndex === 4 ? 'text-emerald-400' : 'text-purple-400'
                                }`}
                              />
                            )}
                            <span
                              className={`text-[10px] sm:text-[11px] leading-tight truncate ${
                                isCurrent
                                  ? 'text-white font-black'
                                  : isReached
                                    ? 'text-neutral-300 font-semibold'
                                    : 'text-neutral-500 font-medium'
                              }`}
                              title={stageName}
                            >
                              <span className="sm:hidden">{meta.shortLabel}</span>
                              <span className="hidden sm:inline">{stageName}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
