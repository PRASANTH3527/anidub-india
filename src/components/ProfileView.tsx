import React, { useState, useEffect, useMemo } from 'react';
import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from '../lib/clerk';
import {
  ShieldCheck,
  Edit3,
  LogOut,
  LogIn,
  Bookmark,
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
  MessageSquarePlus,
  Lock,
  FileWarning,
  Settings,
  ChevronRight,
  Globe2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Anime } from './CatalogView';
import { AnimeCard } from './AnimeCard';
import { useToast } from './Toast';
import { useNotifications } from '../context/NotificationContext';
import { PersonalAnimeStats } from './PersonalAnimeStats';
import { ProfilePageSkeleton } from './SkeletonGrid';
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
  resolveEffectiveLibraryStatus,
} from '../utils/libraryStatus';
import { getAllWatchProgress } from '../utils/watchProgress';
import {
  readPreferredLanguage,
  writePreferredLanguage,
} from '../utils/searchFilterState';
import { isAuthorizedClerkAdmin } from '../utils/auth';

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

const PREFERRED_DUB_OPTIONS = ['All', 'Tamil', 'Hindi', 'Telugu', 'Malayalam'] as const;

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
  { name: 'Roronoa Zoro', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png' },
  { name: 'Levi Ackerman', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png' },
  { name: 'Tanjiro Kamado', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b126071-BTNEc1nRIv68.png' },
  { name: 'Ichigo Kurosaki', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b5-a7bkJgjhhigE.png' },
  { name: 'Itachi Uchiha', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png' },
  { name: 'Kakashi Hatake', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjxjmx.png' },
  { name: 'Naruto Uzumaki', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png' },
  { name: 'Sukuna', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b133701-rCQuDpHr3UZL.png' },
  { name: 'Sosuke Aizen', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b1086-qR9218BjZTC0.png' },
  { name: 'Monkey D. Luffy', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png' },
  { name: 'Satoru Gojo', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png' },
  { name: 'Goku', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/246-wsRRr6z1kii8.png' },
];

function navigateAppPath(path: string) {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function ProfileView({
  watchlist = [],
  catalogList = [],
  savedAnimeItems = [],
  onSelectAnime,
  onToggleWatchlist,
  onOpenCreateCollection,
  onNavigateToCatalog,
}: ProfileProps) {
  const { user, isSignedIn, isLoaded } = useUser();
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
  const isAdminUser = Boolean(isSignedIn && user && isAuthorizedClerkAdmin(user));

  const [customName, setCustomName] = useState<string>(() =>
    activeUserId ? readScopedString('anidub_custom_name', activeUserId, '') : ''
  );
  const [customAvatar, setCustomAvatar] = useState<string>(() =>
    activeUserId
      ? readScopedString('anidub_anime_avatar', activeUserId, DEFAULT_AVATAR) || DEFAULT_AVATAR
      : DEFAULT_AVATAR
  );
  const [preferredDubLang, setPreferredDubLang] = useState<string>(() =>
    readPreferredLanguage(activeUserId)
  );

  // Strict Account Data Isolation: re-hydrate scoped profile identity when user signs in, switches, or logs out
  useEffect(() => {
    const syncProfileScope = () => {
      if (!activeUserId) {
        setCustomName('');
        setCustomAvatar(DEFAULT_AVATAR);
        setPreferredDubLang(readPreferredLanguage(null));
        return;
      }
      setCustomName(readScopedString('anidub_custom_name', activeUserId, ''));
      setCustomAvatar(
        readScopedString('anidub_anime_avatar', activeUserId, DEFAULT_AVATAR) || DEFAULT_AVATAR
      );
      setPreferredDubLang(readPreferredLanguage(activeUserId));
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
      setModalInputName(customName || (isSignedIn ? (user?.fullName || user?.username || '') : ''));
      setModalSelectedAvatar(customAvatar || DEFAULT_AVATAR);
      setModalTab('identity');
      setAvatarSearch('');
      setSelectedCategory('All');
    }
  }, [isEditModalOpen, customName, customAvatar, isSignedIn, user?.fullName, user?.username]);

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

    showToast('Profile Updated', 'Your display name and avatar have been saved.', 'success');
    setIsEditModalOpen(false);
  };

  const handleSelectPreferredLanguage = (lang: string) => {
    const normalized = writePreferredLanguage(lang, activeUserId);
    setPreferredDubLang(normalized);
    showToast('Preferred Dub Updated', `Default dub language set to ${normalized}.`, 'success');
  };

  const handleCustomUpload = () => {
    const url = prompt('Enter direct image URL for your custom avatar:');
    if (url && url.trim()) {
      setModalSelectedAvatar(url.trim());
      showToast('Custom Avatar', 'Custom image URL applied.', 'success');
    }
  };

  const savedAnimeList: Anime[] = useMemo(() => {
    if (!isSignedIn) return [];
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
  }, [isSignedIn, savedAnimeItems, catalogList, watchlist]);

  const profileStats = useMemo(() => {
    if (!isSignedIn) {
      return { watching: 0, completed: 0, episodes: 0, reviews: 0 };
    }
    const statusMap = readLibraryStatusMap(activeUserId);
    const progressMap = getAllWatchProgress(undefined, activeUserId);
    let watching = 0;
    let completed = 0;
    let episodes = 0;

    for (const anime of savedAnimeList) {
      const idNum = Number(anime.id);
      const progress = progressMap[idNum] || null;
      const effective = resolveEffectiveLibraryStatus(idNum, statusMap, progress);
      if (effective === 'watching' || effective === 'rewatching') watching += 1;
      if (effective === 'completed') completed += 1;
    }

    for (const entry of Object.values(progressMap)) {
      episodes += Math.max(0, Number(entry?.episode) || 0);
    }

    let reviews = 0;
    try {
      const rawRevs = JSON.parse(localStorage.getItem('cf_user_reviews') || '[]');
      if (Array.isArray(rawRevs)) reviews = rawRevs.length;
    } catch {}

    return { watching, completed, episodes, reviews };
  }, [isSignedIn, activeUserId, savedAnimeList]);

  const topGenresBreakdown = useMemo(() => {
    if (savedAnimeList.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const anime of savedAnimeList) {
      const rawGenres: unknown = (anime as unknown as { genres?: unknown; genre?: unknown }).genres ??
        (anime as unknown as { genre?: unknown }).genre;
      const list = Array.isArray(rawGenres)
        ? rawGenres.map((g) => String(g || '').trim()).filter(Boolean)
        : String(rawGenres || '').split(/[,/|]+/).map((g) => g.trim()).filter(Boolean);
      for (const genre of list) {
        counts[genre] = (counts[genre] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const maxVal = sorted[0]?.[1] || 1;
    return sorted.map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / maxVal) * 100),
    }));
  }, [savedAnimeList]);

  const filteredAvatars = RICH_ANIME_AVATARS.filter((av) => {
    const matchesSearch = av.name.toLowerCase().includes(avatarSearch.toLowerCase());
    const matchesCat = selectedCategory === 'All' || av.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  if (!isLoaded) {
    return <ProfilePageSkeleton />;
  }

  // Strict Signed-Out Account Isolation View
  if (!isSignedIn) {
    return (
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-5 overflow-x-clip">
        <section
          data-testid="profile-signed-out-card"
          className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-6 sm:p-8 text-center space-y-5"
        >
          <div className="w-14 h-14 rounded-[12px] bg-[#191C29] border border-[#292B39] text-[#B49AF8] flex items-center justify-center mx-auto">
            <UserIcon className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#F4F3FA]">
              Sign In to Your AniDub Profile
            </h1>
            <p className="text-xs sm:text-sm text-[#A1A5B5] leading-relaxed">
              Sync your Watchlist across devices, follow titles for new regional dub alerts, and publish dub reviews.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left max-w-2xl mx-auto pt-1">
            {[
              { title: 'Watchlist Sync', desc: 'Keep Watching & Completed tabs synced across devices.' },
              { title: 'Dub Update Alerts', desc: 'Follow series to get notified on new Tamil, Hindi & Telugu dubs.' },
              { title: 'Community Reviews', desc: 'Rate regional voice acting and localization quality.' },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5 space-y-1"
              >
                <p className="text-xs font-bold text-[#F4F3FA]">{item.title}</p>
                <p className="text-[11px] text-[#A1A5B5] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="min-h-[44px] px-6 py-2.5 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-sm font-bold inline-flex items-center gap-2 transition-colors duration-180 motion-reduce:transition-none cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In / Create Account</span>
                </button>
              </SignInButton>
            </SignedOut>
            {onNavigateToCatalog && (
              <Button variant="secondary" size="md" onClick={onNavigateToCatalog}>
                Browse Explore
              </Button>
            )}
          </div>
        </section>

        {/* Preferred Dub Language & Support Links even for Guests */}
        <section className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-[#B49AF8]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#B49AF8]">
              Preferred Dub Language
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {PREFERRED_DUB_OPTIONS.map((lang) => {
              const active = preferredDubLang.toLowerCase() === lang.toLowerCase();
              return (
                <button
                  key={`guest_pref_${lang}`}
                  type="button"
                  onClick={() => handleSelectPreferredLanguage(lang)}
                  className={`min-h-[44px] px-4 py-2 rounded-[12px] text-xs font-bold border transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                    active
                      ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                      : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </section>

        <section
          aria-label="Settings and Support"
          className="rounded-[12px] bg-[#12141E] border border-[#292B39] overflow-hidden divide-y divide-[#292B39]"
        >
          <div className="px-4 py-3 bg-[#191C29]/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#B49AF8]">
              Support &amp; Legal
            </h2>
          </div>
          {[
            { label: 'Share Feedback', icon: MessageSquarePlus, path: '/feedback' },
            { label: 'Privacy Policy', icon: Lock, path: '/privacy' },
            { label: 'Copyright / Takedown Policy', icon: FileWarning, path: '/copyright' },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.path}
                type="button"
                onClick={() => navigateAppPath(row.path)}
                className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#191C29] transition-colors duration-180 cursor-pointer"
              >
                <span className="inline-flex items-center gap-3 text-xs sm:text-sm font-semibold text-[#F4F3FA]">
                  <Icon className="w-4 h-4 text-[#B49AF8]" />
                  <span>{row.label}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[#A1A5B5]" />
              </button>
            );
          })}
        </section>
      </div>
    );
  }

  const activeAvatar = customAvatar || DEFAULT_AVATAR;
  const displayName = customName || user?.fullName || user?.username || 'Anime Fan';
  const displaySubtitle = user?.primaryEmailAddress?.emailAddress || 'Signed-in member';

  return (
    <div className="relative w-full max-w-full min-h-screen text-[#F4F3FA] font-sans pb-24 overflow-x-clip">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8 space-y-6">
        {/* 1. PROFILE HEADER & COMPACT 4-COLUMN STATS ROW */}
        <section className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[12px] overflow-hidden bg-[#191C29] border border-[#292B39]">
                  <img
                    src={activeAvatar}
                    alt={displayName}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  aria-label="Change Avatar"
                  className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-[10px] bg-[#B49AF8] hover:bg-[#CBB6FF] border-2 border-[#12141E] flex items-center justify-center text-[#0B0A10] cursor-pointer transition-colors duration-180"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#F4F3FA] truncate">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#191C29] border border-[#292B39] text-[#B49AF8] text-[11px] font-bold">
                    <Globe2 className="w-3 h-3" />
                    <span>{preferredDubLang === 'All' ? 'All Indian Dubs' : `${preferredDubLang} Dub`}</span>
                  </span>
                </div>
                <p className="text-xs text-[#A1A5B5] flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{displaySubtitle}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setIsEditModalOpen(true)}
                leftIcon={<Edit3 className="w-4 h-4 text-[#B49AF8]" />}
                className="text-xs font-bold"
              >
                Edit Profile
              </Button>

              <SignedIn>
                <SignOutButton>
                  <button
                    type="button"
                    className="min-h-[44px] px-4 py-2 rounded-[12px] bg-[#191C29] hover:bg-[#F87171]/15 border border-[#292B39] hover:border-[#F87171]/40 text-[#F87171] text-xs font-bold inline-flex items-center gap-1.5 transition-colors duration-180 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </SignOutButton>
              </SignedIn>
            </div>
          </div>

          {/* Compact 4-Column Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#292B39]">
            {[
              { label: 'Watching', value: profileStats.watching, tone: 'text-[#B49AF8]' },
              { label: 'Completed', value: profileStats.completed, tone: 'text-[#34D399]' },
              { label: 'Episodes', value: profileStats.episodes, tone: 'text-[#F9C876]' },
              { label: 'Reviews', value: profileStats.reviews, tone: 'text-[#CBB6FF]' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5 text-center"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                  {stat.label}
                </p>
                <p className={`text-xl font-extrabold mt-1 tabular-nums ${stat.tone}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 2. REFINED ANIME DNA & PREFERRED DUB LANGUAGE SECTION */}
        <section className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#292B39] pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] text-[#B49AF8] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#F4F3FA]">
                  Anime DNA &amp; Dub Preferences
                </h2>
                <p className="text-xs text-[#A1A5B5]">
                  Your preferred regional audio and top genres from saved titles
                </p>
              </div>
            </div>
            {onOpenCreateCollection && (
              <Button variant="secondary" size="sm" onClick={onOpenCreateCollection}>
                New Collection
              </Button>
            )}
          </div>

          {/* Quick Preferred Dub Language Selector */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A5B5] block">
              Preferred Dub Language
            </span>
            <div className="flex flex-wrap gap-2">
              {PREFERRED_DUB_OPTIONS.map((lang) => {
                const active = preferredDubLang.toLowerCase() === lang.toLowerCase();
                return (
                  <button
                    key={`pref_dub_${lang}`}
                    type="button"
                    onClick={() => handleSelectPreferredLanguage(lang)}
                    className={`min-h-[44px] px-4 py-2 rounded-[12px] text-xs font-bold border transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
                      active
                        ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                        : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clean Genre Progress Bars */}
          <div className="space-y-2.5 pt-2 border-t border-[#292B39]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A5B5] block">
              Top Genres
            </span>
            {topGenresBreakdown.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topGenresBreakdown.map((genre) => (
                  <div
                    key={genre.name}
                    className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#F4F3FA]">{genre.name}</span>
                      <span className="text-[#A1A5B5] tabular-nums">
                        {genre.count} {genre.count === 1 ? 'title' : 'titles'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#12141E] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#B49AF8] transition-all duration-180"
                        style={{ width: `${genre.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A1A5B5]">
                Bookmark titles in Explore to generate your Anime DNA genre profile.
              </p>
            )}
          </div>
        </section>

        {/* 3. ORGANIZED SETTINGS, SUPPORT, LEGAL & ACCOUNT ACTIONS */}
        <section
          aria-label="Settings and Support"
          data-testid="profile-settings-support"
          className="rounded-[12px] bg-[#12141E] border border-[#292B39] overflow-hidden divide-y divide-[#292B39]"
        >
          <div className="px-5 py-3.5 bg-[#191C29]/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#B49AF8]">
              Settings &amp; Support
            </h2>
          </div>

          <button
            type="button"
            onClick={() => navigateAppPath('/feedback')}
            className="w-full min-h-[48px] px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#191C29] transition-colors duration-180 cursor-pointer"
          >
            <span className="inline-flex items-center gap-3 text-xs sm:text-sm font-semibold text-[#F4F3FA]">
              <MessageSquarePlus className="w-4 h-4 text-[#B49AF8]" />
              <span>Share Feedback</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#A1A5B5]" />
          </button>

          <button
            type="button"
            onClick={() => navigateAppPath('/privacy')}
            className="w-full min-h-[48px] px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#191C29] transition-colors duration-180 cursor-pointer"
          >
            <span className="inline-flex items-center gap-3 text-xs sm:text-sm font-semibold text-[#F4F3FA]">
              <Lock className="w-4 h-4 text-[#B49AF8]" />
              <span>Privacy Policy</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#A1A5B5]" />
          </button>

          <button
            type="button"
            onClick={() => navigateAppPath('/copyright')}
            className="w-full min-h-[48px] px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#191C29] transition-colors duration-180 cursor-pointer"
          >
            <span className="inline-flex items-center gap-3 text-xs sm:text-sm font-semibold text-[#F4F3FA]">
              <FileWarning className="w-4 h-4 text-[#B49AF8]" />
              <span>Copyright / Takedown Policy</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#A1A5B5]" />
          </button>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="w-full min-h-[48px] px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#191C29] transition-colors duration-180 cursor-pointer"
          >
            <span className="inline-flex items-center gap-3 text-xs sm:text-sm font-semibold text-[#F4F3FA]">
              <Settings className="w-4 h-4 text-[#B49AF8]" />
              <span>Account Settings &amp; Export</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#A1A5B5]" />
          </button>

          {isAdminUser && (
            <button
              type="button"
              onClick={() => navigateAppPath('/admin')}
              className="w-full min-h-[48px] px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#191C29] transition-colors duration-180 cursor-pointer"
            >
              <span className="inline-flex items-center gap-3 text-xs sm:text-sm font-bold text-[#34D399]">
                <ShieldCheck className="w-4 h-4 text-[#34D399]" />
                <span>Admin Dashboard</span>
              </span>
              <ChevronRight className="w-4 h-4 text-[#34D399]" />
            </button>
          )}
        </section>

        {/* PERSONAL ANIME STATS */}
        <PersonalAnimeStats
          watchlist={watchlist}
          catalogList={catalogList}
          savedAnimeItems={savedAnimeList}
          isSignedIn={Boolean(isSignedIn)}
          onNavigateToCatalog={onNavigateToCatalog}
        />

        {/* NOTIFICATION PREFERENCES */}
        <section
          aria-label="Notification Preferences"
          className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292B39] pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#B49AF8]">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#F4F3FA]">
                  Notification Preferences
                </h2>
                <p className="text-xs text-[#A1A5B5]">
                  Sound chimes, browser alerts, and regional dub release updates
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
            <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                {isSoundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#34D399] shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#A1A5B5] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#F4F3FA]">Sound Chime</p>
                  <p className="text-[11px] text-[#A1A5B5]">Play chime on updates</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isSoundEnabled}
                aria-label="Toggle notification sound chime"
                onClick={toggleSound}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-180 cursor-pointer shrink-0 ${
                  isSoundEnabled ? 'bg-[#B49AF8]' : 'bg-[#292B39]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-[#0B0A10] transition-transform duration-180 ${
                    isSoundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="w-4 h-4 text-[#B49AF8] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#F4F3FA]">Desktop Alerts</p>
                  <p className="text-[11px] text-[#A1A5B5] capitalize">{browserPermission}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestBrowserPermission}
                disabled={browserPermission === 'unsupported' || browserPermission === 'granted'}
                className="min-h-[38px] px-3 py-1.5 rounded-[10px] bg-[#12141E] border border-[#292B39] hover:border-[#B49AF8]/60 disabled:opacity-50 text-xs font-bold text-[#F4F3FA] cursor-pointer shrink-0 transition-colors duration-180"
              >
                {browserPermission === 'granted' ? 'Enabled' : browserPermission === 'unsupported' ? 'Unsupported' : 'Enable'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#F4F3FA]">New Dub Releases</p>
                <p className="text-[11px] text-[#A1A5B5]">Tamil, Hindi &amp; Telugu dub additions</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.newDubs}
                aria-label="Toggle new dub releases notifications"
                onClick={() => updatePreference('newDubs', !preferences.newDubs)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-180 cursor-pointer shrink-0 ${
                  preferences.newDubs ? 'bg-[#B49AF8]' : 'bg-[#292B39]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-[#0B0A10] transition-transform duration-180 ${
                    preferences.newDubs ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#F4F3FA]">Weekly Simulcast Drops</p>
                <p className="text-[11px] text-[#A1A5B5]">Scheduled weekly dub episode alerts</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.simulcasts}
                aria-label="Toggle weekly simulcast notifications"
                onClick={() => updatePreference('simulcasts', !preferences.simulcasts)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-180 cursor-pointer shrink-0 ${
                  preferences.simulcasts ? 'bg-[#B49AF8]' : 'bg-[#292B39]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-[#0B0A10] transition-transform duration-180 ${
                    preferences.simulcasts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* ACTIVE WATCHLIST PREVIEW */}
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#B49AF8]" />
              <h2 className="text-base sm:text-lg font-extrabold text-[#F4F3FA]">
                Saved Titles ({savedAnimeList.length})
              </h2>
            </div>
            {onNavigateToCatalog && (
              <button
                type="button"
                onClick={onNavigateToCatalog}
                className="min-h-[40px] px-3 text-xs font-bold text-[#B49AF8] hover:text-[#CBB6FF] cursor-pointer"
              >
                Explore Catalog
              </button>
            )}
          </div>

          {savedAnimeList.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {savedAnimeList.slice(0, 8).map((anime, index) => (
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
              icon={<Layers className="w-5 h-5" />}
              title="No Saved Titles Yet"
              description="Bookmark dubbed anime in Explore to see them in your profile."
              actionLabel={onNavigateToCatalog ? 'Browse Explore' : undefined}
              onAction={onNavigateToCatalog}
            />
          )}
        </section>
      </div>

      {/* EDIT PROFILE & BACKUP MODAL */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0A10]/85"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-[#12141E] border border-[#292B39] rounded-[12px] p-5 sm:p-6 space-y-5 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#292B39] pb-3.5">
              <div>
                <h3 className="text-lg font-extrabold text-[#F4F3FA]">Account Settings &amp; Profile</h3>
                <p className="text-xs text-[#A1A5B5]">Update display name, avatar, or export your library</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-11 h-11 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#A1A5B5] hover:text-[#F4F3FA] cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 p-1 rounded-[12px] bg-[#191C29] border border-[#292B39]">
              <button
                type="button"
                onClick={() => setModalTab('identity')}
                className={`flex-1 min-h-[40px] py-2 px-4 rounded-[10px] text-xs font-bold transition-colors duration-180 cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === 'identity' ? 'bg-[#B49AF8] text-[#0B0A10]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Identity &amp; Avatar</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('backup')}
                className={`flex-1 min-h-[40px] py-2 px-4 rounded-[10px] text-xs font-bold transition-colors duration-180 cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === 'backup' ? 'bg-[#B49AF8] text-[#0B0A10]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Export &amp; Backup</span>
              </button>
            </div>

            {modalTab === 'identity' ? (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#F4F3FA] block">Display Name</label>
                  <input
                    type="text"
                    value={modalInputName}
                    onChange={(e) => setModalInputName(e.target.value)}
                    placeholder="Enter display name..."
                    maxLength={30}
                    className="w-full h-[44px] px-4 rounded-[12px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] text-sm text-[#F4F3FA] placeholder-[#A1A5B5] outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#A1A5B5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={avatarSearch}
                      onChange={(e) => setAvatarSearch(e.target.value)}
                      placeholder="Search character avatars..."
                      className="w-full h-[44px] pl-10 pr-4 rounded-[12px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] text-xs text-[#F4F3FA] placeholder-[#A1A5B5] outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {AVATAR_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-[10px] text-xs font-bold border shrink-0 cursor-pointer transition-colors duration-180 ${
                          selectedCategory === cat
                            ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                            : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39] hover:text-[#F4F3FA]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={handleCustomUpload}
                      className="rounded-[12px] aspect-square border border-dashed border-[#B49AF8]/50 hover:border-[#B49AF8] bg-[#191C29] p-2 flex flex-col items-center justify-center text-center cursor-pointer"
                    >
                      <Upload className="w-5 h-5 text-[#B49AF8] mb-1" />
                      <span className="text-[10px] font-bold text-[#B49AF8]">Custom URL</span>
                    </button>

                    {filteredAvatars.map((av) => {
                      const isSelected = modalSelectedAvatar === av.url;
                      return (
                        <button
                          key={av.name}
                          type="button"
                          onClick={() => setModalSelectedAvatar(av.url)}
                          className={`relative rounded-[12px] overflow-hidden aspect-square border-2 p-0.5 cursor-pointer ${
                            isSelected ? 'border-[#B49AF8]' : 'border-[#292B39] hover:border-[#B49AF8]/60'
                          }`}
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
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#292B39]">
                  <Button type="button" variant="secondary" size="md" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md" leftIcon={<Save className="w-4 h-4" />}>
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-[12px] bg-[#191C29] border border-[#292B39] space-y-3">
                  <h4 className="text-xs font-bold text-[#F4F3FA] uppercase tracking-wider">
                    Export Watchlist
                  </h4>
                  <p className="text-xs text-[#A1A5B5]">
                    Download your saved watchlist as a CSV spreadsheet or JSON backup.
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      leftIcon={<Download className="w-4 h-4" />}
                      onClick={() => {
                        if (savedAnimeList.length === 0) {
                          showToast('Watchlist Empty', 'Save at least one anime before exporting CSV.', 'info');
                          return;
                        }
                        const csv = buildWatchlistCsv(
                          savedAnimeList,
                          readLibraryStatusMap(activeUserId),
                          getAllWatchProgress(undefined, activeUserId)
                        );
                        const dateTag = new Date().toISOString().slice(0, 10);
                        downloadCsvFile(`anidub-india-watchlist-${dateTag}.csv`, csv);
                        showToast('CSV Exported', `Exported ${savedAnimeList.length} titles.`, 'success');
                      }}
                    >
                      Export CSV
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      leftIcon={<Download className="w-4 h-4 text-[#B49AF8]" />}
                      onClick={() => {
                        const dataStr =
                          'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(watchlist));
                        const anchor = document.createElement('a');
                        anchor.setAttribute('href', dataStr);
                        anchor.setAttribute('download', `anidub_watchlist_backup_${Date.now()}.json`);
                        document.body.appendChild(anchor);
                        anchor.click();
                        anchor.remove();
                        showToast('Backup Downloaded', 'Watchlist JSON backup downloaded.', 'success');
                      }}
                    >
                      Export JSON
                    </Button>
                  </div>
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
