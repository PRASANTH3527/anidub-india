import React from 'react';
import { FileText, X, CheckCircle2, Download } from 'lucide-react';

export interface AdminCsvHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadSampleCSV: () => void;
  onTriggerCsvUpload: () => void;
}

export const AdminCsvHelpModal: React.FC<AdminCsvHelpModalProps> = ({
  isOpen,
  onClose,
  onDownloadSampleCSV,
  onTriggerCsvUpload,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-[var(--text-primary)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[var(--text-primary)]">
                CSV Import Format Guide
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Supported columns for bulk anime catalog import into Cloudflare D1
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
            <h4 className="font-bold text-[var(--accent-primary)] uppercase tracking-wider text-[11px]">
              1. Required &amp; Optional Columns
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Your CSV file must have a header row on line 1. Only{' '}
              <strong className="text-[var(--text-primary)]">Title</strong> is strictly required. Missing dub languages remain{' '}
              <strong className="text-[var(--text-primary)]">Unverified</strong> until explicitly provided.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              {[
                { col: 'Title *', desc: 'Anime name (Required)' },
                { col: 'Poster URL', desc: 'Direct image link (.jpg/.png)' },
                { col: 'Synopsis', desc: 'Story description' },
                { col: 'Rating', desc: 'Score (e.g. 8.7)' },
                { col: 'Release Year', desc: '4-digit year (e.g. 2024)' },
                { col: 'Status', desc: 'Airing / Completed / Upcoming' },
                { col: 'Type', desc: 'TV Series / Movie / OVA' },
                { col: 'Studio', desc: 'e.g. MAPPA, Ufotable' },
                { col: 'Genres', desc: 'Pipe or comma separated' },
                { col: 'Languages', desc: 'Tamil | Hindi | Telugu (or empty)' },
                { col: 'Platforms', desc: 'Crunchyroll | Netflix' },
                { col: 'Episodes', desc: '12 or 12 | 24 per season' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                >
                  <div className="font-mono font-bold text-[var(--text-primary)]">{item.col}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
            <h4 className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> 2. Multi-Value Separator Tip
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Use the pipe symbol{' '}
              <code className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono">
                |
              </code>{' '}
              to separate multiple languages, genres, or platforms inside a single cell (e.g.{' '}
              <code className="text-[var(--text-primary)] font-mono">Tamil | Hindi | Telugu</code>).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onDownloadSampleCSV}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" /> Download Sample CSV Template
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onTriggerCsvUpload();
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold transition-all"
            >
              Choose CSV File Now
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
