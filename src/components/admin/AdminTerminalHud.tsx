import React, { useState, useRef } from 'react';
import {
  Terminal,
  Trash2,
  X,
  Database,
  Play,
  Loader2,
  RefreshCw,
  Cloud,
  Code,
  Upload,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { validateImageUpload } from '../../utils/imgbb';
import { cloudflareApi } from '../../services/cloudflareApi';

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
  cfStatus?: any;
  onNormalizePlatforms?: () => void;
  isNormalizingPlatforms?: boolean;
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
  cfStatus,
  onNormalizePlatforms,
  isNormalizingPlatforms = false,
}) => {
  const [drawerTab, setDrawerTab] = useState<'terminal' | 'cloudflare' | 'schema'>('terminal');
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [imgbbTesting, setImgbbTesting] = useState(false);
  const [imgbbResult, setImgbbResult] = useState<{
    ok: boolean;
    url?: string;
    message?: string;
  } | null>(null);
  const imgbbInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const services = cfStatus?.services || {};
  const schemaSql =
    cfStatus?.schemaSql ||
    '-- Run "Probe API" above to load live Cloudflare D1 Database status & schema summary.';

  const handleCopySchema = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(schemaSql);
      setCopiedSchema(true);
      window.setTimeout(() => setCopiedSchema(false), 2000);
    }
  };

  const handleTestImgbbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageUpload(file.size, file.type);
    if (!validation.valid) {
      setImgbbResult({ ok: false, message: validation.error || 'Invalid image file.' });
      return;
    }

    setImgbbTesting(true);
    setImgbbResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || '');
      try {
        const res = await cloudflareApi.uploadImage(base64, file.name);
        if (res && res.success && (res.url || res.display_url)) {
          setImgbbResult({
            ok: true,
            url: res.url || res.display_url,
            message: 'ImgBB gateway uploaded image successfully!',
          });
          onRunDiagnostics();
        } else {
          const uploadErr =
            res && 'error' in res && typeof (res as { error?: unknown }).error === 'string'
              ? (res as { error: string }).error
              : 'ImgBB upload failed.';
          setImgbbResult({
            ok: false,
            message: uploadErr,
          });
        }
      } catch (err: any) {
        setImgbbResult({
          ok: false,
          message: err?.message || 'ImgBB gateway request failed.',
        });
      } finally {
        setImgbbTesting(false);
        if (imgbbInputRef.current) imgbbInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      data-testid="admin-diagnostics-drawer"
      className="fixed inset-0 z-[110] flex justify-end bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] text-[var(--text-primary)] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Terminal className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] truncate">
                Terminal HUD &amp; Edge Diagnostics
              </h3>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                D1 Query Inspector, Cloudflare Console, ImgBB Test &amp; Live Logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRunDiagnostics}
              disabled={isTestingApi}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
              />
              <span>Probe API</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Diagnostics Drawer"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-Navigation Pills (Restores Orphaned Cloudflare Console Utilities Inside Diagnostics) */}
        <div className="px-4 sm:px-5 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'terminal', label: 'D1 Query & Logs', icon: Terminal },
              { id: 'cloudflare', label: 'Edge & ImgBB Test', icon: Cloud },
              { id: 'schema', label: 'D1 Schema & Tools', icon: Code },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = drawerTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDrawerTab(tab.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {drawerTab === 'terminal' && (
            <>
              {/* 1. Parameterized D1 Query Inspector */}
              <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-[var(--accent-primary)]" />
                    Parameterized D1 Table Query
                  </h4>
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                    Read-only · SQLi Protected
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
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {isExecutingQuery ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Run Parameterized Query</span>
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
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
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
            </>
          )}

          {drawerTab === 'cloudflare' && (
            <>
              {/* Live Cloudflare Pages, D1, Clerk & ImgBB Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                    Cloudflare Pages Edge
                  </div>
                  <div className="text-sm font-extrabold text-[var(--text-primary)]">
                    {services.pages?.status || 'Operational'}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                    Region: {services.pages?.region || 'EDGE (IN)'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                    D1 Relational SQL
                  </div>
                  <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    {services.d1?.status || 'Standby'}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-secondary)] tabular-nums">
                    {Number(services.d1?.recordsCount || 0).toLocaleString()} rows ·{' '}
                    {services.d1?.latencyMs ?? '--'}ms
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                    Clerk Admin Auth
                  </div>
                  <div className="text-sm font-extrabold text-[var(--accent-primary)]">
                    {services.clerk?.status || 'Verified'}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-secondary)] truncate">
                    {services.clerk?.email || 'Strict JWT Enforced'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                    ImgBB Image Proxy
                  </div>
                  <div className="text-sm font-extrabold text-[var(--text-primary)]">
                    {services.imgbb?.status || 'Checking...'}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                    {services.imgbb?.provider || 'ImgBB Cloud CDN'}
                  </div>
                </div>
              </div>

              {/* Restored ImgBB Storage Gateway Test Upload (No window.alert!) */}
              <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-[var(--accent-primary)]" />
                      ImgBB Storage Gateway Test
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Verify server-side <code className="font-mono">/api/upload</code> ImgBB CDN upload works end-to-end.
                    </p>
                  </div>
                  <input
                    ref={imgbbInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleTestImgbbUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={imgbbTesting}
                    onClick={() => imgbbInputRef.current?.click()}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {imgbbTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Test Upload</span>
                  </button>
                </div>

                {imgbbResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      imgbbResult.ok
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-500'
                    }`}
                  >
                    {imgbbResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="font-bold">{imgbbResult.message}</div>
                      {imgbbResult.url && (
                        <a
                          href={imgbbResult.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[11px] underline break-all block"
                        >
                          {imgbbResult.url}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {drawerTab === 'schema' && (
            <>
              {/* D1 Schema Summary */}
              <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-[var(--accent-primary)]" />
                    D1 Database Summary
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopySchema}
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedSchema ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedSchema ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-primary)] whitespace-pre-wrap break-words max-h-60 overflow-auto">
                  {schemaSql}
                </pre>
              </div>

              {/* Legacy Platform Tag Normalizer */}
              {onNormalizePlatforms && (
                <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-[var(--accent-primary)]" />
                      Legacy OTT Platform Normalizer
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Safely standardizes platform naming variants (e.g. &ldquo;crunchy roll&rdquo; → &ldquo;Crunchyroll&rdquo;) across D1 rows.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isNormalizingPlatforms}
                    onClick={onNormalizePlatforms}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isNormalizingPlatforms ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)]" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    )}
                    <span>Run Cleanup</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
