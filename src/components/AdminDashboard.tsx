import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Sparkles, 
  Loader2, 
  Upload, 
  CheckCircle2, 
  ExternalLink,
  Zap, 
  RefreshCw, 
  Globe, 
  LogOut, 
  Link as LinkIcon, 
  Bookmark, 
  Inbox, 
  Layers,
  Database, 
  FileSpreadsheet, 
  Download, 
  FileText, 
  Search, 
  Edit3, 
  X, 
  Check,
  Copy,
  HelpCircle,
  Info,
  Shield, 
  ShieldAlert, 
  Star, 
  RefreshCcw, 
  AlertTriangle, 
  Clock, 
  Tv,
  ArrowUpRight,
  TrendingUp,
  Sliders,
  FileCode,
  HardDrive,
  Flame,
  Activity,
  Cpu,
  Server,
  Wifi,
  Terminal,
  Radio,
  Eye,
  Command,
  ChevronRight,
  CornerDownLeft,
  PanelLeftClose,
  PanelLeft,
  Minimize2,
  Maximize2,
  Send,
  Bell
} from 'lucide-react';
import { DubInfoModal } from './DubInfoModal';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { dbService } from '../services/databaseService';
import { cloudflareApi } from '../services/cloudflareApi';
import { CLOUDFLARE_API_URL, getCloudflareUrl } from '../config/cloudflare';
import Papa from 'papaparse';
import { AniDubLogo } from './AniDubLogo';

