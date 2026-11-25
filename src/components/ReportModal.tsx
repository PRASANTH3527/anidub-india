import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Send, AlertCircle } from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';
import { AniDubLogo } from './AniDubLogo';

export interface ReportModalProps {
  isOpen?: boolean;
  animeId?: number | string;
  animeTitle: string;
  initialField?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const REPORT_FIELD_OPTIONS = [
  { id: 'OTT Link', label: 'OTT Link', hint: 'Broken, expired, or wrong official streaming link' },
  { id: 'Dub Language', label: 'Dub Language', hint: 'Missing or inaccurate Indian audio language' },
  { id: 'Episode Count', label: 'Episode Count', hint: 'Wrong season or dubbed episode count' },
  { id: 'Release Schedule', label: 'Release Schedule', hint: 'Incorrect simulcast day, time, or airing status' },
  { id: 'Title / Poster', label: 'Title / Poster', hint: 'Typo, duplicate entry, or wrong cover image' },
  { id: 'Other', label: 'Other', hint: 'Any other factual correction or copyright concern' },
] as const;

// Backwards-compatible export
export const REPORT_ISSUE_TYPES = REPORT_FIELD_OPTIONS.map((f) => f.label);

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen = true,
  animeId,
  animeTitle,
  initialField,
  onClose,
  onSuccess,
}) => {
  const [selectedField, setSelectedField] = useState<string>(
    initialField || REPORT_FIELD_OPTIONS[0].id
  );
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (initialField) {
      setSelectedField(initialField);
    }
  }, [initialField]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedOption =
    REPORT_FIELD_OPTIONS.find((opt) => opt.id === selectedField) || REPORT_FIELD_OPTIONS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await cloudflareApi.reportIssue({
        animeId,
        animeTitle,
        field: selectedField,
        issueType: selectedField,
        reason: selectedField,
        description: description.trim(),
        notes: description.trim(),
      });
      setIsSuccess(true);
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to submit correction right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalNode = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-heading"
        className="relative w-full max-w-md bg-[#121829] border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 text-neutral-100 font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3 min-w-0">
            <AniDubLogo variant="horizontal" size="sm" className="shrink-0" />
            <div className="min-w-0">
              <h2 id="report-modal-heading" className="font-heading font-black text-white text-base sm:text-lg tracking-tight">
                Report Wrong Info
              </h2>
              <p className="text-neutral-400 text-xs truncate max-w-[230px]">
                {animeTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report modal"
            className="w-8 h-8 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-black text-lg text-white">Correction Sent to Admin Queue</h3>
            <p className="text-neutral-400 text-xs max-w-xs mx-auto">
              Thank you for flagging <span className="text-white font-semibold">{selectedField}</span>. Our moderators will verify and update this listing.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="report-field-select" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Which field is wrong?
              </label>

              {/* Quick Field Selector Chips */}
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Field to report">
                {REPORT_FIELD_OPTIONS.map((option) => {
                  const isSelected = selectedField === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedField(option.id)}
                      className={`px-3 py-2 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer border ${
                        isSelected
                          ? 'bg-purple-600/25 border-purple-400 text-white'
                          : 'bg-[#161d30] border-neutral-800 text-neutral-300 hover:bg-[#1c253d] hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <select
                id="report-field-select"
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="sr-only"
                aria-label="Select field to report"
              >
                {REPORT_FIELD_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-neutral-400">{selectedOption.hint}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="report-description" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Correction Note
              </label>
              <textarea
                id="report-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Share the correct ${selectedField.toLowerCase()} (e.g., official OTT URL, episode count, or language)...`}
                className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-purple-500 rounded-2xl p-3 text-xs text-white placeholder-neutral-500 outline-none resize-none"
              />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Sent directly to the Admin moderation queue for verification.</span>
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
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : 'Submit Correction'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
};
