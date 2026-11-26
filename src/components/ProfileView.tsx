import React, { useState, useEffect } from 'react';
import {
  User, Bookmark, CheckCircle, Play, LogOut, Shield, Sparkles, Lock,
  MessageSquare, FileText, Globe, Bell, Cloud, ChevronRight, Check
} from 'lucide-react';
import {
  Anime,
  WatchlistItem,
  normalizeAnimeList,
  normalizeWatchlistProp,
} from '../types';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import { useUser, useClerk } from '../lib/clerk';
import { ProfilePageSkeleton } from './ui/EclipseState';

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

export const ProfileView: React.FC<ProfileViewProps> = ({
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
}) => {
  const { isSignedIn, user: clerkUser } = useUser();
  const { signOut: clerkSignOut, openSignIn: clerkOpenSignIn } = useClerk();

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
    <section className="max-w-[960px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[#F4F3FA] space-y-6">
      <div>
        <h1 className="text-[24px] sm:text-[30px] font-bold text-[#F4F3FA] leading-[1.2] tracking-[-0.02em]">
          Profile &amp; Settings
        </h1>
        <p className="text-[13px] text-[#A1A5B5] mt-0.5">
          Manage your regional dub preferences, cloud sync, and account
        </p>
      </div>

      {/* 1. User Account Card (Signed-In vs Guest) */}
      {user ? (
        <div
          data-testid="profile-signed-in-card"
          className="rounded-[16px] bg-[#12141E] border border-[#292B39] p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-[#292B39]"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[22px] font-bold text-[#B49AF8]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">{user.name}</h2>
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#B49AF8]/15 text-[#CBB6FF] border border-[#B49AF8]/30 text-[11px] font-bold">
                    {isAdminVerified ? 'Admin' : 'Verified Member'}
                  </span>
                </div>
                <p className="text-[13px] text-[#A1A5B5]">{user.email}</p>
              </div>
            </div>

            {isAdminVerified && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="min-h-[44px] px-4 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] font-bold text-[13px] inline-flex items-center gap-2 transition-colors duration-180"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </button>
            )}
          </div>

          {/* Compact 3-Column Stats (Saved, Completed, Episodes) */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#292B39]">
            <div className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[#B49AF8] text-[11px] font-bold uppercase tracking-wider mb-1">
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved</span>
              </div>
              <div className="text-[20px] font-bold text-[#F4F3FA]">{savedCount}</div>
            </div>

            <div className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[#34D399] text-[11px] font-bold uppercase tracking-wider mb-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Completed</span>
              </div>
              <div className="text-[20px] font-bold text-[#F4F3FA]">{completedCount}</div>
            </div>

            <div className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[#F9C876] text-[11px] font-bold uppercase tracking-wider mb-1">
                <Play className="w-3.5 h-3.5" />
                <span>Episodes</span>
              </div>
              <div className="text-[20px] font-bold text-[#F4F3FA]">{episodesWatchedTotal}</div>
            </div>
          </div>

          {/* Refined #B49AF8 Anime DNA Bars */}
          {animeDnaBars.length > 0 && (
            <div className="pt-3 border-t border-[#292B39] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#A1A5B5]">
                  Your Anime DNA
                </span>
                <span className="text-[11px] text-[#CBB6FF]">Top Genres</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {animeDnaBars.map((bar) => (
                  <div key={bar.genre} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-[#F4F3FA]">{bar.genre}</span>
                      <span className="text-[#A1A5B5]">{bar.count} titles</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#191C29] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#B49AF8]"
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
          className="rounded-[16px] bg-[#12141E] border border-[#292B39] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
        >
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#191C29] border border-[#292B39] flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-[#B49AF8]" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#F4F3FA] mb-1">
                Sign in to AniDub India
              </h2>
              <p className="text-[13px] sm:text-[14px] text-[#A1A5B5] max-w-md leading-relaxed">
                Sync your regional dub watchlist across devices, track per-season episode progress, and post verified reviews.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] px-5 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] font-bold text-[14px] inline-flex items-center justify-center gap-2 shrink-0 transition-colors duration-180"
          >
            <Sparkles className="w-4 h-4" />
            <span>Sign In / Create Account</span>
          </button>
        </div>
      )}

      {/* 2. Unified Grouped Settings List (44px+ touch rows) */}
      <div
        data-testid="profile-settings-support"
        className="rounded-[16px] bg-[#12141E] border border-[#292B39] divide-y divide-[#292B39] overflow-hidden"
      >
        {/* Row 1: Preferred Language */}
        <div className="p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setShowLangPicker((prev) => !prev)}
            aria-expanded={showLangPicker}
            className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-[#B49AF8]" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#F4F3FA]">Preferred language</div>
                <div className="text-[12px] text-[#A1A5B5]">
                  Prioritize {preferredLang} dubs in discovery and notifications
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-[8px] bg-[#191C29] border border-[#292B39] text-[12px] font-bold text-[#CBB6FF]">
                {preferredLang}
              </span>
              <ChevronRight className="w-4 h-4 text-[#A1A5B5]" />
            </div>
          </button>

          {showLangPicker && (
            <div className="mt-3 pt-3 border-t border-[#292B39] grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REGIONAL_LANGUAGES.map((lang) => {
                const isSelected = preferredLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleSelectLanguage(lang)}
                    className={`min-h-[44px] px-3 rounded-[10px] text-[13px] font-semibold border flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#B49AF8] text-[#0B0A10] border-[#B49AF8]'
                        : 'bg-[#191C29] text-[#F4F3FA] border-[#292B39] hover:border-[#B49AF8]/40'
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
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-[#B49AF8]" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#F4F3FA]">
                Notifications &amp; Notification Preferences
              </div>
              <div className="text-[12px] text-[#A1A5B5]">
                Weekly Simulcast Drops &amp; Notification Sound Chime for followed regional dubs
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={handleToggleNotifications}
            className={`min-h-[44px] px-4 rounded-[10px] text-[12px] font-bold border transition-colors ${
              notificationsEnabled
                ? 'bg-[#B49AF8]/15 text-[#CBB6FF] border-[#B49AF8]/40'
                : 'bg-[#191C29] text-[#A1A5B5] border-[#292B39]'
            }`}
          >
            {notificationsEnabled ? 'Enabled' : 'Muted'}
          </button>
        </div>

        {/* Row 3: Sync & Backup */}
        <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-[#B49AF8]" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#F4F3FA]">Sync &amp; backup</div>
              <div className="text-[12px] text-[#A1A5B5]">
                {user ? 'Cloud sync active via Cloudflare D1' : 'Local browser storage (Sign in to enable cloud backup)'}
              </div>
            </div>
          </div>
          {user ? (
            <span className="px-2.5 py-1 rounded-[8px] bg-emerald-500/10 text-[#34D399] border border-emerald-500/30 text-[12px] font-semibold">
              Synced
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[44px] px-3.5 rounded-[10px] bg-[#191C29] hover:bg-[#292B39] text-[#CBB6FF] border border-[#292B39] text-[12px] font-semibold"
            >
              Enable Sync
            </button>
          )}
        </div>

        {/* Row 4: Help & Feedback (Single Dedicated Home) */}
        <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-[#B49AF8]" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#F4F3FA]">Help &amp; feedback</div>
              <div className="text-[12px] text-[#A1A5B5]">
                Report a bug, suggest a feature, or submit verified regional dub info
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenSubmitDub && (
              <button
                type="button"
                onClick={onOpenSubmitDub}
                className="min-h-[44px] px-3.5 rounded-[10px] bg-[#191C29] hover:bg-[#292B39] text-[#F4F3FA] border border-[#292B39] text-[12px] font-semibold"
              >
                Submit Dub Info
              </button>
            )}
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="min-h-[44px] px-3.5 rounded-[10px] bg-[#B49AF8]/15 hover:bg-[#B49AF8]/25 text-[#CBB6FF] border border-[#B49AF8]/40 text-[12px] font-semibold"
              >
                Send Feedback
              </button>
            )}
          </div>
        </div>

        {/* Row 5: Privacy & Security */}
        <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#191C29] border border-[#292B39] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-[#B49AF8]" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#F4F3FA]">Privacy &amp; security</div>
              <div className="text-[12px] text-[#A1A5B5]">
                Privacy Policy, Terms of Service, and DMCA / Rights-Holder takedowns
              </div>
            </div>
          </div>
          {onOpenLegal && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#191C29] hover:bg-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] border border-[#292B39] text-[12px] font-semibold inline-flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Privacy</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#191C29] hover:bg-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] border border-[#292B39] text-[12px] font-semibold"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('dmca')}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#191C29] hover:bg-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] border border-[#292B39] text-[12px] font-semibold"
              >
                DMCA
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
                <div className="text-[14px] font-semibold text-[#F4F3FA]">Sign out</div>
                <div className="text-[12px] text-[#A1A5B5]">
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
    </section>
  );
};
