/**
 * Status-Based Library (Watching, Completed, Plan to Watch, On Hold, Dropped, Rewatching)
 * & RFC-4180 Watchlist CSV Export utility for AniDub India.
 */
import { normalizeCanonicalOttList } from './ottHub';
import {
  readScopedJson,
  writeScopedJson,
  type SimpleStorageLike,
} from './accountIsolation';
import type { WatchProgressEntry } from './watchProgress';

export type LibraryStatus =
  | 'watching'
  | 'completed'
  | 'plan_to_watch'
  | 'on_hold'
  | 'dropped'
  | 'rewatching';

export interface LibraryStatusConfig {
  id: LibraryStatus;
  label: string;
  shortLabel: string;
  badgeClass: string;
}

export const LIBRARY_STATUSES: readonly LibraryStatusConfig[] = [
  {
    id: 'watching',
    label: 'Watching',
    shortLabel: 'Watching',
    badgeClass: 'bg-sky-500/15 border-sky-500/35 text-sky-300',
  },
  {
    id: 'completed',
    label: 'Completed',
    shortLabel: 'Completed',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
  },
  {
    id: 'plan_to_watch',
    label: 'Plan to Watch',
    shortLabel: 'Plan',
    badgeClass: 'bg-purple-500/15 border-purple-500/35 text-purple-300',
  },
  {
    id: 'on_hold',
    label: 'On Hold',
    shortLabel: 'On Hold',
    badgeClass: 'bg-amber-500/15 border-amber-500/35 text-amber-300',
  },
  {
    id: 'dropped',
    label: 'Dropped',
    shortLabel: 'Dropped',
    badgeClass: 'bg-rose-500/15 border-rose-500/35 text-rose-300',
  },
  {
    id: 'rewatching',
    label: 'Rewatching',
    shortLabel: 'Rewatch',
    badgeClass: 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300',
  },
] as const;

export const LIBRARY_STATUS_STORAGE_KEY = 'anidub_library_statuses_v1';
export const LIBRARY_STATUS_EVENT = 'anidub:library-status-changed';

const VALID_STATUS_SET = new Set<string>(LIBRARY_STATUSES.map((s) => s.id));

export function isValidLibraryStatus(value: unknown): value is LibraryStatus {
  return typeof value === 'string' && VALID_STATUS_SET.has(value);
}

export function getLibraryStatusConfig(status: LibraryStatus): LibraryStatusConfig {
  return LIBRARY_STATUSES.find((s) => s.id === status) || LIBRARY_STATUSES[2];
}

export function readLibraryStatusMap(
  userId?: string | null,
  storage?: SimpleStorageLike | null
): Record<number, LibraryStatus> {
  const raw = readScopedJson<unknown>(LIBRARY_STATUS_STORAGE_KEY, {}, userId, storage);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<number, LibraryStatus> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const idNum = Number(k);
    if (Number.isInteger(idNum) && idNum > 0 && isValidLibraryStatus(v)) {
      result[idNum] = v;
    }
  }
  return result;
}

export function setAnimeLibraryStatus(
  animeId: number,
  status: LibraryStatus,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): Record<number, LibraryStatus> {
  const idNum = Number(animeId);
  const current = readLibraryStatusMap(userId, storage);
  if (!Number.isInteger(idNum) || idNum <= 0 || !isValidLibraryStatus(status)) {
    return current;
  }
  const next = { ...current, [idNum]: status };
  writeScopedJson(LIBRARY_STATUS_STORAGE_KEY, next, userId, storage);
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(LIBRARY_STATUS_EVENT, { detail: { animeId: idNum, status } }));
    } catch {}
  }
  return next;
}

export function removeAnimeLibraryStatus(
  animeId: number,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): Record<number, LibraryStatus> {
  const idNum = Number(animeId);
  const current = readLibraryStatusMap(userId, storage);
  if (!Number.isInteger(idNum) || idNum <= 0 || !(idNum in current)) {
    return current;
  }
  const next = { ...current };
  delete next[idNum];
  writeScopedJson(LIBRARY_STATUS_STORAGE_KEY, next, userId, storage);
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(LIBRARY_STATUS_EVENT, { detail: { animeId: idNum, status: null } }));
    } catch {}
  }
  return next;
}

