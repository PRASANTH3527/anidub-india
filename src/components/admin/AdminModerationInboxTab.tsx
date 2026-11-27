import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MessageSquare,
  Star,
  CheckCircle2,
  EyeOff,
  Flag,
  ShieldAlert,
  Trash2,
  Edit3,
  RefreshCw,
  Loader2,
  Sliders,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import type { AdminFeedbackItem, FeedbackStatus } from './types';

export interface AdminModerationInboxTabProps {
  pendingItems: any[];
  feedbackList: AdminFeedbackItem[];
  updatingFeedbackId: number | string | null;
  feedbackError: string | null;
  onApproveAnime: (id: number | string, status?: string) => void;
  onRejectAnime: (id: number | string) => void;
  onEditPendingAnime: (anime: any) => void;
  onClearPendingQueue: () => void;
  onUpdateFeedbackStatus: (id: number | string, nextStatus: FeedbackStatus) => void;
  onSuccess?: (message: string) => void;
}

type ModerationQueueTab = 'all' | 'pending' | 'dub_reviews' | 'general_reviews' | 'feedback';

export const AdminModerationInboxTab: React.FC<AdminModerationInboxTabProps> = ({
  pendingItems,
  feedbackList,
  updatingFeedbackId,
  feedbackError,
  onApproveAnime,
  onRejectAnime,
  onEditPendingAnime,
  onClearPendingQueue,
  onUpdateFeedbackStatus,
  onSuccess,
}) => {
  const [queueTab, setQueueTab] = useState<ModerationQueueTab>('all');
  const [loadingInbox, setLoadingInbox] = useState<boolean>(true);
  const [dubReviews, setDubReviews] = useState<any[]>([]);
  const [generalReviews, setGeneralReviews] = useState<any[]>([]);
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const res = await cloudflareApi.fetchAdminModerationInbox();
      setDubReviews(res.dubReviews || []);
      setGeneralReviews(res.generalReviews || []);
    } catch {
      // Safe fallback if dub_reviews is unmigrated
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const handleModerateDubReview = async (
    reviewId: number,
    payload: { status?: 'published' | 'hidden' | 'flagged'; has_spoilers?: boolean }
  ) => {
    setModeratingId(`dub-${reviewId}`);
    try {
      await cloudflareApi.moderateAdminDubReview(reviewId, payload);
      await loadInbox();
      onSuccess?.(`Updated 5-Slider Regional Dub Review #${reviewId}.`);
    } catch {
      // ignore
    } finally {
      setModeratingId(null);
    }
  };

  const handleModerateGeneralReview = async (
    reviewId: number,
    payload: { status?: string; is_spoiler?: boolean }
  ) => {
    setModeratingId(`gen-${reviewId}`);
    try {
      await cloudflareApi.moderateAdminGeneralReview(reviewId, payload);
      await loadInbox();
      onSuccess?.(`Updated General Review #${reviewId}.`);
    } catch {
      // ignore
    } finally {
      setModeratingId(null);
    }
  };

  const handleDeleteGeneralReview = async (reviewId: number) => {
    setModeratingId(`gen-${reviewId}`);
    try {
      await cloudflareApi.deleteAdminGeneralReview(reviewId);
      await loadInbox();
      onSuccess?.(`Deleted General Review #${reviewId}.`);
    } catch {
      // ignore
    } finally {
      setModeratingId(null);
    }
  };

  const openFeedbackCount = feedbackList.filter(
    (f) => (f.status || 'open') !== 'resolved'
  ).length;

  return (
    <div data-testid="admin-unified-moderation-inbox" className="space-y-6 text-[var(--text-primary)]">
      {/* Header & Unified Queue Tabs */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[var(--accent-primary)]" />
            Unified Moderation Inbox
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Centralized moderation queue for Pending Anime Submissions, 5-Slider Regional Dub Quality Reviews (`dub_reviews`), General Reviews, and User Feedback.
          </p>
        </div>

        <button
          type="button"
          onClick={loadInbox}
          disabled={loadingInbox}
          className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 self-start lg:self-center cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${loadingInbox ? 'animate-spin' : ''}`} />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* Queue Sub-Tab Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            {
              id: 'all',
              label: 'All Queues',
              count:
                pendingItems.length +
                dubReviews.length +
                generalReviews.length +
                openFeedbackCount,
            },
            { id: 'pending', label: 'Pending Submissions', count: pendingItems.length },
            { id: 'dub_reviews', label: '5-Slider Dub Reviews', count: dubReviews.length },
            { id: 'general_reviews', label: 'General Reviews', count: generalReviews.length },
            { id: 'feedback', label: 'User Feedback', count: openFeedbackCount },
          ] as Array<{ id: ModerationQueueTab; label: string; count: number }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`moderation-queue-tab-${tab.id}`}
            onClick={() => setQueueTab(tab.id)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-2 cursor-pointer ${
              queueTab === tab.id
                ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>{tab.label}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-black/15">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 1. Pending Anime Submissions Queue */}
      {(queueTab === 'all' || queueTab === 'pending') && (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending Anime Submissions ({pendingItems.length})
            </h3>
            {pendingItems.length > 0 && (
              <button
                type="button"
                onClick={onClearPendingQueue}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-500 cursor-pointer"
              >
                Clear Queue
              </button>
            )}
          </div>

          {pendingItems.length === 0 ? (
            <div className="p-6 rounded-xl bg-[var(--bg-elevated)] text-center text-xs text-[var(--text-secondary)]">
              No pending anime submissions awaiting moderation.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingItems.map((anime) => (
                <div
                  key={anime.id}
                  className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {anime.title}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {anime.type || 'TV Series'} · {anime.year || 'N/A'} · Languages:{' '}
                      {anime.languages || 'Unverified'} · OTT: {anime.platform || 'Unverified'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditPendingAnime(anime)}
                      className="min-h-[40px] px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Review in Editor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onApproveAnime(anime.id, 'Airing')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-500 cursor-pointer"
                    >
                      Approve Live
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectAnime(anime.id)}
                      className="min-h-[40px] px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold text-red-500 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. 5-Slider Regional Dub Quality Reviews Queue (dub_reviews) */}
      {(queueTab === 'all' || queueTab === 'dub_reviews') && (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--accent-primary)]" />
              5-Slider Regional Dub Quality Reviews ({dubReviews.length})
            </h3>
          </div>

          {loadingInbox ? (
            <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2 text-[var(--accent-primary)]" />
              Loading regional dub reviews...
            </div>
          ) : dubReviews.length === 0 ? (
            <div className="p-6 rounded-xl bg-[var(--bg-elevated)] text-center text-xs text-[var(--text-secondary)]">
              No 5-Slider Regional Dub Reviews recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {dubReviews.map((rev) => {
                const isBusy = moderatingId === `dub-${rev.id}`;
                const hasSpoiler = Boolean(rev.has_spoilers);
                const status = String(rev.status || 'published').toLowerCase();
                return (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-[var(--text-primary)]">
                          {rev.anime_title || `Anime #${rev.anime_id}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                          {rev.dub_language} Dub
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-500">
                          Overall: {Number(rev.overall_score || 0).toFixed(1)} / 5
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            status === 'published'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : status === 'flagged'
                                ? 'bg-amber-500/15 text-amber-500'
                                : 'bg-red-500/15 text-red-500'
                          }`}
                        >
                          {status}
                        </span>
                        {hasSpoiler && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 text-red-500">
                            Spoiler Shield ON
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap gap-3">
                        <span>By: {rev.user_name || rev.user_id}</span>
                        <span>Voice Acting: {rev.voice_acting}/5</span>
                        <span>Casting: {rev.voice_casting}/5</span>
                        <span>Translation: {rev.translation_quality}/5</span>
                        <span>Lip Sync: {rev.lip_sync}/5</span>
                        <span>Emotion: {rev.emotional_delivery}/5</span>
                      </div>

                      {rev.review_text && (
                        <p className="text-xs text-[var(--text-primary)] bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                          {rev.review_text}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleModerateDubReview(rev.id, { has_spoilers: !hasSpoiler })
                        }
                        className="min-h-[40px] px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] cursor-pointer"
                      >
                        {hasSpoiler ? 'Remove Spoiler Shield' : 'Enable Spoiler Shield'}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || status === 'published'}
                        onClick={() => handleModerateDubReview(rev.id, { status: 'published' })}
                        className="min-h-[40px] px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-500 inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || status === 'hidden'}
                        onClick={() => handleModerateDubReview(rev.id, { status: 'hidden' })}
                        className="min-h-[40px] px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold text-red-500 inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || status === 'flagged'}
                        onClick={() => handleModerateDubReview(rev.id, { status: 'flagged' })}
                        className="min-h-[40px] px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold text-amber-500 inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Flag</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. General Reviews Queue */}
      {(queueTab === 'all' || queueTab === 'general_reviews') && (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            General Anime Reviews ({generalReviews.length})
          </h3>

          {generalReviews.length === 0 ? (
            <div className="p-6 rounded-xl bg-[var(--bg-elevated)] text-center text-xs text-[var(--text-secondary)]">
              No general anime reviews in the moderation queue.
            </div>
          ) : (
            <div className="space-y-3">
              {generalReviews.slice(0, 40).map((rev) => {
                const isBusy = moderatingId === `gen-${rev.id}`;
                const isSpoiler = Boolean(rev.is_spoiler);
                return (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {rev.anime_title || `Anime #${rev.anime_id}`}
                        </span>
                        <span className="text-xs font-bold text-amber-500">
                          ★ {rev.rating}/10
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          by {rev.user_name || 'User'}
                        </span>
                        {isSpoiler && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-500">
                            Spoiler
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] break-words">
                        {rev.comment}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleModerateGeneralReview(rev.id, { is_spoiler: !isSpoiler })
                        }
                        className="min-h-[38px] px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] cursor-pointer"
                      >
                        {isSpoiler ? 'Unmark Spoiler' : 'Mark Spoiler'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteGeneralReview(rev.id)}
                        className="min-h-[38px] px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold text-red-500 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. User Feedback & Reports Queue */}
      {(queueTab === 'all' || queueTab === 'feedback') && (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--accent-primary)]" />
            User Feedback &amp; Dub Reports ({feedbackList.length})
          </h3>

          {feedbackError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-500">
              {feedbackError}
            </div>
          )}

          {feedbackList.length === 0 ? (
            <div className="p-6 rounded-xl bg-[var(--bg-elevated)] text-center text-xs text-[var(--text-secondary)]">
              No community feedback items recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {feedbackList.map((item) => {
                const currentStatus: FeedbackStatus = item.status || 'open';
                const isUpdating = updatingFeedbackId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {item.name || item.author || 'Anonymous User'}
                        </span>
                        {item.type && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                            {item.type}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            currentStatus === 'resolved'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : currentStatus === 'in_progress'
                                ? 'bg-amber-500/15 text-amber-500'
                                : 'bg-sky-500/15 text-sky-500'
                          }`}
                        >
                          {currentStatus.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] break-words">
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
                          className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border capitalize cursor-pointer ${
                            currentStatus === st
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
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
      )}
    </div>
  );
};
