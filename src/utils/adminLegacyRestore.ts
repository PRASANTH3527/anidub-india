/**
 * Pure, deterministic helpers for restored legacy Admin Dashboard tools:
 * 1. Bulk CSV Text Parser (shared by File Picker & Direct Paste)
 * 2. Real D1 Catalog Genre Distribution aggregator
 * 3. IMDb / External Ratings Checker candidate evaluator & safe batch update builder
 * 4. Secret masking helper for Telegram credentials
 */

export interface ParsedCsvAnimeRow {
  title: string;
  posterUrl: string;
  synopsis: string;
  rating: string;
  releaseYear: string;
  status: string;
  type: string;
  studio: string;
  genres: string;
  languages: string;
  platforms: string;
  episodes: string;
  [key: string]: string;
}

export interface GenreDistributionItem {
  genre: string;
  count: number;
  percentage: number;
}

export type ImdbCheckStatus = 'missing_current' | 'outdated' | 'matched' | 'not_found';

export interface ImdbRatingCandidate {
  animeId: number;
  title: string;
  slug?: string | null;
  coverImage?: string | null;
  year?: number | string | null;
  currentRating: number | null;
  fetchedRating: number | null;
  delta: number | null;
  source: string;
  externalId?: string | null;
  externalUrl?: string | null;
  status: ImdbCheckStatus;
  note?: string;
}

export interface SafeImdbRatingUpdate {
  animeId: number;
  rating: number;
  externalId?: string;
}

/**
 * RFC-4180 compliant CSV parser supporting BOM, quoted commas, escaped quotes, and CRLF/LF newlines.
 */
export function parseRawCsvMatrix(raw: string): string[][] {
  if (!raw || typeof raw !== 'string') return [];
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  const cleanText = raw.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) result.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current !== '' || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell !== '')) result.push(row);
  }
  return result;
}

export interface CsvImportSummaryResult {
  fileName: string;
  totalRows: number;
  addedToPending: number;
  skippedDuplicates: number;
  duplicateTitles: string[];
  invalidRows: number;
  errors: string[];
  failedRows?: Array<Record<string, string>>;
  timestamp: string;
}

/**
 * Parses CSV text (from file picker or direct paste textarea) into normalized anime row payloads.
 * IMPORTANT: Never invents fake dub languages or platforms if blank — leaves them empty so
 * downstream dry-run & D1 import keep them cleanly "Unverified".
 */
