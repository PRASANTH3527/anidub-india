import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, RotateCcw, Search, Share2, Undo2, Plus, X, Check
} from 'lucide-react';
import { Anime, normalizeAnimeList } from '../types';
import { OptimizedImage } from './OptimizedImage';
import { ConfirmDialog } from './ui/EclipseState';

export interface AnimeTierListMakerProps {
  animeList?: any[];
  catalogList?: any[];
  onSelectAnime: (anime: any) => void;
  onNavigateHome?: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type TierKey = 'S' | 'A' | 'B' | 'C' | 'D';
type TiersMap = Record<TierKey, string[]>;

const TIER_DEFINITIONS: { id: TierKey; label: string; badgeClass: string }[] = [
  { id: 'S', label: 'S', badgeClass: 'bg-[#B49AF8] text-[#0B0A10]' },
  { id: 'A', label: 'A', badgeClass: 'bg-emerald-400 text-[#0B0A10]' },
  { id: 'B', label: 'B', badgeClass: 'bg-sky-400 text-[#0B0A10]' },
  { id: 'C', label: 'C', badgeClass: 'bg-[#F9C876] text-[#0B0A10]' },
  { id: 'D', label: 'D', badgeClass: 'bg-[#F87171] text-[#0B0A10]' },
];

const INITIAL_TIERS: TiersMap = { S: [], A: [], B: [], C: [], D: [] };
const LANG_FILTERS = ['All', 'Tamil', 'Hindi', 'Telugu'] as const;

export const AnimeTierListMaker: React.FC<AnimeTierListMakerProps> = ({
  animeList: animeListProp,
  catalogList,
  onSelectAnime,
  onShowToast,
}) => {
  const animeList = useMemo(
    () => normalizeAnimeList(animeListProp || catalogList || []),
    [animeListProp, catalogList]
  );

  const [tiers, setTiers] = useState<TiersMap>(() => {
    try {
      const saved = localStorage.getItem('anidub_tier_list_v2');
      return saved ? JSON.parse(saved) : INITIAL_TIERS;
    } catch {
      return INITIAL_TIERS;
    }
  });
  const [historyStack, setHistoryStack] = useState<TiersMap[]>([]);
  const [selectedAnimeId, setSelectedAnimeId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLang, setSelectedLang] = useState<string>('All');
  const [poolVisibleCount, setPoolVisibleCount] = useState<number>(24);
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('anidub_tier_list_v2', JSON.stringify(tiers));
    } catch {
      // ignore storage errors
    }
  }, [tiers]);

  const animeById = useMemo(() => {
    const map = new Map<string, Anime>();
    animeList.forEach((a) => map.set(a.id, a));
    return map;
  }, [animeList]);

  const rankedIdsSet = useMemo(() => {
    const set = new Set<string>();
    (Object.values(tiers) as string[][]).forEach((arr) => arr.forEach((id) => set.add(id)));
    return set;
  }, [tiers]);

  const filteredUnrankedPool = useMemo(() => {
    return animeList.filter((anime) => {
      if (rankedIdsSet.has(anime.id)) return false;
      if (selectedLang !== 'All') {
        if (!Array.isArray(anime.languages) || !anime.languages.includes(selectedLang as any)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          anime.title.toLowerCase().includes(q) ||
          (anime.japaneseTitle && anime.japaneseTitle.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [animeList, rankedIdsSet, selectedLang, searchQuery]);

  const assignToTier = (animeId: string, targetTier: TierKey | 'UNRANKED') => {
    setHistoryStack((prev) => [...prev.slice(-19), tiers]);
    setTiers((prev) => {
      const cleaned: TiersMap = {
        S: prev.S.filter((id) => id !== animeId),
        A: prev.A.filter((id) => id !== animeId),
        B: prev.B.filter((id) => id !== animeId),
        C: prev.C.filter((id) => id !== animeId),
        D: prev.D.filter((id) => id !== animeId),
      };
      if (targetTier !== 'UNRANKED') {
        cleaned[targetTier] = [...cleaned[targetTier], animeId];
      }
      return cleaned;
    });
    setSelectedAnimeId(null);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setTiers(previous);
    setHistoryStack((prev) => prev.slice(0, -1));
    if (onShowToast) onShowToast('Undid last tier change', 'info');
  };

  const handleConfirmReset = () => {
    setHistoryStack((prev) => [...prev.slice(-19), tiers]);
    setTiers(INITIAL_TIERS);
    setSelectedAnimeId(null);
    setShowConfirmReset(false);
    if (onShowToast) onShowToast('Tier list reset', 'info');
  };

  const handleShareOrExport = () => {
    const lines = TIER_DEFINITIONS.map((t) => {
      const titles = tiers[t.id]
        .map((id) => animeById.get(id)?.title)
        .filter(Boolean)
        .join(', ');
      return `${t.id} Tier: ${titles || 'None'}`;
    });
    const text = `My Regional Dub Anime Tier List (AniDub India)\n${lines.join('\n')}`;
    if (navigator.share) {
      navigator.share({ title: 'My Anime Dub Tier List', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
      if (onShowToast) onShowToast('Tier list copied to clipboard!', 'success');
    }
  };

  const selectedAnime = selectedAnimeId ? animeById.get(selectedAnimeId) || null : null;

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[#F4F3FA]">
      {/* Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#B49AF8] mb-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>Interactive Ranking</span>
          </div>
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[#F4F3FA] leading-[1.2] tracking-[-0.02em]">
            Regional Dub Tier List
          </h1>
          <p className="text-[13px] text-[#A1A5B5] mt-0.5">
            Tap any poster to assign S–D tier on mobile, or drag and drop on desktop
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            aria-label="Undo last tier assignment"
            className="min-h-[44px] px-3.5 rounded-[12px] bg-[#12141E] hover:bg-[#191C29] disabled:opacity-40 text-[#F4F3FA] border border-[#292B39] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Undo2 className="w-4 h-4 text-[#B49AF8]" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmReset(true)}
            disabled={rankedIdsSet.size === 0}
            className="min-h-[44px] px-3.5 rounded-[12px] bg-[#12141E] hover:bg-[#191C29] disabled:opacity-40 text-[#F87171] border border-[#292B39] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleShareOrExport}
            className="min-h-[44px] px-4 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] font-bold text-[13px] inline-flex items-center gap-2 transition-colors shadow-sm"
          >
            {copiedShare ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>{copiedShare ? 'Copied!' : 'Export / Share'}</span>
          </button>
        </div>
      </div>

      {/* Tap-to-Rank Action Bar (Always present in DOM for mobile accessibility & tests) */}
      <div
        data-testid="tier-tap-assign-bar"
        className={`mb-5 rounded-[14px] border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-180 ${
          selectedAnime
            ? 'bg-[#191C29] border-[#B49AF8]'
            : 'bg-[#12141E] border-[#292B39]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selectedAnime ? (
            <>
              <div className="w-10 aspect-[2/3] rounded-[6px] overflow-hidden bg-[#12141E] border border-[#292B39] shrink-0">
                <OptimizedImage
                  src={selectedAnime.poster}
                  alt={selectedAnime.title}
                  className="w-full h-full object-cover"
                  aspectRatio="portrait"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#B49AF8]">
                  Tap a tier to assign
                </div>
                <div className="text-[14px] font-bold text-[#F4F3FA] truncate">
                  {selectedAnime.title}
                </div>
              </div>
            </>
          ) : (
            <div className="text-[13px] text-[#A1A5B5]">
              Select any anime poster below to quickly rank it into <strong className="text-[#F4F3FA]">S, A, B, C, or D</strong> tier.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {TIER_DEFINITIONS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              disabled={!selectedAnimeId}
              onClick={() => selectedAnimeId && assignToTier(selectedAnimeId, tier.id)}
              className={`min-h-[44px] min-w-[44px] px-3 rounded-[10px] font-extrabold text-[13px] transition-opacity ${tier.badgeClass} disabled:opacity-40`}
            >
              {tier.label}
            </button>
          ))}
          {selectedAnimeId && rankedIdsSet.has(selectedAnimeId) && (
            <button
              type="button"
              onClick={() => assignToTier(selectedAnimeId, 'UNRANKED')}
              className="min-h-[44px] px-3 rounded-[10px] bg-[#12141E] text-[#F87171] border border-[#292B39] text-[12px] font-semibold"
            >
              Unrank
            </button>
          )}
          {selectedAnimeId && (
            <button
              type="button"
              onClick={() => setSelectedAnimeId(null)}
              aria-label="Clear selection"
              className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[#12141E] text-[#A1A5B5] border border-[#292B39] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* S - D Tier Rows */}
      <div className="rounded-[16px] bg-[#12141E] border border-[#292B39] divide-y divide-[#292B39] overflow-hidden mb-6">
        {TIER_DEFINITIONS.map((tier) => {
          const tierItems = tiers[tier.id]
            .map((id) => animeById.get(id))
            .filter((x): x is Anime => Boolean(x));

          return (
            <div
              key={tier.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedId) {
                  assignToTier(draggedId, tier.id);
                  setDraggedId(null);
                }
              }}
              className="flex items-stretch min-h-[104px]"
            >
              <div
                className={`w-16 sm:w-20 shrink-0 flex items-center justify-center text-[22px] font-black ${tier.badgeClass}`}
              >
                {tier.label}
              </div>

              <div className="flex-1 p-2.5 sm:p-3 flex flex-wrap items-center gap-2.5 bg-[#12141E]">
                {tierItems.length > 0 ? (
                  tierItems.map((anime) => {
                    const isSelected = selectedAnimeId === anime.id;
                    return (
                      <button
                        key={anime.id}
                        type="button"
                        draggable
                        onDragStart={() => setDraggedId(anime.id)}
                        onClick={() =>
                          setSelectedAnimeId((prev) => (prev === anime.id ? null : anime.id))
                        }
                        onDoubleClick={() => onSelectAnime(anime)}
                        title={anime.title}
                        className={`relative w-16 sm:w-20 aspect-[2/3] rounded-[10px] overflow-hidden bg-[#191C29] border-2 transition-all ${
                          isSelected
                            ? 'border-[#B49AF8] ring-2 ring-[#B49AF8]/40 scale-[1.03]'
                            : 'border-[#292B39] hover:border-[#B49AF8]/50'
                        }`}
                      >
                        <OptimizedImage
                          src={anime.poster}
                          alt={anime.title}
                          className="w-full h-full object-cover"
                          aspectRatio="portrait"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-[#0B0A10]/85 px-1 py-0.5 text-[10px] font-semibold text-[#F4F3FA] truncate">
                          {anime.title}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[12px] text-[#A1A5B5] pl-2">
                    Drop or tap-assign {tier.label}-tier anime here
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unranked Pool with Search, Language Filter Pills & Pagination */}
      <div className="rounded-[16px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[16px] sm:text-[18px] font-bold text-[#F4F3FA]">
              Unranked Anime Pool ({filteredUnrankedPool.length})
            </h2>
            <p className="text-[12px] text-[#A1A5B5]">
              Tap a poster to highlight it, then tap S / A / B / C / D above
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Language Pills (44px) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {LANG_FILTERS.map((lang) => {
                const active = selectedLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setSelectedLang(lang);
                      setPoolVisibleCount(24);
                    }}
                    className={`min-h-[44px] px-3.5 rounded-[10px] text-[12px] font-semibold whitespace-nowrap border transition-colors ${
                      active
                        ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                        : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>

            {/* Search Input (44px) */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#A1A5B5] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPoolVisibleCount(24);
                }}
                placeholder="Search unranked pool..."
                className="w-full min-h-[44px] pl-9 pr-4 rounded-[10px] bg-[#191C29] border border-[#292B39] text-[13px] text-[#F4F3FA] placeholder-[#A1A5B5] focus:outline-none focus:border-[#B49AF8]"
              />
            </div>
          </div>
        </div>

        {/* Paginated Poster Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {filteredUnrankedPool.slice(0, poolVisibleCount).map((anime) => {
            const isSelected = selectedAnimeId === anime.id;
            return (
              <button
                key={anime.id}
                type="button"
                draggable
                onDragStart={() => setDraggedId(anime.id)}
                onClick={() =>
                  setSelectedAnimeId((prev) => (prev === anime.id ? null : anime.id))
                }
                className={`group relative aspect-[2/3] rounded-[10px] overflow-hidden bg-[#191C29] border-2 text-left transition-all duration-180 ${
                  isSelected
                    ? 'border-[#B49AF8] ring-2 ring-[#B49AF8]/40 scale-[1.02]'
                    : 'border-[#292B39] hover:border-[#B49AF8]/50'
                }`}
              >
                <OptimizedImage
                  src={anime.poster}
                  alt={anime.title}
                  width={160}
                  height={240}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  aspectRatio="portrait"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B0A10] via-[#0B0A10]/90 to-transparent p-2 pt-5">
                  <div className="text-[11px] font-semibold text-[#F4F3FA] line-clamp-2 leading-tight">
                    {anime.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredUnrankedPool.length > poolVisibleCount && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setPoolVisibleCount((prev) => prev + 24)}
              className="min-h-[44px] px-5 rounded-[12px] bg-[#191C29] hover:bg-[#292B39] text-[#CBB6FF] border border-[#292B39] text-[13px] font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>
                Load more ({filteredUnrankedPool.length - poolVisibleCount} remaining)
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Protected Reset Confirmation */}
      <ConfirmDialog
        open={showConfirmReset}
        title="Reset Tier List?"
        description="Clear all S–D tier rankings and return all anime to the unranked pool?"
        confirmLabel="Reset Tiers"
        isDestructive={true}
        onCancel={() => setShowConfirmReset(false)}
        onConfirm={handleConfirmReset}
      />
    </section>
  );
};
