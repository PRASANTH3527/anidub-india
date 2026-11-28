import { computeGenreDistributionFromCatalog } from './adminLegacyRestore';
import type { AdminFeedbackItem, AdminOverviewStats } from '../components/admin/types';

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

export function buildCatalogExportCsv(exportList: any[]): string {
  const headers = [
    'ID',
    'Title',
    'Slug',
    'Synopsis',
    'Poster URL',
    'Rating',
    'Release Year',
    'Status',
    'Type',
    'Studio',
    'Genres',
    'Languages',
    'Platforms',
    'Episodes',
    'Season',
    'Broadcast Day',
    'Broadcast Time',
    'season_episode_count',
    'official_source_url',
  ];

  const lines = [
    headers.join(','),
    ...(exportList || []).map((a) => {
      const langs = Array.isArray(a.languages)
        ? a.languages.filter(Boolean).join(' | ')
        : String(a.languages || '').replace(/,/g, ' | ');
      const genres = Array.isArray(a.genres)
        ? a.genres.filter(Boolean).join(' | ')
        : String(a.genres || '').replace(/,/g, ' | ');
      return [
        escapeCsvCell(a.id ?? ''),
        escapeCsvCell(a.title ?? ''),
        escapeCsvCell(a.slug ?? ''),
        escapeCsvCell(a.synopsis ?? a.description ?? ''),
        escapeCsvCell(a.cover_image ?? a.posterUrl ?? a.poster ?? a.image ?? ''),
        escapeCsvCell(a.rating ?? ''),
        escapeCsvCell(a.year ?? a.release_year ?? ''),
        escapeCsvCell(a.status ?? a.airing_status ?? 'Airing'),
        escapeCsvCell(a.type ?? 'TV Series'),
        escapeCsvCell(a.studio ?? ''),
        escapeCsvCell(genres),
        escapeCsvCell(langs),
        escapeCsvCell(a.platform ?? a.platforms ?? ''),
        escapeCsvCell(a.episodes_count ?? a.episodes ?? ''),
        escapeCsvCell(a.season ?? ''),
        escapeCsvCell(a.broadcast_day ?? ''),
        escapeCsvCell(a.broadcast_time ?? ''),
        escapeCsvCell(a.season_episode_count ?? ''),
        escapeCsvCell(a.official_source_url ?? a.watch_url ?? ''),
      ].join(',');
    }),
  ];

  return lines.join('\n');
}

