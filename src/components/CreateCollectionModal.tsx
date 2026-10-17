import React, { useState } from 'react';
import { X, FolderPlus, Share2, Check, Copy, Sparkles, CheckCircle2 } from 'lucide-react';
import { Anime } from './CatalogView';

interface CreateCollectionModalProps {
  animeList: Anime[];
  onClose: () => void;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  animeList,
  onClose
}) => {
  const [collectionName, setCollectionName] = useState('Top Regional Dubs India');
  const [description, setDescription] = useState('Curated Hindi, Tamil, and Telugu dubbed anime directory');
  const [selectedIds, setSelectedIds] = useState<number[]>([1, 2, 3]);
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleGenerateLink = (e: React.FormEvent) => {
    e.preventDefault();
    const encoded = encodeURIComponent(collectionName);
    const ids = selectedIds.join(',');
    const link = `${window.location.origin}/?collection=${encoded}&ids=${ids}`;
    setGeneratedLink(link);
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">
          <FolderPlus className="w-4 h-4" />
          <span>Shareable Custom Collection</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white font-['Space_Grotesk',sans-serif] mb-1">
          Create & Share Anime Collection
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Build a shareable playlist of Hindi, Tamil & Telugu dubbed anime.
        </p>

        <form onSubmit={handleGenerateLink} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Collection Title</label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
              placeholder="e.g., Must-Watch Hindi Shonen"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Titles ({selectedIds.length} chosen)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {animeList.map((anime) => {
                const selected = selectedIds.includes(anime.id);
                return (
                  <div
                    key={anime.id}
                    onClick={() => toggleSelect(anime.id)}
                    className={`flex items-center space-x-2.5 p-2 rounded-xl cursor-pointer border transition-all ${
                      selected
                        ? 'bg-orange-600/20 border-orange-500 text-orange-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-8 h-10 rounded-md overflow-hidden bg-slate-900 flex-shrink-0">
                      <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs font-bold truncate flex-1">{anime.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {generatedLink && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Collection Link Generated & Copied to Clipboard!</span>
              </div>
              <div className="text-orange-400 font-mono text-[11px] truncate">
                {generatedLink}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-[11px] text-slate-500">Ready to share across WhatsApp / Discord</span>
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 transition-all hover:scale-105"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : 'Generate Share Link'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
