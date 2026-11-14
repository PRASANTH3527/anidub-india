import React from 'react';
import { Inbox, Check } from 'lucide-react';
import type { FeedbackTicket } from './types';

export interface AdminFeedbackTabProps {
  feedbackList: FeedbackTicket[];
  onResolveFeedback: (id: number | string) => void;
}

export const AdminFeedbackTab: React.FC<AdminFeedbackTabProps> = ({
  feedbackList,
  onResolveFeedback,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Community Feedback Terminal</h2>
            <p className="text-xs text-neutral-400">User reviews, missing dub requests, and voice actor reports</p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-neutral-300">
          {feedbackList.length} INCOMING MESSAGES
        </span>
      </div>

      {feedbackList.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.025] backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-3 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(168,85,247,0.25)]">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">No Pending Feedback Messages</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            When Indian anime enthusiasts submit request tickets or suggestions from the public site, they will stream here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbackList.map((fb, idx) => (
            <div key={`feedback_ticket_${fb.id ?? idx}`} className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-purple-500/40 shadow-xl hover:shadow-[0_0_30px_rgba(168,85,247,0.12)] transition-all duration-300 hover:scale-[1.01] space-y-3">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-400/30 text-purple-300 flex items-center justify-center font-bold text-xs font-mono">
                    {(fb.name_or_insta || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{fb.name_or_insta || 'Anonymous Fan'}</h4>
                    <span className="text-[10px] text-neutral-500 font-mono">{fb.created_at || 'Just now'}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono">
                  Community Ticket
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/5 font-sans">
                "{fb.feedback_text}"
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onResolveFeedback(fb.id ?? idx)}
                  className="h-8 px-3 rounded-lg bg-white/[0.05] hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-400/40 text-[11px] font-semibold text-emerald-300 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mark Resolved</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
