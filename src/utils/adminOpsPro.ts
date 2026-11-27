/**
 * Pure Domain Logic, Validators & Normalizers for AniDub India — Admin Dashboard 2.0 (Phase 2: Content Operations Pro)
 *
 * Shared across Cloudflare Pages Functions (/api/admin/*), React Admin Workspace components, and unit tests.
 */

export type DubAvailabilityStatus =
  | 'complete'
  | 'partial'
  | 'announced'
  | 'unavailable'
  | 'unverified';

export const VALID_DUB_AVAILABILITY_STATUSES: readonly DubAvailabilityStatus[] = [
  'complete',
  'partial',
  'announced',
  'unavailable',
  'unverified',
] as const;

export interface DubMatrixLanguageMeta {
  code: string;
  name: string;
  nativeName: string;
  primary: boolean;
}

export const DUB_MATRIX_LANGUAGES: readonly DubMatrixLanguageMeta[] = [
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', primary: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', primary: true },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', primary: true },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', primary: true },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', primary: true },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', primary: true },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', primary: false },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', primary: false },
] as const;

export function languageCodeToName(codeOrName: string): string {
  const clean = String(codeOrName || '').trim().toLowerCase();
  const found = DUB_MATRIX_LANGUAGES.find(
    (l) => l.code.toLowerCase() === clean || l.name.toLowerCase() === clean
  );
  return found ? found.name : String(codeOrName || '').trim();
}

export function languageNameToCode(nameOrCode: string): string {
  const clean = String(nameOrCode || '').trim().toLowerCase();
  const found = DUB_MATRIX_LANGUAGES.find(
    (l) => l.name.toLowerCase() === clean || l.code.toLowerCase() === clean
  );
  return found ? found.code : clean;
}

export interface DubMatrixRowInput {
  id?: number;
  anime_id: string | number;
  season_number?: number;
  language_code: string;
  platform_name?: string | null;
  region?: string;
  dubbed_episodes?: number | string | null;
  total_episodes?: number | string | null;
  availability_status?: string;
  source_url?: string | null;
  evidence_note?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  updated_at?: string;
}

