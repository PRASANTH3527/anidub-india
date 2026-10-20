import React, { useState } from 'react';
import { 
  X, 
  Film, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  Globe, 
  Link as LinkIcon, 
  Languages, 
  ShieldAlert,
  Send,
  Tv
} from 'lucide-react';

export interface SubmitDubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const SubmitDubModal: React.FC<SubmitDubModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80');
  const [bannerImage, setBannerImage] = useState('https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1600&auto=format&fit=crop&q=80');
  const [rating, setRating] = useState('8.5');
  const [episodesCount, setEpisodesCount] = useState('12');
  const [status, setStatus] = useState<'Airing' | 'Completed'>('Airing');
  const [platform, setPlatform] = useState('Crunchyroll');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['Hi', 'Ta', 'Te']);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Action', 'Shonen', 'Fantasy']);

  const availableLangs = ['Hi', 'Ta', 'Te', 'Ma', 'Ka', 'En', 'Be'];
  const availableGenres = ['Action', 'Shonen', 'Fantasy', 'Romance', 'Sci-Fi', 'Slice of Life', 'Supernatural', 'Thriller'];

  const toggleLang = (lang: string) => {
    setSelectedLangs(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title,
      synopsis,
      cover_image: coverImage,
      banner_image: bannerImage,
      rating: parseFloat(rating) || 8.5,
      episodes_count: parseInt(episodesCount) || 12,
      status,
      platform,
      languages: selectedLangs.join(','),
      genres: selectedGenres.join(',')
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* MODAL CONTAINER */}
      <div className="relative w-full max-w-xl bg-[#111726]/95 border border-primary-theme/30 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto text-neutral-100 backdrop-blur-xl max-h-[90vh] flex flex-col font-sans">
        
        {/* HEADER */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[var(--primary-badge)]/40 via-transparent to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl btn-primary-theme flex items-center justify-center text-white shadow-lg">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg flex items-center gap-1.5">
                <span>Submit Official Indian Dub</span>
                <span className="badge-primary-theme text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Community OTT
                </span>
              </h2>
              <p className="text-neutral-400 text-xs mt-0.5">
                Catalog newly licensed regional anime dubs on Crunchyroll, Netflix & JioCinema.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STRICT MODERATION NOTICE */}
        <div className="mx-5 mt-5 bg-[#141b29] border border-amber-800/40 rounded-2xl p-3 text-[11px] text-neutral-300 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Strict Legal OTT Moderation Policy</span>
          </div>
          <p className="text-neutral-400">
            Only 100% legal, officially licensed Indian regional dub entries will be approved into the public directory. Fan dubs are strictly prohibited.
          </p>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pb-32 p-5 sm:p-6 space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Anime Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Solo Leveling Season 2 (Tamil Dub)"
              className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Synopsis
            </label>
            <textarea
              rows={3}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Enter plot summary & regional voice casting details..."
              className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Cover Image URL
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Banner Image URL
              </label>
              <input
                type="url"
                value={bannerImage}
                onChange={(e) => setBannerImage(e.target.value)}
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Rating</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Episodes</label>
              <input
                type="number"
                value={episodesCount}
                onChange={(e) => setEpisodesCount(e.target.value)}
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              >
                <option value="Airing">Airing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Streaming Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            >
              <option value="Crunchyroll">Crunchyroll India</option>
              <option value="Netflix">Netflix India</option>
              <option value="JioCinema">JioCinema / JioHotstar</option>
              <option value="Muse India">Muse India / YouTube</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              Available Regional Dub Languages
            </label>
            <div className="flex flex-wrap gap-2">
              {availableLangs.map((lang) => {
                const active = selectedLangs.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLang(lang)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'btn-primary-theme shadow-md'
                        : 'bg-[#0a0e17] border border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              Genres & Categories
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableGenres.map((genre) => {
                const active = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-600/50'
                        : 'bg-[#0a0e17] border border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#111726] via-[#111726]/95 to-transparent backdrop-blur-lg border-t border-white/5 z-50">
            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-purple-600 hover:from-orange-500 hover:via-amber-500 hover:to-purple-500 text-white font-black text-sm flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span>Submit Official Dub Entry</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
