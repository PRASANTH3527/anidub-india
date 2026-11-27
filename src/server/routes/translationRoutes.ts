import { getAdminAuth } from '../../utils/auth';
import {
  computeSourceHash,
  computeTranslationCoverage,
  isMissingTranslationsTableError,
  normalizeTranslationLocale,
  sanitizeTranslationStatus,
  TARGET_TRANSLATION_LOCALES,
  validateTranslationPayload,
  type AnimeTranslationRecord,
} from '../../utils/animeTranslations';
import { getErrorMessage, type D1DatabaseLike, type RouteContext } from './shared';

/**
 * Safely fetches published translations for one or more anime IDs for a target locale.
 * Gracefully returns an empty map when the table is not migrated yet or has no published rows.
 */
export async function fetchPublishedTranslationsMap(
  db: D1DatabaseLike | null | undefined,
  animeIds: Array<string | number>,
  locale: string | null | undefined
): Promise<Map<string, AnimeTranslationRecord>> {
  const map = new Map<string, AnimeTranslationRecord>();
  const normLocale = normalizeTranslationLocale(locale);
  if (!db || !normLocale || normLocale === 'en' || animeIds.length === 0) {
    return map;
  }

  const cleanIds = Array.from(
    new Set(animeIds.map((id) => String(id).trim()).filter(Boolean))
  ).slice(0, 200);
  if (cleanIds.length === 0) return map;

  try {
    const placeholders = cleanIds.map(() => '?').join(', ');
    const res = await db
      .prepare(
        `SELECT id, anime_id, locale, localized_title, synopsis, description, source_hash, translation_status, updated_at
         FROM anime_translations
         WHERE locale = ? AND translation_status = 'published' AND anime_id IN (${placeholders})`
      )
      .bind(normLocale, ...cleanIds)
      .all();

    for (const row of res.results || []) {
      const aid = String(row.anime_id ?? '').trim();
      if (!aid) continue;
      map.set(aid, {
        id: Number(row.id) || undefined,
        anime_id: aid,
        locale: String(row.locale || normLocale),
        localized_title: row.localized_title ? String(row.localized_title) : null,
        synopsis: row.synopsis ? String(row.synopsis) : null,
        description: row.description ? String(row.description) : null,
        source_hash: row.source_hash ? String(row.source_hash) : null,
        translation_status: sanitizeTranslationStatus(row.translation_status, 'published'),
        updated_at: row.updated_at ? String(row.updated_at) : undefined,
      });
    }
  } catch (err) {
    // Graceful English fallback if anime_translations table is not yet migrated
    if (!isMissingTranslationsTableError(err)) {
      console.warn('[anime_translations lookup fallback]:', getErrorMessage(err));
    }
  }

  return map;
}

async function requireAdminSession(ctx: RouteContext) {
  const session = await getAdminAuth(ctx.request, ctx.env);
  if (!session.userId) {
    return {
      ok: false as const,
      response: ctx.jsonResponse(
        {
          success: false,
          error: session.error || 'Unauthorized: Valid Clerk Admin session required',
        },
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
        {
          success: false,
          error: 'Forbidden: Only authorized administrators can manage anime translations',
        },
        403,
        ctx.request,
        { 'Cache-Control': 'no-store' }
      ),
    };
  }
  return { ok: true as const, session };
}

