/**
 * Advanced Smart Filter Engine pure utility for AniDub India.
 * Works identically on the lightweight full catalog index (`/api/anime/index`)
 * and mirrors the server-side SQL filter parameters on `/api/anime`.
 */

import { resolveCanonicalAnimeStatus, isPendingSubmission } from './animeStatus';
import { isFreeLegalStreaming, matchesSelectedPlatforms } from './ottHub';
import { normalizeLanguageName } from './languages';

export type EpisodeLengthBucket = 'any' | '1-13' | '14-26' | '27-100' | '100+';

export interface EpisodeLengthOption {
  id: EpisodeLengthBucket;
  label: string;
  min?: number;
  max?: number;
}

export const EPISODE_LENGTH_OPTIONS: EpisodeLengthOption[] = [
  { id: 'any', label: 'Any length' },
  { id: '1-13', label: '1–13 episodes', min: 1, max: 13 },
  { id: '14-26', label: '14–26 episodes', min: 14, max: 26 },
  { id: '27-100', label: '27–100 episodes', min: 27, max: 100 },
  { id: '100+', label: '100+ episodes', min: 100 },
];

export interface SmartFilterOptions {
  episodeLength?: EpisodeLengthBucket | string;
  minRating?: number;
  fullyDubbedOnly?: boolean;
  verifiedOnly?: boolean;
  freeLegalOnly?: boolean;
  selectedLanguage?: string;
  mySubscriptions?: string[];
  mySubscriptionsEnabled?: boolean;
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  category:
    | 'search'
    | 'language'
    | 'genre'
    | 'platform'
    | 'type'
    | 'status'
    | 'episodeLength'
    | 'minRating'
    | 'fullyDubbedOnly'
    | 'verifiedOnly'
    | 'freeLegalOnly'
    | 'mySubscriptions';
}

export function hasVerifiedOttAvailability(anime: {
  platform?: unknown;
  platforms?: unknown;
  platforms_data?: unknown;
  streaming_partners?: unknown;
  streamUrl?: unknown;
  watch_url?: unknown;
}): boolean {
  const platStr = Array.isArray(anime.platform)
    ? anime.platform.map(String).join(',').trim()
    : String(anime.platform || '').trim();
  if (platStr && platStr.toLowerCase() !== 'not verified' && platStr.toLowerCase() !== 'none') {
    return true;
  }
  const hasPartnerList = (list: unknown) =>
    Array.isArray(list) &&
    list.some((entry: any) => {
      const name = String(entry?.name || entry?.platform || entry || '').trim();
      return Boolean(name && name.toLowerCase() !== 'not verified');
    });
  if (
    hasPartnerList(anime.platforms) ||
    hasPartnerList(anime.platforms_data) ||
    hasPartnerList(anime.streaming_partners)
  ) {
    return true;
  }
  const stream = String(anime.streamUrl || anime.watch_url || '').trim();
  return stream.startsWith('https://');
}

export function matchesEpisodeLengthBucket(
  episodesCount: unknown,
  bucket?: EpisodeLengthBucket | string | null
): boolean {
  const clean = String(bucket || 'any').trim();
  if (!clean || clean === 'any') return true;
  const count = Number(episodesCount);
  if (!Number.isFinite(count) || count <= 0) return false;

  switch (clean) {
    case '1-13':
      return count >= 1 && count <= 13;
    case '14-26':
      return count >= 14 && count <= 26;
    case '27-100':
      return count >= 27 && count <= 100;
    case '100+':
      return count >= 100;
    default:
      return true;
  }
}

export function isFullyDubbedInLanguage(
  anime: {
    status?: string | null;
    airing_status?: string | null;
    languages?: unknown;
    dub_matrix?: unknown;
    episodes_count?: unknown;
  },
  selectedLanguage?: string | null
): boolean {
  const canonical = resolveCanonicalAnimeStatus(anime);
  if (canonical === 'Upcoming') return false;

  const rawLangs = Array.isArray(anime.languages)
    ? anime.languages.map(String).join(',')
    : String(anime.languages || '');
  const normalizedLangs = rawLangs
    .split(/[,/|•+]+/)
    .map((t) => normalizeLanguageName(t))
    .filter(Boolean);

  if (normalizedLangs.length === 0) return false;

  const targetLang =
    selectedLanguage && selectedLanguage !== 'All'
      ? normalizeLanguageName(selectedLanguage)
      : '';

  if (targetLang) {
    const hasLang = normalizedLangs.some((l) => l.toLowerCase() === targetLang.toLowerCase());
    if (!hasLang) return false;
  }

  // If explicit dub_matrix exists with episode counts, verify dubbed >= total for target/any language
  if (anime.dub_matrix && typeof anime.dub_matrix === 'object') {
    const matrix = anime.dub_matrix as Record<string, unknown>;
    const totalEps = Number(anime.episodes_count) || 0;
    if (targetLang) {
      const entry = Object.entries(matrix).find(
        ([k]) => normalizeLanguageName(k).toLowerCase() === targetLang.toLowerCase()
      )?.[1];
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const dubbed = Number(obj.episodes_dubbed ?? obj.episodesDubbed);
        const total = Number(obj.total_episodes ?? obj.totalEpisodes ?? totalEps);
        if (Number.isFinite(dubbed) && Number.isFinite(total) && total > 0) {
          return dubbed >= total;
        }
      }
    }
  }

  // Otherwise, canonical 'Completed' titles with verified regional dub languages qualify as fully dubbed
  return canonical === 'Completed';
}

