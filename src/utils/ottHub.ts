/**
 * OTT Intelligence Hub & "My Subscriptions" pure utility for AniDub India.
 * Computes live platform statistics, manages localStorage subscription preferences,
 * and matches anime records across platform aliases cleanly.
 */

import { parsePlatformList } from './dataNormalization';
import {
  readScopedJson,
  readScopedString,
  writeScopedJson,
  writeScopedString,
} from './accountIsolation';

export interface OttPlatformConfig {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  isFreeLegal: boolean;
  aliases: string[];
  accentBg: string;
  accentBorder: string;
  accentText: string;
  badgeText: string;
}

export const MAJOR_INDIAN_OTTS: OttPlatformConfig[] = [
  {
    id: 'Crunchyroll',
    name: 'Crunchyroll',
    shortName: 'CR',
    tagline: 'Largest Hindi, Tamil & Telugu anime simulcast library',
    isFreeLegal: false,
    aliases: ['crunchyroll', 'crunchyroll india'],
    accentBg: 'from-orange-500/20 via-amber-500/10 to-transparent',
    accentBorder: 'border-orange-500/35 hover:border-orange-400/70',
    accentText: 'text-orange-300',
    badgeText: 'Simulcast Hub',
  },
  {
    id: 'Netflix',
    name: 'Netflix',
    shortName: 'NF',
    tagline: 'Global anime originals & films with Indian audio tracks',
    isFreeLegal: false,
    aliases: ['netflix', 'netflix india'],
    accentBg: 'from-red-600/20 via-rose-500/10 to-transparent',
    accentBorder: 'border-red-500/35 hover:border-red-400/70',
    accentText: 'text-red-300',
    badgeText: 'Originals & Movies',
  },
  {
    id: 'JioHotstar',
    name: 'JioHotstar',
    shortName: 'JH',
    tagline: 'Blockbuster shonen & regional family dubbed anime',
    isFreeLegal: false,
    aliases: ['jiohotstar', 'jiocinema', 'hotstar', 'disney+ hotstar', 'disney+'],
    accentBg: 'from-blue-600/20 via-cyan-500/10 to-transparent',
    accentBorder: 'border-blue-500/35 hover:border-blue-400/70',
    accentText: 'text-sky-300',
    badgeText: 'India Streaming',
  },
  {
    id: 'Anime Times',
    name: 'Anime Times',
    shortName: 'AT',
    tagline: 'Curated Japanese & Hindi dub channel on Prime Video',
    isFreeLegal: false,
    aliases: ['anime times', 'animetimes', 'anime times india'],
    accentBg: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    accentBorder: 'border-amber-500/35 hover:border-amber-400/70',
    accentText: 'text-amber-300',
    badgeText: 'Prime Channel',
  },
  {
    id: 'Muse India',
    name: 'Muse India',
    shortName: 'MI',
    tagline: 'Official free legal anime dubs & subs on YouTube',
    isFreeLegal: true,
    aliases: ['muse india', 'muse asia', 'muse', 'youtube'],
    accentBg: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    accentBorder: 'border-emerald-500/35 hover:border-emerald-400/70',
    accentText: 'text-emerald-300',
    badgeText: 'Free Legal',
  },
  {
    id: 'Prime Video',
    name: 'Prime Video',
    shortName: 'PV',
    tagline: 'Regional anime series & theatrical dub releases',
    isFreeLegal: false,
    aliases: ['prime video', 'amazon prime', 'amazon prime video', 'prime'],
    accentBg: 'from-indigo-500/20 via-sky-500/10 to-transparent',
    accentBorder: 'border-indigo-500/35 hover:border-indigo-400/70',
    accentText: 'text-indigo-300',
    badgeText: 'Included w/ Prime',
  },
];

export const FREE_LEGAL_PLATFORM_PATTERNS = [
  'muse india',
  'muse asia',
  'ani-one',
  'anione',
  'ani one',
  'youtube',
] as const;

