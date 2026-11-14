import React from 'react';
import { Terminal, Minimize2, Maximize2, X } from 'lucide-react';
import { getCloudflareUrl } from '../../config/cloudflare';
import type { TerminalLogEntry } from './types';

export interface AdminTerminalHudProps {
  isOpen: boolean;
  isExpanded: boolean;
  logs: TerminalLogEntry[];
  onToggleOpen: () => void;
  onToggleExpand: () => void;
  onClose: () => void;
  onClearLogs: () => void;
  onAddLog: (level: string, msg: string) => void;
}

export const AdminTerminalHud: React.FC<AdminTerminalHudProps> = ({
  isOpen,
  isExpanded,
  logs,
  onToggleOpen,
  onToggleExpand,
  onClose,
  onClearLogs,
  onAddLog,
}) => {
  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className="fixed bottom-20 md:bottom-5 right-4 md:right-5 z-40 bg-[#070b16]/90 backdrop-blur-xl border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 px-3.5 py-2 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.25)] flex items-center gap-2.5 text-xs font-mono font-bold cursor-pointer hover:scale-105 active:scale-95 transition-all group"
        title="Open Simulated System Terminal"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <Terminal className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
        <span>SYS_TERM</span>
        <span className="text-[10px] text-neutral-400 font-normal hidden sm:inline">LIVE</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-[94vw] sm:w-[640px] bg-[#050811]/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.3)] flex flex-col overflow-hidden transition-all duration-300 ${
        isExpanded ? 'h-[520px]' : 'h-[340px]'
      }`}
    >
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
            onClick={onToggleExpand}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse Terminal' : 'Expand Terminal'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Close Terminal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5 bg-[#060a16] border-b border-white/5 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 hidden sm:inline">PROBES:</span>
          <button
            onClick={() => onAddLog('EDGE', `PING ${new URL(getCloudflareUrl('/')).hostname} (RTT 14ms, POP: BOM1)`)}
            className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 transition-colors cursor-pointer"
          >
            PING EDGE
          </button>
          <button
            onClick={() => onAddLog('D1', `KV Binding ANIME_DB: Total keys synchronized. Status 200 OK`)}
            className="px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 transition-colors cursor-pointer"
          >
            KV TEST
          </button>
          <button
            onClick={() => onAddLog('SYS', `Telemetry health check passed: TLS 1.3, HTTP/2 multiplexing ACTIVE`)}
            className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
          >
            HEALTH
          </button>
        </div>
        <button
          onClick={onClearLogs}
          className="text-neutral-400 hover:text-neutral-200 transition-colors underline cursor-pointer"
        >
          CLEAR
        </button>
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-1.5 font-mono text-[11px] bg-[#04060d] text-slate-300 select-text">
        {logs.length === 0 ? (
          <div className="text-neutral-500 italic py-4 text-center">
            Log stream cleared. Waiting for Cloudflare edge events...
          </div>
        ) : (
          logs.map((log, idx) => {
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
  );
};
