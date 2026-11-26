import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from '../lib/clerk';
import {
  Trophy,
  ShieldCheck,
  Plus,
  Edit3,
  LogOut,
  LogIn,
  Bookmark,
  ExternalLink,
  Mail,
  User as UserIcon,
  Image as ImageIcon,
  X,
  Save,
  Search,
  Upload,
  Download,
  Database,
  Bell,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Anime } from './CatalogView';
import { AnimeCard } from './AnimeCard';
import { useToast } from './Toast';
import { useNotifications } from '../context/NotificationContext';
import { PersonalAnimeStats } from './PersonalAnimeStats';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EclipseState';
import {
  ACCOUNT_CHANGED_EVENT,
  readScopedString,
  removeScopedKey,
  writeScopedString,
} from '../utils/accountIsolation';
import {
  buildWatchlistCsv,
  downloadCsvFile,
  readLibraryStatusMap,
} from '../utils/libraryStatus';
import { getAllWatchProgress } from '../utils/watchProgress';

export interface ProfileProps {
  watchlist?: number[];
  catalogList?: Anime[];
  savedAnimeItems?: Anime[];
  onSelectAnime?: (anime: Anime) => void;
  onToggleWatchlist?: (animeId: number) => void;
  onOpenCreateCollection?: () => void;
  onNavigateToCatalog?: () => void;
}

const DEFAULT_AVATAR = 'https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png';

const AVATAR_CATEGORIES = [
  'All',
  'Shonen',
  'Villains',
  'Swordsmen',
  'Hunters',
  'Ninjas',
] as const;

export interface AnimeAvatarOption {
  name: string;
  category: 'Shonen' | 'Villains' | 'Swordsmen' | 'Hunters' | 'Ninjas';
  url: string;
}

