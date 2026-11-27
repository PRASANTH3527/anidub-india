import React from 'react';
import {
  CheckCircle2,
  Trash2,
  Edit3,
  Check,
  X,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { OFFICIAL_INDIAN_LANGUAGES } from './types';

export interface AdminPendingTabProps {
  pendingItems: any[];
  onApproveAllPending: () => void;
  onClearAllPending: () => void;
  onEditPending: (item: any) => void;
  onTogglePendingLanguage: (id: number | string, lang: string) => void;
  onApprove: (id: number | string) => void;
  onReject: (id: number | string) => void;
}

export const AdminPendingTab: React.FC<AdminPendingTabProps> = ({
  pendingItems,
  onApproveAllPending,
  onClearAllPending,
  onEditPending,
  onTogglePendingLanguage,
  onApprove,
  onReject,
}) => {
  return (
    <div data-testid="admin-pending-tab" className="space-y-4 text-[var(--text-primary)]">
      {pendingItems.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
              {pendingItems.length} Pending Submissions Awaiting Review
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onApproveAllPending}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve All ({pendingItems.length})
            </button>
          </div>
        </div>
      )}

      {pendingItems.length === 0 ? (
        <div className="text-center py-14 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] px-4">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
          <p className="text-base font-bold text-[var(--text-primary)]">
            Moderation Queue is Clear
          </p>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            All community dub submissions have been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingItems.map((item) => {
            const activeLangs: string[] = Array.isArray(item.languages)
              ? item.languages.filter(Boolean)
              : typeof item.languages === 'string' && item.languages.trim()
                ? item.languages.split(',').map((s: string) => s.trim()).filter(Boolean)
                : [];

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <img
                    src={
                      item.poster ||
                      item.cover_image ||
                      'https://picsum.photos/seed/anime/100/150'
                    }
                    alt={item.title}
                    loading="lazy"
                    className="w-14 h-20 rounded-xl object-cover border border-[var(--border-subtle)] shrink-0"
                  />
                  <div className="space-y-2 min-w-0">
                    <div>
                      <h4 className="font-extrabold text-[var(--text-primary)] text-sm sm:text-base truncate">
                        {item.title}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Platform:{' '}
                        <span className="text-[var(--text-primary)] font-semibold">
                          {item.platform || 'Unverified'}
                        </span>{' '}
                        • By: {item.submittedBy || 'Community'} • {item.date || 'Recently'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                        Verify Dub Languages (Click to toggle):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {OFFICIAL_INDIAN_LANGUAGES.map((lang) => {
                          const isSelected = activeLangs.includes(lang);
                          return (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => onTogglePendingLanguage(item.id, lang)}
                              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                isSelected
                                  ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {isSelected ? `✓ ${lang}` : `+ ${lang}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditPending(item)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(item.id)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(item.id)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
