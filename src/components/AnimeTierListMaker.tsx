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
  ChevronDown
} from 'lucide-react';
import { Anime } from './CatalogView';

export interface AnimeTierListMakerProps {
  catalogList: Anime[];
  onSelectAnime?: (anime: Anime) => void;
  onNavigateHome?: () => void;
}

interface TierDefinition {
  id: string;
  label: string;
  name: string;
  bgGradient: string;
  glowShadow: string;
  borderColor: string;
  textClass: string;
}

const TIERS: TierDefinition[] = [
  { 
    id: 'S', 
    label: 'S', 
    name: 'Masterpiece',
    bgGradient: 'bg-gradient-to-br from-red-500 via-rose-500 to-pink-600', 
    glowShadow: 'shadow-lg shadow-red-500/35 ring-1 ring-red-400/40', 
    borderColor: 'border-red-500/30',
    textClass: 'text-white font-black' 
  },
  { 
    id: 'A', 
    label: 'A', 
    name: 'Top Tier',
    bgGradient: 'bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500', 
    glowShadow: 'shadow-lg shadow-orange-500/35 ring-1 ring-orange-400/40', 
    borderColor: 'border-orange-500/30',
    textClass: 'text-white font-black' 
  },
  { 
    id: 'B', 
    label: 'B', 
    name: 'Great Watch',
    bgGradient: 'bg-gradient-to-br from-amber-400 via-yellow-400 to-lime-500', 
    glowShadow: 'shadow-lg shadow-yellow-400/35 ring-1 ring-yellow-300/40', 
    borderColor: 'border-yellow-500/30',
    textClass: 'text-neutral-950 font-black' 
  },
  { 
    id: 'C', 
    label: 'C', 
    name: 'Decent',
    bgGradient: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500', 
    glowShadow: 'shadow-lg shadow-emerald-500/35 ring-1 ring-emerald-400/40', 
    borderColor: 'border-emerald-500/30',
    textClass: 'text-white font-black' 
  },
  { 
    id: 'D', 
    label: 'D', 
    name: 'Pass / Casual',
    bgGradient: 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600', 
    glowShadow: 'shadow-lg shadow-blue-500/35 ring-1 ring-blue-400/40', 
    borderColor: 'border-blue-500/30',
    textClass: 'text-white font-black' 
  },
];