export const MY_SUBSCRIPTIONS_STORAGE_KEY = 'anidub_my_subscriptions';
export const MY_SUBSCRIPTIONS_ENABLED_KEY = 'anidub_my_subscriptions_enabled';
export const MY_SUBSCRIPTIONS_EVENT = 'anidub:subscriptions-changed';

export interface OttHubItemStat {
  platform: OttPlatformConfig;
  count: number;
  exclusiveCount: number;
  highlights: Array<{
    id: number | string;
    slug?: string | null;
    title: string;
    cover_image?: string;
    rating?: number;
  }>;
}

export const CANONICAL_OTT_FILTER_OPTIONS = [
  'All Platforms',
  'Crunchyroll',
  'Netflix',
  'JioHotstar',
  'Prime Video',
  'Anime Times',
  'Muse India',
  'Ani-One India',
  'YouTube',
  'Sony LIV',
  'Sony YAY!',
  'Zee5',
  'Cartoon Network India',
  'ETV Bal Bharat',
  'Bilibili',
] as const;

const CANONICAL_OTT_ALIAS_MAP: Record<string, string> = {
  crunchyroll: 'Crunchyroll',
  'crunchyroll india': 'Crunchyroll',
  netflix: 'Netflix',
  'netflix india': 'Netflix',
  jiohotstar: 'JioHotstar',
  'jio hotstar': 'JioHotstar',
  jiocinema: 'JioHotstar',
  'jio cinema': 'JioHotstar',
  hotstar: 'JioHotstar',
  'disney+ hotstar': 'JioHotstar',
  'disney+hotstar': 'JioHotstar',
  'disney hotstar': 'JioHotstar',
  'disney+': 'JioHotstar',
  'prime video': 'Prime Video',
  'amazon prime': 'Prime Video',
  'amazon prime video': 'Prime Video',
  primevideo: 'Prime Video',
  prime: 'Prime Video',
  'anime times': 'Anime Times',
  animetimes: 'Anime Times',
  'anime times india': 'Anime Times',
  'muse india': 'Muse India',
  'youtube (muse india)': 'Muse India',
  'muse asia': 'Muse India',
  muse: 'Muse India',
  'ani-one': 'Ani-One India',
  'ani-one india': 'Ani-One India',
  'anione india': 'Ani-One India',
  anione: 'Ani-One India',
  'youtube (ani-one)': 'Ani-One India',
  'youtube (ani-one india)': 'Ani-One India',
  youtube: 'YouTube',
  'sony liv': 'Sony LIV',
  sonyliv: 'Sony LIV',
  'sony yay': 'Sony YAY!',
  'sony yay!': 'Sony YAY!',
  zee5: 'Zee5',
  bilibili: 'Bilibili',
  'cartoon network india': 'Cartoon Network India',
  'etv bal bharat': 'ETV Bal Bharat',
};

/**
 * Normalizes legacy/variant OTT platform names (e.g. JioCinema, Disney+ Hotstar -> JioHotstar;
 * Amazon Prime Video -> Prime Video; SonyLIV -> Sony LIV) into consistent canonical labels.
 * Strictly returns '' for empty, unknown placeholder, or unverified values — never fabricates a platform.
 */
export function normalizeCanonicalOttName(rawName: unknown): string {
  if (rawName === null || rawName === undefined) return '';
  const cleaned = String(rawName)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const lower = cleaned.toLowerCase();
  if (
    lower === 'unknown' ||
    lower === 'tba' ||
    lower === 'n/a' ||
    lower === 'none' ||
    lower === 'not verified' ||
    lower === 'unverified'
  ) {
    return '';
  }
  return CANONICAL_OTT_ALIAS_MAP[lower] || cleaned;
}

/**
 * Extracts and deduplicates canonical OTT platform labels for an anime record.
 * Returns an empty array [] if no verified platform data is present (never defaults to Crunchyroll).
 */
