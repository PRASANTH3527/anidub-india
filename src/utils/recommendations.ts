/**
 * Honest Recommendation & Similar-Anime Utility for AniDub India.
 *
 * STRICT HONESTY RULES:
 * - Zero artificial percentage clamping (no fake 78-99% or 75-98% scores).
 * - Mandatory filters (verified language + selected OTT platform) strictly filter out
 *   any anime that does not satisfy the user's requirements.
 * - Every recommended title includes clear, explainable reasons derived strictly from
 *   its verified record fields.
 */

import { extractAnimePlatformsNormalized, matchesSelectedPlatforms } from './ottHub';
import { normalizeLanguageName, isExcludedLanguage } from './languages';

export interface RecommendationPreferences {
  language?: string; // 'All' or a specific Indian language e.g. 'Tamil', 'Hindi'
  platforms?: string[]; // [] or ['All'] means any platform; otherwise mandatory OTT match
  genres?: string[]; // Optional preferred genres
  format?: string; // 'All' | 'TV Series' | 'Movie' | 'OVA/Special'
  mood?: string; // Optional mood tag that maps to honest genre affinities
  limit?: number;
}

export interface ExplainedRecommendation<T = Record<string, unknown>> {
  anime: T;
  reasons: string[];
  matchedGenres: string[];
  verifiedLanguages: string[];
  verifiedPlatforms: string[];
  relevancePoints: number;
}

const MOOD_GENRE_MAP: Record<string, string[]> = {
  'action': ['Action', 'Adventure', 'Shonen', 'Martial Arts', 'Supernatural'],
  'hype': ['Action', 'Sports', 'Shonen', 'Adventure'],
  'chill': ['Slice of Life', 'Comedy', 'Romance', 'Music'],
  'emotional': ['Drama', 'Romance', 'Slice of Life', 'Fantasy'],
  'thriller': ['Mystery', 'Psychological', 'Thriller', 'Suspense', 'Horror', 'Dark Fantasy'],
  'fantasy': ['Fantasy', 'Isekai', 'Adventure', 'Sci-Fi', 'Supernatural'],
  'comedy': ['Comedy', 'Slice of Life', 'Parody', 'School'],
};

export function parseAnimeLanguages(anime: Record<string, unknown>): string[] {
  const raw = anime.languages ?? anime.dubs ?? anime.available_languages ?? anime.dubLanguages;
  const tokens: string[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        tokens.push(...item.split(/[,/|•+]+/));
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj.language === 'string') tokens.push(obj.language);
        if (typeof obj.name === 'string') tokens.push(obj.name);
      }
    }
  } else if (typeof raw === 'string') {
    tokens.push(...raw.split(/[,/|•+]+/));
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    const norm = normalizeLanguageName(tok);
    if (!norm || isExcludedLanguage(norm)) continue;
    const key = norm.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(norm);
    }
  }
  return out;
}

