import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import {
  Plus,
  Sparkles,
  Loader2,
  CheckCircle2,
  Zap,
  RefreshCw,
  Globe,
  LogOut,
  Inbox,
  Database,
  FileSpreadsheet,
  Download,
  X,
  HelpCircle,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Sliders,
  HardDrive,
  Activity,
  Terminal,
  Command,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { DubInfoModal } from './DubInfoModal';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { dbService } from '../services/databaseService';
import { cloudflareApi } from '../services/cloudflareApi';
import { CLOUDFLARE_API_URL } from '../config/cloudflare';
import Papa from 'papaparse';
import { AniDubLogo } from './AniDubLogo';
import { useUser, SignIn } from '@clerk/nextjs';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import { AdminOverviewTab, type GenreStatBar } from './admin/AdminOverviewTab';
import { AdminPendingTab } from './admin/AdminPendingTab';
import { AdminCatalogTab } from './admin/AdminCatalogTab';
import { AdminDataHealthTab } from './admin/AdminDataHealthTab';
import { AdminFeedbackTab } from './admin/AdminFeedbackTab';
import { AdminSettingsTab } from './admin/AdminSettingsTab';
import { AdminTerminalHud } from './admin/AdminTerminalHud';
import { AdminCommandPalette } from './admin/AdminCommandPalette';
import { AdminCsvHelpModal } from './admin/AdminCsvHelpModal';
import {
  type AdminTabId,
  type AdminAnimeRecord,
  type RatingCorrection,
  type FeedbackTicket,
  type TelegramSettingsStatus,
  type TelegramNotice,
  type TerminalLogEntry,
  type CommandPaletteActionItem,
  type CommandPaletteNavItem,
  KNOWN_IMDB_MAP,
  getCleanOmdbQueryTitles,
  formatLanguageText,
} from './admin/types';

const AnalyticsDashboard = lazy(() =>
  import('./AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard }))
);

export interface AdminDashboardProps {
  onAnimeCreated?: (anime?: AdminAnimeRecord, deletedId?: string | number) => void;
  onLogout?: () => void;
  onNavigateHome?: () => void;
  onToast?: (msg: string) => void;
  catalogList?: AdminAnimeRecord[];
}

interface ParsedCsvRow {
  [key: string]: string | undefined;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onAnimeCreated,
  onLogout,
  onNavigateHome,
  catalogList,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { isSignedIn, user: clerkUser } = useUser();
  const isClerkAdminAuthorized = Boolean(isSignedIn && clerkUser && isAuthorizedClerkAdmin(clerkUser));

  const [catalog, setCatalog] = useState<AdminAnimeRecord[]>(() =>
    catalogList && catalogList.length > 0 ? catalogList : []
  );

  useEffect(() => {
    if (catalogList && catalogList.length > 0) {
      setCatalog(catalogList);
    }
  }, [catalogList]);

  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [apiError, setApiError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudStatusText, setCloudStatusText] = useState('');

  // DubInfoModal state
  const [isDubModalOpen, setIsDubModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'submit' | 'edit'>('submit');
  const [editingAnime, setEditingAnime] = useState<AdminAnimeRecord | null>(null);

  // Tabs & list state
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTabId>('overview');
  const [feedbackList, setFeedbackList] = useState<FeedbackTicket[]>([]);
  const [pendingItems, setPendingItems] = useState<AdminAnimeRecord[]>([]);
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');

  // Catalog & CSV states
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportToast, setShowImportToast] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [showCsvHelpModal, setShowCsvHelpModal] = useState(false);
  const [hasCopiedHeaders, setHasCopiedHeaders] = useState(false);
  const [hasCopiedSnippet, setHasCopiedSnippet] = useState(false);

  // Command Palette & Terminal states
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([
    {
      id: 'log-sys-init',
      time: new Date().toLocaleTimeString(),
      level: 'SYS',
      msg: 'AniDub Edge Kernel initialized. Cloudflare D1 connected.',
    },
    {
      id: 'log-edge-conn',
      time: new Date().toLocaleTimeString(),
      level: 'EDGE',
      msg: `Link established: ${CLOUDFLARE_API_URL || 'Pages Native (Relative)'}`,
    },
    {
      id: 'log-d1-mount',
      time: new Date().toLocaleTimeString(),
      level: 'D1',
      msg: 'KV/D1 Catalog persistence mounted [DB: 75f053ab]',
    },
  ]);

  const addTerminalLog = (level: string, msg: string) => {
    const newEntry: TerminalLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      level,
      msg,
    };
    setTerminalLogs((prev) => [newEntry, ...prev.slice(0, 59)]);
  };

  // Cloud Infrastructure Settings
  const [apiUrlOverride, setApiUrlOverride] = useState(() => {
    try {
      return localStorage.getItem('cf_api_url_override') || '';
    } catch {
      return '';
    }
  });

  const handleResetApiUrl = () => {
    try {
      localStorage.removeItem('cf_api_url_override');
      setApiUrlOverride('');
      addTerminalLog('SET', 'API Worker URL reset to default (Relative Paths)');
      setSuccessMsg('API URL reset! Refreshing catalog...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveApiUrlOverride = () => {
    try {
      localStorage.setItem('cf_api_url_override', apiUrlOverride.trim());
      addTerminalLog('SET', `API Worker URL updated to: ${apiUrlOverride || 'Relative Paths'}`);
      setSuccessMsg('API URL configuration saved! Refreshing catalog...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  // Data Health states
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState<RatingCorrection[]>([]);

  // Telegram Bot integration state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<TelegramSettingsStatus>({
    configured: false,
    hasToken: false,
    hasChatId: false,
  });
  const [telegramNotice, setTelegramNotice] = useState<TelegramNotice | null>(null);

  const [confirmPurge, setConfirmPurge] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchTelegramStatus = async () => {
    try {
      const data = await cloudflareApi.fetchTelegramStatus();
      setTelegramStatus({
        configured: Boolean(data.configured),
        hasToken: Boolean(data.hasToken ?? data.configured),
        hasChatId: Boolean(data.hasChatId ?? data.chatId),
      });
      if (data.chatId && !telegramChatId) setTelegramChatId(data.chatId);
    } catch {
      // Ignore optional settings probe failures
    }
  };

  const handleSaveTelegram = async () => {
    setIsSavingTelegram(true);
    setTelegramNotice(null);
    try {
      const data = await cloudflareApi.updateTelegramSettings({
        token: telegramToken,
        chatId: telegramChatId,
      });
      if (data.success) {
        setTelegramNotice({ type: 'success', message: 'Telegram credentials saved successfully!' });
        addTerminalLog('OK', `Telegram credentials updated: chat_id=${telegramChatId}`);
        fetchTelegramStatus();
      } else {
        setTelegramNotice({ type: 'error', message: data.error || 'Failed to save credentials' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error saving credentials';
      setTelegramNotice({ type: 'error', message });
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramNotice(null);
    addTerminalLog('TG', 'Dispatching test notification probe to Telegram API...');
    try {
      const data = await cloudflareApi.testTelegram({
        token: telegramToken || undefined,
        chatId: telegramChatId || undefined,
      });
      if (data.success) {
        setTelegramNotice({
          type: 'success',
          message: 'Test message sent! Check your Telegram channel/group.',
        });
        addTerminalLog('OK', 'Telegram test notification DELIVERED successfully (HTTP 200)');
      } else {
        const errMsg = data.error || 'Telegram rejected test notification';
        setTelegramNotice({ type: 'error', message: errMsg });
        addTerminalLog('ERR', `Telegram test notification failed: ${errMsg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection to Telegram API failed';
      setTelegramNotice({ type: 'error', message: msg });
      addTerminalLog('ERR', `Telegram probe exception: ${msg}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const fetchFeedback = async () => {
    try {
      const data = (await cloudflareApi.fetchFeedback()) as FeedbackTicket[];
      setFeedbackList(data);
      addTerminalLog('FEED', `Loaded ${data.length} user request tickets`);
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    }
  };

  const handleResolveFeedback = async (id: number | string) => {
    try {
      addTerminalLog('FEED', `Resolving feedback ticket #${id}...`);
      await cloudflareApi.deleteFeedback(id);
      setFeedbackList((prev) => prev.filter((fb) => fb.id !== id && fb.id !== Number(id)));
      setSuccessMsg('Feedback ticket marked resolved and archived.');
      addTerminalLog('OK', `Feedback ticket #${id} resolved.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.warn('Error resolving feedback:', err);
      setFeedbackList((prev) => prev.filter((fb) => fb.id !== id && fb.id !== Number(id)));
    }
  };

  const handlePurgeCache = async () => {
    const typedConfirmation = window.prompt(
      'DANGER: This will permanently delete all anime, users, reviews, watchlists, episodes, and feedback from the database.\n\nType "DELETE ALL" to confirm:'
    );
    if (typedConfirmation !== 'DELETE ALL') {
      setConfirmPurge(false);
      addTerminalLog('WARN', 'Database reset cancelled: exact confirmation "DELETE ALL" was not entered.');
      setSuccessMsg('Reset cancelled. You must type "DELETE ALL" to confirm.');
      setTimeout(() => setSuccessMsg(''), 4000);
      return;
    }

    const res = await dbService.clearAllData(typedConfirmation);
    if (!res.success) {
      setConfirmPurge(false);
      addTerminalLog('ERR', `Database reset failed: ${res.error || 'Server error'}`);
      setSuccessMsg(`Database reset failed: ${res.error || 'Server error'}`);
      setTimeout(() => setSuccessMsg(''), 5000);
      return;
    }

    try {
      localStorage.removeItem('cf_admin_catalog_cache');
      localStorage.removeItem('cf_admin_pending_cache');
    } catch {
      // Ignore storage failures
    }
    setConfirmPurge(false);
    setSuccessMsg('Database and local storage cache reset successfully!');
    addTerminalLog('OK', 'Database reset confirmed ("DELETE ALL") and local cache cleared.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const fetchPendingItems = async () => {
    try {
      const data = (await cloudflareApi.fetchPendingItems()) as AdminAnimeRecord[];
      const pending = (data || []).map((item) => ({
        ...item,
        type: item.type || item.Type || 'TV Series',
        Type: item.type || item.Type || 'TV Series',
        languages:
          typeof item.languages === 'string'
            ? item.languages.split(',').map((s) => s.trim())
            : item.languages || ['Hindi', 'Tamil', 'Telugu'],
      }));
      setPendingItems(pending);
      addTerminalLog('QUEUE', `Pending review queue: ${pending.length} submissions awaiting mod`);
      try {
        localStorage.setItem('cf_admin_pending_cache', JSON.stringify(pending));
      } catch {
        // Ignore storage failures
      }
    } catch (err) {
      console.warn('Network notice fetching pending items from Cloudflare Worker, using local cache:', err);
      try {
        const cached = localStorage.getItem('cf_admin_pending_cache');
        if (cached) setPendingItems(JSON.parse(cached) as AdminAnimeRecord[]);
      } catch {
        // Ignore cache parse failures
      }
    }
  };

  const fetchAnime = async () => {
    setLoading(true);
    setCloudSyncing(true);
    setCloudStatusText('Fetching catalog from Cloudflare D1...');
    addTerminalLog('SYNC', 'Querying Cloudflare Edge D1 endpoint: /api/anime');
    setApiError(false);
    try {
      const { data, meta } = await cloudflareApi.fetchCatalog({ page: 1, limit: 100 });
      const allData = [...(data || [])];
      if (meta && meta.totalPages > 1) {
        const extraPages = Math.min(meta.totalPages, 10);
        for (let p = 2; p <= extraPages; p++) {
          const nextRes = await cloudflareApi.fetchCatalog({ page: p, limit: 100 });
          if (nextRes?.data?.length) allData.push(...nextRes.data);
        }
      }
      const items: AdminAnimeRecord[] = allData.map((item) => ({
        ...(item as AdminAnimeRecord),
        type: item.type || 'TV Series',
        Type: item.type || 'TV Series',
      }));
      setCatalog(items);
      addTerminalLog('OK', `Synchronized ${items.length} titles from Cloudflare D1 into active state`);
      try {
        localStorage.setItem('cf_admin_catalog_cache', JSON.stringify(items));
      } catch {
        // Ignore storage errors
      }
      await fetchPendingItems();
    } catch (err) {
      console.warn('Network notice fetching anime from Cloudflare D1:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown API Error';
      addTerminalLog('ERR', `[CRITICAL] Failed to reach Cloudflare D1: ${errorMsg}`);
      setApiError(true);

      if (catalogList && catalogList.length > 0) {
        setCatalog(catalogList);
      } else {
        const cached = localStorage.getItem('cf_admin_catalog_cache');
        if (cached) {
          try {
            setCatalog(JSON.parse(cached) as AdminAnimeRecord[]);
          } catch {
            setCatalog([]);
          }
        } else {
          setCatalog([]);
        }
      }
      await fetchPendingItems();
    } finally {
      setLoading(false);
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  useEffect(() => {
    fetchAnime();
    fetchFeedback();
    fetchTelegramStatus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setShowCsvHelpModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleApprovePending = async (itemId: number | string) => {
    const item = pendingItems.find((p) => p.id === itemId);
    if (!item) return;

    setCloudSyncing(true);
    setCloudStatusText(`Approving ${item.title || `#${itemId}`} on Cloudflare Edge...`);
    addTerminalLog('EDGE', `Approving #${itemId} (${item.title || 'Untitled'}) -> Promoting to Live`);
    try {
      const rawType = item.type || item.Type || 'TV Series';
      const rawStatusIn = String(item.status || item.airing_status || '').trim().toLowerCase();
      const targetStatus = rawStatusIn.includes('complete')
        ? 'Completed'
        : rawType === 'Movie'
          ? 'Completed'
          : 'Airing';

      const res = await cloudflareApi.approveAnime(itemId, targetStatus);
      if (!res || res.success === false) {
        throw new Error(res?.error || 'Failed to approve anime on backend');
      }

      setPendingItems((prev) => {
        const updated = prev.filter((p) => p.id !== itemId);
        try {
          localStorage.setItem('cf_admin_pending_cache', JSON.stringify(updated));
        } catch {
          // Ignore storage error
        }
        return updated;
      });
      setSuccessMsg('Anime Approved & Published globally on Cloudflare Edge.');
      addTerminalLog('OK', `Approval committed globally. #${itemId} is now live with status "${targetStatus}".`);
      await fetchAnime();
      if (typeof onAnimeCreated === 'function') {
        onAnimeCreated();
      }
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Cloudflare Approval error:', err);
      const errMsg = err instanceof Error ? err.message : 'Server error';
      setSuccessMsg(`Approval Failed: ${errMsg}`);
      addTerminalLog('ERR', `[APPROVAL ERROR] Failed to approve #${itemId}: ${errMsg}`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleRejectPending = async (itemId: number | string) => {
    const item = pendingItems.find((p) => p.id === itemId);
    setCloudSyncing(true);
    setCloudStatusText('Rejecting submission from Cloudflare D1...');
    addTerminalLog('REJ', `Rejecting submission #${itemId} (${item?.title || 'Unknown'})`);
    try {
      await cloudflareApi.deleteAnime(itemId);
      addTerminalLog('OK', `Submission #${itemId} purged from moderation queue.`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (/not found/i.test(errMsg)) {
        addTerminalLog('OK', `Submission #${itemId} already removed from Cloudflare D1.`);
      } else {
        console.warn('Notice while deleting rejected submission from Cloudflare D1:', err);
        addTerminalLog('WARN', `Notice while purging #${itemId} from D1: ${errMsg}`);
      }
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
    setPendingItems((prev) => {
      const updated = prev.filter((p) => p.id !== itemId);
      try {
        localStorage.setItem('cf_admin_pending_cache', JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
    setSuccessMsg(`Rejected submission ${item?.title || itemId}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleClearPendingQueue = async () => {
    if (!window.confirm(`Are you sure you want to clear all ${pendingItems.length} pending submissions from the moderation queue?`)) {
      return;
    }
    setCloudSyncing(true);
    setCloudStatusText('Clearing pending moderation queue...');
    addTerminalLog('PURGE', `Wiping pending moderation queue (${pendingItems.length} items)`);
    try {
      await cloudflareApi.clearPendingQueue();
      setPendingItems([]);
      try {
        localStorage.setItem('cf_admin_pending_cache', JSON.stringify([]));
      } catch {
        // Ignore storage errors
      }
      setSuccessMsg('Pending moderation queue wiped successfully.');
      addTerminalLog('OK', 'All pending submissions cleared from Cloudflare D1.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Clear pending error:', err);
      const errMsg = err instanceof Error ? err.message : 'Server error';
      setSuccessMsg(`Failed to clear queue: ${errMsg}`);
      addTerminalLog('ERR', `Failed to wipe pending queue: ${errMsg}`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleDeleteCatalogAnime = async (e: React.MouseEvent, anime: AdminAnimeRecord) => {
    e.stopPropagation();
    const targetId = anime.id || anime._id;
    if (targetId === undefined || targetId === null) return;

    setDeletingId(targetId);
    setCloudSyncing(true);
    setCloudStatusText(`Deleting #${targetId} from Cloudflare D1...`);
    addTerminalLog('DEL', `Issuing HTTP DELETE /api/anime/${targetId} on Cloudflare Edge`);

    try {
      await cloudflareApi.deleteAnime(targetId);
      addTerminalLog('OK', `Purged #${targetId} (${anime.title || 'Untitled'}) from Cloudflare D1`);

      setCatalog((prev) => prev.filter((item) => String(item.id || item._id) !== String(targetId)));
      try {
        const cached = localStorage.getItem('cf_admin_catalog_cache');
        if (cached) {
          const list = JSON.parse(cached) as AdminAnimeRecord[];
          localStorage.setItem(
            'cf_admin_catalog_cache',
            JSON.stringify(list.filter((item) => String(item.id || item._id) !== String(targetId)))
          );
        }
      } catch {
        // Ignore storage error
      }

      setSuccessMsg('Successfully deleted from Cloudflare D1.');
      setTimeout(() => setSuccessMsg(''), 4000);

      if (typeof onAnimeCreated === 'function') {
        onAnimeCreated(undefined, targetId);
      }
    } catch (err) {
      console.error('Cloudflare Delete error:', err);
      const errMsg = err instanceof Error ? err.message : 'Server error';
      setSuccessMsg(`Failed to delete anime: ${errMsg}`);
      addTerminalLog('ERR', `[ERROR] Failed deleting #${targetId} on Edge: ${errMsg}`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } finally {
      setDeletingId(null);
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleOpenEditModal = (anime: AdminAnimeRecord) => {
    setModalMode('edit');
    const resolvedType = anime.type || anime.Type || 'TV Series';
    const rawStatusStr = String(anime.status || anime.airing_status || '').trim().toLowerCase();
    const resolvedStatus = rawStatusStr.includes('complete')
      ? 'Completed'
      : resolvedType === 'Movie'
        ? 'Completed'
        : 'Airing';

    setEditingAnime({
      ...anime,
      type: resolvedType,
      Type: resolvedType,
      status: resolvedStatus,
      airing_status: resolvedStatus,
    });
    setIsDubModalOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    addTerminalLog('CSV', `Loading raw CSV file: ${file.name} (${file.size} bytes)`);

    try {
      const rawText = await file.text();
      const cleanText = rawText.replace(/^\uFEFF/, '').trim();
      if (!cleanText) {
        throw new Error('CSV file is empty');
      }

      const parseResults = Papa.parse<ParsedCsvRow>(cleanText, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header: string) => header.trim(),
      });

      if (parseResults.errors && parseResults.errors.length > 0) {
        console.warn('[CSV Parse Warnings/Errors]:', parseResults.errors);
      }

      const rawRows = parseResults.data || [];
      if (rawRows.length === 0) {
        throw new Error('No data rows found in CSV. Please verify column headers.');
      }

      addTerminalLog('CSV', `Detected headers: [${(parseResults.meta.fields || []).join(', ')}]`);

      const cleanedRows = rawRows
        .map((row) => {
          const rawTitle = (
            row['Title'] ||
            row['title'] ||
            row['Name'] ||
            row['name'] ||
            row['Anime'] ||
            row['anime'] ||
            row['Anime Title'] ||
            row['anime_title'] ||
            row['Series'] ||
            row['series'] ||
            row['Title (English)'] ||
            Object.values(row)[0] ||
            ''
          )
            .toString()
            .trim();

          const rawPoster = (
            row['Cover Image'] ||
            row['cover_image'] ||
            row['Poster'] ||
            row['poster_url'] ||
            row['Poster URL'] ||
            row['Image'] ||
            row['image'] ||
            ''
          )
            .toString()
            .trim();

          const rawLanguages =
            row['Languages'] || row['languages'] || row['Language'] || row['language'] || row['Dub'] || row['dub'] || '';
          const rawGenres = row['Genres'] || row['genres'] || row['Genre'] || row['genre'] || '';
          const rawSeasons = row['Seasons'] || row['seasons'] || '';

          const mixedEntries =
            typeof rawSeasons === 'string' && rawSeasons.trim().length > 0
              ? rawSeasons
                  .split('|')
                  .map((entry) => {
                    const [name, eps] = entry.split(':');
                    return {
                      type: 'Season',
                      name: name ? name.trim() : '',
                      episodes: parseInt(eps || '', 10) || null,
                    };
                  })
                  .filter((e) => e.name !== '')
              : [];

          const parsedYear = parseInt(row['Release Year'] || row['year'] || row['Year'] || row['release_year'] || '', 10) || null;
          const parsedEpisodes = parseInt(row['Episodes'] || row['episodes'] || row['episodes_count'] || '', 10) || null;
          const parsedRating =
            parseFloat(row['Ratings'] || row['ratings'] || row['Rating'] || row['rating'] || row['Score'] || '') || null;
          const status = String(row['Status'] || row['status'] || '')
            .toLowerCase()
            .includes('complete')
            ? 'Completed'
            : 'Airing';

          return {
            title: rawTitle,
            poster_url: rawPoster,
            cover_image: rawPoster,
            year: parsedYear,
            languages: rawLanguages
              .split('|')
              .map((l) => l.trim())
              .filter(Boolean),
            genres: rawGenres
              .split('|')
              .map((g) => g.trim())
              .filter(Boolean),
            studio: (row['Studio'] || row['studio'] || '').toString().trim(),
            type: (row['Type'] || row['type'] || 'TV Series').toString().trim(),
            status,
            airing_status: status,
            episodes: parsedEpisodes,
            episodes_count: parsedEpisodes || 12,
            platform: (row['Platform'] || row['platform'] || '').toString().trim(),
            rating: parsedRating,
            synopsis: (row['Synopsis'] || row['synopsis'] || row['Description'] || row['description'] || '').toString().trim(),
            approval_status: 'pending',
            submissionStatus: 'pending',
            is_published: false,
            mixed_entries: mixedEntries,
            mixedEntries,
            episodes_per_season:
              mixedEntries.length > 0
                ? mixedEntries.map((m) => m.episodes || 12).join('|')
                : String(parsedEpisodes || 12),
            slug: (rawTitle || 'untitled')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, ''),
          };
        })
        .filter((r) => Boolean(r.title && r.slug !== 'untitled'));

      addTerminalLog('CSV', `Cleaned ${cleanedRows.length} valid rows from CSV file.`);

      const normalizeStr = (s: unknown) =>
        String(s || '')
          .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
          .replace(/["'“”‘’]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      const simplifyKey = (s: unknown) => normalizeStr(s).replace(/[^a-z0-9]/g, '');

      const existingTitleSet = new Set<string>();
      const existingKeySet = new Set<string>();

      catalog.forEach((c) => {
        if (c?.title) {
          existingTitleSet.add(normalizeStr(c.title));
          existingKeySet.add(simplifyKey(c.title));
        }
      });

      pendingItems.forEach((p) => {
        if (p?.title) {
          existingTitleSet.add(normalizeStr(p.title));
          existingKeySet.add(simplifyKey(p.title));
        }
      });

      const clientSkippedTitles: string[] = [];
      const clientFilteredRows: typeof cleanedRows = [];
      const seenInUpload = new Set<string>();
      const seenKeysInUpload = new Set<string>();

      for (const row of cleanedRows) {
        const norm = normalizeStr(row.title);
        const key = simplifyKey(row.title);
        if (!norm || !key) continue;

        const isDuplicate =
          existingTitleSet.has(norm) ||
          existingKeySet.has(key) ||
          seenInUpload.has(norm) ||
          seenKeysInUpload.has(key);
        if (isDuplicate) {
          clientSkippedTitles.push(row.title);
          continue;
        }

        seenInUpload.add(norm);
        seenKeysInUpload.add(key);
        clientFilteredRows.push(row);
      }

      if (clientFilteredRows.length === 0) {
        const allExistingMsg = `All ${clientSkippedTitles.length} anime already exist in the database! Skipped: ${clientSkippedTitles.slice(0, 3).join(', ')}${clientSkippedTitles.length > 3 ? ` (+${clientSkippedTitles.length - 3} more)` : ''}. 0 added to pending.`;
        setImportedCount(0);
        setShowImportToast(true);
        setSuccessMsg(allExistingMsg);
        addTerminalLog(
          'REJ',
          `[DEDUPLICATION] All ${clientSkippedTitles.length} anime already exist in catalog or pending queue: ${clientSkippedTitles.join(', ')}`
        );
        setActiveAdminTab('pending');
        setTimeout(() => {
          setShowImportToast(false);
          setSuccessMsg('');
        }, 7000);
        return;
      }

      const res = await cloudflareApi.uploadCSV({ animeList: clientFilteredRows });
      const backendAdded = res.insertedCount !== undefined ? res.insertedCount : res.count || clientFilteredRows.length;
      const backendSkipped = res.skippedCount !== undefined ? res.skippedCount : 0;
      const totalAdded = backendAdded;
      const totalSkipped = clientSkippedTitles.length + backendSkipped;
      const allSkippedTitles = Array.from(new Set([...clientSkippedTitles, ...(res.skippedTitles || [])]));

      const feedbackMsg = `Upload complete: ${totalAdded} added to pending queue, ${totalSkipped} existing titles rejected.`;

      setImportedCount(totalAdded);
      setShowImportToast(true);
      setSuccessMsg(feedbackMsg);
      addTerminalLog('OK', feedbackMsg);

      if (allSkippedTitles.length > 0) {
        addTerminalLog(
          'REJ',
          `Rejected existing/duplicate anime: ${allSkippedTitles.slice(0, 8).join(', ')}${allSkippedTitles.length > 8 ? ` (+${allSkippedTitles.length - 8} more)` : ''}`
        );
      }

      await fetchAnime();
      await fetchPendingItems();
      setActiveAdminTab('pending');
      if (onAnimeCreated) onAnimeCreated();

      setTimeout(() => {
        setShowImportToast(false);
        setSuccessMsg('');
      }, 7000);
    } catch (err) {
      console.error('[CSV Import Error]:', err);
      const errMsg = err instanceof Error ? err.message : 'CSV parsing error';
      setSuccessMsg(`CSV Import Failed: ${errMsg}`);
      addTerminalLog('ERR', `[IMPORT ERROR] ${errMsg}`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportCsv = () => {
    const headers =
      'Title,Type,Status,Studio,Release Year,Rating,Genres,Synopsis,Streaming Partners,Languages,Episodes,Cover Image\n';
    const rows = catalog
      .map((a) => {
        const clean = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
        return `${clean(a.title)},${clean(a.type || a.Type || 'TV Series')},${clean(a.status || a.airing_status || 'Airing')},${clean(a.studio || '')},${clean(a.year || a.release_year || 2024)},${clean(a.rating || 8.5)},${clean(a.genres || a.genre || '')},${clean(a.synopsis || a.description || '')},${clean(a.platform || 'Crunchyroll')},${clean(formatLanguageText(a.languages))},${clean(a.episodes_per_season || a.episodes_count || 12)},${clean(a.cover_image || a.poster_url || '')}`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anidub_india_catalog_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFullJson = () => {
    const jsonStr = JSON.stringify(catalog, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anidub_india_full_backup_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const templateContent =
      'Title,Cover Image,Release Year,Languages,Genres,Studio,Type,Status,Episodes,Platform,Ratings,Synopsis,Seasons\n' +
      'Solo Leveling,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2024,Tamil|Telugu|Hindi,Action|Fantasy,A-1 Pictures,TV Series,Completed,12,Crunchyroll,8.5,"In a world where hunters must battle deadly monsters, a weak hunter gets a second chance to level up.","Season 1:12"\n' +
      'Demon Slayer: Hashira Training,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2024,Tamil|Hindi,Action|Supernatural,Ufotable,TV Series,Airing,8,Crunchyroll,8.9,"Tanjiro goes to see the Stone Hashira, Himejima, who intends to prepare him for the battles to come.","Season 1:26|Season 2:11|Season 3:11|Season 4:8"\n' +
      'Dr. Stone,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2019,Tamil|Telugu|Malayalam,Sci-Fi|Adventure,TMS Entertainment,TV Series,Completed,24,Crunchyroll,8.1,"After a blinding green light strikes the Earth, humanity is turned to stone.","Season 1:24|Season 2:11|Season 3:22"\n';
    const blob = new Blob([templateContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'anidub_catalog_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyHeaders = () => {
    const headers = 'Title,Cover Image,Release Year,Languages,Genres,Studio,Type,Status,Episodes,Platform,Ratings,Synopsis,Seasons';
    navigator.clipboard.writeText(headers);
    setHasCopiedHeaders(true);
    setTimeout(() => setHasCopiedHeaders(false), 2500);
  };

  const handleCopySnippet = () => {
    const sample = `Title,Cover Image,Release Year,Languages,Genres,Studio,Type,Status,Episodes,Platform,Ratings,Synopsis,Seasons
Solo Leveling,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2024,Tamil|Telugu|Hindi,Action|Fantasy,A-1 Pictures,TV Series,Completed,12,Crunchyroll,8.5,"In a world where hunters must battle deadly monsters, a weak hunter gets a second chance to level up.","Season 1:12"
Demon Slayer: Hashira Training,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2024,Tamil|Hindi,Action|Supernatural,Ufotable,TV Series,Airing,8,Crunchyroll,8.9,"Tanjiro goes to see the Stone Hashira, Himejima, who intends to prepare him for the battles to come.","Season 1:26|Season 2:11|Season 3:11|Season 4:8"
Dr. Stone,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2019,Tamil|Telugu|Malayalam,Sci-Fi|Adventure,TMS Entertainment,TV Series,Completed,24,Crunchyroll,8.1,"After a blinding green light strikes the Earth, humanity is turned to stone.","Season 1:24|Season 2:11|Season 3:22"`;
    navigator.clipboard.writeText(sample);
    setHasCopiedSnippet(true);
    setTimeout(() => setHasCopiedSnippet(false), 2500);
  };

  const handleRunHealthCheck = async (targetAnimeId?: number | string) => {
    setIsCheckingHealth(true);
    setIsTerminalOpen(true);
    addTerminalLog('SYS', '=== [HEALTH PROBE INITIALIZED: OMDb & IMDb Auditor v4.5] ===');

    const itemsToProbe = targetAnimeId
      ? catalog.filter((a) => a.id === targetAnimeId || String(a.id) === String(targetAnimeId))
      : catalog && catalog.length > 0
        ? catalog
        : [];

    if (itemsToProbe.length === 0) {
      addTerminalLog('WARN', 'Catalog empty in active memory. Refetching from Cloudflare Edge...');
      await fetchAnime();
    }

    addTerminalLog('PROBE', `Beginning live audit across ${itemsToProbe.length} title(s)...`);

    const collectedCorrections: RatingCorrection[] = [];

    for (const anime of itemsToProbe) {
      const currentRatingNum = Number(parseFloat(String(anime.rating || 0)).toFixed(1));
      addTerminalLog('PROBE', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      addTerminalLog('PROBE', `Auditing #${anime.id}: '${anime.title}' | Current DB Rating: ${currentRatingNum}`);

      const normTitle = (anime.title || '').toLowerCase().trim();
      const matchedKnownKey = Object.keys(KNOWN_IMDB_MAP).find(
        (k) => normTitle.includes(k) || k.includes(normTitle)
      );
      const knownInfo = matchedKnownKey ? KNOWN_IMDB_MAP[matchedKnownKey] : null;

      let resolvedScore: number | null = null;
      let resolvedImdbId = anime.imdbID || anime.imdb_id || anime.imdbId || '';
      let lastOmdbError = '';

      const directCandidateIds: string[] = [];
      if (resolvedImdbId) directCandidateIds.push(resolvedImdbId);
      if (knownInfo) {
        if (knownInfo.id && !directCandidateIds.includes(knownInfo.id)) {
          directCandidateIds.push(knownInfo.id);
        }
        if (knownInfo.alternateIds) {
          for (const alt of knownInfo.alternateIds) {
            if (!directCandidateIds.includes(alt)) directCandidateIds.push(alt);
          }
        }
      }

      if (directCandidateIds.length > 0) {
        addTerminalLog('PROBE', `[IMDb ID DIRECT LOOKUP] Candidate ID pool: [${directCandidateIds.join(', ')}]`);
        for (const candId of directCandidateIds) {
          try {
            const reqUrl = `/api/omdb?i=${encodeURIComponent(candId)}`;
            const startT = Date.now();
            addTerminalLog('EDGE', `[API REQ] GET ${reqUrl}`);
            const res = await fetch(reqUrl);
            const latency = Date.now() - startT;
            const data = (await res.json()) as {
              Response?: string;
              imdbRating?: string;
              imdbID?: string;
              Title?: string;
              Year?: string;
              Error?: string;
            };
            addTerminalLog('EDGE', `[API RES] HTTP ${res.status} ${res.statusText} (${latency}ms) -> Response: "${data.Response}"`);

            if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
              resolvedScore = parseFloat(data.imdbRating);
              resolvedImdbId = data.imdbID || candId;
              addTerminalLog('OK', `[OMDb MATCH] "${data.Title}" (${data.Year}) | IMDb: ${resolvedScore}/10 | ID: ${resolvedImdbId}`);
              break;
            } else {
              lastOmdbError = data.Error || JSON.stringify(data);
              addTerminalLog('WARN', `[OMDb NO MATCH] Candidate ID ${candId}: ${lastOmdbError}`);
            }
          } catch (e) {
            lastOmdbError = e instanceof Error ? e.message : String(e);
            addTerminalLog('ERR', `[FETCH ERROR] ID lookup for ${candId} failed: ${lastOmdbError}`);
          }
        }
      }

      if (resolvedScore === null) {
        const queryCandidates = getCleanOmdbQueryTitles(knownInfo?.fallbackTitle || anime.title);
        addTerminalLog('PROBE', `[FUZZY TITLE SEARCH] Candidate variations: [${queryCandidates.map((c) => `"${c}"`).join(', ')}]`);

        for (const queryStr of queryCandidates) {
          try {
            const reqUrl = `/api/omdb?t=${encodeURIComponent(queryStr)}`;
            const startT = Date.now();
            addTerminalLog('EDGE', `[API REQ] GET ${reqUrl}`);
            const res = await fetch(reqUrl);
            const latency = Date.now() - startT;
            const data = (await res.json()) as {
              Response?: string;
              imdbRating?: string;
              imdbID?: string;
              Title?: string;
              Year?: string;
              Error?: string;
            };
            addTerminalLog('EDGE', `[API RES] HTTP ${res.status} ${res.statusText} (${latency}ms) -> Response: "${data.Response}"`);

            if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
              resolvedScore = parseFloat(data.imdbRating);
              resolvedImdbId = data.imdbID || resolvedImdbId;
              addTerminalLog('OK', `[OMDb MATCH] "${data.Title}" (${data.Year}) | IMDb: ${resolvedScore}/10 | ID: ${data.imdbID || 'N/A'}`);
              break;
            } else {
              lastOmdbError = data.Error || JSON.stringify(data);
              addTerminalLog('WARN', `[OMDb NO MATCH] Query "${queryStr}": ${lastOmdbError}`);
            }
          } catch (err) {
            lastOmdbError = err instanceof Error ? err.message : String(err);
            addTerminalLog('ERR', `[FETCH ERROR] Query "${queryStr}": ${lastOmdbError}`);
          }
        }
      }

      if (resolvedScore === null && knownInfo?.benchmarkRating) {
        resolvedScore = knownInfo.benchmarkRating;
        resolvedImdbId = knownInfo.id;
        addTerminalLog('OK', `[BENCHMARK MATCH] "${knownInfo.fallbackTitle}" | IMDb: ${resolvedScore}/10 | ID: ${resolvedImdbId}`);
      }

      if (resolvedScore !== null && !isNaN(resolvedScore)) {
        const localRating = Number(parseFloat(String(anime.rating || 0)).toFixed(1));
        const targetRating = Number(resolvedScore.toFixed(1));

        if (localRating !== targetRating) {
          addTerminalLog('PROBE', `[MISMATCH FOUND] Action required for '${anime.title}': Local DB ${localRating} != Real IMDb ${targetRating}`);
          collectedCorrections.push({
            anime,
            currentLocalRating: localRating,
            realImdbRating: targetRating,
            imdbID: resolvedImdbId,
          });
        } else {
          addTerminalLog('OK', `[VERIFIED SYNC] '${anime.title}': Local DB rating (${localRating}) matches IMDb (${targetRating}). No action required.`);
        }
      } else {
        addTerminalLog('WARN', `[SKIPPED] '${anime.title}': Could not verify IMDb score. OMDb status: ${lastOmdbError || 'Unknown'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setIsCheckingHealth(false);
    setPendingCorrections(collectedCorrections);
    addTerminalLog('SYS', `=== [PROBE AUDIT COMPLETE] Audited: ${itemsToProbe.length} title(s) | Mismatches Found: ${collectedCorrections.length} pending admin approval ===`);
    setSuccessMsg(`IMDb health probe complete: ${collectedCorrections.length} mismatch(es) found requiring admin approval.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleApproveCorrection = async (correction: RatingCorrection) => {
    const { anime, realImdbRating, imdbID } = correction;
    addTerminalLog('MUT', `[ADMIN APPROVAL] Pushing update for '${anime.title}' (${correction.currentLocalRating} -> ${realImdbRating}) to Cloudflare D1...`);
    try {
      const updatedPayload = {
        ...anime,
        rating: realImdbRating,
        imdbID: imdbID || anime.imdbID || anime.imdb_id,
        imdb_id: imdbID || anime.imdbID || anime.imdb_id,
        id: anime.id,
      };
      await cloudflareApi.updateAnime(anime.id, updatedPayload);

      setCatalog((prev) =>
        prev.map((item) =>
          item.id === anime.id || String(item.id) === String(anime.id)
            ? { ...item, rating: realImdbRating, imdbID }
            : item
        )
      );
      setPendingCorrections((prev) => prev.filter((c) => c.anime.id !== anime.id));
      addTerminalLog('OK', `[SUCCESS] Admin approved update for '${anime.title}'`);
      setSuccessMsg(`Approved & pushed rating update for ${anime.title}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      if (typeof onAnimeCreated === 'function') onAnimeCreated();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addTerminalLog('ERR', `[ERROR] Failed updating #${anime.id}: ${errMsg}`);
      setSuccessMsg(`Failed to push update for ${anime.title}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleApproveAllCorrections = async () => {
    for (const correction of [...pendingCorrections]) {
      await handleApproveCorrection(correction);
    }
  };

  // --- DYNAMIC DASHBOARD CALCULATIONS ---
  const totalUpvotes = catalog.reduce((acc, a) => acc + (Number(a.popularity) || 0), 0);
  const verifiedLinks = catalog.filter((a) => a.platform).length;

  const langStats = catalog.reduce(
    (acc, anime) => {
      const langs = formatLanguageText(anime.languages)
        .split(',')
        .map((l) => l.trim().toUpperCase());
      if (langs.length === 0 || (langs.length === 1 && langs[0] === '')) {
        acc.Hindi += 1;
        acc.Tamil += 1;
        acc.Telugu += 1;
      } else {
        langs.forEach((l) => {
          if (l.includes('HIN')) acc.Hindi += 1;
          else if (l.includes('TAM')) acc.Tamil += 1;
          else if (l.includes('TEL')) acc.Telugu += 1;
          else {
            acc.Hindi += 1;
            acc.Tamil += 1;
            acc.Telugu += 1;
          }
        });
      }
      return acc;
    },
    { Hindi: 0, Tamil: 0, Telugu: 0 }
  );

  const totalLangs = langStats.Hindi + langStats.Tamil + langStats.Telugu;
  const hPct = totalLangs > 0 ? Math.round((langStats.Hindi / totalLangs) * 100) : 0;
  const tPct = totalLangs > 0 ? Math.round((langStats.Tamil / totalLangs) * 100) : 0;
  const tePct = totalLangs > 0 ? Math.max(100 - hPct - tPct, 0) : 0;

  const genreMap = catalog.reduce<Record<string, number>>((acc, anime) => {
    const gs = (anime.genres || '').split(',').map((g) => g.trim());
    gs.forEach((g) => {
      if (g) acc[g] = (acc[g] || 0) + 1;
    });
    return acc;
  }, {});

  const sortedGenres: GenreStatBar[] = Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([genre, count]) => ({
      genre,
      count,
      height: catalog.length > 0 ? `${Math.max(Math.round((count / catalog.length) * 100), 10)}%` : '10%',
    }));

  const pendingCount = pendingItems.length;

  const filteredCatalog = catalog.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const title = String(a.title || '').toLowerCase();
    const id = String(a.id || '');
    const langs = formatLanguageText(a.languages).toLowerCase();
    const genres = String(a.genres || '').toLowerCase();
    const studio = String(a.studio || '').toLowerCase();
    const platform = String(a.platform || '').toLowerCase();
    const status = String(a.status || a.airing_status || '').toLowerCase();
    return (
      title.includes(q) ||
      id.includes(q) ||
      langs.includes(q) ||
      genres.includes(q) ||
      studio.includes(q) ||
      platform.includes(q) ||
      status.includes(q)
    );
  });

  const filteredPendingItems = pendingItems.filter((item) => {
    if (!pendingSearchQuery.trim()) return true;
    const q = pendingSearchQuery.toLowerCase().trim();
    const title = String(item.title || '').toLowerCase();
    const id = String(item.id || '');
    const langs = formatLanguageText(item.languages).toLowerCase();
    const studio = String(item.studio || '').toLowerCase();
    const platform = String(item.platform || '').toLowerCase();
    const genres = String(item.genres || '').toLowerCase();
    return (
      title.includes(q) ||
      id.includes(q) ||
      langs.includes(q) ||
      studio.includes(q) ||
      platform.includes(q) ||
      genres.includes(q)
    );
  });

  const handleSaveEdit = async (editedData: AdminAnimeRecord) => {
    if (!editedData) return;
    const targetId = editedData.id || editingAnime?.id;
    const resolvedImage = editedData.posterUrl || editedData.image || editedData.cover_image || editedData.poster;
    const resolvedType = editedData.type || editedData.Type || editingAnime?.type || 'TV Series';
    const rawStatusStr = String(editedData.status || editedData.airing_status || '').trim().toLowerCase();
    const resolvedStatus = rawStatusStr.includes('complete')
      ? 'Completed'
      : resolvedType === 'Movie'
        ? 'Completed'
        : 'Airing';

    const partnerSources =
      editedData.streaming_partners ||
      editedData.platforms_data ||
      editingAnime?.streaming_partners ||
      editingAnime?.platforms_data;
    const partnersArray = Array.isArray(partnerSources)
      ? partnerSources.map((p) => ({
          ...p,
          url: p.url ? String(p.url).trim() : '',
        }))
      : [];

    const fullEditedData: AdminAnimeRecord = {
      ...editedData,
      id: targetId || editedData.id,
      type: resolvedType,
      Type: resolvedType,
      status: resolvedStatus,
      airing_status: resolvedStatus,
      image: editedData.posterUrl || editedData.image || resolvedImage,
      cover_image: editedData.posterUrl || editedData.cover_image || resolvedImage,
      poster: editedData.posterUrl || editedData.poster || resolvedImage,
      posterUrl: editedData.posterUrl || resolvedImage,
      poster_url: editedData.posterUrl || resolvedImage,
      streaming_partners: partnersArray,
      platforms_data: partnersArray,
      watch_url:
        editedData.watch_url !== undefined
          ? String(editedData.watch_url).trim()
          : editingAnime?.watch_url
            ? String(editingAnime.watch_url).trim()
            : '',
      platform: editedData.platform || editingAnime?.platform || 'Crunchyroll',
      mixed_entries:
        editedData.mixed_entries !== undefined
          ? editedData.mixed_entries
          : editedData.mixedEntries !== undefined
            ? editedData.mixedEntries
            : editingAnime?.mixed_entries || editingAnime?.mixedEntries || [],
      mixedEntries:
        editedData.mixedEntries !== undefined
          ? editedData.mixedEntries
          : editedData.mixed_entries !== undefined
            ? editedData.mixed_entries
            : editingAnime?.mixedEntries || editingAnime?.mixed_entries || [],
      episodes_per_season:
        editedData.episodes_per_season !== undefined
          ? editedData.episodes_per_season
          : editingAnime?.episodes_per_season || '',
    };

    setCatalog((prev) => {
      const exists = Boolean(targetId) && prev.some((item) => item.id === targetId || String(item.id) === String(targetId));
      const updated = exists
        ? prev.map((item) =>
            item.id === targetId || String(item.id) === String(targetId)
              ? { ...item, ...fullEditedData, image: editedData.posterUrl || editedData.image || resolvedImage }
              : item
          )
        : [fullEditedData, ...prev];
      try {
        localStorage.setItem('cf_admin_catalog_cache', JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });

    if (targetId) {
      setPendingItems((prev) =>
        prev.map((item) =>
          item.id === targetId || String(item.id) === String(targetId)
            ? { ...item, ...fullEditedData, image: editedData.posterUrl || editedData.image || resolvedImage }
            : item
        )
      );
    }

    if (onAnimeCreated) {
      onAnimeCreated(fullEditedData);
    }

    setCloudSyncing(true);
    setCloudStatusText(`Saving #${targetId || 'new'} to Cloudflare D1...`);
    addTerminalLog('MUT', `Pushed update for #${targetId || 'new'} (${fullEditedData.title}) to Edge`);
    try {
      if (targetId) {
        await cloudflareApi.updateAnime(targetId, fullEditedData);
        setSuccessMsg('Changes saved to Cloudflare D1.');
        addTerminalLog('OK', `Cloudflare D1 updated entry #${targetId}`);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
      await fetchAnime();
    } catch (err) {
      console.warn('Notice saving edit to Cloudflare D1:', err);
      addTerminalLog('WARN', `Edge warning saving edit #${targetId || 'new'}`);
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const commandPaletteResults = React.useMemo(() => {
    const q = commandPaletteQuery.toLowerCase().trim();
    const navItems: CommandPaletteNavItem[] = [
      { id: 'nav-overview', title: 'Dashboard Overview', desc: 'System metrics & telemetry charts', tab: 'overview', icon: Sliders },
      { id: 'nav-pending', title: `Community Pending Queue (${pendingCount})`, desc: 'Review & approve regional dub submissions', tab: 'pending', icon: Inbox },
      { id: 'nav-catalog', title: `Anime Catalog Matrix (${catalog.length})`, desc: 'Manage anime records on Cloudflare D1', tab: 'catalog', icon: Database },
      { id: 'nav-feedback', title: `User Feedback Reports (${feedbackList.length})`, desc: 'Issue reports & requests from users', tab: 'feedback', icon: Inbox },
      { id: 'nav-health', title: 'IMDb & Diagnostics Probe', desc: 'Missing streaming links & rating health', tab: 'data_health', icon: Shield },
      { id: 'nav-analytics', title: 'Cloudflare Edge Analytics', desc: 'Worker latency, hit rates & bandwidth', tab: 'analytics', icon: Activity },
      { id: 'nav-settings', title: 'Cloud Infrastructure & D1', desc: 'Worker bindings, backups & purges', tab: 'settings', icon: HardDrive },
    ];

    const actionItems: CommandPaletteActionItem[] = [
      {
        id: 'act-add',
        title: 'Add New Anime to Catalog',
        desc: 'Insert new entry to Cloudflare D1',
        icon: Plus,
        action: () => {
          setModalMode('submit');
          setEditingAnime(null);
          setIsDubModalOpen(true);
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-refresh',
        title: 'Sync Live Cloudflare D1 Records',
        desc: 'Refetch all database rows from edge worker',
        icon: RefreshCw,
        action: () => {
          fetchAnime();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-term',
        title: 'Toggle Live System Terminal',
        desc: 'Open simulated CLI & matrix logs stream',
        icon: Terminal,
        action: () => {
          setIsTerminalOpen((prev) => !prev);
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-health',
        title: 'Run Diagnostic Health Scanner',
        desc: 'Scan missing links & ratings',
        icon: ShieldAlert,
        action: () => {
          setActiveAdminTab('data_health');
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-json',
        title: 'Download Full JSON Snapshot',
        desc: 'Complete offline backup file',
        icon: Download,
        action: () => {
          handleExportFullJson();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-csv',
        title: 'Export Anime Catalog to CSV',
        desc: 'Spreadsheet compatible export',
        icon: FileSpreadsheet,
        action: () => {
          handleExportCsv();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-csv-guide',
        title: 'CSV Header & Pipe Format Guide',
        desc: 'View required 13 headers, pipe (|) rules & season syntax',
        icon: HelpCircle,
        action: () => {
          setShowCsvHelpModal(true);
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-csv-template',
        title: 'Download CSV Import Template',
        desc: 'Pre-formatted template with pipe delimiters & seasons',
        icon: Download,
        action: () => {
          handleDownloadTemplate();
          setIsCommandPaletteOpen(false);
        },
      },
    ];

    if (!q) {
      return {
        actions: actionItems,
        nav: navItems,
        animes: catalog.slice(0, 4),
      };
    }

    return {
      actions: actionItems.filter((a) => a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)),
      nav: navItems.filter((n) => n.title.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q)),
      animes: catalog
        .filter(
          (a) =>
            (a.title && a.title.toLowerCase().includes(q)) ||
            (a.hindiTitle && a.hindiTitle.toLowerCase().includes(q)) ||
            formatLanguageText(a.languages).toLowerCase().includes(q) ||
            (a.genres && a.genres.toLowerCase().includes(q)) ||
            String(a.id).includes(q)
        )
        .slice(0, 6),
    };
  }, [commandPaletteQuery, catalog, pendingCount, feedbackList.length]);

  if (!isClerkAdminAuthorized) {
    return (
      <div className="w-full min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-[#121829] border border-purple-500/30 p-8 shadow-2xl text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Protected Admin Route</h2>
            <p className="text-xs text-neutral-400">
              Only the authorized Clerk Administrator can access <code className="text-purple-400">/admin</code>.
            </p>
          </div>
          {!isSignedIn && (
            <div className="flex justify-center">
              <SignIn />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else window.location.href = '/';
            }}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const navItemsConfig = [
    { id: 'overview' as const, label: 'Overview', icon: Sliders },
    { id: 'pending' as const, label: 'Pending Reviews', count: pendingCount, icon: Inbox },
    { id: 'catalog' as const, label: 'Anime Catalog', count: catalog.length, icon: Database },
    { id: 'feedback' as const, label: 'User Feedback', count: feedbackList.length, icon: Inbox },
    { id: 'data_health' as const, label: 'IMDb & Diagnostics', icon: Shield },
    { id: 'analytics' as const, label: 'Edge Analytics', icon: Activity },
    { id: 'settings' as const, label: 'Cloud Infrastructure', icon: HardDrive },
  ];

  return (
    <div className="w-full min-h-screen bg-[#07090e] text-slate-100 flex flex-col md:flex-row font-sans relative selection:bg-purple-500 selection:text-white overflow-x-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="fixed top-[-120px] left-[-120px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-[25%] right-[-140px] w-[550px] h-[550px] bg-cyan-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed bottom-[-140px] left-[25%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-white/10 bg-[#080c16]/95 backdrop-blur-2xl transition-all duration-300 relative z-30 sticky top-0 h-screen overflow-y-auto ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {isSidebarCollapsed ? <AniDubLogo variant="icon" size="sm" /> : <AniDubLogo variant="horizontal" size="sm" />}
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-[10px] font-black tracking-[0.2em] uppercase text-white/40 truncate">ADMIN CONSOLE</div>
                <div className="text-[9px] text-cyan-400 font-mono tracking-tight flex items-center gap-1 mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span>v4.2 PRO</span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className={`w-full rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/50 text-neutral-300 hover:text-white transition-all duration-200 cursor-pointer flex items-center gap-2 group ${
              isSidebarCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2 justify-between'
            }`}
            title="Open Command Palette (Ctrl+K)"
          >
            <div className="flex items-center gap-2">
              <Command className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              {!isSidebarCollapsed && <span className="text-xs font-medium text-neutral-300">Command Palette</span>}
            </div>
            {!isSidebarCollapsed && (
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-neutral-400 border border-white/15">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItemsConfig.map((item) => {
            const isActive = activeAdminTab === item.id;
            const IconComp = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveAdminTab(item.id)}
                className={`w-full rounded-xl transition-colors duration-200 flex items-center gap-3 cursor-pointer group relative ${
                  isSidebarCollapsed ? 'p-3 justify-center' : 'px-3.5 py-2.5 justify-between'
                } ${isActive ? 'text-white font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'}`}
                title={item.label}
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-sidebar-active-tab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.35)] border border-purple-400/40 -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-purple-300'}`} />
                  {!isSidebarCollapsed && <span className="text-xs truncate tracking-tight">{item.label}</span>}
                </div>
                {!isSidebarCollapsed && item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive ? 'bg-purple-900/90 text-purple-200 border border-purple-400/30' : 'bg-white/10 text-neutral-300'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                {isSidebarCollapsed && item.count !== undefined && item.count > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-[#080c16]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setIsTerminalOpen((prev) => !prev)}
            className={`w-full rounded-xl bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400/60 p-2.5 transition-all duration-200 cursor-pointer flex items-center gap-2.5 text-left group ${
              isSidebarCollapsed ? 'justify-center' : 'justify-between'
            }`}
            title="Open Simulated System Terminal"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
                <Terminal className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-[11px] font-mono font-bold text-white flex items-center gap-1.5">
                    <span>SYS TERMINAL</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="text-[9px] text-cyan-400 font-mono truncate">LIVE LOG MATRIX</div>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <ChevronRight className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </div>

        <div className="p-3 border-t border-white/10 bg-black/20">
          <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'flex-col' : 'justify-between'}`}>
            <button
              onClick={() => {
                if (onNavigateHome) onNavigateHome();
                else window.location.href = '/';
              }}
              className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
              title="Return to Public Directory"
            >
              <Globe className="w-4 h-4 text-purple-400" />
              {!isSidebarCollapsed && <span className="text-xs">Public App</span>}
            </button>
            <button
              onClick={() => {
                if (onLogout) onLogout();
                else window.location.href = '/';
              }}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer flex items-center gap-2"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              {!isSidebarCollapsed && <span className="text-xs">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-10 relative">
        <header className="sticky top-0 z-30 bg-[#07090e]/85 backdrop-blur-2xl border-b border-white/10 px-4 sm:px-6 py-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative group shrink-0 md:hidden">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
                <div className="relative w-9 h-9 rounded-xl bg-[#0e121e] border border-white/20 flex items-center justify-center text-white">
                  <Zap className="w-4 h-4 text-cyan-300 fill-cyan-400/40" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    <span className="bg-gradient-to-r from-white via-slate-100 to-purple-200 bg-clip-text text-transparent">
                      Admin Command Console
                    </span>
                  </h1>
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-mono tracking-wider uppercase font-semibold">
                      Superadmin
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono flex items-center gap-1.5 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>Cloudflare Edge D1</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-neutral-400 truncate hidden lg:block">
                    Regional Indian dubs moderation, Cloudflare D1 persistence &amp; IMDb telemetry
                  </p>
                  {cloudSyncing && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-cyan-400 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      <span>{cloudStatusText || 'Syncing with Edge...'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-purple-400/50 text-neutral-300 hover:text-white flex items-center gap-2 text-xs font-medium transition-all duration-200 cursor-pointer shadow-sm group"
                title="Open Global Command Palette (Ctrl+K)"
              >
                <Command className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-white/10 text-[9px] font-mono text-neutral-400 border border-white/15">
                  ⌘K
                </kbd>
              </button>

              <button
                onClick={() => setIsTerminalOpen((prev) => !prev)}
                className={`h-9 px-3 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                  isTerminalOpen
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-neutral-300 hover:text-white'
                }`}
                title="Toggle System Terminal"
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">CLI</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </button>

              <button
                onClick={fetchAnime}
                className="h-9 w-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-400/50 text-neutral-300 hover:text-white flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                title="Refresh database records"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>

              <button
                onClick={() => {
                  if (onNavigateHome) onNavigateHome();
                  else window.location.href = '/';
                }}
                className="h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-purple-400/50 text-neutral-200 hover:text-white text-xs font-semibold hidden md:inline-flex items-center gap-1.5 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span>Public App</span>
              </button>

              <button
                onClick={() => {
                  if (onLogout) onLogout();
                  else window.location.href = '/';
                }}
                className="h-9 w-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-400/50 text-rose-400 hover:text-rose-200 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer md:hidden"
                title="Logout from admin session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-w-6xl mx-auto mt-3 pt-2 border-t border-white/5 md:hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {navItemsConfig.map((tab) => {
                const isActive = activeAdminTab === tab.id;
                const IconComp = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAdminTab(tab.id)}
                    className={`relative h-9 px-3.5 rounded-xl text-xs font-medium transition-colors shrink-0 flex items-center gap-2 cursor-pointer pb-2 ${
                      isActive ? 'text-white font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {IconComp && <IconComp className="w-3.5 h-3.5" />}
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive ? 'bg-purple-900/90 text-purple-200 border border-purple-400/30' : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="admin-mobile-tab-underline"
                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-400 via-cyan-400 to-indigo-400 rounded-full"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto w-full px-4 pt-4 relative z-10">
          {showImportToast && (
            <div className="rounded-2xl p-4 bg-emerald-950/70 backdrop-blur-xl border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.2)] flex items-center justify-between text-emerald-200 text-xs font-semibold mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                </div>
                <span>Import complete: Successfully synchronized {importedCount} anime entries to moderation queue.</span>
              </div>
              <button onClick={() => setShowImportToast(false)} className="text-emerald-400 hover:text-white transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl p-4 bg-purple-950/70 backdrop-blur-xl border border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.2)] flex items-center justify-between text-purple-200 text-xs font-semibold mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-300" />
                </div>
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg('')} className="text-purple-400 hover:text-white transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {apiError && (
            <div className="rounded-2xl p-4 bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-semibold mb-4 flex flex-col gap-2 shadow-lg animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>Failed to reach anime catalog API. Operating in offline/cached session.</span>
              </div>
              {terminalLogs.length > 0 && terminalLogs[0].level === 'ERR' && (
                <div className="mt-1 p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] text-red-400 break-all">
                  {terminalLogs[0].msg}
                </div>
              )}
            </div>
          )}
        </div>

        <main className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeAdminTab}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full space-y-6"
            >
              {activeAdminTab === 'overview' && (
                <AdminOverviewTab
                  loading={loading}
                  catalogCount={catalog.length}
                  verifiedLinks={verifiedLinks}
                  pendingCount={pendingCount}
                  totalUpvotes={totalUpvotes}
                  hPct={hPct}
                  tPct={tPct}
                  tePct={tePct}
                  sortedGenres={sortedGenres}
                  shouldReduceMotion={shouldReduceMotion}
                  onTriggerFileUpload={() => fileInputRef.current?.click()}
                  onDownloadTemplate={handleDownloadTemplate}
                  onOpenCsvGuide={() => setShowCsvHelpModal(true)}
                  onSwitchTab={setActiveAdminTab}
                  onExportFullJson={handleExportFullJson}
                />
              )}

              {activeAdminTab === 'pending' && (
                <AdminPendingTab
                  pendingItems={pendingItems}
                  filteredPendingItems={filteredPendingItems}
                  pendingSearchQuery={pendingSearchQuery}
                  onPendingSearchChange={setPendingSearchQuery}
                  onClearPendingQueue={handleClearPendingQueue}
                  onApprovePending={handleApprovePending}
                  onEditPending={handleOpenEditModal}
                  onRejectPending={handleRejectPending}
                />
              )}

              {activeAdminTab === 'catalog' && (
                <AdminCatalogTab
                  loading={loading}
                  isImporting={isImporting}
                  catalogCount={catalog.length}
                  filteredCatalog={filteredCatalog}
                  searchQuery={searchQuery}
                  deletingId={deletingId}
                  onSearchChange={setSearchQuery}
                  onTriggerFileUpload={() => fileInputRef.current?.click()}
                  onExportCsv={handleExportCsv}
                  onOpenCsvHelp={() => setShowCsvHelpModal(true)}
                  onOpenAddModal={() => {
                    setModalMode('submit');
                    setEditingAnime(null);
                    setIsDubModalOpen(true);
                  }}
                  onOpenEditModal={handleOpenEditModal}
                  onDeleteAnime={handleDeleteCatalogAnime}
                />
              )}

              {activeAdminTab === 'data_health' && (
                <AdminDataHealthTab
                  isCheckingHealth={isCheckingHealth}
                  pendingCorrections={pendingCorrections}
                  terminalLogs={terminalLogs}
                  onRunHealthCheck={() => handleRunHealthCheck()}
                  onApproveCorrection={handleApproveCorrection}
                  onApproveAllCorrections={handleApproveAllCorrections}
                  onOpenTerminal={() => setIsTerminalOpen(true)}
                />
              )}

              {activeAdminTab === 'feedback' && (
                <AdminFeedbackTab feedbackList={feedbackList} onResolveFeedback={handleResolveFeedback} />
              )}

              {activeAdminTab === 'analytics' && (
                <Suspense
                  fallback={
                    <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center gap-3 text-xs text-neutral-400">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      <span>Loading analytics module...</span>
                    </div>
                  }
                >
                  <AnalyticsDashboard />
                </Suspense>
              )}

              {activeAdminTab === 'settings' && (
                <AdminSettingsTab
                  apiUrlOverride={apiUrlOverride}
                  onApiUrlOverrideChange={setApiUrlOverride}
                  onSaveApiUrlOverride={handleSaveApiUrlOverride}
                  onResetApiUrl={handleResetApiUrl}
                  onExportFullJson={handleExportFullJson}
                  onExportCsv={handleExportCsv}
                  telegramStatus={telegramStatus}
                  telegramNotice={telegramNotice}
                  telegramToken={telegramToken}
                  telegramChatId={telegramChatId}
                  onTelegramTokenChange={setTelegramToken}
                  onTelegramChatIdChange={setTelegramChatId}
                  isSavingTelegram={isSavingTelegram}
                  isTestingTelegram={isTestingTelegram}
                  onSaveTelegram={handleSaveTelegram}
                  onTestTelegram={handleTestTelegram}
                  confirmPurge={confirmPurge}
                  onPurgeCache={handlePurgeCache}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AdminTerminalHud
        isOpen={isTerminalOpen}
        isExpanded={isTerminalExpanded}
        logs={terminalLogs}
        onToggleOpen={() => setIsTerminalOpen(true)}
        onToggleExpand={() => setIsTerminalExpanded((prev) => !prev)}
        onClose={() => setIsTerminalOpen(false)}
        onClearLogs={() => setTerminalLogs([])}
        onAddLog={addTerminalLog}
      />

      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        query={commandPaletteQuery}
        results={commandPaletteResults}
        onQueryChange={setCommandPaletteQuery}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={setActiveAdminTab}
        onSelectAnime={(anime) => {
          setEditingAnime(anime);
          setModalMode('edit');
          setIsDubModalOpen(true);
        }}
      />

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-[#090d18]/90 backdrop-blur-2xl border border-white/15 rounded-2xl p-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.85)] flex items-center justify-around">
        <button
          onClick={() => setActiveAdminTab('overview')}
          className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeAdminTab === 'overview' ? 'text-cyan-300 bg-cyan-500/15' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span className="text-[9px] font-medium">Overview</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('pending')}
          className={`p-2 rounded-xl flex flex-col items-center gap-1 relative transition-all cursor-pointer ${
            activeAdminTab === 'pending' ? 'text-amber-300 bg-amber-500/15' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span className="text-[9px] font-medium">Pending</span>
          {pendingCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#090d18]" />}
        </button>

        <button
          onClick={() => setActiveAdminTab('catalog')}
          className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeAdminTab === 'catalog' ? 'text-purple-300 bg-purple-500/15' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span className="text-[9px] font-medium">Catalog</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('analytics')}
          className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeAdminTab === 'analytics' ? 'text-sky-300 bg-sky-500/15' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-[9px] font-medium">Analytics</span>
        </button>

        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="p-2 rounded-xl flex flex-col items-center gap-1 text-purple-400 hover:text-purple-300 cursor-pointer"
        >
          <Command className="w-4 h-4" />
          <span className="text-[9px] font-mono">⌘K</span>
        </button>

        <button
          onClick={() => setIsTerminalOpen((prev) => !prev)}
          className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
            isTerminalOpen ? 'text-cyan-300 bg-cyan-500/15' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span className="text-[9px] font-mono">CLI</span>
        </button>
      </div>

      {isDubModalOpen && (
        <DubInfoModal
          isOpen={isDubModalOpen}
          onClose={() => setIsDubModalOpen(false)}
          onSubmit={handleSaveEdit}
          initialData={editingAnime}
          mode={modalMode}
        />
      )}

      <AdminCsvHelpModal
        isOpen={showCsvHelpModal}
        hasCopiedHeaders={hasCopiedHeaders}
        hasCopiedSnippet={hasCopiedSnippet}
        onClose={() => setShowCsvHelpModal(false)}
        onCopyHeaders={handleCopyHeaders}
        onCopySnippet={handleCopySnippet}
        onDownloadTemplate={handleDownloadTemplate}
      />
    </div>
  );
};
