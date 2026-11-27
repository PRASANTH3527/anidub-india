export type AdminActiveTab =
  | 'overview'
  | 'catalog'
  | 'editor'
  | 'dubs'
  | 'translations'
  | 'franchises'
  | 'cast'
  | 'moderation'
  | 'pending'
  | 'feedback'
  | 'data_health'
  | 'imdb_checker'
  | 'analytics'
  | 'backup'
  | 'recycle_bin'
  | 'activity_log'
  | 'settings';

export type FeedbackStatus = 'open' | 'in_progress' | 'resolved';

export interface AdminAnimeRecord {
  id: number | string;
  title: string;
  synopsis?: string | null;
  description?: string | null;
  slug?: string | null;
  [key: string]: any;
}

export type DataHealthFilter =
  | 'all'
  | 'missing_artwork'
  | 'missing_synopsis'
  | 'duplicate_titles'
  | 'inconsistent_episodes'
  | 'unverified_dubs'
  | 'stale_verification'
  | 'missing_translations'
  | 'orphan_franchise_links'
  | 'conflicting_watch_order'
  | 'unverified_cast_entries'
  | 'missing_external_ids'
  | 'missing_stream_links'
  | 'missing_dub_langs'
  | 'missing_episode_counts'
  | 'unverified_metadata'
  | 'incomplete_schedule';

export const OFFICIAL_INDIAN_LANGUAGES = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
] as const;

export function auditAnimeDataHealth(anime: any): {
  anime: any;
  isHealthy: boolean;
  issues: Array<{
    code: DataHealthFilter;
    label: string;
    severity: 'critical' | 'warning';
  }>;
} {
  const streamingPartners = Array.isArray(anime?.streamingPartners)
    ? anime.streamingPartners
    : Array.isArray(anime?.platforms)
    ? anime.platforms
    : [];
  const hasStreamUrl =
    Boolean(anime?.watch_url || anime?.streamUrl || anime?.official_source_url) ||
    streamingPartners.some((p: any) => typeof p === 'object' && p && Boolean(p.url));

  const langs = Array.isArray(anime?.languages)
    ? anime.languages
    : typeof anime?.languages === 'string' && anime.languages.trim()
    ? anime.languages
        .split(',')
        .map((l: string) => l.trim())
        .filter(Boolean)
    : [];
  const hasDubLangs = langs.length > 0;

  const epCount = Number(anime?.episodes_count ?? anime?.episodes ?? anime?.episode_count ?? 0);
  const hasEpisodeCounts = Number.isFinite(epCount) && epCount > 0;

  const isVerified = Boolean(anime?.last_verified_at || anime?.official_source_url);
  const isOngoing =
    String(anime?.status || anime?.airing_status || '')
      .toLowerCase()
      .includes('ongoing') ||
    String(anime?.status || anime?.airing_status || '')
      .toLowerCase()
      .includes('airing');
  const hasSchedule = !isOngoing || Boolean(anime?.broadcast_day || anime?.releaseDay);

  const issues: Array<{
    code: DataHealthFilter;
    label: string;
    severity: 'critical' | 'warning';
  }> = [];

  if (!hasStreamUrl) {
    issues.push({
      code: 'missing_stream_links',
      label: 'Missing Official Stream Link',
      severity: 'critical',
    });
  }
  if (!hasDubLangs) {
    issues.push({
      code: 'missing_dub_langs',
      label: 'Unverified Dub Languages',
      severity: 'critical',
    });
  }
  if (!hasEpisodeCounts) {
    issues.push({
      code: 'missing_episode_counts',
      label: 'Missing Episode Count',
      severity: 'warning',
    });
  }
  if (!isVerified) {
    issues.push({
      code: 'unverified_metadata',
      label: 'Unverified Source Metadata',
      severity: 'warning',
    });
  }
  if (!hasSchedule) {
    issues.push({
      code: 'incomplete_schedule',
      label: 'Incomplete Broadcast Schedule',
      severity: 'warning',
    });
  }

  return {
    anime,
    isHealthy: issues.length === 0,
    issues,
  };
}

export interface AdminFeedbackItem {
  id: number | string;
  name?: string;
  author?: string;
  email?: string;
  message?: string;
  content?: string;
  date?: string;
  created_at?: string;
  type?: string;
  status?: FeedbackStatus;
}

export interface AdminOverviewStats {
  publishedAnimeCount: number;
  totalAnimeCount: number;
  pendingModerationCount: number;
  openFeedbackCount: number;
  totalFeedbackCount: number;
  unverifiedDubsCount: number;
  missingTranslationsCount: number;
  reviewsCount: number;
  reportsCount: number;
  watchlistCount: number;
  d1Connected: boolean;
  d1LatencyMs: number;
  languageCounts: Record<string, number>;
  genreCounts?: Record<string, number>;
}
