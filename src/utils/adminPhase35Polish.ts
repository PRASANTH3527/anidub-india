// Pure, unit-testable domain logic for AniDub India — Admin Dashboard 2.0 (Phase 3.5: Final Polish, Recycle Bin & Power Ops)

export const RECYCLE_BIN_ENTITY_TYPES = [
  'anime',
  'reviews',
  'dub_reviews',
  'anime_franchise_links',
  'anime_cast_entries',
] as const;

export type RecycleBinEntityType = (typeof RECYCLE_BIN_ENTITY_TYPES)[number];

export interface RecycleBinArchiveInput {
  entity_type: RecycleBinEntityType;
  entity_id: string | number;
  title?: string | null;
  payload: unknown;
  deleted_by?: string | null;
}

export interface RecycleBinArchiveRecord {
  entity_type: RecycleBinEntityType;
  entity_id: string;
  title: string | null;
  payload_json: string;
  deleted_by: string | null;
}

export function buildRecycleBinArchiveEntry(input: RecycleBinArchiveInput): RecycleBinArchiveRecord {
  if (!RECYCLE_BIN_ENTITY_TYPES.includes(input.entity_type)) {
    throw new Error(`Invalid recycle bin entity_type: ${String(input.entity_type)}`);
  }
  const entityId = String(input.entity_id ?? '').trim();
  if (!entityId) {
    throw new Error('Recycle bin entity_id is required');
  }
  const payloadJson =
    typeof input.payload === 'string'
      ? input.payload
      : JSON.stringify(input.payload ?? {});

  return {
    entity_type: input.entity_type,
    entity_id: entityId,
    title: input.title ? String(input.title).trim().slice(0, 240) : null,
    payload_json: payloadJson,
    deleted_by: input.deleted_by ? String(input.deleted_by).trim().slice(0, 160) : 'admin',
  };
}

export function validateRecycleBinPurgeConfirmation(confirmText: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof confirmText !== 'string' || confirmText.trim() !== 'PURGE') {
    return {
      valid: false,
      error: 'Permanent purge requires typing exact confirmation "PURGE".',
    };
  }
  return { valid: true };
}