export async function handleTranslationRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // 1. PUBLIC READ: GET /api/anime/:id/translation(s)(?locale=ta)
  const publicMatch = path.match(/^\/api\/anime\/([0-9a-zA-Z_-]+)\/translations?\/?$/);
  if (publicMatch && method === 'GET') {
    const idOrSlug = decodeURIComponent(publicMatch[1]).trim();
    const localeParam = url.searchParams.get('locale');
    const normLocale = localeParam ? normalizeTranslationLocale(localeParam) : null;

    if (localeParam && !normLocale) {
      return jsonResponse({ success: false, error: 'Unsupported locale parameter.' }, 400, request);
    }

    if (!env.DB) {
      return jsonResponse(
        { success: true, anime_id: idOrSlug, translation: null, translations: [] },
        200,
        request
      );
    }

    try {
      // Resolve canonical anime ID (only published anime)
      const animeRow = await env.DB.prepare(
        "SELECT id, slug FROM anime WHERE (id = ? OR slug = ? OR LOWER(slug) = LOWER(?)) AND (is_published = 1 OR is_published = true) AND LOWER(COALESCE(status, '')) != 'pending' LIMIT 1"
      )
        .bind(idOrSlug, idOrSlug, idOrSlug)
        .first();

      if (!animeRow) {
        return jsonResponse(
          { success: true, anime_id: idOrSlug, translation: null, translations: [] },
          200,
          request
        );
      }

      const canonicalId = String(animeRow.id);

      if (normLocale === 'en') {
        return jsonResponse(
          { success: true, anime_id: canonicalId, translation: null, translations: [] },
          200,
          request,
          { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' }
        );
      }

      try {
        if (normLocale) {
          const row = await env.DB.prepare(
            `SELECT id, anime_id, locale, localized_title, synopsis, description, translation_status, updated_at
             FROM anime_translations
             WHERE anime_id = ? AND locale = ? AND translation_status = 'published'
             LIMIT 1`
          )
            .bind(canonicalId, normLocale)
            .first();

          return jsonResponse(
            {
              success: true,
              anime_id: canonicalId,
              translation: row || null,
              translations: row ? [row] : [],
            },
            200,
            request,
            { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' }
          );
        }

        const allRes = await env.DB.prepare(
          `SELECT id, anime_id, locale, localized_title, synopsis, description, translation_status, updated_at
           FROM anime_translations
           WHERE anime_id = ? AND translation_status = 'published'
           ORDER BY locale ASC`
        )
          .bind(canonicalId)
          .all();

        return jsonResponse(
          {
            success: true,
            anime_id: canonicalId,
            translation: (allRes.results || [])[0] || null,
            translations: allRes.results || [],
          },
          200,
          request,
          { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' }
        );
      } catch (tableErr) {
        if (isMissingTranslationsTableError(tableErr)) {
          return jsonResponse(
            { success: true, anime_id: canonicalId, translation: null, translations: [] },
            200,
            request
          );
        }
        throw tableErr;
      }
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // 2. ADMIN LIST & COVERAGE: GET /api/admin/translations
  if (path === '/api/admin/translations' && method === 'GET') {
    const auth = await requireAdminSession(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          tableReady: false,
          translations: [],
          coverage: [],
          totalAnime: 0,
          targetLocales: TARGET_TRANSLATION_LOCALES,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    try {
      const localeFilter = url.searchParams.get('locale');
      const statusFilter = url.searchParams.get('status');
      const animeIdFilter = url.searchParams.get('animeId');

      const animeRes = await env.DB.prepare(
        'SELECT id, title, slug, synopsis, cover_image, languages, year, status FROM anime ORDER BY popularity DESC, id DESC'
      ).all();
      const animeRows = (animeRes.results || []) as Array<{
        id: string | number;
        title?: string;
        slug?: string;
        synopsis?: string;
        cover_image?: string;
        languages?: string;
        year?: number;
        status?: string;
      }>;

      let allTranslations: AnimeTranslationRecord[] = [];
      let tableReady = true;
      try {
        let trRows: Record<string, unknown>[] = [];
        try {
          const trRes = await env.DB.prepare(
            'SELECT id, anime_id, locale, localized_title, synopsis, description, source_hash, translation_status, updated_by, updated_at FROM anime_translations ORDER BY updated_at DESC, id DESC'
          ).all();
          trRows = trRes.results || [];
        } catch {
          const trResFallback = await env.DB.prepare(
            'SELECT id, anime_id, locale, localized_title, synopsis, description, source_hash, translation_status, updated_at FROM anime_translations ORDER BY updated_at DESC, id DESC'
          ).all();
          trRows = trResFallback.results || [];
        }
        allTranslations = trRows.map((r) => {
          const updatedBy = r.updated_by ? String(r.updated_by) : null;
          const isLocked = Boolean(r.is_locked) || (updatedBy ? updatedBy.startsWith('LOCKED:') : false);
          return {
            id: Number(r.id) || undefined,
            anime_id: String(r.anime_id),
            locale: String(r.locale),
            localized_title: r.localized_title ? String(r.localized_title) : null,
            synopsis: r.synopsis ? String(r.synopsis) : null,
            description: r.description ? String(r.description) : null,
            source_hash: r.source_hash ? String(r.source_hash) : null,
            translation_status: sanitizeTranslationStatus(r.translation_status, 'draft'),
            updated_by: updatedBy,
            is_locked: isLocked,
            updated_at: r.updated_at ? String(r.updated_at) : undefined,
          };
        });
      } catch (trErr) {
        if (isMissingTranslationsTableError(trErr)) {
          tableReady = false;
          allTranslations = [];
        } else {
          throw trErr;
        }
      }

      const coverage = computeTranslationCoverage(animeRows, allTranslations);

      const filteredTranslations = allTranslations.filter((tr) => {
        if (localeFilter && localeFilter !== 'all') {
          const normLoc = normalizeTranslationLocale(localeFilter);
          if (!normLoc || tr.locale !== normLoc) return false;
        }
        if (statusFilter && statusFilter !== 'all') {
          if (tr.translation_status !== statusFilter.toLowerCase()) return false;
        }
        if (animeIdFilter && String(tr.anime_id) !== String(animeIdFilter).trim()) {
          return false;
        }
        return true;
      });

      const animeSourceHashes: Record<string, string> = {};
      for (const a of animeRows) {
        animeSourceHashes[String(a.id)] = computeSourceHash(a.title, a.synopsis);
      }

      return jsonResponse(
        {
          success: true,
          tableReady,
          translations: filteredTranslations,
          coverage,
          totalAnime: animeRows.length,
          animeSourceHashes,
          targetLocales: TARGET_TRANSLATION_LOCALES,
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

  // 3. ADMIN UPSERT: POST /api/admin/translations OR PUT /api/admin/translations/:animeId/:locale
  const adminItemMatch = path.match(
    /^\/api\/admin\/translations\/([0-9a-zA-Z_-]+)\/([a-zA-Z_-]+)\/?$/
  );
  if (
    (path === '/api/admin/translations' && method === 'POST') ||
    (adminItemMatch && (method === 'PUT' || method === 'POST'))
  ) {
    const auth = await requireAdminSession(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Cloudflare D1 database not configured' }, 503, request);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON request body.' }, 400, request);
    }

    const validated = validateTranslationPayload(
      body,
      adminItemMatch ? decodeURIComponent(adminItemMatch[1]) : undefined,
      adminItemMatch ? decodeURIComponent(adminItemMatch[2]) : undefined
    );
    if (!validated.ok) {
      return jsonResponse({ success: false, error: validated.error }, 400, request, {
        'Cache-Control': 'no-store',
      });
    }

    const { anime_id, locale, localized_title, synopsis, description, translation_status } =
      validated.data;
    const requestedLock = body.is_locked !== undefined ? Boolean(body.is_locked) : undefined;

    try {
      // Verify the target anime exists and compute canonical English source_hash without touching anime row
      const animeRow = await env.DB.prepare(
        'SELECT id, title, synopsis FROM anime WHERE id = ? OR slug = ? LIMIT 1'
      )
        .bind(anime_id, anime_id)
        .first();

      if (!animeRow) {
        return jsonResponse(
          { success: false, error: `Anime "${anime_id}" not found in catalog.` },
          404,
          request,
          { 'Cache-Control': 'no-store' }
        );
      }

      const canonicalAnimeId = String(animeRow.id);
      const sourceHash = computeSourceHash(animeRow.title, animeRow.synopsis);
      const actorTag = requestedLock
        ? `LOCKED:${auth.session.email || auth.session.userId || 'admin'}`
        : auth.session.email || auth.session.userId || 'admin';

      try {
        await env.DB.prepare(
          `INSERT INTO anime_translations (anime_id, locale, localized_title, synopsis, description, source_hash, translation_status, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(anime_id, locale) DO UPDATE SET
             localized_title = excluded.localized_title,
             synopsis = excluded.synopsis,
             description = excluded.description,
             source_hash = excluded.source_hash,
             translation_status = excluded.translation_status,
             updated_by = excluded.updated_by,
             updated_at = datetime('now')`
        )
          .bind(
            canonicalAnimeId,
            locale,
            localized_title,
            synopsis,
            description,
            sourceHash,
            translation_status,
            actorTag
          )
          .run();
      } catch {
        await env.DB.prepare(
          `INSERT INTO anime_translations (anime_id, locale, localized_title, synopsis, description, source_hash, translation_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(anime_id, locale) DO UPDATE SET
             localized_title = excluded.localized_title,
             synopsis = excluded.synopsis,
             description = excluded.description,
             source_hash = excluded.source_hash,
             translation_status = excluded.translation_status,
             updated_at = datetime('now')`
        )
          .bind(
            canonicalAnimeId,
            locale,
            localized_title,
            synopsis,
            description,
            sourceHash,
            translation_status
          )
          .run();
      }

      const saved = await env.DB.prepare(
        'SELECT id, anime_id, locale, localized_title, synopsis, description, source_hash, translation_status, updated_at FROM anime_translations WHERE anime_id = ? AND locale = ? LIMIT 1'
      )
        .bind(canonicalAnimeId, locale)
        .first();

      return jsonResponse(
        {
          success: true,
          translation: saved
            ? {
                ...saved,
                updated_by: actorTag,
                is_locked: actorTag.startsWith('LOCKED:'),
              }
            : null,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      if (isMissingTranslationsTableError(err)) {
        return jsonResponse(
          {
            success: false,
            code: 'MIGRATION_REQUIRED',
            error:
              'The anime_translations table is not migrated yet. Apply migrations/002_anime_translations.sql first.',
          },
          503,
          request,
          { 'Cache-Control': 'no-store' }
        );
      }
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request, {
        'Cache-Control': 'no-store',
      });
    }
  }

  // 4. ADMIN QUICK STATUS UPDATE: PATCH /api/admin/translations/:animeId/:locale/status
  const statusPatchMatch = path.match(
    /^\/api\/admin\/translations\/([0-9a-zA-Z_-]+)\/([a-zA-Z_-]+)\/status\/?$/
  );
  if (statusPatchMatch && method === 'PATCH') {
    const auth = await requireAdminSession(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Cloudflare D1 database not configured' }, 503, request);
    }

    const animeId = decodeURIComponent(statusPatchMatch[1]).trim();
    const locale = normalizeTranslationLocale(decodeURIComponent(statusPatchMatch[2]));
    if (!locale || locale === 'en') {
      return jsonResponse({ success: false, error: 'Invalid target locale.' }, 400, request);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON body.' }, 400, request);
    }

    const rawStatus = String(body.translation_status ?? body.status ?? '').trim().toLowerCase();
    if (rawStatus !== 'draft' && rawStatus !== 'reviewed' && rawStatus !== 'published') {
      return jsonResponse(
        { success: false, error: "translation_status must be 'draft', 'reviewed', or 'published'." },
        400,
        request
      );
    }

    try {
      const existing = await env.DB.prepare(
        'SELECT id, synopsis, description FROM anime_translations WHERE anime_id = ? AND locale = ? LIMIT 1'
      )
        .bind(animeId, locale)
        .first();

      if (!existing) {
        return jsonResponse({ success: false, error: 'Translation record not found.' }, 404, request);
      }

      if (rawStatus === 'published' && !existing.synopsis && !existing.description) {
        return jsonResponse(
          { success: false, error: 'Cannot publish a translation without a synopsis or description.' },
          400,
          request
        );
      }

      await env.DB.prepare(
        "UPDATE anime_translations SET translation_status = ?, updated_at = datetime('now') WHERE anime_id = ? AND locale = ?"
      )
        .bind(rawStatus, animeId, locale)
        .run();

      const updated = await env.DB.prepare(
        'SELECT id, anime_id, locale, localized_title, synopsis, description, source_hash, translation_status, updated_at FROM anime_translations WHERE anime_id = ? AND locale = ? LIMIT 1'
      )
        .bind(animeId, locale)
        .first();

      return jsonResponse({ success: true, translation: updated }, 200, request, {
        'Cache-Control': 'no-store',
      });
    } catch (err) {
      if (isMissingTranslationsTableError(err)) {
        return jsonResponse(
          {
            success: false,
            code: 'MIGRATION_REQUIRED',
            error: 'Apply migrations/002_anime_translations.sql before updating translation status.',
          },
          503,
          request
        );
      }
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // 5. ADMIN DELETE TRANSLATION ONLY: DELETE /api/admin/translations/:animeId/:locale
  if (adminItemMatch && method === 'DELETE') {
    const auth = await requireAdminSession(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Cloudflare D1 database not configured' }, 503, request);
    }

    const animeId = decodeURIComponent(adminItemMatch[1]).trim();
    const locale = normalizeTranslationLocale(decodeURIComponent(adminItemMatch[2]));
    if (!locale || locale === 'en') {
      return jsonResponse({ success: false, error: 'Invalid target locale.' }, 400, request);
    }

    try {
      await env.DB.prepare(
        'DELETE FROM anime_translations WHERE anime_id = ? AND locale = ?'
      )
        .bind(animeId, locale)
        .run();

      return jsonResponse(
        { success: true, deleted: { anime_id: animeId, locale } },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      if (isMissingTranslationsTableError(err)) {
        return jsonResponse({ success: true, deleted: { anime_id: animeId, locale } }, 200, request);
      }
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  return null;
}
