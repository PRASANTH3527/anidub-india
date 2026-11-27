import {
  SUPPORTED_LANGUAGE_CODES,
  type SupportedLanguageCode,
} from '../i18n/languageRegistry';

export type TranslationStatus = 'draft' | 'reviewed' | 'published';

export const TRANSLATION_STATUSES: readonly TranslationStatus[] = [
  'draft',
  'reviewed',
  'published',
] as const;

/**
 * Target non-English locales for anime content translations in Phase 2.
 * Canonical English remains untouched in the `anime` table.
 */
export const TARGET_TRANSLATION_LOCALES: readonly Exclude<SupportedLanguageCode, 'en'>[] = [
  'ta',
  'hi',
  'te',
  'ml',
  'kn',
  'bn',
] as const;

export type TargetTranslationLocale = (typeof TARGET_TRANSLATION_LOCALES)[number];

export interface AnimeTranslationRecord {
  id?: number;
  anime_id: string;
  locale: string;
  localized_title: string | null;
  synopsis: string | null;
  description: string | null;
  source_hash: string | null;
  translation_status: TranslationStatus;
  updated_at?: string;
}

export interface TranslationLocaleCoverage {
  locale: TargetTranslationLocale;
  totalAnime: number;
  published: number;
  reviewed: number;
  draft: number;
  missing: number;
  outdated: number;
  percentPublished: number;
}

export interface ValidatedTranslationInput {
  anime_id: string;
  locale: TargetTranslationLocale;
  localized_title: string | null;
  synopsis: string | null;
  description: string | null;
  translation_status: TranslationStatus;
}

const MAX_TITLE_LEN = 300;
const MAX_SYNOPSIS_LEN = 8000;
const MAX_DESCRIPTION_LEN = 2000;

/**
 * Normalizes and validates a query/API locale code against Phase 1/2 supported languages.
 * Returns null for invalid or unsupported inputs.
 */
export function normalizeTranslationLocale(raw: unknown): SupportedLanguageCode | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase().split(/[-_]/)[0];
  if ((SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(cleaned)) {
    return cleaned as SupportedLanguageCode;
  }
  return null;
}

/**
 * Validates that a locale is one of the 6 non-English translatable target locales.
 */
export function isTargetTranslationLocale(raw: unknown): raw is TargetTranslationLocale {
  const norm = normalizeTranslationLocale(raw);
  return Boolean(norm && norm !== 'en');
}

export function sanitizeTranslationStatus(
  raw: unknown,
  fallback: TranslationStatus = 'draft'
): TranslationStatus {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === 'draft' || cleaned === 'reviewed' || cleaned === 'published') {
    return cleaned;
  }
  return fallback;
}

function normalizeOptionalText(raw: unknown, maxLen: number): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  return text.length > maxLen ? text.slice(0, maxLen).trim() : text;
}

/**
 * Validates and sanitizes an incoming admin translation upsert payload.
 */
export function validateTranslationPayload(
  raw: Record<string, unknown>,
  overrideAnimeId?: string,
  overrideLocale?: string
): { ok: true; data: ValidatedTranslationInput } | { ok: false; error: string } {
  const animeId = String(overrideAnimeId ?? raw.anime_id ?? raw.animeId ?? '').trim();
  if (!animeId || animeId.length > 100 || !/^[0-9a-zA-Z_-]+$/.test(animeId)) {
    return { ok: false, error: 'Valid anime_id is required.' };
  }

  const localeNorm = normalizeTranslationLocale(overrideLocale ?? raw.locale);
  if (!localeNorm || localeNorm === 'en') {
    return {
      ok: false,
      error: `Valid non-English target locale is required (${TARGET_TRANSLATION_LOCALES.join(', ')}).`,
    };
  }

  const localizedTitle = normalizeOptionalText(
    raw.localized_title ?? raw.localizedTitle,
    MAX_TITLE_LEN
  );
  const synopsis = normalizeOptionalText(raw.synopsis, MAX_SYNOPSIS_LEN);
  const description = normalizeOptionalText(raw.description, MAX_DESCRIPTION_LEN);

  if (!localizedTitle && !synopsis && !description) {
    return {
      ok: false,
      error: 'Provide at least a localized title, synopsis, or short description.',
    };
  }

  const rawStatus = raw.translation_status ?? raw.translationStatus ?? raw.status;
  if (
    rawStatus !== undefined &&
    rawStatus !== null &&
    String(rawStatus).trim() !== '' &&
    !TRANSLATION_STATUSES.includes(String(rawStatus).trim().toLowerCase() as TranslationStatus)
  ) {
    return {
      ok: false,
      error: "Invalid translation_status. Must be 'draft', 'reviewed', or 'published'.",
    };
  }

  const translationStatus = sanitizeTranslationStatus(rawStatus, 'draft');

  if (translationStatus === 'published' && !synopsis && !description) {
    return {
      ok: false,
      error: 'A synopsis or short description is required before publishing a translation.',
    };
  }

  return {
    ok: true,
    data: {
      anime_id: animeId,
      locale: localeNorm,
      localized_title: localizedTitle,
      synopsis,
      description,
      translation_status: translationStatus,
    },
  };
}