export function normalizeCanonicalOttList(anime: {
  platform?: unknown;
  platforms?: unknown;
  platforms_data?: unknown;
  streaming_partners?: unknown;
}): string[] {
  const rawList = parsePlatformList(
    anime.platform,
    anime.platforms,
    anime.platforms_data ?? anime.streaming_partners,
    { defaultFallback: [] }
  );
  const seen = new Set<string>();
  const canonical: string[] = [];
  for (const raw of rawList) {
    const norm = normalizeCanonicalOttName(raw);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      canonical.push(norm);
    }
  }
  return canonical;
}

export function extractAnimePlatformsNormalized(anime: {
  platform?: unknown;
  platforms?: unknown;
  platforms_data?: unknown;
  streaming_partners?: unknown;
}): string[] {
  return normalizeCanonicalOttList(anime);
}

export function matchesPlatformConfig(animePlatforms: string[], config: OttPlatformConfig): boolean {
  if (!animePlatforms.length) return false;
  return animePlatforms.some((raw) => {
    const lower = raw.trim().toLowerCase();
    return config.aliases.some((alias) => lower === alias || lower.includes(alias));
  });
}

export function getPlatformSqlAliases(platformName: string): string[] {
  const lower = platformName.trim().toLowerCase();
  const matched = MAJOR_INDIAN_OTTS.find(
    (p) =>
      p.id.toLowerCase() === lower ||
      p.name.toLowerCase() === lower ||
      p.aliases.some((a) => a === lower)
  );
  if (matched) return [...matched.aliases];
  return [lower];
}

export function matchesSelectedPlatforms(
  anime: {
    platform?: unknown;
    platforms?: unknown;
    platforms_data?: unknown;
    streaming_partners?: unknown;
  },
  selectedPlatforms: string[]
): boolean {
  if (!Array.isArray(selectedPlatforms) || selectedPlatforms.length === 0) return true;
  const animePlatforms = extractAnimePlatformsNormalized(anime);
  if (animePlatforms.length === 0) return false;

  const lowerAnimePlatforms = animePlatforms.map((p) => p.toLowerCase());
  return selectedPlatforms.some((sel) => {
    const aliases = getPlatformSqlAliases(sel);
    return lowerAnimePlatforms.some((ap) =>
      aliases.some((alias) => ap === alias || ap.includes(alias))
    );
  });
}

export function isFreeLegalStreaming(anime: {
  platform?: unknown;
  platforms?: unknown;
  platforms_data?: unknown;
  streaming_partners?: unknown;
}): boolean {
  const platforms = extractAnimePlatformsNormalized(anime);
  return platforms.some((p) => {
    const lower = p.toLowerCase();
    return FREE_LEGAL_PLATFORM_PATTERNS.some((pat) => lower.includes(pat));
  });
}

export function computeOttHubStats<
  T extends {
    id: number | string;
    slug?: string | null;
    title: string;
    cover_image?: string;
    cover_url?: string;
    rating?: number;
    popularity?: number;
    platform?: unknown;
    platforms?: unknown;
    platforms_data?: unknown;
    streaming_partners?: unknown;
  },
>(catalog: T[]): OttHubItemStat[] {
  const safeList = Array.isArray(catalog) ? catalog : [];

  // Pre-extract platforms per anime once
  const enriched = safeList.map((anime) => ({
    anime,
    platforms: extractAnimePlatformsNormalized(anime),
  }));

  return MAJOR_INDIAN_OTTS.map((config) => {
    const matching = enriched.filter((entry) => matchesPlatformConfig(entry.platforms, config));
    const exclusive = matching.filter((entry) => entry.platforms.length === 1);

    // Pick top 3 highlights by rating/popularity (preferring exclusives first)
    const sorted = [...matching].sort((a, b) => {
      const aExcl = a.platforms.length === 1 ? 1 : 0;
      const bExcl = b.platforms.length === 1 ? 1 : 0;
      if (bExcl !== aExcl) return bExcl - aExcl;
      const popDiff = (Number(b.anime.popularity) || 0) - (Number(a.anime.popularity) || 0);
      if (popDiff !== 0) return popDiff;
      return (Number(b.anime.rating) || 0) - (Number(a.anime.rating) || 0);
    });

    const highlights = sorted.slice(0, 3).map(({ anime }) => ({
      id: anime.id,
      slug: anime.slug ?? null,
      title: anime.title,
      cover_image: anime.cover_image || anime.cover_url || '/logo.png',
      rating: Number(anime.rating) || 0,
    }));

    return {
      platform: config,
      count: matching.length,
      exclusiveCount: exclusive.length,
      highlights,
    };
  });
}

