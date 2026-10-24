import React, { useState, useRef } from 'react';
import { 
  Trophy, 
  Sparkles, 
  RotateCcw, 
  Download, 
  Share2, 
  Search, 
  Flame, 
  X, 
  Plus, 
  Layers, 
  ChevronRight, 
  Check, 
  Star,
  Film
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
  bgClass: string;
  textClass: string;
  borderColor: string;
}

const TIERS: TierDefinition[] = [
  { id: 'S', label: 'S', bgClass: 'bg-[#ff7f7f]', textClass: 'text-black', borderColor: 'border-[#ff7f7f]' },
  { id: 'A', label: 'A', bgClass: 'bg-[#ffbf7f]', textClass: 'text-black', borderColor: 'border-[#ffbf7f]' },
  { id: 'B', label: 'B', bgClass: 'bg-[#ffff7f]', textClass: 'text-black', borderColor: 'border-[#ffff7f]' },
  { id: 'C', label: 'C', bgClass: 'bg-[#7fff7f]', textClass: 'text-black', borderColor: 'border-[#7fff7f]' },
  { id: 'D', label: 'D', bgClass: 'bg-[#7fbfff]', textClass: 'text-black', borderColor: 'border-[#7fbfff]' },
];

export const AnimeTierListMaker: React.FC<AnimeTierListMakerProps> = ({
  catalogList,
  onSelectAnime,
  onNavigateHome
}) => {
  // Map of tierId -> array of anime objects
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
  const tierBoardRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Set of anime IDs currently assigned to tiers
  const assignedIds = new Set(
    Object.values(tierState).flatMap((list) => list.map((a) => a.id))
  );

  // Unranked anime pool
  const unrankedPool = catalogList.filter((anime) => {
    if (assignedIds.has(anime.id)) return false;
    const matchesQuery = !searchQuery.trim() || 
      anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (anime.genres && anime.genres.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLang = selectedLanguage === 'All' || 
      (anime.languages && anime.languages.toLowerCase().includes(selectedLanguage.toLowerCase()));

    return matchesQuery && matchesLang;
  });

  // Assign an anime to a specific tier
  const assignToTier = (anime: Anime, tierId: string) => {
    setTierState((prev) => {
      // Remove from all other tiers first
      const next: Record<string, Anime[]> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = prev[key].filter((a) => a.id !== anime.id);
      });
      next[tierId] = [...(next[tierId] || []), anime];
      return next;
    });
  };

  // Remove an anime from tiers back to unranked pool
  const removeFromTier = (animeId: number) => {
    setTierState((prev) => {
      const next: Record<string, Anime[]> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = prev[key].filter((a) => a.id !== animeId);
      });
      return next;
    });
  };

  // Reset tier board
  const handleReset = () => {
    setTierState({ S: [], A: [], B: [], C: [], D: [] });
    showToast('Tier list reset. All titles returned to pool.');
  };

  // Sample Preset
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

  // Share tier list
  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast('Tier list link copied to clipboard!');
  };

  // Download image export
  const handleDownloadImage = () => {
    setIsExporting(true);
    showToast(`Generating ${format} snapshot of your Indian Dub tier list...`);
    
    // Create an HTML Canvas representation
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Background
        ctx.fillStyle = '#0b0f17';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Header Title
        ctx.fillStyle = '#9333ea';
        ctx.fillRect(40, 40, 60, 60);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('AD', 52, 80);

        ctx.font = 'bold 36px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Anidub India • Regional Dub Tier List', 120, 75);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('Official Indian Dubbed Anime Rankings • Tamil • Telugu • Hindi', 120, 100);

        // Render Tier Rows
        const tierLabels = [
          { label: 'S', color: '#ff7f7f', items: tierState.S },
          { label: 'A', color: '#ffbf7f', items: tierState.A },
          { label: 'B', color: '#ffff7f', items: tierState.B },
          { label: 'C', color: '#7fff7f', items: tierState.C },
          { label: 'D', color: '#7fbfff', items: tierState.D },
        ];

        let startY = 140;
        tierLabels.forEach((tier) => {
          // Tier box
          ctx.fillStyle = tier.color;
          ctx.fillRect(40, startY, 120, 130);
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 48px sans-serif';
          ctx.fillText(tier.label, 85, startY + 80);

          // Row background
          ctx.fillStyle = '#131926';
          ctx.fillRect(160, startY, canvas.width - 200, 130);

          // Draw item text or badges
          ctx.fillStyle = '#e5e7eb';
          ctx.font = 'bold 16px sans-serif';
          tier.items.forEach((item, idx) => {
            if (idx < 5) {
              const xPos = 180 + idx * 190;
              ctx.fillStyle = '#1e243b';
              ctx.fillRect(xPos, startY + 15, 175, 100);
              ctx.fillStyle = '#ffffff';
              ctx.fillText(item.title.slice(0, 16), xPos + 10, startY + 60);
              ctx.fillStyle = '#a855f7';
              ctx.font = '12px sans-serif';
              ctx.fillText('★ ' + (item.rating || 8.5) + '/10', xPos + 10, startY + 85);
              ctx.font = 'bold 16px sans-serif';
            }
          });

          startY += 145;
        });

        // Watermark footer
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.fillText('Generated on Anidub India • Official Anime Streaming & Dubbing Hub', 40, 880);

        // Download canvas
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-sans">
      
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-[#131926]/95 border border-primary-theme/60 backdrop-blur-xl shadow-2xl flex items-center gap-3 text-white text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. TOP HEADER & ACTION CONTROLS */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-2 border-b border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight">
              Indian Anime Tier List Maker
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Rank official regional Indian dubbed anime across S, A, B, C, and D tiers and export shareable images.
          </p>
        </div>

        {/* Action Controls Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Format Selector (PNG/JPEG) */}
          <div className="flex items-center p-1 rounded-xl bg-[#131926] border border-neutral-800">
            {(['PNG', 'JPEG'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  format === fmt ? 'bg-primary-theme text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Sample Preset */}
          <button
            onClick={handleSamplePreset}
            className="h-9 px-3 rounded-xl bg-[#131926] border border-neutral-800 hover:border-amber-500/50 text-neutral-300 hover:text-amber-400 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Load sample community ranking"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Preset</span>
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="h-9 px-3 rounded-xl bg-[#131926] border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset tier list"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Download Image */}
          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="btn-primary-theme h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer hover:opacity-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Download Image'}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="h-9 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* 2. TIER BOARD */}
      <div 
        ref={tierBoardRef}
        className="p-4 sm:p-6 bg-[#0b0f17] rounded-3xl border border-neutral-800/80 shadow-2xl space-y-3"
      >
        {/* Snapshot Header Branding (AD logo box) */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-md">
              AD
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Anidub India Tier List</h3>
              <p className="text-[10px] text-neutral-400">Official Indian Dubbed Anime Directory</p>
            </div>
          </div>
          <span className="text-[10px] text-primary-theme font-bold bg-purple-950/80 border border-purple-500/30 px-2.5 py-1 rounded-full">
            Regional Dub Edition
          </span>
        </div>

        {/* 5 DroppableTierRow rows (S, A, B, C, D) */}
        <div className="space-y-2.5">
          {TIERS.map((tier) => {
            const items = tierState[tier.id] || [];

            return (
              <div 
                key={tier.id}
                className="flex items-stretch rounded-2xl overflow-hidden border border-neutral-800 shadow-md min-h-[90px]"
              >
                {/* Left Label Box */}
                <div 
                  className={`w-20 sm:w-28 ${tier.bgClass} ${tier.textClass} flex items-center justify-center font-heading font-black text-2xl sm:text-3xl shrink-0 shadow-inner select-none`}
                >
                  {tier.label}
                </div>

                {/* Right Items Container */}
                <div className="flex-1 p-2 sm:p-2.5 bg-[#131926]/90 flex flex-wrap gap-2 items-center min-h-[90px]">
                  {items.length === 0 ? (
                    <div className="text-xs text-neutral-500 italic px-3 py-2">
                      Click any anime in the pool below to assign to {tier.label} Tier
                    </div>
                  ) : (
                    items.map((anime) => (
                      <div 
                        key={anime.id}
                        className="relative group w-16 sm:w-20 aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-700/80 shadow-md shrink-0 cursor-pointer"
                        title={anime.title}
                      >
                        <img 
                          src={anime.cover_image ? anime.cover_image : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                          alt={anime.title}
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1 text-[9px] text-white">
                          <button
                            onClick={() => removeFromTier(anime.id)}
                            className="self-end p-0.5 rounded bg-red-600 text-white hover:bg-red-500"
                            title="Remove back to pool"
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

      {/* 3. UNRANKED ANIME POOL */}
      <div className="bg-[#101623] border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        
        {/* Pool Header & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-theme" />
              <span>Unranked Anime Pool ({unrankedPool.length})</span>
            </h3>
            <p className="text-[11px] text-neutral-400">
              Tap an anime thumbnail to assign to a tier, or filter by dub language:
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Dub Language Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {['All', 'Hindi', 'Tamil', 'Telugu'].map((l) => (
                <button
                  key={l}
                  onClick={() => setSelectedLanguage(l)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    selectedLanguage === l
                      ? 'bg-primary-theme text-white'
                      : 'bg-[#182032] border border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-40 sm:w-48">
              <Search className="w-3 h-3 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pool..."
                className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-primary-theme rounded-xl pl-7 pr-2.5 py-1 text-xs text-white placeholder-neutral-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Pool of Draggable/Clickable Thumbnails */}
        {unrankedPool.length === 0 ? (
          <div className="text-center py-10 text-xs text-neutral-500 italic">
            All available titles have been ranked! Use Reset or drag titles to re-organize.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5 max-h-72 overflow-y-auto no-scrollbar p-1">
            {unrankedPool.map((anime) => (
              <div 
                key={anime.id}
                className="relative group w-16 sm:w-20 aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-primary-theme shadow-md shrink-0 cursor-pointer transition-all hover:scale-105"
                title={`${anime.title} - Click to rank`}
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
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-1 p-1">
                  <span className="text-[9px] font-black text-white text-center truncate w-full">
                    Rank into:
                  </span>
                  <div className="flex flex-wrap justify-center gap-1">
                    {TIERS.map((t) => (
                      <button
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          assignToTier(anime, t.id);
                        }}
                        className={`w-5 h-5 rounded ${t.bgClass} ${t.textClass} text-[10px] font-black flex items-center justify-center hover:scale-110 transition-transform`}
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

    </div>
  );
};
