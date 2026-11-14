import React from 'react';
import {
  Tv,
  Link as LinkIcon,
  Inbox,
  Flame,
  TrendingUp,
  Globe,
  Layers,
  Terminal,
  Upload,
  FileSpreadsheet,
  HelpCircle,
  ShieldAlert,
  HardDrive,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { AdminTabId } from './types';

export interface GenreStatBar {
  genre: string;
  count: number;
  height: string;
}

export interface AdminOverviewTabProps {
  loading: boolean;
  catalogCount: number;
  verifiedLinks: number;
  pendingCount: number;
  totalUpvotes: number;
  hPct: number;
  tPct: number;
  tePct: number;
  sortedGenres: GenreStatBar[];
  shouldReduceMotion: boolean | null;
  onTriggerFileUpload: () => void;
  onDownloadTemplate: () => void;
  onOpenCsvGuide: () => void;
  onSwitchTab: (tab: AdminTabId) => void;
  onExportFullJson: () => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  loading,
  catalogCount,
  verifiedLinks,
  pendingCount,
  totalUpvotes,
  hPct,
  tPct,
  tePct,
  sortedGenres,
  shouldReduceMotion,
  onTriggerFileUpload,
  onDownloadTemplate,
  onOpenCsvGuide,
  onSwitchTab,
  onExportFullJson,
}) => {
  if (loading) {
    return (
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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
            <span>{catalogCount}</span>
          </div>
          <div className="mt-2 text-[11px] text-purple-300/90 font-medium flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            <span>Cloudflare D1 Records</span>
          </div>
        </div>

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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Active Stream Routing</span>
          </div>
        </div>

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
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Awaiting Mod Verification</span>
          </div>
        </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  initial={shouldReduceMotion ? false : { strokeDasharray: '0 238' }}
                  animate={{ strokeDasharray: `${hPct * 2.38} 238` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
                <motion.circle
                  cx="50" cy="50" r="38"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="12"
                  strokeDasharray={`${tPct * 2.38} 238`}
                  strokeDashoffset={`-${hPct * 2.38}`}
                  initial={shouldReduceMotion ? false : { strokeDasharray: '0 238' }}
                  animate={{ strokeDasharray: `${tPct * 2.38} 238` }}
                  transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                />
                <motion.circle
                  cx="50" cy="50" r="38"
                  fill="transparent"
                  stroke="#06b6d4"
                  strokeWidth="12"
                  strokeDasharray={`${tePct * 2.38} 238`}
                  strokeDashoffset={`-${(hPct + tPct) * 2.38}`}
                  initial={shouldReduceMotion ? false : { strokeDasharray: '0 238' }}
                  animate={{ strokeDasharray: `${tePct * 2.38} 238` }}
                  transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-white">{catalogCount}</span>
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
                    transition={{ duration: 0.45, delay: idx * 0.06, ease: 'easeOut' }}
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
            onClick={onTriggerFileUpload}
            className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
          >
            <Upload className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Import CSV</span>
            <span className="text-[10px] text-neutral-400">Add bulk titles</span>
          </button>
          <button
            onClick={onDownloadTemplate}
            className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-cyan-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">CSV Template</span>
            <span className="text-[10px] text-neutral-400">Standard columns</span>
          </button>
          <button
            onClick={onOpenCsvGuide}
            className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-indigo-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">CSV Guide</span>
            <span className="text-[10px] text-neutral-400">Headers & syntax</span>
          </button>
          <button
            onClick={() => onSwitchTab('data_health')}
            className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-amber-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">IMDb Probe</span>
            <span className="text-[10px] text-neutral-400">Score sync</span>
          </button>
          <button
            onClick={onExportFullJson}
            className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-400/50 flex flex-col items-center text-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
          >
            <HardDrive className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Full Backup</span>
            <span className="text-[10px] text-neutral-400">D1 JSON snapshot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
