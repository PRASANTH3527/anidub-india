'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  AnimeTheme, 
  ANIME_THEMES 
} from '../utils/theme';
import { ANIME_AVATARS_50, AnimeAvatarPreset } from '../data/animeAvatars50';
import { DubLanguage } from '../types/anime';

export interface LocalUserProfile {
  nickname: string;
  avatar: string;
  favoriteLanguage: DubLanguage | 'All';
}

interface ThemeContextType {
  theme: AnimeTheme;
  themeId: string;
  avatar: string;
  nickname: string;
  userProfile: LocalUserProfile;
  setTheme: (themeId: string) => void;
  setAvatar: (avatarUrl: string) => void;
  setNickname: (nickname: string) => void;
  updateUserProfile: (updates: Partial<LocalUserProfile>) => void;
  availableThemes: AnimeTheme[];
  avatarPresets: AnimeAvatarPreset[];
}

const DEFAULT_AVATAR = ANIME_AVATARS_50[0]?.url || 'https://media.kitsu.app/characters/images/221/original.jpg';
const DEFAULT_NICKNAME = 'Anime Fan';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always use default theme
  const [theme] = useState<AnimeTheme>(ANIME_THEMES[0]);
  const [themeId] = useState<string>(ANIME_THEMES[0].id);

  const [avatar, setAvatarState] = useState<string>(DEFAULT_AVATAR);
  const [nickname, setNicknameState] = useState<string>(DEFAULT_NICKNAME);
  const [favoriteLanguage, setFavoriteLanguage] = useState<DubLanguage | 'All'>('Tamil');

  // Initialize from localStorage on client mount
  useEffect(() => {
    try {
      // Load Profile
      const rawProfile = localStorage.getItem('anidub_local_user_profile');
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile);
        if (parsed.avatar) setAvatarState(parsed.avatar);
        if (parsed.nickname) setNicknameState(parsed.nickname);
        if (parsed.favoriteLanguage) setFavoriteLanguage(parsed.favoriteLanguage);
      } else {
        const legacyAvatar = localStorage.getItem('anidub_user_avatar');
        if (legacyAvatar) setAvatarState(legacyAvatar);
      }
    } catch (e) {
      console.warn('[ThemeContext] Storage init warning:', e);
    }
  }, []);

  // Theme Handler (Placeholder)
  const setTheme = useCallback(() => {}, []);

  // Set Avatar Handler
  const setAvatar = useCallback((avatarUrl: string) => {
    setAvatarState(avatarUrl);
    try {
      localStorage.setItem('anidub_user_avatar', avatarUrl);
      const raw = localStorage.getItem('anidub_local_user_profile');
      const existing = raw ? JSON.parse(raw) : {};
      
      localStorage.setItem(
        'anidub_local_user_profile',
        JSON.stringify({
          ...existing,
          avatar: avatarUrl,
        })
      );
    } catch {}
  }, []);

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

    try {
      const raw = localStorage.getItem('anidub_local_user_profile');
      const existing = raw ? JSON.parse(raw) : {};
      const merged = {
        ...existing,
        ...updates,
      };
      localStorage.setItem('anidub_local_user_profile', JSON.stringify(merged));
      if (updates.avatar) localStorage.setItem('anidub_user_avatar', updates.avatar);
    } catch {}
  }, []);

  const userProfile: LocalUserProfile = {
    nickname,
    avatar,
    favoriteLanguage,
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
