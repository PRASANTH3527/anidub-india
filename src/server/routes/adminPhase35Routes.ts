import { getAdminAuth } from '../../utils/auth';
import { recordAdminActivityLog } from './adminOpsProRoutes';
import {
  getErrorMessage,
  type D1DatabaseLike,
  type RouteContext,
} from './shared';
import {
  RecycleBinEntityType,
  buildRecycleBinArchiveEntry,
  validateRecycleBinPurgeConfirmation,
  checkDailyAiUsageQuota,
} from '../../utils/adminPhase35Polish';
import {
  evaluateImdbRatingDiff,
  sanitizeRatingScore,
  redactSensitiveTokens,
  type ImdbRatingCandidate,
} from '../../utils/adminLegacyRestore';

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function ensurePhase35Tables(db: D1DatabaseLike | null | undefined): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS admin_recycle_bin (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          title TEXT,
          payload_json TEXT NOT NULL,
          deleted_by TEXT,
          deleted_at TEXT DEFAULT (datetime('now')),
          restored_at TEXT
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_recycle_bin_active ON admin_recycle_bin(entity_type, restored_at, deleted_at DESC)`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS translation_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          anime_id INTEGER NOT NULL,
          language_code TEXT NOT NULL,
          synopsis_text TEXT NOT NULL,
          source_type TEXT DEFAULT 'manual',
          saved_by TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_translation_versions_lookup ON translation_versions(anime_id, language_code, created_at DESC)`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS anime_revisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          anime_id INTEGER NOT NULL,
          revision_summary TEXT,
          snapshot_json TEXT NOT NULL,
          edited_by TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_anime_revisions_lookup ON anime_revisions(anime_id, created_at DESC)`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ai_usage_daily (
          usage_date TEXT PRIMARY KEY,
          translation_calls INTEGER DEFAULT 0,
          daily_cap INTEGER DEFAULT 100,
          updated_at TEXT DEFAULT (datetime('now'))
        )`
      )
      .run();
  } catch (e) {
    console.warn('[Phase3.5] ensurePhase35Tables fallback warning:', e);
  }
}

