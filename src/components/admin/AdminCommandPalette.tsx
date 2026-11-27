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
  Globe,
  LayoutDashboard,
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
  onOpenAddModal: () => void;
  onSetActiveTab: (tab: AdminActiveTab) => void;
  onExportCSV: () => void;
  onRunDiagnostics: () => void;
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
  filteredCatalog,
  onEditAnime,
}) => {
  if (!isOpen) return null;

  const actions = [
    {
      label: 'Add New Anime Title',
      icon: Plus,
      color: 'text-[var(--accent-primary)]',
      action: () => {
        onOpenAddModal();
        onClose();
      },
    },
    {
      label: 'Go to Command Center',
      icon: LayoutDashboard,
      color: 'text-[var(--accent-primary)]',
      action: () => {
        onSetActiveTab('overview');
        onClose();
      },
    },
    {
      label: 'Go to Anime Catalog',
      icon: Film,
      color: 'text-sky-500',
      action: () => {
        onSetActiveTab('catalog');
        onClose();
      },
    },
    {
      label: 'Go to Regional Dubs Intelligence',
      icon: Globe,
      color: 'text-amber-500',
      action: () => {
        onSetActiveTab('dubs');
        onClose();
      },
    },
    {
      label: 'Go to Native Synopsis Translations',
      icon: Languages,
      color: 'text-purple-500',
      action: () => {
        onSetActiveTab('translations');
        onClose();
      },
    },
    {
      label: `Go to Moderation & Feedback (${pendingCount + feedbackCount})`,
      icon: Clock,
      color: 'text-amber-500',
      action: () => {
        onSetActiveTab('moderation');
        onClose();
      },
    },
    {
      label: `Go to Data Health Audit (${dataHealthCount} issues)`,
      icon: ShieldCheck,
      color: 'text-emerald-500',
      action: () => {
        onSetActiveTab('data_health');
        onClose();
      },
    },
    {
      label: 'Go to Analytics & Edge Telemetry',
      icon: BarChart3,
      color: 'text-sky-500',
      action: () => {
        onSetActiveTab('analytics');
        onClose();
      },
    },
    {
      label: 'Go to Backup & Export (CSV / SQL)',
      icon: Download,
      color: 'text-emerald-500',
      action: () => {
        onSetActiveTab('backup');
        onClose();
      },
    },
    {
      label: 'Export Full Catalog to CSV',
      icon: Download,
      color: 'text-emerald-500',
      action: () => {
        onExportCSV();
        onClose();
      },
    },
    {
      label: 'Open Edge Diagnostics Drawer',
      icon: Terminal,
      color: 'text-[var(--accent-primary)]',
      action: () => {
        onRunDiagnostics();
        onClose();
      },
    },
    {
      label: 'Go to System Settings',
      icon: Settings,
      color: 'text-[var(--text-secondary)]',
      action: () => {
        onSetActiveTab('settings');
        onClose();
      },
    },
  ].filter((item) => item.label.toLowerCase().includes(cmdQuery.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <Search className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
          <input
            type="text"
            autoFocus
            value={cmdQuery}
            onChange={(e) => setCmdQuery(e.target.value)}
            placeholder="Type a command or search anime title..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] font-mono"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Workspace Navigation &amp; Actions
          </div>
          {actions.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={item.action}
              className="w-full min-h-[42px] flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--bg-elevated)] text-left text-xs sm:text-sm font-bold text-[var(--text-primary)] transition-all"
            >
              <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
              <span>{item.label}</span>
            </button>
          ))}

          {cmdQuery.trim().length > 1 && (
            <>
              <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-t border-[var(--border-subtle)] mt-2">
                Catalog Matches
              </div>
              {filteredCatalog
                .filter((a) =>
                  (a.title || '').toLowerCase().includes(cmdQuery.toLowerCase())
                )
                .slice(0, 6)
                .map((anime) => (
                  <button
                    key={anime.id}
                    type="button"
                    onClick={() => {
                      onEditAnime(anime);
                      onClose();
                    }}
                    className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-all"
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
                        className="w-7 h-10 rounded object-cover shrink-0 border border-[var(--border-subtle)]"
                      />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                          {anime.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] truncate">
                          {Array.isArray(anime.languages) && anime.languages.length > 0
                            ? anime.languages.join(', ')
                            : anime.languages || 'Unverified'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[var(--accent-primary)] shrink-0">
                      Edit &rarr;
                    </span>
                  </button>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
