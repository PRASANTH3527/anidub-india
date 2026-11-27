/**
 * Cloudflare Pages / Worker API Routes for AniDub India — Admin Dashboard 2.0 (Phase 2: Content Operations Pro)
 *
 * Endpoints (ALL strictly protected by Clerk Admin Auth via getAdminAuth):
 * - GET    /api/admin/metadata-search?q=...&provider=anilist|jikan
 * - GET    /api/admin/dub-matrix(?animeId=...)
 * - PUT    /api/admin/dub-matrix/bulk
 * - GET    /api/admin/data-health
 * - POST   /api/admin/translations/generate
 * - PATCH  /api/admin/translations/:animeId/:locale/lock
 * - GET    /api/admin/moderation-inbox
 * - PATCH  /api/admin/dub-reviews/:id
 * - PATCH  /api/admin/reviews/:id
 * - POST   /api/admin/import-csv/dry-run
 * - GET    /api/admin/activity-logs
 * - POST   /api/admin/activity-logs
 */

import { getAdminAuth } from '../../utils/auth';
import {
  DUB_MATRIX_LANGUAGES,
  languageCodeToName,
  normalizeAniListCandidate,
  normalizeJikanCandidate,
  scanCatalogDataHealth,
  validateCsvDryRunRows,
  validateDubMatrixEntry,
  type DubMatrixRowInput,
  type ExternalMetadataCandidate,
  type NormalizedDubMatrixRow,
} from '../../utils/adminOpsPro';
import {
  computeSourceHash,
  isMissingTranslationsTableError,
  normalizeTranslationLocale,
} from '../../utils/animeTranslations';
import { normalizeStreamingPartners } from '../../utils/dataNormalization';
import { scanExtendedDataHealth } from '../../utils/adminPhase35Polish';
import {
  archiveEntityToRecycleBin,
  getTodayAiUsage,
  incrementTodayAiUsage,
  recordTranslationVersion,
} from './adminPhase35Routes';
import {
  getErrorMessage,
  isMissingColumnError,
  type D1DatabaseLike,
  type RouteContext,
} from './shared';

export interface AdminActivityLogInput {
  actor_id?: string | null;
  actor_email?: string | null;
  action?: string;
  action_type?: string;
  entity_type: string;
  entity_id: string | number;
  summary: string;
  diff_json?: unknown;
  payload_json?: unknown;
}

export function isMissingOpsProTableError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase();
  return (
    msg.includes('no such table: anime_dub_matrix') ||
    msg.includes('no such table: admin_activity_logs') ||
    msg.includes('no such table: dub_reviews') ||
    msg.includes('no such table')
  );
}

/**
 * Safely records an admin activity log entry into D1 `admin_activity_logs`.
 * Auto-creates the table if missing or swallows errors so production operations never crash.
 */
export async function recordAdminActivityLog(
  db: D1DatabaseLike | null | undefined,
  entry: AdminActivityLogInput
): Promise<void> {
  if (!db) return;
  const rawDiff = entry.diff_json !== undefined ? entry.diff_json : entry.payload_json;
  const diffStr =
    rawDiff !== undefined && rawDiff !== null
      ? typeof rawDiff === 'string'
        ? rawDiff
        : JSON.stringify(rawDiff)
      : null;
  const actionVal = String(entry.action || entry.action_type || 'ADMIN_ACTION').trim();

  const insertSql = `INSERT INTO admin_activity_logs (actor_id, actor_email, action, entity_type, entity_id, summary, diff_json, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
  try {
    await db
      .prepare(insertSql)
      .bind(
        String(entry.actor_id || 'admin'),
        entry.actor_email ? String(entry.actor_email) : null,
        actionVal,
        String(entry.entity_type).trim(),
        String(entry.entity_id).trim(),
        String(entry.summary || '').trim(),
        diffStr
      )
      .run();
  } catch (err) {
    if (isMissingOpsProTableError(err)) {
      try {
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS admin_activity_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              actor_id TEXT NOT NULL,
              actor_email TEXT,
              action TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              summary TEXT,
              diff_json TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`
          )
          .run();
        await db
          .prepare(insertSql)
          .bind(
            String(entry.actor_id || 'admin'),
            entry.actor_email ? String(entry.actor_email) : null,
            actionVal,
            String(entry.entity_type).trim(),
            String(entry.entity_id).trim(),
            String(entry.summary || '').trim(),
            diffStr
          )
          .run();
      } catch {
        // Safe non-blocking fallback if D1 is read-only or mock
      }
    }
  }
}

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
          error: 'Forbidden: Only authorized administrators can access Content Operations Pro',
        },
        403,
        ctx.request,
        { 'Cache-Control': 'no-store' }
      ),
    };
  }
  return { ok: true as const, session };
}

const ANILIST_SEARCH_QUERY = `
query ($search: String) {
  Page(page: 1, perPage: 8) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      coverImage {
        extraLarge
        large
      }
      bannerImage
      seasonYear
      startDate {
        year
      }
      format
      episodes
      genres
      description(asHtml: false)
      studios(isMain: true) {
        nodes {
          name
        }
      }
    }
  }
}
`;

async function searchAniListCandidates(query: string): Promise<ExternalMetadataCandidate[]> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: ANILIST_SEARCH_QUERY,
      variables: { search: query },
    }),
    signal: AbortSignal.timeout(5500),
  });
  if (!res.ok) {
    throw new Error(`AniList API returned HTTP ${res.status}`);
  }
  const json: any = await res.json();
  const list = json?.data?.Page?.media;
  if (!Array.isArray(list)) return [];
  return list.map((m: Record<string, any>) => normalizeAniListCandidate(m));
}

