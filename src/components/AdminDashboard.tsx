import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import {
  CheckCircle2, XCircle, Plus, Search, ShieldAlert, Clock, Film, Download, Upload, LogOut,
  Terminal, BarChart3, Settings, ArrowLeft, ShieldCheck, Languages, LayoutDashboard,
  PanelLeftClose, PanelLeftOpen, Layers, Mic2, Palette, ExternalLink, Star, Zap, RefreshCw,
  Command, MessageSquare,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { ADMIN_QUICK_PILL_TABS } from '../utils/adminShellLayout';
import { DubInfoModal } from './DubInfoModal';
import { ConfirmDialog, AdminSkeleton } from './ui/EclipseState';
import { cloudflareApi, type AdminLinkCheckResponse } from '../services/cloudflareApi';
import { getCloudflareUrl } from '../config/cloudflare';
import { useUser, useAuth, getClerkSessionToken } from '../lib/clerk';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import {
  auditAnimeDataHealth, type DataHealthFilter, type AdminActiveTab,
  type AdminFeedbackItem, type AdminOverviewStats, type FeedbackStatus,
} from './admin/types';
import { validateCsvDryRunRows, type AnimeEditorTabId, type CsvDryRunSummary } from '../utils/adminOpsPro';
import { AdminTranslationsTab } from './admin/AdminTranslationsTab';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminCatalogTab } from './admin/AdminCatalogTab';
import { AdminDataHealthTab } from './admin/AdminDataHealthTab';
import { AdminSettingsTab } from './admin/AdminSettingsTab';
import { AdminTerminalHud } from './admin/AdminTerminalHud';
import { AdminCommandPalette } from './admin/AdminCommandPalette';
import { AdminCsvHelpModal } from './admin/AdminCsvHelpModal';
import { AdminModerationInboxTab } from './admin/AdminModerationInboxTab';
import { AdminFranchiseBuilderTab } from './admin/AdminFranchiseBuilderTab';
import { AdminCastManagerTab } from './admin/AdminCastManagerTab';
import { AdminBackupCenterTab } from './admin/AdminBackupCenterTab';
import { AdminImdbCheckerTab } from './admin/AdminImdbCheckerTab';
import { AdminMobileNav } from './admin/AdminMobileNav';
import { parseCsvTextToAnimeRows, type CsvImportSummaryResult } from '../utils/adminLegacyRestore';
import {
  buildCatalogExportCsv, buildCatalogExportSql, computeAdminOverviewStats,
  downloadTextBlob, buildFailedCsvRowsString,
} from '../utils/adminExportHelpers';

