import React, { useEffect, useMemo, useState } from 'react';
import {
  Star,
  Send,
  Trash2,
  Eye,
  EyeOff,
  Sliders,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import {
  DUB_REVIEW_DIMENSIONS,
  computeOverallDubScore,
  type DubReviewAggregate,
  type DubReviewDimensionKey,
  type DubReviewRecord,
  type DubReviewScores,
} from '../../utils/animeDetailsV2';
import { getLanguageScriptBadge } from '../../utils/animeDetailIntelligence';

export interface RegionalDubReviewsPanelProps {
  animeTitle: string;
  availableLanguages: string[];
  dubReviews: DubReviewRecord[];
  summary: DubReviewAggregate;
  byLanguage: Record<string, DubReviewAggregate>;
  activeLangFilter: string;
  onSelectLangFilter: (lang: string) => void;
  spoilerShieldEnabled: boolean;
  onToggleSpoilerShield: () => void;
  user?: { id?: string; name?: string; email?: string; isAdmin?: boolean } | null;
  submitState: 'idle' | 'posting' | 'failed';
  submitError: string | null;
  onSubmitDubReview: (payload: {
    dub_language: string;
    voice_acting: number;
    voice_casting: number;
    translation_quality: number;
    lip_sync: number;
    emotional_delivery: number;
    review_text?: string;
    has_spoilers?: boolean;
  }) => Promise<void>;
  onDeleteDubReview: (reviewId: number) => Promise<void>;
  postingLabel?: string;
  retryLabel?: string;
}

const DEFAULT_INDIAN_DUB_LANGUAGES = [
  'Tamil',
  'Hindi',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
];

const INITIAL_SCORES: DubReviewScores = {
  voice_acting: 8,
  voice_casting: 8,
  translation_quality: 8,
  lip_sync: 8,
  emotional_delivery: 8,
};

function formatReviewDate(raw: string): string {
  if (!raw) return 'Just now';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Regional 5-Slider Dub Quality Reviews Panel.
 * - Per-language community averages computed strictly from real published reviews (never fake scores).
 * - Interactive 5-dimension rating form (Voice Acting, Voice Casting, Translation Quality, Lip Sync, Emotional Delivery).
 * - Owner/Admin delete support and Spoiler Shield masking.
 */
export const RegionalDubReviewsPanel: React.FC<RegionalDubReviewsPanelProps> = ({
  animeTitle,
  availableLanguages,
  dubReviews,
  summary,
  byLanguage,
  activeLangFilter,
  onSelectLangFilter,
  spoilerShieldEnabled,
  onToggleSpoilerShield,
  user,
  submitState,
  submitError,
  onSubmitDubReview,
  onDeleteDubReview,
  postingLabel = 'Posting…',
  retryLabel = 'Failed — Retry',
}) => {
  const selectableLanguages = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    const addLang = (l: string) => {
      const clean = String(l || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push(clean);
    };

    for (const l of availableLanguages) addLang(l);
    for (const l of Object.keys(byLanguage)) addLang(l);
    if (ordered.length === 0) {
      for (const l of DEFAULT_INDIAN_DUB_LANGUAGES) addLang(l);
    }
    return ordered;
  }, [availableLanguages, byLanguage]);

  const [selectedFormLang, setSelectedFormLang] = useState<string>(
    selectableLanguages[0] || 'Hindi'
  );
  const [scores, setScores] = useState<DubReviewScores>(INITIAL_SCORES);
  const [reviewText, setReviewText] = useState('');
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lastSubmittedPayload, setLastSubmittedPayload] = useState<{
    dub_language: string;
    voice_acting: number;
    voice_casting: number;
    translation_quality: number;
    lip_sync: number;
    emotional_delivery: number;
    review_text?: string;
    has_spoilers?: boolean;
  } | null>(null);

  useEffect(() => {
    if (selectableLanguages.length > 0 && !selectableLanguages.includes(selectedFormLang)) {
      setSelectedFormLang(selectableLanguages[0]);
    }
  }, [selectableLanguages, selectedFormLang]);

  const liveOverallScore = useMemo(() => computeOverallDubScore(scores), [scores]);

  const filteredReviews = useMemo(() => {
    if (activeLangFilter === 'All') return dubReviews;
    return dubReviews.filter(
      (r) => r.dub_language.toLowerCase() === activeLangFilter.toLowerCase()
    );
  }, [dubReviews, activeLangFilter]);

  const activeSummary: DubReviewAggregate = useMemo(() => {
    if (activeLangFilter === 'All') return summary;
    const exact = byLanguage[activeLangFilter];
    if (exact) return exact;
    const matchedKey = Object.keys(byLanguage).find(
      (k) => k.toLowerCase() === activeLangFilter.toLowerCase()
    );
    if (matchedKey) return byLanguage[matchedKey];
    return {
      count: 0,
      overall: null,
      voice_acting: null,
      voice_casting: null,
      translation_quality: null,
      lip_sync: null,
      emotional_delivery: null,
    };
  }, [activeLangFilter, summary, byLanguage]);

  const handleSliderChange = (key: DubReviewDimensionKey, value: number) => {
    const clamped = Math.max(1, Math.min(10, Math.round(value)));
    setScores((prev) => ({ ...prev, [key]: clamped }));
  };

  const handleFormSubmit = async (e?: React.FormEvent, retryPayload?: typeof lastSubmittedPayload) => {
    if (e) e.preventDefault();
    if (!user?.id) return;
    const payload = retryPayload || {
      dub_language: selectedFormLang,
      ...scores,
      review_text: reviewText.trim() || undefined,
      has_spoilers: hasSpoilers,
    };
    setLastSubmittedPayload(payload);
    try {
      await onSubmitDubReview(payload);
      setReviewText('');
      setHasSpoilers(false);
      setLastSubmittedPayload(null);
    } catch {
      // Parent sets submitState='failed' & submitError
    }
  };

  const handleDelete = async (reviewId: number) => {
    setDeletingId(reviewId);
    try {
      await onDeleteDubReview(reviewId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5" data-testid="regional-dub-reviews-panel">
      {/* 1. Per-Language Filter Pills */}
      <div
        role="tablist"
        aria-label="Filter dub quality reviews by language"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeLangFilter === 'All'}
          data-testid="dub-review-filter-all"
          onClick={() => onSelectLangFilter('All')}
          className={`min-h-[44px] px-3.5 rounded-[10px] border text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
            activeLangFilter === 'All'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
              : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
          }`}
        >
          <span>All Dubs</span>
          {summary.count > 0 && (
            <span className="text-[11px] tabular-nums opacity-85">({summary.count})</span>
          )}
        </button>

        {selectableLanguages.map((lang) => {
          const isActive = activeLangFilter.toLowerCase() === lang.toLowerCase();
          const langAgg =
            byLanguage[lang] ||
            byLanguage[
              Object.keys(byLanguage).find((k) => k.toLowerCase() === lang.toLowerCase()) || ''
            ];
          const count = langAgg?.count || 0;
          return (
            <button
              key={lang}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`dub-review-filter-${lang.toLowerCase()}`}
              onClick={() => onSelectLangFilter(lang)}
              className={`min-h-[44px] px-3 rounded-[10px] border text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-[6px] text-[11px] font-bold flex items-center justify-center ${
                  isActive
                    ? 'bg-black/15 text-[var(--accent-on-primary)]'
                    : 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                }`}
              >
                {getLanguageScriptBadge(lang)}
              </span>
              <span>{lang}</span>
              {count > 0 && (
                <span className="text-[11px] tabular-nums opacity-85">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Honest 5-Dimension Community Dub Quality Summary (ONLY shown when real reviews exist) */}
      {activeSummary.count > 0 && activeSummary.overall !== null && (
        <section
          data-testid="dub-quality-summary"
          className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-5 items-center">
            <div className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {activeLangFilter === 'All' ? 'Overall Dub Score' : `${activeLangFilter} Dub Score`}
              </div>
              <div className="mt-1.5 flex items-baseline justify-center gap-1">
                <span
                  data-testid="dub-summary-overall-score"
                  className="text-[34px] font-extrabold text-[var(--text-primary)] leading-none tabular-nums"
                >
                  {activeSummary.overall.toFixed(1)}
                </span>
                <span className="text-[13px] font-semibold text-[var(--text-muted)]">/10</span>
              </div>
              <div className="mt-1.5 text-[12px] font-semibold text-[var(--text-secondary)] tabular-nums">
                Based on {activeSummary.count}{' '}
                {activeSummary.count === 1 ? 'review' : 'reviews'}
              </div>
            </div>

            <div className="space-y-2.5 min-w-0">
              {DUB_REVIEW_DIMENSIONS.map((dim) => {
                const avg = activeSummary[dim.key];
                const pct = avg !== null ? Math.max(0, Math.min(100, (avg / 10) * 100)) : 0;
                return (
                  <div key={dim.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="font-semibold text-[var(--text-primary)] truncate">
                        {dim.label}
                      </span>
                      <span className="font-bold text-[var(--text-primary)] tabular-nums shrink-0">
                        {avg !== null ? `${avg.toFixed(1)} / 10` : '—'}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. Interactive 5-Slider Regional Dub Rating Form */}
      <form
        onSubmit={(e) => handleFormSubmit(e)}
        data-testid="dub-review-form"
        className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sliders className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <h2 className="text-[16px] font-bold text-[var(--text-primary)] truncate">
              Rate {animeTitle} Regional Dub
            </h2>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30">
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">Overall</span>
            <span
              data-testid="live-dub-overall-score"
              className="text-[14px] font-extrabold text-[var(--accent-primary)] tabular-nums"
            >
              {liveOverallScore.toFixed(1)} / 10
            </span>
          </div>
        </div>

        {/* Select Dub Language to Rate */}
        <div className="space-y-1.5">
          <div className="text-[12px] font-semibold text-[var(--text-secondary)]">
            Dub Language
          </div>
          <div className="flex flex-wrap gap-2">
            {selectableLanguages.map((lang) => {
              const isSelected = selectedFormLang === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  data-testid={`form-lang-${lang.toLowerCase()}`}
                  onClick={() => setSelectedFormLang(lang)}
                  className={`min-h-[44px] px-3 rounded-[10px] border text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
                  }`}
                >
                  <span>{getLanguageScriptBadge(lang)}</span>
                  <span>{lang}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5 Criterion Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {DUB_REVIEW_DIMENSIONS.map((dim, idx) => {
            const val = scores[dim.key];
            const isFullWidthLast = idx === DUB_REVIEW_DIMENSIONS.length - 1;
            return (
              <div
                key={dim.key}
                className={`rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 space-y-2 ${
                  isFullWidthLast ? 'sm:col-span-2' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`dub-slider-${dim.key}`}
                    className="text-[13px] font-bold text-[var(--text-primary)]"
                  >
                    {dim.label}
                  </label>
                  <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-extrabold text-[var(--accent-primary)] tabular-nums">
                    {val}/10
                  </span>
                </div>
                <input
                  id={`dub-slider-${dim.key}`}
                  data-testid={`slider-${dim.key}`}
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={val}
                  onChange={(e) => handleSliderChange(dim.key, Number(e.target.value))}
                  className="w-full h-2.5 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                />
                <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                  {dim.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Optional Written Notes */}
        <div className="space-y-1.5">
          <label
            htmlFor="dub-review-textarea"
            className="block text-[12px] font-semibold text-[var(--text-secondary)]"
          >
            Written notes (optional)
          </label>
          <textarea
            id="dub-review-textarea"
            rows={3}
            maxLength={2000}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder={`Share your impressions of the ${selectedFormLang} voice cast, dialogue naturalness, or lip sync...`}
            className="w-full rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>

        {submitError && (
          <div
            role="alert"
            className="rounded-[10px] bg-[#F87171]/12 border border-[#F87171]/35 px-3.5 py-2.5 flex items-center gap-2 text-[12px] font-semibold text-[#DC2626] dark:text-[#F87171]"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="min-h-[44px] inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasSpoilers}
              onChange={(e) => setHasSpoilers(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--accent-primary)]"
            />
            <span>Contains spoilers</span>
          </label>

          {user?.id ? (
            <div className="flex items-center gap-2">
              {submitState === 'failed' && lastSubmittedPayload && (
                <button
                  type="button"
                  onClick={() => handleFormSubmit(undefined, lastSubmittedPayload)}
                  className="min-h-[44px] px-3.5 rounded-[10px] bg-red-500/15 text-[#DC2626] dark:text-[#F87171] border border-red-500/30 text-[12px] font-bold cursor-pointer"
                >
                  {retryLabel}
                </button>
              )}

              <button
                type="submit"
                disabled={submitState === 'posting'}
                data-testid="submit-dub-review-btn"
                className="min-h-[44px] px-4 rounded-[10px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-on-primary)] font-bold text-[13px] inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {submitState === 'posting'
                    ? postingLabel
                    : `Publish ${selectedFormLang} Rating`}
                </span>
              </button>
            </div>
          ) : (
            <div
              data-testid="dub-review-signin-prompt"
              className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-secondary)] inline-flex items-center gap-2"
            >
              <Lock className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span>Sign in to publish your regional dub rating</span>
            </div>
          )}
        </div>
      </form>

      {/* 4. Spoiler Shield Controls Bar */}
      <div className="rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] min-w-0">
          {spoilerShieldEnabled ? (
            <EyeOff className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          ) : (
            <Eye className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          )}
          <span className="font-semibold text-[var(--text-primary)]">Spoiler Shield</span>
          <span className="text-[12px] text-[var(--text-secondary)] hidden sm:inline truncate">
            {spoilerShieldEnabled
              ? 'Masks reviews flagged with plot spoilers'
              : 'Showing all spoilers'}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={spoilerShieldEnabled}
          onClick={onToggleSpoilerShield}
          data-testid="spoiler-shield-toggle"
          className={`min-h-[44px] px-3.5 rounded-[10px] text-[12px] font-bold border transition-colors duration-180 shrink-0 cursor-pointer ${
            spoilerShieldEnabled
              ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
          }`}
        >
          {spoilerShieldEnabled ? 'Spoiler Shield: ON' : 'Spoiler Shield: OFF'}
        </button>
      </div>

      {/* 5. Community Regional Dub Reviews List (Honest Empty State when 0 reviews) */}
      {filteredReviews.length > 0 ? (
        <div className="space-y-3" data-testid="dub-reviews-list">
          {filteredReviews.map((rev) => {
            const isMasked = Boolean(
              rev.has_spoilers && spoilerShieldEnabled && !revealedIds[rev.id]
            );
            const canDelete = Boolean(rev.is_owner || user?.isAdmin);
            return (
              <article
                key={rev.id}
                data-testid={`dub-review-card-${rev.id}`}
                className="rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[14px] font-bold text-[var(--text-primary)] truncate">
                      {rev.user_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 text-[11px] font-bold">
                      {rev.dub_language} Dub
                    </span>
                    <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-elevated)] text-[#B45309] dark:text-[#FBBF24] border border-[var(--border-subtle)] text-[11px] font-bold tabular-nums inline-flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      {Number(rev.overall_score).toFixed(1)}/10
                    </span>
                    {rev.has_spoilers && (
                      <span className="px-2 py-0.5 rounded-[6px] bg-[#FBBF24]/15 text-[#B45309] dark:text-[#FBBF24] border border-[#FBBF24]/30 text-[10px] font-bold uppercase">
                        Spoiler
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {formatReviewDate(rev.updated_at || rev.created_at)}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        disabled={deletingId === rev.id}
                        onClick={() => handleDelete(rev.id)}
                        aria-label="Delete dub review"
                        className="min-h-[44px] min-w-[44px] rounded-[8px] bg-[var(--bg-elevated)] hover:bg-[#F87171]/15 text-[var(--text-secondary)] hover:text-[#DC2626] dark:hover:text-[#F87171] border border-[var(--border-subtle)] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Compact 5-Dimension Score Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {DUB_REVIEW_DIMENSIONS.map((dim) => (
                    <div
                      key={dim.key}
                      className="rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2.5 py-1.5 flex items-center justify-between gap-1 text-[11px]"
                    >
                      <span className="text-[var(--text-secondary)] truncate">
                        {dim.shortLabel}
                      </span>
                      <span className="font-bold text-[var(--text-primary)] tabular-nums">
                        {rev[dim.key]}
                      </span>
                    </div>
                  ))}
                </div>

                {rev.review_text && (
                  isMasked ? (
                    <div className="p-3 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[13px] text-[var(--text-secondary)]">
                        This dub review is hidden by Spoiler Shield.
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedIds((prev) => ({ ...prev, [rev.id]: true }))
                        }
                        className="min-h-[44px] px-3 rounded-[8px] bg-[var(--bg-surface)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold cursor-pointer"
                      >
                        Reveal Spoiler
                      </button>
                    </div>
                  ) : (
                    <p className="text-[14px] text-[var(--text-primary)] leading-relaxed break-words">
                      {rev.review_text}
                    </p>
                  )
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div
          data-testid="dub-reviews-empty"
          className="rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 text-center text-[13px] text-[var(--text-secondary)]"
        >
          <p className="font-bold text-[var(--text-primary)] mb-1">
            Be the first to rate this dub
          </p>
          <p>
            {activeLangFilter === 'All'
              ? 'No regional dub quality ratings have been submitted for this anime yet.'
              : `No ${activeLangFilter} dub quality ratings yet. Use the 5 sliders above to share your verdict.`}
          </p>
        </div>
      )}
    </div>
  );
};
