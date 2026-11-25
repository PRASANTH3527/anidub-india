import React, { useMemo, useState } from 'react';
import {
  Tv,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  SlidersHorizontal,
  PlayCircle,
  X,
} from 'lucide-react';
import {
  MAJOR_INDIAN_OTTS,
  computeOttHubStats,
  calculateSubscriptionCoverage,
  type OttHubItemStat,
} from '../utils/ottHub';

const COVERAGE_LANGUAGES = ['All', 'Tamil', 'Hindi', 'Telugu', 'Malayalam', 'Kannada'] as const;

export interface OttHubSectionProps {
  catalogIndex: any[];
  selectedPlatform: string;
  onSelectPlatform: (platformName: string) => void;
  mySubscriptions: string[];
  mySubscriptionsEnabled: boolean;
  onToggleSubscriptionPlatform: (platformId: string) => void;
  onToggleMySubscriptionsEnabled: (enabled: boolean) => void;
  onClearSubscriptions: () => void;
  onSelectAnime?: (anime: any) => void;
  activeLanguage?: string;
}

export const OttHubSection: React.FC<OttHubSectionProps> = ({
  catalogIndex,
  selectedPlatform,
  onSelectPlatform,
  mySubscriptions,
  mySubscriptionsEnabled,
  onToggleSubscriptionPlatform,
  onToggleMySubscriptionsEnabled,
  onClearSubscriptions,
  onSelectAnime,
  activeLanguage = 'All',
}) => {
  const [isHubExpanded, setIsHubExpanded] = useState(false);
  const [coverageLanguage, setCoverageLanguage] = useState<string>(() =>
    COVERAGE_LANGUAGES.includes(activeLanguage as any) ? activeLanguage : 'Tamil'
  );

  const hubStats: OttHubItemStat[] = useMemo(
    () => computeOttHubStats(catalogIndex),
    [catalogIndex]
  );

  const coverage = useMemo(
    () => calculateSubscriptionCoverage(catalogIndex, mySubscriptions, coverageLanguage),
    [catalogIndex, mySubscriptions, coverageLanguage]
  );

  return (
    <section
      aria-label="OTT Intelligence Hub and My Subscriptions"
      className="px-0.5 sm:px-2 md:px-0 mt-6 space-y-3"
    >
      {/* 1. MY SUBSCRIPTIONS QUICK FILTER BAR */}
      <div className="rounded-2xl bg-[#131926]/90 border border-[#242d46] p-3.5 sm:p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/35 flex items-center justify-center text-purple-300 shrink-0">
              <Tv className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
                  My Subscriptions &amp; OTT Coverage
                </h2>
                {mySubscriptionsEnabled && mySubscriptions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                    Filtering {mySubscriptions.length} {mySubscriptions.length === 1 ? 'OTT' : 'OTTs'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Select your legal OTT apps to filter titles and calculate dub coverage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!mySubscriptionsEnabled && mySubscriptions.length === 0) {
                  onToggleMySubscriptionsEnabled(true);
                } else {
                  onToggleMySubscriptionsEnabled(!mySubscriptionsEnabled);
                }
              }}
              aria-pressed={mySubscriptionsEnabled}
              aria-label="Toggle My Subscriptions Filter"
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                mySubscriptionsEnabled
                  ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-200 shadow-sm'
                  : 'bg-[#1a2234] border-[#2a3552] text-neutral-300 hover:text-white hover:border-purple-500/40'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{mySubscriptionsEnabled ? 'My OTTs: ON' : 'My OTTs: OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsHubExpanded((prev) => !prev)}
              aria-expanded={isHubExpanded}
              aria-label="Toggle OTT Intelligence Hub cards"
              className="min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#1a2234] border border-[#2a3552] hover:border-purple-500/50 text-purple-300 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>OTT Hub</span>
              {isHubExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Toggleable Subscription Platform Pills */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {MAJOR_INDIAN_OTTS.map((ott) => {
            const isSelected = mySubscriptions.includes(ott.id);
            const stat = hubStats.find((s) => s.platform.id === ott.id);
            return (
              <button
                key={`sub_${ott.id}`}
                type="button"
                onClick={() => onToggleSubscriptionPlatform(ott.id)}
                aria-pressed={isSelected}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-600/30 border-purple-400/70 text-white shadow-sm'
                    : 'bg-[#0e1422] border-[#222b42] text-neutral-300 hover:border-neutral-600 hover:text-white'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                <span>{ott.name}</span>
                {stat && stat.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-neutral-300">
                    {stat.count}
                  </span>
                )}
                {ott.isFreeLegal && (
                  <span className="text-[9px] uppercase font-black text-emerald-300 bg-emerald-500/15 px-1.5 py-0.2 rounded-full">
                    Free
                  </span>
                )}
              </button>
            );
          })}

          {mySubscriptions.length > 0 && (
            <button
              type="button"
              onClick={onClearSubscriptions}
              className="min-h-[36px] px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-neutral-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {mySubscriptionsEnabled && mySubscriptions.length === 0 && (
          <p className="mt-2 text-[11px] text-amber-300/90">
            Pick one or more OTT platforms above to filter the catalog by your subscriptions.
          </p>
        )}

        {/* P2 #5: Subscription Coverage Calculator */}
        <div
          data-testid="subscription-coverage-calculator"
          className="mt-3.5 pt-3.5 border-t border-white/10 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-neutral-300">
              Subscription Coverage Calculator
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {COVERAGE_LANGUAGES.map((lang) => (
                <button
                  key={`cov_lang_${lang}`}
                  type="button"
                  onClick={() => setCoverageLanguage(lang)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                    coverageLanguage === lang
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#0e1422] text-neutral-400 hover:text-white border border-white/10'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {mySubscriptions.length === 0 ? (
            <p className="text-xs text-neutral-400">
              Select your OTT subscriptions above to see what percentage of{' '}
              <strong className="text-neutral-200">{coverage.language}</strong> dubbed anime they cover
              {coverage.totalCount > 0 ? ` (${coverage.totalCount} indexed titles)` : ''}.
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-neutral-200">
                  Your{' '}
                  <strong className="text-white tabular-nums">
                    {mySubscriptions.length} selected {mySubscriptions.length === 1 ? 'OTT' : 'OTTs'}
                  </strong>{' '}
                  cover{' '}
                  <strong className="text-emerald-300 tabular-nums">{coverage.percentage}%</strong>{' '}
                  <span className="text-neutral-400 tabular-nums">
                    ({coverage.coveredCount} of {coverage.totalCount})
                  </span>{' '}
                  of <strong className="text-white">{coverage.language}</strong> dubbed anime
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, coverage.percentage))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. OTT INTELLIGENCE HUB BRANDED CARDS */}
      {isHubExpanded && (
        <div
          data-testid="ott-intelligence-hub"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1"
        >
          {hubStats.map(({ platform, count, exclusiveCount, highlights }) => {
            const isActivePlatform =
              selectedPlatform.toLowerCase() === platform.id.toLowerCase() ||
              selectedPlatform.toLowerCase() === platform.name.toLowerCase();

            return (
              <div
                key={`hub_${platform.id}`}
                className={`relative rounded-2xl bg-gradient-to-br ${platform.accentBg} bg-[#121827] border ${
                  isActivePlatform ? 'border-purple-400 ring-1 ring-purple-400/50' : platform.accentBorder
                } p-4 flex flex-col justify-between gap-3 transition-all shadow-lg`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-9 h-9 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center text-xs font-black shrink-0 ${platform.accentText}`}>
                        {platform.shortName}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-white truncate">{platform.name}</h3>
                        <span className={`text-[10px] font-bold ${platform.accentText}`}>
                          {platform.badgeText}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-white leading-none">{count}</div>
                      <div className="text-[10px] text-neutral-400 font-semibold">
                        {count === 1 ? 'Title' : 'Titles'}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    {platform.tagline}
                  </p>

                  {exclusiveCount > 0 && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      <span>{exclusiveCount} platform exclusive {exclusiveCount === 1 ? 'listing' : 'listings'}</span>
                    </div>
                  )}

                  {highlights.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                        Top Highlights
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {highlights.map((item) => (
                          <button
                            key={`hl_${platform.id}_${item.id}`}
                            type="button"
                            onClick={() => onSelectAnime && onSelectAnime(item)}
                            className="inline-flex items-center gap-1 max-w-full px-2 py-1 rounded-lg bg-black/45 hover:bg-black/70 border border-white/10 text-[10px] font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer truncate"
                          >
                            <PlayCircle className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSubscriptionPlatform(platform.id)}
                    className={`text-[11px] font-bold transition-colors cursor-pointer ${
                      mySubscriptions.includes(platform.id)
                        ? 'text-emerald-300'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {mySubscriptions.includes(platform.id) ? '✓ In My OTTs' : '+ Add to My OTTs'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectPlatform(isActivePlatform ? 'All Platforms' : platform.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-colors cursor-pointer"
                  >
                    <span>{isActivePlatform ? 'Clear Filter' : `Browse ${platform.name}`}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
