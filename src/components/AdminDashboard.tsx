import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Globe,
  ShieldAlert,
  Clock,
  Film,
  Download,
  Upload,
  HelpCircle,
  Loader2,
  Database,
  LogOut,
  Terminal,
  BarChart3,
  MessageSquare,
  Settings,
  ArrowLeft,
  ShieldCheck,
  Languages,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  X,
  FileSpreadsheet,
  RefreshCw,
  Activity,
  Layers,
  Mic2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DubInfoModal } from './DubInfoModal';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { cloudflareApi, type AdminLinkCheckResponse } from '../services/cloudflareApi';
import { getCloudflareUrl } from '../config/cloudflare';
import { useUser, useAuth, getClerkSessionToken } from '../lib/clerk';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import {
  auditAnimeDataHealth,
  type DataHealthFilter,
  type AdminActiveTab,
  type AdminFeedbackItem,
  type AdminOverviewStats,
  type FeedbackStatus,
} from './admin/types';
import {
  validateCsvDryRunRows,
  type AnimeEditorTabId,
  type CsvDryRunSummary,
} from '../utils/adminOpsPro';
import { AdminTranslationsTab } from './admin/AdminTranslationsTab';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminCatalogTab } from './admin/AdminCatalogTab';
import { AdminPendingTab } from './admin/AdminPendingTab';
import { AdminDataHealthTab } from './admin/AdminDataHealthTab';
import { AdminFeedbackTab } from './admin/AdminFeedbackTab';
import { AdminSettingsTab } from './admin/AdminSettingsTab';
import { AdminTerminalHud } from './admin/AdminTerminalHud';
import { AdminCommandPalette } from './admin/AdminCommandPalette';
import { AdminCsvHelpModal } from './admin/AdminCsvHelpModal';
import { AdminAnimeEditorView } from './admin/AdminAnimeEditorView';
import { AdminDubMatrixTab } from './admin/AdminDubMatrixTab';
import { AdminModerationInboxTab } from './admin/AdminModerationInboxTab';
import { AdminActivityLogTab } from './admin/AdminActivityLogTab';
import { AdminFranchiseBuilderTab } from './admin/AdminFranchiseBuilderTab';
import { AdminCastManagerTab } from './admin/AdminCastManagerTab';
import { AdminBackupCenterTab } from './admin/AdminBackupCenterTab';

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
  const { isSignedIn, user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const [serverVerifiedAdmin, setServerVerifiedAdmin] = useState<boolean | null>(null);

  const isClerkAdminAuthorized =
    Boolean(isSignedIn && clerkUser && (isAuthorizedClerkAdmin(clerkUser) || serverVerifiedAdmin === true)) &&
    serverVerifiedAdmin !== false;

  // Navigation & Responsive Shell State
  const [activeTab, setActiveTab] = useState<AdminActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p === '/admin/analytics') return 'analytics';
      if (p === '/admin/catalog/new' || /^\/admin\/catalog\/[^/]+\/edit\/?$/.test(p)) {
        return 'editor';
      }
    }
    return 'overview';
  });
  const [moderationSubTab, setModerationSubTab] = useState<'all' | 'pending' | 'feedback'>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);

  // Server-Side Paginated Catalog State
  const [catalogItems, setCatalogItems] = useState<any[]>(catalogList);
  const [catalogPage, setCatalogPage] = useState<number>(1);
  const [catalogPageSize] = useState<number>(25);
  const [catalogTotalItems, setCatalogTotalItems] = useState<number>(catalogList.length);
  const [catalogTotalPages, setCatalogTotalPages] = useState<number>(1);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterLanguage, setFilterLanguage] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('id_desc');
  const catalogAbortRef = useRef<AbortController | null>(null);

  // Full Catalog Index for Data Health & Translations
  const [fullAdminIndex, setFullAdminIndex] = useState<any[]>(catalogList);

  // Bulk Actions & Modals State
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<number[]>([]);
  const [bulkLanguage, setBulkLanguage] = useState<string>('Hindi');
  const [isBulkProcessing, setIsBulkProcessing] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingAnime, setEditingAnime] = useState<any | null>(null);
  const [editorTargetTab, setEditorTargetTab] = useState<AnimeEditorTabId>('identity');
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
  const [isCsvHelpOpen, setIsCsvHelpOpen] = useState<boolean>(false);
  const [csvDryRunReport, setCsvDryRunReport] = useState<CsvDryRunSummary | null>(null);
  const [stagedCsvRows, setStagedCsvRows] = useState<any[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

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

  // Toast Notification Banner State
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

  // Debounce catalog search query (250ms) and reset page to 1
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCatalogPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when status, language, or sort changes
  useEffect(() => {
    setCatalogPage(1);
  }, [filterStatus, filterLanguage, sortBy]);

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
      (activeTab === 'data_health' ||
        activeTab === 'translations' ||
        activeTab === 'backup' ||
        activeTab === 'franchises' ||
        activeTab === 'cast' ||
        activeTab === 'dubs')
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

  // 4. Fetch D1 Diagnostics & Status Summary
  const fetchD1StatusSummary = useCallback(async () => {
    setIsTestingApi(true);
    try {
      const cf = await cloudflareApi.fetchCloudflareStatus();
      if (cf) {
        setCfStatus(cf);
        addLog(
          `D1 connected (${cf.services?.d1?.recordsCount ?? 0} total rows, ${cf.services?.d1?.latencyMs ?? 12}ms).`,
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
  const overviewStats: AdminOverviewStats = useMemo(() => {
    const d1 = cfStatus?.services?.d1;
    const fallbackPool = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;

    // Accurate language tally from loaded pool if D1 summary hasn't arrived yet
    const computedLangCounts: Record<string, number> = {
      Hindi: 0,
      Tamil: 0,
      Telugu: 0,
      Malayalam: 0,
      Kannada: 0,
      Bengali: 0,
      Marathi: 0,
      Gujarati: 0,
      Unverified: 0,
    };

    for (const anime of fallbackPool) {
      const rawLangs = Array.isArray(anime.languages)
        ? anime.languages.filter(Boolean)
        : typeof anime.languages === 'string' && anime.languages.trim()
          ? anime.languages
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];
      if (rawLangs.length === 0) {
        computedLangCounts.Unverified += 1;
      } else {
        const joined = rawLangs.join(' ').toLowerCase();
        if (joined.includes('hindi')) computedLangCounts.Hindi += 1;
        if (joined.includes('tamil')) computedLangCounts.Tamil += 1;
        if (joined.includes('telugu')) computedLangCounts.Telugu += 1;
        if (joined.includes('malayalam')) computedLangCounts.Malayalam += 1;
        if (joined.includes('kannada')) computedLangCounts.Kannada += 1;
        if (joined.includes('bengali')) computedLangCounts.Bengali += 1;
        if (joined.includes('marathi')) computedLangCounts.Marathi += 1;
        if (joined.includes('gujarati')) computedLangCounts.Gujarati += 1;
      }
    }

    const openFeedbackCount = feedbackList.filter(
      (f) => String(f.status || 'open').toLowerCase() !== 'resolved'
    ).length;

    const publishedAnimeCount =
      typeof d1?.activeAnimeCount === 'number'
        ? d1.activeAnimeCount
        : Math.max(catalogTotalItems, fallbackPool.length);

    const totalAnimeCount =
      typeof d1?.recordsCount === 'number' && d1.recordsCount > 0
        ? d1.recordsCount
        : Math.max(catalogTotalItems, fallbackPool.length);

    const unverifiedDubsCount =
      typeof d1?.unverifiedDubsCount === 'number'
        ? d1.unverifiedDubsCount
        : computedLangCounts.Unverified;

    const missingTranslationsCount =
      typeof d1?.missingTranslationsCount === 'number'
        ? d1.missingTranslationsCount
        : publishedAnimeCount;

    return {
      publishedAnimeCount,
      totalAnimeCount,
      pendingModerationCount: pendingItems.length,
      openFeedbackCount:
        typeof d1?.openFeedbackCount === 'number' && feedbackList.length === 0
          ? d1.openFeedbackCount
          : openFeedbackCount,
      totalFeedbackCount: feedbackList.length || Number(d1?.feedbackCount || 0),
      unverifiedDubsCount,
      missingTranslationsCount,
      reviewsCount: Number(d1?.reviewsCount || 0),
      reportsCount: Number(d1?.reportsCount || 0),
      watchlistCount: Number(d1?.watchlistCount || 0),
      d1Connected: Boolean(d1?.connected),
      d1LatencyMs: Number(d1?.latencyMs || 12),
      languageCounts: d1?.languageCounts || computedLangCounts,
    };
  }, [cfStatus, fullAdminIndex, catalogItems, catalogTotalItems, pendingItems, feedbackList]);

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
  const handleApprove = async (id: number | string) => {
    const itemToApprove = pendingItems.find((item) => String(item.id) === String(id));
    if (!itemToApprove) return;
    try {
      const targetStatus =
        itemToApprove.airing_status && itemToApprove.airing_status !== 'pending'
          ? itemToApprove.airing_status
          : itemToApprove.type === 'Movie'
            ? 'Completed'
            : 'Airing';

      const res: any = await cloudflareApi.approveAnime(id, targetStatus);
      if (!res || res.success === false) {
        throw new Error(res?.error || 'Server rejected approval');
      }

      setPendingItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
      showToast(`Approved "${itemToApprove.title}" and published to D1 catalog!`, 'success');
      void fetchPaginatedAdminCatalog(catalogPage);
      void fetchD1StatusSummary();
      onAnimeCreated?.({
        ...itemToApprove,
        status: targetStatus,
        is_published: 1,
      });
    } catch (err: any) {
      showToast(`Failed to approve: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleReject = async (id: number | string) => {
    try {
      const res: any = await cloudflareApi.rejectAnime(id);
      if (!res || res.success === false) {
        throw new Error(res?.error || 'Server rejected deletion');
      }
      setPendingItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
      showToast('Rejected and removed pending submission from D1.', 'success');
      void fetchD1StatusSummary();
    } catch (err: any) {
      showToast(`Failed to reject submission: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleTogglePendingLanguage = async (id: number | string, lang: string) => {
    const targetItem = pendingItems.find((i) => String(i.id) === String(id));
    if (!targetItem) return;
    const currentLangs: string[] = Array.isArray(targetItem.languages)
      ? targetItem.languages
      : typeof targetItem.languages === 'string' && targetItem.languages.trim()
        ? targetItem.languages.split(',').map((s: string) => s.trim())
        : [];
    const updatedLangs = currentLangs.includes(lang)
      ? currentLangs.filter((l: string) => l !== lang)
      : [...currentLangs, lang];

    setPendingItems((prev) =>
      prev.map((item) =>
        String(item.id) === String(id) ? { ...item, languages: updatedLangs } : item
      )
    );

    try {
      await cloudflareApi.updateAnime(id, {
        ...targetItem,
        languages: updatedLangs.join(', '),
      });
    } catch (err) {
      console.error('Failed to sync pending language update:', err);
    }
  };

  const handleApproveAllPending = () => {
    if (pendingItems.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Approve All Pending Submissions',
      message: `Approve and publish all ${pendingItems.length} pending anime to the live Cloudflare D1 catalog?`,
      confirmLabel: 'Approve All',
      onConfirm: async () => {
        setConfirmDialog(null);
        let approvedCount = 0;
        for (const item of pendingItems) {
          try {
            const targetStatus = item.type === 'Movie' ? 'Completed' : 'Airing';
            const res: any = await cloudflareApi.approveAnime(item.id, targetStatus);
            if (res && res.success !== false) approvedCount++;
          } catch {}
        }
        await fetchPendingItems();
        await fetchPaginatedAdminCatalog(1);
        await fetchD1StatusSummary();
        onAnimeCreated?.();
        showToast(`Approved and published ${approvedCount} titles to the catalog!`, 'success');
      },
    });
  };

  const handleClearAllPending = () => {
    if (pendingItems.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Pending Moderation Queue',
      message: `Reject and permanently delete all ${pendingItems.length} pending submissions? Published catalog titles will NOT be affected.`,
      confirmLabel: 'Clear Queue',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res: any = await cloudflareApi.clearPendingQueue();
          if (!res || !res.success) {
            throw new Error(res?.error || res?.message || 'Failed to clear pending queue');
          }
          setPendingItems([]);
          showToast('Pending moderation queue cleared.', 'success');
          void fetchD1StatusSummary();
        } catch (err: any) {
          showToast(`Failed to clear pending queue: ${err?.message || 'Unknown error'}`, 'error');
        }
      },
    });
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
      message: `Permanently delete "${title}" (#${id}) from Cloudflare D1?`,
      confirmLabel: 'Delete Permanently',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await cloudflareApi.deleteAnime(id);
          setCatalogItems((prev) => prev.filter((a) => Number(a.id) !== Number(id)));
          setCatalogTotalItems((prev) => Math.max(0, prev - 1));
          onAnimeCreated?.(undefined, id);
          showToast(`Deleted "${title}" from D1.`, 'success');
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

  const handleBulkDeleteSelected = () => {
    if (selectedCatalogIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Delete Catalog Titles',
      message: `Permanently delete ${selectedCatalogIds.length} selected anime from Cloudflare D1?`,
      confirmLabel: `Delete ${selectedCatalogIds.length} Titles`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsBulkProcessing(true);
        try {
          for (const id of selectedCatalogIds) {
            await cloudflareApi.deleteAnime(id);
          }
          showToast(`Deleted ${selectedCatalogIds.length} titles from D1.`, 'success');
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

  // 13. Add / Edit Submit Handler
  const handleAddOrEditAnime = async (newAnimeData: any) => {
    try {
      const isEditing = Boolean(editingAnime && editingAnime.id);
      const isPendingItem = Boolean(
        editingAnime &&
          (editingAnime.status === 'pending' ||
            pendingItems.some((p) => String(p.id) === String(editingAnime.id)))
      );

      const savedRes: any = isEditing
        ? await cloudflareApi.updateAnime(editingAnime.id, {
            ...newAnimeData,
            status: isPendingItem ? 'pending' : newAnimeData.status || editingAnime.status,
            is_published: isPendingItem ? 0 : 1,
          })
        : await cloudflareApi.createAnime(newAnimeData);
      const savedAnime = savedRes?.data || savedRes || newAnimeData;

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
    const sampleHeaders = [
      'Title',
      'Poster URL',
      'Synopsis',
      'Rating',
      'Release Year',
      'Status',
      'Type',
      'Studio',
      'Genres',
      'Languages',
      'Platforms',
      'Episodes',
      'Season',
    ];
    const sampleRows = [
      [
        '"Solo Leveling"',
        '"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png"',
        '"In a world where hunters must battle deadly monsters to protect humanity, Sung Jinwoo finds a mysterious program."',
        '"8.8"',
        '"2024"',
        '"Airing"',
        '"TV Series"',
        '"A-1 Pictures"',
        '"Action | Adventure | Fantasy"',
        '"Tamil | Hindi | Telugu"',
        '"Crunchyroll"',
        '"12 | 13"',
        '"Winter 2024"',
      ],
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [sampleHeaders.join(','), ...sampleRows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'anidub_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded sample CSV template!', 'success');
  };

  const handleExportCSV = () => {
    const exportList = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;
    if (exportList.length === 0) {
      showToast('No catalog items loaded to export.', 'error');
      return;
    }

    const headers = [
      'ID',
      'Title',
      'Slug',
      'Poster URL',
      'Rating',
      'Release Year',
      'Status',
      'Type',
      'Studio',
      'Genres',
      'Languages',
      'Platforms',
      'Episodes Count',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = exportList.map((a) => {
      const genresStr = Array.isArray(a.genres) ? a.genres.join(' | ') : a.genres || '';
      const langsStr = Array.isArray(a.languages) ? a.languages.join(' | ') : a.languages || '';
      const platformsStr = Array.isArray(a.platforms)
        ? a.platforms.join(' | ')
        : a.platform || '';
      return [
        escapeCsv(a.id),
        escapeCsv(a.title),
        escapeCsv(a.slug || ''),
        escapeCsv(a.posterUrl || a.image || a.cover_image || ''),
        escapeCsv(a.rating || '8.5'),
        escapeCsv(a.releaseYear || a.year || '2024'),
        escapeCsv(a.status || 'Airing'),
        escapeCsv(a.type || 'TV Series'),
        escapeCsv(a.studio || ''),
        escapeCsv(genresStr),
        escapeCsv(langsStr),
        escapeCsv(platformsStr),
        escapeCsv(a.episodes_count || 12),
      ].join(',');
    });

    const csvString = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `anidub_catalog_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${exportList.length} anime titles to CSV!`, 'success');
  };

  const handleExportSQL = () => {
    const exportList = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;
    if (exportList.length === 0) {
      showToast('No catalog items loaded to export.', 'error');
      return;
    }

    const escSql = (val: any) => {
      if (val === null || val === undefined || val === '') return 'NULL';
      if (typeof val === 'number') return String(val);
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const lines: string[] = [
      `-- AniDub India Cloudflare D1 SQL Backup`,
      `-- Generated at: ${new Date().toISOString()}`,
      `-- Total Titles: ${exportList.length}`,
      ``,
    ];

    for (const a of exportList) {
      const title = escSql(a.title);
      const slug = escSql(
        a.slug ||
          String(a.title || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
      );
      const synopsis = escSql(a.synopsis || '');
      const cover = escSql(a.posterUrl || a.image || a.cover_image || '');
      const rating = Number(a.rating) || 8.5;
      const year = Number(a.releaseYear || a.year) || 2024;
      const status = escSql(a.status || 'Airing');
      const type = escSql(a.type || 'TV Series');
      const studio = escSql(a.studio || 'MAPPA');
      const genres = escSql(
        Array.isArray(a.genres) ? a.genres.join(', ') : a.genres || ''
      );
      const langs = escSql(
        Array.isArray(a.languages) ? a.languages.join(', ') : a.languages || ''
      );
      const platform = escSql(
        Array.isArray(a.platforms) ? a.platforms[0] : a.platform || ''
      );
      const epCount = Number(a.episodes_count) || 12;

      lines.push(
        `INSERT OR REPLACE INTO anime (title, slug, synopsis, cover_image, rating, year, status, type, studio, genres, languages, platform, episodes_count, is_published, submissionStatus) VALUES (${title}, ${slug}, ${synopsis}, ${cover}, ${rating}, ${year}, ${status}, ${type}, ${studio}, ${genres}, ${langs}, ${platform}, ${epCount}, 1, 'approved');`
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'application/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anidub_d1_backup_${new Date().toISOString().slice(0, 10)}.sql`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${exportList.length} titles as D1 SQL Dump!`, 'success');
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCsv(true);

    try {
      const text = await file.text();
      const parseCSV = (raw: string): string[][] => {
        const result: string[][] = [];
        let row: string[] = [];
        let current = '';
        let inQuotes = false;
        const cleanText = raw.replace(/^\uFEFF/, '');
        for (let i = 0; i < cleanText.length; i++) {
          const char = cleanText[i];
          const nextChar = cleanText[i + 1];
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            row.push(current.trim());
            if (row.some((cell) => cell !== '')) result.push(row);
            row = [];
            current = '';
          } else {
            current += char;
          }
        }
        if (current !== '' || row.length > 0) {
          row.push(current.trim());
          if (row.some((cell) => cell !== '')) result.push(row);
        }
        return result;
      };

      const rows = parseCSV(text);
      if (rows.length < 2) {
        showToast('CSV file is empty or missing data rows.', 'error');
        setIsUploadingCsv(false);
        return;
      }

      const rawHeaders = rows[0].map((h) => h.replace(/^"|"$/g, '').trim());
      const parsedItems: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        if (!values || values.length === 0) continue;
        const rowObj: any = {};
        rawHeaders.forEach((h, idx) => {
          if (h) rowObj[h] = values[idx] !== undefined ? values[idx].replace(/^"|"$/g, '').trim() : '';
        });

        const getField = (possibleNames: string[]) => {
          for (const key of Object.keys(rowObj)) {
            const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (possibleNames.includes(normKey) && rowObj[key] !== '') {
              return rowObj[key];
            }
          }
          return '';
        };

        const title = getField(['title', 'name', 'animetitle', 'animename']) || values[0] || '';
        if (!title || title.toLowerCase() === 'title') continue;

        parsedItems.push({
          ...rowObj,
          title,
          posterUrl: getField(['posterurl', 'poster', 'coverimage', 'image', 'cover']),
          synopsis: getField(['synopsis', 'description', 'summary', 'plot']),
          rating: getField(['rating', 'score', 'malscore']) || '8.5',
          releaseYear: getField(['releaseyear', 'year', 'aired']) || '2024',
          status: getField(['status', 'airingstatus']) || 'Completed',
          type: getField(['type', 'format', 'mediatype']) || 'TV Series',
          studio: getField(['studio', 'studios', 'producer']) || 'MAPPA',
          genres: getField(['genres', 'genre', 'tags', 'categories']) || 'Action, Fantasy',
          languages: getField(['languages', 'language', 'dublanguages', 'dub', 'audio']) || '',
          platforms: getField(['platforms', 'platform', 'streaming', 'ott', 'watchon']) || '',
          episodes: getField(['episodes', 'episodecount', 'totalepisodes', 'eps']) || '12',
        });
      }

      if (parsedItems.length === 0) {
        showToast('Could not find valid anime rows in CSV.', 'error');
        setIsUploadingCsv(false);
        return;
      }

      // Phase 2: Safe CSV Import Dry-Run before committing
      setStagedCsvRows(parsedItems);
      try {
        const dryRes = await cloudflareApi.dryRunImportCsv(parsedItems);
        if (dryRes && dryRes.report) {
          setCsvDryRunReport(dryRes.report);
          setActiveTab('backup');
          showToast(
            `Dry-Run Complete: ${dryRes.report.validCount} valid, ${dryRes.report.duplicateCount} duplicates, ${dryRes.report.invalidCount} errors. Review before committing.`,
            'success'
          );
          return;
        }
      } catch {
        // Fallback to local dry-run validator if server endpoint is unreachable
        const existingSource = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;
        const localDryReport = validateCsvDryRunRows(parsedItems, existingSource);
        setCsvDryRunReport(localDryReport);
        setActiveTab('backup');
        showToast(
          `Dry-Run Complete: ${localDryReport.validCount} valid, ${localDryReport.duplicateCount} duplicates, ${localDryReport.invalidCount} errors.`,
          'success'
        );
        return;
      }
    } catch (err: any) {
      showToast(`CSV Dry-Run Failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUploadingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
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
    (anime: any | null, targetTab: AnimeEditorTabId = 'identity') => {
      setEditingAnime(anime);
      setEditorTargetTab(targetTab);
      setActiveTab('editor');
      if (typeof window !== 'undefined') {
        const targetPath =
          anime && anime.id ? `/admin/catalog/${anime.id}/edit` : '/admin/catalog/new';
        if (window.location.pathname !== targetPath) {
          window.history.pushState(null, '', targetPath);
        }
      }
    },
    []
  );

  // STRICT CLERK ADMIN ROUTE GUARD (Production Enforced)
  if (!isClerkAdminAuthorized) {
    return (
      <div
        data-testid="admin-auth-gate"
        className="min-h-[75vh] flex items-center justify-center p-4 bg-[var(--bg-canvas)] text-[var(--text-primary)]"
      >
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
            <button
              type="button"
              onClick={onNavigateHome}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs sm:text-sm font-bold inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Public Catalog
            </button>
          )}
        </div>
      </div>
    );
  }

  // Normalized active tab for unified Moderation & Feedback
  const effectiveTab: AdminActiveTab =
    activeTab === 'pending' || activeTab === 'feedback' ? 'moderation' : activeTab;

  const handleSelectNavTab = (tab: AdminActiveTab) => {
    if (tab === 'pending') {
      setActiveTab('moderation');
      setModerationSubTab('pending');
    } else if (tab === 'feedback') {
      setActiveTab('moderation');
      setModerationSubTab('feedback');
    } else {
      setActiveTab(tab);
    }
    if (
      typeof window !== 'undefined' &&
      tab !== 'editor' &&
      window.location.pathname.startsWith('/admin/catalog/')
    ) {
      window.history.pushState(null, '', '/admin');
    }
    setIsMobileMoreOpen(false);
  };

  const handleFilterCatalogByLanguage = (language: string) => {
    setFilterLanguage(language);
    setCatalogPage(1);
    setActiveTab(language === 'Unverified' ? 'dubs' : 'catalog');
  };

  const totalModerationBadge =
    overviewStats.pendingModerationCount + overviewStats.openFeedbackCount;

  const sidebarGroups: Array<{
    groupLabel: string;
    items: Array<{
      id: AdminActiveTab;
      label: string;
      icon: React.FC<{ className?: string }>;
      badge?: number;
    }>;
  }> = [
    {
      groupLabel: 'Workspace',
      items: [
        { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
        {
          id: 'catalog',
          label: 'Anime Catalog',
          icon: Film,
          badge: overviewStats.publishedAnimeCount,
        },
        {
          id: 'dubs',
          label: 'Dubs Matrix',
          icon: Globe,
          badge:
            overviewStats.unverifiedDubsCount > 0
              ? overviewStats.unverifiedDubsCount
              : undefined,
        },
        {
          id: 'translations',
          label: 'Translation Studio',
          icon: Languages,
        },
        {
          id: 'franchises',
          label: 'Franchise Builder',
          icon: Layers,
        },
        {
          id: 'cast',
          label: 'Cast & Voice Actors',
          icon: Mic2,
        },
      ],
    },
    {
      groupLabel: 'Operations',
      items: [
        {
          id: 'moderation',
          label: 'Moderation Inbox',
          icon: Clock,
          badge: totalModerationBadge > 0 ? totalModerationBadge : undefined,
        },
        {
          id: 'data_health',
          label: 'Data Health QA',
          icon: ShieldCheck,
          badge:
            dataHealthReport.summary.all > 0 ? dataHealthReport.summary.all : undefined,
        },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    {
      groupLabel: 'System',
      items: [
        { id: 'backup', label: 'Backup & CSV', icon: Download },
        { id: 'activity_log', label: 'Activity Log', icon: Activity },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <div
      data-testid="admin-workspace-shell"
      className="min-h-screen w-full max-w-full overflow-x-clip bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col lg:flex-row pb-20 lg:pb-0"
    >
      {/* Hidden CSV File Input */}
      <input
        type="file"
        accept=".csv"
        ref={csvInputRef}
        onChange={handleCsvUpload}
        className="hidden"
      />

      {/* 1. DESKTOP COLLAPSIBLE 240PX SIDEBAR */}
      <aside
        data-testid="admin-desktop-sidebar"
        className={`hidden lg:flex flex-col shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 ${
          isSidebarCollapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
      >
        <div className="h-16 px-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo.png"
                alt="AniDub India"
                className="w-8 h-8 rounded-lg object-contain shrink-0"
              />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                  AniDub Admin
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  Cloudflare D1 Studio
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center mx-auto"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
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
                      isActive
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                          isActive
                            ? 'bg-black/20 text-[var(--accent-on-primary,#fff)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                        }`}
                      >
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
          {onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              title="Back to Public App"
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-2.5"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Back to App</span>}
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Exit Admin"
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2.5"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Lock Admin</span>}
            </button>
          )}
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE COLUMN */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Workspace Header */}
        <header className="sticky top-0 z-30 h-16 px-3 sm:px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="lg:hidden min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-1 shrink-0"
                aria-label="Back to App"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] truncate">
                {effectiveTab === 'overview' && 'Command Center'}
                {effectiveTab === 'catalog' && 'Anime Catalog'}
                {effectiveTab === 'editor' && (editingAnime ? 'Modular Anime Editor' : 'New Catalog Entry')}
                {effectiveTab === 'dubs' && 'Bulk Dub Intelligence & Episode Matrix'}
                {effectiveTab === 'translations' && 'Workers AI Translation Studio'}
                {effectiveTab === 'franchises' && 'Anime Universe & Smart Watch Order Builder'}
                {effectiveTab === 'cast' && 'Characters & Verified Indian Voice Actors'}
                {effectiveTab === 'moderation' && 'Unified Moderation Inbox'}
                {effectiveTab === 'data_health' && 'Catalog Data Health & QA Scanner'}
                {effectiveTab === 'analytics' && 'Actionable Admin Analytics & Demand Intelligence'}
                {effectiveTab === 'backup' && 'Full Backup, JSON Validator & CSV Dry-Run Center'}
                {effectiveTab === 'activity_log' && 'Admin Activity & Audit Log'}
                {effectiveTab === 'settings' && 'Workspace Settings'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="admin-quick-search-trigger"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2"
              title="Quick Search & Commands (⌘K)"
            >
              <Search className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="hidden sm:inline">Quick Search</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-mono">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              data-testid="admin-diagnostics-trigger"
              onClick={() => setIsDiagnosticsOpen(true)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
              title="Open Diagnostics Drawer"
            >
              <Terminal className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="hidden md:inline">Diagnostics</span>
            </button>

            <button
              type="button"
              data-testid="admin-header-add-anime-btn"
              onClick={() => handleOpenModularEditor(null, 'identity')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Anime</span>
            </button>
          </div>
        </header>

        {/* Active Workspace Section Content */}
        <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          {/* SECTION 1: COMMAND CENTER (OVERVIEW) */}
          {effectiveTab === 'overview' && (
            <AdminOverviewTab
              stats={overviewStats}
              pendingItems={pendingItems}
              feedbackList={feedbackList}
              onSetActiveTab={handleSelectNavTab}
              onOpenAddModal={() => handleOpenModularEditor(null, 'identity')}
              onFilterCatalogByLanguage={handleFilterCatalogByLanguage}
              onApprovePending={handleApprove}
              onRejectPending={handleReject}
            />
          )}

          {/* SECTION 2: MODULAR ANIME EDITOR (/admin/catalog/new & /admin/catalog/:id/edit) */}
          {effectiveTab === 'editor' && (
            <AdminAnimeEditorView
              initialAnime={editingAnime}
              initialTab={editorTargetTab}
              onCancel={() => {
                setEditingAnime(null);
                handleSelectNavTab('catalog');
              }}
              onSaved={(savedAnime, isNew) => {
                onAnimeCreated?.(savedAnime);
                setEditingAnime(null);
                handleSelectNavTab('catalog');
                void fetchPaginatedAdminCatalog(catalogPage);
                void fetchD1StatusSummary();
                showToast(
                  isNew
                    ? `Created "${savedAnime.title}" in Cloudflare D1!`
                    : `Updated "${savedAnime.title}" in Cloudflare D1!`,
                  'success'
                );
              }}
              onOpenTranslationsForAnime={(animeId) => {
                setTranslationTargetAnimeId(animeId);
                handleSelectNavTab('translations');
              }}
              onOpenFranchiseBuilder={(fKey) => {
                setFranchiseTargetKey(fKey);
                handleSelectNavTab('franchises');
              }}
              onOpenCastManager={(animeId) => {
                setCastTargetAnimeId(animeId);
                handleSelectNavTab('cast');
              }}
            />
          )}

          {/* SECTION 3: ANIME CATALOG */}
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
              onBulkDeleteSelected={handleBulkDeleteSelected}
              onToggleVisibility={handleToggleVisibility}
              onEditAnime={(anime) => handleOpenModularEditor(anime, 'identity')}
              onDeleteCatalogAnime={handleDeleteCatalogAnime}
            />
          )}

          {/* SECTION 4: BULK DUB INTELLIGENCE & EPISODE MATRIX EDITOR */}
          {effectiveTab === 'dubs' && (
            <AdminDubMatrixTab
              catalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              onEditAnimeInEditor={(anime) => handleOpenModularEditor(anime, 'dubs')}
              onSuccess={(msg) => {
                showToast(msg, 'success');
                void fetchPaginatedAdminCatalog(catalogPage);
                void fetchD1StatusSummary();
              }}
            />
          )}

          {/* SECTION 5: WORKERS AI TRANSLATION STUDIO */}
          {effectiveTab === 'translations' && (
            <AdminTranslationsTab
              catalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              initialAnimeId={translationTargetAnimeId}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          )}

          {/* SECTION 5B: ANIME UNIVERSE & SMART WATCH ORDER VISUAL BUILDER */}
          {effectiveTab === 'franchises' && (
            <AdminFranchiseBuilderTab
              catalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              initialFranchiseKey={franchiseTargetKey}
              onEditAnimeInEditor={(anime) => handleOpenModularEditor(anime, 'metadata')}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          )}

          {/* SECTION 5C: CHARACTERS & VERIFIED INDIAN VOICE ACTOR MANAGER */}
          {effectiveTab === 'cast' && (
            <AdminCastManagerTab
              catalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
              initialAnimeId={castTargetAnimeId}
              onSuccess={(msg) => showToast(msg, 'success')}
            />
          )}

          {/* SECTION 6: UNIFIED MODERATION INBOX */}
          {effectiveTab === 'moderation' && (
            <AdminModerationInboxTab
              pendingItems={pendingItems}
              feedbackList={feedbackList}
              updatingFeedbackId={updatingFeedbackId}
              feedbackError={feedbackError}
              onApproveAnime={handleApprove}
              onRejectAnime={handleReject}
              onEditPendingAnime={(anime) => handleOpenModularEditor(anime, 'identity')}
              onClearPendingQueue={handleClearAllPending}
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
              linkCheckReport={linkCheckReport}
              isCheckingLinks={isCheckingLinks}
              onRunLinkCheck={handleRunLinkCheck}
            />
          )}

          {/* SECTION 8: ACTIONABLE ADMIN ANALYTICS 2.0 */}
          {effectiveTab === 'analytics' && (
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
            />
          )}

          {/* SECTION 9: FULL BACKUP & RECOVERY CENTER */}
          {effectiveTab === 'backup' && (
            <AdminBackupCenterTab
              onFallbackExportCsv={handleExportCSV}
              onExportSql={handleExportSQL}
              onTriggerCsvUpload={() => csvInputRef.current?.click()}
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

          {/* SECTION 10: ADMIN ACTIVITY LOG */}
          {effectiveTab === 'activity_log' && <AdminActivityLogTab />}

          {/* SECTION 11: SETTINGS */}
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
            />
          )}
        </div>
      </div>

      {/* 3. MOBILE 5-TAB BOTTOM NAVIGATION BAR (< 1024px) */}
      <nav
        data-testid="admin-mobile-bottom-nav"
        aria-label="Admin Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] grid grid-cols-5 items-center px-1"
      >
        {(
          [
            { id: 'overview', label: 'Home', icon: LayoutDashboard },
            { id: 'catalog', label: 'Catalog', icon: Film },
            { id: 'dubs', label: 'Dubs', icon: Globe },
            {
              id: 'moderation',
              label: 'Moderation',
              icon: Clock,
              badge: totalModerationBadge,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = effectiveTab === tab.id && !isMobileMoreOpen;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`admin-mobile-tab-${tab.id}`}
              onClick={() => handleSelectNavTab(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl relative transition-all ${
                isActive
                  ? 'text-[var(--accent-primary)] font-extrabold'
                  : 'text-[var(--text-secondary)] font-semibold'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] truncate max-w-[68px]">{tab.label}</span>
              {'badge' in tab && tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute top-1 right-3 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          data-testid="admin-mobile-tab-more"
          onClick={() => setIsMobileMoreOpen((prev) => !prev)}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
            isMobileMoreOpen ||
            [
              'translations',
              'franchises',
              'cast',
              'data_health',
              'analytics',
              'backup',
              'activity_log',
              'settings',
            ].includes(effectiveTab)
              ? 'text-[var(--accent-primary)] font-extrabold'
              : 'text-[var(--text-secondary)] font-semibold'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[11px]">More</span>
        </button>
      </nav>

      {/* MOBILE "MORE" BOTTOM DRAWER */}
      {isMobileMoreOpen && (
        <div
          data-testid="admin-mobile-more-drawer"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            className="w-full bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] rounded-t-2xl p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm font-extrabold text-[var(--text-primary)]">
                More Admin Tools
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { id: 'translations', label: 'Translations', icon: Languages },
                  { id: 'franchises', label: 'Franchise Builder', icon: Layers },
                  { id: 'cast', label: 'Cast & VAs', icon: Mic2 },
                  { id: 'data_health', label: 'Data Health', icon: ShieldCheck },
                  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                  { id: 'backup', label: 'Backup Center', icon: Download },
                  { id: 'activity_log', label: 'Activity Log', icon: Activity },
                  { id: 'settings', label: 'Settings', icon: Settings },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = effectiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNavTab(item.id)}
                    className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2.5 ${
                      isActive
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsDiagnosticsOpen(true);
                }}
                className="min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-2.5"
              >
                <Terminal className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span className="truncate">Diagnostics</span>
              </button>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Lock Admin Workspace
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. OPTIONAL COLLAPSIBLE DIAGNOSTICS DRAWER */}
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
      />

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
        onRunDiagnostics={() => setIsDiagnosticsOpen(true)}
        filteredCatalog={fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems}
        onEditAnime={(anime) => handleOpenModularEditor(anime, 'identity')}
      />

      {/* 6. CSV IMPORT HELP MODAL */}
      <AdminCsvHelpModal
        isOpen={isCsvHelpOpen}
        onClose={() => setIsCsvHelpOpen(false)}
        onDownloadSampleCSV={handleDownloadSampleCSV}
        onTriggerCsvUpload={() => csvInputRef.current?.click()}
      />

      {/* 7. FALLBACK QUICK DUB MODAL (Only if explicitly triggered) */}
      <DubInfoModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingAnime(null);
        }}
        onSubmit={handleAddOrEditAnime}
        initialData={editingAnime}
      />

      {/* 8. NON-DESTRUCTIVE CONFIRMATION MODAL */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl space-y-4 text-[var(--text-primary)]">
            <h3 className="text-lg font-extrabold text-[var(--text-primary)]">
              {confirmDialog.title}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold ${
                  confirmDialog.isDanger
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)]'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

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
