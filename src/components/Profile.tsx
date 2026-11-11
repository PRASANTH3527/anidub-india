import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from '@clerk/nextjs';
import { 
  Trophy, 
  ShieldCheck, 
  Share2, 
  Plus, 
  Edit3, 
  LogOut, 
  LogIn,
  Bookmark, 
  Sparkles, 
  Film, 
  Check, 
  ExternalLink,
  Flame,
  Languages,
  Mail,
  User as UserIcon,
  Image as ImageIcon,
  X,
  Save,
  Search,
  Upload,
  Download,
  Database,
  RefreshCw
} from 'lucide-react';
import { Anime } from './CatalogView';
import { AnimeCard } from './AnimeCard';
import { useToast } from './Toast';

export interface ProfileProps {
  watchlist?: number[];
  catalogList?: any[];
  onSelectAnime?: (anime: any) => void;
  onToggleWatchlist?: (animeId: number) => void;
  onOpenCreateCollection?: () => void;
  onNavigateToCatalog?: () => void;
}

const DEFAULT_AVATAR = 'https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png'; // Roronoa Zoro

const AVATAR_CATEGORIES = [
  'All', 
  'Shonen', 
  'Villains', 
  'Swordsmen', 
  'Hunters', 
  'Ninjas'
];

export interface AnimeAvatarOption {
  name: string;
  category: 'Shonen' | 'Villains' | 'Swordsmen' | 'Hunters' | 'Ninjas';
  url: string;
}

