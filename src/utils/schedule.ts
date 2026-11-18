import {
  CANONICAL_BROADCAST_DAYS,
  type CanonicalBroadcastDay,
  normalizeBroadcastDay,
  normalizeBroadcastTime,
  normalizePlatformString,
} from './dataNormalization';

export { CANONICAL_BROADCAST_DAYS as SCHEDULE_DAYS, type CanonicalBroadcastDay as DayName };

export interface NormalizedScheduleItem {
  id: number | string;
  title: string;
  status: string;
  broadcastDay: CanonicalBroadcastDay | null;
  airTime: string | null;
  displayAirTime: string;
  currentEpisode: number;
  totalEpisodes: number | null;
  platform: string;
  languages: string | string[];
  genres: string;
  cover_image: string;
  rating?: number | string | null;
  [key: string]: any;
}

/**
 * Normalizes catalog/D1 anime records into verified Weekly Schedule entries.
 * - Preserves ONLY verified `broadcast_day` and `broadcast_time` values from D1/admin.
 * - Never fabricates modulo weekdays (`DAYS[idx % 7]`) or fake `'08:00 PM IST'` defaults.
 */
export function buildVerifiedScheduleData(rawItems: any[]): {
  allSimulcasts: NormalizedScheduleItem[];
  scheduledItems: NormalizedScheduleItem[];
  unscheduledItems: NormalizedScheduleItem[];
} {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { allSimulcasts: [], scheduledItems: [], unscheduledItems: [] };
  }

  const dedupedById = new Map<string, any>();
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const key = item.id !== undefined && item.id !== null ? String(item.id) : String(item.slug || item.title || Math.random());
    if (!dedupedById.has(key)) {
      dedupedById.set(key, item);
    }
  }

  const allSimulcasts: NormalizedScheduleItem[] = [];
  const scheduledItems: NormalizedScheduleItem[] = [];
  const unscheduledItems: NormalizedScheduleItem[] = [];

  for (const anime of dedupedById.values()) {
    const rawStatus = `${anime.status || ''} ${anime.airing_status || ''}`.toLowerCase();
    const isOngoing =
      rawStatus.includes('airing') ||
      rawStatus.includes('ongoing') ||
      rawStatus.includes('simulcast');
    const verifiedDay = normalizeBroadcastDay(anime);

    if (!isOngoing && !verifiedDay) {
      continue;
    }

    const verifiedTime = normalizeBroadcastTime(anime);
    const totalEpsRaw = anime.episodes_count ?? anime.episodes ?? anime.totalEpisodes ?? null;
    const totalEps =
      totalEpsRaw !== null && totalEpsRaw !== undefined && Number(totalEpsRaw) > 0
        ? Math.floor(Number(totalEpsRaw))
        : null;
    const currentEp =
      anime.currentEpisode && Number(anime.currentEpisode) > 0
        ? Math.floor(Number(anime.currentEpisode))
        : anime.latestEpisode && Number(anime.latestEpisode) > 0
          ? Math.floor(Number(anime.latestEpisode))
          : 1;

    const cleanPlatform =
      normalizePlatformString(anime.platform) ||
      (Array.isArray(anime.streaming_partners) && anime.streaming_partners.length > 0
        ? normalizePlatformString(anime.streaming_partners.map((p: any) => p?.name || p?.platform))
        : '') ||
      'OTT Simulcast';

    const item: NormalizedScheduleItem = {
      ...anime,
      broadcastDay: verifiedDay,
      broadcast_day: verifiedDay,
      airTime: verifiedTime,
      broadcast_time: verifiedTime,
      displayAirTime: verifiedTime || 'Time TBA',
      currentEpisode: currentEp,
      totalEpisodes: totalEps,
      platform: cleanPlatform,
    };

    allSimulcasts.push(item);
    if (verifiedDay) {
      scheduledItems.push(item);
    } else {
      unscheduledItems.push(item);
    }
  }

  return { allSimulcasts, scheduledItems, unscheduledItems };
}

/**
 * Dynamically calculates the accurate count of currently Airing/Ongoing/Simulcast animes
 * across loaded catalog entries and/or authoritative backend summary metadata.
 */
export function countAiringSimulcasts(
  rawItems: any[],
  apiReportedCount?: number | null
): number {
  let localCount = 0;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const seenKeys = new Set<string>();
    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;
      const key =
        item.id !== undefined && item.id !== null
          ? `id:${String(item.id)}`
          : `title:${String(item.slug || item.title || '').trim().toLowerCase()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const statusText = `${item.status || ''} ${item.airing_status || ''}`.toLowerCase();
      if (!statusText.trim()) continue;
      const isPending = statusText.includes('pending');
      const isFinished = statusText.includes('complete') || statusText.includes('finished');
      const isAiring =
        statusText.includes('airing') ||
        statusText.includes('ongoing') ||
        statusText.includes('simulcast');

      if (!isPending && !isFinished && isAiring) {
        localCount++;
      }
    }
  }

  const normalizedApiCount =
    apiReportedCount !== undefined && apiReportedCount !== null && Number.isFinite(Number(apiReportedCount))
      ? Math.max(0, Math.floor(Number(apiReportedCount)))
      : 0;

  return Math.max(localCount, normalizedApiCount);
}

