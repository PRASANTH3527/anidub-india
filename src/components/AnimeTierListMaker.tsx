import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, RotateCcw, Search, Share2, Undo2, Plus, X, Check
} from 'lucide-react';
import { Anime, normalizeAnimeList } from '../types';
import { OptimizedImage } from './OptimizedImage';
import { ConfirmDialog } from './ui/EclipseState';
import { useTranslation } from 'react-i18next';

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
  { id: 'S', label: 'S', badgeClass: 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)]' },
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
  const { t } = useTranslation(['tools', 'common']);
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
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[var(--text-primary)]">
      {/* Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-primary)] mb-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>Interactive Ranking</span>
          </div>
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em]">
            {t('tools:tierList.title', 'Regional Dub Tier List')}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            {t('tools:tierList.subtitle', 'Rank your favorite Indian dubbed anime and export your board')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            aria-label="Undo last tier assignment"
            className="min-h-[44px] px-3.5 rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Undo2 className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmReset(true)}
            disabled={rankedIdsSet.size === 0}
            className="min-h-[44px] px-3.5 rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 text-[#F87171] border border-[var(--border-subtle)] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('tools:tierList.resetBoard', 'Reset')}</span>
          </button>

          <button
            type="button"
            onClick={handleShareOrExport}
            className="min-h-[44px] px-4 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold text-[13px] inline-flex items-center gap-2 transition-colors shadow-sm"
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
            ? 'bg-[var(--bg-elevated)] border-[var(--accent-primary)]'
            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selectedAnime ? (
            <>
              <div className="w-10 aspect-[2/3] rounded-[6px] overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0">
                <OptimizedImage
                  src={selectedAnime.poster}
                  alt={selectedAnime.title}
                  className="w-full h-full object-cover"
                  aspectRatio="portrait"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                  {t('tools:tierList.tapToAssign', 'Tap a tier to assign')}
                </div>
                <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">
                  {selectedAnime.title}
                </div>
              </div>
            </>
          ) : (
            <div className="text-[13px] text-[var(--text-secondary)]">
              Select any anime poster below to quickly rank it into <strong className="text-[var(--text-primary)]">S, A, B, C, or D</strong> tier.
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
              className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-surface)] text-[#F87171] border border-[var(--border-subtle)] text-[12px] font-semibold"
            >
              Unrank
            </button>
          )}
          {selectedAnimeId && (
            <button
              type="button"
              onClick={() => setSelectedAnimeId(null)}
              aria-label="Clear selection"
              className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* S - D Tier Rows */}
      <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden mb-6">
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

              <div className="flex-1 p-2.5 sm:p-3 flex flex-wrap items-center gap-2.5 bg-[var(--bg-surface)]">
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
                        className={`relative w-16 sm:w-20 aspect-[2/3] rounded-[10px] overflow-hidden bg-[var(--bg-elevated)] border-2 transition-all ${
                          isSelected
                            ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/40 scale-[1.03]'
                            : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50'
                        }`}
                      >
                        <OptimizedImage
                          src={anime.poster}
                          alt={anime.title}
                          className="w-full h-full object-cover"
                          aspectRatio="portrait"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-[var(--bg-canvas)]/85 px-1 py-0.5 text-[10px] font-semibold text-[var(--text-primary)] truncate">
                          {anime.title}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[12px] text-[var(--text-secondary)] pl-2">
                    Drop or tap-assign {tier.label}-tier anime here
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unranked Pool with Search, Language Filter Pills & Pagination */}
      <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[16px] sm:text-[18px] font-bold text-[var(--text-primary)]">
              Unranked Anime Pool ({filteredUnrankedPool.length})
            </h2>
            <p className="text-[12px] text-[var(--text-secondary)]">
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
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {lang === 'All'
                      ? t('common:all', 'All')
                      : t(`common:languages.${lang.toLowerCase()}`, lang)}
                  </button>
                );
              })}
            </div>

            {/* Search Input (44px) */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPoolVisibleCount(24);
                }}
                placeholder="Search unranked pool..."
                className="w-full min-h-[44px] pl-9 pr-4 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
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
                className={`group relative aspect-[2/3] rounded-[10px] overflow-hidden bg-[var(--bg-elevated)] border-2 text-left transition-all duration-180 ${
                  isSelected
                    ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/40 scale-[1.02]'
                    : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50'
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
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)]/90 to-transparent p-2 pt-5">
                  <div className="text-[11px] font-semibold text-[var(--text-primary)] line-clamp-2 leading-tight">
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
              className="min-h-[44px] px-5 rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--accent-hover)] border border-[var(--border-subtle)] text-[13px] font-semibold inline-flex items-center gap-2 transition-colors"
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
