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
  ExternalLink,
  Upload,
  Plus,
  Trash2
} from 'lucide-react';
import { searchJikanAnime, formatJikanToAnime } from '../services/jikanApi';
import { JikanAnimeResult, AnimeRecord } from '../types/database';
import { DubLanguage, StreamingPlatform, AnimeType, ReleaseDay } from '../types/anime';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { useToast } from './Toast';

interface SubmitDubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editAnime?: AnimeRecord | null;
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
  'Seinen',
  'Shoujo',
  'Josei',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
  'Mecha',
  'Psychological',
  'Music',
  'Military',
  'Historical',
  'Martial Arts',
  'Ecchi',
  'Gourmet',
  'Workplace',
];

export const SubmitDubModal: React.FC<SubmitDubModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editAnime,
}) => {
  const currentUser = authService.getCurrentUser();
  const toast = useToast();

  const isEditMode = !!editAnime;

  // Form Fields
  const [title, setTitle] = useState('');
  const [romajiTitle, setRomajiTitle] = useState('');
  const [poster, setPoster] = useState(''); // This will now store Base64
  const [synopsis, setSynopsis] = useState('');
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear());
  const [episodes, setEpisodes] = useState<number>(12);
  const [type, setType] = useState<AnimeType>('TV Series');
  const [studio, setStudio] = useState('');
  const [genres, setGenres] = useState<string[]>(['Action', 'Fantasy']);
  
  // Advanced Progress Tracking (Dynamic Seasons / Mixed Entries)
  const [seasonDetails, setSeasonDetails] = useState<{ 
    type: 'Season' | 'OVA' | 'Movie' | 'Special' | 'ONA'; 
    label: string; 
    episodeCount: number | ''; 
    languages: DubLanguage[];
  }[]>([
    { type: 'Season', label: '1', episodeCount: 12, languages: ['Tamil'] }
  ]);
  const [currentSeason, setCurrentSeason] = useState<number | ''>('');
  const [currentlyAiringEpisode, setCurrentlyAiringEpisode] = useState<number | ''>('');

  // Multi-Platform Links
  const [streamingPartners, setStreamingPartners] = useState<{ name: StreamingPlatform; url: string }[]>([
    { name: 'Crunchyroll', url: '' }
  ]);

  const [airingStatus, setAiringStatus] = useState<'Ongoing' | 'Completed'>('Ongoing');
  const [releaseDay, setReleaseDay] = useState<ReleaseDay>('Saturday');

  // Pre-fill if editing
  useEffect(() => {
    if (editAnime && isOpen) {
      setTitle(editAnime.title);
      setRomajiTitle(editAnime.romajiTitle || '');
      setPoster(editAnime.poster || '');
      setSynopsis(editAnime.synopsis || '');
      setReleaseYear(editAnime.releaseYear || new Date().getFullYear());
      setType(editAnime.type || 'TV Series');
      setStudio(editAnime.studio || '');
      setGenres(editAnime.genres || ['Action']);
      setAiringStatus(editAnime.status === 'Ongoing' ? 'Ongoing' : 'Completed');
      if (editAnime.releaseDay) setReleaseDay(editAnime.releaseDay as ReleaseDay);
      
      if (editAnime.seasonDetails && editAnime.seasonDetails.length > 0) {
        setSeasonDetails(editAnime.seasonDetails.map(s => ({
          type: s.type || 'Season',
          label: s.label || '1',
          episodeCount: s.episodeCount || 0,
          languages: s.languages || (editAnime.dubs || ['Tamil'])
        })));
      } else if (editAnime.totalSeasons || editAnime.episodesPerSeason) {
        // Fallback for older records
        setSeasonDetails([{ 
          type: 'Season', 
          label: '1', 
          episodeCount: editAnime.episodesPerSeason || 12,
          languages: editAnime.dubs || ['Tamil']
        }]);
      }

      if (editAnime.currentSeason) setCurrentSeason(editAnime.currentSeason);
      if (editAnime.currentlyAiringEpisode) setCurrentlyAiringEpisode(editAnime.currentlyAiringEpisode);

      if (editAnime.platforms && editAnime.platforms.length > 0) {
        setStreamingPartners(editAnime.platforms.map(p => ({
          name: p.name as StreamingPlatform,
          url: p.url
        })));
      }
      setAutoFilled(true); // Treat as auto-filled so Jikan search doesn't trigger immediately
    } else if (isOpen && !editAnime) {
      // Clear for new submission
      setTitle('');
      setRomajiTitle('');
      setPoster('');
      setSynopsis('');
      setReleaseYear(new Date().getFullYear());
      setEpisodes(12);
      setType('TV Series');
      setStudio('');
      setGenres(['Action', 'Fantasy']);
      setSeasonDetails([{ type: 'Season', label: '1', episodeCount: 12, languages: ['Tamil'] }]);
      setCurrentSeason('');
      setCurrentlyAiringEpisode('');
      setStreamingPartners([{ name: 'Crunchyroll', url: '' }]);
      setAiringStatus('Ongoing');
      setReleaseDay('Saturday');
      setAutoFilled(false);
    }
  }, [editAnime, isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPoster(base64String);
    };
    reader.readAsDataURL(file);
  };

  const addStreamingPartner = () => {
    setStreamingPartners([...streamingPartners, { name: 'Crunchyroll', url: '' }]);
  };

  const removeStreamingPartner = (index: number) => {
    if (streamingPartners.length > 1) {
      setStreamingPartners(streamingPartners.filter((_, i) => i !== index));
    }
  };

  const updateStreamingPartner = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...streamingPartners];
    updated[index] = { ...updated[index], [field]: value };
    setStreamingPartners(updated);
  };

  // Dynamic Season / Entry Logic
  const addEntry = () => {
    // If last entry was a Season, try to guess the next number
    const lastEntry = seasonDetails[seasonDetails.length - 1];
    let nextLabel = '1';
    if (lastEntry && lastEntry.type === 'Season' && !isNaN(parseInt(lastEntry.label))) {
      nextLabel = (parseInt(lastEntry.label) + 1).toString();
    } else {
      nextLabel = (seasonDetails.length + 1).toString();
    }
    setSeasonDetails([...seasonDetails, { 
      type: 'Season', 
      label: nextLabel, 
      episodeCount: '', 
      languages: lastEntry?.languages || ['Tamil'] 
    }]);
  };

  const removeEntry = (index: number) => {
    if (seasonDetails.length > 1) {
      setSeasonDetails(seasonDetails.filter((_, i) => i !== index));
    }
  };

  const updateEntryField = (index: number, field: 'type' | 'label' | 'episodeCount' | 'languages', value: any) => {
    const updated = [...seasonDetails];
    if (field === 'episodeCount') {
      updated[index] = { ...updated[index], episodeCount: value === '' ? '' : parseInt(value) || 0 };
    } else if (field === 'languages') {
      updated[index] = { ...updated[index], languages: value };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSeasonDetails(updated);
  };

  const toggleLanguageForEntry = (entryIdx: number, lang: DubLanguage) => {
    const currentLangs = seasonDetails[entryIdx].languages || [];
    let updatedLangs: DubLanguage[];
    if (currentLangs.includes(lang)) {
      if (currentLangs.length <= 1) return; // Must have at least one
      updatedLangs = currentLangs.filter(l => l !== lang);
    } else {
      updatedLangs = [...currentLangs, lang];
    }
    updateEntryField(entryIdx, 'languages', updatedLangs);
  };

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
    
    // DERIVE GLOBAL LANGUAGES: Merge all unique languages selected across all seasons
    const derivedGlobalDubs = Array.from(new Set(
      seasonDetails.flatMap(s => s.languages || [])
    )) as DubLanguage[];

    if (!title.trim() || derivedGlobalDubs.length === 0) return;

    setIsSubmitting(true);

    const defaultCover =
      poster.trim() ||
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

    const platforms = streamingPartners.map(p => ({
      name: p.name,
      url: p.url.trim() || 'https://www.crunchyroll.com',
    }));

    const totalEpisodes = seasonDetails.reduce((acc, s) => acc + (Number(s.episodeCount) || 0), 0);
    
    const dubDetails = derivedGlobalDubs.map((lang) => ({
      language: lang,
      available: true,
      platform: streamingPartners.map(p => p.name),
      notes: `Verified ${lang} dub available on ${streamingPartners.map(p => p.name).join(', ')}`,
    }));

    const payload = {
      title: title.trim(),
      romajiTitle: romajiTitle.trim() || title.trim(),
      poster: defaultCover,
      imageUrl: defaultCover,
      synopsis: synopsis.trim() || `Regional Indian dubbed release for ${title.trim()} available in ${derivedGlobalDubs.join(', ')}.`,
      releaseYear: releaseYear || new Date().getFullYear(),
      originalReleaseDate: `${releaseYear || new Date().getFullYear()}`,
      episodes: totalEpisodes || 12,
      seasons: seasonDetails.filter(s => s.type === 'Season').length,
      totalSeasons: seasonDetails.filter(s => s.type === 'Season').length,
      seasonDetails: seasonDetails.map(s => ({
        type: s.type,
        label: s.label,
        episodeCount: Number(s.episodeCount) || 0,
        languages: s.languages
      })),
      currentSeason: airingStatus === 'Ongoing' ? (Number(currentSeason) || 1) : undefined,
      currentlyAiringEpisode: airingStatus === 'Ongoing' ? (Number(currentlyAiringEpisode) || 1) : undefined,
      type: type || 'TV Series',
      studio: studio.trim() || 'Animation Studio',
      status: airingStatus,
      airingStatus,
      releaseDay: airingStatus === 'Ongoing' ? releaseDay : undefined,
      airingDay: airingStatus === 'Ongoing' ? releaseDay : undefined,
      genres: genres.length > 0 ? genres : ['Action', 'Fantasy'],
      dubs: derivedGlobalDubs,
      dubDetails,
      platforms,
    };

    if (isEditMode && editAnime) {
      const success = dbService.updateAnime(editAnime.id, payload);
      setIsSubmitting(false);
      if (success) {
        toast.success('Anime Updated!', `"${title.trim()}" has been successfully updated.`);
        onClose();
        onSuccess?.();
      } else {
        toast.error('Update Failed', 'Could not update the record.');
      }
      return;
    }

    // STRICT APPROVAL GATE: Every submission is saved with status: "pending"
    // Pending anime are NEVER returned in getApprovedAnime() and stay completely hidden from public feeds
    const newRecord = dbService.submitDubInfo({
      ...payload,
      rating: 8.0,
      themes: ['Super Power', 'Indian Dub'],
      characters: [
        {
          characterName: `Protagonist of ${title.trim()}`,
          role: 'Main',
          characterImage: defaultCover,
          japaneseVA: 'Original Cast',
          indianVA: {
            language: derivedGlobalDubs[0],
            actor: 'Regional Voice Cast',
          },
        },
      ],
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
      setStreamingPartners([{ name: 'Crunchyroll', url: '' }]);
      setType('TV Series');
      setGenres(['Action', 'Fantasy']);
      setAiringStatus('Ongoing');
      setReleaseDay('Saturday');
      setSeasonDetails([{ type: 'Season', label: '1', episodeCount: 12, languages: ['Tamil'] }]);
      setCurrentSeason('');
      setCurrentlyAiringEpisode('');
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
                {isEditMode ? 'Edit Anime Info' : 'Submit Dub Info'}
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

              {/* Poster Image File Upload */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <span>Anime Poster (Upload File) <span className="text-rose-400">*</span></span>
                  {autoFilled && <span className="text-[10px] text-emerald-400 font-semibold">✓ Auto-filled from MAL</span>}
                </label>
                <div className="flex gap-3 items-center">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-20 border-2 border-dashed border-neutral-700 hover:border-purple-500 rounded-2xl bg-[#171e2e] flex flex-col items-center justify-center cursor-pointer transition-all group"
                  >
                    <Upload className="w-5 h-5 text-neutral-500 group-hover:text-purple-400 mb-1" />
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider group-hover:text-neutral-200">
                      {poster ? 'Change Photo' : 'Select Photo'}
                    </span>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden" 
                    />
                  </div>
                  {poster && (
                    <div className="relative shrink-0">
                      <img
                        src={poster}
                        alt="Preview"
                        className="w-14 h-20 object-cover rounded-xl border border-purple-500/50 shadow-xl"
                      />
                      <button 
                        type="button"
                        onClick={() => setPoster('')}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center text-white border border-black shadow-lg hover:bg-rose-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-neutral-500 mt-1 uppercase font-bold tracking-tighter">
                  Supported: JPG, PNG, WEBP (Max 2MB).
                </p>
              </div>

              {/* Dynamic Multi-Platform Links */}
              <div className="space-y-2">
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <span>Streaming Partners (Multi-Link) <span className="text-rose-400">*</span></span>
                  <button 
                    type="button" 
                    onClick={addStreamingPartner}
                    className="text-[10px] text-purple-400 font-bold hover:text-purple-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Platform
                  </button>
                </label>
                
                <div className="space-y-2.5">
                  {streamingPartners.map((partner, idx) => (
                    <div key={idx} className="flex gap-2 items-start animate-in slide-in-from-left-2 duration-200">
                      <div className="w-1/3">
                        <select
                          value={partner.name}
                          onChange={(e) => updateStreamingPartner(idx, 'name', e.target.value)}
                          className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                        >
                          <option value="Crunchyroll">Crunchyroll</option>
                          <option value="Netflix">Netflix</option>
                          <option value="JioCinema">JioCinema</option>
                          <option value="YouTube (Muse India)">Muse India</option>
                          <option value="YouTube (Ani-One)">Ani-One</option>
                          <option value="Disney+ Hotstar">Hotstar</option>
                          <option value="Prime Video">Prime</option>
                        </select>
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type="url"
                          required
                          value={partner.url}
                          onChange={(e) => updateStreamingPartner(idx, 'url', e.target.value)}
                          placeholder="Link (e.g. https://...)"
                          className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-[11px] text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      {streamingPartners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStreamingPartner(idx)}
                          className="p-2.5 rounded-xl bg-neutral-800/50 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all border border-neutral-700/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Type, Status & Release Day Dropdowns */}
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
                    <option value="TV Series">TV Series</option>
                    <option value="Movie">Movie</option>
                    <option value="OVA">OVA</option>
                    <option value="ONA">ONA</option>
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

                {/* Release Day */}
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

              {/* Dynamic Seasons & Mixed Entries Tracking */}
              <div className="space-y-3">
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-purple-400" />
                    <span>Mixed Entries (Seasons, OVAs, Movies) <span className="text-rose-400">*</span></span>
                  </div>
                  <button 
                    type="button" 
                    onClick={addEntry}
                    className="text-[10px] text-purple-400 font-bold hover:text-purple-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Entry
                  </button>
                </label>

                <div className="space-y-2.5">
                  {seasonDetails.map((entry, idx) => (
                    <div key={idx} className="bg-[#182032] border border-neutral-700/60 rounded-2xl p-2.5 animate-in zoom-in-95 duration-200 space-y-2">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4">
                          <select
                            value={entry.type}
                            onChange={(e) => updateEntryField(idx, 'type', e.target.value)}
                            className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-purple-500 rounded-xl px-2 py-1.5 text-[10px] sm:text-[11px] text-white outline-none cursor-pointer"
                          >
                            <option value="Season">Season</option>
                            <option value="Movie">Movie</option>
                            <option value="OVA">OVA</option>
                            <option value="ONA">ONA</option>
                            <option value="Special">Special</option>
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            required
                            value={entry.label}
                            onChange={(e) => updateEntryField(idx, 'label', e.target.value)}
                            placeholder="Label (e.g. 1)"
                            className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-purple-500 rounded-xl px-2 py-1.5 text-[10px] sm:text-[11px] text-white placeholder-neutral-600 outline-none"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            required
                            min={1}
                            value={entry.episodeCount}
                            onChange={(e) => updateEntryField(idx, 'episodeCount', e.target.value)}
                            placeholder="Eps"
                            className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-purple-500 rounded-xl px-2 py-1.5 text-[10px] sm:text-[11px] text-white placeholder-neutral-600 outline-none"
                          />
                        </div>
                        <div className="col-span-2 flex justify-center items-center">
                          {seasonDetails.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEntry(idx)}
                              className="p-1.5 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all border border-transparent hover:border-rose-500/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Per-Entry Language Toggles */}
                      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-0.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase mr-1">Available In:</span>
                        {ALL_LANGS.map(lang => {
                          const isSelected = entry.languages?.includes(lang);
                          return (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => toggleLanguageForEntry(idx, lang)}
                              className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all border ${
                                isSelected 
                                  ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                              }`}
                            >
                              {lang.substring(0, 2)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ongoing Status Section (Conditional) */}
              {airingStatus === 'Ongoing' && (
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ongoing Airing Status</span>
                    </label>
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-amber-600 uppercase mb-1 px-1">Currently Airing Season</label>
                      <input
                        type="number"
                        min={1}
                        max={seasonDetails.length}
                        value={currentSeason}
                        onChange={(e) => setCurrentSeason(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        className="w-full bg-[#0a0e17] border border-amber-900/50 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-amber-200 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-amber-600 uppercase mb-1 px-1">Live Episode Number</label>
                      <input
                        type="number"
                        min={1}
                        value={currentlyAiringEpisode}
                        onChange={(e) => setCurrentlyAiringEpisode(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        className="w-full bg-[#0a0e17] border border-amber-900/50 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-amber-200 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-amber-600/80 font-medium leading-tight">
                    * This info will be used to show the "Airing Now" badge and progress on the Home feed.
                  </p>
                </div>
              )}

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
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isEditMode ? (
                  <Plus className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{isEditMode ? 'Update Anime Details' : 'Submit Dub for Admin Approval'}</span>
              </button>

            </form>
          )}
        </div>

      </div>
    </div>
  );
};
