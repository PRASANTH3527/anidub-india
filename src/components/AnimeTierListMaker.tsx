import React, { useState, useRef } from 'react';
import {
  Trophy,
  Sparkles,
  RotateCcw,
  Download,
  Share2,
  Search,
  Layers,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { Anime } from './CatalogView';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EclipseState';

export interface AnimeTierListMakerProps {
  catalogList: Anime[];
  onSelectAnime?: (anime: Anime) => void;
  onNavigateHome?: () => void;
}

interface TierDefinition {
  id: string;
  label: string;
  name: string;
  badgeStyle: string;
}

const TIERS: TierDefinition[] = [
  { id: 'S', label: 'S', name: 'Masterpiece', badgeStyle: 'bg-[#F87171]/15 border-[#F87171]/40 text-[#F87171]' },
  { id: 'A', label: 'A', name: 'Top Tier', badgeStyle: 'bg-[#F9C876]/15 border-[#F9C876]/40 text-[#F9C876]' },
  { id: 'B', label: 'B', name: 'Great Watch', badgeStyle: 'bg-[#B49AF8]/15 border-[#B49AF8]/40 text-[#B49AF8]' },
  { id: 'C', label: 'C', name: 'Decent', badgeStyle: 'bg-[#34D399]/15 border-[#34D399]/40 text-[#34D399]' },
  { id: 'D', label: 'D', name: 'Casual', badgeStyle: 'bg-[#191C29] border-[#292B39] text-[#A1A5B5]' },
];

export const AnimeTierListMaker: React.FC<AnimeTierListMakerProps> = ({
  catalogList,
  onNavigateHome,
}) => {
  const [tierState, setTierState] = useState<Record<string, Anime[]>>({
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
  });

  const [format, setFormat] = useState<'PNG' | 'JPEG'>('PNG');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [draggedAnime, setDraggedAnime] = useState<Anime | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);
  const [isDockExpanded, setIsDockExpanded] = useState(true);
  // Tap-to-assign selection for mobile & keyboard users
  const [activeTapAnime, setActiveTapAnime] = useState<Anime | null>(null);

  const tierBoardRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const assignedIds = new Set(
    Object.values(tierState).flatMap((list) => list.map((a) => a.id))
  );

  const unrankedPool = catalogList.filter((anime) => {
    if (assignedIds.has(anime.id)) return false;
    const matchesQuery =
      !searchQuery.trim() ||
      anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (anime.genres && anime.genres.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLang =
      selectedLanguage === 'All' ||
      (anime.languages && anime.languages.toLowerCase().includes(selectedLanguage.toLowerCase()));

    return matchesQuery && matchesLang;
  });

  const assignToTier = (anime: Anime, tierId: string) => {
    setTierState((prev) => {
      const next: Record<string, Anime[]> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = prev[key].filter((a) => a.id !== anime.id);
      });
      next[tierId] = [...(next[tierId] || []), anime];
      return next;
    });
    setActiveTapAnime(null);
  };

  const removeFromTier = (animeId: number) => {
    setTierState((prev) => {
      const next: Record<string, Anime[]> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = prev[key].filter((a) => a.id !== animeId);
      });
      return next;
    });
    if (activeTapAnime?.id === animeId) {
      setActiveTapAnime(null);
    }
  };

  const handleReset = () => {
    setTierState({ S: [], A: [], B: [], C: [], D: [] });
    setActiveTapAnime(null);
    showToast('Tier list reset.');
  };

  const handleSamplePreset = () => {
    if (catalogList.length === 0) return;
    const items = [...catalogList];
    setTierState({
      S: items.slice(0, 3),
      A: items.slice(3, 6),
      B: items.slice(6, 9),
      C: items.slice(9, 11),
      D: items.slice(11, 13),
    });
    showToast('Loaded sample tier rankings.');
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast('Tier list link copied.');
  };

  const handleDragStart = (e: React.DragEvent, anime: Anime) => {
    setDraggedAnime(anime);
    e.dataTransfer.setData('text/plain', String(anime.id));
  };

  const handleDragOver = (e: React.DragEvent, tierId: string) => {
    e.preventDefault();
    if (dragOverTier !== tierId) setDragOverTier(tierId);
  };

  const handleDragLeave = (_e: React.DragEvent, tierId: string) => {
    if (dragOverTier === tierId) setDragOverTier(null);
  };

  const handleDropOnTier = (e: React.DragEvent, tierId: string) => {
    e.preventDefault();
    setDragOverTier(null);
    if (draggedAnime) {
      assignToTier(draggedAnime, tierId);
      setDraggedAnime(null);
    }
  };

  const handleDownloadImage = () => {
    setIsExporting(true);
    showToast(`Exporting ${format} tier list...`);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0B0A10';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#B49AF8';
        ctx.beginPath();
        ctx.roundRect(40, 40, 50, 50, 12);
        ctx.fill();
        ctx.fillStyle = '#0B0A10';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('AD', 48, 73);

        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#F4F3FA';
        ctx.fillText('AniDub India • Tier List', 110, 70);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#A1A5B5';
        ctx.fillText('Indian Dubbed Anime Rankings', 110, 94);

        const tierLabels = [
          { label: 'S', color: '#F87171', items: tierState.S },
          { label: 'A', color: '#F9C876', items: tierState.A },
          { label: 'B', color: '#B49AF8', items: tierState.B },
          { label: 'C', color: '#34D399', items: tierState.C },
          { label: 'D', color: '#292B39', items: tierState.D },
        ];

        let startY = 135;
        tierLabels.forEach((tier) => {
          ctx.fillStyle = tier.color;
          ctx.beginPath();
          ctx.roundRect(40, startY, 110, 125, 12);
          ctx.fill();
          ctx.fillStyle = tier.label === 'D' ? '#F4F3FA' : '#0B0A10';
          ctx.font = 'bold 42px sans-serif';
          ctx.fillText(tier.label, 80, startY + 80);

          ctx.fillStyle = '#12141E';
          ctx.beginPath();
          ctx.roundRect(155, startY, canvas.width - 195, 125, 12);
          ctx.fill();

          ctx.fillStyle = '#F4F3FA';
          ctx.font = 'bold 15px sans-serif';
          tier.items.forEach((item, idx) => {
            if (idx < 5) {
              const xPos = 175 + idx * 190;
              ctx.fillStyle = '#191C29';
              ctx.beginPath();
              ctx.roundRect(xPos, startY + 12, 170, 100, 10);
              ctx.fill();
              ctx.fillStyle = '#F4F3FA';
              ctx.fillText(item.title.slice(0, 16), xPos + 10, startY + 52);
              const ratingNum = Number(item.rating);
              ctx.fillStyle = '#B49AF8';
              ctx.font = '12px sans-serif';
              ctx.fillText(
                Number.isFinite(ratingNum) && ratingNum > 0 ? `★ ${ratingNum.toFixed(1)}/10` : 'Indian Dub',
                xPos + 10,
                startY + 80
              );
              ctx.font = 'bold 15px sans-serif';
            }
          });

          startY += 140;
        });

        const mimeType = format === 'JPEG' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(mimeType, 0.95);
        const link = document.createElement('a');
        link.download = `anidub_tier_list_${Date.now()}.${format.toLowerCase()}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Saved tier list as ${format}.`);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (catalogList.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-8">
        <EmptyState
          icon={<Trophy className="w-5 h-5" />}
          title="No anime loaded for Tier List"
          description="Browse Explore or wait for the catalog to finish loading to rank your favorite dubbed anime."
          actionLabel={onNavigateHome ? 'Browse Explore' : undefined}
          onAction={onNavigateHome}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0A10] text-[#F4F3FA] font-sans pb-52 px-3 sm:px-6 pt-5 relative overflow-x-clip">
      {toastMessage && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-[12px] bg-[#12141E] border border-[#292B39] shadow-2xl flex items-center gap-2.5 text-[#F4F3FA] text-xs font-semibold"
        >
          <Sparkles className="w-4 h-4 text-[#B49AF8] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOOLBAR */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[12px] bg-[#12141E] border border-[#292B39] text-[#F9C876] flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#F4F3FA] tracking-tight">
              Anime Tier List Maker
            </h1>
          </div>
          <p className="text-xs text-[#A1A5B5] mt-1">
            Tap any anime card below to assign a tier on mobile, or drag and drop on desktop.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-[12px] bg-[#12141E] p-2 border border-[#292B39] flex-wrap">
          <div className="flex items-center bg-[#191C29] rounded-[10px] p-0.5 border border-[#292B39]">
            {(['PNG', 'JPEG'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormat(fmt)}
                className={`min-h-[38px] px-3 py-1 rounded-lg text-xs font-bold transition-colors duration-180 cursor-pointer ${
                  format === fmt ? 'bg-[#B49AF8] text-[#0B0A10]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSamplePreset}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[#191C29] hover:border-[#B49AF8]/60 text-[#F9C876] transition-colors duration-180 cursor-pointer border border-[#292B39] flex items-center justify-center"
            title="Load sample ranking"
            aria-label="Load sample ranking"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[#191C29] hover:border-[#B49AF8]/60 text-[#A1A5B5] hover:text-[#F4F3FA] transition-colors duration-180 cursor-pointer border border-[#292B39] flex items-center justify-center"
            title="Reset tier list"
            aria-label="Reset tier list"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <Button
            type="button"
            onClick={handleDownloadImage}
            disabled={isExporting}
            variant="primary"
            size="md"
            leftIcon={<Download className="w-4 h-4" />}
          >
            {isExporting ? 'Exporting…' : 'Export / Save'}
          </Button>

          <button
            type="button"
            onClick={handleShare}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[#191C29] hover:border-[#B49AF8]/60 text-[#B49AF8] transition-colors duration-180 cursor-pointer border border-[#292B39] flex items-center justify-center"
            title="Share link"
            aria-label="Share Tier List link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CENTRAL TIER BOARD */}
      <div
        ref={tierBoardRef}
        className="max-w-6xl mx-auto p-3.5 sm:p-5 bg-[#12141E] rounded-[12px] border border-[#292B39] space-y-3"
      >
        {TIERS.map((tier) => {
          const items = tierState[tier.id] || [];
          const isTargeted = dragOverTier === tier.id;

          return (
            <div
              key={tier.id}
              onDragOver={(e) => handleDragOver(e, tier.id)}
              onDragLeave={(e) => handleDragLeave(e, tier.id)}
              onDrop={(e) => handleDropOnTier(e, tier.id)}
              className={`flex flex-col sm:flex-row items-stretch rounded-[12px] p-2.5 sm:p-3 bg-[#191C29] border transition-colors duration-180 gap-3 ${
                isTargeted ? 'border-[#B49AF8]' : 'border-[#292B39]'
              }`}
            >
              <div className="flex sm:flex-col items-center justify-between sm:justify-center sm:w-20 shrink-0 select-none">
                <div
                  className={`w-12 h-12 sm:w-16 sm:h-16 rounded-[10px] border ${tier.badgeStyle} flex flex-col items-center justify-center shrink-0`}
                >
                  <span className="text-xl sm:text-2xl font-extrabold leading-none">{tier.label}</span>
                  <span className="text-[9px] uppercase font-bold opacity-80 hidden sm:block mt-0.5">
                    Tier
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#A1A5B5] sm:mt-1.5">
                  {items.length} {items.length === 1 ? 'title' : 'titles'}
                </span>
              </div>

              <div className="flex-1 flex flex-wrap gap-2.5 items-center min-h-[84px]">
                {items.length === 0 ? (
                  <div
                    className={`w-full min-h-[84px] flex items-center justify-center gap-2 border rounded-[10px] py-3 px-3 text-xs select-none ${
                      isTargeted
                        ? 'border-solid border-[#B49AF8] bg-[#B49AF8]/10 text-[#B49AF8]'
                        : 'border-dashed border-[#292B39] text-[#A1A5B5]'
                    }`}
                  >
                    <Layers className="w-4 h-4 opacity-60 shrink-0" />
                    <span>
                      {isTargeted ? `Drop into ${tier.label} Tier` : `Drop or tap-assign into ${tier.label} Tier`}
                    </span>
                  </div>
                ) : (
                  items.map((anime, idx) => (
                    <div
                      key={`tier_${tier.id}_anime_${anime.id}_${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, anime)}
                      onClick={() => setActiveTapAnime(activeTapAnime?.id === anime.id ? null : anime)}
                      className={`relative group w-16 sm:w-20 aspect-[2/3] rounded-[10px] overflow-hidden bg-[#12141E] border shrink-0 cursor-pointer transition-colors duration-180 select-none ${
                        activeTapAnime?.id === anime.id ? 'border-[#B49AF8] ring-2 ring-[#B49AF8]/40' : 'border-[#292B39] hover:border-[#B49AF8]'
                      }`}
                      title={anime.title}
                    >
                      <img
                        src={anime.cover_image || '/logo.png'}
                        alt={anime.title}
                        width={80}
                        height={120}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.src = '/logo.png';
                        }}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromTier(anime.id);
                        }}
                        aria-label={`Remove ${anime.title} from tier`}
                        className="absolute top-1 right-1 w-6 h-6 rounded-md bg-[#0B0A10]/85 border border-[#292B39] text-[#F87171] flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-180 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FLOATING BOTTOM DOCK + MOBILE TAP-TO-ASSIGN BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 sm:px-6 pb-3 sm:pb-5 pointer-events-none">
        <div className="max-w-5xl mx-auto bg-[#12141E] border border-[#292B39] rounded-[12px] p-3.5 sm:p-4 shadow-2xl pointer-events-auto space-y-3">
          {/* Tap-to-Assign Action Bar (Mobile-first) */}
          {activeTapAnime && (
            <div
              data-testid="tier-tap-assign-bar"
              className="rounded-[10px] bg-[#191C29] border border-[#B49AF8]/50 p-2.5 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-[#F4F3FA] truncate max-w-[160px] sm:max-w-[240px]">
                  Assign: {activeTapAnime.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {TIERS.map((t) => (
                  <button
                    key={`tap_assign_${t.id}`}
                    type="button"
                    onClick={() => assignToTier(activeTapAnime, t.id)}
                    className={`min-w-[44px] min-h-[40px] px-2.5 rounded-lg border ${t.badgeStyle} text-xs font-extrabold cursor-pointer`}
                  >
                    {t.label}
                  </button>
                ))}
                {assignedIds.has(activeTapAnime.id) && (
                  <button
                    type="button"
                    onClick={() => removeFromTier(activeTapAnime.id)}
                    className="min-h-[40px] px-2.5 rounded-lg bg-[#F87171]/15 border border-[#F87171]/40 text-[#F87171] text-xs font-bold cursor-pointer"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTapAnime(null)}
                  aria-label="Cancel tap assignment"
                  className="w-10 h-10 rounded-lg bg-[#12141E] border border-[#292B39] text-[#A1A5B5] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#B49AF8]" />
              <h2 className="text-xs font-extrabold text-[#F4F3FA] uppercase tracking-wider">
                Unranked Pool ({unrankedPool.length})
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="hidden sm:flex items-center bg-[#191C29] rounded-[10px] p-0.5 border border-[#292B39]">
                {['All', 'Tamil', 'Hindi', 'Telugu'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setSelectedLanguage(l)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors duration-180 cursor-pointer ${
                      selectedLanguage === l ? 'bg-[#B49AF8] text-[#0B0A10]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="relative w-36 sm:w-44">
                <Search className="w-3.5 h-3.5 text-[#A1A5B5] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter pool..."
                  aria-label="Filter unranked pool"
                  className="w-full h-[38px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-[10px] pl-8 pr-2.5 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsDockExpanded(!isDockExpanded)}
                className="w-10 h-10 rounded-[10px] bg-[#191C29] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center cursor-pointer"
                aria-label={isDockExpanded ? 'Collapse Pool' : 'Expand Pool'}
              >
                {isDockExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isDockExpanded && (
            <div>
              {unrankedPool.length === 0 ? (
                <p className="text-center py-4 text-xs text-[#A1A5B5]">
                  All matching titles have been assigned to tiers.
                </p>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
                  {unrankedPool.map((anime, idx) => {
                    const isSelected = activeTapAnime?.id === anime.id;
                    return (
                      <button
                        key={`dock_anime_${anime.id}_${idx}`}
                        type="button"
                        draggable
                        onDragStart={(e) => handleDragStart(e, anime)}
                        onClick={() => setActiveTapAnime(isSelected ? null : anime)}
                        className={`relative w-16 sm:w-20 aspect-[2/3] rounded-[10px] overflow-hidden bg-[#191C29] border shrink-0 cursor-pointer transition-colors duration-180 text-left ${
                          isSelected
                            ? 'border-[#B49AF8] ring-2 ring-[#B49AF8]/40'
                            : 'border-[#292B39] hover:border-[#B49AF8]'
                        }`}
                        title={`Tap to assign ${anime.title}`}
                      >
                        <img
                          src={anime.cover_image || '/logo.png'}
                          alt={anime.title}
                          width={80}
                          height={120}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.src = '/logo.png';
                          }}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-[#0B0A10] to-transparent pointer-events-none">
                          <p className="text-[9px] font-bold text-[#F4F3FA] truncate">{anime.title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
