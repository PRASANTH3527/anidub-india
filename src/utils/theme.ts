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
    id: 'default-purple',
    name: 'Sleek Purple (Default)',
    character: 'Lelouch Lamperouge',
    series: 'Code Geass',
    colorName: 'Royal Violet',
    previewColor: '#9333ea',
    primary: '#9333ea',
    gradient: 'linear-gradient(135deg, #9333ea, #4f46e5)',
    glow: 'rgba(147, 51, 234, 0.5)',
    light: '#c084fc',
    badge: '#581c87',
    border: 'rgba(147, 51, 234, 0.4)',
    ring: 'rgba(147, 51, 234, 0.6)',
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
