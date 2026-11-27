export type SupportedLanguageCode = 'en' | 'ta' | 'hi' | 'te' | 'ml' | 'kn' | 'bn';

export type FutureLanguageCode =
  | 'mr'
  | 'gu'
  | 'pa'
  | 'ur'
  | 'ar'
  | 'ja'
  | 'ko'
  | 'es'
  | 'fr'
  | 'id';

export type AnyLanguageCode = SupportedLanguageCode | FutureLanguageCode;

export type LanguagePreference = SupportedLanguageCode | 'auto';

export type TextDirection = 'ltr' | 'rtl';

export const I18N_NAMESPACES = [
  'common',
  'navigation',
  'explore',
  'animeDetails',
  'schedule',
  'library',
  'profile',
  'tools',
  'community',
  'forms',
  'states',
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

export interface LanguageMetadata {
  code: AnyLanguageCode;
  bcp47: string;
  englishName: string;
  nativeName: string;
  shortBadge: string;
  dir: TextDirection;
  fontFamily: string;
  enabled: boolean;
  regionLabel: string;
}

export const LANGUAGE_STORAGE_KEY = 'anidub_ui_lang_v1';
export const DEFAULT_LANGUAGE_CODE: SupportedLanguageCode = 'en';

export const LANGUAGE_REGISTRY: readonly LanguageMetadata[] = [
  // Phase 1 Active Languages (7 core Indian & global interface languages)
  {
    code: 'en',
    bcp47: 'en-IN',
    englishName: 'English',
    nativeName: 'English',
    shortBadge: 'EN',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    enabled: true,
    regionLabel: 'India / Global',
  },
  {
    code: 'ta',
    bcp47: 'ta-IN',
    englishName: 'Tamil',
    nativeName: 'தமிழ்',
    shortBadge: 'த',
    dir: 'ltr',
    fontFamily: "'Noto Sans Tamil', 'Inter', system-ui, sans-serif",
    enabled: true,
    regionLabel: 'Tamil Nadu & Puducherry',
  },
  {
    code: 'hi',
    bcp47: 'hi-IN',
    englishName: 'Hindi',
    nativeName: 'हिन्दी',
    shortBadge: 'हि',
    dir: 'ltr',
    fontFamily: "'Noto Sans Devanagari', 'Inter', system-ui, sans-serif",
    enabled: true,
    regionLabel: 'India',
  },
  {
    code: 'te',
    bcp47: 'te-IN',
    englishName: 'Telugu',
    nativeName: 'తెలుగు',
    shortBadge: 'తె',
    dir: 'ltr',
    fontFamily: "'Noto Sans Telugu', 'Inter', system-ui, sans-serif",
    enabled: true,
    regionLabel: 'Andhra Pradesh & Telangana',
  },
  {
    code: 'ml',
    bcp47: 'ml-IN',
    englishName: 'Malayalam',
    nativeName: 'മലയാളം',
    shortBadge: 'മ',
    dir: 'ltr',
    fontFamily: "'Noto Sans Malayalam', 'Inter', system-ui, sans-serif",
    enabled: true,
    regionLabel: 'Kerala',
  },
  {
    code: 'kn',
    bcp47: 'kn-IN',
    englishName: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    shortBadge: 'ಕ',
    dir: 'ltr',
    fontFamily: "'Noto Sans Kannada', 'Inter', system-ui, sans-serif",
    enabled: true,
    regionLabel: 'Karnataka',
  },
  {
    code: 'bn',
    bcp47: 'bn-IN',
    englishName: 'Bengali',
    nativeName: 'বাংলা',
    shortBadge: 'বা',
    dir: 'ltr',
    fontFamily: "'Noto Sans Bengali', 'Inter', system-ui, sans-serif",
    enabled: true,
    regionLabel: 'West Bengal & Tripura',
  },

  // Future Phase 2+ Expansion Metadata (RTL-ready & scalable to 35+ languages)
  {
    code: 'mr',
    bcp47: 'mr-IN',
    englishName: 'Marathi',
    nativeName: 'मराठी',
    shortBadge: 'म',
    dir: 'ltr',
    fontFamily: "'Noto Sans Devanagari', 'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'Maharashtra',
  },
  {
    code: 'gu',
    bcp47: 'gu-IN',
    englishName: 'Gujarati',
    nativeName: 'ગુજરાતી',
    shortBadge: 'ગુ',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'Gujarat',
  },
  {
    code: 'pa',
    bcp47: 'pa-IN',
    englishName: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    shortBadge: 'ਪੰ',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'Punjab',
  },
  {
    code: 'ur',
    bcp47: 'ur-IN',
    englishName: 'Urdu',
    nativeName: 'اردو',
    shortBadge: 'ار',
    dir: 'rtl',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'India',
  },
  {
    code: 'ar',
    bcp47: 'ar',
    englishName: 'Arabic',
    nativeName: 'العربية',
    shortBadge: 'ع',
    dir: 'rtl',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'MENA',
  },
  {
    code: 'ja',
    bcp47: 'ja-JP',
    englishName: 'Japanese',
    nativeName: '日本語',
    shortBadge: '日',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'Japan',
  },
  {
    code: 'ko',
    bcp47: 'ko-KR',
    englishName: 'Korean',
    nativeName: '한국어',
    shortBadge: '한',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'South Korea',
  },
  {
    code: 'es',
    bcp47: 'es',
    englishName: 'Spanish',
    nativeName: 'Español',
    shortBadge: 'ES',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'Global',
  },
  {
    code: 'fr',
    bcp47: 'fr',
    englishName: 'French',
    nativeName: 'Français',
    shortBadge: 'FR',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'Global',
  },
  {
    code: 'id',
    bcp47: 'id-ID',
    englishName: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    shortBadge: 'ID',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, sans-serif",
    enabled: false,
    regionLabel: 'Indonesia',
  },
] as const;

export const ACTIVE_LANGUAGES: readonly LanguageMetadata[] = LANGUAGE_REGISTRY.filter(
  (lang) => lang.enabled
);

export const SUPPORTED_LANGUAGE_CODES: readonly SupportedLanguageCode[] = [
  'en',
  'ta',
  'hi',
  'te',
  'ml',
  'kn',
  'bn',
];

export const LANGUAGE_BY_CODE: Record<SupportedLanguageCode, LanguageMetadata> =
  ACTIVE_LANGUAGES.reduce((acc, item) => {
    acc[item.code as SupportedLanguageCode] = item;
    return acc;
  }, {} as Record<SupportedLanguageCode, LanguageMetadata>);

export function isSupportedLanguage(code: unknown): code is SupportedLanguageCode {
  return (
    typeof code === 'string' &&
    (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(code.toLowerCase())
  );
}

export function sanitizeLanguagePreference(raw: unknown): LanguagePreference {
  if (raw === 'auto') return 'auto';
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'auto') return 'auto';
    const base = normalized.split('-')[0];
    if (isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE_CODE;
}

export function resolveDeviceLanguage(
  navigatorLanguages?: readonly string[]
): SupportedLanguageCode {
  const candidates =
    navigatorLanguages && navigatorLanguages.length > 0
      ? navigatorLanguages
      : typeof navigator !== 'undefined'
        ? navigator.languages && navigator.languages.length > 0
          ? navigator.languages
          : navigator.language
            ? [navigator.language]
            : []
        : [];

  for (const tag of candidates) {
    if (!tag || typeof tag !== 'string') continue;
    const base = tag.trim().toLowerCase().split(/[-_]/)[0];
    if (isSupportedLanguage(base)) {
      return base;
    }
  }
  return DEFAULT_LANGUAGE_CODE;
}

export function resolveEffectiveLanguage(
  preference: LanguagePreference,
  navigatorLanguages?: readonly string[]
): SupportedLanguageCode {
  if (preference === 'auto') {
    return resolveDeviceLanguage(navigatorLanguages);
  }
  return isSupportedLanguage(preference) ? preference : DEFAULT_LANGUAGE_CODE;
}

export function searchLanguages(
  query: string,
  includeUpcoming = false
): LanguageMetadata[] {
  const pool = includeUpcoming ? LANGUAGE_REGISTRY : ACTIVE_LANGUAGES;
  const q = query.trim().toLowerCase();
  if (!q) return [...pool];

  return pool.filter(
    (lang) =>
      lang.englishName.toLowerCase().includes(q) ||
      lang.nativeName.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q) ||
      lang.shortBadge.toLowerCase().includes(q) ||
      lang.regionLabel.toLowerCase().includes(q)
  );
}

export function formatLocaleNumber(
  value: number,
  lang: SupportedLanguageCode,
  options?: Intl.NumberFormatOptions
): string {
  if (!Number.isFinite(value)) return '0';
  const meta = LANGUAGE_BY_CODE[lang] || LANGUAGE_BY_CODE.en;
  try {
    return new Intl.NumberFormat(meta.bcp47, options).format(value);
  } catch {
    return String(value);
  }
}

export function formatLocaleDate(
  input: Date | string | number,
  lang: SupportedLanguageCode,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return typeof input === 'string' ? input : '';
  const meta = LANGUAGE_BY_CODE[lang] || LANGUAGE_BY_CODE.en;
  try {
    return new Intl.DateTimeFormat(meta.bcp47, options).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatLocaleTime(
  input: Date | string | number,
  lang: SupportedLanguageCode
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return typeof input === 'string' ? input : '';
  const meta = LANGUAGE_BY_CODE[lang] || LANGUAGE_BY_CODE.en;
  try {
    return new Intl.DateTimeFormat(meta.bcp47, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Basic native-script & regional transliteration normalization for Explore search.
 * Maps common Indian regional script queries and phonetic spellings to canonical
 * English keywords so D1 search returns accurate results seamlessly.
 */
const REGIONAL_SEARCH_ALIASES: readonly [RegExp, string][] = [
  // Language names in native scripts & common transliterations
  [/தமிழ்|tamizh|thamizh/gi, 'tamil'],
  [/हिन्दी|हिंदी/gi, 'hindi'],
  [/తెలుగు/gi, 'telugu'],
  [/മലയാളം/gi, 'malayalam'],
  [/ಕನ್ನಡ/gi, 'kannada'],
  [/বাংলা/gi, 'bengali'],

  // Popular anime titles in Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali
  [/நருடோ|नारुतो|नरूटो|నరుటో|നറുട്ടോ|ನರುಟೊ|নারুতো/gi, 'naruto'],
  [/ஒன் பீஸ்|वन पीस|వన్ పీస్|വൺ പീസ്|ಒನ್ ಪೀಸ್|ওয়ান পিস/gi, 'one piece'],
  [/டீமன் ஸ்லேயர்|डीमन स्लेयर|డీమన్ స్లేయర్|ഡീമൻ സ്ലെയർ|ಡೀಮನ್ ಸ್ಲೇಯರ್|ডেমন স্লেয়ার/gi, 'demon slayer'],
  [/ஜுஜுட்சு கைசென்|जुजुत्सु काइसेन|జుజుట్సు కైసెన్|ജുജുത്സു കൈസെൻ|ಜುಜುತ್ಸು ಕೈಸೆನ್|জুজুৎসু কাইসেন/gi, 'jujutsu kaisen'],
  [/சோலோ லெவலிங்|सोलो लेवलिंग|సోలో లెవలింగ్|സോളോ ലെവലിംഗ്|ಸೋಲೋ ಲೆವೆಲಿಂಗ್|সোলো লেভেলিং/gi, 'solo leveling'],
  [/டிராகன் பால்|ड्रैगन बॉल|డ్రాగన్ బాల్|ഡ്രാഗൺ ബോൾ|ಡ್ರಾಗನ್ ಬಾಲ್|ড্রাগন বল/gi, 'dragon ball'],
  [/அட்டாக் ஆன் டைட்டன்|अटैक ऑन टाइटन|అటాక్ ఆన్ టైటాన్|അറ്റാക്ക് ഓൺ ടൈറ്റൻ/gi, 'attack on titan'],
  [/டெத் நோட்|डेथ नोट|డెత్ నోట్|ഡെത്ത് നോട്ട്|ಡೆತ್ ನೋಟ್|ডেথ নোট/gi, 'death note'],
  [/ப்ளீச்|ब्लीच|బ్లీచ్|ബ്ലീച്ച്/gi, 'bleach'],
  [/போக்கிமான்|पोकेमॉन|పోకీమాన్|പോക്കിമോൻ/gi, 'pokemon'],
  [/செயின்சா மேன்|चेनसॉ मैन|చైన్సా మ్యాన్/gi, 'chainsaw man'],
  [/ஸ்பை எக்ஸ் ஃபேமிலி|स्पाई एक्स फैमिली|స్పై ఎక్స్ ఫ్యామిలీ/gi, 'spy x family'],
  [/டோக்கியோ ரிவெஞ்சர்ஸ்|टोक्यो रिवेंजर्स/gi, 'tokyo revengers'],
  [/மை ஹீரோ அகாடமியா|माई हीरो एकेडेमिया/gi, 'my hero academia'],
  [/ப்ளூ லாக்|ब्लू लॉक/gi, 'blue lock'],
  [/ஷின்சான்|शिनचैन|షిన్చాన్/gi, 'shinchan'],
  [/டோரேமான்|डोरेमॉन|డోరేమాన్/gi, 'doraemon'],
];

export function normalizeRegionalSearchQuery(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) return '';
  let normalized = trimmed;
  for (const [pattern, replacement] of REGIONAL_SEARCH_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
}