export const AnimeTierListMaker: React.FC<AnimeTierListMakerProps> = ({
  catalogList,
  onSelectAnime,
  onNavigateHome
}) => {
  const [tierState, setTierState] = useState<Record<string, Anime[]>>({
    S: [],
    A: [],
    B: [],
    C: [],
    D: []
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
    const matchesQuery = !searchQuery.trim() || 
      anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (anime.genres && anime.genres.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLang = selectedLanguage === 'All' || 
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
      D: items.slice(11, 13)
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

  const handleDragLeave = (e: React.DragEvent, tierId: string) => {
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
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Watermark Logo
        ctx.fillStyle = '#9333ea';
        ctx.beginPath();
        ctx.roundRect(40, 40, 50, 50, 14);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('AD', 48, 73);

        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Anidub India • Tier List Rankings', 110, 70);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('Official Indian Regional Dub Catalog • Tamil • Telugu • Hindi', 110, 94);

        const tierLabels = [
          { label: 'S', color: '#ef4444', items: tierState.S },
          { label: 'A', color: '#f59e0b', items: tierState.A },
          { label: 'B', color: '#eab308', items: tierState.B },
          { label: 'C', color: '#10b981', items: tierState.C },
          { label: 'D', color: '#3b82f6', items: tierState.D },
        ];

        let startY = 135;
        tierLabels.forEach((tier) => {
          ctx.fillStyle = tier.color;
          ctx.beginPath();
          ctx.roundRect(40, startY, 110, 125, 12);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 44px sans-serif';
          ctx.fillText(tier.label, 80, startY + 82);

          ctx.fillStyle = '#121216';
          ctx.beginPath();
          ctx.roundRect(155, startY, canvas.width - 195, 125, 12);
          ctx.fill();

          ctx.fillStyle = '#e5e7eb';
          ctx.font = 'bold 15px sans-serif';
          tier.items.forEach((item, idx) => {
            if (idx < 5) {
              const xPos = 175 + idx * 190;
              ctx.fillStyle = '#1c1c24';
              ctx.beginPath();
              ctx.roundRect(xPos, startY + 12, 170, 100, 10);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.fillText(item.title.slice(0, 16), xPos + 10, startY + 55);
              ctx.fillStyle = '#a855f7';
              ctx.font = '12px sans-serif';
              ctx.fillText('★ ' + (item.rating || 8.5) + '/10', xPos + 10, startY + 80);
              ctx.font = 'bold 15px sans-serif';
            }
          });

          startY += 140;
        });

        ctx.fillStyle = '#6b7280';
        ctx.font = '13px sans-serif';
        ctx.fillText('Generated on Anidub India • Official Anime Streaming & Dubbing Hub', 40, 875);

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
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 font-sans pb-44 px-4 sm:px-6 pt-6 relative selection:bg-purple-500/30">
      
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-[#141419]/95 border border-purple-500/60 backdrop-blur-2xl shadow-2xl flex items-center gap-3 text-white text-xs font-semibold animate-fadeIn">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FLOATING GLASSMORPHIC TOOLBAR (Top Right) */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg">
              <Trophy className="w-5 h-5" />
            </div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight">
              Indian Anime Tier List Maker
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Rank official regional Indian dubbed anime. Drag items from the glass dock below into the tiers.
          </p>
        </div>

        {/* Sleek Pill-Shaped Glass Floating Dock for Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/10 backdrop-blur-md p-2 border border-white/15 shadow-xl shadow-black/40 flex-wrap justify-center select-none">
          {/* Format Toggle Pill */}
          <div className="flex items-center bg-black/40 rounded-full p-0.5 border border-white/10">
            {(['PNG', 'JPEG'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  format === fmt 
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-900/50' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <button
            onClick={handleSamplePreset}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-amber-400 transition-all cursor-pointer border border-white/10 hover:border-amber-400/40 shadow-sm"
            title="Load sample ranking"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
          </button>

          <button
            onClick={handleReset}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-all cursor-pointer border border-white/10 hover:border-white/30 shadow-sm"
            title="Reset tier list"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white text-xs font-black shadow-lg shadow-purple-500/30 transition-all cursor-pointer disabled:opacity-50"
            title="Download Tier List Image"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Download'}</span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-purple-300 transition-all cursor-pointer border border-white/10 hover:border-purple-400/40 shadow-sm"
            title="Share Tier List link"
          >
            <Share2 className="w-4 h-4 text-purple-400" />
          </button>
        </div>
      </div>

      {/* CENTRAL TIER BOARD (Floating Glass Cards with Neon Badges) */}
      <div 
        ref={tierBoardRef}
        className="max-w-6xl mx-auto p-4 sm:p-6 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.7)] space-y-4"
      >
        {/* Watermark Logo Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-purple-600/30 ring-1 ring-white/20">
              AD
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-wide">Anidub India • Tier List Rankings</h3>
              <p className="text-[10px] text-neutral-400">Official Indian Dubbed Anime Directory</p>
            </div>
          </div>
          <span className="text-[10px] text-purple-300 font-bold bg-white/5 border border-purple-500/30 px-3 py-1 rounded-full shadow-inner">
            Regional Dub Edition
          </span>
        </div>

        {/* Floating Glassmorphism Tier Rows with gap-3 */}
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
                className={`relative flex flex-col sm:flex-row items-center sm:items-stretch rounded-2xl p-2.5 sm:p-3 bg-white/5 backdrop-blur-md border transition-all duration-300 gap-3 sm:gap-4 shadow-lg shadow-black/40 ${
                  isTargeted
                    ? 'border-purple-400 ring-2 ring-purple-500/50 bg-white/[0.08] shadow-[0_0_35px_rgba(168,85,247,0.35)]'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Left Floating Neon Gradient Badge */}
                <div className="flex sm:flex-col items-center justify-between sm:justify-center w-full sm:w-auto shrink-0 select-none">
                  <div 
                    className={`w-14 h-14 sm:w-20 sm:h-20 rounded-2xl ${tier.bgGradient} ${tier.glowShadow} ${tier.textClass} flex flex-col items-center justify-center shadow-lg transition-transform duration-200 hover:scale-105 shrink-0`}
                  >
                    <span className="text-2xl sm:text-3xl font-heading font-black tracking-tight leading-none drop-shadow-md">
                      {tier.label}
                    </span>
                    <span className="text-[8px] uppercase font-black tracking-widest mt-0.5 opacity-80 sm:block hidden">
                      Tier
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-neutral-400 sm:mt-1.5 text-center truncate max-w-[80px]">
                    {items.length} {items.length === 1 ? 'title' : 'titles'}
                  </span>
                </div>

                {/* Right Items / Drag & Drop Zone */}
                <div className="flex-1 w-full flex flex-wrap gap-2.5 sm:gap-3 items-center min-h-[85px] sm:min-h-[95px]">
                  {items.length === 0 ? (
                    <div 
                      className={`w-full min-h-[85px] sm:min-h-[95px] flex flex-col items-center justify-center border rounded-xl py-4 px-3 text-xs select-none transition-all duration-200 ${
                        isTargeted 
                          ? 'border-solid border-purple-400 bg-purple-500/15 text-purple-200 shadow-inner ring-1 ring-purple-400/50' 
                          : 'border-dashed border-white/20 text-neutral-400 hover:border-white/30'
                      }`}
                    >
                      <Layers className={`w-4 h-4 mb-1 transition-transform ${isTargeted ? 'scale-125 text-purple-300 animate-bounce' : 'opacity-40'}`} />
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
                          className="relative group w-16 sm:w-20 aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border border-white/20 shadow-md shrink-0 cursor-grab active:cursor-grabbing hover:scale-105 hover:border-purple-400/80 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-200 select-none"
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
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                          />
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5 text-[9px] text-white">
                            <button
                              onClick={() => removeFromTier(anime.id)}
                              className="self-end p-1 rounded-full bg-red-600/90 hover:bg-red-500 text-white transition-all cursor-pointer shadow-md hover:scale-110"
                              title="Remove to pool"
                            >
                              ✕
                            </button>
                            <span className="truncate font-bold leading-tight drop-shadow">{anime.title}</span>
                          </div>
                        </div>
                      ))}
                      {isTargeted && (
                        <div className="w-16 sm:w-20 aspect-[3/4] rounded-xl border-2 border-solid border-purple-400 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center text-purple-200 text-xs font-bold animate-pulse">
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

      {/* FLOATING BOTTOM GLASS PANEL (Unranked Anime Pool) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 sm:px-6 pb-4 sm:pb-6 pointer-events-none">
        <div className="max-w-5xl mx-auto bg-black/75 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] pointer-events-auto transition-all duration-300 ring-1 ring-white/10">
          
          {/* Dock Header & Filter Controls */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shadow-inner">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Unranked Anime Pool</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-purple-300 border border-white/10">
                    {unrankedPool.length}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Filter */}
              <div className="hidden sm:flex items-center bg-black/40 rounded-xl p-0.5 border border-white/10">
                {['All', 'Hindi', 'Tamil', 'Telugu'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setSelectedLanguage(l)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      selectedLanguage === l
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative w-36 sm:w-44">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter cards..."
                  className="w-full bg-black/50 border border-white/10 focus:border-purple-400/80 rounded-xl pl-8 pr-2.5 py-1 text-[11px] text-white placeholder-neutral-500 outline-none transition-colors"
                />
              </div>

              <button
                onClick={() => setIsDockExpanded(!isDockExpanded)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-sm"
                title={isDockExpanded ? 'Collapse Dock' : 'Expand Dock'}
              >
                {isDockExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Collapsible Dock Content: Trading Cards Pool */}
          {isDockExpanded && (
            <div className="pt-3">
              {unrankedPool.length === 0 ? (
                <div className="text-center py-6 text-xs text-neutral-400 italic flex flex-col items-center justify-center gap-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>All available titles have been ranked into tiers!</span>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-1.5 px-0.5">
                  {unrankedPool.map((anime, idx) => (
                    <div 
                      key={`dock_anime_${anime.id}_${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, anime)}
                      className="relative group w-16 sm:w-20 aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900 border border-white/20 shadow-xl shrink-0 cursor-grab active:cursor-grabbing hover:scale-105 hover:border-purple-400/80 hover:shadow-2xl hover:shadow-purple-500/30 transition-transform duration-200 select-none before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/85 before:via-transparent before:to-white/10 before:pointer-events-none before:z-10"
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
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                      />

                      {/* Card Title Snippet at bottom */}
                      <div className="absolute bottom-0 inset-x-0 p-1.5 z-20 pointer-events-none">
                        <p className="text-[9px] font-bold text-white truncate drop-shadow-md">
                          {anime.title}
                        </p>
                      </div>

                      {/* Quick Tier Select Overlay on Hover */}
                      <div className="absolute inset-0 z-30 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-1.5 p-1 backdrop-blur-xs">
                        <span className="text-[8px] font-black uppercase tracking-wider text-purple-300">Quick Rank:</span>
                        <div className="flex flex-wrap justify-center gap-1">
                          {TIERS.map((t) => (
                            <button
                              key={`dock_assign_${anime.id}_tier_${t.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                assignToTier(anime, t.id);
                              }}
                              className={`w-5 h-5 rounded-lg ${t.bgGradient} ${t.textClass} text-[9px] font-black flex items-center justify-center hover:scale-125 transition-transform cursor-pointer shadow-md`}
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
