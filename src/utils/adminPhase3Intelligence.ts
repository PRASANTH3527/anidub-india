/**
 * Pure Domain Logic, Validators & Normalizers for AniDub India — Admin Dashboard 2.0
 * (Phase 3: Intelligence, Universe/Cast Ops & Backup Scale)
 */

import { languageCodeToName, languageNameToCode } from './adminOpsPro';
import { sanitizeOptionalHttpsImageUrl } from './animeDetailsV2';

export const FRANCHISE_RELATION_LABELS = [
  'Original Series',
  'Sequel',
  'Prequel',
  'Movie',
  'OVA',
  'Special',
  'Spin-off',
  'Next Generation',
] as const;

export type FranchiseRelationLabel = (typeof FRANCHISE_RELATION_LABELS)[number];

export interface AdminFranchiseEntry {
  id?: number;
  franchise_key: string;
  anime_id: string;
  relation_label: string;
  watch_order: number;
  note: string | null;
  updated_at?: string;
  // Joined catalog preview fields
  title?: string;
  slug?: string;
  cover_image?: string;
  year?: number | null;
  status?: string;
  episodes_count?: number | null;
  languages?: string[];
}

export function normalizeFranchiseKey(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function validateFranchiseEntryInput(
  input: {
    franchise_key?: unknown;
    anime_id?: unknown;
    relation_label?: unknown;
    watch_order?: unknown;
    note?: unknown;
  },
  existingEntries: Array<{ franchise_key: string; anime_id: string }> = [],
  allowOverwriteSameAnime: boolean = false
):
  | {
      ok: true;
      data: {
        franchise_key: string;
        anime_id: string;
        relation_label: string;
        watch_order: number;
        note: string | null;
      };
    }
  | { ok: false; error: string } {
  const franchiseKey = normalizeFranchiseKey(input.franchise_key);
  if (!franchiseKey || franchiseKey.length < 2) {
    return {
      ok: false,
      error: 'franchise_key is required (at least 2 characters, e.g., "naruto", "demon-slayer").',
    };
  }

  const animeId = String(input.anime_id ?? '').trim();
  if (!animeId) {
    return { ok: false, error: 'anime_id is required to add an entry to a franchise timeline.' };
  }

  if (!allowOverwriteSameAnime) {
    const duplicate = existingEntries.some(
      (e) =>
        normalizeFranchiseKey(e.franchise_key) === franchiseKey &&
        String(e.anime_id).trim() === animeId
    );
    if (duplicate) {
      return {
        ok: false,
        error: `Anime #${animeId} is already in franchise "${franchiseKey}". Duplicate (franchise_key, anime_id) entries are not allowed.`,
      };
    }
  }

  const rawRelation = String(input.relation_label || 'Original Series').trim();
  const relationLabel = rawRelation.slice(0, 60) || 'Original Series';

  const rawOrder = Number(input.watch_order);
  const watchOrder =
    Number.isFinite(rawOrder) && rawOrder >= 1 ? Math.floor(rawOrder) : existingEntries.length + 1;

  const rawNote =
    input.note !== undefined && input.note !== null ? String(input.note).trim() : '';
  const note = rawNote ? rawNote.slice(0, 300) : null;

  return {
    ok: true,
    data: {
      franchise_key: franchiseKey,
      anime_id: animeId,
      relation_label: relationLabel,
      watch_order: watchOrder,
      note,
    },
  };
}

/**
 * Reorders a franchise watch-order array up or down and cleanly normalizes watch_order integers (1..N).
 */
export function reorderFranchiseEntries<T extends { anime_id: string; watch_order: number }>(
  entries: readonly T[],
  index: number,
  direction: 'up' | 'down'
): T[] {
  const sorted = [...entries].sort((a, b) => a.watch_order - b.watch_order);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= sorted.length || targetIndex < 0 || targetIndex >= sorted.length) {
    return sorted.map((item, idx) => ({ ...item, watch_order: idx + 1 }));
  }

  const temp = sorted[index];
  sorted[index] = sorted[targetIndex];
  sorted[targetIndex] = temp;

  return sorted.map((item, idx) => ({
    ...item,
    watch_order: idx + 1,
  }));
}

