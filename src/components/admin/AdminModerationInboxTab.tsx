import React, { useState, useEffect } from 'react';
import {
  Inbox,
  MessageSquare,
  CheckCircle2,
  Trash2,
  Edit3,
  Loader2,
  AlertTriangle,
  ExternalLink,
  X,
} from 'lucide-react';
import {
  findPotentialCatalogDuplicates,
  REJECTION_REASON_PRESETS,
} from '../../utils/adminPhase35Polish';
import type { AdminFeedbackItem, FeedbackStatus } from './types';

export interface AdminModerationInboxTabProps {
  pendingItems: any[];
  existingCatalog?: Array<{ id: number; title: string; slug?: string | null; status?: string | null }>;
  feedbackList: AdminFeedbackItem[];
  updatingFeedbackId: number | string | null;
  feedbackError: string | null;
  initialSubTab?: ModerationQueueTab;
  onApproveAnime: (id: number | string, status?: string) => void;
  onBulkApproveAnime?: (ids: Array<number | string>) => Promise<void> | void;
  onRejectAnime: (
    id: number | string,
    options?: { reasonPreset?: string; moderatorNote?: string }
  ) => void;
  onEditPendingAnime: (anime: any) => void;
  onInspectExistingAnime?: (animeId: number) => void;
  onClearPendingQueue?: () => void;
  onUpdateFeedbackStatus: (id: number | string, nextStatus: FeedbackStatus) => void;
  onSuccess?: (message: string, recycleBinId?: number | null) => void;
}

export type ModerationQueueTab = 'all' | 'pending' | 'dub_reviews' | 'general_reviews' | 'feedback';

export function getVisibleModerationSections(counts: {
  pendingCount: number;
  dubReviewsCount: number;
  generalReviewsCount: number;
  openFeedbackCount: number;
}): {
  showDubReviews: boolean;
  showGeneralReviews: boolean;
  visibleTabs: Array<{ id: ModerationQueueTab; label: string; count: number }>;
} {
  const showDubReviews = counts.dubReviewsCount > 0;
  const showGeneralReviews = counts.generalReviewsCount > 0;
  const totalCount =
    counts.pendingCount +
    counts.openFeedbackCount +
    (showDubReviews ? counts.dubReviewsCount : 0) +
    (showGeneralReviews ? counts.generalReviewsCount : 0);

  const visibleTabs: Array<{ id: ModerationQueueTab; label: string; count: number }> = [
    { id: 'all', label: 'All Queues', count: totalCount },
    { id: 'pending', label: 'Pending Submissions', count: counts.pendingCount },
    { id: 'feedback', label: 'User Feedback', count: counts.openFeedbackCount },
  ];

  if (showDubReviews) {
    visibleTabs.push({
      id: 'dub_reviews',
      label: '5-Slider Dub Reviews',
      count: counts.dubReviewsCount,
    });
  }

  if (showGeneralReviews) {
    visibleTabs.push({
      id: 'general_reviews',
      label: 'General Reviews',
      count: counts.generalReviewsCount,
    });
  }

  return {
    showDubReviews,
    showGeneralReviews,
    visibleTabs,
  };
}

