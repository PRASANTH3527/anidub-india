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
