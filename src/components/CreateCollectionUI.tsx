import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Layers, 
  Check, 
  Copy, 
  Share2, 
  Trash2, 
  Search, 
  Film, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  X,
  Plus
} from 'lucide-react';
import { Anime } from './CatalogView';

export interface CreateCollectionUIProps {
  animeList: Anime[];
  onBack: () => void;
  onSelectAnime?: (anime: Anime) => void;
}

const TITLE_SUGGESTIONS = [
  'Top Hindi Dubbed Action',
  'Best Tamil Anime Thrillers',
  'Weekend Telugu Dub Binge',
  'Emotional Dubbed Masterpieces',
  'Top Shonen Indian Dubs'
];

export const CreateCollectionUI: React.FC<CreateCollectionUIProps> = ({
  animeList,
  onBack,
  onSelectAnime
}) => {
  const [collectionTitle, setCollectionTitle] = useState('My Curated Regional Anime Dubs');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState('All');
  const [createdCollection, setCreatedCollection] = useState<{ id: string; title: string; count: number; shareUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSaveCollection = () => {
    if (!collectionTitle.trim() || selectedIds.length === 0) return;
    const colId = `col_${Date.now().toString(36)}`;
    const encoded = encodeURIComponent(collectionTitle.trim());
    const ids = selectedIds.join(',');
    const shareUrl = `${window.location.origin}/?collection=${encoded}&ids=${ids}`;

    const newCol = {
      id: colId,
      title: collectionTitle.trim(),
      count: selectedIds.length,
      shareUrl,
      desc: `Curated regional anime collection with ${selectedIds.length} titles.`
    };

    try {
      const existing = JSON.parse(localStorage.getItem('cf_user_collections') || '[]');
      localStorage.setItem('cf_user_collections', JSON.stringify([newCol, ...existing]));
    } catch {}

    setCreatedCollection(newCol);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyLink = () => {
    if (!createdCollection) return;
    navigator.clipboard?.writeText(createdCollection.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Filter right column catalog
  const filteredCatalog = animeList.filter((anime) => {
    const matchesSearch = !searchQuery.trim() || 
      anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (anime.genres && anime.genres.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLang = selectedLang === 'All' || 
      (anime.languages && anime.languages.toLowerCase().includes(selectedLang.toLowerCase()));

    return matchesSearch && matchesLang;
  });

  // Selected queue anime items
  const queueAnime = animeList.filter(a => selectedIds.includes(a.id));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-neutral-100 font-sans">
      
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-neutral-800">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white text-xs sm:text-sm font-bold mb-3 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Directory</span>
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-primary-theme to-amber-500 flex items-center justify-center shadow-lg shadow-primary-theme/30 text-white shrink-0">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Create Custom Collection
                </h1>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 text-[10px] font-black uppercase">
                  Anonymous & Shareable
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Curate regional dubbed anime into a shareable playlist for your friends and community.
              </p>
            </div>
          </div>
        </div>

        {/* Top Save CTA (when selectedIds.length > 0) */}
        {selectedIds.length > 0 && (
          <button
            onClick={handleSaveCollection}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-theme to-orange-500 text-white font-extrabold text-sm shadow-xl hover:opacity-95 transition-all cursor-pointer whitespace-nowrap self-stretch sm:self-auto text-center"
          >
            Save Collection ({selectedIds.length})
          </button>
        )}
      </div>

      {/* 2. SUCCESS BANNER CARD */}
      {createdCollection && (
        <div className="my-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#121926] via-[#101725] to-[#0a0f1d] border-2 border-emerald-500/40 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            {/* Left */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Collection Saved Successfully</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white">
                {createdCollection.title}
              </h2>

              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span>{createdCollection.count} regional dubbed titles curated</span>
                <span>•</span>
                <span className="bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 text-[11px] font-mono text-neutral-300">
                  ID: #{createdCollection.id}
                </span>
              </div>
            </div>

            {/* Right: Readonly share URL box */}
            <div className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-2.5">
              <div className="w-full sm:w-80 bg-neutral-900 border border-neutral-700/80 rounded-xl p-1.5 flex items-center justify-between">
                <input
                  type="text"
                  readOnly
                  value={createdCollection.shareUrl}
                  className="bg-transparent text-xs text-neutral-300 px-2.5 outline-none w-full truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs px-3 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <button
                onClick={() => {
                  window.open(createdCollection.shareUrl, '_blank');
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary-theme hover:bg-primary-theme/90 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>View Published List</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setCreatedCollection(null);
                  setSelectedIds([]);
                  setCollectionTitle('');
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                New List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 2-COLUMN MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 items-start">
        
        {/* LEFT COLUMN (lg:col-span-5) */}
        <div className="lg:col-span-5">
          <div className="p-6 rounded-3xl bg-neutral-900/70 border border-neutral-800/80 backdrop-blur-md space-y-5 sticky top-20 shadow-xl">
            
            {/* 1. Collection Title * */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                1. Collection Title *
              </label>
              <input
                type="text"
                value={collectionTitle}
                onChange={(e) => setCollectionTitle(e.target.value)}
                placeholder="e.g. Best Tamil Dubbed Action Animes"
                className="w-full px-4 py-3 rounded-2xl bg-neutral-950/80 border border-neutral-700/80 text-sm font-semibold text-white placeholder-neutral-500 focus:outline-none focus:border-primary-theme transition-colors"
              />
            </div>

            {/* Inspiration Preset Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-neutral-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Title Suggestions:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TITLE_SUGGESTIONS.map((sug, sIdx) => (
                  <button
                    key={`suggestion_${sIdx}`}
                    type="button"
                    onClick={() => setCollectionTitle(sug)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-neutral-700/50 text-neutral-300 hover:text-white hover:border-primary-theme/60 transition-colors cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Selected Anime Queue */}
            <div className="space-y-3 pt-2 border-t border-neutral-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    2. Selected Queue
                  </span>
                  <span className="bg-primary-theme/20 text-accent-theme border border-primary-theme/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {selectedIds.length} titles
                  </span>
                </div>

                {selectedIds.length > 0 && (
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-neutral-400 hover:text-red-400 inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear all</span>
                  </button>
                )}
              </div>

              {/* Queue List or Empty State */}
              {queueAnime.length === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed border-neutral-800 text-center space-y-2">
                  <Film className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="text-xs text-neutral-400 font-medium">
                    No anime selected yet.
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Click "Add to List" on any anime card from the catalog on the right.
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {queueAnime.map((anime, idx) => (
                    <div 
                      key={`queue_item_${anime.id}_${idx}`}
                      className="p-2.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-mono text-neutral-500 w-4">
                          {idx + 1}.
                        </span>
                        <img 
                          src={anime.cover_image ? anime.cover_image : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                          alt={anime.title}
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                          }}
                          className="w-8 h-11 rounded-lg object-cover shrink-0 border border-white/10"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate max-w-[170px]">
                            {anime.title}
                          </h4>
                          <span className="text-[10px] text-neutral-400 truncate">
                            {anime.languages || 'Hindi, Tamil, Telugu'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleSelect(anime.id)}
                        className="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                        title="Remove from queue"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Save Button */}
            <button
              onClick={handleSaveCollection}
              disabled={selectedIds.length === 0 || !collectionTitle.trim()}
              className={`w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary-theme via-orange-500 to-amber-500 text-white font-black text-sm shadow-xl transition-all cursor-pointer ${
                selectedIds.length === 0 || !collectionTitle.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-95'
              }`}
            >
              Publish Custom Collection ({selectedIds.length})
            </button>

          </div>
        </div>

        {/* RIGHT COLUMN (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Search & Filter Card */}
          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-neutral-800/80 backdrop-blur-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                Select Anime for Collection
              </h3>
              <span className="text-xs text-neutral-400 font-semibold">
                {filteredCatalog.length} available
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog by title or genre..."
                className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-primary-theme rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
              />
            </div>

            {/* Language filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {['All', 'Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'].map((lang) => {
                const isActive = selectedLang === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => setSelectedLang(lang)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-primary-theme text-white shadow-sm'
                        : 'bg-neutral-800/80 border border-neutral-700/50 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selectable Catalog Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {filteredCatalog.map((anime, idx) => {
              const isSelected = selectedIds.includes(anime.id);
              const languages = anime.languages ? anime.languages.split(',').map((l: string) => l.trim()) : ['Hindi', 'Tamil', 'Telugu'];

              return (
                <div 
                  key={`selectable_anime_${anime.id}_${idx}`}
                  className={`rounded-2xl bg-[#131926] border transition-all overflow-hidden flex flex-col justify-between shadow-md ${
                    isSelected 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/50' 
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* Poster Thumbnail */}
                  <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-neutral-900">
                    <img 
                      src={anime.cover_image ? anime.cover_image : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'}
                      alt={anime.title}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover"
                    />

                    {/* Selected Check Badge */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-lg border border-white/20">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}

                    {/* Bottom-left dub tags */}
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                      {languages.slice(0, 2).map((l, lIdx) => (
                        <span 
                          key={`selectable_lang_${anime.id}_${l}_${lIdx}`}
                          className="bg-black/80 backdrop-blur-md text-[9px] font-bold text-amber-300 px-1.5 py-0.5 rounded shadow"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Info & Toggle Button */}
                  <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1 leading-snug">
                        {anime.title}
                      </h4>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {anime.type || 'TV Series'} • {anime.platform || 'Crunchyroll'}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleSelect(anime.id)}
                      className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        isSelected 
                          ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300' 
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to List</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
};