export function readMySubscriptions(userId?: string | null): string[] {
  try {
    const parsed = readScopedJson<unknown>(MY_SUBSCRIPTIONS_STORAGE_KEY, [], userId);
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(MAJOR_INDIAN_OTTS.map((p) => p.id));
    return Array.from(
      new Set(
        parsed
          .map((item) => normalizeCanonicalOttName(item) || String(item))
          .filter((id) => validIds.has(id))
      )
    );
  } catch {
    return [];
  }
}

export function writeMySubscriptions(platforms: string[], userId?: string | null): string[] {
  const validIds = new Set(MAJOR_INDIAN_OTTS.map((p) => p.id));
  const clean = Array.from(
    new Set(
      (platforms || [])
        .map((item) => normalizeCanonicalOttName(item) || String(item))
        .filter((id) => validIds.has(id))
    )
  );
  try {
    writeScopedJson(MY_SUBSCRIPTIONS_STORAGE_KEY, clean, userId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MY_SUBSCRIPTIONS_EVENT, { detail: { platforms: clean } }));
    }
  } catch {}
  return clean;
}

export function readMySubscriptionsEnabled(userId?: string | null): boolean {
  try {
    return readScopedString(MY_SUBSCRIPTIONS_ENABLED_KEY, userId, 'false') === 'true';
  } catch {
    return false;
  }
}

export function writeMySubscriptionsEnabled(enabled: boolean, userId?: string | null): boolean {
  const val = Boolean(enabled);
  try {
    writeScopedString(MY_SUBSCRIPTIONS_ENABLED_KEY, val ? 'true' : 'false', userId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MY_SUBSCRIPTIONS_EVENT, { detail: { enabled: val } }));
    }
  } catch {}
  return val;
}

export interface SubscriptionCoverageResult {
  language: string;
  selectedPlatforms: string[];
  coveredCount: number;
  totalCount: number;
  percentage: number;
}

/**
 * Calculates exact percentage and count of dubbed anime (for a given language or all languages)
 * covered by the user's selected OTT subscriptions.
 */
export function calculateSubscriptionCoverage<
  T extends {
    languages?: unknown;
    platform?: unknown;
    platforms?: unknown;
    platforms_data?: unknown;
    streaming_partners?: unknown;
  },
>(
  catalog: T[],
  selectedPlatforms: string[],
  language = 'All'
): SubscriptionCoverageResult {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const cleanLang = (language || 'All').trim();
  const filterByLang = cleanLang && cleanLang.toLowerCase() !== 'all';

  const matchingLangCatalog = filterByLang
    ? safeCatalog.filter((anime) => {
        const raw = anime.languages;
        const langStr = Array.isArray(raw) ? raw.join(',') : String(raw || '');
        return langStr.toLowerCase().includes(cleanLang.toLowerCase());
      })
    : safeCatalog;

  const totalCount = matchingLangCatalog.length;
  const cleanSelected = Array.isArray(selectedPlatforms)
    ? selectedPlatforms.map(String).filter(Boolean)
    : [];

  if (totalCount === 0 || cleanSelected.length === 0) {
    return {
      language: filterByLang ? cleanLang : 'All Indian',
      selectedPlatforms: cleanSelected,
      coveredCount: 0,
      totalCount,
      percentage: 0,
    };
  }

  const coveredCount = matchingLangCatalog.filter((anime) =>
    matchesSelectedPlatforms(anime, cleanSelected)
  ).length;
  const percentage = Math.round((coveredCount / totalCount) * 100);

  return {
    language: filterByLang ? cleanLang : 'All Indian',
    selectedPlatforms: cleanSelected,
    coveredCount,
    totalCount,
    percentage,
  };
}

