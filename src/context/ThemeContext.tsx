import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_CUSTOM_CONFIG,
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_PERSISTED_THEME_STATE,
  DEFAULT_THEME_ID,
  THEME_BY_ID,
  THEME_REGISTRY,
  THEME_STORAGE_KEY,
} from '../themes/registry';
import type {
  CustomThemeConfig,
  PersistedThemeState,
  ThemeDefinition,
  ThemeId,
  ThemeMode,
  ThemeModePreference,
  ThemeTokens,
} from '../themes/types';
import {
  buildClerkAppearanceVariables,
  buildCustomCssVariableMap,
  clampRadiusPx,
  normalizeHexColor,
  pickRandomThemeId,
  resolveThemeBundle,
  sanitizePersistedThemeState,
  serializeThemeExport,
} from '../themes/utils';

export type AppearanceTab = 'presets' | 'studio';

const ALL_CUSTOM_CSS_KEYS = [
  '--bg-canvas',
  '--bg-surface',
  '--bg-elevated',
  '--bg-hover',
  '--accent-primary',
  '--accent-soft',
  '--accent-hover',
  '--accent-on-primary',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--border-subtle',
  '--border-strong',
  '--shadow-elevated',
  '--radius-card',
  '--radius-control',
] as const;

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readSystemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readInitialThemeState(): PersistedThemeState {
  if (typeof window === 'undefined') {
    return {
      ...DEFAULT_PERSISTED_THEME_STATE,
      custom: { ...DEFAULT_CUSTOM_CONFIG },
    };
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_PERSISTED_THEME_STATE,
        custom: {
          ...DEFAULT_CUSTOM_CONFIG,
          reduceMotion: readSystemPrefersReducedMotion(),
        },
      };
    }
    return sanitizePersistedThemeState(JSON.parse(raw));
  } catch {
    return {
      ...DEFAULT_PERSISTED_THEME_STATE,
      custom: { ...DEFAULT_CUSTOM_CONFIG },
    };
  }
}

export function applyThemeStateToDocument(
  state: PersistedThemeState,
  systemPrefersDark: boolean
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const bundle = resolveThemeBundle(state, systemPrefersDark);

  root.setAttribute('data-theme', bundle.themeId);
  root.setAttribute('data-theme-mode', bundle.mode);
  root.classList.toggle('dark', bundle.mode === 'dark');

  if (state.custom.highContrast) {
    root.setAttribute('data-high-contrast', 'true');
  } else {
    root.removeAttribute('data-high-contrast');
  }

  if (state.custom.reduceMotion) {
    root.setAttribute('data-reduced-motion', 'true');
  } else {
    root.removeAttribute('data-reduced-motion');
  }

  const customVars = buildCustomCssVariableMap(state, systemPrefersDark);
  for (const key of ALL_CUSTOM_CSS_KEYS) {
    const value = customVars[key];
    if (value !== undefined) {
      root.style.setProperty(key, value);
    } else {
      root.style.removeProperty(key);
    }
  }

  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', bundle.tokens.bgCanvas);
  }
}

