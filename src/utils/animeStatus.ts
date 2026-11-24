/**
 * Single Canonical Lifecycle Status utility for AniDub India.
 * Reconciles legacy D1 `status` and `airing_status` columns into one
 * authoritative lifecycle value: 'Airing' | 'Completed' | 'Upcoming'.
 */

export type CanonicalAnimeStatus = 'Airing' | 'Completed' | 'Upcoming';

export interface AnimeStatusInput {
  status?: string | null;
  airing_status?: string | null;
  submissionStatus?: string | null;
  approval_status?: string | null;
}

function classifyStatusToken(raw?: string | null): CanonicalAnimeStatus | null {
  const token = String(raw || '').trim().toLowerCase();
  if (!token || token === 'pending' || token === 'rejected') return null;

  if (
    token === 'airing' ||
    token === 'ongoing' ||
    token === 'simulcast' ||
    token.includes('airing') ||
    token.includes('ongoing') ||
    token.includes('simulcast') ||
    token.includes('releasing')
  ) {
    return 'Airing';
  }

  if (
    token === 'upcoming' ||
    token.includes('upcoming') ||
    token.includes('not yet aired') ||
    token.includes('announced')
  ) {
    return 'Upcoming';
  }

  if (
    token === 'completed' ||
    token === 'finished' ||
    token.includes('complete') ||
    token.includes('finished') ||
    token.includes('ended')
  ) {
    return 'Completed';
  }

  return null;
}

export function isPendingSubmission(anime?: AnimeStatusInput | null): boolean {
  if (!anime) return false;
  const sub = String(anime.submissionStatus || anime.approval_status || '').trim().toLowerCase();
  if (sub === 'pending') return true;
  const rawStatus = String(anime.status || '').trim().toLowerCase();
  return rawStatus === 'pending';
}

/**
 * Resolves the single canonical lifecycle status for an anime record.
 * Precedence:
 * 1. Explicit `airing_status` when it indicates 'Airing' or 'Upcoming'
 *    (fixes legacy rows where `status='Completed'` but `airing_status='Airing'`).
 * 2. Explicit `status` when it indicates 'Airing' or 'Upcoming'.
 * 3. Explicit `airing_status` or `status` indicating 'Completed'.
 * 4. Default fallback: 'Completed'.
 */
export function resolveCanonicalAnimeStatus(anime?: AnimeStatusInput | null): CanonicalAnimeStatus {
  if (!anime) return 'Completed';

  const fromAiring = classifyStatusToken(anime.airing_status);
  const fromStatus = classifyStatusToken(anime.status);

  // If D1 `airing_status` explicitly marks the title as Airing or Upcoming, trust it first.
  if (fromAiring === 'Airing' || fromAiring === 'Upcoming') {
    return fromAiring;
  }

  // Otherwise check if `status` explicitly marks Airing or Upcoming (when airing_status is missing/empty).
  if (!fromAiring && (fromStatus === 'Airing' || fromStatus === 'Upcoming')) {
    return fromStatus;
  }

  if (fromAiring) return fromAiring;
  if (fromStatus) return fromStatus;

  return 'Completed';
}

/**
 * Returns true if the anime is a published (non-pending) title currently Airing.
 */
export function isCanonicalAiring(anime?: AnimeStatusInput | null): boolean {
  if (!anime || isPendingSubmission(anime)) return false;
  return resolveCanonicalAnimeStatus(anime) === 'Airing';
}

/**
 * Returns a shallow copy of the anime record with `status` and `airing_status`
 * reconciled to the single canonical lifecycle status (preserving pending submissions).
 */
export function normalizeAnimeStatusFields<T extends Record<string, unknown>>(anime: T): T {
  if (!anime || typeof anime !== 'object') return anime;
  if (isPendingSubmission(anime as AnimeStatusInput)) {
    return anime;
  }
  const canonical = resolveCanonicalAnimeStatus(anime as AnimeStatusInput);
  return {
    ...anime,
    status: canonical,
    airing_status: canonical,
  };
}

/**
 * Filters a catalog array by canonical status ('Airing', 'Completed', 'Upcoming', or 'All'),
 * reconciling D1 `airing_status` and `status` consistently for UI filters.
 */
export function filterCatalogByStatus<T extends AnimeStatusInput>(
  catalog: T[],
  statusFilter?: string | null
): T[] {
  if (!Array.isArray(catalog) || catalog.length === 0) return [];

  const publishedOnly = catalog.filter((item) => item && !isPendingSubmission(item));
  const rawFilter = String(statusFilter || '').trim().toLowerCase();

  if (!rawFilter || rawFilter === 'all' || rawFilter === 'all status' || rawFilter === 'all statuses') {
    return publishedOnly;
  }

  const targetCanonical = classifyStatusToken(rawFilter);
  if (!targetCanonical) {
    return publishedOnly.filter((item) => {
      const canonical = resolveCanonicalAnimeStatus(item).toLowerCase();
      return canonical === rawFilter;
    });
  }

  return publishedOnly.filter(
    (item) => resolveCanonicalAnimeStatus(item) === targetCanonical
  );
}
