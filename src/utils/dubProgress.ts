/**
 * Pure Visual Dub Progress utility for AniDub India.
 * Computes honest per-language and per-season dubbing progress from D1 anime records.
 *
 * STRICT HONESTY RULE:
 * - Never fabricates episode counts when `episodes_dubbed` is not verified in the record.
 * - Languages present without verified dubbed episode counts report `status: 'available'`
 *   with `episodesDubbed: null` and a clean `'Available'` / `'Verified'` badge.
 */

import { isExcludedLanguage, normalizeLanguageName } from './languages';

export const CORE_INDIAN_DUB_LANGUAGES = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
] as const;

export type DubProgressStatus = 'complete' | 'partial' | 'available' | 'unavailable';

export interface LanguageDubProgress {
  language: string;
  status: DubProgressStatus;
  episodesDubbed: number | null;
  totalEpisodes: number | null;
  percent: number;
  label: string;
  badgeText: string;
}

export interface SeasonDubProgress {
  seasonKey: string;
  seasonLabel: string;
  totalEpisodes: number | null;
  languages: LanguageDubProgress[];
}

export interface DubProgressResult {
  seasons: SeasonDubProgress[];
  hasMultipleSeasons: boolean;
  overall: SeasonDubProgress;
}

interface RawSeasonDubEntry {
  season?: number | string;
  name?: string;
  label?: string;
  total_episodes?: number | string | null;
  totalEpisodes?: number | string | null;
  episodes?: number | string | null;
  episodes_count?: number | string | null;
  languages?: Record<string, unknown> | Array<Record<string, unknown> | string> | string;
  dubs?: Record<string, unknown> | Array<Record<string, unknown> | string>;
}

function parsePositiveInt(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function parseNonNegativeInt(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function safeJsonParse(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return raw;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

function extractLanguageTokens(raw: unknown): string[] {
  if (!raw) return [];
  const parsed = safeJsonParse(raw);
  const rawTokens: string[] = [];

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === 'string') {
        rawTokens.push(...item.split(/[,/|•+]+/));
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj.language === 'string') rawTokens.push(obj.language);
        if (typeof obj.lang === 'string') rawTokens.push(obj.lang);
        if (typeof obj.name === 'string' && !obj.url && !obj.platform) rawTokens.push(obj.name);
        if (Array.isArray(obj.languages)) {
          for (const sub of obj.languages) {
            if (typeof sub === 'string') rawTokens.push(...sub.split(/[,/|•+]+/));
          }
        }
      }
    }
  } else if (typeof parsed === 'string') {
    rawTokens.push(...parsed.split(/[,/|•+]+/));
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const token of rawTokens) {
    const norm = normalizeLanguageName(token);
    if (!norm || isExcludedLanguage(norm)) continue;
    const key = norm.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(norm);
    }
  }
  return unique;
}

interface VerifiedLangCount {
  episodesDubbed: number | null;
  totalEpisodes: number | null;
  available: boolean;
  verified: boolean;
}

