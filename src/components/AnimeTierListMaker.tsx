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
  bgGradient: string;
  borderColor: string;
  glowColor: string;
}

const TIERS: TierDefinition[] = [
  { id: 'S', label: 'S', bgGradient: 'from-red-600 via-rose-600 to-pink-600', borderColor: 'border-red-500/50', glowColor: 'shadow-[0_0_25px_rgba(239,68,68,0.25)]' },
  { id: 'A', label: 'A', bgGradient: 'from-amber-500 via-orange-600 to-red-500', borderColor: 'border-amber-500/50', glowColor: 'shadow-[0_0_25px_rgba(245,158,11,0.25)]' },
  { id: 'B', label: 'B', bgGradient: 'from-yellow-400 via-amber-500 to-orange-500', borderColor: 'border-yellow-500/50', glowColor: 'shadow-[0_0_25px_rgba(234,179,8,0.25)]' },
  { id: 'C', label: 'C', bgGradient: 'from-emerald-500 via-teal-600 to-cyan-600', borderColor: 'border-emerald-500/50', glowColor: 'shadow-[0_0_25px_rgba(16,185,129,0.25)]' },
  { id: 'D', label: 'D', bgGradient: 'from-blue-500 via-indigo-600 to-purple-600', borderColor: 'border-blue-500/50', glowColor: 'shadow-[0_0_25px_rgba(59,130,246,0.25)]' },
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnTier = (e: React.DragEvent, tierId: string) => {
    e.preventDefault();
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

        {/* Minimalist Floating Pill Toolbar */}
        <div className="flex items-center gap-2 bg-[#141419]/80 backdrop-blur-2xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
          {/* Format Toggle Pill */}
          <div className="flex items-center bg-black/40 rounded-xl p-0.5 border border-white/5">
            {(['PNG', 'JPEG'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  format === fmt 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <button
            onClick={handleSamplePreset}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-amber-400 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title="Load sample ranking"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
          </button>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title="Reset tier list"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all cursor-pointer disabled:opacity-60"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Share Tier List"
          >
            <Share2 className="w-4 h-4 text-purple-400" />
          </button>
        </div>
      </div>

      {/* CENTRAL TIER BOARD (Sleek Glowing Cards) */}
      <div 
        ref={tierBoardRef}
        className="max-w-6xl mx-auto p-5 sm:p-8 bg-[#0f0f13]/90 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-4"
      >
        {/* Watermark Logo Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-lg ring-2 ring-purple-500/20">
              AD
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-wide">Anidub India • Tier List Rankings</h3>
              <p className="text-[10px] text-neutral-400">Official Indian Dubbed Anime Directory</p>
            </div>
          </div>
          <span className="text-[10px] text-purple-300 font-bold bg-purple-950/80 border border-purple-500/30 px-3 py-1 rounded-full shadow-inner">
            Regional Dub Edition
          </span>
        </div>

        {/* 5 Premium Glowing Tier Rows */}
        <div className="space-y-3.5">
          {TIERS.map((tier) => {
            const items = tierState[tier.id] || [];

            return (
              <div 
                key={tier.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnTier(e, tier.id)}
                className={`flex items-stretch rounded-2xl overflow-hidden border ${tier.borderColor} ${tier.glowColor} bg-[#141419]/80 backdrop-blur-xl transition-all duration-300 min-h-[105px]`}
              >
                {/* Left Neon Tier Letter Box */}
                <div 
                  className={`w-20 sm:w-28 bg-gradient-to-br ${tier.bgGradient} ${tier.textClass} flex items-center justify-center font-heading font-black text-3xl sm:text-4xl shrink-0 shadow-inner select-none`}
                >
                  {tier.label}
                </div>

                {/* Right Items Container */}
                <div className="flex-1 p-3 flex flex-wrap gap-3 items-center min-h-[105px]">
                  {items.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center border border-dashed border-white/10 rounded-xl py-3 text-[11px] text-neutral-500 italic select-none pointer-events-none">
                      Drag and drop anime thumbnails here
                    </div>
                  ) : (
                    items.map((anime, idx) => (
                      <div 
                        key={`tier_${tier.id}_anime_${anime.id}_${idx}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, anime)}
                        className="relative group w-16 sm:w-20 aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border border-white/20 shadow-xl shrink-0 cursor-grab active:cursor-grabbing transition-transform duration-200 hover:scale-110"
                        title={anime.title}
                      >
                        <img 
                          src={anime.cover_image ? anime.cover_image : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                          alt={anime.title}
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                          }}
                          className="w-full h-full object-cover" 
                        />
                        
                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5 text-[9px] text-white">
                          <button
                            onClick={() => removeFromTier(anime.id)}
                            className="self-end p-1 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors cursor-pointer shadow-md"
                            title="Remove to dock"
                          >
                            ✕
                          </button>
                          <span className="truncate font-bold leading-tight">{anime.title}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* STICKY FLOATING GLASSMORPHIC DOCK (Bottom Inventory Pool) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pointer-events-none">
        <div className="max-w-5xl mx-auto bg-[#121217]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 shadow-[0_10px_50px_rgba(0,0,0,0.9)] pointer-events-auto transition-all duration-300">
          
          {/* Dock Header & Toggle */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Unranked Anime Pool ({unrankedPool.length})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Pills */}
              <div className="hidden sm:flex items-center gap-1">
                {['All', 'Hindi', 'Tamil', 'Telugu'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setSelectedLanguage(l)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      selectedLanguage === l
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative w-32 sm:w-40">
                <Search className="w-3 h-3 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter pool..."
                  className="w-full bg-black/50 border border-white/10 focus:border-purple-500 rounded-xl pl-7 pr-2.5 py-1 text-[11px] text-white placeholder-neutral-500 outline-none transition-colors"
                />
              </div>

              <button
                onClick={() => setIsDockExpanded(!isDockExpanded)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 transition-all cursor-pointer"
                title={isDockExpanded ? 'Collapse Dock' : 'Expand Dock'}
              >
                {isDockExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Collapsible Dock Content (Scrollable Thumbnails) */}
          {isDockExpanded && (
            <div className="pt-3">
              {unrankedPool.length === 0 ? (
                <div className="text-center py-4 text-xs text-neutral-500 italic">
                  All available titles have been ranked into tiers!
                </div>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
                  {unrankedPool.map((anime, idx) => (
                    <div 
                      key={`dock_anime_${anime.id}_${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, anime)}
                      className="relative group w-14 sm:w-16 aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border border-white/25 shadow-lg shrink-0 cursor-grab active:cursor-grabbing transition-transform duration-200 hover:scale-110"
                      title={`${anime.title} - Drag into tier`}
                    >
                      <img 
                        src={anime.cover_image ? anime.cover_image : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                        alt={anime.title}
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                        }}
                        className="w-full h-full object-cover" 
                      />

                      {/* Quick Tier Select Overlay on Hover */}
                      <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-1 p-0.5">
                        <span className="text-[8px] font-black text-white">Rank:</span>
                        <div className="flex flex-wrap justify-center gap-0.5">
                          {TIERS.map((t) => (
                            <button
                              key={`dock_assign_${anime.id}_tier_${t.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                assignToTier(anime, t.id);
                              }}
                              className={`w-4 h-4 rounded bg-gradient-to-br ${t.bgGradient} ${t.textClass} text-[9px] font-black flex items-center justify-center hover:scale-125 transition-transform cursor-pointer shadow-sm`}
                              title={`Rank into ${t.label}`}
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
