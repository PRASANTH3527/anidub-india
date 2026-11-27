import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import type { AdminFeedbackItem, FeedbackStatus } from './types';

export interface AdminFeedbackTabProps {
  feedbackList: AdminFeedbackItem[];
  onUpdateFeedbackStatus: (id: number | string, nextStatus: FeedbackStatus) => Promise<void>;
  onRefreshFeedback?: () => void;
  updatingFeedbackId?: number | string | null;
  feedbackError?: string | null;
}

export const AdminFeedbackTab: React.FC<AdminFeedbackTabProps> = ({
  feedbackList,
  onUpdateFeedbackStatus,
  onRefreshFeedback,
  updatingFeedbackId = null,
  feedbackError = null,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedList = useMemo(() => {
    return (feedbackList || []).map((item) => {
      const rawStatus = String(item.status || 'open').toLowerCase();
      const status: FeedbackStatus =
        rawStatus === 'resolved'
          ? 'resolved'
          : rawStatus === 'in_progress'
            ? 'in_progress'
            : 'open';
      return {
        ...item,
        status,
      };
    });
  }, [feedbackList]);

  const counts = useMemo(() => {
    const res = { all: normalizedList.length, open: 0, in_progress: 0, resolved: 0 };
    for (const item of normalizedList) {
      if (item.status === 'resolved') res.resolved++;
      else if (item.status === 'in_progress') res.in_progress++;
      else res.open++;
    }
    return res;
  }, [normalizedList]);

  const filteredList = useMemo(() => {
    return normalizedList.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${item.name || ''} ${item.author || ''} ${item.email || ''} ${item.message || ''} ${item.content || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [normalizedList, statusFilter, searchQuery]);

  const getStatusBadge = (status?: FeedbackStatus) => {
    if (status === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolved
        </span>
      );
    }
    if (status === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
          <Clock className="w-3.5 h-3.5" />
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold">
        <MessageSquare className="w-3.5 h-3.5" />
        Open
      </span>
    );
  };

  return (
    <div data-testid="admin-feedback-tab" className="space-y-5 text-[var(--text-primary)]">
      {/* Header & Status Filter Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[var(--accent-primary)]" />
              User Feedback &amp; Ticket Workflow
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Track community tickets through Open &rarr; In Progress &rarr; Resolved without losing ticket history.
            </p>
          </div>
          {onRefreshFeedback && (
            <button
              type="button"
              onClick={onRefreshFeedback}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 self-start sm:self-center"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Tickets
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'open', label: `Open (${counts.open})` },
                { id: 'in_progress', label: `In Progress (${counts.in_progress})` },
                { id: 'resolved', label: `Resolved (${counts.resolved})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  statusFilter === tab.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, or message..."
              className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
        </div>
      </div>

      {/* Error Banner if API Status Update Failed */}
      {feedbackError && (
        <div
          data-testid="feedback-error-banner"
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs sm:text-sm font-semibold flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedbackError}</span>
        </div>
      )}

      {/* Tickets List */}
      {filteredList.length === 0 ? (
        <div className="text-center py-14 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] px-4">
          <MessageSquare className="w-10 h-10 text-[var(--text-secondary)] opacity-50 mx-auto mb-3" />
          <p className="text-base font-bold text-[var(--text-primary)]">
            {normalizedList.length === 0
              ? 'No user feedback tickets yet'
              : 'No tickets match your current filter'}
          </p>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Community feedback and dub issue reports submitted by users appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((fb) => {
            const isUpdating = updatingFeedbackId !== null && String(updatingFeedbackId) === String(fb.id);
            const authorLabel = fb.name || fb.author || 'Anonymous User';
            const messageText = fb.message || fb.content || '';
            const timestampLabel = fb.date || fb.created_at || 'Recent';

            return (
              <div
                key={fb.id}
                data-testid={`feedback-ticket-${fb.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between gap-4 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center font-extrabold text-[var(--accent-primary)] text-sm shrink-0">
                        {authorLabel[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-[var(--text-primary)] text-sm truncate">
                          {authorLabel}
                        </h4>
                        <span className="text-xs text-[var(--text-secondary)] block truncate">
                          {fb.email ? `${fb.email} • ` : ''}
                          {timestampLabel}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">{getStatusBadge(fb.status)}</div>
                  </div>

                  <p className="text-sm text-[var(--text-primary)] leading-relaxed bg-[var(--bg-elevated)] p-3.5 rounded-xl border border-[var(--border-subtle)] break-words">
                    &ldquo;{messageText}&rdquo;
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-xs font-mono text-[var(--text-secondary)]">
                    Ticket #{fb.id}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {fb.status !== 'open' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void onUpdateFeedbackStatus(fb.id, 'open')}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reopen
                      </button>
                    )}

                    {fb.status !== 'in_progress' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void onUpdateFeedbackStatus(fb.id, 'in_progress')}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        In Progress
                      </button>
                    )}

                    {fb.status !== 'resolved' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        data-testid={`resolve-feedback-btn-${fb.id}`}
                        onClick={() => void onUpdateFeedbackStatus(fb.id, 'resolved')}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