const AnalyticsDashboard = lazy(() =>
  import('./AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard }))
);

export interface AdminDashboardProps {
  onAnimeCreated?: (updatedAnime?: any, deletedId?: string | number) => void;
  onLogout?: () => void;
  onNavigateHome?: () => void;
  catalogList?: any[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onAnimeCreated,
  onLogout,
  onNavigateHome,
  catalogList = [],
}) => {
  const { t } = useTranslation();
  const { openAppearance, displayName } = useTheme();
  const { isSignedIn, user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const [serverVerifiedAdmin, setServerVerifiedAdmin] = useState<boolean | null>(null);

  const isClerkAdminAuthorized =
    Boolean(isSignedIn && clerkUser && (isAuthorizedClerkAdmin(clerkUser) || serverVerifiedAdmin === true)) &&
    serverVerifiedAdmin !== false;

  // Navigation & Responsive Shell State (hydrates from URL query params)
  const [activeTab, setActiveTab] = useState<AdminActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (p === '/admin/analytics') return 'analytics';
      const tabParam = params.get('tab') as AdminActiveTab | null;
      if (
        tabParam &&
        tabParam !== 'dubs' &&
        tabParam !== 'activity_log' &&
        tabParam !== 'recycle_bin' &&
        tabParam !== 'editor'
      ) {
        return tabParam;
      }
    }
    return 'overview';
  });
  const [moderationSubTab, setModerationSubTab] = useState<'all' | 'pending' | 'feedback'>('pending');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileStudioOpen, setIsMobileStudioOpen] = useState<boolean>(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);

  // Server-Side Paginated Catalog State (restored from URL query params)
  const [catalogItems, setCatalogItems] = useState<any[]>(catalogList);
  const [catalogPage, setCatalogPage] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const p = Number(new URLSearchParams(window.location.search).get('page'));
      if (Number.isInteger(p) && p > 0) return p;
    }
    return 1;
  });
  const [catalogPageSize] = useState<number>(25);
  const [catalogTotalItems, setCatalogTotalItems] = useState<number>(catalogList.length);
  const [catalogTotalPages, setCatalogTotalPages] = useState<number>(1);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') || '' : ''
  );
  const [debouncedSearch, setDebouncedSearch] = useState<string>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') || '' : ''
  );
  const [filterStatus, setFilterStatus] = useState<string>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('status') || 'All' : 'All'
  );
  const [filterLanguage, setFilterLanguage] = useState<string>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') || 'All' : 'All'
  );
  const [sortBy, setSortBy] = useState<string>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sort') || 'id_desc' : 'id_desc'
  );
  const catalogAbortRef = useRef<AbortController | null>(null);

  // Full Catalog Index for Data Health & Translations
  const [fullAdminIndex, setFullAdminIndex] = useState<any[]>(catalogList);

  // Bulk Actions & Modals State
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<number[]>([]);
  const [bulkLanguage, setBulkLanguage] = useState<string>('Hindi');
  const [isBulkProcessing, setIsBulkProcessing] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingAnime, setEditingAnime] = useState<any | null>(null);
  const [translationTargetAnimeId, setTranslationTargetAnimeId] = useState<string | number | null>(null);
  const [franchiseTargetKey, setFranchiseTargetKey] = useState<string | undefined>(undefined);
  const [castTargetAnimeId, setCastTargetAnimeId] = useState<string | number | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [cmdQuery, setCmdQuery] = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<DataHealthFilter>('all');

  // Pending Moderation & Feedback State
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [feedbackList, setFeedbackList] = useState<AdminFeedbackItem[]>([]);
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<number | string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Data Health & Link Checker State
  const [linkCheckReport, setLinkCheckReport] = useState<AdminLinkCheckResponse | null>(null);
  const [isCheckingLinks, setIsCheckingLinks] = useState<boolean>(false);

  // CSV Import / Export & Dry-Run State
  const [isUploadingCsv, setIsUploadingCsv] = useState<boolean>(false);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<CsvImportSummaryResult | null>(null);
  const [isCsvHelpOpen, setIsCsvHelpOpen] = useState<boolean>(false);
  const [csvDryRunReport, setCsvDryRunReport] = useState<CsvDryRunSummary | null>(null);
  const [stagedCsvRows, setStagedCsvRows] = useState<any[]>([]);
  const [backupFocusSection, setBackupFocusSection] = useState<'csv' | 'backup'>('backup');
  const [isNormalizingPlatforms, setIsNormalizingPlatforms] = useState<boolean>(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const triggerCsvFilePicker = useCallback(() => {
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
      csvInputRef.current.click();
    }
  }, []);

  // Diagnostics & D1 Status State
  const [cfStatus, setCfStatus] = useState<any>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [SYSTEM] AniDub India Admin Workspace 2.0 initialized.`,
  ]);
  const [isTestingApi, setIsTestingApi] = useState<boolean>(false);
  const [d1Table, setD1Table] = useState<'anime' | 'users' | 'logs'>('anime');
  const [d1AnimeId, setD1AnimeId] = useState<string>('');
  const [d1TitleSearch, setD1TitleSearch] = useState<string>('');
  const [d1Limit, setD1Limit] = useState<number>(5);
  const [d1QueryResult, setD1QueryResult] = useState<any>(null);
  const [isExecutingQuery, setIsExecutingQuery] = useState<boolean>(false);

  // Settings State
  const [tgToken, setTgToken] = useState<string>('');
  const [tgChatId, setTgChatId] = useState<string>('');
  const [tgStatus, setTgStatus] = useState<{
    configured: boolean;
    botTokenSet?: boolean;
    chatIdSet?: boolean;
  }>({ configured: false });
  const [isSavingTg, setIsSavingTg] = useState<boolean>(false);
  const [isTestingTg, setIsTestingTg] = useState<boolean>(false);
  const [customWorkerUrl, setCustomWorkerUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('cf_api_url_override') || '';
    } catch {
      return '';
    }
  });
  const [isUrlSaved, setIsUrlSaved] = useState<boolean>(false);

  // Toast Notification Banner & Confirmation Dialog State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const addLog = useCallback((msg: string, type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [...prev.slice(-49), `[${time}] [${type}] ${msg}`]);
  }, []);

  // Global ⌘K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsMobileMoreOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounce catalog search query (250ms) and reset page to 1 when search changes
  const prevSearchRef = useRef(searchQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      if (prevSearchRef.current !== searchQuery) {
        prevSearchRef.current = searchQuery;
        setCatalogPage(1);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when status, language, or sort changes
  const prevFiltersRef = useRef({ filterStatus, filterLanguage, sortBy });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.filterStatus !== filterStatus ||
      prev.filterLanguage !== filterLanguage ||
      prev.sortBy !== sortBy
    ) {
      prevFiltersRef.current = { filterStatus, filterLanguage, sortBy };
      setCatalogPage(1);
    }
  }, [filterStatus, filterLanguage, sortBy]);

  // Persist catalog URL query params while browsing /admin so back-navigation from Editor restores state
  useEffect(() => {
    if (typeof window === 'undefined' || activeTab === 'editor') return;
    const params = new URLSearchParams();
    if (activeTab && activeTab !== 'overview') params.set('tab', activeTab);
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (filterStatus && filterStatus !== 'All') params.set('status', filterStatus);
    if (filterLanguage && filterLanguage !== 'All') params.set('lang', filterLanguage);
    if (sortBy && sortBy !== 'id_desc') params.set('sort', sortBy);
    if (catalogPage > 1) params.set('page', String(catalogPage));
    const qs = params.toString();
    const targetUrl = qs ? `/admin?${qs}` : '/admin';
    if (
      window.location.pathname === '/admin' &&
      `${window.location.pathname}${window.location.search}` !== targetUrl
    ) {
      window.history.replaceState(null, '', targetUrl);
    }
  }, [activeTab, debouncedSearch, filterStatus, filterLanguage, sortBy, catalogPage]);

  // 1. Server-Side Paginated D1 Catalog Loader with AbortController cancellation
  const fetchPaginatedAdminCatalog = useCallback(
    async (pageToLoad: number = catalogPage) => {
      if (catalogAbortRef.current) {
        catalogAbortRef.current.abort();
      }
      const controller = new AbortController();
      catalogAbortRef.current = controller;

      setIsCatalogLoading(true);
      setCatalogError(null);

      try {
        const res = await cloudflareApi.fetchCatalog({
          page: pageToLoad,
          limit: catalogPageSize,
          search: debouncedSearch || undefined,
          status: filterStatus !== 'All' ? filterStatus : undefined,
          language: filterLanguage !== 'All' ? filterLanguage : undefined,
          sort: sortBy,
          includePending: true,
          fresh: true,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (res.ok) {
          setCatalogItems(res.data || []);
          setCatalogTotalItems(res.meta.totalItems);
          setCatalogTotalPages(res.meta.totalPages);
        } else {
          setCatalogError(res.error || 'Failed to load catalog page from Cloudflare D1.');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setCatalogError(err?.message || 'Unable to query D1 catalog.');
      } finally {
        if (!controller.signal.aborted) {
          setIsCatalogLoading(false);
        }
      }
    },
    [catalogPage, catalogPageSize, debouncedSearch, filterStatus, filterLanguage, sortBy]
  );

  useEffect(() => {
    if (!isClerkAdminAuthorized) return;
    void fetchPaginatedAdminCatalog(catalogPage);
    return () => {
      catalogAbortRef.current?.abort();
    };
  }, [isClerkAdminAuthorized, catalogPage, fetchPaginatedAdminCatalog]);

  // Load lightweight full index only when Data Health, Translations, or Backup tabs need it
  const fetchFullIndexForTools = useCallback(async () => {
    try {
      const idx = await cloudflareApi.fetchCatalogIndex(true);
      if (Array.isArray(idx) && idx.length > 0) {
        setFullAdminIndex(idx);
      }
    } catch {
      // Fallback to catalogItems
    }
  }, []);

  useEffect(() => {
    if (
      isClerkAdminAuthorized &&
      (activeTab === 'overview' ||
        activeTab === 'data_health' ||
        activeTab === 'imdb_checker' ||
        activeTab === 'translations' ||
        activeTab === 'backup' ||
        activeTab === 'franchises' ||
        activeTab === 'cast')
    ) {
      void fetchFullIndexForTools();
    }
  }, [isClerkAdminAuthorized, activeTab, fetchFullIndexForTools]);

  // 2. Fetch Pending Submissions (Never auto-populating false default dub languages!)
  const fetchPendingItems = useCallback(async () => {
    try {
      const list = await cloudflareApi.fetchPendingItems();
      if (Array.isArray(list)) {
        const formatted = list.map((item: any) => {
          const parsedLangs = Array.isArray(item.languages)
            ? item.languages.filter(Boolean)
            : typeof item.languages === 'string' && item.languages.trim()
              ? item.languages
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [];
          return {
            ...item,
            id: item.id,
            title: item.title || 'Untitled Anime',
            languages: parsedLangs,
            platform: item.platform || item.streamingPlatform || 'Unverified',
            submittedBy: item.submitted_by || item.submittedBy || 'Community User',
            date: item.created_at
              ? new Date(item.created_at).toLocaleDateString()
              : item.date || 'Just now',
            poster:
              item.cover_image ||
              item.poster ||
              item.posterUrl ||
              'https://picsum.photos/seed/pending/100/150',
            status: 'pending',
          };
        });
        setPendingItems(formatted);
      }
    } catch (err) {
      console.warn('Error fetching pending anime:', err);
    }
  }, []);

  // 3. Fetch User Feedback Tickets
  const fetchFeedbackItems = useCallback(async () => {
    try {
      const fb = await cloudflareApi.fetchFeedback();
      if (Array.isArray(fb)) {
        setFeedbackList(
          fb.map((f) => ({
            ...f,
            status:
              f.status === 'in_progress' || f.status === 'resolved'
                ? f.status
                : ('open' as FeedbackStatus),
          }))
        );
      }
    } catch (err) {
      console.warn('Error fetching feedback:', err);
    }
  }, []);

  // 4. Fetch D1 Diagnostics & Status Summary (/api/cloudflare/status)
  const fetchD1StatusSummary = useCallback(async () => {
    setIsTestingApi(true);
    try {
      const cf = await cloudflareApi.fetchCloudflareStatus();
      if (cf) {
        setCfStatus(cf);
        addLog(
          `D1 connected via /api/cloudflare/status (${cf.services?.d1?.recordsCount ?? 0} total rows, ${cf.services?.d1?.latencyMs ?? 12}ms).`,
          'SUCCESS'
        );
      }
    } catch (err: any) {
      addLog(`D1 status probe error: ${err?.message || 'Unknown error'}`, 'ERROR');
    } finally {
      setIsTestingApi(false);
    }
  }, [addLog]);

  // 5. Verify Clerk Admin Session on Mount & Hydrate Admin Workspace
  useEffect(() => {
    let cancelled = false;

    const verifyAndHydrate = async () => {
      if (!isSignedIn) {
        setServerVerifiedAdmin(false);
        return;
      }

      try {
        const token = (await getToken()) || (await getClerkSessionToken());
        const verifyRes = await fetch(getCloudflareUrl('/api/admin/verify'), {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (cancelled) return;

        if (!verifyRes.ok) {
          setServerVerifiedAdmin(false);
          onLogout?.();
          return;
        }
        setServerVerifiedAdmin(true);
      } catch {
        if (!cancelled) {
          setServerVerifiedAdmin(Boolean(clerkUser && isAuthorizedClerkAdmin(clerkUser)));
        }
      }

      if (cancelled) return;

      await Promise.all([
        fetchPendingItems(),
        fetchFeedbackItems(),
        fetchD1StatusSummary(),
        cloudflareApi
          .fetchTelegramStatus()
          .then((tg) => {
            if (!cancelled && tg) setTgStatus(tg);
          })
          .catch(() => {}),
      ]);
    };

    void verifyAndHydrate();
    return () => {
      cancelled = true;
    };
  }, [
    isSignedIn,
    clerkUser,
    getToken,
    onLogout,
    fetchPendingItems,
    fetchFeedbackItems,
    fetchD1StatusSummary,
  ]);

  // 6. Safe Non-Destructive Feedback Status Workflow (Open -> In Progress -> Resolved)
  const handleUpdateFeedbackStatus = async (
    id: number | string,
    nextStatus: FeedbackStatus
  ) => {
    setUpdatingFeedbackId(id);
    setFeedbackError(null);
    try {
      const res = await cloudflareApi.updateFeedbackStatus(id, nextStatus);
      if (!res.success) {
        const errText =
          res.error ||
          `Failed to update Ticket #${id} status. The ticket remains unchanged.`;
        setFeedbackError(errText);
        showToast(errText, 'error');
        return;
      }

      setFeedbackList((prev) =>
        prev.map((item) =>
          String(item.id) === String(id)
            ? { ...item, status: res.status || nextStatus }
            : item
        )
      );
      const label =
        nextStatus === 'resolved'
          ? 'Resolved'
          : nextStatus === 'in_progress'
            ? 'In Progress'
            : 'Open';
      showToast(`Ticket #${id} marked as ${label}.`, 'success');
      void fetchD1StatusSummary();
    } catch (err: any) {
      const errText =
        err?.message ||
        `Network error while updating Ticket #${id}. The ticket remains visible.`;
      setFeedbackError(errText);
      showToast(errText, 'error');
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  // 7. Safe Non-Destructive Local Cache Refresh (Never resets or drops D1 tables!)
  const handleRefreshLocalCache = useCallback(() => {
    try {
      localStorage.removeItem('cf_admin_catalog_cache');
      localStorage.removeItem('cf_admin_pending_cache');
    } catch {}
    cloudflareApi.clearCatalogIndexCache();
    void fetchPaginatedAdminCatalog(1);
    void fetchPendingItems();
    void fetchFeedbackItems();
    void fetchD1StatusSummary();
    showToast('Local admin cache refreshed and re-synced with Cloudflare D1.', 'success');
  }, [
    fetchPaginatedAdminCatalog,
    fetchPendingItems,
    fetchFeedbackItems,
    fetchD1StatusSummary,
    showToast,
  ]);

  // 8. Real D1 Overview Stats (Never attributing empty-language anime to Hindi/Tamil/Telugu!)
  const overviewStats: AdminOverviewStats = useMemo(
    () =>
      computeAdminOverviewStats({
        cfStatus,
        fullAdminIndex,
        catalogItems,
        catalogTotalItems,
        pendingItems,
        feedbackList,
      }),
    [cfStatus, fullAdminIndex, catalogItems, catalogTotalItems, pendingItems, feedbackList]
  );

  // 9. Data Health Report
  const dataHealthPool = useMemo(
    () => (fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems),
    [fullAdminIndex, catalogItems]
  );

  const dataHealthReport = useMemo(() => {
    const audited = dataHealthPool
      .map((anime) => auditAnimeDataHealth(anime))
      .filter((r) => !r.isHealthy);

    const counts = {
      all: audited.length,
      missing_stream_links: audited.filter((r) =>
        r.issues.some((i) => i.code === 'missing_stream_links')
      ).length,
      missing_dub_langs: audited.filter((r) =>
        r.issues.some((i) => i.code === 'missing_dub_langs')
      ).length,
      missing_episode_counts: audited.filter((r) =>
        r.issues.some((i) => i.code === 'missing_episode_counts')
      ).length,
      unverified_metadata: audited.filter((r) =>
        r.issues.some((i) => i.code === 'unverified_metadata')
      ).length,
      incomplete_schedule: audited.filter((r) =>
        r.issues.some((i) => i.code === 'incomplete_schedule')
      ).length,
      healthyCount: Math.max(0, dataHealthPool.length - audited.length),
    };

    const filtered =
      healthFilter === 'all'
        ? audited
        : audited.filter((r) => r.issues.some((i) => i.code === healthFilter));

    return { items: filtered, summary: counts };
  }, [dataHealthPool, healthFilter]);

  // 10. Official OTT Link Checker
  const handleRunLinkCheck = async () => {
    setIsCheckingLinks(true);
    try {
      const report = await cloudflareApi.checkAdminLinks({ limit: 25 });
      setLinkCheckReport(report);
      if (report.success && report.summary) {
        showToast(
          `Checked ${report.summary.total} official links: ${report.summary.active} healthy, ${report.summary.broken} broken.`,
          report.summary.broken > 0 ? 'error' : 'success'
        );
      } else if (report.error) {
        showToast(report.error, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Link health check failed', 'error');
    } finally {
      setIsCheckingLinks(false);
    }
  };

  // 11. Pending Moderation Actions
  const handleApprove = async (id: number | string, explicitStatus?: string) => {
    const itemToApprove = pendingItems.find((item) => String(item.id) === String(id));
    if (!itemToApprove) return;
    try {
      const targetStatus =
        explicitStatus && explicitStatus.toLowerCase() !== 'pending'
          ? explicitStatus
          : itemToApprove.airing_status && String(itemToApprove.airing_status).toLowerCase() !== 'pending'
            ? itemToApprove.airing_status
            : itemToApprove.status && String(itemToApprove.status).toLowerCase() !== 'pending'
              ? itemToApprove.status
              : itemToApprove.type === 'Movie'
                ? 'Completed'
                : 'Airing';

      const res: any = await cloudflareApi.approveAnime(id, targetStatus);
      if (!res || res.success === false) {
        throw new Error(res?.error || 'Server rejected approval');
      }

      setPendingItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
      showToast(`Approved "${itemToApprove.title}" and published to live D1 catalog!`, 'success');
      void fetchPendingItems();
      void fetchPaginatedAdminCatalog(catalogPage);
      void fetchFullIndexForTools();
      void fetchD1StatusSummary();
      onAnimeCreated?.({
        ...itemToApprove,
        status: targetStatus,
        approval_status: 'approved',
        submissionStatus: 'approved',
        is_published: 1,
      });
    } catch (err: any) {
      showToast(`Failed to approve: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleBulkApprove = async (ids: Array<number | string>) => {
    if (!ids || ids.length === 0) return;
    let approvedCount = 0;
    for (const id of ids) {
      const item = pendingItems.find((p) => String(p.id) === String(id));
      const targetStatus =
        item?.airing_status && String(item.airing_status).toLowerCase() !== 'pending'
          ? item.airing_status
          : item?.status && String(item.status).toLowerCase() !== 'pending'
            ? item.status
            : item?.type === 'Movie'
              ? 'Completed'
              : 'Airing';
      try {
        const res: any = await cloudflareApi.approveAnime(id, targetStatus);
        if (res && res.success !== false) {
          approvedCount++;
        }
      } catch {}
    }
    await fetchPendingItems();
    await fetchPaginatedAdminCatalog(catalogPage);
    void fetchFullIndexForTools();
    void fetchD1StatusSummary();
    onAnimeCreated?.();
    if (approvedCount > 0) {
      showToast(`Approved ${approvedCount} anime title(s) to live D1 catalog!`, 'success');
    } else {
      showToast('Failed to approve selected pending items.', 'error');
    }
  };

  const handleReject = async (
    id: number | string,
    options?: { reasonPreset?: string; moderatorNote?: string }
  ) => {
    try {
      const res: any = await cloudflareApi.rejectAnime(id, options);
      if (!res || res.success === false) {
        throw new Error(res?.error || 'Server rejected deletion');
      }
      setPendingItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
      showToast('Rejected pending submission.', 'success');
      void fetchD1StatusSummary();
    } catch (err: any) {
      showToast(`Failed to reject submission: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  // 12. Catalog Row & Bulk Actions
  const handleToggleVisibility = async (anime: any) => {
    const currentlyPublished =
      anime.is_published !== 0 && anime.is_published !== false && anime.status !== 'pending';
    const nextPublished = currentlyPublished ? 0 : 1;
    try {
      const updated = await cloudflareApi.updateAnime(anime.id, {
        ...anime,
        is_published: nextPublished,
      });
      setCatalogItems((prev) =>
        prev.map((a) => (String(a.id) === String(anime.id) ? { ...a, ...updated, is_published: nextPublished } : a))
      );
      showToast(
        nextPublished ? `"${anime.title}" is now Published.` : `"${anime.title}" is now Hidden.`,
        'success'
      );
      onAnimeCreated?.(updated);
    } catch (err: any) {
      showToast(`Visibility update failed: ${err?.message}`, 'error');
    }
  };

  const handleDeleteCatalogAnime = (id: number, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Catalog Title',
      message: `Are you sure you want to remove "${title}" (#${id}) from the live catalog?`,
      confirmLabel: 'Delete Title',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await cloudflareApi.deleteAnime(id);
          setCatalogItems((prev) => prev.filter((a) => Number(a.id) !== Number(id)));
          setCatalogTotalItems((prev) => Math.max(0, prev - 1));
          onAnimeCreated?.(undefined, id);
          showToast(`Deleted "${title}" from catalog.`, 'success');
          void fetchD1StatusSummary();
        } catch (err: any) {
          showToast(`Failed to delete "${title}": ${err?.message || 'Error'}`, 'error');
        }
      },
    });
  };

  const handleToggleSelectCatalog = (id: number) => {
    setSelectedCatalogIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllCatalog = () => {
    if (selectedCatalogIds.length === catalogItems.length) {
      setSelectedCatalogIds([]);
    } else {
      setSelectedCatalogIds(catalogItems.map((a) => Number(a.id)));
    }
  };

  const handleBulkUpdateStatus = async (newStatus: string) => {
    if (selectedCatalogIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      for (const id of selectedCatalogIds) {
        const target = catalogItems.find((a) => Number(a.id) === id);
        if (target) {
          await cloudflareApi.updateAnime(id, { ...target, status: newStatus });
        }
      }
      showToast(`Updated ${selectedCatalogIds.length} titles to "${newStatus}"!`, 'success');
      setSelectedCatalogIds([]);
      await fetchPaginatedAdminCatalog(catalogPage);
      onAnimeCreated?.();
    } catch (err: any) {
      showToast(`Bulk status update failed: ${err?.message}`, 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAssignLanguage = async () => {
    if (selectedCatalogIds.length === 0 || !bulkLanguage) return;
    setIsBulkProcessing(true);
    try {
      for (const id of selectedCatalogIds) {
        const target = catalogItems.find((a) => Number(a.id) === id);
        if (target) {
          const currentLangs = Array.isArray(target.languages)
            ? target.languages.filter(Boolean)
            : typeof target.languages === 'string' && target.languages.trim()
              ? target.languages.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];
          if (!currentLangs.includes(bulkLanguage)) {
            const nextLangs = [...currentLangs, bulkLanguage];
            await cloudflareApi.updateAnime(id, {
              ...target,
              languages: nextLangs.join(', '),
            });
          }
        }
      }
      showToast(`Added ${bulkLanguage} dub tag to ${selectedCatalogIds.length} titles!`, 'success');
      setSelectedCatalogIds([]);
      await fetchPaginatedAdminCatalog(catalogPage);
      void fetchD1StatusSummary();
      onAnimeCreated?.();
    } catch (err: any) {
      showToast(`Bulk language update failed: ${err?.message}`, 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkToggleVisibility = async (publish: boolean) => {
    if (selectedCatalogIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      for (const id of selectedCatalogIds) {
        const target = catalogItems.find((a) => Number(a.id) === id);
        if (target) {
          await cloudflareApi.updateAnime(id, { ...target, is_published: publish ? 1 : 0 });
        }
      }
      showToast(
        `${publish ? 'Published' : 'Unpublished'} ${selectedCatalogIds.length} titles!`,
        'success'
      );
      setSelectedCatalogIds([]);
      await fetchPaginatedAdminCatalog(catalogPage);
      void fetchD1StatusSummary();
      onAnimeCreated?.();
    } catch (err: any) {
      showToast(`Bulk visibility update failed: ${err?.message}`, 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkMarkVerified = async () => {
    if (selectedCatalogIds.length === 0) return;
    setIsBulkProcessing(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      for (const id of selectedCatalogIds) {
        const target = catalogItems.find((a) => Number(a.id) === id);
        if (target) {
          await cloudflareApi.updateAnime(id, { ...target, last_verified_at: today });
        }
      }
      showToast(`Stamped verification date (${today}) on ${selectedCatalogIds.length} titles!`, 'success');
      setSelectedCatalogIds([]);
      await fetchPaginatedAdminCatalog(catalogPage);
      void fetchD1StatusSummary();
      onAnimeCreated?.();
    } catch (err: any) {
      showToast(`Bulk verification failed: ${err?.message}`, 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDeleteSelected = () => {
    if (selectedCatalogIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Selected Titles',
      message: `Are you sure you want to remove ${selectedCatalogIds.length} selected anime from the live catalog?`,
      confirmLabel: `Delete ${selectedCatalogIds.length} Titles`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsBulkProcessing(true);
        try {
          for (const id of selectedCatalogIds) {
            await cloudflareApi.deleteAnime(id);
          }
          showToast(`Deleted ${selectedCatalogIds.length} selected titles.`, 'success');
          setSelectedCatalogIds([]);
          await fetchPaginatedAdminCatalog(1);
          void fetchD1StatusSummary();
          onAnimeCreated?.();
        } catch (err: any) {
          showToast(`Bulk delete failed: ${err?.message}`, 'error');
        } finally {
          setIsBulkProcessing(false);
        }
      },
    });
  };

  // 13. Add / Edit Submit Handler (Avoids double-posting when DubInfoModal already persisted to D1)
  const handleAddOrEditAnime = async (newAnimeData: any) => {
    try {
      const isEditing = Boolean(editingAnime && editingAnime.id);
      const isPendingItem = Boolean(
        editingAnime &&
          (editingAnime.status === 'pending' ||
            pendingItems.some((p) => String(p.id) === String(editingAnime.id)))
      );

      let savedAnime = newAnimeData;
      if (!newAnimeData?._savedToServer) {
        const savedRes: any = isEditing
          ? await cloudflareApi.updateAnime(editingAnime.id, {
              ...newAnimeData,
              status: isPendingItem ? 'pending' : newAnimeData.status || editingAnime.status,
              is_published: isPendingItem ? 0 : 1,
            })
          : await cloudflareApi.createAnime(newAnimeData);
        savedAnime = savedRes?.data || savedRes || newAnimeData;
      }

      if (isEditing && isPendingItem) {
        setPendingItems((prev) =>
          prev.map((item) =>
            String(item.id) === String(editingAnime.id)
              ? { ...item, ...savedAnime, id: editingAnime.id }
              : item
          )
        );
      } else {
        onAnimeCreated?.(savedAnime);
      }

      setEditingAnime(null);
      setIsAddModalOpen(false);
      await fetchPaginatedAdminCatalog(catalogPage);
      void fetchD1StatusSummary();
      showToast(
        isEditing
          ? `Saved changes to "${savedAnime.title || newAnimeData.title}".`
          : `Added "${savedAnime.title || newAnimeData.title}" to D1 catalog!`,
        'success'
      );
    } catch (error: any) {
      showToast(error?.message || 'Failed to save anime to D1.', 'error');
      throw error;
    }
  };

  // 14. Settings & Diagnostics Handlers
  const handleExecuteD1Query = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecutingQuery(true);
    try {
      const res = await cloudflareApi.executeD1Query({
        table: d1Table,
        animeId: d1AnimeId.trim() ? d1AnimeId.trim() : undefined,
        title: d1TitleSearch.trim() ? d1TitleSearch.trim() : undefined,
        limit: d1Limit,
      });
      setD1QueryResult(res);
    } catch (err: any) {
      setD1QueryResult({ error: err?.message || 'Failed to execute query' });
    } finally {
      setIsExecutingQuery(false);
    }
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTg(true);
    try {
      const res = await cloudflareApi.updateTelegramSettings({
        token: tgToken,
        chatId: tgChatId,
      });
      if (res.success) {
        setTgStatus({
          configured: Boolean(tgToken && tgChatId),
          botTokenSet: Boolean(tgToken),
          chatIdSet: Boolean(tgChatId),
        });
        showToast(res.message || 'Telegram Bot settings saved!', 'success');
      } else {
        showToast(res.error || 'Failed to save settings', 'error');
      }
    } catch {
      showToast('Network error while saving Telegram settings', 'error');
    } finally {
      setIsSavingTg(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTg(true);
    try {
      const res = await cloudflareApi.testTelegram({
        token: tgToken || undefined,
        chatId: tgChatId || undefined,
      });
      if (res.success) {
        showToast(res.message || 'Test alert sent to your Telegram!', 'success');
      } else {
        showToast(res.error || 'Failed to send test alert.', 'error');
      }
    } catch {
      showToast('Error testing Telegram bot connection', 'error');
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleSaveWorkerUrl = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (customWorkerUrl.trim()) {
        localStorage.setItem('cf_api_url_override', customWorkerUrl.trim());
      } else {
        localStorage.removeItem('cf_api_url_override');
      }
    } catch {}
    setIsUrlSaved(true);
    window.setTimeout(() => setIsUrlSaved(false), 3000);
    showToast(
      customWorkerUrl.trim()
        ? `Connected to Worker URL: ${customWorkerUrl.trim()}`
        : 'Reset to default same-origin (/api/anime) endpoint',
      'success'
    );
    void fetchD1StatusSummary();
  };

  const handleResetWorkerUrl = () => {
    setCustomWorkerUrl('');
    try {
      localStorage.removeItem('cf_api_url_override');
    } catch {}
    showToast('Reset to same-origin /api/anime routing.', 'success');
    void fetchD1StatusSummary();
  };

  // 15. CSV Import / Export & SQL Dump Handlers
  const handleDownloadSampleCSV = () => {
    const sampleHeaders = 'Title,Poster URL,Synopsis,Rating,Release Year,Status,Type,Studio,Genres,Languages,Platforms,Episodes,Season';
    const sampleRow = 'Solo Leveling,https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png,"In a world where hunters must battle deadly monsters to protect humanity, Sung Jinwoo finds a mysterious program.",8.8,2024,Airing,TV Series,A-1 Pictures,Action | Adventure | Fantasy,Tamil | Hindi | Telugu,Prime Video|Netflix,12 | 13,Winter 2024';
    downloadTextBlob([sampleHeaders, sampleRow].join('\n'), 'anidub_sample_template.csv');
    showToast('Downloaded sample CSV template!', 'success');
  };

  const handleExportCSV = () => {
    const exportList = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;
    if (exportList.length === 0) return showToast('No catalog items loaded to export.', 'error');
    downloadTextBlob(buildCatalogExportCsv(exportList), `anidub_catalog_export_${new Date().toISOString().slice(0, 10)}.csv`);
    showToast(`Exported ${exportList.length} anime titles to CSV!`, 'success');
  };

  const handleExportSQL = () => {
    const exportList = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;
    if (exportList.length === 0) return showToast('No catalog items loaded to export.', 'error');
    downloadTextBlob(buildCatalogExportSql(exportList), `anidub_d1_backup_${new Date().toISOString().slice(0, 10)}.sql`, 'application/sql;charset=utf-8;');
    showToast(`Exported ${exportList.length} titles as D1 SQL Dump!`, 'success');
  };

  const runCsvTextDryRun = async (rawCsvText: string) => {
    setIsUploadingCsv(true);
    try {
      const parsed = parseCsvTextToAnimeRows(rawCsvText);
      if (parsed.error || parsed.rows.length === 0) {
        showToast(parsed.error || 'Could not find valid anime rows in CSV.', 'error');
        return;
      }
      const parsedItems = parsed.rows;
      setStagedCsvRows(parsedItems);
      try {
        const dryRes = await cloudflareApi.dryRunImportCsv(parsedItems);
        if (dryRes && dryRes.report) {
          setCsvDryRunReport(dryRes.report);
          setBackupFocusSection('csv');
          setActiveTab('backup');
          showToast(`Dry-Run Complete: ${dryRes.report.validCount} valid, ${dryRes.report.duplicateCount} duplicates, ${dryRes.report.invalidCount} errors. Review before committing.`, 'success');
          return;
        }
      } catch {
        const existingSource = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;
        const localDryReport = validateCsvDryRunRows(parsedItems, existingSource);
        setCsvDryRunReport(localDryReport);
        setBackupFocusSection('csv');
        setActiveTab('backup');
        showToast(`Dry-Run Complete: ${localDryReport.validCount} valid, ${localDryReport.duplicateCount} duplicates, ${localDryReport.invalidCount} errors.`, 'success');
        return;
      }
    } catch (err: any) {
      showToast(`CSV Dry-Run Failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleDownloadFailedCsvRows = () => {
    const failed = csvImportResult?.failedRows || [];
    if (failed.length === 0) return;
    downloadTextBlob(buildFailedCsvRowsString(failed), `anidub_failed_csv_rows_${failed.length}.csv`);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    const fileName = String(file.name || '').trim();
    if (!/\.csv$/i.test(fileName)) {
      const extErr = `Invalid file "${fileName || 'unknown'}". Please select a valid .csv file.`;
      setCsvUploadError(extErr);
      setCsvImportResult(null);
      showToast(extErr, 'error');
      inputEl.value = '';
      if (csvInputRef.current) csvInputRef.current.value = '';
      return;
    }

    setIsUploadingCsv(true);
    setCsvUploadError(null);
    setCsvImportResult(null);
    addLog(`Checking duplicates & importing CSV ("${fileName}")...`, 'INFO');

    try {
      const text = await file.text();
      const parsed = parseCsvTextToAnimeRows(text);
      if (parsed.rows.length === 0) {
        const parseErr = parsed.error || 'Could not find valid anime rows with a Title column in CSV.';
        setCsvUploadError(parseErr);
        addLog(`CSV parse error: ${parseErr}`, 'ERROR');
        showToast(parseErr, 'error');
        return;
      }

      const res = await cloudflareApi.uploadCSV({
        animeList: parsed.rows,
        totalRows: parsed.totalRows,
        invalidRows: parsed.invalidRows,
        errors: parsed.errors,
      });

      if (!res || res.success === false) {
        throw new Error(res?.error || res?.message || 'Server rejected CSV upload');
      }

      const addedToPending = Number(res.addedToPending ?? res.insertedCount ?? res.count ?? 0);
      const duplicateTitles = Array.isArray(res.duplicateTitles)
        ? res.duplicateTitles
        : Array.isArray(res.skippedTitles) ? res.skippedTitles : [];
      const skippedDuplicates = Number(res.skippedDuplicates ?? duplicateTitles.length ?? 0);
      const invalidRows = Number(res.invalidRows ?? parsed.invalidRows ?? 0);
      const totalRows = Number(res.totalRows ?? parsed.totalRows ?? parsed.rows.length);

      const summary: CsvImportSummaryResult = {
        fileName, totalRows, addedToPending, skippedDuplicates, duplicateTitles, invalidRows,
        errors: Array.isArray(res.errors) && res.errors.length > 0 ? res.errors : parsed.errors,
        failedRows: parsed.failedRows,
        timestamp: new Date().toLocaleTimeString(),
      };

      setCsvImportResult(summary);
      await fetchPendingItems();
      void fetchD1StatusSummary();
      addLog(`CSV Import complete: ${addedToPending} added to Pending Reviews, ${skippedDuplicates} duplicates skipped, ${invalidRows} invalid rows.`, 'SUCCESS');
      showToast(`CSV Import Complete: ${addedToPending} added to Pending Reviews, ${skippedDuplicates} duplicates skipped${invalidRows > 0 ? `, ${invalidRows} invalid rows` : ''}.`, 'success');
    } catch (err: any) {
      const errMsg = err?.message || 'Network or authentication error while importing CSV.';
      setCsvUploadError(errMsg);
      addLog(`CSV import failed: ${errMsg}`, 'ERROR');
      showToast(`CSV Import Failed: ${errMsg}`, 'error');
    } finally {
      setIsUploadingCsv(false);
      inputEl.value = '';
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleNormalizePlatforms = async () => {
    setIsNormalizingPlatforms(true);
    try {
      const res = await cloudflareApi.normalizeAdminPlatforms();
      addLog(`OTT Platform Normalizer scanned ${res.totalScanned} rows, standardized ${res.updatedCount} rows.`, 'SUCCESS');
      showToast(
        res.updatedCount > 0
          ? `Normalized OTT platform tags on ${res.updatedCount} anime title(s) (scanned ${res.totalScanned}).`
          : `All ${res.totalScanned} catalog OTT platform tags are already normalized.`,
        'success'
      );
      if (res.updatedCount > 0) {
        void fetchPaginatedAdminCatalog(catalogPage);
        void fetchFullIndexForTools();
      }
    } catch (err: any) {
      addLog(`Platform normalizer error: ${err?.message || 'Unknown error'}`, 'ERROR');
      showToast(err?.message || 'Platform normalization failed.', 'error');
    } finally {
      setIsNormalizingPlatforms(false);
    }
  };

  const handleCommitStagedCsv = async () => {
    if (stagedCsvRows.length === 0) return;
    setIsUploadingCsv(true);
    try {
      const res: any = await cloudflareApi.uploadCSV({ animeList: stagedCsvRows });
      if (res && res.success) {
        const addedCount = res.insertedCount ?? res.inserted ?? res.count ?? stagedCsvRows.length;
        setCsvDryRunReport(null);
        setStagedCsvRows([]);
        await fetchPendingItems();
        void fetchD1StatusSummary();
        setActiveTab('moderation');
        setModerationSubTab('pending');
        showToast(`Committed ${addedCount} valid titles into Pending Moderation queue!`, 'success');
      } else {
        showToast(res?.error || res?.message || 'Failed to commit CSV rows', 'error');
      }
    } catch (err: any) {
      showToast(`CSV Commit Failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleOpenModularEditor = useCallback(
    (anime: any | null, _targetTab: AnimeEditorTabId = 'identity') => {
      if (anime && anime.id !== undefined && anime.id !== null) {
        const richerMatch =
          catalogItems.find((item) => String(item.id) === String(anime.id)) ||
          pendingItems.find((item) => String(item.id) === String(anime.id));
        setEditingAnime(richerMatch ? { ...anime, ...richerMatch } : anime);
      } else {
        setEditingAnime(anime);
      }
      setIsAddModalOpen(true);
    },
    [catalogItems, pendingItems]
  );

  // STRICT CLERK ADMIN ROUTE GUARD (Production Enforced)
  if (!isClerkAdminAuthorized) {
    return (
      <div data-testid="admin-auth-gate" className="min-h-[75vh] flex items-center justify-center p-4 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)]">
            {t('admin.restrictedTitle', 'Admin Access Restricted')}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            Strict Clerk Admin authentication and verified administrator credentials are required to access the AniDub India Admin Workspace.
          </p>
          {onNavigateHome && (
            <button type="button" onClick={onNavigateHome} className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs sm:text-sm font-bold inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Return to Public Catalog
            </button>
          )}
        </div>
      </div>
    );
  }

  const effectiveTab: AdminActiveTab = activeTab === 'pending' || activeTab === 'feedback' ? 'moderation' : activeTab;

  const handleSelectNavTab = (tab: AdminActiveTab) => {
    if (tab === 'pending' || tab === 'moderation') {
      setActiveTab('moderation');
      setModerationSubTab('pending');
    } else if (tab === 'feedback') {
      setActiveTab('moderation');
      setModerationSubTab('feedback');
    } else {
      setActiveTab(tab);
    }
    if (typeof window !== 'undefined' && tab !== 'editor' && window.location.pathname.startsWith('/admin/catalog/')) {
      window.history.pushState(null, '', '/admin');
    }
    setIsMobileStudioOpen(false);
    setIsMobileMoreOpen(false);
  };

  const handleFilterCatalogByLanguage = (language: string) => {
    setFilterLanguage(language);
    setCatalogPage(1);
    setActiveTab('catalog');
  };

  const handleFilterCatalogByGenre = (genre: string) => {
    setSearchQuery(genre);
    setCatalogPage(1);
    setActiveTab('catalog');
  };

  const handleOpenBulkCsvUpload = () => {
    setBackupFocusSection('csv');
    handleSelectNavTab('backup');
  };

  const totalModerationBadge = overviewStats.pendingModerationCount + overviewStats.openFeedbackCount;

  const sidebarGroups: Array<{
    groupLabel: string;
    items: Array<{ id: AdminActiveTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }>;
  }> = [
    {
      groupLabel: 'Workspace',
      items: [
        { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
        { id: 'catalog', label: 'Anime Catalog', icon: Film, badge: overviewStats.publishedAnimeCount },
        { id: 'moderation', label: 'Pending & Feedback', icon: Clock, badge: totalModerationBadge > 0 ? totalModerationBadge : undefined },
        { id: 'translations', label: 'Translation Studio', icon: Languages },
        { id: 'franchises', label: 'Franchise Builder', icon: Layers },
        { id: 'cast', label: 'Cast & Voice Actors', icon: Mic2 },
      ],
    },
    {
      groupLabel: 'Operations & Tools',
      items: [
        { id: 'data_health', label: 'Data Health QA', icon: ShieldCheck, badge: dataHealthReport.summary.all > 0 ? dataHealthReport.summary.all : undefined },
        { id: 'imdb_checker', label: 'IMDb Ratings Checker', icon: Star },
        { id: 'analytics', label: 'Analytics 2.0', icon: BarChart3 },
      ],
    },
    {
      groupLabel: 'System',
      items: [
        { id: 'backup', label: 'Bulk CSV & Backup', icon: Upload },
        { id: 'settings', label: 'Telegram & Settings', icon: Settings },
      ],
    },
  ];

  return (
    <div data-testid="admin-workspace-shell" className="min-h-screen w-full max-w-full overflow-x-clip bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col lg:flex-row pb-20 lg:pb-0">
      <input type="file" accept=".csv,text/csv,text/plain,application/vnd.ms-excel" ref={csvInputRef} onChange={handleCsvUpload} data-testid="admin-csv-file-input" className="hidden" />

      {/* 1. DESKTOP COLLAPSIBLE 240PX SIDEBAR */}
      <aside
        data-testid="admin-desktop-sidebar"
        className={`hidden lg:flex flex-col shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 ${isSidebarCollapsed ? 'w-[72px]' : 'w-[240px]'}`}
      >
        <div className="h-[52px] px-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <img src="/logo.png" alt="AniDub India" className="w-6 h-6 rounded-md object-contain shrink-0" />
              <span className="text-sm font-extrabold text-[var(--text-primary)] truncate">AniDub Admin</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${overviewStats.d1Connected ? 'bg-emerald-500' : 'bg-amber-500'}`} title={overviewStats.d1Connected ? 'Cloudflare D1 Connected' : 'D1 Local Runtime'} />
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center mx-auto"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {sidebarGroups.map((group) => (
            <div key={group.groupLabel} className="space-y-1">
              {!isSidebarCollapsed && (
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                  {group.groupLabel}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = effectiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`admin-nav-${item.id}`}
                    onClick={() => handleSelectNavTab(item.id)}
                    title={item.label}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 transition-all ${
                      isActive ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${isActive ? 'bg-black/20 text-[var(--accent-on-primary,#fff)]' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--border-subtle)] space-y-1.5">
          <button type="button" data-testid="admin-diagnostics-trigger" onClick={() => setIsDiagnosticsOpen(true)} title="Open Diagnostics Drawer" className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-2.5 cursor-pointer">
            <Terminal className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            {!isSidebarCollapsed && <span>Diagnostics</span>}
          </button>
          {onNavigateHome && (
            <button type="button" onClick={onNavigateHome} title="Exit to Site" className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-2.5 cursor-pointer">
              <ExternalLink className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Exit to Site</span>}
            </button>
          )}
          {onLogout && (
            <button type="button" onClick={onLogout} title="Lock Admin" className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2.5 cursor-pointer">
              <LogOut className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Lock Admin</span>}
            </button>
          )}
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE COLUMN */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Classic Admin Command Console Top Bar */}
        <header
          data-testid="admin-top-bar"
          className="sticky top-0 z-30 min-h-[60px] px-3 sm:px-5 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md flex items-center justify-between gap-2"
        >
          {/* Left: Glowing dark rounded square badge with cyan lightning bolt icon + two-line "Admin Command / Console" */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => handleSelectNavTab('overview')}
              className="flex items-center gap-3 min-h-[44px] pr-1 cursor-pointer group text-left"
              aria-label="Admin Command Console Home"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#0e1526] border border-cyan-500/35 shadow-md shadow-cyan-500/15 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-sm sm:text-base font-black text-[var(--text-primary)] tracking-tight whitespace-nowrap">
                  Admin Command
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-black text-[var(--text-primary)] tracking-tight whitespace-nowrap">
                    Console
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      overviewStats.d1Connected ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    title={overviewStats.d1Connected ? 'D1 Live Connected' : 'D1 Local Runtime'}
                  />
                </div>
              </div>
            </button>
          </div>

          {/* Right: 4 Compact Rounded Icon Buttons (⌘ Command Palette, >_ Live Terminal, ↻ Refresh, [→ Icon-Only Exit) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="admin-quick-search-trigger"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-10 h-10 sm:w-auto sm:min-h-[40px] sm:px-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              aria-label="Command Palette (Ctrl+K)"
              title="Command Palette (Ctrl+K)"
            >
              <Command className="w-4 h-4 text-slate-300 shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Search</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-mono leading-none">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              data-testid="admin-topbar-terminal-btn"
              onClick={() => setIsDiagnosticsOpen((prev) => !prev)}
              className="relative w-10 h-10 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-cyan-400 inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
              aria-label="Open Live System Terminal"
              title="Live System Terminal (>_)"
            >
              <Terminal className="w-4 h-4 shrink-0" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80" />
            </button>

            <button
              type="button"
              data-testid="admin-topbar-refresh-btn"
              onClick={() => {
                void fetchPaginatedAdminCatalog(catalogPage);
                void fetchFullIndexForTools();
                void fetchD1StatusSummary();
                showToast('Synced live Cloudflare D1 records.', 'success');
              }}
              className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Refresh Live D1 Records"
              title="Refresh Live D1 Records"
            >
              <RefreshCw
                className={`w-4 h-4 shrink-0 ${isCatalogLoading ? 'animate-spin text-purple-400' : ''}`}
              />
            </button>

            <button
              type="button"
              data-testid="admin-theme-toggle"
              onClick={() => openAppearance('presets')}
              className="hidden sm:inline-flex min-w-[40px] min-h-[40px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] items-center justify-center cursor-pointer transition-colors"
              aria-label={`Switch Theme (${displayName})`}
              title={`Theme: ${displayName}`}
            >
              <Palette className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              data-testid="admin-header-add-anime-btn"
              onClick={() => handleOpenModularEditor(null, 'identity')}
              className="hidden sm:inline-flex min-h-[40px] px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors shadow-sm shadow-purple-600/25"
              aria-label="Add Anime"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add</span>
            </button>

            {onNavigateHome && (
              <button
                type="button"
                data-testid="admin-exit-to-site-btn"
                onClick={onNavigateHome}
                className="w-10 h-10 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-400 inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                aria-label="Exit to Site"
                title="Exit to Site"
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </button>
            )}
          </div>
        </header>

        {/* Horizontal Scrollable Command Console Tab Bar (Classic Flat Inactive & Soft Purple/Lavender Active Pill) */}
        <div
          data-testid="admin-quick-tab-bar"
          role="tablist"
          aria-label="Admin Command Console Tabs"
          className="w-full max-w-full overflow-x-auto no-scrollbar border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/85 px-2.5 sm:px-5 py-2 flex items-center gap-1.5"
        >
          {ADMIN_QUICK_PILL_TABS.map((tabItem) => {
            const isTabActive =
              (effectiveTab === tabItem.id ||
                (tabItem.id === 'catalog' && effectiveTab === 'editor')) &&
              (tabItem.id !== 'moderation' || moderationSubTab !== 'feedback');
            const displayLabel =
              tabItem.id === 'moderation'
                ? 'Pending Reviews'
                : tabItem.id === 'catalog'
                  ? 'Anime Catalog'
                  : tabItem.id === 'imdb_checker'
                    ? 'IMDb & Diagnostics'
                    : tabItem.id === 'analytics'
                      ? 'Edge Analytics'
                      : tabItem.id === 'settings'
                        ? 'Cloud Infrastructure'
                        : tabItem.label;
            const TabIcon =
              tabItem.id === 'overview'
                ? LayoutDashboard
                : tabItem.id === 'moderation'
                  ? Clock
                  : tabItem.id === 'catalog'
                    ? Film
                    : tabItem.id === 'imdb_checker'
                      ? Star
                      : tabItem.id === 'analytics'
                        ? BarChart3
                        : tabItem.id === 'settings'
                          ? Settings
                          : tabItem.id === 'backup'
                            ? Upload
                            : tabItem.id === 'data_health'
                              ? ShieldCheck
                              : tabItem.id === 'translations'
                                ? Languages
                                : tabItem.id === 'franchises'
                                  ? Layers
                                  : Mic2;
            const badgeCount =
              tabItem.id === 'moderation'
                ? pendingItems.length
                : tabItem.id === 'catalog'
                  ? overviewStats.totalAnimeCount
                  : tabItem.id === 'data_health'
                    ? dataHealthReport.summary.all
                    : 0;
            return (
              <React.Fragment key={tabItem.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isTabActive}
                  data-testid={`admin-quick-tab-${tabItem.id}`}
                  onClick={() => {
                    if (tabItem.id === 'moderation') {
                      setModerationSubTab('pending');
                    }
                    handleSelectNavTab(tabItem.id);
                  }}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 inline-flex items-center gap-2 transition-all cursor-pointer ${
                    isTabActive
                      ? 'bg-[#c084fc] text-[#090d16] shadow-md shadow-purple-500/20'
                      : 'bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{displayLabel}</span>
                  {badgeCount > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md font-mono tabular-nums text-[10px] font-black ${
                        isTabActive
                          ? 'bg-[#090d16]/15 text-[#090d16]'
                          : tabItem.id === 'moderation'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>

                {/* Place "User Feedback" 4th, immediately AFTER "Anime Catalog" (3rd) */}
                {tabItem.id === 'catalog' && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectiveTab === 'moderation' && moderationSubTab === 'feedback'}
                    data-testid="admin-quick-tab-user-feedback"
                    onClick={() => {
                      setModerationSubTab('feedback');
                      handleSelectNavTab('feedback');
                    }}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 inline-flex items-center gap-2 transition-all cursor-pointer ${
                      effectiveTab === 'moderation' && moderationSubTab === 'feedback'
                        ? 'bg-[#c084fc] text-[#090d16] shadow-md shadow-purple-500/20'
                        : 'bg-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>User Feedback</span>
                    {feedbackList.length > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-mono tabular-nums text-[10px] font-black ${
                          effectiveTab === 'moderation' && moderationSubTab === 'feedback'
                            ? 'bg-[#090d16]/15 text-[#090d16]'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {feedbackList.length}
                      </span>
                    )}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Active Workspace Section Content */}
        <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-4">
          {/* GLOBAL CSV UPLOAD STATUS / SUMMARY BANNER (When triggered outside Catalog tab) */}
          {effectiveTab !== 'catalog' && isUploadingCsv && (
            <div
              data-testid="global-csv-upload-loading-banner"
              className="p-3.5 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center gap-3 text-xs sm:text-sm font-bold text-purple-300"
            >
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
              <span>Checking duplicates &amp; importing CSV...</span>
            </div>
          )}

          {effectiveTab !== 'catalog' && csvUploadError && !isUploadingCsv && (
            <div
              data-testid="global-csv-upload-error-banner"
              className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-between gap-3 text-xs sm:text-sm text-red-300"
            >
              <span>
                <strong className="text-red-200">CSV Import Error:</strong> {csvUploadError}
              </span>
              <button
                type="button"
                onClick={() => setCsvUploadError(null)}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-bold text-red-200 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {effectiveTab !== 'catalog' && csvImportResult && !isUploadingCsv && (
            <div
              data-testid="global-csv-upload-summary-banner"
              className="p-4 rounded-xl bg-[#0e1628] border border-emerald-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
            >
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-extrabold text-white">
                  CSV Import Complete ({csvImportResult.fileName})
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-extrabold">
                    {csvImportResult.addedToPending} added to Pending Reviews
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-extrabold">
                    {csvImportResult.skippedDuplicates} duplicates skipped
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 text-xs font-extrabold">
                    {csvImportResult.invalidRows} invalid rows
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectNavTab('pending')}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold cursor-pointer"
                >
                  Open Pending Reviews ({csvImportResult.addedToPending})
                </button>
                <button
                  type="button"
                  onClick={() => setCsvImportResult(null)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* SECTION 1: COMMAND CENTER (OVERVIEW) */}
          {effectiveTab === 'overview' && (
            <AdminOverviewTab
              stats={overviewStats}
              pendingItems={pendingItems}
              feedbackList={feedbackList}
              onSetActiveTab={handleSelectNavTab}
              onOpenAddModal={() => handleOpenModularEditor(null, 'identity')}
              onFilterCatalogByLanguage={handleFilterCatalogByLanguage}
              onFilterCatalogByGenre={handleFilterCatalogByGenre}
              onApprovePending={handleApprove}
              onRejectPending={handleReject}
              onTriggerCsvUpload={triggerCsvFilePicker}
              onDownloadSampleCsv={handleDownloadSampleCSV}
              onOpenCsvHelp={() => setIsCsvHelpOpen(true)}
            />
          )}

          {/* SECTION 2: ANIME CATALOG */}
          {effectiveTab === 'catalog' && (
            <AdminCatalogTab
              mode="catalog"
              items={catalogItems}
              totalItems={catalogTotalItems}
              currentPage={catalogPage}
              totalPages={catalogTotalPages}
              pageSize={catalogPageSize}
              isLoading={isCatalogLoading}
              errorMsg={catalogError}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterLanguage={filterLanguage}
              setFilterLanguage={setFilterLanguage}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onPageChange={(nextPage) => setCatalogPage(nextPage)}
              onRefresh={() => void fetchPaginatedAdminCatalog(catalogPage)}
              onOpenAddModal={() => handleOpenModularEditor(null, 'identity')}
              onTriggerCsvUpload={triggerCsvFilePicker}
              onExportCsv={handleExportCSV}
              onOpenCsvHelp={() => setIsCsvHelpOpen(true)}
              isUploadingCsv={isUploadingCsv}
              csvUploadError={csvUploadError}
              csvImportResult={csvImportResult}
              onDismissCsvFeedback={() => {
                setCsvUploadError(null);
                setCsvImportResult(null);
              }}
              onOpenPendingReviews={() => handleSelectNavTab('pending')}
              onDownloadFailedCsvRows={handleDownloadFailedCsvRows}
              selectedCatalogIds={selectedCatalogIds}
              setSelectedCatalogIds={setSelectedCatalogIds}
              bulkLanguage={bulkLanguage}
              setBulkLanguage={setBulkLanguage}
              isBulkProcessing={isBulkProcessing}
              onSelectAllCatalog={handleSelectAllCatalog}
              onToggleSelectCatalog={handleToggleSelectCatalog}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkAssignLanguage={handleBulkAssignLanguage}
              onBulkToggleVisibility={handleBulkToggleVisibility}
              onBulkMarkVerified={handleBulkMarkVerified}
              onBulkDeleteSelected={handleBulkDeleteSelected}
              onToggleVisibility={handleToggleVisibility}
              onEditAnime={(anime) => handleOpenModularEditor(anime, 'identity')}
              onDeleteCatalogAnime={handleDeleteCatalogAnime}
            />
          )}

          {/* SECTION 3: WORKERS AI TRANSLATION STUDIO */}
          {effectiveTab === 'translations' && (
            <AdminTranslationsTab
              catalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              initialAnimeId={translationTargetAnimeId}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          )}

          {/* SECTION 4: ANIME UNIVERSE & SMART WATCH ORDER VISUAL BUILDER */}
          {effectiveTab === 'franchises' && (
            <AdminFranchiseBuilderTab
              catalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              initialFranchiseKey={franchiseTargetKey}
              onEditAnimeInEditor={(anime) => handleOpenModularEditor(anime, 'metadata')}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          )}

          {/* SECTION 5: CHARACTERS & VERIFIED INDIAN VOICE ACTOR MANAGER */}
          {effectiveTab === 'cast' && (
            <AdminCastManagerTab
              catalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              initialAnimeId={castTargetAnimeId}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          )}

          {/* SECTION 6: COMPACT PENDING & FEEDBACK */}
          {effectiveTab === 'moderation' && (
            <AdminModerationInboxTab
              pendingItems={pendingItems}
              existingCatalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              feedbackList={feedbackList}
              updatingFeedbackId={updatingFeedbackId}
              feedbackError={feedbackError}
              initialSubTab={moderationSubTab}
              onApproveAnime={handleApprove}
              onBulkApproveAnime={handleBulkApprove}
              onRejectAnime={handleReject}
              onEditPendingAnime={(anime) => handleOpenModularEditor(anime, 'identity')}
              onInspectExistingAnime={(animeId) => {
                const pool = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;
                const found = pool.find((a) => Number(a.id) === Number(animeId));
                if (found) {
                  handleOpenModularEditor(found, 'identity');
                } else {
                  setSearchQuery(String(animeId));
                  handleSelectNavTab('catalog');
                }
              }}
              onUpdateFeedbackStatus={handleUpdateFeedbackStatus}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          )}

          {/* SECTION 7: CATALOG DATA HEALTH & QA SCANNER */}
          {effectiveTab === 'data_health' && (
            <AdminDataHealthTab
              dataHealthReport={dataHealthReport}
              catalogList={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              healthFilter={healthFilter}
              setHealthFilter={setHealthFilter}
              onEditAnime={(anime, targetTab) =>
                handleOpenModularEditor(anime, targetTab || 'identity')
              }
              onJumpToFranchises={() => handleSelectNavTab('franchises')}
              onJumpToCast={() => handleSelectNavTab('cast')}
              onOpenImdbChecker={() => handleSelectNavTab('imdb_checker')}
              onNormalizePlatforms={() => void handleNormalizePlatforms()}
              isNormalizingPlatforms={isNormalizingPlatforms}
              linkCheckReport={linkCheckReport}
              isCheckingLinks={isCheckingLinks}
              onRunLinkCheck={handleRunLinkCheck}
            />
          )}

          {/* SECTION 7B: IMDb & EXTERNAL RATINGS CHECKER */}
          {effectiveTab === 'imdb_checker' && (
            <AdminImdbCheckerTab
              catalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
              onRatingsUpdated={() => {
                void fetchPaginatedAdminCatalog(catalogPage);
                void fetchFullIndexForTools();
                void fetchD1StatusSummary();
              }}
              terminalLogs={terminalLogs}
              onExpandTerminal={() => setIsDiagnosticsOpen(true)}
              d1LatencyMs={overviewStats.d1LatencyMs}
            />
          )}

          {/* SECTION 8: ACTIONABLE ADMIN ANALYTICS 2.0 (Lazy Loaded) */}
          {effectiveTab === 'analytics' && (
            <Suspense fallback={<AdminSkeleton />}>
              <AnalyticsDashboard
                onNavigateHome={onNavigateHome}
                onSelectAnimeSlug={(slug) => {
                  setSearchQuery(slug);
                  setActiveTab('catalog');
                }}
                onAddMissingAnimeTitle={(missingTitle) => {
                  handleOpenModularEditor({ title: missingTitle }, 'identity');
                }}
                onJumpToDataHealth={(filterKey) => {
                  if (filterKey) {
                    setHealthFilter(filterKey as DataHealthFilter);
                  }
                  handleSelectNavTab('data_health');
                }}
                onJumpToDubsMatrix={() => handleFilterCatalogByLanguage('Unverified')}
              />
            </Suspense>
          )}

          {/* SECTION 9: FULL BACKUP & BULK CSV UPLOAD CENTER */}
          {effectiveTab === 'backup' && (
            <AdminBackupCenterTab
              onFallbackExportCsv={handleExportCSV}
              onExportSql={handleExportSQL}
              onTriggerCsvUpload={triggerCsvFilePicker}
              onDryRunPastedCsv={(csvText) => void runCsvTextDryRun(csvText)}
              initialFocusSection={backupFocusSection}
              isUploadingCsv={isUploadingCsv}
              csvDryRunReport={csvDryRunReport}
              onCancelCsvDryRun={() => {
                setCsvDryRunReport(null);
                setStagedCsvRows([]);
              }}
              onCommitStagedCsv={handleCommitStagedCsv}
              onOpenCsvHelp={() => setIsCsvHelpOpen(true)}
              onDownloadSampleCsv={handleDownloadSampleCSV}
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {/* SECTION 10: SETTINGS / CLOUD INFRASTRUCTURE */}
          {effectiveTab === 'settings' && (
            <AdminSettingsTab
              tgStatus={tgStatus}
              tgToken={tgToken}
              setTgToken={setTgToken}
              tgChatId={tgChatId}
              setTgChatId={setTgChatId}
              isSavingTg={isSavingTg}
              isTestingTg={isTestingTg}
              onSaveTelegram={handleSaveTelegram}
              onTestTelegram={handleTestTelegram}
              customWorkerUrl={customWorkerUrl}
              setCustomWorkerUrl={setCustomWorkerUrl}
              isUrlSaved={isUrlSaved}
              onSaveWorkerUrl={handleSaveWorkerUrl}
              onResetWorkerUrl={handleResetWorkerUrl}
              onRefreshLocalCache={handleRefreshLocalCache}
              onOpenDiagnosticsDrawer={() => setIsDiagnosticsOpen(true)}
              onExportCsv={handleExportCSV}
            />
          )}
        </div>
      </div>

      {/* 3. DEDICATED ADMIN MOBILE 5-TAB BOTTOM NAVIGATION BAR & SHEETS */}
      <AdminMobileNav
        effectiveTab={effectiveTab}
        totalModerationBadge={totalModerationBadge}
        isMobileStudioOpen={isMobileStudioOpen}
        setIsMobileStudioOpen={setIsMobileStudioOpen}
        isMobileMoreOpen={isMobileMoreOpen}
        setIsMobileMoreOpen={setIsMobileMoreOpen}
        onSelectNavTab={handleSelectNavTab}
        onOpenBulkCsvUpload={handleOpenBulkCsvUpload}
        onOpenBackupCenter={() => {
          setBackupFocusSection('backup');
          handleSelectNavTab('backup');
        }}
        onOpenDiagnostics={() => {
          setIsMobileMoreOpen(false);
          setIsDiagnosticsOpen(true);
        }}
        onLogout={onLogout}
      />

      {/* 4. OPTIONAL COLLAPSIBLE DIAGNOSTICS / TERMINAL HUD DRAWER */}
      <AdminTerminalHud
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        terminalLogs={terminalLogs}
        onClearLogs={() => setTerminalLogs([])}
        d1Table={d1Table}
        setD1Table={setD1Table}
        d1AnimeId={d1AnimeId}
        setD1AnimeId={setD1AnimeId}
        d1TitleSearch={d1TitleSearch}
        setD1TitleSearch={setD1TitleSearch}
        d1Limit={d1Limit}
        setD1Limit={setD1Limit}
        d1QueryResult={d1QueryResult}
        isExecutingQuery={isExecutingQuery}
        onExecuteD1Query={handleExecuteD1Query}
        onRunDiagnostics={() => void fetchD1StatusSummary()}
        isTestingApi={isTestingApi}
        cfStatus={cfStatus}
        onNormalizePlatforms={() => void handleNormalizePlatforms()}
        isNormalizingPlatforms={isNormalizingPlatforms}
      />

      {/* 4B. FLOATING BOTTOM-RIGHT ">_ SYS_TERM" PILL BUTTON (Hidden when any modal is open) */}
      {!isDiagnosticsOpen && !isAddModalOpen && !isCsvHelpOpen && !isCommandPaletteOpen && !confirmDialog?.isOpen && (
        <button
          type="button"
          data-testid="admin-floating-sys-term"
          onClick={() => setIsDiagnosticsOpen(true)}
          className="fixed bottom-20 lg:bottom-6 right-4 z-20 min-h-[40px] px-3.5 py-2 rounded-full bg-[#090d16]/95 hover:bg-[#0e1526] border border-cyan-500/40 text-cyan-300 text-xs font-mono font-extrabold shadow-xl shadow-cyan-500/15 flex items-center gap-2 cursor-pointer transition-all"
          title="Open Live System Terminal (>_ SYS_TERM)"
        >
          <span className="text-cyan-400 font-black">&gt;_</span>
          <span>SYS_TERM</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* 5. GLOBAL COMMAND PALETTE (⌘K) */}
      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        cmdQuery={cmdQuery}
        setCmdQuery={setCmdQuery}
        pendingCount={pendingItems.length}
        feedbackCount={overviewStats.openFeedbackCount}
        dataHealthCount={dataHealthReport.summary.all}
        onOpenAddModal={(prefillTitle) =>
          handleOpenModularEditor(prefillTitle ? { title: prefillTitle } : null, 'identity')
        }
        onSetActiveTab={handleSelectNavTab}
        onFilterUnverifiedDubs={() => handleFilterCatalogByLanguage('Unverified')}
        onExportCSV={handleExportCSV}
        onTriggerCsvUpload={triggerCsvFilePicker}
        onOpenCsvHelp={() => setIsCsvHelpOpen(true)}
        onDownloadSampleCsv={handleDownloadSampleCSV}
        onSyncLiveRecords={() => {
          void fetchPaginatedAdminCatalog(catalogPage);
          void fetchFullIndexForTools();
          void fetchD1StatusSummary();
        }}
        onRunDiagnostics={() => setIsDiagnosticsOpen(true)}
        filteredCatalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
        onEditAnime={(anime) => handleOpenModularEditor(anime, 'identity')}
      />

      {/* 6. CSV IMPORT HELP MODAL */}
      <AdminCsvHelpModal
        isOpen={isCsvHelpOpen}
        onClose={() => setIsCsvHelpOpen(false)}
        onDownloadSampleCSV={handleDownloadSampleCSV}
        onTriggerCsvUpload={triggerCsvFilePicker}
      />

      {/* 7. CLASSIC SINGLE-SCROLL ADD / EDIT ANIME MODAL */}
      <DubInfoModal
        key={editingAnime?.id ? `edit-${editingAnime.id}` : isAddModalOpen ? 'add-new' : 'closed'}
        mode={editingAnime?.id ? 'edit' : 'submit'}
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingAnime(null);
        }}
        onSubmit={handleAddOrEditAnime}
        initialData={editingAnime}
      />

      {/* 8. SAFE CONFIRMATION MODAL (Prevents accidental deletes) */}
      <ConfirmDialog
        isOpen={Boolean(confirmDialog?.isOpen)}
        title={confirmDialog?.title || 'Confirm Action'}
        description={confirmDialog?.message || ''}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirm'}
        cancelLabel="Cancel"
        destructive={Boolean(confirmDialog?.isDanger)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => confirmDialog?.onConfirm()}
      />

      {/* 9. TOAST NOTIFICATION BANNER */}
      {toastMessage && (
        <div
          data-testid="admin-toast-banner"
          className={`fixed bottom-20 lg:bottom-6 right-4 z-[140] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border max-w-md ${
            toastType === 'error'
              ? 'bg-[var(--bg-surface)] border-red-500/50 text-red-600 dark:text-red-400'
              : 'bg-[var(--bg-surface)] border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {toastType === 'error' ? (
            <XCircle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
};
