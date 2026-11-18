export interface MixedEntryLike {
  type?: string;
  entryType?: string;
  name?: string;
  episodes?: number | string | null;
  episodeCount?: number | string | null;
}

/**
 * Normalizes a platform string or array of platform names by splitting on `|` or `,`,
 * trimming and collapsing whitespace, deduplicating case-insensitively (preserving
 * first-seen casing), sorting alphabetically, and rejoining with `|`.
 */
export function normalizePlatformString(rawPlatform: unknown): string {
  const rawTokens: string[] = [];

  if (Array.isArray(rawPlatform)) {
    for (const item of rawPlatform) {
      if (item !== null && item !== undefined) {
        rawTokens.push(...String(item).split(/[|,]/));
      }
    }
  } else if (typeof rawPlatform === 'string') {
    rawTokens.push(...rawPlatform.split(/[|,]/));
  } else if (rawPlatform !== null && rawPlatform !== undefined) {
    rawTokens.push(...String(rawPlatform).split(/[|,]/));
  }

  const deduped = new Map<string, string>();
  for (const token of rawTokens) {
    const cleaned = token.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, cleaned);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .join('|');
}

/**
 * Splits a single or array platform representation (`"Crunchyroll|Netflix"`,
 * `"Crunchyroll, Netflix"`, `"Netflix / JioCinema"`, `"Crunchyroll • Netflix"`,
 * or `platforms_data` partner lists) into an ordered, case-insensitively
 * deduplicated list of clean platform names.
 */
export function parsePlatformList(
  rawPlatform: unknown,
  rawPlatforms?: unknown,
  rawPlatformsData?: unknown,
  options: { defaultFallback?: string[] } = {}
): string[] {
  const deduped = new Map<string, string>();
  const pushToken = (val: unknown) => {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      val.forEach(pushToken);
      return;
    }
    if (typeof val === 'object') {
      const rec = val as Record<string, unknown>;
      pushToken(rec.name ?? rec.platform);
      return;
    }
    const text = String(val);
    for (const part of text.split(/[|,•/]+/)) {
      const cleaned = part.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, cleaned);
      }
    }
  };

  pushToken(rawPlatforms);
  pushToken(rawPlatform);

  if (rawPlatformsData) {
    const parsedPartners = normalizeStreamingPartners(rawPlatformsData);
    for (const partner of parsedPartners) {
      pushToken(partner.name || partner.platform);
    }
  }

  if (deduped.size === 0 && Array.isArray(options.defaultFallback)) {
    return [...options.defaultFallback];
  }
  return Array.from(deduped.values());
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Parses an optional release season string from either a row/body object or a raw value.
 * Returns `null` when omitted or blank instead of hardcoding `'Spring'`.
 */