export interface NormalizedDubMatrixRow {
  anime_id: string;
  season_number: number;
  language_code: string;
  platform_name: string;
  region: string;
  dubbed_episodes: number | null;
  total_episodes: number | null;
  availability_status: DubAvailabilityStatus;
  source_url: string | null;
  evidence_note: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

/**
 * Distinguishes 0 episodes (explicit 0) from unknown/NULL (empty string, undefined, null).
 */
export function parseNullableEpisodeCount(val: unknown): {
  ok: boolean;
  value: number | null;
  error?: string;
} {
  if (val === null || val === undefined || val === '') {
    return { ok: true, value: null };
  }
  if (typeof val === 'string' && val.trim() === '') {
    return { ok: true, value: null };
  }
  const num = Number(val);
  if (!Number.isInteger(num) || num < 0 || num > 5000) {
    return {
      ok: false,
      value: null,
      error: 'Episode count must be a non-negative integer (0–5000) or left blank for unknown.',
    };
  }
  return { ok: true, value: num };
}

/**
 * Validates a Dub Matrix row, enforcing that:
 * - 0 episodes is preserved distinctly from NULL/unknown
 * - 'complete' status is never allowed without verified positive dubbed_episodes == total_episodes
 * - dubbed_episodes never exceeds total_episodes
 */
export function validateDubMatrixEntry(
  input: DubMatrixRowInput
): { ok: true; data: NormalizedDubMatrixRow } | { ok: false; error: string } {
  const animeId = String(input.anime_id ?? '').trim();
  if (!animeId) {
    return { ok: false, error: 'anime_id is required for dub matrix entry.' };
  }

  const seasonNum =
    input.season_number !== undefined && input.season_number !== null
      ? Number(input.season_number)
      : 1;
  if (!Number.isInteger(seasonNum) || seasonNum < 1 || seasonNum > 100) {
    return { ok: false, error: 'season_number must be an integer between 1 and 100.' };
  }

  const langCode = languageNameToCode(input.language_code);
  if (!langCode) {
    return { ok: false, error: 'language_code is required.' };
  }

  const rawStatus = String(input.availability_status || 'unverified')
    .trim()
    .toLowerCase() as DubAvailabilityStatus;
  if (!VALID_DUB_AVAILABILITY_STATUSES.includes(rawStatus)) {
    return {
      ok: false,
      error: `Invalid availability_status "${rawStatus}". Must be one of: ${VALID_DUB_AVAILABILITY_STATUSES.join(', ')}.`,
    };
  }

  const dubbedParsed = parseNullableEpisodeCount(input.dubbed_episodes);
  if (!dubbedParsed.ok) {
    return { ok: false, error: `dubbed_episodes: ${dubbedParsed.error}` };
  }

  const totalParsed = parseNullableEpisodeCount(input.total_episodes);
  if (!totalParsed.ok) {
    return { ok: false, error: `total_episodes: ${totalParsed.error}` };
  }

  const dubbedEpisodes = dubbedParsed.value;
  const totalEpisodes = totalParsed.value;

  if (
    dubbedEpisodes !== null &&
    totalEpisodes !== null &&
    totalEpisodes > 0 &&
    dubbedEpisodes > totalEpisodes
  ) {
    return {
      ok: false,
      error: `Dubbed episodes (${dubbedEpisodes}) cannot exceed total episodes (${totalEpisodes}).`,
    };
  }

  // Never allow 'complete' status without verified episode counts supporting completion
  if (rawStatus === 'complete') {
    if (dubbedEpisodes === null || totalEpisodes === null || totalEpisodes <= 0) {
      return {
        ok: false,
        error:
          'Cannot mark dub status as "Complete" without specifying both dubbed_episodes and total_episodes (> 0). Use "Partial", "Announced", or "Unverified" instead.',
      };
    }
    if (dubbedEpisodes < totalEpisodes) {
      return {
        ok: false,
        error: `Cannot mark dub status as "Complete" when dubbed_episodes (${dubbedEpisodes}) is less than total_episodes (${totalEpisodes}). Use "Partial" instead.`,
      };
    }
  }

  if (rawStatus === 'unavailable' && dubbedEpisodes !== null && dubbedEpisodes > 0) {
    return {
      ok: false,
      error: 'Cannot mark dub status as "Unavailable" when dubbed_episodes is greater than 0.',
    };
  }

  const platformName = String(input.platform_name ?? '').trim();
  const region = String(input.region || 'IN').trim().toUpperCase() || 'IN';
  const sourceUrl = input.source_url ? String(input.source_url).trim() : null;
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return {
      ok: false,
      error: 'Official source_url must start with http:// or https://',
    };
  }

  const evidenceNote = input.evidence_note ? String(input.evidence_note).trim().slice(0, 500) : null;
  const verifiedAt = input.verified_at ? String(input.verified_at).trim() : null;
  const verifiedBy = input.verified_by ? String(input.verified_by).trim() : null;

  return {
    ok: true,
    data: {
      anime_id: animeId,
      season_number: seasonNum,
      language_code: langCode,
      platform_name: platformName,
      region,
      dubbed_episodes: dubbedEpisodes,
      total_episodes: totalEpisodes,
      availability_status: rawStatus,
      source_url: sourceUrl || null,
      evidence_note: evidenceNote || null,
      verified_at: verifiedAt,
      verified_by: verifiedBy,
    },
  };
}

export type AnimeEditorTabId =
  | 'identity'
  | 'artwork'
  | 'metadata'
  | 'dubs'
  | 'seasons'
  | 'translations'
  | 'publish';

export interface AdminActivityLogItem {
  id: number;
  actor_id: string;
  actor_email?: string | null;
  action: string;
  action_type?: string;
  entity_type: string;
  entity_id: string;
  summary?: string | null;
  diff_json?: string | Record<string, any> | null;
  created_at: string;
}

/**
 * ELIGIBLE EXTERNAL METADATA AUTO-FILL CANDIDATE
 * Strictly excludes Indian dub languages, Indian OTT platforms, regional dubbed episode counts, or Indian release dates.
 */
export interface ExternalMetadataCandidate {
  externalId: string;
  provider: 'anilist' | 'jikan';
  title: string;
  alternativeTitles: string[];
  posterUrl: string;
  bannerUrl: string;
  releaseYear: number | null;
  year: number | null;
  format: 'TV Series' | 'Movie' | 'OVA' | 'ONA' | 'Special';
  studio: string;
  genres: string[];
  episodesCount: number | null;
  episodes: number | null;
  synopsis: string;
}