function parseLanguageMap(
  rawLangData: unknown,
  fallbackTotal: number | null
): Map<string, VerifiedLangCount> {
  const map = new Map<string, VerifiedLangCount>();
  if (!rawLangData) return map;
  const parsed = safeJsonParse(rawLangData);

  const register = (
    rawName: string,
    dubbed: number | null,
    total: number | null,
    available: boolean,
    verified: boolean
  ) => {
    const norm = normalizeLanguageName(rawName);
    if (!norm || isExcludedLanguage(norm)) return;
    const existing = map.get(norm);
    const bestDubbed =
      dubbed !== null && existing?.episodesDubbed !== null && existing?.episodesDubbed !== undefined
        ? Math.max(dubbed, existing.episodesDubbed)
        : dubbed ?? existing?.episodesDubbed ?? null;
    const bestTotal = total ?? existing?.totalEpisodes ?? fallbackTotal;
    map.set(norm, {
      episodesDubbed: bestDubbed,
      totalEpisodes: bestTotal,
      available: available || Boolean(existing?.available) || (bestDubbed !== null && bestDubbed > 0),
      verified: verified || Boolean(existing?.verified),
    });
  };

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (typeof entry === 'string') {
        for (const tok of entry.split(/[,/|•+]+/)) {
          register(tok, null, fallbackTotal, true, false);
        }
      } else if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const langName = String(obj.language || obj.lang || obj.name || '').trim();
        if (langName) {
          const dubbed = parseNonNegativeInt(
            obj.episodes_dubbed ?? obj.episodesDubbed ?? obj.dubbed_episodes ?? obj.dubbedCount
          );
          const total = parsePositiveInt(
            obj.total_episodes ?? obj.totalEpisodes ?? obj.episodes ?? obj.episodes_count
          );
          const explicitlyUnavailable =
            obj.available === false ||
            String(obj.status || '').toLowerCase() === 'unavailable';
          const isVerified = Boolean(obj.verified || obj.source_url || obj.url);
          register(langName, dubbed, total, !explicitlyUnavailable, isVerified);
        }
      }
    }
  } else if (parsed && typeof parsed === 'object') {
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof val === 'number') {
        register(key, parseNonNegativeInt(val), fallbackTotal, val > 0, true);
      } else if (typeof val === 'boolean') {
        register(key, null, fallbackTotal, val, false);
      } else if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        const ratioMatch = lower.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (ratioMatch) {
          register(key, Number(ratioMatch[1]), Number(ratioMatch[2]), Number(ratioMatch[1]) > 0, true);
        } else if (lower === 'unavailable' || lower === 'none' || lower === 'false') {
          register(key, 0, fallbackTotal, false, false);
        } else {
          register(key, null, fallbackTotal, true, lower === 'verified');
        }
      } else if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        const dubbed = parseNonNegativeInt(
          obj.episodes_dubbed ?? obj.episodesDubbed ?? obj.dubbed_episodes ?? obj.dubbedCount
        );
        const total = parsePositiveInt(
          obj.total_episodes ?? obj.totalEpisodes ?? obj.episodes ?? obj.episodes_count
        );
        const explicitlyUnavailable =
          obj.available === false ||
          String(obj.status || '').toLowerCase() === 'unavailable';
        const isVerified = Boolean(obj.verified || obj.source_url || obj.url);
        register(key, dubbed, total, !explicitlyUnavailable, isVerified);
      }
    }
  } else if (typeof parsed === 'string') {
    for (const tok of parsed.split(/[,/|•+]+/)) {
      register(tok, null, fallbackTotal, true, false);
    }
  }

  return map;
}

function buildLanguageRows(
  langMap: Map<string, VerifiedLangCount>,
  fallbackTotal: number | null,
  hasOfficialEvidence: boolean
): LanguageDubProgress[] {
  const orderedLanguages: string[] = [...CORE_INDIAN_DUB_LANGUAGES];
  for (const lang of langMap.keys()) {
    if (!orderedLanguages.includes(lang)) {
      orderedLanguages.push(lang);
    }
  }

  return orderedLanguages.map((language) => {
    const info = langMap.get(language);
    if (!info || !info.available) {
      return {
        language,
        status: 'unavailable',
        episodesDubbed: null,
        totalEpisodes: fallbackTotal,
        percent: 0,
        label: 'Unavailable',
        badgeText: 'Unavailable',
      };
    }

    const total = info.totalEpisodes ?? fallbackTotal;
    const dubbed = info.episodesDubbed;

    // Only show episode ratios when verified dubbed count exists
    if (dubbed !== null && total !== null && total > 0) {
      const clampedDubbed = Math.min(dubbed, total);
      const percent = Math.round((clampedDubbed / total) * 100);
      if (clampedDubbed >= total) {
        return {
          language,
          status: 'complete',
          episodesDubbed: clampedDubbed,
          totalEpisodes: total,
          percent: 100,
          label: `${clampedDubbed}/${total} episodes`,
          badgeText: 'Fully Dubbed',
        };
      }
      if (clampedDubbed > 0) {
        return {
          language,
          status: 'partial',
          episodesDubbed: clampedDubbed,
          totalEpisodes: total,
          percent,
          label: `${clampedDubbed}/${total} episodes`,
          badgeText: 'In Progress',
        };
      }
      return {
        language,
        status: 'unavailable',
        episodesDubbed: 0,
        totalEpisodes: total,
        percent: 0,
        label: 'Unavailable',
        badgeText: 'Unavailable',
      };
    }

    if (dubbed !== null && dubbed > 0) {
      return {
        language,
        status: 'partial',
        episodesDubbed: dubbed,
        totalEpisodes: null,
        percent: 65,
        label: `${dubbed} ${dubbed === 1 ? 'episode' : 'episodes'} dubbed`,
        badgeText: 'Dubbed',
      };
    }

    // Strict Honesty: language is listed without verified episode count
    const honestStatus = info.verified || hasOfficialEvidence ? 'Verified' : 'Available';
    return {
      language,
      status: 'available',
      episodesDubbed: null,
      totalEpisodes: total,
      percent: 100,
      label: honestStatus,
      badgeText: honestStatus,
    };
  });
}

