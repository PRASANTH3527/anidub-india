import { getAuth, extractClientIp } from '../../utils/auth';
import {
  validateExternalImageUrl,
  validateOfficialSourceUrl,
} from '../../utils/submissionValidation';
import {
  DUB_RADAR_STAGES,
  normalizeDubRadarRow,
  validateDubRadarPayload,
} from '../../utils/dubRadar';
import {
  DUB_REQUEST_LANGUAGES,
  normalizeRequestLanguage,
  validateDubRequestSubmission,
} from '../../utils/dubRequests';
import { getErrorMessage, type RouteContext } from './shared';

const VOTE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const VOTE_RATE_LIMIT_MAX = 15;
const voteRateLimitBuckets = new Map<string, number[]>();

export function resetDubRequestRateLimitBucketsForTest(): void {
  voteRateLimitBuckets.clear();
}

function checkVoteRateLimit(key: string, nowMs = Date.now()): { ok: boolean; retryAfterSeconds?: number } {
  const cutoff = nowMs - VOTE_RATE_LIMIT_WINDOW_MS;
  const recent = (voteRateLimitBuckets.get(key) || []).filter((ts) => ts > cutoff);
  if (recent.length >= VOTE_RATE_LIMIT_MAX) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + VOTE_RATE_LIMIT_WINDOW_MS - nowMs) / 1000));
    voteRateLimitBuckets.set(key, recent);
    return { ok: false, retryAfterSeconds };
  }
  recent.push(nowMs);
  voteRateLimitBuckets.set(key, recent);
  return { ok: true };
}