export function parseOptionalSeason(input: unknown, maxLen = 50): string | null {
  const rawCandidate = isPlainRecord(input)
    ? input.season ??
      input.Season ??
      input.release_season ??
      input['Release Season'] ??
      input.releaseSeason ??
      input.ReleaseSeason
    : input;

  if (rawCandidate === null || rawCandidate === undefined) return null;
  const cleaned = String(rawCandidate)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

/**
 * Parses an optional positive integer episode count from either a row/body object
 * or a raw value, optionally falling back to summing positive `mixedEntries` counts.
 * Returns `null` when omitted or blank instead of hardcoding `12`.
 */
export function parseOptionalEpisodesCount(
  input: unknown,
  mixedEntries?: MixedEntryLike[] | null
): number | null {
  const rawCandidate = isPlainRecord(input)
    ? input.episodes_count ??
      input.Episodes ??
      input.episodes ??
      input.episodesCount ??
      input.episode_count ??
      input.totalEpisodes ??
      input['Total Episodes']
    : input;

  if (rawCandidate !== null && rawCandidate !== undefined) {
    if (typeof rawCandidate === 'number') {
      if (Number.isFinite(rawCandidate) && rawCandidate > 0) {
        return Math.floor(rawCandidate);
      }
    } else {
      const trimmed = String(rawCandidate).trim();
      if (trimmed !== '') {
        const parsed = parseInt(trimmed, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
  }

  if (Array.isArray(mixedEntries) && mixedEntries.length > 0) {
    let total = 0;
    let hasPositive = false;
    for (const entry of mixedEntries) {
      const epRaw = entry?.episodes ?? entry?.episodeCount;
      if (epRaw === null || epRaw === undefined || String(epRaw).trim() === '') continue;
      const epNum = Number(epRaw);
      if (Number.isFinite(epNum) && epNum > 0) {
        total += Math.floor(epNum);
        hasPositive = true;
      }
    }
    if (hasPositive) return total;
  }

  return null;
}

/**
 * Parses CSV `Seasons` (`Season 1:26|Season 2:11`) or pre-parsed `mixed_entries`
 * and computes `episodes_per_season` without injecting fake `12` defaults.
 */
export function parseCsvMixedEntriesAndEpisodesPerSeason(
  rawSeasons: unknown,
  rawEntries: unknown,
  rawEpisodesPerSeason?: unknown
): {
  mixedEntries: Array<{ type: string; name: string; episodes: number | null }>;
  episodesPerSeason: string;
} {
  let mixedEntries: Array<{ type: string; name: string; episodes: number | null }> = [];

  if (Array.isArray(rawEntries)) {
    mixedEntries = rawEntries
      .map((entry: MixedEntryLike) => {
        const name = String(entry?.name || '').trim();
        const epRaw = entry?.episodes ?? entry?.episodeCount;
        const parsedEp =
          epRaw !== null && epRaw !== undefined && String(epRaw).trim() !== ''
            ? parseInt(String(epRaw), 10)
            : NaN;
        return {
          type: String(entry?.type || entry?.entryType || 'Season').trim() || 'Season',
          name,
          episodes: Number.isFinite(parsedEp) && parsedEp > 0 ? parsedEp : null,
        };
      })
      .filter((e) => e.name !== '');
  } else if (typeof rawSeasons === 'string' && rawSeasons.trim().length > 0) {
    mixedEntries = rawSeasons
      .split('|')
      .map((entry) => {
        const [name, eps] = entry.split(':');
        const parsedEp = eps !== undefined && eps.trim() !== '' ? parseInt(eps.trim(), 10) : NaN;
        return {
          type: 'Season',
          name: name ? name.trim() : '',
          episodes: Number.isFinite(parsedEp) && parsedEp > 0 ? parsedEp : null,
        };
      })
      .filter((e) => e.name !== '');
  }

  const numericSeasonEps = mixedEntries
    .map((e) => (e.episodes !== null && e.episodes > 0 ? String(e.episodes) : ''))
    .filter(Boolean);

  let episodesPerSeason = '';
  if (numericSeasonEps.length > 0) {
    episodesPerSeason = numericSeasonEps.join('|');
  } else if (typeof rawEpisodesPerSeason === 'string' && rawEpisodesPerSeason.trim() !== '') {
    episodesPerSeason = rawEpisodesPerSeason.trim();
  }

  return { mixedEntries, episodesPerSeason };
}

export interface NormalizedStreamingPartner {
  name: string;
  platform: string;
  url: string;
  languages: string[];
}

/**
 * Normalizes a per-platform languages value (array or comma/pipe-delimited string)
 * into a deduplicated array of clean language names, preserving insertion order.
 */
export function normalizePartnerLanguages(rawLanguages: unknown): string[] {
  const rawTokens: string[] = [];
  if (Array.isArray(rawLanguages)) {
    for (const item of rawLanguages) {
      if (item !== null && item !== undefined) {
        rawTokens.push(...String(item).split(/[,/|]+/));
      }
    }
  } else if (typeof rawLanguages === 'string') {
    rawTokens.push(...rawLanguages.split(/[,/|]+/));
  }

  const deduped = new Map<string, string>();
  for (const token of rawTokens) {
    const cleaned = token.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, cleaned);
    }
  }
  return Array.from(deduped.values());
}

/**
 * Normalizes nested streaming partner payloads (JSON string or array of objects)
 * so every platform item preserves its name, platform alias, url, and languages array.
 */
export function normalizeStreamingPartners(rawPartners: unknown): NormalizedStreamingPartner[] {
  let list: unknown[] = [];
  if (Array.isArray(rawPartners)) {
    list = rawPartners;
  } else if (typeof rawPartners === 'string' && rawPartners.trim()) {
    try {
      const parsed = JSON.parse(rawPartners) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    } catch {
      return [];
    }
  }

  const normalized: NormalizedStreamingPartner[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rawName = String(rec.name ?? rec.platform ?? '').replace(/<[^>]*>/g, '').trim();
    const rawUrl = String(rec.url ?? rec.watch_url ?? rec.link ?? '').trim();
    const languages = normalizePartnerLanguages(rec.languages);
    if (!rawName && !rawUrl && languages.length === 0) continue;
    const resolvedName = rawName || 'Crunchyroll';
    normalized.push({
      name: resolvedName,
      platform: resolvedName,
      url: rawUrl,
      languages,
    });
  }
  return normalized;
}

/**
 * Computes a deduplicated comma-separated global languages string across all
 * streaming partner entries for catalog filtering and summary stats.
 */
export function deriveAggregateLanguagesFromPartners(partners: NormalizedStreamingPartner[]): string {
  const deduped = new Map<string, string>();
  for (const partner of partners) {
    for (const lang of partner.languages || []) {
      const cleaned = lang.trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, cleaned);
      }
    }
  }
  return Array.from(deduped.values()).join(', ');
}

