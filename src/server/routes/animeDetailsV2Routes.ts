/**
 * Cloudflare Pages / Worker API Routes for AniDub India — Anime Details 2.0 (Phase 2)
 *
 * Endpoints:
 * - GET    /api/anime/:id/dub-reviews(?lang=Tamil)
 * - POST   /api/anime/:id/dub-reviews          (Authenticated Clerk user; upserts per anime+user+lang)
 * - DELETE /api/anime/:id/dub-reviews/:revId   (Authenticated owner or Clerk admin)
 * - GET    /api/anime/:id/franchise            (Verified anime_franchise_links joined with published catalog)
 * - GET    /api/anime/:id/cast(?lang=Tamil)    (Verified anime_cast_entries only)
 * - PUT    /api/admin/franchise/:franchiseKey  (Admin upsert franchise watch-order entry)
 * - DELETE /api/admin/franchise/:franchiseKey/:animeId (Admin delete franchise link)
 * - POST   /api/admin/anime/:id/cast           (Admin add verified cast / voice actor entry)
 * - DELETE /api/admin/cast/:castId             (Admin delete cast entry)
 *
 * All D1 queries are parameterized and wrapped in safe try/catch fallbacks so the site
 * remains 100% functional even before migrations/003_anime_details_v2.sql is applied.
 */

import { getAuth, getAdminAuth } from '../../utils/auth';
import {
  computeDubReviewAggregates,
  computeDubReviewAggregatesByLanguage,
  groupVerifiedCastByLanguage,
  isMissingDetailsV2TableError,
  sanitizeOptionalHttpsImageUrl,
  sortSmartWatchOrderEntries,
  validateDubReviewPayload,
  type DubReviewRecord,
  type FranchiseLinkItem,
  type VerifiedCastEntry,
} from '../../utils/animeDetailsV2';
import { parseLanguageArray } from '../../types';
import { getErrorMessage, type RouteContext } from './shared';

async function resolveCanonicalAnimeId(
  db: RouteContext['env']['DB'],
  idOrSlug: string
): Promise<string> {
  const clean = String(idOrSlug || '').trim();
  if (!db || !clean) return clean;
  if (/^\d+$/.test(clean)) return clean;
  try {
    const row = await db
      .prepare('SELECT id FROM anime WHERE slug = ? LIMIT 1')
      .bind(clean)
      .first();
    if (row && row.id !== undefined && row.id !== null) {
      return String(row.id);
    }
  } catch {
    // Fallback to raw segment
  }
  return clean;
}

async function requireClerkUser(ctx: RouteContext) {
  const session = await getAuth(ctx.request, ctx.env);
  if (!session.authenticated || !session.userId) {
    return {
      ok: false as const,
      response: ctx.jsonResponse(
        {
          success: false,
          error: session.error || 'Please sign in to submit or manage dub reviews.',
        },
        401,
        ctx.request,
        { 'Cache-Control': 'no-store' }
      ),
    };
  }
  return { ok: true as const, session };
}

async function requireClerkAdmin(ctx: RouteContext) {
  const session = await getAdminAuth(ctx.request, ctx.env);
  if (!session.userId) {
    return {
      ok: false as const,
      response: ctx.jsonResponse(
        { success: false, error: session.error || 'Unauthorized: Clerk Admin session required' },
        401,
        ctx.request,
        { 'Cache-Control': 'no-store' }
      ),
    };
  }
  if (!session.isAdmin) {
    return {
      ok: false as const,
      response: ctx.jsonResponse(
        { success: false, error: 'Forbidden: Admin access required' },
        403,
        ctx.request,
        { 'Cache-Control': 'no-store' }
      ),
    };
  }
  return { ok: true as const, session };
}

