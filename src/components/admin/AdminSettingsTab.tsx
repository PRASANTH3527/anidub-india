import React from 'react';
import {
  Send,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Zap,
  Globe,
  RefreshCw,
  Check,
  Terminal,
} from 'lucide-react';

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
  setCustomWorkerUrl,
  isUrlSaved,
  onSaveWorkerUrl,
  onResetWorkerUrl,
  onRefreshLocalCache,
  onOpenDiagnosticsDrawer,
}) => {
  return (
    <div
      data-testid="admin-settings-tab"
      className="max-w-4xl mx-auto space-y-6 pb-8 text-[var(--text-primary)]"
    >
      {/* 1. Telegram Notification Bot Settings */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                Telegram Notification Bot
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Receive instant alerts for community dub submissions, issue reports, and user feedback.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tgStatus.configured ? (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Active &amp; Connected
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Setup Required
              </span>
            )}
          </div>
        </div>

        <form onSubmit={onSaveTelegram} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                <span>Bot API Token</span>
                {tgStatus.botTokenSet && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
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
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-primary)] transition-all font-mono"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Create a bot via <span className="text-sky-500 font-semibold">@BotFather</span> on Telegram to get your token.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                <span>Admin Chat ID</span>
                {tgStatus.chatIdSet && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                    ✓ Configured
                  </span>
                )}
              </label>
              <input
                type="text"
                value={tgChatId}
                onChange={(e) => setTgChatId(e.target.value)}
                placeholder={tgStatus.chatIdSet ? '•••••••••• (Saved)' : 'e.g. 987654321'}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-primary)] transition-all font-mono"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Message <span className="text-sky-500 font-semibold">@userinfobot</span> on Telegram to find your numeric Chat ID.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={isSavingTg}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] font-bold text-xs sm:text-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingTg ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save Credentials
              </button>

              <button
                type="button"
                onClick={onTestTelegram}
                disabled={isTestingTg}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs sm:text-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isTestingTg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-500" />}
                Send Test Alert
              </button>
            </div>

            <span className="text-xs text-[var(--text-secondary)] font-mono">
              Secrets encrypted in server runtime
            </span>
          </div>
        </form>
      </div>

      {/* 2. Read-Only Deployment Environment Status (API Routing Locked for Production Safety) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                Deployment Environment Status
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Runtime API routing is locked to same-origin <code className="text-[var(--accent-primary)]">/api/*</code> Cloudflare Pages Functions to prevent accidental routing misconfiguration.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold self-start sm:self-center">
            Same-Origin Locked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Active Origin
            </span>
            <p className="text-xs sm:text-sm font-mono font-bold text-[var(--text-primary)] truncate">
              {typeof window !== 'undefined' ? window.location.origin : 'https://anidub.in'}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              API Routing Mode
            </span>
            <p className="text-xs sm:text-sm font-mono font-bold text-emerald-500">
              Same-Origin (/api/*)
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Admin Auth Guard
            </span>
            <p className="text-xs sm:text-sm font-mono font-bold text-[var(--accent-primary)]">
              Strict Clerk JWT + Role
            </p>
          </div>
        </div>
        {customWorkerUrl && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500">
            <span>Legacy local worker URL override detected in browser storage.</span>
            <button
              type="button"
              onClick={onResetWorkerUrl}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold text-amber-400 transition-colors"
            >
              Clear Legacy Override
            </button>
          </div>
        )}
      </div>

      {/* 3. Safe Non-Destructive Cache & Diagnostics Controls */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[var(--accent-primary)]" />
            Local Admin Workspace Cache &amp; Diagnostics
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
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs sm:text-sm font-bold flex items-center gap-2 transition-all"
            >
              <Terminal className="w-4 h-4 text-[var(--accent-primary)]" />
              Open Diagnostics Drawer
            </button>
          )}
          <button
            type="button"
            data-testid="refresh-local-cache-btn"
            onClick={onRefreshLocalCache}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs sm:text-sm font-bold flex items-center gap-2 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Local Cache
          </button>
        </div>
      </div>
    </div>
  );
};
