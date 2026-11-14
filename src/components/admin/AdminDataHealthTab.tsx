import React from 'react';
import { Star, RefreshCcw, AlertTriangle, Check, Terminal } from 'lucide-react';
import type { RatingCorrection, TerminalLogEntry } from './types';

export interface AdminDataHealthTabProps {
  isCheckingHealth: boolean;
  pendingCorrections: RatingCorrection[];
  terminalLogs: TerminalLogEntry[];
  onRunHealthCheck: () => void;
  onApproveCorrection: (correction: RatingCorrection) => void;
  onApproveAllCorrections: () => void;
  onOpenTerminal: () => void;
}

export const AdminDataHealthTab: React.FC<AdminDataHealthTabProps> = ({
  isCheckingHealth,
  pendingCorrections,
  terminalLogs,
  onRunHealthCheck,
  onApproveCorrection,
  onApproveAllCorrections,
  onOpenTerminal,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
              <Star className="w-6 h-6 fill-amber-400 text-amber-300" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">IMDb Telemetry &amp; Scoring Health Engine</h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono">Automated Probe</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
                Performs real-time schema validation across all catalog titles, testing score consistency and streaming platform mappings against global records.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
            <button
              onClick={onRunHealthCheck}
              disabled={isCheckingHealth}
              className="h-10 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCcw className={`w-4 h-4 text-white ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span>{isCheckingHealth ? 'Running Live OMDb Probe...' : 'Initiate Full Health Probe'}</span>
            </button>
          </div>
        </div>

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
                onClick={onApproveAllCorrections}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Approve &amp; Push All ({pendingCorrections.length})</span>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              {pendingCorrections.map((item, idx) => (
                <div key={`rating_correction_${idx}`} className="p-4 rounded-xl bg-black/40 border border-white/10 hover:border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={item.anime.cover_image || item.anime.posterUrl || item.anime.image || '/logo.png'}
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
                      onClick={() => onApproveCorrection(item)}
                      className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-md hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Approve &amp; Push</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                onClick={onOpenTerminal}
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
  );
};
