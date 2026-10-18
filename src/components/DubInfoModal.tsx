import React, { useState } from 'react';
import { 
  X, Film, ShieldAlert, Sparkles, Tv, Plus, Trash2, Check, 
  Send, Globe, Link as LinkIcon, Languages, Star, AlertTriangle
} from 'lucide-react';

interface DubInfoModalProps {
  isOpen: boolean;
  mode?: 'submit' | 'edit';
  initialData?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const DubInfoModal: React.FC<DubInfoModalProps> = ({
  isOpen,
  mode = 'submit',
  initialData,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState(initialData?.title || '');
  const [synopsis, setSynopsis] = useState(initialData?.synopsis || '');
  const [coverImage, setCoverImage] = useState(initialData?.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80');
  const [bannerImage, setBannerImage] = useState(initialData?.banner_image || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1600&auto=format&fit=crop&q=80');
  const [rating, setRating] = useState(initialData?.rating ? String(initialData.rating) : '7.8');
  const [episodesCount, setEpisodesCount] = useState(initialData?.episodes_count ? String(initialData.episodes_count) : '12');
  const [status, setStatus] = useState<'Ongoing' | 'Completed'>(
    initialData?.status?.toLowerCase() === 'ongoing' || initialData?.status?.toLowerCase() === 'airing' ? 'Ongoing' : 'Completed'
  );
  const [ongoingSeason, setOngoingSeason] = useState(initialData?.season || 'Season 1');
  const [ongoingEpisode, setOngoingEpisode] = useState('Episode 12');
  const [season, setSeason] = useState(initialData?.season || 'Spring');
  const [year, setYear] = useState(initialData?.year ? String(initialData.year) : '2025');
  const [animationStudio, setAnimationStudio] = useState(initialData?.animation_studio || 'Liden Films');
  
  // Platform links state
  const [platforms, setPlatforms] = useState<Array<{ name: string; url: string }>>(
    initialData?.platforms || [
      { name: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/example' },
      { name: 'Netflix', url: 'https://www.netflix.com/title/example' }
    ]
  );

  // Mixed entries state (dynamic rows)
  const [entries, setEntries] = useState<Array<{ type: string; season: string; episode: string; languages: string[] }>>(
    initialData?.entries || [
      { type: 'TV Series', season: 'Season 1', episode: '1-12', languages: ['Hi', 'Ta', 'Te'] },
      { type: 'Movie', season: 'Movie 1', episode: 'Full Movie', languages: ['Hi', 'Ta'] }
    ]
  );

  // Available Languages short pills
  const shortLangs = ['Ta', 'Te', 'Hi', 'Ma', 'Ka', 'Be', 'En'];

  // Genres state
  const selectedGenresList = initialData?.genres 
    ? initialData.genres.split(',').map((g: string) => g.trim()) 
    : ['Action', 'Fantasy', 'Romance'];
  const [selectedGenres, setSelectedGenres] = useState<string[]>(selectedGenresList);

  const availableGenres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 
    'Fantasy', 'Horror', 'Isekai', 'Mystery', 
    'Romance', 'Sci-Fi', 'Shonen', 'Seinen', 
    'Shoujo', 'Josei', 'Slice of Life', 'Sports'
  ];

  const platformOptions = ['Crunchyroll', 'Netflix', 'JioCinema', 'Disney+ Hotstar', 'Amazon Prime', 'Muse India', 'Ani-One India'];

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleAddPlatform = () => {
    setPlatforms([...platforms, { name: 'Crunchyroll', url: '' }]);
  };

  const handleRemovePlatform = (index: number) => {
    setPlatforms(platforms.filter((_, i) => i !== index));
  };

  const handlePlatformChange = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...platforms];
    updated[index][field] = value;
    setPlatforms(updated);
  };

  const handleAddEntry = () => {
    setEntries([...entries, { type: 'TV Series', season: `Season ${entries.length + 1}`, episode: '1-12', languages: ['Hi'] }]);
  };

  const handleRemoveEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleEntryChange = (index: number, field: 'type' | 'season' | 'episode', value: string) => {
    const updated = [...entries];
    updated[index][field] = value;
    setEntries(updated);
  };

  const toggleLangForEntry = (entryIdx: number, lang: string) => {
    const updated = [...entries];
    const currLangs = updated[entryIdx].languages;
    if (currLangs.includes(lang)) {
      updated[entryIdx].languages = currLangs.filter(l => l !== lang);
    } else {
      updated[entryIdx].languages = [...currLangs, lang];
    }
    setEntries(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Collect all languages from entries
    const allLangs = Array.from(new Set(entries.flatMap(e => e.languages)));

    onSubmit({
      title,
      synopsis,
      cover_image: coverImage,
      banner_image: bannerImage,
      rating: parseFloat(rating) || 7.5,
      episodes_count: parseInt(episodesCount) || 12,
      status: status === 'Ongoing' ? 'Ongoing' : 'Completed',
      season: status === 'Ongoing' ? ongoingSeason : season,
      year: parseInt(year) || 2025,
      animation_studio: animationStudio,
      genres: selectedGenres.join(','),
      languages: allLangs.join(','),
      platforms,
      entries
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[4px] flex items-center justify-center p-3 sm:p-4">
      
      {/* 1) MODAL SHELL */}
      <div className="relative w-full max-w-[510px] h-[calc(100dvh-40px)] my-[20px] mx-[16px] rounded-[32px] bg-[#0d1225] border border-[#d4d4d8] overflow-hidden flex flex-col shadow-2xl">
        
        {/* 2) HEADER (Fixed) */}
        <div className="shrink-0 p-[28px] bg-gradient-to-r from-[#2b1760] to-[#121734] border-b border-[#1f2645] flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] border border-[#8b5cf6] flex items-center justify-center text-[#e9d5ff] shrink-0 shadow-lg">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-white font-['Space_Grotesk',sans-serif] leading-tight">
                {mode === 'edit' ? 'Edit Anime Info' : 'Submit Dub Info'}
              </h2>
              <div className="flex items-center space-x-1.5 mt-1">
                <ShieldAlert className="w-4 h-4 text-[#fbbf24] shrink-0" />
                <span className="text-[12px] font-medium text-[#fbbf24]">
                  Strict Moderation: Requires Admin Approval
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 flex items-center justify-center text-[#cbd5e1] transition-colors shrink-0 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3) BODY (Scrolling) */}
        <div className="flex-1 overflow-y-auto p-[24px] space-y-[28px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#3a3f55] [&::-webkit-scrollbar-thumb]:rounded-full">
          
          <form id="dub-info-form" onSubmit={handleSubmit} className="space-y-[28px]">
            
            {/* Title Field */}
            <div className="space-y-[10px]">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-semibold text-white">
                  Anime Title <span className="text-[#8b92a5] font-normal text-[11px]">(Required)</span>
                </label>
                <span className="text-[11px] font-medium text-[#a855f7]">Verified Catalog</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Agents of the Four Seasons"
                required
                className="w-full h-10 rounded-full px-4 bg-[#121830] border border-[#262d4a] text-white text-[14px] placeholder-[#6b7280] focus:outline-none focus:border-[#a855f7] focus:ring-[3px] focus:ring-[#a855f7]/25 transition-all"
              />
            </div>

            {/* Poster & Banner Image URLs */}
            <div className="space-y-[10px]">
              <label className="text-[13px] font-semibold text-white block">
                Poster Image URL <span className="text-[#8b92a5] font-normal text-[11px]">(2:3 aspect)</span>
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
                required
                className="w-full h-10 rounded-full px-4 bg-[#121830] border border-[#262d4a] text-white text-[14px] placeholder-[#6b7280] focus:outline-none focus:border-[#a855f7] focus:ring-[3px] focus:ring-[#a855f7]/25 transition-all"
              />
            </div>

            <div className="space-y-[10px]">
              <label className="text-[13px] font-semibold text-white block">
                Banner Image URL <span className="text-[#8b92a5] font-normal text-[11px]">(16:9 aspect) (Optional)</span>
              </label>
              <input
                type="url"
                value={bannerImage}
                onChange={(e) => setBannerImage(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 rounded-full px-4 bg-[#121830] border border-[#262d4a] text-white text-[14px] placeholder-[#6b7280] focus:outline-none focus:border-[#a855f7] focus:ring-[3px] focus:ring-[#a855f7]/25 transition-all"
              />
            </div>

            {/* Airing Status Selector */}
            <div className="space-y-[10px]">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-semibold text-white">
                  Airing Status <span className="text-[#8b92a5] font-normal text-[11px]">(Required)</span>
                </label>
                <span className="text-[11px] font-medium text-[#a855f7]">Shows Live Badge if Ongoing</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('Ongoing')}
                  className={`h-10 rounded-full text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    status === 'Ongoing'
                      ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                      : 'bg-[#121830] border border-[#262d4a] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>Ongoing (Live Airing)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Completed')}
                  className={`h-10 rounded-full text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    status === 'Completed'
                      ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                      : 'bg-[#121830] border border-[#262d4a] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Completed</span>
                </button>
              </div>
            </div>

            {/* ONGOING AIRING STATUS CARD (Only if Status=Ongoing) */}
            {status === 'Ongoing' && (
              <div className="rounded-[18px] p-[22px] bg-[rgba(245,158,11,0.05)] border-[1.5px] border-[rgba(245,158,11,0.45)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>ONGOING AIRING STATUS</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse ring-4 ring-amber-400/20"></span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-amber-300 uppercase tracking-wide">
                      Airing Season
                    </label>
                    <input
                      type="text"
                      value={ongoingSeason}
                      onChange={(e) => setOngoingSeason(e.target.value)}
                      placeholder="e.g. Season 2"
                      className="w-full h-10 rounded-full px-4 bg-[#0a0c10] border-[1.5px] border-amber-500/60 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-amber-300 uppercase tracking-wide">
                      Latest Episode
                    </label>
                    <input
                      type="text"
                      value={ongoingEpisode}
                      onChange={(e) => setOngoingEpisode(e.target.value)}
                      placeholder="e.g. Episode 14"
                      className="w-full h-10 rounded-full px-4 bg-[#0a0c10] border-[1.5px] border-amber-500/60 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <p className="text-[11.5px] text-[#fbbf24]/85 leading-relaxed font-normal">
                  Live Airing Badge: This anime will show the blinking LIVE badge on home and catalog cards until status changes to Completed.
                </p>
              </div>
            )}

            {/* Platform Links Section */}
            <div className="space-y-[10px]">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-semibold text-white">
                  Platform Links <span className="text-[#8b92a5] font-normal text-[11px]">(Optional)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddPlatform}
                  className="text-[#a855f7] text-[11px] font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Platform Link</span>
                </button>
              </div>

              <div className="space-y-3">
                {platforms.map((plat, idx) => (
                  <div 
                    key={idx}
                    className="bg-[#151b33] border border-[#232a45] rounded-[18px] p-[14px] space-y-2"
                  >
                    <div className="flex items-center gap-[10px]">
                      <select
                        value={plat.name}
                        onChange={(e) => handlePlatformChange(idx, 'name', e.target.value)}
                        className="w-[130px] h-10 rounded-full px-3 bg-[#0d1225] border border-[#262d4a] text-white text-xs focus:outline-none focus:border-[#a855f7] shrink-0"
                      >
                        {platformOptions.map(p => (
                          <option key={p} value={p} className="bg-[#0d1225] text-white">{p}</option>
                        ))}
                      </select>

                      <input
                        type="url"
                        value={plat.url}
                        onChange={(e) => handlePlatformChange(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className="flex-1 min-w-0 h-10 rounded-full px-4 bg-[#0d1225] border border-[#262d4a] text-white text-xs placeholder-[#6b7280] focus:outline-none focus:border-[#a855f7]"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemovePlatform(idx)}
                        className="w-9 h-9 rounded-full bg-red-950/40 border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-900/60 transition-colors shrink-0 cursor-pointer"
                        title="Remove link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Validation Error Tooltip if empty */}
                    {!plat.url && (
                      <div className="text-[11px] text-amber-400 flex items-center space-x-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/25 rounded-lg w-fit">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Please enter a URL.</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mixed Entries Section */}
            <div className="space-y-[10px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[#a855f7] text-[14px] font-bold">
                  <Tv className="w-5 h-5 text-[#a855f7]" />
                  <span>Mixed Entries (Seasons / Movies / OVAs)</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddEntry}
                  className="h-8 px-3 rounded-full bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-semibold hover:bg-purple-600/30 flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Entry</span>
                </button>
              </div>

              <div className="space-y-3">
                {entries.map((entry, eIdx) => (
                  <div 
                    key={eIdx}
                    className="bg-[#151a30] border border-[#232a45] rounded-[18px] p-[14px] space-y-3"
                  >
                    {/* Row 1: Type select, season #, episode # */}
                    <div className="flex items-center gap-[10px]">
                      <select
                        value={entry.type}
                        onChange={(e) => handleEntryChange(eIdx, 'type', e.target.value)}
                        className="h-[32px] rounded-full bg-[#0a0c16] border border-[#1c2240] text-xs text-white px-3 focus:outline-none focus:border-[#a855f7]"
                      >
                        <option value="TV Series" className="bg-[#0a0c16]">TV Series</option>
                        <option value="Movie" className="bg-[#0a0c16]">Movie</option>
                        <option value="OVA" className="bg-[#0a0c16]">OVA</option>
                        <option value="Special" className="bg-[#0a0c16]">Special</option>
                      </select>

                      <input
                        type="text"
                        value={entry.season}
                        onChange={(e) => handleEntryChange(eIdx, 'season', e.target.value)}
                        placeholder="Season 1"
                        className="h-[32px] w-24 rounded-full bg-[#0a0c16] border border-[#1c2240] text-xs text-white px-3 focus:outline-none focus:border-[#a855f7]"
                      />

                      <input
                        type="text"
                        value={entry.episode}
                        onChange={(e) => handleEntryChange(eIdx, 'episode', e.target.value)}
                        placeholder="1-12"
                        className="h-[32px] w-24 rounded-full bg-[#0a0c16] border border-[#1c2240] text-xs text-white px-3 focus:outline-none focus:border-[#a855f7]"
                      />

                      {entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEntry(eIdx)}
                          className="w-[32px] h-[32px] rounded-full bg-red-950/40 border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-900/60 transition-colors ml-auto shrink-0 cursor-pointer"
                          title="Remove entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Row 2: AVAILABLE IN + language pills */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b92a5] mb-1.5 block">
                        AVAILABLE IN:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {shortLangs.map(sl => {
                          const isSel = entry.languages.includes(sl);
                          return (
                            <button
                              key={sl}
                              type="button"
                              onClick={() => toggleLangForEntry(eIdx, sl)}
                              className={`h-[22px] px-[10px] rounded-full text-[11px] font-semibold transition-all inline-flex items-center justify-center cursor-pointer ${
                                isSel
                                  ? 'bg-[rgba(168,85,247,0.18)] border-[1.5px] border-[#a855f7] text-[#e9d5ff] font-bold shadow-sm'
                                  : 'bg-[#13172b] border border-[#262c47] text-[#9ca3af] hover:text-white'
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

            {/* Genres Section */}
            <div className="space-y-[10px]">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-semibold text-white">
                  Genres <span className="text-[#8b92a5] font-normal text-[11px]">(Action, Comedy, Shonen, etc.) (Optional)</span>
                </label>
                <span className="text-[11px] font-medium text-[#a855f7]">{selectedGenres.length} selected</span>
              </div>

              <div className="bg-[#11162b] border border-[#232a45] rounded-[20px] p-[14px] max-h-[175px] overflow-y-auto [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#3a3f55]">
                <div className="flex flex-wrap gap-[7px]">
                  {availableGenres.map(genre => {
                    const isSelected = selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={`h-[34px] px-[16px] rounded-[12px] text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#9d1df5] to-[#7c3aed] text-white shadow-[0_0_15px_rgba(157,29,245,0.45)] border border-purple-400 font-bold'
                            : 'bg-[#151a30] border border-[#2a3050] text-[#9ca3af] hover:text-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        <span>{genre}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-[#8b92a5] leading-relaxed">
                Click tags to toggle genres. These link directly to the Library Genre filter so users can find this show easily.
              </p>
            </div>

            {/* Animation Studio */}
            <div className="space-y-[10px]">
              <label className="text-[13px] font-semibold text-white block">
                Animation Studio <span className="text-[#8b92a5] font-normal text-[11px]">(Optional)</span>
              </label>
              <input
                type="text"
                value={animationStudio}
                onChange={(e) => setAnimationStudio(e.target.value)}
                placeholder="e.g. Liden Films"
                className="w-full h-10 rounded-full px-4 bg-[#121830] border border-[#262d4a] text-white text-[14px] placeholder-[#6b7280] focus:outline-none focus:border-[#a855f7] focus:ring-[3px] focus:ring-[#a855f7]/25 transition-all"
              />
            </div>

            {/* Release Year */}
            <div className="space-y-[10px]">
              <label className="text-[13px] font-semibold text-white block">
                Release Year <span className="text-[#8b92a5] font-normal text-[11px]">(Optional)</span>
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2025"
                className="w-full h-10 rounded-full px-4 bg-[#121830] border border-[#262d4a] text-white text-[14px] placeholder-[#6b7280] focus:outline-none focus:border-[#a855f7] focus:ring-[3px] focus:ring-[#a855f7]/25 transition-all"
              />
            </div>

            {/* Global Rating (0-10) */}
            <div className="space-y-[10px]">
              <label className="text-[13px] font-semibold text-white block">
                GLOBAL RATING (0-10) <span className="text-[#8b92a5] font-normal text-[11px]">(Optional)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-full h-10 rounded-full px-4 pr-10 bg-[#121830] border border-[#262d4a] text-white text-[14px] focus:outline-none focus:border-[#a855f7] focus:ring-[3px] focus:ring-[#a855f7]/25 transition-all"
                />
                <Star className="absolute right-3.5 top-3 w-4 h-4 text-amber-400 fill-amber-400 pointer-events-none" />
              </div>
            </div>

            {/* Strict Moderation Gate Card */}
            <div className="rounded-[18px] p-4 bg-[rgba(245,158,11,0.05)] border-[1.5px] border-[rgba(245,158,11,0.45)] space-y-1.5">
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Strict Moderation Gate</span>
              </div>
              <p className="text-[12px] text-[#cbd5e1] leading-relaxed">
                This submission will be saved with <span className="text-amber-400 font-bold">status: "pending"</span>. It will <span className="text-red-400 font-bold">NEVER</span> appear on the public website (Home, Search, or Airing Now) until approved by the admin.
              </p>
            </div>

            {/* Synopsis Field */}
            <div className="space-y-[10px]">
              <label className="text-[13px] font-semibold text-white block">
                Synopsis <span className="text-[#8b92a5] font-normal text-[11px]">(Plot summary)</span>
              </label>
              <textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="Enter plot summary..."
                rows={3}
                required
                className="w-full rounded-2xl p-4 bg-[#121830] border border-[#262d4a] text-white text-[14px] placeholder-[#6b7280] focus:outline-none focus:border-[#a855f7] focus:ring-[3px] focus:ring-[#a855f7]/25 resize-none transition-all"
              />
            </div>

          </form>

        </div>

        {/* 4) FOOTER (Fixed) */}
        <div className="shrink-0 p-[24px] bg-[#0d1225] border-t border-[rgba(255,255,255,0.06)] relative">
          <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-[#0d1225] to-transparent pointer-events-none" />
          
          <button
            type="submit"
            form="dub-info-form"
            disabled={!title.trim()}
            className="w-full h-[60px] rounded-[22px] bg-gradient-to-r from-[#ff8a00] via-[#e0521a] to-[#9333ea] text-white text-[15px] font-bold shadow-[0_0_25px_rgba(255,138,0,0.45)] flex items-center justify-center space-x-2.5 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 disabled:shadow-none"
          >
            <Send className="w-5 h-5 text-white" />
            <span>{mode === 'edit' ? 'Save Anime Changes' : 'Submit Dub Info for Review'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