async function searchJikanCandidates(query: string): Promise<ExternalMetadataCandidate[]> {
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=8&sfw=true`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5500),
  });
  if (!res.ok) {
    throw new Error(`Jikan API returned HTTP ${res.status}`);
  }
  const json: any = await res.json();
  const list = json?.data;
  if (!Array.isArray(list)) return [];
  return list.map((item: Record<string, any>) => normalizeJikanCandidate(item));
}

/**
 * Syncs verified dub matrix entries back to the parent `anime` catalog row
 * so public Explore and Anime Details 2.0 pages reflect verified dub languages,
 * OTT platforms, and verification timestamps immediately.
 */
async function syncDubMatrixToPublicAnimeRow(
  db: D1DatabaseLike,
  animeId: string,
  allAnimeMatrixRows: NormalizedDubMatrixRow[],
  verifiedTimestamp: string
): Promise<void> {
  try {
    const animeRow = await db
      .prepare('SELECT id, languages, platform, platforms_data, official_source_url FROM anime WHERE id = ? LIMIT 1')
      .bind(animeId)
      .first<Record<string, any>>();
    if (!animeRow) return;

    // Collect verified languages ('complete' or 'partial' or 'announced')
    const verifiedMatrixRows = allAnimeMatrixRows.filter(
      (r) =>
        r.availability_status === 'complete' ||
        r.availability_status === 'partial' ||
        r.availability_status === 'announced'
    );

    const langSet = new Set<string>();
    const platformMap = new Map<
      string,
      {
        name: string;
        url: string;
        languages: Set<string>;
        episodeCount: number | null;
      }
    >();
    let primarySourceUrl = String(animeRow.official_source_url || '').trim();

    // Preserve existing streaming partners and merge matrix updates
    const existingPartners = normalizeStreamingPartners(animeRow.platforms_data);
    for (const p of existingPartners) {
      if (!p.name) continue;
      const pAny = p as unknown as Record<string, unknown>;
      platformMap.set(p.name.toLowerCase(), {
        name: p.name,
        url: p.url || '',
        languages: new Set(Array.isArray(p.languages) ? p.languages : []),
        episodeCount: typeof pAny.episodeCount === 'number' ? pAny.episodeCount : null,
      });
    }

    for (const row of verifiedMatrixRows) {
      const langName = languageCodeToName(row.language_code);
      if (langName) langSet.add(langName);
      if (row.source_url && !primarySourceUrl) {
        primarySourceUrl = row.source_url;
      }
      if (row.platform_name) {
        const key = row.platform_name.toLowerCase();
        const existing = platformMap.get(key) || {
          name: row.platform_name,
          url: row.source_url || '',
          languages: new Set<string>(),
          episodeCount: row.dubbed_episodes,
        };
        if (langName) existing.languages.add(langName);
        if (row.source_url) existing.url = row.source_url;
        if (row.dubbed_episodes !== null) existing.episodeCount = row.dubbed_episodes;
        platformMap.set(key, existing);
      }
    }

    // Remove languages explicitly marked 'unavailable' or 'unverified' if no other season/platform verifies them
    const nextLanguagesStr = Array.from(langSet).join(', ');
    const mergedPartners = Array.from(platformMap.values()).map((p) => ({
      name: p.name,
      platform: p.name,
      url: p.url,
      languages: Array.from(p.languages),
      ...(p.episodeCount !== null ? { episodeCount: p.episodeCount } : {}),
    }));
    const nextPlatformStr =
      mergedPartners.map((p) => p.name).join(' | ') || String(animeRow.platform || '').trim();
    const partnersJson = JSON.stringify(mergedPartners);

    try {
      await db
        .prepare(
          `UPDATE anime
           SET languages = ?,
               platform = ?,
               platforms_data = ?,
               streaming_partners = ?,
               official_source_url = COALESCE(NULLIF(?, ''), official_source_url),
               last_verified_at = ?
           WHERE id = ?`
        )
        .bind(
          nextLanguagesStr,
          nextPlatformStr || null,
          partnersJson,
          partnersJson,
          primarySourceUrl,
          verifiedTimestamp,
          animeId
        )
        .run();
    } catch (colErr) {
      if (isMissingColumnError(colErr)) {
        await db
          .prepare('UPDATE anime SET languages = ?, platform = ? WHERE id = ?')
          .bind(nextLanguagesStr, nextPlatformStr || null, animeId)
          .run();
      }
    }
  } catch (err) {
    console.warn('[syncDubMatrixToPublicAnimeRow fallback]:', getErrorMessage(err));
  }
}

export async function handleAdminOpsProRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // ===========================================================================
  // 1. 1-CLICK METADATA AUTO-FILL: GET /api/admin/metadata-search
  // ===========================================================================
  if (path === '/api/admin/metadata-search' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const query = (url.searchParams.get('q') || '').trim();
    const providerParam = (url.searchParams.get('provider') || 'anilist').trim().toLowerCase();
    const provider: 'anilist' | 'jikan' = providerParam === 'jikan' ? 'jikan' : 'anilist';

    if (!query || query.length < 2) {
      return jsonResponse(
        {
          success: false,
          error: 'Please enter at least 2 characters to search external anime metadata.',
          candidates: [],
        },
        400,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    try {
      let candidates: ExternalMetadataCandidate[] = [];
      let usedProvider: 'anilist' | 'jikan' = provider;
      let fallbackNotice: string | null = null;

      try {
        candidates =
          provider === 'anilist'
            ? await searchAniListCandidates(query)
            : await searchJikanCandidates(query);
      } catch (primaryErr) {
        // Rate-limit / timeout safety: automatically try secondary provider
        try {
          usedProvider = provider === 'anilist' ? 'jikan' : 'anilist';
          candidates =
            usedProvider === 'anilist'
              ? await searchAniListCandidates(query)
              : await searchJikanCandidates(query);
          fallbackNotice = `Primary provider (${provider}) timed out or rate-limited; fetched from ${usedProvider}.`;
        } catch (secondaryErr) {
          return jsonResponse(
            {
              success: false,
              error: `External metadata search unavailable (${getErrorMessage(primaryErr)} / ${getErrorMessage(secondaryErr)}).`,
              candidates: [],
            },
            502,
            request,
            { 'Cache-Control': 'no-store' }
          );
        }
      }

      return jsonResponse(
        {
          success: true,
          provider: usedProvider,
          query,
          notice: fallbackNotice,
          candidates,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse(
        { success: false, error: getErrorMessage(err), candidates: [] },
        500,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }
  }

  // ===========================================================================
  // 2. BULK DUB INTELLIGENCE & EPISODE MATRIX: GET /api/admin/dub-matrix
  // ===========================================================================
  if (path === '/api/admin/dub-matrix' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          tableReady: false,
          rows: [],
          languages: DUB_MATRIX_LANGUAGES,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    const animeIdFilter = (url.searchParams.get('animeId') || '').trim();
    const langFilter = (url.searchParams.get('language') || '').trim().toLowerCase();

    try {
      let matrixRows: Array<Record<string, any>> = [];
      let tableReady = true;

      try {
        if (animeIdFilter) {
          const res = await env.DB.prepare(
            'SELECT * FROM anime_dub_matrix WHERE anime_id = ? ORDER BY season_number ASC, language_code ASC'
          )
            .bind(animeIdFilter)
            .all();
          matrixRows = res.results || [];
        } else if (langFilter && langFilter !== 'all') {
          const res = await env.DB.prepare(
            'SELECT * FROM anime_dub_matrix WHERE LOWER(language_code) = ? ORDER BY updated_at DESC, id DESC LIMIT 500'
          )
            .bind(langFilter)
            .all();
          matrixRows = res.results || [];
        } else {
          const res = await env.DB.prepare(
            'SELECT * FROM anime_dub_matrix ORDER BY updated_at DESC, id DESC LIMIT 1000'
          ).all();
          matrixRows = res.results || [];
        }
      } catch (tableErr) {
        if (isMissingOpsProTableError(tableErr)) {
          tableReady = false;
          matrixRows = [];
        } else {
          throw tableErr;
        }
      }

      return jsonResponse(
        {
          success: true,
          tableReady,
          rows: matrixRows,
          languages: DUB_MATRIX_LANGUAGES,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse(
        { success: false, error: getErrorMessage(err), rows: [] },
        500,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }
  }

  // ===========================================================================
  // 2B. BULK SAVE DUB MATRIX: PUT /api/admin/dub-matrix/bulk
  // ===========================================================================
  if (path === '/api/admin/dub-matrix/bulk' && (method === 'PUT' || method === 'POST')) {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse(
        { success: false, error: 'Cloudflare D1 database binding is not configured.' },
        503,
        request
      );
    }

    let body: Record<string, any>;
    try {
      body = (await request.json()) as Record<string, any>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON payload.' }, 400, request);
    }

    const rawEntries: DubMatrixRowInput[] = Array.isArray(body?.entries)
      ? body.entries
      : Array.isArray(body?.rows)
        ? body.rows
        : [];

    if (rawEntries.length === 0) {
      return jsonResponse(
        { success: false, error: 'No dub matrix entries provided in payload.' },
        400,
        request
      );
    }

    const validatedEntries: NormalizedDubMatrixRow[] = [];
    for (let i = 0; i < rawEntries.length; i++) {
      const check = validateDubMatrixEntry(rawEntries[i]);
      if (!check.ok) {
        return jsonResponse(
          {
            success: false,
            error: `Row #${i + 1} (${rawEntries[i]?.language_code || 'unknown'}): ${check.error}`,
          },
          400,
          request
        );
      }
      validatedEntries.push(check.data);
    }

    const nowIso = new Date().toISOString();
    const actorEmail = auth.session.email || auth.session.userId || 'admin';

    try {
      // Ensure additive table exists so bulk edits succeed even before manual CLI migration
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS anime_dub_matrix (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          anime_id TEXT NOT NULL,
          season_number INTEGER NOT NULL DEFAULT 1,
          language_code TEXT NOT NULL,
          platform_name TEXT,
          region TEXT NOT NULL DEFAULT 'IN',
          dubbed_episodes INTEGER,
          total_episodes INTEGER,
          availability_status TEXT NOT NULL DEFAULT 'unverified' CHECK (availability_status IN ('complete', 'partial', 'announced', 'unavailable', 'unverified')),
          source_url TEXT,
          evidence_note TEXT,
          verified_at TEXT,
          verified_by TEXT,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(anime_id, season_number, language_code, platform_name)
        )`
      )
        .run()
        .catch(() => {});

      const affectedAnimeIds = new Set<string>();

      for (const entry of validatedEntries) {
        affectedAnimeIds.add(entry.anime_id);
        const isVerifiedStatus =
          entry.availability_status === 'complete' ||
          entry.availability_status === 'partial' ||
          entry.availability_status === 'announced';
        const resolvedVerifiedAt =
          entry.verified_at || (isVerifiedStatus ? nowIso : null);
        const resolvedVerifiedBy =
          entry.verified_by || (isVerifiedStatus ? actorEmail : null);

        await env.DB.prepare(
          `INSERT INTO anime_dub_matrix (
            anime_id, season_number, language_code, platform_name, region,
            dubbed_episodes, total_episodes, availability_status,
            source_url, evidence_note, verified_at, verified_by, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(anime_id, season_number, language_code, platform_name) DO UPDATE SET
            region = excluded.region,
            dubbed_episodes = excluded.dubbed_episodes,
            total_episodes = excluded.total_episodes,
            availability_status = excluded.availability_status,
            source_url = excluded.source_url,
            evidence_note = excluded.evidence_note,
            verified_at = COALESCE(excluded.verified_at, anime_dub_matrix.verified_at),
            verified_by = COALESCE(excluded.verified_by, anime_dub_matrix.verified_by),
            updated_at = datetime('now')`
        )
          .bind(
            entry.anime_id,
            entry.season_number,
            entry.language_code,
            entry.platform_name || '',
            entry.region,
            entry.dubbed_episodes,
            entry.total_episodes,
            entry.availability_status,
            entry.source_url,
            entry.evidence_note,
            resolvedVerifiedAt,
            resolvedVerifiedBy
          )
          .run();
      }

      // Sync verified dub updates back to public `anime` rows for full backward compatibility
      for (const animeId of affectedAnimeIds) {
        const allForAnimeRes = await env.DB.prepare(
          'SELECT * FROM anime_dub_matrix WHERE anime_id = ?'
        )
          .bind(animeId)
          .all<Record<string, any>>()
          .catch(() => ({ results: [] }));
        const normalizedForSync: NormalizedDubMatrixRow[] = (allForAnimeRes.results || []).map(
          (r) => ({
            anime_id: String(r.anime_id),
            season_number: Number(r.season_number) || 1,
            language_code: String(r.language_code),
            platform_name: String(r.platform_name || ''),
            region: String(r.region || 'IN'),
            dubbed_episodes:
              r.dubbed_episodes !== null && r.dubbed_episodes !== undefined
                ? Number(r.dubbed_episodes)
                : null,
            total_episodes:
              r.total_episodes !== null && r.total_episodes !== undefined
                ? Number(r.total_episodes)
                : null,
            availability_status: (r.availability_status as any) || 'unverified',
            source_url: r.source_url ? String(r.source_url) : null,
            evidence_note: r.evidence_note ? String(r.evidence_note) : null,
            verified_at: r.verified_at ? String(r.verified_at) : null,
            verified_by: r.verified_by ? String(r.verified_by) : null,
          })
        );
        await syncDubMatrixToPublicAnimeRow(env.DB, animeId, normalizedForSync, nowIso);
      }

      await recordAdminActivityLog(env.DB, {
        actor_id: auth.session.userId,
        actor_email: auth.session.email,
        action: 'BULK_DUB_MATRIX_UPDATE',
        entity_type: 'anime_dub_matrix',
        entity_id: Array.from(affectedAnimeIds).join(','),
        summary: `Updated ${validatedEntries.length} regional dub matrix record(s) across ${affectedAnimeIds.size} anime.`,
        diff_json: {
          updatedCount: validatedEntries.length,
          animeIds: Array.from(affectedAnimeIds),
          sample: validatedEntries.slice(0, 5),
        },
      });

      return jsonResponse(
        {
          success: true,
          updatedCount: validatedEntries.length,
          affectedAnimeIds: Array.from(affectedAnimeIds),
          verifiedAt: nowIso,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse(
        { success: false, error: getErrorMessage(err) },
        500,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }
  }

  // ===========================================================================
  // 3. CATALOG DATA HEALTH & QA SCANNER: GET /api/admin/data-health
  // ===========================================================================
  if (path === '/api/admin/data-health' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      const emptyReport = scanCatalogDataHealth([], [], []);
      return jsonResponse({ success: true, report: emptyReport }, 200, request, {
        'Cache-Control': 'no-store',
      });
    }

    try {
      let animeRows: Array<Record<string, any>> = [];
      try {
        const res = await env.DB.prepare(
          `SELECT id, title, slug, synopsis, cover_image, banner_image, status, airing_status,
                  episodes_count, episodes_per_season, season_episode_count, languages,
                  platform, platforms_data, watch_url, official_source_url, last_verified_at
           FROM anime
           WHERE (is_published = 1 OR is_published = true) AND LOWER(COALESCE(status, '')) != 'pending'
           ORDER BY id DESC`
        ).all();
        animeRows = res.results || [];
      } catch (colErr) {
        if (!isMissingColumnError(colErr)) throw colErr;
        const fallback = await env.DB.prepare(
          'SELECT id, title, slug, synopsis, cover_image, banner_image, status, episodes_count, languages, platform, watch_url FROM anime ORDER BY id DESC'
        ).all();
        animeRows = fallback.results || [];
      }

      const [trRes, dmRes, frRes, castRes] = await Promise.all([
        env.DB.prepare(
          'SELECT anime_id, locale, translation_status FROM anime_translations'
        )
          .all<{ anime_id: string; locale: string; translation_status: string }>()
          .catch(() => ({ results: [] })),
        env.DB.prepare(
          'SELECT anime_id, availability_status, verified_at FROM anime_dub_matrix'
        )
          .all<{ anime_id: string; availability_status: string; verified_at: string | null }>()
          .catch(() => ({ results: [] })),
        env.DB.prepare(
          'SELECT id, franchise_key, franchise_title, anime_id, relation_type, watch_order FROM anime_franchise_links'
        )
          .all<Record<string, any>>()
          .catch(() => ({ results: [] })),
        env.DB.prepare(
          'SELECT id, anime_id, character_name, voice_actor_name, COALESCE(dub_language, language) as language, verified FROM anime_cast_entries'
        )
          .all<Record<string, any>>()
          .catch(() => ({ results: [] })),
      ]);

      const baseReport = scanCatalogDataHealth(
        animeRows,
        trRes.results || [],
        dmRes.results || []
      );

      const extendedReport = scanExtendedDataHealth({
        animeRows: animeRows.map((a) => ({
          id: Number(a.id),
          title: String(a.title || ''),
          slug: a.slug ? String(a.slug) : null,
          mal_id: a.mal_id ?? null,
          anilist_id: a.anilist_id ?? null,
          external_id: a.external_id ?? null,
        })),
        franchiseRows: (frRes.results || []).map((f) => ({
          id: Number(f.id) || undefined,
          franchise_key: String(f.franchise_key || ''),
          franchise_title: f.franchise_title ? String(f.franchise_title) : null,
          anime_id: Number(f.anime_id),
          relation_type: f.relation_type ? String(f.relation_type) : null,
          watch_order: Number(f.watch_order) || 1,
        })),
        castRows: (castRes.results || []).map((c) => ({
          id: Number(c.id),
          anime_id: Number(c.anime_id),
          character_name: String(c.character_name || ''),
          voice_actor_name: String(c.voice_actor_name || ''),
          language: String(c.language || 'Hindi'),
          verified: Number(c.verified) === 1 || c.verified === true,
        })),
      });

      const report = {
        ...baseReport,
        categoryCounts: {
          ...baseReport.categoryCounts,
          orphan_franchise_links: extendedReport.orphanFranchiseLinks.length,
          conflicting_watch_order: extendedReport.conflictingWatchOrders.length,
          unverified_cast_entries: extendedReport.unverifiedCastEntries.length,
          missing_external_ids: extendedReport.missingExternalIds.length,
        },
        countsByCategory: {
          ...baseReport.countsByCategory,
          orphan_franchise_links: extendedReport.orphanFranchiseLinks.length,
          conflicting_watch_order: extendedReport.conflictingWatchOrders.length,
          unverified_cast_entries: extendedReport.unverifiedCastEntries.length,
          missing_external_ids: extendedReport.missingExternalIds.length,
        },
        extended: extendedReport,
      };

      return jsonResponse(
        {
          success: true,
          report,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse(
        { success: false, error: getErrorMessage(err) },
        500,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }
  }

  // ===========================================================================
  // 4. WORKERS AI TRANSLATION STUDIO:
  //    - POST  /api/admin/translations/generate
  //    - PATCH /api/admin/translations/:animeId/:locale/lock
  // ===========================================================================
  if (path === '/api/admin/translations/generate' && method === 'POST') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    let body: Record<string, any>;
    try {
      body = (await request.json()) as Record<string, any>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON request body.' }, 400, request);
    }

    const animeId = String(body.anime_id ?? body.animeId ?? '').trim();
    const locale = normalizeTranslationLocale(String(body.locale || ''));
    const forceUnlock = Boolean(body.forceUnlock);

    if (!animeId || !locale || locale === 'en') {
      return jsonResponse(
        {
          success: false,
          error: 'Valid anime_id and target regional locale (ta, hi, te, ml, kn, bn) are required.',
        },
        400,
        request
      );
    }

    const LOCALE_NAMES: Record<string, { english: string; native: string }> = {
      ta: { english: 'Tamil', native: 'தமிழ்' },
      hi: { english: 'Hindi', native: 'हिन्दी' },
      te: { english: 'Telugu', native: 'తెలుగు' },
      ml: { english: 'Malayalam', native: 'മലയാളം' },
      kn: { english: 'Kannada', native: 'ಕನ್ನಡ' },
      bn: { english: 'Bengali', native: 'বাংলা' },
    };

    try {
      let englishTitle = String(body.title || '').trim();
      let englishSynopsis = String(body.synopsis || '').trim();

      if (env.DB) {
        const animeRow = await env.DB.prepare(
          'SELECT id, title, synopsis, description FROM anime WHERE id = ? OR slug = ? LIMIT 1'
        )
          .bind(animeId, animeId)
          .first<Record<string, any>>();
        if (animeRow) {
          if (!englishTitle) englishTitle = String(animeRow.title || '');
          if (!englishSynopsis) {
            englishSynopsis = String(animeRow.synopsis || animeRow.description || '');
          }
        }

        // Check if manual edit lock is active & fetch previous synopsis for version history
        let previousSynopsisText = '';
        try {
          const existing = await env.DB.prepare(
            'SELECT id, synopsis, is_locked, updated_by, translation_status FROM anime_translations WHERE anime_id = ? AND locale = ? LIMIT 1'
          )
            .bind(animeId, locale)
            .first<Record<string, any>>();
          if (existing) {
            previousSynopsisText = String(existing.synopsis || '');
            const isLocked =
              Number(existing.is_locked) === 1 ||
              existing.is_locked === true ||
              String(existing.updated_by || '').startsWith('LOCKED:');
            if (isLocked && !forceUnlock) {
              return jsonResponse(
                {
                  success: false,
                  locked: true,
                  error:
                    'This translation is locked ("Lock Manual Edit" is enabled) to prevent automatic overwrite. Unlock it first to regenerate.',
                },
                409,
                request
              );
            }
          }
        } catch {
          // If is_locked column is not yet added, proceed safely
        }

        // Enforce Workers AI Daily Cost Guard
        const aiUsageBefore = await getTodayAiUsage(env.DB);
        if (!aiUsageBefore.allowed) {
          return jsonResponse(
            {
              success: false,
              quotaExceeded: true,
              aiUsage: aiUsageBefore,
              error: `Daily Workers AI translation cap reached (${aiUsageBefore.usedToday} / ${aiUsageBefore.dailyCap} daily AI runs). Increase the daily cap or wait until tomorrow.`,
            },
            429,
            request
          );
        }

        if (previousSynopsisText.trim()) {
          await recordTranslationVersion(env.DB, {
            anime_id: Number(animeId) || 0,
            language_code: locale,
            synopsis_text: previousSynopsisText,
            source_type: 'pre_ai_backup',
            saved_by: auth.session.email || auth.session.userId || 'admin',
          });
        }
      }

      if (!englishSynopsis) {
        return jsonResponse(
          {
            success: false,
            error: 'Original English synopsis is empty. Add an English synopsis first before running Workers AI translation.',
          },
          400,
          request
        );
      }

      let generatedSynopsis = '';
      let generatedDescription = '';
      let usedWorkersAi = false;

      if (env.AI && typeof env.AI.run === 'function') {
        try {
          const m2mRes = await env.AI.run('@cf/meta/m2m100-1.2b', {
            text: englishSynopsis.slice(0, 1800),
            source_lang: 'en',
            target_lang: locale,
          });
          if (m2mRes && typeof m2mRes.translated_text === 'string' && m2mRes.translated_text.trim()) {
            generatedSynopsis = m2mRes.translated_text.trim();
            usedWorkersAi = true;
          }
        } catch (aiErr) {
          console.warn('[Workers AI m2m100 fallback]:', getErrorMessage(aiErr));
        }
      }

      if (!generatedSynopsis) {
        const meta = LOCALE_NAMES[locale] || { english: locale.toUpperCase(), native: locale };
        generatedSynopsis = `[${meta.native} · ${meta.english} Draft] ${englishSynopsis}`;
      }

      await incrementTodayAiUsage(env.DB);
      const aiUsageAfter = await getTodayAiUsage(env.DB);

      generatedDescription = generatedSynopsis.slice(0, 155).trim();

      let savedRecord: Record<string, any> | null = null;
      if (env.DB && body.saveDraft !== false) {
        const sourceHash = computeSourceHash(englishTitle, englishSynopsis);
        try {
          await env.DB.prepare(
            `INSERT INTO anime_translations (anime_id, locale, localized_title, synopsis, description, source_hash, translation_status, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, 'draft', datetime('now'))
             ON CONFLICT(anime_id, locale) DO UPDATE SET
               synopsis = excluded.synopsis,
               description = excluded.description,
               source_hash = excluded.source_hash,
               translation_status = 'draft',
               updated_at = datetime('now')`
          )
            .bind(animeId, locale, generatedSynopsis, generatedDescription, sourceHash)
            .run();

          savedRecord = await env.DB.prepare(
            'SELECT * FROM anime_translations WHERE anime_id = ? AND locale = ? LIMIT 1'
          )
            .bind(animeId, locale)
            .first();
        } catch (saveErr) {
          if (!isMissingTranslationsTableError(saveErr)) {
            console.warn('[Workers AI draft save warning]:', getErrorMessage(saveErr));
          }
        }

        await recordTranslationVersion(env.DB, {
          anime_id: Number(animeId) || 0,
          language_code: locale,
          synopsis_text: generatedSynopsis,
          source_type: usedWorkersAi ? 'workers_ai' : 'ai_draft',
          saved_by: auth.session.email || auth.session.userId || 'admin',
        });

        await recordAdminActivityLog(env.DB, {
          actor_id: auth.session.userId,
          actor_email: auth.session.email,
          action: 'WORKERS_AI_TRANSLATION_GENERATE',
          entity_type: 'anime_translations',
          entity_id: `${animeId}:${locale}`,
          summary: `Generated ${LOCALE_NAMES[locale]?.english || locale} synopsis via Workers AI for "${englishTitle || animeId}".`,
        });
      }

      return jsonResponse(
        {
          success: true,
          usedWorkersAi,
          anime_id: animeId,
          locale,
          synopsis: generatedSynopsis,
          description: generatedDescription,
          translation: savedRecord,
          aiUsage: aiUsageAfter,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  const lockMatch = path.match(
    /^\/api\/admin\/translations\/([0-9a-zA-Z_-]+)\/([a-zA-Z_-]+)\/lock\/?$/
  );
  if (lockMatch && (method === 'PATCH' || method === 'POST')) {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const animeId = decodeURIComponent(lockMatch[1]).trim();
    const locale = normalizeTranslationLocale(decodeURIComponent(lockMatch[2]));
    if (!animeId || !locale || locale === 'en') {
      return jsonResponse({ success: false, error: 'Invalid animeId or locale.' }, 400, request);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const locked = Boolean(body.locked ?? body.is_locked ?? true);

    if (env.DB) {
      try {
        try {
          await env.DB.prepare(
            "UPDATE anime_translations SET is_locked = ?, updated_at = datetime('now') WHERE anime_id = ? AND locale = ?"
          )
            .bind(locked ? 1 : 0, animeId, locale)
            .run();
        } catch (colErr) {
          if (isMissingColumnError(colErr)) {
            await env.DB.prepare(
              'ALTER TABLE anime_translations ADD COLUMN is_locked INTEGER DEFAULT 0'
            )
              .run()
              .catch(() => {});
            await env.DB.prepare(
              "UPDATE anime_translations SET is_locked = ?, updated_at = datetime('now') WHERE anime_id = ? AND locale = ?"
            )
              .bind(locked ? 1 : 0, animeId, locale)
              .run();
          } else if (!isMissingTranslationsTableError(colErr)) {
            throw colErr;
          }
        }

        await recordAdminActivityLog(env.DB, {
          actor_id: auth.session.userId,
          actor_email: auth.session.email,
          action: locked ? 'LOCK_TRANSLATION' : 'UNLOCK_TRANSLATION',
          entity_type: 'anime_translations',
          entity_id: `${animeId}:${locale}`,
          summary: `${locked ? 'Locked' : 'Unlocked'} manual translation edits for anime #${animeId} (${locale.toUpperCase()}).`,
        });
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
      }
    }

    return jsonResponse(
      {
        success: true,
        anime_id: animeId,
        locale,
        is_locked: locked,
      },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  // ===========================================================================
  // 5. UNIFIED MODERATION INBOX:
  //    - GET   /api/admin/moderation-inbox
  //    - PATCH /api/admin/dub-reviews/:id
  //    - PATCH /api/admin/reviews/:id
  // ===========================================================================
  if (path === '/api/admin/moderation-inbox' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse(
        {
          success: true,
          generalReviews: [],
          dubReviews: [],
          feedback: [],
          pendingAnime: [],
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    try {
      const [genRevRes, dubRevRes, fbRes, pendingRes] = await Promise.all([
        env.DB.prepare(
          `SELECT r.*, a.title as anime_title
           FROM reviews r
           LEFT JOIN anime a ON CAST(a.id AS TEXT) = CAST(r.anime_id AS TEXT)
           ORDER BY r.id DESC LIMIT 100`
        )
          .all<Record<string, any>>()
          .catch(() => ({ results: [] })),
        env.DB.prepare(
          `SELECT dr.*, a.title as anime_title
           FROM dub_reviews dr
           LEFT JOIN anime a ON CAST(a.id AS TEXT) = CAST(dr.anime_id AS TEXT)
           ORDER BY dr.updated_at DESC, dr.id DESC LIMIT 100`
        )
          .all<Record<string, any>>()
          .catch(() => ({ results: [] })),
        env.DB.prepare('SELECT * FROM feedback ORDER BY id DESC LIMIT 100')
          .all<Record<string, any>>()
          .catch(() => ({ results: [] })),
        env.DB.prepare(
          "SELECT * FROM anime WHERE status = 'pending' OR submissionStatus = 'pending' ORDER BY id DESC LIMIT 100"
        )
          .all<Record<string, any>>()
          .catch(() => ({ results: [] })),
      ]);

      return jsonResponse(
        {
          success: true,
          generalReviews: genRevRes.results || [],
          dubReviews: dubRevRes.results || [],
          feedback: fbRes.results || [],
          pendingAnime: pendingRes.results || [],
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  const dubReviewModMatch = path.match(/^\/api\/admin\/dub-reviews\/([0-9]+)\/?$/);
  if (dubReviewModMatch && (method === 'PATCH' || method === 'PUT')) {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const revId = Number(dubReviewModMatch[1]);
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const rawStatus = body.status ? String(body.status).trim().toLowerCase() : undefined;
    if (rawStatus && !['published', 'hidden', 'flagged'].includes(rawStatus)) {
      return jsonResponse(
        { success: false, error: "status must be 'published', 'hidden', or 'flagged'." },
        400,
        request
      );
    }

    const hasSpoilers =
      body.has_spoilers !== undefined ? (Boolean(body.has_spoilers) ? 1 : 0) : undefined;

    if (env.DB) {
      try {
        if (rawStatus !== undefined && hasSpoilers !== undefined) {
          await env.DB.prepare(
            "UPDATE dub_reviews SET status = ?, has_spoilers = ?, updated_at = datetime('now') WHERE id = ?"
          )
            .bind(rawStatus, hasSpoilers, revId)
            .run();
        } else if (rawStatus !== undefined) {
          await env.DB.prepare(
            "UPDATE dub_reviews SET status = ?, updated_at = datetime('now') WHERE id = ?"
          )
            .bind(rawStatus, revId)
            .run();
        } else if (hasSpoilers !== undefined) {
          await env.DB.prepare(
            "UPDATE dub_reviews SET has_spoilers = ?, updated_at = datetime('now') WHERE id = ?"
          )
            .bind(hasSpoilers, revId)
            .run();
        }

        await recordAdminActivityLog(env.DB, {
          actor_id: auth.session.userId,
          actor_email: auth.session.email,
          action: 'MODERATE_DUB_REVIEW',
          entity_type: 'dub_reviews',
          entity_id: revId,
          summary: `Updated 5-slider dub review #${revId} (${rawStatus ? `status=${rawStatus}` : ''}${hasSpoilers !== undefined ? ` spoilers=${Boolean(hasSpoilers)}` : ''}).`,
        });
      } catch (err) {
        if (!isMissingOpsProTableError(err)) {
          return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
        }
      }
    }

    return jsonResponse(
      {
        success: true,
        id: revId,
        ...(rawStatus ? { status: rawStatus } : {}),
        ...(hasSpoilers !== undefined ? { has_spoilers: Boolean(hasSpoilers) } : {}),
      },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  const genReviewModMatch = path.match(/^\/api\/admin\/reviews\/([0-9]+)\/?$/);
  if (genReviewModMatch && (method === 'PATCH' || method === 'DELETE')) {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const revId = Number(genReviewModMatch[1]);
    if (method === 'DELETE') {
      let recycleBinId: number | null = null;
      if (env.DB) {
        const existingRev = await env.DB.prepare('SELECT * FROM reviews WHERE id = ?')
          .bind(revId)
          .first<Record<string, unknown>>()
          .catch(() => null);

        if (existingRev) {
          recycleBinId = await archiveEntityToRecycleBin(env.DB, {
            entity_type: 'reviews',
            entity_id: revId,
            title: `Review by ${existingRev.username || existingRev.user_name || 'User'} (Anime #${existingRev.anime_id})`,
            payload: existingRev,
            deleted_by: auth.session.email || auth.session.userId || 'admin',
          });
        }

        await env.DB.prepare('DELETE FROM reviews WHERE id = ?')
          .bind(revId)
          .run()
          .catch(() => {});
        await recordAdminActivityLog(env.DB, {
          actor_id: auth.session.userId,
          actor_email: auth.session.email,
          action: 'DELETE_GENERAL_REVIEW',
          entity_type: 'reviews',
          entity_id: revId,
          summary: `Soft-deleted general community review #${revId} into Recycle Bin.`,
        });
      }
      return jsonResponse({ success: true, id: revId, deleted: true, recycleBinId }, 200, request);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const isSpoiler = body.is_spoiler !== undefined ? (Boolean(body.is_spoiler) ? 1 : 0) : undefined;
    const status = body.status ? String(body.status).trim().toLowerCase() : undefined;

    if (env.DB) {
      try {
        if (isSpoiler !== undefined) {
          await env.DB.prepare('UPDATE reviews SET is_spoiler = ? WHERE id = ?')
            .bind(isSpoiler, revId)
            .run()
            .catch(() => {});
        }
        if (status !== undefined) {
          try {
            await env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ?')
              .bind(status, revId)
              .run();
          } catch (colErr) {
            if (isMissingColumnError(colErr)) {
              await env.DB.prepare("ALTER TABLE reviews ADD COLUMN status TEXT DEFAULT 'published'")
                .run()
                .catch(() => {});
              await env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ?')
                .bind(status, revId)
                .run()
                .catch(() => {});
            }
          }
        }
        await recordAdminActivityLog(env.DB, {
          actor_id: auth.session.userId,
          actor_email: auth.session.email,
          action: 'MODERATE_GENERAL_REVIEW',
          entity_type: 'reviews',
          entity_id: revId,
          summary: `Moderated general review #${revId} (${status ? `status=${status}` : ''}${isSpoiler !== undefined ? ` spoiler=${Boolean(isSpoiler)}` : ''}).`,
        });
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
      }
    }

    return jsonResponse(
      {
        success: true,
        id: revId,
        ...(status ? { status } : {}),
        ...(isSpoiler !== undefined ? { is_spoiler: Boolean(isSpoiler) } : {}),
      },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  // ===========================================================================
  // 6. SAFE CSV IMPORT DRY-RUN: POST /api/admin/import-csv/dry-run
  // ===========================================================================
  if (path === '/api/admin/import-csv/dry-run' && method === 'POST') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, any>;
      const rawRows: Array<Record<string, any>> = Array.isArray(body)
        ? body
        : Array.isArray(body?.animeList)
          ? body.animeList
          : Array.isArray(body?.rows)
            ? body.rows
            : [];

      const existingTitles = new Set<string>();
      if (env.DB) {
        const res = await env.DB.prepare('SELECT title FROM anime')
          .all<{ title?: string }>()
          .catch(() => ({ results: [] }));
        for (const r of res.results || []) {
          if (r.title) existingTitles.add(String(r.title).trim().toLowerCase());
        }
      }

      const summary = validateCsvDryRunRows(rawRows, existingTitles);
      return jsonResponse(
        {
          success: true,
          dryRun: true,
          ...summary,
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
  // 7. ADMIN ACTIVITY LOG: GET & POST /api/admin/activity-logs
  // ===========================================================================
  if (path === '/api/admin/activity-logs' && method === 'GET') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    if (!env.DB) {
      return jsonResponse(
        { success: true, tableReady: false, logs: [] },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    }

    const actionFilter = (url.searchParams.get('action') || '').trim();
    const entityFilter = (url.searchParams.get('entityType') || '').trim();
    const searchFilter = (url.searchParams.get('search') || '').trim().toLowerCase();
    const rawLimit = Number(url.searchParams.get('limit') || 100);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 250) : 100;

    try {
      let tableReady = true;
      let logs: Array<Record<string, any>> = [];
      try {
        const res = await env.DB.prepare(
          'SELECT * FROM admin_activity_logs ORDER BY created_at DESC, id DESC LIMIT ?'
        )
          .bind(limit)
          .all();
        logs = res.results || [];
      } catch (tableErr) {
        if (isMissingOpsProTableError(tableErr)) {
          tableReady = false;
          logs = [];
        } else {
          throw tableErr;
        }
      }

      const filtered = logs.filter((log) => {
        if (actionFilter && actionFilter !== 'all' && String(log.action) !== actionFilter) {
          return false;
        }
        if (entityFilter && entityFilter !== 'all' && String(log.entity_type) !== entityFilter) {
          return false;
        }
        if (searchFilter) {
          const hay = `${log.action || ''} ${log.entity_type || ''} ${log.entity_id || ''} ${log.summary || ''} ${log.actor_email || ''}`.toLowerCase();
          if (!hay.includes(searchFilter)) return false;
        }
        return true;
      });

      return jsonResponse(
        {
          success: true,
          tableReady,
          logs: filtered,
        },
        200,
        request,
        { 'Cache-Control': 'no-store' }
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err), logs: [] }, 500, request);
    }
  }

  if (path === '/api/admin/activity-logs' && method === 'POST') {
    const auth = await requireStrictAdmin(ctx);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    if (!body.action || !body.entity_type) {
      return jsonResponse(
        { success: false, error: 'action and entity_type are required.' },
        400,
        request
      );
    }

    await recordAdminActivityLog(env.DB, {
      actor_id: auth.session.userId,
      actor_email: auth.session.email,
      action: String(body.action),
      entity_type: String(body.entity_type),
      entity_id: String(body.entity_id ?? 'global'),
      summary: String(body.summary || ''),
      diff_json: body.diff_json,
    });

    return jsonResponse({ success: true }, 200, request, { 'Cache-Control': 'no-store' });
  }

  return null;
}
