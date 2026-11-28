/**
 * Cloudflare Pages / Worker API Routes for AniDub India — Admin Dashboard 2.0
 * (Phase 3: Intelligence, Universe/Cast Ops & Backup Scale)
 *
 * Public Privacy-Safe Telemetry Endpoint:
 * - POST   /api/analytics/event
 *
 * Strictly Protected Clerk Admin Endpoints (401 / 403 enforced via getAdminAuth):
 * - GET    /api/admin/franchises(?franchiseKey=...)
 * - PUT    /api/admin/franchises/:franchiseKey
 * - DELETE /api/admin/franchises/:franchiseKey/:animeId
 * - GET    /api/admin/cast(?animeId=...&lang=...)
 * - POST   /api/admin/cast
 * - PUT    /api/admin/cast/:id
 * - PATCH  /api/admin/cast/:id
 * - DELETE /api/admin/cast/:id
 * - GET    /api/admin/analytics/demand(?timeframe=today|7d|30d|90d)
 * - GET    /api/admin/backup/stats
 * - GET    /api/admin/backup/export-csv
 * - GET    /api/admin/backup/export-json
 * - POST   /api/admin/backup/validate
 */

import { getAdminAuth } from '../../utils/auth';
import {
  DUB_MATRIX_LANGUAGES,
  languageCodeToName,
  scanCatalogDataHealth,
} from '../../utils/adminOpsPro';
import {
  CAST_SUPPORTED_LANGUAGES,
  CONTENT_BACKUP_SCHEMA_VERSION,
  CORE_CONTENT_BACKUP_TABLES,
  computeOttPerformanceCtr,
  normalizeCastLanguage,
  normalizeFranchiseKey,
  validateAdminCastPayload,
  validateContentBackupBundle,
  validateContentDemandEvent,
  validateFranchiseEntryInput,
  type AdminCastEntry,
  type AdminFranchiseEntry,
  type CoreContentBackupTable,
} from '../../utils/adminPhase3Intelligence';
import { parseLanguageArray } from '../../types';
import { computeHighDemandMissingDubs } from '../../utils/adminPhase35Polish';
import { recordAdminActivityLog } from './adminOpsProRoutes';
import { archiveEntityToRecycleBin } from './adminPhase35Routes';
import {
  getErrorMessage,
  isMissingColumnError,
  type D1DatabaseLike,
  type RouteContext,
} from './shared';

async function requireStrictAdmin(ctx: RouteContext) {
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
          error: 'Forbidden: Only authorized administrators can access this endpoint',
        },
        403,
        ctx.request,
        { 'Cache-Control': 'no-store' }
      ),
    };
  }
  return { ok: true as const, session };
}

function isMissingPhase3TableError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase();
  return (
    msg.includes('no such table: content_demand_events') ||
    msg.includes('no such table: anime_franchise_links') ||
    msg.includes('no such table: anime_cast_entries') ||
    msg.includes('no such table: anime_dub_matrix') ||
    msg.includes('no such table: anime_translations') ||
    msg.includes('no such table: dub_reviews') ||
    msg.includes('no such table')
  );
}

async function ensureFranchiseLinksTable(_db: D1DatabaseLike): Promise<void> {
  // Handled by migrations/003_anime_details_v2.sql
}

async function ensureCastEntriesTable(_db: D1DatabaseLike): Promise<void> {
  // Handled by migrations/003_anime_details_v2.sql
}

