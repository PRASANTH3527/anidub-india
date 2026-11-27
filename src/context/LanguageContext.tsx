import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, {
  applyDocumentLanguage,
  readStoredLanguagePreference,
  switchI18nLanguage,
} from '../i18n/config';
import {
  ACTIVE_LANGUAGES,
  LANGUAGE_BY_CODE,
  LANGUAGE_STORAGE_KEY,
  resolveDeviceLanguage,
  resolveEffectiveLanguage,
  sanitizeLanguagePreference,
  type LanguageMetadata,
  type LanguagePreference,
  type SupportedLanguageCode,
} from '../i18n/languageRegistry';

export interface LanguageContextValue {
  preference: LanguagePreference;
  language: SupportedLanguageCode;
  languageMeta: LanguageMetadata;
  deviceLanguage: SupportedLanguageCode;
  deviceLanguageMeta: LanguageMetadata;
  availableLanguages: readonly LanguageMetadata[];
  isLoadingLanguage: boolean;
  isSelectorOpen: boolean;
  openLanguageSelector: () => void;
  closeLanguageSelector: () => void;
  setLanguagePreference: (pref: LanguagePreference) => Promise<SupportedLanguageCode>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreference] = useState<LanguagePreference>(() =>
    readStoredLanguagePreference()
  );
  const [deviceLanguage, setDeviceLanguage] = useState<SupportedLanguageCode>(() =>
    resolveDeviceLanguage()
  );
  const [isLoadingLanguage, setIsLoadingLanguage] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const effectiveLanguage = useMemo(
    () => resolveEffectiveLanguage(preference, [deviceLanguage]),
    [preference, deviceLanguage]
  );

  // Sync browser languagechange events when user selected "Use device language"
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLanguageChange = () => {
      setDeviceLanguage(resolveDeviceLanguage());
    };
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  // Keep i18next + <html lang/dir> synchronized on mount and preference updates
  useEffect(() => {
    let active = true;
    applyDocumentLanguage(effectiveLanguage);
    setIsLoadingLanguage(true);
    void switchI18nLanguage(effectiveLanguage).finally(() => {
      if (active) setIsLoadingLanguage(false);
    });
    return () => {
      active = false;
    };
  }, [effectiveLanguage]);

  const setLanguagePreference = useCallback(
    async (nextPref: LanguagePreference): Promise<SupportedLanguageCode> => {
      const sanitized = sanitizeLanguagePreference(nextPref);
      const nextDevice = resolveDeviceLanguage();
      const targetLang = resolveEffectiveLanguage(sanitized, [nextDevice]);

      setDeviceLanguage(nextDevice);
      setPreference(sanitized);
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, sanitized);
      } catch {
        // Ignore storage errors in private browsing
      }

      setIsLoadingLanguage(true);
      try {
        await switchI18nLanguage(targetLang);
      } finally {
        setIsLoadingLanguage(false);
      }
      return targetLang;
    },
    []
  );

  const openLanguageSelector = useCallback(() => setIsSelectorOpen(true), []);
  const closeLanguageSelector = useCallback(() => setIsSelectorOpen(false), []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      preference,
      language: effectiveLanguage,
      languageMeta: LANGUAGE_BY_CODE[effectiveLanguage] || LANGUAGE_BY_CODE.en,
      deviceLanguage,
      deviceLanguageMeta: LANGUAGE_BY_CODE[deviceLanguage] || LANGUAGE_BY_CODE.en,
      availableLanguages: ACTIVE_LANGUAGES,
      isLoadingLanguage,
      isSelectorOpen,
      openLanguageSelector,
      closeLanguageSelector,
      setLanguagePreference,
    }),
    [
      preference,
      effectiveLanguage,
      deviceLanguage,
      isLoadingLanguage,
      isSelectorOpen,
      openLanguageSelector,
      closeLanguageSelector,
      setLanguagePreference,
    ]
  );

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
