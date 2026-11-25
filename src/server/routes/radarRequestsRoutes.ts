import { getAuth, extractClientIp } from '../../utils/auth';
import {
  DUB_REQUEST_LANGUAGES,
  normalizeRequestLanguage,
  normalizeRequestTitle,
  validateDubRequestSubmission,
  type DubRequestItem,
} from '../../utils/dubRequests';
import { getErrorMessage, type RouteContext } from './shared';

const VOTE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const VOTE_RATE_LIMIT_MAX = 20;
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
    let h = 2166136261;
    for (let i = 0; i < rawIdentity.length; i++) {
      h ^= rawIdentity.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fnv_${(h >>> 0).toString(16)}`;
  }
}

async function ensureDubRequestsTables(db: any): Promise<void> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS dub_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anime_title TEXT NOT NULL,
        normalized_title TEXT NOT NULL,
        anime_id INTEGER,
        language TEXT NOT NULL,
        vote_count INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS dub_request_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        voter_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(request_id, voter_hash)
      )
    `).run();
  } catch (err) {
    console.error('Failed to ensure dub requests tables:', err);
  }
}

function isMissingTableErr(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase();
  return msg.includes('no such table');
}

export async function handleRadarRequestsRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // ============================================================================
  // 1. DUB REQUESTS GET (/api/dub-requests)
  // ============================================================================
  if (path === '/api/dub-requests' || path === '/api/dub-requests/') {
    if (method === 'GET') {
      const langFilter = (url.searchParams.get('language') || '').trim();

      if (!env.DB) {
        return jsonResponse({ data: [], count: 0 }, 200, request);
      }

      try {
        await ensureDubRequestsTables(env.DB);
        const session = await getAuth(request, env);
        const voterHash = await computeVoterHash(request, session.userId);

        const whereClauses: string[] = [];
        const bindings: unknown[] = [];

        if (langFilter && langFilter.toLowerCase() !== 'all') {
          whereClauses.push('LOWER(language) = LOWER(?)');
          bindings.push(langFilter);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const res = await env.DB.prepare(
          `SELECT * FROM dub_requests ${whereSql} ORDER BY vote_count DESC, id DESC LIMIT 500`
        )
          .bind(...bindings)
          .all();

        const rows = (res.results || []) as any[];
        const requestIds = rows.map((r) => Number(r.id));

        let votedSet = new Set<number>();
        if (requestIds.length > 0) {
          const placeholders = requestIds.map(() => '?').join(',');
          const votesRes = await env.DB.prepare(
            `SELECT request_id FROM dub_request_votes WHERE voter_hash = ? AND request_id IN (${placeholders})`
          )
            .bind(voterHash, ...requestIds)
            .all();
          for (const v of (votesRes.results || []) as any[]) {
            votedSet.add(Number(v.request_id));
          }
        }

        const items: DubRequestItem[] = rows.map((r) => ({
          id: Number(r.id),
          anime_title: String(r.anime_title),
          anime_id: r.anime_id !== null && r.anime_id !== undefined ? Number(r.anime_id) : null,
          language: r.language as any,
          vote_count: Number(r.vote_count || 1),
          created_at: String(r.created_at || ''),
          updated_at: String(r.updated_at || ''),
          hasVoted: votedSet.has(Number(r.id)),
        }));

        return jsonResponse(
          {
            data: items,
            count: items.length,
          },
          200,
          request,
          { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=30' }
        );
      } catch (err) {
        if (isMissingTableErr(err)) {
          return jsonResponse({ data: [], count: 0 }, 200, request);
        }
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }
  }

  // ============================================================================
  // 2. DUB REQUESTS VOTE / SUBMIT (/api/dub-requests/vote)
  // ============================================================================
  if (path === '/api/dub-requests/vote' || path === '/api/dub-requests/vote/') {
    if (method === 'POST') {
      if (!env.DB) {
        return jsonResponse({ error: 'Database binding (DB) is not configured' }, 500, request);
      }

      try {
        await ensureDubRequestsTables(env.DB);
        const session = await getAuth(request, env);
        const voterHash = await computeVoterHash(request, session.userId);

        const ip = extractClientIp(request);
        const rateKey = `dub_vote:${session.userId || ip}`;
        const rateCheck = checkVoteRateLimit(rateKey);
        if (!rateCheck.ok) {
          return jsonResponse(
            { error: 'Rate limit exceeded. Please wait before voting again.' },
            429,
            request,
            { 'Retry-After': String(rateCheck.retryAfterSeconds || 60) }
          );
        }

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const rawRequestId = body.requestId !== undefined ? Number(body.requestId) : null;

        const nowIso = new Date().toISOString();

        // Case A: Upvoting an existing request ID
        if (rawRequestId !== null && Number.isInteger(rawRequestId) && rawRequestId > 0) {
          const existingReq = await env.DB.prepare('SELECT * FROM dub_requests WHERE id = ?')
            .bind(rawRequestId)
            .first();

          if (!existingReq) {
            return jsonResponse({ error: 'Dub request not found' }, 404, request);
          }

          // Check if already voted
          const existingVote = await env.DB.prepare(
            'SELECT id FROM dub_request_votes WHERE request_id = ? AND voter_hash = ?'
          )
            .bind(rawRequestId, voterHash)
            .first();

          if (existingVote) {
            return jsonResponse({ error: 'You have already voted for this request', alreadyVoted: true }, 409, request);
          }

          // Insert vote & increment vote_count
          await env.DB.prepare(
            'INSERT INTO dub_request_votes (request_id, voter_hash, created_at) VALUES (?, ?, ?)'
          )
            .bind(rawRequestId, voterHash, nowIso)
            .run();

          await env.DB.prepare(
            'UPDATE dub_requests SET vote_count = vote_count + 1, updated_at = ? WHERE id = ?'
          )
            .bind(nowIso, rawRequestId)
            .run();

          const updatedRow = await env.DB.prepare('SELECT * FROM dub_requests WHERE id = ?')
            .bind(rawRequestId)
            .first();

          const item: DubRequestItem = {
            id: Number(updatedRow!.id),
            anime_title: String(updatedRow!.anime_title),
            anime_id: updatedRow!.anime_id !== null ? Number(updatedRow!.anime_id) : null,
            language: updatedRow!.language as any,
            vote_count: Number(updatedRow!.vote_count),
            created_at: String(updatedRow!.created_at),
            updated_at: String(updatedRow!.updated_at),
            hasVoted: true,
          };

          return jsonResponse({ success: true, request: item }, 200, request);
        }

        // Case B: Submitting a new anime title + language (or merging into existing)
        const validation = validateDubRequestSubmission({
          animeTitle: body.animeTitle,
          animeId: body.animeId,
          language: body.language,
          website: body.website,
        });

        if (!validation.ok) {
          return jsonResponse({ error: validation.error }, validation.status, request);
        }

        const { anime_title, normalized_title, anime_id, language } = validation.data;

        // Check if an entry with same normalized title and language already exists
        const matchRow = await env.DB.prepare(
          'SELECT * FROM dub_requests WHERE normalized_title = ? AND LOWER(language) = LOWER(?)'
        )
          .bind(normalized_title, language)
          .first();

        let targetId: number;
        let mergedExisting = false;

        if (matchRow) {
          targetId = Number(matchRow.id);
          mergedExisting = true;

          // Check if user already voted for this matching request
          const existingVote = await env.DB.prepare(
            'SELECT id FROM dub_request_votes WHERE request_id = ? AND voter_hash = ?'
          )
            .bind(targetId, voterHash)
            .first();

          if (!existingVote) {
            await env.DB.prepare(
              'INSERT INTO dub_request_votes (request_id, voter_hash, created_at) VALUES (?, ?, ?)'
            )
              .bind(targetId, voterHash, nowIso)
              .run();

            await env.DB.prepare(
              'UPDATE dub_requests SET vote_count = vote_count + 1, updated_at = ? WHERE id = ?'
            )
              .bind(nowIso, targetId)
              .run();
          }
        } else {
          // Insert new request
          const insertRes = await env.DB.prepare(
            `INSERT INTO dub_requests (anime_title, normalized_title, anime_id, language, vote_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, ?, ?)`
          )
            .bind(anime_title, normalized_title, anime_id, language, nowIso, nowIso)
            .run();

          targetId = Number(insertRes.meta?.last_row_id || 0);

          // Record vote for creator
          await env.DB.prepare(
            'INSERT INTO dub_request_votes (request_id, voter_hash, created_at) VALUES (?, ?, ?)'
          )
            .bind(targetId, voterHash, nowIso)
            .run();
        }

        const finalRow = await env.DB.prepare('SELECT * FROM dub_requests WHERE id = ?')
          .bind(targetId)
          .first();

        const item: DubRequestItem = {
          id: Number(finalRow!.id),
          anime_title: String(finalRow!.anime_title),
          anime_id: finalRow!.anime_id !== null ? Number(finalRow!.anime_id) : null,
          language: finalRow!.language as any,
          vote_count: Number(finalRow!.vote_count),
          created_at: String(finalRow!.created_at),
          updated_at: String(finalRow!.updated_at),
          hasVoted: true,
        };

        return jsonResponse(
          {
            success: true,
            created: !mergedExisting,
            mergedExisting,
            request: item,
          },
          mergedExisting ? 200 : 201,
          request
        );
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500, request);
      }
    }
  }

  return null;
}
