/**
 * Pure slug normalization, collision resolution, and D1 unique constraint helpers
 * for AniDub India anime catalog & CSV bulk imports.
 */

export function normalizeAnimeSlug(raw: unknown): string {
  const str = typeof raw === 'string' ? raw.trim().toLowerCase() : String(raw ?? '').trim().toLowerCase();
  const clean = str.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'anime';
}

export function pickUniqueSlugFromSet(
  titleOrSlug: unknown,
  existingSlugs: Iterable<string>,
  releaseYear?: number | string | null
): string {
  const baseSlug = normalizeAnimeSlug(titleOrSlug);
  const used = new Set<string>();
  for (const s of existingSlugs) {
    if (s) used.add(String(s).trim().toLowerCase());
  }

  if (!used.has(baseSlug)) {
    return baseSlug;
  }

  const parsedYear =
    releaseYear !== undefined && releaseYear !== null && String(releaseYear).trim() !== ''
      ? parseInt(String(releaseYear), 10)
      : NaN;

  if (Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100) {
    const yearCandidate = `${baseSlug}-${parsedYear}`;
    if (!used.has(yearCandidate)) {
      return yearCandidate;
    }
  }

  let counter = 2;
  while (counter < 10000) {
    const candidate = `${baseSlug}-${counter}`;
    if (!used.has(candidate)) {
      return candidate;
    }
    counter++;
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
}

export function isSlugUniqueConstraintError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : String((err as any)?.message || err || '');
  const lower = msg.toLowerCase();
  return (
    (lower.includes('unique constraint failed') || lower.includes('sqlite_constraint')) &&
    lower.includes('slug')
  );
}
