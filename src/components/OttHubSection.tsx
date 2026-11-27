import React, { useMemo, useState } from 'react';
import {
  Tv,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
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
  mode?: 'inline' | 'sheet';
  onCloseSheet?: () => void;
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
  mode = 'inline',
  onCloseSheet,
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

  const isSheet = mode === 'sheet';

  return (
    <section
      aria-label="OTT Intelligence Hub and My Subscriptions"
      className={isSheet ? 'space-y-4' : 'px-0.5 sm:px-2 md:px-0 mt-4 space-y-3'}
    >
      {/* 1. MASTER MY OTTs FILTER SWITCH ROW */}
      <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden">
        <button
          type="button"
          role="switch"
          aria-checked={mySubscriptionsEnabled}
          aria-label="Toggle My Subscriptions Filter"
          onClick={() => onToggleMySubscriptionsEnabled(!mySubscriptionsEnabled)}
          className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-elevated)]/80 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary)]/12 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Tv className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  Filter catalog by My OTTs
                </span>
                {mySubscriptionsEnabled && mySubscriptions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#34D399]/15 border border-[#34D399]/35 text-[#34D399] text-[10px] font-bold">
                    {mySubscriptions.length} {mySubscriptions.length === 1 ? 'OTT' : 'OTTs'} active
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {mySubscriptionsEnabled
                  ? mySubscriptions.length > 0
                    ? 'Showing only anime available on your selected platforms'
                    : 'Select one or more platforms below to activate filtering'
                  : 'Off — browse all legal Indian streaming platforms'}
              </p>
            </div>
          </div>

          <span
            aria-hidden="true"
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-180 motion-reduce:transition-none ${
              mySubscriptionsEnabled
                ? 'bg-[var(--accent-primary)] border-[var(--accent-hover)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-180 motion-reduce:transition-none ${
                mySubscriptionsEnabled
                  ? 'translate-x-5 bg-[var(--accent-on-primary)]'
                  : 'translate-x-1 bg-[var(--text-secondary)]'
              }`}
            />
          </span>
        </button>
      </div>

      {/* 2. TAPPABLE PLATFORM SELECTION CARDS */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Your Streaming Platforms
          </span>
          {!isSheet && mySubscriptions.length > 0 && (
            <button
              type="button"
              onClick={onClearSubscriptions}
              className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-colors duration-180 cursor-pointer inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {MAJOR_INDIAN_OTTS.map((ott) => {
            const isSelected = mySubscriptions.includes(ott.id);
            const stat = hubStats.find((s) => s.platform.id === ott.id);
            const titleCount = stat?.count ?? 0;

            return (
              <button
                key={`sub_${ott.id}`}
                type="button"
                onClick={() => onToggleSubscriptionPlatform(ott.id)}
                aria-pressed={isSelected}
                className={`min-h-[58px] px-2.5 sm:px-3.5 py-2.5 rounded-xl border text-left transition-all duration-180 motion-reduce:transition-none cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center text-[11px] sm:text-xs font-extrabold shrink-0 ${
                      isSelected
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-hover)]'
                        : 'bg-[var(--bg-surface)] text-[var(--accent-hover)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {ott.shortName}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                        {ott.name}
                      </span>
                      {ott.isFreeLegal && (
                        <span className="px-1.5 py-0.5 rounded bg-[#34D399]/15 border border-[#34D399]/35 text-[9px] font-extrabold uppercase tracking-wide text-[#34D399] shrink-0">
                          FREE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] tabular-nums truncate">
                      {titleCount > 0
                        ? `${titleCount} ${titleCount === 1 ? 'title' : 'titles'}`
                        : ott.badgeText}
                    </div>
                  </div>
                </div>

                <span
                  aria-hidden="true"
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-180 ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] border-[var(--accent-hover)] text-[var(--accent-on-primary)]'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. SUBSCRIPTION COVERAGE CALCULATOR */}
      <div
        data-testid="subscription-coverage-calculator"
        className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3.5 sm:p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Dub Coverage Calculator
          </span>
          {mySubscriptions.length > 0 && (
            <span className="text-sm font-extrabold text-[#34D399] tabular-nums">
              {coverage.percentage}%
            </span>
          )}
        </div>

        {/* Language Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {COVERAGE_LANGUAGES.map((lang) => {
            const active = coverageLanguage === lang;
            return (
              <button
                key={`cov_lang_${lang}`}
                type="button"
                onClick={() => setCoverageLanguage(lang)}
                aria-pressed={active}
                className={`min-h-[36px] min-w-[52px] px-3 py-1 rounded-full text-xs font-semibold border shrink-0 transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                  active
                    ? 'bg-[var(--accent-primary)] border-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/40'
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>

        {mySubscriptions.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Tap your OTT apps above to calculate what share of{' '}
            <strong className="text-[var(--text-primary)]">{coverage.language}</strong> dubbed anime they cover
            {coverage.totalCount > 0 ? ` (${coverage.totalCount} indexed titles)` : ''}.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Your{' '}
              <strong className="text-[var(--text-primary)] tabular-nums">
                {mySubscriptions.length} selected {mySubscriptions.length === 1 ? 'OTT' : 'OTTs'}
              </strong>{' '}
              cover{' '}
              <strong className="text-[#34D399] tabular-nums">{coverage.percentage}%</strong>{' '}
              <span className="tabular-nums">
                ({coverage.coveredCount} of {coverage.totalCount})
              </span>{' '}
              of <strong className="text-[var(--text-primary)]">{coverage.language}</strong> dubbed anime.
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[#34D399] transition-all duration-300 motion-reduce:transition-none"
                style={{ width: `${Math.min(100, Math.max(0, coverage.percentage))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. OPTIONAL EXPANDABLE OTT HUB HIGHLIGHTS */}
      <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHubExpanded((prev) => !prev)}
          aria-expanded={isHubExpanded}
          aria-label="Toggle OTT Intelligence Hub cards"
          className="w-full min-h-[48px] px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/40 transition-colors duration-180 cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Explore OTT Platform Highlights</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
            <span>{isHubExpanded ? 'Hide' : 'View'}</span>
            {isHubExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {isHubExpanded && (
          <div
            data-testid="ott-intelligence-hub"
            className="p-3.5 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {hubStats.map(({ platform, count, exclusiveCount, highlights }) => {
              const isActivePlatform =
                selectedPlatform.toLowerCase() === platform.id.toLowerCase() ||
                selectedPlatform.toLowerCase() === platform.name.toLowerCase();

              return (
                <div
                  key={`hub_${platform.id}`}
                  className={`rounded-xl bg-[var(--bg-surface)] border ${
                    isActivePlatform ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'
                  } p-3.5 flex flex-col justify-between gap-3`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-xs font-extrabold text-[var(--accent-hover)] shrink-0">
                          {platform.shortName}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                            {platform.name}
                          </h3>
                          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                            {platform.badgeText}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-extrabold text-[var(--text-primary)] leading-none tabular-nums">
                          {count}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)] font-medium">
                          {count === 1 ? 'Title' : 'Titles'}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {platform.tagline}
                    </p>

                    {exclusiveCount > 0 && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F9C876] bg-[#F9C876]/10 border border-[#F9C876]/25 px-2 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3" />
                        <span>
                          {exclusiveCount} platform exclusive {exclusiveCount === 1 ? 'listing' : 'listings'}
                        </span>
                      </div>
                    )}

                    {highlights.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">
                          Top Highlights
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {highlights.map((item) => (
                            <button
                              key={`hl_${platform.id}_${item.id}`}
                              type="button"
                              onClick={() => {
                                onCloseSheet?.();
                                onSelectAnime?.(item);
                              }}
                              className="inline-flex items-center gap-1.5 max-w-full min-h-[34px] px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)]/50 border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition-colors duration-180 cursor-pointer truncate"
                            >
                              <PlayCircle className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleSubscriptionPlatform(platform.id)}
                      className={`min-h-[38px] text-xs font-semibold transition-colors cursor-pointer ${
                        mySubscriptions.includes(platform.id)
                          ? 'text-[#34D399]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {mySubscriptions.includes(platform.id) ? '✓ In My OTTs' : '+ Add to My OTTs'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectPlatform(isActivePlatform ? 'All Platforms' : platform.id);
                        onCloseSheet?.();
                      }}
                      className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)]/15 border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-primary)] transition-colors duration-180 cursor-pointer"
                    >
                      <span>{isActivePlatform ? 'Clear Filter' : `Browse ${platform.name}`}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