export interface CsvDryRunRowLike {
  rowNumber: number;
  title: string;
  slug: string;
  status: 'valid' | 'duplicate' | 'invalid';
  errors: string[];
  raw?: Record<string, string>;
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateFailedCsvRowsExport(rows: CsvDryRunRowLike[]): string {
  const failedRows = (rows || []).filter(
    (r) => r.status !== 'valid' || (Array.isArray(r.errors) && r.errors.length > 0)
  );
  if (failedRows.length === 0) {
    return '';
  }

  // Collect all unique original column headers across raw rows, falling back to core columns
  const rawKeySet = new Set<string>();
  for (const r of failedRows) {
    if (r.raw && typeof r.raw === 'object') {
      for (const k of Object.keys(r.raw)) {
        if (k && k !== 'error_reason') rawKeySet.add(k);
      }
    }
  }

  const baseHeaders =
    rawKeySet.size > 0
      ? Array.from(rawKeySet)
      : ['row_number', 'title', 'slug', 'status'];
  const headers = [...baseHeaders, 'error_reason'];

  const lines: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const r of failedRows) {
    const errorReason =
      Array.isArray(r.errors) && r.errors.length > 0
        ? r.errors.join('; ')
        : r.status === 'duplicate'
        ? 'Duplicate title or slug in catalog'
        : 'Validation failed';

    const values = baseHeaders.map((col) => {
      if (r.raw && col in r.raw) {
        return escapeCsvCell(r.raw[col]);
      }
      if (col === 'row_number') return escapeCsvCell(r.rowNumber);
      if (col === 'title') return escapeCsvCell(r.title);
      if (col === 'slug') return escapeCsvCell(r.slug);
      if (col === 'status') return escapeCsvCell(r.status);
      return '';
    });

    values.push(escapeCsvCell(errorReason));
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

export interface CatalogDuplicateCandidate {
  id: number;
  title: string;
  slug?: string | null;
  status?: string | null;
}

export interface DuplicateMatchResult {
  id: number;
  title: string;
  slug: string;
  matchType: 'exact_title' | 'slug' | 'similar_title';
}

function normalizeTitleForComparison(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeSlugForComparison(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function findPotentialCatalogDuplicates(
  pendingSubmission: { id?: number; title: string; slug?: string | null },
  existingCatalog: CatalogDuplicateCandidate[]
): DuplicateMatchResult[] {
  const pendingNormTitle = normalizeTitleForComparison(pendingSubmission.title);
  const pendingSlug = normalizeSlugForComparison(
    pendingSubmission.slug || pendingSubmission.title
  );

  if (!pendingNormTitle) return [];

  const matches: DuplicateMatchResult[] = [];
  const seenIds = new Set<number>();

  for (const item of existingCatalog || []) {
    if (!item || typeof item.id !== 'number') continue;
    if (pendingSubmission.id !== undefined && item.id === pendingSubmission.id) continue;
    if (String(item.status || '').toLowerCase() === 'pending') continue;

    const itemNormTitle = normalizeTitleForComparison(item.title);
    const itemSlug = normalizeSlugForComparison(item.slug || item.title);

    if (!itemNormTitle) continue;

    if (itemNormTitle === pendingNormTitle) {
      seenIds.add(item.id);
      matches.push({
        id: item.id,
        title: item.title,
        slug: item.slug || itemSlug,
        matchType: 'exact_title',
      });
      continue;
    }

    if (pendingSlug && itemSlug && itemSlug === pendingSlug) {
      seenIds.add(item.id);
      matches.push({
        id: item.id,
        title: item.title,
        slug: item.slug || itemSlug,
        matchType: 'slug',
      });
      continue;
    }

    if (
      pendingNormTitle.length >= 6 &&
      itemNormTitle.length >= 6 &&
      (itemNormTitle.includes(pendingNormTitle) || pendingNormTitle.includes(itemNormTitle))
    ) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        matches.push({
          id: item.id,
          title: item.title,
          slug: item.slug || itemSlug,
          matchType: 'similar_title',
        });
      }
    }
  }

  return matches.slice(0, 5);
}

export const REJECTION_REASON_PRESETS = [
  'Duplicate Entry',
  'Unverified Dub Claim',
  'Missing Official OTT Source',
  'Spam/Off-Topic',
] as const;

export type RejectionReasonPreset = (typeof REJECTION_REASON_PRESETS)[number];

export function formatModerationRejectionSummary(
  animeId: number | string,
  title: string,
  reasonPreset?: string | null,
  moderatorNote?: string | null
): string {
  const base = `Rejected pending anime #${animeId} (${title || 'Untitled'})`;
  const parts: string[] = [];
  if (reasonPreset && String(reasonPreset).trim()) {
    parts.push(`Reason: ${String(reasonPreset).trim()}`);
  }
  if (moderatorNote && String(moderatorNote).trim()) {
    parts.push(`Note: ${String(moderatorNote).trim().slice(0, 240)}`);
  }
  return parts.length > 0 ? `${base} — ${parts.join(' | ')}` : base;
}

export function checkOptimisticConcurrencyConflict(
  expectedUpdatedAt?: string | null,
  currentDbUpdatedAt?: string | null
): {
  conflict: boolean;
  expectedUpdatedAt: string | null;
  currentDbUpdatedAt: string | null;
} {
  const expected = expectedUpdatedAt ? String(expectedUpdatedAt).trim() : null;
  const current = currentDbUpdatedAt ? String(currentDbUpdatedAt).trim() : null;

  if (!expected || !current) {
    return {
      conflict: false,
      expectedUpdatedAt: expected,
      currentDbUpdatedAt: current,
    };
  }

  return {
    conflict: expected !== current,
    expectedUpdatedAt: expected,
    currentDbUpdatedAt: current,
  };
}

export interface RevisionFieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

const TRACKED_REVISION_FIELDS = [
  'title',
  'slug',
  'synopsis',
  'status',
  'release_year',
  'episodes_count',
  'rating',
  'Content_Type',
  'poster_url',
  'banner_url',
  'trailer_url',
  'crunchyroll_url',
  'netflix_url',
  'prime_url',
  'jio_url',
  'youtube_url',
  'dub_languages',
  'streaming_platforms',
  'genres',
  'seo_title',
  'seo_description',
] as const;

export function computeAnimeRevisionDiff(
  beforeSnapshot: Record<string, unknown> | null | undefined,
  afterSnapshot: Record<string, unknown> | null | undefined
): {
  changes: RevisionFieldDiff[];
  summary: string;
} {
  const beforeObj = beforeSnapshot || {};
  const afterObj = afterSnapshot || {};
  const changes: RevisionFieldDiff[] = [];

  for (const field of TRACKED_REVISION_FIELDS) {
    const bVal = beforeObj[field];
    const aVal = afterObj[field];
    const bNorm = typeof bVal === 'object' ? JSON.stringify(bVal ?? null) : String(bVal ?? '');
    const aNorm = typeof aVal === 'object' ? JSON.stringify(aVal ?? null) : String(aVal ?? '');
    if (bNorm !== aNorm) {
      changes.push({
        field,
        before: bVal ?? null,
        after: aVal ?? null,
      });
    }
  }

  const summary =
    changes.length === 0
      ? 'Saved anime metadata (no tracked field changes)'
      : `Updated ${changes.map((c) => c.field).slice(0, 5).join(', ')}${
          changes.length > 5 ? ` (+${changes.length - 5} more)` : ''
        }`;

  return { changes, summary };
}

export function checkDailyAiUsageQuota(
  usedToday: number,
  dailyCap: number
): {
  allowed: boolean;
  usedToday: number;
  dailyCap: number;
  remaining: number;
} {
  const safeUsed = Math.max(0, Math.floor(Number(usedToday) || 0));
  const safeCap = Math.max(1, Math.floor(Number(dailyCap) || 100));
  const remaining = Math.max(0, safeCap - safeUsed);
  return {
    allowed: safeUsed < safeCap,
    usedToday: safeUsed,
    dailyCap: safeCap,
    remaining,
  };
}

export interface ExtendedDataHealthInput {
  animeRows: Array<{
    id: number;
    title: string;
    slug?: string | null;
    mal_id?: number | string | null;
    anilist_id?: number | string | null;
    external_id?: string | null;
  }>;
  franchiseRows: Array<{
    id?: number;
    franchise_key: string;
    franchise_title?: string | null;
    anime_id: number;
    relation_type?: string | null;
    watch_order: number;
  }>;
  castRows: Array<{
    id: number;
    anime_id: number;
    character_name: string;
    voice_actor_name: string;
    language: string;
    verified: number | boolean;
  }>;
}

export interface ExtendedDataHealthReport {
  orphanFranchiseLinks: Array<{
    id?: number;
    franchise_key: string;
    franchise_title: string;
    anime_id: number;
    watch_order: number;
  }>;
  conflictingWatchOrders: Array<{
    franchise_key: string;
    watch_order: number;
    anime_ids: number[];
  }>;
  unverifiedCastEntries: Array<{
    id: number;
    anime_id: number;
    anime_title: string;
    character_name: string;
    voice_actor_name: string;
    language: string;
  }>;
  missingExternalIds: Array<{
    anime_id: number;
    title: string;
    slug: string;
  }>;
}

export function scanExtendedDataHealth(input: ExtendedDataHealthInput): ExtendedDataHealthReport {
  const animeById = new Map<number, ExtendedDataHealthInput['animeRows'][number]>();
  for (const a of input.animeRows || []) {
    if (a && typeof a.id === 'number') {
      animeById.set(a.id, a);
    }
  }

  const orphanFranchiseLinks: ExtendedDataHealthReport['orphanFranchiseLinks'] = [];
  const watchOrderGroups = new Map<string, number[]>();

  for (const f of input.franchiseRows || []) {
    const animeId = Number(f.anime_id);
    if (!animeById.has(animeId)) {
      orphanFranchiseLinks.push({
        id: f.id,
        franchise_key: f.franchise_key,
        franchise_title: f.franchise_title || f.franchise_key,
        anime_id: animeId,
        watch_order: Number(f.watch_order) || 1,
      });
    }

    const key = `${f.franchise_key}::${Number(f.watch_order) || 1}`;
    const existing = watchOrderGroups.get(key) || [];
    existing.push(animeId);
    watchOrderGroups.set(key, existing);
  }

  const conflictingWatchOrders: ExtendedDataHealthReport['conflictingWatchOrders'] = [];
  for (const [compositeKey, animeIds] of watchOrderGroups.entries()) {
    if (animeIds.length > 1) {
      const [franchiseKey, orderStr] = compositeKey.split('::');
      conflictingWatchOrders.push({
        franchise_key: franchiseKey,
        watch_order: Number(orderStr) || 1,
        anime_ids: animeIds,
      });
    }
  }

  const unverifiedCastEntries: ExtendedDataHealthReport['unverifiedCastEntries'] = [];
  for (const c of input.castRows || []) {
    const isVerified = c.verified === true || Number(c.verified) === 1;
    if (!isVerified) {
      const anime = animeById.get(Number(c.anime_id));
      unverifiedCastEntries.push({
        id: Number(c.id),
        anime_id: Number(c.anime_id),
        anime_title: anime?.title || `Anime #${c.anime_id}`,
        character_name: c.character_name,
        voice_actor_name: c.voice_actor_name,
        language: c.language,
      });
    }
  }

  const missingExternalIds: ExtendedDataHealthReport['missingExternalIds'] = [];
  for (const a of input.animeRows || []) {
    const hasExternalId =
      (a.mal_id !== undefined && a.mal_id !== null && String(a.mal_id).trim() !== '') ||
      (a.anilist_id !== undefined && a.anilist_id !== null && String(a.anilist_id).trim() !== '') ||
      (a.external_id !== undefined && a.external_id !== null && String(a.external_id).trim() !== '');

    if (!hasExternalId) {
      missingExternalIds.push({
        anime_id: a.id,
        title: a.title,
        slug: a.slug || '',
      });
    }
  }

  return {
    orphanFranchiseLinks,
    conflictingWatchOrders,
    unverifiedCastEntries,
    missingExternalIds,
  };
}

export interface HighDemandMissingDubItem {
  anime_id: number;
  title: string;
  slug: string;
  poster_url: string | null;
  total_demand_events: number;
  detail_views: number;
  watchlist_adds: number;
  ott_clicks: number;
  translation_requests: number;
  verified_languages: string[];
  missing_languages: string[];
}

const CORE_REGIONAL_DUB_LANGUAGES = ['Tamil', 'Hindi', 'Telugu'] as const;

export function computeHighDemandMissingDubs(
  animeRows: Array<{
    id: number;
    title: string;
    slug?: string | null;
    poster_url?: string | null;
  }>,
  demandEventsByAnime: Array<{
    anime_id: number;
    detail_views?: number;
    watchlist_adds?: number;
    ott_clicks?: number;
    translation_requests?: number;
  }>,
  verifiedDubMatrixRows: Array<{
    anime_id: number;
    language: string;
    verified: number | boolean;
    status?: string | null;
  }>
): HighDemandMissingDubItem[] {
  const animeById = new Map<number, (typeof animeRows)[number]>();
  for (const a of animeRows || []) {
    if (a && typeof a.id === 'number') {
      animeById.set(a.id, a);
    }
  }

  const verifiedLangsByAnime = new Map<number, Set<string>>();
  for (const row of verifiedDubMatrixRows || []) {
    const isVerified = row.verified === true || Number(row.verified) === 1;
    const status = String(row.status || '').toLowerCase();
    if (!isVerified || (status !== 'complete' && status !== 'partial')) continue;

    const animeId = Number(row.anime_id);
    const set = verifiedLangsByAnime.get(animeId) || new Set<string>();
    const normalizedLang =
      CORE_REGIONAL_DUB_LANGUAGES.find(
        (l) => l.toLowerCase() === String(row.language || '').trim().toLowerCase()
      ) || String(row.language || '').trim();
    if (normalizedLang) set.add(normalizedLang);
    verifiedLangsByAnime.set(animeId, set);
  }

  const results: HighDemandMissingDubItem[] = [];

  for (const demand of demandEventsByAnime || []) {
    const animeId = Number(demand.anime_id);
    const anime = animeById.get(animeId);
    if (!anime) continue;

    const detailViews = Math.max(0, Number(demand.detail_views) || 0);
    const watchlistAdds = Math.max(0, Number(demand.watchlist_adds) || 0);
    const ottClicks = Math.max(0, Number(demand.ott_clicks) || 0);
    const translationRequests = Math.max(0, Number(demand.translation_requests) || 0);
    const total = detailViews + watchlistAdds + ottClicks + translationRequests;
    if (total <= 0) continue;

    const verifiedSet = verifiedLangsByAnime.get(animeId) || new Set<string>();
    const missingLanguages = CORE_REGIONAL_DUB_LANGUAGES.filter((l) => !verifiedSet.has(l));
    if (missingLanguages.length === 0) continue;

    results.push({
      anime_id: anime.id,
      title: anime.title,
      slug: anime.slug || '',
      poster_url: anime.poster_url || null,
      total_demand_events: total,
      detail_views: detailViews,
      watchlist_adds: watchlistAdds,
      ott_clicks: ottClicks,
      translation_requests: translationRequests,
      verified_languages: Array.from(verifiedSet),
      missing_languages: missingLanguages,
    });
  }

  return results.sort((a, b) => b.total_demand_events - a.total_demand_events).slice(0, 15);
}
