import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Languages,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  FileEdit,
  AlertTriangle,
  Trash2,
  Send,
  ShieldCheck,
  Loader2,
  BookOpen,
} from 'lucide-react';
import {
  cloudflareApi,
  type AnimeTranslationItem,
  type LocaleCoverageItem,
} from '../../services/cloudflareApi';
import {
  TARGET_TRANSLATION_LOCALES,
  computeSourceHash,
  isTranslationOutdated,
  type TargetTranslationLocale,
  type TranslationStatus,
} from '../../utils/animeTranslations';
import { LANGUAGE_REGISTRY } from '../../i18n/languageRegistry';
import { ConfirmDialog } from '../ui/EclipseState';
import type { AdminAnimeRecord } from './types';

interface AdminTranslationsTabProps {
  catalog: AdminAnimeRecord[];
  onSuccess?: (message: string) => void;
}

type TranslationFilterStatus = 'all' | 'missing' | 'draft' | 'reviewed' | 'published' | 'outdated';

const LOCALE_LABELS: Record<TargetTranslationLocale, { native: string; english: string; badge: string }> = {
  ta: { native: 'தமிழ்', english: 'Tamil', badge: 'TA' },
  hi: { native: 'हिन्दी', english: 'Hindi', badge: 'HI' },
  te: { native: 'తెలుగు', english: 'Telugu', badge: 'TE' },
  ml: { native: 'മലയാളം', english: 'Malayalam', badge: 'ML' },
  kn: { native: 'ಕನ್ನಡ', english: 'Kannada', badge: 'KN' },
  bn: { native: 'বাংলা', english: 'Bengali', badge: 'BN' },
};

const STATUS_FILTER_OPTIONS: Array<{ id: TranslationFilterStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'missing', label: 'Missing' },
  { id: 'draft', label: 'Draft' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'published', label: 'Published' },
  { id: 'outdated', label: 'Outdated' },
];

