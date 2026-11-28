import React from 'react';
import {
  Search,
  Plus,
  Film,
  Clock,
  ShieldCheck,
  BarChart3,
  Settings,
  Download,
  Terminal,
  Languages,
  LayoutDashboard,
  Layers,
  Mic2,
  Star,
  RefreshCw,
  FileSpreadsheet,
  HelpCircle,
  MessageSquare,
} from 'lucide-react';
import type { AdminActiveTab } from './types';

export interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  cmdQuery: string;
  setCmdQuery: (q: string) => void;
  pendingCount: number;
  feedbackCount: number;
  dataHealthCount: number;
  onOpenAddModal: (prefillTitle?: string) => void;
  onSetActiveTab: (tab: AdminActiveTab) => void;
  onFilterUnverifiedDubs?: () => void;
  onExportCSV: () => void;
  onRunDiagnostics: () => void;
  onSyncLiveRecords?: () => void;
  onOpenCsvHelp?: () => void;
  onDownloadSampleCsv?: () => void;
  filteredCatalog: any[];
  onEditAnime: (anime: any) => void;
}

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({
  isOpen,
  onClose,
  cmdQuery,
  setCmdQuery,
  pendingCount,
  feedbackCount,
  dataHealthCount,
  onOpenAddModal,
  onSetActiveTab,
  onExportCSV,
  onRunDiagnostics,
  onSyncLiveRecords,
  onOpenCsvHelp,
  onDownloadSampleCsv,
  filteredCatalog,
  onEditAnime,
}) => {
  if (!isOpen) return null;

  const quickOperations = [
    {
      label: cmdQuery.trim()
        ? `Add New Anime to Catalog: "${cmdQuery.trim()}"`
        : 'Add New Anime to Catalog',
      badge: 'CREATE',
      icon: Plus,
      color: 'text-purple-400',
      action: () => {
        onOpenAddModal(cmdQuery.trim() || undefined);
        onClose();
      },
    },
    {
      label: 'Sync Live Cloudflare D1 Records',
      badge: 'SYNC',
      icon: RefreshCw,
      color: 'text-cyan-400',
      action: () => {
        if (onSyncLiveRecords) onSyncLiveRecords();
        onClose();
      },
    },
    {
      label: 'Toggle Live System Terminal',
      badge: 'CONSOLE',
      icon: Terminal,
      color: 'text-emerald-400',
      action: () => {
        onRunDiagnostics();
        onClose();
      },
    },
    {
      label: 'Run Diagnostic Health Scanner',
      badge: 'PROBE',
      icon: Star,
      color: 'text-amber-400',
      action: () => {
        onSetActiveTab('imdb_checker');
        onClose();
      },
    },
    {
      label: 'Download Full JSON Snapshot',
      badge: 'BACKUP',
      icon: Download,
      color: 'text-purple-400',
      action: () => {
        onSetActiveTab('settings');
        onClose();
      },
    },
    {
      label: 'Export Anime Catalog to CSV',
      badge: 'CSV',
      icon: FileSpreadsheet,
      color: 'text-emerald-400',
      action: () => {
        onExportCSV();
        onClose();
      },
    },
    {
      label: 'CSV Header & Pipe Format Guide',
      badge: 'DOCS',
      icon: HelpCircle,
      color: 'text-cyan-400',
      action: () => {
        if (onOpenCsvHelp) onOpenCsvHelp();
        else onSetActiveTab('backup');
        onClose();
      },
    },
    {
      label: 'Download CSV Import Template',
      badge: 'SAMPLE',
      icon: Download,
      color: 'text-amber-400',
      action: () => {
        if (onDownloadSampleCsv) onDownloadSampleCsv();
        else onSetActiveTab('backup');
        onClose();
      },
    },
  ].filter(
    (item) =>
      !cmdQuery.trim() ||
      item.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
      item.label.startsWith('Add New Anime to Catalog:')
  );

  const navActions = [
    {
      label: 'Go to Overview',
      icon: LayoutDashboard,
      color: 'text-purple-400',
      action: () => {
        onSetActiveTab('overview');
        onClose();
      },
    },
    {
      label: `Go to Pending Reviews (${pendingCount})`,
      icon: Clock,
      color: 'text-amber-400',
      action: () => {
        onSetActiveTab('pending');
        onClose();
      },
    },
    {
      label: 'Go to Anime Catalog',
      icon: Film,
      color: 'text-cyan-400',
      action: () => {
        onSetActiveTab('catalog');
        onClose();
      },
    },
    {
      label: `Go to User Feedback (${feedbackCount})`,
      icon: MessageSquare,
      color: 'text-sky-400',
      action: () => {
        onSetActiveTab('feedback');
        onClose();
      },
    },
    {
      label: 'Go to IMDb & Diagnostics',
      icon: Star,
      color: 'text-amber-400',
      action: () => {
        onSetActiveTab('imdb_checker');
        onClose();
      },
    },
    {
      label: 'Go to Edge Analytics',
      icon: BarChart3,
      color: 'text-emerald-400',
      action: () => {
        onSetActiveTab('analytics');
        onClose();
      },
    },
    {
      label: 'Go to Cloud Infrastructure',
      icon: Settings,
      color: 'text-purple-400',
      action: () => {
        onSetActiveTab('settings');
        onClose();
      },
    },
    {
      label: `Open Data Health QA (${dataHealthCount})`,
      icon: ShieldCheck,
      color: 'text-emerald-400',
      action: () => {
        onSetActiveTab('data_health');
        onClose();
      },
    },
    {
      label: 'Open Translation Studio',
      icon: Languages,
      color: 'text-purple-400',
      action: () => {
        onSetActiveTab('translations');
        onClose();
      },
    },
    {
      label: 'Open Franchise Builder',
      icon: Layers,
      color: 'text-cyan-400',
      action: () => {
        onSetActiveTab('franchises');
        onClose();
      },
    },
    {
      label: 'Open Cast Manager',
      icon: Mic2,
      color: 'text-sky-400',
      action: () => {
        onSetActiveTab('cast');
        onClose();
      },
    },
  ].filter(
    (item) => !cmdQuery.trim() || item.label.toLowerCase().includes(cmdQuery.toLowerCase())
  );

  const matchingCatalog = (filteredCatalog || [])
    .filter((a) =>
      !cmdQuery.trim()
        ? true
        : (a.title || '').toLowerCase().includes(cmdQuery.toLowerCase()) ||
          String(a.id || '').includes(cmdQuery.trim())
    )
    .slice(0, 6);

  return (
    <div
      data-testid="admin-command-palette-modal"
      className="fixed inset-0 z-[120] flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface)] border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-900/20 overflow-hidden text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <Search className="w-5 h-5 text-purple-400 shrink-0" />
          <input
            type="text"
            autoFocus
            data-testid="admin-command-palette-input"
            value={cmdQuery}
            onChange={(e) => setCmdQuery(e.target.value)}
            placeholder="Search commands, tabs, or anime to edit..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-mono font-bold text-[var(--text-secondary)] cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Scrollable Command Sections */}
        <div className="max-h-[70vh] overflow-y-auto p-2.5 space-y-3">
          {quickOperations.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                QUICK OPERATIONS
              </div>
              {quickOperations.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={item.action}
                  className="w-full min-h-[42px] flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-[var(--bg-elevated)] text-left text-xs sm:text-sm font-bold text-[var(--text-primary)] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-mono font-extrabold text-[var(--text-secondary)] shrink-0">
                    {item.badge}
                  </span>
                </button>
              ))}
            </div>
          )}

          {navActions.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
              <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                NAVIGATION &amp; TABS
              </div>
              {navActions.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={item.action}
                  className="w-full min-h-[40px] flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-[var(--bg-elevated)] text-left text-xs sm:text-sm font-bold text-[var(--text-primary)] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-mono font-extrabold text-[var(--text-secondary)] shrink-0">
                    TAB
                  </span>
                </button>
              ))}
            </div>
          )}

          {matchingCatalog.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
              <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                CATALOG ANIME MATCHES (CLICK TO EDIT)
              </div>
              {matchingCatalog.map((anime) => (
                <button
                  key={anime.id}
                  type="button"
                  onClick={() => {
                    onEditAnime(anime);
                    onClose();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={
                        anime.posterUrl ||
                        anime.image ||
                        anime.cover_image ||
                        'https://picsum.photos/seed/anime/40/60'
                      }
                      alt=""
                      className="w-8 h-11 rounded-lg object-cover shrink-0 border border-[var(--border-subtle)]"
                    />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-extrabold text-[var(--text-primary)] truncate">
                        {anime.title}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-secondary)] truncate">
                        #{anime.id} • ★ {anime.rating || '8.5'} • {anime.platform || 'Crunchyroll'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-[10px] font-extrabold text-purple-400 shrink-0">
                    EDIT
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
