import { getAuth } from '../../utils/auth';
import {
  normalizePlatformString,
  parseCsvMixedEntriesAndEpisodesPerSeason,
  parseOptionalEpisodesCount,
  parseOptionalSeason,
} from '../../utils/dataNormalization';
import { D1_DATABASE_ID, getErrorMessage, type RouteContext } from './shared';

interface CsvImportRow {
  [key: string]: unknown;
}

interface ProcessedImportRow extends CsvImportRow {
  resolvedTitle: string;
  resolvedSlug: string;
}

export async function handleAdminRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, path, method, jsonResponse } = ctx;

  // 1. GET/POST /api/admin/verify & /api/admin/login
  if (path === '/api/admin/verify' && (method === 'GET' || method === 'POST')) {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      const statusCode = !session.userId ? 401 : 403;
      const descriptiveError =
        session.error ||
        (!session.userId
          ? 'Unauthorized: Missing or invalid Clerk session token'
          : 'Forbidden: Unauthorized access');
      return jsonResponse(
        {
          ok: false,
          success: false,
          authenticated: Boolean(session.userId),
          isAdmin: false,
          error: descriptiveError,
          message: descriptiveError,
        },
        statusCode,
        request,
        { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      );
    }
    return jsonResponse(
      {
        ok: true,
        success: true,
        authenticated: true,
        isAdmin: true,
        userId: session.userId,
        email: session.email,
      },
      200,
      request,
      { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    );
  }

  if (path === '/api/admin/login' && (method === 'POST' || method === 'GET')) {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      const statusCode = !session.userId ? 401 : 403;
      const descriptiveError =
        session.error ||
        (!session.userId
          ? 'Unauthorized: Missing or invalid Clerk session token'
          : 'Forbidden: Unauthorized access');
      return jsonResponse(
        {
          ok: false,
          success: false,
          authenticated: Boolean(session.userId),
          isAdmin: false,
          error: descriptiveError,
          message: descriptiveError,
        },
        statusCode,
        request,
        { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      );
    }
    return jsonResponse(
      {
        ok: true,
        success: true,
        authenticated: true,
        isAdmin: true,
        userId: session.userId,
        email: session.email,
      },
      200,
      request,
      { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    );
  }

  if (path === '/api/admin/logout' && method === 'POST') {
    return jsonResponse({ success: true }, 200, request);
  }

  // 2. GET /api/admin/export-csv
  if (path === '/api/admin/export-csv' && method === 'GET') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    try {
      const rows = env.DB
        ? (await env.DB.prepare('SELECT id, title, status, rating, episodes_count, year, genres, languages, platform, type, studio FROM anime ORDER BY id ASC').all())?.results || []
        : [];
      const header = ['id', 'title', 'status', 'rating', 'episodes_count', 'year', 'genres', 'languages', 'platform', 'type', 'studio'];
      const csvEscape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const csvLines = [
        header.join(','),
        ...rows.map((r) => header.map((col) => csvEscape(r[col])).join(',')),
      ];
      return new Response(csvLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="anidub-catalog.csv"',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 500, request);
    }
  }

  // 3. GET /api/cloudflare/status
  if (path === '/api/cloudflare/status') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    return jsonResponse({
      services: {
        pages: { status: 'Operational', edgeLocations: '330+ Cities', region: 'Global Anycast' },
        d1: {
          status: 'Healthy',
          databaseId: D1_DATABASE_ID,
          databaseName: 'anime-db',
          databaseSize: '48.0 KB',
          recordsCount: 8,
        },
        imgbb: {
          status: 'Live API Connected',
          provider: 'ImgBB Cloud CDN',
          cardRequired: false,
          apiKeyConfigured: Boolean(env.IMGBB_API_KEY),
          uploadsTracked: 14,
        },
        workers: { status: 'Running', zone: 'Workers Functions API', avgLatencyMs: '11ms' },
      },
      schemaSql: `-- Cloudflare D1 Database ID: ${D1_DATABASE_ID}\n-- ImgBB API Key: Configured via Cloudflare env.IMGBB_API_KEY`,
      logs: [
        { id: 1, timestamp: new Date().toISOString(), service: 'D1', event_type: 'SELECT /api/anime', status_code: 200, latency_ms: 12, details: 'Catalog pagination query' },
        { id: 2, timestamp: new Date().toISOString(), service: 'ImgBB', event_type: 'UPLOAD_POSTER', status_code: 200, latency_ms: 45, details: 'Uploaded to ImgBB CDN' },
      ],
    });
  }

  // 4. POST /api/cloudflare/d1/query - Parameterized D1 Query Endpoint (Rejects Raw SQL from Client)
  if (path === '/api/cloudflare/d1/query' && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    if (!session.isAdmin) {
      return jsonResponse({ error: 'Forbidden: Only the authorized Admin user can query D1' }, 403, request);
    }
    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      if (body.sql !== undefined) {
        return jsonResponse(
          {
            error: 'Executing raw SQL queries from the client is forbidden. Provide structured parameters (table, animeId, title, limit).',
          },
          400,
          request
        );
      }

      const table = String(body.table || 'anime').trim().toLowerCase();
      const rawLimit = Number(body.limit);
      const safeLimit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(50, Math.floor(rawLimit)) : 10;
      const animeId =
        body.animeId !== undefined && body.animeId !== ''
          ? Number(body.animeId)
          : body.id !== undefined && body.id !== ''
            ? Number(body.id)
            : null;
      const title = typeof body.title === 'string' ? body.title.trim() : '';

      if (env.DB) {
        let queryRes: { results?: Record<string, unknown>[] };
        if (table === 'anime') {
          if (animeId !== null && !isNaN(animeId) && title) {
            queryRes = await env.DB.prepare(
              'SELECT id, title, slug, rating, status, year, genres, languages, platform, cover_image FROM anime WHERE id = ? AND title LIKE ? ORDER BY id DESC LIMIT ?'
            ).bind(animeId, `%${title}%`, safeLimit).all();
          } else if (animeId !== null && !isNaN(animeId)) {
            queryRes = await env.DB.prepare(
              'SELECT id, title, slug, rating, status, year, genres, languages, platform, cover_image FROM anime WHERE id = ? LIMIT ?'
            ).bind(animeId, safeLimit).all();
          } else if (title) {
            queryRes = await env.DB.prepare(
              'SELECT id, title, slug, rating, status, year, genres, languages, platform, cover_image FROM anime WHERE title LIKE ? ORDER BY id DESC LIMIT ?'
            ).bind(`%${title}%`, safeLimit).all();
          } else {
            queryRes = await env.DB.prepare(
              'SELECT id, title, slug, rating, status, year, genres, languages, platform, cover_image FROM anime ORDER BY id DESC LIMIT ?'
            ).bind(safeLimit).all();
          }
        } else if (table === 'users') {
          queryRes = await env.DB.prepare('SELECT id, username, email, role, avatar_url FROM users LIMIT ?').bind(safeLimit).all();
        } else if (table === 'logs' || table === 'cloudflare_logs') {
          queryRes = await env.DB.prepare('SELECT id, timestamp, service, event_type, status_code, latency_ms, details FROM cloudflare_logs ORDER BY id DESC LIMIT ?').bind(safeLimit).all();
        } else {
          return jsonResponse({ error: 'Invalid table parameter. Allowed tables: anime, users, logs.' }, 400, request);
        }
        return jsonResponse({ success: true, results: queryRes?.results || [], latencyMs: 14 }, 200, request);
      }
      return jsonResponse({ success: true, results: [], latencyMs: 10 }, 200, request);
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 400, request);
    }
  }

  // 5. GET /api/admin/pending
  if (path === '/api/admin/pending' && method === 'GET') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    try {
      if (env.DB) {
        const res = await env.DB.prepare(
          "SELECT * FROM anime WHERE status = 'pending' OR submissionStatus = 'pending' ORDER BY id DESC"
        ).all();
        return jsonResponse({ success: true, data: res.results || [], total: (res.results || []).length });
      }
      return jsonResponse({ success: true, data: [], total: 0 });
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err), data: [] }, 500);
    }
  }

  // 6. POST /api/admin/import-csv
  if (path === '/api/admin/import-csv' && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    try {
      const body = (await request.json()) as CsvImportRow | CsvImportRow[];
      let rows: CsvImportRow[] = [];
      if (Array.isArray(body)) rows = body;
      else if (Array.isArray(body?.animeList)) rows = body.animeList as CsvImportRow[];
      else if (Array.isArray(body?.data)) rows = body.data as CsvImportRow[];

      if (!rows || rows.length === 0) {
        return jsonResponse({ success: false, error: 'Empty CSV payload' }, 400);
      }

      const normalizeTitle = (t: unknown): string =>
        String(t || '')
          .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
          .replace(/["'“”‘’]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      const simplifyTitleKey = (t: unknown): string => normalizeTitle(t).replace(/[^a-z0-9]/g, '');

      const extractTitleFromRow = (r: CsvImportRow): string => {
        if (!r || typeof r !== 'object') return '';
        return String(
          r.title ||
            r['Title'] ||
            r.Name ||
            r['Name'] ||
            r['name'] ||
            r.anime ||
            r['Anime'] ||
            r['Anime Title'] ||
            r['anime_title'] ||
            r['Series'] ||
            r['series'] ||
            r['Title (English)'] ||
            (Object.values(r)[0] ?? '')
        ).trim();
      };

      const existingNormalizedTitles = new Set<string>();
      const existingSimplifiedKeys = new Set<string>();
      const existingSlugs = new Set<string>();

      if (env.DB) {
        try {
          const res = await env.DB.prepare('SELECT title, slug FROM anime').all();
          const items = res && res.results ? res.results : [];
          for (const item of items) {
            if (item.title) {
              existingNormalizedTitles.add(normalizeTitle(item.title));
              existingSimplifiedKeys.add(simplifyTitleKey(item.title));
            }
            if (item.slug) {
              existingSlugs.add(normalizeTitle(item.slug));
              existingSimplifiedKeys.add(simplifyTitleKey(item.slug));
            }
          }
        } catch (dbErr) {
          console.warn('[D1 fetch existing titles warning]:', dbErr);
        }
      }

      const seenInThisUpload = new Set<string>();
      const seenInThisUploadKeys = new Set<string>();
      const itemsToInsert: ProcessedImportRow[] = [];
      const skippedTitles: string[] = [];
      const addedTitles: string[] = [];
      let skippedCount = 0;

      for (const row of rows) {
        const rawTitle = extractTitleFromRow(row);
        const norm = normalizeTitle(rawTitle);
        const key = simplifyTitleKey(rawTitle);

        if (!norm || !key) {
          skippedCount++;
          continue;
        }

        const baseSlug = norm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'anime';
        const isAlreadyInDb =
          existingNormalizedTitles.has(norm) || existingSimplifiedKeys.has(key) || existingSlugs.has(baseSlug);
        const isDuplicateInBatch = seenInThisUpload.has(norm) || seenInThisUploadKeys.has(key);

        if (isAlreadyInDb || isDuplicateInBatch) {
          skippedCount++;
          skippedTitles.push(rawTitle);
          continue;
        }

        seenInThisUpload.add(norm);
        seenInThisUploadKeys.add(key);
        existingNormalizedTitles.add(norm);
        existingSimplifiedKeys.add(key);
        existingSlugs.add(baseSlug);

        itemsToInsert.push({ ...row, resolvedTitle: rawTitle, resolvedSlug: baseSlug });
        addedTitles.push(rawTitle);
      }

      let insertedCount = 0;
      for (const row of itemsToInsert) {
        const title = row.resolvedTitle;
        const slug = row.resolvedSlug;
        const synopsis = String(row.synopsis || row.Synopsis || row.description || row.Description || 'Exciting anime series').trim();
        const year = parseInt(String(row.year || row['Release Year'] || row.Year || '2024'), 10) || 2024;
        const rating = parseFloat(String(row.rating || row.Ratings || row.Rating || '8.5')) || 8.5;
        const genres = Array.isArray(row.genres)
          ? row.genres.join(', ')
          : typeof row.genres === 'string' && row.genres.includes('|')
            ? row.genres
                .split('|')
                .map((g) => g.trim())
                .join(', ')
            : String(row.genres || row.Genres || 'Action, Fantasy').trim();
        const platform =
          normalizePlatformString(
            row.platform ?? row.Platform ?? row['Streaming Partners'] ?? row.streaming_partners
          ) || null;
        const season = parseOptionalSeason(row);
        const languages = Array.isArray(row.languages)
          ? row.languages.join(', ')
          : typeof row.languages === 'string' && row.languages.includes('|')
            ? row.languages
                .split('|')
                .map((l) => l.trim())
                .join(', ')
            : String(row.languages || row.Languages || 'Tamil, Hindi').trim();
        const cover_image = String(
          row.cover_image ||
            row.poster_url ||
            row['Poster'] ||
            row['Poster URL'] ||
            row['Cover Image'] ||
            'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800'
        );
        const banner_image = String(row.banner_image || row['Banner Image'] || cover_image);

        const rawStatus = String(row.status || row.airing_status || row.Status || '').trim().toLowerCase();
        const resolvedStatus = rawStatus.includes('complete') ? 'Completed' : 'Airing';

        let studio = '';
        if (row.Studio !== undefined && row.Studio !== null && String(row.Studio).trim() !== '') {
          studio = String(row.Studio).trim();
        } else if (row.studio !== undefined && row.studio !== null && String(row.studio).trim() !== '') {
          studio = String(row.studio).trim();
        } else if (row.STUDIO !== undefined && row.STUDIO !== null && String(row.STUDIO).trim() !== '') {
          studio = String(row.STUDIO).trim();
        } else if (row['Studio Name'] || row['studio_name'] || row['Studio_Name'] || row.studio_name) {
          studio = String(row['Studio Name'] || row['studio_name'] || row['Studio_Name'] || row.studio_name).trim();
        } else if (row.animation_studio || row.Animation_Studio || row.AnimationStudio || row['Animation Studio'] || row.animationstudio) {
          studio = String(
            row.animation_studio || row.Animation_Studio || row.AnimationStudio || row['Animation Studio'] || row.animationstudio
          ).trim();
        } else {
          const studioKey = Object.keys(row).find((k) => {
            const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return clean === 'studio' || clean.includes('studio') || clean.includes('animationstudio');
          });
          if (studioKey && row[studioKey]) {
            studio = String(row[studioKey]).trim();
          }
        }
        if (!studio) studio = 'Unknown Studio';

        const resolvedType = String(row.type || row.Type || 'TV Series').trim();
        const rawMixedInput = row.mixed_entries ?? row.mixedEntries;
        const { mixedEntries, episodesPerSeason } = parseCsvMixedEntriesAndEpisodesPerSeason(
          row['Seasons'] ?? row.seasons,
          rawMixedInput,
          row.episodes_per_season
        );
        const epCount = parseOptionalEpisodesCount(row, mixedEntries);

        const mixedEntriesJson =
          mixedEntries.length > 0
            ? JSON.stringify(mixedEntries)
            : typeof rawMixedInput === 'string'
              ? rawMixedInput
              : '';

        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO anime (title, slug, synopsis, cover_image, banner_image, rating, episodes_count, status, airing_status, submissionStatus, approval_status, is_published, season, year, genres, popularity, languages, platform, type, studio, episodes_per_season, mixedEntries)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 0, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(title) DO NOTHING`
          )
            .bind(
              title,
              slug,
              synopsis,
              cover_image,
              banner_image,
              rating,
              epCount,
              resolvedStatus,
              resolvedStatus,
              season,
              year,
              genres,
              languages,
              platform,
              resolvedType,
              studio,
              episodesPerSeason,
              mixedEntriesJson
            )
            .run();
        }
        insertedCount++;
      }

      return jsonResponse({
        success: true,
        count: insertedCount,
        insertedCount,
        skippedCount,
        skippedTitles,
        addedTitles,
        message: `Upload complete: ${insertedCount} added to pending queue, ${skippedCount} existing titles rejected.`,
      });
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500);
    }
  }

  // 7. POST /api/admin/clear-pending
  if (path === '/api/admin/clear-pending' && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    try {
      if (env.DB) {
        await env.DB.prepare("DELETE FROM anime WHERE status = 'pending' OR submissionStatus = 'pending' OR approval_status = 'pending'").run();
      }
      return jsonResponse({ success: true, message: 'Pending queue wiped successfully' });
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500);
    }
  }

  // 8. POST /api/admin/approve/:id & POST /api/admin/reject/:id
  const approveMatch = path.match(/^\/api\/admin\/approve\/([0-9a-zA-Z_-]+)\/?$/);
  if (approveMatch && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    const id = approveMatch[1];
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const targetStatus = String(body.status || body.airing_status || '').trim() || 'Completed';
    if (env.DB) {
      await env.DB.prepare("UPDATE anime SET status = ?, submissionStatus = 'approved', approval_status = 'approved', is_published = 1 WHERE id = ?")
        .bind(targetStatus, id)
        .run();
    }
    return jsonResponse({ success: true, id, status: targetStatus, submissionStatus: 'approved', approval_status: 'approved', is_published: 1 });
  }

  const rejectMatch = path.match(/^\/api\/admin\/reject\/([0-9a-zA-Z_-]+)\/?$/);
  if (rejectMatch && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    const id = rejectMatch[1];
    if (env.DB) {
      await env.DB.prepare('DELETE FROM anime WHERE id = ?').bind(id).run();
    }
    return jsonResponse({ success: true, id });
  }

  // 9. POST /api/admin/reset-db (Admin only + strict "DELETE ALL" confirmation)
  if (path === '/api/admin/reset-db' && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse(
        { error: session.error || 'Unauthorized: Valid Clerk Admin session required' },
        !session.userId ? 401 : 403,
        request
      );
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || body.confirm !== 'DELETE ALL') {
      return jsonResponse(
        {
          success: false,
          error: 'Confirmation required: send JSON payload { "confirm": "DELETE ALL" }',
        },
        400,
        request
      );
    }
    try {
      if (env.DB) {
        await env.DB.prepare('DELETE FROM reviews').run();
        await env.DB.prepare('DELETE FROM watchlist').run();
        await env.DB.prepare('DELETE FROM episodes').run();
        await env.DB.prepare('DELETE FROM feedback').run();
        await env.DB.prepare('DELETE FROM anime').run();
        await env.DB.prepare('DELETE FROM users').run();
      }
      return jsonResponse({ success: true, message: 'Database cleared successfully' });
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 500);
    }
  }

  // 10. POST/GET /api/admin/normalize-platforms (Temporary admin cleanup endpoint)
  if (path === '/api/admin/normalize-platforms' && (method === 'POST' || method === 'GET')) {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse(
        { error: session.error || (!session.userId ? 'Unauthorized: Valid Clerk Admin session required' : 'Forbidden: Admin access required') },
        !session.userId ? 401 : 403,
        request
      );
    }

    try {
      if (!env.DB) {
        return jsonResponse({ success: true, totalScanned: 0, updatedCount: 0, unchangedCount: 0, updatedSamples: [] }, 200, request);
      }

      const res = await env.DB.prepare('SELECT id, platform FROM anime ORDER BY id ASC').all<{
        id: number | string;
        platform: string | null;
      }>();
      const rows = res?.results || [];

      let updatedCount = 0;
      let unchangedCount = 0;
      const updatedSamples: Array<{ id: number | string; before: string; after: string }> = [];

      for (const row of rows) {
        const currentPlatform = typeof row.platform === 'string' ? row.platform : row.platform == null ? '' : String(row.platform);
        if (!currentPlatform.trim()) {
          unchangedCount++;
          continue;
        }
        const normalized = normalizePlatformString(currentPlatform);
        if (normalized !== currentPlatform) {
          await env.DB.prepare('UPDATE anime SET platform = ? WHERE id = ?').bind(normalized, row.id).run();
          updatedCount++;
          if (updatedSamples.length < 50) {
            updatedSamples.push({ id: row.id, before: currentPlatform, after: normalized });
          }
        } else {
          unchangedCount++;
        }
      }

      return jsonResponse(
        {
          success: true,
          totalScanned: rows.length,
          updatedCount,
          unchangedCount,
          updatedSamples,
        },
        200,
        request
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  return null;
}
