'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  AnimeTheme, 
  ANIME_THEMES, 
  applyAnimeTheme, 
  getSavedAnimeTheme,
  getRecommendedThemeForAvatar 
} from '../utils/theme';
import { ANIME_AVATARS_50, AnimeAvatarPreset } from '../data/animeAvatars50';

export interface LocalUserProfile {
  nickname: string;
  avatar: string;
  favoriteLanguage?: string;
  theme?: string;
}

interface ThemeContextType {
  theme: AnimeTheme;
  themeId: string;
  avatar: string;
  nickname: string;
  userProfile: LocalUserProfile;
  setTheme: (themeId: string) => void;
  setAvatar: (avatarUrl: string, autoMatchTheme?: boolean) => void;
  setNickname: (nickname: string) => void;
  updateUserProfile: (updates: Partial<LocalUserProfile>) => void;
  availableThemes: AnimeTheme[];
  avatarPresets: AnimeAvatarPreset[];
}

const DEFAULT_AVATAR = ANIME_AVATARS_50[0]?.url || 'https://media.kitsu.app/characters/images/221/original.jpg';
const DEFAULT_NICKNAME = 'Anime Fan';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AnimeTheme>(() => {
    return getSavedAnimeTheme();
  });
  const [themeId, setThemeIdState] = useState<string>(() => {
    return getSavedAnimeTheme().id;
  });

  const [avatar, setAvatarState] = useState<string>(DEFAULT_AVATAR);
  const [nickname, setNicknameState] = useState<string>(DEFAULT_NICKNAME);
  const [favoriteLanguage, setFavoriteLanguage] = useState<string>('Tamil');

  // Initialize from localStorage on client mount
  useEffect(() => {
    try {
      const savedTheme = getSavedAnimeTheme();
      setThemeState(savedTheme);
      setThemeIdState(savedTheme.id);
      applyAnimeTheme(savedTheme.id);

      // Load Profile
      const rawProfile = localStorage.getItem('anidub_local_user_profile');
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile);
        if (parsed.avatar) setAvatarState(parsed.avatar);
        if (parsed.nickname) setNicknameState(parsed.nickname);
        if (parsed.favoriteLanguage) setFavoriteLanguage(parsed.favoriteLanguage);
        if (parsed.theme) {
          const matched = ANIME_THEMES.find((t) => t.id === parsed.theme);
          if (matched) {
            setThemeState(matched);
            setThemeIdState(matched.id);
            applyAnimeTheme(matched.id);
          }
        }
      } else {
        const legacyAvatar = localStorage.getItem('anidub_user_avatar');
        if (legacyAvatar) setAvatarState(legacyAvatar);
      }
    } catch (e) {
      console.warn('[ThemeContext] Storage init warning:', e);
    }
  }, []);

  // Set Theme Handler
  const setTheme = useCallback((newThemeId: string) => {
    const updatedTheme = applyAnimeTheme(newThemeId);
    setThemeState(updatedTheme);
    setThemeIdState(updatedTheme.id);

    try {
      localStorage.setItem('anidub_accent_theme', updatedTheme.id);
      const raw = localStorage.getItem('anidub_local_user_profile');
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        'anidub_local_user_profile',
        JSON.stringify({ ...existing, theme: updatedTheme.id })
      );
    } catch {}
  }, []);

  // Set Avatar Handler (optionally auto matching character accent theme)
  const setAvatar = useCallback((avatarUrl: string, autoMatchTheme: boolean = false) => {
    setAvatarState(avatarUrl);
    try {
      localStorage.setItem('anidub_user_avatar', avatarUrl);
      const raw = localStorage.getItem('anidub_local_user_profile');
      const existing = raw ? JSON.parse(raw) : {};
      
      let nextThemeId = existing.theme || themeId;
      if (autoMatchTheme) {
        const preset = ANIME_AVATARS_50.find((a) => a.url === avatarUrl);
        if (preset) {
          const recTheme = getRecommendedThemeForAvatar(`${preset.character} ${preset.series}`);
          nextThemeId = recTheme.id;
          applyAnimeTheme(recTheme.id);
          setThemeState(recTheme);
          setThemeIdState(recTheme.id);
        }
      }

      localStorage.setItem(
        'anidub_local_user_profile',
        JSON.stringify({
          ...existing,
          avatar: avatarUrl,
          theme: nextThemeId,
        })
      );
    } catch {}
  }, [themeId]);

  // Set Nickname Handler
  const setNickname = useCallback((newNick: string) => {
    const clean = newNick.trim() || DEFAULT_NICKNAME;
    setNicknameState(clean);
    try {
      const raw = localStorage.getItem('anidub_local_user_profile');
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        'anidub_local_user_profile',
        JSON.stringify({ ...existing, nickname: clean })
      );
    } catch {}
  }, []);

  // Update Full Profile Handler
  const updateUserProfile = useCallback((updates: Partial<LocalUserProfile>) => {
    if (updates.nickname !== undefined) setNicknameState(updates.nickname);
    if (updates.avatar !== undefined) setAvatarState(updates.avatar);
    if (updates.favoriteLanguage !== undefined) setFavoriteLanguage(updates.favoriteLanguage);
    if (updates.theme !== undefined) {
      const matched = ANIME_THEMES.find((t) => t.id === updates.theme) || ANIME_THEMES[0];
      setThemeState(matched);
      setThemeIdState(matched.id);
      applyAnimeTheme(matched.id);
    }

    try {
      const raw = localStorage.getItem('anidub_local_user_profile');
      const existing = raw ? JSON.parse(raw) : {};
      const merged = {
        ...existing,
        ...updates,
      };
      localStorage.setItem('anidub_local_user_profile', JSON.stringify(merged));
      if (updates.avatar) localStorage.setItem('anidub_user_avatar', updates.avatar);
      if (updates.theme) localStorage.setItem('anidub_accent_theme', updates.theme);
    } catch {}
  }, []);

  const userProfile: LocalUserProfile = {
    nickname,
    avatar,
    favoriteLanguage,
    theme: themeId,
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeId,
        avatar,
        nickname,
        userProfile,
        setTheme,
        setAvatar,
        setNickname,
        updateUserProfile,
        availableThemes: ANIME_THEMES,
        avatarPresets: ANIME_AVATARS_50,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