export interface StreamingPartnerInput {
  name?: string;
  platform?: string;
  url?: string;
  languages?: string[];
}

/**
 * Serializes streaming partners for backend submission:
 * - When there is only 1 platform, auto-syncs its `languages` array from the
 *   globally selected languages (Mixed Entries 'Available Languages').
 * - When there are 2+ platforms, preserves each platform's own selected
 *   `languages` array and derives the global dubs union across all platforms.
 */
export function buildStreamingPartnersPayload(
  partners: StreamingPartnerInput[],
  globalLanguages: string[],
  defaultPlatform = 'Crunchyroll',
  fallbackLanguages: string[] = ['Tamil', 'Hindi']
): {
  serializedPartners: NormalizedStreamingPartner[];
  derivedGlobalDubs: string[];
} {
  const cleanGlobalLangs = normalizePartnerLanguages(globalLanguages);
  const cleanFallback = normalizePartnerLanguages(fallbackLanguages);
  const resolvedGlobalOrFallback =
    cleanGlobalLangs.length > 0 ? cleanGlobalLangs : cleanFallback;

  if (!Array.isArray(partners) || partners.length === 0) {
    return {
      serializedPartners: [],
      derivedGlobalDubs: resolvedGlobalOrFallback,
    };
  }

  if (partners.length === 1) {
    const p = partners[0] || {};
    const resolvedName =
      String(p.name || p.platform || defaultPlatform).trim() || defaultPlatform;
    return {
      serializedPartners: [
        {
          name: resolvedName,
          platform: resolvedName,
          url: String(p.url || '').trim(),
          languages: resolvedGlobalOrFallback,
        },
      ],
      derivedGlobalDubs: resolvedGlobalOrFallback,
    };
  }

  const serializedPartners: NormalizedStreamingPartner[] = partners.map((p) => {
    const resolvedName =
      String(p?.name || p?.platform || defaultPlatform).trim() || defaultPlatform;
    return {
      name: resolvedName,
      platform: resolvedName,
      url: String(p?.url || '').trim(),
      languages: normalizePartnerLanguages(p?.languages),
    };
  });

  const partnerLanguages = normalizePartnerLanguages(
    serializedPartners.flatMap((p) => p.languages)
  );
  const derivedGlobalDubs =
    partnerLanguages.length > 0 ? partnerLanguages : resolvedGlobalOrFallback;

  return {
    serializedPartners,
    derivedGlobalDubs,
  };
}

export const CANONICAL_BROADCAST_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type CanonicalBroadcastDay = (typeof CANONICAL_BROADCAST_DAYS)[number];

const DAY_ALIAS_MAP: Record<string, CanonicalBroadcastDay> = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday',
};

/**
 * Normalizes a broadcast day value into a canonical English weekday name
 * ('Monday'..'Sunday'), or `null` when omitted, blank, or non-weekday (e.g. 'TBA').
 */
export function normalizeBroadcastDay(rawDay: unknown): CanonicalBroadcastDay | null {
  const rawCandidate = isPlainRecord(rawDay)
    ? rawDay.broadcast_day ??
      rawDay.broadcastDay ??
      rawDay.releaseDay ??
      rawDay.release_day ??
      rawDay['Broadcast Day'] ??
      rawDay['Release Day']
    : rawDay;

  if (rawCandidate === null || rawCandidate === undefined) return null;
  const cleaned = String(rawCandidate)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return null;

  if (DAY_ALIAS_MAP[cleaned]) {
    return DAY_ALIAS_MAP[cleaned];
  }

  for (const [alias, canonical] of Object.entries(DAY_ALIAS_MAP)) {
    if (cleaned.startsWith(`${alias} `) || cleaned.endsWith(` ${alias}`)) {
      return canonical;
    }
  }

  return null;
}

/**
 * Normalizes a verified broadcast air-time string (e.g. '06:30 PM IST').
 * Returns `null` when omitted or blank instead of fabricating a fake default like '08:00 PM IST'.
 */
export function normalizeBroadcastTime(rawTime: unknown, maxLen = 40): string | null {
  const rawCandidate = isPlainRecord(rawTime)
    ? rawTime.broadcast_time ??
      rawTime.broadcastTime ??
      rawTime.airTime ??
      rawTime.air_time ??
      rawTime['Broadcast Time'] ??
      rawTime['Air Time']
    : rawTime;

  if (rawCandidate === null || rawCandidate === undefined) return null;
  const cleaned = String(rawCandidate)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (lower === 'tba' || lower === 'none' || lower === 'null' || lower === 'n/a') {
    return null;
  }
  return cleaned.slice(0, maxLen);
}