async function computeVoterHash(request: Request, userId?: string | null): Promise<string> {
  const ip = extractClientIp(request);
  const ua = (request.headers.get('user-agent') || '').slice(0, 120);
  const rawIdentity = userId ? `clerk:${userId}` : `anon:${ip}|${ua}`;
  try {
    const data = new TextEncoder().encode(rawIdentity);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback deterministic hex hash if subtle crypto is unavailable
    let h = 2166136261;
    for (let i = 0; i < rawIdentity.length; i++) {
      h ^= rawIdentity.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fnv_${(h >>> 0).toString(16)}`;
  }
}

function isMissingTableErr(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase();
  return msg.includes('no such table');
}

export async function handleRadarRequestsRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // ============================================================================
  // 1. DUB RELEASE RADAR (/api/dub-radar, /api/dub-radar/:id)
  // ============================================================================
  if (path === '/api/dub-radar' || path === '/api/dub-radar/') {
    if (method === 'GET') {
      const stageFilter = (url.searchParams.get('stage') || '').trim();
      const langFilter = (url.searchParams.get('language') || '').trim();

      if (!env.DB) {
        return jsonResponse({ data: [], count: 0, stages: DUB_RADAR_STAGES }, 200, request);
      }

      try {
        const whereClauses: string[] = [];
        const bindings: unknown[] = [];

        if (stageFilter && stageFilter.toLowerCase() !== 'all') {
          whereClauses.push('LOWER(stage) = LOWER(?)');
          bindings.push(stageFilter);
        }
        if (langFilter && langFilter.toLowerCase() !== 'all') {
          whereClauses.push('LOWER(languages) LIKE ?');
          bindings.push(`%${langFilter.toLowerCase()}%`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const res = await env.DB.prepare(
          `SELECT * FROM dub_radar ${whereSql} ORDER BY updated_at DESC, id DESC LIMIT 200`
        )
          .bind(...bindings)
          .all();

        const normalized = (res.results || []).map((row) => normalizeDubRadarRow(row));
        return jsonResponse(
          {
            data: normalized,
            count: normalized.length,
            stages: DUB_RADAR_STAGES,
          },
          200,
          request,
          { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' }
        );
      } catch (err) {
        if (isMissingTableErr(err)) {
          return jsonResponse({ data: [], count: 0, stages: DUB_RADAR_STAGES }, 200, request);
        }
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }

    if (method === 'POST') {
      const session = await getAuth(request, env);
      if (!session.userId) {
        return jsonResponse({ error: 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
      }
      if (!session.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Only Admin users can manage Dub Release Radar entries' }, 403, request);
      }

      try {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const validation = validateDubRadarPayload(body);
        if (!validation.ok) {
          return jsonResponse({ error: validation.error }, 400, request);
        }

        const sourceCheck = validateOfficialSourceUrl(validation.data.source_url, 'Source URL');
        if (!sourceCheck.ok) {
          return jsonResponse({ error: sourceCheck.error }, 400, request);
        }
        const coverCheck = validateExternalImageUrl(validation.data.cover_image, {
          required: false,
          fieldName: 'Cover Image URL',
        });
        if (!coverCheck.ok) {
          return jsonResponse({ error: coverCheck.error }, 400, request);
        }

        if (!env.DB) {
          return jsonResponse({ error: 'Database binding (DB) is not configured' }, 500, request);
        }

        const nowIso = new Date().toISOString();
        const insertRes = await env.DB.prepare(
          `INSERT INTO dub_radar (anime_title, anime_id, slug, languages, platform, stage, release_date, source_url, notes, cover_image, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            validation.data.anime_title,
            validation.data.anime_id,
            validation.data.slug,
            validation.data.languages,
            validation.data.platform,
            validation.data.stage,
            validation.data.release_date,
            sourceCheck.url || '',
            validation.data.notes,
            coverCheck.url || '',
            nowIso,
            nowIso
          )
          .run();

        const createdId = insertRes.meta?.last_row_id || null;
        const createdRow = createdId
          ? await env.DB.prepare('SELECT * FROM dub_radar WHERE id = ?').bind(createdId).first()
          : null;

        return jsonResponse(
          {
            success: true,
            id: createdId,
            entry: createdRow ? normalizeDubRadarRow(createdRow) : null,
          },
          201,
          request
        );
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }
  }

  const radarItemMatch = path.match(/^\/api\/dub-radar\/(\d+)\/?$/);
  if (radarItemMatch) {
    const radarId = Number(radarItemMatch[1]);
    if (method === 'PUT' || method === 'PATCH') {
      const session = await getAuth(request, env);
      if (!session.userId) {
        return jsonResponse({ error: 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
      }
      if (!session.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Only Admin users can update Dub Release Radar entries' }, 403, request);
      }

      try {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const validation = validateDubRadarPayload(body);
        if (!validation.ok) {
          return jsonResponse({ error: validation.error }, 400, request);
        }

        const sourceCheck = validateOfficialSourceUrl(validation.data.source_url, 'Source URL');
        if (!sourceCheck.ok) {
          return jsonResponse({ error: sourceCheck.error }, 400, request);
        }
        const coverCheck = validateExternalImageUrl(validation.data.cover_image, {
          required: false,
          fieldName: 'Cover Image URL',
        });
        if (!coverCheck.ok) {
          return jsonResponse({ error: coverCheck.error }, 400, request);
        }

        if (!env.DB) {
          return jsonResponse({ error: 'Database binding (DB) is not configured' }, 500, request);
        }

        const nowIso = new Date().toISOString();
        const updateRes = await env.DB.prepare(
          `UPDATE dub_radar
           SET anime_title = ?, anime_id = ?, slug = ?, languages = ?, platform = ?, stage = ?, release_date = ?, source_url = ?, notes = ?, cover_image = ?, updated_at = ?
           WHERE id = ?`
        )
          .bind(
            validation.data.anime_title,
            validation.data.anime_id,
            validation.data.slug,
            validation.data.languages,
            validation.data.platform,
            validation.data.stage,
            validation.data.release_date,
            sourceCheck.url || '',
            validation.data.notes,
            coverCheck.url || '',
            nowIso,
            radarId
          )
          .run();

        if ((updateRes.meta?.changes || 0) === 0) {
          return jsonResponse({ error: 'Radar entry not found' }, 404, request);
        }

        const updatedRow = await env.DB.prepare('SELECT * FROM dub_radar WHERE id = ?')
          .bind(radarId)
          .first();

        return jsonResponse(
          {
            success: true,
            entry: updatedRow ? normalizeDubRadarRow(updatedRow) : null,
          },
          200,
          request
        );
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }

    if (method === 'DELETE') {
      const session = await getAuth(request, env);
      if (!session.userId) {
        return jsonResponse({ error: 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
      }
      if (!session.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Only Admin users can delete Dub Release Radar entries' }, 403, request);
      }
      if (!env.DB) {
        return jsonResponse({ error: 'Database binding (DB) is not configured' }, 500, request);
      }
      try {
        await env.DB.prepare('DELETE FROM dub_radar WHERE id = ?').bind(radarId).run();
        return jsonResponse({ success: true, id: radarId }, 200, request);
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }
  }

  // ============================================================================
  // 2. DUB REQUEST VOTING (/api/dub-requests & /api/dub-requests/vote)
  // ============================================================================
  if (path === '/api/dub-requests' || path === '/api/dub-requests/') {
    if (method === 'GET') {
      const langParam = (url.searchParams.get('language') || '').trim();
      const normalizedLang = langParam && langParam.toLowerCase() !== 'all' ? normalizeRequestLanguage(langParam) : null;

      if (!env.DB) {
        return jsonResponse(
          { data: [], count: 0, votedRequestIds: [], languages: DUB_REQUEST_LANGUAGES },
          200,
          request
        );
      }

      try {
        const session = await getAuth(request, env).catch(() => ({
          authenticated: false,
          userId: null,
          isAdmin: false,
          email: null,
        }));
        const voterHash = await computeVoterHash(request, session.userId);

        const whereSql = normalizedLang ? 'WHERE LOWER(language) = LOWER(?)' : '';
        const queryStmt = env.DB.prepare(
          `SELECT id, anime_title, anime_id, language, vote_count, created_at, updated_at
           FROM dub_requests
           ${whereSql}
           ORDER BY vote_count DESC, created_at DESC
           LIMIT 200`
        );
        const rowsRes = normalizedLang ? await queryStmt.bind(normalizedLang).all() : await queryStmt.all();

        let votedIds: number[] = [];
        try {
          const votesRes = await env.DB.prepare(
            'SELECT request_id FROM dub_request_votes WHERE voter_hash = ?'
          )
            .bind(voterHash)
            .all();
          votedIds = (votesRes.results || [])
            .map((r) => Number(r.request_id))
            .filter((n) => Number.isInteger(n) && n > 0);
        } catch {
          votedIds = [];
        }

        const votedSet = new Set(votedIds);
        const data = (rowsRes.results || []).map((row) => ({
          id: Number(row.id),
          anime_title: String(row.anime_title || ''),
          anime_id: row.anime_id !== null && row.anime_id !== undefined ? Number(row.anime_id) : null,
          language: normalizeRequestLanguage(row.language) || 'Hindi',
          vote_count: Number(row.vote_count || 0),
          created_at: row.created_at ? String(row.created_at) : undefined,
          updated_at: row.updated_at ? String(row.updated_at) : undefined,
          hasVoted: votedSet.has(Number(row.id)),
        }));

        return jsonResponse(
          {
            data,
            count: data.length,
            votedRequestIds: votedIds,
            languages: DUB_REQUEST_LANGUAGES,
          },
          200,
          request,
          { 'Cache-Control': 'no-store' }
        );
      } catch (err) {
        if (isMissingTableErr(err)) {
          return jsonResponse(
            { data: [], count: 0, votedRequestIds: [], languages: DUB_REQUEST_LANGUAGES },
            200,
            request
          );
        }
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }
  }

  if (path === '/api/dub-requests/vote' && method === 'POST') {
    if (!env.DB) {
      return jsonResponse({ error: 'Database binding (DB) is not configured' }, 500, request);
    }

    try {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return jsonResponse({ error: 'Invalid JSON request payload' }, 400, request);
      }

      const session = await getAuth(request, env).catch(() => ({
        authenticated: false,
        userId: null,
        isAdmin: false,
        email: null,
      }));
      const voterHash = await computeVoterHash(request, session.userId);

      // Rate-limit check per voter/IP
      const rateLimit = checkVoteRateLimit(voterHash);
      if (!rateLimit.ok) {
        return jsonResponse(
          {
            error: 'Too many dub request votes in a short period. Please try again shortly.',
            code: 'RATE_LIMITED',
          },
          429,
          request,
          rateLimit.retryAfterSeconds ? { 'Retry-After': String(rateLimit.retryAfterSeconds) } : undefined
        );
      }

      const rawRequestId = body.requestId ?? body.request_id ?? body.id;
      const requestIdNum =
        rawRequestId !== undefined && rawRequestId !== null && String(rawRequestId).trim() !== ''
          ? Number(rawRequestId)
          : null;

      // Mode A: Upvote an existing dub request by ID
      if (requestIdNum !== null) {
        if (!Number.isInteger(requestIdNum) || requestIdNum <= 0) {
          return jsonResponse({ error: 'Invalid requestId' }, 400, request);
        }

        const existing = await env.DB.prepare('SELECT * FROM dub_requests WHERE id = ?')
          .bind(requestIdNum)
          .first();
        if (!existing) {
          return jsonResponse({ error: 'Dub request not found' }, 404, request);
        }

        const alreadyVoted = await env.DB.prepare(
          'SELECT id FROM dub_request_votes WHERE request_id = ? AND voter_hash = ? LIMIT 1'
        )
          .bind(requestIdNum, voterHash)
          .first();
        if (alreadyVoted) {
          return jsonResponse(
            {
              error: 'You have already upvoted this dub request.',
              alreadyVoted: true,
              request: {
                id: Number(existing.id),
                anime_title: String(existing.anime_title),
                anime_id: existing.anime_id ? Number(existing.anime_id) : null,
                language: normalizeRequestLanguage(existing.language) || 'Hindi',
                vote_count: Number(existing.vote_count || 0),
                hasVoted: true,
              },
            },
            409,
            request
          );
        }

        const nowIso = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO dub_request_votes (request_id, voter_hash, created_at) VALUES (?, ?, ?)'
        )
          .bind(requestIdNum, voterHash, nowIso)
          .run();

        await env.DB.prepare(
          'UPDATE dub_requests SET vote_count = vote_count + 1, updated_at = ? WHERE id = ?'
        )
          .bind(nowIso, requestIdNum)
          .run();

        const updated = await env.DB.prepare('SELECT * FROM dub_requests WHERE id = ?')
          .bind(requestIdNum)
          .first();

        return jsonResponse(
          {
            success: true,
            created: false,
            request: {
              id: Number(updated?.id ?? requestIdNum),
              anime_title: String(updated?.anime_title ?? existing.anime_title),
              anime_id: updated?.anime_id ? Number(updated.anime_id) : null,
              language: normalizeRequestLanguage(updated?.language ?? existing.language) || 'Hindi',
              vote_count: Number(updated?.vote_count ?? Number(existing.vote_count || 0) + 1),
              hasVoted: true,
            },
          },
          200,
          request
        );
      }

      // Mode B: Submit a new anime dub request (or upvote existing matching title + language)
      const validation = validateDubRequestSubmission({
        animeTitle: body.animeTitle ?? body.anime_title ?? body.title,
        animeId: body.animeId ?? body.anime_id,
        language: body.language,
        website: body.website,
      });

      if (!validation.ok) {
        return jsonResponse({ error: validation.error }, validation.status, request);
      }

      const { anime_title, normalized_title, anime_id, language } = validation.data;
      const nowIso = new Date().toISOString();

      const existingSame = await env.DB.prepare(
        'SELECT * FROM dub_requests WHERE normalized_title = ? AND language = ? LIMIT 1'
      )
        .bind(normalized_title, language)
        .first();

      if (existingSame) {
        const existingId = Number(existingSame.id);
        const alreadyVoted = await env.DB.prepare(
          'SELECT id FROM dub_request_votes WHERE request_id = ? AND voter_hash = ? LIMIT 1'
        )
          .bind(existingId, voterHash)
          .first();

        if (alreadyVoted) {
          return jsonResponse(
            {
              error: `You have already voted for ${String(existingSame.anime_title)} in ${language}.`,
              alreadyVoted: true,
              request: {
                id: existingId,
                anime_title: String(existingSame.anime_title),
                anime_id: existingSame.anime_id ? Number(existingSame.anime_id) : null,
                language,
                vote_count: Number(existingSame.vote_count || 0),
                hasVoted: true,
              },
            },
            409,
            request
          );
        }

        await env.DB.prepare(
          'INSERT INTO dub_request_votes (request_id, voter_hash, created_at) VALUES (?, ?, ?)'
        )
          .bind(existingId, voterHash, nowIso)
          .run();

        await env.DB.prepare(
          'UPDATE dub_requests SET vote_count = vote_count + 1, updated_at = ? WHERE id = ?'
        )
          .bind(nowIso, existingId)
          .run();

        const refreshed = await env.DB.prepare('SELECT * FROM dub_requests WHERE id = ?')
          .bind(existingId)
          .first();

        return jsonResponse(
          {
            success: true,
            created: false,
            mergedExisting: true,
            request: {
              id: existingId,
              anime_title: String(refreshed?.anime_title ?? existingSame.anime_title),
              anime_id: refreshed?.anime_id ? Number(refreshed.anime_id) : null,
              language,
              vote_count: Number(refreshed?.vote_count ?? Number(existingSame.vote_count || 0) + 1),
              hasVoted: true,
            },
          },
          200,
          request
        );
      }

      // Create brand new request with initial vote = 1 and record voter hash
      const insertRes = await env.DB.prepare(
        `INSERT INTO dub_requests (anime_title, normalized_title, anime_id, language, vote_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
        .bind(anime_title, normalized_title, anime_id, language, nowIso, nowIso)
        .run();

      const newId = Number(insertRes.meta?.last_row_id || 0);
      if (newId > 0) {
        await env.DB.prepare(
          'INSERT INTO dub_request_votes (request_id, voter_hash, created_at) VALUES (?, ?, ?)'
        )
          .bind(newId, voterHash, nowIso)
          .run();
      }

      return jsonResponse(
        {
          success: true,
          created: true,
          request: {
            id: newId,
            anime_title,
            anime_id,
            language,
            vote_count: 1,
            created_at: nowIso,
            updated_at: nowIso,
            hasVoted: true,
          },
        },
        201,
        request
      );
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 500, request);
    }
  }

  return null;
}
