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
} from 'lucide-react';
import { buildAnimeComparison, type ComparableAnimeLike } from '../utils/compareAnime';
import { matchesAnimeSearchQuery } from '../utils/searchFilterState';
import { proxyUrl } from '../utils/imgbb';

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
      className={`w-full ${
        asModal
          ? 'max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#101624] border border-white/15 p-5 sm:p-7 shadow-2xl'
          : 'max-w-5xl mx-auto rounded-3xl bg-[#101624]/95 border border-white/10 p-5 sm:p-8 shadow-2xl'
      } text-neutral-100 font-sans space-y-6`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 id="compare-anime-heading" className="text-lg sm:text-xl font-black text-white tracking-tight">
              Compare Anime (A vs B)
            </h2>
            <p className="text-xs text-neutral-400">
              Side-by-side comparison of verified Indian dub languages, official OTT platforms, episodes, and ratings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap Anime A and Anime B"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Swap</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Compare Anime"
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {safeList.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Film className="w-8 h-8 text-neutral-500 mx-auto" />
          <p className="text-sm font-semibold text-white">Catalog is still loading</p>
          <p className="text-xs text-neutral-400">Once anime titles finish loading, you can compare any two side by side.</p>
        </div>
      ) : (
        <>
          {/* Pickers Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Anime A Picker */}
            <div className="rounded-2xl bg-[#0b0f17] border border-white/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="compare-select-a" className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                  Anime A
                </label>
                {leftAnime && onSelectAnime && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      onSelectAnime(leftAnime);
                    }}
                    className="text-[11px] font-semibold text-purple-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={leftSearch}
                  onChange={(e) => setLeftSearch(e.target.value)}
                  placeholder="Filter Anime A (English or Japanese)..."
                  aria-label="Filter Anime A options"
                  className="w-full rounded-xl bg-[#131926] border border-white/10 focus:border-purple-500 pl-8 pr-3 py-2 text-xs text-white placeholder-neutral-500 outline-none"
                />
              </div>
              <select
                id="compare-select-a"
                value={leftAnime ? Number(leftAnime.id) : ''}
                onChange={(e) => setLeftId(Number(e.target.value))}
                className="w-full rounded-xl bg-[#131926] border border-white/15 focus:border-purple-500 px-3 py-2 text-xs font-semibold text-white outline-none cursor-pointer"
              >
                {filteredLeftOptions.map((item) => (
                  <option key={`cmp_a_${item.id}`} value={Number(item.id)} className="bg-[#131926] text-white">
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Anime B Picker */}
            <div className="rounded-2xl bg-[#0b0f17] border border-white/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="compare-select-b" className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  Anime B
                </label>
                {rightAnime && onSelectAnime && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      onSelectAnime(rightAnime);
                    }}
                    className="text-[11px] font-semibold text-cyan-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={rightSearch}
                  onChange={(e) => setRightSearch(e.target.value)}
                  placeholder="Filter Anime B (English or Japanese)..."
                  aria-label="Filter Anime B options"
                  className="w-full rounded-xl bg-[#131926] border border-white/10 focus:border-cyan-500 pl-8 pr-3 py-2 text-xs text-white placeholder-neutral-500 outline-none"
                />
              </div>
              <select
                id="compare-select-b"
                value={rightAnime ? Number(rightAnime.id) : ''}
                onChange={(e) => setRightId(Number(e.target.value))}
                className="w-full rounded-xl bg-[#131926] border border-white/15 focus:border-cyan-500 px-3 py-2 text-xs font-semibold text-white outline-none cursor-pointer"
              >
                {filteredRightOptions.map((item) => (
                  <option key={`cmp_b_${item.id}`} value={Number(item.id)} className="bg-[#131926] text-white">
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Grid */}
          {comparison && (
            <div className="space-y-4">
              {/* Poster & Core Identity Row */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {[
                  { side: comparison.left, accent: 'border-purple-500/30', winnerRating: comparison.ratingWinner === 'left' },
                  { side: comparison.right, accent: 'border-cyan-500/30', winnerRating: comparison.ratingWinner === 'right' },
                ].map(({ side, accent, winnerRating }, idx) => (
                  <div
                    key={`cmp_card_${idx}_${side.id}`}
                    className={`rounded-2xl bg-[#0c111d] border ${accent} p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-start gap-3`}
                  >
                    <img
                      src={proxyUrl(side.coverImage)}
                      alt={side.title}
                      className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl object-cover border border-white/10 shrink-0 bg-neutral-900"
                    />
                    <div className="min-w-0 flex-1 text-center sm:text-left space-y-1.5">
                      <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug">
                        {side.title}
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        {side.type}
                        {side.year ? ` • ${side.year}` : ''}
                        {side.status ? ` • ${side.status}` : ''}
                      </p>
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className={winnerRating ? 'text-amber-300' : 'text-neutral-200'}>
                          {side.ratingLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Structured Comparison Rows */}
              <div className="rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/10 bg-[#0b0f17]/80">
                {/* Verified Indian Dub Languages */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                      <Globe2 className="w-4 h-4 text-purple-400" />
                      Verified Indian Dub Languages
                    </span>
                    {comparison.sharedLanguages.length > 0 && (
                      <span className="text-[11px] text-emerald-300 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {comparison.sharedLanguages.length} shared ({comparison.sharedLanguages.join(', ')})
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {[comparison.left, comparison.right].map((side, idx) => (
                      <div key={`cmp_lang_${idx}`} className="flex flex-wrap gap-1.5">
                        {side.languages.length > 0 ? (
                          side.languages.map((lang) => {
                            const isShared = comparison.sharedLanguages.includes(lang);
                            return (
                              <span
                                key={`${idx}_${lang}`}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  isShared
                                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
                                    : 'bg-white/5 border-white/10 text-neutral-200'
                                }`}
                              >
                                {lang}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-neutral-500">Not verified</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Official OTT Platforms */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                      <Tv className="w-4 h-4 text-cyan-400" />
                      Official OTT Platforms
                    </span>
                    {comparison.sharedPlatforms.length > 0 && (
                      <span className="text-[11px] text-cyan-300 font-semibold">
                        Both on {comparison.sharedPlatforms.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {[comparison.left, comparison.right].map((side, idx) => (
                      <div key={`cmp_ott_${idx}`} className="flex flex-wrap gap-1.5">
                        {side.platforms.length > 0 ? (
                          side.platforms.map((plat) => {
                            const isShared = comparison.sharedPlatforms.includes(plat);
                            return (
                              <span
                                key={`${idx}_${plat}`}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  isShared
                                    ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-200'
                                    : 'bg-white/5 border-white/10 text-neutral-200'
                                }`}
                              >
                                {plat}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-neutral-500">Not verified</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Episode Count */}
                <div className="p-4 grid grid-cols-2 gap-3 sm:gap-4">
                  {[comparison.left, comparison.right].map((side, idx) => (
                    <div key={`cmp_ep_${idx}`} className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Episodes
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-white">{side.episodesLabel}</p>
                    </div>
                  ))}
                </div>

                {/* Rating & Studio */}
                <div className="p-4 grid grid-cols-2 gap-3 sm:gap-4">
                  {[comparison.left, comparison.right].map((side, idx) => (
                    <div key={`cmp_studio_${idx}`} className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Rating • Studio
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-white">
                        {side.ratingLabel}
                        <span className="text-neutral-400 font-normal"> • {side.studio}</span>
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
    return <div className="w-full px-3 sm:px-6 py-6 sm:py-8">{content}</div>;
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md"
    >
      {content}
    </div>
  );
};