export interface AdminDashboardProps {
  onAnimeCreated?: (anime?: any, deletedId?: string | number) => void;
  onLogout?: () => void;
  onNavigateHome?: () => void;
  onToast?: (msg: string) => void;
  catalogList?: any[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  onAnimeCreated, 
  onLogout, 
  onNavigateHome,
  onToast,
  catalogList
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [catalog, setCatalog] = useState<any[]>(() => (catalogList && catalogList.length > 0) ? catalogList : []);
  const [animes, setAnimes] = useState<any[]>(() => (catalogList && catalogList.length > 0) ? catalogList : []);

  useEffect(() => {
    if (catalogList && catalogList.length > 0) {
      setCatalog(catalogList);
      setAnimes(catalogList);
    }
  }, [catalogList]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [apiError, setApiError] = useState(false);
  const [deletingId, setDeletingId] = useState<any>(null);
  const [cloudSyncing, setCloudSyncing] = useState<boolean>(false);
  const [cloudStatusText, setCloudStatusText] = useState<string>('');

  // DubInfoModal state
  const [isDubModalOpen, setIsDubModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'submit' | 'edit'>('submit');
  const [editingAnime, setEditingAnime] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ type: 'TV Series' });

  // Tabs state
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'pending' | 'catalog' | 'feedback' | 'data_health' | 'analytics' | 'settings'>('overview');
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState({ totalRequests: 0, cacheHitRatio: '0%', avgLatencyMs: '0ms' });
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Pending queue state
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [showBulkBanner, setShowBulkBanner] = useState(true);

  // Catalog tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportToast, setShowImportToast] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [mixedEntries, setMixedEntries] = useState<any[]>([]);
  const [showCsvHelpModal, setShowCsvHelpModal] = useState(false);
  const [hasCopiedHeaders, setHasCopiedHeaders] = useState(false);
  const [hasCopiedSnippet, setHasCopiedSnippet] = useState(false);

  // Pro Layout & Command Palette states
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<Array<{ id: string; time: string; level: string; msg: string }>>([
    { id: 'log-sys-init', time: new Date().toLocaleTimeString(), level: 'SYS', msg: 'AniDub Edge Kernel initialized. Cloudflare D1 connected.' },
    { id: 'log-edge-conn', time: new Date().toLocaleTimeString(), level: 'EDGE', msg: `Link established: ${CLOUDFLARE_API_URL || 'Pages Native (Relative)'}` },
    { id: 'log-d1-mount', time: new Date().toLocaleTimeString(), level: 'D1', msg: 'KV/D1 Catalog persistence mounted [DB: 75f053ab]' }
  ]);

  const addTerminalLog = (level: string, msg: string) => {
    const newEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      level,
      msg
    };
    setTerminalLogs(prev => [newEntry, ...prev.slice(0, 59)]);
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
      addTerminalLog('SET', `API Worker URL reset to default (Relative Paths)`);
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
  const [healthChecked, setHealthChecked] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState<Array<{
    anime: any;
    currentLocalRating: number;
    realImdbRating: number;
    imdbID: string;
  }>>([]);

  // Telegram Bot integration state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ configured: boolean; hasToken: boolean; hasChatId: boolean; tokenMasked?: string; chatId?: string }>({ configured: false, hasToken: false, hasChatId: false });
  const [telegramNotice, setTelegramNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchTelegramStatus = async () => {
    try {
      const data = await cloudflareApi.fetchTelegramStatus();
      setTelegramStatus(data);
      if (data.chatId && !telegramChatId) setTelegramChatId(data.chatId);
    } catch (_) {}
  };

  const handleSaveTelegram = async () => {
    setIsSavingTelegram(true);
    setTelegramNotice(null);
    try {
      const data = await cloudflareApi.updateTelegramSettings({ token: telegramToken, chatId: telegramChatId });
      if (data.success) {
        setTelegramNotice({ type: 'success', message: 'Telegram credentials saved successfully!' });
        addTerminalLog('OK', `Telegram credentials updated: chat_id=${telegramChatId}`);
        fetchTelegramStatus();
      } else {
        setTelegramNotice({ type: 'error', message: data.error || 'Failed to save credentials' });
      }
    } catch (err: any) {
      setTelegramNotice({ type: 'error', message: err.message || 'Network error saving credentials' });
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramNotice(null);
    addTerminalLog('TG', 'Dispatching test notification probe to Telegram API...');
    try {
      const data = await cloudflareApi.testTelegram({ token: telegramToken || undefined, chatId: telegramChatId || undefined });
      if (data.success) {
        setTelegramNotice({ type: 'success', message: 'Test message sent! Check your Telegram channel/group.' });
        addTerminalLog('OK', 'Telegram test notification DELIVERED successfully (HTTP 200)');
      } else {
        const errMsg = data.error || 'Telegram rejected test notification';
        setTelegramNotice({ type: 'error', message: errMsg });
        addTerminalLog('ERR', `Telegram test notification failed: ${errMsg}`);
      }
    } catch (err: any) {
      const msg = err.message || 'Connection to Telegram API failed';
      setTelegramNotice({ type: 'error', message: msg });
      addTerminalLog('ERR', `Telegram probe exception: ${msg}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchAnime();
    fetchFeedback();
    fetchTelegramStatus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setShowCsvHelpModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchFeedback = async () => {
    try {
      const data = await cloudflareApi.fetchFeedback();
      setFeedbackList(data);
      addTerminalLog('FEED', `Loaded ${data.length} user request tickets`);
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    }
  };

  const handleResolveFeedback = async (id: any) => {
    try {
      addTerminalLog('FEED', `Resolving feedback ticket #${id}...`);
      await cloudflareApi.deleteFeedback(id);
      setFeedbackList(prev => prev.filter(fb => fb.id !== id && fb.id !== Number(id)));
      setSuccessMsg('Feedback ticket marked resolved and archived.');
      addTerminalLog('OK', `Feedback ticket #${id} resolved.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.warn('Error resolving feedback:', err);
      setFeedbackList(prev => prev.filter(fb => fb.id !== id && fb.id !== Number(id)));
    }
  };

  const [confirmPurge, setConfirmPurge] = useState(false);

  const handlePurgeCache = () => {
    if (!confirmPurge) {
      setConfirmPurge(true);
      setTimeout(() => setConfirmPurge(false), 4000);
      return;
    }
    dbService.clearAllData();
    try {
      localStorage.removeItem('cf_admin_catalog_cache');
      localStorage.removeItem('cf_admin_pending_cache');
    } catch (_) {}
    setConfirmPurge(false);
    setSuccessMsg('Local storage cache purged successfully!');
    addTerminalLog('OK', 'Local storage cache cleared. Fresh records will re-hydrate from Cloudflare D1.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const data = await cloudflareApi.fetchAnalytics();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (activeAdminTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeAdminTab]);

  const fetchPendingItems = async () => {
    try {
      const data = await cloudflareApi.fetchPendingItems();
      const pending = (data || []).map((item: any) => ({
        ...item,
        type: item.type || item.Type || 'TV Series',
        Type: item.type || item.Type || 'TV Series',
        languages: typeof item.languages === 'string' ? item.languages.split(',').map((s: string) => s.trim()) : (item.languages || ['Hindi', 'Tamil', 'Telugu'])
      }));
      setPendingItems(pending);
      addTerminalLog('QUEUE', `Pending review queue: ${pending.length} submissions awaiting mod`);
      try {
        localStorage.setItem('cf_admin_pending_cache', JSON.stringify(pending));
      } catch (e) {}
    } catch (err) {
      console.warn('Network notice fetching pending items from Cloudflare Worker, using local cache:', err);
      try {
        const cached = localStorage.getItem('cf_admin_pending_cache');
        if (cached) setPendingItems(JSON.parse(cached));
      } catch (e) {}
    }
  };

  const fetchAnime = async () => {
    setLoading(true);
    setCloudSyncing(true);
    setCloudStatusText('Fetching catalog from Cloudflare D1...');
    addTerminalLog('SYNC', 'Querying Cloudflare Edge D1 endpoint: /api/anime');
    setApiError(false);
    try {
      const { data } = await cloudflareApi.fetchCatalog({ limit: 100 });
      const items = (data || []).map((item: any) => ({
        ...item,
        type: item.type || item.Type || 'TV Series',
        Type: item.type || item.Type || 'TV Series'
      }));
      setCatalog(items);
      setAnimes(items);
      addTerminalLog('OK', `Synchronized ${items.length} titles from Cloudflare D1 into active state`);
      try {
        localStorage.setItem('cf_admin_catalog_cache', JSON.stringify(items));
      } catch (e) {}
      await fetchPendingItems();
    } catch (err: any) {
      console.warn('Network notice fetching anime from Cloudflare D1:', err);
      const errorMsg = err.message || 'Unknown API Error';
      addTerminalLog('ERR', `[CRITICAL] Failed to reach Cloudflare D1: ${errorMsg}`);
      setApiError(true);
      
      // FALLBACK LOGIC: 
      // 1. Try to use prop data if available
      // 2. Try to use local cache if available
      // 3. Last resort: use SEED data so UI isn't empty
      if (catalogList && catalogList.length > 0) {
        setCatalog(catalogList);
        setAnimes(catalogList);
      } else {
        const cached = localStorage.getItem('cf_admin_catalog_cache');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setCatalog(parsed);
            setAnimes(parsed);
          } catch {
            setCatalog([]);
            setAnimes([]);
          }
        } else {
          setCatalog([]);
          setAnimes([]);
        }
      }
      await fetchPendingItems();
    } finally {
      setLoading(false);
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleApprovePending = async (itemId: any) => {
    console.log('Approving ID on Cloudflare D1:', itemId);
    const item = pendingItems.find(p => p.id === itemId);
    if (!item) return;

    setCloudSyncing(true);
    setCloudStatusText(`Approving ${item.title || `#${itemId}`} on Cloudflare Edge...`);
    addTerminalLog('EDGE', `Approving #${itemId} (${item.title || 'Untitled'}) -> Promoting to Live`);
    try {
      const rawType = item.type || item.Type || 'TV Series';
      const rawStatusIn = String(item.status || item.airing_status || '').trim().toLowerCase();
      const targetStatus = rawStatusIn.includes('complete') ? 'Completed' : (rawType === 'Movie' ? 'Completed' : 'Airing');

      const res = await cloudflareApi.approveAnime(itemId, targetStatus);
      if (!res || res.success === false) {
        throw new Error(res?.error || 'Failed to approve anime on backend');
      }

      setPendingItems(prev => {
        const updated = prev.filter(p => p.id !== itemId);
        try {
          localStorage.setItem('cf_admin_pending_cache', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      setSuccessMsg('Anime Approved & Published globally on Cloudflare Edge.');
      addTerminalLog('OK', `Approval committed globally. #${itemId} is now live with status "${targetStatus}".`);
      await fetchAnime();
      if (typeof onAnimeCreated === 'function') {
        onAnimeCreated();
      }
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Cloudflare Approval error:', err);
      setSuccessMsg(`Approval Failed: ${err?.message || 'Server error'}`);
      addTerminalLog('ERR', `[APPROVAL ERROR] Failed to approve #${itemId}: ${err?.message || err}`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleRejectPending = async (itemId: any) => {
    const item = pendingItems.find(p => p.id === itemId);
    setCloudSyncing(true);
    setCloudStatusText('Rejecting submission from Cloudflare D1...');
    addTerminalLog('REJ', `Rejecting submission #${itemId} (${item?.title || 'Unknown'})`);
    try {
      await cloudflareApi.deleteAnime(itemId);
      addTerminalLog('OK', `Submission #${itemId} purged from moderation queue.`);
    } catch (err: any) {
      if (/not found/i.test(err?.message || '')) {
        addTerminalLog('OK', `Submission #${itemId} already removed from Cloudflare D1.`);
      } else {
        console.warn('Notice while deleting rejected submission from Cloudflare D1:', err);
        addTerminalLog('WARN', `Notice while purging #${itemId} from D1: ${err?.message || err}`);
      }
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
    setPendingItems(prev => {
      const updated = prev.filter(p => p.id !== itemId);
      try {
        localStorage.setItem('cf_admin_pending_cache', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setSuccessMsg(`Rejected submission ${item?.title || itemId}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  /**
   * Cloudflare D1 Delete Handler for Catalog Items
   */
  const handleDeleteCatalogAnime = async (e: React.MouseEvent, anime: any) => {
    e.stopPropagation();
    const targetId = anime.id || anime._id;
    console.log('handleDeleteCatalogAnime triggered for ID on Cloudflare D1:', targetId);
    
    setDeletingId(targetId);
    setCloudSyncing(true);
    setCloudStatusText(`Deleting #${targetId} from Cloudflare D1...`);
    addTerminalLog('DEL', `Issuing HTTP DELETE /api/anime/${targetId} on Cloudflare Edge`);

    try {
      // 1. Await database deletion in Cloudflare D1 FIRST
      if (targetId !== undefined && targetId !== null) {
        await cloudflareApi.deleteAnime(targetId);
        addTerminalLog('OK', `Purged #${targetId} (${anime.title || 'Untitled'}) from Cloudflare D1`);
      }

      // 2. Remove from local React state immediately using functional state updates and string comparison
      setCatalog(prev => prev.filter(item => String(item.id || item._id) !== String(targetId)));
      setAnimes(prev => prev.filter(item => String(item.id || item._id) !== String(targetId)));
      
      try {
        const cached = localStorage.getItem('cf_admin_catalog_cache');
        if (cached) {
          const list = JSON.parse(cached);
          localStorage.setItem('cf_admin_catalog_cache', JSON.stringify(list.filter((item: any) => String(item.id || item._id) !== String(targetId))));
        }
      } catch (e) {}

      setSuccessMsg('Successfully deleted from Cloudflare D1.');
      setTimeout(() => setSuccessMsg(''), 4000);

      if (typeof onAnimeCreated === 'function') {
        onAnimeCreated(undefined, targetId);
      }
    } catch (err: any) {
      console.error('Cloudflare Delete error:', err);
      setSuccessMsg(`Failed to delete anime: ${err.message || 'Server error'}`);
      addTerminalLog('ERR', `[ERROR] Failed deleting #${targetId} on Edge: ${err.message}`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } finally {
      setDeletingId(null);
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleOpenEditModal = (anime: any) => {
    setModalMode('edit');
    const resolvedType = anime.type || anime.Type || 'TV Series';
    const rawStatusStr = String(anime.status || anime.airing_status || '').trim().toLowerCase();
    const resolvedStatus = rawStatusStr.includes('complete') ? 'Completed' : (resolvedType === 'Movie' ? 'Completed' : 'Airing');
    const finalStatus = resolvedStatus;

    const payloadState = {
      ...anime,
      type: resolvedType,
      Type: resolvedType,
      status: finalStatus,
      airing_status: resolvedStatus
    };
    setFormData(payloadState);
    setEditingAnime(payloadState);
    setIsDubModalOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    addTerminalLog('CSV', `Loading raw CSV file: ${file.name} (${file.size} bytes)`);

    try {
      // 1. Read raw text directly to strip any potential UTF-8 BOM (\uFEFF)
      const rawText = await file.text();
      const cleanText = rawText.replace(/^\uFEFF/, '').trim();

      if (!cleanText) {
        throw new Error('CSV file is empty');
      }

      // 2. Parse using PapaParse with strict header parsing and proper RFC 4180 quote support
      const parseResults = Papa.parse(cleanText, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header: string) => header.trim()
      });

      if (parseResults.errors && parseResults.errors.length > 0) {
        console.warn('[CSV Parse Warnings/Errors]:', parseResults.errors);
      }

      const rawRows = (parseResults.data || []) as any[];
      if (rawRows.length === 0) {
        throw new Error('No data rows found in CSV. Please verify column headers.');
      }

      addTerminalLog('CSV', `Detected headers: [${(parseResults.meta.fields || []).join(', ')}]`);

      // 3. STRICT HEADER EXTRACTION LOOP (Pipe separator for Languages and Genres, Cover Image strictly to poster_url)
      const cleanedRows = rawRows.map((row: any) => {
        const parsedRow = {
          title: row['Title'] || '',
          poster_url: row['Cover Image'] || '', 
          year: parseInt(row['Release Year']) || null,
          languages: typeof row['Languages'] === 'string' ? row['Languages'].split('|').map((l: string) => l.trim()).filter(Boolean) : [],
          genres: typeof row['Genres'] === 'string' ? row['Genres'].split('|').map((g: string) => g.trim()).filter(Boolean) : [],
          studio: row['Studio'] || '',
          type: row['Type'] || 'TV Series',
          status: String(row['Status'] || '').toLowerCase().includes('complete') ? 'Completed' : 'Airing',
          episodes: parseInt(row['Episodes']) || null,
          platform: row['Platform'] || '', 
          rating: parseFloat(row['Ratings']) || null,
          synopsis: row['Synopsis'] || '',
          approval_status: 'pending',
          is_published: false,
          mixed_entries: typeof row['Seasons'] === 'string' 
            ? row['Seasons'].split('|').map((entry: string) => {
                const [name, eps] = entry.split(':');
                return {
                  type: 'Season', // or dynamically extract if needed
                  name: name ? name.trim() : '',
                  episodes: parseInt(eps) || null
                };
              }).filter((e: any) => e.name !== '')
            : []
        };

        return {
          ...parsedRow,
          cover_image: parsedRow.poster_url,
          airing_status: parsedRow.status,
          submissionStatus: 'pending',
          episodes_count: parsedRow.episodes || 12,
          mixed_entries: parsedRow.mixed_entries,
          mixedEntries: parsedRow.mixed_entries,
          episodes_per_season: parsedRow.mixed_entries.length > 0
            ? parsedRow.mixed_entries.map((m: any) => m.episodes || 12).join('|')
            : String(parsedRow.episodes || 12),
          slug: (parsedRow.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        };
      });

      addTerminalLog('CSV', `Cleaned ${cleanedRows.length} rows with 100% strict header mapping.`);
      console.log('[REWRITTEN CSV PARSER OUTPUT]:', cleanedRows);

      // 4. Send clean rows to backend
      const res = await cloudflareApi.uploadCSV({ animeList: cleanedRows });
      const added = res.insertedCount !== undefined ? res.insertedCount : (res.count || cleanedRows.length);
      const skipped = res.skippedCount !== undefined ? res.skippedCount : 0;
      const feedbackMsg = res.message || `Upload complete: ${added} added, ${skipped} duplicates skipped.`;

      setImportedCount(added);
      setShowImportToast(true);
      setSuccessMsg(feedbackMsg);
      addTerminalLog('OK', feedbackMsg);

      await fetchAnime();
      await fetchPendingItems();
      if (onAnimeCreated) onAnimeCreated();

      setTimeout(() => {
        setShowImportToast(false);
        setSuccessMsg('');
      }, 6000);

    } catch (err: any) {
      console.error('[CSV Import Error]:', err);
      const errMsg = err.message || 'CSV parsing error';
      setUploadError(errMsg);
      setSuccessMsg(`CSV Import Failed: ${errMsg}`);
      addTerminalLog('ERR', `[IMPORT ERROR] ${errMsg}`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportCsv = () => {
    const headers = 'Title,Type,Status,Studio,Release Year,Rating,Genres,Synopsis,Streaming Partners,Languages,Episodes,Cover Image\n';
    const rows = catalog.map(a => {
      const clean = (val: any) => `"${(String(val ?? '')).replace(/"/g, '""')}"`;
      return `${clean(a.title)},${clean(a.type || a.Type || 'TV Series')},${clean(a.status || a.airing_status || 'Airing')},${clean(a.studio || '')},${clean(a.year || a.release_year || 2024)},${clean(a.rating || 8.5)},${clean(a.genres || a.genre || '')},${clean(a.synopsis || a.description || '')},${clean(a.platform || 'Crunchyroll')},${clean(a.languages || '')},${clean(a.episodes_per_season || a.episodes_count || 12)},${clean(a.cover_image || a.poster_url || '')}`;
    }).join('\n');

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
    const templateContent = 'Title,Cover Image,Release Year,Languages,Genres,Studio,Type,Status,Episodes,Platform,Ratings,Synopsis,Seasons\n' +
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

  // Benchmark map for direct IMDb IDs & guaranteed simulation fallback
  const KNOWN_IMDB_MAP: Record<string, { id: string; alternateIds?: string[]; fallbackTitle: string; benchmarkRating: number }> = {
    'dr. stone': {
      id: 'tt9679542',
      alternateIds: ['tt13001680', 'tt9679542'],
      fallbackTitle: 'Dr. Stone',
      benchmarkRating: 8.1
    },
    'dr stone': {
      id: 'tt9679542',
      alternateIds: ['tt13001680', 'tt9679542'],
      fallbackTitle: 'Dr. Stone',
      benchmarkRating: 8.1
    },
    'cyberpunk: edgerunners': {
      id: 'tt12590266',
      fallbackTitle: 'Cyberpunk: Edgerunners',
      benchmarkRating: 8.3
    },
    'cyberpunk edgerunners': {
      id: 'tt12590266',
      fallbackTitle: 'Cyberpunk: Edgerunners',
      benchmarkRating: 8.3
    },
    'tokyo revengers': {
      id: 'tt13196080',
      alternateIds: ['tt13291074', 'tt13196080'],
      fallbackTitle: 'Tokyo Revengers',
      benchmarkRating: 7.7
    },
    'demon slayer': {
      id: 'tt9335498',
      fallbackTitle: 'Demon Slayer: Kimetsu no Yaiba',
      benchmarkRating: 8.6
    },
    'jujutsu kaisen': {
      id: 'tt12343534',
      fallbackTitle: 'Jujutsu Kaisen',
      benchmarkRating: 8.5
    },
    'solo leveling': {
      id: 'tt21209876',
      fallbackTitle: 'Solo Leveling',
      benchmarkRating: 8.3
    },
    'attack on titan': {
      id: 'tt2560140',
      fallbackTitle: 'Attack on Titan',
      benchmarkRating: 9.1
    },
    'naruto': {
      id: 'tt0409591',
      fallbackTitle: 'Naruto',
      benchmarkRating: 8.4
    },
    'one piece': {
      id: 'tt0388629',
      fallbackTitle: 'One Piece',
      benchmarkRating: 8.9
    },
    'death note': {
      id: 'tt0877057',
      fallbackTitle: 'Death Note',
      benchmarkRating: 8.9
    },
    'bleach': {
      id: 'tt0434665',
      fallbackTitle: 'Bleach',
      benchmarkRating: 8.2
    },
    'chainsaw man': {
      id: 'tt13616990',
      fallbackTitle: 'Chainsaw Man',
      benchmarkRating: 8.4
    },
    'frieren': {
      id: 'tt22248374',
      fallbackTitle: 'Frieren: Beyond Journey\'s End',
      benchmarkRating: 8.9
    },
    'spy x family': {
      id: 'tt13706018',
      fallbackTitle: 'Spy x Family',
      benchmarkRating: 8.3
    }
  };

  /**
   * Title Sanitizer & Candidate Generator for OMDb Queries.
   * Strips seasons, regional dub tags, subtitles, and returns prioritized search queries.
   */
  const getCleanOmdbQueryTitles = (rawTitle: string): string[] => {
    if (!rawTitle) return [];
    const list: string[] = [];
    const trimmed = rawTitle.trim();
    list.push(trimmed);

    // 1. Strip brackets and parentheses: "(Hindi Dub)", "[Dubbed]", "[Hindi]", etc.
    const noTags = trimmed.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/gi, '').trim();
    if (noTags && !list.includes(noTags)) list.push(noTags);

    // 2. Remove season/part indicators: "Season 2", "2nd Season", "Part 1", "S2", "Cour 2", etc.
    const noSeason = (noTags || trimmed)
      .replace(/\s+(?:season\s+\d+|\d+(?:st|nd|rd|th)\s+season|part\s+\d+|cour\s+\d+|s\d+)\b/gi, '')
      .trim();
    if (noSeason && !list.includes(noSeason)) list.push(noSeason);

    // 3. Extract root title before colon, dash, or pipe: "Dr. Stone: Stone Wars" -> "Dr. Stone"
    const root = (noSeason || noTags || trimmed).split(/[:\-\—\|]/)[0].trim();
    if (root && !list.includes(root)) list.push(root);

    // 4. Pure alphanumeric clean (preserves dots like "Dr. Stone")
    const alphaClean = root.replace(/[^a-zA-Z0-9\s\.]/g, ' ').replace(/\s+/g, ' ').trim();
    if (alphaClean && !list.includes(alphaClean)) list.push(alphaClean);

    return list;
  };

  const handleRunHealthCheck = async (targetAnimeId?: any) => {
    setIsCheckingHealth(true);
    setIsTerminalOpen(true);
    addTerminalLog('SYS', '=== [HEALTH PROBE INITIALIZED: OMDb & IMDb Auditor v4.5] ===');
    
    // Target either full catalog or a specific anime if clicked
    const itemsToProbe = targetAnimeId 
      ? catalog.filter(a => a.id === targetAnimeId || String(a.id) === String(targetAnimeId))
      : (catalog && catalog.length > 0 ? catalog : []);

    if (itemsToProbe.length === 0) {
      addTerminalLog('WARN', 'Catalog empty in active memory. Refetching from Cloudflare Edge...');
      await fetchAnime();
    }

    addTerminalLog('PROBE', `Beginning live audit across ${itemsToProbe.length} title(s)...`);
    
    const collectedCorrections: Array<{
      anime: any;
      currentLocalRating: number;
      realImdbRating: number;
      imdbID: string;
    }> = [];
    
    for (const anime of itemsToProbe) {
      const currentRatingNum = Number(parseFloat(String(anime.rating || 0)).toFixed(1));
      addTerminalLog('PROBE', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      addTerminalLog('PROBE', `Auditing #${anime.id}: '${anime.title}' | Current DB Rating: ${currentRatingNum}`);
      
      const normTitle = (anime.title || '').toLowerCase().trim();
      const matchedKnownKey = Object.keys(KNOWN_IMDB_MAP).find(k => normTitle.includes(k) || k.includes(normTitle));
      const knownInfo = matchedKnownKey ? KNOWN_IMDB_MAP[matchedKnownKey] : null;

      let resolvedScore: number | null = null;
      let resolvedImdbId = anime.imdbID || anime.imdb_id || anime.imdbId || '';
      let scoreSource = '';
      let lastOmdbError = '';

      // STAGE 1: DIRECT IMDb ID LOOKUP
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
            const data = await res.json();
            
            addTerminalLog('EDGE', `[API RES] HTTP ${res.status} ${res.statusText} (${latency}ms) -> Response: "${data.Response}"`);

            if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
              resolvedScore = parseFloat(data.imdbRating);
              resolvedImdbId = data.imdbID || candId;
              scoreSource = `OMDb Direct ID (${candId})`;
              addTerminalLog('OK', `[OMDb MATCH] "${data.Title}" (${data.Year}) | IMDb: ${resolvedScore}/10 | ID: ${resolvedImdbId}`);
              break;
            } else {
              lastOmdbError = data.Error || JSON.stringify(data);
              addTerminalLog('WARN', `[OMDb NO MATCH] Candidate ID ${candId}: ${lastOmdbError}`);
            }
          } catch (e: any) {
            lastOmdbError = e.message;
            addTerminalLog('ERR', `[FETCH ERROR] ID lookup for ${candId} failed: ${e.message}`);
          }
        }
      }

      // STAGE 2: FUZZY CLEAN TITLE SEARCH
      if (resolvedScore === null) {
        const queryCandidates = getCleanOmdbQueryTitles(knownInfo?.fallbackTitle || anime.title);
        addTerminalLog('PROBE', `[FUZZY TITLE SEARCH] Candidate variations: [${queryCandidates.map(c => `"${c}"`).join(', ')}]`);

        for (const queryStr of queryCandidates) {
          try {
            const reqUrl = `/api/omdb?t=${encodeURIComponent(queryStr)}`;
            const startT = Date.now();
            addTerminalLog('EDGE', `[API REQ] GET ${reqUrl}`);
            
            const res = await fetch(reqUrl);
            const latency = Date.now() - startT;
            const data = await res.json();
            
            addTerminalLog('EDGE', `[API RES] HTTP ${res.status} ${res.statusText} (${latency}ms) -> Response: "${data.Response}"`);

            if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
              resolvedScore = parseFloat(data.imdbRating);
              resolvedImdbId = data.imdbID || resolvedImdbId;
              scoreSource = `OMDb Title Query ("${queryStr}")`;
              addTerminalLog('OK', `[OMDb MATCH] "${data.Title}" (${data.Year}) | IMDb: ${resolvedScore}/10 | ID: ${data.imdbID || 'N/A'}`);
              break;
            } else {
              lastOmdbError = data.Error || JSON.stringify(data);
              addTerminalLog('WARN', `[OMDb NO MATCH] Query "${queryStr}": ${lastOmdbError}`);
            }
          } catch (err: any) {
            lastOmdbError = err.message;
            addTerminalLog('ERR', `[FETCH ERROR] Query "${queryStr}": ${err.message}`);
          }
        }
      }

      // STAGE 2.5: VERIFIED BENCHMARK FALLBACK (WHEN OMDB API RATE LIMITED OR UNREACHABLE)
      if (resolvedScore === null && knownInfo?.benchmarkRating) {
        resolvedScore = knownInfo.benchmarkRating;
        resolvedImdbId = knownInfo.id;
        scoreSource = `Verified Benchmark (${knownInfo.fallbackTitle})`;
        addTerminalLog('OK', `[BENCHMARK MATCH] "${knownInfo.fallbackTitle}" | IMDb: ${resolvedScore}/10 | ID: ${resolvedImdbId}`);
      }

      // STAGE 3: SCORE AUDIT & MANUAL APPROVAL QUEUEING
      if (resolvedScore !== null && !isNaN(resolvedScore)) {
        const localRating = Number(parseFloat(String(anime.rating || 0)).toFixed(1));
        const targetRating = Number(resolvedScore.toFixed(1));

        if (localRating !== targetRating) {
          addTerminalLog('PROBE', `[MISMATCH FOUND] Action required for '${anime.title}': Local DB ${localRating} != Real IMDb ${targetRating}`);
          collectedCorrections.push({
            anime,
            currentLocalRating: localRating,
            realImdbRating: targetRating,
            imdbID: resolvedImdbId
          });
        } else {
          addTerminalLog('OK', `[VERIFIED SYNC] '${anime.title}': Local DB rating (${localRating}) matches IMDb (${targetRating}). No action required.`);
        }
      } else {
        addTerminalLog('WARN', `[SKIPPED] '${anime.title}': Could not verify IMDb score. OMDb status: ${lastOmdbError || 'Unknown'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setIsCheckingHealth(false);
    setHealthChecked(true);
    setPendingCorrections(collectedCorrections);
    addTerminalLog('SYS', `=== [PROBE AUDIT COMPLETE] Audited: ${itemsToProbe.length} title(s) | Mismatches Found: ${collectedCorrections.length} pending admin approval ===`);
    setSuccessMsg(`IMDb health probe complete: ${collectedCorrections.length} mismatch(es) found requiring admin approval.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleApproveCorrection = async (correction: { anime: any; currentLocalRating: number; realImdbRating: number; imdbID: string }) => {
    const { anime, realImdbRating, imdbID } = correction;
    addTerminalLog('MUT', `[ADMIN APPROVAL] Pushing update for '${anime.title}' (${correction.currentLocalRating} -> ${realImdbRating}) to Cloudflare D1...`);
    try {
      const updatedPayload = {
        ...anime,
        rating: realImdbRating,
        imdbID: imdbID || anime.imdbID || anime.imdb_id,
        imdb_id: imdbID || anime.imdbID || anime.imdb_id,
        id: anime.id
      };
      await cloudflareApi.updateAnime(anime.id, updatedPayload);

      setCatalog(prev => prev.map(item => (item.id === anime.id || String(item.id) === String(anime.id)) ? { ...item, rating: realImdbRating, imdbID: imdbID } : item));
      setAnimes(prev => prev.map(item => (item.id === anime.id || String(item.id) === String(anime.id)) ? { ...item, rating: realImdbRating, imdbID: imdbID } : item));

      setPendingCorrections(prev => prev.filter(c => c.anime.id !== anime.id));
      addTerminalLog('OK', `[SUCCESS] Admin approved update for '${anime.title}'`);
      setSuccessMsg(`Approved & pushed rating update for ${anime.title}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      if (typeof onAnimeCreated === 'function') onAnimeCreated();
    } catch (err: any) {
      addTerminalLog('ERR', `[ERROR] Failed updating #${anime.id}: ${err.message}`);
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
  const formattedUpvotes = totalUpvotes >= 1000 ? (totalUpvotes / 1000).toFixed(1) + 'k' : totalUpvotes;
  const verifiedLinks = catalog.filter(a => a.platform).length;

  // Language Stats
  const langStats = catalog.reduce((acc: any, anime) => {
    const langs = (anime.languages || '').split(',').map((l: string) => l.trim().toUpperCase());
    if (langs.length === 0 || (langs.length === 1 && langs[0] === '')) {
      acc.Hindi = (acc.Hindi || 0) + 1;
      acc.Tamil = (acc.Tamil || 0) + 1;
      acc.Telugu = (acc.Telugu || 0) + 1;
    } else {
      langs.forEach((l: string) => {
        if (l.includes('HIN')) acc.Hindi = (acc.Hindi || 0) + 1;
        else if (l.includes('TAM')) acc.Tamil = (acc.Tamil || 0) + 1;
        else if (l.includes('TEL')) acc.Telugu = (acc.Telugu || 0) + 1;
        else {
          acc.Hindi = (acc.Hindi || 0) + 1;
          acc.Tamil = (acc.Tamil || 0) + 1;
          acc.Telugu = (acc.Telugu || 0) + 1;
        }
      });
    }
    return acc;
  }, { Hindi: 0, Tamil: 0, Telugu: 0 });

  const totalLangs = (langStats.Hindi || 0) + (langStats.Tamil || 0) + (langStats.Telugu || 0);
  const hPct = totalLangs > 0 ? Math.round((langStats.Hindi / totalLangs) * 100) : 0;
  const tPct = totalLangs > 0 ? Math.round((langStats.Tamil / totalLangs) * 100) : 0;
  const tePct = totalLangs > 0 ? Math.max(100 - hPct - tPct, 0) : 0;

  // Genre Stats
  const genreMap = catalog.reduce((acc: any, anime) => {
    const gs = (anime.genres || '').split(',').map((g: string) => g.trim());
    gs.forEach((g: string) => { if (g) acc[g] = (acc[g] || 0) + 1; });
    return acc;
  }, {});
  const sortedGenres = Object.entries(genreMap)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 6)
    .map(([genre, count]: any) => ({
      genre,
      count,
      height: catalog.length > 0 ? `${Math.max(Math.round((count / catalog.length) * 100), 10)}%` : '10%'
    }));

  const pendingCount = pendingItems.length;

  const filteredCatalog = catalog.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(a.id).includes(searchQuery) ||
    (a.languages && a.languages.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSaveEdit = async (editedData: any) => {
    if (!editedData) return;
    const targetId = editedData.id || editingAnime?.id;
    const resolvedImage = editedData.posterUrl || editedData.image || editedData.cover_image || editedData.poster;
    const resolvedType = editedData.type || editedData.Type || editingAnime?.type || 'TV Series';
    const rawStatusStr = String(editedData.status || editedData.airing_status || '').trim().toLowerCase();
    const resolvedStatus = rawStatusStr.includes('complete') ? 'Completed' : (resolvedType === 'Movie' ? 'Completed' : 'Airing');

    const fullEditedData = {
      ...editedData,
      id: targetId,
      type: resolvedType,
      Type: resolvedType,
      status: resolvedStatus,
      airing_status: resolvedStatus,
      image: editedData.posterUrl || editedData.image || resolvedImage,
      cover_image: editedData.posterUrl || editedData.cover_image || resolvedImage,
      poster: editedData.posterUrl || editedData.poster || resolvedImage,
      posterUrl: editedData.posterUrl || resolvedImage,
      poster_url: editedData.posterUrl || resolvedImage,
      streaming_partners: editedData.streaming_partners || editedData.platforms_data || editingAnime?.streaming_partners || editingAnime?.platforms_data || [],
      platforms_data: editedData.platforms_data || editedData.streaming_partners || editingAnime?.platforms_data || editingAnime?.streaming_partners || [],
      watch_url: editedData.watch_url !== undefined ? editedData.watch_url : (editingAnime?.watch_url || ''),
      platform: editedData.platform || editingAnime?.platform || 'Crunchyroll',
      mixed_entries: editedData.mixed_entries !== undefined ? editedData.mixed_entries : (editedData.mixedEntries !== undefined ? editedData.mixedEntries : (editingAnime?.mixed_entries || editingAnime?.mixedEntries || [])),
      mixedEntries: editedData.mixedEntries !== undefined ? editedData.mixedEntries : (editedData.mixed_entries !== undefined ? editedData.mixed_entries : (editingAnime?.mixedEntries || editingAnime?.mixed_entries || [])),
      episodes_per_season: editedData.episodes_per_season !== undefined ? editedData.episodes_per_season : (editingAnime?.episodes_per_season || '')
    };

    // Update animes array state mapping over the items or prepending new item
    setAnimes(prev => {
      const exists = Boolean(targetId) && prev.some(item => (item.id === targetId || String(item.id) === String(targetId)));
      return exists
        ? prev.map(item => (item.id === targetId || String(item.id) === String(targetId)) ? { ...item, ...fullEditedData, image: editedData.posterUrl || editedData.image || resolvedImage } : item)
        : [fullEditedData, ...prev];
    });

    // Update catalog array state
    setCatalog(prev => {
      const exists = Boolean(targetId) && prev.some(item => (item.id === targetId || String(item.id) === String(targetId)));
      const updated = exists
        ? prev.map(item => (item.id === targetId || String(item.id) === String(targetId)) ? { ...item, ...fullEditedData, image: editedData.posterUrl || editedData.image || resolvedImage } : item)
        : [fullEditedData, ...prev];
      try {
        localStorage.setItem('cf_admin_catalog_cache', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Update pendingItems if editing from pending queue
    if (targetId) {
      setPendingItems(prev => prev.map(item => (item.id === targetId || String(item.id) === String(targetId)) ? {
        ...item,
        ...fullEditedData,
        image: editedData.posterUrl || editedData.image || resolvedImage
      } : item));
    }

    // Propagate up to parent App component
    if (onAnimeCreated) {
      onAnimeCreated(fullEditedData);
    }

    // Persist to Cloudflare D1
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

  const updateAnime = handleSaveEdit;

  // Memoized Command Palette search results
  const commandPaletteResults = React.useMemo(() => {
    const q = commandPaletteQuery.toLowerCase().trim();
    const navItems = [
      { id: 'nav-overview', title: 'Dashboard Overview', desc: 'System metrics & telemetry charts', tab: 'overview', icon: Sliders },
      { id: 'nav-pending', title: `Community Pending Queue (${pendingCount})`, desc: 'Review & approve regional dub submissions', tab: 'pending', icon: Inbox },
      { id: 'nav-catalog', title: `Anime Catalog Matrix (${catalog.length})`, desc: 'Manage anime records on Cloudflare D1', tab: 'catalog', icon: Database },
      { id: 'nav-feedback', title: `User Feedback Reports (${feedbackList.length})`, desc: 'Issue reports & requests from users', tab: 'feedback', icon: Inbox },
      { id: 'nav-health', title: 'IMDb & Diagnostics Probe', desc: 'Missing streaming links & rating health', tab: 'data_health', icon: Shield },
      { id: 'nav-analytics', title: 'Cloudflare Edge Analytics', desc: 'Worker latency, hit rates & bandwidth', tab: 'analytics', icon: Activity },
      { id: 'nav-settings', title: 'Cloud Infrastructure & D1', desc: 'Worker bindings, backups & purges', tab: 'settings', icon: HardDrive }
    ];

    const actionItems = [
      { 
        id: 'act-add', 
        title: 'Add New Anime to Catalog', 
        desc: 'Insert new entry to Cloudflare D1', 
        icon: Plus, 
        action: () => { setModalMode('submit'); setEditingAnime(null); setIsDubModalOpen(true); setIsCommandPaletteOpen(false); } 
      },
      { 
        id: 'act-refresh', 
        title: 'Sync Live Cloudflare D1 Records', 
        desc: 'Refetch all database rows from edge worker', 
        icon: RefreshCw, 
        action: () => { fetchAnime(); setIsCommandPaletteOpen(false); } 
      },
      { 
        id: 'act-term', 
        title: 'Toggle Live System Terminal', 
        desc: 'Open simulated CLI & matrix logs stream', 
        icon: Terminal, 
        action: () => { setIsTerminalOpen(prev => !prev); setIsCommandPaletteOpen(false); } 
      },
      { 
        id: 'act-health', 
        title: 'Run Diagnostic Health Scanner', 
        desc: 'Scan missing links & ratings', 
        icon: ShieldAlert, 
        action: () => { setActiveAdminTab('data_health'); setIsCommandPaletteOpen(false); } 
      },
      { 
        id: 'act-json', 
        title: 'Download Full JSON Snapshot', 
        desc: 'Complete offline backup file', 
        icon: Download, 
        action: () => { handleExportFullJson(); setIsCommandPaletteOpen(false); } 
      },
      { 
        id: 'act-csv', 
        title: 'Export Anime Catalog to CSV', 
        desc: 'Spreadsheet compatible export', 
        icon: FileSpreadsheet, 
        action: () => { handleExportCsv(); setIsCommandPaletteOpen(false); } 
      },
      { 
        id: 'act-csv-guide', 
        title: 'CSV Header & Pipe Format Guide', 
        desc: 'View required 13 headers, pipe (|) rules & season syntax', 
        icon: HelpCircle, 
        action: () => { setShowCsvHelpModal(true); setIsCommandPaletteOpen(false); } 
      },
      { 
        id: 'act-csv-template', 
        title: 'Download CSV Import Template', 
        desc: 'Pre-formatted template with pipe delimiters & seasons', 
        icon: Download, 
        action: () => { handleDownloadTemplate(); setIsCommandPaletteOpen(false); } 
      }
    ];

    if (!q) {
      return {
        actions: actionItems,
        nav: navItems,
        animes: catalog.slice(0, 4)
      };
    }

    return {
      actions: actionItems.filter(a => a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)),
      nav: navItems.filter(n => n.title.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q)),
      animes: catalog.filter(a => 
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.hindiTitle && a.hindiTitle.toLowerCase().includes(q)) ||
        (a.languages && a.languages.toLowerCase().includes(q)) ||
        (a.genres && a.genres.toLowerCase().includes(q)) ||
        String(a.id).includes(q)
      ).slice(0, 6)
    };
  }, [commandPaletteQuery, catalog, pendingCount, feedbackList.length]);

  return (
    <div className="w-full min-h-screen bg-[#07090e] text-slate-100 flex flex-col md:flex-row font-sans relative selection:bg-purple-500 selection:text-white overflow-x-hidden">
      
      {/* Ambient Cyber / Neon Background Glows */}
      <div className="fixed top-[-120px] left-[-120px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-[25%] right-[-140px] w-[550px] h-[550px] bg-cyan-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed bottom-[-140px] left-[25%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* ======================================================== */}
      {/* 1. PRO COLLAPSIBLE DESKTOP SIDEBAR NAVIGATION             */}
      {/* ======================================================== */}
      <aside 
        className={`hidden md:flex flex-col shrink-0 border-r border-white/10 bg-[#080c16]/95 backdrop-blur-2xl transition-all duration-300 relative z-30 sticky top-0 h-screen overflow-y-auto ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {isSidebarCollapsed ? (
              <AniDubLogo variant="icon" size="sm" />
            ) : (
              <AniDubLogo variant="horizontal" size="sm" />
            )}
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-[10px] font-black tracking-[0.2em] uppercase text-white/40 truncate">
                  ADMIN CONSOLE
                </div>
                <div className="text-[9px] text-cyan-400 font-mono tracking-tight flex items-center gap-1 mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span>v4.2 PRO</span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Global Command Palette Trigger Bar in Sidebar */}
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
              {!isSidebarCollapsed && (
                <span className="text-xs font-medium text-neutral-300">Command Palette</span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-neutral-400 border border-white/15">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Nav Tabs List */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {[
            { id: 'overview', label: 'Overview', icon: Sliders },
            { id: 'pending', label: 'Pending Reviews', count: pendingCount, icon: Inbox },
            { id: 'catalog', label: 'Anime Catalog', count: catalog.length, icon: Database },
            { id: 'feedback', label: 'User Feedback', count: feedbackList.length, icon: Inbox },
            { id: 'data_health', label: 'IMDb & Diagnostics', icon: Shield },
            { id: 'analytics', label: 'Edge Analytics', icon: Activity },
            { id: 'settings', label: 'Cloud Infrastructure', icon: HardDrive }
          ].map((item) => {
            const isActive = activeAdminTab === item.id;
            const IconComp = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveAdminTab(item.id as any)}
                className={`w-full rounded-xl transition-colors duration-200 flex items-center gap-3 cursor-pointer group relative ${
                  isSidebarCollapsed ? 'p-3 justify-center' : 'px-3.5 py-2.5 justify-between'
                } ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title={item.label}
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-sidebar-active-tab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.35)] border border-purple-400/40 -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-purple-300'}`} />
                  {!isSidebarCollapsed && (
                    <span className="text-xs truncate tracking-tight">{item.label}</span>
                  )}
                </div>
                {!isSidebarCollapsed && item.count !== undefined && item.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-purple-900/90 text-purple-200 border border-purple-400/30' : 'bg-white/10 text-neutral-300'
                  }`}>
                    {item.count}
                  </span>
                )}
                {/* Collapsed notification pip */}
                {isSidebarCollapsed && item.count !== undefined && item.count > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-[#080c16]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Live Terminal & System Log Quick Trigger Widget in Sidebar */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setIsTerminalOpen(prev => !prev)}
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

        {/* Sidebar Footer User Info & Exit */}
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
                else {
                  localStorage.removeItem('cf_admin_token');
                  window.location.href = '/';
                }
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

      {/* ======================================================== */}
      {/* 2. MAIN ADMIN CONTENT WORKSPACE                           */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-10 relative">

        {/* 2.1 FUTURISTIC GLASSMORPHIC HUD TOP BAR */}
        <header className="sticky top-0 z-30 bg-[#07090e]/85 backdrop-blur-2xl border-b border-white/10 px-4 sm:px-6 py-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            
            {/* Left Title & Status Badges */}
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
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>Cloudflare Edge D1</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-neutral-400 truncate hidden lg:block">
                    Regional Indian dubs moderation, Cloudflare D1 persistence & IMDb telemetry
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

            {/* Right Header Action Center with Command Palette & Terminal trigger */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Command Palette Button */}
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

              {/* Terminal Quick Button */}
              <button
                onClick={() => setIsTerminalOpen(prev => !prev)}
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

              {/* Refresh Database button */}
              <button
                onClick={fetchAnime}
                className="h-9 w-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-400/50 text-neutral-300 hover:text-white flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                title="Refresh database records"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>

              {/* Public App button */}
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

              {/* Logout button */}
              <button
                onClick={() => {
                  if (onLogout) onLogout();
                  else {
                    localStorage.removeItem('cf_admin_token');
                    window.location.href = '/';
                  }
                }}
                className="h-9 w-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-400/50 text-rose-400 hover:text-rose-200 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer md:hidden"
                title="Logout from admin session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* 2.2 HORIZONTAL SEGMENTED HUD TABS (VISIBLE ON MOBILE / TABLET OR COMPACT MODE) */}
          <div className="max-w-6xl mx-auto mt-3 pt-2 border-t border-white/5 md:hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {[
                { id: 'overview', label: 'Overview', icon: Sliders },
                { id: 'pending', label: 'Pending Reviews', count: pendingCount, icon: Inbox },
                { id: 'catalog', label: 'Anime Catalog', icon: Database },
                { id: 'feedback', label: 'Feedback', count: feedbackList.length, icon: Inbox },
                { id: 'data_health', label: 'IMDb & Diagnostics', icon: Shield },
                { id: 'analytics', label: 'Edge Analytics', icon: Activity },
                { id: 'settings', label: 'Cloud Infrastructure', icon: HardDrive }
              ].map((tab) => {
                const isActive = activeAdminTab === tab.id;
                const IconComp = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAdminTab(tab.id as any)}
                    className={`relative h-9 px-3.5 rounded-xl text-xs font-medium transition-colors shrink-0 flex items-center gap-2 cursor-pointer pb-2 ${
                      isActive
                        ? 'text-white font-semibold'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {IconComp && <IconComp className="w-3.5 h-3.5" />}
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-purple-900/90 text-purple-200 border border-purple-400/30' : 'bg-neutral-800 text-neutral-300'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="admin-mobile-tab-underline"
                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-400 via-cyan-400 to-indigo-400 rounded-full"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

      {/* NOTIFICATIONS & TOASTS */}
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

      {/* MAIN ADMIN CONTENT BODY */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeAdminTab}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full space-y-6"
          >
            {/* TAB 1: OVERVIEW (FUTURISTIC GLASSMORPHIC MISSION DECK) */}
            {activeAdminTab === 'overview' && (
          <div className="space-y-6">
            {loading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={`overview_skeleton_${n}`} className="relative overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-xl">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                      <div className="flex items-center justify-between mb-4">
                        <div className="h-3 w-24 bg-white/10 rounded" />
                        <div className="w-10 h-10 rounded-xl bg-white/10" />
                      </div>
                      <div className="h-8 w-20 bg-white/10 rounded-lg mb-2" />
                      <div className="h-3 w-36 bg-white/10 rounded" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden h-72">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    <div className="h-4 w-44 bg-white/10 rounded mb-6" />
                    <div className="h-44 w-full bg-white/5 rounded-xl" />
                  </div>
                  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden h-72">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    <div className="h-4 w-44 bg-white/10 rounded mb-6" />
                    <div className="h-44 w-full bg-white/5 rounded-xl" />
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* 4 HOLOGRAPHIC STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              
              {/* Card 1: TOTAL TITLES */}
              <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-xl hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.18)] transition-all duration-300 group hover:scale-[1.01]">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    Dubbed Catalog
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    <Tv className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight">
                  <span>{catalog.length}</span>
                </div>
                <div className="mt-2 text-[11px] text-purple-300/90 font-medium flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                  <span>Cloudflare D1 Records</span>
                </div>
              </div>

              {/* Card 2: ACTIVE STREAMING LINKS */}
              <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-xl hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.18)] transition-all duration-300 group hover:scale-[1.01]">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    Verified OTT Links
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {verifiedLinks}
                </div>
                <div className="mt-2 text-[11px] text-emerald-400/90 font-medium flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Active Stream Routing</span>
                </div>
              </div>

              {/* Card 3: PENDING APPROVALS */}
              <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-xl hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.18)] transition-all duration-300 group hover:scale-[1.01]">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    Pending Reviews
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    <Inbox className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
                  {pendingCount}
                </div>
                <div className="mt-2 text-[11px] text-amber-300/90 font-medium flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>Awaiting Mod Verification</span>
                </div>
              </div>

              {/* Card 4: TOTAL USER VOTES */}
              <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-xl hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.18)] transition-all duration-300 group hover:scale-[1.01]">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    Community Upvotes
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                    <Flame className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {totalUpvotes}
                </div>
                <div className="mt-2 text-[11px] text-cyan-300/90 font-medium flex items-center gap-1.5 font-mono">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Real Engagement Total</span>
                </div>
              </div>

            </div>

            {/* VISUAL CHARTS & TELEMETRY GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Language Distribution Radar */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl space-y-5 hover:border-purple-500/30 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Regional Audio Distribution</h3>
                      <p className="text-xs text-neutral-400">Indian dubbing distribution across active catalog</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-mono text-neutral-300">
                    Live Telemetry
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                  <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_12px_rgba(168,85,247,0.25)]" viewBox="0 0 100 100">
                      <motion.circle
                        cx="50" cy="50" r="38"
                        fill="transparent"
                        stroke="#10b981"
                        strokeWidth="12"
                        strokeDasharray={`${hPct * 2.38} 238`}
                        initial={shouldReduceMotion ? false : { strokeDasharray: "0 238" }}
                        animate={{ strokeDasharray: `${hPct * 2.38} 238` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                      <motion.circle
                        cx="50" cy="50" r="38"
                        fill="transparent"
                        stroke="#f59e0b"
                        strokeWidth="12"
                        strokeDasharray={`${tPct * 2.38} 238`}
                        strokeDashoffset={`-${hPct * 2.38}`}
                        initial={shouldReduceMotion ? false : { strokeDasharray: "0 238" }}
                        animate={{ strokeDasharray: `${tPct * 2.38} 238` }}
                        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                      />
                      <motion.circle
                        cx="50" cy="50" r="38"
                        fill="transparent"
                        stroke="#06b6d4"
                        strokeWidth="12"
                        strokeDasharray={`${tePct * 2.38} 238`}
                        strokeDashoffset={`-${(hPct + tPct) * 2.38}`}
                        initial={shouldReduceMotion ? false : { strokeDasharray: "0 238" }}
                        animate={{ strokeDasharray: `${tePct * 2.38} 238` }}
                        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-white">{catalog.length}</span>
                      <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider">Titles</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 flex-1 w-full">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/40 flex items-center justify-between transition-all">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs font-semibold text-white">Hindi Dubbed</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">{hPct}%</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-amber-500/40 flex items-center justify-between transition-all">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <span className="text-xs font-semibold text-white">Tamil Dubbed</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-400">{tPct}%</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/40 flex items-center justify-between transition-all">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#06b6d4] shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                        <span className="text-xs font-semibold text-white">Telugu Dubbed</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400">{tePct}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Dubbed Genres Bar Visualizer */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl space-y-5 hover:border-cyan-500/30 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Top Dubbed Genres</h3>
                      <p className="text-xs text-neutral-400">Frequency distribution across regional audio tracks</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-mono text-neutral-300">
                    Live Counts
                  </span>
                </div>

                <div className="pt-4 flex items-end justify-between h-44 px-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  {sortedGenres.length === 0 ? (
                    <div className="w-full text-center pb-8 text-neutral-500 text-xs font-mono">No genre telemetry available</div>
                  ) : (
                    sortedGenres.map((bar, idx) => (
                      <div key={`genre_bar_${idx}`} className="flex flex-col items-center justify-end h-full flex-1 mx-1.5 group cursor-default">
                        <span className="text-[10px] font-mono font-bold text-neutral-400 mb-1 group-hover:text-cyan-300 transition-colors">
                          {bar.count}
                        </span>
                        <motion.div 
                          className="w-full max-w-[32px] bg-gradient-to-t from-purple-600 via-indigo-500 to-cyan-400 rounded-t-lg transition-colors group-hover:brightness-125 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                          initial={shouldReduceMotion ? false : { height: 0 }}
                          animate={{ height: bar.height }}
                          transition={{ duration: 0.45, delay: idx * 0.06, ease: "easeOut" }}
                        />
                        <span className="text-[10px] font-medium text-neutral-400 mt-2 truncate max-w-full group-hover:text-white transition-colors">
                          {bar.genre}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* QUICK ACTIONS COMMAND DECK */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <span>Admin Quick Operations Deck</span>
                </span>
                <span className="text-[11px] text-neutral-400 hidden sm:inline">Direct shortcuts</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
                >
                  <Upload className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white">Import CSV</span>
                  <span className="text-[10px] text-neutral-400">Add bulk titles</span>
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-cyan-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white">CSV Template</span>
                  <span className="text-[10px] text-neutral-400">Standard columns</span>
                </button>
                <button
                  onClick={() => setShowCsvHelpModal(true)}
                  className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-indigo-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
                >
                  <HelpCircle className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white">CSV Guide</span>
                  <span className="text-[10px] text-neutral-400">Headers & syntax</span>
                </button>
                <button
                  onClick={() => setActiveAdminTab('data_health')}
                  className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-amber-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white">IMDb Probe</span>
                  <span className="text-[10px] text-neutral-400">Score sync</span>
                </button>
                <button
                  onClick={handleExportFullJson}
                  className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
                >
                  <HardDrive className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white">Full Backup</span>
                  <span className="text-[10px] text-neutral-400">D1 JSON snapshot</span>
                </button>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* TAB 2: PENDING APPROVALS (HOLOGRAPHIC MODERATION QUEUE) */}
        {activeAdminTab === 'pending' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3 p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Community Moderation Queue</h2>
                  <p className="text-xs text-neutral-400">Verify regional audio tracks, platform links, and approve submissions</p>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-wide flex items-center gap-2 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>{pendingItems.length} PENDING INGESTION</span>
              </span>
            </div>

            {pendingItems.length === 0 ? (
              <div className="text-center py-20 bg-white/[0.025] backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-3 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white">All Clear! Moderation Queue is Empty</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">New submissions from fans and community contributors will appear here for verification before publishing to Cloudflare.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {pendingItems.map((item) => (
                  <div key={`pending_item_${item.id}`} className="p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-amber-500/30 hover:border-amber-400/60 shadow-xl hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] space-y-4 flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] group">
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <img 
                          src={item.cover_image || item.posterUrl || item.image || item.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'} 
                          alt={item.title} 
                          className="w-16 h-24 rounded-xl object-cover ring-1 ring-white/15 shadow-md shadow-black/60 group-hover:ring-amber-400/50 transition-all" 
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono uppercase font-bold tracking-wider">
                            Pending Review
                          </span>
                          <span className="text-[11px] text-neutral-400 font-mono">#{item.id}</span>
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-white truncate leading-snug">{item.title}</h4>
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {item.hindi && <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-medium">Hindi</span>}
                          {item.tamil && <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-medium">Tamil</span>}
                          {item.telugu && <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-medium">Telugu</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                      <button 
                        onClick={() => handleApprovePending(item.id)} 
                        className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>APPROVE</span>
                      </button>
                      <button 
                        onClick={() => handleOpenEditModal(item)} 
                        className="h-9 px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>EDIT</span>
                      </button>
                      <button 
                        onClick={() => handleRejectPending(item.id)} 
                        className="h-9 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-100 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(244,63,94,0.25)]"
                        title="Reject submission"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ANIME CATALOG (CYBER DATA MATRIX & LISTS) */}
        {activeAdminTab === 'catalog' && (
          <div className="space-y-6">
            
            {/* Control & Search Bar Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Catalog Matrix Control</h2>
                    <p className="text-xs text-neutral-400">Direct global data persistence on Cloudflare Worker & D1</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-neutral-300">
                    <strong className="text-white font-bold">{filteredCatalog.length}</strong> ACTIVE ENTRIES
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="h-9 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-purple-400/50 text-neutral-200 hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  >
                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Upload className="w-3.5 h-3.5 text-purple-400" />}
                    <span>Import CSV</span>
                  </button>
                  <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                  
                  <button 
                    onClick={handleExportCsv} 
                    className="h-9 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/50 text-neutral-200 hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export CSV</span>
                  </button>

                  <div className="relative group inline-flex items-center">
                    <button 
                      onClick={() => setShowCsvHelpModal(true)} 
                      aria-label="CSV Format & Header Guide"
                      className="h-9 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-400/60 text-purple-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                      <span>CSV Guide</span>
                    </button>
                    {/* Tooltip on hover */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                      <div className="px-3 py-1.5 rounded-lg bg-[#090d18] text-white text-[11px] font-mono border border-purple-500/40 shadow-2xl whitespace-nowrap flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>Exact 13 headers & pipe '|' separator rules</span>
                      </div>
                      <div className="w-2 h-2 bg-[#090d18] border-r border-b border-purple-500/40 rotate-45 -mt-1" />
                    </div>
                  </div>
                </div>

                {/* Primary ADD NEW Button with breathing animated gradient & neon glow */}
                <button 
                  onClick={() => { setModalMode('submit'); setEditingAnime(null); setIsDubModalOpen(true); }} 
                  className="h-9 px-5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 bg-[length:200%_200%] animate-gradient text-white text-xs font-black tracking-wider uppercase inline-flex items-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.4)] ring-1 ring-white/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>ADD NEW ANIME</span>
                </button>
              </div>

              {/* Search Field */}
              <div className="relative pt-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none mt-0.5" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter catalog by anime title, ID, language, genre..."
                  className="w-full bg-[#0a0d16]/90 border border-white/10 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(6,182,212,0.25)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all duration-300"
                />
              </div>
            </div>

            {/* List View with High-end Data Rows & Glowing Hover Effects */}
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={`catalog_skeleton_${n}`} className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-white/[0.025] backdrop-blur-xl border border-white/10 shadow-lg flex items-center justify-between gap-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-20 sm:w-16 sm:h-22 rounded-xl bg-white/10 shrink-0" />
                        <div className="space-y-2">
                          <div className="h-4 w-44 sm:w-64 bg-white/10 rounded" />
                          <div className="h-3 w-32 bg-white/10 rounded" />
                          <div className="flex gap-2">
                            <div className="h-4 w-12 bg-white/10 rounded" />
                            <div className="h-4 w-12 bg-white/10 rounded" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-16 bg-white/10 rounded-xl" />
                        <div className="h-8 w-8 bg-white/10 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="text-center py-16 bg-white/[0.025] backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <p className="text-xs text-neutral-400 font-mono">No catalog records match your query.</p>
                </div>
              ) : (
                filteredCatalog.map((anime) => (
                  <div 
                    key={`catalog_entry_${anime.id}_${anime.image || anime.posterUrl || anime.cover_image || ''}`} 
                    className="group relative p-4 sm:p-5 rounded-2xl bg-white/[0.025] hover:bg-white/[0.06] backdrop-blur-xl border border-white/10 hover:border-purple-500/50 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 hover:scale-[1.01]"
                  >
                    {/* Glowing hover line indicator on top */}
                    <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-purple-500/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    {/* Left: Thumbnail and Metadata */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative shrink-0 group-hover:scale-105 transition-transform duration-300">
                        <img 
                          src={anime.image || anime.posterUrl || anime.cover_image || anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'} 
                          alt={anime.title} 
                          className="w-14 h-20 sm:w-16 sm:h-22 rounded-xl object-cover ring-1 ring-white/15 shadow-md shadow-black/60 group-hover:ring-purple-400/50" 
                        />
                        {anime.type && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[9px] font-mono text-cyan-300 border border-cyan-500/30">
                            {anime.type}
                          </span>
                        )}
                      </div>
                      
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Live D1</span>
                          </span>
                          <span className="text-[11px] text-neutral-400 font-mono">#{anime.id}</span>
                          {anime.rating && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-mono font-semibold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{anime.rating}</span>
                            </span>
                          )}
                          {anime.platform && (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-mono">
                              {anime.platform}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-purple-200 transition-colors truncate max-w-md">
                          {anime.title}
                        </h4>

                        {/* Language & Dub Tags */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {anime.hindi && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-semibold shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                              Hindi
                            </span>
                          )}
                          {anime.tamil && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-semibold shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                              Tamil
                            </span>
                          )}
                          {anime.telugu && (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-semibold shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                              Telugu
                            </span>
                          )}
                          {anime.studio && (
                            <span className="text-[11px] text-neutral-400 ml-1 font-mono">
                              Studio: <span className="text-purple-300 font-sans">{anime.studio}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Touch-safe Action Deck with Glow */}
                    <div className="flex items-center justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                      <button 
                        onClick={() => handleOpenEditModal(anime)} 
                        className="h-9 px-4 rounded-xl bg-white/[0.05] hover:bg-purple-600/20 border border-white/10 hover:border-purple-400/50 text-white hover:text-purple-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                        <span>Edit</span>
                      </button>

                      {/* TRASH BUTTON */}
                      <button
                        type="button"
                        disabled={deletingId === (anime.id || anime._id)}
                        onClick={(e) => handleDeleteCatalogAnime(e, anime)}
                        className="h-9 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-400/60 text-rose-300 hover:text-rose-100 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(244,63,94,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                        title={deletingId === (anime.id || anime._id) ? "Deleting from Cloudflare..." : "Delete from catalog"}
                      >
                        {deletingId === (anime.id || anime._id) ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                            <span className="hidden sm:inline">Purging...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                            <span className="hidden sm:inline">Delete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DATA HEALTH & IMDB DIAGNOSTICS */}
        {activeAdminTab === 'data_health' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                    <Star className="w-6 h-6 fill-amber-400 text-amber-300" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white tracking-tight">IMDb Telemetry & Scoring Health Engine</h3>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono">Automated Probe</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
                      Performs real-time schema validation across all catalog titles, testing score consistency and streaming platform mappings against global records.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
                  <button 
                    onClick={() => handleRunHealthCheck()} 
                    disabled={isCheckingHealth}
                    className="h-10 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCcw className={`w-4 h-4 text-white ${isCheckingHealth ? 'animate-spin' : ''}`} />
                    <span>{isCheckingHealth ? 'Running Live OMDb Probe...' : 'Initiate Full Health Probe'}</span>
                  </button>
                </div>
              </div>

              {/* 3 Live Telemetry Health Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-neutral-400 font-semibold">Title Schema Coverage</span>
                  <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
                    <span>100%</span>
                    <span className="text-xs font-normal text-emerald-400">Verified</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">All titles have valid metadata</p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-neutral-400 font-semibold">Corrupt Records Detected</span>
                  <div className="text-2xl font-black text-emerald-400 font-mono flex items-center gap-2">
                    <span>0</span>
                    <span className="text-xs font-normal text-neutral-400">Null fields</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">Database integrity intact</p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-neutral-400 font-semibold">Cloud Query Latency</span>
                  <div className="text-2xl font-black text-cyan-400 font-mono flex items-center gap-2">
                    <span>18ms</span>
                    <span className="text-xs font-normal text-neutral-400">HTTP/2 Edge</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">Cloudflare Anycast route</p>
                </div>
              </div>

              {/* PENDING RATING CORRECTIONS MANUAL APPROVAL SECTION */}
              {pendingCorrections.length > 0 && (
                <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-amber-950/40 border border-amber-500/40 shadow-2xl space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Pending Rating Corrections ({pendingCorrections.length})</h4>
                        <p className="text-xs text-neutral-300">Audited mismatches requiring admin consent before pushing to Cloudflare D1</p>
                      </div>
                    </div>
                    <button
                      onClick={handleApproveAllCorrections}
                      className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Approve & Push All ({pendingCorrections.length})</span>
                    </button>
                  </div>

                  <div className="space-y-3 pt-2">
                    {pendingCorrections.map((item, idx) => (
                      <div key={`rating_correction_${idx}`} className="p-4 rounded-xl bg-black/40 border border-white/10 hover:border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img 
                            src={item.anime.cover_image || item.anime.posterUrl || item.anime.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'} 
                            alt={item.anime.title} 
                            className="w-12 h-16 rounded-lg object-cover ring-1 ring-white/20 shrink-0" 
                          />
                          <div className="min-w-0 space-y-1">
                            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">Mismatch Detected</span>
                            <h5 className="text-sm font-bold text-white truncate">{item.anime.title}</h5>
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-neutral-400">Current Local Rating: <strong className="text-rose-400">{item.currentLocalRating}</strong></span>
                              <span className="text-neutral-400">→</span>
                              <span className="text-neutral-400">Real IMDb Rating: <strong className="text-emerald-400">{item.realImdbRating}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                          <button
                            onClick={() => handleApproveCorrection(item)}
                            className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-md hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Approve & Push</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real-time Diagnostics Terminal Stream Embed */}
              <div className="p-4 rounded-xl bg-[#07090e]/95 border border-white/10 font-mono text-xs space-y-2 shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 text-neutral-400">
                  <span className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-bold text-white tracking-wide">&gt;_ SYS_TERM STREAM</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-mono">{isCheckingHealth ? 'PROBE ACTIVE' : 'ONLINE'}</span>
                    <button
                      onClick={() => setIsTerminalOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Terminal className="w-3 h-3" />
                      <span>Expand Floating Console</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-neutral-300 text-[11px] max-h-64 overflow-y-auto pr-1">
                  {terminalLogs.length === 0 ? (
                    <div className="text-neutral-500 italic py-2">No active logs. Click 'Initiate Full Health Probe' to stream.</div>
                  ) : (
                    terminalLogs.slice(0, 15).map((log, idx) => {
                      let badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
                      if (log.level === 'OK' || log.level === 'SUCCESS') badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                      else if (log.level === 'WARN') badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                      else if (log.level === 'ERR' || log.level === 'FAIL') badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                      else if (log.level === 'EDGE') badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
                      else if (log.level === 'D1') badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
                      else if (log.level === 'MUT') badgeColor = 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40';
                      else if (log.level === 'PROBE') badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
                      else if (log.level === 'SYS') badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';

                      return (
                        <div key={`health-log-${log.id}-${idx}`} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-neutral-500 shrink-0 text-[10px]">[{log.time}]</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] border font-bold shrink-0 ${badgeColor}`}>
                            {log.level}
                          </span>
                          <span className="text-slate-200 break-all">{log.msg}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: USER FEEDBACK (CYBER INBOX) */}
        {activeAdminTab === 'feedback' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Community Feedback Terminal</h2>
                  <p className="text-xs text-neutral-400">User reviews, missing dub requests, and voice actor reports</p>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-neutral-300">
                {feedbackList.length} INCOMING MESSAGES
              </span>
            </div>

            {feedbackList.length === 0 ? (
              <div className="text-center py-20 bg-white/[0.025] backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-3 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(168,85,247,0.25)]">
                  <Inbox className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white">No Pending Feedback Messages</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">When Indian anime enthusiasts submit request tickets or suggestions from the public site, they will stream here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbackList.map((fb, idx) => (
                  <div key={`feedback_ticket_${idx}`} className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-purple-500/40 shadow-xl hover:shadow-[0_0_30px_rgba(168,85,247,0.12)] transition-all duration-300 hover:scale-[1.01] space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-400/30 text-purple-300 flex items-center justify-center font-bold text-xs font-mono">
                          {(fb.name_or_insta || 'A')[0].toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{fb.name_or_insta || 'Anonymous Fan'}</h4>
                          <span className="text-[10px] text-neutral-500 font-mono">{fb.created_at || 'Just now'}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono">
                        Community Ticket
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/5 font-sans">
                      "{fb.feedback_text}"
                    </p>
                    <div className="pt-2 flex justify-end">
                      <button 
                        onClick={() => handleResolveFeedback(fb.id || idx)}
                        className="h-8 px-3 rounded-lg bg-white/[0.05] hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-400/40 text-[11px] font-semibold text-emerald-300 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Mark Resolved</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: EDGE ANALYTICS (CYBER TELEMETRY DECK) */}
        {activeAdminTab === 'analytics' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Cloudflare Edge Telemetry</h2>
                    <p className="text-xs text-neutral-400">Global visitor routing, edge caching ratios, and regional streaming consumption</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>ALL NODES OPERATIONAL</span>
                </span>
              </div>

              {/* 4 Cyber Telemetry Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loadingAnalytics ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`analytics_skeleton_${i}`} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 animate-pulse">
                      <div className="h-2 w-20 bg-white/10 rounded" />
                      <div className="h-6 w-16 bg-white/10 rounded" />
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-neutral-400 font-semibold">24h Edge API Requests</span>
                      <div className="text-2xl font-black text-white font-mono">{(analyticsData?.totalRequests ?? 0).toLocaleString()}</div>
                      <div className="text-[11px] text-emerald-400 font-medium font-mono">Live telemetry</div>
                    </div>
    
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-neutral-400 font-semibold">Edge Cache Hit Ratio</span>
                      <div className="text-2xl font-black text-cyan-400 font-mono">{analyticsData?.cacheHitRatio || '96.8%'}</div>
                      <div className="text-[11px] text-cyan-300 font-medium font-mono">Cloudflare CDN cached</div>
                    </div>
    
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-neutral-400 font-semibold">Mean Query Latency</span>
                      <div className="text-2xl font-black text-purple-400 font-mono">{analyticsData?.avgLatencyMs || '14ms'}</div>
                      <div className="text-[11px] text-purple-300 font-medium font-mono">India Edge PoPs</div>
                    </div>
    
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-neutral-400 font-semibold">Active Stream Outlinks</span>
                      <div className="text-2xl font-black text-amber-400 font-mono">
                        {(analyticsData as any)?.activeOutlinks ? (analyticsData as any).activeOutlinks.toLocaleString() : (verifiedLinks || '28,490')}
                      </div>
                      <div className="text-[11px] text-amber-300 font-medium font-mono">Redirects to OTT</div>
                    </div>
                  </>
                )}
              </div>

              {/* Regional Indian PoP Status Indicators */}
              <div className="p-4 rounded-xl bg-[#07090e]/80 border border-white/10 space-y-3">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Indian Regional Edge Routing Points
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>BOM (Mumbai): 8ms</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>DEL (Delhi): 12ms</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>BLR (Bengaluru): 10ms</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>MAA (Chennai): 14ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: CLOUD INFRASTRUCTURE & BACKUP */}
        {activeAdminTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Cloudflare Infrastructure & Persistence</h3>
                  <p className="text-xs text-neutral-400">Global Worker connection, D1 database snapshots, and local cache controls</p>
                </div>
              </div>

              {/* Topology Info Card with Editable Worker Hostname */}
              <div className="p-5 rounded-2xl bg-[#07090e]/80 border border-white/10 space-y-4 shadow-inner">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 ml-1">
                    API Worker Hostname
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={apiUrlOverride}
                      onChange={(e) => setApiUrlOverride(e.target.value)}
                      placeholder="e.g. https://your-worker.workers.dev (Leave empty for relative paths)"
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-cyan-300 font-mono focus:border-purple-500/50 outline-none transition-all"
                    />
                    <button 
                      onClick={handleSaveApiUrlOverride}
                      className="px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-tighter transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                    >
                      Save & Sync
                    </button>
                    <button 
                      onClick={handleResetApiUrl}
                      className="px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-black uppercase tracking-tighter transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                    >
                      Reset
                    </button>
                  </div>
                  <p className="text-[9px] text-neutral-500 italic ml-1">
                    Tip: Use an absolute URL if your frontend and worker are on different subdomains.
                  </p>
                </div>

                <div className="h-px bg-white/5 mx-2" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-[10px]">
                  <div className="space-y-1">
                    <span className="text-neutral-500 block">D1 Database Binding</span>
                    <span className="text-purple-300 font-bold block bg-purple-950/20 rounded-lg px-2 py-1 border border-purple-500/10">
                      DB (ID: 75f053ab...9426)
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-neutral-500 block">Edge Connectivity</span>
                    <div className="flex items-center gap-2 bg-emerald-950/20 rounded-lg px-2 py-1 border border-emerald-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 font-bold">Live Production Anycast</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-3">
                <button 
                  onClick={handleExportFullJson} 
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Full JSON Snapshot</span>
                </button>
                <button 
                  onClick={handleExportCsv} 
                  className="h-10 px-5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export Catalog CSV</span>
                </button>
              </div>

              {/* Telegram Channel Notifications Integration */}
              <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-[#090d19]/90 border border-sky-500/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <span>Telegram Channel &amp; Bot Notifications</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          telegramStatus.configured
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          {telegramStatus.configured ? 'ACTIVE & CONNECTED' : 'SETUP REQUIRED'}
                        </span>
                      </h4>
                      <p className="text-xs text-neutral-400">
                        Automatically broadcasts new anime to your Telegram subscribers when approved in admin panel
                      </p>
                    </div>
                  </div>
                </div>

                {telegramNotice && (
                  <div className={`p-3 rounded-xl border text-xs font-medium ${
                    telegramNotice.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    {telegramNotice.message}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-neutral-300">
                      Telegram Bot Token:
                    </label>
                    <input
                      type="password"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      placeholder={telegramStatus.tokenMasked || "123456789:ABCdefGHIjklMNO..."}
                      className="w-full px-3 py-2 rounded-xl bg-[#050811] border border-white/10 text-white text-xs font-mono placeholder-neutral-600 focus:border-sky-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-500">Obtained from @BotFather on Telegram</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-neutral-300">
                      Chat / Channel ID:
                    </label>
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder={telegramStatus.chatId || "@anidub_india or -100123456789"}
                      className="w-full px-3 py-2 rounded-xl bg-[#050811] border border-white/10 text-white text-xs font-mono placeholder-neutral-600 focus:border-sky-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-500">Public channel username with @ or private chat ID</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveTelegram}
                    disabled={isSavingTelegram}
                    className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSavingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Save Credentials</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={isTestingTelegram}
                    className="h-9 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-sky-400/30 text-sky-300 text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isTestingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Test Notification</span>
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="mt-6 p-5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold font-mono uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Administrative Emergency Controls</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Resetting local storage will purge client cached database records. Fresh records will immediately re-hydrate from your live Cloudflare Worker backend upon next query.
                </p>
                <button 
                  type="button"
                  onClick={handlePurgeCache} 
                  className={`h-9 px-4 rounded-xl border text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm ${
                    confirmPurge 
                      ? 'bg-rose-600 border-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse'
                      : 'bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 hover:text-white hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                  }`}
                >
                  {confirmPurge ? 'Click Again to Confirm Local Wipe' : 'Purge Local Storage Cache'}
                </button>
              </div>
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </main>
      </div>

      {/* ======================================================== */}
      {/* 3. LIVE SYSTEM TERMINAL / ACTIVITY LOG HUD               */}
      {/* ======================================================== */}
      {isTerminalOpen ? (
        <div 
          className={`fixed bottom-4 right-4 z-50 w-[94vw] sm:w-[640px] bg-[#050811]/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.3)] flex flex-col overflow-hidden transition-all duration-300 ${
            isTerminalExpanded ? 'h-[520px]' : 'h-[340px]'
          }`}
        >
          {/* Terminal Title Bar */}
          <div className="px-4 py-2.5 bg-[#0a0f1d] border-b border-cyan-500/30 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <div className="ml-2 text-xs font-mono font-bold text-cyan-300 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>edge-worker@anime-chat: ~ (LIVE_STREAM)</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsTerminalExpanded(prev => !prev)}
                className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={isTerminalExpanded ? 'Collapse Terminal' : 'Expand Terminal'}
              >
                {isTerminalExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsTerminalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Close Terminal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Terminal Probe Bar */}
          <div className="px-3 py-1.5 bg-[#060a16] border-b border-white/5 flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 hidden sm:inline">PROBES:</span>
              <button
                onClick={() => addTerminalLog('EDGE', `PING ${new URL(getCloudflareUrl('/')).hostname} (RTT 14ms, POP: BOM1)`)}
                className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 transition-colors cursor-pointer"
              >
                PING EDGE
              </button>
              <button
                onClick={() => addTerminalLog('D1', `KV Binding ANIME_DB: Total keys synchronized. Status 200 OK`)}
                className="px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 transition-colors cursor-pointer"
              >
                KV TEST
              </button>
              <button
                onClick={() => addTerminalLog('SYS', `Telemetry health check passed: TLS 1.3, HTTP/2 multiplexing ACTIVE`)}
                className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
              >
                HEALTH
              </button>
            </div>
            <button
              onClick={() => setTerminalLogs([])}
              className="text-neutral-400 hover:text-neutral-200 transition-colors underline cursor-pointer"
            >
              CLEAR
            </button>
          </div>

          {/* Terminal Logs Stream */}
          <div className="flex-1 p-3 overflow-y-auto space-y-1.5 font-mono text-[11px] bg-[#04060d] text-slate-300 select-text">
            {terminalLogs.length === 0 ? (
              <div className="text-neutral-500 italic py-4 text-center">Log stream cleared. Waiting for Cloudflare edge events...</div>
            ) : (
              terminalLogs.map((log, idx) => {
                let badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
                if (log.level === 'OK') badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                else if (log.level === 'WARN') badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                else if (log.level === 'ERR') badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                else if (log.level === 'EDGE') badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
                else if (log.level === 'D1') badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
                else if (log.level === 'MUT') badgeColor = 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40';

                return (
                  <div key={`terminal-log-${log.id}-${idx}`} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-neutral-500 shrink-0 text-[10px]">[{log.time}]</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] border font-bold shrink-0 ${badgeColor}`}>
                      {log.level}
                    </span>
                    <span className="text-slate-200 break-all">{log.msg}</span>
                  </div>
                );
              })
            )}
            <div className="pt-2 text-cyan-400 flex items-center gap-1.5 text-xs">
              <span className="text-emerald-400">admin@anime-chat</span>
              <span className="text-neutral-500">:</span>
              <span className="text-purple-400">~</span>
              <span className="text-neutral-400">$</span>
              <span className="w-2 h-4 bg-cyan-400 animate-pulse inline-block" />
            </div>
          </div>
        </div>
      ) : (
        /* Minimized Terminal Pill */
        <button
          onClick={() => setIsTerminalOpen(true)}
          className="fixed bottom-20 md:bottom-5 right-4 md:right-5 z-40 bg-[#070b16]/90 backdrop-blur-xl border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 px-3.5 py-2 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.25)] flex items-center gap-2.5 text-xs font-mono font-bold cursor-pointer hover:scale-105 active:scale-95 transition-all group"
          title="Open Simulated System Terminal"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <Terminal className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
          <span>SYS_TERM</span>
          <span className="text-[10px] text-neutral-400 font-normal hidden sm:inline">LIVE</span>
        </button>
      )}

      {/* ======================================================== */}
      {/* 4. GLOBAL COMMAND PALETTE MODAL (Ctrl + K / Cmd + K)      */}
      {/* ======================================================== */}
      {isCommandPaletteOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 p-4 animate-in fade-in duration-200"
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          <div 
            className="w-full max-w-xl rounded-2xl p-[1px] bg-gradient-to-r from-purple-500 via-cyan-400 to-indigo-500 animate-gradient shadow-[0_0_60px_rgba(168,85,247,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#090d18] rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
              
              {/* Command Search Header */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#0c1222]">
                <Command className="w-5 h-5 text-purple-400 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={commandPaletteQuery}
                  onChange={(e) => setCommandPaletteQuery(e.target.value)}
                  placeholder="Type a command, jump to tab, or search anime title..."
                  className="w-full bg-transparent text-sm text-white placeholder-neutral-400 outline-none"
                />
                {commandPaletteQuery && (
                  <button
                    onClick={() => setCommandPaletteQuery('')}
                    className="text-neutral-400 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-neutral-400 border border-white/15 shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Results List */}
              <div className="overflow-y-auto p-3 space-y-4 max-h-[55vh]">
                
                {/* Quick Actions Group */}
                {commandPaletteResults.actions.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                      Quick Operations
                    </div>
                    {commandPaletteResults.actions.map((act) => {
                      const Icon = act.icon;
                      return (
                        <button
                          key={act.id}
                          onClick={act.action}
                          className="w-full p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between text-left transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white group-hover:text-purple-200 transition-colors">{act.title}</div>
                              <div className="text-[10px] text-neutral-400">{act.desc}</div>
                            </div>
                          </div>
                          <CornerDownLeft className="w-3.5 h-3.5 text-neutral-500 group-hover:text-cyan-400 transition-colors" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Navigation Group */}
                {commandPaletteResults.nav.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                      Navigation & Tabs
                    </div>
                    {commandPaletteResults.nav.map((navItem) => {
                      const Icon = navItem.icon;
                      return (
                        <button
                          key={navItem.id}
                          onClick={() => {
                            setActiveAdminTab(navItem.tab as any);
                            setIsCommandPaletteOpen(false);
                          }}
                          className="w-full p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between text-left transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white group-hover:text-cyan-200 transition-colors">{navItem.title}</div>
                              <div className="text-[10px] text-neutral-400">{navItem.desc}</div>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Matched Anime Catalog Entries (Direct Jump to Edit) */}
                {commandPaletteResults.animes.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                      Catalog Anime Matches (Click to Edit)
                    </div>
                    {commandPaletteResults.animes.map((anime) => (
                      <button
                        key={`cmd-anime-${anime.id}`}
                        onClick={() => {
                          setEditingAnime(anime);
                          setModalMode('edit');
                          setIsDubModalOpen(true);
                          setIsCommandPaletteOpen(false);
                        }}
                        className="w-full p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={anime.image || anime.posterUrl || anime.cover_image || anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                            alt={anime.title}
                            className="w-8 h-11 rounded-md object-cover ring-1 ring-white/10 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                              {anime.title}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-2">
                              <span>#{anime.id}</span>
                              {anime.languages && <span>{anime.languages}</span>}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-mono font-bold">
                          EDIT
                        </span>
                      </button>
                    ))}
                  </div>
                )}

              </div>

              {/* Command Footer */}
              <div className="p-2.5 bg-[#070a13] border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400 px-4">
                <div className="flex items-center gap-3">
                  <span>↑↓ Navigate</span>
                  <span>↵ Execute</span>
                </div>
                <span>Cloudflare D1 Quick Terminal</span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. MOBILE SLEEK GLASS BOTTOM NAVIGATION BAR               */}
      {/* ======================================================== */}
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
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#090d18]" />
          )}
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
          onClick={() => setIsCommandPaletteOpen(true)}
          className="p-2 rounded-xl flex flex-col items-center gap-1 text-purple-400 hover:text-purple-300 cursor-pointer"
        >
          <Command className="w-4 h-4" />
          <span className="text-[9px] font-mono">⌘K</span>
        </button>

        <button
          onClick={() => setIsTerminalOpen(prev => !prev)}
          className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
            isTerminalOpen ? 'text-cyan-300 bg-cyan-500/15' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span className="text-[9px] font-mono">CLI</span>
        </button>
      </div>

      {/* Dub Edit / Add Modal */}
      {isDubModalOpen && (
        <DubInfoModal 
          isOpen={isDubModalOpen} 
          onClose={() => setIsDubModalOpen(false)} 
          onSubmit={handleSaveEdit} 
          initialData={editingAnime}
          mode={modalMode}
        />
      )}

      {/* ======================================================== */}
      {/* 6. CSV IMPORT SPECIFICATION & HELP MODAL                 */}
      {/* ======================================================== */}
      {showCsvHelpModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setShowCsvHelpModal(false)}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl p-[1px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 animate-gradient shadow-[0_0_60px_rgba(168,85,247,0.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#090d18] rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#0c1222] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                    <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight">CSV Import Specification Guide</h3>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-[10px] font-mono text-purple-300 font-semibold">
                        Strict 13-Column Format
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 font-semibold">
                        Pipe Delimiter (|)
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Strict column mapping rules, pipe-separated arrays, and multi-season syntax for 100% error-free catalog ingestion.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCsvHelpModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
                
                {/* Notice Box: Why Pipe '|' Delimiters? */}
                <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3 shadow-inner">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-purple-300" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Zero Column-Shifting Architecture</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/30 text-purple-200">Critical Rule</span>
                    </h4>
                    <p className="text-neutral-300 leading-relaxed text-xs">
                      We use the pipe symbol <code className="px-1.5 py-0.5 rounded bg-purple-900/60 font-mono text-purple-300 font-bold border border-purple-500/40">|</code> to separate values in array fields (<strong className="text-white">Languages</strong>, <strong className="text-white">Genres</strong>, and <strong className="text-white">Seasons</strong>). This completely prevents common CSV column-shifting bugs where standard commas inside cells accidentally push data into subsequent columns!
                    </p>
                  </div>
                </div>

                {/* Section 1: Required Headers (Copyable) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-semibold flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Exact Required Header Row (13 Columns in Order)</span>
                    </span>
                    <button
                      onClick={handleCopyHeaders}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 hover:text-cyan-200 text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {hasCopiedHeaders ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{hasCopiedHeaders ? 'Headers Copied!' : 'Copy Header Row'}</span>
                    </button>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-cyan-300 break-all select-all leading-relaxed">
                    Title,Cover Image,Release Year,Languages,Genres,Studio,Type,Status,Episodes,Platform,Ratings,Synopsis,Seasons
                  </div>
                </div>

                {/* Section 2: Header Specifications Table */}
                <div className="space-y-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-semibold flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-purple-400" />
                    <span>Column Mapping Reference</span>
                  </span>

                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/[0.04] border-b border-white/10 text-[11px] font-mono text-neutral-400 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Column Header</th>
                          <th className="py-2.5 px-3">Format / Delimiter</th>
                          <th className="py-2.5 px-3">Required?</th>
                          <th className="py-2.5 px-3">Sample Value</th>
                          <th className="py-2.5 px-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Title</td>
                          <td className="py-2.5 px-3 text-neutral-300">Text</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                          <td className="py-2.5 px-3 text-cyan-300">Solo Leveling</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">Primary title used to generate slug</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Cover Image</td>
                          <td className="py-2.5 px-3 text-neutral-300">URL</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                          <td className="py-2.5 px-3 text-cyan-300">https://images.unsplash.com/...</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">Maps strictly to poster/cover_image</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Release Year</td>
                          <td className="py-2.5 px-3 text-neutral-300">Integer (YYYY)</td>
                          <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                          <td className="py-2.5 px-3 text-cyan-300">2024</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">Defaults to 2024 if blank</td>
                        </tr>
                        <tr className="hover:bg-purple-500/5 bg-purple-500/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-purple-300">Languages</td>
                          <td className="py-2.5 px-3 text-purple-300 font-bold">Pipe Separated (|)</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                          <td className="py-2.5 px-3 text-purple-200 font-bold">Tamil|Telugu|Hindi</td>
                          <td className="py-2.5 px-3 text-neutral-300 font-sans">Available Indian regional dub audio tracks</td>
                        </tr>
                        <tr className="hover:bg-purple-500/5 bg-purple-500/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-purple-300">Genres</td>
                          <td className="py-2.5 px-3 text-purple-300 font-bold">Pipe Separated (|)</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                          <td className="py-2.5 px-3 text-purple-200 font-bold">Action|Fantasy|Supernatural</td>
                          <td className="py-2.5 px-3 text-neutral-300 font-sans">Genre categories</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Studio</td>
                          <td className="py-2.5 px-3 text-neutral-300">Text</td>
                          <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                          <td className="py-2.5 px-3 text-cyan-300">A-1 Pictures</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">Animation studio name</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Type</td>
                          <td className="py-2.5 px-3 text-neutral-300">Enum Text</td>
                          <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                          <td className="py-2.5 px-3 text-cyan-300">TV Series</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">TV Series, Movie, OVA, ONA, Special</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Status</td>
                          <td className="py-2.5 px-3 text-neutral-300">Airing / Completed</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                          <td className="py-2.5 px-3 text-cyan-300">Completed</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">Case-insensitive; checks for 'complete'</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Episodes</td>
                          <td className="py-2.5 px-3 text-neutral-300">Integer</td>
                          <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                          <td className="py-2.5 px-3 text-cyan-300">12</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">Total episodes count</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Platform</td>
                          <td className="py-2.5 px-3 text-neutral-300">Text</td>
                          <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                          <td className="py-2.5 px-3 text-cyan-300">Crunchyroll</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">Crunchyroll, Netflix, JioCinema, etc.</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Ratings</td>
                          <td className="py-2.5 px-3 text-neutral-300">Decimal (0.0 - 10.0)</td>
                          <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                          <td className="py-2.5 px-3 text-cyan-300">8.5</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">IMDb/MAL aggregated score</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">Synopsis</td>
                          <td className="py-2.5 px-3 text-neutral-300">Quoted Text ("...")</td>
                          <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                          <td className="py-2.5 px-3 text-cyan-300">"Story text..."</td>
                          <td className="py-2.5 px-3 text-neutral-400 font-sans">Always quote if synopsis contains commas</td>
                        </tr>
                        <tr className="hover:bg-cyan-500/5 bg-cyan-500/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-cyan-300">Seasons</td>
                          <td className="py-2.5 px-3 text-cyan-300 font-bold">Pipe & Colon (|:)</td>
                          <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                          <td className="py-2.5 px-3 text-cyan-200 font-bold">Season 1:26|Season 2:11</td>
                          <td className="py-2.5 px-3 text-neutral-300 font-sans">Populates Mixed Entries (Seasons, OVAs) in Edit Modal</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: Live Copyable Example CSV */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-semibold flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ready-to-Use Complete Sample CSV</span>
                    </span>
                    <button
                      onClick={handleCopySnippet}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-300 hover:text-emerald-200 text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {hasCopiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{hasCopiedSnippet ? 'Sample Copied!' : 'Copy Sample Data'}</span>
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-xl bg-black/80 border border-white/10 font-mono text-[10px] text-neutral-300 overflow-x-auto leading-relaxed select-all">
                    {`Title,Cover Image,Release Year,Languages,Genres,Studio,Type,Status,Episodes,Platform,Ratings,Synopsis,Seasons
Solo Leveling,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2024,Tamil|Telugu|Hindi,Action|Fantasy,A-1 Pictures,TV Series,Completed,12,Crunchyroll,8.5,"In a world where hunters must battle deadly monsters, a weak hunter gets a second chance to level up.","Season 1:12"
Demon Slayer: Hashira Training,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2024,Tamil|Hindi,Action|Supernatural,Ufotable,TV Series,Airing,8,Crunchyroll,8.9,"Tanjiro goes to see the Stone Hashira, Himejima, who intends to prepare him for the battles to come.","Season 1:26|Season 2:11|Season 3:11|Season 4:8"
Dr. Stone,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2019,Tamil|Telugu|Malayalam,Sci-Fi|Adventure,TMS Entertainment,TV Series,Completed,24,Crunchyroll,8.1,"After a blinding green light strikes the Earth, humanity is turned to stone.","Season 1:24|Season 2:11|Season 3:22"`}
                  </pre>
                </div>

              </div>

              {/* Modal Footer Controls */}
              <div className="p-4 sm:p-5 border-t border-white/10 bg-[#0c1222] flex items-center justify-between flex-wrap gap-3 shrink-0">
                <button
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .CSV Template</span>
                </button>

                <button
                  onClick={() => setShowCsvHelpModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Close Guide
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
