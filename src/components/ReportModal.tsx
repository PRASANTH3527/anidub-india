import React, { useState } from 'react';
import { X, AlertTriangle, Send, Link2 } from 'lucide-react';
import { Anime } from '../types';
import { cloudflareApi } from '../services/cloudflareApi';
import { useTranslation } from 'react-i18next';

export interface ReportModalProps {
  anime?: Anime | any | null;
  isOpen?: boolean;
  animeId?: number | string;
  animeTitle?: string;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

const ISSUE_CATEGORIES = [
  'OTT Link',
  'Dub Language',
  'Episode Count',
  'Release Schedule',
  'Title / Poster',
  'Other',
] as const;

export const ReportModal: React.FC<ReportModalProps> = ({
  anime: animeProp,
  isOpen = true,
  animeId,
  animeTitle,
  onClose,
  onSubmitSuccess,
}) => {
  const { t } = useTranslation(['forms', 'common']);
  const [issueType, setIssueType] = useState<string>('OTT Link');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const anime = animeProp
    ? { id: String(animeProp.id ?? animeId ?? '0'), title: String(animeProp.title || animeTitle || 'Anime') }
    : animeId !== undefined || animeTitle
      ? { id: String(animeId ?? '0'), title: String(animeTitle || 'Anime') }
      : null;

  if (!anime) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setIsSubmitting(true);

    const fullDescription = sourceUrl.trim()
      ? `${description.trim()} (Source: ${sourceUrl.trim()})`
      : description.trim();

    try {
      await cloudflareApi.reportIssue({
        anime_id: anime.id,
        anime_title: anime.title,
        issue_type: issueType,
        description: fullDescription,
      });
    } catch (error) {
      console.error('Failed to report issue to Cloudflare:', error);
    }

    const reports = JSON.parse(localStorage.getItem('anime_reports') || '[]');
    reports.push({
      id: Date.now().toString(),
      animeId: anime.id,
      animeTitle: anime.title,
      issueType,
      description: fullDescription,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('anime_reports', JSON.stringify(reports));

    setIsSubmitting(false);
    onSubmitSuccess?.();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Report incorrect info for ${anime.title}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-180"
    >
      <div className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl text-[var(--text-primary)]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[#F9C876] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{t('forms:report.title', 'Report Incorrect Info')}</h2>
              <p className="text-[12px] text-[var(--text-secondary)] truncate max-w-[230px]">{anime.title}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report modal"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Chip Grid (Issue Type) */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              {t('forms:report.reasonLabel', 'Issue Type')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ISSUE_CATEGORIES.map((cat) => {
                const active = issueType === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setIssueType(cat)}
                    className={`min-h-[44px] px-3 rounded-[10px] text-[12px] font-semibold border transition-colors ${
                      active
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Correct Information (Description) */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Description / Correct information
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('forms:report.detailsPlaceholder', 'Describe the correction or verified source...')}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px] p-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
            />
          </div>

          {/* Optional Official Source URL */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Official source URL (Optional)
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.crunchyroll.com/..."
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !description.trim()}
            className="w-full min-h-[44px] sm:min-h-[48px] px-5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-on-primary)] font-bold text-[14px] rounded-[12px] transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? t('forms:submitDub.submitting', 'Submitting...') : t('forms:report.submitCta', 'Submit correction')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
