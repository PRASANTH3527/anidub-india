import {
  CUSTOM_BG_PRESETS,
  DEFAULT_CUSTOM_CONFIG,
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_PERSISTED_THEME_STATE,
  DEFAULT_THEME_ID,
  THEME_BY_ID,
  THEME_REGISTRY,
} from './registry';
import type {
  CustomBackgroundPreset,
  CustomThemeConfig,
  PersistedThemeState,
  ThemeDefinition,
  ThemeId,
  ThemeMode,
  ThemeTokens,
} from './types';

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(THEME_BY_ID, value);
}

export function normalizeHexColor(raw: string): string | null {
  const cleaned = String(raw || '').trim();
  const withHash = cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
    return withHash.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const intVal = parseInt(normalized.slice(1), 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function computeContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = getRelativeLuminance(foregroundHex);
  const l2 = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Automatically selects the highest-contrast readable text color (#0B0A10 vs #FFFFFF)
 * on top of any custom accent color.
 */
export function getAccessibleOnPrimary(accentHex: string): '#0B0A10' | '#FFFFFF' {
  const darkContrast = computeContrastRatio('#0B0A10', accentHex);
  const whiteContrast = computeContrastRatio('#FFFFFF', accentHex);
  return darkContrast >= whiteContrast ? '#0B0A10' : '#FFFFFF';
}

export function hexToSoftRgba(hex: string, alpha = 0.15): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(180, 154, 248, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function adjustAccentHover(hex: string, mode: ThemeMode): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const delta = mode === 'dark' ? 22 : -22;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r + delta)}${toHex(rgb.g + delta)}${toHex(rgb.b + delta)}`.toUpperCase();
}

export function clampRadiusPx(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.max(6, Math.min(20, Math.round(value)));
}

export function getCustomBackgroundPreset(id: string): CustomBackgroundPreset {
  return (
    CUSTOM_BG_PRESETS.find((preset) => preset.id === id) || CUSTOM_BG_PRESETS[0]
  );
}

export function resolveEffectiveThemeId(
  state: PersistedThemeState,
  systemPrefersDark: boolean
): ThemeId {
  if (state.modePreference === 'system') {
    if (systemPrefersDark) {
      return isValidThemeId(state.lastDarkThemeId) &&
        THEME_BY_ID[state.lastDarkThemeId].mode === 'dark'
        ? state.lastDarkThemeId
        : DEFAULT_THEME_ID;
    }
    return isValidThemeId(state.lastLightThemeId) &&
      THEME_BY_ID[state.lastLightThemeId].mode === 'light'
      ? state.lastLightThemeId
      : DEFAULT_LIGHT_THEME_ID;
  }
  return isValidThemeId(state.themeId) ? state.themeId : DEFAULT_THEME_ID;
}

export function resolveThemeBundle(
  state: PersistedThemeState,
  systemPrefersDark: boolean
): {
  themeId: ThemeId;
  baseTheme: ThemeDefinition;
  mode: ThemeMode;
  tokens: ThemeTokens;
  displayName: string;
  swatches: [string, string, string];
} {
  const effectiveId = resolveEffectiveThemeId(state, systemPrefersDark);
  const baseTheme = THEME_BY_ID[effectiveId] || THEME_BY_ID[DEFAULT_THEME_ID];
  const radius = clampRadiusPx(state.custom.radiusPx);

  if (!state.custom.enabled) {
    return {
      themeId: baseTheme.id,
      baseTheme,
      mode: baseTheme.mode,
      tokens: {
        ...baseTheme.tokens,
        radiusCard: `${radius}px`,
        radiusControl: `${Math.min(radius, 14)}px`,
      },
      displayName: baseTheme.name,
      swatches: baseTheme.swatches,
    };
  }

  const bgPreset = getCustomBackgroundPreset(state.custom.bgPresetId);
  const accentHex = normalizeHexColor(state.custom.accentColor) || baseTheme.tokens.accentPrimary;
  const accentOnPrimary = getAccessibleOnPrimary(accentHex);

  return {
    themeId: baseTheme.id,
    baseTheme,
    mode: bgPreset.mode,
    tokens: {
      bgCanvas: bgPreset.bgCanvas,
      bgSurface: bgPreset.bgSurface,
      bgElevated: bgPreset.bgElevated,
      bgHover: bgPreset.bgHover,
      accentPrimary: accentHex,
      accentSoft: hexToSoftRgba(accentHex, bgPreset.mode === 'light' ? 0.12 : 0.15),
      accentHover: adjustAccentHover(accentHex, bgPreset.mode),
      accentOnPrimary,
      textPrimary: bgPreset.textPrimary,
      textSecondary: bgPreset.textSecondary,
      textMuted: bgPreset.textMuted,
      borderSubtle: bgPreset.borderSubtle,
      borderStrong: bgPreset.borderStrong,
      radiusCard: `${radius}px`,
      radiusControl: `${Math.min(radius, 14)}px`,
      shadowElevated:
        bgPreset.mode === 'light'
          ? '0 12px 30px rgba(15, 23, 42, 0.08)'
          : '0 16px 36px rgba(0, 0, 0, 0.55)',
    },
    displayName: `Custom (${bgPreset.name})`,
    swatches: [bgPreset.bgCanvas, bgPreset.bgSurface, accentHex],
  };
}

export function buildCustomCssVariableMap(
  state: PersistedThemeState,
  systemPrefersDark: boolean
): Record<string, string> {
  const resolved = resolveThemeBundle(state, systemPrefersDark);
  const vars: Record<string, string> = {
    '--radius-card': resolved.tokens.radiusCard,
    '--radius-control': resolved.tokens.radiusControl,
  };

  if (state.custom.enabled) {
    vars['--bg-canvas'] = resolved.tokens.bgCanvas;
    vars['--bg-surface'] = resolved.tokens.bgSurface;
    vars['--bg-elevated'] = resolved.tokens.bgElevated;
    vars['--bg-hover'] = resolved.tokens.bgHover;
    vars['--accent-primary'] = resolved.tokens.accentPrimary;
    vars['--accent-soft'] = resolved.tokens.accentSoft;
    vars['--accent-hover'] = resolved.tokens.accentHover;
    vars['--accent-on-primary'] = resolved.tokens.accentOnPrimary;
    vars['--text-primary'] = resolved.tokens.textPrimary;
    vars['--text-secondary'] = resolved.tokens.textSecondary;
    vars['--text-muted'] = resolved.tokens.textMuted;
    vars['--border-subtle'] = resolved.tokens.borderSubtle;
    vars['--border-strong'] = resolved.tokens.borderStrong;
    vars['--shadow-elevated'] = resolved.tokens.shadowElevated;
  }

  return vars;
}

export function sanitizePersistedThemeState(raw: unknown): PersistedThemeState {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_PERSISTED_THEME_STATE,
      custom: { ...DEFAULT_CUSTOM_CONFIG },
    };
  }
  const obj = raw as Partial<PersistedThemeState>;
  const themeId = isValidThemeId(obj.themeId) ? obj.themeId : DEFAULT_THEME_ID;
  const modePreference =
    obj.modePreference === 'light' ||
    obj.modePreference === 'dark' ||
    obj.modePreference === 'system'
      ? obj.modePreference
      : THEME_BY_ID[themeId].mode;

  const lastDarkThemeId =
    isValidThemeId(obj.lastDarkThemeId) && THEME_BY_ID[obj.lastDarkThemeId].mode === 'dark'
      ? obj.lastDarkThemeId
      : THEME_BY_ID[themeId].mode === 'dark'
        ? themeId
        : DEFAULT_THEME_ID;

  const lastLightThemeId =
    isValidThemeId(obj.lastLightThemeId) && THEME_BY_ID[obj.lastLightThemeId].mode === 'light'
      ? obj.lastLightThemeId
      : THEME_BY_ID[themeId].mode === 'light'
        ? themeId
        : DEFAULT_LIGHT_THEME_ID;

  const rawCustom = (obj.custom || {}) as Partial<CustomThemeConfig>;
  const bgPreset = getCustomBackgroundPreset(String(rawCustom.bgPresetId || 'eclipse-dark'));
  const accentColor = normalizeHexColor(String(rawCustom.accentColor || '')) || '#B49AF8';

  return {
    version: 1,
    themeId,
    modePreference,
    lastDarkThemeId,
    lastLightThemeId,
    custom: {
      enabled: Boolean(rawCustom.enabled),
      bgPresetId: bgPreset.id,
      accentColor,
      radiusPx: clampRadiusPx(Number(rawCustom.radiusPx ?? 12)),
      reduceMotion: Boolean(rawCustom.reduceMotion),
      highContrast: Boolean(rawCustom.highContrast),
    },
  };
}

export function pickRandomThemeId(currentId: ThemeId, randomFn: () => number = Math.random): ThemeId {
  const candidates = THEME_REGISTRY.filter((t) => t.id !== currentId);
  if (candidates.length === 0) return DEFAULT_THEME_ID;
  const index = Math.floor(randomFn() * candidates.length) % candidates.length;
  return candidates[Math.max(0, index)].id;
}

export function serializeThemeExport(
  state: PersistedThemeState,
  systemPrefersDark: boolean
): string {
  const bundle = resolveThemeBundle(state, systemPrefersDark);
  return JSON.stringify(
    {
      name: bundle.displayName,
      themeId: state.custom.enabled ? 'custom' : bundle.themeId,
      mode: bundle.mode,
      highContrast: state.custom.highContrast,
      reduceMotion: state.custom.reduceMotion,
      tokens: bundle.tokens,
    },
    null,
    2
  );
}

export function buildClerkAppearanceVariables(tokens: ThemeTokens, mode: ThemeMode) {
  return {
    variables: {
      colorPrimary: tokens.accentPrimary,
      colorBackground: tokens.bgSurface,
      colorInputBackground: tokens.bgElevated,
      colorInputText: tokens.textPrimary,
      colorText: tokens.textPrimary,
      colorTextSecondary: tokens.textSecondary,
      colorTextOnPrimaryBackground: tokens.accentOnPrimary,
      colorNeutral: tokens.textSecondary,
      borderRadius: tokens.radiusControl,
    },
    elements: {
      card: {
        backgroundColor: tokens.bgSurface,
        borderColor: tokens.borderSubtle,
        color: tokens.textPrimary,
      },
      headerTitle: {
        color: tokens.textPrimary,
      },
      headerSubtitle: {
        color: tokens.textSecondary,
      },
      formFieldInput: {
        backgroundColor: tokens.bgElevated,
        borderColor: tokens.borderSubtle,
        color: tokens.textPrimary,
      },
      socialButtonsBlockButton: {
        backgroundColor: mode === 'light' ? '#FFFFFF' : tokens.bgElevated,
        borderColor: tokens.borderSubtle,
        color: tokens.textPrimary,
      },
    },
  };
}