/**
 * Builds visual dub progress breakdown (including optional multi-season tabs)
 * from any D1 anime detail or catalog record.
 */
export function buildDubProgressBreakdown(anime: Record<string, unknown> | null | undefined): DubProgressResult {
  if (!anime || typeof anime !== 'object') {
    const emptySeason: SeasonDubProgress = {
      seasonKey: 'overall',
      seasonLabel: 'All Seasons',
      totalEpisodes: null,
      languages: buildLanguageRows(new Map(), null, false),
    };
    return { seasons: [emptySeason], hasMultipleSeasons: false, overall: emptySeason };
  }

  const totalEpisodes = parsePositiveInt(
    anime.episodes_count ?? anime.episodes ?? anime.episode_count
  );
  const hasOfficialEvidence = Boolean(
    typeof anime.official_source_url === 'string' && anime.official_source_url.trim().startsWith('http')
  );

  // 1. Collect baseline available languages from top-level `languages` & `platforms_data`
  const baseLangMap = new Map<string, VerifiedLangCount>();
  const topTokens = [
    ...extractLanguageTokens(anime.languages),
    ...extractLanguageTokens(anime.platforms_data),
    ...extractLanguageTokens(anime.streaming_partners),
  ];

  const parsedPlatforms = safeJsonParse(anime.platforms_data ?? anime.streaming_partners);
  const platformHasVerifiedUrl = Array.isArray(parsedPlatforms)
    ? parsedPlatforms.some(
        (p) => p && typeof p === 'object' && typeof (p as Record<string, unknown>).url === 'string' && String((p as Record<string, unknown>).url).trim().startsWith('http')
      )
    : false;

  for (const lang of topTokens) {
    baseLangMap.set(lang, {
      episodesDubbed: null,
      totalEpisodes,
      available: true,
      verified: hasOfficialEvidence || platformHasVerifiedUrl,
    });
  }

  // Merge any per-partner episodes_dubbed info from platforms_data
  if (Array.isArray(parsedPlatforms)) {
    for (const p of parsedPlatforms) {
      if (!p || typeof p !== 'object') continue;
      const pObj = p as Record<string, unknown>;
      const pDubMatrix = pObj.dub_matrix ?? pObj.dubProgress ?? pObj.dub_progress;
      if (pDubMatrix) {
        const subMap = parseLanguageMap(pDubMatrix, totalEpisodes);
        for (const [k, v] of subMap.entries()) {
          baseLangMap.set(k, v);
        }
      }
    }
  }

  // 2. Inspect optional `dub_matrix` (can be per-language object OR array of season objects)
  const rawDubMatrix = safeJsonParse(anime.dub_matrix ?? anime.dubProgress ?? anime.dub_progress);
  const seasonEntries: SeasonDubProgress[] = [];

  const extractSeasonList = (candidate: unknown): RawSeasonDubEntry[] => {
    if (!candidate) return [];
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is RawSeasonDubEntry =>
          Boolean(item && typeof item === 'object' && ('season' in item || 'languages' in item || 'dubs' in item || 'name' in item))
      );
    }
    if (typeof candidate === 'object') {
      const obj = candidate as Record<string, unknown>;
      if (Array.isArray(obj.seasons)) {
        return extractSeasonList(obj.seasons);
      }
      // Check if keys look like season identifiers (e.g. "Season 1", "S1", "season_1")
      const keys = Object.keys(obj);
      const looksLikeSeasonKeys =
        keys.length > 0 &&
        keys.every((k) => /^(season\s*\d+|s\d+|season_\d+|movie|ova|part\s*\d+)$/i.test(k.trim()));
      if (looksLikeSeasonKeys) {
        return keys.map((k) => {
          const val = obj[k];
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            const vObj = val as Record<string, unknown>;
            if ('languages' in vObj || 'dubs' in vObj) {
              return { name: k, ...(vObj as RawSeasonDubEntry) };
            }
            return { name: k, languages: vObj };
          }
          return { name: k, languages: val as RawSeasonDubEntry['languages'] };
        });
      }
    }
    return [];
  };

  const dubMatrixSeasons = extractSeasonList(rawDubMatrix);
  if (dubMatrixSeasons.length > 0) {
    dubMatrixSeasons.forEach((s, idx) => {
      const seasonLabel =
        String(s.label || s.name || (s.season ? `Season ${s.season}` : `Season ${idx + 1}`)).trim();
      const sTotal = parsePositiveInt(s.total_episodes ?? s.totalEpisodes ?? s.episodes ?? s.episodes_count);
      const langMap = parseLanguageMap(s.languages ?? s.dubs, sTotal);
      seasonEntries.push({
        seasonKey: `season_${idx + 1}`,
        seasonLabel,
        totalEpisodes: sTotal,
        languages: buildLanguageRows(langMap, sTotal, hasOfficialEvidence || platformHasVerifiedUrl),
      });
    });
  } else if (rawDubMatrix && typeof rawDubMatrix === 'object') {
    const flatMap = parseLanguageMap(rawDubMatrix, totalEpisodes);
    for (const [k, v] of flatMap.entries()) {
      baseLangMap.set(k, v);
    }
  }

  // 3. Also check `seasons` / `mixed_entries` if no dub_matrix seasons existed and multiple seasons have distinct data
  if (seasonEntries.length === 0) {
    const rawSeasons = safeJsonParse(anime.seasons ?? anime.mixed_entries ?? anime.mixedEntries ?? anime.seasonsList);
    if (Array.isArray(rawSeasons) && rawSeasons.length > 1) {
      rawSeasons.forEach((entry: unknown, idx: number) => {
        if (!entry || typeof entry !== 'object') return;
        const sObj = entry as Record<string, unknown>;
        const seasonLabel = String(sObj.name || sObj.label || `Season ${idx + 1}`).trim();
        const sTotal = parsePositiveInt(sObj.episodes ?? sObj.episode_count ?? sObj.episodeCount);
        const sLangsRaw = sObj.dub_matrix ?? sObj.languages;
        const sLangMap = sLangsRaw ? parseLanguageMap(sLangsRaw, sTotal) : new Map(baseLangMap);
        seasonEntries.push({
          seasonKey: `season_${idx + 1}`,
          seasonLabel,
          totalEpisodes: sTotal,
          languages: buildLanguageRows(sLangMap, sTotal, hasOfficialEvidence || platformHasVerifiedUrl),
        });
      });
    }
  }

  const overall: SeasonDubProgress = {
    seasonKey: 'overall',
    seasonLabel: 'Overview',
    totalEpisodes,
    languages: buildLanguageRows(baseLangMap, totalEpisodes, hasOfficialEvidence || platformHasVerifiedUrl),
  };

  if (seasonEntries.length > 1) {
    return {
      seasons: seasonEntries,
      hasMultipleSeasons: true,
      overall,
    };
  }

  if (seasonEntries.length === 1) {
    return {
      seasons: seasonEntries,
      hasMultipleSeasons: false,
      overall: seasonEntries[0],
    };
  }

  return {
    seasons: [overall],
    hasMultipleSeasons: false,
    overall,
  };
}