export interface ThemeContextValue {
  state: PersistedThemeState;
  themes: readonly ThemeDefinition[];
  activeThemeId: ThemeId;
  activeTheme: ThemeDefinition;
  resolvedMode: ThemeMode;
  resolvedTokens: ThemeTokens;
  displayName: string;
  activeSwatches: [string, string, string];
  modePreference: ThemeModePreference;
  customConfig: CustomThemeConfig;
  clerkAppearance: ReturnType<typeof buildClerkAppearanceVariables>;
  isAppearanceOpen: boolean;
  appearanceTab: AppearanceTab;
  openAppearance: (tab?: AppearanceTab) => void;
  closeAppearance: () => void;
  setAppearanceTab: (tab: AppearanceTab) => void;
  setTheme: (id: ThemeId) => void;
  setModePreference: (pref: ThemeModePreference) => void;
  pickRandomTheme: () => ThemeId;
  updateCustomConfig: (patch: Partial<CustomThemeConfig>) => void;
  setHighContrast: (enabled: boolean) => void;
  setReduceMotion: (enabled: boolean) => void;
  resetToDefault: () => void;
  exportThemeJson: () => string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedThemeState>(readInitialThemeState);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(readSystemPrefersDark);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [appearanceTab, setAppearanceTab] = useState<AppearanceTab>('presets');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    setSystemPrefersDark(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsoLayoutEffect(() => {
    applyThemeStateToDocument(state, systemPrefersDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota or private mode failures
    }
  }, [state, systemPrefersDark]);

  const bundle = useMemo(
    () => resolveThemeBundle(state, systemPrefersDark),
    [state, systemPrefersDark]
  );

  const clerkAppearance = useMemo(
    () => buildClerkAppearanceVariables(bundle.tokens, bundle.mode),
    [bundle.tokens, bundle.mode]
  );

  const openAppearance = useCallback((tab: AppearanceTab = 'presets') => {
    setAppearanceTab(tab);
    setIsAppearanceOpen(true);
  }, []);

  const closeAppearance = useCallback(() => {
    setIsAppearanceOpen(false);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    const def = THEME_BY_ID[id];
    if (!def) return;
    setState((prev) => ({
      ...prev,
      themeId: id,
      modePreference: def.mode,
      lastDarkThemeId: def.mode === 'dark' ? id : prev.lastDarkThemeId,
      lastLightThemeId: def.mode === 'light' ? id : prev.lastLightThemeId,
      custom: {
        ...prev.custom,
        enabled: false,
      },
    }));
  }, []);

  const setModePreference = useCallback((pref: ThemeModePreference) => {
    setState((prev) => {
      if (pref === 'system') {
        return {
          ...prev,
          modePreference: 'system',
          custom: { ...prev.custom, enabled: false },
        };
      }
      if (pref === 'light') {
        const nextLight =
          THEME_BY_ID[prev.lastLightThemeId]?.mode === 'light'
            ? prev.lastLightThemeId
            : DEFAULT_LIGHT_THEME_ID;
        return {
          ...prev,
          themeId: nextLight,
          modePreference: 'light',
          lastLightThemeId: nextLight,
          custom: { ...prev.custom, enabled: false },
        };
      }
      const nextDark =
        THEME_BY_ID[prev.lastDarkThemeId]?.mode === 'dark'
          ? prev.lastDarkThemeId
          : DEFAULT_THEME_ID;
      return {
        ...prev,
        themeId: nextDark,
        modePreference: 'dark',
        lastDarkThemeId: nextDark,
        custom: { ...prev.custom, enabled: false },
      };
    });
  }, []);

  const pickRandomTheme = useCallback((): ThemeId => {
    let chosen: ThemeId = DEFAULT_THEME_ID;
    setState((prev) => {
      chosen = pickRandomThemeId(prev.themeId);
      const def = THEME_BY_ID[chosen];
      return {
        ...prev,
        themeId: chosen,
        modePreference: def.mode,
        lastDarkThemeId: def.mode === 'dark' ? chosen : prev.lastDarkThemeId,
        lastLightThemeId: def.mode === 'light' ? chosen : prev.lastLightThemeId,
        custom: {
          ...prev.custom,
          enabled: false,
        },
      };
    });
    return chosen;
  }, []);

  const updateCustomConfig = useCallback((patch: Partial<CustomThemeConfig>) => {
    setState((prev) => {
      const nextAccent =
        patch.accentColor !== undefined
          ? normalizeHexColor(patch.accentColor) || prev.custom.accentColor
          : prev.custom.accentColor;
      const nextRadius =
        patch.radiusPx !== undefined
          ? clampRadiusPx(patch.radiusPx)
          : prev.custom.radiusPx;
      return {
        ...prev,
        custom: {
          ...prev.custom,
          ...patch,
          accentColor: nextAccent,
          radiusPx: nextRadius,
        },
      };
    });
  }, []);

  const setHighContrast = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      custom: { ...prev.custom, highContrast: enabled },
    }));
  }, []);

  const setReduceMotion = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      custom: { ...prev.custom, reduceMotion: enabled },
    }));
  }, []);

  const resetToDefault = useCallback(() => {
    setState({
      ...DEFAULT_PERSISTED_THEME_STATE,
      custom: { ...DEFAULT_CUSTOM_CONFIG },
    });
  }, []);

  const exportThemeJson = useCallback(
    () => serializeThemeExport(state, systemPrefersDark),
    [state, systemPrefersDark]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      state,
      themes: THEME_REGISTRY,
      activeThemeId: bundle.themeId,
      activeTheme: bundle.baseTheme,
      resolvedMode: bundle.mode,
      resolvedTokens: bundle.tokens,
      displayName: bundle.displayName,
      activeSwatches: bundle.swatches,
      modePreference: state.modePreference,
      customConfig: state.custom,
      clerkAppearance,
      isAppearanceOpen,
      appearanceTab,
      openAppearance,
      closeAppearance,
      setAppearanceTab,
      setTheme,
      setModePreference,
      pickRandomTheme,
      updateCustomConfig,
      setHighContrast,
      setReduceMotion,
      resetToDefault,
      exportThemeJson,
    }),
    [
      state,
      bundle,
      clerkAppearance,
      isAppearanceOpen,
      appearanceTab,
      openAppearance,
      closeAppearance,
      setTheme,
      setModePreference,
      pickRandomTheme,
      updateCustomConfig,
      setHighContrast,
      setReduceMotion,
      resetToDefault,
      exportThemeJson,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
