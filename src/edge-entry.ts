import { onRequest } from '../functions/api/[[route]]';
import { ChatRoom } from './chat-room';
import { isApprovedOrigin } from './utils/auth';
import {
  parseLanguageFromPath,
  resolveAnimeSeoResponse,
  resolveLanguageSeoResponse,
} from './utils/seoMeta';

export { ChatRoom };

interface EdgeEnv {
  DB: any;
  CHAT_ROOM?: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: any;
}

function getEdgeCorsHeaders(request: Request, env: EdgeEnv): Record<string, string> {
  const origin = request.headers.get('Origin') || request.headers.get('origin') || '';
  const resolvedOrigin =
    origin && isApprovedOrigin(origin, env)
      ? origin
      : 'https://anidub-india-a1y.pages.dev';

  return {
    Vary: 'Origin',
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection, x-device-id',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Unified Cloudflare Worker entry-point for `wrangler deploy`.
 * Exports `ChatRoom` Durable Object, routes `/api/*` and `/ws*` requests
 * to `functions/api/[[route]].ts`, and injects dynamic SEO meta tags via
 * `HTMLRewriter` for `/anime/*` and `/dubbed-anime/*` routes.
 */
export default {
  async fetch(request: Request, env: EdgeEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getEdgeCorsHeaders(request, env),
      });
    }

    if (
      url.pathname === '/api' ||
      url.pathname.startsWith('/api/') ||
      url.pathname === '/ws' ||
      url.pathname.startsWith('/ws/')
    ) {
      return onRequest({ request, env });
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const isGetOrHead = request.method === 'GET' || request.method === 'HEAD';
      if (isGetOrHead && url.pathname.startsWith('/anime/')) {
        const idOrSlug = decodeURIComponent(
          url.pathname.replace(/^\/anime\//, '').split('/')[0] || ''
        ).trim();
        const baseRes = await env.ASSETS.fetch(
          new Request(new URL('/index.html', url.origin), {
            method: 'GET',
            headers: request.headers,
          })
        );
        return resolveAnimeSeoResponse({
          request,
          db: env.DB ?? null,
          idOrSlug,
          baseHtmlResponse: baseRes,
        });
      }

      if (isGetOrHead && url.pathname.startsWith('/dubbed-anime/')) {
        const parsedLang = parseLanguageFromPath(url.pathname);
        if (parsedLang) {
          const baseRes = await env.ASSETS.fetch(
            new Request(new URL('/index.html', url.origin), {
              method: 'GET',
              headers: request.headers,
            })
          );
          return resolveLanguageSeoResponse({
            request,
            languageSlug: parsedLang.slug,
            baseHtmlResponse: baseRes,
          });
        }
      }

      return env.ASSETS.fetch(request);
    }

    return new Response(JSON.stringify({ ok: false, error: 'Static assets binding (ASSETS) is not configured.' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...getEdgeCorsHeaders(request, env),
      },
    });
  },
};



