import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Image as ImageIcon, Sparkles, Loader2, Upload, CheckCircle2, ExternalLink } from 'lucide-react';
import { validateImageUpload } from '../utils/imgbb';

interface AdminPanelViewProps {
  onAnimeCreated: () => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ onAnimeCreated }) => {
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [coverImage, setCoverImage] = useState('https://i.ibb.co/vzS8G90/cyberpunk-poster.jpg');
  const [bannerImage, setBannerImage] = useState('https://i.ibb.co/xL2y9Bv/cyberpunk-banner.jpg');
  const [rating, setRating] = useState('9.0');
  const [episodesCount, setEpisodesCount] = useState('12');
  const [status, setStatus] = useState('Airing');
  const [season, setSeason] = useState('Spring');
  const [year, setYear] = useState('2026');
  const [genres, setGenres] = useState('Action,Sci-Fi,Cyberpunk');

  // AI poster prompt state
  const [aiPosterPrompt, setAiPosterPrompt] = useState('');
  const [generatingPoster, setGeneratingPoster] = useState(false);

  useEffect(() => {
    fetchAnime();
  }, []);

  const fetchAnime = async () => {
    try {
      const res = await fetch('/api/anime?limit=50');
      const data = await res.json();
      setAnimeList(data.data || []);
    } catch (err) {
      console.error('Failed to fetch anime:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, isCover: boolean) => {
    const validation = validateImageUpload(file.size, file.type);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file');
      return;
    }

    setUploadError('');
    if (isCover) setUploadingPoster(true);
    else setUploadingBanner(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        // Secure server-side ImgBB upload via Cloudflare Pages Function
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            filename: file.name,
            type: isCover ? 'anime_poster' : 'anime_banner'
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload image');

        if (isCover) {
          setCoverImage(data.url);
          setSuccessMsg(`Cover poster uploaded successfully: ${data.url}`);
        } else {
          setBannerImage(data.url);
          setSuccessMsg(`Banner uploaded successfully: ${data.url}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading file');
    } finally {
      if (isCover) setUploadingPoster(false);
      else setUploadingBanner(false);
    }
  };

  const handleGeneratePoster = async () => {
    if (!aiPosterPrompt.trim()) return;
    setGeneratingPoster(true);
    setUploadError('');
    try {
      const res = await fetch('/api/ai/generate-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPosterPrompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoverImage(data.url);
      setBannerImage(data.url);
      setSuccessMsg(`AI Poster generated and saved to catalog: ${data.url}`);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to generate poster');
    } finally {
      setGeneratingPoster(false);
    }
  };

  const handleCreateAnime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !synopsis) return;

    setSubmitting(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/anime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          synopsis,
          cover_image: coverImage,
          banner_image: bannerImage,
          rating: parseFloat(rating),
          episodes_count: parseInt(episodesCount),
          status,
          season,
          year: parseInt(year),
          genres
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(`Anime "${title}" published and added to catalog!`);
      setTitle('');
      setSynopsis('');
      fetchAnime();
      onAnimeCreated();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to create anime');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnime = async (id: number) => {
    if (!confirm('Are you sure you want to delete this anime from the directory?')) return;
    try {
      await fetch(`/api/anime/${id}`, { method: 'DELETE' });
      fetchAnime();
      onAnimeCreated();
    } catch (err) {
      console.error('Failed to delete anime:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Moderation & Media Manager</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Space_Grotesk',sans-serif]">
            Anidub India Admin Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Publish new anime titles, upload posters, and manage verified catalog entries.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs text-slate-300">
          <ImageIcon className="w-4 h-4 text-orange-400" />
          <span>Catalog Media: <strong className="text-orange-400">Active & Accelerated</strong></span>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {uploadError}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{successMsg}</span>
        </div>
      )}

      {/* Grid: Create Anime Form & AI Poster Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Anime Form (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <h2 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] mb-6 flex items-center space-x-2">
            <Plus className="w-5 h-5 text-orange-400" />
            <span>Publish New Anime Title</span>
          </h2>

          <form onSubmit={handleCreateAnime} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Anime Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Cyberpunk Odyssey"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Genres (comma separated)</label>
                <input
                  type="text"
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  placeholder="Action, Sci-Fi, Cyberpunk"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Synopsis</label>
              <textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="Detailed plot synopsis..."
                rows={3}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rating (1-10)</label>
                <input
                  type="number"
                  step="0.1"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Episodes Count</label>
                <input
                  type="number"
                  value={episodesCount}
                  onChange={(e) => setEpisodesCount(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  <option value="Airing">Airing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Poster & Banner Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Cover Poster</label>
                  <label className="cursor-pointer inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], true)}
                      className="hidden"
                    />
                  </label>
                </div>
                {uploadingPoster && (
                  <div className="flex items-center space-x-2 text-xs text-orange-400 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading poster to storage backend...</span>
                  </div>
                )}
                <input
                  type="text"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-orange-500"
                  placeholder="https://..."
                />
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Banner Image</label>
                  <label className="cursor-pointer inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], false)}
                      className="hidden"
                    />
                  </label>
                </div>
                {uploadingBanner && (
                  <div className="flex items-center space-x-2 text-xs text-orange-400 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading banner to storage backend...</span>
                  </div>
                )}
                <input
                  type="text"
                  value={bannerImage}
                  onChange={(e) => setBannerImage(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-orange-500"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting || uploadingPoster || uploadingBanner}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Publish to Directory</span>
              </button>
            </div>
          </form>
        </div>

        {/* AI Poster Generator (1 Col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] mb-2 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>AI Poster Generator</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Generate anime posters using AI and pipe them directly into the verified directory.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Artwork Prompt</label>
                <textarea
                  value={aiPosterPrompt}
                  onChange={(e) => setAiPosterPrompt(e.target.value)}
                  placeholder="e.g., Cyberpunk samurai warrior standing on a neon skyscraper rooftop overlooking Tokyo in rain..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              {coverImage && (
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
                  <img src={coverImage} alt="Generated Poster" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-[10px] text-orange-400 text-center font-medium truncate">
                    Poster: {coverImage}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleGeneratePoster}
              disabled={generatingPoster || !aiPosterPrompt.trim()}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 transition-all disabled:opacity-50"
            >
              {generatingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Generate & Save Poster</span>
            </button>
          </div>
        </div>

      </div>

      {/* Anime Management Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] mb-6">
          Verified Anime Catalog ({animeList.length} items)
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300">
                  <th className="p-3 font-semibold">Poster</th>
                  <th className="p-3 font-semibold">Title</th>
                  <th className="p-3 font-semibold">Media URL</th>
                  <th className="p-3 font-semibold">Genres</th>
                  <th className="p-3 font-semibold">Rating</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {animeList.map((anime) => (
                  <tr key={anime.id} className="border-b border-slate-900/50 hover:bg-slate-900/40">
                    <td className="p-3">
                      <div className="w-10 h-12 rounded-lg overflow-hidden bg-slate-900">
                        <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="p-3 font-bold text-white">{anime.title}</td>
                    <td className="p-3 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                      <span className="text-orange-400">{anime.cover_image}</span>
                    </td>
                    <td className="p-3 text-slate-300 truncate max-w-xs">{anime.genres}</td>
                    <td className="p-3 text-amber-400 font-bold">{anime.rating}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                        {anime.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteAnime(anime.id)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete Anime"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