function escapeSqlLiteral(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function buildCatalogExportSql(exportList: any[]): string {
  const lines: string[] = [
    `-- AniDub India Cloudflare D1 SQL Catalog Dump (${new Date().toISOString()})`,
    'BEGIN TRANSACTION;',
  ];

  for (const a of exportList || []) {
    const langs = Array.isArray(a.languages)
      ? a.languages.filter(Boolean).join(', ')
      : String(a.languages || '');
    const genres = Array.isArray(a.genres)
      ? a.genres.filter(Boolean).join(', ')
      : String(a.genres || '');
    lines.push(
      `INSERT OR REPLACE INTO anime (id, title, slug, synopsis, cover_image, rating, year, status, type, studio, genres, languages, platform, episodes_count, is_published) VALUES (${escapeSqlLiteral(
        a.id
      )}, ${escapeSqlLiteral(a.title || '')}, ${escapeSqlLiteral(
        a.slug || ''
      )}, ${escapeSqlLiteral(a.synopsis || '')}, ${escapeSqlLiteral(
        a.cover_image || a.posterUrl || '/logo.png'
      )}, ${escapeSqlLiteral(Number(a.rating) || 8.5)}, ${escapeSqlLiteral(
        Number(a.year) || 2024
      )}, ${escapeSqlLiteral(a.status || 'Airing')}, ${escapeSqlLiteral(
        a.type || 'TV Series'
      )}, ${escapeSqlLiteral(a.studio || 'Unknown Studio')}, ${escapeSqlLiteral(
        genres
      )}, ${escapeSqlLiteral(langs)}, ${escapeSqlLiteral(
        a.platform || ''
      )}, ${escapeSqlLiteral(Number(a.episodes_count) || 12)}, ${
        a.is_published === 0 || a.is_published === false ? 0 : 1
      });`
    );
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

export function computeAdminOverviewStats(input: {
  cfStatus: any;
  fullAdminIndex: any[];
  catalogItems: any[];
  catalogTotalItems: number;
  pendingItems: any[];
  feedbackList: AdminFeedbackItem[];
}): AdminOverviewStats {
  const { cfStatus, fullAdminIndex, catalogItems, catalogTotalItems, pendingItems, feedbackList } =
    input;
  const sourcePool = fullAdminIndex.length > 0 ? fullAdminIndex : catalogItems;

  const languageCounts: Record<string, number> = {
    Hindi: 0,
    Tamil: 0,
    Telugu: 0,
    Malayalam: 0,
    Kannada: 0,
    Bengali: 0,
    Unverified: 0,
  };

  let unverifiedCount = 0;
  let publishedCount = 0;

  for (const anime of sourcePool) {
    const isPending =
      String(anime?.status || '').toLowerCase() === 'pending' ||
      String(anime?.submissionStatus || '').toLowerCase() === 'pending' ||
      String(anime?.approval_status || '').toLowerCase() === 'pending' ||
      anime?.is_published === 0 ||
      anime?.is_published === false;

    if (!isPending) {
      publishedCount++;
    }

    const langs = Array.isArray(anime?.languages)
      ? anime.languages.map((s: any) => String(s).trim()).filter(Boolean)
      : typeof anime?.languages === 'string' && anime.languages.trim()
        ? anime.languages
            .split(/[,|]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

    if (langs.length === 0) {
      unverifiedCount++;
      languageCounts.Unverified++;
    } else {
      for (const lang of langs) {
        const key = Object.keys(languageCounts).find(
          (k) => k.toLowerCase() === lang.toLowerCase()
        );
        if (key && key !== 'Unverified') {
          languageCounts[key] = (languageCounts[key] || 0) + 1;
        }
      }
    }
  }

  const d1Summary = cfStatus?.services?.d1;
  const totalRecords = Math.max(
    Number(d1Summary?.recordsCount || 0),
    Number(catalogTotalItems || 0),
    sourcePool.length
  );
  const resolvedPublished = Math.max(
    publishedCount,
    Number(d1Summary?.publishedAnimeCount || 0),
    Math.max(0, totalRecords - pendingItems.length)
  );

  const openFeedbackCount = (feedbackList || []).filter(
    (f) => String(f.status || 'open').toLowerCase() !== 'resolved'
  ).length;

  const genreDist = computeGenreDistributionFromCatalog(sourcePool, totalRecords || 1);

  return {
    publishedAnimeCount: resolvedPublished,
    totalAnimeCount: totalRecords,
    pendingModerationCount: Math.max(
      pendingItems.length,
      Number(d1Summary?.pendingModerationCount || 0)
    ),
    openFeedbackCount,
    totalFeedbackCount: Math.max(
      feedbackList.length,
      Number(d1Summary?.feedbackCount || 0)
    ),
    unverifiedDubsCount: unverifiedCount,
    missingTranslationsCount: Number(d1Summary?.missingTranslationsCount ?? resolvedPublished),
    reviewsCount: Number(d1Summary?.reviewsCount || 0),
    reportsCount: Number(d1Summary?.reportsCount || 0),
    watchlistCount: Number(d1Summary?.watchlistCount || 0),
    d1Connected: Boolean(cfStatus?.services?.d1?.status === 'Connected' || cfStatus?.ok),
    d1LatencyMs: Number(d1Summary?.latencyMs || 12),
    languageCounts,
    genreCounts: genreDist.genreCounts,
  };
}
