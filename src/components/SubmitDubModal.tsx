import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  Search, 
  Loader2, 
  CheckCircle2, 
  ShieldAlert, 
  Film, 
  Tv, 
  ExternalLink 
} from 'lucide-react';
import { searchJikanAnime, formatJikanToAnime } from '../services/jikanApi';
import { JikanAnimeResult } from '../types/database';
import { DubLanguage, StreamingPlatform, AnimeType, ReleaseDay } from '../types/anime';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { useToast } from './Toast';

interface SubmitDubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ALL_LANGS: DubLanguage[] = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'];
const ALL_DAYS: ReleaseDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const AVAILABLE_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Isekai',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Shonen',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

export const SubmitDubModal: React.FC<SubmitDubModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const currentUser = authService.getCurrentUser();
  const toast = useToast();

  // Form Fields
  const [title, setTitle] = useState('');
  const [romajiTitle, setRomajiTitle] = useState('');
  const [poster, setPoster] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear());
  const [episodes, setEpisodes] = useState<number>(12);
  const [type, setType] = useState<AnimeType>('Series');
  const [studio, setStudio] = useState('');
  const [genres, setGenres] = useState<string[]>(['Action', 'Fantasy']);
  
  // Dub fields
  const [selectedDubs, setSelectedDubs] = useState<DubLanguage[]>(['Tamil']);
  const [platform, setPlatform] = useState<StreamingPlatform>('Crunchyroll');
  const [streamUrl, setStreamUrl] = useState('');
  const [airingStatus, setAiringStatus] = useState<'Ongoing' | 'Completed'>('Ongoing');
  const [releaseDay, setReleaseDay] = useState<ReleaseDay>('Saturday');

  // Jikan Search State
  const [jikanResults, setJikanResults] = useState<JikanAnimeResult[]>([]);
  const [isSearchingJikan, setIsSearchingJikan] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced Jikan API search
  useEffect(() => {
    if (!title || title.trim().length < 2 || autoFilled) {
      setJikanResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingJikan(true);
      try {
        const results = await searchJikanAnime(title);
        setJikanResults(results);
        setShowDropdown(results.length > 0);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearchingJikan(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, autoFilled]);

  // Click outside listener for Jikan dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Handle auto-filling details from Jikan API
  const handleSelectJikan = (item: JikanAnimeResult) => {
    const formatted = formatJikanToAnime(item);
    setTitle(formatted.title);
    setRomajiTitle(formatted.romajiTitle);
    setPoster(formatted.poster);
    setSynopsis(formatted.synopsis);
    setReleaseYear(formatted.releaseYear);
    setEpisodes(formatted.episodes);
    setType(formatted.type);
    setStudio(formatted.studio);
    setGenres(formatted.genres);
    if (item.airing !== undefined) {
      setAiringStatus(item.airing ? 'Ongoing' : 'Completed');
    }
    if (item.broadcast?.day) {
      const bDay = item.broadcast.day.replace(/s$/i, '').trim();
      const matched = ALL_DAYS.find((d) => d.toLowerCase() === bDay.toLowerCase());
      if (matched) {
        setReleaseDay(matched);
      }
    }
    setAutoFilled(true);
    setShowDropdown(false);
  };

  const toggleDub = (lang: DubLanguage) => {
    if (selectedDubs.includes(lang)) {
      if (selectedDubs.length > 1) {
        setSelectedDubs(selectedDubs.filter((l) => l !== lang));
      }
    } else {
      setSelectedDubs([...selectedDubs, lang]);
    }
  };

  const toggleGenre = (genre: string) => {
    if (genres.includes(genre)) {
      if (genres.length > 1) {
        setGenres(genres.filter((g) => g !== genre));
      }
    } else {
      setGenres([...genres, genre]);
    }
  };

  // STRICT MODERATION SUBMIT: ALWAYS ENFORCES status: "pending"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedDubs.length === 0) return;

    setIsSubmitting(true);

    const defaultCover =
      poster.trim() ||
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

    const dubDetails = selectedDubs.map((lang) => ({
      language: lang,
      available: true,
      platform: [platform],
      notes: `Verified ${lang} dub on ${platform}`,
    }));

    const platforms = [
      {
        name: platform,
        url: streamUrl.trim() || 'https://www.crunchyroll.com',
      },
    ];

    // STRICT APPROVAL GATE: Every submission is saved with status: "pending"
    // Pending anime are NEVER returned in getApprovedAnime() and stay completely hidden from public feeds
    const newRecord = dbService.submitDubInfo({
      title: title.trim(),
      romajiTitle: romajiTitle.trim() || title.trim(),
      poster: defaultCover,
      imageUrl: defaultCover,
      synopsis: synopsis.trim() || `Regional Indian dubbed release for ${title.trim()} available in ${selectedDubs.join(', ')} on ${platform}.`,
      releaseYear: releaseYear || new Date().getFullYear(),
      originalReleaseDate: `${releaseYear || new Date().getFullYear()}`,
      episodes: episodes || 12,
      type: type || 'Series',
      studio: studio.trim() || 'Animation Studio',
      rating: 8.0,
      status: airingStatus,
      airingStatus,
      releaseDay: airingStatus === 'Ongoing' ? releaseDay : undefined,
      airingDay: airingStatus === 'Ongoing' ? releaseDay : undefined,
      genres: genres.length > 0 ? genres : ['Action', 'Fantasy'],
      themes: ['Super Power', 'Indian Dub'],
      characters: [
        {
          characterName: `Protagonist of ${title.trim()}`,
          role: 'Main',
          characterImage: defaultCover,
          japaneseVA: 'Original Cast',
          indianVA: {
            language: selectedDubs[0],
            actor: 'Regional Voice Cast',
          },
        },
      ],
      dubs: selectedDubs,
      dubDetails,
      platforms,
      submittedBy: {
        userId: currentUser?.uid || 'guest-user',
        userName: currentUser?.displayName || 'Community Member',
        userEmail: currentUser?.email || 'contributor@anidub.in',
      },
    });

    setIsSubmitting(false);
    setIsSuccess(true);
    toast.success('Anime Submitted Successfully!', `"${title.trim()}" is now pending stealth admin approval.`);

    setTimeout(() => {
      setIsSuccess(false);
      setTitle('');
      setPoster('');
      setSynopsis('');
      setStreamUrl('');
      setSelectedDubs(['Tamil']);
      setType('Series');
      setGenres(['Action', 'Fantasy']);
      setAiringStatus('Ongoing');
      setReleaseDay('Saturday');
      setAutoFilled(false);
      onClose();
      onSuccess?.();
    }, 2400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-[#111726]/95 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto text-neutral-100 backdrop-blur-xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-transparent to-transparent shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-white leading-tight">
                Submit Dub Info
              </h3>
              <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Strict Moderation: Requires Admin Approval</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-950/70 border border-amber-500/50 flex items-center justify-center mx-auto text-amber-400 animate-bounce">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-heading font-black text-xl text-white">
                Saved with Status: "Pending"!
              </h4>
              <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
                Your submission is currently locked under <strong className="text-amber-400">Strict Moderation</strong>. 
                It has been sent to the Admin Dashboard and will remain hidden from the website until approved.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Title & Jikan Auto-fill Search */}
              <div className="relative" ref={dropdownRef}>
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <span>Anime Title (Type to Auto-Fill via MyAnimeList) <span className="text-rose-400">*</span></span>
                  {isSearchingJikan && (
                    <span className="text-[10px] text-purple-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Searching MAL...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setAutoFilled(false);
                    }}
                    placeholder="e.g. Solo Leveling, Demon Slayer, Jujutsu Kaisen..."
                    className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-2.5 pl-3.5 pr-8 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <Search className="w-4 h-4 text-neutral-500 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Auto-fill Dropdown Results from Jikan */}
                {showDropdown && jikanResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#141b29] border border-purple-500/40 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-neutral-800">
                    <div className="p-2 text-[10px] font-bold text-purple-300 bg-purple-950/40 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Select anime to 1-click auto-fill poster, synopsis, studio & year:</span>
                    </div>
                    {jikanResults.map((item) => (
                      <div
                        key={item.mal_id}
                        onClick={() => handleSelectJikan(item)}
                        className="p-2.5 flex items-center gap-3 hover:bg-purple-950/30 cursor-pointer transition-colors"
                      >
                        <img
                          src={item.images.jpg.image_url}
                          alt={item.title}
                          className="w-9 h-12 object-cover rounded-lg shrink-0 border border-neutral-700"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs truncate">{item.title}</p>
                          <p className="text-[10px] text-neutral-400">
                            {item.year || item.type || 'Anime'} • {item.episodes ? `${item.episodes} eps` : 'Ongoing'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Image URL text field */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <span>Image URL (Anime Poster Link)</span>
                  {autoFilled && <span className="text-[10px] text-emerald-400 font-semibold">✓ Auto-filled from MAL</span>}
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="url"
                    value={poster}
                    onChange={(e) => setPoster(e.target.value)}
                    placeholder="https://... (paste link to anime poster image)"
                    className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-2 px-3 text-xs text-white placeholder-neutral-500 focus:outline-none"
                  />
                  {poster && (
                    <img
                      src={poster}
                      alt="Cover Preview"
                      className="w-9 h-11 object-cover rounded-lg border border-purple-500/50 shrink-0 shadow"
                      onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                    />
                  )}
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Paste any image URL or use the title search above to auto-fill from MyAnimeList.
                </p>
              </div>

              {/* Dubbed Indian Languages */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1.5">
                  Dubbed Indian Languages <span className="text-rose-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_LANGS.map((lang) => {
                    const isSelected = selectedDubs.includes(lang);
                    return (
                      <button
                        type="button"
                        key={lang}
                        onClick={() => toggleDub(lang)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400/50'
                            : 'bg-[#182032] text-neutral-400 hover:text-white border border-neutral-700'
                        }`}
                      >
                        {lang} Dub
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Streaming Platform & Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-300 mb-1">
                    Streaming Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as StreamingPlatform)}
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="Crunchyroll">Crunchyroll</option>
                    <option value="Netflix">Netflix</option>
                    <option value="JioCinema">JioCinema</option>
                    <option value="YouTube (Muse India)">YouTube (Muse India)</option>
                    <option value="YouTube (Ani-One)">YouTube (Ani-One)</option>
                    <option value="Disney+ Hotstar">Disney+ Hotstar</option>
                    <option value="Prime Video">Prime Video</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-300 mb-1">
                    Streaming Link / URL
                  </label>
                  <input
                    type="url"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://crunchyroll.com/watch/..."
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Type, Status & Release Day Dropdowns (Release Day is conditionally rendered ONLY when Status is 'Ongoing') */}
              <div className={`grid grid-cols-1 ${airingStatus === 'Ongoing' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                <div>
                  <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Type <span className="text-rose-400">*</span></span>
                    <span className="text-[10px] text-purple-400 font-semibold">Format</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AnimeType)}
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 cursor-pointer text-xs"
                  >
                    <option value="Series">Series</option>
                    <option value="Movie">Movie</option>
                    <option value="Special">Special</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Status <span className="text-rose-400">*</span></span>
                    <span className="text-[10px] text-purple-400 font-semibold">Airing State</span>
                  </label>
                  <select
                    value={airingStatus}
                    onChange={(e) => setAiringStatus(e.target.value as 'Ongoing' | 'Completed')}
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 cursor-pointer text-xs"
                  >
                    <option value="Ongoing">Ongoing (Simulcast)</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                {/* Release Day: ONLY visible and required if Status is set to 'Ongoing' */}
                {airingStatus === 'Ongoing' && (
                  <div className="animate-fadeIn">
                    <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                      <span>Release Day <span className="text-rose-400">*</span></span>
                      <span className="text-[10px] text-emerald-400 font-semibold">Schedule Tab</span>
                    </label>
                    <select
                      required
                      value={releaseDay}
                      onChange={(e) => setReleaseDay(e.target.value as ReleaseDay)}
                      className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 cursor-pointer text-xs"
                    >
                      {ALL_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Explanatory note for Ongoing releases */}
              {airingStatus === 'Ongoing' && (
                <p className="text-[10px] text-neutral-400 -mt-1">
                  Ongoing titles will be featured on the <strong className="text-white">Airing Now</strong> weekly calendar under <strong className="text-emerald-400">{releaseDay}</strong>.
                </p>
              )}

              {/* Explicit Genre Selector (Action, Comedy, Shonen, etc.) */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1.5 flex items-center justify-between">
                  <span>Genres (Action, Comedy, Shonen, etc.) <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-purple-400 font-semibold">{genres.length} selected</span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-[#141b29] border border-neutral-700/80 max-h-36 overflow-y-auto no-scrollbar">
                  {AVAILABLE_GENRES.map((g) => {
                    const isSelected = genres.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow shadow-purple-600/30 ring-1 ring-purple-400/60'
                            : 'bg-[#1b2234] text-neutral-400 hover:text-neutral-200 border border-neutral-700/60'
                        }`}
                      >
                        {isSelected && <span>✓</span>}
                        <span>{g}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Click tags to toggle genres. These link directly to the Library Genre filter so users can find this show easily.
                </p>
              </div>

              {/* Optional Studio & Synopsis info (auto-filled if selected) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-400 mb-1">Animation Studio</label>
                  <input
                    type="text"
                    value={studio}
                    onChange={(e) => setStudio(e.target.value)}
                    placeholder="e.g. Ufotable, A-1 Pictures"
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-1.5 text-white placeholder-neutral-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-400 mb-1">Release Year</label>
                  <input
                    type="number"
                    value={releaseYear}
                    onChange={(e) => setReleaseYear(parseInt(e.target.value) || 2024)}
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-1.5 text-white"
                  />
                </div>
              </div>

              {/* Strict Approval Notice */}
              <div className="bg-[#141b29] border border-amber-800/40 rounded-2xl p-3 text-[11px] text-neutral-300 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Strict Moderation Gate</span>
                </div>
                <p className="text-neutral-400 leading-relaxed">
                  This submission will be saved with <strong className="text-amber-300">status: "pending"</strong>. 
                  It will <strong>NEVER</strong> appear on the public website (Home, Search, or Airing Now) until approved by the admin.
                </p>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Submit Dub for Admin Approval</span>
              </button>

            </form>
          )}
        </div>

      </div>
    </div>
  );
};
