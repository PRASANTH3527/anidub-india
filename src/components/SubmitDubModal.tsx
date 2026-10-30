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
import { dbService } from '../services/databaseService';

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

  const availableGenres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 
    'Mystery', 'Romance', 'Sci-Fi', 'Shonen', 'Seinen', 'Shoujo', 'Josei', 
    'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Mecha', 'Psychological',
    'Music', 'Military', 'Historical', 'Martial Arts', 'Ecchi', 'Gourmet', 'Workplace',
    'School', 'Mythology', 'Parody'
  ];

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    setIsSubmitting(true);

    const payload = {
      title: title.trim(),
      synopsis: synopsis.trim(),
      cover_image: coverImage,
      banner_image: bannerImage,
      rating: parseFloat(rating) || 8.5,
      episodes_count: parseInt(episodesCount) || 12,
      status: 'pending',
      submissionStatus: 'pending',
      airing_status: status,
      platform,
      languages: selectedLangs.join(','),
      genres: selectedGenres.join(',')
    };

    try {
      await dbService.submitDubInfo(payload);
      onSubmit(payload);
      onClose();
    } catch (err: any) {
      console.warn('Submission error:', err);
      if (err?.message?.includes('already exists')) {
        setError("This anime already exists in our database!");
      } else {
        setError(err?.message || "An error occurred while submitting. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
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
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
              <span>Synopsis</span>
              <span className="text-[10px] text-neutral-500 font-normal lowercase">(optional plot summary)</span>
            </label>
            <textarea
              rows={3}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Type or paste a descriptive summary of the anime..."
              className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors resize-y leading-relaxed"
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
              className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
            >
              <option value="Crunchyroll">Crunchyroll</option>
              <option value="Netflix">Netflix</option>
              <option value="JioCinema">JioCinema</option>
              <option value="JioHotstar">JioHotstar</option>
              <option value="YouTube">YouTube</option>
              <option value="YouTube (Muse India)">YouTube (Muse India)</option>
              <option value="YouTube (Ani-One)">YouTube (Ani-One)</option>
              <option value="Disney+ Hotstar">Disney+ Hotstar</option>
              <option value="Prime Video">Prime Video</option>
              <option value="Anime Times">Anime Times</option>
              <option value="Sony YAY!">Sony YAY!</option>
              <option value="Sony LIV">Sony LIV</option>
              <option value="Bilibili">Bilibili</option>
              <option value="Cartoon Network India">Cartoon Network India</option>
              <option value="ETV Bal Bharat">ETV Bal Bharat</option>
              <option value="Zee5">Zee5</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              Available Regional Dub Languages
            </label>
            <div className="flex flex-wrap gap-2">
              {['Hi', 'Ta', 'Te', 'Ma', 'Ka', 'Be'].map((lang) => {
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Genres & Categories
              </label>
              <span className="text-[10px] text-purple-400 font-bold">{selectedGenres.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-[#0a0e17] border border-neutral-800 max-h-48 overflow-y-auto no-scrollbar">
              {availableGenres.map((genre) => {
                const active = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                      active
                        ? 'bg-gradient-to-r from-[#9333ea] to-[#7c3aed] text-white shadow-[0_0_15px_rgba(147,51,234,0.45)] ring-1 ring-purple-400/70 font-bold'
                        : 'bg-[#141b29] border border-neutral-700/60 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {active && <span className="text-white text-xs font-black">✓</span>}
                    <span>{genre}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STRICT MODERATION GATE */}
          <div className="rounded-2xl p-4 bg-amber-950/20 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Strict Moderation Gate</span>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              This submission will be saved with <span className="text-amber-400 font-bold">status: "pending"</span>. It will <span className="text-rose-400 font-bold">NEVER</span> appear on the public website until approved by the admin.
            </p>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 animate-in slide-in-from-bottom-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-[11px] font-bold text-red-200">{error}</p>
            </div>
          )}

          {/* STICKY FOOTER */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#111726] via-[#111726]/95 to-transparent backdrop-blur-lg border-t border-white/5 z-50">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-purple-600 hover:from-orange-500 hover:via-amber-500 hover:to-purple-500 text-white font-black text-sm flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'Verifying & Submitting...' : 'Submit Official Dub Entry'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