export function parseCsvTextToAnimeRows(rawText: string): {
  rows: ParsedCsvAnimeRow[];
  totalRows: number;
  invalidRows: number;
  errors: string[];
  failedRows: Array<Record<string, string>>;
  error?: string;
} {
  const matrix = parseRawCsvMatrix(rawText);
  if (matrix.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      invalidRows: 0,
      errors: ['CSV input is empty or missing data rows (header + at least 1 data row required).'],
      failedRows: [],
      error: 'CSV input is empty or missing data rows (header + at least 1 data row required).',
    };
  }

  const rawHeaders = matrix[0].map((h) => h.replace(/^"|"$/g, '').trim());
  const hasExplicitTitleHeader = rawHeaders.some((h) =>
    ['title', 'name', 'animetitle', 'animename', 'series', 'titleenglish'].includes(
      h.toLowerCase().replace(/[^a-z0-9]/g, '')
    )
  );
  const parsedItems: ParsedCsvAnimeRow[] = [];
  const errors: string[] = [];
  const failedRows: Array<Record<string, string>> = [];
  let totalDataRows = 0;

  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i];
    if (!values || values.length === 0 || values.every((cell) => !cell || !cell.trim())) continue;

    const rowObj: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      if (h) {
        rowObj[h] = values[idx] !== undefined ? values[idx].replace(/^"|"$/g, '').trim() : '';
      }
    });

    const getField = (possibleNames: string[]): string => {
      for (const key of Object.keys(rowObj)) {
        const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (possibleNames.includes(normKey) && rowObj[key] !== '') {
          return rowObj[key];
        }
      }
      return '';
    };

    const explicitTitle = getField(['title', 'name', 'animetitle', 'animename', 'series', 'titleenglish']);
    const fallbackFirstCol = !hasExplicitTitleHeader ? (values[0] || '').replace(/^"|"$/g, '').trim() : '';
    const title = (explicitTitle || fallbackFirstCol).trim();

    // Skip repeated header row if present
    if (title.toLowerCase() === 'title' && i === 1) continue;

    totalDataRows++;

    if (!title) {
      errors.push(`Row ${i + 1}: Missing required Title value`);
      failedRows.push(rowObj);
      continue;
    }

    parsedItems.push({
      ...rowObj,
      title,
      posterUrl: getField(['posterurl', 'poster', 'coverimage', 'image', 'cover']),
      synopsis: getField(['synopsis', 'description', 'summary', 'plot']),
      rating: getField(['rating', 'score', 'malscore', 'imdbrating']),
      releaseYear: getField(['releaseyear', 'year', 'aired']),
      status: getField(['status', 'airingstatus']) || 'Completed',
      type: getField(['type', 'format', 'mediatype']) || 'TV Series',
      studio: getField(['studio', 'studios', 'producer', 'animationstudio', 'studioname']),
      genres: getField(['genres', 'genre', 'tags', 'categories']),
      languages: getField(['languages', 'language', 'dublanguages', 'dub', 'audio']),
      platforms: getField(['platforms', 'platform', 'streaming', 'ott', 'watchon', 'streamingpartners']),
      episodes: getField(['episodes', 'episodecount', 'totalepisodes', 'eps', 'episodesperseason']),
      season: getField(['season', 'seasons', 'cour']),
      watchUrl: getField(['watchurl', 'url', 'link', 'streamurl', 'officialsourceurl', 'officialsourcelink']),
    });
  }

  if (parsedItems.length === 0) {
    const errMsg =
      errors.length > 0
        ? `Could not import CSV: ${errors[0]}`
        : 'Could not find valid anime rows with a Title column in the provided CSV.';
    return {
      rows: [],
      totalRows: totalDataRows,
      invalidRows: failedRows.length,
      errors: errors.length > 0 ? errors : [errMsg],
      failedRows,
      error: errMsg,
    };
  }

  return {
    rows: parsedItems,
    totalRows: totalDataRows,
    invalidRows: failedRows.length,
    errors,
    failedRows,
  };
}

/**
 * Computes real genre distribution counts from D1 catalog items or server-side genre map.
 * Supports comma- or pipe-delimited genre strings as well as string arrays.
 * Never fabricates placeholder genres when catalog has no genre tags.
 */
export function computeGenreDistributionFromCatalog(
  catalog: Array<{ genres?: string | string[] | null }>,
  limit = 10
): { genreCounts: Record<string, number>; ranked: GenreDistributionItem[]; totalTitles: number } {
  const counts: Record<string, number> = {};
  const totalTitles = Array.isArray(catalog) ? catalog.length : 0;

  for (const item of catalog || []) {
    const raw = item?.genres;
    let tokens: string[] = [];
    if (Array.isArray(raw)) {
      tokens = raw.map((g) => String(g || '').trim()).filter(Boolean);
    } else if (typeof raw === 'string' && raw.trim()) {
      tokens = raw
        .split(/[,|/]/)
        .map((g) => g.trim())
        .filter(Boolean);
    }

    const seenForAnime = new Set<string>();
    for (const token of tokens) {
      const normalized = token.replace(/\s+/g, ' ');
      const lower = normalized.toLowerCase();
      if (!normalized || lower === 'n/a' || lower === 'unknown' || lower === 'none') continue;
      if (seenForAnime.has(lower)) continue;
      seenForAnime.add(lower);

      // Canonical title-case key while preserving known acronyms like Sci-Fi
      const canonical =
        lower === 'sci-fi' || lower === 'scifi'
          ? 'Sci-Fi'
          : lower === 'slice of life'
            ? 'Slice of Life'
            : normalized.replace(/\b\w/g, (ch) => ch.toUpperCase());

      counts[canonical] = (counts[canonical] || 0) + 1;
    }
  }

  const ranked = rankGenreCounts(counts, totalTitles, limit);
  return { genreCounts: counts, ranked, totalTitles };
}

