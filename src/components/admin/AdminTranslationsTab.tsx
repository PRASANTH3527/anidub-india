import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Sparkles,
  Lock,
  Unlock,
  History,
  RotateCcw,
  Layers,
  Gauge,
  X,
} from 'lucide-react';
import {
  cloudflareApi,
  type AnimeTranslationItem,
  type LocaleCoverageItem,
  type AdminAiUsageSnapshot,
  type TranslationVersionRecord,
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
  initialAnimeId?: string | number | null;
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
  initialAnimeId,
  onSuccess,
}) => {
  const [selectedLocale, setSelectedLocale] = useState<TargetTranslationLocale>('ta');
  const [statusFilter, setStatusFilter] = useState<TranslationFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>(
    initialAnimeId ? String(initialAnimeId) : ''
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);
  const [togglingLock, setTogglingLock] = useState<boolean>(false);
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
  const [isManualLocked, setIsManualLocked] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Phase 3.5: Workers AI Daily Cost Guard
  const [aiUsage, setAiUsage] = useState<AdminAiUsageSnapshot | null>(null);
  const [editingAiCap, setEditingAiCap] = useState(false);
  const [aiCapInput, setAiCapInput] = useState('100');
  const [savingAiCap, setSavingAiCap] = useState(false);

  // Phase 3.5: Selective Bulk Translate Drawer
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkSelectedAnimeIds, setBulkSelectedAnimeIds] = useState<string[]>([]);
  const [bulkTargetLocales, setBulkTargetLocales] = useState<TargetTranslationLocale[]>(['ta', 'hi']);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    completed: number;
    total: number;
    succeeded: number;
    skippedLocked: number;
    failed: number;
    currentLabel: string;
    stoppedReason?: string;
  } | null>(null);
  const bulkCancelRef = useRef(false);

  // Phase 3.5: Version History & Rollback Drawer
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsList, setVersionsList] = useState<TranslationVersionRecord[]>([]);
  const [rollingBackId, setRollingBackId] = useState<number | null>(null);

  useEffect(() => {
    if (initialAnimeId) {
      setSelectedAnimeId(String(initialAnimeId));
    }
  }, [initialAnimeId]);

  const loadAiUsage = useCallback(async () => {
    try {
      const res = await cloudflareApi.fetchAdminAiUsage();
      setAiUsage(res.usage);
      setAiCapInput(String(res.usage?.dailyCap ?? 100));
    } catch {
      // Safe fallback
    }
  }, []);

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [res] = await Promise.all([cloudflareApi.fetchAdminTranslations(), loadAiUsage()]);
      setTableReady(res.tableReady);
      setMigrationNotice(res.notice || null);
      setTranslations(res.translations || []);
      setCoverage(res.coverage || []);
      setAnimeSourceHashes(res.animeSourceHashes || {});
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load translation studio data.');
    } finally {
      setLoading(false);
    }
  }, [loadAiUsage]);

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
        const locked =
          Boolean(tr?.is_locked) ||
          (typeof tr?.updated_by === 'string' && tr.updated_by.startsWith('LOCKED:'));
        return {
          anime,
          animeIdStr,
          translation: tr,
          status,
          outdated,
          locked,
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
      setIsManualLocked(false);
      return;
    }
    setLocalizedTitle(activeRow.translation?.localized_title || '');
    setLocalizedSynopsis(activeRow.translation?.synopsis || '');
    setLocalizedDescription(activeRow.translation?.description || '');
    setIsManualLocked(Boolean(activeRow.locked));
  }, [activeRow?.animeIdStr, selectedLocale, activeRow?.translation?.updated_at, activeRow?.locked]);

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
      if (isManualLocked) {
        await cloudflareApi.toggleAdminTranslationLock(activeRow.animeIdStr, selectedLocale, true).catch(() => null);
      }
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

  const handleRegenerateWithWorkersAi = async () => {
    if (!activeRow) return;
    if (isManualLocked) {
      setErrorMsg(
        'This translation is locked for manual editing. Unlock it first if you want Workers AI to overwrite it.'
      );
      return;
    }
    setGeneratingAi(true);
    setErrorMsg(null);
    try {
      const res = await cloudflareApi.generateAdminTranslationWithAi({
        anime_id: activeRow.animeIdStr,
        locale: selectedLocale,
        title: activeRow.anime.title,
        synopsis: activeRow.anime.synopsis || activeRow.anime.description || '',
      });
      if (res.synopsis) {
        setLocalizedSynopsis(res.synopsis);
      }
      if (res.description) {
        setLocalizedDescription(res.description);
      }
      await loadTranslations();
      const label = LOCALE_LABELS[selectedLocale]?.english || selectedLocale.toUpperCase();
      onSuccess?.(
        `Generated ${label} translation via ${res.provider === 'workers-ai' ? 'Cloudflare Workers AI' : 'Translation Engine'} for "${activeRow.anime.title}".`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to generate translation with Workers AI.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleToggleLock = async () => {
    if (!activeRow) return;
    const nextLock = !isManualLocked;
    setTogglingLock(true);
    setErrorMsg(null);
    try {
      await cloudflareApi.toggleAdminTranslationLock(activeRow.animeIdStr, selectedLocale, nextLock);
      setIsManualLocked(nextLock);
      await loadTranslations();
      const label = LOCALE_LABELS[selectedLocale]?.english || selectedLocale.toUpperCase();
      onSuccess?.(
        `${nextLock ? 'Locked' : 'Unlocked'} manual ${label} translation for "${activeRow.anime.title}".`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Save a draft first before locking manual edits.');
    } finally {
      setTogglingLock(false);
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

  const handleSaveAiCap = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.max(1, Math.min(2000, Math.round(Number(aiCapInput) || 100)));
    setSavingAiCap(true);
    try {
      const updated = await cloudflareApi.updateAdminAiDailyCap(parsed);
      setAiUsage(updated.usage);
      setAiCapInput(String(updated.usage.dailyCap));
      setEditingAiCap(false);
      onSuccess?.(`Updated daily Workers AI translation cap to ${updated.usage.dailyCap} runs/day.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update daily AI cap.');
    } finally {
      setSavingAiCap(false);
    }
  };

  const handleOpenVersionHistory = async () => {
    if (!activeRow) return;
    setIsHistoryOpen(true);
    setLoadingVersions(true);
    try {
      const res = await cloudflareApi.fetchAdminTranslationVersions(activeRow.animeIdStr, selectedLocale);
      setVersionsList(res.versions || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load translation version history.');
      setVersionsList([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRollbackVersion = async (versionId: number) => {
    if (!activeRow) return;
    setRollingBackId(versionId);
    setErrorMsg(null);
    try {
      await cloudflareApi.rollbackAdminTranslationVersion(
        activeRow.animeIdStr,
        selectedLocale,
        versionId
      );
      await loadTranslations();
      const updatedVersions = await cloudflareApi.fetchAdminTranslationVersions(
        activeRow.animeIdStr,
        selectedLocale
      );
      setVersionsList(updatedVersions.versions || []);
      onSuccess?.(`Rolled back ${LOCALE_LABELS[selectedLocale].english} translation for "${activeRow.anime.title}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to rollback translation version.');
    } finally {
      setRollingBackId(null);
    }
  };

  const handleStartSelectiveBulkTranslate = async () => {
    if (bulkSelectedAnimeIds.length === 0 || bulkTargetLocales.length === 0) return;
    bulkCancelRef.current = false;
    setIsBulkRunning(true);
    const tasks: Array<{ anime: AdminAnimeRecord; locale: TargetTranslationLocale }> = [];
    for (const idStr of bulkSelectedAnimeIds) {
      const anime = catalog.find((a) => String(a.id) === idStr);
      if (!anime) continue;
      for (const locale of bulkTargetLocales) {
        tasks.push({ anime, locale });
      }
    }

    let completed = 0;
    let succeeded = 0;
    let skippedLocked = 0;
    let failed = 0;
    let stoppedReason: string | undefined;

    setBulkProgress({
      completed: 0,
      total: tasks.length,
      succeeded: 0,
      skippedLocked: 0,
      failed: 0,
      currentLabel: 'Initializing batch...',
    });

    for (const task of tasks) {
      if (bulkCancelRef.current) {
        stoppedReason = 'Cancelled by admin.';
        break;
      }
      const key = `${String(task.anime.id)}:${task.locale}`;
      const existing = translationLookup.get(key);
      const isLocked =
        Boolean(existing?.is_locked) ||
        (typeof existing?.updated_by === 'string' && existing.updated_by.startsWith('LOCKED:'));

      setBulkProgress({
        completed,
        total: tasks.length,
        succeeded,
        skippedLocked,
        failed,
        currentLabel: `${task.anime.title} (${LOCALE_LABELS[task.locale].badge})`,
      });

      if (isLocked) {
        skippedLocked += 1;
        completed += 1;
        continue;
      }

      try {
        await cloudflareApi.generateAdminTranslationWithAi({
          anime_id: String(task.anime.id),
          locale: task.locale,
          title: task.anime.title,
          synopsis: task.anime.synopsis || task.anime.description || '',
        });
        succeeded += 1;
      } catch (err: any) {
        failed += 1;
        const msg = String(err?.message || '');
        if (msg.toLowerCase().includes('cap') || msg.includes('429')) {
          stoppedReason = 'Daily Workers AI cap reached — batch paused safely.';
          completed += 1;
          break;
        }
      }
      completed += 1;
    }

    setBulkProgress({
      completed,
      total: tasks.length,
      succeeded,
      skippedLocked,
      failed,
      currentLabel: stoppedReason || 'Batch complete!',
      stoppedReason,
    });
    setIsBulkRunning(false);
    await loadTranslations();
    onSuccess?.(
      `Bulk translate finished: ${succeeded} generated, ${skippedLocked} locked skipped, ${failed} failed.`
    );
  };

  const activeLocaleMeta = LANGUAGE_REGISTRY.find((l) => l.code === selectedLocale);

  return (
    <div data-testid="admin-translations-studio" className="space-y-5 min-w-0">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
              <Languages className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                Workers AI Translation Studio (`anime_translations`)
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Side-by-side Original English Synopsis vs Localized Translation across 6 Indian scripts with Workers AI cost guard, selective batching, manual lock protection &amp; version rollback.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Workers AI Daily Cost Guard Badge */}
          {aiUsage && (
            <div
              data-testid="ai-daily-usage-badge"
              className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-2 ${
                aiUsage.allowed
                  ? 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                  : 'bg-red-500/15 border-red-500/40 text-red-500'
              }`}
            >
              <Gauge className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              {editingAiCap ? (
                <form onSubmit={handleSaveAiCap} className="inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={aiCapInput}
                    onChange={(e) => setAiCapInput(e.target.value)}
                    className="w-16 px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--accent-primary)] text-xs font-mono text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    disabled={savingAiCap}
                    className="px-2 py-0.5 rounded bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-[11px] font-bold cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAiCap(false)}
                    className="text-[11px] text-[var(--text-secondary)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span>
                    AI Cost Guard: {aiUsage.usedToday} / {aiUsage.dailyCap} today
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingAiCap(true)}
                    className="text-[11px] underline text-[var(--accent-primary)] cursor-pointer"
                  >
                    Cap
                  </button>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            data-testid="open-selective-bulk-translate-btn"
            onClick={() => {
              setBulkSelectedAnimeIds(
                enrichedRows
                  .filter((r) => !r.locked && (r.status === 'missing' || r.outdated))
                  .slice(0, 15)
                  .map((r) => r.animeIdStr)
              );
              setBulkProgress(null);
              setIsBulkOpen(true);
            }}
            className="min-h-[44px] px-3.5 rounded-xl bg-[var(--accent-soft)] hover:opacity-90 border border-[var(--accent-primary)]/40 text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Selective Bulk Translate</span>
          </button>

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
                      {row.locked && (
                        <span
                          className="p-1 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30"
                          title="Locked Manual Edit"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
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

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Regenerate with Workers AI Button */}
                  <button
                    type="button"
                    data-testid="regenerate-workers-ai-btn"
                    disabled={generatingAi || saving || isManualLocked || aiUsage?.allowed === false}
                    onClick={handleRegenerateWithWorkersAi}
                    title={
                      aiUsage?.allowed === false
                        ? 'Daily Workers AI cap reached'
                        : isManualLocked
                          ? 'Unlock manual edits first'
                          : 'Generate translation with Workers AI'
                    }
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--accent-soft)] hover:opacity-90 border border-[var(--accent-primary)]/40 text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {generatingAi ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {aiUsage?.allowed === false ? 'Daily AI Cap Reached' : 'Regenerate with Workers AI'}
                    </span>
                  </button>

                  {/* Version History & Rollback Button */}
                  <button
                    type="button"
                    data-testid="open-translation-versions-btn"
                    onClick={handleOpenVersionHistory}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>History</span>
                  </button>

                  {/* Lock Manual Edit Button */}
                  <button
                    type="button"
                    data-testid="toggle-translation-lock-btn"
                    disabled={togglingLock || saving}
                    onClick={handleToggleLock}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      isManualLocked
                        ? 'bg-amber-500/15 text-amber-500 border-amber-500/40'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {isManualLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span>{isManualLocked ? 'Locked (Manual)' : 'Lock Manual Edit'}</span>
                  </button>

                  <StatusBadge status={activeRow.status} />
                </div>
              </div>

              {/* Side-by-Side Comparison: Left Original English vs Right Localized Editor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Original English Source (Read-Only) */}
                <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      Original English Synopsis
                    </span>
                    <span className="text-[10px] font-mono">Read-Only</span>
                  </div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    {activeRow.anime.title}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
                    {activeRow.anime.synopsis || activeRow.anime.description || 'No English synopsis recorded yet.'}
                  </p>
                </div>

                {/* Localized Synopsis Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="admin-tr-synopsis"
                      className="block text-xs font-bold text-[var(--text-primary)]"
                    >
                      Localized {LOCALE_LABELS[selectedLocale].english} Synopsis
                    </label>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {localizedSynopsis.length}/4000
                    </span>
                  </div>
                  <textarea
                    id="admin-tr-synopsis"
                    rows={8}
                    maxLength={4000}
                    value={localizedSynopsis}
                    onChange={(e) => setLocalizedSynopsis(e.target.value)}
                    disabled={!tableReady || saving}
                    placeholder={`Write or generate natural ${LOCALE_LABELS[selectedLocale].english} synopsis for Indian anime fans...`}
                    className="w-full p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] leading-relaxed resize-y disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Additional Localized Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                    placeholder="Optional native-script subtitle (English title stays primary)"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-60"
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
                  <input
                    id="admin-tr-description"
                    type="text"
                    maxLength={320}
                    value={localizedDescription}
                    onChange={(e) => setLocalizedDescription(e.target.value)}
                    disabled={!tableReady || saving}
                    placeholder="Concise 140–160 char localized meta description"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-60"
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
                    <span>Edit Manually (Save Draft)</span>
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

      {/* Selective Bulk Translate Modal */}
      {isBulkOpen && (
        <div
          data-testid="selective-bulk-translate-modal"
          className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Selective Bulk Workers AI Translation</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Locked manual translations are automatically skipped. Respects your daily Workers AI Cost Guard cap.
                </p>
              </div>
              <button
                type="button"
                disabled={isBulkRunning}
                onClick={() => setIsBulkOpen(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)] mb-2">
                  1. Target Languages ({bulkTargetLocales.length} selected)
                </div>
                <div className="flex flex-wrap gap-2">
                  {TARGET_TRANSLATION_LOCALES.map((loc) => {
                    const active = bulkTargetLocales.includes(loc);
                    return (
                      <button
                        key={loc}
                        type="button"
                        disabled={isBulkRunning}
                        onClick={() =>
                          setBulkTargetLocales((prev) =>
                            prev.includes(loc) ? prev.filter((x) => x !== loc) : [...prev, loc]
                          )
                        }
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                          active
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {LOCALE_LABELS[loc].native} ({LOCALE_LABELS[loc].english})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    2. Select Anime ({bulkSelectedAnimeIds.length} selected)
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={isBulkRunning}
                      onClick={() =>
                        setBulkSelectedAnimeIds(enrichedRows.slice(0, 25).map((r) => r.animeIdStr))
                      }
                      className="text-[var(--accent-primary)] font-bold underline cursor-pointer"
                    >
                      Select Top 25
                    </button>
                    <button
                      type="button"
                      disabled={isBulkRunning}
                      onClick={() => setBulkSelectedAnimeIds([])}
                      className="text-[var(--text-secondary)] underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  {enrichedRows.slice(0, 50).map((row) => {
                    const checked = bulkSelectedAnimeIds.includes(row.animeIdStr);
                    return (
                      <label
                        key={row.animeIdStr}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-[var(--bg-surface)]"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            disabled={isBulkRunning}
                            checked={checked}
                            onChange={() =>
                              setBulkSelectedAnimeIds((prev) =>
                                prev.includes(row.animeIdStr)
                                  ? prev.filter((id) => id !== row.animeIdStr)
                                  : [...prev, row.animeIdStr]
                              )
                            }
                            className="w-4 h-4 accent-[var(--accent-primary)]"
                          />
                          <span className="font-semibold text-[var(--text-primary)] truncate">
                            {row.anime.title}
                          </span>
                        </span>
                        {row.locked && (
                          <span className="text-[10px] font-bold text-amber-500 shrink-0">
                            Locked (Skipped)
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {bulkProgress && (
                <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                    <span className="truncate">{bulkProgress.currentLabel}</span>
                    <span className="font-mono shrink-0">
                      {bulkProgress.completed} / {bulkProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-primary)] transition-all duration-200"
                      style={{
                        width: `${
                          bulkProgress.total > 0
                            ? Math.round((bulkProgress.completed / bulkProgress.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-secondary)]">
                    <span className="text-emerald-500 font-bold">Generated: {bulkProgress.succeeded}</span>
                    <span className="text-amber-500 font-bold">Locked Skipped: {bulkProgress.skippedLocked}</span>
                    <span className="text-red-500 font-bold">Failed: {bulkProgress.failed}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                {isBulkRunning ? (
                  <button
                    type="button"
                    onClick={() => {
                      bulkCancelRef.current = true;
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-red-500 text-white text-xs font-extrabold cursor-pointer"
                  >
                    Cancel Batch
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsBulkOpen(false)}
                      className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={
                        bulkSelectedAnimeIds.length === 0 ||
                        bulkTargetLocales.length === 0 ||
                        aiUsage?.allowed === false
                      }
                      onClick={handleStartSelectiveBulkTranslate}
                      className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        Run {bulkSelectedAnimeIds.length * bulkTargetLocales.length} Translations
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History & 1-Click Rollback Slide-Over Drawer */}
      {isHistoryOpen && activeRow && (
        <div
          data-testid="translation-version-history-drawer"
          className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-xs flex justify-end"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            className="w-full max-w-lg h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <History className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Translation Version History</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {activeRow.anime.title} · {LOCALE_LABELS[selectedLocale].english} ({LOCALE_LABELS[selectedLocale].native})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {loadingVersions ? (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
                  <span>Loading saved translation snapshots...</span>
                </div>
              ) : versionsList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
                  No previous versions recorded yet. Snapshots are automatically archived before every overwrite or AI regeneration.
                </div>
              ) : (
                versionsList.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-[var(--text-primary)]">
                        {ver.source_type || 'manual'} · {ver.saved_by || 'admin'}
                      </span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {ver.created_at ? new Date(ver.created_at).toLocaleString() : '—'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words line-clamp-4">
                      {ver.synopsis_text || '(Empty synopsis)'}
                    </p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={rollingBackId === ver.id}
                        onClick={() => handleRollbackVersion(ver.id)}
                        className="min-h-[38px] px-3 rounded-lg bg-[var(--accent-soft)] hover:opacity-90 border border-[var(--accent-primary)]/40 text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {rollingBackId === ver.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>1-Click Rollback</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
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
