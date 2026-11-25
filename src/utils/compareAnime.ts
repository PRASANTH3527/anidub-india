/**
 * Pure side-by-side Anime Comparison (A vs B) utility for AniDub India.
 * Strictly honest: never fabricates dub languages, OTT availability, or episode counts.
 */
import { normalizeCanonicalOttList } from './ottHub';
import { normalizeLanguageName, isExcludedLanguage } from './languages';
import { resolveCanonicalAnimeStatus } from './animeStatus';

export interface ComparableAnimeLike {
  id: number | string;
  slug?: string | null;
  title?: string;
  cover_image?: string;
  cover_url?: string;
  image?: string;
  poster?: string;
  languages?: string | string[];
  platform?: unknown;
  platforms?: unknown;
  platforms_data?: unknown;
  streaming_partners?: unknown;
  episodes_count?: number | null;
  episodes?: number | null;
  season_episode_count?: string | null;
  rating?: number | string | null;
  year?: number | null;
  releaseYear?: number | null;
  status?: string;
  airing_status?: string;
  type?: string;
  genres?: string;
  studio?: string;
}

export interface NormalizedCompareSide {
  id: number;
  slug?: string;
  title: string;
  coverImage: string;
  languages: string[];
  platforms: string[];
  episodesCount: number | null;
  episodesLabel: string;
  rating: number | null;
  ratingLabel: string;
  year: number | null;
  status: string;
  type: string;
  genres: string[];
  studio: string;
}

export interface AnimeComparisonResult {
  left: NormalizedCompareSide;
  right: NormalizedCompareSide;
  sharedLanguages: string[];
  onlyLeftLanguages: string[];
  onlyRightLanguages: string[];
  sharedPlatforms: string[];
  onlyLeftPlatforms: string[];
  onlyRightPlatforms: string[];
  ratingWinner: 'left' | 'right' | 'tie' | 'none';
  languageCountWinner: 'left' | 'right' | 'tie';
}

function extractVerifiedIndianLanguages(rawLangs: unknown): string[] {
  const tokens: string[] = [];
  if (Array.isArray(rawLangs)) {
    for (const item of rawLangs) {
      if (typeof item === 'string') tokens.push(...item.split(/[,/|•+]+/));
    }
  } else if (typeof rawLangs === 'string') {
    tokens.push(...rawLangs.split(/[,/|•+]+/));
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const norm = normalizeLanguageName(token);
    if (!norm || isExcludedLanguage(norm)) continue;
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

export function normalizeCompareSide(anime: ComparableAnimeLike): NormalizedCompareSide {
  const languages = extractVerifiedIndianLanguages(anime.languages);
  const platforms = normalizeCanonicalOttList(anime);

  const rawEp = anime.episodes_count ?? anime.episodes;
  const parsedEp = rawEp !== null && rawEp !== undefined ? Number(rawEp) : NaN;
  const episodesCount = Number.isFinite(parsedEp) && parsedEp > 0 ? Math.floor(parsedEp) : null;
  const episodesLabel =
    episodesCount !== null
      ? `${episodesCount} ${episodesCount === 1 ? 'Episode' : 'Episodes'}`
      : anime.season_episode_count && String(anime.season_episode_count).trim()
        ? String(anime.season_episode_count).trim()
        : 'Count not verified';

  const parsedRating = anime.rating !== null && anime.rating !== undefined ? Number(anime.rating) : NaN;
  const rating = Number.isFinite(parsedRating) && parsedRating > 0 ? Number(parsedRating.toFixed(1)) : null;
  const ratingLabel = rating !== null ? `${rating.toFixed(1)} / 10` : 'Unrated';

  const yearRaw = anime.year ?? anime.releaseYear;
  const year = yearRaw && Number(yearRaw) > 1900 ? Number(yearRaw) : null;

  const genres = String(anime.genres || '')
    .split(/[,/|]+/)
    .map((g) => g.trim())
    .filter(Boolean);

  return {
    id: Number(anime.id) || 0,
    slug: anime.slug || undefined,
    title: String(anime.title || 'Untitled Anime').trim(),
    coverImage: anime.cover_image || anime.cover_url || anime.image || anime.poster || '/logo.png',
    languages,
    platforms,
    episodesCount,
    episodesLabel,
    rating,
    ratingLabel,
    year,
    status: resolveCanonicalAnimeStatus(anime as any),
    type: String(anime.type || 'TV Series').trim(),
    genres,
    studio: String(anime.studio || '').trim() || 'Not verified',
  };
}

export function buildAnimeComparison(
  animeA: ComparableAnimeLike,
  animeB: ComparableAnimeLike
): AnimeComparisonResult {
  const left = normalizeCompareSide(animeA);
  const right = normalizeCompareSide(animeB);

  const rightLangSet = new Set(right.languages);
  const leftLangSet = new Set(left.languages);
  const sharedLanguages = left.languages.filter((l) => rightLangSet.has(l));
  const onlyLeftLanguages = left.languages.filter((l) => !rightLangSet.has(l));
  const onlyRightLanguages = right.languages.filter((l) => !leftLangSet.has(l));

  const rightPlatSet = new Set(right.platforms);
  const leftPlatSet = new Set(left.platforms);
  const sharedPlatforms = left.platforms.filter((p) => rightPlatSet.has(p));
  const onlyLeftPlatforms = left.platforms.filter((p) => !rightPlatSet.has(p));
  const onlyRightPlatforms = right.platforms.filter((p) => !leftPlatSet.has(p));

  let ratingWinner: 'left' | 'right' | 'tie' | 'none' = 'none';
  if (left.rating !== null && right.rating !== null) {
    if (left.rating > right.rating) ratingWinner = 'left';
    else if (right.rating > left.rating) ratingWinner = 'right';
    else ratingWinner = 'tie';
  } else if (left.rating !== null) {
    ratingWinner = 'left';
  } else if (right.rating !== null) {
    ratingWinner = 'right';
  }

  let languageCountWinner: 'left' | 'right' | 'tie' = 'tie';
  if (left.languages.length > right.languages.length) languageCountWinner = 'left';
  else if (right.languages.length > left.languages.length) languageCountWinner = 'right';

  return {
    left,
    right,
    sharedLanguages,
    onlyLeftLanguages,
    onlyRightLanguages,
    sharedPlatforms,
    onlyLeftPlatforms,
    onlyRightPlatforms,
    ratingWinner,
    languageCountWinner,
  };
}
