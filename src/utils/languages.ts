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
 * Extracts and deduplicates all unique language names from an array of anime objects.
 */
export function extractUniqueLanguagesFromAnimeList(animeList: any[] = []): string[] {
  if (!Array.isArray(animeList) || animeList.length === 0) {
    return [];
  }

  const uniqueSet = new Set<string>();

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
      const normalized = normalizeLanguageName(token);
      if (normalized) {
        uniqueSet.add(normalized);
      }
    });
  });

  // Priority sort for Indian regional dub order
  const priority = ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'English', 'Japanese'];
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