/**
 * Applies all smart filters (episode length, min rating, fully dubbed only,
 * verified availability only, free legal streaming only, and My Subscriptions) to any anime array.
 */
export function applySmartFilters<
  T extends {
    episodes_count?: number | null;
    episodes?: number | null;
    rating?: number | null;
    status?: string | null;
    airing_status?: string | null;
    submissionStatus?: string | null;
    approval_status?: string | null;
    languages?: unknown;
    platform?: unknown;
    platforms?: unknown;
    platforms_data?: unknown;
    streaming_partners?: unknown;
    streamUrl?: unknown;
    watch_url?: unknown;
    dub_matrix?: unknown;
  },
>(items: T[], options: SmartFilterOptions): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const minRating = Number(options.minRating) || 0;
  const epBucket = (options.episodeLength || 'any') as EpisodeLengthBucket;
  const useSubs = Boolean(options.mySubscriptionsEnabled && options.mySubscriptions && options.mySubscriptions.length > 0);

  return items.filter((anime) => {
    if (!anime || isPendingSubmission(anime)) return false;

    if (epBucket !== 'any') {
      const eps = anime.episodes_count ?? anime.episodes ?? null;
      if (!matchesEpisodeLengthBucket(eps, epBucket)) return false;
    }

    if (minRating > 0) {
      const score = Number(anime.rating) || 0;
      if (score < minRating) return false;
    }

    if (options.fullyDubbedOnly) {
      if (!isFullyDubbedInLanguage(anime, options.selectedLanguage)) return false;
    }

    if (options.verifiedOnly) {
      if (!hasVerifiedOttAvailability(anime)) return false;
    }

    if (options.freeLegalOnly) {
      if (!isFreeLegalStreaming(anime)) return false;
    }

    if (useSubs && options.mySubscriptions) {
      if (!matchesSelectedPlatforms(anime, options.mySubscriptions)) return false;
    }

    return true;
  });
}

export function buildActiveFilterChips(params: {
  search?: string;
  language?: string;
  genre?: string;
  platform?: string;
  type?: string;
  status?: string;
  episodeLength?: EpisodeLengthBucket;
  minRating?: number;
  fullyDubbedOnly?: boolean;
  verifiedOnly?: boolean;
  freeLegalOnly?: boolean;
  mySubscriptionsEnabled?: boolean;
  mySubscriptions?: string[];
}): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (params.search && params.search.trim()) {
    chips.push({ key: 'search', category: 'search', label: `Search: "${params.search.trim()}"` });
  }
  if (params.language && params.language !== 'All') {
    chips.push({ key: 'language', category: 'language', label: `Dub: ${params.language}` });
  }
  if (params.genre && params.genre !== 'All' && params.genre !== 'All Genres') {
    chips.push({ key: 'genre', category: 'genre', label: `Genre: ${params.genre}` });
  }
  if (params.platform && params.platform !== 'All' && params.platform !== 'All Platforms') {
    chips.push({ key: 'platform', category: 'platform', label: `OTT: ${params.platform}` });
  }
  if (params.type && params.type !== 'All' && params.type !== 'All Types') {
    chips.push({ key: 'type', category: 'type', label: `Type: ${params.type}` });
  }
  if (params.status && params.status !== 'All' && params.status !== 'All Status') {
    chips.push({ key: 'status', category: 'status', label: `Status: ${params.status}` });
  }
  if (params.episodeLength && params.episodeLength !== 'any') {
    const opt = EPISODE_LENGTH_OPTIONS.find((o) => o.id === params.episodeLength);
    chips.push({
      key: 'episodeLength',
      category: 'episodeLength',
      label: `Length: ${opt?.label || params.episodeLength}`,
    });
  }
  if (params.minRating && params.minRating > 0) {
    chips.push({
      key: 'minRating',
      category: 'minRating',
      label: `Rating ≥ ${params.minRating.toFixed(1)}/10`,
    });
  }
  if (params.verifiedOnly) {
    chips.push({
      key: 'verifiedOnly',
      category: 'verifiedOnly',
      label: 'Verified Availability Only',
    });
  }
  if (params.fullyDubbedOnly) {
    chips.push({
      key: 'fullyDubbedOnly',
      category: 'fullyDubbedOnly',
      label: 'Fully Dubbed Seasons Only',
    });
  }
  if (params.freeLegalOnly) {
    chips.push({
      key: 'freeLegalOnly',
      category: 'freeLegalOnly',
      label: 'Free Legal Streaming',
    });
  }
  if (params.mySubscriptionsEnabled && params.mySubscriptions && params.mySubscriptions.length > 0) {
    chips.push({
      key: 'mySubscriptions',
      category: 'mySubscriptions',
      label: `My OTTs: ${params.mySubscriptions.join(', ')}`,
    });
  }

  return chips;
}