/**
 * Ranks a genre->count dictionary descending by count then alphabetically.
 */
export function rankGenreCounts(
  genreCounts: Record<string, number> | null | undefined,
  totalTitles: number,
  limit = 10
): GenreDistributionItem[] {
  if (!genreCounts || typeof genreCounts !== 'object') return [];
  const denom = Math.max(1, Number(totalTitles) || 0);
  return Object.entries(genreCounts)
    .filter(([genre, count]) => Boolean(genre.trim()) && Number(count) > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, Math.max(1, limit))
    .map(([genre, count]) => ({
      genre,
      count: Number(count),
      percentage: Math.min(100, Math.round((Number(count) / denom) * 100)),
    }));
}

/**
 * Parses and validates a rating score strictly within [0.1, 10.0], rounded to 1 decimal place.
 * Returns null if blank, NaN, zero, or out of bounds.
 */
export function sanitizeRatingScore(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0.1 || num > 10) return null;
  return Math.round(num * 10) / 10;
}

/**
 * Evaluates a live fetched rating against the current D1 rating without ever inventing scores.
 */
export function evaluateImdbRatingDiff(
  currentRaw: unknown,
  fetchedRaw: unknown
): {
  currentRating: number | null;
  fetchedRating: number | null;
  delta: number | null;
  status: ImdbCheckStatus;
} {
  const currentRating = sanitizeRatingScore(currentRaw);
  const fetchedRating = sanitizeRatingScore(fetchedRaw);

  if (fetchedRating === null) {
    return {
      currentRating,
      fetchedRating: null,
      delta: null,
      status: 'not_found',
    };
  }

  if (currentRating === null) {
    return {
      currentRating: null,
      fetchedRating,
      delta: null,
      status: 'missing_current',
    };
  }

  const delta = Math.round((fetchedRating - currentRating) * 10) / 10;
  const status: ImdbCheckStatus = Math.abs(delta) >= 0.1 ? 'outdated' : 'matched';
  return {
    currentRating,
    fetchedRating,
    delta,
    status,
  };
}

/**
 * Builds a strict, validated batch update payload from selected IMDb Checker rows.
 * Automatically rejects rows without a valid fetched score so production D1 ratings are never corrupted.
 */
export function buildSafeImdbBatchUpdates(
  candidates: ImdbRatingCandidate[],
  selectedAnimeIds: number[]
): SafeImdbRatingUpdate[] {
  const selectedSet = new Set(selectedAnimeIds.map((id) => Number(id)));
  const updates: SafeImdbRatingUpdate[] = [];

  for (const row of candidates || []) {
    const id = Number(row.animeId);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!selectedSet.has(id)) continue;
    const validScore = sanitizeRatingScore(row.fetchedRating);
    if (validScore === null) continue;

    updates.push({
      animeId: id,
      rating: validScore,
      externalId: row.externalId && String(row.externalId).trim() ? String(row.externalId).trim() : undefined,
    });
  }

  return updates;
}

/**
 * Redacts Telegram bot tokens or sensitive query params from error messages before surfacing to UI/logs.
 */
export function redactSensitiveTokens(text: string): string {
  if (!text) return '';
  return text
    .replace(/bot\d+:[A-Za-z0-9_-]{10,}/gi, 'bot[REDACTED]')
    .replace(/([?&](?:apikey|key|token)=)[^&\s]+/gi, '$1[REDACTED]');
}
