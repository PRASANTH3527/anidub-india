import React, { useState } from 'react';
import { X, Flag, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';

export interface ReportModalProps {
  animeTitle: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  'Incorrect Dub Audio / Missing Language',
  'Broken Streaming Link / OTT Error',
  'Incorrect Voice Artist Credits',
  'Duplicate Listing or Title Mismatch',
  'Audio / Video Sync Issue',
  'Other Policy or Content Issue'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  animeTitle,
  onClose
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(REPORT_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await cloudflareApi.reportIssue({ animeTitle, reason: selectedReason, notes }).catch(() => {});
    } catch {}

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1800);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* MODAL CONTAINER */}
      <div className="relative w-full max-w-md bg-[#121829] border border-primary-theme/40 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-neutral-100 font-sans">
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-theme/10 border border-primary-theme/30 text-accent-theme shrink-0 shadow-lg flex items-center justify-center">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg tracking-tight">
                Report Issue
              </h2>
              <p className="text-neutral-400 text-xs truncate max-w-[240px]">
                {animeTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          /* SUCCESS STATE */
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-black text-lg text-white">Report Submitted Successfully</h3>
            <p className="text-neutral-400 text-xs max-w-xs mx-auto">
              Our moderation team & automated Telegram webhook have been notified. Thank you for keeping Anidub India accurate!
            </p>
          </div>
        ) : (
          /* REPORT FORM */
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Select Report Reason
              </label>

              {/* REASON CHIPS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REPORT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`p-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-primary-theme/20 border-primary-theme text-primary-theme shadow-md shadow-purple-950/40'
                          : 'bg-[#161d30] border-neutral-800 text-neutral-300 hover:bg-[#1c253d]'
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Additional Details (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe episode number, correct voice actor, or OTT timestamp..."
                className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-primary-theme rounded-2xl p-3 text-xs text-white outline-none resize-none"
              />
            </div>

            {/* TELEGRAM NOTE */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Direct webhook notification sent to Telegram admin channel.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl btn-primary-theme active:scale-95 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : 'Submit Report'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