export function stripHtmlTags(raw: unknown): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[Written by MAL Rewrite\]/gi, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function mapExternalFormat(rawFormat: unknown): ExternalMetadataCandidate['format'] {
  const up = String(rawFormat || '').trim().toUpperCase();
  if (up === 'MOVIE') return 'Movie';
  if (up === 'OVA') return 'OVA';
  if (up === 'ONA') return 'ONA';
  if (up === 'SPECIAL' || up === 'MUSIC') return 'Special';
  return 'TV Series';
}

export function normalizeAniListCandidate(media: Record<string, any>): ExternalMetadataCandidate {
  const titleObj = media?.title || {};
  const primaryTitle = String(
    titleObj.english || titleObj.romaji || titleObj.native || 'Untitled'
  ).trim();

  const altSet = new Set<string>();
  if (titleObj.romaji && titleObj.romaji !== primaryTitle) altSet.add(String(titleObj.romaji).trim());
  if (titleObj.english && titleObj.english !== primaryTitle) altSet.add(String(titleObj.english).trim());
  if (titleObj.native && titleObj.native !== primaryTitle) altSet.add(String(titleObj.native).trim());
  if (Array.isArray(media?.synonyms)) {
    for (const syn of media.synonyms.slice(0, 4)) {
      if (syn && String(syn).trim() !== primaryTitle) altSet.add(String(syn).trim());
    }
  }

  const studioNodes = media?.studios?.nodes || [];
  const primaryStudio =
    Array.isArray(studioNodes) && studioNodes.length > 0 && studioNodes[0]?.name
      ? String(studioNodes[0].name).trim()
      : '';

  const year =
    Number(media?.seasonYear || media?.startDate?.year) > 1900
      ? Number(media?.seasonYear || media?.startDate?.year)
      : null;

  const episodes =
    Number.isInteger(Number(media?.episodes)) && Number(media?.episodes) > 0
      ? Number(media.episodes)
      : null;

  return {
    externalId: `anilist:${String(media?.id || '')}`,
    provider: 'anilist',
    title: primaryTitle,
    alternativeTitles: Array.from(altSet).filter(Boolean),
    posterUrl: String(media?.coverImage?.extraLarge || media?.coverImage?.large || '').trim(),
    bannerUrl: String(media?.bannerImage || '').trim(),
    releaseYear: year,
    year,
    format: mapExternalFormat(media?.format),
    studio: primaryStudio,
    genres: Array.isArray(media?.genres)
      ? media.genres.map((g: unknown) => String(g || '').trim()).filter(Boolean)
      : [],
    episodesCount: episodes,
    episodes,
    synopsis: stripHtmlTags(media?.description),
  };
}

export function normalizeJikanCandidate(item: Record<string, any>): ExternalMetadataCandidate {
  const primaryTitle = String(
    item?.title_english || item?.title || item?.title_japanese || 'Untitled'
  ).trim();

  const altSet = new Set<string>();
  if (item?.title && item.title !== primaryTitle) altSet.add(String(item.title).trim());
  if (item?.title_japanese && item.title_japanese !== primaryTitle) {
    altSet.add(String(item.title_japanese).trim());
  }
  if (Array.isArray(item?.title_synonyms)) {
    for (const syn of item.title_synonyms.slice(0, 4)) {
      if (syn && String(syn).trim() !== primaryTitle) altSet.add(String(syn).trim());
    }
  }

  const studios = Array.isArray(item?.studios) ? item.studios : [];
  const primaryStudio = studios.length > 0 && studios[0]?.name ? String(studios[0].name).trim() : '';

  const rawYear = Number(item?.year || item?.aired?.prop?.from?.year);
  const year = rawYear > 1900 ? rawYear : null;
  const episodes =
    Number.isInteger(Number(item?.episodes)) && Number(item?.episodes) > 0
      ? Number(item.episodes)
      : null;

  const genres = Array.isArray(item?.genres)
    ? item.genres.map((g: any) => String(g?.name || '').trim()).filter(Boolean)
    : [];

  return {
    externalId: `mal:${String(item?.mal_id || '')}`,
    provider: 'jikan',
    title: primaryTitle,
    alternativeTitles: Array.from(altSet).filter(Boolean),
    posterUrl: String(
      item?.images?.webp?.large_image_url ||
        item?.images?.jpg?.large_image_url ||
        item?.images?.jpg?.image_url ||
        ''
    ).trim(),
    bannerUrl: String(item?.trailer?.images?.maximum_image_url || '').trim(),
    releaseYear: year,
    year,
    format: mapExternalFormat(item?.type),
    studio: primaryStudio,
    genres,
    episodesCount: episodes,
    episodes,
    synopsis: stripHtmlTags(item?.synopsis),
  };
}

