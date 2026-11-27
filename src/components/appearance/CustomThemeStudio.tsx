import React, { useEffect, useState } from 'react';
import { Check, Copy, Compass, Calendar, MessageCircle, Bookmark, User, RotateCcw } from 'lucide-react';
import {
  CUSTOM_ACCENT_SWATCHES,
  CUSTOM_BG_PRESETS,
} from '../../themes/registry';
import {
  computeContrastRatio,
  getAccessibleOnPrimary,
  getCustomBackgroundPreset,
  normalizeHexColor,
} from '../../themes/utils';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../Toast';

export const CustomThemeStudio: React.FC = () => {
  const {
    customConfig,
    resolvedTokens,
    updateCustomConfig,
    resetToDefault,
    exportThemeJson,
  } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation(['profile', 'navigation', 'animeDetails', 'states']);

  const [hexInput, setHexInput] = useState(customConfig.accentColor);
  const [hexError, setHexError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHexInput(customConfig.accentColor);
    setHexError(null);
  }, [customConfig.accentColor]);

  const activePreset = getCustomBackgroundPreset(customConfig.bgPresetId);
  const previewAccent = normalizeHexColor(customConfig.accentColor) || resolvedTokens.accentPrimary;
  const previewOnPrimary = getAccessibleOnPrimary(previewAccent);
  const contrastScore = computeContrastRatio(previewOnPrimary, previewAccent).toFixed(1);
  const previewRadius = `${customConfig.radiusPx}px`;

  const handleSelectBgPreset = (presetId: typeof customConfig.bgPresetId) => {
    updateCustomConfig({
      enabled: true,
      bgPresetId: presetId,
    });
  };

  const handleSelectAccent = (hex: string) => {
    setHexInput(hex);
    setHexError(null);
    updateCustomConfig({
      enabled: true,
      accentColor: hex,
    });
  };

  const handleHexChange = (value: string) => {
    setHexInput(value);
    const normalized = normalizeHexColor(value);
    if (normalized) {
      setHexError(null);
      updateCustomConfig({
        enabled: true,
        accentColor: normalized,
      });
    } else if (value.trim().length >= 4) {
      setHexError('Enter a valid 3 or 6-digit hex color (e.g. #B49AF8)');
    } else {
      setHexError(null);
    }
  };

  const handleCopyJson = async () => {
    const json = exportThemeJson();
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(json);
      } else {
        const ta = document.createElement('textarea');
        ta.value = json;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      showToast('Theme Copied', 'Custom theme JSON copied to clipboard.', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copy Unavailable', 'Unable to access clipboard on this device.', 'warning');
    }
  };

  const handleReset = () => {
    resetToDefault();
    showToast('Theme Reset', 'Restored default Eclipse Dark appearance.', 'info');
  };

  return (
    <div data-testid="custom-theme-studio" className="space-y-5">
      {/* 1. Live Mini Preview Card */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {t('profile:themeStudio.livePreview', 'Live Mini Preview')}
          </span>
          <span className="text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
            CTA Contrast {contrastScore}:1 · Radius {customConfig.radiusPx}px
          </span>
        </div>

        <div
          data-testid="custom-studio-live-preview"
          className="border p-3.5 space-y-3 overflow-hidden transition-colors duration-180"
          style={{
            backgroundColor: activePreset.bgCanvas,
            borderColor: activePreset.borderSubtle,
            borderRadius: previewRadius,
          }}
        >
          {/* Preview Header & Language Pill */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: previewAccent }}
              />
              <span
                className="text-xs font-bold truncate"
                style={{ color: activePreset.textPrimary }}
              >
                AniDub India
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="px-2.5 py-1 text-[11px] font-bold rounded-full"
                style={{
                  backgroundColor: previewAccent,
                  color: previewOnPrimary,
                }}
              >
                Tamil
              </span>
              <span
                className="px-2.5 py-1 text-[11px] font-semibold rounded-full border"
                style={{
                  backgroundColor: activePreset.bgElevated,
                  borderColor: activePreset.borderSubtle,
                  color: activePreset.textSecondary,
                }}
              >
                Hindi
              </span>
            </div>
          </div>

          {/* Preview Surface Card & Primary CTA Button */}
          <div
            className="p-3 border flex items-center justify-between gap-3"
            style={{
              backgroundColor: activePreset.bgSurface,
              borderColor: activePreset.borderSubtle,
              borderRadius: previewRadius,
            }}
          >
            <div className="min-w-0">
              <div
                className="text-xs font-bold truncate"
                style={{ color: activePreset.textPrimary }}
              >
                Solo Leveling
              </div>
              <div
                className="text-[11px] truncate mt-0.5"
                style={{ color: activePreset.textSecondary }}
              >
                Crunchyroll · Tamil, Hindi, Telugu
              </div>
            </div>
            <span
              className="px-3 py-1.5 text-[11px] font-bold shrink-0"
              style={{
                backgroundColor: previewAccent,
                color: previewOnPrimary,
                borderRadius: `${Math.min(customConfig.radiusPx, 14)}px`,
              }}
            >
              {t('animeDetails:whereToWatch', 'Where to Watch')}
            </span>
          </div>

          {/* Preview Mini Bottom Nav Bar */}
          <div
            className="grid grid-cols-5 py-2 px-1 border"
            style={{
              backgroundColor: activePreset.bgSurface,
              borderColor: activePreset.borderSubtle,
              borderRadius: `${Math.min(customConfig.radiusPx, 14)}px`,
            }}
          >
            {[
              { id: 'explore', label: t('navigation:explore', 'Explore'), icon: Compass, active: true },
              { id: 'schedule', label: t('navigation:schedule', 'Schedule'), icon: Calendar, active: false },
              { id: 'chat', label: t('navigation:chat', 'Chat'), icon: MessageCircle, active: false },
              { id: 'library', label: t('navigation:library', 'Library'), icon: Bookmark, active: false },
              { id: 'profile', label: t('navigation:profile', 'Profile'), icon: User, active: false },
            ].map((tab) => {
              const IconComp = tab.icon;
              return (
                <div
                  key={tab.id}
                  className="flex flex-col items-center justify-center gap-0.5 px-0.5 min-w-0"
                  style={{
                    color: tab.active ? previewAccent : activePreset.textSecondary,
                  }}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[9px] font-semibold leading-tight max-w-full truncate">{tab.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Background Preset Circles */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--text-primary)]">
            {t('profile:themeStudio.backgroundSurface', 'Background Surface')}
          </label>
          <span className="text-[11px] text-[var(--text-secondary)]">{activePreset.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {CUSTOM_BG_PRESETS.map((preset) => {
            const isSelected = customConfig.bgPresetId === preset.id && customConfig.enabled;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectBgPreset(preset.id)}
                aria-label={`Background preset: ${preset.name}`}
                aria-pressed={isSelected}
                title={preset.name}
                className={`relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border-2 flex items-center justify-center transition-transform duration-180 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isSelected
                    ? 'border-[var(--accent-primary)] scale-105'
                    : 'border-[var(--border-strong)] hover:scale-105'
                }`}
                style={{ backgroundColor: preset.bgCanvas }}
              >
                <span
                  className="w-5 h-5 rounded-full border"
                  style={{
                    backgroundColor: preset.bgSurface,
                    borderColor: preset.borderSubtle,
                  }}
                />
                {isSelected && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-[var(--bg-surface)]"
                    style={{
                      backgroundColor: previewAccent,
                      color: previewOnPrimary,
                    }}
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Accent Color Swatches + Custom Hex Input */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="custom-accent-hex-input"
            className="text-xs font-semibold text-[var(--text-primary)]"
          >
            {t('profile:themeStudio.accentColor', 'Accent Color')}
          </label>
          <span className="text-[11px] font-mono text-[var(--text-secondary)]">
            {previewAccent}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CUSTOM_ACCENT_SWATCHES.map((swatch) => {
            const isSelected =
              previewAccent.toUpperCase() === swatch.hex.toUpperCase() && customConfig.enabled;
            const iconColor = getAccessibleOnPrimary(swatch.hex);
            return (
              <button
                key={swatch.id}
                type="button"
                onClick={() => handleSelectAccent(swatch.hex)}
                aria-label={`Accent color ${swatch.name}`}
                aria-pressed={isSelected}
                title={swatch.name}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border-2 flex items-center justify-center transition-transform duration-180 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isSelected ? 'border-[var(--text-primary)] scale-105' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: swatch.hex }}
              >
                {isSelected && <Check className="w-4 h-4 stroke-[3]" style={{ color: iconColor }} />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <label
            className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-[var(--radius-control)] border border-[var(--border-subtle)] overflow-hidden shrink-0 cursor-pointer"
            style={{ backgroundColor: previewAccent }}
            aria-label="Pick custom accent color"
          >
            <input
              type="color"
              value={previewAccent}
              onChange={(e) => handleSelectAccent(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Color wheel picker"
            />
          </label>
          <input
            id="custom-accent-hex-input"
            type="text"
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            placeholder="#B49AF8"
            maxLength={7}
            spellCheck={false}
            data-testid="custom-accent-hex-input"
            className="flex-1 min-w-0 h-11 min-h-[44px] px-3.5 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-180"
          />
        </div>
        {hexError && (
          <p role="alert" className="text-xs text-[#F87171]">
            {hexError}
          </p>
        )}
      </div>

      {/* 4. Corner Radius Slider (6px sharp -> 20px soft) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="custom-radius-slider"
            className="text-xs font-semibold text-[var(--text-primary)]"
          >
            {t('profile:themeStudio.cornerRadius', 'Corner Radius')}
          </label>
          <span className="text-xs font-semibold text-[var(--accent-primary)] tabular-nums">
            {customConfig.radiusPx}px
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--text-muted)] shrink-0">
            {t('profile:themeStudio.sharp', 'Sharp (6px)')}
          </span>
          <input
            id="custom-radius-slider"
            type="range"
            min={6}
            max={20}
            step={1}
            value={customConfig.radiusPx}
            onChange={(e) =>
              updateCustomConfig({
                radiusPx: Number(e.target.value),
              })
            }
            data-testid="custom-radius-slider"
            className="w-full h-2 rounded-full accent-[var(--accent-primary)] cursor-pointer"
          />
          <span className="text-[11px] text-[var(--text-muted)] shrink-0">
            {t('profile:themeStudio.soft', 'Soft (20px)')}
          </span>
        </div>
      </div>

      {/* 5. Actions: Copy Theme JSON & Reset to Default */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={handleCopyJson}
          data-testid="copy-theme-json-btn"
          className="h-11 min-h-[44px] px-4 rounded-[var(--radius-control)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors duration-180 cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
          <span className="truncate">
            {copied
              ? t('states:copiedToClipboard', 'Copied to clipboard')
              : t('profile:themeStudio.copyJson', 'Copy Theme JSON')}
          </span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          data-testid="reset-theme-default-btn"
          className="h-11 min-h-[44px] px-4 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-180 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          <span className="truncate">{t('profile:themeStudio.resetDefault', 'Reset to Default')}</span>
        </button>
      </div>
    </div>
  );
};
