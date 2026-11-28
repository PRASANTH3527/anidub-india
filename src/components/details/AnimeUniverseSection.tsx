import React from 'react';
import { Layers, ArrowRight, ChevronRight, Compass } from 'lucide-react';
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
 * Public Anime Details "Watch Order" Timeline Card.
 * Prefers verified D1 anime_franchise_links joined with approved/published catalog records,
 * gracefully falls back to verified catalog-matched franchise entries, and renders NOTHING
 * when fewer than 2 entries exist.
 */
export const AnimeUniverseSection: React.FC<AnimeUniverseSectionProps> = ({
  d1Entries,
  fallbackEntries,
  currentAnimeId,
  allAnime,
  onSelectAnime,
  titleLabel = 'Watch Order',
  'data-testid': testId = 'franchise-watch-order',
}) => {
  const unifiedEntries: UnifiedUniverseCard[] = React.useMemo(() => {
    if (Array.isArray(d1Entries) && d1Entries.length >= 2) {
      return d1Entries.map((entry, idx) => ({
        id: String(entry.anime_id),
        title: entry.title,
        watchOrder: entry.watch_order || idx + 1,
        relationLabel: entry.relation_label || 'Main Series',
        releaseYear: entry.release_year,
        poster: entry.poster,
        note: entry.note,
        isCurrent: Boolean(entry.is_current) || String(entry.anime_id) === String(currentAnimeId),
        slug: entry.slug,
        languages: entry.languages,
      }));
    }

    if (Array.isArray(fallbackEntries) && fallbackEntries.length >= 2) {
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

  // Hide completely when 0 or 1 entries exist
  if (unifiedEntries.length < 2) return null;

  const currentIdx = unifiedEntries.findIndex((e) => e.isCurrent);
  const nextEntry =
    currentIdx >= 0 && currentIdx + 1 < unifiedEntries.length
      ? unifiedEntries[currentIdx + 1]
      : null;

  const resolveClickableTarget = (entry: UnifiedUniverseCard) => {
    const fromCatalog = allAnime.find((a) => String(a.id) === String(entry.id));
    if (fromCatalog) return fromCatalog;
    if (d1Entries.length >= 2) {
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
      className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
          </div>
          <h2 className="text-[16px] font-bold text-[var(--text-primary)] truncate">
            {titleLabel}
          </h2>
        </div>

        <span className="text-[12px] font-semibold text-[var(--text-secondary)] tabular-nums shrink-0">
          {unifiedEntries.length} entries
        </span>
      </div>

      {/* Smart "Watch Next" guidance bar when a verified next title follows the current entry */}
      {nextEntry && onSelectAnime && (
        <div
          data-testid="smart-watch-next-banner"
          className="mb-3 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="text-[12px] font-semibold text-[var(--text-secondary)] shrink-0">
              Next:
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
            className="min-h-[36px] px-3 rounded-[9px] bg-[var(--accent-soft)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-on-primary)] border border-[var(--accent-primary)]/30 text-[12px] font-bold inline-flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
          >
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Compact Vertical Watch Order Timeline (0px horizontal overflow on mobile & all 12 themes) */}
      <ol className="space-y-2">
        {unifiedEntries.map((entry, idx) => {
          const targetAnime = resolveClickableTarget(entry);
          const isClickable = !entry.isCurrent && Boolean(targetAnime) && Boolean(onSelectAnime);

          return (
            <li key={`${entry.id}-${entry.watchOrder}`}>
              <button
                type="button"
                data-testid={`universe-entry-${entry.watchOrder}`}
                disabled={!isClickable}
                onClick={() => {
                  if (isClickable && targetAnime && onSelectAnime) {
                    onSelectAnime(targetAnime);
                  }
                }}
                className={`w-full text-left rounded-[12px] border p-2.5 flex items-center gap-2.5 transition-colors ${
                  entry.isCurrent
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/60 cursor-default'
                    : isClickable
                      ? 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 cursor-pointer'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] opacity-90 cursor-default'
                }`}
              >
                {/* Order Number */}
                <span
                  className={`w-8 h-8 rounded-[8px] text-[12px] font-extrabold flex items-center justify-center shrink-0 tabular-nums ${
                    entry.isCurrent
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)]'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]'
                  }`}
                >
                  #{entry.watchOrder || idx + 1}
                </span>

                {/* Poster Thumbnail */}
                <div className="w-10 h-14 rounded-[8px] overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0 flex items-center justify-center">
                  {entry.poster ? (
                    <OptimizedImage
                      src={entry.poster}
                      alt={entry.title}
                      width={40}
                      height={56}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      aspectRatio="portrait"
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-[var(--text-muted)] tabular-nums">
                      #{entry.watchOrder}
                    </span>
                  )}
                </div>

                {/* Title, Relation Badge & Optional Note */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] sm:text-[14px] font-bold text-[var(--text-primary)] truncate">
                      {entry.title}
                    </span>
                    {entry.isCurrent && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-[6px] bg-[var(--accent-primary)] text-[var(--accent-on-primary)] text-[10px] font-bold uppercase tracking-wide">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    <span className="px-1.5 py-0.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-semibold text-[var(--text-secondary)]">
                      {entry.relationLabel}
                    </span>
                    {entry.releaseYear ? (
                      <span className="tabular-nums text-[var(--text-muted)]">
                        {entry.releaseYear}
                      </span>
                    ) : null}
                  </div>

                  {entry.note && (
                    <p className="mt-1 text-[11px] text-[var(--text-muted)] line-clamp-2 leading-snug">
                      {entry.note}
                    </p>
                  )}
                </div>

                {isClickable && (
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
