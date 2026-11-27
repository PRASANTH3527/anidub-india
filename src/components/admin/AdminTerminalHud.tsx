import React from 'react';
import {
  Terminal,
  Trash2,
  X,
  Database,
  Play,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export interface AdminTerminalHudProps {
  isOpen: boolean;
  onClose: () => void;
  terminalLogs: string[];
  onClearLogs: () => void;
  d1Table: 'anime' | 'users' | 'logs';
  setD1Table: (t: 'anime' | 'users' | 'logs') => void;
  d1AnimeId: string;
  setD1AnimeId: (v: string) => void;
  d1TitleSearch: string;
  setD1TitleSearch: (v: string) => void;
  d1Limit: number;
  setD1Limit: (n: number) => void;
  d1QueryResult: any;
  isExecutingQuery: boolean;
  onExecuteD1Query: (e: React.FormEvent) => void;
  onRunDiagnostics: () => void;
  isTestingApi: boolean;
}

export const AdminTerminalHud: React.FC<AdminTerminalHudProps> = ({
  isOpen,
  onClose,
  terminalLogs,
  onClearLogs,
  d1Table,
  setD1Table,
  d1AnimeId,
  setD1AnimeId,
  d1TitleSearch,
  setD1TitleSearch,
  d1Limit,
  setD1Limit,
  d1QueryResult,
  isExecutingQuery,
  onExecuteD1Query,
  onRunDiagnostics,
  isTestingApi,
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-testid="admin-diagnostics-drawer"
      className="fixed inset-0 z-[110] flex justify-end bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-xl h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] text-[var(--text-primary)] flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Terminal className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] truncate">
                Edge Diagnostics &amp; D1 Inspector
              </h3>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Parameterized D1 table queries &amp; live runtime logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRunDiagnostics}
              disabled={isTestingApi}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-spin text-[var(--accent-primary)]' : ''}`} />
              Probe API
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Diagnostics Drawer"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. Parameterized D1 Query Inspector */}
          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <Database className="w-4 h-4 text-[var(--accent-primary)]" />
                Parameterized D1 Table Query
              </h4>
              <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                Read-only • SQLi Protected
              </span>
            </div>

            <form onSubmit={onExecuteD1Query} className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block mb-1">
                    Table
                  </label>
                  <select
                    value={d1Table}
                    onChange={(e) => setD1Table(e.target.value as 'anime' | 'users' | 'logs')}
                    className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
                  >
                    <option value="anime">anime</option>
                    <option value="users">users</option>
                    <option value="logs">cloudflare_logs</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block mb-1">
                    Record ID
                  </label>
                  <input
                    type="number"
                    value={d1AnimeId}
                    onChange={(e) => setD1AnimeId(e.target.value)}
                    placeholder="Any"
                    disabled={d1Table !== 'anime'}
                    className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block mb-1">
                    Title Match
                  </label>
                  <input
                    type="text"
                    value={d1TitleSearch}
                    onChange={(e) => setD1TitleSearch(e.target.value)}
                    placeholder="Title..."
                    disabled={d1Table !== 'anime'}
                    className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block mb-1">
                    Limit
                  </label>
                  <select
                    value={d1Limit}
                    onChange={(e) => setD1Limit(Number(e.target.value))}
                    className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
                  >
                    <option value={5}>5 rows</option>
                    <option value={10}>10 rows</option>
                    <option value={25}>25 rows</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isExecutingQuery}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold flex items-center gap-1.5"
              >
                {isExecutingQuery ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Run Parameterized Query
              </button>
            </form>

            {d1QueryResult && (
              <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-h-56 overflow-auto font-mono text-xs">
                {d1QueryResult.error ? (
                  <span className="text-red-500">{d1QueryResult.error}</span>
                ) : (
                  <pre className="text-[11px] text-[var(--text-primary)] whitespace-pre-wrap break-words">
                    {JSON.stringify(d1QueryResult.results || [], null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* 2. Live Runtime Console Logs */}
          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                Diagnostic Stream ({terminalLogs.length})
              </h4>
              <button
                type="button"
                onClick={onClearLogs}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-h-64 overflow-y-auto font-mono text-xs space-y-1.5">
              {terminalLogs.length === 0 ? (
                <p className="text-[var(--text-secondary)] italic">
                  No diagnostic events logged yet.
                </p>
              ) : (
                terminalLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`leading-relaxed break-words ${
                      log.includes('[ERROR]') || log.includes('[FATAL]')
                        ? 'text-red-500'
                        : log.includes('[SUCCESS]')
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