const RICH_ANIME_AVATARS: AnimeAvatarOption[] = [
  // --- HUNTERS (Solo Leveling & Hunter x Hunter) ---
  { name: 'Sung Jin-woo', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129928-BCEjVaP0AQSw.png' },
  { name: 'Cha Hae-in', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b138789-AhE8m0LWjE7E.png' },
  { name: 'Killua Zoldyck', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg' },
  { name: 'Gon Freecss', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b30-lyFExKyDhefc.jpg' },
  { name: 'Kurapika', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b28-ivA7UGnfE40a.png' },
  { name: 'Hisoka Morow', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b31-FZckOuu7L1un.png' },

  // --- SWORDSMEN (Blades, Hashira & Reapers) ---
  { name: 'Roronoa Zoro', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png' },
  { name: 'Levi Ackerman', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png' },
  { name: 'Mikasa Ackerman', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1PkreDvj.png' },
  { name: 'Tanjiro Kamado', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b126071-BTNEc1nRIv68.png' },
  { name: 'Zenitsu Agatsuma', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129131-FZrQ7lSlxmEr.png' },
  { name: 'Inosuke Hashibira', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/n129130-SJC0Kn1DU39E.jpg' },
  { name: 'Kyojuro Rengoku', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129133-VlTPowwt68rJ.png' },
  { name: 'Tengen Uzui', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b136071-99Kexnnn2PiV.png' },
  { name: 'Giyu Tomioka', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b130050-qsLThJs5VIbz.png' },
  { name: 'Shinobu Kocho', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b136070-MC9LLxJsHyHE.png' },
  { name: 'Ichigo Kurosaki', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b5-a7bkJgjhhigE.png' },
  { name: 'Byakuya Kuchiki', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b907-kgnDKeMtEN5y.png' },
  { name: 'Kenpachi Zaraki', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b909-slhoFBon7oiH.jpg' },
  { name: 'Guts', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b422-XTaiTuvRohsV.png' },

  // --- NINJAS (Shinobi Legends) ---
  { name: 'Itachi Uchiha', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png' },
  { name: 'Kakashi Hatake', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjxjmx.png' },
  { name: 'Naruto Uzumaki', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png' },
  { name: 'Sasuke Uchiha', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b13-SISLEw1oAD7a.png' },
  { name: 'Minato Namikaze', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b2535-Xq9WKNPJQEt3.png' },
  { name: 'Jiraiya', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b2434-Xz1F9bC9y80A.png' },
  { name: 'Gaara', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b1662-8Xl6x1pL2wT0.png' },

  // --- VILLAINS (Antagonists & Masterminds) ---
  { name: 'Madara Uchiha', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b53901-HnRKSoHMG5Vg.png' },
  { name: 'Sukuna', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b133701-rCQuDpHr3UZL.png' },
  { name: 'Toji Fushiguro', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b162722-btzdghBizxKS.jpg' },
  { name: 'Garou', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b89277-xBGb4B5YISXg.png' },
  { name: 'Sosuke Aizen', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b1086-qR9218BjZTC0.png' },
  { name: 'Light Yagami', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b80-26EhwSsSqQ50.png' },
  { name: 'Muzan Kibutsuji', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129132-4nIZakUZ1o8W.jpg' },
  { name: 'Akaza', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b141694-0COi0GVXPuEn.png' },
  { name: 'Pain', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b3180-ITMGBLWNBOgV.png' },
  { name: 'Obito Uchiha', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b1660-8fS1kU9rL23T.png' },
  { name: 'Griffith', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b424-Jfrsf8I7zBps.png' },
  { name: 'Chrollo Lucilfer', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b58-USOmsz3nursi.jpg' },
  { name: 'Tomura Shigaraki', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b89226-qGXqFthO4SM3.jpg' },
  { name: 'Dabi', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b126378-RFSljq5koy5U.png' },
  { name: 'Askeladd', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b13020-ZdiYlNmpRUNS.png' },

  // --- SHONEN (Protagonists & Heroes) ---
  { name: 'Monkey D. Luffy', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png' },
  { name: 'Sanji', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b305-6lisPmHtCnLT.png' },
  { name: 'Yuji Itadori', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127212-FVm2tD0erQ5B.png' },
  { name: 'Satoru Gojo', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png' },
  { name: 'Megumi Fushiguro', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b126635-L0y3I92JSUkN.png' },
  { name: 'Eren Yeager', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg' },
  { name: 'Nezuko Kamado', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127518-NRlq1CQ1v1ro.png' },
  { name: 'Saitama', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b73935-ON5d0mAcrItd.jpg' },
  { name: 'Goku', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/246-wsRRr6z1kii8.png' },
  { name: 'Vegeta', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b913-NIFkKazWM8VO.png' },
  { name: 'L Lawliet', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b71-1W4panC53vfs.png' },
  { name: 'Edward Elric', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b11-TA5Nuk7EDUZG.jpg' },
  { name: 'Roy Mustang', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b68-moBLY2WO2am3.png' },
  { name: 'Katsuki Bakugo', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b88892-bdOha3lNcaN6.png' },
  { name: 'Shoto Todoroki', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b89220-KNBwaVFAR8FD.png' },
  { name: 'All Might', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b89224-K6KEuQAuYKzq.jpg' },
  { name: 'Ken Kaneki', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b87275-mb13EWZBdbh3.png' },
  { name: 'Lelouch Lamperouge', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b417-gVLmIJu9phcK.png' },
];

export default function Profile({
  watchlist = [],
  catalogList = [],
  onSelectAnime,
  onToggleWatchlist,
  onOpenCreateCollection,
  onNavigateToCatalog
}: ProfileProps) {
  const { user, isSignedIn } = useUser();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // LocalStorage state for custom name & custom avatar
  const [customName, setCustomName] = useState<string>(() => {
    try {
      return localStorage.getItem('anidub_custom_name') || '';
    } catch {
      return '';
    }
  });

  const [customAvatar, setCustomAvatar] = useState<string>(() => {
    try {
      return localStorage.getItem('anidub_anime_avatar') || DEFAULT_AVATAR;
    } catch {
      return DEFAULT_AVATAR;
    }
  });

  // Modal temporary edit form states
  const [modalInputName, setModalInputName] = useState('');
  const [modalSelectedAvatar, setModalSelectedAvatar] = useState('');
  const [modalTab, setModalTab] = useState<'identity' | 'backup'>('identity');
  const [avatarSearch, setAvatarSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Sync modal states whenever modal opens
  useEffect(() => {
    if (isEditModalOpen) {
      setModalInputName(customName || (isSignedIn ? (user?.fullName || '') : ''));
      setModalSelectedAvatar(customAvatar || DEFAULT_AVATAR);
      setModalTab('identity');
      setAvatarSearch('');
      setSelectedCategory('All');
    }
  }, [isEditModalOpen, customName, customAvatar, isSignedIn, user?.fullName]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = modalInputName.trim();
    const finalAvatar = modalSelectedAvatar || DEFAULT_AVATAR;

    setCustomName(cleanName);
    setCustomAvatar(finalAvatar);

    try {
      if (cleanName) {
        localStorage.setItem('anidub_custom_name', cleanName);
      } else {
        localStorage.removeItem('anidub_custom_name');
      }
      localStorage.setItem('anidub_anime_avatar', finalAvatar);
      window.dispatchEvent(new Event('storage'));
    } catch {}

    showToast('Profile Updated', 'Your display name and anime avatar have been saved!', 'success');
    setIsEditModalOpen(false);
  };

  const handleCustomUpload = () => {
    const url = prompt('Enter direct image URL for your custom avatar:');
    if (url && url.trim()) {
      setModalSelectedAvatar(url.trim());
      showToast('Custom Avatar', 'Custom image URL applied!', 'success');
    }
  };

  const savedAnimeList: Anime[] = catalogList.filter((anime) => watchlist.includes(anime.id));

  // Dynamically compute preferred regional audio from real watchlist entries
  const preferredAudio = React.useMemo(() => {
    if (savedAnimeList.length === 0) return 'None saved yet';
    const langTally: Record<string, number> = {};
    savedAnimeList.forEach(anime => {
      const langs = (anime.languages || '').split(/[,/|•+]+/).map((s: string) => s.trim()).filter(Boolean);
      langs.forEach((l: string) => {
        const clean = l.replace(/Dub/i, '').trim();
        if (clean && !['Japanese', 'English', 'Romaji', 'Korean', 'Chinese'].includes(clean)) {
          langTally[clean] = (langTally[clean] || 0) + 1;
        }
      });
    });
    const sorted = Object.entries(langTally).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return 'Regional Dubs';
    return sorted.slice(0, 2).map(([lang]) => lang).join(' / ');
  }, [savedAnimeList]);

  // Dynamically compute Anime DNA from real genres in saved anime
  const animeDna = React.useMemo(() => {
    if (savedAnimeList.length === 0) return 'New Explorer';
    const genreTally: Record<string, number> = {};
    savedAnimeList.forEach(anime => {
      const genres = (anime.genres || '').split(/[,/|]+/).map((s: string) => s.trim()).filter(Boolean);
      genres.forEach((g: string) => {
        if (g) genreTally[g] = (genreTally[g] || 0) + 1;
      });
    });
    const sorted = Object.entries(genreTally).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return 'Anime Enthusiast';
    return `${sorted[0][0]} Specialist`;
  }, [savedAnimeList]);

  // Dynamic dub tier based on real saves/contributions
  const dubTier = React.useMemo(() => {
    const count = savedAnimeList.length;
    if (count >= 10) return 'Master Curator';
    if (count >= 5) return 'Senior Enthusiast';
    if (count >= 1) return 'Active Voyager';
    return 'Community Member';
  }, [savedAnimeList.length]);

  const handleShareProfile = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      showToast('Profile Shared', 'Profile link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast('Share Profile', 'Profile link ready to share!', 'info');
    }
  };

  const activeAvatar = customAvatar || DEFAULT_AVATAR;
  const displayName = customName || (isSignedIn ? (user?.fullName || 'Anime Fan') : 'Guest');
  const displaySubtitle = isSignedIn 
    ? (user?.primaryEmailAddress?.emailAddress || 'authenticated@anidub.india')
    : 'Sign in to sync data';

  const filteredAvatars = RICH_ANIME_AVATARS.filter((av) => {
    const matchesSearch = av.name.toLowerCase().includes(avatarSearch.toLowerCase());
    const matchesCat = selectedCategory === 'All' || av.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="relative w-full min-h-screen text-neutral-100 font-sans pb-24 overflow-hidden selection:bg-purple-500/30">
      
      {/* Ambient background atmosphere */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-gradient-to-br from-purple-700/20 via-indigo-600/15 to-transparent blur-[140px] rounded-full transform -rotate-12" />
        <div className="absolute top-10 -right-28 w-[550px] h-[550px] bg-gradient-to-bl from-pink-600/15 via-purple-900/20 to-transparent blur-[150px] rounded-full" />
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[160px] rounded-full pointer-events-none" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 space-y-8 relative z-10">

        {/* =========================================================================
            MAIN RICH PROFILE CARD
           ========================================================================= */}
        <div className="relative w-full bg-gradient-to-b from-[#14192b]/95 via-[#0e1220]/95 to-[#090b14]/98 rounded-3xl p-6 sm:p-10 border border-purple-500/20 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden animate-in fade-in duration-300">
          
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-pink-500 opacity-80" />
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* AUTHENTICATION BUTTON IN TOP-RIGHT CORNER */}
          <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20">
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95"
                >
                  <LogIn className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sign In</span>
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <SignOutButton>
                <button
                  type="button"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 hover:text-red-200 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span>Log Out</span>
                </button>
              </SignOutButton>
            </SignedIn>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
            
            {/* Avatar container with circular edit icon at the bottom-right corner */}
            <div className="relative shrink-0">
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-500 opacity-70 blur-md animate-pulse" />
              
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden p-1 bg-gradient-to-br from-white/20 via-purple-500/30 to-black/80 shadow-2xl backdrop-blur-md">
                <img 
                  src={activeAvatar} 
                  alt={displayName} 
                  className="w-full h-full object-cover rounded-[20px]"
                />
              </div>

              {/* Circular edit icon at bottom-right corner of avatar */}
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                title="Change Avatar"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-500 border-2 border-[#090b14] flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer z-30"
                aria-label="Change Avatar"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              {/* Active Profile Status Dot */}
              <span 
                className={`absolute top-1 left-1 w-4 h-4 rounded-full border-2 border-[#090b14] shadow-[0_0_12px_rgba(52,211,153,0.9)] z-20 ${
                  isSignedIn ? 'bg-emerald-500' : 'bg-neutral-500'
                }`} 
                title={isSignedIn ? 'Active Clerk Session' : 'Guest Profile'} 
              />
            </div>

            {/* Profile Details */}
            <div className="flex-1 text-center md:text-left space-y-3 pt-2 sm:pt-0">
              
              {/* Badges Row */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold shadow-sm ${
                  isSignedIn 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isSignedIn ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-400'}`} />
                  <span>Active Local Profile</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-sm">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>{dubTier}</span>
                </span>

                {isSignedIn && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Clerk Verified</span>
                  </span>
                )}
              </div>

              {/* Display Name with subtle edit icon right next to it */}
              <div className="flex items-center justify-center md:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-black text-white tracking-tight drop-shadow-md">
                  {displayName}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  title="Edit Display Name"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-purple-300 hover:bg-white/5 transition-colors cursor-pointer active:scale-95"
                  aria-label="Edit Display Name"
                >
                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Dynamic Email / Subtitle */}
              <p className="text-neutral-400 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span>{displaySubtitle}</span>
              </p>

              {/* ACTION BUTTONS */}
              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Link' : 'Share Profile'}</span>
                </button>

                {onOpenCreateCollection && (
                  <button
                    type="button"
                    onClick={onOpenCreateCollection}
                    className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Collection</span>
                  </button>
                )}
              </div>

            </div>

          </div>

          {/* QUICK STATS STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Watchlist</p>
              <p className="text-lg sm:text-xl font-heading font-black text-purple-400 mt-0.5">{savedAnimeList.length}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Dub Ranking</p>
              <p className="text-sm sm:text-base font-heading font-black text-amber-400 mt-1 truncate">{dubTier}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Preferred Audio</p>
              <p className="text-xs sm:text-sm font-heading font-bold text-emerald-400 mt-1 truncate">{preferredAudio}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Anime DNA</p>
              <p className="text-xs sm:text-sm font-heading font-bold text-pink-400 mt-1 truncate">{animeDna}</p>
            </div>
          </div>

        </div>

        {/* =====================================================================
            ACTIVE WATCHLIST SECTION
           ===================================================================== */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <Bookmark className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl sm:text-2xl font-heading font-black text-white tracking-tight uppercase">
                Active Watchlist
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
                {savedAnimeList.length}
              </span>
            </div>

            {onNavigateToCatalog && (
              <button
                type="button"
                onClick={onNavigateToCatalog}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Explore Catalog</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {savedAnimeList.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {savedAnimeList.map((anime, index) => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  index={index}
                  isBookmarked={true}
                  onSelect={(selected) => onSelectAnime && onSelectAnime(selected)}
                  onToggleBookmark={(id) => onToggleWatchlist && onToggleWatchlist(id)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#121829]/70 border border-white/10 rounded-3xl p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <Bookmark className="w-8 h-8 opacity-70" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white">Your Watchlist is Empty</h3>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto">
                  Explore our regional Indian dub directory and click the bookmark button on any anime to save it here.
                </p>
              </div>
              {onNavigateToCatalog && (
                <button
                  type="button"
                  onClick={onNavigateToCatalog}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  Browse Dub Catalog
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* =========================================================================
          RESTORED OLD RICHER EDIT PROFILE MODAL
         ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl bg-gradient-to-b from-[#14192b] to-[#0c0e18] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-heading font-black text-white">Edit Profile & Avatar</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold tracking-wider uppercase">
                    {RICH_ANIME_AVATARS.length} Anime Characters
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Customize your identity and choose your favorite character avatar
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/[0.03] border border-white/10">
              <button
                type="button"
                onClick={() => setModalTab('identity')}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === 'identity'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Avatar & Identity</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('backup')}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === 'backup'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Watchlist Stats & Backup</span>
              </button>
            </div>

            {modalTab === 'identity' ? (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                
                {/* Profile Preview Card inside modal */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-transparent border border-purple-500/30 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 border-purple-400 shadow-md">
                    <img src={modalSelectedAvatar || DEFAULT_AVATAR} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate">
                      {modalInputName.trim() || displayName}
                    </h4>
                    <p className="text-[11px] text-purple-300 font-medium">
                      Active Regional Enthusiast • {preferredAudio}
                    </p>
                  </div>
                </div>

                {/* Display Name Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span>Display Name</span>
                  </label>
                  <input
                    type="text"
                    value={modalInputName}
                    onChange={(e) => setModalInputName(e.target.value)}
                    placeholder="e.g. ZoroFan99, Prasanth..."
                    maxLength={30}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-purple-500 text-sm text-white placeholder-neutral-500 outline-none transition-colors"
                  />
                </div>

                {/* Search & Filters */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={avatarSearch}
                        onChange={(e) => setAvatarSearch(e.target.value)}
                        placeholder="Search character avatars by name..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 focus:border-purple-500 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {AVATAR_CATEGORIES.map((cat) => {
                      const count = cat === 'All'
                        ? RICH_ANIME_AVATARS.length
                        : RICH_ANIME_AVATARS.filter((a) => a.category === cat).length;
                      const isActive = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                              : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span>{cat}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                              isActive
                                ? 'bg-purple-900/70 text-purple-200'
                                : 'bg-white/10 text-neutral-400'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Avatar Grid (CUSTOM upload placeholder first, followed by anime avatars) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-200">
                      Character Library ({filteredAvatars.length} characters)
                    </label>
                    {selectedCategory !== 'All' && (
                      <span className="text-[11px] text-purple-400 font-medium">
                        Showing {selectedCategory}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-72 sm:max-h-84 overflow-y-auto pr-1">
                    
                    {/* CUSTOM UPLOAD PLACEHOLDER */}
                    <button
                      type="button"
                      onClick={handleCustomUpload}
                      className="group relative rounded-2xl overflow-hidden aspect-square border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-500/5 hover:bg-purple-500/10 transition-all p-2 flex flex-col items-center justify-center text-center cursor-pointer hover:scale-102"
                      title="Upload or paste custom image URL"
                    >
                      <Upload className="w-5 h-5 text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold text-purple-300">CUSTOM</span>
                      <span className="text-[9px] text-neutral-400">Direct URL</span>
                    </button>

                    {/* Anime Avatars */}
                    {filteredAvatars.map((av) => {
                      const isSelected = modalSelectedAvatar === av.url;
                      return (
                        <button
                          key={av.name}
                          type="button"
                          onClick={() => setModalSelectedAvatar(av.url)}
                          className={`group relative rounded-2xl overflow-hidden aspect-square border-2 transition-all p-0.5 cursor-pointer flex flex-col items-center justify-center ${
                            isSelected 
                              ? 'border-purple-500 scale-105 shadow-[0_0_14px_rgba(168,85,247,0.7)] bg-purple-500/10 ring-2 ring-purple-400/50' 
                              : 'border-white/10 hover:border-white/30 bg-white/[0.02] opacity-85 hover:opacity-100 hover:scale-102'
                          }`}
                          title={`${av.name} • ${av.category}`}
                        >
                          <img 
                            src={av.url} 
                            alt={av.name} 
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                            }}
                            className="w-full h-full object-cover rounded-[14px]"
                          />
                          {/* Name ribbon overlay */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-3 pb-1 px-1 rounded-b-[14px] pointer-events-none">
                            <p className="text-[10px] font-bold text-white text-center truncate leading-tight drop-shadow-sm">
                              {av.name}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-[10px] text-white font-black shadow-md border border-white/20">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: WATCHLIST STATS & BACKUP */
              <div className="space-y-6 py-2">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Watchlist Data Summary</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                      <p className="text-[10px] text-neutral-400 uppercase font-bold">Saved Items</p>
                      <p className="text-base font-bold text-purple-400 mt-0.5">{watchlist.length} Anime</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                      <p className="text-[10px] text-neutral-400 uppercase font-bold">Cloud Sync Status</p>
                      <p className="text-base font-bold text-emerald-400 mt-0.5">{isSignedIn ? 'Synced to Clerk' : 'Local Storage'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Export / Import Watchlist Backup</h4>
                  <p className="text-xs text-neutral-400">
                    Download your current watchlist as a JSON backup file or restore from a previous backup.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(watchlist));
                        const downloadAnchor = document.createElement('a');
                        downloadAnchor.setAttribute("href", dataStr);
                        downloadAnchor.setAttribute("download", `anidub_watchlist_backup_${Date.now()}.json`);
                        document.body.appendChild(downloadAnchor);
                        downloadAnchor.click();
                        downloadAnchor.remove();
                        showToast('Export Success', 'Watchlist backup downloaded!', 'success');
                      }}
                      className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

export { Profile as ProfileView };
