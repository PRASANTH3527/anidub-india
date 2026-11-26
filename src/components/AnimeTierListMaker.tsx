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
} from 'lucide-react';
import { Anime } from './CatalogView';
import { Button } from './ui/Button';

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
  {
    id: 'S',
    label: 'S',
    name: 'Masterpiece',
    badgeStyle: 'bg-[#F87171]/15 border-[#F87171]/40 text-[#F87171]',
  },
  {
    id: 'A',
    label: 'A',
    name: 'Top Tier',
    badgeStyle: 'bg-[#F9C876]/15 border-[#F9C876]/40 text-[#F9C876]',
  },
  {
    id: 'B',
    label: 'B',
    name: 'Great Watch',
    badgeStyle: 'bg-[#B49AF8]/15 border-[#B49AF8]/40 text-[#B49AF8]',
  },
  {
    id: 'C',
    label: 'C',
    name: 'Decent',
    badgeStyle: 'bg-[#34D399]/15 border-[#34D399]/40 text-[#34D399]',
  },
  {
    id: 'D',
    label: 'D',
    name: 'Pass / Casual',
    badgeStyle: 'bg-[#191C29] border-[#292B39] text-[#A1A5B5]',
  },
];

export const AnimeTierListMaker: React.FC<AnimeTierListMakerProps> = ({
  catalogList,
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

  const tierBoardRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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
  };

  const removeFromTier = (animeId: number) => {
    setTierState((prev) => {
      const next: Record<string, Anime[]> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = prev[key].filter((a) => a.id !== animeId);
      });
      return next;
    });
  };

  const handleReset = () => {
    setTierState({ S: [], A: [], B: [], C: [], D: [] });
    showToast('Tier list reset. All titles returned to dock.');
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
    showToast('Loaded sample community tier list rankings!');
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast('Tier list link copied to clipboard!');
  };

  const handleDragStart = (e: React.DragEvent, anime: Anime) => {
    setDraggedAnime(anime);
    e.dataTransfer.setData('text/plain', String(anime.id));
  };

  const handleDragOver = (e: React.DragEvent, tierId: string) => {
    e.preventDefault();
    if (dragOverTier !== tierId) {
      setDragOverTier(tierId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, tierId: string) => {
    if (dragOverTier === tierId) {
      setDragOverTier(null);
    }
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
    showToast(`Generating ${format} snapshot of your tier list...`);

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
        ctx.roundRect(40, 40, 50, 50, 14);
        ctx.fill();
        ctx.fillStyle = '#0B0A10';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('AD', 48, 73);

        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#F4F3FA';
        ctx.fillText('AniDub India • Tier List Rankings', 110, 70);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#A1A5B5';
        ctx.fillText('Official Indian Regional Dub Catalog • Tamil • Telugu • Hindi', 110, 94);

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
          ctx.fillStyle = '#0B0A10';
          ctx.font = 'bold 44px sans-serif';
          ctx.fillText(tier.label, 80, startY + 82);

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
              ctx.fillText(item.title.slice(0, 16), xPos + 10, startY + 55);
              ctx.fillStyle = '#B49AF8';
              ctx.font = '12px sans-serif';
              ctx.fillText('★ ' + (item.rating || 8.5) + '/10', xPos + 10, startY + 80);
              ctx.font = 'bold 15px sans-serif';
            }
          });

          startY += 140;
        });

        ctx.fillStyle = '#A1A5B5';
        ctx.font = '13px sans-serif';
        ctx.fillText('Generated on AniDub India • Official Anime Streaming & Dubbing Hub', 40, 875);

        const mimeType = format === 'JPEG' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(mimeType, 0.95);
        const link = document.createElement('a');
        link.download = `anidub_tier_list_${Date.now()}.${format.toLowerCase()}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Tier list downloaded as ${format}!`);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A10] text-[#F4F3FA] font-sans pb-44 px-4 sm:px-6 pt-6 relative">
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-[#12141E] border border-[#292B39] shadow-2xl flex items-center gap-3 text-[#F4F3FA] text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-[#B49AF8] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#12141E] border border-[#292B39] text-[#F9C876] flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#F4F3FA] tracking-tight">
              Indian Anime Tier List Maker
            </h1>
          </div>
          <p className="text-xs text-[#A1A5B5] mt-1">
            Rank official regional Indian dubbed anime. Drag items from the dock below into the tiers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 rounded-2xl bg-[#12141E] p-2 border border-[#292B39] flex-wrap justify-center select-none">
          <div className="flex items-center bg-[#191C29] rounded-xl p-0.5 border border-[#292B39]">
            {(['PNG', 'JPEG'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer ${
                  format === fmt
                    ? 'bg-[#B49AF8] text-[#0B0A10]'
                    : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <button
            onClick={handleSamplePreset}
            className="w-10 h-10 rounded-xl bg-[#191C29] hover:bg-[#292B39] text-[#F9C876] transition-colors duration-150 cursor-pointer border border-[#292B39] flex items-center justify-center"
            title="Load sample ranking"
            aria-label="Load sample ranking"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            onClick={handleReset}
            className="w-10 h-10 rounded-xl bg-[#191C29] hover:bg-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] transition-colors duration-150 cursor-pointer border border-[#292B39] flex items-center justify-center"
            title="Reset tier list"
            aria-label="Reset tier list"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <Button
            onClick={handleDownloadImage}
            disabled={isExporting}
            variant="primary"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            title="Download Tier List Image"
          >
            {isExporting ? 'Exporting...' : 'Download'}
          </Button>

          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-xl bg-[#191C29] hover:bg-[#292B39] text-[#B49AF8] transition-colors duration-150 cursor-pointer border border-[#292B39] flex items-center justify-center"
            title="Share Tier List link"
            aria-label="Share Tier List link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTRAL TIER BOARD */}
      <div
        ref={tierBoardRef}
        className="max-w-6xl mx-auto p-4 sm:p-6 bg-[#12141E] rounded-2xl border border-[#292B39] shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#292B39]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B49AF8] flex items-center justify-center text-[#0B0A10] font-black text-sm">
              AD
            </div>
            <div>
              <h3 className="text-sm font-black text-[#F4F3FA] tracking-wide">AniDub India • Tier List Rankings</h3>
              <p className="text-[10px] text-[#A1A5B5]">Official Indian Dubbed Anime Directory</p>
            </div>
          </div>
          <span className="text-[10px] text-[#B49AF8] font-bold bg-[#191C29] border border-[#292B39] px-3 py-1 rounded-full">
            Regional Dub Edition
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {TIERS.map((tier) => {
            const items = tierState[tier.id] || [];
            const isTargeted = dragOverTier === tier.id;

            return (
              <div
                key={tier.id}
                onDragOver={(e) => handleDragOver(e, tier.id)}
                onDragLeave={(e) => handleDragLeave(e, tier.id)}
                onDrop={(e) => handleDropOnTier(e, tier.id)}
                className={`relative flex flex-col sm:flex-row items-center sm:items-stretch rounded-xl p-2.5 sm:p-3 bg-[#191C29] border transition-colors duration-150 gap-3 sm:gap-4 ${
                  isTargeted
                    ? 'border-[#B49AF8] bg-[#191C29]'
                    : 'border-[#292B39]'
                }`}
              >
                <div className="flex sm:flex-col items-center justify-between sm:justify-center w-full sm:w-auto shrink-0 select-none">
                  <div
                    className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl border ${tier.badgeStyle} flex flex-col items-center justify-center shrink-0`}
                  >
                    <span className="text-2xl sm:text-3xl font-heading font-black tracking-tight leading-none">
                      {tier.label}
                    </span>
                    <span className="text-[8px] uppercase font-black tracking-widest mt-0.5 opacity-80 sm:block hidden">
                      Tier
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#A1A5B5] sm:mt-1.5 text-center truncate max-w-[80px]">
                    {items.length} {items.length === 1 ? 'title' : 'titles'}
                  </span>
                </div>

                {/* Right Items / Drag & Drop Zone */}
                <div className="flex-1 w-full flex flex-wrap gap-2.5 sm:gap-3 items-center min-h-[85px] sm:min-h-[95px]">
                  {items.length === 0 ? (
                    <div
                      className={`w-full min-h-[85px] sm:min-h-[95px] flex flex-col items-center justify-center border rounded-xl py-4 px-3 text-xs select-none transition-colors duration-150 ${
                        isTargeted
                          ? 'border-solid border-[#B49AF8] bg-[#B49AF8]/10 text-[#B49AF8]'
                          : 'border-dashed border-[#292B39] text-[#A1A5B5]'
                      }`}
                    >
                      <Layers className="w-4 h-4 mb-1 opacity-60" />
                      <span className="font-medium">
                        {isTargeted ? `Drop here to rank in ${tier.label} Tier!` : `Drag & drop anime cards into ${tier.label} Tier`}
                      </span>
                    </div>
                  ) : (
                    <>
                      {items.map((anime, idx) => (
                        <div
                          key={`tier_${tier.id}_anime_${anime.id}_${idx}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, anime)}
                          className="relative group w-16 sm:w-20 aspect-[3/4] rounded-xl overflow-hidden bg-[#12141E] border border-[#292B39] shrink-0 cursor-grab active:cursor-grabbing hover:border-[#B49AF8] transition-colors duration-150 select-none"
                          title={anime.title}
                        >
                          <img
                            src={anime.cover_image ? anime.cover_image : '/logo.png'}
                            alt={anime.title}
                            width={160}
                            height={213}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.src = '/logo.png';
                            }}
                            className="w-full h-full object-cover"
                          />

                          <div className="absolute inset-0 bg-[#0B0A10]/85 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-between p-1.5 text-[9px] text-[#F4F3FA]">
                            <button
                              onClick={() => removeFromTier(anime.id)}
                              className="self-end w-6 h-6 rounded-full bg-[#F87171] text-[#0B0A10] font-bold flex items-center justify-center cursor-pointer"
                              title="Remove to pool"
                            >
                              ✕
                            </button>
                            <span className="truncate font-bold leading-tight">{anime.title}</span>
                          </div>
                        </div>
                      ))}
                      {isTargeted && (
                        <div className="w-16 sm:w-20 aspect-[3/4] rounded-xl border-2 border-solid border-[#B49AF8] bg-[#B49AF8]/15 flex items-center justify-center text-[#B49AF8] text-xs font-bold">
                          + Drop
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FLOATING BOTTOM PANEL (Unranked Anime Pool) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 sm:px-6 pb-4 sm:pb-6 pointer-events-none">
        <div className="max-w-5xl mx-auto bg-[#12141E] border border-[#292B39] rounded-2xl p-4 sm:p-5 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between pb-3 border-b border-[#292B39] gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#191C29] border border-[#292B39] text-[#B49AF8] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-[#F4F3FA] uppercase tracking-wider flex items-center gap-2">
                  <span>Unranked Anime Pool</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#191C29] text-[10px] font-bold text-[#B49AF8] border border-[#292B39]">
                    {unrankedPool.length}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center bg-[#191C29] rounded-xl p-0.5 border border-[#292B39]">
                {['All', 'Hindi', 'Tamil', 'Telugu'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setSelectedLanguage(l)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors duration-150 cursor-pointer ${
                      selectedLanguage === l
                        ? 'bg-[#B49AF8] text-[#0B0A10]'
                        : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
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
                  placeholder="Filter cards..."
                  className="w-full bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-xl pl-8 pr-2.5 py-1.5 text-[11px] text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-150"
                />
              </div>

              <button
                onClick={() => setIsDockExpanded(!isDockExpanded)}
                className="w-8 h-8 rounded-xl bg-[#191C29] hover:bg-[#292B39] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-150 cursor-pointer"
                title={isDockExpanded ? 'Collapse Dock' : 'Expand Dock'}
                aria-label={isDockExpanded ? 'Collapse Dock' : 'Expand Dock'}
              >
                {isDockExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isDockExpanded && (
            <div className="pt-3">
              {unrankedPool.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#A1A5B5] italic flex flex-col items-center justify-center gap-1">
                  <Sparkles className="w-4 h-4 text-[#F9C876]" />
                  <span>All available titles have been ranked into tiers!</span>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-1.5 px-0.5">
                  {unrankedPool.map((anime, idx) => (
                    <div
                      key={`dock_anime_${anime.id}_${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, anime)}
                      className="relative group w-16 sm:w-20 aspect-[3/4] rounded-xl overflow-hidden bg-[#191C29] border border-[#292B39] shrink-0 cursor-grab active:cursor-grabbing hover:border-[#B49AF8] transition-colors duration-150 select-none"
                      title={`${anime.title} - Drag into tier`}
                    >
                      <img
                        src={anime.cover_image ? anime.cover_image : '/logo.png'}
                        alt={anime.title}
                        width={160}
                        height={213}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.src = '/logo.png';
                        }}
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-[#0B0A10] to-transparent z-20 pointer-events-none">
                        <p className="text-[9px] font-bold text-[#F4F3FA] truncate">
                          {anime.title}
                        </p>
                      </div>

                      {/* Quick Tier Select Overlay on Hover */}
                      <div className="absolute inset-0 z-30 bg-[#0B0A10]/90 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-center items-center gap-1.5 p-1">
                        <span className="text-[8px] font-black uppercase tracking-wider text-[#B49AF8]">Quick Rank:</span>
                        <div className="flex flex-wrap justify-center gap-1">
                          {TIERS.map((t) => (
                            <button
                              key={`dock_assign_${anime.id}_tier_${t.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                assignToTier(anime, t.id);
                              }}
                              className={`w-6 h-6 rounded-lg border ${t.badgeStyle} text-[9px] font-black flex items-center justify-center cursor-pointer`}
                              title={`Rank into ${t.label} Tier`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
