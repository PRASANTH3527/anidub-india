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

export const CANONICAL_STREAMING_PLATFORMS = [
  'Crunchyroll',
  'Netflix',
  'JioCinema',
  'JioHotstar',
  'YouTube',
  'YouTube (Muse India)',
  'YouTube (Ani-One)',
  'YouTube (Ani-One India)',
  'Disney+ Hotstar',
  'Prime Video',
  'Anime Times',
  'Sony YAY!',
  'Sony LIV',
  'Bilibili',
  'Cartoon Network India',
  'ETV Bal Bharat',
  'Zee5',
] as const;

const CANONICAL_PLATFORM_LOOKUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const name of CANONICAL_STREAMING_PLATFORMS) {
    map[name.toLowerCase()] = name;
  }
  // Unambiguous spacing/naming aliases
  map['amazon prime'] = 'Prime Video';
  map['amazon prime video'] = 'Prime Video';
  map['primevideo'] = 'Prime Video';
  map['jio hotstar'] = 'JioHotstar';
  map['jio cinema'] = 'JioCinema';
  map['disney hotstar'] = 'Disney+ Hotstar';
  map['disney+hotstar'] = 'Disney+ Hotstar';
  map['sony yay'] = 'Sony YAY!';
  map['sonyliv'] = 'Sony LIV';
  map['muse india'] = 'YouTube (Muse India)';
  map['ani-one india'] = 'YouTube (Ani-One India)';
  map['anione india'] = 'YouTube (Ani-One India)';
  return map;
})();

/**
 * Trims, collapses whitespace, and matches a platform name case-insensitively
 * against the canonical UI dropdown options in DubInfoModal.
 */
export function matchCanonicalPlatformName(rawName: unknown): string {
  if (rawName === null || rawName === undefined) return '';
  const cleaned = String(rawName)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return CANONICAL_PLATFORM_LOOKUP[cleaned.toLowerCase()] ?? cleaned;
}

/**
 * Parses a CSV `platforms` cell supporting:
 * - Multi-platform with URLs: `PlatformName::URL|PlatformName2::URL2`
 * - Single platform with URL: `Prime Video::https://www.primevideo.com/detail/xyz`
 * - Backward-compatible single or pipe/comma-separated names without URLs: `Crunchyroll`, `JioHotstar|Crunchyroll`, `Netflix, Crunchyroll`
 * - Already-structured partner arrays or JSON strings
 *
 * Trims names and URLs, matches platform names case-insensitively to canonical UI options,
 * and returns the exact partner array structure used by D1 and DubInfoModal.
 */
