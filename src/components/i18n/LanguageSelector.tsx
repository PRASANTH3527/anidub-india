import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Globe, Search, Smartphone, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import {
  searchLanguages,
  type LanguagePreference,
  type SupportedLanguageCode,
} from '../../i18n/languageRegistry';
import { useToast } from '../Toast';

interface LanguageListBodyProps {
  onSelectComplete: () => void;
  autoFocusSearch?: boolean;
  compact?: boolean;
}

const LanguageListBody: React.FC<LanguageListBodyProps> = ({
  onSelectComplete,
  autoFocusSearch = false,
  compact = false,
}) => {
  const { t } = useTranslation(['common']);
  const {
    preference,
    language,
    deviceLanguageMeta,
    isLoadingLanguage,
    setLanguagePreference,
  } = useLanguage();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocusSearch) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [autoFocusSearch]);

  const filteredLanguages = useMemo(() => searchLanguages(query, false), [query]);

  const handleChoose = async (nextPref: LanguagePreference) => {
    const resolvedCode: SupportedLanguageCode = await setLanguagePreference(nextPref);
    const matched = searchLanguages('', false).find((item) => item.code === resolvedCode);
    const label = matched ? `${matched.nativeName}` : resolvedCode.toUpperCase();

    if (nextPref === 'auto') {
      showToast(
        t('common:languageSelector.switchedToastTitle', 'Language Updated'),
        t('common:languageSelector.autoSwitchedToastBody', {
          language: label,
          defaultValue: `Using device language (${label})`,
        }),
        'info'
      );
    } else {
      showToast(
        t('common:languageSelector.switchedToastTitle', 'Language Updated'),
        t('common:languageSelector.switchedToastBody', {
          language: label,
          defaultValue: `Interface switched to ${label}`,
        }),
        'info'
      );
    }
    onSelectComplete();
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Search Input */}
      <div className={compact ? 'p-3 border-b border-[var(--border-subtle)]' : 'px-4 sm:px-6 py-3 border-b border-[var(--border-subtle)]'}>
        <div className="relative">
          <Search
            className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common:languageSelector.searchPlaceholder', 'Search languages...')}
            aria-label={t('common:languageSelector.searchPlaceholder', 'Search languages...')}
            data-testid="language-search-input"
            className="w-full h-11 min-h-[44px] pl-10 pr-9 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors duration-180"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('common:clear', 'Clear')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Language List */}
      <div
        className={`overflow-y-auto overscroll-contain space-y-1.5 ${
          compact ? 'max-h-[340px] p-2.5' : 'flex-1 px-4 sm:px-6 py-3.5 max-h-[60vh]'
        }`}
        role="listbox"
        aria-label={t('common:languageSelector.title', 'Website Language')}
      >
        {/* Use Device Language Quick Option */}
        {!query.trim() && (
          <button
            type="button"
            role="option"
            aria-selected={preference === 'auto'}
            disabled={isLoadingLanguage}
            onClick={() => void handleChoose('auto')}
            data-testid="language-option-auto"
            className={`w-full min-h-[52px] px-3 py-2.5 rounded-[var(--radius-control)] border flex items-center justify-between gap-3 text-left transition-colors duration-180 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60 ${
              preference === 'auto'
                ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/60'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]'
            }`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <span
                className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                  preference === 'auto'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--accent-primary)] border-[var(--border-subtle)]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text-primary)] leading-snug">
                  {t('common:languageSelector.useDeviceLanguage', 'Use device language')}
                </span>
                <span className="block text-xs text-[var(--text-secondary)] truncate">
                  {t('common:languageSelector.deviceDetected', {
                    language: `${deviceLanguageMeta.nativeName} (${deviceLanguageMeta.englishName})`,
                    defaultValue: `Detected: ${deviceLanguageMeta.nativeName}`,
                  })}
                </span>
              </span>
            </span>
            {preference === 'auto' && (
              <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-[var(--accent-on-primary)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            )}
          </button>
        )}

        {/* Active 7 Core Languages */}
        {filteredLanguages.length > 0 ? (
          filteredLanguages.map((item) => {
            const isSelected = preference !== 'auto' && language === item.code;
            const isEffectiveAuto = preference === 'auto' && language === item.code;
            return (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isLoadingLanguage}
                onClick={() => void handleChoose(item.code as SupportedLanguageCode)}
                data-testid={`language-option-${item.code}`}
                className={`w-full min-h-[52px] px-3 py-2.5 rounded-[var(--radius-control)] border flex items-center justify-between gap-3 text-left transition-colors duration-180 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60 ${
                  isSelected
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/60'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {item.shortBadge}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text-primary)] truncate">
                      {item.nativeName}
                    </span>
                    <span className="block text-xs text-[var(--text-secondary)] truncate">
                      {item.englishName}
                    </span>
                  </span>
                </span>

                {isSelected ? (
                  <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-[var(--accent-on-primary)] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </span>
                ) : isEffectiveAuto ? (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
                    {t('common:languageSelector.active', 'Active')}
                  </span>
                ) : null}
              </button>
            );
          })
        ) : (
          <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
            {t('common:languageSelector.noResults', 'No matching languages found.')}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Desktop Top Header Globe Popover Trigger (`1024px+`).
 * Hidden on mobile (<1024px) to guarantee 0px header crowding on 360px viewports.
 */
export const DesktopLanguagePopover: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { t } = useTranslation(['common']);
  const { languageMeta } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative hidden lg:block shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const next = !open;
          if (next && onOpen) onOpen();
          setOpen(next);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('common:languageSelector.buttonAriaLabel', {
          language: `${languageMeta.nativeName} (${languageMeta.englishName})`,
          defaultValue: `Website language: ${languageMeta.englishName}`,
        })}
        title={`${languageMeta.nativeName} (${languageMeta.englishName})`}
        data-testid="navbar-language-trigger"
        className={`h-11 min-h-[44px] px-3 rounded-[var(--radius-control)] bg-[var(--bg-elevated)] border transition-colors duration-180 motion-reduce:transition-none inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60 ${
          open
            ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
            : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
        }`}
      >
        <Globe
          className={`w-4 h-4 shrink-0 ${
            open ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        />
        <span className="text-xs font-bold tracking-wide text-[var(--text-primary)]">
          {languageMeta.shortBadge}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-180 ${
            open ? 'rotate-180 text-[var(--accent-primary)]' : ''
          }`}
        />
      </button>

      {open && (
        <div
          data-testid="desktop-language-popover"
          className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden z-[75]"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
        >
          <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                {t('common:languageSelector.title', 'Website Language')}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-snug">
                {t(
                  'common:languageSelector.subtitle',
                  'Interface language only · Dub filters stay separate'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('common:languageSelector.closeLabel', 'Close language selector')}
              className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <LanguageListBody
            compact
            autoFocusSearch
            onSelectComplete={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Global Mobile Bottom Sheet / Centered Modal Language Selector.
 * Triggered from Mobile Tools Bottom Sheet and Profile -> Language & Region.
 */
export const LanguageSelector: React.FC = () => {
  const { t } = useTranslation(['common']);
  const { isSelectorOpen, closeLanguageSelector } = useLanguage();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isSelectorOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLanguageSelector();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isSelectorOpen, closeLanguageSelector]);

  if (!isSelectorOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('common:languageSelector.title', 'Website Language')}
      data-testid="language-selector-modal"
      className="fixed inset-0 z-[96] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        aria-hidden="true"
        onClick={closeLanguageSelector}
        className="fixed inset-0 backdrop-blur-xs transition-opacity duration-180"
        style={{ backgroundColor: 'var(--backdrop-scrim)' }}
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full sm:max-w-md max-h-[88vh] rounded-t-3xl sm:rounded-2xl bg-[var(--bg-surface)] border-t sm:border border-[var(--border-subtle)] flex flex-col overflow-hidden outline-none"
        style={{
          boxShadow: 'var(--shadow-elevated)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border-strong)]" />
        </div>

        {/* Sticky Header */}
        <div className="px-4 sm:px-6 pt-3 pb-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-[var(--radius-control)] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight truncate">
                {t('common:languageSelector.title', 'Website Language')}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {t(
                  'common:languageSelector.subtitle',
                  'Interface language only · Dub filters stay separate'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeLanguageSelector}
            aria-label={t('common:languageSelector.closeLabel', 'Close language selector')}
            data-testid="language-selector-close-btn"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors duration-180 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <LanguageListBody onSelectComplete={closeLanguageSelector} />
      </div>
    </div>
  );
};
