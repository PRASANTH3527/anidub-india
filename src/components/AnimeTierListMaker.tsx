// ==============================================================================
// AniDub India — Interactive Anime Tier List Maker (Viral Feature)
// Drag-and-drop tier ranking using @dnd-kit/core + High-Res Social Share via html-to-image
// ==============================================================================

'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { toPng } from 'html-to-image';
import {
  Download,
  Share2,
  RotateCcw,
  Sparkles,
  Trophy,
  Search,
  Check,
  Flame,
  ArrowRight,
  Layers,
  HelpCircle,
  Eye,
  Loader2
} from 'lucide-react';
import { Anime } from '../types/anime';
import { useToast } from './Toast';

export interface AnimeTierListMakerProps {
  allAnime: Anime[];
  onSelectAnime?: (anime: Anime) => void;
}

export type TierId = 'S' | 'A' | 'B' | 'C' | 'D';

interface TierDefinition {
  id: TierId;
  label: string;
  sublabel: string;
  headerBg: string;
  rowBorder: string;
}

const TIERS: TierDefinition[] = [
  { id: 'S', label: 'S', sublabel: 'GOD TIER / GOAT', headerBg: 'bg-gradient-to-br from-red-600 to-rose-700 text-white', rowBorder: 'border-red-600/30' },
  { id: 'A', label: 'A', sublabel: 'MASTERPIECE DUB', headerBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white', rowBorder: 'border-amber-500/30' },
  { id: 'B', label: 'B', sublabel: 'GREAT DUB', headerBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white', rowBorder: 'border-emerald-500/30' },
  { id: 'C', label: 'C', sublabel: 'DECENT / WATCHABLE', headerBg: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white', rowBorder: 'border-sky-500/30' },
  { id: 'D', label: 'D', sublabel: 'MID / SKIP', headerBg: 'bg-gradient-to-br from-slate-600 to-neutral-700 text-white', rowBorder: 'border-slate-600/30' },
];

/**
 * Draggable Anime Poster Thumbnail
 */
function DraggableThumbnail({
  anime,
  currentTier,
  onQuickAssign,
  isOverlay = false,
}: {
  anime: Anime;
  currentTier?: TierId | 'pool';
  onQuickAssign?: (animeId: string, targetTier: TierId | 'pool') => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: anime.id,
    data: { anime, currentTier },
    disabled: isOverlay,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  const poster = anime.poster || anime.imageUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative shrink-0 w-20 sm:w-24 aspect-[3/4.2] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none transition-transform duration-200 border border-neutral-700/80 bg-neutral-900 shadow-md ${
        isDragging ? 'opacity-30 scale-95' : 'hover:scale-105 hover:z-20 hover:border-primary-theme'
      } ${isOverlay ? 'scale-110 shadow-2xl ring-4 ring-primary-theme/50 z-50 cursor-grabbing' : ''}`}
    >
      <img
        src={poster}
        alt={anime.title}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover pointer-events-none"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

      {/* Anime Title & Language overlay */}
      <div className="absolute bottom-1 left-1 right-1 pointer-events-none">
        <p className="text-[9px] font-black text-white truncate leading-tight">
          {anime.title}
        </p>
        <span className="text-[7px] font-black text-amber-300 block uppercase">
          {anime.dubs?.[0] || 'Dub'}
        </span>
      </div>

      {/* Quick Move Button for Mobile Touch users */}
      {!isOverlay && onQuickAssign && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <select
            value={currentTier || 'pool'}
            onChange={(e) => {
              e.stopPropagation();
              onQuickAssign(anime.id, e.target.value as any);
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[9px] font-black bg-black/90 text-white rounded px-1 py-0.5 border border-white/20 outline-none cursor-pointer"
            title="Move to tier"
          >
            <option value="pool">Pool</option>
            <option value="S">S</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>
      )}
    </div>
  );
}

/**
 * Droppable Tier Row
 */
function DroppableTierRow({
  tier,
  animeList,
  onQuickAssign,
}: {
  tier: TierDefinition;
  animeList: Anime[];
  onQuickAssign: (animeId: string, targetTier: TierId | 'pool') => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: tier.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-stretch rounded-2xl border overflow-hidden min-h-[120px] transition-all duration-200 ${
        tier.rowBorder
      } ${isOver ? 'bg-primary-theme/15 ring-2 ring-primary-theme shadow-lg' : 'bg-[#131926]/90'}`}
    >
      {/* Left Tier Header Label */}
      <div
        className={`w-24 sm:w-32 shrink-0 flex flex-col items-center justify-center p-3 select-none text-center ${tier.headerBg}`}
      >
        <span className="font-heading font-black text-3xl sm:text-4xl tracking-tighter leading-none">
          {tier.label}
        </span>
        <span className="text-[9px] font-black uppercase tracking-wider mt-1 opacity-90 leading-tight">
          {tier.sublabel}
        </span>
        <span className="text-[10px] font-bold mt-1 bg-black/30 px-2 py-0.5 rounded-full">
          {animeList.length}
        </span>
      </div>

      {/* Droppable Content Area */}
      <div className="flex-grow p-3 flex flex-wrap gap-2.5 items-center content-center min-w-0">
        {animeList.length > 0 ? (
          animeList.map((anime) => (
            <DraggableThumbnail
              key={anime.id}
              anime={anime}
              currentTier={tier.id}
              onQuickAssign={onQuickAssign}
            />
          ))
        ) : (
          <div className="w-full text-center py-6 text-neutral-600 text-xs font-semibold select-none flex items-center justify-center gap-1.5 border-2 border-dashed border-neutral-800/80 rounded-xl">
            <span>Drag anime poster thumbnails here to assign to {tier.label} Tier</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Droppable Unranked Pool Container
 */
function DroppablePool({
  animeList,
  onQuickAssign,
  searchQuery,
  onSearchChange,
}: {
  animeList: Anime[];
  onQuickAssign: (animeId: string, targetTier: TierId | 'pool') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'pool',
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border p-4 transition-all duration-200 ${
        isOver ? 'bg-primary-theme/10 border-primary-theme ring-2 ring-primary-theme/30' : 'bg-[#101623] border-neutral-800'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary-theme/20 border border-primary-theme/30 flex items-center justify-center text-primary-theme font-black text-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-heading font-black text-white text-sm">
              Unranked Anime Pool
            </h4>
            <p className="text-[11px] text-neutral-400">
              Drag posters into rows above, or use the quick dropdown on each card
            </p>
          </div>
        </div>

        {/* Filter Input for Pool */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search unranked pool..."
            className="w-full bg-[#0a0e17] border border-neutral-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-primary-theme"
          />
        </div>
      </div>

      {/* Pool of Cards */}
      <div className="flex flex-wrap gap-2.5 max-h-72 overflow-y-auto p-1 no-scrollbar">
        {animeList.length > 0 ? (
          animeList.map((anime) => (
            <DraggableThumbnail
              key={anime.id}
              anime={anime}
              currentTier="pool"
              onQuickAssign={onQuickAssign}
            />
          ))
        ) : (
          <div className="w-full text-center py-8 text-neutral-500 text-xs">
            {searchQuery ? `No anime found in pool matching "${searchQuery}"` : 'All anime have been ranked into tiers!'}
          </div>
        )}
      </div>
    </div>
  );
}

export const AnimeTierListMaker: React.FC<AnimeTierListMakerProps> = ({
  allAnime,
  onSelectAnime,
}) => {
  const toast = useToast();
  const captureRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [poolSearch, setPoolSearch] = useState('');

  // Sensors for Drag and Drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Map of Tier IDs to anime IDs: { S: [...], A: [...], B: [...], C: [...], D: [...] }
  const [tierAssignments, setTierAssignments] = useState<Record<TierId, string[]>>({
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
  });

  // Calculate unranked pool IDs
  const allRankedIds = useMemo(() => {
    return new Set(Object.values(tierAssignments).flat());
  }, [tierAssignments]);

  const unrankedAnimeList = useMemo(() => {
    const list = allAnime.filter((a) => !allRankedIds.has(a.id));
    if (!poolSearch.trim()) return list;
    const q = poolSearch.toLowerCase();
    return list.filter((a) => a.title.toLowerCase().includes(q) || (a.dubs || []).some(d => d.toLowerCase().includes(q)));
  }, [allAnime, allRankedIds, poolSearch]);

  // Lookup map for fast retrieval
  const animeMap = useMemo(() => {
    const map = new Map<string, Anime>();
    allAnime.forEach((a) => map.set(a.id, a));
    return map;
  }, [allAnime]);

  // Active dragging item
  const activeAnime = activeDragId ? animeMap.get(activeDragId) : null;

  // Handle Drag Start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  // Handle Drag End
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const animeId = String(active.id);
    const targetContainer = String(over.id) as TierId | 'pool';

    assignAnimeToTier(animeId, targetContainer);
  };

  // Unified assignment handler for both drag-and-drop and touch selector
  const assignAnimeToTier = useCallback((animeId: string, targetTier: TierId | 'pool') => {
    setTierAssignments((prev) => {
      const next: Record<TierId, string[]> = {
        S: prev.S.filter((id) => id !== animeId),
        A: prev.A.filter((id) => id !== animeId),
        B: prev.B.filter((id) => id !== animeId),
        C: prev.C.filter((id) => id !== animeId),
        D: prev.D.filter((id) => id !== animeId),
      };

      if (targetTier !== 'pool' && next[targetTier]) {
        next[targetTier].push(animeId);
      }

      return next;
    });
  }, []);

  // Quick preset loader (pre-populates top anime into sample tiers for viral fun)
  const handleAutoPopulate = () => {
    const sorted = [...allAnime].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    setTierAssignments({
      S: sorted.slice(0, 3).map((a) => a.id),
      A: sorted.slice(3, 7).map((a) => a.id),
      B: sorted.slice(7, 11).map((a) => a.id),
      C: sorted.slice(11, 14).map((a) => a.id),
      D: sorted.slice(14, 16).map((a) => a.id),
    });
    toast.success('Sample Tier List Loaded', 'Feel free to drag, rearrange, and download!');
  };

  // Reset tier assignments
  const handleReset = () => {
    setTierAssignments({ S: [], A: [], B: [], C: [], D: [] });
    toast.info('Tier List Reset', 'All anime returned to unranked pool.');
  };

  // Download & Share high-resolution tier list snapshot via html-to-image
  const handleDownloadAndShare = async (triggerShare = false) => {
    if (!captureRef.current) return;
    setIsExporting(true);

    try {
      // Capture element DOM with 2x pixel ratio for crystal clear image quality
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        backgroundColor: '#0b0f17',
        pixelRatio: 2,
        quality: 0.95,
      });

      if (triggerShare && typeof navigator !== 'undefined' && (navigator as any).share) {
        // Convert data URL to Blob for native Web Share API
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'AniDub-India-Tier-List.png', { type: 'image/png' });

        if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({
            title: 'My AniDub India Anime Tier List',
            text: 'Check out my ultimate Indian dubbed anime tier list ranked on AniDub India!',
            files: [file],
          });
          toast.success('Shared Successfully', 'Your tier list image was shared!');
          return;
        }
      }

      // Download file directly
      const link = document.createElement('a');
      link.download = `AniDub-India-Tier-List-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Tier List Downloaded', 'High-res image saved for social media sharing!');
    } catch (err: any) {
      console.error('[Tier List Capture Error]:', err);
      toast.info('Export Notice', 'Could not export image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const totalRanked = allRankedIds.size;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Title & Viral Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-theme/15 border border-primary-theme/30 text-primary-theme text-xs font-black uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Viral Community Feature</span>
          </div>
          <h2 className="font-heading font-black text-2xl sm:text-4xl text-white tracking-tight">
            Indian Dubbed Anime Tier List Maker
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Drag anime from the pool into tiers, then download a high-res image to debate on Instagram, Twitter & WhatsApp!
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleAutoPopulate}
            className="px-3.5 py-2 rounded-xl bg-[#131926] hover:bg-[#1a2336] text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Sample Template</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-[#131926] hover:bg-[#1a2336] text-neutral-400 hover:text-neutral-200 border border-neutral-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Reset tier list"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Download Image Button */}
          <button
            type="button"
            onClick={() => handleDownloadAndShare(false)}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl btn-primary-theme text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExporting ? 'Generating...' : 'Download Image'}</span>
          </button>

          {/* Social Share Button */}
          <button
            type="button"
            onClick={() => handleDownloadAndShare(true)}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
            title="Share image to social apps"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* DND Context for drag and drop */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Tier Board Captured for High-Res Social Media Export */}
        <div
          ref={captureRef}
          className="p-4 sm:p-6 bg-[#0b0f17] rounded-3xl border border-neutral-800/80 shadow-2xl space-y-3"
        >
          {/* Header watermark in saved snapshot */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-primary-theme flex items-center justify-center font-black text-white text-xs shadow-md">
                AD
              </div>
              <div>
                <span className="font-heading font-black text-sm text-white tracking-tight block">
                  AniDub India — Dubbed Anime Tier List
                </span>
                <span className="text-[10px] text-neutral-500 font-semibold block">
                  Tamil, Telugu, Hindi, Malayalam & Kannada Dubs • anidub.in
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-black text-purple-400">
                {totalRanked} Anime Ranked
              </span>
            </div>
          </div>

          {/* The 5 Main Tier Rows (S, A, B, C, D) */}
          <div className="space-y-3">
            {TIERS.map((tier) => {
              const assignedIds = tierAssignments[tier.id] || [];
              const tierAnimeList = assignedIds
                .map((id) => animeMap.get(id))
                .filter(Boolean) as Anime[];

              return (
                <DroppableTierRow
                  key={tier.id}
                  tier={tier}
                  animeList={tierAnimeList}
                  onQuickAssign={assignAnimeToTier}
                />
              );
            })}
          </div>

          {/* Snapshot Footer Branding */}
          <div className="pt-2 flex items-center justify-between text-[10px] text-neutral-500 font-bold px-1">
            <span>Rank your own favorites at anidub.in/tierlist</span>
            <span>Made with ❤️ for Indian Anime Fans</span>
          </div>
        </div>

        {/* Drag Overlay (Renders smooth visual under cursor while dragging) */}
        <DragOverlay>
          {activeAnime ? <DraggableThumbnail anime={activeAnime} isOverlay /> : null}
        </DragOverlay>

        {/* Bottom Unranked Anime Pool */}
        <DroppablePool
          animeList={unrankedAnimeList}
          onQuickAssign={assignAnimeToTier}
          searchQuery={poolSearch}
          onSearchChange={setPoolSearch}
        />
      </DndContext>
    </div>
  );
};

export default AnimeTierListMaker;
