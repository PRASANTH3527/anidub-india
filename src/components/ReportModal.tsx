import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Send, AlertCircle } from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';
import { AniDubLogo } from './AniDubLogo';
import { Button } from './ui/Button';

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
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#0B0A10]/85 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-heading"
        className="relative w-full max-w-md bg-[#12141E] border border-[#292B39] rounded-2xl p-5 sm:p-6 shadow-2xl z-10 text-[#F4F3FA] font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#292B39]">
          <div className="flex items-center gap-3 min-w-0">
            <AniDubLogo variant="horizontal" size="sm" className="shrink-0" />
            <div className="min-w-0">
              <h2 id="report-modal-heading" className="font-heading font-black text-[#F4F3FA] text-base sm:text-lg tracking-tight">
                Report Wrong Info
              </h2>
              <p className="text-[#A1A5B5] text-xs truncate max-w-[230px]">
                {animeTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report modal"
            className="w-10 h-10 rounded-xl bg-[#191C29] hover:bg-[#292B39] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-150 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#34D399]/15 border border-[#34D399]/40 flex items-center justify-center text-[#34D399]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-black text-lg text-[#F4F3FA]">Correction Sent to Admin Queue</h3>
            <p className="text-[#A1A5B5] text-xs max-w-xs mx-auto">
              Thank you for flagging <span className="text-[#F4F3FA] font-semibold">{selectedField}</span>. Our moderators will verify and update this listing.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#F87171]" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="report-field-select" className="text-xs font-bold text-[#F4F3FA] uppercase tracking-wider block">
                Issue Type (Specific Field)
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
                      className={`min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-bold transition-colors duration-150 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#B49AF8]/20 border-[#B49AF8] text-[#F4F3FA]'
                          : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
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

              <p className="text-[11px] text-[#A1A5B5]">{selectedOption.hint}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="report-description" className="text-xs font-bold text-[#F4F3FA] uppercase tracking-wider block">
                Description
              </label>
              <textarea
                id="report-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Share the correct ${selectedField.toLowerCase()} (e.g., official OTT URL, episode count, or language)...`}
                className="w-full bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-xl p-3 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none resize-none transition-colors duration-150"
              />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#191C29] border border-[#292B39] text-[11px] text-[#A1A5B5]">
              <AlertTriangle className="w-4 h-4 text-[#F9C876] shrink-0" />
              <span>Sent directly to the Admin moderation queue for verification.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                {isSubmitting ? 'Sending...' : 'Submit Correction'}
              </Button>
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
