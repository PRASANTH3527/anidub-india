import { getAuth, extractClientIp } from '../../utils/auth';
import { buildLanguageLikePatterns, buildPaginatedMeta, parsePaginationQuery } from '../../utils/pagination';
import { computeDynamicLanguageFilters, extractUniqueLanguagesFromAnimeList, formatLanguagesBulletList } from '../../utils/languages';
import {
  validateExternalImageUrl,
  validateCommunitySubmissionAccount,
  checkAndRecordSubmissionRateLimit,
  validateAndSanitizeCommunitySubmission,
} from '../../utils/submissionValidation';
import {
  normalizePlatformString,
  parseOptionalEpisodesCount,
  parseOptionalSeason,
} from '../../utils/dataNormalization';
import { getErrorMessage, sendTelegramAlert, type RouteContext } from './shared';

interface PartnerEntry {
  name?: string;
  url?: string;
}

interface MixedEntry {
  type?: string;
  name?: string;
  episodes?: number | null;
  episodeCount?: number | null;
}

export async function handleAnimeRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // 1. GET /api/anime (Catalog with server-side LIMIT/OFFSET pagination, filtering & search)
  if (path === '/api/anime' && method === 'GET') {
    try {
      const includePending = url.searchParams.get('includePending') === 'true';
      if (includePending) {
        const session = await getAuth(request, env);
        if (!session.userId || !session.isAdmin) {
          return jsonResponse({ error: 'Unauthorized: Valid Clerk Admin session required to view pending/unpublished entries' }, 401, request);
        }
      }

      const { page, limit, offset } = parsePaginationQuery(url.searchParams, {
        defaultLimit: 12,
        maxLimit: includePending ? 500 : 100,
      });

      const genre = url.searchParams.get('genre');
      const language = url.searchParams.get('language');
      const platform = url.searchParams.get('platform');
      const animeType = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const rawSearch = url.searchParams.get('search');
      const search = rawSearch && !rawSearch.trim().toLowerCase().startsWith('/admin') ? rawSearch.trim() : '';
      const sort = url.searchParams.get('sort') || 'popularity';

      if (env.DB) {
        try {
          const basePublishedClause =
            "(is_published = 1 OR is_published = true) AND status != 'pending' AND (submissionStatus = 'approved' OR submissionStatus IS NULL)";
          const whereClauses: string[] = [];
          const params: unknown[] = [];

          if (!includePending) {
            whereClauses.push(basePublishedClause);
          }

          if (language && language !== 'All') {
            const langPatterns = buildLanguageLikePatterns(language);
            if (langPatterns.length > 0) {
              const langOr = langPatterns.map(() => "LOWER(COALESCE(languages, 'HIN,TAM,TEL')) LIKE ?").join(' OR ');
              whereClauses.push(`(${langOr})`);
              params.push(...langPatterns);
            }
          }

          if (genre && genre !== 'All' && genre !== 'All Genres') {
            whereClauses.push("LOWER(COALESCE(genres, '')) LIKE ?");
            params.push(`%${genre.trim().toLowerCase()}%`);
          }

          if (platform && platform !== 'All' && platform !== 'All Platforms') {
            whereClauses.push("LOWER(COALESCE(platform, 'Crunchyroll')) LIKE ?");
            params.push(`%${platform.trim().toLowerCase()}%`);
          }

          if (animeType && animeType !== 'All' && animeType !== 'All Types') {
            whereClauses.push("LOWER(COALESCE(type, 'TV Series')) LIKE ?");
            params.push(`%${animeType.trim().toLowerCase()}%`);
          }

          if (status && status !== 'All' && status !== 'All Status') {
            const normStatus = status.trim().toLowerCase();
            if (normStatus === 'airing') {
              whereClauses.push("(LOWER(COALESCE(status, '')) IN ('airing', 'ongoing') OR LOWER(COALESCE(status, '')) LIKE '%simulcast%')");
            } else if (normStatus === 'completed') {
              whereClauses.push("(LOWER(COALESCE(status, '')) LIKE '%complete%' OR LOWER(COALESCE(status, '')) LIKE '%finished%')");
            } else {
              whereClauses.push("LOWER(COALESCE(status, '')) = ?");
              params.push(normStatus);
            }
          }

          if (search) {
            const likeSearch = `%${search.toLowerCase()}%`;
            whereClauses.push("(LOWER(title) LIKE ? OR LOWER(COALESCE(synopsis, '')) LIKE ? OR LOWER(COALESCE(genres, '')) LIKE ? OR LOWER(COALESCE(studio, '')) LIKE ?)");
            params.push(likeSearch, likeSearch, likeSearch, likeSearch);
          }

          const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
          let orderSql = 'ORDER BY popularity DESC, id DESC';
          if (sort === 'rating') orderSql = 'ORDER BY rating DESC, id DESC';
          else if (sort === 'newest') orderSql = 'ORDER BY year DESC, id DESC';
          else if (sort === 'title') orderSql = 'ORDER BY title ASC, id DESC';

          const countRes = await env.DB.prepare(`SELECT COUNT(*) as total FROM anime ${whereSql}`).bind(...params).first();
          const totalItems = countRes ? Number(countRes.total) : 0;
          const meta = buildPaginatedMeta(totalItems, page, limit);

          let results: Record<string, unknown>[] = [];
          if (totalItems > 0) {
            const queryParams = [...params, limit, offset];
            const dataRes = await env.DB.prepare(`SELECT * FROM anime ${whereSql} ${orderSql} LIMIT ? OFFSET ?`).bind(...queryParams).all();
            results = dataRes.results || [];
          }

          let summary: Record<string, unknown> | undefined;
          try {
            const summaryWhere = includePending ? '' : `WHERE ${basePublishedClause}`;
            const aggRes = await env.DB.prepare(
              `SELECT COUNT(*) as totalAnime, COALESCE(SUM(MAX(0, CASE WHEN upvotes > 0 THEN upvotes ELSE COALESCE(popularity, 0) END)), 0) as totalVotes FROM anime ${summaryWhere}`
            ).first();
            const langRows = await env.DB.prepare(`SELECT languages FROM anime ${summaryWhere}`).all();
            const langEntries = (langRows?.results || []).map((r) => ({ languages: r.languages as string | string[] | null | undefined }));
            const languagesList = extractUniqueLanguagesFromAnimeList(langEntries);
            const languageFilters = computeDynamicLanguageFilters(langEntries);
            summary = {
              totalAnime: Number(aggRes?.totalAnime) || totalItems,
              totalVotes: Number(aggRes?.totalVotes) || 0,
              totalLanguages: languagesList.length,
              languagesList,
              languagesString: formatLanguagesBulletList(languagesList),
              languageFilters,
            };
          } catch {
            // Optional summary fallback if upvotes/popularity columns vary
          }

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
              'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
            }
          );
        } catch (dbErr) {
          console.error('D1 Catalog Query Error:', dbErr);
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
    const session = await getAuth(request, env);
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

      const parsedEpisodes = parseOptionalEpisodesCount(body);
      const parsedSeason = parseOptionalSeason(body);
      const partnerNamesFromBody = Array.isArray(body.streaming_partners)
        ? (body.streaming_partners as PartnerEntry[]).map((p) => p?.name).filter(Boolean)
        : Array.isArray(body.platforms_data)
          ? (body.platforms_data as PartnerEntry[]).map((p) => p?.name).filter(Boolean)
          : [];
      const normalizedPlatform =
        normalizePlatformString(
          body.platform ?? body.platforms ?? (partnerNamesFromBody.length > 0 ? partnerNamesFromBody : '')
        ) || null;

      if (env.DB) {
        const slug = String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        try {
          const insertRes = await env.DB.prepare(`
            INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, submissionStatus, season, year, genres, popularity, languages, platform, type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              body.languages || 'Tamil, Telugu, Hindi',
              normalizedPlatform,
              resolvedType
            )
            .run();
          createdId = insertRes.meta?.last_row_id || null;
        } catch {
          const insertRes = await env.DB.prepare(`
            INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, season, year, genres, popularity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              body.title,
              slug,
              body.synopsis || '',
              body.cover_image,
              body.banner_image || body.cover_image,
              parseFloat(String(body.rating)) || 8.5,
              parsedEpisodes,
              finalStatus,
              parsedSeason,
              parseInt(String(body.year), 10) || 2026,
              body.genres || 'Action',
              0
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
        `🎙 *Languages:* ${body.languages || 'Tamil, Telugu, Hindi'}\n` +
        `📺 *Platform:* ${normalizedPlatform || 'Not specified'}\n\n` +
        `💬 _"${String(body.synopsis || '').slice(0, 120)}"_`;
      await sendTelegramAlert(env, tgMsg);

      return jsonResponse({ success: true, animeId: createdId, id: createdId, status: finalStatus }, 201);
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 500);
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
        return jsonResponse(
          { error: rateLimitCheck.error },
          rateLimitCheck.status,
          request,
          rateLimitCheck.retryAfterSeconds
            ? { 'Retry-After': String(rateLimitCheck.retryAfterSeconds) }
            : undefined
        );
      }

      let createdId: number | null = null;
      if (env.DB) {
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

      return jsonResponse(
        {
          success: true,
          id: createdId,
          message: 'Anime submitted successfully for admin review.',
          submissionStatus: 'pending',
        },
        201,
        request
      );
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 500, request);
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
          const query = session.isAdmin
            ? 'SELECT * FROM anime WHERE id = ? OR slug = ?'
            : 'SELECT * FROM anime WHERE (id = ? OR slug = ?) AND is_published = 1';
          const anime = await env.DB.prepare(query).bind(id, id).first();
          if (anime) {
            let streamingPartners: PartnerEntry[] = [];
            const rawP = anime.streaming_partners || anime.platforms_data;
            if (rawP) {
              try {
                streamingPartners = typeof rawP === 'string' ? (JSON.parse(rawP) as PartnerEntry[]) : (rawP as PartnerEntry[]);
              } catch {
                streamingPartners = [];
              }
            }
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
            const reviews = await env.DB.prepare(
              'SELECT id, anime_id, user_id, user_name, user_avatar, rating, language, comment, created_at FROM reviews WHERE anime_id = ? ORDER BY id DESC'
            )
              .bind(anime.id)
              .all();

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

            return jsonResponse(
              {
                ...anime,
                streaming_partners: streamingPartners,
                platforms_data: streamingPartners,
                mixed_entries: mixedEntries,
                mixedEntries,
                episodes: episodes.results || [],
                reviews: reviews.results || [],
                average_score: communityRating,
                averageScore: communityRating,
                community_rating: communityRating,
                communityRating,
                total_votes: communityVotes,
                totalVotes: communityVotes,
                community_votes: communityVotes,
                communityVotes,
              },
              200,
              request,
              {
                'Cache-Control': 'no-cache',
              }
            );
          }
        }
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500);
      }

      return jsonResponse({ error: 'Anime not found' }, 404);
    }

    if (method === 'PUT' || method === 'PATCH') {
      const session = await getAuth(request, env);
      if (!session.userId) {
        return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
      }
      if (!session.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Only the authorized Admin user can update anime entries' }, 403, request);
      }
      if (env.DB) {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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

          const rawPartners = body.streaming_partners !== undefined ? body.streaming_partners : body.platforms_data;
          let cleanedPartners = rawPartners;
          if (Array.isArray(rawPartners)) {
            cleanedPartners = (rawPartners as PartnerEntry[]).map((p) => ({ ...p, url: p.url ? String(p.url).trim() : '' }));
          } else if (typeof rawPartners === 'string' && rawPartners.trim()) {
            try {
              const parsed = JSON.parse(rawPartners) as unknown;
              if (Array.isArray(parsed)) {
                cleanedPartners = (parsed as PartnerEntry[]).map((p) => ({ ...p, url: p.url ? String(p.url).trim() : '' }));
              }
            } catch {
              // Keep raw string if non-JSON
            }
          }
          const partnersJson =
            cleanedPartners !== undefined && cleanedPartners !== null
              ? typeof cleanedPartners === 'string'
                ? cleanedPartners
                : JSON.stringify(cleanedPartners)
              : null;

          let resolvedWatchUrl: string | null =
            body.watch_url !== undefined ? (body.watch_url !== null ? String(body.watch_url).trim() : null) : null;
          if (!resolvedWatchUrl && Array.isArray(cleanedPartners) && cleanedPartners.length > 0) {
            const typedPartners = cleanedPartners as PartnerEntry[];
            resolvedWatchUrl = String(typedPartners.find((p) => p.url?.trim())?.url || typedPartners[0]?.url || '').trim();
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
            body.platform !== undefined || body.platforms !== undefined
              ? normalizePlatformString(body.platform ?? body.platforms) || null
              : Array.isArray(cleanedPartners) && cleanedPartners.length > 0
                ? normalizePlatformString((cleanedPartners as PartnerEntry[]).map((p) => p?.name).filter(Boolean)) || null
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

          await env.DB.prepare(
            `UPDATE anime SET 
              title = COALESCE(?, title),
              synopsis = COALESCE(?, synopsis),
              cover_image = COALESCE(?, cover_image),
              banner_image = COALESCE(?, banner_image),
              rating = COALESCE(?, rating),
              episodes_count = COALESCE(?, episodes_count),
              status = COALESCE(?, status),
              submissionStatus = COALESCE(?, submissionStatus),
              season = COALESCE(?, season),
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
              updatedSeason,
              parsedUpdateYear !== null && Number.isFinite(parsedUpdateYear) ? parsedUpdateYear : null,
              body.genres || null,
              body.languages || null,
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

          return jsonResponse({
            success: true,
            id,
            status: incomingStatus,
            platform: normalizedPlatformUpdate,
            platforms_data: partnersJson,
            streaming_partners: rawPartners,
            watch_url: resolvedWatchUrl,
            mixed_entries: rawMixed,
            mixedEntries: rawMixed,
            episodes_per_season: episodesPerSeasonStr,
          });
        } catch (err) {
          return jsonResponse({ error: getErrorMessage(err) }, 500);
        }
      }
      return jsonResponse({ success: true, id }, 200, request);
    }

    if (method === 'DELETE') {
      const session = await getAuth(request, env);
      if (!session.userId) {
        return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
      }
      if (!session.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Only the authorized Admin user can delete anime entries' }, 403, request);
      }
      if (env.DB) {
        await env.DB.prepare('DELETE FROM anime WHERE id = ?').bind(id).run();
      }
      return jsonResponse({ success: true });
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
        if (env.DB && numericId) {
          await env.DB.prepare('INSERT INTO reviews (anime_id, user_id, user_name, user_avatar, rating, comment) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(
              numericId,
              session.userId,
              String(body.user_name || 'Anonymous').slice(0, 50),
              String(body.user_avatar || '').slice(0, 500),
              Number(body.rating) || 10,
              String(body.comment || '').slice(0, 2000)
            )
            .run();
        }
        return jsonResponse({ success: true, message: 'Review posted successfully' });
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500);
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