/**
 * CHARACTERS & INDIAN / JAPANESE VOICE ACTOR MANAGER
 */
export const CAST_SUPPORTED_LANGUAGES = [
  'Japanese',
  'Tamil',
  'Hindi',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
] as const;

export type CastSupportedLanguage = (typeof CAST_SUPPORTED_LANGUAGES)[number];

export interface AdminCastEntry {
  id: number;
  anime_id: string;
  character_name: string;
  role: 'Main' | 'Supporting';
  voice_actor_name: string;
  dub_language: string;
  character_image: string | null;
  actor_image: string | null;
  verified: boolean;
  updated_at?: string;
}

export function normalizeCastLanguage(raw: unknown): string {
  const clean = String(raw || '').trim();
  if (!clean) return '';
  if (clean.toLowerCase() === 'japanese' || clean.toLowerCase() === 'jp' || clean.toLowerCase() === 'ja') {
    return 'Japanese';
  }
  const mapped = languageCodeToName(clean);
  const match = CAST_SUPPORTED_LANGUAGES.find(
    (l) => l.toLowerCase() === mapped.toLowerCase() || l.toLowerCase() === clean.toLowerCase()
  );
  return match || '';
}

/**
 * Validates a cast & voice actor payload.
 * IMPORTANT: Defaults `verified` to 0 (unverified) unless explicitly marked true / 1.
 */
export function validateAdminCastPayload(input: Record<string, unknown>):
  | {
      ok: true;
      data: {
        anime_id: string;
        character_name: string;
        role: 'Main' | 'Supporting';
        voice_actor_name: string;
        dub_language: string;
        character_image: string | null;
        actor_image: string | null;
        verified: number;
      };
    }
  | { ok: false; error: string } {
  const animeId = String(input.anime_id ?? input.animeId ?? '').trim();
  if (!animeId) {
    return { ok: false, error: 'anime_id is required.' };
  }

  const characterName = String(input.character_name ?? input.characterName ?? '').trim().slice(0, 120);
  if (!characterName) {
    return { ok: false, error: 'Character name is required.' };
  }

  const voiceActorName = String(input.voice_actor_name ?? input.voiceActorName ?? '').trim().slice(0, 120);
  if (!voiceActorName) {
    return { ok: false, error: 'Voice actor name is required.' };
  }

  const dubLanguage = normalizeCastLanguage(input.dub_language ?? input.dubLanguage ?? input.language);
  if (!dubLanguage) {
    return { ok: false, error: 'Voice actor language (Japanese, Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali) is required.' };
  }

  const rawRole = String(input.role || 'Main').trim();
  const role: 'Main' | 'Supporting' =
    rawRole.toLowerCase() === 'supporting' ? 'Supporting' : 'Main';

  const characterImage = sanitizeOptionalHttpsImageUrl(
    input.character_image ?? input.characterImage
  );
  const actorImage = sanitizeOptionalHttpsImageUrl(input.actor_image ?? input.actorImage);

  // Default to unverified (0) unless explicitly verified = true or 1
  const verified =
    input.verified === true || input.verified === 1 || input.verified === '1' ? 1 : 0;

  return {
    ok: true,
    data: {
      anime_id: animeId,
      character_name: characterName,
      role,
      voice_actor_name: voiceActorName,
      dub_language: dubLanguage,
      character_image: characterImage,
      actor_image: actorImage,
      verified,
    },
  };
}

/**
 * ACTIONABLE ADMIN ANALYTICS 2.0 (PRIVACY-SAFE CONTENT DEMAND INTELLIGENCE)
 */
export const VALID_DEMAND_EVENT_TYPES = [
  'search_query',
  'ott_impression',
  'ott_click',
  'dub_language_filter',
  'anime_detail_view',
  'watchlist_add',
  'translation_request',
] as const;

export type ContentDemandEventType = (typeof VALID_DEMAND_EVENT_TYPES)[number];