/**
 * Resolves the effective library status for a saved anime:
 * 1. Explicit user-selected status in statusMap
 * 2. Inferred from local watch progress (completed -> 'completed', episode > 0 -> 'watching')
 * 3. Default -> 'plan_to_watch'
 */
export function resolveEffectiveLibraryStatus(
  animeId: number,
  statusMap: Record<number, LibraryStatus>,
  progressEntry?: WatchProgressEntry | null
): LibraryStatus {
  const explicit = statusMap[Number(animeId)];
  if (explicit && isValidLibraryStatus(explicit)) return explicit;
  if (progressEntry?.completed) return 'completed';
  if (progressEntry && progressEntry.episode > 0) return 'watching';
  return 'plan_to_watch';
}

// ---------------------------------------------------------------------------
// RFC-4180 CSV Export (with spreadsheet formula-injection neutralization)
// ---------------------------------------------------------------------------

function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Neutralize spreadsheet formula prefixes (=, +, -, @, tab)
  if (/^[=+\-@\t]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface WatchlistCsvItem {
  id: number | string;
  title?: string;
  slug?: string;
  languages?: string | string[];
  platform?: unknown;
  platforms?: unknown;
  platforms_data?: unknown;
  streaming_partners?: unknown;
  episodes_count?: number | null;
  rating?: number | string | null;
  year?: number | null;
  releaseYear?: number | null;
  status?: string;
  airing_status?: string;
  official_source_url?: string;
  watch_url?: string;
  streamUrl?: string;
}

export function buildWatchlistCsv(
  items: WatchlistCsvItem[],
  statusMap: Record<number, LibraryStatus> = {},
  progressMap: Record<number, WatchProgressEntry> = {}
): string {
  const headers = [
    'Title',
    'Library Status',
    'Indian Dub Languages',
    'Official OTT Platforms',
    'Progress',
    'Total Episodes',
    'Rating',
    'Year',
    'Official Link',
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const anime of items || []) {
    const idNum = Number(anime.id);
    const progress = progressMap[idNum] || null;
    const status = resolveEffectiveLibraryStatus(idNum, statusMap, progress);
    const statusLabel = getLibraryStatusConfig(status).label;

    const langs = Array.isArray(anime.languages)
      ? anime.languages.filter(Boolean).join(', ')
      : String(anime.languages || '').trim() || 'Not verified';

    const canonicalOtts = normalizeCanonicalOttList(anime);
    const ottLabel = canonicalOtts.length > 0 ? canonicalOtts.join(', ') : 'Not verified';

    const progressText = progress
      ? progress.completed
        ? `Completed (S${progress.season} Ep ${progress.episode})`
        : `S${progress.season} Ep ${progress.episode}${progress.totalEpisodes ? ` / ${progress.totalEpisodes}` : ''}`
      : 'Not started';

    const totalEps =
      anime.episodes_count && Number(anime.episodes_count) > 0
        ? String(anime.episodes_count)
        : 'Count not verified';

    const ratingNum = Number(anime.rating);
    const ratingText = Number.isFinite(ratingNum) && ratingNum > 0 ? ratingNum.toFixed(1) : 'Unrated';

    const yearVal = anime.year || anime.releaseYear || '';
    const linkVal = anime.official_source_url || anime.watch_url || anime.streamUrl || '';

    rows.push(
      [
        anime.title || `Anime #${anime.id}`,
        statusLabel,
        langs,
        ottLabel,
        progressText,
        totalEps,
        ratingText,
        yearVal,
        linkVal,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return rows.join('\n');
}

export function downloadCsvFile(filename: string, csvContent: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  try {
    // Prefix UTF-8 BOM so Excel opens Indian/Unicode titles cleanly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', filename);
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
