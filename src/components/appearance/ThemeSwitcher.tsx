import React, { useEffect, useRef } from 'react';
import {
  Check,
  Contrast,
  Monitor,
  Moon,
  Palette,
  Shuffle,
  Sliders,
  Sparkles,
  Sun,
  X,
  ZapOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../Toast';
import { CustomThemeStudio } from './CustomThemeStudio';
import type { ThemeModePreference } from '../../themes/types';

export const ThemeSwitcher: React.FC = () => {
  const {
    themes,
    activeThemeId,
    displayName,
    modePreference,
    customConfig,
    isAppearanceOpen,
    appearanceTab,
    closeAppearance,
    setAppearanceTab,
    setTheme,
    setModePreference,
    pickRandomTheme,
    setHighContrast,
    setReduceMotion,
  } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation(['profile', 'common']);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isAppearanceOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAppearance();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isAppearanceOpen, closeAppearance]);

  if (!isAppearanceOpen) return null;

  const coreThemes = themes.filter((t) => t.category === 'Core & Minimal');
  const animeThemes = themes.filter((t) => t.category === 'Anime-Inspired');

  const modeOptions: { id: ThemeModePreference; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: t('profile:themeStudio.light', 'Light'), icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'dark', label: t('profile:themeStudio.dark', 'Dark'), icon: <Moon className="w-3.5 h-3.5" /> },
    { id: 'system', label: t('profile:themeStudio.system', 'System'), icon: <Monitor className="w-3.5 h-3.5" /> },
  ];

  const handleShuffle = () => {
    const nextId = pickRandomTheme();
    const matched = themes.find((t) => t.id === nextId);
    if (matched) {
      showToast('Theme Applied', `Switched to ${matched.name}`, 'info');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Appearance and Themes"
      data-testid="appearance-switcher-dialog"
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeAppearance}
        className="fixed inset-0 backdrop-blur-xs transition-opacity duration-180"
        style={{ backgroundColor: 'var(--backdrop-scrim)' }}
      />

      {/* Bottom Sheet (Mobile) / Centered Modal (Desktop) */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full sm:max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-2xl bg-[var(--bg-surface)] border-t sm:border border-[var(--border-subtle)] flex flex-col overflow-hidden outline-none"
        style={{
          boxShadow: 'var(--shadow-elevated)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border-strong)]" />
        </div>

        {/* Sticky Sheet Header */}
        <div className="px-4 sm:px-6 pt-3 pb-3.5 border-b border-[var(--border-subtle)] shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-[var(--radius-control)] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                <Palette className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] leading-tight truncate">
                  {t('profile:themeStudio.title', 'Appearance')}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {t('profile:themeStudio.activePrefix', {
                    name: displayName,
                    defaultValue: `Active: ${displayName}`,
                  })}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeAppearance}
              aria-label={t('common:close', 'Close')}
              data-testid="appearance-close-btn"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors duration-180 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Two-Tab Switcher: Presets (12) | Custom Studio */}
          <div
            role="tablist"
            aria-label={t('profile:themeStudio.title', 'Appearance')}
            className="grid grid-cols-2 gap-1.5 p-1 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={appearanceTab === 'presets'}
              onClick={() => setAppearanceTab('presets')}
              data-testid="appearance-tab-presets"
              className={`h-10 min-h-[44px] sm:min-h-[40px] px-2 rounded-[10px] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-180 cursor-pointer min-w-0 ${
                appearanceTab === 'presets'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('profile:themeStudio.presetsTab', 'Presets (12)')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={appearanceTab === 'studio'}
              onClick={() => setAppearanceTab('studio')}
              data-testid="appearance-tab-studio"
              className={`h-10 min-h-[44px] sm:min-h-[40px] px-2 rounded-[10px] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-180 cursor-pointer min-w-0 ${
                appearanceTab === 'studio'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('profile:themeStudio.customStudioTab', 'Custom Studio')}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {appearanceTab === 'presets' ? (
            <>
              {/* Quick Mode Bar: Light | Dark | System + Shuffle */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  role="group"
                  aria-label="Color mode preference"
                  className="flex items-center gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex-1 min-w-[210px]"
                >
                  {modeOptions.map((opt) => {
                    const isSelected = !customConfig.enabled && modePreference === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setModePreference(opt.id)}
                        aria-pressed={isSelected}
                        data-testid={`mode-pref-${opt.id}`}
                        className={`flex-1 h-10 min-h-[44px] sm:min-h-[38px] px-2 rounded-[8px] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-180 cursor-pointer whitespace-nowrap min-w-0 ${
                          isSelected
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--accent-primary)]/50'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                        }`}
                      >
                        {opt.icon}
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleShuffle}
                  data-testid="shuffle-theme-btn"
                  aria-label={t('profile:themeStudio.shuffle', 'Shuffle')}
                  className="h-11 min-h-[44px] px-3.5 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 text-[var(--text-primary)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-180 cursor-pointer shrink-0"
                >
                  <Shuffle className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{t('profile:themeStudio.shuffle', 'Shuffle')}</span>
                </button>
              </div>

              {/* Section 1: Core & Minimal Modes */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t('profile:themeStudio.coreSection', 'Core & Minimal')}
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">3</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {coreThemes.map((theme) => {
                    const isSelected = !customConfig.enabled && activeThemeId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setTheme(theme.id)}
                        aria-pressed={isSelected}
                        data-testid={`theme-card-${theme.id}`}
                        className={`relative p-3 text-left rounded-[var(--radius-card)] border transition-colors duration-180 cursor-pointer min-h-[82px] flex flex-col justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                          isSelected
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5" aria-hidden="true">
                            {theme.swatches.map((hex, i) => (
                              <span
                                key={`${theme.id}_swatch_${i}`}
                                className="w-4 h-4 rounded-full border border-black/20"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                          {isSelected ? (
                            <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-on-primary)] flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-[var(--text-muted)] capitalize">
                              {theme.mode}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-[13px] font-bold text-[var(--text-primary)] truncate">
                            {theme.name}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                            {theme.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Anime-Inspired Collections */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t('profile:themeStudio.animeSection', 'Anime-Inspired Palettes')}
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">9</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {animeThemes.map((theme) => {
                    const isSelected = !customConfig.enabled && activeThemeId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setTheme(theme.id)}
                        aria-pressed={isSelected}
                        data-testid={`theme-card-${theme.id}`}
                        className={`relative p-3 text-left rounded-[var(--radius-card)] border transition-colors duration-180 cursor-pointer min-h-[82px] flex flex-col justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                          isSelected
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5" aria-hidden="true">
                            {theme.swatches.map((hex, i) => (
                              <span
                                key={`${theme.id}_swatch_${i}`}
                                className="w-4 h-4 rounded-full border border-black/20"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                          {isSelected ? (
                            <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-on-primary)] flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-[var(--text-muted)] capitalize">
                              {theme.mode === 'light'
                                ? t('profile:themeStudio.light', 'Light')
                                : t('profile:themeStudio.dark', 'Dark')}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-[13px] font-bold text-[var(--text-primary)] truncate">
                            {theme.name}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                            {theme.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Accessibility Toggles */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
                <div className="rounded-[var(--radius-card)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                  {/* High Contrast Mode */}
                  <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                        <Contrast className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                          {t('profile:themeStudio.highContrast', 'High Contrast Mode')}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {t('profile:themeStudio.highContrastDesc', 'Boost border definition and text contrast')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={customConfig.highContrast}
                      aria-label={t('profile:themeStudio.highContrast', 'High Contrast Mode')}
                      data-testid="toggle-high-contrast"
                      onClick={() => setHighContrast(!customConfig.highContrast)}
                      className={`relative w-12 h-7 min-h-[28px] rounded-full transition-colors duration-180 cursor-pointer shrink-0 flex items-center px-1 ${
                        customConfig.highContrast
                          ? 'bg-[var(--accent-primary)]'
                          : 'bg-[var(--border-strong)]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full transition-transform duration-180 ${
                          customConfig.highContrast
                            ? 'translate-x-5 bg-[var(--accent-on-primary)]'
                            : 'translate-x-0 bg-[var(--bg-surface)]'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Reduce Animations */}
                  <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                        <ZapOff className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                          {t('profile:themeStudio.reduceAnimations', 'Reduce Animations')}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {t('profile:themeStudio.reduceAnimationsDesc', 'Minimize motion and transitions across the app')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={customConfig.reduceMotion}
                      aria-label="Toggle Reduce Animations"
                      data-testid="toggle-reduce-motion"
                      onClick={() => setReduceMotion(!customConfig.reduceMotion)}
                      className={`relative w-12 h-7 min-h-[28px] rounded-full transition-colors duration-180 cursor-pointer shrink-0 flex items-center px-1 ${
                        customConfig.reduceMotion
                          ? 'bg-[var(--accent-primary)]'
                          : 'bg-[var(--border-strong)]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full transition-transform duration-180 ${
                          customConfig.reduceMotion
                            ? 'translate-x-5 bg-[var(--accent-on-primary)]'
                            : 'translate-x-0 bg-[var(--bg-surface)]'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <CustomThemeStudio />
          )}
        </div>
      </div>
    </div>
  );
};