const RICH_ANIME_AVATARS: AnimeAvatarOption[] = [
  { name: 'Sung Jin-woo', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129928-BCEjVaP0AQSw.png' },
  { name: 'Cha Hae-in', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b138789-AhE8m0LWjE7E.png' },
  { name: 'Killua Zoldyck', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg' },
  { name: 'Gon Freecss', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b30-lyFExKyDhefc.jpg' },
  { name: 'Kurapika', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b28-ivA7UGnfE40a.png' },
  { name: 'Hisoka Morow', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b31-FZckOuu7L1un.png' },
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
  { name: 'Itachi Uchiha', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png' },
  { name: 'Kakashi Hatake', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjxjmx.png' },
  { name: 'Naruto Uzumaki', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png' },
  { name: 'Sasuke Uchiha', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b13-SISLEw1oAD7a.png' },
  { name: 'Minato Namikaze', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b2535-Xq9WKNPJQEt3.png' },
  { name: 'Jiraiya', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b2434-Xz1F9bC9y80A.png' },
  { name: 'Gaara', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b1662-8Xl6x1pL2wT0.png' },
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

export function ProfileView({
  watchlist = [],
  catalogList = [],
  savedAnimeItems = [],
  onSelectAnime,
  onToggleWatchlist,
  onOpenCreateCollection,
  onNavigateToCatalog,
}: ProfileProps) {
  const { user, isSignedIn } = useUser();
  const { showToast } = useToast();
  const {
    isSoundEnabled,
    toggleSound,
    browserPermission,
    requestBrowserPermission,
    preferences,
    updatePreference,
    triggerTestNotification,
  } = useNotifications();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const activeUserId = isSignedIn ? (user?.id ?? null) : null;

  const [customName, setCustomName] = useState<string>(() =>
    readScopedString('anidub_custom_name', activeUserId, '')
  );

  const [customAvatar, setCustomAvatar] = useState<string>(() =>
    readScopedString('anidub_anime_avatar', activeUserId, DEFAULT_AVATAR) || DEFAULT_AVATAR
  );

  // Strict Account Data Isolation: re-hydrate scoped profile identity when user signs in, switches, or logs out
  useEffect(() => {
    const syncProfileScope = () => {
      setCustomName(readScopedString('anidub_custom_name', activeUserId, ''));
      setCustomAvatar(
        readScopedString('anidub_anime_avatar', activeUserId, DEFAULT_AVATAR) || DEFAULT_AVATAR
      );
    };
    syncProfileScope();
    window.addEventListener(ACCOUNT_CHANGED_EVENT, syncProfileScope);
    return () => window.removeEventListener(ACCOUNT_CHANGED_EVENT, syncProfileScope);
  }, [activeUserId]);

  const [modalInputName, setModalInputName] = useState('');
  const [modalSelectedAvatar, setModalSelectedAvatar] = useState('');
  const [modalTab, setModalTab] = useState<'identity' | 'backup'>('identity');
  const [avatarSearch, setAvatarSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

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
        writeScopedString('anidub_custom_name', cleanName, activeUserId);
      } else {
        removeScopedKey('anidub_custom_name', activeUserId);
      }
      writeScopedString('anidub_anime_avatar', finalAvatar, activeUserId);
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

  const savedAnimeList: Anime[] = React.useMemo(() => {
    const source = [...(savedAnimeItems || []), ...catalogList];
    const byId = new Map<number, Anime>();
    for (const item of source) {
      const id = Number(item?.id);
      if (Number.isInteger(id) && id > 0 && !byId.has(id)) {
        byId.set(id, item);
      }
    }
    return watchlist
      .map((id) => byId.get(Number(id)))
      .filter((item): item is Anime => Boolean(item));
  }, [savedAnimeItems, catalogList, watchlist]);

  const preferredAudio = React.useMemo(() => {
    if (savedAnimeList.length === 0) return 'None saved yet';
    const langTally: Record<string, number> = {};
    savedAnimeList.forEach(anime => {
      const rawLangs: unknown = (anime as any).languages ?? (anime as any).language;
      const langs = Array.isArray(rawLangs)
        ? rawLangs.map((s) => String(s || '').trim()).filter(Boolean)
        : String(rawLangs || '').split(/[,/|•+]+/).map((s: string) => s.trim()).filter(Boolean);
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

  const animeDna = React.useMemo(() => {
    if (savedAnimeList.length === 0) return 'New Explorer';
    const genreTally: Record<string, number> = {};
    savedAnimeList.forEach(anime => {
      const rawGenres: unknown = (anime as any).genres ?? (anime as any).genre;
      const genres = Array.isArray(rawGenres)
        ? rawGenres.map((s) => String(s || '').trim()).filter(Boolean)
        : String(rawGenres || '').split(/[,/|]+/).map((s: string) => s.trim()).filter(Boolean);
      genres.forEach((g: string) => {
        if (g) genreTally[g] = (genreTally[g] || 0) + 1;
      });
    });
    const sorted = Object.entries(genreTally).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return 'Anime Enthusiast';
    return `${sorted[0][0]} Specialist`;
  }, [savedAnimeList]);

  const dubTier = React.useMemo(() => {
    const count = savedAnimeList.length;
    if (count >= 10) return 'Master Curator';
    if (count >= 5) return 'Senior Enthusiast';
    if (count >= 1) return 'Active Voyager';
    return 'Community Member';
  }, [savedAnimeList.length]);

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
    <div className="relative w-full max-w-full min-h-screen text-[#F4F3FA] font-sans pb-24 overflow-x-clip">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-6 sm:pt-10 space-y-8 relative z-10">
        {/* PROFILE IDENTITY CARD */}
        <div className="relative w-full bg-[#12141E] rounded-2xl p-5 sm:p-8 border border-[#292B39] shadow-xl overflow-hidden animate-in fade-in duration-200">
          <div className="absolute top-3 sm:top-6 right-3 sm:right-6 z-20">
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-xs font-bold transition-colors duration-150 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <SignOutButton>
                <button
                  type="button"
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#191C29] hover:bg-[#F87171]/15 border border-[#292B39] hover:border-[#F87171]/40 text-[#F87171] text-xs font-bold transition-colors duration-150 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </SignOutButton>
            </SignedIn>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8 min-w-0">
            <div className="relative shrink-0">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden p-1 bg-[#191C29] border border-[#292B39]">
                <img
                  src={activeAvatar}
                  alt={displayName}
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                title="Change Avatar"
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#B49AF8] hover:bg-[#CBB6FF] border-2 border-[#0B0A10] flex items-center justify-center text-[#0B0A10] shadow-lg transition-colors duration-150 cursor-pointer z-30"
                aria-label="Change Avatar"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full border-2 border-[#0B0A10] z-20 ${
                  isSignedIn ? 'bg-[#34D399]' : 'bg-[#A1A5B5]'
                }`}
                title={isSignedIn ? 'Active Clerk Session' : 'Guest Profile'}
              />
            </div>

            <div className="flex-1 min-w-0 w-full text-center md:text-left space-y-3 pt-2 sm:pt-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
                  isSignedIn
                    ? 'bg-[#34D399]/10 border-[#34D399]/30 text-[#34D399]'
                    : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5]'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isSignedIn ? 'bg-[#34D399]' : 'bg-[#A1A5B5]'}`} />
                  <span>Active Local Profile</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191C29] border border-[#292B39] text-[#F9C876] text-xs font-bold">
                  <Trophy className="w-3.5 h-3.5 text-[#F9C876]" />
                  <span>{dubTier}</span>
                </span>

                {isSignedIn && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191C29] border border-[#292B39] text-[#B49AF8] text-xs font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#B49AF8]" />
                    <span>Clerk Verified</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center md:justify-start gap-2.5 min-w-0 max-w-full">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-black text-[#F4F3FA] tracking-tight break-words max-w-full">
                  {displayName}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  title="Edit Display Name"
                  className="p-2 rounded-lg text-[#A1A5B5] hover:text-[#B49AF8] hover:bg-[#191C29] transition-colors duration-150 cursor-pointer shrink-0"
                  aria-label="Edit Display Name"
                >
                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <p className="text-[#A1A5B5] text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1.5 min-w-0 max-w-full">
                <Mail className="w-3.5 h-3.5 text-[#A1A5B5] shrink-0" />
                <span className="truncate">{displaySubtitle}</span>
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3">
                {onOpenCreateCollection && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={onOpenCreateCollection}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    className="text-xs"
                  >
                    New Collection
                  </Button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (savedAnimeList.length === 0) {
                      showToast('Watchlist Empty', 'Save at least one anime before exporting to CSV.', 'info');
                      return;
                    }
                    const csv = buildWatchlistCsv(
                      savedAnimeList as any,
                      readLibraryStatusMap(activeUserId),
                      getAllWatchProgress(undefined, activeUserId)
                    );
                    const dateTag = new Date().toISOString().slice(0, 10);
                    downloadCsvFile(csv, `anidub-india-watchlist-${dateTag}.csv`);
                    showToast('Watchlist Exported', `Downloaded ${savedAnimeList.length} saved titles as CSV.`, 'success');
                  }}
                  leftIcon={<Download className="w-3.5 h-3.5 text-[#34D399]" />}
                  className="text-xs"
                >
                  Export Watchlist (CSV)
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-[#292B39]">
            <div className="bg-[#191C29] border border-[#292B39] rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-[#A1A5B5] tracking-wider">Watchlist</p>
              <p className="text-lg sm:text-xl font-heading font-black text-[#B49AF8] mt-0.5">{savedAnimeList.length}</p>
            </div>
            <div className="bg-[#191C29] border border-[#292B39] rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-[#A1A5B5] tracking-wider">Dub Ranking</p>
              <p className="text-sm sm:text-base font-heading font-black text-[#F9C876] mt-1 truncate">{dubTier}</p>
            </div>
            <div className="bg-[#191C29] border border-[#292B39] rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-[#A1A5B5] tracking-wider">Preferred Audio</p>
              <p className="text-xs sm:text-sm font-heading font-bold text-[#34D399] mt-1 truncate">{preferredAudio}</p>
            </div>
            <div className="bg-[#191C29] border border-[#292B39] rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-[#A1A5B5] tracking-wider">Anime DNA</p>
              <p className="text-xs sm:text-sm font-heading font-bold text-[#CBB6FF] mt-1 truncate">{animeDna}</p>
            </div>
          </div>
        </div>

        {/* PERSONAL ANIME STATS ("MY ANIME JOURNEY" DASHBOARD) */}
        <PersonalAnimeStats
          watchlist={watchlist}
          catalogList={catalogList}
          savedAnimeItems={savedAnimeList}
          isSignedIn={Boolean(isSignedIn)}
          onNavigateToCatalog={onNavigateToCatalog}
        />

        {/* NOTIFICATION PREFERENCES SECTION */}
        <section
          aria-label="Notification Preferences"
          className="rounded-2xl bg-[#12141E] border border-[#292B39] p-6 sm:p-7 space-y-5 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292B39] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#B49AF8]">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-heading font-black text-[#F4F3FA] uppercase tracking-tight">
                  Notification Preferences
                </h2>
                <p className="text-xs text-[#A1A5B5]">
                  Manage sound chimes, browser push alerts, and dub release notifications
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => triggerTestNotification()}
              aria-label="Send test notification"
              className="text-xs"
            >
              Send Test Alert
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Sound Chime Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#191C29] border border-[#292B39] p-4">
              <div className="flex items-center gap-3 min-w-0">
                {isSoundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#34D399] shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#F4F3FA]">Notification Sound Chime</p>
                  <p className="text-[11px] text-[#A1A5B5]">Play a gentle chime on live updates</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isSoundEnabled}
                aria-label="Toggle notification sound chime"
                onClick={toggleSound}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-150 cursor-pointer shrink-0 ${
                  isSoundEnabled ? 'bg-[#B49AF8]' : 'bg-[#292B39]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-[#0B0A10] transition-transform duration-150 ${
                    isSoundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Browser Desktop Notifications */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#191C29] border border-[#292B39] p-4">
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="w-4 h-4 text-[#B49AF8] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#F4F3FA]">Desktop Push Alerts</p>
                  <p className="text-[11px] text-[#A1A5B5]">
                    Status:{' '}
                    <span className="font-semibold text-[#F4F3FA] capitalize">
                      {browserPermission}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestBrowserPermission}
                disabled={browserPermission === 'unsupported' || browserPermission === 'granted'}
                aria-label="Enable browser push notifications"
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 disabled:opacity-50 text-xs font-bold text-[#F4F3FA] cursor-pointer shrink-0 transition-colors duration-150"
              >
                {browserPermission === 'granted'
                  ? 'Enabled'
                  : browserPermission === 'unsupported'
                  ? 'Unsupported'
                  : 'Enable'}
              </button>
            </div>

            {/* New Dub Releases Category */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#191C29] border border-[#292B39] p-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#F4F3FA]">New Dub Releases</p>
                <p className="text-[11px] text-[#A1A5B5]">
                  Notify when new Hindi, Tamil &amp; Telugu dubs are added
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.newDubs}
                aria-label="Toggle new dub releases notifications"
                onClick={() => updatePreference('newDubs', !preferences.newDubs)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-150 cursor-pointer shrink-0 ${
                  preferences.newDubs ? 'bg-[#B49AF8]' : 'bg-[#292B39]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-[#0B0A10] transition-transform duration-150 ${
                    preferences.newDubs ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Weekly Simulcast Alerts */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#191C29] border border-[#292B39] p-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#F4F3FA]">Weekly Simulcast Drops</p>
                <p className="text-[11px] text-[#A1A5B5]">
                  Alerts for scheduled weekly dub episode drops
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.simulcasts}
                aria-label="Toggle weekly simulcast notifications"
                onClick={() => updatePreference('simulcasts', !preferences.simulcasts)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-150 cursor-pointer shrink-0 ${
                  preferences.simulcasts ? 'bg-[#B49AF8]' : 'bg-[#292B39]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-[#0B0A10] transition-transform duration-150 ${
                    preferences.simulcasts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Community Chat & Reviews */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#191C29] border border-[#292B39] p-4 sm:col-span-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#F4F3FA]">Community Chat &amp; Reviews</p>
                <p className="text-[11px] text-[#A1A5B5]">
                  Receive real-time alerts for new community reviews and chat highlights
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.communityChat}
                aria-label="Toggle community chat and review notifications"
                onClick={() => updatePreference('communityChat', !preferences.communityChat)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-150 cursor-pointer shrink-0 ${
                  preferences.communityChat ? 'bg-[#B49AF8]' : 'bg-[#292B39]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-[#0B0A10] transition-transform duration-150 ${
                    preferences.communityChat ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <Bookmark className="w-5 h-5 text-[#B49AF8]" />
              <h2 className="text-xl sm:text-2xl font-heading font-black text-[#F4F3FA] tracking-tight uppercase">
                Active Watchlist
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#191C29] border border-[#292B39] text-[#B49AF8] text-xs font-bold">
                {savedAnimeList.length}
              </span>
            </div>

            {onNavigateToCatalog && (
              <button
                type="button"
                onClick={onNavigateToCatalog}
                className="min-h-[40px] px-3 text-xs font-bold text-[#B49AF8] hover:text-[#CBB6FF] flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
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
                  onSelect={(selected) =>
                    onSelectAnime &&
                    onSelectAnime({
                      ...selected,
                      slug: selected.slug || String(selected.id),
                    } as Anime)
                  }
                  onToggleBookmark={(id) => onToggleWatchlist && onToggleWatchlist(id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Bookmark className="w-6 h-6" />}
              title="Your Watchlist is Empty"
              description="Explore our regional Indian dub directory and click the bookmark button on any anime to save it here."
              actionLabel={onNavigateToCatalog ? 'Browse Dub Catalog' : undefined}
              onAction={onNavigateToCatalog}
            />
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0A10]/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl bg-[#12141E] border border-[#292B39] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#292B39] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-heading font-black text-[#F4F3FA]">Edit Profile &amp; Avatar</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#191C29] border border-[#292B39] text-[#B49AF8] text-[10px] font-bold tracking-wider uppercase">
                    {RICH_ANIME_AVATARS.length} Anime Characters
                  </span>
                </div>
                <p className="text-xs text-[#A1A5B5]">
                  Customize your identity and choose your favorite character avatar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-[#191C29] hover:bg-[#292B39] border border-[#292B39] flex items-center justify-center text-[#A1A5B5] hover:text-[#F4F3FA] transition-colors duration-150 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 p-1 rounded-xl bg-[#191C29] border border-[#292B39]">
              <button
                type="button"
                onClick={() => setModalTab('identity')}
                className={`flex-1 min-h-[40px] py-2 px-4 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === 'identity'
                    ? 'bg-[#B49AF8] text-[#0B0A10]'
                    : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Avatar &amp; Identity</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('backup')}
                className={`flex-1 min-h-[40px] py-2 px-4 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === 'backup'
                    ? 'bg-[#B49AF8] text-[#0B0A10]'
                    : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Watchlist Stats &amp; Backup</span>
              </button>
            </div>

            {modalTab === 'identity' ? (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="p-4 rounded-xl bg-[#191C29] border border-[#292B39] flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-[#B49AF8]">
                    <img src={modalSelectedAvatar || DEFAULT_AVATAR} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-[#F4F3FA] truncate">
                      {modalInputName.trim() || displayName}
                    </h4>
                    <p className="text-[11px] text-[#B49AF8] font-medium">
                      Active Regional Enthusiast • {preferredAudio}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#F4F3FA] flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-[#B49AF8]" />
                    <span>Display Name</span>
                  </label>
                  <input
                    type="text"
                    value={modalInputName}
                    onChange={(e) => setModalInputName(e.target.value)}
                    placeholder="e.g. ZoroFan99, Prasanth..."
                    maxLength={30}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] text-sm text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-150"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#A1A5B5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={avatarSearch}
                        onChange={(e) => setAvatarSearch(e.target.value)}
                        placeholder="Search character avatars by name..."
                        className="w-full min-h-[40px] pl-10 pr-4 py-2 rounded-xl bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-150"
                      />
                    </div>
                  </div>

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
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                            isActive
                              ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                              : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                          }`}
                        >
                          <span>{cat}</span>
                          <span className="text-[10px] opacity-85 font-semibold">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#F4F3FA]">
                      Character Library ({filteredAvatars.length} characters)
                    </label>
                    {selectedCategory !== 'All' && (
                      <span className="text-[11px] text-[#B49AF8] font-medium">
                        Showing {selectedCategory}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-72 sm:max-h-84 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={handleCustomUpload}
                      className="group relative rounded-xl overflow-hidden aspect-square border border-dashed border-[#B49AF8]/50 hover:border-[#B49AF8] bg-[#191C29] transition-colors duration-150 p-2 flex flex-col items-center justify-center text-center cursor-pointer"
                      title="Upload or paste custom image URL"
                    >
                      <Upload className="w-5 h-5 text-[#B49AF8] mb-1" />
                      <span className="text-[10px] font-bold text-[#B49AF8]">CUSTOM</span>
                      <span className="text-[9px] text-[#A1A5B5]">Direct URL</span>
                    </button>

                    {filteredAvatars.map((av) => {
                      const isSelected = modalSelectedAvatar === av.url;
                      return (
                        <button
                          key={av.name}
                          type="button"
                          onClick={() => setModalSelectedAvatar(av.url)}
                          className={`group relative rounded-xl overflow-hidden aspect-square border-2 transition-colors duration-150 p-0.5 cursor-pointer flex flex-col items-center justify-center ${
                            isSelected
                              ? 'border-[#B49AF8] bg-[#B49AF8]/10'
                              : 'border-[#292B39] hover:border-[#B49AF8]/60 bg-[#191C29]'
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
                            className="w-full h-full object-cover rounded-[10px]"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B0A10] via-[#0B0A10]/60 to-transparent pt-3 pb-1 px-1 rounded-b-[10px] pointer-events-none">
                            <p className="text-[10px] font-bold text-[#F4F3FA] text-center truncate leading-tight">
                              {av.name}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-[#B49AF8] rounded-full flex items-center justify-center text-[10px] text-[#0B0A10] font-black">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#292B39]">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6 py-2">
                <div className="p-4 rounded-xl bg-[#191C29] border border-[#292B39] space-y-3">
                  <h4 className="text-xs font-bold text-[#F4F3FA] uppercase tracking-wider">Watchlist Data Summary</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#12141E] border border-[#292B39]">
                      <p className="text-[10px] text-[#A1A5B5] uppercase font-bold">Saved Items</p>
                      <p className="text-base font-bold text-[#B49AF8] mt-0.5">{watchlist.length} Anime</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#12141E] border border-[#292B39]">
                      <p className="text-[10px] text-[#A1A5B5] uppercase font-bold">Cloud Sync Status</p>
                      <p className="text-base font-bold text-[#34D399] mt-0.5">{isSignedIn ? 'Synced to Clerk' : 'Local Storage'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#191C29] border border-[#292B39] space-y-3">
                  <h4 className="text-xs font-bold text-[#F4F3FA] uppercase tracking-wider">Export / Import Watchlist Backup</h4>
                  <p className="text-xs text-[#A1A5B5]">
                    Download your current watchlist as a JSON backup file or restore from a previous backup.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<Download className="w-3.5 h-3.5 text-[#B49AF8]" />}
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
                    >
                      Export JSON
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-[#292B39]">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditModalOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { ProfileView as Profile };
export default ProfileView;