export interface MetadataFieldDiffItem {
  field:
    | 'title'
    | 'alternative_titles'
    | 'cover_image'
    | 'banner_image'
    | 'year'
    | 'type'
    | 'studio'
    | 'genres'
    | 'episodes_count'
    | 'synopsis'
    | 'external_id';
  label: string;
  currentValue: string;
  fetchedValue: string;
  hasCurrentValue: boolean;
  defaultSelected: boolean;
}

export type MetadataFieldDiff = MetadataFieldDiffItem;

/**
 * Computes field-level diff items between current editor form values and fetched candidate.
 * Fields that already have a non-empty manual value default to `defaultSelected: false`
 * so manually edited fields are NEVER overwritten without explicit user approval.
 */
export function computeMetadataFieldDiffs(
  current: {
    title?: string;
    alternativeTitles?: string;
    alternative_titles?: string;
    posterUrl?: string;
    cover_image?: string;
    bannerUrl?: string;
    banner_image?: string;
    releaseYear?: string | number | null;
    year?: string | number | null;
    type?: string;
    studio?: string;
    genres?: string | string[];
    episodesCount?: string | number | null;
    episodes_count?: string | number | null;
    synopsis?: string;
    externalId?: string;
    external_id?: string;
  },
  candidate: ExternalMetadataCandidate
): MetadataFieldDiffItem[] {
  const currGenres = Array.isArray(current.genres)
    ? current.genres.join(', ')
    : String(current.genres || '').trim();
  const fetchedGenres = candidate.genres.join(', ');
  const currAltTitles = current.alternative_titles ?? current.alternativeTitles ?? '';
  const currCover = current.cover_image ?? current.posterUrl ?? '';
  const currBanner = current.banner_image ?? current.bannerUrl ?? '';
  const currYear = current.year ?? current.releaseYear ?? null;
  const currEpisodes = current.episodes_count ?? current.episodesCount ?? null;
  const currExternalId = current.external_id ?? current.externalId ?? '';

  const rawRows: Array<{
    field: MetadataFieldDiffItem['field'];
    label: string;
    currentVal: string;
    fetchedVal: string;
  }> = [
    {
      field: 'title',
      label: 'Official Title',
      currentVal: String(current.title || '').trim(),
      fetchedVal: candidate.title,
    },
    {
      field: 'alternative_titles',
      label: 'Alternative Titles',
      currentVal: String(currAltTitles).trim(),
      fetchedVal: candidate.alternativeTitles.join(' | '),
    },
    {
      field: 'cover_image',
      label: 'Poster Artwork URL',
      currentVal: String(currCover).trim(),
      fetchedVal: candidate.posterUrl,
    },
    {
      field: 'banner_image',
      label: 'Banner Artwork URL',
      currentVal: String(currBanner).trim(),
      fetchedVal: candidate.bannerUrl,
    },
    {
      field: 'year',
      label: 'Release Year',
      currentVal: currYear ? String(currYear).trim() : '',
      fetchedVal: candidate.releaseYear ? String(candidate.releaseYear) : '',
    },
    {
      field: 'type',
      label: 'Media Format',
      currentVal: String(current.type || '').trim(),
      fetchedVal: candidate.format,
    },
    {
      field: 'studio',
      label: 'Animation Studio',
      currentVal: String(current.studio || '').trim(),
      fetchedVal: candidate.studio,
    },
    {
      field: 'genres',
      label: 'Genres',
      currentVal: currGenres,
      fetchedVal: fetchedGenres,
    },
    {
      field: 'episodes_count',
      label: 'Original Episode Count',
      currentVal:
        currEpisodes !== null &&
        currEpisodes !== undefined &&
        String(currEpisodes).trim() !== ''
          ? String(currEpisodes).trim()
          : '',
      fetchedVal: candidate.episodesCount !== null ? String(candidate.episodesCount) : '',
    },
    {
      field: 'synopsis',
      label: 'English Synopsis',
      currentVal: String(current.synopsis || '').trim(),
      fetchedVal: candidate.synopsis,
    },
    {
      field: 'external_id',
      label: 'External Provider ID',
      currentVal: String(currExternalId).trim(),
      fetchedVal: candidate.externalId,
    },
  ];

  return rawRows
    .filter((r) => Boolean(r.fetchedVal))
    .map((r) => {
      const hasCurrentValue = Boolean(r.currentVal);
      return {
        field: r.field,
        label: r.label,
        currentValue: r.currentVal,
        fetchedValue: r.fetchedVal,
        hasCurrentValue,
        defaultSelected: !hasCurrentValue,
      };
    });
}

