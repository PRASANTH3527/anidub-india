/**
 * ============================================================================
 * Language Extraction & Normalization Utilities for AniDub India
 * ============================================================================
 * Extracts unique dubbed languages from loaded anime records and formats them
 * into dynamic counts and bullet-separated display strings.
 */

export const LANGUAGE_NAME_MAP: Record<string, string> = {
  hin: 'Hindi',
  hi: 'Hindi',
  hindi: 'Hindi',
  tam: 'Tamil',
  ta: 'Tamil',
  tamil: 'Tamil',
  tel: 'Telugu',
  te: 'Telugu',
  telugu: 'Telugu',
  mal: 'Malayalam',
  ma: 'Malayalam',
  ml: 'Malayalam',
  malayalam: 'Malayalam',
  kan: 'Kannada',
  ka: 'Kannada',
  kn: 'Kannada',
  kannada: 'Kannada',
  eng: 'English',
  en: 'English',
  english: 'English',
  ben: 'Bengali',
  bn: 'Bengali',
  be: 'Bengali',
  bengali: 'Bengali',
  mar: 'Marathi',
  mr: 'Marathi',
  marathi: 'Marathi',
  guj: 'Gujarati',
  gu: 'Gujarati',
  gujarati: 'Gujarati',
  pan: 'Punjabi',
  pa: 'Punjabi',
  punjabi: 'Punjabi',
  jap: 'Japanese',
  ja: 'Japanese',
  jpn: 'Japanese',
  japanese: 'Japanese'
};

/**
 * Non-regional languages excluded from the Indian regional dub stats.
 * AniDub India is dedicated to Indian regional dub tracking.
 */
export const EXCLUDED_LANGUAGES = new Set([
  'japanese',
  'english',
  'romaji',
  'korean',
  'chinese',
  'japan',
  'jpn',
  'jap',
  'ja',
  'eng',
  'en',
  'kor',
  'ko',
  'chi',
  'zh'
]);

/**
 * Checks whether a language token or name is excluded from regional dub tracking.
 */
export function isExcludedLanguage(lang: string): boolean {
  if (!lang || typeof lang !== 'string') return true;
  const trimmed = lang.trim();
  if (['Japanese', 'English', 'Romaji', 'Korean', 'Chinese'].some(
    ex => ex.toLowerCase() === trimmed.toLowerCase()
  )) {
    return true;
  }
  const clean = trimmed.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
  return EXCLUDED_LANGUAGES.has(clean) || ['japanese', 'english', 'romaji', 'korean', 'chinese', 'korea', 'china', 'kor', 'chi', 'zh', 'ko', 'ja', 'jp', 'jpn', 'jap', 'en', 'eng'].includes(clean);
}

/**
 * Normalizes any language token (e.g., 'HIN', 'ta', 'telugu') to its clean proper name.
 */
export function normalizeLanguageName(rawLang: string): string {
  if (!rawLang || typeof rawLang !== 'string') return '';
  const clean = rawLang.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
  if (!clean) return '';
  const lower = clean.toLowerCase();
  if (LANGUAGE_NAME_MAP[lower]) {
    return LANGUAGE_NAME_MAP[lower];
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Extracts and deduplicates all unique Indian regional language names from an array of anime objects.
 * Filters out Japanese, English, Romaji, Korean, and Chinese so only Indian regional languages are counted and displayed.
 */
export function extractUniqueLanguagesFromAnimeList(animeList: any[] = []): string[] {
  if (!Array.isArray(animeList) || animeList.length === 0) {
    return [];
  }

  const rawLanguages: string[] = [];

  animeList.forEach((anime) => {
    if (!anime) return;
    const raw = anime.languages || anime.language || anime.dub || anime.dubbedLanguages;
    if (!raw) return;

    let tokens: string[] = [];
    if (Array.isArray(raw)) {
      tokens = raw.map(String);
    } else if (typeof raw === 'string') {
      tokens = raw.split(/[,/|•+]+/);
    }

    tokens.forEach((token) => {
      const trimmed = token.trim();
      if (!trimmed) return;
      if (['Japanese', 'English', 'Romaji', 'Korean', 'Chinese'].includes(trimmed)) return;
      if (isExcludedLanguage(trimmed)) return;
      const normalized = normalizeLanguageName(trimmed);
      if (normalized && !isExcludedLanguage(normalized)) {
        rawLanguages.push(normalized);
      }
    });
  });

  // Strictly enforce the filter in the calculation logic as specified by the user:
  const filteredLanguages = rawLanguages.filter(
    lang => lang && !['Japanese', 'English', 'Romaji', 'Korean', 'Chinese'].includes(lang.trim()) && !isExcludedLanguage(lang)
  );

  const uniqueSet = new Set<string>(filteredLanguages);

  // Priority sort for Indian regional dub order
  const priority = ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi'];
  return Array.from(uniqueSet).sort((a, b) => {
    const pA = priority.indexOf(a);
    const pB = priority.indexOf(b);
    if (pA !== -1 && pB !== -1) return pA - pB;
    if (pA !== -1) return -1;
    if (pB !== -1) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Formats an array of language names into a bullet-separated string (e.g., "Hindi • Tamil • Telugu").
 */
export function formatLanguagesBulletList(languages: string[]): string {
  if (!Array.isArray(languages) || languages.length === 0) {
    return 'None';
  }
  return languages.join(' • ');
}

/**
 * Computes all top catalog stats (total anime, total community votes, unique languages).
 */
export function calculateCatalogStats(animeList: any[] = []) {
  if (!Array.isArray(animeList) || animeList.length === 0) {
    return {
      totalAnime: 0,
      totalVotes: 0,
      totalLanguages: 0,
      languagesList: [],
      languagesString: 'None'
    };
  }

  const uniqueLanguages = extractUniqueLanguagesFromAnimeList(animeList);
  const totalVotes = animeList.reduce((acc, curr) => {
    const popularity = Number(curr.popularity) || 0;
    const likesCount = Number(curr.likesCount) || 0;
    const upvotes = Number(curr.upvotes) || 0;
    const likes = Number(curr.likes) || 0;
    // Prefer upvotes/likes if present, else popularity/likesCount
    const effectiveUpvotes = upvotes || popularity;
    const effectiveLikes = likes || likesCount;
    return acc + effectiveUpvotes + effectiveLikes;
  }, 0);

  return {
    totalAnime: animeList.length,
    totalVotes,
    totalLanguages: uniqueLanguages.length,
    languagesList: uniqueLanguages,
    languagesString: formatLanguagesBulletList(uniqueLanguages)
  };
}