async function ensureContentDemandEventsTable(_db: D1DatabaseLike): Promise<void> {
  // Handled by migrations/005_admin_intelligence_scale.sql
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function handleAdminPhase3Routes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // ===========================================================================
  // 1. PUBLIC PRIVACY-SAFE TELEMETRY: POST /api/analytics/event
  // ===========================================================================
  if (path === '/api/analytics/event' && method === 'POST') {
    let rawBody: Record<string, unknown> = {};
    try {
      const contentType = (request.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        rawBody = ((await request.json().catch(() => null)) || {}) as Record<string, unknown>;
      } else {
        const text = await request.text().catch(() => '');
        if (text.trim()) {
          rawBody = (JSON.parse(text) || {}) as Record<string, unknown>;
        }
      }
    } catch {
      return jsonResponse(
        { success: false, error: 'Malformed JSON payload.' },
        400,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    const validation = validateContentDemandEvent(rawBody);
    if (!validation.ok) {
      return jsonResponse(
        { success: false, error: validation.error },
        400,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    if (env.DB) {
      const ev = validation.data;
      const insertSql = `INSERT INTO content_demand_events (
        event_type, anime_id, query_text, language_code, platform_name, result_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;

      try {
        await env.DB.prepare(insertSql)
          .bind(
            ev.event_type,
            ev.anime_id,
            ev.query_text,
            ev.language_code,
            ev.platform_name,
            ev.result_count
          )
          .run();
      } catch (err) {
        if (isMissingPhase3TableError(err)) {
          try {
            await ensureContentDemandEventsTable(env.DB);
            await env.DB.prepare(insertSql)
              .bind(
                ev.event_type,
                ev.anime_id,
                ev.query_text,
                ev.language_code,
                ev.platform_name,
                ev.result_count
              )
              .run();
          } catch {
            // Silently ignore if D1 is read-only or not yet migrated
          }
        }
      }
    }

    return jsonResponse(
      { success: true, recorded: true },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  // ===========================================================================
  // 2. ANIME UNIVERSE & SMART WATCH ORDER VISUAL BUILDER:
  //    - GET    /api/admin/franchises(?franchiseKey=...)
  //    - PUT    /api/admin/franchises/:franchiseKey
  //    - DELETE /api/admin/franchises/:franchiseKey/:animeId
  // ===========================================================================
  if (path === '/api/admin/franchises' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const filterKey = normalizeFranchiseKey(url.searchParams.get('franchiseKey') || '');

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          tableReady: false,
          franchises: [],
          entries: [],
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    try {
      let tableReady = true;
      let franchiseSummaries: Array<{ franchise_key: string; entry_count: number; updated_at: string }> = [];
      let entries: AdminFranchiseEntry[] = [];

      try {
        const groupRes = await env.DB.prepare(
          `SELECT franchise_key, COUNT(*) as entry_count, MAX(updated_at) as updated_at
           FROM anime_franchise_links
           GROUP BY franchise_key
           ORDER BY franchise_key ASC`
        ).all<Record<string, any>>();

        franchiseSummaries = (groupRes.results || []).map((r) => ({
          franchise_key: String(r.franchise_key || ''),
          entry_count: Number(r.entry_count) || 0,
          updated_at: String(r.updated_at || ''),
        }));

        const targetKey =
          filterKey ||
          (franchiseSummaries.length > 0 ? franchiseSummaries[0].franchise_key : '');

        if (targetKey) {
          const rowsRes = await env.DB.prepare(
            `SELECT l.id, l.franchise_key, l.anime_id, l.relation_label, l.watch_order, l.note, l.updated_at,
                    a.title, a.slug, a.cover_image, a.year, a.status, a.episodes_count, a.languages
             FROM anime_franchise_links l
             LEFT JOIN anime a ON CAST(a.id AS TEXT) = l.anime_id
             WHERE l.franchise_key = ?
             ORDER BY l.watch_order ASC, l.id ASC`
          )
            .bind(targetKey)
            .all<Record<string, any>>();

          entries = (rowsRes.results || []).map((r, idx) => ({
            id: Number(r.id),
            franchise_key: String(r.franchise_key),
            anime_id: String(r.anime_id),
            relation_label: String(r.relation_label || 'Original Series'),
            watch_order: Number(r.watch_order) || idx + 1,
            note: r.note ? String(r.note) : null,
            updated_at: r.updated_at ? String(r.updated_at) : undefined,
            title: r.title ? String(r.title) : `Anime #${r.anime_id}`,
            slug: r.slug ? String(r.slug) : undefined,
            cover_image: r.cover_image ? String(r.cover_image) : undefined,
            year: Number(r.year) > 1900 ? Number(r.year) : null,
            status: r.status ? String(r.status) : undefined,
            episodes_count: Number(r.episodes_count) > 0 ? Number(r.episodes_count) : null,
            languages: parseLanguageArray(r.languages),
          }));
        }
      } catch (err) {
        if (isMissingPhase3TableError(err)) {
          tableReady = false;
        } else {
          throw err;
        }
      }

      return jsonResponse(
        {
          success: true,
          tableReady,
          franchises: franchiseSummaries,
          selectedFranchiseKey:
            filterKey ||
            (franchiseSummaries.length > 0 ? franchiseSummaries[0].franchise_key : null),
          entries,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  const franchisePutMatch = path.match(/^\/api\/admin\/franchises\/([0-9a-zA-Z_-]+)\/?$/);
  if (franchisePutMatch && (method === 'PUT' || method === 'POST')) {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Database binding unavailable.' }, 503, request);
    }

    const franchiseKey = normalizeFranchiseKey(decodeURIComponent(franchisePutMatch[1]));
    if (!franchiseKey) {
      return jsonResponse({ success: false, error: 'Valid franchiseKey is required.' }, 400, request);
    }

    let body: Record<string, any>;
    try {
      body = (await request.json()) as Record<string, any>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON request body.' }, 400, request);
    }

    try {
      await ensureFranchiseLinksTable(env.DB);

      // Mode A: Full ordered list save (`entries: [...]`)
      if (Array.isArray(body.entries)) {
        const seenAnimeIds = new Set<string>();
        const validatedList: Array<{
          franchise_key: string;
          anime_id: string;
          relation_label: string;
          watch_order: number;
          note: string | null;
        }> = [];

        for (let i = 0; i < body.entries.length; i++) {
          const item = body.entries[i] || {};
          const check = validateFranchiseEntryInput(
            {
              franchise_key: franchiseKey,
              anime_id: item.anime_id,
              relation_label: item.relation_label,
              watch_order: i + 1,
              note: item.note,
            },
            [],
            true
          );
          if (!check.ok) {
            return jsonResponse({ success: false, error: check.error }, 400, request);
          }
          if (seenAnimeIds.has(check.data.anime_id)) {
            return jsonResponse(
              {
                success: false,
                error: `Duplicate anime_id #${check.data.anime_id} in franchise "${franchiseKey}".`,
              },
              400,
              request
            );
          }
          seenAnimeIds.add(check.data.anime_id);
          validatedList.push(check.data);
        }

        // Replace watch order cleanly for this franchise_key
        await env.DB.prepare('DELETE FROM anime_franchise_links WHERE franchise_key = ?')
          .bind(franchiseKey)
          .run();

        for (const entry of validatedList) {
          await env.DB.prepare(
            `INSERT INTO anime_franchise_links (franchise_key, anime_id, relation_label, watch_order, note, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`
          )
            .bind(
              entry.franchise_key,
              entry.anime_id,
              entry.relation_label,
              entry.watch_order,
              entry.note
            )
            .run();
        }

        await recordAdminActivityLog(env.DB, {
          actor_id: auth.session.userId,
          actor_email: auth.session.email,
          action: 'SAVE_FRANCHISE_WATCH_ORDER',
          entity_type: 'anime_franchise_links',
          entity_id: franchiseKey,
          summary: `Updated Smart Watch Order for franchise "${franchiseKey}" (${validatedList.length} entries).`,
          diff_json: { franchiseKey, entries: validatedList },
        });

        return jsonResponse(
          {
            success: true,
            franchiseKey,
            updatedCount: validatedList.length,
          },
          200,
          request,
          { 'Cache-Control': 'no-store' }
        );
      }

      // Mode B: Add or update a single entry
      const existingRes = await env.DB.prepare(
        'SELECT franchise_key, anime_id FROM anime_franchise_links WHERE franchise_key = ? ORDER BY watch_order ASC'
      )
        .bind(franchiseKey)
        .all<{ franchise_key: string; anime_id: string }>()
        .catch(() => ({ results: [] }));

      const existingEntries = existingRes.results || [];
      const allowOverwrite = Boolean(body.allowOverwrite);

      const check = validateFranchiseEntryInput(
        {
          franchise_key: franchiseKey,
          anime_id: body.anime_id,
          relation_label: body.relation_label,
          watch_order: body.watch_order ?? existingEntries.length + 1,
          note: body.note,
        },
        existingEntries,
        allowOverwrite
      );

      if (!check.ok) {
        return jsonResponse({ success: false, error: check.error }, 400, request);
      }

      const d = check.data;
      await env.DB.prepare(
        `INSERT INTO anime_franchise_links (franchise_key, anime_id, relation_label, watch_order, note, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(franchise_key, anime_id) DO UPDATE SET
           relation_label = excluded.relation_label,
           watch_order = excluded.watch_order,
           note = excluded.note,
           updated_at = datetime('now')`
      )
        .bind(d.franchise_key, d.anime_id, d.relation_label, d.watch_order, d.note)
        .run();

      await recordAdminActivityLog(env.DB, {
        actor_id: auth.session.userId,
        actor_email: auth.session.email,
        action: 'ADD_FRANCHISE_LINK',
        entity_type: 'anime_franchise_links',
        entity_id: `${d.franchise_key}:${d.anime_id}`,
        summary: `Added anime #${d.anime_id} (${d.relation_label}, #${d.watch_order}) to franchise "${d.franchise_key}".`,
        diff_json: d,
      });

      return jsonResponse(
        {
          success: true,
          entry: d,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  const franchiseDelMatch = path.match(
    /^\/api\/admin\/franchises\/([0-9a-zA-Z_-]+)\/([0-9a-zA-Z_-]+)\/?$/
  );
  if (franchiseDelMatch && method === 'DELETE') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Database binding unavailable.' }, 503, request);
    }

    const franchiseKey = normalizeFranchiseKey(decodeURIComponent(franchiseDelMatch[1]));
    const animeId = decodeURIComponent(franchiseDelMatch[2]).trim();

    try {
      const existingFr = await env.DB.prepare(
        'SELECT * FROM anime_franchise_links WHERE franchise_key = ? AND anime_id = ? LIMIT 1'
      )
        .bind(franchiseKey, animeId)
        .first<Record<string, unknown>>()
        .catch(() => null);

      let recycleBinId: number | null = null;
      if (existingFr) {
        recycleBinId = await archiveEntityToRecycleBin(env.DB, {
          entity_type: 'anime_franchise_links',
          entity_id: String(existingFr.id ?? `${franchiseKey}:${animeId}`),
          title: `Franchise link ${franchiseKey} → Anime #${animeId}`,
          payload: existingFr,
          deleted_by: auth.session.email || auth.session.userId || 'admin',
        });
      }

      await env.DB.prepare(
        'DELETE FROM anime_franchise_links WHERE franchise_key = ? AND anime_id = ?'
      )
        .bind(franchiseKey, animeId)
        .run();

      // Re-normalize remaining watch_order integers 1..N
      const remRes = await env.DB.prepare(
        'SELECT id FROM anime_franchise_links WHERE franchise_key = ? ORDER BY watch_order ASC, id ASC'
      )
        .bind(franchiseKey)
        .all<{ id: number }>()
        .catch(() => ({ results: [] }));

      const remaining = remRes.results || [];
      for (let i = 0; i < remaining.length; i++) {
        await env.DB.prepare(
          "UPDATE anime_franchise_links SET watch_order = ?, updated_at = datetime('now') WHERE id = ?"
        )
          .bind(i + 1, remaining[i].id)
          .run();
      }

      await recordAdminActivityLog(env.DB, {
        actor_id: auth.session.userId,
        actor_email: auth.session.email,
        action: 'DELETE_FRANCHISE_LINK',
        entity_type: 'anime_franchise_links',
        entity_id: `${franchiseKey}:${animeId}`,
        summary: `Soft-deleted anime #${animeId} from franchise "${franchiseKey}" into Recycle Bin.`,
      });

      return jsonResponse(
        { success: true, franchiseKey, deletedAnimeId: animeId, recycleBinId },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // ===========================================================================
  // 3. CHARACTERS & INDIAN / JAPANESE VOICE ACTOR MANAGER (`anime_cast_entries`):
  //    - GET    /api/admin/cast(?animeId=...&lang=...)
  //    - POST   /api/admin/cast
  //    - PUT    /api/admin/cast/:id
  //    - PATCH  /api/admin/cast/:id
  //    - DELETE /api/admin/cast/:id
  // ===========================================================================
  if (path === '/api/admin/cast' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const animeIdFilter = (url.searchParams.get('animeId') || '').trim();
    const langFilter = normalizeCastLanguage(url.searchParams.get('lang') || '');

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          tableReady: false,
          entries: [],
          supportedLanguages: CAST_SUPPORTED_LANGUAGES,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    try {
      let tableReady = true;
      let entries: AdminCastEntry[] = [];

      try {
        let rows: Array<Record<string, any>> = [];
        if (animeIdFilter) {
          const res = await env.DB.prepare(
            `SELECT id, anime_id, character_name, role, voice_actor_name, dub_language,
                    character_image, actor_image, verified, updated_at
             FROM anime_cast_entries
             WHERE anime_id = ?
             ORDER BY CASE WHEN LOWER(role) = 'main' THEN 0 ELSE 1 END, character_name ASC, dub_language ASC`
          )
            .bind(animeIdFilter)
            .all<Record<string, any>>();
          rows = res.results || [];
        } else {
          const res = await env.DB.prepare(
            `SELECT id, anime_id, character_name, role, voice_actor_name, dub_language,
                    character_image, actor_image, verified, updated_at
             FROM anime_cast_entries
             ORDER BY updated_at DESC, id DESC LIMIT 200`
          ).all<Record<string, any>>();
          rows = res.results || [];
        }

        entries = rows
          .map((r) => ({
            id: Number(r.id),
            anime_id: String(r.anime_id),
            character_name: String(r.character_name || ''),
            role: (String(r.role || 'Main').toLowerCase() === 'supporting'
              ? 'Supporting'
              : 'Main') as 'Main' | 'Supporting',
            voice_actor_name: String(r.voice_actor_name || ''),
            dub_language: normalizeCastLanguage(r.dub_language) || String(r.dub_language || ''),
            character_image: r.character_image ? String(r.character_image) : null,
            actor_image: r.actor_image ? String(r.actor_image) : null,
            verified: Number(r.verified) === 1 || r.verified === true,
            updated_at: r.updated_at ? String(r.updated_at) : undefined,
          }))
          .filter((e) =>
            langFilter && langFilter.toLowerCase() !== 'all'
              ? e.dub_language.toLowerCase() === langFilter.toLowerCase()
              : true
          );
      } catch (err) {
        if (isMissingPhase3TableError(err)) {
          tableReady = false;
        } else {
          throw err;
        }
      }

      return jsonResponse(
        {
          success: true,
          tableReady,
          entries,
          supportedLanguages: CAST_SUPPORTED_LANGUAGES,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  if (path === '/api/admin/cast' && method === 'POST') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Database binding unavailable.' }, 503, request);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON request body.' }, 400, request);
    }

    const validation = validateAdminCastPayload(body);
    if (!validation.ok) {
      return jsonResponse({ success: false, error: validation.error }, 400, request);
    }

    try {
      await ensureCastEntriesTable(env.DB);
      const d = validation.data;

      const info = await env.DB.prepare(
        `INSERT INTO anime_cast_entries (
          anime_id, character_name, role, voice_actor_name, dub_language,
          character_image, actor_image, verified, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          d.anime_id,
          d.character_name,
          d.role,
          d.voice_actor_name,
          d.dub_language,
          d.character_image,
          d.actor_image,
          d.verified
        )
        .run();

      const insertedId = Number(info?.meta?.last_row_id || 0);

      await recordAdminActivityLog(env.DB, {
        actor_id: auth.session.userId,
        actor_email: auth.session.email,
        action: 'CREATE_CAST_ENTRY',
        entity_type: 'anime_cast_entries',
        entity_id: insertedId || `${d.anime_id}:${d.character_name}`,
        summary: `Added ${d.dub_language} voice actor "${d.voice_actor_name}" for character "${d.character_name}" (Anime #${d.anime_id}, verified=${Boolean(d.verified)}).`,
        diff_json: d,
      });

      return jsonResponse(
        {
          success: true,
          entry: {
            id: insertedId,
            ...d,
            verified: Boolean(d.verified),
          },
        },
        201,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  const castItemMatch = path.match(/^\/api\/admin\/cast\/(\d+)\/?$/);
  if (castItemMatch && (method === 'PUT' || method === 'PATCH')) {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Database binding unavailable.' }, 503, request);
    }

    const castId = Number(castItemMatch[1]);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON request body.' }, 400, request);
    }

    try {
      await ensureCastEntriesTable(env.DB);

      // Quick toggle of verified status when only { verified } is sent via PATCH
      if (
        method === 'PATCH' &&
        body.verified !== undefined &&
        body.character_name === undefined &&
        body.voice_actor_name === undefined
      ) {
        const verifiedInt = body.verified === true || body.verified === 1 ? 1 : 0;
        await env.DB.prepare(
          "UPDATE anime_cast_entries SET verified = ?, updated_at = datetime('now') WHERE id = ?"
        )
          .bind(verifiedInt, castId)
          .run();

        await recordAdminActivityLog(env.DB, {
          actor_id: auth.session.userId,
          actor_email: auth.session.email,
          action: verifiedInt ? 'VERIFY_CAST_ENTRY' : 'UNVERIFY_CAST_ENTRY',
          entity_type: 'anime_cast_entries',
          entity_id: castId,
          summary: `Marked cast entry #${castId} as ${verifiedInt ? 'Verified' : 'Unverified'}.`,
        });

        return jsonResponse(
          { success: true, id: castId, verified: Boolean(verifiedInt) },
          200,
          request,
          { 'Cache-Control': 'no-store' }
        );
      }

      const existing = await env.DB.prepare(
        'SELECT * FROM anime_cast_entries WHERE id = ? LIMIT 1'
      )
        .bind(castId)
        .first<Record<string, any>>();

      const merged = {
        ...(existing || {}),
        ...body,
      };
      const validation = validateAdminCastPayload(merged);
      if (!validation.ok) {
        return jsonResponse({ success: false, error: validation.error }, 400, request);
      }

      const d = validation.data;
      await env.DB.prepare(
        `UPDATE anime_cast_entries
         SET character_name = ?,
             role = ?,
             voice_actor_name = ?,
             dub_language = ?,
             character_image = ?,
             actor_image = ?,
             verified = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          d.character_name,
          d.role,
          d.voice_actor_name,
          d.dub_language,
          d.character_image,
          d.actor_image,
          d.verified,
          castId
        )
        .run();

      await recordAdminActivityLog(env.DB, {
        actor_id: auth.session.userId,
        actor_email: auth.session.email,
        action: 'UPDATE_CAST_ENTRY',
        entity_type: 'anime_cast_entries',
        entity_id: castId,
        summary: `Updated ${d.dub_language} voice actor "${d.voice_actor_name}" for "${d.character_name}" (verified=${Boolean(d.verified)}).`,
        diff_json: d,
      });

      return jsonResponse(
        {
          success: true,
          entry: {
            id: castId,
            ...d,
            verified: Boolean(d.verified),
          },
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  if (castItemMatch && method === 'DELETE') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Database binding unavailable.' }, 503, request);
    }

    const castId = Number(castItemMatch[1]);
    try {
      const existingCast = await env.DB.prepare('SELECT * FROM anime_cast_entries WHERE id = ? LIMIT 1')
        .bind(castId)
        .first<Record<string, unknown>>()
        .catch(() => null);

      let recycleBinId: number | null = null;
      if (existingCast) {
        recycleBinId = await archiveEntityToRecycleBin(env.DB, {
          entity_type: 'anime_cast_entries',
          entity_id: castId,
          title: `${existingCast.character_name || 'Character'} — ${existingCast.voice_actor_name || 'Voice Actor'} (${existingCast.dub_language || existingCast.language || 'Dub'})`,
          payload: existingCast,
          deleted_by: auth.session.email || auth.session.userId || 'admin',
        });
      }

      await env.DB.prepare('DELETE FROM anime_cast_entries WHERE id = ?').bind(castId).run();

      await recordAdminActivityLog(env.DB, {
        actor_id: auth.session.userId,
        actor_email: auth.session.email,
        action: 'DELETE_CAST_ENTRY',
        entity_type: 'anime_cast_entries',
        entity_id: castId,
        summary: `Soft-deleted cast/voice actor entry #${castId} into Recycle Bin.`,
      });

      return jsonResponse(
        { success: true, deletedId: castId, recycleBinId },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // ===========================================================================
  // 4. ACTIONABLE ADMIN ANALYTICS 2.0 (REAL CONTENT DEMAND INTELLIGENCE):
  //    - GET /api/admin/analytics/demand?timeframe=today|7d|30d|90d
  // ===========================================================================
  if (path === '/api/admin/analytics/demand' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const rawTimeframe = (url.searchParams.get('timeframe') || '30d').trim().toLowerCase();
    const timeframe = ['today', '7d', '30d', '90d'].includes(rawTimeframe)
      ? (rawTimeframe as 'today' | '7d' | '30d' | '90d')
      : '30d';

    let sqlDateClause = "created_at >= datetime('now', '-30 days')";
    if (timeframe === 'today') {
      sqlDateClause = "date(created_at) = date('now')";
    } else if (timeframe === '7d') {
      sqlDateClause = "created_at >= datetime('now', '-7 days')";
    } else if (timeframe === '90d') {
      sqlDateClause = "created_at >= datetime('now', '-90 days')";
    }

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          tableReady: false,
          timeframe,
          missingSearches: [],
          languageDemand: DUB_MATRIX_LANGUAGES.filter((l) => l.primary).map((l) => ({
            code: l.code,
            language: l.name,
            nativeName: l.nativeName,
            eventCount: 0,
            sharePercent: 0,
          })),
          ottPerformance: [],
          completenessGaps: {
            totalScanned: 0,
            flaggedCount: 0,
            healthyCount: 0,
            countsByCategory: {
              missing_artwork: 0,
              missing_synopsis: 0,
              duplicate_titles: 0,
              inconsistent_episodes: 0,
              unverified_dubs: 0,
              stale_verification: 0,
              missing_translations: 0,
            },
          },
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    try {
      let tableReady = true;
      let missingSearches: Array<{
        queryText: string;
        searchCount: number;
        lastSearchedAt: string;
      }> = [];
      let rawLangDemandRows: Array<{ language_code: string; count: number }> = [];
      let rawOttRows: Array<{
        platform_name: string;
        event_type: string;
        count: number;
      }> = [];

      try {
        const [missingRes, langRes, ottRes] = await Promise.all([
          env.DB.prepare(
            `SELECT LOWER(TRIM(query_text)) as norm_query,
                    MAX(TRIM(query_text)) as display_query,
                    COUNT(*) as search_count,
                    MAX(created_at) as last_searched_at
             FROM content_demand_events
             WHERE event_type = 'search_query'
               AND (result_count = 0 OR result_count IS NULL)
               AND query_text IS NOT NULL
               AND TRIM(query_text) != ''
               AND ${sqlDateClause}
             GROUP BY LOWER(TRIM(query_text))
             ORDER BY search_count DESC, last_searched_at DESC
             LIMIT 15`
          ).all<Record<string, any>>(),
          env.DB.prepare(
            `SELECT LOWER(TRIM(language_code)) as language_code, COUNT(*) as count
             FROM content_demand_events
             WHERE language_code IS NOT NULL
               AND TRIM(language_code) != ''
               AND ${sqlDateClause}
             GROUP BY LOWER(TRIM(language_code))
             ORDER BY count DESC`
          ).all<{ language_code: string; count: number }>(),
          env.DB.prepare(
            `SELECT TRIM(platform_name) as platform_name, event_type, COUNT(*) as count
             FROM content_demand_events
             WHERE event_type IN ('ott_impression', 'ott_click')
               AND platform_name IS NOT NULL
               AND TRIM(platform_name) != ''
               AND ${sqlDateClause}
             GROUP BY TRIM(platform_name), event_type`
          ).all<{ platform_name: string; event_type: string; count: number }>(),
        ]);

        missingSearches = (missingRes.results || []).map((r) => ({
          queryText: String(r.display_query || r.norm_query || ''),
          searchCount: Number(r.search_count) || 0,
          lastSearchedAt: String(r.last_searched_at || ''),
        }));
        rawLangDemandRows = langRes.results || [];
        rawOttRows = ottRes.results || [];
      } catch (err) {
        if (isMissingPhase3TableError(err)) {
          tableReady = false;
        } else {
          throw err;
        }
      }

      // Compute Regional Dub Language Demand across the 6 primary Indian languages
      const primaryLanguages = DUB_MATRIX_LANGUAGES.filter((l) => l.primary);
      const countByCode = new Map<string, number>();
      for (const r of rawLangDemandRows) {
        const name = languageCodeToName(r.language_code);
        const matched = primaryLanguages.find(
          (l) =>
            l.code.toLowerCase() === r.language_code.toLowerCase() ||
            l.name.toLowerCase() === name.toLowerCase()
        );
        if (matched) {
          countByCode.set(
            matched.code,
            (countByCode.get(matched.code) || 0) + (Number(r.count) || 0)
          );
        }
      }
      const totalLangEvents = Array.from(countByCode.values()).reduce((a, b) => a + b, 0);
      const languageDemand = primaryLanguages.map((l) => {
        const count = countByCode.get(l.code) || 0;
        const sharePercent =
          totalLangEvents > 0 ? Math.round((count / totalLangEvents) * 1000) / 10 : 0;
        return {
          code: l.code,
          language: l.name,
          nativeName: l.nativeName,
          eventCount: count,
          sharePercent,
        };
      });

      // Compute OTT Performance & CTR (OTT Clicks / OTT Impressions * 100)
      const ottMap = new Map<
        string,
        { platform: string; impressions: number; clicks: number }
      >();
      for (const r of rawOttRows) {
        const pName = String(r.platform_name || '').trim();
        if (!pName) continue;
        const key = pName.toLowerCase();
        const curr = ottMap.get(key) || { platform: pName, impressions: 0, clicks: 0 };
        if (r.event_type === 'ott_impression') {
          curr.impressions += Number(r.count) || 0;
        } else if (r.event_type === 'ott_click') {
          curr.clicks += Number(r.count) || 0;
        }
        ottMap.set(key, curr);
      }

      const ottPerformance = Array.from(ottMap.values())
        .map((item) => {
          const ctr = computeOttPerformanceCtr(item.clicks, item.impressions);
          return {
            platform: item.platform,
            impressions: item.impressions,
            clicks: item.clicks,
            ctrPercent: ctr.ctrPercent,
            ctrDisplay: ctr.display,
          };
        })
        .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

      // Compute real Catalog Completeness Gaps from D1 catalog
      let animeRows: Array<Record<string, any>> = [];
      try {
        const res = await env.DB.prepare(
          `SELECT id, title, slug, synopsis, cover_image, banner_image, status, airing_status,
                  episodes_count, episodes_per_season, season_episode_count, languages,
                  platform, platforms_data, watch_url, official_source_url, last_verified_at
           FROM anime
           WHERE (is_published = 1 OR is_published = true) AND LOWER(COALESCE(status, '')) != 'pending'`
        ).all();
        animeRows = res.results || [];
      } catch (colErr) {
        if (!isMissingColumnError(colErr)) throw colErr;
        const fallback = await env.DB.prepare(
          'SELECT id, title, slug, synopsis, cover_image, banner_image, status, episodes_count, languages, platform, watch_url FROM anime'
        ).all();
        animeRows = fallback.results || [];
      }

      const [trRes, dmRes, animeDemandRes] = await Promise.all([
        env.DB.prepare('SELECT anime_id, locale, translation_status FROM anime_translations')
          .all<{ anime_id: string; locale: string; translation_status: string }>()
          .catch(() => ({ results: [] })),
        env.DB.prepare('SELECT anime_id, language, availability_status, verified_at, verified, status FROM anime_dub_matrix')
          .all<Record<string, any>>()
          .catch(async () => {
            return env.DB!.prepare('SELECT anime_id, language, availability_status, verified_at FROM anime_dub_matrix')
              .all<Record<string, any>>()
              .catch(() => ({ results: [] }));
          }),
        env.DB.prepare(
          `SELECT anime_id,
                  SUM(CASE WHEN event_type = 'anime_detail_view' THEN 1 ELSE 0 END) as detail_views,
                  SUM(CASE WHEN event_type = 'watchlist_add' THEN 1 ELSE 0 END) as watchlist_adds,
                  SUM(CASE WHEN event_type = 'ott_click' THEN 1 ELSE 0 END) as ott_clicks,
                  SUM(CASE WHEN event_type = 'translation_request' THEN 1 ELSE 0 END) as translation_requests
           FROM content_demand_events
           WHERE anime_id IS NOT NULL
             AND TRIM(CAST(anime_id AS TEXT)) != ''
             AND ${sqlDateClause}
           GROUP BY anime_id`
        )
          .all<Record<string, any>>()
          .catch(() => ({ results: [] })),
      ]);

      const healthReport = scanCatalogDataHealth(
        animeRows,
        trRes.results || [],
        (dmRes.results || []) as any
      );

      const highDemandMissingDubs = computeHighDemandMissingDubs(
        animeRows.map((a) => ({
          id: Number(a.id),
          title: String(a.title || ''),
          slug: a.slug ? String(a.slug) : null,
          poster_url: (a.cover_image || a.poster_url) ? String(a.cover_image || a.poster_url) : null,
        })),
        (animeDemandRes.results || []).map((d) => ({
          anime_id: Number(d.anime_id),
          detail_views: Number(d.detail_views) || 0,
          watchlist_adds: Number(d.watchlist_adds) || 0,
          ott_clicks: Number(d.ott_clicks) || 0,
          translation_requests: Number(d.translation_requests) || 0,
        })),
        (dmRes.results || []).map((m) => ({
          anime_id: Number(m.anime_id),
          language: String(m.language || ''),
          verified: Boolean(m.verified_at || Number(m.verified) === 1 || m.verified === true),
          status: String(m.availability_status || m.status || 'complete'),
        }))
      );

      return jsonResponse(
        {
          success: true,
          tableReady,
          timeframe,
          missingSearches,
          languageDemand,
          totalLanguageDemandEvents: totalLangEvents,
          ottPerformance,
          highDemandMissingDubs,
          completenessGaps: {
            totalScanned: healthReport.totalScanned,
            flaggedCount: healthReport.flaggedCount,
            healthyCount: healthReport.healthyCount,
            countsByCategory: healthReport.countsByCategory,
          },
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // ===========================================================================
  // 5. FULL BACKUP & RECOVERY CENTER:
  //    - GET  /api/admin/backup/stats
  //    - GET  /api/admin/backup/export-csv
  //    - GET  /api/admin/backup/export-json
  //    - POST /api/admin/backup/validate
  // ===========================================================================
  if (path === '/api/admin/backup/stats' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const counts: Record<CoreContentBackupTable, number> = {
      anime: 0,
      anime_dub_matrix: 0,
      anime_translations: 0,
      anime_franchise_links: 0,
      anime_cast_entries: 0,
      dub_reviews: 0,
    };
    const tableReady: Record<CoreContentBackupTable, boolean> = {
      anime: false,
      anime_dub_matrix: false,
      anime_translations: false,
      anime_franchise_links: false,
      anime_cast_entries: false,
      dub_reviews: false,
    };

    if (env.DB) {
      await Promise.all(
        CORE_CONTENT_BACKUP_TABLES.map(async (table) => {
          try {
            const row = await env.DB!.prepare(`SELECT COUNT(*) as count FROM ${table}`).first<{
              count: number;
            }>();
            counts[table] = Number(row?.count) || 0;
            tableReady[table] = true;
          } catch {
            counts[table] = 0;
            tableReady[table] = false;
          }
        })
      );
    }

    return jsonResponse(
      {
        success: true,
        schemaVersion: CONTENT_BACKUP_SCHEMA_VERSION,
        counts,
        tableReady,
      },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  if (path === '/api/admin/backup/export-csv' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    let animeRows: Array<Record<string, any>> = [];
    if (env.DB) {
      try {
        const res = await env.DB.prepare('SELECT * FROM anime ORDER BY id ASC').all<
          Record<string, any>
        >();
        animeRows = res.results || [];
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
      }
    }

    const headers = [
      'id',
      'title',
      'slug',
      'year',
      'type',
      'status',
      'studio',
      'rating',
      'episodes_count',
      'languages',
      'platform',
      'watch_url',
      'official_source_url',
      'last_verified_at',
      'cover_image',
      'banner_image',
      'genres',
      'synopsis',
    ];

    const csvLines = [headers.join(',')];
    for (const row of animeRows) {
      const line = [
        escapeCsvCell(row.id ?? ''),
        escapeCsvCell(row.title ?? ''),
        escapeCsvCell(row.slug ?? ''),
        escapeCsvCell(row.year ?? ''),
        escapeCsvCell(row.type ?? 'TV Series'),
        escapeCsvCell(row.status ?? row.airing_status ?? 'Completed'),
        escapeCsvCell(row.studio ?? ''),
        escapeCsvCell(row.rating ?? ''),
        escapeCsvCell(row.episodes_count ?? row.episodes ?? ''),
        escapeCsvCell(
          Array.isArray(row.languages) ? row.languages.join(' | ') : row.languages ?? ''
        ),
        escapeCsvCell(row.platform ?? ''),
        escapeCsvCell(row.watch_url ?? row.streamUrl ?? ''),
        escapeCsvCell(row.official_source_url ?? ''),
        escapeCsvCell(row.last_verified_at ?? ''),
        escapeCsvCell(row.cover_image ?? row.posterUrl ?? ''),
        escapeCsvCell(row.banner_image ?? row.bannerUrl ?? ''),
        escapeCsvCell(Array.isArray(row.genres) ? row.genres.join(' | ') : row.genres ?? ''),
        escapeCsvCell(row.synopsis ?? row.description ?? ''),
      ].join(',');
      csvLines.push(line);
    }

    if (env.DB) {
      await recordAdminActivityLog(env.DB, {
        actor_id: auth.session.userId,
        actor_email: auth.session.email,
        action: 'EXPORT_CATALOG_CSV',
        entity_type: 'anime',
        entity_id: 'all',
        summary: `Exported full D1 catalog CSV (${animeRows.length} rows).`,
      });
    }

    return jsonResponse(
      {
        success: true,
        rowCount: animeRows.length,
        exportedAt: new Date().toISOString(),
        csv: csvLines.join('\n'),
      },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  if (path === '/api/admin/backup/export-json' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const tables: Record<CoreContentBackupTable, Array<Record<string, any>>> = {
      anime: [],
      anime_dub_matrix: [],
      anime_translations: [],
      anime_franchise_links: [],
      anime_cast_entries: [],
      dub_reviews: [],
    };

    if (env.DB) {
      await Promise.all(
        CORE_CONTENT_BACKUP_TABLES.map(async (table) => {
          try {
            const res = await env.DB!.prepare(`SELECT * FROM ${table} ORDER BY id ASC`).all<
              Record<string, any>
            >();
            // Strip user_id from dub_reviews so zero user identifiers or credentials are included
            if (table === 'dub_reviews') {
              tables[table] = (res.results || []).map(({ user_id, ...rest }) => rest);
            } else {
              tables[table] = res.results || [];
            }
          } catch {
            tables[table] = [];
          }
        })
      );

      await recordAdminActivityLog(env.DB, {
        actor_id: auth.session.userId,
        actor_email: auth.session.email,
        action: 'EXPORT_FULL_CONTENT_JSON_BACKUP',
        entity_type: 'backup_bundle',
        entity_id: CONTENT_BACKUP_SCHEMA_VERSION,
        summary: `Exported Full Content JSON Backup (${tables.anime.length} anime, ${tables.anime_dub_matrix.length} dub matrix, ${tables.anime_translations.length} translations, ${tables.anime_franchise_links.length} franchise links, ${tables.anime_cast_entries.length} cast entries).`,
      });
    }

    const exportedAt = new Date().toISOString();
    const tableCounts: Record<CoreContentBackupTable, number> = {
      anime: tables.anime.length,
      anime_dub_matrix: tables.anime_dub_matrix.length,
      anime_translations: tables.anime_translations.length,
      anime_franchise_links: tables.anime_franchise_links.length,
      anime_cast_entries: tables.anime_cast_entries.length,
      dub_reviews: tables.dub_reviews.length,
    };

    return jsonResponse(
      {
        success: true,
        bundle: {
          schemaVersion: CONTENT_BACKUP_SCHEMA_VERSION,
          exportedAt,
          app: 'AniDub India',
          excludesPrivateCredentials: true,
          tableCounts,
          tables,
        },
      },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  if (path === '/api/admin/backup/validate' && method === 'POST') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: 'Uploaded file is not valid JSON.',
        },
        400,
        request
      );
    }

    const payload =
      body && typeof body === 'object' && 'bundle' in (body as Record<string, any>)
        ? (body as Record<string, any>).bundle
        : body;

    const report = validateContentBackupBundle(payload);
    return jsonResponse(
      {
        success: true,
        dryRun: true,
        report,
      },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  return null;
}
