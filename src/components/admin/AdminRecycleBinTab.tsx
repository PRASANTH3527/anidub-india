import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  X,
  Film,
  MessageSquare,
  Star,
  GitBranch,
  Mic,
  Filter,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import { RECYCLE_BIN_ENTITY_TYPES } from '../../utils/adminPhase35Polish';

interface RecycleBinItem {
  id: number;
  entity_type: string;
  entity_id: string;
  title: string | null;
  payload: Record<string, any>;
  deleted_by: string | null;
  deleted_at: string;
  restored_at: string | null;
}

interface AdminRecycleBinTabProps {
  onShowToast?: (message: string, type?: 'success' | 'error') => void;
  onRestoredItem?: (entityType: string, entityId: string) => void;
}

const ENTITY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  anime: { label: 'Anime Catalog', icon: <Film className="w-3.5 h-3.5" /> },
  reviews: { label: 'Community Review', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  dub_reviews: { label: '5-Slider Dub Review', icon: <Star className="w-3.5 h-3.5" /> },
  anime_franchise_links: { label: 'Franchise Watch Order', icon: <GitBranch className="w-3.5 h-3.5" /> },
  anime_cast_entries: { label: 'Voice Actor / Cast', icon: <Mic className="w-3.5 h-3.5" /> },
};

export const AdminRecycleBinTab: React.FC<AdminRecycleBinTabProps> = ({
  onShowToast,
  onRestoredItem,
}) => {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [includeRestored, setIncludeRestored] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [inspectItem, setInspectItem] = useState<RecycleBinItem | null>(null);

  // Permanent Purge Confirmation Modal state
  const [purgeTarget, setPurgeTarget] = useState<RecycleBinItem | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  const loadRecycleBin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cloudflareApi.fetchAdminRecycleBin({
        entity_type: entityFilter,
        include_restored: includeRestored,
      });
      setItems(res.items || []);
    } catch (e: any) {
      onShowToast?.(e?.message || 'Failed to load Recycle Bin', 'error');
    } finally {
      setLoading(false);
    }
  }, [entityFilter, includeRestored, onShowToast]);

  useEffect(() => {
    void loadRecycleBin();
  }, [loadRecycleBin]);

  const handleRestore = async (item: RecycleBinItem) => {
    setRestoringId(item.id);
    try {
      const res = await cloudflareApi.restoreAdminRecycleBinItem(item.id);
      onShowToast?.(
        `Restored ${ENTITY_LABELS[item.entity_type]?.label || item.entity_type} "${item.title || `#${item.entity_id}`}" back to production D1.`,
        'success'
      );
      onRestoredItem?.(res.entity_type, res.entity_id);
      await loadRecycleBin();
    } catch (e: any) {
      onShowToast?.(e?.message || 'Failed to restore item', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const handleConfirmPurge = async () => {
    if (!purgeTarget || purgeConfirmText.trim() !== 'PURGE') return;
    setIsPurging(true);
    try {
      await cloudflareApi.purgeAdminRecycleBinItem(purgeTarget.id, 'PURGE');
      onShowToast?.(
        `Permanently purged "${purgeTarget.title || `#${purgeTarget.entity_id}`}" from Recycle Bin.`,
        'success'
      );
      setPurgeTarget(null);
      setPurgeConfirmText('');
      await loadRecycleBin();
    } catch (e: any) {
      onShowToast?.(e?.message || 'Failed to purge item', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
                  Soft-Delete Recycle Bin & Safe Undo
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  All deleted anime, reviews, dub ratings, franchise links, and voice actors are safely archived here before removal.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-primary)] px-3 py-2 rounded-xl border border-[var(--border-subtle)] cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={includeRestored}
                onChange={(e) => setIncludeRestored(e.target.checked)}
                className="rounded border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              Show Restored History
            </label>

            <button
              type="button"
              onClick={() => void loadRecycleBin()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Entity Type Filter Tabs */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
            <Filter className="w-3.5 h-3.5" />
            Entity Type:
          </span>
          <button
            type="button"
            onClick={() => setEntityFilter('all')}
            className={`px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-bold border transition-all ${
              entityFilter === 'all'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Archived ({items.length})
          </button>
          {RECYCLE_BIN_ENTITY_TYPES.map((type) => {
            const meta = ENTITY_LABELS[type] || { label: type, icon: null };
            return (
              <button
                key={type}
                type="button"
                onClick={() => setEntityFilter(type)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-bold border transition-all ${
                  entityFilter === type
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Items List */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">
            Loading archived records from D1 Recycle Bin...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Recycle Bin is clean
            </p>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              No soft-deleted records match the current filter. Any anime, review, dub rating, franchise link, or cast entry deleted by an admin will appear here for 1-click recovery.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {items.map((item) => {
              const meta = ENTITY_LABELS[item.entity_type] || {
                label: item.entity_type,
                icon: <Trash2 className="w-3.5 h-3.5" />,
              };
              const isRestored = Boolean(item.restored_at);

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg-primary)]/40 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        {meta.icon}
                        {meta.label}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        ID: #{item.entity_id}
                      </span>
                      {isRestored && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Restored {item.restored_at}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {item.title || `${meta.label} #${item.entity_id}`}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Deleted by <span className="font-semibold text-[var(--text-secondary)]">{item.deleted_by || 'admin'}</span> on{' '}
                      <span>{item.deleted_at}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setInspectItem(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Inspect JSON
                    </button>

                    {!isRestored && (
                      <button
                        type="button"
                        onClick={() => void handleRestore(item)}
                        disabled={restoringId === item.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-400 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${restoringId === item.id ? 'animate-spin' : ''}`} />
                        {restoringId === item.id ? 'Restoring...' : '1-Click Restore'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setPurgeTarget(item);
                        setPurgeConfirmText('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Permanent Purge
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspect JSON Snapshot Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)]">
                  Archived Record Snapshot — #{inspectItem.id}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {inspectItem.entity_type} · #{inspectItem.entity_id} · {inspectItem.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
              <pre className="text-xs font-mono bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-4 overflow-x-auto text-[var(--text-secondary)]">
                {JSON.stringify(inspectItem.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Purge Confirmation Dialog requiring exact "PURGE" */}
      {purgeTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] border border-rose-500/40 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--text-primary)]">
                  Permanent Purge Confirmation
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  This will permanently remove{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    {purgeTarget.title || `#${purgeTarget.entity_id}`}
                  </span>{' '}
                  from `admin_recycle_bin`. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[var(--text-secondary)]">
                Type <span className="font-mono text-rose-400">PURGE</span> to confirm permanent deletion:
              </label>
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder="Type PURGE"
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPurgeTarget(null);
                  setPurgeConfirmText('');
                }}
                className="px-4 py-2 min-h-[44px] rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmPurge()}
                disabled={purgeConfirmText.trim() !== 'PURGE' || isPurging}
                className="px-4 py-2 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-40 transition-colors"
              >
                {isPurging ? 'Purging...' : 'Permanently Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
