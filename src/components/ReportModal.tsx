import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Send, AlertCircle } from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';
import { AniDubLogo } from './AniDubLogo';

export interface ReportModalProps {
  animeId?: number | string;
  animeTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const REPORT_ISSUE_TYPES = [
  'Incorrect Dub Audio / Missing Language',
  'Broken Streaming Link / OTT Error',
  'Incorrect Voice Artist Credits',
  'Duplicate Listing or Title Mismatch',
  'Incorrect Episode Count or Airing Status',
  'Audio / Video Sync Issue',
  'Other Policy or Content Issue'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  animeId,
  animeTitle,
  onClose,
  onSuccess
}) => {
  const [issueType, setIssueType] = useState<string>(REPORT_ISSUE_TYPES[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await cloudflareApi.reportIssue({
        animeId,
        animeTitle,
        issueType,
        reason: issueType,
        description: description.trim(),
        notes: description.trim(),
      });
      setIsSuccess(true);
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to submit report right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* MODAL CONTAINER */}
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-heading"
        className="relative w-full max-w-md bg-[#121829] border border-primary-theme/40 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-neutral-100 font-sans"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <AniDubLogo variant="horizontal" size="sm" className="shrink-0 drop-shadow-md" />
            <div>
              <h2 id="report-modal-heading" className="font-heading font-black text-white text-base sm:text-lg tracking-tight">
                Report Issue
              </h2>
              <p className="text-neutral-400 text-xs truncate max-w-[240px]">
                {animeTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report modal"
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
              Your report has been saved to our moderation queue. Thank you for keeping Anidub India accurate!
            </p>
          </div>
        ) : (
          /* REPORT FORM */
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="report-issue-type" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Issue Type
              </label>
              <select
                id="report-issue-type"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-primary-theme rounded-xl px-3 py-2.5 text-xs text-white outline-none"
              >
                {REPORT_ISSUE_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-[#121829] text-white">
                    {type}
                  </option>
                ))}
              </select>

              {/* REASON CHIPS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {REPORT_ISSUE_TYPES.slice(0, 4).map((reason) => {
                  const isSelected = issueType === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setIssueType(reason)}
                      className={`p-2 rounded-xl text-left text-[11px] font-bold transition-all cursor-pointer border ${
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
              <label htmlFor="report-description" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Description
              </label>
              <textarea
                id="report-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what needs correction (episode number, OTT link, voice credits, audio track)..."
                className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-primary-theme rounded-2xl p-3 text-xs text-white placeholder-neutral-500 outline-none resize-none"
              />
            </div>

            {/* MODERATION NOTE */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Submitted reports are logged directly to D1 & moderation alerts.</span>
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
                <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
