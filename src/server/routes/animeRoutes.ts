import { getAuth, getAdminAuth, extractClientIp } from '../../utils/auth';
import { buildLanguageLikePatterns, buildPaginatedMeta, parsePaginationQuery } from '../../utils/pagination';
import { computeDynamicLanguageFilters, extractUniqueLanguagesFromAnimeList, formatLanguagesBulletList } from '../../utils/languages';
import {
  validateExternalImageUrl,
  validateOfficialSourceUrl,
  validateCommunitySubmissionAccount,
  checkAndRecordSubmissionRateLimit,
  validateAndSanitizeCommunitySubmission,
} from '../../utils/submissionValidation';
import {
  normalizeBroadcastDay,
  normalizeBroadcastTime,
  normalizePlatformString,
  normalizeSeasonEpisodeCount,
  normalizeStreamingPartners,
  deriveAggregateLanguagesFromPartners,
  parseOptionalEpisodesCount,
  parseOptionalSeason,
} from '../../utils/dataNormalization';
import { normalizeAnimeStatusFields, resolveCanonicalAnimeStatus } from '../../utils/animeStatus';
import { FREE_LEGAL_PLATFORM_PATTERNS, getPlatformSqlAliases } from '../../utils/ottHub';
import { expandSearchQueryVariants } from '../../utils/searchFilterState';
import { mergePublishedTranslation, normalizeTranslationLocale } from '../../utils/animeTranslations';
import { fetchPublishedTranslationsMap } from './translationRoutes';
import { recordAdminActivityLog } from './adminOpsProRoutes';
import { archiveEntityToRecycleBin, recordAnimeRevision } from './adminPhase35Routes';
import { checkOptimisticConcurrencyConflict, computeAnimeRevisionDiff } from '../../utils/adminPhase35Polish';
import { getErrorMessage, isMissingColumnError, sendTelegramAlert, type RouteContext } from './shared';

const BASE_PUBLISHED_CLAUSE =
  "(is_published = 1 OR is_published = true) AND LOWER(COALESCE(status, '')) != 'pending' AND (submissionStatus = 'approved' OR submissionStatus IS NULL)";

const SQL_IS_CANONICAL_AIRING =
  "((LOWER(COALESCE(airing_status, '')) IN ('airing', 'ongoing', 'simulcast') OR LOWER(COALESCE(airing_status, '')) LIKE '%airing%' OR LOWER(COALESCE(airing_status, '')) LIKE '%ongoing%' OR LOWER(COALESCE(airing_status, '')) LIKE '%simulcast%') OR (TRIM(COALESCE(airing_status, '')) = '' AND (LOWER(COALESCE(status, '')) IN ('airing', 'ongoing', 'simulcast') OR LOWER(COALESCE(status, '')) LIKE '%airing%' OR LOWER(COALESCE(status, '')) LIKE '%ongoing%' OR LOWER(COALESCE(status, '')) LIKE '%simulcast%')))";

const SQL_IS_CANONICAL_UPCOMING =
  "(LOWER(COALESCE(airing_status, '')) LIKE '%upcoming%' OR (TRIM(COALESCE(airing_status, '')) = '' AND LOWER(COALESCE(status, '')) LIKE '%upcoming%'))";

const SQL_IS_CANONICAL_COMPLETED =
  `(NOT ${SQL_IS_CANONICAL_AIRING} AND NOT ${SQL_IS_CANONICAL_UPCOMING} AND LOWER(COALESCE(status, '')) != 'pending')`;

interface PartnerEntry {
  name?: string;
  platform?: string;
  url?: string;
  languages?: string[];
}

interface MixedEntry {
  type?: string;
  name?: string;
  episodes?: number | null;
  episodeCount?: number | null;
}

