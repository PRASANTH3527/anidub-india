export type ThemeId =
  | 'eclipse'
  | 'arctic-white'
  | 'amoled-black'
  | 'shadow-monarch'
  | 'crimson-flame'
  | 'infinity-void'
  | 'ocean-king'
  | 'black-grimoire'
  | 'shinobi-ember'
  | 'sakura-bloom'
  | 'emerald-spirit'
  | 'cyber-tokyo';

export type ThemeMode = 'dark' | 'light';

export type ThemeModePreference = 'dark' | 'light' | 'system';

export type ThemeCategory = 'Core & Minimal' | 'Anime-Inspired';

export type CustomBackgroundPresetId =
  | 'eclipse-dark'
  | 'true-black'
  | 'midnight-blue'
  | 'deep-violet'
  | 'deep-forest'
  | 'warm-espresso'
  | 'clean-light';

export interface ThemeTokens {
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  bgHover: string;
  accentPrimary: string;
  accentSoft: string;
  accentHover: string;
  accentOnPrimary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  borderStrong: string;
  radiusCard: string;
  radiusControl: string;
  shadowElevated: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  category: ThemeCategory;
  subtitle: string;
  mode: ThemeMode;
  swatches: [string, string, string];
  tokens: ThemeTokens;
}

export interface CustomBackgroundPreset {
  id: CustomBackgroundPresetId;
  name: string;
  mode: ThemeMode;
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  borderStrong: string;
}

export interface CustomAccentSwatch {
  id: string;
  name: string;
  hex: string;
}

export interface CustomThemeConfig {
  enabled: boolean;
  bgPresetId: CustomBackgroundPresetId;
  accentColor: string;
  radiusPx: number;
  reduceMotion: boolean;
  highContrast: boolean;
}

export interface PersistedThemeState {
  version: 1;
  themeId: ThemeId;
  modePreference: ThemeModePreference;
  lastDarkThemeId: ThemeId;
  lastLightThemeId: ThemeId;
  custom: CustomThemeConfig;
}
