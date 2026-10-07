import React, { useState } from 'react';
import { X, Send, CheckCircle2, Film, Plus, Loader2 } from 'lucide-react';
import { DubLanguage } from '../types/anime';
import { dbService, cleanFirestoreData } from '../services/databaseService';

interface SuggestDubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuggestDubModal: React.FC<SuggestDubModalProps> = ({ isOpen, onClose }) => {
  const [animeName, setAnimeName] = useState('');
  const [language, setLanguage] = useState<DubLanguage>('Tamil');
  const [platform, setPlatform] = useState('Crunchyroll');
  const [sourceLink, setSourceLink] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animeName.trim()) return;

    setIsSubmitting(true);
    try {
      // STRICT RTDB ROUTING: Route all user suggestions strictly to RTDB pending_animes
      await dbService.submitDubInfo({
        title: animeName.trim(),
        romajiTitle: "",
        poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
        imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
        type: 'TV Series',
        releaseYear: 0,
        originalReleaseDate: "",
        rating: 0,
        episodes: 0,
        seasons: 1,
        totalSeasons: 1,
        status: 'pending',
        airingStatus: 'Ongoing',
        genres: [],
        themes: ['Community Suggestion'],
        studio: "",
        synopsis: notes.trim() || 'No additional notes provided.',
        characters: [],
        dubs: [language],
        dubDetails: [{
          language,
          available: true,
          platform: [platform as any],
          notes: `Suggested on ${platform} (${sourceLink || 'No link'})`
        }],
        platforms: [{ name: platform as any, url: sourceLink || 'https://www.crunchyroll.com', languages: [language] }],
      } as any);

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
        setAnimeName('');
        setSourceLink('');
        setNotes('');
      }, 2200);
    } catch (err: any) {
      console.error('Submission error:', err);
      window.alert("Suggestion Error: " + (err?.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md bg-[#131926] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden z-10 p-6 text-neutral-100">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-400" />
            <h3 className="font-heading font-black text-lg text-white">
              Submit an Anime / Dub
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="font-bold text-white text-base">Dub Suggestion Sent!</h4>
            <p className="text-xs text-neutral-400">
              Our contributors will verify and add it to AniDub India catalog.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Anime Title <span className="text-primary-theme">*</span>
            </label>
            <input
              type="text"
              required
              value={animeName}
              onChange={(e) => setAnimeName(e.target.value)}
              placeholder="e.g. Bleach, Naruto, Blue Lock"
              className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary-theme"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Dubbed Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as DubLanguage)}
                className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary-theme cursor-pointer"
              >
                <option value="Tamil">Tamil (தமிழ்)</option>
                <option value="Telugu">Telugu (తెలుగు)</option>
                <option value="Hindi">Hindi (हिंदी)</option>
                <option value="Malayalam">Malayalam (மலയാളம்)</option>
                <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary-theme cursor-pointer"
              >
                <option value="Crunchyroll">Crunchyroll</option>
                <option value="Netflix">Netflix</option>
                <option value="JioCinema">JioCinema</option>
                <option value="YouTube (Muse India)">YouTube (Muse India)</option>
                <option value="YouTube (Ani-One)">YouTube (Ani-One)</option>
                <option value="Disney+ Hotstar">Disney+ Hotstar</option>
                <option value="TV Channel">Sony YAY / Cartoon Network</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Official Streaming or Source Link
            </label>
            <input
              type="url"
              value={sourceLink}
              onChange={(e) => setSourceLink(e.target.value)}
              placeholder="https://crunchyroll.com/..."
              className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary-theme"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Which season? Voice actor info or release date..."
              className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary-theme resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 btn-primary-theme text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 group disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <div className="bg-white/20 p-1 rounded-lg group-hover:rotate-90 transition-transform duration-300">
                <Plus className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
            )}
            <span>{isSubmitting ? 'Submitting...' : 'Submit Dub Information'}</span>
          </button>
          </form>
        )}
      </div>
    </div>
  );
};
