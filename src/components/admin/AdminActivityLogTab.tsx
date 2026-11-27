import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Clock,
  UserCheck,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import type { AdminActivityLogItem } from '../../utils/adminOpsPro';

const ACTION_FILTERS = [
  { id: 'all', label: 'All Actions' },
  { id: 'CREATE_ANIME', label: 'Create Anime' },
  { id: 'UPDATE_ANIME', label: 'Update Anime' },
  { id: 'DELETE_ANIME', label: 'Delete Anime' },
  { id: 'BULK_DUB_MATRIX_UPDATE', label: 'Bulk Dub Matrix' },
  { id: 'APPROVE_ANIME', label: 'Approve Pending' },
  { id: 'REJECT_ANIME', label: 'Reject Pending' },
  { id: 'MODERATE_DUB_REVIEW', label: 'Moderate Dub Review' },
  { id: 'AI_GENERATE_TRANSLATION', label: 'Workers AI Translation' },
  { id: 'IMPORT_CSV', label: 'CSV Import' },
];

export const AdminActivityLogTab: React.FC = () => {
  const [logs, setLogs] = useState<AdminActivityLogItem[]>([]);
  const [tableReady, setTableReady] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await cloudflareApi.fetchAdminActivityLogs({
        action: actionFilter !== 'all' ? actionFilter : undefined,
        search: searchQuery.trim() || undefined,
        limit: 100,
      });
      setTableReady(res.tableReady);
      setLogs(res.logs || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load admin activity logs.');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, searchQuery]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div data-testid="admin-activity-log-tab" className="space-y-5 text-[var(--text-primary)]">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--accent-primary)]" />
            Admin Activity &amp; Audit Log (`admin_activity_logs`)
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Immutable operational audit trail for catalog creates, updates, deletes, bulk dub matrix commits, Workers AI translations, and moderation decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {!tableReady && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Additive Migration Notice:</span> `admin_activity_logs` will begin persisting history once `migrations/004_admin_ops_pro.sql` is applied to D1.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-500">
          {errorMsg}
        </div>
      )}

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit logs by actor email, entity ID, or summary..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Entity</th>
                <th className="py-3 px-3">Summary</th>
                <th className="py-3 px-4">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-secondary)]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent-primary)]" />
                    Loading Admin Activity Logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-secondary)]">
                    No activity logs recorded yet for this filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--bg-elevated)]/60">
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {log.created_at}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                      {log.entity_type}
                      {log.entity_id ? ` #${log.entity_id}` : ''}
                    </td>
                    <td className="py-3 px-3 text-[var(--text-primary)] font-semibold max-w-md">
                      {log.summary}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-[11px] text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                        {log.actor_email || 'admin'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
