import React from 'react';
import {
  HardDrive,
  Download,
  FileSpreadsheet,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { TelegramNotice, TelegramSettingsStatus } from './types';

export interface AdminSettingsTabProps {
  apiUrlOverride: string;
  onApiUrlOverrideChange: (val: string) => void;
  onSaveApiUrlOverride: () => void;
  onResetApiUrl: () => void;
  onExportFullJson: () => void;
  onExportCsv: () => void;
  telegramStatus: TelegramSettingsStatus;
  telegramNotice: TelegramNotice | null;
  telegramToken: string;
  telegramChatId: string;
  onTelegramTokenChange: (val: string) => void;
  onTelegramChatIdChange: (val: string) => void;
  isSavingTelegram: boolean;
  isTestingTelegram: boolean;
  onSaveTelegram: () => void;
  onTestTelegram: () => void;
  confirmPurge: boolean;
  onPurgeCache: () => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  apiUrlOverride,
  onApiUrlOverrideChange,
  onSaveApiUrlOverride,
  onResetApiUrl,
  onExportFullJson,
  onExportCsv,
  telegramStatus,
  telegramNotice,
  telegramToken,
  telegramChatId,
  onTelegramTokenChange,
  onTelegramChatIdChange,
  isSavingTelegram,
  isTestingTelegram,
  onSaveTelegram,
  onTestTelegram,
  confirmPurge,
  onPurgeCache,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Cloudflare Infrastructure &amp; Persistence</h3>
            <p className="text-xs text-neutral-400">Global Worker connection, D1 database snapshots, and local cache controls</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#07090e]/80 border border-white/10 space-y-4 shadow-inner">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 ml-1">
              API Worker Hostname
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiUrlOverride}
                onChange={(e) => onApiUrlOverrideChange(e.target.value)}
                placeholder="e.g. https://your-worker.workers.dev (Leave empty for relative paths)"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-cyan-300 font-mono focus:border-purple-500/50 outline-none transition-all"
              />
              <button
                onClick={onSaveApiUrlOverride}
                className="px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-tighter transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
              >
                Save &amp; Sync
              </button>
              <button
                onClick={onResetApiUrl}
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

        <div className="pt-2 flex flex-wrap gap-3">
          <button
            onClick={onExportFullJson}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Full JSON Snapshot</span>
          </button>
          <button
            onClick={onExportCsv}
            className="h-10 px-5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Catalog CSV</span>
          </button>
        </div>

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
                onChange={(e) => onTelegramTokenChange(e.target.value)}
                placeholder={telegramStatus.tokenMasked || '123456789:ABCdefGHIjklMNO...'}
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
                onChange={(e) => onTelegramChatIdChange(e.target.value)}
                placeholder={telegramStatus.chatId || '@anidub_india or -100123456789'}
                className="w-full px-3 py-2 rounded-xl bg-[#050811] border border-white/10 text-white text-xs font-mono placeholder-neutral-600 focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[10px] text-neutral-500">Public channel username with @ or private chat ID</span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSaveTelegram}
              disabled={isSavingTelegram}
              className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Save Credentials</span>
            </button>

            <button
              type="button"
              onClick={onTestTelegram}
              disabled={isTestingTelegram}
              className="h-9 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-sky-400/30 text-sky-300 text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isTestingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Send Test Notification</span>
            </button>
          </div>
        </div>

        <div className="mt-6 p-5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold font-mono uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Administrative Emergency Controls</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Resetting will clear client cached records and wipe all D1 database tables (anime, users, reviews, watchlists, episodes, feedback). You will be prompted to type <span className="font-mono text-rose-300 font-semibold">DELETE ALL</span> to confirm.
          </p>
          <button
            type="button"
            onClick={onPurgeCache}
            className={`h-9 px-4 rounded-xl border text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm ${
              confirmPurge
                ? 'bg-rose-600 border-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse'
                : 'bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 hover:text-white hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]'
            }`}
          >
            Reset Database &amp; Cache
          </button>
        </div>
      </div>
    </div>
  );
};
