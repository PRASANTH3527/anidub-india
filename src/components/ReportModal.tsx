'use client';

import React, { useState } from 'react';
import { Flag, X, Send, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  anime: { id: string; title: string; poster?: string } | null;
}

const COMMON_REASONS = [
  'Broken Streaming Link',
  'Wrong Regional Info',
  'Audio Not Dubbed / Sub-only',
  'Incorrect Platform Listed',
  'Audio Desync / Quality Issue',
  'Other Error',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  anime,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const toast = useToast();

  if (!isOpen || !anime) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeId: anime.id,
          animeTitle: anime.title,
          reason: selectedReason,
          details: details.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send report');
      }

      setIsSubmitted(true);
      toast.success('Report Sent!', `Moderators alerted on Telegram for "${anime.title}".`);

      setTimeout(() => {
        setIsSubmitted(false);
        setDetails('');
        setSelectedReason(COMMON_REASONS[0]);
        onClose();
      }, 1600);
    } catch (err: any) {
      toast.error('Submission Failed', err.message || 'Could not send report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#121829] border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-lg">
              <Flag className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-heading font-black text-white text-base sm:text-lg">
                Report Issue
              </h3>
              <p className="text-xs text-neutral-400 truncate max-w-[240px]" title={anime.title}>
                {anime.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-white text-base">Report Delivered</h4>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              Our moderation team was pinged on Telegram and will verify the dub link/info promptly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick Reason Chips */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                What is the issue?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMMON_REASONS.map((r) => {
                  const isSelected = selectedReason === r;
                  return (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setSelectedReason(r)}
                      className={`text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-rose-950/70 border-rose-500 text-rose-200 shadow-md shadow-rose-950/40'
                          : 'bg-[#161d30] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional Details */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Additional Notes <span className="text-neutral-500 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. Correct link is Netflix, or episode 4 is missing Tamil audio..."
                rows={3}
                className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-rose-500 rounded-2xl p-3 text-xs text-white placeholder-neutral-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* Note about Telegram alert */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Sends an instant notification to the admin moderation bot.</span>
            </div>

            {/* Submit CTA */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedReason}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Alerting Team...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Telegram Alert</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
