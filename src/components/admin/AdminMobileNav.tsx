import React from 'react';
import {
  BarChart3,
  Clock,
  Download,
  Film,
  Languages,
  Layers,
  LayoutDashboard,
  LogOut,
  Mic2,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Star,
  Terminal,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { resolveMobileAdminActiveGroup } from '../../utils/adminShellLayout';
import type { AdminActiveTab } from './types';

interface AdminMobileNavProps {
  effectiveTab: AdminActiveTab;
  totalModerationBadge: number;
  isMobileStudioOpen: boolean;
  setIsMobileStudioOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileMoreOpen: boolean;
  setIsMobileMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectNavTab: (tab: AdminActiveTab) => void;
  onOpenBulkCsvUpload: () => void;
  onOpenBackupCenter: () => void;
  onOpenDiagnostics: () => void;
  onLogout?: () => void;
}

export const AdminMobileNav: React.FC<AdminMobileNavProps> = ({
  effectiveTab,
  totalModerationBadge,
  isMobileStudioOpen,
  setIsMobileStudioOpen,
  isMobileMoreOpen,
  setIsMobileMoreOpen,
  onSelectNavTab,
  onOpenBulkCsvUpload,
  onOpenBackupCenter,
  onOpenDiagnostics,
  onLogout,
}) => {
  const activeMobileGroup = resolveMobileAdminActiveGroup(effectiveTab);

  return (
    <>
      {/* DEDICATED ADMIN MOBILE 5-TAB BOTTOM NAVIGATION BAR (Home, Catalog, Pending, Tools, More) */}
      <nav
        data-testid="admin-mobile-bottom-nav"
        aria-label="Admin Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-[60px] bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] grid grid-cols-5 items-center px-1"
      >
        {(
          [
            { id: 'overview', navGroup: 'overview', label: 'Home', icon: LayoutDashboard, badge: 0 },
            { id: 'catalog', navGroup: 'catalog', label: 'Catalog', icon: Film, badge: 0 },
            { id: 'moderation', navGroup: 'pending', label: 'Pending', icon: Clock, badge: totalModerationBadge },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeMobileGroup === tab.navGroup && !isMobileStudioOpen && !isMobileMoreOpen;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`admin-mobile-tab-${tab.navGroup}`}
              onClick={() => onSelectNavTab(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl relative transition-colors cursor-pointer ${
                isActive
                  ? 'text-[var(--accent-primary)] font-extrabold'
                  : 'text-[var(--text-secondary)] font-semibold'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] truncate max-w-[68px]">{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute top-1.5 right-3 min-w-[16px] px-1 rounded-full bg-amber-500 text-black text-[9px] font-black font-mono leading-tight text-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Tools Tab */}
        <button
          type="button"
          data-testid="admin-mobile-tab-tools"
          onClick={() => {
            setIsMobileMoreOpen(false);
            setIsMobileStudioOpen((prev) => !prev);
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl relative transition-colors cursor-pointer ${
            isMobileStudioOpen || (activeMobileGroup === 'tools' && !isMobileMoreOpen)
              ? 'text-[var(--accent-primary)] font-extrabold'
              : 'text-[var(--text-secondary)] font-semibold'
          }`}
        >
          <Wrench className="w-5 h-5" />
          <span className="text-[11px]">Tools</span>
        </button>

        {/* More Tab */}
        <button
          type="button"
          data-testid="admin-mobile-tab-more"
          onClick={() => {
            setIsMobileStudioOpen(false);
            setIsMobileMoreOpen((prev) => !prev);
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl relative transition-colors cursor-pointer ${
            isMobileMoreOpen || (activeMobileGroup === 'more' && !isMobileStudioOpen)
              ? 'text-[var(--accent-primary)] font-extrabold'
              : 'text-[var(--text-secondary)] font-semibold'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[11px]">More</span>
        </button>
      </nav>

      {/* MOBILE "TOOLS" BOTTOM SHEET */}
      {isMobileStudioOpen && (
        <div
          data-testid="admin-mobile-tools-drawer"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs"
          onClick={() => setIsMobileStudioOpen(false)}
        >
          <div
            className="w-full bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] rounded-t-2xl p-4 pb-6 space-y-3 shadow-2xl max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm font-extrabold text-[var(--text-primary)]">
                Content Studio &amp; Tools
              </span>
              <button
                type="button"
                aria-label="Close Tools Menu"
                onClick={() => setIsMobileStudioOpen(false)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                data-testid="admin-tools-tile-bulk-csv"
                onClick={onOpenBulkCsvUpload}
                className="min-h-[54px] px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-left flex items-center gap-3 cursor-pointer"
              >
                <Upload className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">Bulk CSV Upload</div>
                  <div className="text-[11px] text-[var(--text-secondary)] truncate">
                    File Picker · Paste CSV · Dry-Run &amp; Sample Template
                  </div>
                </div>
              </button>

              {(
                [
                  {
                    id: 'imdb_checker',
                    label: 'IMDb Ratings Checker',
                    sub: 'Live IMDb / MAL rating audit & batch sync',
                    icon: Star,
                  },
                  {
                    id: 'data_health',
                    label: 'Data Health QA',
                    sub: 'Artwork, OTT links, duplicates & platform cleanup',
                    icon: ShieldCheck,
                  },
                  {
                    id: 'translations',
                    label: 'Translation Studio',
                    sub: '6 Indian scripts · AI Cost Guard · Rollback',
                    icon: Languages,
                  },
                  {
                    id: 'franchises',
                    label: 'Franchise Builder',
                    sub: 'Anime Universe & Smart Watch Order',
                    icon: Layers,
                  },
                  {
                    id: 'cast',
                    label: 'Cast & Voice Actors',
                    sub: 'Verified Indian & Japanese voice credits',
                    icon: Mic2,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = effectiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`admin-tools-tile-${item.id}`}
                    onClick={() => onSelectNavTab(item.id)}
                    className={`min-h-[54px] px-3.5 py-2.5 rounded-xl border text-left flex items-center gap-3 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold truncate">{item.label}</div>
                      <div
                        className={`text-[11px] truncate ${
                          isActive
                            ? 'text-[var(--accent-on-primary,#fff)]/80'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {item.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE "MORE" BOTTOM SHEET */}
      {isMobileMoreOpen && (
        <div
          data-testid="admin-mobile-more-drawer"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            className="w-full bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] rounded-t-2xl p-4 pb-6 space-y-3 shadow-2xl max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm font-extrabold text-[var(--text-primary)]">
                Admin Operations &amp; System
              </span>
              <button
                type="button"
                aria-label="Close More Menu"
                onClick={() => setIsMobileMoreOpen(false)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'analytics', label: 'Analytics 2.0', icon: BarChart3 },
                  { id: 'backup', label: 'Backup Center', icon: Download },
                  { id: 'settings', label: 'Telegram & Settings', icon: Settings },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = effectiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`admin-more-tile-${item.id}`}
                    onClick={() => {
                      if (item.id === 'backup') {
                        onOpenBackupCenter();
                      } else {
                        onSelectNavTab(item.id);
                      }
                    }}
                    className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
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
                data-testid="admin-more-tile-diagnostics"
                onClick={onOpenDiagnostics}
                className="min-h-[48px] px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-2 cursor-pointer col-span-2"
              >
                <Terminal className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span className="truncate">Terminal HUD &amp; Edge Diagnostics</span>
              </button>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Lock Admin Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
