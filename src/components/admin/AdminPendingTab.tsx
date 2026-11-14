import React from 'react';
import { Inbox, Trash2, Search, X, CheckCircle2, Check, Edit3 } from 'lucide-react';
import type { AdminAnimeRecord } from './types';

export interface AdminPendingTabProps {
  pendingItems: AdminAnimeRecord[];
  filteredPendingItems: AdminAnimeRecord[];
  pendingSearchQuery: string;
  onPendingSearchChange: (q: string) => void;
  onClearPendingQueue: () => void;
  onApprovePending: (id: number | string) => void;
  onEditPending: (item: AdminAnimeRecord) => void;
  onRejectPending: (id: number | string) => void;
}

export const AdminPendingTab: React.FC<AdminPendingTabProps> = ({
  pendingItems,
  filteredPendingItems,
  pendingSearchQuery,
  onPendingSearchChange,
  onClearPendingQueue,
  onApprovePending,
  onEditPending,
  onRejectPending,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Community Moderation Queue</h2>
            <p className="text-xs text-neutral-400">Verify regional audio tracks, platform links, and approve submissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {pendingItems.length > 0 && (
            <button
              onClick={onClearPendingQueue}
              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-100 text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]"
              title="Purge all pending submissions"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Pending</span>
            </button>
          )}
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-wide flex items-center gap-2 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{pendingItems.length} PENDING INGESTION</span>
          </span>
        </div>
      </div>

      {pendingItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={pendingSearchQuery}
              onChange={(e) => onPendingSearchChange(e.target.value)}
              placeholder="Search pending moderation queue by title, ID, language, studio, genre..."
              className="w-full bg-[#0a0d16]/90 border border-amber-500/20 focus:border-amber-400 focus:shadow-[0_0_20px_rgba(245,158,11,0.2)] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all duration-300"
            />
            {pendingSearchQuery && (
              <button
                onClick={() => onPendingSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {pendingSearchQuery && (
            <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 font-mono">
              <span>Searching pending for: "{pendingSearchQuery}"</span>
              <span className="text-amber-300 font-bold">{filteredPendingItems.length} of {pendingItems.length} matching</span>
            </div>
          )}
        </div>
      )}

      {pendingItems.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.025] backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-3 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">All Clear! Moderation Queue is Empty</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            New submissions from fans and community contributors will appear here for verification before publishing to Cloudflare.
          </p>
        </div>
      ) : filteredPendingItems.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.025] backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
          <p className="text-xs text-neutral-400 font-mono">No pending submissions match "{pendingSearchQuery}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredPendingItems.map((item) => (
            <div key={`pending_item_${item.id}`} className="p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-amber-500/30 hover:border-amber-400/60 shadow-xl hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] space-y-4 flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] group">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <img
                    src={item.cover_image || item.posterUrl || item.image || item.poster || '/logo.png'}
                    alt={item.title}
                    className="w-16 h-24 rounded-xl object-cover ring-1 ring-white/15 shadow-md shadow-black/60 group-hover:ring-amber-400/50 transition-all"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono uppercase font-bold tracking-wider">
                      Pending Review
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">#{item.id}</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white truncate leading-snug">{item.title}</h4>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {item.hindi && <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-medium">Hindi</span>}
                    {item.tamil && <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-medium">Tamil</span>}
                    {item.telugu && <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-medium">Telugu</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  onClick={() => onApprovePending(item.id)}
                  className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>APPROVE</span>
                </button>
                <button
                  onClick={() => onEditPending(item)}
                  className="h-9 px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>EDIT</span>
                </button>
                <button
                  onClick={() => onRejectPending(item.id)}
                  className="h-9 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-100 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(244,63,94,0.25)]"
                  title="Reject submission"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
