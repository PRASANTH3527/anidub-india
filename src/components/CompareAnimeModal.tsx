import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ExternalLink,
  Globe2,
  Scale,
  Search,
  Star,
  Tv,
  X,
  CheckCircle2,
  Film,
  Activity,
} from 'lucide-react';
import { buildAnimeComparison, type ComparableAnimeLike } from '../utils/compareAnime';
import { matchesAnimeSearchQuery } from '../utils/searchFilterState';
import { proxyUrl } from '../utils/imgbb';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EclipseState';

export interface CompareAnimeModalProps {
  catalogList: ComparableAnimeLike[];
  initialLeftAnime?: ComparableAnimeLike | null;
  onClose?: () => void;
  onSelectAnime?: (anime: any) => void;
  asModal?: boolean;
}

export const CompareAnimeModal: React.FC<CompareAnimeModalProps> = ({
  catalogList,
  initialLeftAnime = null,
  onClose,
  onSelectAnime,
  asModal = true,
}) => {
  const safeList = useMemo(
    () => (Array.isArray(catalogList) ? catalogList.filter((a) => a && a.title) : []),
    [catalogList]
  );

  const defaultLeftId = useMemo(() => {
    if (initialLeftAnime?.id) return Number(initialLeftAnime.id);
    return safeList[0] ? Number(safeList[0].id) : 0;
  }, [initialLeftAnime, safeList]);

  const defaultRightId = useMemo(() => {
    const second = safeList.find((a) => Number(a.id) !== defaultLeftId);
    return second ? Number(second.id) : defaultLeftId;
  }, [safeList, defaultLeftId]);

  const [leftId, setLeftId] = useState<number>(defaultLeftId);
  const [rightId, setRightId] = useState<number>(defaultRightId);
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');

  useEffect(() => {
    if (!leftId && defaultLeftId) setLeftId(defaultLeftId);
    if (!rightId && defaultRightId) setRightId(defaultRightId);
  }, [leftId, rightId, defaultLeftId, defaultRightId]);

  useEffect(() => {
    if (!asModal || !onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [asModal, onClose]);

  const leftAnime = useMemo(() => {
    if (initialLeftAnime && Number(initialLeftAnime.id) === leftId) return initialLeftAnime;
    return safeList.find((a) => Number(a.id) === leftId) || safeList[0] || null;
  }, [initialLeftAnime, leftId, safeList]);

  const rightAnime = useMemo(() => {
    return safeList.find((a) => Number(a.id) === rightId) || safeList[1] || safeList[0] || null;
  }, [rightId, safeList]);

  const filteredLeftOptions = useMemo(() => {
    const matches = leftSearch.trim()
      ? safeList.filter((a) => matchesAnimeSearchQuery(a as any, leftSearch))
      : safeList;
    return matches.slice(0, 60);
  }, [safeList, leftSearch]);

  const filteredRightOptions = useMemo(() => {
    const matches = rightSearch.trim()
      ? safeList.filter((a) => matchesAnimeSearchQuery(a as any, rightSearch))
      : safeList;
    return matches.slice(0, 60);
  }, [safeList, rightSearch]);

  const comparison = useMemo(() => {
    if (!leftAnime || !rightAnime) return null;
    return buildAnimeComparison(leftAnime, rightAnime);
  }, [leftAnime, rightAnime]);

  const handleSwap = () => {
    setLeftId(rightId);
    setRightId(leftId);
  };

  const content = (
    <div
      role={asModal ? 'dialog' : undefined}
      aria-modal={asModal ? true : undefined}
      aria-labelledby="compare-anime-heading"
      onClick={(e) => e.stopPropagation()}
      className={`w-full overflow-x-clip ${
        asModal
          ? 'max-w-4xl max-h-[90vh] overflow-y-auto rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-6 shadow-2xl'
          : 'max-w-5xl mx-auto rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-6'
      } text-[#F4F3FA] font-sans space-y-5`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#292B39] pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[12px] bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#B49AF8] shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 id="compare-anime-heading" className="text-lg sm:text-xl font-extrabold text-[#F4F3FA] tracking-tight truncate">
              Compare Anime (A vs B)
            </h2>
            <p className="text-xs text-[#A1A5B5]">
              Verified Indian dub languages, official OTT platforms, status, episodes, and ratings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleSwap}
            aria-label="Swap Anime A and Anime B"
            leftIcon={<ArrowLeftRight className="w-4 h-4 text-[#B49AF8]" />}
            className="text-xs"
          >
            <span className="hidden sm:inline">Swap</span>
          </Button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Compare Anime"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[#191C29] hover:border-[#B49AF8]/60 border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-180 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {safeList.length === 0 ? (
        <EmptyState
          icon={<Film className="w-5 h-5" />}
          title="No anime loaded to compare"
          description="Once the Indian dub catalog loads, pick any two titles to compare them side by side."
          className="bg-[#191C29]"
        />
      ) : (
        <>
          {/* Clean Select Anime A & Select Anime B Picker Slots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Anime A Picker */}
            <div className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5 space-y-2.5 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="compare-select-a" className="text-xs font-bold uppercase tracking-wider text-[#B49AF8]">
                  Select Anime A
                </label>
                {leftAnime && onSelectAnime && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      onSelectAnime(leftAnime);
                    }}
                    className="text-xs font-semibold text-[#B49AF8] hover:text-[#CBB6FF] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-[#A1A5B5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={leftSearch}
                  onChange={(e) => setLeftSearch(e.target.value)}
                  placeholder="Search Anime A..."
                  aria-label="Filter Anime A options"
                  className="w-full h-[44px] rounded-[12px] bg-[#12141E] border border-[#292B39] focus:border-[#B49AF8] pl-9 pr-3 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-180"
                />
              </div>
              <select
                id="compare-select-a"
                value={leftAnime ? Number(leftAnime.id) : ''}
                onChange={(e) => setLeftId(Number(e.target.value))}
                className="w-full h-[44px] rounded-[12px] bg-[#12141E] border border-[#292B39] focus:border-[#B49AF8] px-3 text-xs font-semibold text-[#F4F3FA] outline-none cursor-pointer"
              >
                {filteredLeftOptions.map((item) => (
                  <option key={`cmp_a_${item.id}`} value={Number(item.id)} className="bg-[#12141E] text-[#F4F3FA]">
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Anime B Picker */}
            <div className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5 space-y-2.5 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="compare-select-b" className="text-xs font-bold uppercase tracking-wider text-[#CBB6FF]">
                  Select Anime B
                </label>
                {rightAnime && onSelectAnime && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      onSelectAnime(rightAnime);
                    }}
                    className="text-xs font-semibold text-[#CBB6FF] hover:text-[#F4F3FA] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-[#A1A5B5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={rightSearch}
                  onChange={(e) => setRightSearch(e.target.value)}
                  placeholder="Search Anime B..."
                  aria-label="Filter Anime B options"
                  className="w-full h-[44px] rounded-[12px] bg-[#12141E] border border-[#292B39] focus:border-[#B49AF8] pl-9 pr-3 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-180"
                />
              </div>
              <select
                id="compare-select-b"
                value={rightAnime ? Number(rightAnime.id) : ''}
                onChange={(e) => setRightId(Number(e.target.value))}
                className="w-full h-[44px] rounded-[12px] bg-[#12141E] border border-[#292B39] focus:border-[#B49AF8] px-3 text-xs font-semibold text-[#F4F3FA] outline-none cursor-pointer"
              >
                {filteredRightOptions.map((item) => (
                  <option key={`cmp_b_${item.id}`} value={Number(item.id)} className="bg-[#12141E] text-[#F4F3FA]">
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Responsive Side-by-Side Comparison Grid */}
          {comparison && (
            <div className="space-y-4">
              {/* Poster & Core Identity Row */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {[
                  { side: comparison.left, accent: 'border-[#B49AF8]/40', winnerRating: comparison.ratingWinner === 'left' },
                  { side: comparison.right, accent: 'border-[#CBB6FF]/40', winnerRating: comparison.ratingWinner === 'right' },
                ].map(({ side, accent, winnerRating }, idx) => (
                  <div
                    key={`cmp_card_${idx}_${side.id}`}
                    className={`rounded-[12px] bg-[#191C29] border ${accent} p-3 flex flex-col sm:flex-row items-center sm:items-start gap-2.5 sm:gap-3 min-w-0`}
                  >
                    <div className="w-16 sm:w-20 aspect-[2/3] rounded-[10px] overflow-hidden border border-[#292B39] shrink-0 bg-[#12141E]">
                      <img
                        src={proxyUrl(side.coverImage)}
                        alt={side.title}
                        width={80}
                        height={120}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
                      <h3 className="text-xs sm:text-sm font-bold text-[#F4F3FA] line-clamp-2 leading-snug break-words">
                        {side.title}
                      </h3>
                      <p className="text-[11px] text-[#A1A5B5] truncate">
                        {side.type}{side.year ? ` • ${side.year}` : ''}
                      </p>
                      <div className="inline-flex items-center gap-1 text-xs font-bold tabular-nums">
                        <Star className="w-3.5 h-3.5 text-[#F9C876] fill-[#F9C876]" />
                        <span className={winnerRating ? 'text-[#F9C876]' : 'text-[#F4F3FA]'}>
                          {side.ratingLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Structured Comparison Rows */}
              <div className="rounded-[12px] border border-[#292B39] overflow-hidden divide-y divide-[#292B39] bg-[#191C29]/60">
                {/* Verified Indian Dub Languages */}
                <div className="p-3.5 sm:p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#F4F3FA] flex items-center gap-1.5">
                      <Globe2 className="w-4 h-4 text-[#B49AF8]" />
                      Verified Dub Languages
                    </span>
                    {comparison.sharedLanguages.length > 0 && (
                      <span className="text-[11px] text-[#34D399] font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {comparison.sharedLanguages.length} shared
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                    {[comparison.left, comparison.right].map((side, idx) => (
                      <div key={`cmp_lang_${idx}`} className="flex flex-wrap gap-1.5 min-w-0">
                        {side.languages.length > 0 ? (
                          side.languages.map((lang) => {
                            const isShared = comparison.sharedLanguages.includes(lang);
                            return (
                              <span
                                key={`${idx}_${lang}`}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  isShared
                                    ? 'bg-[#34D399]/15 border-[#34D399]/35 text-[#34D399]'
                                    : 'bg-[#12141E] border-[#292B39] text-[#F4F3FA]'
                                }`}
                              >
                                {lang}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-[#A1A5B5]">Not verified</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Official Indian OTT Platforms */}
                <div className="p-3.5 sm:p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#F4F3FA] flex items-center gap-1.5">
                      <Tv className="w-4 h-4 text-[#B49AF8]" />
                      Official Indian OTT Platforms
                    </span>
                    {comparison.sharedPlatforms.length > 0 && (
                      <span className="text-[11px] text-[#B49AF8] font-semibold">
                        Both on {comparison.sharedPlatforms.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                    {[comparison.left, comparison.right].map((side, idx) => (
                      <div key={`cmp_ott_${idx}`} className="flex flex-wrap gap-1.5 min-w-0">
                        {side.platforms.length > 0 ? (
                          side.platforms.map((plat) => {
                            const isShared = comparison.sharedPlatforms.includes(plat);
                            return (
                              <span
                                key={`${idx}_${plat}`}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  isShared
                                    ? 'bg-[#B49AF8]/15 border-[#B49AF8]/40 text-[#B49AF8]'
                                    : 'bg-[#12141E] border-[#292B39] text-[#F4F3FA]'
                                }`}
                              >
                                {plat}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-[#A1A5B5]">Not verified</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Airing Status */}
                <div className="p-3.5 sm:p-4 grid grid-cols-2 gap-2.5 sm:gap-4">
                  {[comparison.left, comparison.right].map((side, idx) => (
                    <div key={`cmp_status_${idx}`} className="space-y-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A5B5] flex items-center gap-1">
                        <Activity className="w-3 h-3 text-[#B49AF8]" />
                        <span>Airing Status</span>
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-[#F4F3FA] truncate">
                        {side.status || 'Not verified'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Episode Count */}
                <div className="p-3.5 sm:p-4 grid grid-cols-2 gap-2.5 sm:gap-4">
                  {[comparison.left, comparison.right].map((side, idx) => (
                    <div key={`cmp_ep_${idx}`} className="space-y-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                        Episode Count
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-[#F4F3FA] truncate">
                        {side.episodesLabel}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Rating & Studio */}
                <div className="p-3.5 sm:p-4 grid grid-cols-2 gap-2.5 sm:gap-4">
                  {[comparison.left, comparison.right].map((side, idx) => (
                    <div key={`cmp_studio_${idx}`} className="space-y-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                        Rating • Studio
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-[#F4F3FA] break-words">
                        {side.ratingLabel}
                        <span className="text-[#A1A5B5] font-normal"> • {side.studio}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (!asModal) {
    return <div className="w-full px-3 sm:px-6 py-5 sm:py-7 overflow-x-clip">{content}</div>;
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center p-2.5 sm:p-5 bg-[#0B0A10]/85"
    >
      {content}
    </div>
  );
};
