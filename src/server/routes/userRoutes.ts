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
      } catch {
        // Fallback to session claims
      }
      return jsonResponse(
        {
          id: userId,
          username: session.email ? session.email.split('@')[0] : 'AnimeFan',
          email: session.email || '',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
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
        const safeAvatarUrl =
          avatarCheck.url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
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

  return null;
}