export async function archiveEntityToRecycleBin(
  db: D1DatabaseLike | null | undefined,
  input: {
    entity_type: RecycleBinEntityType;
    entity_id: string | number;
    title?: string | null;
    payload: unknown;
    deleted_by?: string | null;
  }
): Promise<number | null> {
  if (!db) return null;
  try {
    await ensurePhase35Tables(db);
    const entry = buildRecycleBinArchiveEntry(input);
    const res = await db
      .prepare(
        `INSERT INTO admin_recycle_bin (entity_type, entity_id, title, payload_json, deleted_by, deleted_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        entry.entity_type,
        entry.entity_id,
        entry.title,
        entry.payload_json,
        entry.deleted_by
      )
      .run();
    const insertedId = Number(res?.meta?.last_row_id || 0);
    return insertedId > 0 ? insertedId : null;
  } catch (e) {
    console.warn('[Phase3.5] Failed to archive entity to admin_recycle_bin:', e);
    return null;
  }
}

export async function recordTranslationVersion(
  db: D1DatabaseLike | null | undefined,
  input: {
    anime_id: number;
    language_code: string;
    synopsis_text: string;
    source_type?: string;
    saved_by?: string | null;
  }
): Promise<void> {
  if (!db || !input.synopsis_text || !String(input.synopsis_text).trim()) return;
  try {
    await ensurePhase35Tables(db);
    await db
      .prepare(
        `INSERT INTO translation_versions (anime_id, language_code, synopsis_text, source_type, saved_by, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        Number(input.anime_id),
        String(input.language_code).trim().toLowerCase(),
        String(input.synopsis_text),
        input.source_type || 'manual',
        input.saved_by || 'admin'
      )
      .run();
  } catch (e) {
    console.warn('[Phase3.5] recordTranslationVersion fallback warning:', e);
  }
}

export async function recordAnimeRevision(
  db: D1DatabaseLike | null | undefined,
  input: {
    anime_id: number;
    revision_summary?: string | null;
    snapshot: unknown;
    edited_by?: string | null;
  }
): Promise<void> {
  if (!db || !input.anime_id) return;
  try {
    await ensurePhase35Tables(db);
    const snapshotJson =
      typeof input.snapshot === 'string'
        ? input.snapshot
        : JSON.stringify(input.snapshot ?? {});
    await db
      .prepare(
        `INSERT INTO anime_revisions (anime_id, revision_summary, snapshot_json, edited_by, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        Number(input.anime_id),
        input.revision_summary || 'Saved anime snapshot',
        snapshotJson,
        input.edited_by || 'admin'
      )
      .run();
  } catch (e) {
    console.warn('[Phase3.5] recordAnimeRevision fallback warning:', e);
  }
}

export async function getTodayAiUsage(db: D1DatabaseLike | null | undefined): Promise<{
  usageDate: string;
  usedToday: number;
  dailyCap: number;
  remaining: number;
  allowed: boolean;
}> {
  const today = new Date().toISOString().slice(0, 10);
  if (!db) {
    return {
      usageDate: today,
      usedToday: 0,
      dailyCap: 100,
      remaining: 100,
      allowed: true,
    };
  }
  try {
    await ensurePhase35Tables(db);
    let row = await db
      .prepare(`SELECT usage_date, translation_calls, daily_cap FROM ai_usage_daily WHERE usage_date = ?`)
      .bind(today)
      .first<Record<string, unknown>>();

    let defaultCap = 100;
    if (!row) {
      const latestRow = await db
        .prepare(`SELECT daily_cap FROM ai_usage_daily ORDER BY usage_date DESC LIMIT 1`)
        .first<Record<string, unknown>>();
      if (latestRow && Number(latestRow.daily_cap) > 0) {
        defaultCap = Number(latestRow.daily_cap);
      }
      await db
        .prepare(
          `INSERT OR IGNORE INTO ai_usage_daily (usage_date, translation_calls, daily_cap, updated_at)
           VALUES (?, 0, ?, datetime('now'))`
        )
        .bind(today, defaultCap)
        .run();
      row = await db
        .prepare(`SELECT usage_date, translation_calls, daily_cap FROM ai_usage_daily WHERE usage_date = ?`)
        .bind(today)
        .first<Record<string, unknown>>();
    }

    const usedToday = Number(row?.translation_calls ?? 0);
    const dailyCap = Number(row?.daily_cap ?? defaultCap);
    const quota = checkDailyAiUsageQuota(usedToday, dailyCap);
    return {
      usageDate: today,
      ...quota,
    };
  } catch (e) {
    console.warn('[Phase3.5] getTodayAiUsage fallback warning:', e);
    return {
      usageDate: today,
      usedToday: 0,
      dailyCap: 100,
      remaining: 100,
      allowed: true,
    };
  }
}

export async function incrementTodayAiUsage(db: D1DatabaseLike | null | undefined): Promise<void> {
  if (!db) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    await getTodayAiUsage(db);
    await db
      .prepare(
        `UPDATE ai_usage_daily
         SET translation_calls = COALESCE(translation_calls, 0) + 1,
             updated_at = datetime('now')
         WHERE usage_date = ?`
      )
      .bind(today)
      .run();
  } catch (e) {
    console.warn('[Phase3.5] incrementTodayAiUsage fallback warning:', e);
  }
}

export async function handleAdminPhase35Routes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, path, method, url, jsonResponse } = ctx;

  const isPhase35Route =
    path === '/api/admin/recycle-bin' ||
    path.startsWith('/api/admin/recycle-bin/') ||
    path === '/api/admin/ai-usage' ||
    path === '/api/admin/ai-usage/cap' ||
    (path.startsWith('/api/admin/translations/') &&
      (path.endsWith('/versions') || path.endsWith('/rollback'))) ||
    (path.startsWith('/api/admin/anime/') && path.includes('/revisions')) ||
    path.startsWith('/api/admin/dub-reviews/') ||
    path === '/api/admin/imdb-ratings/check' ||
    path === '/api/admin/imdb-ratings/apply';

  if (!isPhase35Route) {
    return null;
  }

  // Strict server-side Clerk admin verification on EVERY /api/admin/* endpoint
  const session = await getAdminAuth(request, env);
  if (!session.userId) {
    return jsonResponse(
      {
        success: false,
        error: session.error || 'Unauthorized: Valid Clerk Admin session required',
      },
      401,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }
  if (!session.isAdmin) {
    return jsonResponse(
      {
        success: false,
        error: session.error || 'Forbidden: Admin privileges required',
      },
      403,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  const adminActor = session.email || session.userId || 'admin';
  await ensurePhase35Tables(env.DB);

  // =========================================================================
  // 1. RECYCLE BIN: List, 1-Click Restore, Permanent Purge
  // =========================================================================
  if (path === '/api/admin/recycle-bin' && method === 'GET') {
    const entityType = (url.searchParams.get('entity_type') || '').trim();
    const showRestored = url.searchParams.get('include_restored') === '1';

    if (!env.DB) {
      return jsonResponse({ success: true, items: [] }, 200, request);
    }

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (!showRestored) {
        conditions.push('restored_at IS NULL');
      }
      if (entityType && entityType !== 'all') {
        conditions.push('entity_type = ?');
        params.push(entityType);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const res = await env.DB.prepare(
        `SELECT id, entity_type, entity_id, title, payload_json, deleted_by, deleted_at, restored_at
         FROM admin_recycle_bin
         ${whereSql}
         ORDER BY id DESC
         LIMIT 200`
      )
        .bind(...params)
        .all<Record<string, unknown>>();

      const items = (res.results || []).map((row) => ({
        ...row,
        payload: safeJsonParse(row.payload_json, {}),
      }));

      return jsonResponse({ success: true, items }, 200, request, { 'Cache-Control': 'no-store' });
    } catch (e) {
      return jsonResponse({ success: true, items: [], warning: getErrorMessage(e) }, 200, request);
    }
  }

  const restoreMatch = path.match(/^\/api\/admin\/recycle-bin\/(\d+)\/restore$/);
  if (restoreMatch && method === 'POST') {
    if (!env.DB) {
      return jsonResponse({ error: 'D1 database binding unavailable' }, 503, request);
    }
    const binId = parseInt(restoreMatch[1], 10);
    try {
      const binRow = await env.DB.prepare(`SELECT * FROM admin_recycle_bin WHERE id = ?`)
        .bind(binId)
        .first<Record<string, unknown>>();

      if (!binRow) {
        return jsonResponse({ error: 'Recycle bin entry not found' }, 404, request);
      }
      if (binRow.restored_at) {
        return jsonResponse({ error: 'This item has already been restored' }, 400, request);
      }

      const payload = safeJsonParse<Record<string, unknown>>(binRow.payload_json, {});
      const entityType = String(binRow.entity_type) as RecycleBinEntityType;

      if (entityType === 'anime') {
        const title = String(payload.title || binRow.title || 'Restored Anime');
        const slug = String(
          payload.slug ||
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
        );

        // Try restoring using dynamic columns present in payload and anime table
        const tableInfo = await env.DB.prepare(`PRAGMA table_info(anime)`).all<Record<string, unknown>>();
        const validColumns = new Set((tableInfo.results || []).map((col) => String(col.name)));

        const insertCols: string[] = [];
        const insertVals: unknown[] = [];

        for (const [k, v] of Object.entries(payload)) {
          if (validColumns.has(k) && v !== undefined) {
            insertCols.push(k);
            insertVals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
          }
        }

        if (!insertCols.includes('title') && validColumns.has('title')) {
          insertCols.push('title');
          insertVals.push(title);
        }
        if (!insertCols.includes('slug') && validColumns.has('slug')) {
          insertCols.push('slug');
          insertVals.push(slug);
        }

        if (insertCols.length > 0) {
          const placeholders = insertCols.map(() => '?').join(', ');
          await env.DB.prepare(
            `INSERT OR REPLACE INTO anime (${insertCols.join(', ')}) VALUES (${placeholders})`
          )
            .bind(...insertVals)
            .run();
        }
      } else if (entityType === 'reviews') {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO reviews (id, anime_id, user_id, username, rating, comment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
        )
          .bind(
            payload.id ? Number(payload.id) : null,
            Number(payload.anime_id),
            String(payload.user_id || 'restored'),
            String(payload.username || payload.user_name || 'User'),
            Number(payload.rating) || 5,
            String(payload.comment || ''),
            payload.created_at || null
          )
          .run()
          .catch(async () => {
            await env.DB!.prepare(
              `INSERT OR REPLACE INTO reviews (id, anime_id, user_id, user_name, rating, comment, created_at)
               VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
            )
              .bind(
                payload.id ? Number(payload.id) : null,
                Number(payload.anime_id),
                String(payload.user_id || 'restored'),
                String(payload.user_name || payload.username || 'User'),
                Number(payload.rating) || 5,
                String(payload.comment || ''),
                payload.created_at || null
              )
              .run();
          });
      } else if (entityType === 'dub_reviews') {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO dub_reviews (
            id, anime_id, user_id, user_name, dub_language, platform,
            voice_acting_score, translation_fidelity_score, audio_mix_score,
            localization_feel_score, consistency_score, overall_score,
            review_text, spoiler, helpful_count, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`
        )
          .bind(
            payload.id ? Number(payload.id) : null,
            Number(payload.anime_id),
            String(payload.user_id || 'restored'),
            String(payload.user_name || 'User'),
            String(payload.dub_language || 'Hindi'),
            payload.platform || null,
            Number(payload.voice_acting_score) || 4,
            Number(payload.translation_fidelity_score) || 4,
            Number(payload.audio_mix_score) || 4,
            Number(payload.localization_feel_score) || 4,
            Number(payload.consistency_score) || 4,
            Number(payload.overall_score) || 4,
            payload.review_text || null,
            payload.spoiler ? 1 : 0,
            Number(payload.helpful_count) || 0,
            payload.created_at || null
          )
          .run();
      } else if (entityType === 'anime_franchise_links') {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO anime_franchise_links (
            id, franchise_key, franchise_title, anime_id, relation_type,
            watch_order, is_recommended_entry, note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
        )
          .bind(
            payload.id ? Number(payload.id) : null,
            String(payload.franchise_key || 'restored-franchise'),
            String(payload.franchise_title || 'Restored Franchise'),
            Number(payload.anime_id),
            String(payload.relation_type || 'Season'),
            Number(payload.watch_order) || 1,
            payload.is_recommended_entry ? 1 : 0,
            payload.note || null,
            payload.created_at || null
          )
          .run();
      } else if (entityType === 'anime_cast_entries') {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO anime_cast_entries (
            id, anime_id, character_name, character_role, character_image_url,
            language, voice_actor_name, voice_actor_image_url, studio_or_platform,
            source_note, verified, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
        )
          .bind(
            payload.id ? Number(payload.id) : null,
            Number(payload.anime_id),
            String(payload.character_name || 'Character'),
            String(payload.character_role || 'Main'),
            payload.character_image_url || null,
            String(payload.language || 'Hindi'),
            String(payload.voice_actor_name || 'Voice Actor'),
            payload.voice_actor_image_url || null,
            payload.studio_or_platform || null,
            payload.source_note || null,
            payload.verified ? 1 : 0,
            payload.created_at || null
          )
          .run();
      } else {
        return jsonResponse({ error: `Unsupported entity_type: ${entityType}` }, 400, request);
      }

      await env.DB.prepare(`UPDATE admin_recycle_bin SET restored_at = datetime('now') WHERE id = ?`)
        .bind(binId)
        .run();

      await recordAdminActivityLog(env.DB, {
        actor_email: adminActor,
        action_type: 'RECYCLE_BIN_RESTORE',
        entity_type: entityType,
        entity_id: String(binRow.entity_id),
        summary: `Restored ${entityType} #${binRow.entity_id} (${binRow.title || 'item'}) from Recycle Bin`,
      });

      return jsonResponse(
        {
          success: true,
          restoredId: binId,
          entity_type: entityType,
          entity_id: binRow.entity_id,
        },
        200,
        request
      );
    } catch (e) {
      return jsonResponse({ error: getErrorMessage(e) || 'Failed to restore item' }, 500, request);
    }
  }

  const purgeMatch = path.match(/^\/api\/admin\/recycle-bin\/(\d+)$/);
  if (purgeMatch && method === 'DELETE') {
    if (!env.DB) {
      return jsonResponse({ error: 'D1 database binding unavailable' }, 503, request);
    }
    const binId = parseInt(purgeMatch[1], 10);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const confirmCheck = validateRecycleBinPurgeConfirmation(
      body?.confirm || url.searchParams.get('confirm')
    );

    if (!confirmCheck.valid) {
      return jsonResponse({ error: confirmCheck.error }, 400, request);
    }

    try {
      const binRow = await env.DB.prepare(
        `SELECT id, entity_type, entity_id, title FROM admin_recycle_bin WHERE id = ?`
      )
        .bind(binId)
        .first<Record<string, unknown>>();

      if (!binRow) {
        return jsonResponse({ error: 'Recycle bin entry not found' }, 404, request);
      }

      await env.DB.prepare(`DELETE FROM admin_recycle_bin WHERE id = ?`).bind(binId).run();

      await recordAdminActivityLog(env.DB, {
        actor_email: adminActor,
        action_type: 'RECYCLE_BIN_PURGE',
        entity_type: String(binRow.entity_type),
        entity_id: String(binRow.entity_id),
        summary: `Permanently purged ${binRow.entity_type} #${binRow.entity_id} (${binRow.title || 'item'})`,
      });

      return jsonResponse({ success: true, purgedId: binId }, 200, request);
    } catch (e) {
      return jsonResponse({ error: getErrorMessage(e) || 'Failed to purge item' }, 500, request);
    }
  }

  // =========================================================================
  // 2. WORKERS AI DAILY COST GUARD (ai_usage_daily)
  // =========================================================================
  if (path === '/api/admin/ai-usage' && method === 'GET') {
    const usage = await getTodayAiUsage(env.DB);
    let history: Record<string, unknown>[] = [];
    if (env.DB) {
      try {
        const res = await env.DB.prepare(
          `SELECT usage_date, translation_calls, daily_cap, updated_at
           FROM ai_usage_daily
           ORDER BY usage_date DESC
           LIMIT 14`
        ).all<Record<string, unknown>>();
        history = res.results || [];
      } catch {
        // ignore
      }
    }
    return jsonResponse({ success: true, usage, history }, 200, request);
  }

  if (path === '/api/admin/ai-usage/cap' && method === 'PUT') {
    if (!env.DB) {
      return jsonResponse({ error: 'D1 database binding unavailable' }, 503, request);
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const newCap = Math.max(1, Math.min(5000, Math.floor(Number(body?.dailyCap) || 100)));
    const today = new Date().toISOString().slice(0, 10);

    try {
      await getTodayAiUsage(env.DB);
      await env.DB.prepare(
        `UPDATE ai_usage_daily SET daily_cap = ?, updated_at = datetime('now') WHERE usage_date = ?`
      )
        .bind(newCap, today)
        .run();

      await recordAdminActivityLog(env.DB, {
        actor_email: adminActor,
        action_type: 'AI_USAGE_CAP_UPDATE',
        entity_type: 'ai_usage_daily',
        entity_id: today,
        summary: `Updated Workers AI daily translation cap to ${newCap}`,
      });

      const usage = await getTodayAiUsage(env.DB);
      return jsonResponse({ success: true, usage }, 200, request);
    } catch (e) {
      return jsonResponse({ error: getErrorMessage(e) || 'Failed to update AI daily cap' }, 500, request);
    }
  }

  // =========================================================================
  // 3. TRANSLATION VERSION HISTORY & 1-CLICK ROLLBACK (translation_versions)
  // =========================================================================
  const transVersionMatch = path.match(/^\/api\/admin\/translations\/(\d+)\/([a-z]{2})\/versions$/);
  if (transVersionMatch && method === 'GET') {
    const animeId = parseInt(transVersionMatch[1], 10);
    const locale = transVersionMatch[2];
    if (!env.DB) {
      return jsonResponse({ success: true, versions: [] }, 200, request);
    }
    try {
      const res = await env.DB.prepare(
        `SELECT id, anime_id, language_code, synopsis_text, source_type, saved_by, created_at
         FROM translation_versions
         WHERE anime_id = ? AND language_code = ?
         ORDER BY id DESC
         LIMIT 30`
      )
        .bind(animeId, locale)
        .all<Record<string, unknown>>();
      return jsonResponse({ success: true, versions: res.results || [] }, 200, request);
    } catch (e) {
      return jsonResponse({ success: true, versions: [], warning: getErrorMessage(e) }, 200, request);
    }
  }

  const transRollbackMatch = path.match(/^\/api\/admin\/translations\/(\d+)\/([a-z]{2})\/rollback$/);
  if (transRollbackMatch && method === 'POST') {
    if (!env.DB) {
      return jsonResponse({ error: 'D1 database binding unavailable' }, 503, request);
    }
    const animeId = parseInt(transRollbackMatch[1], 10);
    const locale = transRollbackMatch[2];
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const versionId = Number(body?.versionId);

    if (!versionId) {
      return jsonResponse({ error: 'versionId is required for rollback' }, 400, request);
    }

    try {
      const targetVersion = await env.DB.prepare(
        `SELECT * FROM translation_versions WHERE id = ? AND anime_id = ? AND language_code = ?`
      )
        .bind(versionId, animeId, locale)
        .first<Record<string, unknown>>();

      if (!targetVersion) {
        return jsonResponse({ error: 'Translation version not found' }, 404, request);
      }

      const currentActive = await env.DB.prepare(
        `SELECT synopsis FROM anime_translations WHERE anime_id = ? AND language_code = ?`
      )
        .bind(animeId, locale)
        .first<Record<string, unknown>>();

      if (currentActive && currentActive.synopsis) {
        await recordTranslationVersion(env.DB, {
          anime_id: animeId,
          language_code: locale,
          synopsis_text: String(currentActive.synopsis),
          source_type: 'pre_rollback_backup',
          saved_by: adminActor,
        });
      }

      await env.DB.prepare(
        `INSERT INTO anime_translations (anime_id, language_code, synopsis, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(anime_id, language_code)
         DO UPDATE SET synopsis = excluded.synopsis, updated_at = datetime('now')`
      )
        .bind(animeId, locale, String(targetVersion.synopsis_text))
        .run();

      await recordAdminActivityLog(env.DB, {
        actor_email: adminActor,
        action_type: 'TRANSLATION_ROLLBACK',
        entity_type: 'anime_translations',
        entity_id: `${animeId}:${locale}`,
        summary: `Rolled back ${locale.toUpperCase()} translation for anime #${animeId} to version #${versionId}`,
      });

      return jsonResponse(
        {
          success: true,
          anime_id: animeId,
          language_code: locale,
          synopsis: targetVersion.synopsis_text,
        },
        200,
        request
      );
    } catch (e) {
      return jsonResponse({ error: getErrorMessage(e) || 'Failed to rollback translation' }, 500, request);
    }
  }

  // =========================================================================
  // 4. ANIME REVISION HISTORY & 1-CLICK RESTORE (anime_revisions)
  // =========================================================================
  const revListMatch = path.match(/^\/api\/admin\/anime\/(\d+)\/revisions$/);
  if (revListMatch && method === 'GET') {
    const animeId = parseInt(revListMatch[1], 10);
    if (!env.DB) {
      return jsonResponse({ success: true, revisions: [] }, 200, request);
    }
    try {
      const res = await env.DB.prepare(
        `SELECT id, anime_id, revision_summary, snapshot_json, edited_by, created_at
         FROM anime_revisions
         WHERE anime_id = ?
         ORDER BY id DESC
         LIMIT 35`
      )
        .bind(animeId)
        .all<Record<string, unknown>>();

      const revisions = (res.results || []).map((r) => ({
        ...r,
        snapshot: safeJsonParse(r.snapshot_json, {}),
      }));

      return jsonResponse({ success: true, revisions }, 200, request);
    } catch (e) {
      return jsonResponse({ success: true, revisions: [], warning: getErrorMessage(e) }, 200, request);
    }
  }

  const revRestoreMatch = path.match(/^\/api\/admin\/anime\/(\d+)\/revisions\/(\d+)\/restore$/);
  if (revRestoreMatch && method === 'POST') {
    if (!env.DB) {
      return jsonResponse({ error: 'D1 database binding unavailable' }, 503, request);
    }
    const animeId = parseInt(revRestoreMatch[1], 10);
    const revisionId = parseInt(revRestoreMatch[2], 10);

    try {
      const revRow = await env.DB.prepare(
        `SELECT * FROM anime_revisions WHERE id = ? AND anime_id = ?`
      )
        .bind(revisionId, animeId)
        .first<Record<string, unknown>>();

      if (!revRow) {
        return jsonResponse({ error: 'Revision not found' }, 404, request);
      }

      const snap = safeJsonParse<Record<string, unknown>>(revRow.snapshot_json, {});
      if (!snap || !snap.title) {
        return jsonResponse({ error: 'Invalid revision snapshot payload' }, 400, request);
      }

      const currentAnime = await env.DB.prepare(`SELECT * FROM anime WHERE id = ?`)
        .bind(animeId)
        .first<Record<string, unknown>>();
      if (currentAnime) {
        await recordAnimeRevision(env.DB, {
          anime_id: animeId,
          revision_summary: `Auto-backup before restoring revision #${revisionId}`,
          snapshot: currentAnime,
          edited_by: adminActor,
        });
      }

      const tableInfo = await env.DB.prepare(`PRAGMA table_info(anime)`).all<Record<string, unknown>>();
      const validColumns = new Set((tableInfo.results || []).map((col) => String(col.name)));

      const updateAssignments: string[] = [];
      const updateVals: unknown[] = [];

      for (const [k, v] of Object.entries(snap)) {
        if (k === 'id' || k === 'created_at' || k === 'updated_at') continue;
        if (validColumns.has(k) && v !== undefined) {
          updateAssignments.push(`${k} = ?`);
          updateVals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
        }
      }

      if (validColumns.has('updated_at')) {
        updateAssignments.push(`updated_at = datetime('now')`);
      }

      if (updateAssignments.length > 0) {
        updateVals.push(animeId);
        await env.DB.prepare(
          `UPDATE anime SET ${updateAssignments.join(', ')} WHERE id = ?`
        )
          .bind(...updateVals)
          .run();
      }

      const updatedAnime = await env.DB.prepare(`SELECT * FROM anime WHERE id = ?`)
        .bind(animeId)
        .first<Record<string, unknown>>();

      await recordAdminActivityLog(env.DB, {
        actor_email: adminActor,
        action_type: 'ANIME_REVISION_RESTORE',
        entity_type: 'anime',
        entity_id: String(animeId),
        summary: `Restored anime #${animeId} (${snap.title}) to revision #${revisionId}`,
      });

      return jsonResponse(
        {
          success: true,
          restoredRevisionId: revisionId,
          anime: updatedAnime,
        },
        200,
        request
      );
    } catch (e) {
      return jsonResponse({ error: getErrorMessage(e) || 'Failed to restore revision' }, 500, request);
    }
  }

  // =========================================================================
  // 5. DUB REVIEW SOFT-DELETE (DELETE /api/admin/dub-reviews/:id)
  // =========================================================================
  const dubRevDeleteMatch = path.match(/^\/api\/admin\/dub-reviews\/(\d+)$/);
  if (dubRevDeleteMatch && method === 'DELETE') {
    if (!env.DB) {
      return jsonResponse({ error: 'D1 database binding unavailable' }, 503, request);
    }
    const dubReviewId = parseInt(dubRevDeleteMatch[1], 10);
    try {
      const existing = await env.DB.prepare(`SELECT * FROM dub_reviews WHERE id = ?`)
        .bind(dubReviewId)
        .first<Record<string, unknown>>();
      if (!existing) {
        return jsonResponse({ error: 'Dub review not found' }, 404, request);
      }

      const recycleBinId = await archiveEntityToRecycleBin(env.DB, {
        entity_type: 'dub_reviews',
        entity_id: dubReviewId,
        title: `${existing.dub_language || 'Dub'} review by ${existing.user_name || 'User'} (Anime #${existing.anime_id})`,
        payload: existing,
        deleted_by: adminActor,
      });

      await env.DB.prepare(`DELETE FROM dub_reviews WHERE id = ?`).bind(dubReviewId).run();

      await recordAdminActivityLog(env.DB, {
        actor_email: adminActor,
        action_type: 'DELETE_DUB_REVIEW',
        entity_type: 'dub_reviews',
        entity_id: String(dubReviewId),
        summary: `Soft-deleted dub review #${dubReviewId} into Recycle Bin`,
      });

      return jsonResponse({ success: true, recycleBinId }, 200, request);
    } catch (e) {
      return jsonResponse({ error: getErrorMessage(e) || 'Failed to delete dub review' }, 500, request);
    }
  }

  // =========================================================================
  // 6. RESTORED LEGACY TOOL: IMDb RATINGS CHECKER & SYNC
  //    - POST /api/admin/imdb-ratings/check (Real OMDb + Jikan/MAL live lookup, zero fake scores)
  //    - POST /api/admin/imdb-ratings/apply (Safe single or batch rating update with activity log)
  // =========================================================================
  if (path === '/api/admin/imdb-ratings/check' && method === 'POST') {
    if (!env.DB) {
      return jsonResponse({ success: true, checkedAt: new Date().toISOString(), results: [] }, 200, request);
    }

    try {
      const body = (await request.json().catch(() => ({}))) as {
        animeIds?: number[];
        filter?: 'missing' | 'default' | 'all';
        limit?: number;
        offset?: number;
        search?: string;
      };

      const limit = Math.min(12, Math.max(1, Number(body.limit) || 8));
      const offset = Math.max(0, Number(body.offset) || 0);
      const filter = body.filter || 'missing';
      const search = typeof body.search === 'string' ? body.search.trim() : '';

      let rows: Array<Record<string, unknown>> = [];

      const selectCols = 'id, title, slug, year, rating, cover_image, external_id, mal_id';
      const fallbackSelectCols = 'id, title, slug, year, rating, cover_image';

      const queryCatalogRows = async (cols: string) => {
        if (Array.isArray(body.animeIds) && body.animeIds.length > 0) {
          const cleanIds = body.animeIds
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
            .slice(0, 12);
          if (cleanIds.length === 0) return [];
          const placeholders = cleanIds.map(() => '?').join(', ');
          const res = await env.DB!.prepare(
            `SELECT ${cols} FROM anime WHERE id IN (${placeholders}) ORDER BY id DESC`
          )
            .bind(...cleanIds)
            .all<Record<string, unknown>>();
          return res?.results || [];
        }

        const whereClauses: string[] = [];
        const params: unknown[] = [];

        if (search) {
          whereClauses.push('LOWER(title) LIKE ?');
          params.push(`%${search.toLowerCase()}%`);
        }

        if (filter === 'missing') {
          whereClauses.push('(rating IS NULL OR rating = 0 OR CAST(rating AS TEXT) = "")');
        } else if (filter === 'default') {
          whereClauses.push('(rating IS NULL OR rating = 0 OR rating = 8.5 OR rating = 8.0)');
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const res = await env.DB!.prepare(
          `SELECT ${cols} FROM anime ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`
        )
          .bind(...params, limit, offset)
          .all<Record<string, unknown>>();
        return res?.results || [];
      };

      try {
        rows = await queryCatalogRows(selectCols);
      } catch {
        rows = await queryCatalogRows(fallbackSelectCols);
      }

      const omdbKey = String(env.OMDB_API_KEY || '').trim();
      const results: ImdbRatingCandidate[] = [];

      for (const row of rows) {
        const animeId = Number(row.id);
        const title = String(row.title || '').trim();
        const year = row.year ? Number(row.year) : null;
        const existingExternalId = String(row.external_id || '').trim();
        const existingMalId = row.mal_id ? Number(row.mal_id) : null;

        let fetchedScore: number | null = null;
        let source = 'Not Found';
        let matchedExternalId: string | null = existingExternalId || null;
        let externalUrl: string | null = null;
        let note = 'No verified rating found from live metadata sources.';

        // 1. Live OMDb / IMDb lookup if OMDB_API_KEY is configured
        if (omdbKey && title) {
          try {
            const isImdbId = /^tt\d{5,}$/i.test(existingExternalId);
            const omdbParams = new URLSearchParams({ apikey: omdbKey });
            if (isImdbId) {
              omdbParams.set('i', existingExternalId);
            } else {
              omdbParams.set('t', title);
              if (year && Number.isFinite(year)) omdbParams.set('y', String(year));
            }
            const omdbRes = await fetch(`https://www.omdbapi.com/?${omdbParams.toString()}`);
            if (omdbRes.ok) {
              const omdbData = (await omdbRes.json().catch(() => null)) as Record<string, any> | null;
              const parsed = sanitizeRatingScore(omdbData?.imdbRating);
              if (omdbData?.Response === 'True' && parsed !== null) {
                fetchedScore = parsed;
                source = 'IMDb (OMDb)';
                if (typeof omdbData.imdbID === 'string' && omdbData.imdbID.startsWith('tt')) {
                  matchedExternalId = omdbData.imdbID;
                  externalUrl = `https://www.imdb.com/title/${omdbData.imdbID}/`;
                }
                note = omdbData.imdbVotes
                  ? `Verified IMDb score (${omdbData.imdbVotes} votes)`
                  : 'Verified IMDb score via OMDb API';
              }
            }
          } catch {
            // Fall through safely to Jikan/MAL public API
          }
        }

        // 2. Real Live Jikan (MyAnimeList) Public API lookup fallback (zero API key required)
        if (fetchedScore === null && title) {
          try {
            const jikanUrl = existingMalId
              ? `https://api.jikan.moe/v4/anime/${existingMalId}`
              : `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=3&sfw=true`;
            const jRes = await fetch(jikanUrl, {
              headers: { Accept: 'application/json' },
            });
            if (jRes.ok) {
              const jJson = (await jRes.json().catch(() => null)) as { data?: any } | null;
              const candidates = Array.isArray(jJson?.data)
                ? jJson.data
                : jJson?.data
                  ? [jJson.data]
                  : [];

              const normTarget = title.toLowerCase().replace(/[^a-z0-9]/g, '');
              const best =
                candidates.find((c: any) => {
                  const t1 = String(c?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                  const t2 = String(c?.title_english || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                  return t1 === normTarget || t2 === normTarget;
                }) || candidates[0];

              const parsed = sanitizeRatingScore(best?.score);
              if (best && parsed !== null) {
                fetchedScore = parsed;
                source = 'MAL (Jikan Live)';
                if (!matchedExternalId && best.mal_id) {
                  matchedExternalId = `mal:${best.mal_id}`;
                }
                externalUrl = typeof best.url === 'string' ? best.url : null;
                note = best.scored_by
                  ? `Verified MAL score (${Number(best.scored_by).toLocaleString()} users)`
                  : 'Verified live MyAnimeList score';
              }
            }
          } catch {
            // Leave fetchedScore null cleanly
          }
        }

        const evalDiff = evaluateImdbRatingDiff(row.rating, fetchedScore);
        results.push({
          animeId,
          title,
          slug: row.slug ? String(row.slug) : null,
          coverImage: row.cover_image ? String(row.cover_image) : null,
          year: year ?? null,
          currentRating: evalDiff.currentRating,
          fetchedRating: evalDiff.fetchedRating,
          delta: evalDiff.delta,
          source,
          externalId: matchedExternalId,
          externalUrl,
          status: evalDiff.status,
          note,
        });
      }

      return jsonResponse(
        {
          success: true,
          checkedAt: new Date().toISOString(),
          omdbConfigured: Boolean(omdbKey),
          results,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (e) {
      return jsonResponse(
        { success: false, error: redactSensitiveTokens(getErrorMessage(e)) },
        500,
        request
      );
    }
  }

  if (path === '/api/admin/imdb-ratings/apply' && method === 'POST') {
    if (!env.DB) {
      return jsonResponse({ success: false, error: 'D1 database binding unavailable' }, 503, request);
    }

    try {
      const body = (await request.json().catch(() => null)) as {
        updates?: Array<{ animeId?: number; rating?: number; externalId?: string }>;
      } | null;

      const rawUpdates = Array.isArray(body?.updates) ? body.updates.slice(0, 50) : [];
      if (rawUpdates.length === 0) {
        return jsonResponse(
          { success: false, error: 'Provide at least one validated rating update.' },
          400,
          request
        );
      }

      const updatedIds: number[] = [];
      for (const item of rawUpdates) {
        const animeId = Number(item.animeId);
        const validRating = sanitizeRatingScore(item.rating);
        if (!Number.isInteger(animeId) || animeId <= 0 || validRating === null) continue;

        const extId =
          typeof item.externalId === 'string' && item.externalId.trim()
            ? item.externalId.trim().slice(0, 64)
            : null;

        if (extId) {
          try {
            await env.DB.prepare(
              `UPDATE anime
               SET rating = ?,
                   external_id = COALESCE(NULLIF(TRIM(external_id), ''), ?)
               WHERE id = ?`
            )
              .bind(validRating, extId, animeId)
              .run();
          } catch {
            await env.DB.prepare('UPDATE anime SET rating = ? WHERE id = ?')
              .bind(validRating, animeId)
              .run();
          }
        } else {
          await env.DB.prepare('UPDATE anime SET rating = ? WHERE id = ?')
            .bind(validRating, animeId)
            .run();
        }
        updatedIds.push(animeId);
      }

      if (updatedIds.length > 0) {
        await recordAdminActivityLog(env.DB, {
          actor_email: adminActor,
          action_type: 'SYNC_IMDB_RATINGS',
          entity_type: 'anime',
          entity_id: updatedIds.join(','),
          summary: `Synced verified external ratings for ${updatedIds.length} anime title(s)`,
        });
      }

      return jsonResponse(
        {
          success: true,
          updatedCount: updatedIds.length,
          updatedIds,
        },
        200,
        request
      );
    } catch (e) {
      return jsonResponse(
        { success: false, error: redactSensitiveTokens(getErrorMessage(e)) },
        500,
        request
      );
    }
  }

  return null;
}