export interface ContentDemandEventInput {
  event_type?: unknown;
  eventType?: unknown;
  anime_id?: unknown;
  animeId?: unknown;
  query_text?: unknown;
  queryText?: unknown;
  language_code?: unknown;
  languageCode?: unknown;
  platform_name?: unknown;
  platformName?: unknown;
  result_count?: unknown;
  resultCount?: unknown;
}

export interface NormalizedContentDemandEvent {
  event_type: ContentDemandEventType;
  anime_id: string | null;
  query_text: string | null;
  language_code: string | null;
  platform_name: string | null;
  result_count: number | null;
}

/**
 * Strips any accidental email addresses or long tokens from search query telemetry
 * so zero PII is ever persisted in content_demand_events.
 */
export function sanitizeDemandQueryText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

export function validateContentDemandEvent(
  input: ContentDemandEventInput | null | undefined
): { ok: true; data: NormalizedContentDemandEvent } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Event payload must be a JSON object.' };
  }

  const rawType = String(input.event_type ?? input.eventType ?? '')
    .trim()
    .toLowerCase() as ContentDemandEventType;

  if (!VALID_DEMAND_EVENT_TYPES.includes(rawType)) {
    return {
      ok: false,
      error: `Invalid event_type. Must be one of: ${VALID_DEMAND_EVENT_TYPES.join(', ')}.`,
    };
  }

  const rawAnimeId = String(input.anime_id ?? input.animeId ?? '').trim();
  const animeId = rawAnimeId ? rawAnimeId.slice(0, 80) : null;

  if (
    (rawType === 'anime_detail_view' ||
      rawType === 'watchlist_add' ||
      rawType === 'translation_request') &&
    !animeId
  ) {
    return {
      ok: false,
      error: `${rawType} event requires a non-empty anime_id.`,
    };
  }

  const queryText = sanitizeDemandQueryText(input.query_text ?? input.queryText);
  if (rawType === 'search_query' && !queryText) {
    return {
      ok: false,
      error: 'search_query event requires a non-empty query_text (at least 2 characters).',
    };
  }

  const rawLang = String(input.language_code ?? input.languageCode ?? '').trim();
  const languageCode =
    rawLang && rawLang.toLowerCase() !== 'all'
      ? languageNameToCode(rawLang).slice(0, 20)
      : null;

  if (rawType === 'dub_language_filter' && !languageCode) {
    return {
      ok: false,
      error: 'dub_language_filter event requires a valid language_code.',
    };
  }

  const rawPlatform = String(input.platform_name ?? input.platformName ?? '').trim();
  const platformName = rawPlatform ? rawPlatform.slice(0, 80) : null;

  if ((rawType === 'ott_impression' || rawType === 'ott_click') && !platformName) {
    return {
      ok: false,
      error: `${rawType} event requires a platform_name.`,
    };
  }

  const rawResultCount = input.result_count ?? input.resultCount;
  let resultCount: number | null = null;
  if (rawResultCount !== undefined && rawResultCount !== null && rawResultCount !== '') {
    const parsed = Number(rawResultCount);
    if (Number.isFinite(parsed) && parsed >= 0) {
      resultCount = Math.min(10000, Math.floor(parsed));
    }
  }

  return {
    ok: true,
    data: {
      event_type: rawType,
      anime_id: animeId,
      query_text: queryText,
      language_code: languageCode,
      platform_name: platformName,
      result_count: resultCount,
    },
  };
}

/**
 * Computes OTT Click-Through Rate (CTR = Clicks / Impressions * 100).
 * Returns display: '—' cleanly when impressions are 0.
 */
export function computeOttPerformanceCtr(
  clicks: number,
  impressions: number
): { ctrPercent: number | null; display: string } {
  const safeClicks = Math.max(0, Number(clicks) || 0);
  const safeImpressions = Math.max(0, Number(impressions) || 0);
  if (safeImpressions <= 0) {
    return { ctrPercent: null, display: '—' };
  }
  const rawPct = (safeClicks / safeImpressions) * 100;
  const clamped = Math.min(100, Math.round(rawPct * 10) / 10);
  return {
    ctrPercent: clamped,
    display: `${clamped.toFixed(1)}%`,
  };
}

