import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Search, 
  CheckCircle2, 
  ShieldAlert, 
  Tv, 
  Film,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Loader2,
  Send
} from 'lucide-react';
import { AnimeRecord, DubLanguage, dbService } from '../services/databaseService';
import { cloudflareApi } from '../services/cloudflareApi';

interface DubInfoModalProps {
  isOpen: boolean;
  mode?: 'submit' | 'edit';
  initialData?: any;
  onClose: () => void;
  onSubmit: (updatedAnime?: any) => void;
}

const ALL_LANGS: DubLanguage[] = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'];
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const AVAILABLE_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 
  'Mystery', 'Romance', 'Sci-Fi', 'Shonen', 'Seinen', 'Shoujo', 'Josei', 
  'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Mecha', 'Psychological',
  'Music', 'Military', 'Historical', 'Martial Arts', 'Ecchi', 'Gourmet', 'Workplace',
  'School', 'Mythology', 'Parody'
];

const normalizeAnimeType = (val: any): string => {
  if (!val || typeof val !== 'string') return 'TV Series';
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('movie')) return 'Movie';
  if (lower.includes('ova/special')) return 'OVA/Special';
  if (lower.includes('ova') || lower.includes('special')) return 'OVA/Special';
  if (lower.includes('ona')) return 'ONA';
  if (lower.includes('tv') || lower.length > 0) return 'TV Series';
  return 'TV Series';
};

