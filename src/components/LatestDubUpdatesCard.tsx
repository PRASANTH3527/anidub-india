import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw, Sparkles, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cloudflareApi, type DubUpdateRecord } from '../services/cloudflareApi';
import { useLanguage } from '../context/LanguageContext';
import { formatLocaleDate, type SupportedLanguageCode } from '../i18n/languageRegistry';

interface LatestDubUpdatesCardProps {
  onSelectAnime?: (animeId: number | string) => void;
  limit?: number;
  className?: string;
}

const UPDATE_TYPE_LABELS: Record<string, { label: string; badgeClass: string }> = {
  dub_language: {
    label: 'Dub Languages',
    badgeClass: 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/30',
  },
  episode_update: {
    label: 'Episodes',
    badgeClass: 'bg-emerald-500/15 text-[#34D399] border-emerald-500/30',
  },
  platform_update: {
    label: 'OTT Link',
    badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  },
  status_update: {
    label: 'Status',
    badgeClass: 'bg-amber-500/15 text-[#FBBF24] border-amber-500/30',
  },
};

function formatUpdateTime(raw: string, locale: SupportedLanguageCode): string {
  if (!raw) return 'Recently';
  const parsed = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  const diffMs = Date.now() - parsed.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatLocaleDate(parsed, locale, { month: 'short', day: 'numeric' });
}

export const LatestDubUpdatesCard: React.FC<LatestDubUpdatesCardProps> = ({
  onSelectAnime,
  limit = 6,
  className = '',
}) => {
  const { t } = useTranslation(['explore', 'common']);
  const { language } = useLanguage();
  const [updates, setUpdates] = useState<DubUpdateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUpdates = async () => {
    setLoading(true);
    try {
      const rows = await cloudflareApi.fetchDubUpdates(limit);
      setUpdates(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUpdates();
  }, [limit]);

  if (!loading && updates.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={t('explore:latestUpdates.title', 'Latest Dub Updates')}
      className={`rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight truncate">
              {t('explore:latestUpdates.title', 'Latest Dub Updates')}
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {t('explore:latestUpdates.subtitle', 'Verified catalog changes logged by editors')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadUpdates}
          disabled={loading}
          aria-label={t('explore:latestUpdates.refresh', 'Refresh latest dub updates')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('common:retry', 'Refresh')}</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {updates.map((item) => {
            const meta = UPDATE_TYPE_LABELS[item.update_type] || {
              label: 'Updated',
              badgeClass: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
            };
            const clickable = Boolean(item.anime_id && onSelectAnime);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (item.anime_id && onSelectAnime) onSelectAnime(item.anime_id);
                }}
                className={`text-left p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors flex flex-col justify-between gap-1.5 ${
                  clickable
                    ? 'hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)]/40 cursor-pointer group'
                    : 'cursor-default'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] line-clamp-1 group-hover:text-[var(--accent-hover)] transition-colors">
                    {item.anime_title}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">{item.summary}</p>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-0.5">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="w-3 h-3" />
                    {formatUpdateTime(item.created_at, language)}
                  </span>
                  {clickable && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--accent-primary)] font-semibold">
                      Details
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