/**
 * FULL CONTENT JSON BACKUP & SAFE DRY-RUN VALIDATOR
 */
export const CONTENT_BACKUP_SCHEMA_VERSION = 'anidub-content-backup-v2.3';

export const CORE_CONTENT_BACKUP_TABLES = [
  'anime',
  'anime_dub_matrix',
  'anime_translations',
  'anime_franchise_links',
  'anime_cast_entries',
  'dub_reviews',
] as const;

export type CoreContentBackupTable = (typeof CORE_CONTENT_BACKUP_TABLES)[number];

export interface ContentBackupValidationReport {
  valid: boolean;
  schemaVersion: string | null;
  exportedAt: string | null;
  tableCounts: Record<CoreContentBackupTable, number>;
  totalRows: number;
  warnings: string[];
  errors: string[];
}

export function validateContentBackupBundle(rawBundle: unknown): ContentBackupValidationReport {
  const emptyCounts: Record<CoreContentBackupTable, number> = {
    anime: 0,
    anime_dub_matrix: 0,
    anime_translations: 0,
    anime_franchise_links: 0,
    anime_cast_entries: 0,
    dub_reviews: 0,
  };

  if (!rawBundle || typeof rawBundle !== 'object' || Array.isArray(rawBundle)) {
    return {
      valid: false,
      schemaVersion: null,
      exportedAt: null,
      tableCounts: emptyCounts,
      totalRows: 0,
      warnings: [],
      errors: ['Backup file must be a valid JSON object bundle.'],
    };
  }

  const bundle = rawBundle as Record<string, any>;
  const errors: string[] = [];
  const warnings: string[] = [];

  const schemaVersion = bundle.schemaVersion ? String(bundle.schemaVersion).trim() : null;
  const exportedAt = bundle.exportedAt ? String(bundle.exportedAt).trim() : null;

  if (!schemaVersion) {
    errors.push('Missing schemaVersion property in JSON backup bundle.');
  } else if (!schemaVersion.startsWith('anidub-content-backup-v2')) {
    warnings.push(
      `Schema version "${schemaVersion}" differs from current "${CONTENT_BACKUP_SCHEMA_VERSION}".`
    );
  }

  if (!exportedAt || Number.isNaN(Date.parse(exportedAt))) {
    warnings.push('Missing or non-ISO exportedAt timestamp.');
  }

  // Ensure no private user credentials or secrets were leaked into the backup
  const tablesObj =
    bundle.tables && typeof bundle.tables === 'object' && !Array.isArray(bundle.tables)
      ? (bundle.tables as Record<string, any>)
      : bundle;

  if ('users' in tablesObj || 'secrets' in tablesObj || 'clerk_secret' in bundle) {
    errors.push(
      'Backup bundle contains prohibited private user credentials or secret tables.'
    );
  }

  let totalRows = 0;
  for (const table of CORE_CONTENT_BACKUP_TABLES) {
    const rows = tablesObj[table];
    if (rows === undefined) {
      warnings.push(`Table "${table}" is not present in this backup bundle (0 rows).`);
      emptyCounts[table] = 0;
    } else if (!Array.isArray(rows)) {
      errors.push(`Table "${table}" must be an array of row objects.`);
    } else {
      emptyCounts[table] = rows.length;
      totalRows += rows.length;
      if (table === 'anime' && rows.length > 0) {
        const missingTitles = rows.filter((r) => !r || typeof r !== 'object' || !r.title).length;
        if (missingTitles > 0) {
          errors.push(`"anime" table contains ${missingTitles} row(s) missing a required title.`);
        }
      }
    }
  }

  if (emptyCounts.anime === 0 && errors.length === 0) {
    warnings.push('The "anime" catalog array in this backup contains 0 rows.');
  }

  return {
    valid: errors.length === 0,
    schemaVersion,
    exportedAt,
    tableCounts: emptyCounts,
    totalRows,
    warnings,
    errors,
  };
}
