import React, { useState } from 'react';
import { Sparkles, Send, Loader2, Star, Play, Tv } from 'lucide-react';

interface AiRecommenderViewProps {
  onSelectAnime: (anime: any) => void;
}

const MOOD_SUGGESTIONS = [
  "Cyberpunk thriller with mind-bending twists",
  "Cozy slice of life coffee break in space",
  "Epic martial arts tournament and celestial battles",
  "Emotional musical romance across dimensions"
];

export const AiRecommenderView: React.FC<AiRecommenderViewProps> = ({ onSelectAnime }) => {
  const [mood, setMood] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [error, setError] = useState('');

  const handleRecommend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mood.trim()) return;

    setLoading(true);
    setError('');
    setRecommendations([]);

    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate recommendations');
      
      // Match recommendations with catalog data
      const catalogRes = await fetch('/api/anime?limit=50');
      const catalogData = await catalogRes.json();
      const allAnime = catalogData.data || [];

      const enriched = (data.recommendations || []).map((rec: any) => {
        const found = allAnime.find((a: any) => a.title.toLowerCase() === rec.title.toLowerCase()) || allAnime[0];
        return {
          ...found,
          ...rec
        };
      });

      setRecommendations(enriched);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-4">
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>Gemini AI Recommender Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-['Space_Grotesk',sans-serif] mb-3">
          What kind of anime world are you craving today?
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          Describe your mood, vibe, or preferred storyline, and Gemini AI will curate the perfect matches from our Cloudflare D1 catalog.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-10">
        <form onSubmit={handleRecommend} className="space-y-4">
          <div className="relative">
            <textarea
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="e.g., I want an intense cyberpunk sci-fi anime with stunning fight choreography and deep philosophical themes..."
              rows={3}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Suggestions:</span>
              {MOOD_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMood(s)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Curate with AI</span>
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 mb-8 text-center">
          {error}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Curated AI Recommendations</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendations.map((anime, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between group transition-all"
              >
                <div className="relative h-48 overflow-hidden">
                  <img src={anime.banner_image || anime.cover_image} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center space-x-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{anime.rating}</span>
                  </div>
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold">
                    {anime.vibeScore || 95}% Match
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3
                      onClick={() => onSelectAnime(anime)}
                      className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] hover:text-orange-400 cursor-pointer transition-colors"
                    >
                      {anime.title}
                    </h3>
                    <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl mt-2 leading-relaxed">
                      &ldquo;{anime.matchReason}&rdquo;
                    </p>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {anime.synopsis}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
                    <button
                      onClick={() => onSelectAnime(anime)}
                      className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition-colors shadow-md shadow-orange-600/30"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
