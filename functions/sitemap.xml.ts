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
  }

  const origin = new URL(request.url).origin;
  const xml = buildDynamicSitemapXml(animeRows, origin);

  return new Response(request.method === 'HEAD' ? null : xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