/**
 * DATA HEALTH & QA SCANNER
 */
export type QaIssueCategory =
  | 'missing_artwork'
  | 'missing_synopsis'
  | 'duplicate_titles'
  | 'inconsistent_episodes'
  | 'unverified_dubs'
  | 'stale_verification'
  | 'missing_translations';

export type DataHealthIssueCategory = QaIssueCategory;

export interface QaIssueDetail {
  category: QaIssueCategory;
  severity: 'critical' | 'warning';
  label: string;
  detail: string;
  targetEditorTab:
    | 'identity'
    | 'artwork'
    | 'metadata'
    | 'dubs'
    | 'seasons'
    | 'translations';
}

export interface QaFlaggedIssueRow extends QaIssueDetail {
  animeId: string;
  title: string;
  slug: string;
  cover_image: string;
}

export interface QaFlaggedAnimeItem {
  animeId: string;
  title: string;
  slug: string;
  posterUrl: string;
  status: string;
  languages: string[];
  platform: string;
  lastVerifiedAt: string | null;
  issues: QaIssueDetail[];
}

export interface QaHealthScanReport {
  scannedAt: string;
  totalCatalogScanned: number;
  totalScanned: number;
  healthyCount: number;
  flaggedCount: number;
  categoryCounts: Record<QaIssueCategory, number>;
  countsByCategory: Record<QaIssueCategory, number>;
  items: QaFlaggedAnimeItem[];
  issues: QaFlaggedIssueRow[];
}

export type DataHealthScanReport = QaHealthScanReport;