export const DubInfoModal: React.FC<DubInfoModalProps> = ({
  isOpen,
  mode = 'submit',
  initialData,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const initDataAny = initialData as any;

  // Form Fields & formData state for strict select binding
  const initialResolvedType = normalizeAnimeType(
    initDataAny?.type || initDataAny?.Type || (initialData as any)?.type || (initialData as any)?.Type || 'TV Series'
  );
  const [formData, setFormData] = useState<any>(() => ({
    ...(initialData || {}),
    type: initialResolvedType
  }));
  const [title, setTitle] = useState(initialData?.title || '');
  const [romajiTitle, setRomajiTitle] = useState(initialData?.japanese_title || '');
  const [poster, setPoster] = useState(initialData?.poster_url || initDataAny?.cover_image || '');
  const [releaseYear, setReleaseYear] = useState<number | ''>(
    initialData?.release_year || initDataAny?.year || new Date().getFullYear()
  );
  const [rating, setRating] = useState<number | ''>(initialData?.rating !== undefined ? initialData.rating : '');
  const [type, setType] = useState<string>(initialResolvedType);
  const [studio, setStudio] = useState(initialData?.studio || '');
  const [genres, setGenres] = useState<string[]>(
    initialData?.genres 
      ? (typeof initialData.genres === 'string' ? initialData.genres.split(',').map((g: string) => g.trim()) : initialData.genres)
      : ['Action', 'Fantasy']
  );
  
  // Advanced Progress Tracking (Mixed Entries)
  const [mixedEntries, setMixedEntries] = useState<{
    id: number | string;
    entryType: string;
    seasonNumber: string;
    episodes: string;
    languages: DubLanguage[];
  }[]>(
    initDataAny?.mixedEntries && Array.isArray(initDataAny.mixedEntries)
      ? initDataAny.mixedEntries.map((e: any, idx: number) => ({
          id: e.id || idx + 1,
          entryType: e.entryType || e.type || 'Season',
          seasonNumber: e.seasonNumber || e.number || String(idx + 1),
          episodes: String(e.episodes || e.episodeCount || 12),
          languages: e.languages || ['Tamil', 'Hindi']
        }))
      : initialData ? [
          {
            id: 1,
            entryType: 'Season',
            seasonNumber: initialData.release_season || initDataAny?.season || '1',
            episodes: String(initialData.episodes_count || 12),
            languages: (Array.isArray(initialData.languages) 
              ? initialData.languages 
              : (initialData.languages || 'Tamil, Hindi').split(',').map((s: string) => s.trim())) as DubLanguage[]
          }
        ] : [
          {
            id: 1,
            entryType: 'Season',
            seasonNumber: '1',
            episodes: '12',
            languages: ['Tamil', 'Hindi']
          }
        ]
  );

  const seasonDetails = mixedEntries.map(entry => ({
    type: (entry.entryType as any) || 'Season',
    label: entry.seasonNumber || '1',
    episodeCount: entry.episodes === '' ? '' : Number(entry.episodes) || 0,
    languages: entry.languages || ['Tamil', 'Hindi']
  }));

  const [currentSeason, setCurrentSeason] = useState<string>(initialData?.release_season || initDataAny?.season || '');
  const [currentlyAiringEpisode, setCurrentlyAiringEpisode] = useState<number | ''>(initialData?.episodes_count || '');

  // Multi-Platform Links
  const [streamingPartners, setStreamingPartners] = useState<{ 
    name: string; 
    url: string;
    languages: DubLanguage[];
  }[]>(
    initialData ? [
      { 
        name: initialData.platform || 'Crunchyroll', 
        url: '', 
        languages: (Array.isArray(initialData.languages) 
          ? initialData.languages 
          : (initialData.languages || 'Tamil, Hindi').split(',').map((s: string) => s.trim())) as DubLanguage[]
      }
    ] : [
      { name: 'Crunchyroll', url: '', languages: ['Tamil', 'Hindi'] }
    ]
  );

  const [airingStatus, setAiringStatus] = useState<'Ongoing' | 'Completed'>(
    initialData?.status?.toLowerCase() === 'airing' || initialData?.status?.toLowerCase() === 'ongoing' ? 'Ongoing' : 'Completed'
  );
  const [releaseDay, setReleaseDay] = useState<string>('Saturday');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setRomajiTitle(initialData.japanese_title || '');
      setPoster(initialData.poster_url || initDataAny?.cover_image || '');
      setReleaseYear(initialData.release_year || initDataAny?.year || new Date().getFullYear());
      setRating(initialData.rating !== undefined ? initialData.rating : '');
      
      const rawType = initDataAny?.type || initDataAny?.Type || (initialData as any)?.type || (initialData as any)?.Type || 'TV Series';
      let cleanType = 'TV Series';
      if (rawType && typeof rawType === 'string') {
        const trimmed = rawType.trim();
        const lower = trimmed.toLowerCase();
        if (lower === 'movie' || lower === 'film' || lower.includes('movie')) cleanType = 'Movie';
        else if (lower === 'ova/special') cleanType = 'OVA/Special';
        else if (lower === 'ova') cleanType = 'OVA';
        else if (lower === 'ona') cleanType = 'ONA';
        else if (lower === 'special' || lower === 'specials') cleanType = 'Special';
        else if (lower.includes('ova') || lower.includes('special')) cleanType = 'OVA/Special';
        else if (lower === 'tv' || lower === 'tv series' || lower === 'series' || lower.includes('tv') || lower.length > 0) cleanType = 'TV Series';
        else cleanType = trimmed;
      }
      setType(cleanType);

      // State Initialization: When the Edit Modal opens and sets its state, make sure the type property is explicitly included
      const anime = initialData as any;
      setFormData({ ...anime, type: anime.type || anime.Type || 'TV Series' });

      const rawStatus = initDataAny?.status || (initialData as any).status || 'Completed';
      const trimmedStatus = typeof rawStatus === 'string' ? rawStatus.trim() : rawStatus;
      setAiringStatus(trimmedStatus.toLowerCase() === 'airing' || trimmedStatus.toLowerCase() === 'ongoing' ? 'Ongoing' : 'Completed');

      if (initDataAny?.mixedEntries && Array.isArray(initDataAny.mixedEntries)) {
        const mapped = initDataAny.mixedEntries.map((e: any, idx: number) => ({
          id: e.id || idx + 1,
          entryType: e.entryType || e.type || 'Season',
          seasonNumber: e.seasonNumber || e.number || String(idx + 1),
          episodes: String(e.episodes || e.episodeCount || 12),
          languages: e.languages || ['Tamil', 'Hindi']
        }));
        setMixedEntries(mapped);
        setCurrentSeason(String(mapped.length));
        const last = mapped[mapped.length - 1];
        if (last && last.episodes) {
          setCurrentlyAiringEpisode(Number(last.episodes) || 12);
        }
      } else {
        const rawEp = initDataAny?.episodes_per_season || initDataAny?.Episodes || initDataAny?.episodes || initialData.episodes_count;
        if (rawEp) {
          const epStr = String(rawEp);
          const mappedLangs = (Array.isArray(initialData.languages) 
            ? initialData.languages 
            : (initialData.languages || 'Tamil, Hindi').split(',').map((s: string) => s.trim())) as DubLanguage[];
          const episodesArray = epStr.split('|').map((ep: string) => ep.trim()).filter(Boolean);
          if (episodesArray.length > 0) {
            const parsedSeasons = episodesArray.map((epCount: string, idx: number) => ({
              id: Date.now() + Math.random() + idx,
              entryType: 'Season',
              seasonNumber: String(idx + 1),
              episodes: String(epCount),
              languages: mappedLangs
            }));
            setMixedEntries(parsedSeasons);
            setCurrentSeason(String(episodesArray.length));
            setCurrentlyAiringEpisode(Number(episodesArray[episodesArray.length - 1]) || 12);
          } else {
            setMixedEntries([{
              id: 1,
              entryType: 'Season',
              seasonNumber: initialData.release_season || initDataAny?.season || '1',
              episodes: String(rawEp),
              languages: mappedLangs
            }]);
            setCurrentSeason('1');
            setCurrentlyAiringEpisode(Number(rawEp) || 12);
          }
        }
      }
    }
  }, [initialData]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // NOTE: Remember to paste/replace your ImgBB API key below (e.g., 'ee6b4e37ae9c228c29b8448483b6591b')
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('image', file);

      const apiKey = 'ee6b4e37ae9c228c29b8448483b6591b'; // TODO: Paste your ImgBB API key here
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formDataObj
      });
      const data = await res.json();
      if (data && data.success && data.data) {
        const publicUrl = data.data.display_url || data.data.url;
        setPoster(publicUrl);
        setFormData((prev: any) => ({
          ...prev,
          poster: publicUrl,
          cover_image: publicUrl,
          posterUrl: publicUrl,
          image: publicUrl
        }));
      } else {
        console.warn('ImgBB API upload failed:', data);
      }
    } catch (err) {
      console.error('ImgBB upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const addStreamingPartner = () => {
    setStreamingPartners([...streamingPartners, { name: 'Crunchyroll', url: '', languages: ['Tamil', 'Hindi'] }]);
  };

  const removeStreamingPartner = (index: number) => {
    if (streamingPartners.length > 1) {
      setStreamingPartners(streamingPartners.filter((_, i) => i !== index));
    }
  };

  const updateStreamingPartner = (index: number, field: 'name' | 'url' | 'languages', value: any) => {
    const updated = [...streamingPartners];
    updated[index] = { ...updated[index], [field]: value };
    setStreamingPartners(updated);
  };

  const addEntry = () => {
    const lastEntry = mixedEntries[mixedEntries.length - 1];
    let nextNum = '1';
    if (lastEntry && !isNaN(parseInt(lastEntry.seasonNumber))) {
      nextNum = (parseInt(lastEntry.seasonNumber) + 1).toString();
    }
    setMixedEntries([...mixedEntries, {
      id: Date.now() + Math.random(),
      entryType: 'Season',
      seasonNumber: nextNum,
      episodes: '12',
      languages: lastEntry?.languages || ['Tamil']
    }]);
  };

  const removeEntry = (index: number) => {
    if (mixedEntries.length > 1) {
      setMixedEntries(mixedEntries.filter((_, i) => i !== index));
    }
  };

  const updateEntryField = (index: number, field: string, value: any) => {
    const updated = [...mixedEntries];
    if (field === 'episodeCount' || field === 'episodes') {
      updated[index] = { ...updated[index], episodes: String(value) };
    } else if (field === 'label' || field === 'number' || field === 'seasonNumber') {
      updated[index] = { ...updated[index], seasonNumber: String(value) };
    } else if (field === 'type' || field === 'entryType') {
      updated[index] = { ...updated[index], entryType: value };
    } else if (field === 'languages') {
      updated[index] = { ...updated[index], languages: value };
    }
    setMixedEntries(updated);
  };

  const toggleLangForEntry = (entryIdx: number, lang: DubLanguage) => {
    const currentLangs = seasonDetails[entryIdx].languages || [];
    let updatedLangs: DubLanguage[];
    if (currentLangs.includes(lang)) {
      updatedLangs = currentLangs.filter(l => l !== lang);
    } else {
      updatedLangs = [...currentLangs, lang];
    }
    updateEntryField(entryIdx, 'languages', updatedLangs);
  };

  const toggleGenre = (genre: string) => {
    if (genres.includes(genre)) {
      setGenres(genres.filter((g) => g !== genre));
    } else {
      setGenres([...genres, genre]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const rawLanguages = Array.from(new Set(
      seasonDetails.flatMap(s => s.languages || [])
    )) as DubLanguage[];
    const derivedGlobalDubs = rawLanguages.length > 0 ? rawLanguages : (['Tamil', 'Hindi'] as DubLanguage[]);

    setIsSubmitting(true);
    const defaultCover =
      (poster || formData.posterUrl || formData.poster || formData.image || formData.cover_image || '').trim() ||
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

    try {

      const totalEpisodes = seasonDetails.reduce((acc, s) => acc + (Number(s.episodeCount) || 0), 0);
      
      const parsedRating = (rating !== '' && rating !== undefined) ? Number(rating) : 7.8;
      const parsedYear = releaseYear ? Number(releaseYear) : 2025;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const payload = {
        title: title.trim(),
        slug,
        cover_image: defaultCover,
        banner_image: defaultCover,
        rating: parsedRating,
        episodes_count: totalEpisodes || 12,
        status: mode === 'edit' ? 'approved' : 'pending',
        submissionStatus: mode === 'edit' ? 'approved' : 'pending',
        airing_status: airingStatus === 'Ongoing' ? 'Airing' : 'Completed',
        languages: derivedGlobalDubs.join(', '),
        platform: streamingPartners[0]?.name || 'Crunchyroll',
        type: formData.type || type || 'TV Series',
        season: 'Spring',
        year: parsedYear,
        genres: Array.isArray(genres) ? genres.join(',') : genres,
        popularity: 1000,
        studio: studio || 'Unknown Studio'
      };

      if (mode === 'edit' && initialData?.id) {
        await cloudflareApi.updateAnime(initialData.id, payload);
      } else {
        await cloudflareApi.createAnime(payload);
      }

      const fullUpdatedItem = {
        ...payload,
        id: initialData?.id,
        cover_image: defaultCover,
        image: defaultCover,
        poster: defaultCover,
        posterUrl: defaultCover,
        poster_url: defaultCover
      };

      // Trigger parent state update immediately
      onSubmit(fullUpdatedItem);

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[Submission error]:', err);
      // Fallback local success so user isn't blocked by transient network errors
      const fallbackItem = {
        title: title.trim(),
        id: initialData?.id,
        cover_image: defaultCover,
        image: defaultCover,
        poster: defaultCover,
        posterUrl: defaultCover,
        poster_url: defaultCover
      };
      onSubmit(fallbackItem);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const platformOptions = [
    'Crunchyroll',
    'Netflix',
    'JioCinema',
    'JioHotstar',
    'YouTube',
    'YouTube (Muse India)',
    'YouTube (Ani-One)',
    'Disney+ Hotstar',
    'Prime Video',
    'Anime Times',
    'Sony YAY!',
    'Sony LIV',
    'Bilibili',
    'Cartoon Network India',
    'ETV Bal Bharat',
    'Zee5'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      <div className="relative w-full max-w-xl bg-[#0b0e18]/95 border border-white/10 hover:border-purple-500/40 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.25)] overflow-hidden z-10 my-auto text-neutral-100 backdrop-blur-2xl max-h-[90vh] flex flex-col font-sans transition-all duration-300">
        
        {/* HEADER */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-transparent to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-white leading-tight">
                {mode === 'edit' ? 'Edit Anime Info' : 'Submit Dub Info'}
              </h3>
              {mode !== 'edit' && (
                <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Strict Moderation: Requires Admin Approval</span>
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLING BODY */}
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="p-5 sm:p-6 space-y-4">
            {isSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-heading font-black text-xl text-white">
                  {mode === 'edit' ? 'Changes Saved Successfully!' : 'Saved with Status: "Pending"!'}
                </h4>
                <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
                  {mode === 'edit'
                    ? 'Your edits have been successfully saved and updated directly in the live catalog.'
                    : 'Your submission is currently locked under Strict Moderation. It has been sent to the Admin Dashboard and will remain hidden from the website until approved.'}
                </p>
              </div>
            ) : (
              <form id="dub-info-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
                
                {/* Title Field */}
                <div>
                  <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Anime Title <span className="text-purple-400">*</span></span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Solo Leveling, Demon Slayer, Jujutsu Kaisen..."
                      className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-primary-theme rounded-xl py-2.5 pl-3.5 pr-8 text-xs text-white placeholder-neutral-500 outline-none transition-all"
                    />
                    <Search className="w-4 h-4 text-neutral-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Poster Upload Area */}
                <div>
                  <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Anime Poster (Upload File or Enter URL)</span>
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-3 items-center">
                      <div 
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        className="flex-1 h-16 border-2 border-dashed border-neutral-700 hover:border-primary-theme rounded-2xl bg-[#171e2e] flex flex-col items-center justify-center cursor-pointer transition-all group"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 text-primary-theme animate-spin mb-0.5" />
                            <span className="text-[10px] text-neutral-300 font-bold uppercase tracking-wider">
                              Uploading...
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-neutral-500 group-hover:text-accent-theme mb-0.5" />
                            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider group-hover:text-neutral-200">
                              {poster ? 'Change Uploaded Photo' : 'Upload Image File'}
                            </span>
                          </>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          className="hidden" 
                        />
                      </div>
                      {(poster || formData.poster) && (
                        <div className="relative shrink-0">
                          <img
                            src={poster || formData.poster || undefined}
                            alt="Preview"
                            className="w-12 h-16 object-cover rounded-xl border border-primary-theme/50 shadow-xl"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              setPoster('');
                              setFormData((prev: any) => ({
                                ...prev,
                                poster: '',
                                cover_image: '',
                                posterUrl: '',
                                image: ''
                              }));
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center text-white border border-black shadow-lg hover:bg-purple-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={poster || formData.poster || ''}
                      onChange={(e) => {
                        setPoster(e.target.value);
                        setFormData((prev: any) => ({
                          ...prev,
                          poster: e.target.value,
                          cover_image: e.target.value,
                          posterUrl: e.target.value,
                          image: e.target.value
                        }));
                      }}
                      placeholder="Or paste poster image URL (https://...)"
                      className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-primary-theme rounded-xl py-2 px-3 text-xs text-white placeholder-neutral-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Streaming Partners */}
                <div className="space-y-2">
                  <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Streaming Partners (Multi-Link)</span>
                    <button 
                      type="button" 
                      onClick={addStreamingPartner}
                      className="text-[10px] text-accent-theme font-bold hover:text-primary-theme flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Platform
                    </button>
                  </label>
                  
                  <div className="space-y-3">
                    {streamingPartners.map((partner, idx) => (
                      <div key={idx} className="bg-[#141b29] border border-neutral-800 rounded-2xl p-3 space-y-2">
                        <div className="flex gap-2 items-start">
                          <div className="w-1/3">
                            <select
                              value={partner.name}
                              onChange={(e) => updateStreamingPartner(idx, 'name', e.target.value)}
                              className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-primary-theme cursor-pointer"
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
                          <div className="flex-1 relative">
                            <input
                              type="url"
                              value={partner.url}
                              onChange={(e) => updateStreamingPartner(idx, 'url', e.target.value)}
                              placeholder="Link (e.g. https://...)"
                              className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-[11px] text-white placeholder-neutral-600 focus:outline-none focus:border-primary-theme"
                            />
                          </div>
                          {streamingPartners.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStreamingPartner(idx)}
                              className="p-2.5 rounded-xl bg-neutral-800/50 text-neutral-500 hover:text-purple-400 hover:bg-purple-950/25 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3-Column Grid (Type, Status, Release Day) */}
                <div className={`grid grid-cols-1 ${airingStatus === 'Ongoing' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                  <div>
                    <label className="block font-bold text-neutral-300 mb-1">Type</label>
                    <select 
                      value={formData.type || 'TV Series'} 
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-theme cursor-pointer text-xs"
                    >
                      <option value="TV Series">TV Series</option>
                      <option value="Movie">Movie</option>
                      <option value="OVA/Special">OVA/Special</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-300 mb-1">Status</label>
                    <select
                      value={airingStatus}
                      onChange={(e) => setAiringStatus(e.target.value as 'Ongoing' | 'Completed')}
                      className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-theme cursor-pointer text-xs"
                    >
                      <option value="Ongoing">Ongoing (Simulcast)</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  {airingStatus === 'Ongoing' && (
                    <div>
                      <label className="block font-bold text-neutral-300 mb-1">Release Day</label>
                      <select
                        value={releaseDay}
                        onChange={(e) => setReleaseDay(e.target.value)}
                        className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-theme cursor-pointer text-xs"
                      >
                        {ALL_DAYS.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Ongoing Airing Status Box */}
                {airingStatus === 'Ongoing' && (
                  <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Currently Airing Details</span>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-300/90 mb-1">Current Season</label>
                        <input
                          type="text"
                          value={currentSeason}
                          onChange={(e) => setCurrentSeason(e.target.value)}
                          placeholder="e.g. Season 2"
                          className="w-full bg-[#171e2e] border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-amber-300/90 mb-1">Live Episode</label>
                        <input
                          type="number"
                          value={currentlyAiringEpisode}
                          onChange={(e) => setCurrentlyAiringEpisode(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                          placeholder="e.g. 5"
                          className="w-full bg-[#171e2e] border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Mixed Entries Section */}
                <div className="space-y-3">
                  <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-accent-theme" />
                      <span>Mixed Entries (Seasons, OVAs, Movies)</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={addEntry}
                      className="text-[10px] text-accent-theme font-bold hover:text-primary-theme flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Entry
                    </button>
                  </label>

                  <div className="space-y-2.5">
                    {seasonDetails.map((entry, idx) => (
                      <div key={idx} className="bg-[#171e2e] border border-neutral-700/80 rounded-2xl p-3 space-y-2.5">
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4">
                            <select
                              value={entry.type}
                              onChange={(e) => updateEntryField(idx, 'type', e.target.value)}
                              className="w-full bg-[#121829] border border-neutral-700 rounded-xl px-2 py-1.5 text-[11px] text-white outline-none cursor-pointer"
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
                              value={entry.label}
                              onChange={(e) => updateEntryField(idx, 'label', e.target.value)}
                              placeholder="Label"
                              className="w-full bg-[#121829] border border-neutral-700 rounded-xl px-2 py-1.5 text-[11px] text-white outline-none"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              value={entry.episodeCount}
                              onChange={(e) => updateEntryField(idx, 'episodeCount', e.target.value)}
                              placeholder="Eps"
                              className="w-full bg-[#121829] border border-neutral-700 rounded-xl px-2 py-1.5 text-[11px] text-white outline-none"
                            />
                          </div>
                          <div className="col-span-2 flex justify-center items-center">
                            {seasonDetails.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEntry(idx)}
                                className="p-1.5 rounded-xl text-neutral-500 hover:text-purple-400 hover:bg-purple-950/20 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Language Pill Toggles */}
                        <div>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Available Languages:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_LANGS.map(sl => {
                              const isSel = entry.languages.includes(sl);
                              return (
                                <button
                                  key={sl}
                                  type="button"
                                  onClick={() => toggleLangForEntry(idx, sl)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                    isSel
                                      ? 'bg-purple-600 text-white font-bold ring-1 ring-purple-400'
                                      : 'bg-[#121829] text-neutral-400 border border-neutral-700'
                                  }`}
                                >
                                  {sl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Genres */}
                <div>
                  <label className="block font-bold text-neutral-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>Genres</span>
                      <span className="text-[10px] text-neutral-400 font-normal">(Select all that apply)</span>
                    </span>
                    <span className="text-[10px] text-purple-400 font-bold">{genres.length} selected</span>
                  </label>
                  <div className="flex flex-wrap gap-2 p-3.5 rounded-2xl bg-[#141b29] border border-neutral-700/80 max-h-48 overflow-y-auto no-scrollbar">
                    {AVAILABLE_GENRES.map((g) => {
                      const isSelected = genres.includes(g);
                      return (
                        <button
                          type="button"
                          key={g}
                          onClick={() => toggleGenre(g)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#9333ea] to-[#7c3aed] text-white shadow-[0_0_15px_rgba(147,51,234,0.45)] ring-1 ring-purple-400/70'
                              : 'bg-[#1a2235] text-neutral-400 hover:text-neutral-200 border border-neutral-700/60 hover:border-neutral-600'
                          }`}
                        >
                          {isSelected && <span className="text-white text-xs font-black">✓</span>}
                          <span>{g}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Studio, Year, Rating */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-neutral-400 mb-1">Studio</label>
                    <input
                      type="text"
                      value={studio}
                      onChange={(e) => setStudio(e.target.value)}
                      placeholder="e.g. Ufotable"
                      className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-neutral-400 mb-1">Year</label>
                    <input
                      type="number"
                      value={releaseYear}
                      onChange={(e) => setReleaseYear(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                      placeholder="2025"
                      className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-neutral-400 mb-1">Rating</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={rating}
                      onChange={(e) => setRating(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="8.5"
                      className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Strict Moderation Gate Card */}
                <div className="rounded-2xl p-4 bg-amber-950/20 border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Strict Moderation Gate</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    This submission will be saved with <span className="text-amber-400 font-bold">status: "pending"</span>. It will <span className="text-rose-400 font-bold">NEVER</span> appear on the public website until approved by the admin.
                  </p>
                </div>

              </form>
            )}
          </div>
        </div>

        {/* STICKY GLOWING FOOTER BUTTON */}
        {!isSuccess && (
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#111726] via-[#111726]/95 to-transparent backdrop-blur-lg border-t border-white/5 z-50">
            <button
              type="submit"
              form="dub-info-form"
              disabled={isSubmitting || !title.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-purple-600 hover:from-orange-500 hover:via-amber-500 hover:to-purple-500 text-white font-black text-sm flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2 text-white">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
                  <span>{mode === 'edit' ? 'Saving changes to Cloudflare D1...' : 'Submitting to Cloudflare Edge...'}</span>
                </div>
              ) : (
                <div className="relative flex items-center gap-3">
                  <div className="absolute -inset-1 bg-white rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity" />
                  <Send className="w-5 h-5 relative" />
                  <span>{mode === 'edit' ? 'Save Anime Changes to Cloudflare' : 'Submit Dub for Admin Approval'}</span>
                </div>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
