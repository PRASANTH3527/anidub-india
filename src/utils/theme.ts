// Dynamic Anime Themes configuration & CSS Variable Engine

export interface AnimeTheme {
  id: string;
  name: string;
  character: string;
  series: string;
  colorName: string;
  previewColor: string;
  primary: string;
  gradient: string;
  glow: string;
  light: string;
  badge: string;
  border: string;
  ring: string;
}

export const ANIME_THEMES: AnimeTheme[] = [
  {
    id: 'default-red',
    name: 'Default Red (Sukuna / Itachi)',
    character: 'Sukuna & Itachi',
    series: 'Jujutsu Kaisen & Naruto',
    colorName: 'Crimson Flame',
    previewColor: '#e11d48',
    primary: '#e11d48',
    gradient: 'linear-gradient(135deg, #e11d48, #be123c)',
    glow: 'rgba(225, 29, 72, 0.4)',
    light: '#fda4af',
    badge: '#881337',
    border: 'rgba(225, 29, 72, 0.45)',
    ring: 'rgba(225, 29, 72, 0.6)',
  }
];

/**
 * Retrieve the default theme
 */
export function getSavedAnimeTheme(): AnimeTheme {
  return ANIME_THEMES[0];
}

/**
 * Placeholder for compatibility
 */
export function applyAnimeTheme(themeId: string): AnimeTheme {
  return ANIME_THEMES[0];
}

/**
 * Placeholder for compatibility
 */
export function getRecommendedThemeForAvatar(characterOrSeries: string): AnimeTheme {
  return ANIME_THEMES[0];
}
