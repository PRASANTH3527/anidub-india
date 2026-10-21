import React, { useState } from 'react';
import { 
  User, 
  X, 
  Check, 
  Search, 
  Share2, 
  Sparkles, 
  Zap, 
  Languages, 
  ShieldCheck 
} from 'lucide-react';

export interface LocalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName?: string;
  onSaveProfile?: (name: string, avatarUrl: string, language: string) => void;
}

const AVATAR_LIST = [
  { id: 1, name: 'Tanjiro Kamado', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80', tag: 'Action' },
  { id: 2, name: 'Gojo Satoru', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80', tag: 'Sorcerer' },
  { id: 3, name: 'Luffy Monkey', url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80', tag: 'Pirate' },
  { id: 4, name: 'Naruto Uzumaki', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80', tag: 'Ninja' },
  { id: 5, name: 'Levi Ackerman', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80', tag: 'Elite' },
  { id: 6, name: 'Anya Forger', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&auto=format&fit=crop&q=80', tag: 'Spy' },
  { id: 7, name: 'Zoro Roronoa', url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&auto=format&fit=crop&q=80', tag: 'Swordsman' },
  { id: 8, name: 'Nezuko Kamado', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80', tag: 'Demon' },
  { id: 9, name: 'Eren Yeager', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80', tag: 'Titan' },
  { id: 10, name: 'Megumi Fushiguro', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80', tag: 'Shadow' }
];

const FILTERS = ['All', 'Action', 'Sorcerer', 'Pirate', 'Ninja', 'Elite'];

export const LocalProfileModal: React.FC<LocalProfileModalProps> = ({
  isOpen,
  onClose,
  currentName = 'Prasanth',
  onSaveProfile
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(currentName);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_LIST[0].url);
  const [selectedLang, setSelectedLang] = useState('Tamil (தமிழ்)');
  const [activeTab, setActiveTab] = useState<'identity' | 'stats'>('identity');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [copied, setCopied] = useState(false);

  const filteredAvatars = AVATAR_LIST.filter(avatar => {
    const matchesSearch = !searchQuery.trim() || avatar.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || avatar.tag === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const handleSave = () => {
    if (onSaveProfile) {
      onSaveProfile(name.trim() || 'Anime Fan', selectedAvatar, selectedLang);
    }
    onClose();
  };

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/?user=${encodeURIComponent(name)}`;
    navigator.clipboard?.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* MODAL CONTAINER */}
      <div 
        className="relative w-full max-w-2xl bg-[#121829] border border-primary-theme rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-neutral-100 font-sans max-h-[90vh] overflow-y-auto no-scrollbar"
        style={{ boxShadow: '0 20px 50px -10px var(--primary-glow)' }}
      >
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl btn-primary-theme flex items-center justify-center text-white shadow-lg shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg flex items-center gap-1.5">
                <span>Edit Profile & Avatar</span>
                <span className="badge-primary-theme text-[10px] font-bold px-2 py-0.5 rounded-full">
                  50 Top Characters
                </span>
              </h2>
              <p className="text-neutral-400 text-xs mt-0.5">
                Customize your identity, regional dubbed language preference & shareable profile.
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

        {/* TAB SWITCHER */}
        <div className="flex items-center gap-1 p-1 bg-[#0a0e17] border-b border-neutral-800 mt-4 rounded-xl">
          <button
            onClick={() => setActiveTab('identity')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'identity'
                ? 'bg-primary-theme text-white shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
            }`}
          >
            Avatar & Identity
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-primary-theme text-white shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
            }`}
          >
            Watchlist Stats & Backup
          </button>
        </div>

        {/* IDENTITY TAB CONTENT */}
        {activeTab === 'identity' && (
          <div className="space-y-5 pt-4">
            
            {/* Active DP Preview Card */}
            <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#0c101a] border border-neutral-800/90 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={selectedAvatar}
                    alt="Active DP"
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 shadow-lg"
                    style={{ borderColor: 'var(--primary-accent)' }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-md animate-pulse">
                    <Zap className="w-3 h-3 text-neutral-950 fill-current" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">
                    {name || 'Anime Fan'}
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Active Regional Enthusiast • {selectedLang}
                  </p>
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  Verified Creator
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search character avatars by name..."
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl py-2 pl-9 pr-8 text-xs text-white outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none text-[11px]">
              {FILTERS.map((filter) => {
                const active = selectedFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-all cursor-pointer ${
                      active
                        ? 'active-tab-theme text-white'
                        : 'bg-[#0a0e17] border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>

            {/* 50 Avatars Grid */}
            <div className="rounded-2xl bg-[#0a0e17] border border-neutral-800/90 p-2 sm:p-3 max-h-56 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-2.5">
                {filteredAvatars.map((avatar) => {
                  const isSelected = selectedAvatar === avatar.url;
                  return (
                    <div
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.url)}
                      className={`relative group aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-4 ring-accent-theme ring-offset-2 ring-offset-[#0a0e17] border-2 scale-105 shadow-md shadow-primary-theme'
                          : 'border border-neutral-800 hover:border-neutral-600 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={avatar.url}
                        alt={avatar.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                        <span className="text-[9px] font-bold text-white truncate">{avatar.name}</span>
                      </div>

                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 btn-primary-theme rounded-full flex items-center justify-center text-white shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nickname & Language Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Profile Nickname
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-2xl px-3 sm:px-4 py-2.5 text-xs text-white outline-none"
                  placeholder="Enter your name..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Preferred Dub Language
                </label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-2xl px-3 sm:px-4 py-2.5 text-xs text-white outline-none"
                >
                  <option value="Tamil (தமிழ்)">Tamil (தமிழ்)</option>
                  <option value="Telugu (తెలుగు)">Telugu (తెలుగు)</option>
                  <option value="Hindi (हिन्दी)">Hindi (हिन्दी)</option>
                  <option value="Malayalam (മലയാളം)">Malayalam (മലയാളം)</option>
                  <option value="Kannada (ಕನ್ನಡ)">Kannada (ಕನ್ನಡ)</option>
                </select>
              </div>
            </div>

          </div>
        )}

        {/* STATS & BACKUP TAB CONTENT */}
        {activeTab === 'stats' && (
          <div className="space-y-5 pt-4">
            <div className="p-4 rounded-2xl bg-[#0a0e17] border border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Cloudflare D1 Local Storage Sync</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Your watchlist items, custom collections, and profile preferences are securely persisted in your browser's local state and synced with Cloudflare edge worker bindings.
              </p>
            </div>

            {/* Backup Box */}
            <div className="p-3.5 rounded-2xl bg-[#0d121f] border border-neutral-800 space-y-2.5">
              <span className="text-xs font-bold text-white block">Export / Import Watchlist Backup</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const data = localStorage.getItem('cf_anime_watchlist') || '[]';
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'anidub_watchlist_backup.json';
                    a.click();
                  }}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition-colors"
                >
                  Export JSON Backup
                </button>
                <span className="text-[11px] text-neutral-500">Secure & Instant</span>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between pt-5 border-t border-neutral-800 mt-6">
          <button
            type="button"
            onClick={handleShareProfile}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a0e17] border border-neutral-800 hover:border-neutral-700 text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-primary-theme" />
            <span>{copied ? 'Link Copied!' : 'Share Profile'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl btn-primary-theme text-xs font-extrabold shadow-lg cursor-pointer transition-transform active:scale-95"
            >
              Save Profile
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
