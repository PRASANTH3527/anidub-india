import React from 'react';
import { Layers, ArrowRight, Compass } from 'lucide-react';
import { OptimizedImage } from '../OptimizedImage';
import type { FranchiseLinkItem } from '../../utils/animeDetailsV2';
import type { FranchiseEntry } from '../AnimeDetailPage';

export interface AnimeUniverseSectionProps {
  d1Entries: FranchiseLinkItem[];
  fallbackEntries: FranchiseEntry[];
  currentAnimeId: string;
  allAnime: any[];
  onSelectAnime?: (anime: any) => void;
  titleLabel?: string;
  'data-testid'?: string;
}

interface UnifiedUniverseCard {
  id: string;
  title: string;
  watchOrder: number;
  relationLabel: string;
  releaseYear?: number;
  poster?: string;
  note?: string | null;
  isCurrent: boolean;
  slug?: string;
  languages?: string[];
}

/**
 * Anime Universe & Smart Watch Order rail.
 * Prefers verified D1 anime_franchise_links joined with published catalog records,
 * gracefully falls back to verified catalog-matched franchise entries, and hides
 * completely when no verified franchise relationship exists.
 */
export const AnimeUniverseSection: React.FC<AnimeUniverseSectionProps> = ({
  d1Entries,
  fallbackEntries,
  currentAnimeId,
  allAnime,
  onSelectAnime,
  titleLabel = 'Anime Universe & Watch Order',
  'data-testid': testId = 'franchise-watch-order',
}) => {
  const unifiedEntries: UnifiedUniverseCard[] = React.useMemo(() => {
    if (Array.isArray(d1Entries) && d1Entries.length > 0) {
      return d1Entries.map((entry, idx) => ({
        id: String(entry.anime_id),
        title: entry.title,
        watchOrder: entry.watch_order || idx + 1,
        relationLabel: entry.relation_label || 'Main Story',
        releaseYear: entry.release_year,
        poster: entry.poster,
        note: entry.note,
        isCurrent: Boolean(entry.is_current) || String(entry.anime_id) === String(currentAnimeId),
        slug: entry.slug,
        languages: entry.languages,
      }));
    }

    if (Array.isArray(fallbackEntries) && fallbackEntries.length > 1) {
      return fallbackEntries.map((entry, idx) => ({
        id: String(entry.id),
        title: entry.title,
        watchOrder: entry.seasonNumber || idx + 1,
        relationLabel: entry.relationType,
        releaseYear: entry.releaseYear,
        poster: entry.poster,
        note: null,
        isCurrent: String(entry.id) === String(currentAnimeId),
      }));
    }

    return [];
  }, [d1Entries, fallbackEntries, currentAnimeId]);

  if (unifiedEntries.length === 0) return null;

  const currentIdx = unifiedEntries.findIndex((e) => e.isCurrent);
  const nextEntry =
    currentIdx >= 0 && currentIdx + 1 < unifiedEntries.length
      ? unifiedEntries[currentIdx + 1]
      : null;

  const resolveClickableTarget = (entry: UnifiedUniverseCard) => {
    const fromCatalog = allAnime.find((a) => String(a.id) === String(entry.id));
    if (fromCatalog) return fromCatalog;
    if (d1Entries.length > 0) {
      return {
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        poster: entry.poster,
        releaseYear: entry.releaseYear,
        languages: entry.languages || [],
      };
    }
    return null;
  };

  return (
    <section
      data-testid={testId}
      className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-[var(--text-primary)] truncate">
              {titleLabel}
            </h2>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Verified chronological watch sequence
            </p>
          </div>
        </div>

        <span className="text-[12px] font-semibold text-[var(--text-secondary)] tabular-nums shrink-0">
          {unifiedEntries.length} {unifiedEntries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Smart "Watch Next" guidance bar when a verified next title follows the current entry */}
      {nextEntry && onSelectAnime && (
        <div
          data-testid="smart-watch-next-banner"
          className="mb-3.5 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="text-[12px] font-semibold text-[var(--text-secondary)] shrink-0">
              Watch Next:
            </span>
            <span className="text-[13px] font-bold text-[var(--text-primary)] truncate">
              #{nextEntry.watchOrder} {nextEntry.title}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const target = resolveClickableTarget(nextEntry);
              if (target) onSelectAnime(target);
            }}
            className="min-h-[44px] px-3 rounded-[9px] bg-[var(--accent-soft)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-on-primary)] border border-[var(--accent-primary)]/30 text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
          >
            <span>Open Next</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {unifiedEntries.map((entry, idx) => {
          const targetAnime = resolveClickableTarget(entry);
          const isStartHere = idx === 0 && !entry.isCurrent;
          const isWatchNext = nextEntry && entry.id === nextEntry.id;
          const isClickable = !entry.isCurrent && Boolean(targetAnime) && Boolean(onSelectAnime);

          const statusTag = entry.isCurrent
            ? 'Current'
            : isWatchNext
              ? 'Watch Next'
              : isStartHere
                ? 'Start Here'
                : entry.relationLabel;

          return (
            <button
              key={`${entry.id}-${entry.watchOrder}`}
              type="button"
              data-testid={`universe-entry-${entry.watchOrder}`}
              disabled={!isClickable}
              onClick={() => {
                if (isClickable && targetAnime && onSelectAnime) {
                  onSelectAnime(targetAnime);
                }
              }}
              className={`w-[152px] sm:w-[166px] shrink-0 text-left rounded-[12px] border p-2.5 flex flex-col transition-colors ${
                entry.isCurrent
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/50 cursor-default'
                  : isClickable
                    ? 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 cursor-pointer'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] opacity-90 cursor-default'
              }`}
            >
              <div className="relative aspect-[2/3] w-full rounded-[8px] overflow-hidden bg-[var(--bg-surface)] mb-2">
                {entry.poster ? (
                  <OptimizedImage
                    src={entry.poster}
                    alt={entry.title}
                    width={166}
                    height={249}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    aspectRatio="portrait"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[13px] font-bold tabular-nums">
                    #{entry.watchOrder}
                  </div>
                )}

                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-[6px] bg-black/80 text-white text-[10px] font-extrabold tabular-nums">
                  #{entry.watchOrder}
                </span>

                <span
                  className={`absolute bottom-1.5 left-1.5 right-1.5 px-1.5 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wide truncate text-center ${
                    entry.isCurrent
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)]'
                      : isWatchNext
                        ? 'bg-[#34D399] text-[#052E16]'
                        : 'bg-black/75 text-white'
                  }`}
                >
                  {statusTag}
                </span>
              </div>

              <div className="text-[13px] font-bold text-[var(--text-primary)] line-clamp-2 leading-snug">
                {entry.title}
              </div>

              <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-[var(--text-secondary)]">
                <span className="truncate">{entry.relationLabel}</span>
                {entry.releaseYear ? (
                  <span className="tabular-nums shrink-0">{entry.releaseYear}</span>
                ) : null}
              </div>

              {entry.note && (
                <p className="mt-1.5 text-[11px] text-[var(--text-muted)] line-clamp-2 leading-snug">
                  {entry.note}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