export const AdminModerationInboxTab: React.FC<AdminModerationInboxTabProps> = ({
  pendingItems,
  existingCatalog = [],
  feedbackList,
  updatingFeedbackId,
  feedbackError,
  initialSubTab = 'pending',
  onApproveAnime,
  onBulkApproveAnime,
  onRejectAnime,
  onEditPendingAnime,
  onInspectExistingAnime,
  onUpdateFeedbackStatus,
}) => {
  const isFeedbackMode = initialSubTab === 'feedback';
  const [selectedPendingIds, setSelectedPendingIds] = useState<Array<number | string>>([]);
  const [isBulkApproving, setIsBulkApproving] = useState<boolean>(false);
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>(REJECTION_REASON_PRESETS[0]);
  const [moderatorNote, setModeratorNote] = useState<string>('');

  useEffect(() => {
    const validIds = new Set(pendingItems.map((item) => String(item.id)));
    setSelectedPendingIds((prev) => prev.filter((id) => validIds.has(String(id))));
  }, [pendingItems]);

  const toggleSelectPending = (id: number | string) => {
    setSelectedPendingIds((prev) =>
      prev.some((x) => String(x) === String(id))
        ? prev.filter((x) => String(x) !== String(id))
        : [...prev, id]
    );
  };

  const toggleSelectAllPending = () => {
    if (selectedPendingIds.length === pendingItems.length) {
      setSelectedPendingIds([]);
    } else {
      setSelectedPendingIds(pendingItems.map((item) => item.id));
    }
  };

  const handleBulkApproveSelected = async () => {
    if (selectedPendingIds.length === 0 || isBulkApproving) return;
    setIsBulkApproving(true);
    try {
      if (onBulkApproveAnime) {
        await onBulkApproveAnime(selectedPendingIds);
      } else {
        for (const id of selectedPendingIds) {
          await Promise.resolve(onApproveAnime(id));
        }
      }
      setSelectedPendingIds([]);
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleConfirmRejectPending = () => {
    if (!rejectTarget) return;
    onRejectAnime(rejectTarget.id, {
      reasonPreset: selectedPreset,
      moderatorNote: moderatorNote.trim() || undefined,
    });
    setRejectTarget(null);
    setModeratorNote('');
  };

  if (isFeedbackMode) {
    return (
      <div data-testid="admin-user-feedback-tab" className="space-y-4 text-[var(--text-primary)]">
        <div className="p-5 sm:p-6 rounded-3xl bg-[#0b101d] border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/35 shadow-lg shadow-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                User Feedback &amp; Dub Reports
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Community feedback tickets, broken link reports, and regional audio requests
              </p>
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/35 text-purple-300 text-xs font-mono font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              {feedbackList.length} TOTAL TICKETS
            </span>
          </div>
        </div>

        {feedbackError && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-400">
            {feedbackError}
          </div>
        )}

        {feedbackList.length === 0 ? (
          <div className="p-10 sm:p-14 rounded-3xl bg-[#0b101d] border border-white/10 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg sm:text-xl font-black text-white">
                No Community Feedback Tickets
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                User feedback submissions and dub error reports will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbackList.map((item) => {
              const currentStatus: FeedbackStatus = item.status || 'open';
              const isUpdating = updatingFeedbackId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#0b101d] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-white">
                        {item.name || item.author || 'Anonymous User'}
                      </span>
                      {item.type && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300">
                          {item.type}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          currentStatus === 'resolved'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : currentStatus === 'in_progress'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {currentStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 break-words">
                      {item.message || item.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(['open', 'in_progress', 'resolved'] as FeedbackStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={isUpdating || currentStatus === st}
                        onClick={() => onUpdateFeedbackStatus(item.id, st)}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border capitalize cursor-pointer transition-colors ${
                          currentStatus === st
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="admin-community-moderation-queue"
      className="space-y-4 text-[var(--text-primary)]"
    >
      {/* Classic Top Header Card: Community Moderation Queue */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#0b101d] border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/35 shadow-lg shadow-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Community Moderation Queue
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Verify regional audio tracks, platform links, and approve submissions
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            data-testid="pending-ingestion-count-pill"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-amber-400 text-xs font-mono font-extrabold uppercase tracking-wider"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {pendingItems.length} PENDING INGESTION
          </span>

          {pendingItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="pending-select-all-btn"
                onClick={toggleSelectAllPending}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 cursor-pointer"
              >
                {selectedPendingIds.length === pendingItems.length
                  ? 'Deselect All'
                  : `Select All (${pendingItems.length})`}
              </button>
              <button
                type="button"
                data-testid="pending-bulk-approve-btn"
                onClick={() => void handleBulkApproveSelected()}
                disabled={selectedPendingIds.length === 0 || isBulkApproving}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-extrabold text-emerald-400 inline-flex items-center gap-1.5 disabled:opacity-45 cursor-pointer"
              >
                {isBulkApproving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Approve Selected ({selectedPendingIds.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty State Card (when pendingCount === 0) */}
      {pendingItems.length === 0 ? (
        <div
          data-testid="moderation-queue-empty-card"
          className="p-10 sm:p-14 rounded-3xl bg-[#0b101d] border border-white/10 text-center flex flex-col items-center justify-center space-y-4 shadow-xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              All Clear! Moderation Queue is Empty
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              New submissions from fans and community contributors will appear here for verification before publishing to Cloudflare.
            </p>
          </div>
        </div>
      ) : (
        /* Pending Items List (when pendingCount > 0) */
        <div className="space-y-3">
          {pendingItems.map((anime) => {
            const isSelected = selectedPendingIds.some(
              (id) => String(id) === String(anime.id)
            );
            const duplicateMatches = findPotentialCatalogDuplicates(
              { id: Number(anime.id), title: String(anime.title || ''), slug: anime.slug },
              existingCatalog
            );
            const resolvedAiringStatus =
              anime.airing_status && String(anime.airing_status).toLowerCase() !== 'pending'
                ? String(anime.airing_status)
                : anime.status && String(anime.status).toLowerCase() !== 'pending'
                  ? String(anime.status)
                  : anime.type === 'Movie'
                    ? 'Completed'
                    : 'Airing';

            const langsList = Array.isArray(anime.languages)
              ? anime.languages.filter(Boolean)
              : typeof anime.languages === 'string' && anime.languages.trim()
                ? anime.languages
                    .split(/[,|]/)
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : [];

            const posterSrc =
              anime.posterUrl ||
              anime.cover_image ||
              anime.poster ||
              anime.image ||
              'https://picsum.photos/seed/pending/100/150';

            return (
              <div
                key={anime.id}
                data-testid={`pending-anime-row-${anime.id}`}
                className={`p-4 sm:p-5 rounded-2xl bg-[#0b101d] border transition-colors space-y-3 shadow-md ${
                  isSelected
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-white/10 hover:border-amber-500/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectPending(anime.id)}
                      aria-label={`Select ${anime.title}`}
                      className="mt-2 w-4 h-4 rounded accent-emerald-500 cursor-pointer shrink-0"
                    />
                    <img
                      src={posterSrc}
                      alt={anime.title}
                      loading="lazy"
                      className="w-16 h-24 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-extrabold text-white truncate">
                          {anime.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Pending Ingestion
                        </span>
                        {duplicateMatches.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Possible Duplicate
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400">
                        {anime.type || 'TV Series'} · {anime.year || '2024'} · Status:{' '}
                        <span className="text-slate-200 font-bold">{resolvedAiringStatus}</span> · OTT:{' '}
                        <span className="text-cyan-400 font-bold">
                          {anime.platform || 'Unverified'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {langsList.length > 0 ? (
                          langsList.map((lang: string, idx: number) => (
                            <span
                              key={`${lang}-${idx}`}
                              className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-200"
                            >
                              {lang}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[10px] font-bold text-rose-400">
                            Unverified Dubs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid={`pending-approve-btn-${anime.id}`}
                      onClick={() => onApproveAnime(anime.id, resolvedAiringStatus)}
                      className="min-h-[40px] px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-extrabold text-emerald-400 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditPendingAnime(anime)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget(anime);
                        setSelectedPreset(
                          duplicateMatches.length > 0
                            ? 'Duplicate Entry'
                            : REJECTION_REASON_PRESETS[0]
                        );
                        setModeratorNote('');
                      }}
                      className="min-h-[40px] px-3.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/35 text-xs font-extrabold text-red-400 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>

                {duplicateMatches.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="text-amber-400 font-semibold">
                      Possible duplicate of existing catalog{' '}
                      {duplicateMatches.map((m) => `"${m.title}" (#${m.id})`).join(', ')}.
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {duplicateMatches.slice(0, 2).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (onInspectExistingAnime) {
                              onInspectExistingAnime(m.id);
                            } else {
                              window.location.href = `/anime/${m.slug || m.id}`;
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg bg-[#090d16] border border-amber-500/40 text-amber-400 font-bold hover:bg-amber-500/15 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Inspect #{m.id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Reason Presets & Moderator Note Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-white/10 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">
                  Reject Pending Submission
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Rejecting <span className="font-bold text-white">{rejectTarget.title}</span> will archive it to the Recycle Bin and record your reason in Activity Logs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="p-2 min-h-[40px] min-w-[40px] rounded-xl bg-white/5 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Quick Rejection Reason Preset
              </label>
              <div className="flex flex-wrap gap-2">
                {REJECTION_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={`px-3 py-2 min-h-[38px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedPreset === preset
                        ? 'bg-red-500/20 text-red-400 border-red-500/50'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Moderator Note (Optional — saved to Activity Logs)
              </label>
              <textarea
                rows={3}
                value={moderatorNote}
                onChange={(e) => setModeratorNote(e.target.value)}
                placeholder="Add context for audit history (e.g., already listed under ID #42, no official Crunchyroll India source)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="min-h-[44px] px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectPending}
                className="min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold cursor-pointer"
              >
                Confirm Reject &amp; Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