export async function handleAnimeRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // 0. GET /api/anime/index OR GET /api/anime?mode=index (Lightweight full published catalog index)
  if (
    method === 'GET' &&
    (path === '/api/anime/index' ||
      path === '/api/anime/index/' ||
      (path === '/api/anime' && url.searchParams.get('mode') === 'index'))
  ) {
    try {
      if (env.DB) {
        let rows: Record<string, unknown>[] = [];
        try {
          const res = await env.DB.prepare(
            `SELECT id, slug, title, cover_image, genres, languages, status, airing_status, rating, type, year, platform, popularity, episodes_count
             FROM anime
             WHERE ${BASE_PUBLISHED_CLAUSE}
             ORDER BY popularity DESC, id DESC`
          ).all();
          rows = res.results || [];
        } catch (colErr) {
          if (!isMissingColumnError(colErr)) throw colErr;
          const fallbackRes = await env.DB.prepare(
            `SELECT id, slug, title, cover_image, genres, languages, status, rating, type, year, platform, popularity
             FROM anime
             WHERE ${BASE_PUBLISHED_CLAUSE}
             ORDER BY popularity DESC, id DESC`
          ).all();
          rows = fallbackRes.results || [];
        }

        const lightweight = rows.map((row) => {
          const canonicalStatus = resolveCanonicalAnimeStatus(row as Record<string, string | null | undefined>);
          const coverUrl = typeof row.cover_image === 'string' ? row.cover_image : '';
          const releaseYear = row.year ?? null;
          return {
            id: row.id,
            slug: row.slug || null,
            title: row.title,
            cover_url: coverUrl,
            cover_image: coverUrl,
            genres: row.genres || '',
            languages: row.languages || '',
            status: canonicalStatus,
            airing_status: canonicalStatus,
            rating: row.rating !== undefined && row.rating !== null ? Number(row.rating) : 0,
            type: row.type || 'TV Series',
            release_year: releaseYear,
            year: releaseYear,
            platform: row.platform || '',
            popularity: Number(row.popularity) || 0,
            episodes_count: row.episodes_count !== undefined ? row.episodes_count : null,
          };
        });

        const bypassIndexCache = url.searchParams.has('_t') || url.searchParams.get('fresh') === '1';
        return jsonResponse(
          {
            data: lightweight,
            total: lightweight.length,
            mode: 'index',
          },
          200,
          request,
          {
            'Cache-Control': bypassIndexCache
              ? 'no-store'
              : 'public, max-age=120, s-maxage=300, stale-while-revalidate=600',
          }
        );
      }

      return jsonResponse({ data: [], total: 0, mode: 'index' }, 200, request);
    } catch (err) {
      console.error('D1 Catalog Index Error:', err);
      return jsonResponse({ data: [], total: 0, mode: 'index', error: getErrorMessage(err) }, 500, request);
    }
  }

  // 1. GET /api/anime (Catalog with server-side LIMIT/OFFSET pagination, filtering & search)
  if (path === '/api/anime' && method === 'GET') {
    try {
      const includePending = url.searchParams.get('includePending') === 'true';
      if (includePending) {
        const session = await getAdminAuth(request, env);
        if (!session.userId || !session.isAdmin) {
          return jsonResponse(
            {
              error:
                session.error ||
                (!session.userId
                  ? 'Unauthorized: Valid Clerk Admin session required to view pending/unpublished entries'
                  : 'Forbidden: Admin access required to view pending/unpublished entries'),
            },
            !session.userId ? 401 : 403,
            request
          );
        }
      }

      const { page, limit, offset } = parsePaginationQuery(url.searchParams, {
        defaultLimit: 12,
        maxLimit: includePending ? 500 : 100,
      });

      const idsParam = url.searchParams.get('ids');
      const requestedIds = idsParam
        ? Array.from(
            new Set(
              idsParam
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isInteger(n) && n > 0)
            )
          ).slice(0, 200)
        : [];

      if (idsParam !== null && requestedIds.length === 0) {
        const emptyIdsMeta = buildPaginatedMeta(0, 1, 1);
        return jsonResponse(
          {
            data: [],
            meta: emptyIdsMeta,
            pagination: { page: 1, limit: 1, total: 0, totalPages: 1 },
          },
          200,
          request
        );
      }

      const genre = url.searchParams.get('genre');
      const language = url.searchParams.get('language');
      const platform = url.searchParams.get('platform');
      const platformsParam = url.searchParams.get('platforms');
      const animeType = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const episodeLength = url.searchParams.get('episodeLength');
      const minRatingRaw = url.searchParams.get('minRating');
      const minRating = minRatingRaw !== null && minRatingRaw !== '' ? Number(minRatingRaw) : 0;
      const fullyDubbed = url.searchParams.get('fullyDubbed') === 'true';
      const freeLegal = url.searchParams.get('freeLegal') === 'true';
      const rawSearch = url.searchParams.get('search');
      const search = rawSearch && !rawSearch.trim().toLowerCase().startsWith('/admin') ? rawSearch.trim() : '';
      const sort = url.searchParams.get('sort') || 'popularity';

      if (env.DB) {
        try {
          const basePublishedClause = BASE_PUBLISHED_CLAUSE;

          if (requestedIds.length > 0) {
            const placeholders = requestedIds.map(() => '?').join(', ');
            const idsWhere = includePending
              ? `WHERE id IN (${placeholders})`
              : `WHERE ${basePublishedClause} AND id IN (${placeholders})`;
            const dataRes = await env.DB.prepare(`SELECT * FROM anime ${idsWhere}`)
              .bind(...requestedIds)
              .all();
            const rowMap = new Map<number, Record<string, unknown>>();
            for (const row of dataRes.results || []) {
              const { last_verified_date: _ignoredLastVerified, ...cleanRow } = row;
              const canonicalRow = normalizeAnimeStatusFields(cleanRow);
              const parsedPartners = normalizeStreamingPartners(canonicalRow.streaming_partners || canonicalRow.platforms_data);
              const normalizedRow =
                parsedPartners.length === 0
                  ? canonicalRow
                  : {
                      ...canonicalRow,
                      streaming_partners: parsedPartners,
                      platforms_data: parsedPartners,
                      watch_providers: parsedPartners,
                    };
              rowMap.set(Number(row.id), normalizedRow);
            }
            const orderedResults = requestedIds
              .map((idNum) => rowMap.get(idNum))
              .filter((item): item is Record<string, unknown> => Boolean(item));
            const batchMeta = buildPaginatedMeta(orderedResults.length, 1, Math.max(1, orderedResults.length));
            return jsonResponse(
              {
                data: orderedResults,
                meta: batchMeta,
                pagination: {
                  page: 1,
                  limit: batchMeta.limit,
                  total: orderedResults.length,
                  totalPages: 1,
                },
              },
              200,
              request,
              { 'Cache-Control': 'no-store' }
            );
          }

          const whereClauses: string[] = [];
          const params: unknown[] = [];

          if (!includePending) {
            whereClauses.push(basePublishedClause);
          }

          if (language && language !== 'All' && language !== 'All Languages') {
            if (language.trim().toLowerCase() === 'unverified') {
              whereClauses.push("TRIM(COALESCE(languages, '')) = ''");
            } else {
              const langPatterns = buildLanguageLikePatterns(language);
              if (langPatterns.length > 0) {
                const langOr = langPatterns.map(() => "LOWER(COALESCE(languages, '')) LIKE ?").join(' OR ');
                whereClauses.push(`(${langOr})`);
                params.push(...langPatterns);
              }
            }
          }

          if (genre && genre !== 'All' && genre !== 'All Genres') {
            whereClauses.push("LOWER(COALESCE(genres, '')) LIKE ?");
            params.push(`%${genre.trim().toLowerCase()}%`);
          }

          if (platform && platform !== 'All' && platform !== 'All Platforms') {
            const platAliases = getPlatformSqlAliases(platform);
            const platOr = platAliases
              .map(
                () =>
                  "LOWER(COALESCE(platform, '') || ' ' || COALESCE(platforms_data, '') || ' ' || COALESCE(streaming_partners, '')) LIKE ?"
              )
              .join(' OR ');
            whereClauses.push(`(${platOr})`);
            params.push(...platAliases.map((a) => `%${a}%`));
          }

          if (platformsParam && platformsParam.trim()) {
            const requestedPlatforms = platformsParam
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean);
            const allAliases = Array.from(
              new Set(requestedPlatforms.flatMap((p) => getPlatformSqlAliases(p)))
            );
            if (allAliases.length > 0) {
              const multiOr = allAliases
                .map(
                  () =>
                    "LOWER(COALESCE(platform, '') || ' ' || COALESCE(platforms_data, '') || ' ' || COALESCE(streaming_partners, '')) LIKE ?"
                )
                .join(' OR ');
              whereClauses.push(`(${multiOr})`);
              params.push(...allAliases.map((a) => `%${a}%`));
            }
          }

          if (animeType && animeType !== 'All' && animeType !== 'All Types') {
            whereClauses.push("LOWER(COALESCE(type, 'TV Series')) LIKE ?");
            params.push(`%${animeType.trim().toLowerCase()}%`);
          }

          if (status && status !== 'All' && status !== 'All Status') {
            const normStatus = status.trim().toLowerCase();
            if (normStatus === 'airing' || normStatus === 'ongoing' || normStatus === 'simulcast') {
              whereClauses.push(`${SQL_IS_CANONICAL_AIRING} AND LOWER(COALESCE(status, '')) != 'pending'`);
            } else if (normStatus === 'upcoming') {
              whereClauses.push(`${SQL_IS_CANONICAL_UPCOMING} AND LOWER(COALESCE(status, '')) != 'pending'`);
            } else if (normStatus === 'completed' || normStatus === 'finished') {
              whereClauses.push(SQL_IS_CANONICAL_COMPLETED);
            } else {
              whereClauses.push("(LOWER(COALESCE(airing_status, '')) = ? OR LOWER(COALESCE(status, '')) = ?)");
              params.push(normStatus, normStatus);
            }
          }

          if (episodeLength && episodeLength !== 'any') {
            if (episodeLength === '1-13') {
              whereClauses.push('COALESCE(episodes_count, 0) >= 1 AND COALESCE(episodes_count, 0) <= 13');
            } else if (episodeLength === '14-26') {
              whereClauses.push('COALESCE(episodes_count, 0) >= 14 AND COALESCE(episodes_count, 0) <= 26');
            } else if (episodeLength === '27-100') {
              whereClauses.push('COALESCE(episodes_count, 0) >= 27 AND COALESCE(episodes_count, 0) <= 100');
            } else if (episodeLength === '100+') {
              whereClauses.push('COALESCE(episodes_count, 0) >= 100');
            }
          }

          if (Number.isFinite(minRating) && minRating > 0) {
            whereClauses.push('COALESCE(rating, 0) >= ?');
            params.push(minRating);
          }

          if (fullyDubbed) {
            whereClauses.push(`${SQL_IS_CANONICAL_COMPLETED} AND TRIM(COALESCE(languages, '')) != ''`);
          }

          if (freeLegal) {
            const freeOr = FREE_LEGAL_PLATFORM_PATTERNS.map(
              () =>
                "LOWER(COALESCE(platform, '') || ' ' || COALESCE(platforms_data, '') || ' ' || COALESCE(streaming_partners, '')) LIKE ?"
            ).join(' OR ');
            whereClauses.push(`(${freeOr})`);
            params.push(...FREE_LEGAL_PLATFORM_PATTERNS.map((p) => `%${p}%`));
          }

          if (search) {
            const variants = expandSearchQueryVariants(search);
            const variantClauses: string[] = [];
            for (const variant of variants) {
              const likeSearch = `%${variant.toLowerCase()}%`;
              variantClauses.push(
                "(CAST(id AS TEXT) = ? OR LOWER(title) LIKE ? OR LOWER(COALESCE(slug, '')) LIKE ? OR LOWER(COALESCE(synopsis, '')) LIKE ? OR LOWER(COALESCE(genres, '')) LIKE ? OR LOWER(COALESCE(studio, '')) LIKE ?)"
              );
              params.push(variant.trim(), likeSearch, likeSearch, likeSearch, likeSearch, likeSearch);
            }
            if (variantClauses.length > 0) {
              whereClauses.push(`(${variantClauses.join(' OR ')})`);
            }
          }

          const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
          let orderSql = 'ORDER BY popularity DESC, id DESC';
          if (sort === 'rating') orderSql = 'ORDER BY rating DESC, id DESC';
          else if (sort === 'newest') orderSql = 'ORDER BY year DESC, id DESC';
          else if (sort === 'title') orderSql = 'ORDER BY title ASC, id DESC';
          else if (sort === 'id_desc') orderSql = 'ORDER BY id DESC';
          else if (sort === 'id_asc') orderSql = 'ORDER BY id ASC';

          const countRes = await env.DB.prepare(`SELECT COUNT(*) as total FROM anime ${whereSql}`).bind(...params).first();
          const totalItems = countRes ? Number(countRes.total) : 0;
          const meta = buildPaginatedMeta(totalItems, page, limit);

          let results: Record<string, unknown>[] = [];
          if (totalItems > 0) {
            const queryParams = [...params, limit, offset];
            const dataRes = await env.DB.prepare(`SELECT * FROM anime ${whereSql} ${orderSql} LIMIT ? OFFSET ?`).bind(...queryParams).all();
            const localeParam = normalizeTranslationLocale(url.searchParams.get('locale') || url.searchParams.get('lang'));
            const rawRows = dataRes.results || [];
            const translationsByAnimeId =
              localeParam && localeParam !== 'en'
                ? await fetchPublishedTranslationsMap(
                    env.DB,
                    rawRows.map((r) => String(r.id)),
                    localeParam
                  )
                : new Map();
            results = rawRows.map((row) => {
              const { last_verified_date: _ignoredLastVerified, ...cleanRow } = row;
              const canonicalRow = normalizeAnimeStatusFields(cleanRow);
              const parsedPartners = normalizeStreamingPartners(canonicalRow.streaming_partners || canonicalRow.platforms_data);
              const baseRow =
                parsedPartners.length === 0
                  ? canonicalRow
                  : {
                      ...canonicalRow,
                      streaming_partners: parsedPartners,
                      platforms_data: parsedPartners,
                      watch_providers: parsedPartners,
                    };
              if (!localeParam || localeParam === 'en') return baseRow;
              return mergePublishedTranslation(baseRow, translationsByAnimeId.get(String(row.id)), localeParam);
            });
          }

          let summary: Record<string, unknown> | undefined;
          try {
            const summaryWhere = includePending ? '' : `WHERE ${basePublishedClause}`;
            const aggRes = await env.DB.prepare(
              `SELECT
                COUNT(*) as totalAnime,
                COALESCE(SUM(MAX(0, CASE WHEN upvotes > 0 THEN upvotes ELSE COALESCE(popularity, 0) END)), 0) as totalVotes,
                COALESCE(SUM(CASE
                  WHEN ${SQL_IS_CANONICAL_AIRING}
                    AND LOWER(COALESCE(status, '')) != 'pending'
                  THEN 1 ELSE 0 END), 0) as airingCount
              FROM anime ${summaryWhere}`
            ).first();
            const langRows = await env.DB.prepare(`SELECT languages FROM anime ${summaryWhere}`).all();
            const langEntries = (langRows?.results || []).map((r) => ({ languages: r.languages as string | string[] | null | undefined }));
            const languagesList = extractUniqueLanguagesFromAnimeList(langEntries);
            const languageFilters = computeDynamicLanguageFilters(langEntries);
            summary = {
              totalAnime: Number(aggRes?.totalAnime) || totalItems,
              totalVotes: Number(aggRes?.totalVotes) || 0,
              airingCount: Number(aggRes?.airingCount) || 0,
              totalLanguages: languagesList.length,
              languagesList,
              languagesString: formatLanguagesBulletList(languagesList),
              languageFilters,
            };
          } catch {
            // Optional summary fallback if upvotes/popularity columns vary
          }

          const bypassCatalogCache =
            includePending || url.searchParams.has('_t') || url.searchParams.get('fresh') === '1';
          return jsonResponse(
            {
              data: results,
              meta,
              pagination: {
                page: meta.currentPage,
                limit: meta.limit,
                total: meta.totalItems,
                totalPages: meta.totalPages,
              },
              ...(summary ? { summary } : {}),
            },
            200,
            request,
            {
              'Cache-Control': bypassCatalogCache
                ? 'no-store'
                : 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
            }
          );
        } catch (dbErr) {
          console.error('D1 Catalog Query Error:', dbErr);
          const errMeta = buildPaginatedMeta(0, page, limit);
          return jsonResponse(
            {
              success: false,
              error: `Database query failed: ${getErrorMessage(dbErr)}`,
              data: [],
              meta: errMeta,
              pagination: {
                page: errMeta.currentPage,
                limit: errMeta.limit,
                total: 0,
                totalPages: errMeta.totalPages,
              },
            },
            500,
            request,
            { 'Cache-Control': 'no-store' }
          );
        }
      }

      const emptyMeta = buildPaginatedMeta(0, page, limit);
      return jsonResponse(
        {
          data: [],
          meta: emptyMeta,
          pagination: {
            page: emptyMeta.currentPage,
            limit: emptyMeta.limit,
            total: 0,
            totalPages: emptyMeta.totalPages,
          },
        },
        200,
        request,
        {
          'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
        }
      );
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 500);
    }
  }

  // 2. POST /api/anime (Admin creation)
  if (path === '/api/anime' && method === 'POST') {
    const session = await getAdminAuth(request, env);
    if (!session.userId) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    if (!session.isAdmin) {
      return jsonResponse({ error: 'Forbidden: Only the authorized Admin user can create anime entries' }, 403, request);
    }
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (!body.title || !String(body.title).trim()) {
        return jsonResponse({ error: 'Anime title is required' }, 400, request);
      }
      const coverCheck = validateExternalImageUrl(body.cover_image, { required: false, fieldName: 'Cover Image URL' });
      if (!coverCheck.ok) {
        return jsonResponse({ error: coverCheck.error }, 400, request);
      }
      const bannerCheck = validateExternalImageUrl(body.banner_image, { required: false, fieldName: 'Banner Image URL' });
      if (!bannerCheck.ok) {
        return jsonResponse({ error: bannerCheck.error }, 400, request);
      }
      const safeCoverUrl = coverCheck.url || String(body.cover_image || '') || '/logo.png';
      const safeBannerUrl = bannerCheck.url || safeCoverUrl;

      let createdId: number | null = null;
      const incomingStatus = String(body.status || body.airing_status || '').trim();
      const resolvedType = String(body.type || body.Type || 'TV Series');
      const finalStatus =
        incomingStatus && incomingStatus.toLowerCase() !== 'pending'
          ? incomingStatus
          : resolvedType === 'Movie'
            ? 'Completed'
            : 'Airing';
      const finalSubmissionStatus = String(body.submissionStatus || 'approved');

      const rawPartners =
        body.streaming_partners !== undefined
          ? body.streaming_partners
          : body.platforms_data !== undefined
            ? body.platforms_data
            : body.watch_providers !== undefined
              ? body.watch_providers
              : Array.isArray(body.platforms) && body.platforms.some((p) => p && typeof p === 'object')
                ? body.platforms
                : undefined;
      const normalizedPartners = normalizeStreamingPartners(rawPartners);
      const partnersJson = normalizedPartners.length > 0 ? JSON.stringify(normalizedPartners) : '';
      const resolvedWatchUrl = String(
        body.watch_url || normalizedPartners.find((p) => p.url)?.url || ''
      ).trim();
      const derivedPartnerLanguages = deriveAggregateLanguagesFromPartners(normalizedPartners);
      const resolvedLanguages =
        (typeof body.languages === 'string' && body.languages.trim()) ||
        (Array.isArray(body.languages) && body.languages.length > 0 ? body.languages.join(', ') : '') ||
        derivedPartnerLanguages ||
        '';

      const rawMixed =
        body.mixed_entries !== undefined
          ? body.mixed_entries
          : body.mixedEntries !== undefined
            ? body.mixedEntries
            : null;
      const mixedJson =
        rawMixed !== undefined && rawMixed !== null
          ? typeof rawMixed === 'string'
            ? rawMixed
            : JSON.stringify(rawMixed)
          : '';
      const episodesPerSeasonStr =
        body.episodes_per_season !== undefined
          ? String(body.episodes_per_season)
          : Array.isArray(rawMixed)
            ? (rawMixed as MixedEntry[]).map((m) => m.episodes || m.episodeCount || 0).join('|')
            : '';

      const officialSourceCheck = validateOfficialSourceUrl(
        body.official_source_url ?? body.officialSourceUrl ?? body['Official Source Link'],
        'Official Source Link'
      );
      if (!officialSourceCheck.ok) {
        return jsonResponse({ error: officialSourceCheck.error }, 400, request);
      }
      const seasonEpisodeCount = normalizeSeasonEpisodeCount(body);
      const officialSourceUrl = officialSourceCheck.url || '';

      const parsedEpisodes = parseOptionalEpisodesCount(body);
      const parsedSeason = parseOptionalSeason(body);
      const broadcastDay = normalizeBroadcastDay(body);
      const broadcastTime = normalizeBroadcastTime(body);
      const partnerNamesFromBody = normalizedPartners.map((p) => p.name).filter(Boolean);
      const normalizedPlatform =
        normalizePlatformString(
          body.platform ??
            (Array.isArray(body.platforms) && body.platforms.every((p) => typeof p === 'string')
              ? body.platforms
              : partnerNamesFromBody.length > 0
                ? partnerNamesFromBody
                : '')
        ) || null;

      if (env.DB) {
        const slug = String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const finalIsPublished =
          body.is_published === false ||
          body.is_published === 0 ||
          finalSubmissionStatus.toLowerCase() === 'pending'
            ? 0
            : 1;
        try {
          const insertRes = await env.DB.prepare(`
            INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, submissionStatus, season, year, genres, popularity, languages, platform, type, platforms_data, watch_url, studio, mixedEntries, mixed_entries, episodes_per_season, broadcast_day, broadcast_time, season_episode_count, official_source_url, approval_status, is_published, airing_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              body.title,
              slug,
              body.synopsis || '',
              safeCoverUrl,
              safeBannerUrl,
              parseFloat(String(body.rating)) || 8.5,
              parsedEpisodes,
              finalStatus,
              finalSubmissionStatus,
              parsedSeason,
              parseInt(String(body.year), 10) || 2026,
              body.genres || 'Action',
              0,
              resolvedLanguages,
              normalizedPlatform,
              resolvedType,
              partnersJson,
              resolvedWatchUrl,
              String(body.studio || 'Unknown Studio').trim() || 'Unknown Studio',
              mixedJson,
              mixedJson,
              episodesPerSeasonStr,
              broadcastDay,
              broadcastTime,
              seasonEpisodeCount,
              officialSourceUrl,
              finalSubmissionStatus,
              finalIsPublished,
              finalStatus
            )
            .run();
          createdId = insertRes.meta?.last_row_id || null;
        } catch (primaryInsertErr) {
          if (!isMissingColumnError(primaryInsertErr)) {
            throw primaryInsertErr;
          }
          const insertRes = await env.DB.prepare(`
            INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, submissionStatus, season, year, genres, popularity, languages, platform, type, platforms_data, watch_url, studio, mixedEntries, mixed_entries, episodes_per_season, approval_status, is_published)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              body.title,
              slug,
              body.synopsis || '',
              safeCoverUrl,
              safeBannerUrl,
              parseFloat(String(body.rating)) || 8.5,
              parsedEpisodes,
              finalStatus,
              finalSubmissionStatus,
              parsedSeason,
              parseInt(String(body.year), 10) || 2026,
              body.genres || 'Action',
              0,
              resolvedLanguages,
              normalizedPlatform,
              resolvedType,
              partnersJson,
              resolvedWatchUrl,
              String(body.studio || 'Unknown Studio').trim() || 'Unknown Studio',
              mixedJson,
              mixedJson,
              episodesPerSeasonStr,
              finalSubmissionStatus,
              finalIsPublished
            )
            .run();
          createdId = insertRes.meta?.last_row_id || null;
        }
      }

      const tgMsg =
        `🔥 *NEW ANIME / DUB SUBMISSION ADDED*\n\n` +
        `📌 *Title:* ${body.title}\n` +
        `⭐ *Rating:* ${body.rating || 8.5}/10\n` +
        `📊 *Status:* ${finalStatus}\n` +
        `🎙 *Languages:* ${resolvedLanguages}\n` +
        `📺 *Platform:* ${normalizedPlatform || 'Not specified'}\n\n` +
        `💬 _"${String(body.synopsis || '').slice(0, 120)}"_`;
      await sendTelegramAlert(env, tgMsg);

      await recordAdminActivityLog(env.DB, {
        actor_email: session.email || session.userId,
        action_type: 'CREATE_ANIME',
        entity_type: 'anime',
        entity_id: String(createdId || body.title),
        summary: `Created anime "${String(body.title).trim()}" (${finalStatus})`,
        payload_json: {
          title: body.title,
          status: finalStatus,
          languages: resolvedLanguages,
          platform: normalizedPlatform,
        },
      });

      return jsonResponse(
        {
          success: true,
          animeId: createdId,
          id: createdId,
          status: finalStatus,
          airing_status: finalStatus,
          platform: normalizedPlatform,
          languages: resolvedLanguages,
          broadcast_day: broadcastDay,
          broadcast_time: broadcastTime,
          season_episode_count: seasonEpisodeCount,
          official_source_url: officialSourceUrl,
          platforms_data: normalizedPartners,
          streaming_partners: normalizedPartners,
          watch_providers: normalizedPartners,
        },
        201
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // 3. POST /api/anime/submit (Community submission with verified email & spam checks)
  if (path === '/api/anime/submit' && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse({ error: 'Unauthorized: Active Clerk user session required to submit anime' }, 401, request);
    }

    const accountCheck = validateCommunitySubmissionAccount(session);
    if (!accountCheck.ok) {
      return jsonResponse({ error: accountCheck.error }, accountCheck.status, request);
    }

    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const validation = validateAndSanitizeCommunitySubmission(body);
      if (!validation.ok || !validation.data) {
        return jsonResponse({ error: validation.error || 'Invalid submission data' }, validation.status, request);
      }

      const submission = validation.data;
      const clientIp = extractClientIp(request);

      if (env.DB) {
        const existingAnime = await env.DB.prepare(
          'SELECT id FROM anime WHERE LOWER(title) = LOWER(?) OR slug = ? LIMIT 1'
        )
          .bind(submission.title, submission.slug)
          .first()
          .catch(() => null);

        if (existingAnime) {
          return jsonResponse(
            { error: 'This anime already exists or is already pending review in our database.' },
            409,
            request
          );
        }
      }

      const rateLimitCheck = await checkAndRecordSubmissionRateLimit({
        userId: session.userId,
        clientIp,
        titleSlug: submission.slug,
        db: env.DB,
        isAdmin: session.isAdmin,
      });

      if (!rateLimitCheck.ok) {
        const rlHeaders: Record<string, string> = {
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Remaining': '0',
          ...(rateLimitCheck.retryAfterSeconds
            ? { 'Retry-After': String(rateLimitCheck.retryAfterSeconds) }
            : {}),
        };
        return jsonResponse(
          { success: false, code: 'RATE_LIMITED', error: rateLimitCheck.error },
          rateLimitCheck.status,
          request,
          rlHeaders
        );
      }

      let createdId: number | null = null;
      if (env.DB) {
        try {
          const insertRes = await env.DB.prepare(`
            INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, submissionStatus, approval_status, is_published, season, year, genres, popularity, languages, platform, type, studio, broadcast_day, broadcast_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', 0, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              submission.title,
              submission.slug,
              submission.synopsis,
              submission.cover_image,
              submission.banner_image,
              submission.rating,
              submission.episodes_count,
              submission.season,
              submission.year,
              submission.genres,
              submission.languages,
              submission.platform,
              submission.type,
              submission.studio,
              submission.broadcast_day,
              submission.broadcast_time
            )
            .run();
          createdId = insertRes.meta?.last_row_id || null;
        } catch (submitErr) {
          if (!isMissingColumnError(submitErr)) {
            throw submitErr;
          }
          const insertRes = await env.DB.prepare(`
            INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, submissionStatus, approval_status, is_published, season, year, genres, popularity, languages, platform, type, studio)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', 0, ?, ?, ?, 0, ?, ?, ?, ?)
          `)
            .bind(
              submission.title,
              submission.slug,
              submission.synopsis,
              submission.cover_image,
              submission.banner_image,
              submission.rating,
              submission.episodes_count,
              submission.season,
              submission.year,
              submission.genres,
              submission.languages,
              submission.platform,
              submission.type,
              submission.studio
            )
            .run();
          createdId = insertRes.meta?.last_row_id || null;
        }
      }

      return jsonResponse(
        {
          success: true,
          id: createdId,
          message: 'Anime submitted successfully for admin review.',
          submissionStatus: 'pending',
          broadcast_day: submission.broadcast_day,
          broadcast_time: submission.broadcast_time,
        },
        201,
        request
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // 4. GET / PUT / PATCH / DELETE /api/anime/:id
  const animeIdMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)\/?$/);
  if (animeIdMatch) {
    const id = animeIdMatch[1];
    if (method === 'GET') {
      try {
        if (env.DB) {
          const session = await getAuth(request, env);
          const cleanLookup = decodeURIComponent(id).trim();
          const primaryQuery = session.isAdmin
            ? 'SELECT * FROM anime WHERE id = ? OR slug = ? LIMIT 1'
            : "SELECT * FROM anime WHERE (id = ? OR slug = ?) AND is_published = 1 AND LOWER(COALESCE(status, '')) != 'pending' LIMIT 1";
          let anime = await env.DB.prepare(primaryQuery).bind(cleanLookup, cleanLookup).first();
          if (!anime && cleanLookup) {
            const ciQuery = session.isAdmin
              ? 'SELECT * FROM anime WHERE LOWER(slug) = LOWER(?) LIMIT 1'
              : `SELECT * FROM anime WHERE LOWER(slug) = LOWER(?) AND ${BASE_PUBLISHED_CLAUSE} LIMIT 1`;
            anime = await env.DB.prepare(ciQuery).bind(cleanLookup).first();
          }
          if (anime) {
            const streamingPartners = normalizeStreamingPartners(anime.streaming_partners || anime.platforms_data);
            let mixedEntries: MixedEntry[] = [];
            const rawMixed = anime.mixed_entries || anime.mixedEntries;
            if (rawMixed) {
              try {
                mixedEntries = typeof rawMixed === 'string' ? (JSON.parse(rawMixed) as MixedEntry[]) : (rawMixed as MixedEntry[]);
              } catch {
                mixedEntries = [];
              }
            }
            const episodes = await env.DB.prepare('SELECT * FROM episodes WHERE anime_id = ? ORDER BY episode_number ASC')
              .bind(anime.id)
              .all();
            let reviewRows: Record<string, unknown>[] = [];
            try {
              const reviewsRes = await env.DB.prepare(
                'SELECT id, anime_id, user_id, user_name, user_avatar, rating, language, comment, is_spoiler, created_at FROM reviews WHERE anime_id = ? ORDER BY id DESC'
              )
                .bind(anime.id)
                .all();
              reviewRows = (reviewsRes.results || []).map((r) => ({
                ...r,
                is_spoiler: Boolean(r.is_spoiler),
                spoilers: Boolean(r.is_spoiler),
              }));
            } catch (revErr) {
              if (!isMissingColumnError(revErr)) throw revErr;
              const fallbackReviews = await env.DB.prepare(
                'SELECT id, anime_id, user_id, user_name, user_avatar, rating, language, comment, created_at FROM reviews WHERE anime_id = ? ORDER BY id DESC'
              )
                .bind(anime.id)
                .all();
              reviewRows = (fallbackReviews.results || []).map((r) => ({
                ...r,
                is_spoiler: false,
                spoilers: false,
              }));
            }

            let franchiseEntries: Record<string, unknown>[] = [];
            const rawFranchiseId = typeof anime.franchise_id === 'string' ? anime.franchise_id.trim() : '';
            if (rawFranchiseId) {
              try {
                const franchiseRes = await env.DB.prepare(
                  `SELECT id, title, slug, cover_image, year, type, languages, relation_type, sequence_number, status
                   FROM anime
                   WHERE LOWER(TRIM(franchise_id)) = LOWER(TRIM(?)) AND ${BASE_PUBLISHED_CLAUSE}
                   ORDER BY COALESCE(sequence_number, 9999) ASC, COALESCE(year, 9999) ASC, id ASC`
                )
                  .bind(rawFranchiseId)
                  .all();
                franchiseEntries = (franchiseRes.results || []).map((entry) => ({
                  id: entry.id,
                  title: entry.title,
                  slug: entry.slug,
                  cover_image: entry.cover_image,
                  year: entry.year,
                  type: entry.type,
                  languages: entry.languages,
                  relation_type: entry.relation_type || 'Main series',
                  sequence_number: entry.sequence_number ?? null,
                  status: entry.status,
                }));
              } catch {
                franchiseEntries = [];
              }
            }

            let communityRating = 0;
            let communityVotes = 0;
            try {
              const statsRes = await env.DB.prepare(
                'SELECT AVG(rating) as average_score, COUNT(rating) as total_votes FROM user_ratings WHERE anime_id = ?'
              )
                .bind(anime.id)
                .first();
              if (statsRes) {
                communityRating = statsRes.average_score != null ? Number(Number(statsRes.average_score).toFixed(1)) : 0;
                communityVotes = Number(statsRes.total_votes || 0);
              }
            } catch {
              // Optional rating aggregate fallback
            }

            const { last_verified_date: rawLegacyVerifiedDate, ...cleanAnimeRaw } = anime;
            const cleanAnime = normalizeAnimeStatusFields(cleanAnimeRaw);
            const resolvedLastVerified =
              (typeof anime.last_verified_at === 'string' && anime.last_verified_at.trim()) ||
              (typeof rawLegacyVerifiedDate === 'string' && rawLegacyVerifiedDate.trim()) ||
              (typeof anime.updated_at === 'string' && anime.updated_at.trim()) ||
              (typeof anime.created_at === 'string' && anime.created_at.trim()) ||
              null;

            const localeParam = normalizeTranslationLocale(url.searchParams.get('locale') || url.searchParams.get('lang'));
            let publishedTranslation = null;
            if (localeParam && localeParam !== 'en') {
              const trMap = await fetchPublishedTranslationsMap(env.DB, [String(anime.id)], localeParam);
              publishedTranslation = trMap.get(String(anime.id)) || null;
            }

            const basePayload = {
              ...cleanAnime,
              last_verified_at: resolvedLastVerified,
              franchise_id: rawFranchiseId || '',
              relation_type: anime.relation_type || '',
              sequence_number: anime.sequence_number ?? null,
              franchise_entries: franchiseEntries,
              streaming_partners: streamingPartners,
              platforms_data: streamingPartners,
              watch_providers: streamingPartners,
              mixed_entries: mixedEntries,
              mixedEntries,
              episodes: episodes.results || [],
              reviews: reviewRows,
              average_score: communityRating,
              averageScore: communityRating,
              community_rating: communityRating,
              communityRating,
              total_votes: communityVotes,
              totalVotes: communityVotes,
              community_votes: communityVotes,
              communityVotes,
            };

            const finalPayload =
              localeParam && localeParam !== 'en'
                ? mergePublishedTranslation(basePayload, publishedTranslation, localeParam)
                : basePayload;

            return jsonResponse(
              finalPayload,
              200,
              request,
              {
                'Cache-Control': 'no-cache',
              }
            );
          }
        }
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }

      return jsonResponse({ error: 'Anime not found' }, 404, request);
    }

    if (method === 'PUT' || method === 'PATCH') {
      const session = await getAdminAuth(request, env);
      if (!session.userId) {
        return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
      }
      if (!session.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Only the authorized Admin user can update anime entries' }, 403, request);
      }
      if (env.DB) {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const existingRecordBeforeUpdate = await env.DB.prepare('SELECT * FROM anime WHERE id = ? OR slug = ? LIMIT 1')
            .bind(id, id)
            .first<Record<string, unknown>>()
            .catch(() => null);

          if (body.expected_updated_at && existingRecordBeforeUpdate) {
            const dbTimestamp = String(
              existingRecordBeforeUpdate.updated_at || existingRecordBeforeUpdate.last_verified_at || ''
            ).trim();
            const conflictCheck = checkOptimisticConcurrencyConflict(
              String(body.expected_updated_at),
              dbTimestamp
            );
            if (conflictCheck.conflict) {
              return jsonResponse(
                {
                  error: 'Conflict: This anime was modified in another session since you loaded it. Please review or reload the latest version before saving.',
                  conflict: true,
                  expectedUpdatedAt: conflictCheck.expectedUpdatedAt,
                  currentUpdatedAt: conflictCheck.currentDbUpdatedAt,
                  currentRecord: existingRecordBeforeUpdate,
                },
                409,
                request
              );
            }
          }

          if (body.cover_image !== undefined) {
            const coverCheck = validateExternalImageUrl(body.cover_image, { required: false, fieldName: 'Cover Image URL' });
            if (!coverCheck.ok) {
              return jsonResponse({ error: coverCheck.error }, 400, request);
            }
          }
          if (body.banner_image !== undefined) {
            const bannerCheck = validateExternalImageUrl(body.banner_image, { required: false, fieldName: 'Banner Image URL' });
            if (!bannerCheck.ok) {
              return jsonResponse({ error: bannerCheck.error }, 400, request);
            }
          }
          const incomingStatus = String(body.status || body.airing_status || '').trim();
          const resolvedType = body.type || body.Type || null;

          const rawPartners =
            body.streaming_partners !== undefined
              ? body.streaming_partners
              : body.platforms_data !== undefined
                ? body.platforms_data
                : body.watch_providers !== undefined
                  ? body.watch_providers
                  : Array.isArray(body.platforms) && body.platforms.some((p) => p && typeof p === 'object')
                    ? body.platforms
                    : undefined;
          const hasPartnersUpdate = rawPartners !== undefined;
          const normalizedPartners = hasPartnersUpdate ? normalizeStreamingPartners(rawPartners) : [];
          const partnersJson = hasPartnersUpdate
            ? JSON.stringify(normalizedPartners)
            : null;
          const derivedPartnerLangs = hasPartnersUpdate
            ? deriveAggregateLanguagesFromPartners(normalizedPartners)
            : '';
          const resolvedUpdateLanguages =
            (typeof body.languages === 'string' && body.languages.trim()) ||
            (Array.isArray(body.languages) && body.languages.length > 0 ? body.languages.join(', ') : '') ||
            (derivedPartnerLangs || null);

          let resolvedWatchUrl: string | null =
            body.watch_url !== undefined ? (body.watch_url !== null ? String(body.watch_url).trim() : null) : null;
          if (!resolvedWatchUrl && normalizedPartners.length > 0) {
            resolvedWatchUrl = String(normalizedPartners.find((p) => p.url?.trim())?.url || normalizedPartners[0]?.url || '').trim();
          }

          const rawMixed =
            body.mixed_entries !== undefined
              ? body.mixed_entries
              : body.mixedEntries !== undefined
                ? body.mixedEntries
                : null;
          const mixedJson =
            rawMixed !== undefined && rawMixed !== null
              ? typeof rawMixed === 'string'
                ? rawMixed
                : JSON.stringify(rawMixed)
              : null;
          const episodesPerSeasonStr =
            body.episodes_per_season !== undefined
              ? String(body.episodes_per_season)
              : Array.isArray(rawMixed)
                ? (rawMixed as MixedEntry[]).map((m) => m.episodes || m.episodeCount || 0).join('|')
                : null;

          const normalizedPlatformUpdate =
            body.platform !== undefined || (Array.isArray(body.platforms) && body.platforms.every((p) => typeof p === 'string')) || typeof body.platforms === 'string'
              ? normalizePlatformString(body.platform ?? body.platforms) || null
              : normalizedPartners.length > 0
                ? normalizePlatformString(normalizedPartners.map((p) => p.name).filter(Boolean)) || null
                : null;
          const updatedEpisodes =
            body.episodes_count !== undefined || body.episodes !== undefined
              ? parseOptionalEpisodesCount(body)
              : null;
          const updatedSeason =
            body.season !== undefined || body.release_season !== undefined
              ? parseOptionalSeason(body)
              : null;
          const parsedUpdateYear =
            body.year !== undefined && body.year !== null && String(body.year).trim() !== ''
              ? parseInt(String(body.year), 10)
              : null;

          const hasSeasonEpisodeCountUpdate =
            body.season_episode_count !== undefined ||
            body.seasonEpisodeCount !== undefined ||
            body['Season & Episode Count'] !== undefined;
          const hasOfficialSourceUpdate =
            body.official_source_url !== undefined ||
            body.officialSourceUrl !== undefined ||
            body['Official Source Link'] !== undefined;

          let updatedOfficialSourceUrl = '';
          if (hasOfficialSourceUpdate) {
            const officialCheck = validateOfficialSourceUrl(
              body.official_source_url ?? body.officialSourceUrl ?? body['Official Source Link'],
              'Official Source Link'
            );
            if (!officialCheck.ok) {
              return jsonResponse({ error: officialCheck.error }, 400, request);
            }
            updatedOfficialSourceUrl = officialCheck.url || '';
          }
          const updatedSeasonEpisodeCount = hasSeasonEpisodeCountUpdate
            ? normalizeSeasonEpisodeCount(body)
            : '';

          const lowerIncomingStatus = incomingStatus.toLowerCase();
          const isNonAiringStatus =
            lowerIncomingStatus.includes('complete') ||
            lowerIncomingStatus === 'finished' ||
            lowerIncomingStatus === 'ended' ||
            lowerIncomingStatus.includes('upcoming');

          const explicitSeasonClear =
            body.season === null ||
            body.season === '' ||
            body.current_season === null ||
            body.current_season === '';
          const seasonBindValue =
            isNonAiringStatus && (explicitSeasonClear || body.season === undefined)
              ? ''
              : explicitSeasonClear
                ? ''
                : updatedSeason;

          const hasBroadcastDayUpdate =
            isNonAiringStatus ||
            body.broadcast_day !== undefined ||
            body.broadcastDay !== undefined ||
            body.releaseDay !== undefined ||
            body.release_day !== undefined;
          const hasBroadcastTimeUpdate =
            isNonAiringStatus ||
            body.broadcast_time !== undefined ||
            body.broadcastTime !== undefined ||
            body.airTime !== undefined ||
            body.air_time !== undefined;
          const updatedBroadcastDay = isNonAiringStatus
            ? null
            : hasBroadcastDayUpdate
              ? normalizeBroadcastDay(body)
              : null;
          const updatedBroadcastTime = isNonAiringStatus
            ? null
            : hasBroadcastTimeUpdate
              ? normalizeBroadcastTime(body)
              : null;

          let updateRes: { meta?: { changes?: number } } | undefined;
          try {
            updateRes = await env.DB.prepare(
              `UPDATE anime SET 
                title = COALESCE(?, title),
                synopsis = COALESCE(?, synopsis),
                cover_image = COALESCE(?, cover_image),
                banner_image = COALESCE(?, banner_image),
                rating = COALESCE(?, rating),
                episodes_count = COALESCE(?, episodes_count),
                status = COALESCE(?, status),
                submissionStatus = COALESCE(?, submissionStatus),
                season = NULLIF(COALESCE(?, season), ''),
                year = COALESCE(?, year),
                genres = COALESCE(?, genres),
                languages = COALESCE(?, languages),
                platform = COALESCE(?, platform),
                type = COALESCE(?, type),
                studio = COALESCE(?, studio),
                platforms_data = CASE WHEN ? IS NOT NULL THEN ? ELSE platforms_data END,
                watch_url = CASE WHEN ? IS NOT NULL THEN ? ELSE watch_url END,
                mixedEntries = CASE WHEN ? IS NOT NULL THEN ? ELSE mixedEntries END,
                mixed_entries = CASE WHEN ? IS NOT NULL THEN ? ELSE mixed_entries END,
                episodes_per_season = CASE WHEN ? IS NOT NULL THEN ? ELSE episodes_per_season END,
                broadcast_day = CASE WHEN ? = 1 THEN ? ELSE broadcast_day END,
                broadcast_time = CASE WHEN ? = 1 THEN ? ELSE broadcast_time END,
                season_episode_count = CASE WHEN ? = 1 THEN ? ELSE season_episode_count END,
                official_source_url = CASE WHEN ? = 1 THEN ? ELSE official_source_url END,
                last_verified_at = COALESCE(?, last_verified_at),
                airing_status = COALESCE(?, airing_status)
              WHERE id = ? OR slug = ?`
            )
              .bind(
                body.title || null,
                body.synopsis || null,
                body.cover_image || null,
                body.banner_image || null,
                body.rating !== undefined && body.rating !== null && String(body.rating).trim() !== '' ? parseFloat(String(body.rating)) : null,
                updatedEpisodes,
                incomingStatus || null,
                body.submissionStatus || null,
                seasonBindValue,
                parsedUpdateYear !== null && Number.isFinite(parsedUpdateYear) ? parsedUpdateYear : null,
                body.genres || null,
                resolvedUpdateLanguages,
                normalizedPlatformUpdate,
                resolvedType,
                body.studio || null,
                partnersJson,
                partnersJson,
                resolvedWatchUrl,
                resolvedWatchUrl,
                mixedJson,
                mixedJson,
                mixedJson,
                mixedJson,
                episodesPerSeasonStr,
                episodesPerSeasonStr,
                hasBroadcastDayUpdate ? 1 : 0,
                updatedBroadcastDay,
                hasBroadcastTimeUpdate ? 1 : 0,
                updatedBroadcastTime,
                hasSeasonEpisodeCountUpdate ? 1 : 0,
                updatedSeasonEpisodeCount,
                hasOfficialSourceUpdate ? 1 : 0,
                updatedOfficialSourceUrl,
                body.last_verified_at !== undefined
                  ? String(body.last_verified_at || '').trim().slice(0, 40) || null
                  : (resolvedUpdateLanguages || normalizedPlatformUpdate || updatedEpisodes !== null
                      ? new Date().toISOString().slice(0, 10)
                      : null),
                incomingStatus || null,
                id,
                id
              )
              .run();
          } catch (updErr) {
            if (!isMissingColumnError(updErr)) {
              throw updErr;
            }
            try {
              updateRes = await env.DB.prepare(
                `UPDATE anime SET 
                  title = COALESCE(?, title),
                  synopsis = COALESCE(?, synopsis),
                  cover_image = COALESCE(?, cover_image),
                  banner_image = COALESCE(?, banner_image),
                  rating = COALESCE(?, rating),
                  episodes_count = COALESCE(?, episodes_count),
                  status = COALESCE(?, status),
                  submissionStatus = COALESCE(?, submissionStatus),
                  season = NULLIF(COALESCE(?, season), ''),
                  year = COALESCE(?, year),
                  genres = COALESCE(?, genres),
                  languages = COALESCE(?, languages),
                  platform = COALESCE(?, platform),
                  type = COALESCE(?, type),
                  studio = COALESCE(?, studio),
                  platforms_data = CASE WHEN ? IS NOT NULL THEN ? ELSE platforms_data END,
                  watch_url = CASE WHEN ? IS NOT NULL THEN ? ELSE watch_url END,
                  mixedEntries = CASE WHEN ? IS NOT NULL THEN ? ELSE mixedEntries END,
                  mixed_entries = CASE WHEN ? IS NOT NULL THEN ? ELSE mixed_entries END,
                  episodes_per_season = CASE WHEN ? IS NOT NULL THEN ? ELSE episodes_per_season END,
                  airing_status = COALESCE(?, airing_status)
                WHERE id = ? OR slug = ?`
              )
                .bind(
                  body.title || null,
                  body.synopsis || null,
                  body.cover_image || null,
                  body.banner_image || null,
                  body.rating !== undefined && body.rating !== null && String(body.rating).trim() !== '' ? parseFloat(String(body.rating)) : null,
                  updatedEpisodes,
                  incomingStatus || null,
                  body.submissionStatus || null,
                  seasonBindValue,
                  parsedUpdateYear !== null && Number.isFinite(parsedUpdateYear) ? parsedUpdateYear : null,
                  body.genres || null,
                  resolvedUpdateLanguages,
                  normalizedPlatformUpdate,
                  resolvedType,
                  body.studio || null,
                  partnersJson,
                  partnersJson,
                  resolvedWatchUrl,
                  resolvedWatchUrl,
                  mixedJson,
                  mixedJson,
                  mixedJson,
                  mixedJson,
                  episodesPerSeasonStr,
                  episodesPerSeasonStr,
                  incomingStatus || null,
                  id,
                  id
                )
                .run();
            } catch (legacyUpdErr) {
              if (!isMissingColumnError(legacyUpdErr)) {
                throw legacyUpdErr;
              }
              updateRes = await env.DB.prepare(
                `UPDATE anime SET 
                  title = COALESCE(?, title),
                  synopsis = COALESCE(?, synopsis),
                  cover_image = COALESCE(?, cover_image),
                  banner_image = COALESCE(?, banner_image),
                  rating = COALESCE(?, rating),
                  episodes_count = COALESCE(?, episodes_count),
                  status = COALESCE(?, status),
                  submissionStatus = COALESCE(?, submissionStatus),
                  season = NULLIF(COALESCE(?, season), ''),
                  year = COALESCE(?, year),
                  genres = COALESCE(?, genres),
                  languages = COALESCE(?, languages),
                  platform = COALESCE(?, platform),
                  type = COALESCE(?, type),
                  studio = COALESCE(?, studio),
                  platforms_data = CASE WHEN ? IS NOT NULL THEN ? ELSE platforms_data END,
                  watch_url = CASE WHEN ? IS NOT NULL THEN ? ELSE watch_url END,
                  mixedEntries = CASE WHEN ? IS NOT NULL THEN ? ELSE mixedEntries END,
                  mixed_entries = CASE WHEN ? IS NOT NULL THEN ? ELSE mixed_entries END,
                  episodes_per_season = CASE WHEN ? IS NOT NULL THEN ? ELSE episodes_per_season END
                WHERE id = ? OR slug = ?`
              )
                .bind(
                  body.title || null,
                  body.synopsis || null,
                  body.cover_image || null,
                  body.banner_image || null,
                  body.rating !== undefined && body.rating !== null && String(body.rating).trim() !== '' ? parseFloat(String(body.rating)) : null,
                  updatedEpisodes,
                  incomingStatus || null,
                  body.submissionStatus || null,
                  seasonBindValue,
                  parsedUpdateYear !== null && Number.isFinite(parsedUpdateYear) ? parsedUpdateYear : null,
                  body.genres || null,
                  resolvedUpdateLanguages,
                  normalizedPlatformUpdate,
                  resolvedType,
                  body.studio || null,
                  partnersJson,
                  partnersJson,
                  resolvedWatchUrl,
                  resolvedWatchUrl,
                  mixedJson,
                  mixedJson,
                  mixedJson,
                  mixedJson,
                  episodesPerSeasonStr,
                  episodesPerSeasonStr,
                  id,
                  id
                )
                .run();
            }
          }

          if (updateRes?.meta?.changes === 0) {
            return jsonResponse({ success: false, error: 'Anime not found' }, 404, request);
          }

          // Optional P2 Franchise & Verification metadata update (preserves legacy bind param positions)
          const hasFranchiseUpdate =
            body.franchise_id !== undefined ||
            body.relation_type !== undefined ||
            body.sequence_number !== undefined ||
            body.last_verified_at !== undefined;
          const cleanFranchiseId =
            body.franchise_id !== undefined ? String(body.franchise_id || '').trim().slice(0, 120) : null;
          const cleanRelationType =
            body.relation_type !== undefined ? String(body.relation_type || '').trim().slice(0, 40) : null;
          const parsedSequence =
            body.sequence_number !== undefined && body.sequence_number !== null && String(body.sequence_number).trim() !== ''
              ? Math.floor(Number(body.sequence_number))
              : null;
          const cleanSequenceNumber =
            parsedSequence !== null && Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : null;
          const cleanLastVerifiedAt =
            body.last_verified_at !== undefined
              ? String(body.last_verified_at || '').trim().slice(0, 40)
              : new Date().toISOString().slice(0, 10);

          if (hasFranchiseUpdate) {
            try {
              await env.DB.prepare(
                `UPDATE anime SET
                  franchise_id = CASE WHEN ? = 1 THEN ? ELSE franchise_id END,
                  relation_type = CASE WHEN ? = 1 THEN ? ELSE relation_type END,
                  sequence_number = CASE WHEN ? = 1 THEN ? ELSE sequence_number END,
                  last_verified_at = ?
                WHERE id = ? OR slug = ?`
              )
                .bind(
                  body.franchise_id !== undefined ? 1 : 0,
                  cleanFranchiseId ?? '',
                  body.relation_type !== undefined ? 1 : 0,
                  cleanRelationType ?? '',
                  body.sequence_number !== undefined ? 1 : 0,
                  cleanSequenceNumber,
                  cleanLastVerifiedAt,
                  id,
                  id
                )
                .run();
            } catch {
              // Ignore if migration 0011 columns are not yet applied
            }
          }

          // P2 #2 & #5: Auto-log dub update history & notify followers when dubs/episodes/platform/status change
          const updateSummaries: string[] = [];
          let updateType = 'catalog_update';
          if (resolvedUpdateLanguages) {
            updateType = 'dub_language';
            updateSummaries.push(`Languages: ${resolvedUpdateLanguages}`);
          }
          if (updatedEpisodes !== null && updatedEpisodes > 0) {
            if (updateType === 'catalog_update') updateType = 'episode_update';
            updateSummaries.push(`Episodes: ${updatedEpisodes}`);
          } else if (hasSeasonEpisodeCountUpdate && updatedSeasonEpisodeCount) {
            if (updateType === 'catalog_update') updateType = 'episode_update';
            updateSummaries.push(`Episodes: ${updatedSeasonEpisodeCount}`);
          }
          if (normalizedPlatformUpdate) {
            if (updateType === 'catalog_update') updateType = 'platform_update';
            updateSummaries.push(`OTT: ${normalizedPlatformUpdate.split('|').join(', ')}`);
          }
          if (incomingStatus) {
            if (updateType === 'catalog_update') updateType = 'status_update';
            updateSummaries.push(`Status: ${incomingStatus}`);
          }

          if (updateSummaries.length > 0) {
            try {
              let resolvedNumericAnimeId: number | null = /^\d+$/.test(id) ? Number(id) : null;
              let resolvedAnimeTitle = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '';
              if (!resolvedNumericAnimeId || !resolvedAnimeTitle) {
                const lookup = await env.DB.prepare('SELECT id, title FROM anime WHERE id = ? OR slug = ? LIMIT 1')
                  .bind(id, id)
                  .first();
                if (lookup) {
                  resolvedNumericAnimeId = Number(lookup.id) || resolvedNumericAnimeId;
                  resolvedAnimeTitle = resolvedAnimeTitle || String(lookup.title || '').trim();
                }
              }
              if (resolvedAnimeTitle) {
                const summaryText = updateSummaries.slice(0, 3).join(' • ').slice(0, 280);
                await env.DB.prepare(
                  'INSERT INTO dub_updates (anime_id, anime_title, update_type, summary) VALUES (?, ?, ?, ?)'
                )
                  .bind(resolvedNumericAnimeId, resolvedAnimeTitle.slice(0, 160), updateType, summaryText)
                  .run();

                // Fan out real in-app alerts to users following this anime
                if (resolvedNumericAnimeId) {
                  const followers = await env.DB.prepare(
                    'SELECT user_id FROM anime_follows WHERE anime_id = ?'
                  )
                    .bind(resolvedNumericAnimeId)
                    .all();
                  const followerRows = followers.results || [];
                  for (const follower of followerRows) {
                    const followerUserId = String(follower.user_id || '').trim();
                    if (!followerUserId) continue;
                    await env.DB.prepare(
                      'INSERT INTO in_app_alerts (user_id, anime_id, anime_title, update_type, message, is_read) VALUES (?, ?, ?, ?, ?, 0)'
                    )
                      .bind(
                        followerUserId,
                        resolvedNumericAnimeId,
                        resolvedAnimeTitle.slice(0, 160),
                        updateType,
                        `${resolvedAnimeTitle}: ${summaryText}`.slice(0, 320)
                      )
                      .run();
                  }
                }
              }
            } catch {
              // Safe no-op if dub_updates / anime_follows / in_app_alerts tables are not yet created
            }
          }

          const updatedRecordSnapshot = await env.DB.prepare('SELECT * FROM anime WHERE id = ? OR slug = ? LIMIT 1')
            .bind(id, id)
            .first<Record<string, unknown>>()
            .catch(() => null);

          if (updatedRecordSnapshot && updatedRecordSnapshot.id) {
            const diffInfo = computeAnimeRevisionDiff(existingRecordBeforeUpdate, updatedRecordSnapshot);
            await recordAnimeRevision(env.DB, {
              anime_id: Number(updatedRecordSnapshot.id),
              revision_summary:
                typeof body.revision_summary === 'string' && body.revision_summary.trim()
                  ? body.revision_summary.trim()
                  : diffInfo.summary,
              snapshot: updatedRecordSnapshot,
              edited_by: session.email || session.userId || 'admin',
            });
          }

          await recordAdminActivityLog(env.DB, {
            actor_email: session.email || session.userId,
            action_type: 'UPDATE_ANIME',
            entity_type: 'anime',
            entity_id: String(id),
            summary: `Updated anime #${id}${body.title ? ` ("${String(body.title).trim()}")` : ''}`,
            payload_json: {
              id,
              title: body.title,
              status: incomingStatus || undefined,
              languages: resolvedUpdateLanguages || undefined,
              platform: normalizedPlatformUpdate || undefined,
            },
          });

          return jsonResponse(
            {
              success: true,
              id,
              updated_at: updatedRecordSnapshot?.updated_at || updatedRecordSnapshot?.last_verified_at || new Date().toISOString(),
              status: incomingStatus,
              airing_status: incomingStatus,
              languages: resolvedUpdateLanguages,
              platform: normalizedPlatformUpdate,
              broadcast_day: updatedBroadcastDay,
              broadcast_time: updatedBroadcastTime,
              season: seasonBindValue === '' ? null : seasonBindValue,
              ...(hasSeasonEpisodeCountUpdate ? { season_episode_count: updatedSeasonEpisodeCount } : {}),
              ...(hasOfficialSourceUpdate ? { official_source_url: updatedOfficialSourceUrl } : {}),
              ...(body.franchise_id !== undefined ? { franchise_id: cleanFranchiseId } : {}),
              ...(body.relation_type !== undefined ? { relation_type: cleanRelationType } : {}),
              ...(body.sequence_number !== undefined ? { sequence_number: cleanSequenceNumber } : {}),
              last_verified_at: cleanLastVerifiedAt,
              platforms_data: hasPartnersUpdate ? normalizedPartners : partnersJson,
              streaming_partners: hasPartnersUpdate ? normalizedPartners : rawPartners,
              watch_providers: hasPartnersUpdate ? normalizedPartners : undefined,
              watch_url: resolvedWatchUrl,
              mixed_entries: rawMixed,
              mixedEntries: rawMixed,
              episodes_per_season: episodesPerSeasonStr,
            },
            200,
            request,
            { 'Cache-Control': 'no-store' }
          );
        } catch (err) {
          return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
        }
      }
      return jsonResponse({ success: true, id }, 200, request);
    }

    if (method === 'DELETE') {
      const session = await getAdminAuth(request, env);
      if (!session.userId) {
        return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
      }
      if (!session.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Only the authorized Admin user can delete anime entries' }, 403, request);
      }
      try {
        let recycleBinId: number | null = null;
        if (env.DB) {
          const existingRow = await env.DB.prepare('SELECT * FROM anime WHERE id = ? OR slug = ? LIMIT 1')
            .bind(id, id)
            .first<Record<string, unknown>>()
            .catch(() => null);
          if (!existingRow) {
            return jsonResponse({ success: false, error: 'Anime not found' }, 404, request);
          }
          recycleBinId = await archiveEntityToRecycleBin(env.DB, {
            entity_type: 'anime',
            entity_id: String(existingRow.id ?? id),
            title: String(existingRow.title || `Anime #${id}`),
            payload: existingRow,
            deleted_by: session.email || session.userId || 'admin',
          });
          const delRes = await env.DB.prepare('DELETE FROM anime WHERE id = ? OR slug = ?').bind(id, id).run();
          if (delRes?.meta?.changes === 0) {
            return jsonResponse({ success: false, error: 'Anime not found' }, 404, request);
          }
          await recordAdminActivityLog(env.DB, {
            actor_email: session.email || session.userId,
            action_type: 'DELETE_ANIME',
            entity_type: 'anime',
            entity_id: String(existingRow.id ?? id),
            summary: `Soft-deleted anime #${existingRow.id ?? id}${existingRow?.title ? ` ("${String(existingRow.title)}")` : ''} into Recycle Bin`,
          });
        }
        return jsonResponse({ success: true, id, recycleBinId }, 200, request);
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
      }
    }
  }

  // 5. Sub-routes: /api/anime/:id/(reviews|like|likes|vote|upvote|vote-status)
  const animeSubMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)\/(reviews|like|likes|vote|upvote|vote-status)\/?$/);
  if (animeSubMatch) {
    const id = animeSubMatch[1];
    const sub = animeSubMatch[2];

    let numericId = parseInt(id, 10);
    if (isNaN(numericId) && env.DB) {
      try {
        const row = await env.DB.prepare('SELECT id FROM anime WHERE slug = ?').bind(id).first();
        if (row && row.id) numericId = Number(row.id);
      } catch {
        // Ignore slug lookup miss
      }
    }

    if (sub === 'reviews' && method === 'POST') {
      try {
        const session = await getAuth(request, env);
        if (!session.userId) {
          return jsonResponse({ error: 'Authentication required', requiresAuth: true }, 401, request);
        }
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const comment = String(body.comment || '').trim();
        const ratingVal = body.rating !== undefined && body.rating !== null ? Number(body.rating) : NaN;
        if (!comment && (!Number.isFinite(ratingVal) || ratingVal < 1 || ratingVal > 10)) {
          return jsonResponse({ success: false, error: 'Review comment or valid rating (1-10) is required' }, 400, request);
        }

        const cleanUserName = String(body.user_name || session.username || 'Anonymous').slice(0, 50);
        const cleanUserAvatar = String(body.user_avatar || '').slice(0, 500);
        const cleanRating = Number.isFinite(ratingVal) && ratingVal >= 1 && ratingVal <= 10 ? Math.round(ratingVal) : 10;
        const cleanLanguage = String(body.language || body.dub_language || 'Hindi').trim().slice(0, 40) || 'Hindi';
        const cleanComment = comment.slice(0, 2000);
        const isSpoilerBool = Boolean(body.spoiler ?? body.spoilers ?? body.is_spoiler ?? body.isSpoiler);
        const isSpoilerInt = isSpoilerBool ? 1 : 0;
        let createdReviewId: number | null = null;

        if (env.DB) {
          if (!numericId || isNaN(numericId)) {
            return jsonResponse({ success: false, error: 'Anime not found' }, 404, request);
          }
          try {
            const ins = await env.DB.prepare(
              'INSERT INTO reviews (anime_id, user_id, user_name, user_avatar, rating, language, comment, is_spoiler) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )
              .bind(
                numericId,
                session.userId,
                cleanUserName,
                cleanUserAvatar,
                cleanRating,
                cleanLanguage,
                cleanComment,
                isSpoilerInt
              )
              .run();
            createdReviewId = Number(ins.meta?.last_row_id || 0) || null;
          } catch (revInsErr) {
            if (!isMissingColumnError(revInsErr)) throw revInsErr;
            try {
              const ins = await env.DB.prepare(
                'INSERT INTO reviews (anime_id, user_id, user_name, user_avatar, rating, language, comment) VALUES (?, ?, ?, ?, ?, ?, ?)'
              )
                .bind(numericId, session.userId, cleanUserName, cleanUserAvatar, cleanRating, cleanLanguage, cleanComment)
                .run();
              createdReviewId = Number(ins.meta?.last_row_id || 0) || null;
            } catch (revLegacyErr) {
              if (!isMissingColumnError(revLegacyErr)) throw revLegacyErr;
              const ins = await env.DB.prepare(
                'INSERT INTO reviews (anime_id, user_id, user_name, user_avatar, rating, comment) VALUES (?, ?, ?, ?, ?, ?)'
              )
                .bind(numericId, session.userId, cleanUserName, cleanUserAvatar, cleanRating, cleanComment)
                .run();
              createdReviewId = Number(ins.meta?.last_row_id || 0) || null;
            }
          }
        }
        return jsonResponse(
          {
            success: true,
            message: 'Review posted successfully',
            review: {
              id: createdReviewId,
              anime_id: numericId || id,
              user_id: session.userId,
              user_name: cleanUserName,
              user_avatar: cleanUserAvatar,
              rating: cleanRating,
              language: cleanLanguage,
              comment: cleanComment,
              is_spoiler: isSpoilerBool,
              spoilers: isSpoilerBool,
              created_at: new Date().toISOString(),
            },
          },
          201,
          request
        );
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
      }
    }

    if (sub === 'vote-status' && method === 'GET') {
      let hasLiked = false;
      let hasUpvoted = false;
      const session = await getAuth(request, env);
      const userId = session.userId;
      if (env.DB && numericId && userId) {
        try {
          const likeCheck = await env.DB.prepare(
            "SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'like'"
          )
            .bind(numericId, userId)
            .first();
          const upvoteCheck = await env.DB.prepare(
            "SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'upvote'"
          )
            .bind(numericId, userId)
            .first();
          hasLiked = Boolean(likeCheck);
          hasUpvoted = Boolean(upvoteCheck);
        } catch {
          // Ignore optional table lookup failure
        }
      }
      return jsonResponse({ animeId: numericId || id, hasLiked, hasUpvoted });
    }

    if ((sub === 'vote' || sub === 'upvote') && method === 'POST') {
      try {
        const session = await getAuth(request, env);
        const userId = session.userId;

        if (!userId) {
          return jsonResponse(
            {
              error: 'Authentication required',
              message: 'Please sign in to upvote anime titles.',
              requiresAuth: true,
            },
            401
          );
        }

        if (env.DB && numericId) {
          const existing = await env.DB.prepare(
            "SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'upvote'"
          )
            .bind(numericId, userId)
            .first();

          if (existing) {
            return jsonResponse(
              {
                error: 'Already voted',
                message: 'You have already upvoted this anime.',
                alreadyVoted: true,
                animeId: numericId,
              },
              400
            );
          }

          try {
            await env.DB.prepare("INSERT INTO user_votes (anime_id, user_id, vote_type) VALUES (?, ?, 'upvote')")
              .bind(numericId, userId)
              .run();
          } catch (uErr) {
            if (getErrorMessage(uErr).toLowerCase().includes('unique')) {
              return jsonResponse(
                {
                  error: 'Already voted',
                  message: 'You have already upvoted this anime.',
                  alreadyVoted: true,
                  animeId: numericId,
                },
                400
              );
            }
            throw uErr;
          }

          await env.DB.prepare(
            'UPDATE anime SET upvotes = MAX(0, COALESCE(upvotes, 0) + 1), popularity = MAX(0, COALESCE(popularity, 0) + 1) WHERE id = ?'
          )
            .bind(numericId)
            .run();

          const updated = await env.DB.prepare('SELECT upvotes, popularity FROM anime WHERE id = ?').bind(numericId).first();
          const newUpvotes = updated?.upvotes ?? updated?.popularity ?? 1;

          return jsonResponse({
            success: true,
            upvotes: newUpvotes,
            popularity: newUpvotes,
            animeId: numericId,
            message: 'Upvote recorded successfully',
          });
        }
        return jsonResponse({ success: true, upvotes: 1, popularity: 1 });
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500);
      }
    }

    if ((sub === 'like' || sub === 'likes') && method === 'POST') {
      try {
        const session = await getAuth(request, env);
        const userId = session.userId;

        if (!userId) {
          return jsonResponse(
            {
              error: 'Authentication required',
              message: 'Please sign in to like anime titles.',
              requiresAuth: true,
            },
            401
          );
        }

        if (env.DB && numericId) {
          const existing = await env.DB.prepare(
            "SELECT id FROM user_votes WHERE anime_id = ? AND user_id = ? AND vote_type = 'like'"
          )
            .bind(numericId, userId)
            .first();

          if (existing) {
            return jsonResponse(
              {
                error: 'Already voted',
                message: 'You have already liked this anime.',
                alreadyVoted: true,
                animeId: numericId,
              },
              400
            );
          }

          try {
            await env.DB.prepare("INSERT INTO user_votes (anime_id, user_id, vote_type) VALUES (?, ?, 'like')")
              .bind(numericId, userId)
              .run();
          } catch (uErr) {
            if (getErrorMessage(uErr).toLowerCase().includes('unique')) {
              return jsonResponse(
                {
                  error: 'Already voted',
                  message: 'You have already liked this anime.',
                  alreadyVoted: true,
                  animeId: numericId,
                },
                400
              );
            }
            throw uErr;
          }

          await env.DB.prepare(
            'UPDATE anime SET likes = MAX(0, COALESCE(likes, 0) + 1), likesCount = MAX(0, COALESCE(likesCount, 0) + 1) WHERE id = ?'
          )
            .bind(numericId)
            .run();

          const updated = await env.DB.prepare('SELECT likes, likesCount FROM anime WHERE id = ?').bind(numericId).first();
          const newLikes = updated?.likes ?? updated?.likesCount ?? 1;

          return jsonResponse({
            success: true,
            likes: newLikes,
            likesCount: newLikes,
            animeId: numericId,
            message: 'Like recorded successfully',
          });
        }
        return jsonResponse({ success: true, likes: 1, likesCount: 1 });
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500);
      }
    }
  }

  // 6. Community 10-Point Rating System: POST/GET /api/rate & /api/anime/:id/rate
  if (path === '/api/rate' || (path.startsWith('/api/anime/') && path.endsWith('/rate'))) {
    if (method === 'POST') {
      try {
        const session = await getAuth(request, env);
        if (!session.userId) {
          return jsonResponse({ error: 'Unauthorized: Active Clerk user session required to submit ratings' }, 401, request);
        }
        const userId = session.userId;

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        let animeId = Number(body.anime_id || body.animeId);
        if (!animeId && path.startsWith('/api/anime/')) {
          const match = path.match(/^\/api\/anime\/([0-9]+)\/rate/);
          if (match) animeId = Number(match[1]);
        }
        const rating = Number(body.rating);

        if (!animeId || isNaN(animeId)) {
          return jsonResponse({ error: 'Valid anime_id is required' }, 400, request);
        }
        if (isNaN(rating) || rating < 1 || rating > 10) {
          return jsonResponse({ error: 'Rating must be a score between 1 and 10.' }, 400, request);
        }

        const roundedRating = Math.round(rating);

        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO user_ratings (user_id, anime_id, rating, created_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(user_id, anime_id) DO UPDATE SET
               rating = excluded.rating,
               created_at = CURRENT_TIMESTAMP;`
          )
            .bind(userId, animeId, roundedRating)
            .run();

          const statsRes = await env.DB.prepare(
            'SELECT AVG(rating) as average_score, COUNT(rating) as total_votes FROM user_ratings WHERE anime_id = ?'
          )
            .bind(animeId)
            .first();

          const avgScore = statsRes?.average_score != null ? Number(Number(statsRes.average_score).toFixed(1)) : roundedRating;
          const totalVotes = Number(statsRes?.total_votes || 1);

          return jsonResponse(
            {
              success: true,
              anime_id: animeId,
              rating: roundedRating,
              average_score: avgScore,
              averageScore: avgScore,
              communityRating: avgScore,
              community_rating: avgScore,
              total_votes: totalVotes,
              totalVotes,
              userRating: roundedRating,
            },
            200,
            request
          );
        }

        return jsonResponse(
          {
            success: true,
            anime_id: animeId,
            rating: roundedRating,
            average_score: roundedRating,
            averageScore: roundedRating,
            communityRating: roundedRating,
            community_rating: roundedRating,
            total_votes: 1,
            totalVotes: 1,
            userRating: roundedRating,
          },
          200,
          request
        );
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }

    if (method === 'GET') {
      try {
        const animeId = Number(url.searchParams.get('anime_id') || url.searchParams.get('id'));
        const session = await getAuth(request, env);
        const userId = session.userId;

        if (!animeId || isNaN(animeId)) {
          return jsonResponse({ error: 'anime_id query parameter is required' }, 400, request);
        }

        let avgScore = 0;
        let totalVotes = 0;
        let userRating: number | null = null;

        if (env.DB) {
          const statsRes = await env.DB.prepare(
            'SELECT AVG(rating) as average_score, COUNT(rating) as total_votes FROM user_ratings WHERE anime_id = ?'
          )
            .bind(animeId)
            .first();

          if (statsRes) {
            avgScore = statsRes.average_score != null ? Number(Number(statsRes.average_score).toFixed(1)) : 0;
            totalVotes = Number(statsRes.total_votes || 0);
          }

          if (userId) {
            const uRes = await env.DB.prepare('SELECT rating FROM user_ratings WHERE anime_id = ? AND user_id = ?')
              .bind(animeId, userId)
              .first();
            if (uRes) {
              userRating = Number(uRes.rating);
            }
          }
        }

        return jsonResponse(
          {
            anime_id: animeId,
            average_score: avgScore,
            averageScore: avgScore,
            communityRating: avgScore,
            community_rating: avgScore,
            total_votes: totalVotes,
            totalVotes,
            userRating,
          },
          200,
          request
        );
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }
  }

  return null;
}
