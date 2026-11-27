import React, { useEffect, useState } from 'react';
import { Play, ExternalLink, Film } from 'lucide-react';
import type { OfficialTrailerInfo } from '../../utils/animeDetailsV2';

export interface OfficialTrailerCardProps {
  trailer: OfficialTrailerInfo | null;
  animeTitle: string;
  fallbackPoster?: string;
}

/**
 * Lazy-loaded official YouTube trailer section.
 * Renders a lightweight 16:9 thumbnail preview first with zero iframe network overhead,
 * mounting the privacy-enhanced youtube-nocookie.com iframe only after the user clicks Play.
 * Returns null completely when no verified official YouTube trailer exists for the title.
 */
export const OfficialTrailerCard: React.FC<OfficialTrailerCardProps> = ({
  trailer,
  animeTitle,
  fallbackPoster,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>(trailer?.thumbnailUrl || '');

  useEffect(() => {
    setIsPlaying(false);
    setImgSrc(trailer?.thumbnailUrl || '');
  }, [trailer?.videoId, trailer?.thumbnailUrl]);

  if (!trailer) return null;

  return (
    <section
      data-testid="official-trailer-section"
      className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
            <Film className="w-4 h-4 text-[var(--accent-primary)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-[var(--text-primary)] truncate">
              Official Trailer
            </h2>
            <p className="text-[12px] text-[var(--text-secondary)] truncate">
              Loads only when you press play
            </p>
          </div>
        </div>

        <a
          href={trailer.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors shrink-0"
        >
          <span>Watch on YouTube</span>
          <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
        </a>
      </div>

      <div className="relative w-full aspect-video rounded-[12px] overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
        {isPlaying ? (
          <iframe
            data-testid="trailer-iframe"
            src={trailer.embedUrl}
            title={`${animeTitle} Official Trailer`}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            data-testid="trailer-play-button"
            onClick={() => setIsPlaying(true)}
            aria-label={`Play official trailer for ${animeTitle}`}
            className="group relative w-full h-full flex items-center justify-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer"
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={`${animeTitle} trailer thumbnail`}
                width={640}
                height={360}
                loading="lazy"
                onError={() => {
                  if (fallbackPoster && imgSrc !== fallbackPoster) {
                    setImgSrc(fallbackPoster);
                  } else {
                    setImgSrc('');
                  }
                }}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="w-full h-full bg-[var(--bg-elevated)]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/15" />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4 text-center">
              <span className="w-14 h-14 rounded-full bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </span>
              <span className="px-3 py-1 rounded-[8px] bg-black/75 text-white text-[12px] font-semibold tracking-wide">
                Play Official Trailer
              </span>
            </div>
          </button>
        )}
      </div>
    </section>
  );
};
