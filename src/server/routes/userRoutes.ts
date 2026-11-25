import { getAuth } from '../../utils/auth';
import { validateServerImageUpload, validateExternalImageUrl } from '../../utils/submissionValidation';
import { getErrorMessage, type RouteContext } from './shared';

interface ImgbbUploadResponse {
  success?: boolean;
  status_txt?: string;
  error?: { message?: string };
  data?: {
    url?: string;
    display_url?: string;
    delete_url?: string;
    thumb?: { url?: string };
  };
}

export async function handleUserRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // 1. POST /api/upload (ImgBB Secure Backend Upload)
  if (path === '/api/upload' && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse({ error: 'Unauthorized: Active Clerk user session required' }, 401, request);
    }
    try {
      const contentType = (request.headers.get('content-type') || '').toLowerCase();
      let validationInput: {
        image?: unknown;
        bytes?: Uint8Array;
        filename?: unknown;
        mimeType?: unknown;
      };

      if (contentType.includes('multipart/form-data')) {
        const incomingForm = await request.formData();
        const uploadedFile = incomingForm.get('file') || incomingForm.get('image');
        if (!uploadedFile || typeof uploadedFile === 'string') {
          return jsonResponse({ success: false, error: 'Missing image file in multipart form payload' }, 400, request);
        }
        const fileObj = uploadedFile as File;
        const arrayBuf = await fileObj.arrayBuffer();
        validationInput = {
          bytes: new Uint8Array(arrayBuf),
          filename: fileObj.name,
          mimeType: fileObj.type,
        };
      } else {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body !== 'object') {
          return jsonResponse({ success: false, error: 'Invalid upload request payload' }, 400, request);
        }
        validationInput = {
          image: body.image,
          filename: body.filename,
          mimeType: body.mimeType || body.contentType,
        };
      }

      const validation = validateServerImageUpload(validationInput);
      if (!validation.ok) {
        return jsonResponse({ success: false, error: validation.error }, validation.status, request);
      }

      const apiKey = env.IMGBB_API_KEY;
      if (!apiKey) {
        return jsonResponse({ error: 'Server configuration error: IMGBB_API_KEY environment variable is not set.' }, 500, request);
      }

      const formData = new FormData();
      formData.append('key', apiKey);
      if (validation.cleanBase64) {
        formData.append('image', validation.cleanBase64);
      } else if (validationInput.bytes) {
        const blob = new Blob([validationInput.bytes.slice()], { type: validation.mimeType });
        formData.append('image', blob, validation.sanitizedFilename || 'poster.png');
      }
      if (validation.sanitizedFilename) {
        formData.append('name', validation.sanitizedFilename.replace(/\.[^/.]+$/, ''));
      }

      const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });
      const data = (await imgbbRes.json().catch(() => null)) as ImgbbUploadResponse | null;
      if (!imgbbRes.ok || !data?.success || !data?.data) {
        const providerError = data?.error?.message || data?.status_txt || `ImgBB upload failed (HTTP ${imgbbRes.status})`;
        return jsonResponse({ success: false, error: providerError }, 502, request);
      }

      const primaryUrlCheck = validateExternalImageUrl(data.data.url || data.data.display_url, {
        required: true,
        fieldName: 'Uploaded image URL',
      });
      const displayUrlCheck = validateExternalImageUrl(data.data.display_url || data.data.url, {
        required: true,
        fieldName: 'Uploaded display URL',
      });
      if (!primaryUrlCheck.ok || !displayUrlCheck.ok) {
        return jsonResponse(
          { success: false, error: primaryUrlCheck.error || displayUrlCheck.error || 'Image host returned an invalid URL' },
          502,
          request
        );
      }

      return jsonResponse(
        {
          success: true,
          url: primaryUrlCheck.url,
          display_url: displayUrlCheck.url,
          thumb: data.data.thumb?.url || primaryUrlCheck.url,
          delete_url: data.data.delete_url,
          mimeType: validation.mimeType,
          sizeBytes: validation.sizeBytes,
          storage: 'ImgBB Live Cloud',
        },
        200,
        request
      );
    } catch (err) {
      const safeMessage = getErrorMessage(err).replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]');
      return jsonResponse({ success: false, error: safeMessage }, 500, request);
    }
  }

  // 2. GET /api/user/profile & PUT /api/user/profile
  if (path === '/api/user/profile') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse({ error: 'Unauthorized: Active Clerk user session required' }, 401, request);
    }
    const userId = session.userId;

    if (method === 'GET') {
      try {
        if (env.DB) {
          const res = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
          if (res) return jsonResponse(res, 200, request);
        }
      } catch (err) {
        const msg = getErrorMessage(err).toLowerCase();
        if (!msg.includes('no such table')) {
          return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
        }
      }
      return jsonResponse(
        {
          id: userId,
          username: session.email ? session.email.split('@')[0] : 'AnimeFan',
          email: session.email || '',
          avatar_url: '/app-icon.png',
          role: session.isAdmin ? 'admin' : 'user',
          bio: '',
        },
        200,
        request
      );
    }

    if (method === 'PUT') {
      try {
        const body = (await request.json()) as Record<string, unknown>;
        if (!body.username) return jsonResponse({ error: 'Username is required' }, 400, request);
        const avatarCheck = validateExternalImageUrl(body.avatar_url, { required: false, fieldName: 'Avatar URL' });
        if (!avatarCheck.ok) {
          return jsonResponse({ error: avatarCheck.error }, 400, request);
        }
        const safeAvatarUrl = avatarCheck.url || '/app-icon.png';
        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO users (id, username, email, avatar_url, role, bio)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               username = excluded.username,
               bio = excluded.bio,
               avatar_url = excluded.avatar_url`
          )
            .bind(
              userId,
              String(body.username).trim().slice(0, 50),
              session.email || `${userId}@clerk.user`,
              safeAvatarUrl.slice(0, 500),
              session.isAdmin ? 'admin' : 'user',
              String(body.bio || '').slice(0, 500)
            )
            .run();
        }
        return jsonResponse({ success: true, userId }, 200, request);
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }
  }

  // 3. GET / POST / DELETE /api/watchlist
  if (path === '/api/watchlist') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse(
        { error: session.error || 'Unauthorized: Active Clerk user session required' },
        401,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    if (method === 'GET') {
      try {
        if (env.DB) {
          const list = await env.DB.prepare(`
            SELECT anime.* FROM watchlist
            JOIN anime ON watchlist.anime_id = anime.id
            WHERE watchlist.user_id = ?
            ORDER BY watchlist.id DESC
          `)
            .bind(session.userId)
            .all();
          const results = list.results || [];
          const watchlistIds = results
            .map((row) => Number(row.id))
            .filter((id) => Number.isInteger(id) && id > 0);
          return jsonResponse(
            { data: results, watchlist: watchlistIds, user_id: session.userId },
            200,
            request,
            { 'Cache-Control': 'no-store' }
          );
        }
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err), data: [], watchlist: [] }, 500, request, { 'Cache-Control': 'no-store' });
      }
      return jsonResponse({ data: [], watchlist: [], user_id: session.userId }, 200, request, { 'Cache-Control': 'no-store' });
    }

    if (method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const animeId = Number(
          body.anime_id ??
            body.animeId ??
            body.id ??
            url.searchParams.get('anime_id') ??
            url.searchParams.get('animeId') ??
            url.searchParams.get('id')
        );
        if (!Number.isInteger(animeId) || animeId <= 0) {
          return jsonResponse({ error: 'Valid anime_id is required' }, 400, request, { 'Cache-Control': 'no-store' });
        }
        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO watchlist (user_id, anime_id) VALUES (?, ?)
            ON CONFLICT(user_id, anime_id) DO NOTHING
          `)
            .bind(session.userId, animeId)
            .run();
        }
        return jsonResponse(
          { success: true, watchlisted: true, anime_id: animeId, user_id: session.userId },
          200,
          request,
          { 'Cache-Control': 'no-store' }
        );
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request, { 'Cache-Control': 'no-store' });
      }
    }

    if (method === 'DELETE') {
      try {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const animeId = Number(
          url.searchParams.get('anime_id') ??
            url.searchParams.get('animeId') ??
            url.searchParams.get('id') ??
            body.anime_id ??
            body.animeId ??
            body.id
        );
        if (!Number.isInteger(animeId) || animeId <= 0) {
          return jsonResponse(
            { error: 'Valid anime_id query parameter or body is required for deletion' },
            400,
            request,
            { 'Cache-Control': 'no-store' }
          );
        }
        if (env.DB) {
          await env.DB.prepare('DELETE FROM watchlist WHERE user_id = ? AND anime_id = ?')
            .bind(session.userId, animeId)
            .run();
        }
        return jsonResponse(
          { success: true, watchlisted: false, anime_id: animeId, user_id: session.userId },
          200,
          request,
          { 'Cache-Control': 'no-store' }
        );
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request, { 'Cache-Control': 'no-store' });
      }
    }

    return jsonResponse({ error: 'Method not allowed for /api/watchlist' }, 405, request, { 'Cache-Control': 'no-store' });
  }

  // 4. GET / PUT / DELETE /api/progress (Authenticated Watch Progress Tracker)
  if (path === '/api/progress') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse(
        { error: session.error || 'Unauthorized: Active Clerk user session required' },
        401,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    if (method === 'GET') {
      const animeIdParam = url.searchParams.get('anime_id') ?? url.searchParams.get('animeId');
      if (!env.DB) {
        return jsonResponse({ success: false, error: 'Database binding (DB) is not configured' }, 500, request, {
          'Cache-Control': 'no-store',
        });
      }
      try {
        if (animeIdParam) {
          const animeId = Number(animeIdParam);
          if (!Number.isInteger(animeId) || animeId <= 0) {
            return jsonResponse({ error: 'Valid anime_id query parameter required' }, 400, request);
          }
          const row = await env.DB.prepare(
            'SELECT anime_id, season, episode, total_episodes, completed, updated_at FROM watch_progress WHERE user_id = ? AND anime_id = ?'
          )
            .bind(session.userId, animeId)
            .first();
          const normalizedRow = row
            ? {
                animeId: Number(row.anime_id),
                season: Number(row.season || 1),
                episode: Number(row.episode || 0),
                totalEpisodes:
                  row.total_episodes !== null && row.total_episodes !== undefined
                    ? Number(row.total_episodes)
                    : null,
                completed: Boolean(row.completed),
                updatedAt: String(row.updated_at || new Date().toISOString()),
              }
            : null;
          return jsonResponse({ success: true, progress: normalizedRow }, 200, request, {
            'Cache-Control': 'no-store',
          });
        }

        const rows = await env.DB.prepare(
          'SELECT anime_id, season, episode, total_episodes, completed, updated_at FROM watch_progress WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200'
        )
          .bind(session.userId)
          .all();
        const normalizedList = (rows.results || []).map((r) => ({
          animeId: Number(r.anime_id),
          season: Number(r.season || 1),
          episode: Number(r.episode || 0),
          totalEpisodes:
            r.total_episodes !== null && r.total_episodes !== undefined
              ? Number(r.total_episodes)
              : null,
          completed: Boolean(r.completed),
          updatedAt: String(r.updated_at || new Date().toISOString()),
        }));
        return jsonResponse({ success: true, progress: normalizedList }, 200, request, {
          'Cache-Control': 'no-store',
        });
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request, {
          'Cache-Control': 'no-store',
        });
      }
    }

    if (method === 'PUT' || method === 'POST') {
      try {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body !== 'object') {
          return jsonResponse({ error: 'Invalid JSON watch progress payload' }, 400, request);
        }
        const animeId = Number(body.anime_id ?? body.animeId);
        if (!Number.isInteger(animeId) || animeId <= 0) {
          return jsonResponse({ error: 'Valid positive animeId is required' }, 400, request);
        }
        const rawSeason = Number(body.season ?? 1);
        const season = Number.isFinite(rawSeason) && rawSeason >= 1 ? Math.min(Math.floor(rawSeason), 99) : 1;
        const rawEpisode = Number(body.episode ?? 0);
        const episode = Number.isFinite(rawEpisode) && rawEpisode >= 0 ? Math.min(Math.floor(rawEpisode), 9999) : 0;
        const rawTotal = body.totalEpisodes ?? body.total_episodes;
        const parsedTotal =
          rawTotal !== null && rawTotal !== undefined && String(rawTotal).trim() !== ''
            ? Math.floor(Number(rawTotal))
            : null;
        const totalEpisodes =
          parsedTotal !== null && Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : null;
        const completed = body.completed ? 1 : 0;
        const updatedAt = new Date().toISOString();

        if (!env.DB) {
          return jsonResponse({ success: false, error: 'Database binding (DB) is not configured' }, 500, request, {
            'Cache-Control': 'no-store',
          });
        }

        await env.DB.prepare(
          `INSERT INTO watch_progress (user_id, anime_id, season, episode, total_episodes, completed, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, anime_id) DO UPDATE SET
             season = excluded.season,
             episode = excluded.episode,
             total_episodes = excluded.total_episodes,
             completed = excluded.completed,
             updated_at = excluded.updated_at`
        )
          .bind(session.userId, animeId, season, episode, totalEpisodes, completed, updatedAt)
          .run();

        return jsonResponse(
          {
            success: true,
            progress: {
              animeId,
              season,
              episode,
              totalEpisodes,
              completed: Boolean(completed),
              updatedAt,
            },
          },
          200,
          request,
          { 'Cache-Control': 'no-store' }
        );
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request, {
          'Cache-Control': 'no-store',
        });
      }
    }

    if (method === 'DELETE') {
      const animeIdParam = url.searchParams.get('anime_id') ?? url.searchParams.get('animeId');
      const animeId = Number(animeIdParam);
      if (!Number.isInteger(animeId) || animeId <= 0) {
        return jsonResponse({ error: 'Valid anime_id query parameter is required' }, 400, request);
      }
      if (!env.DB) {
        return jsonResponse({ success: false, error: 'Database binding (DB) is not configured' }, 500, request, {
          'Cache-Control': 'no-store',
        });
      }
      try {
        await env.DB.prepare('DELETE FROM watch_progress WHERE user_id = ? AND anime_id = ?')
          .bind(session.userId, animeId)
          .run();
        return jsonResponse({ success: true, animeId }, 200, request, { 'Cache-Control': 'no-store' });
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request, {
          'Cache-Control': 'no-store',
        });
      }
    }

    return jsonResponse({ error: 'Method not allowed for /api/progress' }, 405, request, {
      'Cache-Control': 'no-store',
    });
  }

  // 5. GET / POST / DELETE /api/follows (P2 #5 Authenticated Anime Follow System)
  if (path === '/api/follows') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse(
        { error: session.error || 'Unauthorized: Active Clerk user session required' },
        401,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    if (method === 'GET') {
      if (!env.DB) {
        return jsonResponse({ success: true, follows: [], data: [] }, 200, request, { 'Cache-Control': 'no-store' });
      }
      try {
        const res = await env.DB.prepare(
          `SELECT f.anime_id, f.created_at, a.title, a.slug, a.cover_image, a.languages, a.platform
           FROM anime_follows f
           LEFT JOIN anime a ON a.id = f.anime_id
           WHERE f.user_id = ?
           ORDER BY f.id DESC`
        )
          .bind(session.userId)
          .all();
        const rows = res.results || [];
        const followIds = rows
          .map((r) => Number(r.anime_id))
          .filter((id) => Number.isInteger(id) && id > 0);
        return jsonResponse({ success: true, follows: followIds, data: rows }, 200, request, {
          'Cache-Control': 'no-store',
        });
      } catch (err) {
        if (getErrorMessage(err).toLowerCase().includes('no such table')) {
          return jsonResponse({ success: true, follows: [], data: [] }, 200, request, { 'Cache-Control': 'no-store' });
        }
        return jsonResponse({ success: false, error: getErrorMessage(err), follows: [], data: [] }, 500, request, {
          'Cache-Control': 'no-store',
        });
      }
    }

    if (method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const animeId = Number(
          body.anime_id ?? body.animeId ?? url.searchParams.get('anime_id') ?? url.searchParams.get('animeId')
        );
        if (!Number.isInteger(animeId) || animeId <= 0) {
          return jsonResponse({ success: false, error: 'Valid positive anime_id is required' }, 400, request, {
            'Cache-Control': 'no-store',
          });
        }
        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO anime_follows (user_id, anime_id) VALUES (?, ?)
             ON CONFLICT(user_id, anime_id) DO NOTHING`
          )
            .bind(session.userId, animeId)
            .run();
        }
        return jsonResponse({ success: true, following: true, anime_id: animeId }, 200, request, {
          'Cache-Control': 'no-store',
        });
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request, {
          'Cache-Control': 'no-store',
        });
      }
    }

    if (method === 'DELETE') {
      try {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const animeId = Number(
          url.searchParams.get('anime_id') ??
            url.searchParams.get('animeId') ??
            body.anime_id ??
            body.animeId
        );
        if (!Number.isInteger(animeId) || animeId <= 0) {
          return jsonResponse({ success: false, error: 'Valid positive anime_id is required' }, 400, request, {
            'Cache-Control': 'no-store',
          });
        }
        if (env.DB) {
          await env.DB.prepare('DELETE FROM anime_follows WHERE user_id = ? AND anime_id = ?')
            .bind(session.userId, animeId)
            .run();
        }
        return jsonResponse({ success: true, following: false, anime_id: animeId }, 200, request, {
          'Cache-Control': 'no-store',
        });
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request, {
          'Cache-Control': 'no-store',
        });
      }
    }

    return jsonResponse({ error: 'Method not allowed for /api/follows' }, 405, request, {
      'Cache-Control': 'no-store',
    });
  }

  // 6. GET /api/alerts & POST /api/alerts/read (P2 #5 Real D1 In-App Alerts Inbox)
  if (path === '/api/alerts' && method === 'GET') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse(
        { error: session.error || 'Unauthorized: Active Clerk user session required' },
        401,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }
    if (!env.DB) {
      return jsonResponse({ success: true, alerts: [], unreadCount: 0 }, 200, request, {
        'Cache-Control': 'no-store',
      });
    }
    try {
      const res = await env.DB.prepare(
        `SELECT id, anime_id, anime_title, update_type, message, is_read, created_at
         FROM in_app_alerts
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 30`
      )
        .bind(session.userId)
        .all();
      const alerts = (res.results || []).map((row) => ({
        id: Number(row.id),
        anime_id: row.anime_id ? Number(row.anime_id) : null,
        anime_title: String(row.anime_title || ''),
        update_type: String(row.update_type || 'update'),
        message: String(row.message || ''),
        is_read: Boolean(row.is_read),
        created_at: String(row.created_at || ''),
      }));
      const unreadCount = alerts.filter((a) => !a.is_read).length;
      return jsonResponse({ success: true, alerts, unreadCount }, 200, request, {
        'Cache-Control': 'no-store',
      });
    } catch (err) {
      if (getErrorMessage(err).toLowerCase().includes('no such table')) {
        return jsonResponse({ success: true, alerts: [], unreadCount: 0 }, 200, request, {
          'Cache-Control': 'no-store',
        });
      }
      return jsonResponse({ success: false, error: getErrorMessage(err), alerts: [], unreadCount: 0 }, 500, request, {
        'Cache-Control': 'no-store',
      });
    }
  }

  if (path === '/api/alerts/read' && method === 'POST') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse(
        { error: session.error || 'Unauthorized: Active Clerk user session required' },
        401,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }
    if (!env.DB) {
      return jsonResponse({ success: true }, 200, request, { 'Cache-Control': 'no-store' });
    }
    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const alertId = Number(body.alertId ?? body.id);
      if (Number.isInteger(alertId) && alertId > 0) {
        await env.DB.prepare('UPDATE in_app_alerts SET is_read = 1 WHERE id = ? AND user_id = ?')
          .bind(alertId, session.userId)
          .run();
      } else {
        await env.DB.prepare('UPDATE in_app_alerts SET is_read = 1 WHERE user_id = ?')
          .bind(session.userId)
          .run();
      }
      return jsonResponse({ success: true }, 200, request, { 'Cache-Control': 'no-store' });
    } catch (err) {
      if (getErrorMessage(err).toLowerCase().includes('no such table')) {
        return jsonResponse({ success: true }, 200, request, { 'Cache-Control': 'no-store' });
      }
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request, {
        'Cache-Control': 'no-store',
      });
    }
  }

  return null;
}

