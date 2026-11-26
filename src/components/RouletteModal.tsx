import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Dices, Play, Star, RefreshCw, Bookmark } from 'lucide-react';
import { Anime } from './CatalogView';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EclipseState';
import { extractCompactLanguageCodes, normalizeLanguageName } from '../utils/languages';
import { normalizeCanonicalOttList } from '../utils/ottHub';

export interface RouletteModalProps {
  animeList: Anime[];
  onClose: () => void;
  onSelectAnime: (anime: Anime) => void;
  watchlist?: number[];
  onToggleWatchlist?: (animeId: number) => void;
}

const ROULETTE_LANG_FILTERS = [
  { id: 'All', label: 'All Dubs' },
  { id: 'Tamil', label: 'Tamil Dub Only' },
  { id: 'Hindi', label: 'Hindi' },
  { id: 'Telugu', label: 'Telugu' },
  { id: 'Malayalam', label: 'Malayalam' },
] as const;

export const RouletteModal: React.FC<RouletteModalProps> = ({
  animeList,
  onClose,
  onSelectAnime,
  watchlist = [],
  onToggleWatchlist,
}) => {
  const [selectedLangFilter, setSelectedLangFilter] = useState<string>('All');
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredPool = useMemo(() => {
    const valid = Array.isArray(animeList) ? animeList : [];
    if (selectedLangFilter === 'All') return valid;
    const targetNorm = normalizeLanguageName(selectedLangFilter).toLowerCase();
    return valid.filter((anime) => {
      const raw = String(anime.languages || '').toLowerCase();
      return raw.includes(targetNorm);
    });
  }, [animeList, selectedLangFilter]);

  const rollRoulette = useCallback(
    (poolOverride?: Anime[]) => {
      const pool = poolOverride ?? filteredPool;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (pool.length === 0) {
        setSelectedAnime(null);
        setIsSpinning(false);
        return;
      }
      if (pool.length === 1) {
        setSelectedAnime(pool[0]);
        setIsSpinning(false);
        return;
      }

      setIsSpinning(true);
      let counter = 0;
      intervalRef.current = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * pool.length);
        setSelectedAnime(pool[randomIndex]);
        counter++;
        if (counter >= 10) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsSpinning(false);
        }
      }, 75);
    },
    [filteredPool]
  );

  useEffect(() => {
    rollRoulette(filteredPool);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [filteredPool, rollRoulette]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isSaved = selectedAnime ? watchlist.includes(selectedAnime.id) : false;
  const ratingNum = selectedAnime ? Number(selectedAnime.rating) : 0;
  const hasVerifiedRating = Number.isFinite(ratingNum) && ratingNum > 0;
  const langCodes = selectedAnime ? extractCompactLanguageCodes(selectedAnime.languages) : [];
  const canonicalOtts = selectedAnime
    ? normalizeCanonicalOttList(selectedAnime as unknown as Record<string, unknown>)
    : [];
  const honestPlatform = canonicalOtts.length > 0 ? canonicalOtts[0] : 'Not verified';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Random Anime Picker"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#0B0A10]/85 font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#12141E] border-t sm:border border-[#292B39] rounded-t-2xl sm:rounded-[12px] p-4 sm:p-6 shadow-2xl text-[#F4F3FA] space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#F4F3FA] flex items-center gap-2">
              <Dices className={`w-5 h-5 text-[#B49AF8] ${isSpinning ? 'animate-spin' : ''}`} />
              <span>Random Anime</span>
            </h2>
            <p className="text-xs text-[#A1A5B5] mt-0.5">
              Roll a verified Indian dubbed anime from the catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Random Anime"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[#191C29] hover:border-[#B49AF8]/60 border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-180 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Language Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {ROULETTE_LANG_FILTERS.map((opt) => {
            const active = selectedLangFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedLangFilter(opt.id)}
                className={`min-h-[40px] px-3 py-1.5 rounded-[10px] text-xs font-bold border whitespace-nowrap transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                  active
                    ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                    : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Poster-First 2:3 Result Card or EmptyState */}
        {filteredPool.length === 0 ? (
          <EmptyState
            icon={<Dices className="w-5 h-5" />}
            title={`No ${selectedLangFilter} dub titles available`}
            description="Try switching back to All Dubs to roll from the complete verified catalog."
            actionLabel="Show All Dubs"
            onAction={() => setSelectedLangFilter('All')}
            className="bg-[#191C29]"
          />
        ) : selectedAnime ? (
          <div className="space-y-4">
            <div
              className={`rounded-[12px] bg-[#191C29] border p-3.5 flex gap-3.5 transition-colors duration-180 ${
                isSpinning ? 'border-[#F9C876]' : 'border-[#292B39]'
              }`}
            >
              {/* Strict 2:3 Poster */}
              <div className="w-28 sm:w-32 aspect-[2/3] rounded-[10px] overflow-hidden bg-[#12141E] border border-[#292B39] shrink-0 relative">
                <img
                  src={selectedAnime.cover_image || '/logo.png'}
                  alt={selectedAnime.title}
                  width={128}
                  height={192}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = '/logo.png';
                  }}
                  className="w-full h-full object-cover"
                />
                {hasVerifiedRating && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#0B0A10]/90 text-[#F9C876] text-[10px] font-bold border border-[#292B39] inline-flex items-center gap-0.5 tabular-nums">
                    <Star className="w-3 h-3 fill-[#F9C876]" />
                    <span>{ratingNum.toFixed(1)}</span>
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                <div className="space-y-1.5">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-[#12141E] border border-[#292B39] text-[11px] font-semibold text-[#A1A5B5] truncate max-w-full">
                    {honestPlatform}
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#F4F3FA] line-clamp-2 leading-snug">
                    {selectedAnime.title}
                  </h3>
                  {selectedAnime.genres && (
                    <p className="text-[11px] text-[#A1A5B5] line-clamp-1">{selectedAnime.genres}</p>
                  )}
                  {selectedAnime.synopsis && (
                    <p className="text-xs text-[#A1A5B5] line-clamp-2 leading-relaxed">
                      {selectedAnime.synopsis}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {langCodes.length > 0 ? (
                    langCodes.slice(0, 4).map((code) => (
                      <span
                        key={`roulette_lang_${selectedAnime.id}_${code}`}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#12141E] border border-[#292B39] text-[#CBB6FF]"
                      >
                        {code}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-[#A1A5B5]">Dub languages not verified</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => rollRoulette()}
                disabled={isSpinning}
                leftIcon={<RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />}
                className="flex-1"
              >
                {isSpinning ? 'Rolling…' : 'Roll Random Anime'}
              </Button>

              <div className="flex items-center gap-2">
                {onToggleWatchlist && (
                  <button
                    type="button"
                    onClick={() => onToggleWatchlist(selectedAnime.id)}
                    className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] flex items-center justify-center transition-colors duration-180 cursor-pointer border ${
                      isSaved
                        ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                        : 'bg-[#191C29] hover:border-[#B49AF8]/60 text-[#A1A5B5] hover:text-[#F4F3FA] border-[#292B39]'
                    }`}
                    aria-label={isSaved ? 'Remove from Library' : 'Save to Library'}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    onSelectAnime(selectedAnime);
                    onClose();
                  }}
                  rightIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                  className="flex-1 sm:flex-initial"
                >
                  View Details
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