export const AdminTranslationsTab: React.FC<AdminTranslationsTabProps> = ({
  catalog,
  onSuccess,
}) => {
  const [selectedLocale, setSelectedLocale] = useState<TargetTranslationLocale>('ta');
  const [statusFilter, setStatusFilter] = useState<TranslationFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tableReady, setTableReady] = useState<boolean>(true);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);

  const [translations, setTranslations] = useState<AnimeTranslationItem[]>([]);
  const [coverage, setCoverage] = useState<LocaleCoverageItem[]>([]);
  const [animeSourceHashes, setAnimeSourceHashes] = useState<Record<string, string>>({});

  // Editor fields
  const [localizedTitle, setLocalizedTitle] = useState('');
  const [localizedSynopsis, setLocalizedSynopsis] = useState('');
  const [localizedDescription, setLocalizedDescription] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await cloudflareApi.fetchAdminTranslations();
      setTableReady(res.tableReady);
      setMigrationNotice(res.notice || null);
      setTranslations(res.translations || []);
      setCoverage(res.coverage || []);
      setAnimeSourceHashes(res.animeSourceHashes || {});
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load translation center data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  const translationLookup = useMemo(() => {
    const map = new Map<string, AnimeTranslationItem>();
    for (const item of translations) {
      map.set(`${String(item.anime_id)}:${String(item.locale).toLowerCase()}`, item);
    }
    return map;
  }, [translations]);

  const enrichedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog
      .map((anime) => {
        const animeIdStr = String(anime.id);
        const tr = translationLookup.get(`${animeIdStr}:${selectedLocale}`) || null;
        const currentHash =
          animeSourceHashes[animeIdStr] ||
          computeSourceHash(anime.title, anime.synopsis || anime.description || '');
        const outdated = tr ? isTranslationOutdated(tr.source_hash, currentHash) : false;
        const status: 'missing' | TranslationStatus = tr ? tr.translation_status : 'missing';
        return {
          anime,
          animeIdStr,
          translation: tr,
          status,
          outdated,
          currentHash,
        };
      })
      .filter((row) => {
        if (q) {
          const matchesTitle = (row.anime.title || '').toLowerCase().includes(q);
          const matchesId = row.animeIdStr.toLowerCase().includes(q);
          const matchesLocTitle = (row.translation?.localized_title || '').toLowerCase().includes(q);
          if (!matchesTitle && !matchesId && !matchesLocTitle) return false;
        }
        if (statusFilter === 'all') return true;
        if (statusFilter === 'outdated') return row.outdated;
        return row.status === statusFilter;
      });
  }, [catalog, translationLookup, selectedLocale, animeSourceHashes, searchQuery, statusFilter]);

  // Keep a valid anime selected when catalog or filters update
  useEffect(() => {
    if (enrichedRows.length === 0) {
      setSelectedAnimeId('');
      return;
    }
    const stillVisible = enrichedRows.some((r) => r.animeIdStr === selectedAnimeId);
    if (!stillVisible) {
      setSelectedAnimeId(enrichedRows[0].animeIdStr);
    }
  }, [enrichedRows, selectedAnimeId]);

  const activeRow = useMemo(
    () => enrichedRows.find((r) => r.animeIdStr === selectedAnimeId) || enrichedRows[0] || null,
    [enrichedRows, selectedAnimeId]
  );

  // Hydrate editor form whenever selected anime or locale changes
  useEffect(() => {
    if (!activeRow) {
      setLocalizedTitle('');
      setLocalizedSynopsis('');
      setLocalizedDescription('');
      return;
    }
    setLocalizedTitle(activeRow.translation?.localized_title || '');
    setLocalizedSynopsis(activeRow.translation?.synopsis || '');
    setLocalizedDescription(activeRow.translation?.description || '');
  }, [activeRow?.animeIdStr, selectedLocale, activeRow?.translation?.updated_at]);

  const handleSaveWithStatus = async (targetStatus: TranslationStatus) => {
    if (!activeRow) return;
    const trimmedTitle = localizedTitle.trim();
    const trimmedSynopsis = localizedSynopsis.trim();
    const trimmedDesc = localizedDescription.trim();

    if (!trimmedTitle && !trimmedSynopsis && !trimmedDesc) {
      setErrorMsg('Enter at least a localized synopsis, title, or short SEO description before saving.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await cloudflareApi.upsertAdminTranslation({
        anime_id: activeRow.animeIdStr,
        locale: selectedLocale,
        localized_title: trimmedTitle || null,
        synopsis: trimmedSynopsis || null,
        description: trimmedDesc || null,
        translation_status: targetStatus,
      });
      await loadTranslations();
      const label = LOCALE_LABELS[selectedLocale]?.english || selectedLocale.toUpperCase();
      onSuccess?.(
        `Saved ${label} translation for "${activeRow.anime.title}" as ${targetStatus}.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save translation.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTranslation = async () => {
    if (!activeRow || !activeRow.translation) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      await cloudflareApi.deleteAdminTranslation(activeRow.animeIdStr, selectedLocale);
      setConfirmDeleteOpen(false);
      await loadTranslations();
      const label = LOCALE_LABELS[selectedLocale]?.english || selectedLocale.toUpperCase();
      onSuccess?.(
        `Removed ${label} translation for "${activeRow.anime.title}". Original English catalog entry remains untouched.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete translation.');
    } finally {
      setDeleting(false);
    }
  };

  const activeLocaleMeta = LANGUAGE_REGISTRY.find((l) => l.code === selectedLocale);

  return (
    <div className="space-y-5 min-w-0">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
              <Languages className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                Multilingual Translation Center
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Additive D1 localization for anime synopses &amp; SEO metadata. English source entries are never altered.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadTranslations}
          disabled={loading}
          className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Coverage</span>
        </button>
      </div>

      {/* Migration Readiness Notice */}
      {!tableReady && (
        <div
          data-testid="translations-migration-notice"
          className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[#FBBF24]/40 text-[#FBBF24] text-xs flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <div className="font-bold text-sm">Additive D1 Migration Pending</div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {migrationNotice ||
                'The anime_translations table has not been migrated yet. Public pages automatically fall back to English until migrations/002_anime_translations.sql is applied.'}
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl p-3.5 bg-[var(--bg-surface)] border border-[#F87171]/40 text-[#F87171] text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="min-w-0 break-words">{errorMsg}</span>
        </div>
      )}

      {/* Per-Locale Coverage Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {TARGET_TRANSLATION_LOCALES.map((locale) => {
          const stat = coverage.find((c) => c.locale === locale) || {
            locale,
            totalAnime: catalog.length,
            published: 0,
            reviewed: 0,
            draft: 0,
            missing: catalog.length,
            outdated: 0,
            percentPublished: 0,
          };
          const meta = LOCALE_LABELS[locale];
          const isSelected = selectedLocale === locale;
          const pct = Math.min(100, Math.max(0, Number(stat.percentPublished) || 0));
          return (
            <button
              key={locale}
              type="button"
              onClick={() => setSelectedLocale(locale)}
              data-testid={`locale-coverage-card-${locale}`}
              className={`min-h-[88px] text-left p-3 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                isSelected
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--text-primary)] truncate">{meta.native}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] truncate">{meta.english}</div>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                  }`}
                >
                  {pct}%
                </span>
              </div>

              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#34D399] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                  <span>{stat.published}/{stat.totalAnime} live</span>
                  {stat.outdated > 0 && (
                    <span className="text-[#FBBF24] font-semibold">{stat.outdated} stale</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3.5 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search anime to translate into ${LOCALE_LABELS[selectedLocale].english}...`}
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0">
          {STATUS_FILTER_OPTIONS.map((opt) => {
            const active = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Split Workspace: Anime Queue + Side-by-Side Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Queue Column */}
        <div className="lg:col-span-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Catalog Queue ({enrichedRows.length})
            </span>
            <span className="text-xs font-semibold text-[var(--accent-primary)]">
              {LOCALE_LABELS[selectedLocale].native} · {LOCALE_LABELS[selectedLocale].badge}
            </span>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
              <span>Loading translations...</span>
            </div>
          ) : enrichedRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
              No anime match this locale and status filter.
            </div>
          ) : (
            <div className="max-h-[540px] overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {enrichedRows.slice(0, 120).map((row) => {
                const isSelected = activeRow?.animeIdStr === row.animeIdStr;
                return (
                  <button
                    key={row.animeIdStr}
                    type="button"
                    onClick={() => setSelectedAnimeId(row.animeIdStr)}
                    className={`w-full min-h-[60px] px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent-soft)]'
                        : 'hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {row.anime.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                        {row.translation?.localized_title || `ID #${row.animeIdStr}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {row.outdated && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30">
                          Outdated
                        </span>
                      )}
                      <StatusBadge status={row.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Side-by-Side Editor Column */}
        <div className="lg:col-span-7 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4 min-w-0">
          {!activeRow ? (
            <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
              Select an anime from the queue to edit its {LOCALE_LABELS[selectedLocale].english} translation.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Editing {LOCALE_LABELS[selectedLocale].english} ({LOCALE_LABELS[selectedLocale].native})
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] break-words mt-0.5">
                    {activeRow.anime.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {activeRow.outdated && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Source Changed
                    </span>
                  )}
                  <StatusBadge status={activeRow.status} />
                </div>
              </div>

              {/* Read-Only English Source Reference */}
              <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Original English Source (Read-Only)</span>
                </div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  {activeRow.anime.title}
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words max-h-36 overflow-y-auto">
                  {activeRow.anime.synopsis || activeRow.anime.description || 'No English synopsis recorded yet.'}
                </p>
              </div>

              {/* Editable Localized Fields */}
              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="admin-tr-title"
                    className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5"
                  >
                    Optional Localized Subtitle ({activeLocaleMeta?.nativeName || selectedLocale})
                  </label>
                  <input
                    id="admin-tr-title"
                    type="text"
                    maxLength={240}
                    value={localizedTitle}
                    onChange={(e) => setLocalizedTitle(e.target.value)}
                    disabled={!tableReady || saving}
                    placeholder="Optional native-script subtitle (official English title stays primary)"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="admin-tr-synopsis"
                      className="block text-xs font-semibold text-[var(--text-primary)]"
                    >
                      Localized Synopsis
                    </label>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {localizedSynopsis.length}/4000
                    </span>
                  </div>
                  <textarea
                    id="admin-tr-synopsis"
                    rows={5}
                    maxLength={4000}
                    value={localizedSynopsis}
                    onChange={(e) => setLocalizedSynopsis(e.target.value)}
                    disabled={!tableReady || saving}
                    placeholder={`Write natural ${LOCALE_LABELS[selectedLocale].english} synopsis for Indian anime fans...`}
                    className="w-full p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] leading-relaxed resize-y disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="admin-tr-description"
                      className="block text-xs font-semibold text-[var(--text-primary)]"
                    >
                      Short SEO Description (Optional)
                    </label>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {localizedDescription.length}/320
                    </span>
                  </div>
                  <textarea
                    id="admin-tr-description"
                    rows={2}
                    maxLength={320}
                    value={localizedDescription}
                    onChange={(e) => setLocalizedDescription(e.target.value)}
                    disabled={!tableReady || saving}
                    placeholder="Concise 140–160 char localized meta description for search & social shares"
                    className="w-full p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-y disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Workflow Action Bar */}
              <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!tableReady || saving}
                    onClick={() => handleSaveWithStatus('draft')}
                    className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="button"
                    disabled={!tableReady || saving}
                    onClick={() => handleSaveWithStatus('reviewed')}
                    className="min-h-[44px] px-4 rounded-xl bg-[#FBBF24]/15 hover:bg-[#FBBF24]/25 border border-[#FBBF24]/35 text-xs font-semibold text-[#FBBF24] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Mark Reviewed</span>
                  </button>

                  <button
                    type="button"
                    disabled={!tableReady || saving}
                    onClick={() => handleSaveWithStatus('published')}
                    className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] hover:opacity-95 text-[var(--accent-on-primary)] text-xs font-bold inline-flex items-center gap-1.5 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Publish Live</span>
                  </button>
                </div>

                {activeRow.translation && (
                  <button
                    type="button"
                    disabled={deleting || saving}
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="min-h-[44px] px-3.5 rounded-xl bg-[#F87171]/10 hover:bg-[#F87171]/20 border border-[#F87171]/30 text-xs font-semibold text-[#F87171] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteTranslation}
        title="Delete Localized Translation?"
        description={`Remove the ${LOCALE_LABELS[selectedLocale].english} translation for "${activeRow?.anime.title || ''}"? The original English catalog record will not be changed.`}
        confirmLabel="Delete Translation"
        destructive
        loading={deleting}
      />
    </div>
  );
};

const StatusBadge: React.FC<{ status: 'missing' | TranslationStatus }> = ({ status }) => {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30">
        <CheckCircle2 className="w-3 h-3" />
        Published
      </span>
    );
  }
  if (status === 'reviewed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30">
        <ShieldCheck className="w-3 h-3" />
        Reviewed
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
        <Clock className="w-3 h-3" />
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
      Missing
    </span>
  );
};
