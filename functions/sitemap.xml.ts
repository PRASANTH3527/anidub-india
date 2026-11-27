import { buildDynamicSitemapXml, type SitemapAnimeRow } from '../src/utils/seoMeta';

export interface D1SitemapDbLike {
  prepare: (sql: string) => {
    all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
  };
}

export interface PagesSitemapContext {
  request: Request;
  env: {
    DB?: D1SitemapDbLike | null;
  };
}

export async function onRequest(context: PagesSitemapContext): Promise<Response> {
  const { request, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let animeRows: SitemapAnimeRow[] = [];
  const publishedTranslationsByAnimeId = new Map<string, string[]>();
  if (env?.DB && typeof env.DB.prepare === 'function') {
    try {
      const result = await env.DB.prepare(
        "SELECT id, slug, created_at FROM anime WHERE (is_published = 1 OR is_published = true) AND (status IS NULL OR status != 'pending') ORDER BY popularity DESC, id DESC"
      ).all<SitemapAnimeRow>();
      if (Array.isArray(result?.results)) {
        animeRows = result.results;
      }
    } catch {
      animeRows = [];
    }

    try {
      const trResult = await env.DB.prepare(
        "SELECT at.anime_id, at.locale FROM anime_translations at INNER JOIN anime a ON CAST(a.id AS TEXT) = at.anime_id WHERE (a.is_published = 1 OR a.is_published = true) AND (a.status IS NULL OR a.status != 'pending') AND at.translation_status = 'published'"
      ).all<{ anime_id?: string | number; locale?: string }>();
      for (const tr of trResult?.results || []) {
        const aId = tr?.anime_id !== undefined && tr?.anime_id !== null ? String(tr.anime_id) : '';
        const loc = typeof tr?.locale === 'string' ? tr.locale.trim().toLowerCase() : '';
        if (!aId || !loc) continue;
        const list = publishedTranslationsByAnimeId.get(aId) || [];
        if (!list.includes(loc)) list.push(loc);
        publishedTranslationsByAnimeId.set(aId, list);
      }
    } catch {
      // Gracefully omit localized sitemap alternates if anime_translations is not yet migrated
    }
  }

  const origin = new URL(request.url).origin;
  const xml = buildDynamicSitemapXml(animeRows, origin, publishedTranslationsByAnimeId);

  return new Response(request.method === 'HEAD' ? null : xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
