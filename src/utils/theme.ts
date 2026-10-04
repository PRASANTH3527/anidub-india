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
  },
  {
    id: 'zenitsu-yellow',
    name: 'Zenitsu Yellow (Thunder)',
    character: 'Zenitsu Agatsuma',
    series: 'Demon Slayer',
    colorName: 'Thunderbolt Amber',
    previewColor: '#eab308',
    primary: '#eab308',
    gradient: 'linear-gradient(135deg, #eab308, #d97706)',
    glow: 'rgba(234, 179, 8, 0.45)',
    light: '#fef08a',
    badge: '#713f12',
    border: 'rgba(234, 179, 8, 0.45)',
    ring: 'rgba(234, 179, 8, 0.65)',
  },
  {
    id: 'naruto-orange',
    name: 'Naruto Orange (Kurama)',
    character: 'Naruto Uzumaki',
    series: 'Naruto Shippuden',
    colorName: 'Sage Mode Orange',
    previewColor: '#f97316',
    primary: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316, #c2410c)',
    glow: 'rgba(249, 115, 22, 0.45)',
    light: '#fed7aa',
    badge: '#7c2d12',
    border: 'rgba(249, 115, 22, 0.45)',
    ring: 'rgba(249, 115, 22, 0.65)',
  },
  {
    id: 'gojo-blue',
    name: 'Gojo Blue (Limitless)',
    character: 'Satoru Gojo',
    series: 'Jujutsu Kaisen',
    colorName: 'Six Eyes Cyan',
    previewColor: '#06b6d4',
    primary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)',
    glow: 'rgba(6, 182, 212, 0.45)',
    light: '#a5f3fc',
    badge: '#164e63',
    border: 'rgba(6, 182, 212, 0.45)',
    ring: 'rgba(6, 182, 212, 0.65)',
  },
  {
    id: 'zoro-green',
    name: 'Zoro Green (Santoryu)',
    character: 'Roronoa Zoro',
    series: 'One Piece',
    colorName: 'Demon Ashura Emerald',
    previewColor: '#10b981',
    primary: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #047857)',
    glow: 'rgba(16, 185, 129, 0.45)',
    light: '#a7f3d0',
    badge: '#064e3b',
    border: 'rgba(16, 185, 129, 0.45)',
    ring: 'rgba(16, 185, 129, 0.65)',
  },
  {
    id: 'default-purple',
    name: 'Lelouch Violet (Geass)',
    character: 'Lelouch Lamperouge',
    series: 'Code Geass',
    colorName: 'Imperial Violet',
    previewColor: '#9333ea',
    primary: '#9333ea',
    gradient: 'linear-gradient(135deg, #9333ea, #6366f1)',
    glow: 'rgba(147, 51, 234, 0.45)',
    light: '#d8b4fe',
    badge: '#581c87',
    border: 'rgba(147, 51, 234, 0.45)',
    ring: 'rgba(147, 51, 234, 0.65)',
  },
];

/**
 * Converts a hex string into an RGB triplet (e.g., "225, 29, 72")
 */
export function hexToRgb(hex: string): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return '225, 29, 72';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

/**
 * Determine recommended theme based on avatar name/character
 */
export function getRecommendedThemeForAvatar(characterOrSeries: string): AnimeTheme {
  const lower = characterOrSeries.toLowerCase();
  if (lower.includes('zenitsu') || lower.includes('thunder')) {
    return ANIME_THEMES.find((t) => t.id === 'zenitsu-yellow') || ANIME_THEMES[1];
  }
  if (lower.includes('naruto') || lower.includes('kurama') || lower.includes('shippuden')) {
    return ANIME_THEMES.find((t) => t.id === 'naruto-orange') || ANIME_THEMES[2];
  }
  if (lower.includes('gojo') || lower.includes('limitless') || lower.includes('megumi')) {
    return ANIME_THEMES.find((t) => t.id === 'gojo-blue') || ANIME_THEMES[3];
  }
  if (lower.includes('zoro') || lower.includes('one piece') || lower.includes('luffy')) {
    return ANIME_THEMES.find((t) => t.id === 'zoro-green') || ANIME_THEMES[4];
  }
  if (lower.includes('lelouch') || lower.includes('geass') || lower.includes('violet')) {
    return ANIME_THEMES.find((t) => t.id === 'default-purple') || ANIME_THEMES[5];
  }
  return ANIME_THEMES[0];
}

/**
 * Apply the selected theme across document styles and persist to localStorage
 */
export function applyAnimeTheme(themeId: string): AnimeTheme {
  const theme = ANIME_THEMES.find((t) => t.id === themeId) || ANIME_THEMES[0];

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const rgb = hexToRgb(theme.primary);
    
    // Core CSS custom variables
    root.style.setProperty('--primary-accent', theme.primary);
    root.style.setProperty('--primary-glow', theme.glow);
    root.style.setProperty('--primary-gradient', theme.gradient);
    root.style.setProperty('--primary-light', theme.light);
    root.style.setProperty('--primary-badge', theme.badge);
    root.style.setProperty('--primary-border', theme.border);
    root.style.setProperty('--primary-ring', theme.ring);
    root.style.setProperty('--primary-accent-rgb', rgb);

    // Dynamic Tailwind purple overrides so all components instantly adopt the chosen accent color
    root.style.setProperty('--color-purple-600', theme.primary);
    root.style.setProperty('--color-purple-500', theme.primary);
    root.style.setProperty('--color-purple-400', theme.light);
    root.style.setProperty('--color-purple-300', theme.light);
    root.style.setProperty('--color-purple-700', theme.badge);
    root.style.setProperty('--color-purple-800', theme.badge);
    root.style.setProperty('--color-purple-900', theme.badge);
    root.style.setProperty('--color-purple-950', `${theme.badge}bb`);

    root.setAttribute('data-anime-theme', theme.id);
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('anidub_accent_theme', theme.id);
    } catch {}
  }

  return theme;
}

/**
 * Retrieve the saved theme from localStorage
 */
export function getSavedAnimeTheme(): AnimeTheme {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('anidub_accent_theme');
      if (saved) {
        const found = ANIME_THEMES.find((t) => t.id === saved);
        if (found) return found;
      }
    } catch {}
  }
  return ANIME_THEMES[0];
}
