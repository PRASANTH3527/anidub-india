import React, { useState, useEffect } from 'react';
import {
  User, Bookmark, CheckCircle, Play, LogOut, Shield, Sparkles, Lock,
  MessageSquare, FileText, Globe, Languages, Bell, Cloud, ChevronRight, Check, Camera, X, Palette
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Anime,
  WatchlistItem,
  normalizeAnimeList,
  normalizeWatchlistProp,
} from '../types';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import { useUser, useClerk } from '../lib/clerk';
import { ProfilePageSkeleton } from './ui/EclipseState';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export interface ProfileViewProps {
  user?: {
    id?: string;
    name: string;
    email: string;
    avatar?: string;
    isAdmin?: boolean;
  } | null;
  watchlist?: any[];
  animeList?: any[];
  catalogList?: any[];
  savedAnimeItems?: any[];
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onSelectAnime?: (anime: any) => void;
  onToggleWatchlist?: (id: any) => void;
  onOpenCreateCollection?: () => void;
  onNavigateToCatalog?: () => void;
  onOpenAdmin?: () => void;
  onOpenSubmitDub?: () => void;
  onOpenFeedback?: () => void;
  onOpenLegal?: (page?: 'privacy' | 'terms' | 'dmca') => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  isLoading?: boolean;
}

const REGIONAL_LANGUAGES = ['Tamil', 'Hindi', 'Telugu', 'Malayalam', 'Kannada', 'Bengali'] as const;

export interface AnimeAvatarOption {
  name: string;
  category: 'Shonen' | 'Villains' | 'Swordsmen' | 'Hunters' | 'Ninjas';
  url: string;
}

const AVATAR_CATEGORIES = ['All', 'Shonen', 'Villains', 'Swordsmen', 'Hunters', 'Ninjas'] as const;