function mapDubReviewRow(row: Record<string, any>, viewerUserId?: string | null): DubReviewRecord {
  const rawUserId = String(row.user_id || '');
  return {
    id: Number(row.id),
    anime_id: String(row.anime_id),
    user_name: String(row.user_name || 'AnimeFan_IN'),
    dub_language: String(row.dub_language || ''),
    voice_acting: Number(row.voice_acting),
    voice_casting: Number(row.voice_casting),
    translation_quality: Number(row.translation_quality),
    lip_sync: Number(row.lip_sync),
    emotional_delivery: Number(row.emotional_delivery),
    overall_score: Number(row.overall_score),
    review_text: row.review_text ? String(row.review_text) : null,
    has_spoilers: Number(row.has_spoilers) === 1 || row.has_spoilers === true,
    status: (row.status as DubReviewRecord['status']) || 'published',
    is_owner: Boolean(viewerUserId && rawUserId && viewerUserId === rawUserId),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export async function handleAnimeDetailsV2Routes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // ============================================================================
  // 1. REGIONAL 5-SLIDER DUB REVIEWS
  // ============================================================================

  // GET /api/anime/:id/dub-reviews(?lang=Tamil)
  const getReviewsMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)\/dub-reviews\/?$/);
  if (getReviewsMatch && method === 'GET') {
    const idOrSlug = decodeURIComponent(getReviewsMatch[1]).trim();
    const langFilter = (url.searchParams.get('lang') || '').trim();

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          tableReady: false,
          anime_id: idOrSlug,
          reviews: [],
          summary: computeDubReviewAggregates([]),
          byLanguage: {},
        },
        200,
        request
      );
    }

    try {
      const animeId = await resolveCanonicalAnimeId(env.DB, idOrSlug);
      const viewerSession = await getAuth(request, env).catch(() => ({ userId: null }));

      const allRes = await env.DB.prepare(
        `SELECT id, anime_id, user_id, user_name, dub_language,
                voice_acting, voice_casting, translation_quality, lip_sync, emotional_delivery,
                overall_score, review_text, has_spoilers, status, created_at, updated_at
         FROM dub_reviews
         WHERE anime_id = ? AND status = 'published'
         ORDER BY updated_at DESC, id DESC
         LIMIT 200`
      )
        .bind(animeId)
        .all();

      const allReviews = (allRes.results || []).map((row) =>
        mapDubReviewRow(row, viewerSession?.userId)
      );
      const byLanguage = computeDubReviewAggregatesByLanguage(allReviews);

      const filtered = langFilter
        ? allReviews.filter(
            (r) => r.dub_language.toLowerCase() === langFilter.toLowerCase()
          )
        : allReviews;

      return jsonResponse(
        {
          success: true,
          tableReady: true,
          anime_id: animeId,
          language: langFilter || null,
          reviews: filtered,
          summary: computeDubReviewAggregates(filtered),
          overallSummary: computeDubReviewAggregates(allReviews),
          byLanguage,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      if (isMissingDetailsV2TableError(err)) {
        return jsonResponse(
          {
            success: true,
            tableReady: false,
            anime_id: idOrSlug,
            reviews: [],
            summary: computeDubReviewAggregates([]),
            byLanguage: {},
          },
          200,
          request
        );
      }
      console.warn('[dub_reviews GET fallback]:', getErrorMessage(err));
      return jsonResponse(
        {
          success: true,
          tableReady: false,
          anime_id: idOrSlug,
          reviews: [],
          summary: computeDubReviewAggregates([]),
          byLanguage: {},
        },
        200,
        request
      );
    }
  }

  // POST /api/anime/:id/dub-reviews (Authenticated Clerk upsert)
  if (getReviewsMatch && method === 'POST') {
    const auth = await requireClerkUser(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse(
        { success: false, error: 'Database is currently unavailable.' },
        503,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON request body.' }, 400, request);
    }

    const validation = validateDubReviewPayload(body);
    if (!validation.ok) {
      return jsonResponse({ success: false, error: validation.error }, 400, request);
    }

    const idOrSlug = decodeURIComponent(getReviewsMatch[1]).trim();
    const displayName = String(
      body.user_name || auth.session.email?.split('@')[0] || 'AnimeFan_IN'
    )
      .trim()
      .slice(0, 60);

    try {
      const animeId = await resolveCanonicalAnimeId(env.DB, idOrSlug);
      const {
        dub_language,
        voice_acting,
        voice_casting,
        translation_quality,
        lip_sync,
        emotional_delivery,
        overall_score,
        review_text,
        has_spoilers,
      } = validation.data;

      await env.DB.prepare(
        `INSERT INTO dub_reviews (
           anime_id, user_id, user_name, dub_language,
           voice_acting, voice_casting, translation_quality, lip_sync, emotional_delivery,
           overall_score, review_text, has_spoilers, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'))
         ON CONFLICT(anime_id, user_id, dub_language) DO UPDATE SET
           user_name = excluded.user_name,
           voice_acting = excluded.voice_acting,
           voice_casting = excluded.voice_casting,
           translation_quality = excluded.translation_quality,
           lip_sync = excluded.lip_sync,
           emotional_delivery = excluded.emotional_delivery,
           overall_score = excluded.overall_score,
           review_text = excluded.review_text,
           has_spoilers = excluded.has_spoilers,
           status = 'published',
           updated_at = datetime('now')`
      )
        .bind(
          animeId,
          auth.session.userId,
          displayName,
          dub_language,
          voice_acting,
          voice_casting,
          translation_quality,
          lip_sync,
          emotional_delivery,
          overall_score,
          review_text,
          has_spoilers
        )
        .run();

      const savedRow = await env.DB.prepare(
        `SELECT id, anime_id, user_id, user_name, dub_language,
                voice_acting, voice_casting, translation_quality, lip_sync, emotional_delivery,
                overall_score, review_text, has_spoilers, status, created_at, updated_at
         FROM dub_reviews
         WHERE anime_id = ? AND user_id = ? AND dub_language = ?
         LIMIT 1`
      )
        .bind(animeId, auth.session.userId, dub_language)
        .first();

      return jsonResponse(
        {
          success: true,
          review: savedRow ? mapDubReviewRow(savedRow, auth.session.userId) : null,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      if (isMissingDetailsV2TableError(err)) {
        return jsonResponse(
          {
            success: false,
            tableReady: false,
            error: 'Dub reviews table is not yet initialized. Apply migration 003_anime_details_v2.sql.',
          },
          503,
          request,
          { 'Cache-Control': 'no-store' }
        );
      }
      console.error('[dub_reviews POST error]:', getErrorMessage(err));
      return jsonResponse(
        { success: false, error: 'Failed to save dub review.' },
        500,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }
  }

  // DELETE /api/anime/:id/dub-reviews/:reviewId (Authenticated owner or admin)
  const deleteReviewMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)\/dub-reviews\/(\d+)\/?$/);
  if (deleteReviewMatch && method === 'DELETE') {
    const auth = await requireClerkUser(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Database unavailable.' }, 503, request);
    }

    const reviewId = Number(deleteReviewMatch[2]);
    try {
      const existing = await env.DB.prepare(
        'SELECT id, user_id FROM dub_reviews WHERE id = ? LIMIT 1'
      )
        .bind(reviewId)
        .first();

      if (!existing) {
        return jsonResponse({ success: false, error: 'Review not found.' }, 404, request);
      }

      if (String(existing.user_id) !== auth.session.userId && !auth.session.isAdmin) {
        return jsonResponse(
          { success: false, error: 'Forbidden: You can only delete your own review.' },
          403,
          request
        );
      }

      await env.DB.prepare('DELETE FROM dub_reviews WHERE id = ?').bind(reviewId).run();
      return jsonResponse({ success: true, deletedId: reviewId }, 200, request, {
        'Cache-Control': 'no-store',
      });
    } catch (err) {
      if (isMissingDetailsV2TableError(err)) {
        return jsonResponse({ success: false, tableReady: false, error: 'Table not ready.' }, 503, request);
      }
      return jsonResponse({ success: false, error: 'Failed to delete review.' }, 500, request);
    }
  }

  // ============================================================================
  // 2. ANIME UNIVERSE & SMART WATCH ORDER
  // ============================================================================

  // GET /api/anime/:id/franchise
  const franchiseMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)\/franchise\/?$/);
  if (franchiseMatch && method === 'GET') {
    const idOrSlug = decodeURIComponent(franchiseMatch[1]).trim();
    if (!env.DB) {
      return jsonResponse(
        { success: true, tableReady: false, franchiseKey: null, entries: [] },
        200,
        request
      );
    }

    try {
      const animeId = await resolveCanonicalAnimeId(env.DB, idOrSlug);
      const linkRow = await env.DB.prepare(
        'SELECT franchise_key FROM anime_franchise_links WHERE anime_id = ? LIMIT 1'
      )
        .bind(animeId)
        .first();

      if (!linkRow || !linkRow.franchise_key) {
        return jsonResponse(
          { success: true, tableReady: true, franchiseKey: null, entries: [] },
          200,
          request
        );
      }

      const franchiseKey = String(linkRow.franchise_key);
      const rowsRes = await env.DB.prepare(
        `SELECT l.id, l.franchise_key, l.anime_id, l.relation_label, l.watch_order, l.note,
                a.title, a.slug, a.cover_image, a.year, a.status, a.episodes_count, a.languages,
                a.is_published, a.approval_status
         FROM anime_franchise_links l
         LEFT JOIN anime a ON CAST(a.id AS TEXT) = l.anime_id
         WHERE l.franchise_key = ?
         ORDER BY l.watch_order ASC, l.id ASC`
      )
        .bind(franchiseKey)
        .all();

      const rawEntries: FranchiseLinkItem[] = [];
      for (const r of rowsRes.results || []) {
        // Strictly omit unpublished, pending, or rejected anime rows from public watch-order responses
        const normalizedStatus = r.status ? String(r.status).trim().toLowerCase() : '';
        const normalizedApproval = r.approval_status
          ? String(r.approval_status).trim().toLowerCase()
          : '';
        const isUnpublished =
          (r.is_published !== undefined && r.is_published !== null && Number(r.is_published) === 0) ||
          (normalizedApproval !== '' && normalizedApproval !== 'approved' && normalizedApproval !== 'published') ||
          normalizedStatus === 'pending' ||
          normalizedStatus === 'rejected';
        if (isUnpublished || !r.title) continue;

        rawEntries.push({
          id: Number(r.id),
          franchise_key: String(r.franchise_key),
          anime_id: String(r.anime_id),
          relation_label: String(r.relation_label || 'Main Story'),
          watch_order: Number(r.watch_order) || 1,
          note: r.note ? String(r.note) : null,
          title: String(r.title),
          slug: r.slug ? String(r.slug) : undefined,
          poster: r.cover_image ? String(r.cover_image) : undefined,
          release_year: Number(r.year) > 1900 ? Number(r.year) : undefined,
          status: r.status ? String(r.status) : undefined,
          episodes_count: Number(r.episodes_count) > 0 ? Number(r.episodes_count) : undefined,
          languages: parseLanguageArray(r.languages),
        });
      }

      const entries = sortSmartWatchOrderEntries(rawEntries, animeId);
      return jsonResponse(
        {
          success: true,
          tableReady: true,
          franchiseKey,
          entries,
        },
        200,
        request
      );
    } catch (err) {
      if (!isMissingDetailsV2TableError(err)) {
        console.warn('[anime_franchise_links GET fallback]:', getErrorMessage(err));
      }
      return jsonResponse(
        { success: true, tableReady: false, franchiseKey: null, entries: [] },
        200,
        request
      );
    }
  }

  // PUT /api/admin/franchise/:franchiseKey
  const adminFranchisePutMatch = path.match(/^\/api\/admin\/franchise\/([0-9a-zA-Z_-]+)\/?$/);
  if (adminFranchisePutMatch && method === 'PUT') {
    const auth = await requireClerkAdmin(ctx);
    if (!auth.ok) return auth.response;
    if (!env.DB) return jsonResponse({ success: false, error: 'Database unavailable.' }, 503, request);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON payload.' }, 400, request);
    }

    const franchiseKey = decodeURIComponent(adminFranchisePutMatch[1]).trim();
    const animeId = String(body.anime_id || '').trim();
    const relationLabel = String(body.relation_label || 'Main Story').trim().slice(0, 60);
    const watchOrder = Math.max(1, Math.floor(Number(body.watch_order) || 1));
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null;

    if (!franchiseKey || !animeId) {
      return jsonResponse({ success: false, error: 'franchise_key and anime_id are required.' }, 400, request);
    }

    try {
      await env.DB.prepare(
        `INSERT INTO anime_franchise_links (franchise_key, anime_id, relation_label, watch_order, note, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(franchise_key, anime_id) DO UPDATE SET
           relation_label = excluded.relation_label,
           watch_order = excluded.watch_order,
           note = excluded.note,
           updated_at = datetime('now')`
      )
        .bind(franchiseKey, animeId, relationLabel, watchOrder, note)
        .run();

      return jsonResponse({ success: true, franchiseKey, anime_id: animeId, watch_order: watchOrder }, 200, request, {
        'Cache-Control': 'no-store',
      });
    } catch (err) {
      if (isMissingDetailsV2TableError(err)) {
        return jsonResponse({ success: false, tableReady: false, error: 'Migration 003 required.' }, 503, request);
      }
      return jsonResponse({ success: false, error: 'Failed to save franchise link.' }, 500, request);
    }
  }

  // DELETE /api/admin/franchise/:franchiseKey/:animeId
  const adminFranchiseDelMatch = path.match(
    /^\/api\/admin\/franchise\/([0-9a-zA-Z_-]+)\/([0-9a-zA-Z_-]+)\/?$/
  );
  if (adminFranchiseDelMatch && method === 'DELETE') {
    const auth = await requireClerkAdmin(ctx);
    if (!auth.ok) return auth.response;
    if (!env.DB) return jsonResponse({ success: false, error: 'Database unavailable.' }, 503, request);

    const franchiseKey = decodeURIComponent(adminFranchiseDelMatch[1]).trim();
    const animeId = decodeURIComponent(adminFranchiseDelMatch[2]).trim();
    try {
      await env.DB.prepare(
        'DELETE FROM anime_franchise_links WHERE franchise_key = ? AND anime_id = ?'
      )
        .bind(franchiseKey, animeId)
        .run();
      return jsonResponse({ success: true }, 200, request, { 'Cache-Control': 'no-store' });
    } catch (err) {
      if (isMissingDetailsV2TableError(err)) {
        return jsonResponse({ success: false, tableReady: false, error: 'Migration 003 required.' }, 503, request);
      }
      return jsonResponse({ success: false, error: 'Failed to delete franchise link.' }, 500, request);
    }
  }

  // ============================================================================
  // 3. VERIFIED CAST / INDIAN VOICE ACTORS
  // ============================================================================

  // GET /api/anime/:id/cast(?lang=Tamil)
  const castMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)\/cast\/?$/);
  if (castMatch && method === 'GET') {
    const idOrSlug = decodeURIComponent(castMatch[1]).trim();
    const langFilter = (url.searchParams.get('lang') || '').trim();

    if (!env.DB) {
      return jsonResponse(
        { success: true, tableReady: false, entries: [], languages: [], byLanguage: {} },
        200,
        request
      );
    }

    try {
      const animeId = await resolveCanonicalAnimeId(env.DB, idOrSlug);
      const res = await env.DB.prepare(
        `SELECT id, anime_id, character_name, role, voice_actor_name, dub_language,
                character_image, actor_image, verified, updated_at
         FROM anime_cast_entries
         WHERE anime_id = ? AND verified = 1
         ORDER BY CASE WHEN LOWER(role) = 'main' THEN 0 ELSE 1 END, character_name ASC
         LIMIT 200`
      )
        .bind(animeId)
        .all();

      const allVerified: VerifiedCastEntry[] = (res.results || []).map((row) => ({
        id: Number(row.id),
        anime_id: String(row.anime_id),
        character_name: String(row.character_name || ''),
        role: String(row.role || 'Main'),
        voice_actor_name: String(row.voice_actor_name || ''),
        dub_language: String(row.dub_language || ''),
        character_image: sanitizeOptionalHttpsImageUrl(row.character_image),
        actor_image: sanitizeOptionalHttpsImageUrl(row.actor_image),
        verified: Number(row.verified) === 1 || row.verified === true,
        updated_at: row.updated_at ? String(row.updated_at) : undefined,
      }));

      const grouped = groupVerifiedCastByLanguage(allVerified);
      const filteredEntries = langFilter
        ? allVerified.filter(
            (e) => e.dub_language.toLowerCase() === langFilter.toLowerCase()
          )
        : allVerified;

      return jsonResponse(
        {
          success: true,
          tableReady: true,
          anime_id: animeId,
          entries: filteredEntries,
          languages: grouped.languages,
          byLanguage: grouped.byLanguage,
        },
        200,
        request
      );
    } catch (err) {
      if (!isMissingDetailsV2TableError(err)) {
        console.warn('[anime_cast_entries GET fallback]:', getErrorMessage(err));
      }
      return jsonResponse(
        { success: true, tableReady: false, entries: [], languages: [], byLanguage: {} },
        200,
        request
      );
    }
  }

  // POST /api/admin/anime/:id/cast
  const adminCastPostMatch = path.match(/^\/api\/admin\/anime\/([0-9a-zA-Z_-]+)\/cast\/?$/);
  if (adminCastPostMatch && method === 'POST') {
    const auth = await requireClerkAdmin(ctx);
    if (!auth.ok) return auth.response;
    if (!env.DB) return jsonResponse({ success: false, error: 'Database unavailable.' }, 503, request);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON payload.' }, 400, request);
    }

    const animeId = await resolveCanonicalAnimeId(
      env.DB,
      decodeURIComponent(adminCastPostMatch[1]).trim()
    );
    const characterName = String(body.character_name || '').trim().slice(0, 120);
    const voiceActorName = String(body.voice_actor_name || '').trim().slice(0, 120);
    const dubLanguage = String(body.dub_language || '').trim().slice(0, 40);
    const role = String(body.role || 'Main').trim().slice(0, 40);
    const characterImage = sanitizeOptionalHttpsImageUrl(body.character_image);
    const actorImage = sanitizeOptionalHttpsImageUrl(body.actor_image);
    const verified = body.verified === false || body.verified === 0 ? 0 : 1;

    if (!characterName || !voiceActorName || !dubLanguage) {
      return jsonResponse(
        { success: false, error: 'character_name, voice_actor_name, and dub_language are required.' },
        400,
        request
      );
    }

    try {
      const info = await env.DB.prepare(
        `INSERT INTO anime_cast_entries (
           anime_id, character_name, role, voice_actor_name, dub_language,
           character_image, actor_image, verified, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          animeId,
          characterName,
          role,
          voiceActorName,
          dubLanguage,
          characterImage,
          actorImage,
          verified
        )
        .run();

      return jsonResponse(
        {
          success: true,
          id: info?.meta?.last_row_id ?? null,
        },
        201,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      if (isMissingDetailsV2TableError(err)) {
        return jsonResponse({ success: false, tableReady: false, error: 'Migration 003 required.' }, 503, request);
      }
      return jsonResponse({ success: false, error: 'Failed to save cast entry.' }, 500, request);
    }
  }

  // DELETE /api/admin/cast/:castId
  const adminCastDelMatch = path.match(/^\/api\/admin\/cast\/(\d+)\/?$/);
  if (adminCastDelMatch && method === 'DELETE') {
    const auth = await requireClerkAdmin(ctx);
    if (!auth.ok) return auth.response;
    if (!env.DB) return jsonResponse({ success: false, error: 'Database unavailable.' }, 503, request);

    const castId = Number(adminCastDelMatch[1]);
    try {
      await env.DB.prepare('DELETE FROM anime_cast_entries WHERE id = ?').bind(castId).run();
      return jsonResponse({ success: true, deletedId: castId }, 200, request, {
        'Cache-Control': 'no-store',
      });
    } catch (err) {
      if (isMissingDetailsV2TableError(err)) {
        return jsonResponse({ success: false, tableReady: false, error: 'Migration 003 required.' }, 503, request);
      }
      return jsonResponse({ success: false, error: 'Failed to delete cast entry.' }, 500, request);
    }
  }

  return null;
}