/**
 * Normalizes season & episode summary count strings (e.g. '2 Seasons • 24 Episodes')
 * from admin inputs, DB records, or CSV imports.
 */
export function normalizeSeasonEpisodeCount(input: unknown, maxLen = 100): string {
  const rawCandidate = isPlainRecord(input)
    ? input.season_episode_count ??
      input.seasonEpisodeCount ??
      input['Season & Episode Count'] ??
      input['Seasons & Episodes'] ??
      input['Season Episode Count']
    : input;

  if (rawCandidate === null || rawCandidate === undefined) return '';
  const cleaned = String(rawCandidate)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.slice(0, maxLen);
}

/**
 * Normalizes a last-verified date into YYYY-MM-DD format when valid, or '' if empty/invalid.
 */
export function normalizeLastVerifiedDate(input: unknown): string {
  const rawCandidate = isPlainRecord(input)
    ? input.last_verified_date ??
      input.lastVerifiedDate ??
      input['Last Verified Date'] ??
      input['Last Verified']
    : input;

  if (rawCandidate === null || rawCandidate === undefined) return '';
  const cleaned = String(rawCandidate).replace(/<[^>]*>/g, '').trim();
  if (!cleaned) return '';

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    return '';
  }

  const parsedMs = Date.parse(cleaned);
  if (!Number.isFinite(parsedMs)) return '';
  const d = new Date(parsedMs);
  const yyyy = d.getUTCFullYear();
  if (yyyy < 1990 || yyyy > 2100) return '';
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Summarizes Mixed Entries (Seasons, Movies, OVAs, ONAs, Specials) into a concise
 * `season_episode_count` string (e.g. `'2 Seasons • 24 Episodes'`).
 */
export function deriveSeasonEpisodeCountSummary(entries: MixedEntryLike[]): string {
  if (!Array.isArray(entries) || entries.length === 0) return '';

  let seasons = 0;
  let movies = 0;
  let ovas = 0;
  let onas = 0;
  let specials = 0;
  let totalEpisodes = 0;

  for (const entry of entries) {
    if (!entry) continue;
    const rawType = String(entry.entryType || entry.type || 'Season').trim().toLowerCase();
    if (rawType.includes('movie')) movies += 1;
    else if (rawType.includes('ova')) ovas += 1;
    else if (rawType.includes('ona')) onas += 1;
    else if (rawType.includes('special')) specials += 1;
    else seasons += 1;

    const epRaw = entry.episodes ?? entry.episodeCount;
    if (epRaw !== null && epRaw !== undefined && String(epRaw).trim() !== '') {
      const epNum = Number(epRaw);
      if (Number.isFinite(epNum) && epNum > 0) {
        totalEpisodes += Math.floor(epNum);
      }
    }
  }

  const labelParts: string[] = [];
  if (seasons > 0) labelParts.push(`${seasons} ${seasons === 1 ? 'Season' : 'Seasons'}`);
  if (movies > 0) labelParts.push(`${movies} ${movies === 1 ? 'Movie' : 'Movies'}`);
  if (ovas > 0) labelParts.push(`${ovas} ${ovas === 1 ? 'OVA' : 'OVAs'}`);
  if (onas > 0) labelParts.push(`${onas} ${onas === 1 ? 'ONA' : 'ONAs'}`);
  if (specials > 0) labelParts.push(`${specials} ${specials === 1 ? 'Special' : 'Specials'}`);

  if (labelParts.length === 0) return '';

  const isMovieOnlyWithSingleEach =
    movies > 0 &&
    seasons === 0 &&
    ovas === 0 &&
    onas === 0 &&
    specials === 0 &&
    totalEpisodes <= movies;

  const summary =
    totalEpisodes > 0 && !isMovieOnlyWithSingleEach
      ? `${labelParts.join(', ')} • ${totalEpisodes} ${totalEpisodes === 1 ? 'Episode' : 'Episodes'}`
      : labelParts.join(', ');

  return normalizeSeasonEpisodeCount(summary);
}

/**
 * Extracts the primary watch URL from Streaming Partners to populate `official_source_url`.
 */
export function deriveOfficialSourceUrlFromPartners(partners: StreamingPartnerInput[]): string {
  if (!Array.isArray(partners) || partners.length === 0) return '';
  for (const partner of partners) {
    const candidate = String(partner?.url || '').trim();
    if (candidate) return candidate;
  }
  return '';
}