const RICH_ANIME_AVATARS: AnimeAvatarOption[] = [
  { name: 'Sung Jin-woo', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129928-i1C9G8G7nA5R.png' },
  { name: 'Cha Hae-in', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b136071-e6P4J7Y8nX3Z.png' },
  { name: 'Roronoa Zoro', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b62-Wixe3k3YOgpH.png' },
  { name: 'Sanji', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b305-t221469103.png' },
  { name: 'Itachi Uchiha', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5g6c7L9.png' },
  { name: 'Kakashi Hatake', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjLNag.png' },
  { name: 'Madara Uchiha', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b53901-8x9S7x9X6X9X.png' },
  { name: 'Levi Ackerman', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmGiOV.png' },
  { name: 'Eren Yeager', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg' },
  { name: 'Mikasa Ackerman', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1PkreDvj.png' },
  { name: 'Nezuko Kamado', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127518-NRlq1CQ1v1ro.png' },
  { name: 'Zenitsu Agatsuma', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129131-F1e3b4G7rX9S.png' },
  { name: 'Kyojuro Rengoku', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129130-k5W5g6H9mP2B.png' },
  { name: 'Tengen Uzui', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b129132-8h4V1f5nM7C2.png' },
  { name: 'Yuji Itadori', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127212-F8g2H4k7M9N1.png' },
  { name: 'Sukuna', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b133700-3R7t9X2vL8Q5.png' },
  { name: 'Toji Fushiguro', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b165352-9T2w4K6pX1V8.png' },
  { name: 'Saitama', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b73935-b2V4y6K8nM1Q.png' },
  { name: 'Garou', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b89695-4L7m9R2xN6B3.png' },
  { name: 'Light Yagami', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b80-5E8w2K9pT4C1.png' },
  { name: 'L Lawliet', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b71-7R3n5X1vB8M4.png' },
  { name: 'Goku', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b246-6Q9m2N4xP7L5.png' },
  { name: 'Vegeta', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b913-2T5k8R1vW3C9.png' },
  { name: 'Ichigo Kurosaki', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b5-9M2v4K7xR1N6.png' },
  { name: 'Sosuke Aizen', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b1086-3X6n8T2pL5Q7.png' },
  { name: 'Naruto Uzumaki', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b17-IInspectable1.png' },
  { name: 'Sasuke Uchiha', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b13-8N4k2V6mX9P3.png' },
  { name: 'Minato Namikaze', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b2535-7T1p4R9vL2C8.png' },
  { name: 'Jiraiya', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b2423-5K8m3X1nP6Q4.png' },
  { name: 'Monkey D. Luffy', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-9R2v6N4kT7M1.png' },
  { name: 'Satoru Gojo', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-Um2d9X5pL8C4.png' },
  { name: 'Megumi Fushiguro', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b126635-2V7k4R9nM1Q6.png' },
  { name: 'Tanjiro Kamado', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b126071-BTJEtoken123.png' },
  { name: 'Giyu Tomioka', category: 'Swordsmen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b146736-4R8m2K6pX9N3.png' },
  { name: 'Gon Freecss', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b30-6N9v3T1kL5C7.png' },
  { name: 'Killua Zoldyck', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-8K2m5X7pR4Q1.png' },
  { name: 'Kurapika', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b28-3T6n9R2vL8M4.png' },
  { name: 'Hisoka Morow', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b31-5M8k2V4nX7P9.png' },
  { name: 'Chrollo Lucilfer', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b58-7P1r4N8vK3C6.png' },
  { name: 'Denji', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b137079-9X4m2T7pR5L1.png' },
  { name: 'Makima', category: 'Villains', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b137080-2K6n8V3pM9Q4.png' },
  { name: 'Aki Hayakawa', category: 'Hunters', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b137081-4R9t1X5vN2C8.png' },
  { name: 'Izuku Midoriya', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b89028-6T3k7M2pL9V5.png' },
  { name: 'Katsuki Bakugo', category: 'Shonen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b88892-8N5v2R4kX1Q7.png' },
  { name: 'Pain Nagato', category: 'Ninjas', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b3180-1M7p4K9nT6C3.png' },
];

export function ProfileView({
  user: userProp,
  watchlist: watchlistProp = [],
  animeList: animeListProp,
  catalogList,
  savedAnimeItems,
  onOpenAuth: onOpenAuthProp,
  onLogout: onLogoutProp,
  onOpenAdmin: onOpenAdminProp,
  onOpenSubmitDub,
  onOpenFeedback,
  onOpenLegal,
  onShowToast,
  isLoading = false,
}: ProfileViewProps) {
  const { isSignedIn, user: clerkUser } = useUser();
  const { signOut: clerkSignOut, openSignIn: clerkOpenSignIn } = useClerk();
  const { t } = useTranslation(['profile', 'common']);
  const { displayName: activeThemeName, activeSwatches, openAppearance } = useTheme();
  const { languageMeta, preference: uiLangPref, openLanguageSelector } = useLanguage();

  const user = React.useMemo(() => {
    if (userProp !== undefined) return userProp;
    if (isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || '';
      return {
        id: clerkUser.id,
        name: clerkUser.fullName || clerkUser.username || email.split('@')[0] || 'Member',
        email,
        avatar: clerkUser.imageUrl,
        isAdmin: isAuthorizedClerkAdmin(clerkUser),
      };
    }
    return null;
  }, [userProp, isSignedIn, clerkUser]);

  const onOpenAuth = onOpenAuthProp || (() => clerkOpenSignIn?.());
  const onLogout = onLogoutProp || (() => clerkSignOut?.());
  const onOpenAdmin =
    onOpenAdminProp ||
    (() => {
      if (typeof window !== 'undefined') {
        window.history.pushState({ tab: 'admin' }, '', '/admin');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });

  const combinedCatalog = React.useMemo(
    () => normalizeAnimeList([...(animeListProp || []), ...(catalogList || []), ...(savedAnimeItems || [])]),
    [animeListProp, catalogList, savedAnimeItems]
  );

  const { items: watchlist, animePool: animeList } = React.useMemo(
    () =>
      normalizeWatchlistProp(
        savedAnimeItems && savedAnimeItems.length > 0 ? savedAnimeItems : watchlistProp,
        combinedCatalog
      ),
    [watchlistProp, savedAnimeItems, combinedCatalog]
  );

  const [preferredLang, setPreferredLang] = useState<string>(() => {
    try {
      return localStorage.getItem('anidub_preferred_lang') || 'Tamil';
    } catch {
      return 'Tamil';
    }
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('anidub_notifications') !== 'false';
    } catch {
      return true;
    }
  });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState<(typeof AVATAR_CATEGORIES)[number]>('All');
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCustomAvatarUrl(null);
      return;
    }
    try {
      const key = `anidub_custom_avatar_${user.id || user.email}`;
      setCustomAvatarUrl(localStorage.getItem(key));
    } catch {
      setCustomAvatarUrl(null);
    }
  }, [user]);

  const activeAvatarUrl = customAvatarUrl || user?.avatar || null;
  const filteredAvatars =
    avatarCategory === 'All'
      ? RICH_ANIME_AVATARS
      : RICH_ANIME_AVATARS.filter((a) => a.category === avatarCategory);

  const handleSelectAvatar = (avatar: AnimeAvatarOption) => {
    if (!user) return;
    setCustomAvatarUrl(avatar.url);
    setShowAvatarPicker(false);
    try {
      const key = `anidub_custom_avatar_${user.id || user.email}`;
      localStorage.setItem(key, avatar.url);
    } catch {
      // ignore
    }
    onShowToast?.(`Profile avatar updated to ${avatar.name}`, 'success');
  };

  const isAdminVerified = Boolean(user?.isAdmin && isAuthorizedClerkAdmin(user.email));

  // Strict Guest / Signed-In Data Isolation
  const savedCount = user ? watchlist.length : 0;
  const completedCount = user ? watchlist.filter((item) => item.status === 'Completed').length : 0;

  const [episodesWatchedTotal, setEpisodesWatchedTotal] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setEpisodesWatchedTotal(0);
      return;
    }
    try {
      const progressMap = JSON.parse(localStorage.getItem('anime_progress') || '{}');
      const sum = Object.values(progressMap).reduce(
        (acc: number, val) => acc + (Number(val) || 0),
        0
      );
      setEpisodesWatchedTotal(sum);
    } catch {
      setEpisodesWatchedTotal(0);
    }
  }, [user, watchlist]);

  // Compute Anime DNA (Top genres/languages from signed-in user's watchlist)
  const animeDnaBars = React.useMemo(() => {
    if (!user || watchlist.length === 0) return [];
    const genreCounts: Record<string, number> = {};
    watchlist.forEach((w) => {
      const found = animeList.find((a) => String(a.id) === String(w.id));
      if (found && Array.isArray(found.genres)) {
        found.genres.forEach((g: string) => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    });
    const entries = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const maxVal = entries[0]?.[1] || 1;
    return entries.map(([genre, count]) => ({
      genre,
      count,
      percent: Math.round((count / maxVal) * 100),
    }));
  }, [user, watchlist, animeList]);

  const handleSelectLanguage = (lang: string) => {
    setPreferredLang(lang);
    setShowLangPicker(false);
    try {
      localStorage.setItem('anidub_preferred_lang', lang);
    } catch {
      // ignore
    }
    if (onShowToast) {
      onShowToast(`Preferred dub language set to ${lang}`, 'success');
    }
  };

  const handleToggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    try {
      localStorage.setItem('anidub_notifications', String(next));
    } catch {
      // ignore
    }
    if (onShowToast) {
      onShowToast(
        next ? 'Dub update notifications enabled' : 'Notifications muted',
        'info'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 pt-6 pb-24">
        <ProfilePageSkeleton />
      </div>
    );
  }

  return (
    <section className="max-w-[960px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[var(--text-primary)] space-y-6">
      <div>
        <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em]">
          {t('profile:title', 'Profile & Settings')}
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
          {t('profile:subtitle', 'Manage your regional dub preferences, cloud sync, and account')}
        </p>
      </div>

      {/* 1. User Account Card (Signed-In vs Guest) */}
      {user ? (
        <div
          data-testid="profile-signed-in-card"
          className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowAvatarPicker(true)}
                aria-label="Choose anime avatar"
                className="relative group w-16 h-16 rounded-2xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                {activeAvatarUrl ? (
                  <img
                    src={activeAvatarUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[22px] font-bold text-[var(--accent-primary)]">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-[var(--bg-canvas)]/80 py-0.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-3.5 h-3.5 text-[var(--accent-hover)]" />
                </span>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] sm:text-[20px] font-bold text-[var(--text-primary)]">{user.name}</h2>
                  <span className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border border-[var(--accent-primary)]/30 text-[11px] font-bold">
                    {isAdminVerified ? 'Admin' : 'Verified Member'}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--text-secondary)]">{user.email}</p>
              </div>
            </div>

            {isAdminVerified && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="min-h-[44px] px-4 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold text-[13px] inline-flex items-center gap-2 transition-colors duration-180"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </button>
            )}
          </div>

          {/* Compact 3-Column Stats (Saved, Completed, Episodes) */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[var(--accent-primary)] text-[11px] font-bold uppercase tracking-wider mb-1">
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved</span>
              </div>
              <div className="text-[20px] font-bold text-[var(--text-primary)]">{savedCount}</div>
            </div>

            <div className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[#34D399] text-[11px] font-bold uppercase tracking-wider mb-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Completed</span>
              </div>
              <div className="text-[20px] font-bold text-[var(--text-primary)]">{completedCount}</div>
            </div>

            <div className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[#F9C876] text-[11px] font-bold uppercase tracking-wider mb-1">
                <Play className="w-3.5 h-3.5" />
                <span>Episodes</span>
              </div>
              <div className="text-[20px] font-bold text-[var(--text-primary)]">{episodesWatchedTotal}</div>
            </div>
          </div>

          {/* Refined #B49AF8 Anime DNA Bars */}
          {animeDnaBars.length > 0 && (
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Your Anime DNA
                </span>
                <span className="text-[11px] text-[var(--accent-hover)]">Top Genres</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {animeDnaBars.map((bar) => (
                  <div key={bar.genre} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-[var(--text-primary)]">{bar.genre}</span>
                      <span className="text-[var(--text-secondary)]">{bar.count} titles</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent-primary)]"
                        style={{ width: `${bar.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Signed-Out Guest Card */
        <div
          data-testid="profile-signed-out-card"
          className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
        >
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[var(--text-primary)] mb-1">
                {t('profile:signInTitle', 'Sign in to AniDub India')}
              </h2>
              <p className="text-[13px] sm:text-[14px] text-[var(--text-secondary)] max-w-md leading-relaxed">
                {t(
                  'profile:signInSubtitle',
                  'Sync your regional dub watchlist across devices, track per-season episode progress, and post verified reviews.'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] px-5 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold text-[14px] inline-flex items-center justify-center gap-2 shrink-0 transition-colors duration-180 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{t('profile:signInCta', 'Sign In / Create Account')}</span>
          </button>
        </div>
      )}

      {/* 2. Unified Grouped Settings List (44px+ touch rows) */}
      <div
        data-testid="profile-settings-support"
        className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden"
      >
        {/* Row 0: Appearance & Themes */}
        <div className="p-3 sm:p-4" data-testid="profile-appearance-card">
          <button
            type="button"
            onClick={() => openAppearance('presets')}
            aria-label={`${t('profile:appearanceTitle', 'Appearance & Themes')} — ${activeThemeName}`}
            className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {t('profile:appearanceTitle', 'Appearance & Themes')}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] truncate">
                  {t('profile:appearanceSubtitle', '12 themes, light/dark modes, and Custom Theme Studio')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1" aria-hidden="true">
                {activeSwatches.map((hex, idx) => (
                  <span
                    key={`profile_theme_dot_${idx}`}
                    className="w-3.5 h-3.5 rounded-full border border-black/20"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <span className="hidden xs:inline sm:inline px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] font-bold text-[var(--accent-primary)] max-w-[130px] truncate">
                {activeThemeName}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
          </button>
        </div>

        {/* Row 0.5: Website Language & Region (Separate from Dub Filter) */}
        <div className="p-3 sm:p-4" data-testid="profile-language-card">
          <button
            type="button"
            onClick={openLanguageSelector}
            aria-label={`${t('profile:websiteLanguageTitle', 'Language & Region')} — ${languageMeta.nativeName}`}
            className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Languages className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {t('profile:websiteLanguageTitle', 'Language & Region')}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] truncate">
                  {t('profile:websiteLanguageSubtitle', 'Website interface language (independent of dub filters)')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] font-bold text-[var(--accent-primary)] max-w-[140px] truncate">
                {languageMeta.nativeName}
                {uiLangPref === 'auto' ? ' · Auto' : ''}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
          </button>
        </div>

        {/* Row 1: Preferred Dub Language (Independent from Website UI Language) */}
        <div className="p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setShowLangPicker((prev) => !prev)}
            aria-expanded={showLangPicker}
            className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {t('profile:preferredDubTitle', 'Preferred dub language')}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] truncate">
                  {t('profile:preferredDubSubtitle', {
                    language: preferredLang,
                    defaultValue: `Prioritize ${preferredLang} dubs in discovery and notifications`,
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] font-bold text-[var(--accent-hover)]">
                {preferredLang}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
          </button>

          {showLangPicker && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REGIONAL_LANGUAGES.map((lang) => {
                const isSelected = preferredLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleSelectLanguage(lang)}
                    className={`min-h-[44px] px-3 rounded-[10px] text-[13px] font-semibold border flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
                    }`}
                  >
                    <span>{lang}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 2: Notifications & Notification Preferences */}
        <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                {t('profile:notificationsTitle', 'Notifications & Notification Preferences')}
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                {t(
                  'profile:notificationsSubtitle',
                  'Weekly Simulcast Drops & Notification Sound Chime for followed regional dubs'
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={handleToggleNotifications}
            className={`min-h-[44px] px-4 rounded-[10px] text-[12px] font-bold border transition-colors shrink-0 cursor-pointer ${
              notificationsEnabled
                ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border-[var(--accent-primary)]/40'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
            }`}
          >
            {notificationsEnabled
              ? t('common:enabled', 'Enabled')
              : t('common:disabled', 'Disabled')}
          </button>
        </div>

        {/* Row 3: Sync & Backup */}
        <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                {t('profile:syncTitle', 'Sync & backup')}
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                {user
                  ? t('profile:syncSubtitleCloud', 'Synced securely with your account across devices')
                  : t('profile:syncSubtitleLocal', 'Local browser storage (Sign in to enable cloud backup)')}
              </div>
            </div>
          </div>
          {user ? (
            <span className="px-2.5 py-1 rounded-[8px] bg-emerald-500/10 text-[#34D399] border border-emerald-500/30 text-[12px] font-semibold shrink-0">
              {t('common:verified', 'Verified')}
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--accent-hover)] border border-[var(--border-subtle)] text-[12px] font-semibold shrink-0 cursor-pointer"
            >
              {t('profile:enableSync', 'Enable Sync')}
            </button>
          )}
        </div>

        {/* Row 4: Help & Feedback (Single Dedicated Home) */}
        <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                {t('profile:helpTitle', 'Help & feedback')}
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                {t('profile:helpSubtitle', 'Report a bug, suggest a feature, or submit verified regional dub info')}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenSubmitDub && (
              <button
                type="button"
                onClick={onOpenSubmitDub}
                className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold cursor-pointer"
              >
                {t('profile:submitDubInfo', 'Submit Dub Info')}
              </button>
            )}
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="min-h-[44px] px-3.5 rounded-[10px] bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 text-[var(--accent-hover)] border border-[var(--accent-primary)]/40 text-[12px] font-semibold cursor-pointer"
              >
                {t('profile:sendFeedback', 'Send Feedback')}
              </button>
            )}
          </div>
        </div>

        {/* Row 5: Privacy & Security */}
        <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                {t('profile:privacyTitle', 'Privacy & security')}
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                {t('profile:privacySubtitle', 'Privacy Policy, Terms of Service, and DMCA / Rights-Holder takedowns')}
              </div>
            </div>
          </div>
          {onOpenLegal && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t('profile:privacy', 'Privacy')}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold cursor-pointer"
              >
                {t('profile:terms', 'Terms')}
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('dmca')}
                className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold cursor-pointer"
              >
                {t('profile:dmca', 'DMCA')}
              </button>
            </div>
          )}
        </div>

        {/* Row 6: Sign Out (Only when signed in) */}
        {user && (
          <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4 text-[#F87171]" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">Sign out</div>
                <div className="text-[12px] text-[var(--text-secondary)]">
                  Sign out of your account on this device
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] px-4 rounded-[10px] bg-red-500/15 hover:bg-red-500/25 text-[#F87171] border border-red-500/30 text-[13px] font-bold transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Eclipse Dark Anime Avatar Picker Modal */}
      {showAvatarPicker && user && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose Anime Character Avatar"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full sm:max-w-xl max-h-[85vh] rounded-t-[20px] sm:rounded-[20px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Choose Anime Avatar</h3>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Pick from {RICH_ANIME_AVATARS.length} iconic anime characters
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarPicker(false)}
                aria-label="Close avatar picker"
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2 overflow-x-auto no-scrollbar">
              {AVATAR_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAvatarCategory(cat)}
                  className={`min-h-[40px] px-3.5 rounded-[10px] text-[12px] font-semibold whitespace-nowrap border transition-colors ${
                    avatarCategory === cat
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filteredAvatars.map((avatar) => {
                const isSelected = activeAvatarUrl === avatar.url;
                return (
                  <button
                    key={avatar.name}
                    type="button"
                    onClick={() => handleSelectAvatar(avatar)}
                    className={`p-2 rounded-[12px] border text-center transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="w-14 h-14 mx-auto rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] mb-1.5">
                      <img
                        src={avatar.url}
                        alt={avatar.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                      {avatar.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export { ProfileView as Profile };
