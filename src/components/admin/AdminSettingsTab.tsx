import React, { useState } from 'react';
import {
  Send,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Zap,
  Globe,
  RefreshCw,
  Terminal,
  Database,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';

export interface AdminSettingsTabProps {
  tgStatus: { configured: boolean; botTokenSet?: boolean; chatIdSet?: boolean };
  tgToken: string;
  setTgToken: (val: string) => void;
  tgChatId: string;
  setTgChatId: (val: string) => void;
  isSavingTg: boolean;
  isTestingTg: boolean;
  onSaveTelegram: (e: React.FormEvent) => void;
  onTestTelegram: () => void;
  customWorkerUrl: string;
  setCustomWorkerUrl: (val: string) => void;
  isUrlSaved: boolean;
  onSaveWorkerUrl: (e: React.FormEvent) => void;
  onResetWorkerUrl: () => void;
  onRefreshLocalCache: () => void;
  onOpenDiagnosticsDrawer?: () => void;
  onExportCsv?: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  tgStatus,
  tgToken,
  setTgToken,
  tgChatId,
  setTgChatId,
  isSavingTg,
  isTestingTg,
  onSaveTelegram,
  onTestTelegram,
  customWorkerUrl,
  onResetWorkerUrl,
  onRefreshLocalCache,
  onOpenDiagnosticsDrawer,
  onExportCsv,
  onSuccess,
  onError,
}) => {
  const [isDownloadingSnapshot, setIsDownloadingSnapshot] = useState(false);

  const handleDownloadJsonSnapshot = async () => {
    setIsDownloadingSnapshot(true);
    try {
      const res = await cloudflareApi.exportFullContentJsonBackup();
      const snapshot = res.bundle || res;
      const jsonText = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `anidub_d1_full_snapshot_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onSuccess?.('Downloaded Full Cloudflare D1 JSON Snapshot!');
    } catch (err: any) {
      onError?.(err?.message || 'Failed to export D1 JSON snapshot.');
    } finally {
      setIsDownloadingSnapshot(false);
    }
  };

  return (
    <div
      data-testid="admin-settings-tab"
      className="max-w-4xl mx-auto space-y-5 pb-8 text-[var(--text-primary)]"
    >
      {/* 1. CLASSIC CLOUDFLARE INFRASTRUCTURE & PERSISTENCE CARD */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-5 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                Cloudflare Infrastructure &amp; Persistence
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Edge D1 SQLite persistence binding, full JSON snapshot export, and global Anycast routing.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold self-start sm:self-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Live Production Anycast
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
              D1 DATABASE BINDING
            </span>
            <p className="text-xs sm:text-sm font-mono font-bold text-[var(--text-primary)] truncate">
              env.DB (anidub-production-d1)
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
              API ROUTING MODE
            </span>
            <p className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
              Same-Origin (/api/*)
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
              ADMIN AUTH GUARD
            </span>
            <p className="text-xs sm:text-sm font-mono font-bold text-purple-400">
              Strict Clerk JWT + Role
            </p>
          </div>
        </div>

        {/* Full-Width Glowing Purple Download Full JSON Snapshot + Export Catalog CSV Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => void handleDownloadJsonSnapshot()}
            disabled={isDownloadingSnapshot}
            className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isDownloadingSnapshot ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download Full JSON Snapshot</span>
          </button>

          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Catalog CSV</span>
            </button>
          )}
        </div>

        {customWorkerUrl && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            <span>Legacy local worker URL override detected in browser storage.</span>
            <button
              type="button"
              onClick={onResetWorkerUrl}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold text-amber-300 transition-colors cursor-pointer"
            >
              Clear Legacy Override
            </button>
          </div>
        )}
      </div>

      {/* 2. TELEGRAM CHANNEL & BOT NOTIFICATIONS CARD */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                Telegram Channel &amp; Bot Notifications
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Receive instant alerts for community dub submissions, issue reports, and user feedback.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tgStatus.configured ? (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Active &amp; Connected
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Setup Required
              </span>
            )}
          </div>
        </div>

        <form onSubmit={onSaveTelegram} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                <span>Telegram Bot Token</span>
                {tgStatus.botTokenSet && (
                  <span className="text-emerald-400 text-[11px] font-semibold">
                    ✓ Configured
                  </span>
                )}
              </label>
              <input
                type="password"
                value={tgToken}
                onChange={(e) => setTgToken(e.target.value)}
                placeholder={
                  tgStatus.botTokenSet
                    ? '•••••••••••••••••••••••••••••• (Saved)'
                    : 'e.g. 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ'
                }
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-purple-500 transition-all font-mono"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Create a bot via <span className="text-sky-400 font-semibold">@BotFather</span> on Telegram to get your token.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                <span>Chat / Channel ID</span>
                {tgStatus.chatIdSet && (
                  <span className="text-emerald-400 text-[11px] font-semibold">
                    ✓ Configured
                  </span>
                )}
              </label>
              <input
                type="text"
                value={tgChatId}
                onChange={(e) => setTgChatId(e.target.value)}
                placeholder={tgStatus.chatIdSet ? '•••••••••• (Saved)' : 'e.g. 987654321'}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-purple-500 transition-all font-mono"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Message <span className="text-sky-400 font-semibold">@userinfobot</span> on Telegram to find your numeric Chat ID.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={isSavingTg}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSavingTg ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save Credentials
              </button>

              <button
                type="button"
                onClick={onTestTelegram}
                disabled={isTestingTg}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs sm:text-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isTestingTg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-400" />}
                Send Test Notification
              </button>
            </div>

            <span className="text-xs text-[var(--text-secondary)] font-mono">
              Secrets encrypted in server runtime
            </span>
          </div>
        </form>
      </div>

      {/* 3. Safe Non-Destructive Cache & Diagnostics Controls */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            Local Admin Workspace Cache &amp; Terminal Console
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Safely refresh local browser caches and re-sync catalog metadata from Cloudflare D1 without modifying any database tables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenDiagnosticsDrawer && (
            <button
              type="button"
              onClick={onOpenDiagnosticsDrawer}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              Open System Terminal
            </button>
          )}
          <button
            type="button"
            data-testid="refresh-local-cache-btn"
            onClick={onRefreshLocalCache}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Local Cache
          </button>
        </div>
      </div>
    </div>
  );
};