export function scanCatalogDataHealth(
  animeRows: Array<Record<string, any>>,
  translationRowsOrOptions:
    | Array<{ anime_id: string | number; locale: string; translation_status?: string }>
    | {
        translationCountsByAnime?: Record<string, number>;
        nowMs?: number;
      } = [],
  dubMatrixRows: Array<{ anime_id: string | number; availability_status?: string; verified_at?: string | null }> = [],
  nowMsParam: number = Date.now()
): QaHealthScanReport {
  let translationRows: Array<{ anime_id: string | number; locale: string; translation_status?: string }> = [];
  let translationCountsByAnime: Record<string, number> | null = null;
  let nowMs = nowMsParam;

  if (Array.isArray(translationRowsOrOptions)) {
    translationRows = translationRowsOrOptions;
  } else if (translationRowsOrOptions && typeof translationRowsOrOptions === 'object') {
    if (translationRowsOrOptions.translationCountsByAnime) {
      translationCountsByAnime = translationRowsOrOptions.translationCountsByAnime;
    }
    if (typeof translationRowsOrOptions.nowMs === 'number') {
      nowMs = translationRowsOrOptions.nowMs;
    }
  }

  const categoryCounts: Record<QaIssueCategory, number> = {
    missing_artwork: 0,
    missing_synopsis: 0,
    duplicate_titles: 0,
    inconsistent_episodes: 0,
    unverified_dubs: 0,
    stale_verification: 0,
    missing_translations: 0,
  };

  // Detect duplicate normalized titles
  const titleFrequency = new Map<string, string[]>();
  for (const row of animeRows) {
    const normTitle = String(row.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
    if (!normTitle) continue;
    const list = titleFrequency.get(normTitle) || [];
    list.push(String(row.id));
    titleFrequency.set(normTitle, list);
  }

  // Index published translations per anime
  const publishedLocalesByAnime = new Map<string, Set<string>>();
  for (const tr of translationRows) {
    if (!tr.translation_status || tr.translation_status === 'published') {
      const aid = String(tr.anime_id);
      const set = publishedLocalesByAnime.get(aid) || new Set<string>();
      set.add(String(tr.locale).toLowerCase());
      publishedLocalesByAnime.set(aid, set);
    }
  }

  // Index dub matrix rows per anime
  const matrixByAnime = new Map<string, Array<{ availability_status?: string; verified_at?: string | null }>>();
  for (const dm of dubMatrixRows) {
    const aid = String(dm.anime_id);
    const list = matrixByAnime.get(aid) || [];
    list.push(dm);
    matrixByAnime.set(aid, list);
  }

  const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
  const flaggedItems: QaFlaggedAnimeItem[] = [];
  const flatIssues: QaFlaggedIssueRow[] = [];

  for (const row of animeRows) {
    const animeId = String(row.id ?? '');
    const title = String(row.title || 'Untitled');
    const slug = String(row.slug || '');
    const posterUrl = String(
      row.cover_image || row.posterUrl || row.poster_url || row.poster || row.image || ''
    ).trim();
    const bannerUrl = String(row.banner_image || row.bannerUrl || '').trim();
    const synopsis = String(row.synopsis || row.description || '').trim();
    const status = String(row.status || row.airing_status || 'Airing');
    const rawLangs = Array.isArray(row.languages)
      ? row.languages.map(String).filter(Boolean)
      : typeof row.languages === 'string' && row.languages.trim()
        ? row.languages
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];
    const platform = String(row.platform || '').trim();
    const watchUrl = String(row.watch_url || row.streamUrl || row.official_source_url || '').trim();
    const lastVerifiedAt = row.last_verified_at ? String(row.last_verified_at) : null;

    const issues: QaIssueDetail[] = [];

    // 1. Missing posters / banners
    const hasValidPoster =
      Boolean(posterUrl) &&
      posterUrl !== '/logo.png' &&
      !posterUrl.includes('picsum.photos') &&
      !posterUrl.includes('placeholder');
    const hasValidBanner = Boolean(bannerUrl) && bannerUrl !== '/logo.png';
    if (!hasValidPoster || !hasValidBanner) {
      issues.push({
        category: 'missing_artwork',
        severity: !hasValidPoster ? 'critical' : 'warning',
        label: !hasValidPoster ? 'Missing Poster Artwork' : 'Missing Banner Artwork',
        detail: !hasValidPoster
          ? 'Primary vertical poster URL is missing or using a fallback logo.'
          : 'Wide hero banner image URL is missing.',
        targetEditorTab: 'artwork',
      });
    }

    // 2. Missing synopsis
    if (!synopsis || synopsis.length < 30 || synopsis.toLowerCase() === 'exciting anime series') {
      issues.push({
        category: 'missing_synopsis',
        severity: 'critical',
        label: 'Missing / Stub Synopsis',
        detail: 'English synopsis is empty or under 30 characters.',
        targetEditorTab: 'metadata',
      });
    }

    // 3. Potential duplicate titles
    const normTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
    const dupIds = normTitle ? titleFrequency.get(normTitle) || [] : [];
    if (dupIds.length > 1) {
      issues.push({
        category: 'duplicate_titles',
        severity: 'critical',
        label: 'Potential Duplicate Title',
        detail: `Collides with ID(s): ${dupIds.filter((id) => id !== animeId).join(', ')}`,
        targetEditorTab: 'identity',
      });
    }

    // 4. Inconsistent episode counts
    const epCount = Number(row.episodes_count ?? row.episodes ?? row.episode_count ?? 0);
    const epsPerSeason = String(row.episodes_per_season || row.season_episode_count || '').trim();
    let seasonSum = 0;
    if (epsPerSeason) {
      const nums = epsPerSeason.match(/\d+/g);
      if (nums && nums.length > 1) {
        seasonSum = nums.map(Number).reduce((a, b) => a + b, 0);
      }
    }
    if (!Number.isFinite(epCount) || epCount <= 0) {
      issues.push({
        category: 'inconsistent_episodes',
        severity: 'warning',
        label: 'Missing Episode Count',
        detail: 'Total episode count is missing or 0.',
        targetEditorTab: 'seasons',
      });
    } else if (seasonSum > 0 && epCount < seasonSum && !epsPerSeason.includes('S1')) {
      issues.push({
        category: 'inconsistent_episodes',
        severity: 'warning',
        label: 'Episode Count Mismatch',
        detail: `Total episodes (${epCount}) is less than season breakdown sum (${seasonSum}).`,
        targetEditorTab: 'seasons',
      });
    }

    // 5. Unverified dub claims
    const matrixEntries = matrixByAnime.get(animeId) || [];
    const hasVerifiedMatrix = matrixEntries.some(
      (m) => m.availability_status === 'complete' || m.availability_status === 'partial'
    );
    if (rawLangs.length === 0 && !hasVerifiedMatrix) {
      issues.push({
        category: 'unverified_dubs',
        severity: 'critical',
        label: 'Unverified Dub Languages',
        detail: 'No verified Indian dub languages or matrix records assigned.',
        targetEditorTab: 'dubs',
      });
    } else if (rawLangs.length > 0 && !platform && !watchUrl && !hasVerifiedMatrix) {
      issues.push({
        category: 'unverified_dubs',
        severity: 'warning',
        label: 'Dub Claim Missing OTT / Source URL',
        detail: `Lists ${rawLangs.join(', ')} without an official OTT platform or source URL.`,
        targetEditorTab: 'dubs',
      });
    }

    // 6. Stale OTT verification dates (> 90 days)
    const latestMatrixVerified = matrixEntries
      .map((m) => (m.verified_at ? Date.parse(m.verified_at) : NaN))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a)[0];
    const verifiedTimestamp = lastVerifiedAt
      ? Date.parse(lastVerifiedAt)
      : latestMatrixVerified || NaN;

    if (!Number.isFinite(verifiedTimestamp)) {
      issues.push({
        category: 'stale_verification',
        severity: 'warning',
        label: 'Never Verified Timestamp',
        detail: 'OTT dub availability has no recorded verification timestamp.',
        targetEditorTab: 'dubs',
      });
    } else if (nowMs - verifiedTimestamp > STALE_THRESHOLD_MS) {
      const daysOld = Math.floor((nowMs - verifiedTimestamp) / (24 * 60 * 60 * 1000));
      issues.push({
        category: 'stale_verification',
        severity: 'warning',
        label: `Stale Verification (${daysOld}d old)`,
        detail: 'OTT verification timestamp is older than 90 days.',
        targetEditorTab: 'dubs',
      });
    }

    // 7. Missing translations across 6 Indian locales
    const trCount =
      translationCountsByAnime && translationCountsByAnime[animeId] !== undefined
        ? Number(translationCountsByAnime[animeId])
        : (publishedLocalesByAnime.get(animeId) || new Set<string>()).size;
    if (trCount < 6) {
      const missingCount = 6 - trCount;
      issues.push({
        category: 'missing_translations',
        severity: 'warning',
        label: `Missing ${missingCount}/6 Translations`,
        detail: `${trCount} of 6 native synopsis translations published.`,
        targetEditorTab: 'translations',
      });
    }

    if (issues.length > 0) {
      const seenCats = new Set<QaIssueCategory>();
      for (const iss of issues) {
        if (!seenCats.has(iss.category)) {
          seenCats.add(iss.category);
          categoryCounts[iss.category] += 1;
        }
        flatIssues.push({
          ...iss,
          animeId,
          title,
          slug,
          cover_image: posterUrl || '/logo.png',
        });
      }
      flaggedItems.push({
        animeId,
        title,
        slug,
        posterUrl,
        status,
        languages: rawLangs,
        platform,
        lastVerifiedAt,
        issues,
      });
    }
  }

  return {
    scannedAt: new Date(nowMs).toISOString(),
    totalCatalogScanned: animeRows.length,
    totalScanned: animeRows.length,
    healthyCount: Math.max(0, animeRows.length - flaggedItems.length),
    flaggedCount: flaggedItems.length,
    categoryCounts,
    countsByCategory: categoryCounts,
    items: flaggedItems,
    issues: flatIssues,
  };
}

