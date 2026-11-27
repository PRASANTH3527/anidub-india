import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enResources from './locales/en';
import {
  DEFAULT_LANGUAGE_CODE,
  I18N_NAMESPACES,
  LANGUAGE_BY_CODE,
  LANGUAGE_STORAGE_KEY,
  resolveEffectiveLanguage,
  sanitizeLanguagePreference,
  type I18nNamespace,
  type LanguagePreference,
  type SupportedLanguageCode,
} from './languageRegistry';

type LocaleBundleMap = Record<I18nNamespace, Record<string, unknown>>;

const LAZY_LOCALE_LOADERS: Record<
  Exclude<SupportedLanguageCode, 'en'>,
  () => Promise<{ default: LocaleBundleMap }>
> = {
  ta: () => import('./locales/ta'),
  hi: () => import('./locales/hi'),
  te: () => import('./locales/te'),
  ml: () => import('./locales/ml'),
  kn: () => import('./locales/kn'),
  bn: () => import('./locales/bn'),
};

const loadedLanguages = new Set<SupportedLanguageCode>(['en']);

export function readStoredLanguagePreference(): LanguagePreference {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE_CODE;
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!raw) return DEFAULT_LANGUAGE_CODE;
    return sanitizeLanguagePreference(raw);
  } catch {
    return DEFAULT_LANGUAGE_CODE;
  }
}

export function applyDocumentLanguage(lang: SupportedLanguageCode): void {
  if (typeof document === 'undefined') return;
  const meta = LANGUAGE_BY_CODE[lang] || LANGUAGE_BY_CODE.en;
  const root = document.documentElement;
  root.lang = meta.code;
  root.dir = meta.dir;
  root.setAttribute('data-ui-lang', meta.code);
  root.style.setProperty('--font-ui-script', meta.fontFamily);
}

export async function ensureLanguageBundleLoaded(
  lang: SupportedLanguageCode
): Promise<void> {
  if (lang === 'en' || loadedLanguages.has(lang)) {
    return;
  }

  const loader = LAZY_LOCALE_LOADERS[lang];
  if (!loader) return;

  const mod = await loader();
  const bundle = mod.default;
  for (const ns of I18N_NAMESPACES) {
    if (bundle[ns]) {
      i18n.addResourceBundle(lang, ns, bundle[ns], true, true);
    }
  }
  loadedLanguages.add(lang);
}

const initialPreference = readStoredLanguagePreference();
const initialLanguage = resolveEffectiveLanguage(initialPreference);

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: enResources,
    },
    lng: 'en',
    fallbackLng: DEFAULT_LANGUAGE_CODE,
    ns: [...I18N_NAMESPACES],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    returnNull: false,
    returnEmptyString: false,
  });
}

// Immediately align html lang/dir and lazy-load persisted non-English bundle
applyDocumentLanguage(initialLanguage);
if (initialLanguage !== 'en') {
  void ensureLanguageBundleLoaded(initialLanguage).then(() => {
    if (i18n.language !== initialLanguage) {
      return i18n.changeLanguage(initialLanguage);
    }
    return undefined;
  });
}

export async function switchI18nLanguage(lang: SupportedLanguageCode): Promise<void> {
  await ensureLanguageBundleLoaded(lang);
  applyDocumentLanguage(lang);
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
}

export default i18n;