/**
 * Deterministic portable source hash (dual 32-bit FNV-1a -> 16-char hex)
 * computed from canonical English title + synopsis so admins can detect
 * when English catalog metadata changed after a translation was saved.
 */
export function computeSourceHash(
  title: unknown,
  synopsis: unknown,
  description?: unknown
): string {
  const canonical = [
    String(title ?? '').replace(/\s+/g, ' ').trim(),
    String(synopsis ?? '').replace(/\s+/g, ' ').trim(),
    String(description ?? '').replace(/\s+/g, ' ').trim(),
  ].join('\u001f');

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i += 1) {
    const code = canonical.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }

  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function isTranslationOutdated(
  translationSourceHash: string | null | undefined,
  currentSourceHash: string
): boolean {
  if (!translationSourceHash || !currentSourceHash) return false;
  return translationSourceHash !== currentSourceHash;
}

/**
 * Non-destructively overlays a `published` translation onto an anime row for API responses.
 * NEVER overwrites the canonical English `title` or `original_synopsis`.
 * If no `published` translation exists for the requested locale, returns the original row cleanly.
 */
export function mergePublishedTranslation<T extends Record<string, unknown>>(
  animeRow: T,
  translation: Partial<AnimeTranslationRecord> | null | undefined,
  requestedLocale?: string | null
): T & {
  original_title?: string;
  original_synopsis?: string;
  localized_title?: string | null;
  localized_synopsis?: string | null;
  localized_description?: string | null;
  translation_locale?: string | null;
  has_published_translation?: boolean;
} {
  const normLocale = normalizeTranslationLocale(requestedLocale);
  const originalTitle = String(animeRow.title ?? '').trim();
  const originalSynopsis = String(animeRow.synopsis ?? animeRow.description ?? '').trim();

  if (
    !normLocale ||
    normLocale === 'en' ||
    !translation ||
    translation.translation_status !== 'published' ||
    normalizeTranslationLocale(translation.locale) !== normLocale
  ) {
    return {
      ...animeRow,
      original_title: originalTitle,
      original_synopsis: originalSynopsis,
      localized_title: null,
      localized_synopsis: null,
      localized_description: null,
      translation_locale: null,
      has_published_translation: false,
    };
  }

  const localizedTitle = normalizeOptionalText(translation.localized_title, MAX_TITLE_LEN);
  const localizedSynopsis = normalizeOptionalText(translation.synopsis, MAX_SYNOPSIS_LEN);
  const localizedDescription = normalizeOptionalText(translation.description, MAX_DESCRIPTION_LEN);
  const hasAny = Boolean(localizedTitle || localizedSynopsis || localizedDescription);

  return {
    ...animeRow,
    original_title: originalTitle,
    original_synopsis: originalSynopsis,
    localized_title: localizedTitle,
    localized_synopsis: localizedSynopsis,
    localized_description: localizedDescription,
    translation_locale: hasAny ? normLocale : null,
    has_published_translation: hasAny,
  };
}

/**
 * Computes per-locale translation coverage statistics for the Admin Translation Center.
 */
export function computeTranslationCoverage(
  animeList: Array<{ id: string | number; title?: unknown; synopsis?: unknown; description?: unknown }>,
  translations: AnimeTranslationRecord[]
): TranslationLocaleCoverage[] {
  const totalAnime = animeList.length;
  const sourceHashByAnimeId = new Map<string, string>();
  for (const anime of animeList) {
    sourceHashByAnimeId.set(
      String(anime.id),
      computeSourceHash(anime.title, anime.synopsis, anime.description)
    );
  }

  return TARGET_TRANSLATION_LOCALES.map((locale) => {
    let published = 0;
    let reviewed = 0;
    let draft = 0;
    let outdated = 0;
    const coveredIds = new Set<string>();

    for (const tr of translations) {
      if (normalizeTranslationLocale(tr.locale) !== locale) continue;
      const aid = String(tr.anime_id);
      if (!sourceHashByAnimeId.has(aid)) continue;

      coveredIds.add(aid);
      if (tr.translation_status === 'published') published += 1;
      else if (tr.translation_status === 'reviewed') reviewed += 1;
      else draft += 1;

      const currentHash = sourceHashByAnimeId.get(aid) || '';
      if (isTranslationOutdated(tr.source_hash, currentHash)) {
        outdated += 1;
      }
    }

    const missing = Math.max(0, totalAnime - coveredIds.size);
    const percentPublished =
      totalAnime > 0 ? Math.round((published / totalAnime) * 100) : 0;

    return {
      locale,
      totalAnime,
      published,
      reviewed,
      draft,
      missing,
      outdated,
      percentPublished,
    };
  });
}

export function isMissingTranslationsTableError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err || '').toLowerCase();
  return (
    msg.includes('no such table') ||
    msg.includes('anime_translations') && msg.includes('does not exist')
  );
}