export function parseCsvPlatformsField(
  rawInput: unknown,
  fallbackLanguages?: unknown,
  fallbackWatchUrl?: unknown
): {
  partners: NormalizedStreamingPartner[];
  platformString: string;
  primaryUrl: string;
} {
  const cleanLangs = normalizePartnerLanguages(fallbackLanguages);
  const cleanFallbackUrl =
    typeof fallbackWatchUrl === 'string' ? fallbackWatchUrl.trim() : '';

  const deduped = new Map<string, NormalizedStreamingPartner>();
  const upsertPartner = (rawName: unknown, rawUrl: unknown, rawLangs?: unknown) => {
    const canonicalName = matchCanonicalPlatformName(rawName);
    if (!canonicalName) return;
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : String(rawUrl ?? '').trim();
    const explicitLangs = normalizePartnerLanguages(rawLangs);
    const languages = explicitLangs.length > 0 ? explicitLangs : [...cleanLangs];
    const key = canonicalName.toLowerCase();
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, {
        name: canonicalName,
        platform: canonicalName,
        url,
        languages,
      });
    } else {
      if (!existing.url && url) {
        existing.url = url;
      }
      if (existing.languages.length === 0 && languages.length > 0) {
        existing.languages = languages;
      }
    }
  };

  let handledStructured = false;
  if (Array.isArray(rawInput)) {
    handledStructured = true;
    const normalized = normalizeStreamingPartners(rawInput);
    for (const p of normalized) {
      upsertPartner(p.name || p.platform, p.url, p.languages);
    }
  } else if (typeof rawInput === 'string' && rawInput.trim().startsWith('[')) {
    const normalized = normalizeStreamingPartners(rawInput);
    if (normalized.length > 0) {
      handledStructured = true;
      for (const p of normalized) {
        upsertPartner(p.name || p.platform, p.url, p.languages);
      }
    }
  }

  if (!handledStructured && typeof rawInput === 'string' && rawInput.trim()) {
    const text = rawInput.trim();
    const segments = text.includes('::') ? text.split('|') : text.split(/[|,]/);
    for (const seg of segments) {
      const trimmedSeg = seg.trim();
      if (!trimmedSeg) continue;
      const sepIdx = trimmedSeg.indexOf('::');
      if (sepIdx !== -1) {
        const rawName = trimmedSeg.slice(0, sepIdx);
        const rawUrl = trimmedSeg.slice(sepIdx + 2);
        upsertPartner(rawName, rawUrl);
      } else {
        upsertPartner(trimmedSeg, '');
      }
    }
  }

  const partners = Array.from(deduped.values());
  if (partners.length === 1 && !partners[0].url && cleanFallbackUrl) {
    partners[0].url = cleanFallbackUrl;
  }

  const platformString = normalizePlatformString(partners.map((p) => p.name));
  const primaryUrl = deriveOfficialSourceUrlFromPartners(partners) || cleanFallbackUrl;

  return {
    partners,
    platformString,
    primaryUrl,
  };
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
    const trimmed = rawPartners.trim();
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object') {
        list = Object.entries(parsed as Record<string, unknown>).map(([k, v]) => {
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            return { name: k, ...(v as Record<string, unknown>) };
          }
          return { name: k, url: typeof v === 'string' ? v : '' };
        });
      }
    } catch {
      if (trimmed.includes('::')) {
        const segments = trimmed.split('|');
        for (const seg of segments) {
          const cleanSeg = seg.trim();
          if (!cleanSeg) continue;
          const idx = cleanSeg.indexOf('::');
          if (idx !== -1) {
            list.push({
              name: cleanSeg.slice(0, idx).trim(),
              url: cleanSeg.slice(idx + 2).trim(),
            });
          } else {
            list.push({ name: cleanSeg, url: '' });
          }
        }
      } else {
        return [];
      }
    }
  } else if (rawPartners && typeof rawPartners === 'object') {
    list = Object.entries(rawPartners as Record<string, unknown>).map(([k, v]) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return { name: k, ...(v as Record<string, unknown>) };
      }
      return { name: k, url: typeof v === 'string' ? v : '' };
    });
  }

  const normalized: NormalizedStreamingPartner[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rawName = String(
      rec.name ?? rec.platform ?? rec.provider ?? rec.platform_name ?? ''
    )
      .replace(/<[^>]*>/g, '')
      .trim();
    const rawUrl = String(
      rec.url ??
        rec.watch_url ??
        rec.watchUrl ??
        rec.link ??
        rec.watchLink ??
        rec.stream_url ??
        rec.streamUrl ??
        rec.official_source_url ??
        rec.officialSourceUrl ??
        rec.source_url ??
        rec.sourceUrl ??
        rec.href ??
        ''
    ).trim();
    const languages = normalizePartnerLanguages(
      rec.languages ?? rec.dubs ?? rec.audio_languages ?? rec.dubLanguages
    );
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

const PLATFORM_DOMAIN_PATTERNS: Array<{ pattern: RegExp; platforms: string[] }> = [
  { pattern: /crunchyroll\.com/i, platforms: ['crunchyroll'] },
  { pattern: /netflix\.com/i, platforms: ['netflix'] },
  {
    pattern: /hotstar\.com|jiocinema\.com|jiohotstar\.com/i,
    platforms: ['jiohotstar', 'jiocinema', 'disney+ hotstar', 'hotstar'],
  },
  {
    pattern: /primevideo\.com|amazon\.(com|in)/i,
    platforms: ['prime video', 'anime times', 'amazon prime'],
  },
  {
    pattern: /youtube\.com|youtu\.be/i,
    platforms: [
      'youtube',
      'youtube (muse india)',
      'youtube (ani-one)',
      'youtube (ani-one india)',
      'muse india',
      'ani-one india',
      'ani-one',
    ],
  },
  { pattern: /sonyliv\.com/i, platforms: ['sony liv', 'sonyliv'] },
  { pattern: /zee5\.com/i, platforms: ['zee5'] },
  { pattern: /bilibili\.(tv|com)/i, platforms: ['bilibili'] },
];

export function doesUrlMatchStreamingPlatform(url: string, platformName: string): boolean {
  const cleanUrl = String(url || '').trim();
  const cleanPlat = String(platformName || '').trim().toLowerCase();
  const canonicalPlat = matchCanonicalPlatformName(platformName).toLowerCase();
  if (!cleanUrl || !cleanPlat) return false;

  for (const entry of PLATFORM_DOMAIN_PATTERNS) {
    if (entry.pattern.test(cleanUrl)) {
      return entry.platforms.some(
        (p) =>
          cleanPlat === p ||
          canonicalPlat === p ||
          cleanPlat.includes(p) ||
          canonicalPlat.includes(p)
      );
    }
  }
  return false;
}

export interface ResolveStreamingPartnersOptions {
  fallbackLanguages?: unknown;
  defaultWhenEmpty?: boolean;
  includePlatformNamesFallback?: boolean;
}

/**
 * Resolves all streaming partner entries and URLs from an anime record by inspecting
 * every D1 and frontend OTT link field (`platforms_data`, `streaming_partners`,
 * `watch_providers`, `platform_links`, `streaming_links`, `streamingLinks`, `platforms`,
 * `platform`, `watch_url`, `watchUrl`, `watchLink`, `streamUrl`, `official_source_url`, `source_url`).
 *
 * Never short-circuits when `streaming_partners` is `'[]'` or `[]` while `platforms_data`
 * or `watch_url` / `official_source_url` holds the real links.
 */
export function resolveAnimeStreamingPartners(
  record: unknown,
  options: ResolveStreamingPartnersOptions = {}
): NormalizedStreamingPartner[] {
  const defaultWhenEmpty = options.defaultWhenEmpty === true;
  const includePlatformNamesFallback = options.includePlatformNamesFallback !== false;

  if (!record || typeof record !== 'object') {
    const fallbackLangs = normalizePartnerLanguages(options.fallbackLanguages);
    return defaultWhenEmpty
      ? [{ name: 'Crunchyroll', platform: 'Crunchyroll', url: '', languages: fallbackLangs }]
      : [];
  }

  const rec = record as Record<string, unknown>;
  const fallbackLangs = normalizePartnerLanguages(
    options.fallbackLanguages ?? rec.languages ?? rec.dubLanguages
  );

  // 1. Collect all structured partner lists across all candidate fields (never short-circuiting on '[]')
  const candidateSources: unknown[] = [
    rec.platforms_data,
    rec.platformsData,
    rec.streaming_partners,
    rec.streamingPartners,
    rec.watch_providers,
    rec.watchProviders,
    rec.platform_links,
    rec.platformLinks,
    rec.streaming_links,
    rec.streamingLinks,
  ];

  if (
    (Array.isArray(rec.platforms) && rec.platforms.some((p) => p && typeof p === 'object')) ||
    (typeof rec.platforms === 'string' &&
      (rec.platforms.trim().startsWith('[') ||
        rec.platforms.trim().startsWith('{') ||
        rec.platforms.includes('::')))
  ) {
    candidateSources.push(rec.platforms);
  }
  if (
    typeof rec.platform === 'string' &&
    (rec.platform.trim().startsWith('[') ||
      rec.platform.trim().startsWith('{') ||
      rec.platform.includes('::'))
  ) {
    candidateSources.push(rec.platform);
  }

  const parsedSourceLists: NormalizedStreamingPartner[][] = [];
  for (const src of candidateSources) {
    if (src === null || src === undefined || src === '' || src === '[]' || src === '{}') continue;
    const parsed = normalizeStreamingPartners(src);
    if (parsed.length > 0) {
      parsedSourceLists.push(parsed);
    }
  }

  // Prefer the first source that has at least one non-empty URL, or else the first non-empty source
  const primaryIdx = parsedSourceLists.findIndex((list) => list.some((p) => Boolean(p.url)));
  const orderedLists =
    primaryIdx > 0
      ? [
          parsedSourceLists[primaryIdx],
          ...parsedSourceLists.slice(0, primaryIdx),
          ...parsedSourceLists.slice(primaryIdx + 1),
        ]
      : parsedSourceLists;

  const partners: NormalizedStreamingPartner[] = [];
  const findPartnerMatch = (name: string): NormalizedStreamingPartner | undefined => {
    const lower = name.trim().toLowerCase();
    const canonical = matchCanonicalPlatformName(name).toLowerCase();
    return partners.find((p) => {
      const pLower = p.name.trim().toLowerCase();
      const pCanonical = matchCanonicalPlatformName(p.name).toLowerCase();
      return pLower === lower || pCanonical === canonical;
    });
  };

  for (let listIdx = 0; listIdx < orderedLists.length; listIdx++) {
    const list = orderedLists[listIdx];
    for (const item of list) {
      const existing = findPartnerMatch(item.name || item.platform);
      if (!existing) {
        if (listIdx === 0 || Boolean(item.url)) {
          partners.push({
            name: item.name,
            platform: item.platform || item.name,
            url: item.url,
            languages: [...item.languages],
          });
        }
      } else {
        if (!existing.url && item.url) {
          existing.url = item.url;
        }
        if (existing.languages.length === 0 && item.languages.length > 0) {
          existing.languages = [...item.languages];
        }
      }
    }
  }

  // 2. Collect single-URL fallback columns on the anime row
  const singleUrlFields = [
    rec.watch_url,
    rec.watchUrl,
    rec.watchLink,
    rec.stream_url,
    rec.streamUrl,
    rec.official_source_url,
    rec.officialSourceUrl,
    rec.source_url,
    rec.sourceUrl,
  ];
  const fallbackUrls: string[] = [];
  for (const rawUrl of singleUrlFields) {
    if (typeof rawUrl === 'string') {
      const clean = rawUrl.trim();
      if (clean && !fallbackUrls.includes(clean)) {
        fallbackUrls.push(clean);
      }
    }
  }

  // 3. Ensure all platforms from platform / platforms string are included when includePlatformNamesFallback is true (or when partners is empty and a fallback URL exists)
  if (includePlatformNamesFallback || (partners.length === 0 && fallbackUrls.length > 0)) {
    const platList = parsePlatformList(rec.platform, rec.platforms, undefined, {
      defaultFallback: partners.length === 0 && defaultWhenEmpty ? ['Crunchyroll'] : [],
    });
    for (const platName of platList) {
      const canonical = matchCanonicalPlatformName(platName) || platName;
      if (!findPartnerMatch(canonical)) {
        partners.push({
          name: canonical,
          platform: canonical,
          url: '',
          languages: [],
        });
      }
    }
  }

  // 4. Backfill any missing partner URL from single-URL columns (only when that URL isn't already assigned to a partner)
  for (const candidateUrl of fallbackUrls) {
    const alreadyAssigned = partners.some(
      (p) => p.url.trim().toLowerCase() === candidateUrl.toLowerCase()
    );
    if (alreadyAssigned) continue;

    // First try domain-based matching onto an empty partner row
    const domainMatched = partners.find(
      (p) => !p.url && doesUrlMatchStreamingPlatform(candidateUrl, p.name)
    );
    if (domainMatched) {
      domainMatched.url = candidateUrl;
      continue;
    }

    // Otherwise, if no partner has any URL yet (or there is only 1 partner and its URL is empty), assign to the first partner
    if (partners.length > 0 && partners.every((p) => !p.url)) {
      partners[0].url = candidateUrl;
    }
  }

  // 5. Backfill languages when missing
  if (fallbackLangs.length > 0) {
    if (partners.length === 1 && partners[0].languages.length === 0) {
      partners[0].languages = [...fallbackLangs];
    } else if (
      partners.length > 1 &&
      defaultWhenEmpty &&
      partners.every((p) => p.languages.length === 0)
    ) {
      partners[0].languages = [...fallbackLangs];
    }
  }

  if (partners.length === 0 && defaultWhenEmpty) {
    return [
      {
        name: 'Crunchyroll',
        platform: 'Crunchyroll',
        url: fallbackUrls[0] || '',
        languages: fallbackLangs,
      },
    ];
  }

  return partners;
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