/**
 * CSV DRY-RUN VALIDATOR
 */
export interface CsvDryRunRowResult {
  rowIndex: number;
  title: string;
  slug: string;
  year: number;
  type: string;
  status: 'valid' | 'duplicate' | 'invalid';
  airingStatus: string;
  studio: string;
  languages: string;
  languageList: string[];
  platform: string;
  episodesCount: number | null;
  statusTag: 'valid' | 'duplicate_db' | 'duplicate_batch' | 'error';
  errors: string[];
  warnings: string[];
  normalizedRow: Record<string, any>;
}

export interface CsvDryRunSummary {
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  invalidCount: number;
  rows: CsvDryRunRowResult[];
}

export function validateCsvDryRunRows(
  rawRows: Array<Record<string, any>>,
  existingTitlesOrList: Set<string> | Array<Record<string, any>> = new Set<string>()
): CsvDryRunSummary {
  const existingLowerTitles =
    existingTitlesOrList instanceof Set
      ? existingTitlesOrList
      : new Set(
          (Array.isArray(existingTitlesOrList) ? existingTitlesOrList : [])
            .map((a) => String(a?.title || '').trim().toLowerCase())
            .filter(Boolean)
        );
  const seenInBatch = new Set<string>();
  const results: CsvDryRunRowResult[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  rawRows.forEach((row, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const rawTitle = String(
      row.title ||
        row.Title ||
        row.Name ||
        row.name ||
        row['Anime Title'] ||
        row.anime_title ||
        ''
    ).trim();

    if (!rawTitle) {
      errors.push('Missing anime Title.');
    }

    const lowerTitle = rawTitle.toLowerCase();
    const slug =
      lowerTitle.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `anime-${index + 1}`;

    const rawYear = Number(row.releaseYear || row.year || row['Release Year'] || row.Year || 2024);
    const year = Number.isInteger(rawYear) && rawYear >= 1960 && rawYear <= 2035 ? rawYear : 2024;
    if (!Number.isInteger(rawYear) || rawYear < 1960 || rawYear > 2035) {
      warnings.push(`Invalid release year "${row.year ?? ''}", defaulted to 2024.`);
    }

    // Never auto-populate Tamil/Hindi/Telugu when languages column is empty!
    const rawLangStr = Array.isArray(row.languages)
      ? row.languages.join(', ')
      : String(row.languages || row.Languages || '').trim();
    const parsedLangs = rawLangStr
      ? rawLangStr
          .split(/[|,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (parsedLangs.length === 0) {
      warnings.push('No dub languages specified (will import as Unverified).');
    }

    const platform = String(row.platforms || row.Platforms || row.platform || row.Platform || '').trim();
    const rawEp = row.episodes ?? row.episodes_count ?? row.Episodes ?? null;
    const epNum = rawEp !== null && rawEp !== '' ? parseInt(String(rawEp), 10) : null;
    const episodesCount = epNum !== null && !Number.isNaN(epNum) && epNum > 0 ? epNum : null;

    let statusTag: CsvDryRunRowResult['statusTag'] = 'valid';
    let rowStatus: CsvDryRunRowResult['status'] = 'valid';
    if (errors.length > 0) {
      statusTag = 'error';
      rowStatus = 'invalid';
      errorCount++;
    } else if (seenInBatch.has(lowerTitle)) {
      statusTag = 'duplicate_batch';
      rowStatus = 'duplicate';
      errors.push('Duplicate title within this CSV file.');
      duplicateCount++;
    } else if (existingLowerTitles.has(lowerTitle)) {
      statusTag = 'duplicate_db';
      rowStatus = 'duplicate';
      errors.push('Title already exists in Cloudflare D1 catalog.');
      duplicateCount++;
    } else {
      seenInBatch.add(lowerTitle);
      validCount++;
    }

    const languagesString = parsedLangs.join(', ');

    results.push({
      rowIndex: index + 1,
      title: rawTitle || '(Missing Title)',
      slug,
      year,
      type: String(row.type || row.Type || 'TV Series').trim(),
      status: rowStatus,
      airingStatus: String(row.status || row.Status || 'Completed').trim(),
      studio: String(row.studio || row.Studio || 'Unknown Studio').trim(),
      languages: languagesString,
      languageList: parsedLangs,
      platform,
      episodesCount,
      statusTag,
      errors,
      warnings,
      normalizedRow: {
        ...row,
        title: rawTitle,
        languages: languagesString,
      },
    });
  });

  return {
    totalRows: rawRows.length,
    validCount,
    duplicateCount,
    errorCount,
    invalidCount: errorCount,
    rows: results,
  };
}