export function parseAnimeGenres(anime: Record<string, unknown>): string[] {
  const raw = anime.genres ?? anime.genre;
  const tokens: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') tokens.push(...item.split(/[,/|]+/));
    }
  } else if (typeof raw === 'string') {
    tokens.push(...raw.split(/[,/|]+/));
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const clean = t.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

function matchesFormat(anime: Record<string, unknown>, format?: string): boolean {
  if (!format || format === 'All' || format === 'Any') return true;
  const animeType = String(anime.type || anime.format || 'TV Series').toLowerCase();
  const target = format.toLowerCase();
  if (target === 'movie') return animeType.includes('movie') || animeType.includes('film');
  if (target === 'tv series' || target === 'series') {
    return animeType.includes('tv') || animeType.includes('series') || !animeType.includes('movie');
  }
  if (target.includes('ova') || target.includes('special')) {
    return animeType.includes('ova') || animeType.includes('special') || animeType.includes('ona');
  }
  return animeType.includes(target);
}

/**
 * Strictly filters anime by mandatory verified language & OTT platform criteria,
 * then ranks by honest genre overlap, format match, and verified rating.
 * Returns clear, human-readable reasons for every returned match.
 */
export function filterAndExplainRecommendations<T extends Record<string, unknown>>(
  catalog: T[],
  preferences: RecommendationPreferences
): ExplainedRecommendation<T>[] {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const targetLang =
    preferences.language && preferences.language !== 'All' && preferences.language !== 'Any'
      ? normalizeLanguageName(preferences.language)
      : null;

  const selectedPlatforms = (preferences.platforms || [])
    .map((p) => String(p).trim())
    .filter((p) => p && p !== 'All' && p !== 'Any');

  const preferredGenres = (preferences.genres || [])
    .map((g) => g.trim())
    .filter(Boolean);

  const moodKey = (preferences.mood || '').trim().toLowerCase();
  const moodGenres = moodKey && MOOD_GENRE_MAP[moodKey] ? MOOD_GENRE_MAP[moodKey] : [];

  const desiredGenres = Array.from(new Set([...preferredGenres, ...moodGenres]));
  const desiredGenresLower = new Set(desiredGenres.map((g) => g.toLowerCase()));

  const results: ExplainedRecommendation<T>[] = [];

  for (const anime of safeCatalog) {
    const verifiedLanguages = parseAnimeLanguages(anime);
    const verifiedPlatforms = extractAnimePlatformsNormalized(anime);
    const animeGenres = parseAnimeGenres(anime);

    // 1. Mandatory verified language filter
    if (targetLang) {
      const hasLang = verifiedLanguages.some(
        (l) => l.toLowerCase() === targetLang.toLowerCase()
      );
      if (!hasLang) continue;
    }

    // 2. Mandatory selected OTT platform filter
    if (selectedPlatforms.length > 0) {
      if (!matchesSelectedPlatforms(anime, selectedPlatforms)) continue;
    }

    // 3. Mandatory format filter (if explicitly chosen)
    if (!matchesFormat(anime, preferences.format)) continue;

    // 4. Build honest, explainable reasons
    const reasons: string[] = [];
    let relevancePoints = 0;

    if (targetLang) {
      reasons.push(`Verified ${targetLang} dub`);
      relevancePoints += 30;
    } else if (verifiedLanguages.length > 0) {
      reasons.push(`Available in ${verifiedLanguages.slice(0, 3).join(', ')}`);
      relevancePoints += 10;
    }

    if (selectedPlatforms.length > 0) {
      const matchedPlats = verifiedPlatforms.filter((vp) =>
        matchesSelectedPlatforms({ platform: vp }, selectedPlatforms)
      );
      if (matchedPlats.length > 0) {
        reasons.push(`Streams on ${matchedPlats[0]}`);
      } else {
        reasons.push(`Streams on ${selectedPlatforms[0]}`);
      }
      relevancePoints += 25;
    } else if (verifiedPlatforms.length > 0) {
      reasons.push(`Streams on ${verifiedPlatforms[0]}`);
    }

    const matchedGenres = animeGenres.filter((g) =>
      desiredGenresLower.has(g.toLowerCase())
    );
    if (matchedGenres.length > 0) {
      reasons.push(
        matchedGenres.length === 1
          ? `Matches ${matchedGenres[0]} genre`
          : `Matches ${matchedGenres.slice(0, 2).join(' & ')} genres`
      );
      relevancePoints += matchedGenres.length * 15;
    } else if (desiredGenres.length > 0 && preferredGenres.length > 0) {
      // If user explicitly picked specific genres and none match, still keep if language/OTT matched,
      // but rank lower than genre matches
      relevancePoints -= 5;
    }

    const numericRating = Number(anime.rating);
    if (Number.isFinite(numericRating) && numericRating > 0) {
      relevancePoints += numericRating;
      if (numericRating >= 8.3 && reasons.length < 3) {
        reasons.push(`Rated ${numericRating.toFixed(1)}/10`);
      }
    }

    if (preferences.format && preferences.format !== 'All' && preferences.format !== 'Any' && reasons.length < 3) {
      reasons.push(`${preferences.format} format`);
    }

    results.push({
      anime,
      reasons: reasons.slice(0, 3),
      matchedGenres,
      verifiedLanguages,
      verifiedPlatforms,
      relevancePoints,
    });
  }

  results.sort((a, b) => {
    if (b.relevancePoints !== a.relevancePoints) {
      return b.relevancePoints - a.relevancePoints;
    }
    const ratingDiff = (Number(b.anime.rating) || 0) - (Number(a.anime.rating) || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return String(a.anime.title || '').localeCompare(String(b.anime.title || ''));
  });

  const limit = preferences.limit && preferences.limit > 0 ? preferences.limit : results.length;
  return results.slice(0, limit);
}

/**
 * Computes honest "More Like This" recommendations based on shared genres,
 * shared verified Indian dub languages, and shared OTT platform — zero fake match%.
 */
export function buildSimilarAnimeRecommendations<T extends Record<string, unknown>>(
  currentAnime: Record<string, unknown>,
  catalog: T[],
  limit = 6
): ExplainedRecommendation<T>[] {
  if (!currentAnime || !Array.isArray(catalog) || catalog.length === 0) return [];

  const currentId = String(currentAnime.id ?? '');
  const currentTitle = String(currentAnime.title ?? '').trim().toLowerCase();
  const currentGenres = new Set(parseAnimeGenres(currentAnime).map((g) => g.toLowerCase()));
  const currentLangs = new Set(parseAnimeLanguages(currentAnime).map((l) => l.toLowerCase()));
  const currentPlatforms = new Set(
    extractAnimePlatformsNormalized(currentAnime).map((p) => p.toLowerCase())
  );

  const scored: ExplainedRecommendation<T>[] = [];

  for (const item of catalog) {
    if (String(item.id ?? '') === currentId) continue;
    if (currentTitle && String(item.title ?? '').trim().toLowerCase() === currentTitle) continue;

    const itemGenres = parseAnimeGenres(item);
    const itemLangs = parseAnimeLanguages(item);
    const itemPlatforms = extractAnimePlatformsNormalized(item);

    const sharedGenres = itemGenres.filter((g) => currentGenres.has(g.toLowerCase()));
    const sharedLangs = itemLangs.filter((l) => currentLangs.has(l.toLowerCase()));
    const sharedPlatforms = itemPlatforms.filter((p) => currentPlatforms.has(p.toLowerCase()));

    const points =
      sharedGenres.length * 15 +
      sharedLangs.length * 8 +
      sharedPlatforms.length * 5 +
      (Number(item.rating) || 0);

    if (sharedGenres.length === 0 && sharedLangs.length === 0) continue;

    const reasons: string[] = [];
    if (sharedGenres.length > 0) {
      reasons.push(`Similar ${sharedGenres.slice(0, 2).join(' & ')}`);
    }
    if (sharedLangs.length > 0) {
      reasons.push(`Also dubbed in ${sharedLangs.slice(0, 2).join(', ')}`);
    }
    if (sharedPlatforms.length > 0 && reasons.length < 3) {
      reasons.push(`Also on ${sharedPlatforms[0]}`);
    }

    scored.push({
      anime: item,
      reasons,
      matchedGenres: sharedGenres,
      verifiedLanguages: itemLangs,
      verifiedPlatforms: itemPlatforms,
      relevancePoints: points,
    });
  }

  scored.sort((a, b) => b.relevancePoints - a.relevancePoints);
  return scored.slice(0, limit);
}
